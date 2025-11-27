// src/firebaseHelpers/actividadesRemotasHelper.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './config';
import {
  ActividadRemota,
  RespuestaEstudianteActividad,
  User,
  PruebaEstandarizada,
} from '../../types';

/* ============================ Constantes ============================ */
const ACTIVIDADES_COLLECTION = 'actividades_remotas';
const RESPUESTAS_COLLECTION = 'respuestas_actividades';
const PRUEBAS_ESTANDARIZADAS_COLLECTION = 'pruebas_estandarizadas';
const USERS_COLLECTION = 'usuarios';

/* ============================ Utilidades de fecha (robustas) ============================ */
const toDateObj = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'object') {
    if (typeof (v as any).toDate === 'function') {
      const d = (v as any).toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }
    if ('seconds' in v && 'nanoseconds' in v) {
      const ms = (v as any).seconds * 1000 + Math.floor((v as any).nanoseconds / 1e6);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
};

const toISO = (v: any): string | undefined => {
  const d = toDateObj(v);
  return d ? d.toISOString() : undefined;
};

const toYYYYMMDD = (v: any): string | undefined => {
  const d = toDateObj(v);
  return d ? d.toISOString().split('T')[0] : undefined;
};

const fromYYYYMMDDToTimestamp = (d?: string | null): Timestamp | null => {
  if (!d) return null;
  const date = new Date(`${d}T00:00:00`);
  if (isNaN(date.getTime())) return null;
  return Timestamp.fromDate(date);
};

const toTimestampFromISO = (iso?: string): Timestamp =>
  Timestamp.fromDate(new Date(iso || new Date().toISOString()));

/* ============================ Otras utilidades ============================ */
const isDataUrl = (url?: string) => !!url && /^data:/.test(url);

/** Elimina claves con undefined (Firestore no acepta undefined) */
const stripUndefined = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as unknown as T;
  const out: any = {};
  Object.entries(obj as any).forEach(([k, v]) => {
    if (v !== undefined) out[k] = stripUndefined(v);
  });
  return out;
};

/** Convierte data URL a Uint8Array para uploadBytes */
const dataUrlToUint8Array = (dataUrl: string): { bytes: Uint8Array; contentType: string } => {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Data URL inválida');
  const contentType = match[1] || 'application/octet-stream';
  const base64 = match[2];

  let binary = '';
  // @ts-ignore
  if (typeof atob === 'function') {
    // @ts-ignore
    binary = atob(base64);
  } else {
    // Node fallback (por si se usa en SSR)
    // @ts-ignore
    const Buf = typeof Buffer !== 'undefined' ? Buffer : null;
    if (Buf) {
      // @ts-ignore
      const buf = Buf.from(base64, 'base64');
      binary = buf.toString('binary');
    } else {
      throw new Error('No hay decodificador base64 disponible');
    }
  }

  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
};

/* ============================ Converters ============================ */
const convertActividadDoc = (snap: any): ActividadRemota => {
  const data = snap.data() || {};
  return {
    ...data,
    id: snap.id,
    // Siempre strings en el modelo que consume React:
    fechaCreacion: toISO(data.fechaCreacion) || new Date().toISOString(),
    plazoEntrega: toYYYYMMDD(data.plazoEntrega) || toYYYYMMDD(new Date())!,
  } as ActividadRemota;
};

const convertRespuestaDoc = (snap: any): RespuestaEstudianteActividad => {
  const data = snap.data() || {};
  return {
    ...data,
    id: snap.id,
    // Siempre string ISO:
    fechaCompletado: toISO(data.fechaCompletado) || new Date().toISOString(),
  } as RespuestaEstudianteActividad;
};

const convertUserDoc = (snap: any): User => {
  const data = snap.data() || {};
  if (data.id && data.id !== snap.id) {
    console.warn(`[convertUserDoc] ID Mismatch fixed. DocID: ${snap.id}, DataID: ${data.id}`);
  }
  return {
    ...data,
    id: snap.id,
    // Priorizar usuarioId explícito, luego fallback a ID legacy si existe y es diferente
    usuarioId: data.usuarioId || ((data.id && data.id !== snap.id) ? data.id : undefined),
    legacyId: data.id, // Exponer legacy ID explícitamente
  } as User;
};

const convertPruebaDoc = (snap: any): PruebaEstandarizada => {
  const data = snap.data() || {};
  return {
    ...data,
    id: snap.id,
    fechaCreacion: toISO(data.fechaCreacion) || new Date().toISOString(),
    plazoEntrega: toYYYYMMDD(data.plazoEntrega) || toYYYYMMDD(new Date())!,
  } as PruebaEstandarizada;
};

/* ============================ Suscripciones ============================ */
export const subscribeToActividades = (cb: (data: ActividadRemota[]) => void) => {
  // Se elimina orderBy de la query para evitar errores de índice faltante
  const qy = query(collection(db, ACTIVIDADES_COLLECTION));
  return onSnapshot(
    qy,
    (qs) => {
      const docs = qs.docs.map(convertActividadDoc);
      // Ordenamiento en cliente
      docs.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
      cb(docs);
    },
    (err) => {
      console.error('subscribeToActividades error:', err);
      cb([]);
    }
  );
};

