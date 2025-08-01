// src/firebaseHelpers/interdisciplinarioHelper.ts
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { PlanificacionInterdisciplinaria, EntregaTareaInterdisciplinaria, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const PLANIFICACIONES_COLLECTION = 'proyectos_interdisciplinarios';
const ENTREGAS_COLLECTION = 'entregas_interdisciplinarias';
const USERS_COLLECTION = 'usuarios';

// --- HELPERS DE CONVERSIÓN ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
  } as T;
};

// --- GESTIÓN DE PLANIFICACIONES ---

/**
 * Se suscribe en tiempo real a todas las planificaciones interdisciplinarias.
 */
export const subscribeToPlanificaciones = (callback: (data: PlanificacionInterdisciplinaria[]) => void) => {
  const q = query(collection(db, PLANIFICACIONES_COLLECTION), orderBy('nombreProyecto', 'asc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const planificaciones = querySnapshot.docs.map(doc => convertFirestoreDoc<PlanificacionInterdisciplinaria>(doc));
    callback(planificaciones);
  }, (error) => {
    console.error("Error al suscribirse a las planificaciones:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Crea una nueva planificación de proyecto.
 */
export const createPlanificacion = async (planData: Omit<PlanificacionInterdisciplinaria, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, PLANIFICACIONES_COLLECTION), planData);
    return docRef.id;
  } catch (error) {
    console.error("Error al crear la planificación:", error);
    throw new Error("No se pudo crear la planificación.");
  }
};

/**
 * Actualiza una planificación existente.
 */
export const updatePlanificacion = async (planId: string, updatedData: PlanificacionInterdisciplinaria): Promise<void> => {
  try {
    const { id, ...dataToSave } = updatedData;
    const docRef = doc(db, PLANIFICACIONES_COLLECTION, planId);
    await setDoc(docRef, dataToSave);
  } catch (error) {
    console.error("Error al actualizar la planificación:", error);
    throw new Error("No se pudo actualizar la planificación.");
  }
};

/**
 * Elimina una planificación.
 */
export const deletePlanificacion = async (planId: string): Promise<void> => {
  try {
    const docRef = doc(db, PLANIFICACIONES_COLLECTION, planId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error al eliminar la planificación:", error);
    throw new Error("No se pudo eliminar la planificación.");
  }
};


// --- GESTIÓN DE ENTREGAS DE TAREAS ---

/**
 * Se suscribe a las entregas de tareas para una planificación específica.
 */
export const subscribeToEntregas = (planId: string, callback: (data: EntregaTareaInterdisciplinaria[]) => void) => {
    const q = query(collection(db, ENTREGAS_COLLECTION), where('planificacionId', '==', planId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const entregas = querySnapshot.docs.map(doc => convertFirestoreDoc<EntregaTareaInterdisciplinaria>(doc));
        callback(entregas);
    }, (error) => {
        console.error("Error al suscribirse a las entregas:", error);
        callback([]);
    });

    return unsubscribe;
};

/**
 * Guarda o actualiza la retroalimentación de una entrega.
 */
export const saveFeedbackEntrega = async (entregaId: string, feedback: string): Promise<void> => {
    try {
        const docRef = doc(db, ENTREGAS_COLLECTION, entregaId);
        await setDoc(docRef, { 
            feedbackProfesor: feedback,
            fechaFeedback: Timestamp.fromDate(new Date()) 
        }, { merge: true });
    } catch (error) {
        console.error("Error al guardar la retroalimentación:", error);
        throw new Error("No se pudo guardar la retroalimentación.");
    }
};

// --- GESTIÓN DE USUARIOS ---

/**
 * Se suscribe a la lista completa de usuarios.
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
