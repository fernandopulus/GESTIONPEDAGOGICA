import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { IntranetEntry } from '../../types';

const COLLECTION = 'intranet_entries';

export const listenIntranetEntries = (
  onData: (entries: IntranetEntry[]) => void,
  onError?: (e: any) => void
) => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      const rows: IntranetEntry[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
      onData(rows);
    }, (err) => onError && onError(err));
  } catch (e) {
    onError && onError(e);
    return () => {};
  }
};

export const fetchIntranetEntriesOnce = async (): Promise<IntranetEntry[]> => {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
};

export const createIntranetEntry = async (data: Omit<IntranetEntry, 'id' | 'createdAt' | 'creadoPor'> & { createdAt?: string }): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');
  const payload: any = {
    ...data,
    creadoPor: user.email || 'desconocido',
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
};

export const updateIntranetEntry = async (id: string, data: Partial<IntranetEntry>) => {
  const payload = { ...data, updatedAt: new Date().toISOString() } as any;
  // Sanitizar: eliminar propiedades con valor undefined (incluye anidados)
  const sanitized = JSON.parse(JSON.stringify(payload));
  await updateDoc(doc(db, COLLECTION, id), sanitized);
};

export const deleteIntranetEntry = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION, id));
};
