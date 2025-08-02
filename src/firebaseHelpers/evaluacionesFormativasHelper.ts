// src/firebaseHelpers/evaluacionesFormativasHelper.ts
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
  writeBatch,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { EvaluacionFormativa, CalificacionesFormativas, TrabajoGrupal, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const EVALUACIONES_COLLECTION = 'evaluaciones_formativas';
const CALIFICACIONES_COLLECTION = 'calificaciones_formativas';
const TRABAJOS_GRUPALES_COLLECTION = 'trabajos_grupales_formativos';
const USERS_COLLECTION = 'usuarios';

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

// --- GESTIÓN DE EVALUACIONES ---

export const subscribeToEvaluaciones = (curso: string, asignatura: string, callback: (data: EvaluacionFormativa[]) => void) => {
  const q = query(
    collection(db, EVALUACIONES_COLLECTION),
    where('curso', '==', curso),
    where('asignatura', '==', asignatura),
    orderBy('fecha', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => convertFirestoreDoc<EvaluacionFormativa>(doc)));
  }, (error) => {
    console.error("Error al suscribirse a evaluaciones:", error);
    callback([]);
  });
};

export const createEvaluacion = async (evaluacionData: Omit<EvaluacionFormativa, 'id'>, initialCalificaciones: Record<string, string>) => {
  const batch = writeBatch(db);
  
  const evalDocRef = doc(collection(db, EVALUACIONES_COLLECTION));
  batch.set(evalDocRef, {
    ...evaluacionData,
    fecha: Timestamp.fromDate(new Date(evaluacionData.fecha + 'T00:00:00')),
  });

  const califDocRef = doc(db, CALIFICACIONES_COLLECTION, evalDocRef.id);
  batch.set(califDocRef, initialCalificaciones);

  await batch.commit();
  return evalDocRef.id;
};

export const updateEvaluacion = async (id: string, data: Partial<EvaluacionFormativa>) => {
  const docRef = doc(db, EVALUACIONES_COLLECTION, id);
  await setDoc(docRef, data, { merge: true });
};

export const deleteEvaluacion = async (id: string) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, EVALUACIONES_COLLECTION, id));
  batch.delete(doc(db, CALIFICACIONES_COLLECTION, id));
  await batch.commit();
};

// --- GESTIÓN DE CALIFICACIONES ---

export const subscribeToCalificaciones = (evaluacionIds: string[], callback: (data: CalificacionesFormativas) => void) => {
  if (evaluacionIds.length === 0) {
    callback({});
    return () => {};
  }
  
  const unsubscribes = evaluacionIds.map(id => {
    const docRef = doc(db, CALIFICACIONES_COLLECTION, id);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ [id]: docSnap.data() } as CalificacionesFormativas);
      }
    });
  });

  return () => unsubscribes.forEach(unsub => unsub());
};

export const updateCalificaciones = async (evaluacionId: string, calificaciones: Record<string, string>) => {
  const docRef = doc(db, CALIFICACIONES_COLLECTION, evaluacionId);
  await setDoc(docRef, calificaciones, { merge: true });
};


// --- GESTIÓN DE TRABAJOS GRUPALES ---

export const subscribeToTrabajosGrupales = (curso: string, asignatura: string, callback: (data: TrabajoGrupal[]) => void) => {
    const q = query(
        collection(db, TRABAJOS_GRUPALES_COLLECTION),
        where('curso', '==', curso),
        where('asignatura', '==', asignatura),
        orderBy('fechaPresentacion', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => convertFirestoreDoc<TrabajoGrupal>(doc)));
    }, (error) => {
        console.error("Error al suscribirse a trabajos grupales:", error);
        callback([]);
    });
};

export const createTrabajoGrupal = async (data: Omit<TrabajoGrupal, 'id'>) => {
    const dataToSend = {
        ...data,
        fechaPresentacion: Timestamp.fromDate(new Date(data.fechaPresentacion + 'T00:00:00')),
    };
    await addDoc(collection(db, TRABAJOS_GRUPALES_COLLECTION), dataToSend);
};

export const updateTrabajoGrupal = async (id: string, data: Partial<TrabajoGrupal>) => {
    const docRef = doc(db, TRABAJOS_GRUPALES_COLLECTION, id);
    await setDoc(docRef, data, { merge: true });
};


// --- GESTIÓN DE USUARIOS ---

export const subscribeToAllUsers = (callback: (data: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => convertFirestoreDoc<User>(doc)));
    }, (error) => {
        console.error("Error al suscribirse a usuarios:", error);
        callback([]);
    });
};
