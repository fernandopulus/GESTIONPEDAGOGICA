// src/firebaseHelpers/autoaprendizajeHelper.ts
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './config';
import { ActividadRemota, RespuestaEstudianteActividad, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const ACTIVIDADES_COLLECTION = 'actividades_remotas';
const RESPUESTAS_COLLECTION = 'respuestas_actividades';

// --- HELPERS DE CONVERSIÓN (Lógica unificada y robusta) ---
const toDateObj = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (v && typeof v.toDate === 'function') {
    const d = v.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  if (v && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number') {
    const ms = v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const toISO = (v: any): string | undefined => {
  const d = toDateObj(v);
  return d ? d.toISOString() : undefined;
};

const toYYYYMMDD = (v: any): string | undefined => {
  const d = toDateObj(v);
  return d ? d.toISOString().split('T')[0] : undefined;
};


const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    // Usa los helpers robustos para asegurar consistencia
    fechaCreacion: toISO(data.fechaCreacion) || data.fechaCreacion,
    plazoEntrega: toYYYYMMDD(data.plazoEntrega) || data.plazoEntrega,
    fechaCompletado: toISO(data.fechaCompletado) || data.fechaCompletado,
  } as T;
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
    
    // La lógica de filtrado es correcta y se mantiene
    const actividadesDisponibles = todasActividades.filter(actividad => {
      if (!actividad.cursosDestino?.length && !actividad.estudiantesDestino?.length) {
        const nivelNum = actividad.nivel.charAt(0);
        return currentUser.curso?.startsWith(nivelNum);
      }
      if (actividad.cursosDestino?.includes(currentUser.curso || '')) {
        return true;
      }
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
    // Asegura que la fecha se guarde como un Timestamp de Firestore
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