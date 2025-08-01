// src/firebaseHelpers/horariosHelper.ts
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  getDoc,
  setDoc,
  where, // <-- ESTA ES LA CORRECCIÓN
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { AsignacionHorario, HorariosGenerados, User, Profile } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const ASIGNACIONES_COLLECTION = 'horario_asignaciones';
const HORARIOS_GENERADOS_DOC = 'horarios_generados'; // Usaremos un único documento para el horario global
const USERS_COLLECTION = 'usuarios';

// --- HELPERS DE CONVERSIÓN ---

const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
  } as T;
};

// --- GESTIÓN DE ASIGNACIONES ---

/**
 * Se suscribe en tiempo real a la lista de asignaciones de horarios.
 * @param callback La función que se ejecutará con los datos actualizados.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToAsignaciones = (callback: (data: AsignacionHorario[]) => void) => {
  const q = query(collection(db, ASIGNACIONES_COLLECTION));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const asignaciones = querySnapshot.docs.map(doc => convertFirestoreDoc<AsignacionHorario>(doc));
    callback(asignaciones);
  }, (error) => {
    console.error("Error al suscribirse a las asignaciones:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Agrega una nueva asignación de horario a Firestore.
 * @param asignacionData Los datos de la asignación a crear.
 * @returns El ID del nuevo documento.
 */
export const addAsignacion = async (asignacionData: Omit<AsignacionHorario, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, ASIGNACIONES_COLLECTION), asignacionData);
    return docRef.id;
  } catch (error) {
    console.error("Error al agregar asignación:", error);
    throw new Error("No se pudo agregar la asignación.");
  }
};

/**
 * Elimina una asignación de horario de Firestore.
 * @param id El ID de la asignación a eliminar.
 */
export const deleteAsignacion = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, ASIGNACIONES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error al eliminar asignación:", error);
    throw new Error("No se pudo eliminar la asignación.");
  }
};

// --- GESTIÓN DE HORARIOS GENERADOS ---

/**
 * Guarda el objeto completo de horarios generados en un único documento.
 * @param horarios El objeto de horarios generados.
 */
export const saveHorarios = async (horarios: HorariosGenerados): Promise<void> => {
  try {
    // Usamos un documento con un ID fijo para guardar siempre en el mismo lugar.
    const docRef = doc(db, HORARIOS_GENERADOS_DOC, 'global');
    await setDoc(docRef, { data: horarios });
  } catch (error) {
    console.error("Error al guardar los horarios:", error);
    throw new Error("No se pudieron guardar los horarios generados.");
  }
};

/**
 * Se suscribe en tiempo real al documento que contiene los horarios generados.
 * @param callback La función que se ejecutará con los datos actualizados.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToHorarios = (callback: (data: HorariosGenerados) => void) => {
  const docRef = doc(db, HORARIOS_GENERADOS_DOC, 'global');

  const unsubscribe = onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().data || {});
    } else {
      callback({}); // Si no existe el documento, devuelve un objeto vacío.
    }
  }, (error) => {
    console.error("Error al suscribirse a los horarios:", error);
    callback({});
  });

  return unsubscribe;
};


// --- GESTIÓN DE USUARIOS (PROFESORES) ---

/**
 * Se suscribe en tiempo real a la lista de usuarios con perfil de Profesorado.
 * @param callback La función que se ejecutará con los datos actualizados.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToProfesores = (callback: (data: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION), where("profile", "==", Profile.PROFESORADO));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const users = querySnapshot.docs.map(doc => convertFirestoreDoc<User>(doc));
        callback(users);
    }, (error) => {
        console.error("Error al suscribirse a los profesores:", error);
        callback([]);
    });

    return unsubscribe;
};
