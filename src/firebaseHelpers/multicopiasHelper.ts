import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './config';
import type { SolicitudMulticopia, EstadoMulticopia } from '../../types';
import { createNotificacionDocente } from './notificacionesHelper';
import { deleteDoc } from 'firebase/firestore';

const COLLECTION = 'multicopias';

// Utilidad: eliminar undefined
const stripUndefined = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  const out: any = Array.isArray(obj) ? [] : {};
  Object.entries(obj as any).forEach(([k, v]) => {
    if (v !== undefined) out[k] = typeof v === 'object' && v !== null ? stripUndefined(v) : v;
  });
  return out;
};

// Converter de Firestore -> Front (ISO strings)
const toISO = (ts: any): string | undefined => {
  try {
    if (!ts) return undefined;
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (ts.seconds) return new Date(ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6)).toISOString();
  } catch {}
  return undefined;
};

const convertDoc = (snap: any): SolicitudMulticopia => {
  const d = snap.data() || {};
  return {
    ...d,
    id: snap.id, // forzar que prevalezca el id del documento
    createdAt: toISO(d.createdAt) || new Date().toISOString(),
    updatedAt: toISO(d.updatedAt) || undefined,
  } as SolicitudMulticopia;
};

export async function uploadAdjuntoMulticopia(file: File, folderHint = 'multicopias'): Promise<string> {
  const stamp = Date.now();
  const clean = file.name.replace(/\s+/g, '_');
  const path = `${folderHint}/${stamp}/${clean}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

export async function createSolicitudMulticopia(payload: Omit<SolicitudMulticopia, 'id' | 'createdAt' | 'updatedAt' | 'estado' | 'solicitanteEmailLower'> & { estado?: EstadoMulticopia }): Promise<string> {
  // Proteger ante payloads con 'id' por casting externo
  const { id: _ignoreId, createdAt: _ignoreC, updatedAt: _ignoreU, solicitanteEmailLower: _ignoreSEL, ...rest } = (payload as any) || {};
  const base = rest as Omit<SolicitudMulticopia, 'id' | 'createdAt' | 'updatedAt' | 'estado' | 'solicitanteEmailLower'> & { estado?: EstadoMulticopia };
  const data: any = stripUndefined({
    ...base,
    estado: base.estado || 'Enviada',
    solicitanteEmailLower: base.solicitanteEmail ? base.solicitanteEmail.toLowerCase() : undefined,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const refDoc = await addDoc(collection(db, COLLECTION), data);
  return refDoc.id;
}

export async function updateSolicitudMulticopia(id: string, patch: Partial<SolicitudMulticopia>) {
  if (!id) throw new Error('updateSolicitudMulticopia: id requerido');
  const data: any = stripUndefined({ ...patch, updatedAt: serverTimestamp() });
  await updateDoc(doc(db, COLLECTION, id), data);
}

export function subscribeMulticopiasPorSolicitante(emailOrId: { emailLower?: string; solicitanteId?: string }, cb: (items: SolicitudMulticopia[]) => void) {
  const col = collection(db, COLLECTION);
  let qy;
  if (emailOrId.emailLower) {
    qy = query(col, where('solicitanteEmailLower', '==', emailOrId.emailLower), orderBy('createdAt', 'desc'));
  } else if (emailOrId.solicitanteId) {
    qy = query(col, where('solicitanteId', '==', emailOrId.solicitanteId), orderBy('createdAt', 'desc'));
  } else {
    qy = query(col, orderBy('createdAt', 'desc'));
  }
  return onSnapshot(qy, (snap) => cb(snap.docs.map(convertDoc)), (err) => { console.error('subscribeMulticopiasPorSolicitante', err); cb([]); });
}

export function subscribeMulticopiasAllConFiltros(filters: { nivel?: string; curso?: string; asignatura?: string; docenteNombre?: string; estado?: EstadoMulticopia | 'Todos' }, cb: (items: SolicitudMulticopia[]) => void) {
  // Firestore limita múltiples where; aplicamos parte en servidor y parte en cliente
  const col = collection(db, COLLECTION);
  const qy = query(col, orderBy('createdAt', 'desc'));
  return onSnapshot(qy, (snap) => {
    const all = snap.docs.map(convertDoc);
    const out = all.filter((m) => {
      if (filters.nivel && filters.nivel !== 'Todos' && (m.nivel || '') !== filters.nivel) return false;
      if (filters.curso && filters.curso !== 'Todos' && (m.curso || '') !== filters.curso) return false;
      if (filters.asignatura && filters.asignatura !== 'Todas' && (m.asignatura || '') !== filters.asignatura) return false;
      if (filters.docenteNombre && filters.docenteNombre !== 'Todos' && (m.solicitanteNombre || '') !== filters.docenteNombre) return false;
      if (filters.estado && filters.estado !== 'Todos' && (m.estado || 'Enviada') !== filters.estado) return false;
      return true;
    });
    cb(out);
  }, (err) => { console.error('subscribeMulticopiasAllConFiltros', err); cb([]); });
}

export async function listarMulticopiasAll(): Promise<SolicitudMulticopia[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')));
  return snap.docs.map(convertDoc);
}

export async function cambiarEstadoMulticopia(id: string, nuevoEstado: EstadoMulticopia, actorNombre: string, opciones?: { motivoRechazo?: string }) {
  if (!id) throw new Error('cambiarEstadoMulticopia: id requerido');
  const patch: Partial<SolicitudMulticopia> = { estado: nuevoEstado };
  if (nuevoEstado === 'Visada') patch.visadoPor = actorNombre;
  if (nuevoEstado === 'Aceptada') patch.aceptadoPor = actorNombre;
  if (nuevoEstado === 'Rechazada') {
    patch.rechazadoPor = actorNombre;
    if (opciones?.motivoRechazo) patch.motivoRechazo = opciones.motivoRechazo;
  }
  if (nuevoEstado === 'Completada') patch.completadoPor = actorNombre;
  await updateSolicitudMulticopia(id, patch);
}

export async function notificarAceptacionMulticopia(solicitud: SolicitudMulticopia) {
  try {
    if (!solicitud.solicitanteNombre && !solicitud.solicitanteEmail) return;
    await createNotificacionDocente({
      docenteNombre: solicitud.solicitanteNombre,
      docenteEmail: solicitud.solicitanteEmail,
      tipo: 'alerta',
      titulo: 'Multicopia aceptada',
      mensaje: 'Su solicitud fue aceptada. La multicopia estará lista en un plazo máximo de 48 horas.',
      estudianteNombre: undefined,
      estudianteId: undefined,
      accionRequerida: undefined,
    });
  } catch (e) {
    console.warn('No se pudo crear notificación de aceptación:', e);
  }
}

/**
 * Elimina una solicitud de multicopias por id. Si se entrega adjuntoUrl, intenta borrar también el archivo de Storage.
 */
export async function eliminarSolicitudMulticopia(id: string, opciones?: { adjuntoUrl?: string }) {
  if (!id) throw new Error('eliminarSolicitudMulticopia: id requerido');
  // Borrar archivo adjunto si corresponde (mejor esfuerzo)
  if (opciones?.adjuntoUrl) {
    try {
      const r = ref(storage, opciones.adjuntoUrl);
      await deleteObject(r);
    } catch (e) {
      console.warn('No se pudo eliminar adjunto de Storage (continuando con borrado de doc):', e);
    }
  }
  // Borrar documento en Firestore
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Lista solicitudes con adjunto (Storage) para análisis. Si se pasa emailLower, filtra por solicitante.
 * Nota: aplica filtros adicionales en cliente para evitar requerir índices.
 */
export async function listarAdjuntosMulticopias(options: { emailLower?: string; max?: number } = {}): Promise<SolicitudMulticopia[]> {
  const { emailLower, max = 200 } = options;
  let qy;
  const col = collection(db, COLLECTION);
  if (emailLower) {
    // Evitar índices: sólo where y ordenar en cliente
    qy = query(col, where('solicitanteEmailLower', '==', emailLower));
  } else {
    qy = query(col, orderBy('createdAt', 'desc'));
  }
  const snap = await getDocs(qy);
  let all = snap.docs.map(convertDoc).filter(d => !!d.adjuntoUrl);
  if (emailLower) {
    all = all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
  return all.slice(0, max);
}
