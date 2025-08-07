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
  getDocs,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { ActividadRemota, RespuestaEstudianteActividad, User, PruebaEstandarizada, RespuestaPruebaEstandarizada } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const ACTIVIDADES_COLLECTION = 'actividades_remotas';
const RESPUESTAS_COLLECTION = 'respuestas_actividades';
const PRUEBAS_ESTANDARIZADAS_COLLECTION = 'pruebas_estandarizadas';
const RESPUESTAS_PRUEBAS_COLLECTION = 'respuestas_pruebas_estandarizadas';
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

const convertPruebaFirestoreDoc = (docSnapshot: any): PruebaEstandarizada => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.().toISOString() || data.fechaCreacion,
    plazoEntrega: data.plazoEntrega?.toDate?.().toISOString().split('T')[0] || data.plazoEntrega,
  } as PruebaEstandarizada;
};

const convertRespuestaPruebaFirestoreDoc = (docSnapshot: any): RespuestaPruebaEstandarizada => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    fechaInicio: data.fechaInicio?.toDate?.().toISOString() || data.fechaInicio,
    fechaCompletado: data.fechaCompletado?.toDate?.().toISOString() || data.fechaCompletado,
  } as RespuestaPruebaEstandarizada;
};

// --- GESTIÓN DE ACTIVIDADES REMOTAS ---

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

// --- GESTIÓN DE PRUEBAS ESTANDARIZADAS ---

/**
 * Se suscribe en tiempo real a la lista de pruebas estandarizadas.
 */
export const subscribeToPruebasEstandarizadas = (callback: (data: PruebaEstandarizada[]) => void) => {
  const q = query(collection(db, PRUEBAS_ESTANDARIZADAS_COLLECTION), orderBy('fechaCreacion', 'desc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const pruebas = querySnapshot.docs.map(doc => convertPruebaFirestoreDoc(doc));
    callback(pruebas);
  }, (error) => {
    console.error("Error al suscribirse a las pruebas estandarizadas:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Crea una nueva prueba estandarizada en Firestore.
 */
export const createPruebaEstandarizada = async (pruebaData: Omit<PruebaEstandarizada, 'id'>): Promise<string> => {
  try {
    const dataToSend = {
        ...pruebaData,
        fechaCreacion: Timestamp.fromDate(new Date()),
        plazoEntrega: Timestamp.fromDate(new Date(pruebaData.plazoEntrega + 'T00:00:00')),
    };
    const docRef = await addDoc(collection(db, PRUEBAS_ESTANDARIZADAS_COLLECTION), dataToSend);
    return docRef.id;
  } catch (error) {
    console.error("Error al crear la prueba estandarizada:", error);
    throw new Error("No se pudo crear la prueba estandarizada.");
  }
};

/**
 * Obtiene las pruebas estandarizadas disponibles para un estudiante específico.
 */
export const getPruebasParaEstudiante = async (
  estudianteNombre: string,
  estudianteCurso: string,
  estudianteNivel: string
): Promise<PruebaEstandarizada[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, PRUEBAS_ESTANDARIZADAS_COLLECTION), orderBy('fechaCreacion', 'desc'))
    );
    
    const pruebas: PruebaEstandarizada[] = [];
    querySnapshot.forEach((doc) => {
      const prueba = convertPruebaFirestoreDoc(doc);
      
      // Verificar si el estudiante puede acceder a esta prueba
      const puedeAcceder = 
        // Si no hay destinatarios específicos, disponible para todo el nivel
        (!prueba.cursosDestino?.length && !prueba.estudiantesDestino?.length && 
         prueba.nivel.charAt(0) === estudianteNivel.charAt(0)) ||
        // Si está en los cursos destino
        prueba.cursosDestino?.includes(estudianteCurso) ||
        // Si está en los estudiantes destino
        prueba.estudiantesDestino?.includes(estudianteNombre);
      
      if (puedeAcceder) {
        pruebas.push(prueba);
      }
    });
    
    return pruebas;
  } catch (error) {
    console.error('Error al obtener pruebas para estudiante:', error);
    throw error;
  }
};

/**
 * Verifica si un estudiante ya completó una prueba estandarizada.
 */
export const checkPruebaCompletada = async (
  pruebaId: string,
  estudianteId: string
): Promise<boolean> => {
  try {
    const q = query(
      collection(db, RESPUESTAS_PRUEBAS_COLLECTION),
      where('pruebaId', '==', pruebaId),
      where('estudianteId', '==', estudianteId)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error al verificar prueba completada:', error);
    return false;
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

/**
 * Se suscribe a las respuestas de pruebas estandarizadas.
 */
export const subscribeToRespuestasPruebas = (callback: (data: RespuestaPruebaEstandarizada[]) => void) => {
    const q = query(collection(db, RESPUESTAS_PRUEBAS_COLLECTION), orderBy('fechaCompletado', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const respuestas = querySnapshot.docs.map(doc => convertRespuestaPruebaFirestoreDoc(doc));
        callback(respuestas);
    }, (error) => {
        console.error("Error al suscribirse a las respuestas de pruebas:", error);
        callback([]);
    });

    return unsubscribe;
};

/**
 * Guarda la respuesta de una prueba estandarizada.
 */
export const saveRespuestaPrueba = async (
  respuestaData: Omit<RespuestaPruebaEstandarizada, 'id'>
): Promise<string> => {
  try {
    const dataToSend = {
      ...respuestaData,
      fechaInicio: Timestamp.fromDate(new Date(respuestaData.fechaInicio)),
      fechaCompletado: Timestamp.fromDate(new Date(respuestaData.fechaCompletado))
    };
    const docRef = await addDoc(collection(db, RESPUESTAS_PRUEBAS_COLLECTION), dataToSend);
    return docRef.id;
  } catch (error) {
    console.error('Error al guardar respuesta de prueba:', error);
    throw error;
  }
};

/**
 * Obtiene las respuestas de un estudiante para una prueba específica.
 */
export const getRespuestaPrueba = async (
  pruebaId: string,
  estudianteId: string
): Promise<RespuestaPruebaEstandarizada | null> => {
  try {
    const q = query(
      collection(db, RESPUESTAS_PRUEBAS_COLLECTION),
      where('pruebaId', '==', pruebaId),
      where('estudianteId', '==', estudianteId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return convertRespuestaPruebaFirestoreDoc(doc);
  } catch (error) {
    console.error('Error al obtener respuesta de prueba:', error);
    return null;
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
