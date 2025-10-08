// src/firebaseHelpers/acompanamientos.ts - VERSIÓN COMPLETA Y CORREGIDA CON SOPORTE PARA CICLOS OPR INDEPENDIENTES

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  Timestamp,
  writeBatch,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';

import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';

import { auth, db } from './config';
import { AcompanamientoDocente, CicloOPR } from '../../types';

// ✅ Storage inicializado desde la app configurada
const storage = getStorage();

// =========================
// CONSTANTES DE COLECCIONES
// =========================
const ACOMPANAMIENTOS_COLLECTION = 'acompanamientos';
const CICLOS_OPR_COLLECTION = 'ciclos_opr';

// =========================
// UTILIDADES DE FECHAS Y PATHS
// =========================

const normalizeFecha = (fecha: any): string => {
  if (!fecha) return new Date().toISOString().split('T')[0];
  if (typeof fecha === 'string') {
    return fecha.includes('T') ? fecha.split('T')[0] : fecha;
  }
  if (typeof fecha?.toDate === 'function') {
    return fecha.toDate().toISOString().split('T')[0];
  }
  try {
    return new Date(fecha).toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

/** Sanitiza nombres de archivo evitando caracteres problemáticos */
const sanitizeFileName = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.');
  const name = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  const extension = lastDot > 0 ? fileName.substring(lastDot) : '';
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
  return cleanName + extension.toLowerCase();
};

/** Construye un path seguro para Firebase Storage */
const buildSecurePath = (acompId: string, cicloId: string, fileName: string): string => {
  const sanitizedAcompId = (acompId || 'general').replace(/[^a-zA-Z0-9-]/g, '_');
  const sanitizedCicloId = (cicloId || 'temp').replace(/[^a-zA-Z0-9-]/g, '_');
  const sanitizedFileName = sanitizeFileName(fileName);
  return `videos_opr/${sanitizedAcompId}/${sanitizedCicloId}/${sanitizedFileName}`;
};

/** Extrae el storage path desde una downloadURL pública */
export const storagePathFromDownloadURL = (url: string): string | null => {
  try {
    const u = new URL(url);
    const afterO = u.pathname.split('/o/')[1];
    if (!afterO) return null;
    return decodeURIComponent(afterO.split('?')[0]);
  } catch {
    return null;
  }
};

/** Prefijo de carpeta para los archivos de un ciclo */
export const getCicloStoragePrefix = (acompanamientoId: string, cicloId: string) => {
  const a = (acompanamientoId || 'general').replace(/[^a-zA-Z0-9-]/g, '_');
  const c = (cicloId || 'temp').replace(/[^a-zA-Z0-9-]/g, '_');
  return `videos_opr/${a}/${c}/`;
};

// =========================
// SUBIDA DE ARCHIVOS
// =========================

export const uploadFileImproved = async (
  file: File,
  requestedPath: string,
  onProgress?: (progressPercent: number) => void
): Promise<string> => {
  try {
    // Validaciones mínimas
    if (!auth.currentUser) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión nuevamente.');
    }
    if (!file) {
      throw new Error('No se proporcionó un archivo válido.');
    }

    const allowedTypes = [
      'video/mp4',
      'video/quicktime',  // .mov
      'video/x-msvideo',  // .avi
      'video/x-m4v',      // .m4v
    ];
    const MAX_SIZE = 500 * 1024 * 1024; // 500MB

    if (file.size > MAX_SIZE) {
      throw new Error(`El archivo es demasiado grande. Máximo permitido: ${(MAX_SIZE / 1024 / 1024).toFixed(0)}MB`);
    }
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no permitido. Solo se aceptan MP4, MOV, AVI o M4V.');
    }

    // Resolver ruta final: requiere acompanamientoId y cicloId en requestedPath
    let finalPath = '';
    const parts = (requestedPath || '').split('/');
    if (parts.length >= 4 && parts[0] === 'videos_opr') {
      const acompId = parts[1];
      const cicloId = parts[2];
      const fileName = parts.slice(3).join('/');
      finalPath = buildSecurePath(acompId, cicloId, fileName);
    } else {
      // Fallback: solo en caso de que se intente subir antes de tener IDs
      const timestamp = Date.now();
      const sanitizedName = sanitizeFileName(file.name);
      finalPath = `videos_opr/general/${timestamp}_${sanitizedName}`;
    }

    const storageRef = ref(storage, finalPath);
    const metadata = {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000',
      customMetadata: {
        originalName: file.name,
        uploadedBy: auth.currentUser.uid,
        uploadDate: new Date().toISOString(),
        fileSize: String(file.size),
      },
    };

    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    return new Promise<string>((resolve, reject) => {
      let lastReportedProgress = -1;

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const progressRounded = Math.floor(progress);
          if (onProgress && progressRounded !== lastReportedProgress) {
            lastReportedProgress = progressRounded;
            onProgress(progressRounded);
          }
        },
        (error: any) => {
          let errorMessage = 'Error desconocido durante la subida.';
          switch (error?.code) {
            case 'storage/unauthorized':
              errorMessage = 'No tienes permisos para subir archivos. Verifica las reglas de Firebase Storage.';
              break;
            case 'storage/canceled':
              errorMessage = 'La subida fue cancelada por el usuario.';
              break;
            case 'storage/quota-exceeded':
              errorMessage = 'Se agotó el espacio de almacenamiento disponible.';
              break;
            case 'storage/retry-limit-exceeded':
              errorMessage = 'Se agotaron los reintentos. Verifica tu conexión a internet.';
              break;
            default:
              if (error?.message) errorMessage = error.message;
              break;
          }
          reject(new Error(errorMessage));
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (urlError: any) {
            reject(new Error('El archivo se subió, pero no se pudo obtener la URL de descarga.'));
          }
        }
      );
    });

  } catch (error: any) {
    const errorMessage = error?.message || 'Error inesperado al procesar el archivo.';
    throw new Error(errorMessage);
  }
};

