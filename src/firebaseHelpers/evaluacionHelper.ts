// src/firebaseHelpers/evaluacionHelper.ts
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { Prueba, RubricaEstatica, RubricaInteractiva, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const PRUEBAS_COLLECTION = 'evaluaciones_pruebas';
const RUBRICAS_ESTATICAS_COLLECTION = 'evaluaciones_rubricas_estaticas';
const RUBRICAS_INTERACTIVAS_COLLECTION = 'evaluaciones_rubricas_interactivas';
const USERS_COLLECTION = 'usuarios';

// --- HELPERS DE CONVERSIÓN ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.().toISOString() || data.fechaCreacion,
  } as T;
};

// --- GESTIÓN DE PRUEBAS ---

export const subscribeToPruebas = (callback: (data: Prueba[]) => void) => {
  const q = query(collection(db, PRUEBAS_COLLECTION), orderBy('fechaCreacion', 'desc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => convertFirestoreDoc<Prueba>(doc)));
  }, (error) => {
    console.error("Error al suscribirse a las pruebas:", error);
    callback([]);
  });
  return unsubscribe;
};

export const savePrueba = async (prueba: Prueba): Promise<void> => {
  try {
    const { id, ...dataToSave } = prueba;
    const docRef = doc(db, PRUEBAS_COLLECTION, id);
    await setDoc(docRef, {
      ...dataToSave,
      fechaCreacion: Timestamp.fromDate(new Date(dataToSave.fechaCreacion)),
    });
  } catch (error) {
    console.error("Error al guardar la prueba:", error);
    throw new Error("No se pudo guardar la prueba.");
  }
};

export const deletePrueba = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, PRUEBAS_COLLECTION, id));
  } catch (error) {
    console.error("Error al eliminar la prueba:", error);
    throw new Error("No se pudo eliminar la prueba.");
  }
};

// --- GESTIÓN DE RÚBRICAS ESTÁTICAS ---

export const subscribeToRubricasEstaticas = (callback: (data: RubricaEstatica[]) => void) => {
  const q = query(collection(db, RUBRICAS_ESTATICAS_COLLECTION), orderBy('fechaCreacion', 'desc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => convertFirestoreDoc<RubricaEstatica>(doc)));
  }, (error) => {
    console.error("Error al suscribirse a las rúbricas estáticas:", error);
    callback([]);
  });
  return unsubscribe;
};

export const saveRubricaEstatica = async (rubrica: RubricaEstatica): Promise<void> => {
    try {
        const { id, ...dataToSave } = rubrica;
        const docRef = doc(db, RUBRICAS_ESTATICAS_COLLECTION, id);
        await setDoc(docRef, {
            ...dataToSave,
            fechaCreacion: Timestamp.fromDate(new Date(dataToSave.fechaCreacion)),
        });
    } catch (error) {
        console.error("Error al guardar la rúbrica estática:", error);
        throw new Error("No se pudo guardar la rúbrica.");
    }
};

export const deleteRubricaEstatica = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, RUBRICAS_ESTATICAS_COLLECTION, id));
    } catch (error) {
        console.error("Error al eliminar la rúbrica estática:", error);
        throw new Error("No se pudo eliminar la rúbrica.");
    }
};

// --- GESTIÓN DE RÚBRICAS INTERACTIVAS ---

export const subscribeToRubricasInteractivas = (callback: (data: RubricaInteractiva[]) => void) => {
    const q = query(collection(db, RUBRICAS_INTERACTIVAS_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => convertFirestoreDoc<RubricaInteractiva>(doc)));
    }, (error) => {
        console.error("Error al suscribirse a las rúbricas interactivas:", error);
        callback([]);
    });
    return unsubscribe;
};

export const saveRubricaInteractiva = async (rubrica: RubricaInteractiva): Promise<void> => {
    try {
        const { id, ...dataToSave } = rubrica;
        const docRef = doc(db, RUBRICAS_INTERACTIVAS_COLLECTION, id);
        await setDoc(docRef, dataToSave);
    } catch (error) {
        console.error("Error al guardar la rúbrica interactiva:", error);
        throw new Error("No se pudo guardar la rúbrica interactiva.");
    }
};

export const createRubricaInteractiva = async (rubricaData: Omit<RubricaInteractiva, 'id'>): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, RUBRICAS_INTERACTIVAS_COLLECTION), rubricaData);
        return docRef.id;
    } catch (error) {
        console.error("Error al crear la rúbrica interactiva:", error);
        throw new Error("No se pudo crear la rúbrica interactiva.");
    }
};

// --- GESTIÓN DE USUARIOS ---

export const subscribeToAllUsers = (callback: (data: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => convertFirestoreDoc<User>(doc)));
    }, (error) => {
        console.error("Error al suscribirse a los usuarios:", error);
        callback([]);
    });
    return unsubscribe;
};
