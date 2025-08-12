// src/firebaseHelpers/acompanamientos.ts - VERSIÓN COMPLETA Y CORREGIDA

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

// ✅ CRÍTICO: Obtener storage desde la configuración correcta
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

// =========================
// SUBIDA DE ARCHIVOS COMPLETAMENTE CORREGIDA
// =========================

export const uploadFileImproved = async (
  file: File,
  requestedPath: string,
  onProgress?: (progressPercent: number) => void
): Promise<string> => {
  try {
    // 🔍 DEBUG: Verificar configuración de Storage
    console.log('🔍 DEBUG - Storage configurado:', {
      bucket: storage.app.options.storageBucket,
      app: storage.app.name
    });
    console.log('🔍 DEBUG - Path solicitado:', requestedPath);
    
    // Validaciones de autenticación y archivo
    if (!auth.currentUser) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión nuevamente.');
    }
    if (!file) {
      throw new Error('No se proporcionó un archivo válido.');
    }

    // Validaciones de archivo
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

    console.log('📹 Iniciando subida:', {
      nombre: file.name,
      tamaño: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      tipo: file.type,
      pathSolicitado: requestedPath
    });

    // Resolver ruta final
    let finalPath = '';
    const parts = (requestedPath || '').split('/');
    if (parts.length >= 4 && parts[0] === 'videos_opr') {
      const acompId = parts[1];
      const cicloId = parts[2];
      const fileName = parts.slice(3).join('/');
      finalPath = buildSecurePath(acompId, cicloId, fileName);
    } else {
      const timestamp = Date.now();
      const sanitizedName = sanitizeFileName(file.name);
      finalPath = `videos_opr/general/${timestamp}_${sanitizedName}`;
    }

    console.log('📁 Path final sanitizado:', finalPath);

    // ✅ CRÍTICO: Crear referencia usando Firebase Storage SDK
    const storageRef = ref(storage, finalPath);
    
    // 🔍 DEBUG: Verificar referencia creada
    console.log('🔍 Storage ref creado:', {
      bucket: storageRef.bucket,
      fullPath: storageRef.fullPath,
      name: storageRef.name,
      toString: storageRef.toString()
    });

    // Metadata optimizada
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

    // ✅ CRÍTICO: Usar uploadBytesResumable del Firebase SDK
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    return new Promise<string>((resolve, reject) => {
      let lastReportedProgress = -1;

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Reportar progreso
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const progressRounded = Math.floor(progress);
          
          if (onProgress && progressRounded !== lastReportedProgress) {
            lastReportedProgress = progressRounded;
            onProgress(progressRounded);
            console.log(`📊 Progreso: ${progressRounded}%`);
          }
        },
        (error: any) => {
          console.error('❌ Error en la subida:', error);
          
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
            case 'storage/invalid-format':
              errorMessage = 'El formato del archivo no es válido para Firebase Storage.';
              break;
            case 'storage/unknown':
              errorMessage = 'Error desconocido del servidor de Firebase Storage.';
              break;
            default:
              const errorMsg = error?.message?.toLowerCase() || '';
              if (errorMsg.includes('cors')) {
                errorMessage = 'Error de configuración CORS. Verifica las reglas de Firebase Storage.';
              } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
                errorMessage = 'Error de conexión. Verifica tu internet e intenta nuevamente.';
              } else if (errorMsg.includes('permission') || errorMsg.includes('forbidden')) {
                errorMessage = 'Permisos insuficientes. Contacta al administrador del sistema.';
              } else if (error?.message) {
                errorMessage = `Error del servidor: ${error.message}`;
              }
              break;
          }
          
          reject(new Error(errorMessage));
        },
        async () => {
          try {
            // ✅ CRÍTICO: Obtener URL usando getDownloadURL del SDK
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            console.log('✅ Archivo subido exitosamente:', {
              path: finalPath,
              url: downloadURL,
              bucket: uploadTask.snapshot.ref.bucket,
              size: `${(uploadTask.snapshot.totalBytes / 1024 / 1024).toFixed(2)} MB`
            });
            
            resolve(downloadURL);
            
          } catch (urlError: any) {
            console.error('❌ Error al obtener URL de descarga:', urlError);
            reject(new Error('El archivo se subió correctamente, pero no se pudo obtener la URL de descarga. Intenta recargar la página.'));
          }
        }
      );
    });

  } catch (error: any) {
    console.error('❌ Error general en uploadFileImproved:', error);
    const errorMessage = error?.message || 'Error inesperado al procesar el archivo. Intenta nuevamente.';
    throw new Error(errorMessage);
  }
};

