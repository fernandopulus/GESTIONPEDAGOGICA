import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from './config';
import type { NotaPractica } from '../../types';

const NOTAS_COLLECTION = 'notas_practica';

const convertDoc = <T>(d: any): T => ({ id: d.id, ...d.data() });

export const subscribeNotasEstudiante = (estudianteId: string, cb: (data: NotaPractica[]) => void) => {
  const q = query(collection(db, NOTAS_COLLECTION), where('estudianteId', '==', estudianteId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => convertDoc<NotaPractica>(d)));
  });
};

export const addNotaPractica = async (nota: Omit<NotaPractica, 'id' | 'createdAt'>) => {
  // Eliminar campos undefined para cumplir con restricciones de Firestore
  const payload: Record<string, any> = { ...nota };
  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k];
  });
  await addDoc(collection(db, NOTAS_COLLECTION), { ...payload, createdAt: serverTimestamp() });
};

export const deleteNotaPractica = async (notaId: string) => {
  await deleteDoc(doc(db, NOTAS_COLLECTION, notaId));
};
