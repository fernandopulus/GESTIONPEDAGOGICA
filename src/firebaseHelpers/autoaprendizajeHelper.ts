// src/firebaseHelpers/autoaprendizajeHelper.ts
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
 * Se suscribe a las actividades disponibles para un estudiante específico.
 */
export const subscribeToActividadesDisponibles = (
  currentUser: User,
  callback: (data: ActividadRemota[]) => void
) => {
  const q = query(collection(db, ACTIVIDADES_COLLECTION), orderBy('fechaCreacion', 'desc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const todasActividades = querySnapshot.docs.map(doc => convertFirestoreDoc<ActividadRemota>(doc));
    
    // Filtrar actividades disponibles para este estudiante
    const actividadesDisponibles = todasActividades.filter(actividad => {
      // Si no hay destinatarios específicos, disponible para todo el nivel
      if (!actividad.cursosDestino?.length && !actividad.estudiantesDestino?.length) {
        const nivelNum = actividad.nivel.charAt(0);
        return currentUser.curso?.startsWith(nivelNum);
      }
      
      // Si está en los cursos destino
      if (actividad.cursosDestino?.includes(currentUser.curso || '')) {
        return true;
      }
      
      // Si está en los estudiantes destino
      if (actividad.estudiantesDestino?.includes(currentUser.nombreCompleto)) {
        return true;
      }
      
      return false;
    });
    
    callback(actividadesDisponibles);
  }, (error) => {
    console.error("Error al suscribirse a las actividades disponibles:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Se suscribe a las respuestas de un estudiante específico.
 */
export const subscribeToRespuestasEstudiante = (
  estudianteId: string,
  callback: (data: RespuestaEstudianteActividad[]) => void
) => {
    const q = query(
      collection(db, RESPUESTAS_COLLECTION), 
      where('estudianteId', '==', estudianteId),
      orderBy('fechaCompletado', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const respuestas = querySnapshot.docs.map(doc => convertFirestoreDoc<RespuestaEstudianteActividad>(doc));
        callback(respuestas);
    }, (error) => {
        console.error("Error al suscribirse a las respuestas del estudiante:", error);
        callback([]);
    });

    return unsubscribe;
};

/**
 * Guarda la respuesta de una actividad.
 */
export const saveRespuestaActividad = async (
  respuestaData: Omit<RespuestaEstudianteActividad, 'id'>
): Promise<string> => {
  try {
    const dataToSend = {
        ...respuestaData,
        fechaCompletado: Timestamp.fromDate(new Date(respuestaData.fechaCompletado)),
    };
    const docRef = await addDoc(collection(db, RESPUESTAS_COLLECTION), dataToSend);
    return docRef.id;
  } catch (error) {
    console.error("Error al guardar la respuesta de actividad:", error);
    throw new Error("No se pudo guardar la respuesta de la actividad.");
  }
};

// --- GESTIÓN DE PRUEBAS ESTANDARIZADAS ---

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
 * Se suscribe a las respuestas de pruebas de un estudiante específico.
 */
export const subscribeToRespuestasPruebasEstudiante = (
  estudianteId: string,
  callback: (data: RespuestaPruebaEstandarizada[]) => void
) => {
    const q = query(
      collection(db, RESPUESTAS_PRUEBAS_COLLECTION), 
      where('estudianteId', '==', estudianteId),
      orderBy('fechaCompletado', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const respuestas = querySnapshot.docs.map(doc => convertRespuestaPruebaFirestoreDoc(doc));
        callback(respuestas);
    }, (error) => {
        console.error("Error al suscribirse a las respuestas de pruebas del estudiante:", error);
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