/** Elimina un archivo (recibe path en Storage, no la URL) */
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    if (!auth.currentUser) throw new Error('Usuario no autenticado');
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
    console.log('🗑️ Archivo eliminado:', filePath);
  } catch (error: any) {
    if (error?.code === 'storage/object-not-found') {
      console.warn('⚠️ El archivo no existe en Storage:', filePath);
      return;
    }
    console.error('❌ Error al eliminar archivo:', error);
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
  } catch (error) {
    console.warn('⚠️ Error al eliminar carpeta:', prefix, error);
  }
};

// =========================
// ACOMPAÑAMIENTOS (CRUD) - TODAS LAS FUNCIONES EXPORTADAS
// =========================

export const getAllAcompanamientos = async (): Promise<AcompanamientoDocente[]> => {
  try {
    console.log('📋 Obteniendo todos los acompañamientos...');
    
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
    
    console.log('✅ Acompañamientos obtenidos:', acompanamientos.length);
    return acompanamientos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  } catch (error) {
    console.error('❌ Error al obtener acompañamientos:', error);
    throw new Error('No se pudieron cargar los acompañamientos');
  }
};

export const createAcompanamiento = async (
  acompanamiento: Omit<AcompanamientoDocente, 'id'>
): Promise<AcompanamientoDocente> => {
  try {
    console.log('💾 Creando nuevo acompañamiento:', {
      docente: acompanamiento.docente,
      curso: acompanamiento.curso,
      asignatura: acompanamiento.asignatura
    });

    const dataToSave = {
      ...acompanamiento,
      fecha: Timestamp.fromDate(new Date(acompanamiento.fecha)),
      fechaCreacion: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, ACOMPANAMIENTOS_COLLECTION), dataToSave);
    
    const newAcompanamiento: AcompanamientoDocente = {
      ...acompanamiento,
      id: docRef.id,
      fecha: normalizeFecha(acompanamiento.fecha),
    };

    console.log('✅ Acompañamiento creado con ID:', docRef.id);
    return newAcompanamiento;
  } catch (error) {
    console.error('❌ Error al crear acompañamiento:', error);
    throw new Error('No se pudo crear el acompañamiento');
  }
};

export const updateAcompanamiento = async (
  id: string,
  updates: Partial<Omit<AcompanamientoDocente, 'id'>>
): Promise<void> => {
  try {
    console.log('🔄 Actualizando acompañamiento:', id);

    const dataToUpdate = {
      ...updates,
      ...(updates.fecha ? { fecha: Timestamp.fromDate(new Date(updates.fecha)) } : {}),
      fechaModificacion: Timestamp.now(),
    };
    
    await updateDoc(doc(db, ACOMPANAMIENTOS_COLLECTION, id), dataToUpdate);
    console.log('✅ Acompañamiento actualizado exitosamente');
  } catch (error) {
    console.error('❌ Error al actualizar acompañamiento:', error);
    throw new Error('No se pudo actualizar el acompañamiento');
  }
};

export const deleteAcompanamiento = async (id: string): Promise<void> => {
  try {
    console.log('🗑️ Eliminando acompañamiento:', id);

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

    console.log('✅ Acompañamiento eliminado con sus ciclos y archivos');
  } catch (error) {
    console.error('❌ Error al eliminar acompañamiento:', error);
    throw new Error('No se pudo eliminar el acompañamiento y sus datos asociados');
  }
};

// =========================
// CICLOS OPR (CRUD) - TODAS LAS FUNCIONES EXPORTADAS
// =========================

