// src/firebaseHelpers/actividadesRemotasHelper.ts
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { ActividadRemota, RespuestaEstudianteActividad, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const ACTIVIDADES_COLLECTION = 'actividades_remotas';
const RESPUESTAS_COLLECTION = 'respuestas_actividades';
const USERS_COLLECTION = 'usuarios';

// --- HELPERS DE CONVERSIÓN ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.().toISOString() || data.fechaCreacion,
    plazoEntrega: data.plazoEntrega?.toDate?.().toISOString().split('T')[0] || data.plazoEntrega,
    fechaCompletado: data.fechaCompletado?.toDate?.().toISOString() || data.fechaCompletado,
  } as T;
};

// --- GESTIÓN DE ACTIVIDADES ---

/**
 * Se suscribe en tiempo real a la lista de actividades remotas.
 */
export const subscribeToActividades = (callback: (data: ActividadRemota[]) => void) => {
  const q = query(collection(db, ACTIVIDADES_COLLECTION), orderBy('fechaCreacion', 'desc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const actividades = querySnapshot.docs.map(doc => convertFirestoreDoc<ActividadRemota>(doc));
    callback(actividades);
  }, (error) => {
    console.error("Error al suscribirse a las actividades:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Crea una nueva actividad remota en Firestore.
 */
export const createActividad = async (actividadData: Omit<ActividadRemota, 'id'>): Promise<string> => {
  try {
    const dataToSend = {
        ...actividadData,
        fechaCreacion: Timestamp.fromDate(new Date()),
        plazoEntrega: Timestamp.fromDate(new Date(actividadData.plazoEntrega + 'T00:00:00')),
    };
    const docRef = await addDoc(collection(db, ACTIVIDADES_COLLECTION), dataToSend);
    return docRef.id;
  } catch (error) {
    console.error("Error al crear la actividad:", error);
    throw new Error("No se pudo crear la actividad.");
  }
};

// --- GESTIÓN DE RESPUESTAS ---

/**
 * Se suscribe a las respuestas de los estudiantes para todas las actividades.
 */
export const subscribeToRespuestas = (callback: (data: RespuestaEstudianteActividad[]) => void) => {
    const q = query(collection(db, RESPUESTAS_COLLECTION));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const respuestas = querySnapshot.docs.map(doc => convertFirestoreDoc<RespuestaEstudianteActividad>(doc));
        callback(respuestas);
    }, (error) => {
        console.error("Error al suscribirse a las respuestas:", error);
        callback([]);
    });

    return unsubscribe;
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
