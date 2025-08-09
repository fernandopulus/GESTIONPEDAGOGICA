
// src/firebaseHelpers/notificacionesHelper.ts
// Helper completo y robusto para notificaciones de docentes (Firestore).
// Exporta exactamente lo que tu TopBar está importando.

import {
  collection,
  addDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { db } from "../firebase";

export type NotificacionTipo = 'nueva_intervencion' | 'recordatorio' | 'alerta' | string;

export interface NotificacionDocente {
  id?: string;
  docenteNombre: string;
  docenteEmail?: string;
  docenteEmailLower?: string;
  tipo: NotificacionTipo;
  titulo: string;
  mensaje: string;
  estudianteNombre?: string;
  estudianteId?: string;
  accionRequerida?: string;
  leida: boolean;
  createdAt?: Timestamp;
}

// ---------- Crear ----------
export async function createNotificacionDocente(
  payload: Omit<NotificacionDocente, "id" | "leida" | "createdAt">
): Promise<string> {
  const data: any = {
    ...payload,
    // asegurar campo normalizado para queries por email
    docenteEmailLower: payload.docenteEmail ? payload.docenteEmail.toLowerCase() : payload.docenteEmailLower,
    leida: false,
    createdAt: serverTimestamp(),
  };
  // Firestore no acepta undefined
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  const ref = await addDoc(collection(db, "notificaciones"), data);
  return ref.id as string;
}

// ---------- Lectura puntual (no realtime) por email ----------
export async function getNotificacionesPorDocenteEmail(docenteEmail: string) {
  const q = query(
    collection(db, "notificaciones"),
    where("docenteEmailLower", "==", docenteEmail.toLowerCase()),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificacionDocente));
}

// ---------- Suscripción realtime por email (recomendado) ----------
export function subscribeToNotificacionesDocentePorEmail(
  docenteEmail: string,
  callback: (items: NotificacionDocente[]) => void
): () => void {
  const q = query(
    collection(db, "notificaciones"),
    where("docenteEmailLower", "==", docenteEmail.toLowerCase()),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificacionDocente));
    callback(items);
  });
}

// ---------- Suscripción realtime por nombre (compatibilidad) ----------
export function subscribeToNotificacionesDocente(
  docenteNombre: string,
  callback: (items: NotificacionDocente[]) => void
): () => void {
  const q = query(
    collection(db, "notificaciones"),
    where("docenteNombre", "==", docenteNombre),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificacionDocente));
    callback(items);
  });
}

// ---------- Suscripción híbrida (email + nombre) ----------
// Esto es lo que tu TopBar intenta importar.
export function subscribeToNotificacionesParaUsuario(
  params: { email?: string; nombreCompleto?: string },
  callback: (items: NotificacionDocente[]) => void
): () => void {
  const unsubs: (() => void)[] = [];
  let a: NotificacionDocente[] = [];
  let b: NotificacionDocente[] = [];

  const emit = () => {
    const map = new Map<string, NotificacionDocente>();
    [...a, ...b].forEach(n => {
      if (!n.id) return;
      if (!map.has(n.id)) map.set(n.id, n);
    });
    const merged = Array.from(map.values()).sort((x, y) => {
      const tx = (x.createdAt as any)?.toDate ? (x.createdAt as any).toDate().getTime() : 0;
      const ty = (y.createdAt as any)?.toDate ? (y.createdAt as any).toDate().getTime() : 0;
      return ty - tx;
    });
    callback(merged);
  };

  if (params.email) {
    const qEmail = query(
      collection(db, "notificaciones"),
      where("docenteEmailLower", "==", params.email.toLowerCase()),
      orderBy("createdAt", "desc")
    );
    unsubs.push(onSnapshot(qEmail, (snap) => {
      a = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificacionDocente));
      emit();
    }));
  }

  if (params.nombreCompleto) {
    const qNombre = query(
      collection(db, "notificaciones"),
      where("docenteNombre", "==", params.nombreCompleto),
      orderBy("createdAt", "desc")
    );
    unsubs.push(onSnapshot(qNombre, (snap) => {
      b = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificacionDocente));
      emit();
    }));
  }

  return () => unsubs.forEach(u => u());
}

// ---------- Acciones ----------
export async function marcarNotificacionComoLeida(notificacionId: string) {
  const ref = doc(db, "notificaciones", notificacionId);
  await updateDoc(ref, { leida: true });
}

// alias por si en algún lado la llamaban distinto
export const marcarNotificacionLeida = marcarNotificacionComoLeida;

export async function eliminarNotificacion(notificacionId: string) {
  const ref = doc(db, "notificaciones", notificacionId);
  await deleteDoc(ref);
}

// alias por si en algún lado la llamaban distinto
export const deleteNotificacion = eliminarNotificacion;