/** Elimina un archivo (recibe path en Storage, no la URL) */
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    if (!auth.currentUser) throw new Error('Usuario no autenticado');
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
  } catch (error: any) {
    if (error?.code === 'storage/object-not-found') return;
    throw new Error('Error al eliminar el archivo del almacenamiento');
  }
};

/** Elimina en cascada todos los archivos debajo de un prefijo (carpeta) */
const listAndDeleteFolder = async (prefix: string): Promise<void> => {
  try {
    const folderRef = ref(storage, prefix);
    const { items, prefixes } = await listAll(folderRef);
    await Promise.all(items.map((it) => deleteObject(it)));
    await Promise.all(prefixes.map((p) => listAndDeleteFolder(p.fullPath)));
  } catch (_err) {
    // swallow
  }
};

// =========================
// ACOMPAÑAMIENTOS (CRUD)
// =========================

export const getAllAcompanamientos = async (): Promise<AcompanamientoDocente[]> => {
  try {
    const q = query(collection(db, ACOMPANAMIENTOS_COLLECTION), orderBy('fecha', 'desc'));
    const querySnapshot = await getDocs(q);
    const acompanamientos = querySnapshot.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
        fecha: normalizeFecha(data?.fecha),
      } as AcompanamientoDocente;
    });
    return acompanamientos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  } catch (_err) {
    throw new Error('No se pudieron cargar los acompañamientos');
  }
};

export const createAcompanamiento = async (
  acompanamiento: Omit<AcompanamientoDocente, 'id'>
): Promise<AcompanamientoDocente> => {
  try {
    const docenteEmailLower = (acompanamiento as any).docenteEmailLower || auth.currentUser?.email?.toLowerCase() || undefined;
    const dataToSave = {
      ...acompanamiento,
      docenteEmailLower,
      fecha: Timestamp.fromDate(new Date(acompanamiento.fecha)),
      fechaCreacion: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, ACOMPANAMIENTOS_COLLECTION), dataToSave);
    const newAcompanamiento: AcompanamientoDocente = {
      ...acompanamiento,
      id: docRef.id,
      fecha: normalizeFecha(acompanamiento.fecha),
    };
    return newAcompanamiento;
  } catch (_err) {
    throw new Error('No se pudo crear el acompañamiento');
  }
};

