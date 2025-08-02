// src/firebaseHelpers/tareasInterdisciplinariasHelper.ts
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { PlanificacionInterdisciplinaria, EntregaTareaInterdisciplinaria, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const PLANIFICACIONES_COLLECTION = 'proyectos_interdisciplinarios';
const ENTREGAS_COLLECTION = 'entregas_interdisciplinarias';

// --- HELPERS DE CONVERSIÓN ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.().toISOString() || data.fechaCreacion,
    fechaCompletado: data.fechaCompletado?.toDate?.().toISOString() || data.fechaCompletado,
  } as T;
};

// --- SUSCRIPCIONES A DATOS ---

/**
 * Se suscribe a los proyectos interdisciplinarios asignados al curso de un estudiante.
 */
export const subscribeToMisProyectos = (curso: string, callback: (data: PlanificacionInterdisciplinaria[]) => void) => {
  const q = query(
    collection(db, PLANIFICACIONES_COLLECTION),
    where('cursos', 'array-contains', curso)
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const proyectos = querySnapshot.docs.map(doc => convertFirestoreDoc<PlanificacionInterdisciplinaria>(doc));
    callback(proyectos);
  }, (error) => {
    console.error("Error al suscribirse a los proyectos:", error);
    callback([]);
  });
};

/**
 * Se suscribe a las entregas de un estudiante para todos sus proyectos.
 */
export const subscribeToMisEntregas = (studentId: string, callback: (data: EntregaTareaInterdisciplinaria[]) => void) => {
    const q = query(
        collection(db, ENTREGAS_COLLECTION),
        where('estudianteId', '==', studentId)
    );

    return onSnapshot(q, (querySnapshot) => {
        const entregas = querySnapshot.docs.map(doc => convertFirestoreDoc<EntregaTareaInterdisciplinaria>(doc));
        callback(entregas);
    }, (error) => {
        console.error("Error al suscribirse a las entregas:", error);
        callback([]);
    });
};

/**
 * Guarda o actualiza una entrega de tarea.
 * Si el documento ya existe, lo actualiza. Si no, lo crea.
 */
export const updateEntrega = async (entrega: EntregaTareaInterdisciplinaria): Promise<void> => {
    try {
        const { id, ...dataToSave } = entrega;
        const docRef = doc(db, ENTREGAS_COLLECTION, id);
        
        const dataWithTimestamp = {
            ...dataToSave,
            fechaCompletado: Timestamp.fromDate(new Date(dataToSave.fechaCompletado || Date.now())),
        };

        await setDoc(docRef, dataWithTimestamp, { merge: true });
    } catch (error) {
        console.error("Error al actualizar la entrega:", error);
        throw new Error("No se pudo guardar la entrega.");
    }
};