export const subscribeToRespuestas = (
  cb: (data: RespuestaEstudianteActividad[]) => void,
  actividadId?: string
) => {
  const base = collection(db, RESPUESTAS_COLLECTION);
  // Se elimina orderBy para evitar errores de índice compuesto (actividadId + fechaCompletado)
  const qy = actividadId
    ? query(base, where('actividadId', '==', actividadId))
    : query(base);
    
  return onSnapshot(
    qy,
    (qs) => {
      const docs = qs.docs.map(convertRespuestaDoc);
      // Ordenamiento en cliente
      docs.sort((a, b) => new Date(b.fechaCompletado).getTime() - new Date(a.fechaCompletado).getTime());
      cb(docs);
    },
    (err) => {
      console.error('subscribeToRespuestas error:', err);
      cb([]);
    }
  );
};

export const subscribeToAllUsers = (cb: (data: User[]) => void) => {
  const qy = query(collection(db, USERS_COLLECTION));
  return onSnapshot(
    qy,
    (qs) => {
      const docs = qs.docs.map(convertUserDoc);
      docs.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
      cb(docs);
    },
    (err) => {
      console.error('subscribeToAllUsers error:', err);
      cb([]);
    }
  );
};

/** Actualiza campos del usuario en colección 'usuarios' */
export const updateUsuarioFields = async (userId: string, patch: Partial<User>) => {
  console.log(`[updateUsuarioFields] Attempting to update user: ${userId}`, patch);
  const clean: any = stripUndefined({ ...patch });
  await updateDoc(doc(db, USERS_COLLECTION, userId), clean);
};

export const subscribeToPruebasEstandarizadas = (cb: (data: PruebaEstandarizada[]) => void) => {
  // Se elimina orderBy de la query
  const qy = query(collection(db, PRUEBAS_ESTANDARIZADAS_COLLECTION));
  return onSnapshot(
    qy,
    (qs) => {
      const docs = qs.docs.map(convertPruebaDoc);
      // Ordenamiento en cliente
      docs.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
      cb(docs);
    },
    (err) => {
      console.error('subscribeToPruebasEstandarizadas error:', err);
      cb([]);
    }
  );
};

/* ============================ CRUD Actividades / Pruebas ============================ */
export const createActividad = async (actividad: ActividadRemota): Promise<string> => {
  const { id: _omit, fechaCreacion, plazoEntrega, ...rest } = actividad || ({} as ActividadRemota);
  const payload = stripUndefined({
    ...rest,
    // El módulo actual prioriza asignación por estudiantes; nivel puede llegar como '—'
    fechaCreacion: toTimestampFromISO(fechaCreacion),
    plazoEntrega: fromYYYYMMDDToTimestamp(plazoEntrega),
  });
  const docRef = await addDoc(collection(db, ACTIVIDADES_COLLECTION), payload as any);
  return docRef.id;
};

export const updateActividad = async (actividadId: string, patch: Partial<ActividadRemota>) => {
  const { fechaCreacion, plazoEntrega, ...rest } = patch || {};
  const toUpdate: any = stripUndefined({ ...rest });
  if (fechaCreacion !== undefined) toUpdate.fechaCreacion = toTimestampFromISO(fechaCreacion);
  if (plazoEntrega !== undefined) toUpdate.plazoEntrega = fromYYYYMMDDToTimestamp(plazoEntrega);
  await updateDoc(doc(db, ACTIVIDADES_COLLECTION, actividadId), toUpdate);
};

export const deleteActividad = async (actividadId: string) => {
  await deleteDoc(doc(db, ACTIVIDADES_COLLECTION, actividadId));
};

export const createPruebaEstandarizada = async (prueba: PruebaEstandarizada): Promise<string> => {
  const { id: _omit, fechaCreacion, plazoEntrega, ...rest } = prueba || ({} as PruebaEstandarizada);
  const payload = stripUndefined({
    ...rest,
    fechaCreacion: toTimestampFromISO(fechaCreacion),
    plazoEntrega: fromYYYYMMDDToTimestamp(plazoEntrega),
  });
  const docRef = await addDoc(collection(db, PRUEBAS_ESTANDARIZADAS_COLLECTION), payload as any);
  return docRef.id;
};

export const updatePruebaEstandarizada = async (pruebaId: string, patch: Partial<PruebaEstandarizada>) => {
  const { fechaCreacion, plazoEntrega, ...rest } = patch || {};
  const toUpdate: any = stripUndefined({ ...rest });
  if (fechaCreacion !== undefined) toUpdate.fechaCreacion = toTimestampFromISO(fechaCreacion);
  if (plazoEntrega !== undefined) toUpdate.plazoEntrega = fromYYYYMMDDToTimestamp(plazoEntrega);
  await updateDoc(doc(db, PRUEBAS_ESTANDARIZADAS_COLLECTION, pruebaId), toUpdate);
};