export const updateAcompanamiento = async (
  id: string,
  updates: Partial<Omit<AcompanamientoDocente, 'id'>>
): Promise<void> => {
  try {
    const dataToUpdate = {
      ...updates,
      ...(updates.fecha ? { fecha: Timestamp.fromDate(new Date(updates.fecha)) } : {}),
      fechaModificacion: Timestamp.now(),
    };
    await updateDoc(doc(db, ACOMPANAMIENTOS_COLLECTION, id), dataToUpdate);
  } catch (_err) {
    throw new Error('No se pudo actualizar el acompañamiento');
  }
};

export const deleteAcompanamiento = async (id: string): Promise<void> => {
  try {
    // 1) Eliminar ciclos asociados
    const ciclosQ = query(collection(db, CICLOS_OPR_COLLECTION), where('acompanamientoId', '==', id));
    const snap = await getDocs(ciclosQ);
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(doc(db, CICLOS_OPR_COLLECTION, d.id)));
    await batch.commit();

    // 2) Eliminar archivos en Storage bajo la carpeta del acompañamiento
    await listAndDeleteFolder(`videos_opr/${id}`);

    // 3) Eliminar el acompañamiento
    await deleteDoc(doc(db, ACOMPANAMIENTOS_COLLECTION, id));
  } catch (_err) {
    throw new Error('No se pudo eliminar el acompañamiento y sus datos asociados');
  }
};

// =========================
// CICLOS OPR (CRUD)
// =========================

export const createCicloOPR = async (ciclo: Omit<CicloOPR, 'id'>): Promise<CicloOPR> => {
  try {
    if (!ciclo?.fecha) {
      throw new Error('Falta fecha al crear ciclo OPR.');
    }

    const dataToSave: any = {
      ...ciclo,
      acompanamientoId: String(ciclo.acompanamientoId || ''), // Puede ser string vacío para ciclos independientes
      fecha: Timestamp.fromDate(new Date(ciclo.fecha)),
      fechaCreacion: Timestamp.now(),
      ...(ciclo as any).docenteEmailLower ? { docenteEmailLower: (ciclo as any).docenteEmailLower } : {},
    };

    if ((ciclo as any)?.seguimiento?.fecha) {
      dataToSave.seguimiento = {
        ...(ciclo as any).seguimiento,
        fecha: Timestamp.fromDate(new Date((ciclo as any).seguimiento.fecha)),
      };
    }

    const docRef = await addDoc(collection(db, CICLOS_OPR_COLLECTION), dataToSave);

    const newCiclo: CicloOPR = {
      ...ciclo,
      id: docRef.id,
      acompanamientoId: String(ciclo.acompanamientoId || ''),
      fecha: normalizeFecha(ciclo.fecha),
    };

    return newCiclo;
  } catch (_err) {
    throw new Error('No se pudo crear el ciclo OPR');
  }
};

export const updateCicloOPR = async (
  id: string,
  updates: Partial<Omit<CicloOPR, 'id'>>
): Promise<void> => {
  try {
    const dataToUpdate: any = { ...updates };
    if (updates.fecha) dataToUpdate.fecha = Timestamp.fromDate(new Date(updates.fecha));
    if ((updates as any).seguimiento?.fecha) {
      dataToUpdate.seguimiento = {
        ...(updates as any).seguimiento,
        fecha: Timestamp.fromDate(new Date((updates as any).seguimiento.fecha)),
      };
    }
    dataToUpdate.fechaModificacion = Timestamp.now();
    await updateDoc(doc(db, CICLOS_OPR_COLLECTION, id), dataToUpdate);
  } catch (_err) {
    throw new Error('No se pudo actualizar el ciclo OPR');
  }
};

export const getCiclosOPRByAcompanamiento = async (acompanamientoId: string): Promise<CicloOPR[]> => {
  try {
    const q = query(
      collection(db, CICLOS_OPR_COLLECTION),
      where('acompanamientoId', '==', acompanamientoId),
      orderBy('fecha', 'desc')
    );

    const snapshot = await getDocs(q);
    const ciclos = snapshot.docs.map((d) => {
      const data = d.data() as any;
      const base: CicloOPR = {
        id: d.id,
        ...data,
        fecha: normalizeFecha(data?.fecha),
      };
      if (data?.seguimiento?.fecha) {
        (base as any).seguimiento = {
          ...data.seguimiento,
          fecha: normalizeFecha(data.seguimiento.fecha),
        };
      }
      return base;
    });
    return ciclos;
  } catch (_err) {
    // Posible falta de índice compuesto
    throw new Error('No se pudieron cargar los ciclos OPR. Revisa el índice compuesto (acompanamientoId + fecha).');
  }
};

