import { db, storage, functions } from '../firebase';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

export interface DocuMeta {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  storagePath: string;
  contentType?: string;
  contentText?: string;
  pageCount?: number;
  createdBy: string;
  createdAt: any;
}

const COL = 'documentacion_docs';

export function subscribeDocs(cb: (docs: DocuMeta[]) => void) {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as DocuMeta[];
    cb(list);
  });
}

export async function createDocMeta(title: string, description?: string, tags?: string[]) {
  const refDoc = doc(collection(db, COL));
  const payload: Partial<DocuMeta> = {
    title,
    description: description || '',
    tags: tags || [],
    createdAt: serverTimestamp(),
  } as any;
  await setDoc(refDoc, payload, { merge: true });
  return refDoc.id;
}

export async function uploadFileForDoc(docId: string, file: File): Promise<{ storagePath: string; downloadURL: string; contentType: string }>{
  const path = `documentacion/${docId}/${file.name}`;
  const r = ref(storage, path);
  const snap = await uploadBytes(r, file, { contentType: file.type });
  const url = await getDownloadURL(r);
  return { storagePath: path, downloadURL: url, contentType: file.type };
}

export async function indexDocument(docId: string, storagePath: string, title: string, description?: string, tags?: string[], contentType?: string) {
  const callable = httpsCallable(functions, 'indexDocumentacionDoc');
  const res = await callable({ docId, storagePath, title, description, tags, contentType });
  return res.data as any;
}

export async function askDocumentacion(question: string, topK = 3, tags?: string[], history?: Array<{ role: 'user' | 'assistant'; text: string }>) {
  const callable = httpsCallable(functions, 'documentacionQuery');
  const res = await callable({ question, topK, tags, history });
  return res.data as { ok: boolean; answer: string; modelUsed: string; citations: Array<{ index: number; id: string; title: string; storagePath: string }>; };
}

export async function deleteDocMeta(id: string) {
  await deleteDoc(doc(db, COL, id));
}