export const createCicloOPR = async (ciclo: Omit<CicloOPR, 'id'>): Promise<CicloOPR> => {
  try {
    console.log('💾 Creando nuevo ciclo OPR:', {
      nombre: ciclo.nombreCiclo,
      docente: ciclo.docenteInfo,
      acompanamientoId: ciclo.acompanamientoId
    });

    const dataToSave: any = {
      ...ciclo,
      fecha: Timestamp.fromDate(new Date(ciclo.fecha)),
      fechaCreacion: Timestamp.now(),
    };

    if (ciclo.seguimiento?.fecha) {
      dataToSave.seguimiento = {
        ...ciclo.seguimiento,
        fecha: Timestamp.fromDate(new Date(ciclo.seguimiento.fecha)),
      };
    }

    const docRef = await addDoc(collection(db, CICLOS_OPR_COLLECTION), dataToSave);
    
    const newCiclo: CicloOPR = {
      ...ciclo,
      id: docRef.id,
      fecha: normalizeFecha(ciclo.fecha)
    };

    console.log('✅ Ciclo OPR creado con ID:', docRef.id);
    return newCiclo;
  } catch (error) {
    console.error('❌ Error al crear ciclo OPR:', error);
    throw new Error('No se pudo crear el ciclo OPR');
  }
};

export const updateCicloOPR = async (
  id: string,
  updates: Partial<Omit<CicloOPR, 'id'>>
): Promise<void> => {
  try {
    console.log('🔄 Actualizando ciclo OPR:', id);

    const dataToUpdate: any = { ...updates };
    if (updates.fecha) dataToUpdate.fecha = Timestamp.fromDate(new Date(updates.fecha));
    if (updates.seguimiento?.fecha) {
      dataToUpdate.seguimiento = {
        ...updates.seguimiento,
        fecha: Timestamp.fromDate(new Date(updates.seguimiento.fecha)),
      };
    }
    dataToUpdate.fechaModificacion = Timestamp.now();
    
    await updateDoc(doc(db, CICLOS_OPR_COLLECTION, id), dataToUpdate);
    console.log('✅ Ciclo OPR actualizado exitosamente');
  } catch (error) {
    console.error('❌ Error al actualizar ciclo OPR:', error);
    throw new Error('No se pudo actualizar el ciclo OPR');
  }
};

export const getCiclosOPRByAcompanamiento = async (acompanamientoId: string): Promise<CicloOPR[]> => {
  try {
    console.log('📋 Obteniendo ciclos OPR para acompañamiento:', acompanamientoId);

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
        base.seguimiento = {
          ...data.seguimiento,
          fecha: normalizeFecha(data.seguimiento.fecha),
        };
      }
      return base;
    });
    
    console.log('✅ Ciclos OPR obtenidos:', ciclos.length);
    return ciclos;
  } catch (error) {
    console.error('❌ Error al obtener ciclos OPR:', error);
    throw new Error('No se pudieron cargar los ciclos OPR');
  }
};

export const deleteCicloOPR = async (id: string): Promise<void> => {
  try {
    console.log('🗑️ Eliminando ciclo OPR:', id);

    const d = await getDoc(doc(db, CICLOS_OPR_COLLECTION, id));
    if (!d.exists()) return;

    const ciclo = d.data() as any;
    const acompanamientoId = ciclo?.acompanamientoId || 'general';

    await listAndDeleteFolder(`videos_opr/${acompanamientoId}/${id}`);
    await deleteDoc(doc(db, CICLOS_OPR_COLLECTION, id));

    console.log('✅ Ciclo OPR eliminado con sus archivos');
  } catch (error) {
    console.error('❌ Error al eliminar ciclo OPR:', error);
    throw new Error('No se pudo eliminar el ciclo OPR');
  }
};

// =========================
// FUNCIONES DE UTILIDAD EXPORTADAS
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
  } catch (error) {
    console.error('❌ Error en getAcompanamientosByDocente:', error);
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
  } catch (error) {
    console.error('❌ Error en getRubricaPersonalizada:', error);
    return null;
  }
};

// =========================
// FUNCIONES DE DEPURACIÓN TEMPORAL
// =========================

/** Función para verificar configuración de Storage */
export const debugStorageConfig = () => {
  console.log('🔍 DEBUG Storage Config:', {
    bucket: storage.app.options.storageBucket,
    projectId: storage.app.options.projectId,
    appName: storage.app.name
  });
  return storage.app.options.storageBucket;
};

// Mantener compatibilidad con código existente
export const uploadFile = uploadFileImproved;