/** Get all standalone OPR cycles (cycles without acompanamientoId) */
export const getStandaloneCiclosOPR = async (): Promise<CicloOPR[]> => {
  try {
    const q = query(
      collection(db, CICLOS_OPR_COLLECTION),
      where('acompanamientoId', '==', ''), // Empty string for standalone cycles
      orderBy('fecha', 'desc')
    );

    const snapshot = await getDocs(q);
    const ciclos = snapshot.docs.map((d) => {
      const data = d.data() as any;
      const base: CicloOPR = {
        id: d.id,
        ...data,
        fecha: normalizeFecha(data?.fecha),
      };
      if (data?.seguimiento?.fecha) {
        (base as any).seguimiento = {
          ...data.seguimiento,
          fecha: normalizeFecha(data.seguimiento.fecha),
        };
      }
      return base;
    });
    return ciclos;
  } catch (error) {
    console.error('Error fetching standalone OPR cycles:', error);
    throw new Error('No se pudieron cargar los ciclos OPR independientes.');
  }
};

/** Get all OPR cycles (both standalone and associated) */
export const getAllCiclosOPR = async (): Promise<CicloOPR[]> => {
  try {
    const q = query(
      collection(db, CICLOS_OPR_COLLECTION),
      orderBy('fecha', 'desc')
    );

    const snapshot = await getDocs(q);
    const ciclos = snapshot.docs.map((d) => {
      const data = d.data() as any;
      const base: CicloOPR = {
        id: d.id,
        ...data,
        fecha: normalizeFecha(data?.fecha),
      };
      if (data?.seguimiento?.fecha) {
        (base as any).seguimiento = {
          ...data.seguimiento,
          fecha: normalizeFecha(data.seguimiento.fecha),
        };
      }
      return base;
    });
    return ciclos;
  } catch (error) {
    console.error('Error fetching all OPR cycles:', error);
    throw new Error('No se pudieron cargar los ciclos OPR.');
  }
};

/** Suscripción en tiempo real opcional */
export const subscribeToCiclosOPRByAcompanamiento = (
  acompanamientoId: string,
  onChange: (ciclos: CicloOPR[]) => void,
  onError?: (err: any) => void
) => {
  const qy = query(
    collection(db, CICLOS_OPR_COLLECTION),
    where('acompanamientoId', '==', acompanamientoId),
    orderBy('fecha', 'desc')
  );

  return onSnapshot(
    qy,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const ciclos = snapshot.docs.map((d) => {
        const data = d.data() as any;
        const base: CicloOPR = {
          id: d.id,
          ...data,
          fecha: normalizeFecha(data?.fecha),
        };
        if (data?.seguimiento?.fecha) {
          (base as any).seguimiento = {
            ...data.seguimiento,
            fecha: normalizeFecha(data.seguimiento.fecha),
          };
        }
        return base;
      });
      onChange(ciclos);
    },
    (err) => onError?.(err)
  );
};

export const deleteCicloOPR = async (id: string): Promise<void> => {
  try {
    const d = await getDoc(doc(db, CICLOS_OPR_COLLECTION, id));
    if (!d.exists()) return;

    const ciclo = d.data() as any;
    const acompanamientoId = ciclo?.acompanamientoId || 'general';

    await listAndDeleteFolder(`videos_opr/${acompanamientoId}/${id}`);
    await deleteDoc(doc(db, CICLOS_OPR_COLLECTION, id));
  } catch (_err) {
    throw new Error('No se pudo eliminar el ciclo OPR');
  }
};

// =========================
// MANTENCIÓN / REPARACIÓN
// =========================

/**
 * Repara ciclos OPR asociados a un acompañamiento, completando campos de propiedad/visibilidad
 * para cumplir con las reglas de lectura por parte del docente:
 * - docenteEmailLower
 * - docenteInfo (nombre del docente)
 * - docente (nombre del docente)
 * - cursoInfo, asignaturaInfo (opcional, útil para consistencia)
 */
