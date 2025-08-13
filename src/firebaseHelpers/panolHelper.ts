// src/firebaseHelpers/panolHelper.ts
import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { RegistroPañol, Maquina } from '../../types';

export const MAQUINAS_COLLECTION = 'panol_maquinas';
export const REGISTROS_COLLECTION = 'panol_registros';

export const subscribeToMaquinas = (cb: (items: Maquina[]) => void) => {
  const q = query(collection(db, MAQUINAS_COLLECTION), orderBy('nombre', 'asc'));
  return onSnapshot(q, (snap) => {
    const data: Maquina[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Maquina, 'id'>) }));
    cb(data);
  });
};

export const subscribeToRegistros = (cb: (items: RegistroPañol[]) => void) => {
  const q = query(collection(db, REGISTROS_COLLECTION), orderBy('fecha', 'desc'));
  return onSnapshot(q, (snap) => {
    const data: RegistroPañol[] = snap.docs.map((d) => {
      const raw = d.data() as any;
      return {
        id: d.id,
        fecha: raw.fecha,
        curso: raw.curso,
        profesorResponsable: raw.profesorResponsable,
        maquinaId: raw.maquinaId,
        totalHoras: raw.totalHoras,
        observaciones: raw.observaciones || '',
      } as RegistroPañol;
    });
    cb(data);
  });
};

export const addMaquina = async (payload: Omit<Maquina, 'id'>) => {
  const ref = await addDoc(collection(db, MAQUINAS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateMaquina = async (id: string, payload: Partial<Omit<Maquina, 'id'>>) => {
  await updateDoc(doc(db, MAQUINAS_COLLECTION, id), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const deleteMaquina = async (id: string) => {
  const q = query(collection(db, REGISTROS_COLLECTION), where('maquinaId', '==', id));
  const hasRefs = await getDocs(q);
  if (!hasRefs.empty) {
    throw new Error('No se puede eliminar una máquina con registros de uso. Elimine los registros primero.');
  }
  await deleteDoc(doc(db, MAQUINAS_COLLECTION, id));
};

export const addRegistro = async (payload: Omit<RegistroPañol, 'id'>) => {
  const ref = await addDoc(collection(db, REGISTROS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateRegistro = async (id: string, payload: Partial<Omit<RegistroPañol, 'id'>>) => {
  await updateDoc(doc(db, REGISTROS_COLLECTION, id), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const deleteRegistro = async (id: string) => {
  await deleteDoc(doc(db, REGISTROS_COLLECTION, id));
};

export const seedDefaultMaquinasIfEmpty = async () => {
  const snap = await getDocs(collection(db, MAQUINAS_COLLECTION));
  if (!snap.empty) return;

  const batch = writeBatch(db);
  const defaults: Omit<Maquina, 'id'>[] = [
    { nombre: 'Torno', especialidad: 'Industrial' as any },
    { nombre: 'Fresadora', especialidad: 'Industrial' as any },
    { nombre: 'Rectificadora', especialidad: 'Industrial' as any },
    { nombre: 'Soldadora MIG', especialidad: 'Industrial' as any },
    { nombre: 'Soldadora TIG', especialidad: 'Industrial' as any },
    { nombre: 'Torno CNC', especialidad: 'Industrial' as any },
    { nombre: 'Elevador', especialidad: 'Automotriz' as any },
    { nombre: 'Compresor', especialidad: 'Automotriz' as any },
    { nombre: 'Rectificadora', especialidad: 'Automotriz' as any },
    { nombre: 'Maqueta de motor', especialidad: 'Automotriz' as any },
    { nombre: 'Maqueta hidráulica', especialidad: 'Automotriz' as any },
  ];

  defaults.forEach((m) => {
    const ref = doc(collection(db, MAQUINAS_COLLECTION));
    batch.set(ref, { ...m, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });

  await batch.commit();
};
