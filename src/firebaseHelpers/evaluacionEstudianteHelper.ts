// src/firebaseHelpers/evaluacionEstudianteHelper.ts
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { EvaluacionFormativa, CalificacionesFormativas, TrabajoGrupal } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const EVALUACIONES_COLLECTION = 'evaluaciones_formativas';
const CALIFICACIONES_COLLECTION = 'calificaciones_formativas';
const TRABAJOS_GRUPALES_COLLECTION = 'trabajos_grupales_formativos';

// --- HELPERS DE CONVERSIÓN ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    fecha: data.fecha?.toDate?.().toISOString().split('T')[0] || data.fecha,
    fechaPresentacion: data.fechaPresentacion?.toDate?.().toISOString().split('T')[0] || data.fechaPresentacion,
  } as T;
};

// --- SUSCRIPCIONES A DATOS DEL ESTUDIANTE ---

/**
 * Se suscribe a las evaluaciones formativas del curso del estudiante.
 */
export const subscribeToEvaluacionesEstudiante = (curso: string, callback: (data: EvaluacionFormativa[]) => void) => {
  const q = query(
    collection(db, EVALUACIONES_COLLECTION),
    where('curso', '==', curso)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => convertFirestoreDoc<EvaluacionFormativa>(doc)));
  }, (error) => {
    console.error("Error subscribing to student evaluations:", error);
    callback([]);
  });
};

/**
 * Se suscribe a TODAS las calificaciones. En una app a gran escala, esto debería optimizarse.
 */
export const subscribeToCalificaciones = (callback: (data: CalificacionesFormativas) => void) => {
  const q = query(collection(db, CALIFICACIONES_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const allCalificaciones: CalificacionesFormativas = {};
    snapshot.forEach(doc => {
        allCalificaciones[doc.id] = doc.data();
    });
    callback(allCalificaciones);
  }, (error) => {
    console.error("Error subscribing to grades:", error);
    callback({});
  });
};

/**
 * Se suscribe a las calificaciones SOLO de las evaluaciones indicadas.
 * Devuelve actualizaciones parciales: { [evaluacionId]: { ...mapaCalificaciones } }
 */
export const subscribeToCalificacionesPorEvaluaciones = (
  evaluacionIds: string[],
  callback: (data: CalificacionesFormativas) => void
) => {
  if (!evaluacionIds || evaluacionIds.length === 0) {
    // Nada que escuchar
    return () => {};
  }

  const unsubscribes = evaluacionIds.map((id) => {
    const ref = doc(db, CALIFICACIONES_COLLECTION, id);
    return onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        callback({ [id]: docSnap.data() } as CalificacionesFormativas);
      } else {
        // Si no existe, reportamos vacío para ese id
        callback({ [id]: {} } as CalificacionesFormativas);
      }
    }, (error) => {
      // Degradamos silenciosamente permission-denied para no romper la UI del estudiante
      if (error?.code !== 'permission-denied') {
        console.error(`Error subscribing to grade doc ${id}:`, error);
      }
      // En caso de error, no llamamos callback para evitar sobrescribir estado válido
    });
  });

  return () => unsubscribes.forEach(u => u());
};

/**
 * Se suscribe a los trabajos grupales del curso del estudiante.
 */
export const subscribeToTrabajosGrupalesEstudiante = (curso: string, callback: (data: TrabajoGrupal[]) => void) => {
    const q = query(
        collection(db, TRABAJOS_GRUPALES_COLLECTION),
        where('curso', '==', curso)
    );
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => convertFirestoreDoc<TrabajoGrupal>(doc)));
    }, (error) => {
        console.error("Error subscribing to group projects:", error);
        callback([]);
    });
};

/**
 * Actualiza un documento de trabajo grupal completo.
 */
export const updateTrabajoGrupal = async (trabajo: TrabajoGrupal): Promise<void> => {
    try {
        const { id, ...dataToSave } = trabajo;
        const docRef = doc(db, TRABAJOS_GRUPALES_COLLECTION, id);
        // Usamos setDoc con merge:false para reemplazar el documento, asegurando que la estructura de 'grupos' se actualice correctamente.
        await setDoc(docRef, dataToSave); 
    } catch (error) {
        console.error("Error updating group project:", error);
        throw new Error("Could not update group project.");
    }
};
