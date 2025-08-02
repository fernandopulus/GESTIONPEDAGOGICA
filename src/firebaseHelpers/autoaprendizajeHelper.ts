// src/firebaseHelpers/autoaprendizajeHelper.ts
import {
  collection,
  doc,
  addDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { ActividadRemota, RespuestaEstudianteActividad, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const ACTIVIDADES_COLLECTION = 'actividades_remotas';
const RESPUESTAS_COLLECTION = 'respuestas_actividades';

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

// --- GESTIÓN DE ACTIVIDADES PARA EL ESTUDIANTE ---

/**
 * Se suscribe a las actividades disponibles para un estudiante específico.
 * Filtra por curso, nombre de estudiante, o nivel si no hay destinatarios específicos.
 */
export const subscribeToActividadesDisponibles = (currentUser: User, callback: (data: ActividadRemota[]) => void) => {
    if (!currentUser.curso) {
        callback([]);
        return () => {};
    }
    const studentLevelInitial = currentUser.curso.charAt(0);

    const q = query(
        collection(db, ACTIVIDADES_COLLECTION),
        orderBy('fechaCreacion', 'desc')
    );

    return onSnapshot(q, (querySnapshot) => {
        const allActivities = querySnapshot.docs.map(doc => convertFirestoreDoc<ActividadRemota>(doc));
        
        const filtered = allActivities.filter(act => {
            const isGlobal = !act.cursosDestino?.length && !act.estudiantesDestino?.length;
            const isForMyCourse = act.cursosDestino?.includes(currentUser.curso!) ?? false;
            const isForMe = act.estudiantesDestino?.includes(currentUser.nombreCompleto) ?? false;
            
            if (isForMyCourse || isForMe) return true;
            
            if (isGlobal) {
                const actLevelNum = act.nivel.charAt(0);
                return actLevelNum === studentLevelInitial;
            }
            return false;
        });
        
        callback(filtered);
    }, (error) => {
        console.error("Error al suscribirse a actividades disponibles:", error);
        callback([]);
    });
};

/**
 * Se suscribe a las respuestas de un estudiante específico.
 */
export const subscribeToRespuestasEstudiante = (studentId: string, callback: (data: RespuestaEstudianteActividad[]) => void) => {
    const q = query(
        collection(db, RESPUESTAS_COLLECTION),
        where('estudianteId', '==', studentId)
    );

    return onSnapshot(q, (querySnapshot) => {
        const respuestas = querySnapshot.docs.map(doc => convertFirestoreDoc<RespuestaEstudianteActividad>(doc));
        callback(respuestas);
    }, (error) => {
        console.error("Error al suscribirse a las respuestas del estudiante:", error);
        callback([]);
    });
};

/**
 * Guarda la respuesta de un estudiante a una actividad.
 */
export const saveRespuestaActividad = async (respuestaData: Omit<RespuestaEstudianteActividad, 'id'>): Promise<string> => {
    try {
        const dataToSend = {
            ...respuestaData,
            fechaCompletado: Timestamp.fromDate(new Date()),
        };
        const docRef = await addDoc(collection(db, RESPUESTAS_COLLECTION), dataToSend);
        return docRef.id;
    } catch (error) {
        console.error("Error al guardar la respuesta:", error);
        throw new Error("No se pudo guardar la respuesta.");
    }
};
