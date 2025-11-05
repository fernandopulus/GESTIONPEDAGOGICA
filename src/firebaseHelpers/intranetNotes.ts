import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { IntranetNote } from '../../types';

const COLLECTION = 'intranet_notes';

export const listenIntranetNotes = (
  onData: (notes: IntranetNote[]) => void,
  onError?: (e: any) => void
) => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('destacado', 'desc'), orderBy('fechaPublicacion', 'desc'));
    return onSnapshot(q, (snap) => {
      const rows: IntranetNote[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
      onData(rows);
    }, (err) => onError && onError(err));
  } catch (e) {
    onError && onError(e);
    return () => {};
  }
};

export const createIntranetNote = async (data: Omit<IntranetNote, 'id' | 'fechaPublicacion' | 'autor' | 'autorId' | 'destacado'> & { destacado?: boolean }): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');
  const payload: any = {
    ...data,
    destacado: data.destacado ?? false,
    autor: user.displayName || user.email || 'Usuario',
    autorId: user.uid,
    fechaPublicacion: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
};

export const updateIntranetNote = async (id: string, data: Partial<IntranetNote>) => {
  const sanitized = JSON.parse(JSON.stringify(data));
  await updateDoc(doc(db, COLLECTION, id), sanitized);
};

export const deleteIntranetNote = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION, id));
};
