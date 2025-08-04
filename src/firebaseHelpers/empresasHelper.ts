// src/firebaseHelpers/empresasHelper.ts
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './config';
import { Empresa, User, Profile } from '../../types';

const EMPRESAS_COLLECTION = 'empresas_practicas';
const USERS_COLLECTION = 'usuarios';

const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return { id: docSnapshot.id, ...data } as T;
};

// --- GESTIÓN DE EMPRESAS ---

export const subscribeToEmpresas = (callback: (data: Empresa[]) => void) => {
  const q = query(collection(db, EMPRESAS_COLLECTION), orderBy('nombre', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const empresas = snapshot.docs.map(doc => convertFirestoreDoc<Empresa>(doc));
    callback(empresas);
  }, (error) => console.error("Error al suscribirse a empresas:", error));
};

export const saveEmpresa = async (empresaData: Omit<Empresa, 'id' | 'createdAt'> | Empresa) => {
  const { calificaciones } = empresaData;
  const puntajeTotal = calificaciones.reduce((acc, item) => acc + (item.score || 0), 0);
  const dataToSave = { ...empresaData, puntajeTotal };

  if ('id' in empresaData && empresaData.id) {
    // Actualizar empresa existente
    const { id, ...data } = dataToSave as Empresa;
    const docRef = doc(db, EMPRESAS_COLLECTION, id);
    await setDoc(docRef, data, { merge: true });
    return id;
  } else {
    // Crear nueva empresa
    const docRef = await addDoc(collection(db, EMPRESAS_COLLECTION), {
      ...dataToSave,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }
};

export const deleteEmpresa = async (empresaId: string): Promise<void> => {
  const docRef = doc(db, EMPRESAS_COLLECTION, empresaId);
  await deleteDoc(docRef);
};

// --- GESTIÓN DE ESTUDIANTES (para la asignación) ---

export const subscribeToEstudiantes = (callback: (data: User[]) => void) => {
  const q = query(collection(db, USERS_COLLECTION), where('profile', '==', Profile.ESTUDIANTE), orderBy('nombreCompleto', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const estudiantes = snapshot.docs.map(doc => convertFirestoreDoc<User>(doc));
    callback(estudiantes);
  }, (error) => console.error("Error al suscribirse a estudiantes:", error));
};
