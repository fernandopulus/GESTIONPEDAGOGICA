// src/firebaseHelpers/actasHelper.ts
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { Acta, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const ACTAS_COLLECTION = 'actas_de_reunion';

// --- HELPERS DE CONVERSIÓN ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.().toISOString() || data.fechaCreacion,
  } as T;
};

// --- GESTIÓN DE ACTAS ---

/**
 * Se suscribe en tiempo real a la lista de actas.
 */
export const subscribeToActas = (callback: (data: Acta[]) => void) => {
  const q = query(collection(db, ACTAS_COLLECTION), orderBy('fechaCreacion', 'desc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const actas = querySnapshot.docs.map(doc => convertFirestoreDoc<Acta>(doc));
    callback(actas);
  }, (error) => {
    console.error("Error al suscribirse a las actas:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Crea una nueva acta en Firestore.
 */
export const createActa = async (actaData: Omit<Acta, 'id'>, creador: User): Promise<string> => {
  try {
    const dataToSend = {
      ...actaData,
      creadorId: creador.id,
      creadorNombre: creador.nombreCompleto,
      fechaCreacion: Timestamp.fromDate(new Date(actaData.fechaCreacion)),
    };
    const docRef = await addDoc(collection(db, ACTAS_COLLECTION), dataToSend);
    return docRef.id;
  } catch (error) {
    console.error("Error al crear el acta:", error);
    throw new Error("No se pudo crear el acta.");
  }
};

/**
 * Elimina un acta de Firestore.
 */
export const deleteActa = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, ACTAS_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error al eliminar el acta:", error);
        throw new Error("No se pudo eliminar el acta.");
    }
};