export const deletePruebaEstandarizada = async (pruebaId: string) => {
  await deleteDoc(doc(db, PRUEBAS_ESTANDARIZADAS_COLLECTION, pruebaId));
};

/* ============================ Revisión docente / calificaciones ============================ */
export const updateRespuestaActividadDocente = async (
  respuestaId: string,
  patch: {
    revisionDocente?: {
      completada?: boolean;
      observacionesGenerales?: string;
      detalle?: Array<{ index: number; puntaje: number; observacion?: string }>;
      puntajeDocente?: number;
    };
    puntaje?: number;
    puntajeMaximo?: number;
    nota?: string;
  }
) => {
  const clean = stripUndefined(patch);
  await updateDoc(doc(db, RESPUESTAS_COLLECTION, respuestaId), clean as any);
};

export const calcularNota60 = (puntaje: number, puntajeMax: number): string => {
  if (!puntajeMax || puntajeMax <= 0) return '1.0';
  const exigencia = 0.6;
  const aprob = puntajeMax * exigencia;
  let nota: number;
  if (puntaje >= aprob) {
    nota = 4 + (3 * (puntaje - aprob)) / (puntajeMax - aprob + 1e-9);
  } else {
    nota = 1 + (3 * puntaje) / (aprob + 1e-9);
  }
  nota = Math.max(1, Math.min(7, nota));
  return nota.toFixed(1);
};

/* ============================ Consultas simples ============================ */
export const getRespuestasByActividad = async (actividadId: string) => {
  const qy = query(
    collection(db, RESPUESTAS_COLLECTION),
    where('actividadId', '==', actividadId)
  );
  const qs = await getDocs(qy);
  const docs = qs.docs.map(convertRespuestaDoc);
  return docs.sort((a, b) => new Date(b.fechaCompletado).getTime() - new Date(a.fechaCompletado).getTime());
};

export const getRespuestasByEstudiante = async (estudianteId: string) => {
  const qy = query(
    collection(db, RESPUESTAS_COLLECTION),
    where('estudianteId', '==', estudianteId)
  );
  const qs = await getDocs(qy);
  const docs = qs.docs.map(convertRespuestaDoc);
  return docs.sort((a, b) => new Date(b.fechaCompletado).getTime() - new Date(a.fechaCompletado).getTime());
};

export const getActividadById = async (actividadId: string) => {
  const snap = await getDoc(doc(db, ACTIVIDADES_COLLECTION, actividadId));
  return snap.exists() ? convertActividadDoc(snap) : null;
};

export const getPruebaById = async (pruebaId: string) => {
  const snap = await getDoc(doc(db, PRUEBAS_ESTANDARIZADAS_COLLECTION, pruebaId));
  return snap.exists() ? convertPruebaDoc(snap) : null;
};

/* ============================ Storage: uploads ============================ */
export const uploadRecursos = async (
  files: File[],
  nivel: string
): Promise<Array<{ nombre: string; url: string }>> => {
  const uploaded: Array<{ nombre: string; url: string }> = [];
  const stamp = Date.now();

  for (const file of files) {
    const clean = file.name.replace(/\s+/g, '_');
    const safeNivel = (nivel && nivel !== '—') ? nivel : 'general';
    const path = `recursos/${safeNivel}/${stamp}/${clean}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    uploaded.push({ nombre: file.name, url });
  }
  return uploaded;
};

export const uploadDataUrl = async (
  dataUrl: string,
  nombre: string,
  nivel: string
): Promise<{ nombre: string; url: string }> => {
  const { bytes, contentType } = dataUrlToUint8Array(dataUrl);
  const stamp = Date.now();
  const clean = nombre.replace(/\s+/g, '_');
  const safeNivel = (nivel && nivel !== '—') ? nivel : 'general';
  const path = `recursos/${safeNivel}/${stamp}/${clean}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, bytes, { contentType });
  const url = await getDownloadURL(storageRef);
  return { nombre, url };
};

/**
 * Guarda una actividad proveniente de la previsualización:
 * - Si `recursos.archivos` contiene `data:` URLs (base64), las sube a Storage
 * - Sustituye por URLs https y crea el documento en Firestore
 * - Este módulo trabaja SÓLO por estudiantes (sin cursos/niveles en UI)
 */
export const saveActividadFromPreview = async (preview: ActividadRemota): Promise<string> => {
  const nivel = preview.nivel || 'general';
  const archivos = preview.recursos?.archivos || [];

  const archivosNormalizados = await Promise.all(
    archivos.map(async (a: any, idx: number) => {
      if (isDataUrl(a?.url)) {
        const nombre = a?.nombre || `archivo_${idx}.bin`
        return uploadDataUrl(a.url, nombre, nivel);
      }
      return { nombre: a?.nombre || `archivo_${idx}`, url: a?.url };
    })
  );

  const actividad: ActividadRemota = {
    ...preview,
    recursos: {
      ...(preview.recursos || {}),
      archivos: archivosNormalizados,
    },
  };

  return createActividad(actividad);
};