export const repairCiclosOPRForAcompanamiento = async (
  acompanamiento: AcompanamientoDocente
): Promise<{ updated: number; total: number }> => {
  const acompId = acompanamiento.id;
  if (!acompId) return { updated: 0, total: 0 };

  const ciclosQ = query(
    collection(db, CICLOS_OPR_COLLECTION),
    where('acompanamientoId', '==', acompId)
  );
  const snap = await getDocs(ciclosQ);

  if (snap.empty) return { updated: 0, total: 0 };

  const batch = writeBatch(db);
  let updatesCount = 0;

  snap.forEach((d) => {
    const data = d.data() as any;
    const toUpdate: Record<string, any> = {};

    if (!data.docenteEmailLower && (acompanamiento as any).docenteEmailLower) {
      toUpdate.docenteEmailLower = (acompanamiento as any).docenteEmailLower;
    }
    if (!data.docenteInfo && acompanamiento.docente) {
      toUpdate.docenteInfo = acompanamiento.docente;
    }
    if (!data.docente && acompanamiento.docente) {
      toUpdate.docente = acompanamiento.docente;
    }
    if (!data.cursoInfo && acompanamiento.curso) {
      toUpdate.cursoInfo = acompanamiento.curso;
    }
    if (!data.asignaturaInfo && acompanamiento.asignatura) {
      toUpdate.asignaturaInfo = acompanamiento.asignatura;
    }

    if (Object.keys(toUpdate).length > 0) {
      updatesCount++;
      batch.update(doc(db, CICLOS_OPR_COLLECTION, d.id), toUpdate);
    }
  });

  if (updatesCount > 0) {
    await batch.commit();
  }

  return { updated: updatesCount, total: snap.size };
};

// =========================
// UTILIDADES EXPORTADAS
// =========================

export const getFileInfo = (file: File) => ({
  name: file.name,
  size: file.size,
  sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
  type: file.type,
  lastModified: new Date(file.lastModified).toLocaleString(),
  sanitizedName: sanitizeFileName(file.name),
});

export const canAccessAcompanamiento = (
  acompanamiento: AcompanamientoDocente,
  currentUser: { nombreCompleto: string; profile: string }
): boolean => {
  if (currentUser.profile === 'ADMINISTRADOR') return true;
  if (currentUser.profile === 'PROFESORADO' && acompanamiento.docente === currentUser.nombreCompleto) return true;
  return false;
};

export const getAcompanamientosByDocente = async (
  nombreDocente: string
): Promise<AcompanamientoDocente[]> => {
  try {
    const q = query(
      collection(db, ACOMPANAMIENTOS_COLLECTION),
      where('docente', '==', nombreDocente),
      orderBy('fecha', 'desc')
    );
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
        fecha: normalizeFecha(data?.fecha),
      } as AcompanamientoDocente;
    });
  } catch (_err) {
    throw new Error('No se pudieron cargar los acompañamientos del docente');
  }
};

export const getAcompanamientosByEmail = async (
  emailLower: string
): Promise<AcompanamientoDocente[]> => {
  try {
    const q = query(
      collection(db, ACOMPANAMIENTOS_COLLECTION),
      where('docenteEmailLower', '==', emailLower),
      orderBy('fecha', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
        fecha: normalizeFecha(data?.fecha),
      } as AcompanamientoDocente;
    });
  } catch (_err) {
    throw new Error('No se pudieron cargar los acompañamientos del docente');
  }
};

export const getRubricaPersonalizada = async (
  nombreDocente: string
): Promise<any | null> => {
  try {
    const q = query(
      collection(db, 'rubricas_personalizadas'),
      where('docente', '==', nombreDocente)
    );
    const snap = await getDocs(q);

    if (snap.empty) return null;

    const data = snap.docs[0].data() as any;
    return data?.rubrica ?? null;
  } catch (_err) {
    return null;
  }
};

/** Depurar configuración de Storage/Firestore */
export const debugStorageConfig = () => {
  // @ts-ignore
  const bucket = storage.app.options?.storageBucket;
  // @ts-ignore
  const projectId = storage.app.options?.projectId;
  // @ts-ignore
  const appName = storage.app.name;
  const info = { bucket, projectId, appName };
  console.log('DEBUG Storage Config:', info);
  return info;
};

// Mantener compatibilidad con código existente
export const uploadFile = uploadFileImproved;
