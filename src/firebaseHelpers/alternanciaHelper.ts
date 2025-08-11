// src/firebaseHelpers/alternanciaHelper.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase";

export interface Actividad {
  fecha: string;
  tipo: string;
  actividad: string;
  lugar: string;
  evidencias: string;
}

export interface Integrante {
  rol: string;
  nombre: string;
  correo: string;
}

export interface AlternanciaTPData {
  id?: string;
  especialidad: string;
  tipoAlternancia: string[];
  cobertura: string;
  fundamentacion: string;
  actividades?: Actividad[];
  equipo?: Integrante[];
  contrapartes?: Integrante[];
  tutores?: Integrante[];
  analisisCurricular: string;
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}

// Colección principal
const alternanciaCol = collection(db, "alternancias");

// ---------- Crear ----------
export async function createAlternancia(data: Omit<AlternanciaTPData, "id">) {
  const docRef = await addDoc(alternanciaCol, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// ---------- Leer ----------
export async function getAlternancias({
  especialidad,
  pageSize = 10,
  lastDoc,
}: {
  especialidad?: string;
  pageSize?: number;
  lastDoc?: any;
}) {
  let q = query(alternanciaCol, orderBy("createdAt", "desc"), limit(pageSize));
  if (especialidad) {
    q = query(alternanciaCol, where("especialidad", "==", especialidad), orderBy("createdAt", "desc"), limit(pageSize));
  }
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  const snap = await getDocs(q);
  const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as AlternanciaTPData[];
  return { items, lastDoc: snap.docs[snap.docs.length - 1] };
}

export async function getAlternanciaById(id: string) {
  const docRef = doc(db, "alternancias", id);
  const snap = await getDoc(docRef);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as AlternanciaTPData) : null;
}

// ---------- Actualizar ----------
export async function updateAlternancia(id: string, data: Partial<AlternanciaTPData>) {
  const docRef = doc(db, "alternancias", id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

// ---------- Eliminar ----------
export async function deleteAlternancia(id: string) {
  const docRef = doc(db, "alternancias", id);
  await deleteDoc(docRef);
}

// ---------- Subcolecciones ----------
export async function addSubDoc(alternanciaId: string, sub: string, payload: any) {
  const subCol = collection(db, "alternancias", alternanciaId, sub);
  await addDoc(subCol, { ...payload, createdAt: serverTimestamp() });
}

export async function getSubDocs(alternanciaId: string, sub: string) {
  const subCol = collection(db, "alternancias", alternanciaId, sub);
  const snap = await getDocs(subCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteSubDoc(alternanciaId: string, sub: string, subId: string) {
  const subRef = doc(db, "alternancias", alternanciaId, sub, subId);
  await deleteDoc(subRef);
}

// ---------- Evidencias (Storage) ----------
export async function uploadEvidencia(
  alternanciaId: string,
  file: File
): Promise<{ url: string; path: string }> {
  const path = `alternancias/${alternanciaId}/evidencias/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await addSubDoc(alternanciaId, "evidencias", { url, path, nombre: file.name });
  return { url, path };
}

export async function deleteEvidencia(path: string) {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}
