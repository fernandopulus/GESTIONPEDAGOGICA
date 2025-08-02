// src/firebaseHelpers/recursosHelper.ts
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { CrosswordPuzzle, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const CRUCIGRAMAS_COLLECTION = 'recursos_crucigramas';

// --- HELPERS DE CONVERSIÓN ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.().toISOString() || data.fechaCreacion,
  } as T;
};

// --- GESTIÓN DE CRUCIGRAMAS ---

/**
 * Se suscribe en tiempo real a la lista de crucigramas guardados.
 */
export const subscribeToCrucigramas = (callback: (data: CrosswordPuzzle[]) => void) => {
  const q = query(collection(db, CRUCIGRAMAS_COLLECTION), orderBy('fechaCreacion', 'desc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const crucigramas = querySnapshot.docs.map(doc => convertFirestoreDoc<CrosswordPuzzle>(doc));
    callback(crucigramas);
  }, (error) => {
    console.error("Error al suscribirse a los crucigramas:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Guarda un nuevo crucigrama en Firestore.
 */
export const saveCrucigrama = async (puzzleData: Omit<CrosswordPuzzle, 'id' | 'fechaCreacion'>, creador: User): Promise<string> => {
  try {
    const dataToSend = {
      ...puzzleData,
      creadorId: creador.id,
      creadorNombre: creador.nombreCompleto,
      fechaCreacion: Timestamp.fromDate(new Date()),
    };
    const docRef = await addDoc(collection(db, CRUCIGRAMAS_COLLECTION), dataToSend);
    return docRef.id;
  } catch (error) {
    console.error("Error al guardar el crucigrama:", error);
    throw new Error("No se pudo guardar el crucigrama.");
  }
};

/**
 * Elimina un crucigrama de Firestore.
 */
export const deleteCrucigrama = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, CRUCIGRAMAS_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error al eliminar el crucigrama:", error);
        throw new Error("No se pudo eliminar el crucigrama.");
    }
};
