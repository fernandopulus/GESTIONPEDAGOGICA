// src/firebaseHelpers/inclusionHelper.ts
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { EstudianteInclusion, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const INCLUSION_COLLECTION = 'estudiantes_inclusion';
const USERS_COLLECTION = 'usuarios';

// --- HELPERS DE CONVERSIÓN ---

const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
  } as T;
};

// --- FUNCIONES DE SUSCRIPCIÓN (TIEMPO REAL) ---

/**
 * Se suscribe en tiempo real a la lista de estudiantes del programa de inclusión.
 * @param callback La función que se ejecutará con los datos actualizados.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToEstudiantesInclusion = (callback: (data: EstudianteInclusion[]) => void) => {
  const q = query(collection(db, INCLUSION_COLLECTION));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const estudiantes = querySnapshot.docs.map(doc => convertFirestoreDoc<EstudianteInclusion>(doc));
    callback(estudiantes);
  }, (error) => {
    console.error("Error al suscribirse a estudiantes de inclusión:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Se suscribe en tiempo real a la lista completa de usuarios.
 * @param callback La función que se ejecutará con los datos actualizados.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToAllUsers = (callback: (data: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const users = querySnapshot.docs.map(doc => convertFirestoreDoc<User>(doc));
        callback(users);
    }, (error) => {
        console.error("Error al suscribirse a todos los usuarios:", error);
        callback([]);
    });

    return unsubscribe;
};


// --- FUNCIONES CRUD (Crear, Leer, Actualizar, Eliminar) ---

/**
 * Agrega un nuevo estudiante al programa de inclusión.
 * @param studentData Los datos del estudiante a agregar.
 * @returns El ID del nuevo documento creado.
 */
export const addEstudianteToInclusion = async (studentData: Omit<EstudianteInclusion, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, INCLUSION_COLLECTION), studentData);
    return docRef.id;
  } catch (error) {
    console.error("Error al agregar estudiante a inclusión:", error);
    throw new Error("No se pudo agregar al estudiante.");
  }
};

/**
 * Actualiza la ficha completa de un estudiante de inclusión.
 * @param studentId El ID del estudiante a actualizar.
 * @param updatedData El objeto completo del estudiante con los datos actualizados.
 */
export const updateEstudianteInclusion = async (studentId: string, updatedData: EstudianteInclusion): Promise<void> => {
  try {
    // Excluimos el 'id' del objeto para no guardarlo como un campo dentro del documento
    const { id, ...dataToSave } = updatedData;
    const docRef = doc(db, INCLUSION_COLLECTION, studentId);
    // Usamos setDoc para reemplazar completamente el documento con los nuevos datos.
    await setDoc(docRef, dataToSave);
  } catch (error) {
    console.error("Error al actualizar estudiante de inclusión:", error);
    throw new Error("No se pudo actualizar la ficha del estudiante.");
  }
};

/**
 * Elimina a un estudiante del programa de inclusión.
 * @param studentId El ID del estudiante a eliminar.
 */
export const deleteEstudianteInclusion = async (studentId: string): Promise<void> => {
  try {
    const docRef = doc(db, INCLUSION_COLLECTION, studentId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error al eliminar estudiante de inclusión:", error);
    throw new Error("No se pudo eliminar al estudiante.");
  }
};
