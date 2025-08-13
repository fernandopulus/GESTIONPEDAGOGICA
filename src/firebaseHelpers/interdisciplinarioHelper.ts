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
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { PlanificacionInterdisciplinaria, EntregaTareaInterdisciplinaria, User } from '../../types';

const PLANIFICACIONES_COLLECTION = 'proyectos_interdisciplinarios';
const ENTREGAS_COLLECTION = 'entregas_interdisciplinarias';
const USERS_COLLECTION = 'usuarios';

const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return { id: docSnapshot.id, ...data } as T;
};

const withSafeDefaults = (p: any): PlanificacionInterdisciplinaria => {
  return {
    ...p,
    contenidosPorAsignatura: Array.isArray(p?.contenidosPorAsignatura) ? p.contenidosPorAsignatura : [],
    actividades: Array.isArray(p?.actividades) ? p.actividades : [],
    fechasClave: Array.isArray(p?.fechasClave) ? p.fechasClave : [],
    tareas: Array.isArray(p?.tareas) ? p.tareas : [],
    docentesResponsables: Array.isArray(p?.docentesResponsables)
      ? p.docentesResponsables
      : [p?.docentesResponsables].filter(Boolean),
  } as unknown as PlanificacionInterdisciplinaria;
};

export const subscribeToPlanificaciones = (callback: (data: PlanificacionInterdisciplinaria[]) => void) => {
  const q = query(collection(db, PLANIFICACIONES_COLLECTION), orderBy('nombreProyecto', 'asc'));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    try {
      const planificaciones = querySnapshot.docs.map(d => withSafeDefaults(convertFirestoreDoc<PlanificacionInterdisciplinaria>(d)));
      callback(planificaciones);
    } catch (e) {
      console.error('Error parseando planificaciones:', e);
      callback([]);
    }
  }, (error) => {
    console.error('Error al suscribirse a las planificaciones:', error);
    callback([]);
  });
  return unsubscribe;
};

export const createPlanificacion = async (planData: Omit<PlanificacionInterdisciplinaria, 'id'>): Promise<string> => {
  const payload: any = {
    ...planData,
    contenidosPorAsignatura: Array.isArray((planData as any).contenidosPorAsignatura) ? (planData as any).contenidosPorAsignatura : [],
    actividades: Array.isArray((planData as any).actividades) ? (planData as any).actividades : [],
    fechasClave: Array.isArray((planData as any).fechasClave) ? (planData as any).fechasClave : [],
    tareas: Array.isArray((planData as any).tareas) ? (planData as any).tareas : [],
    docentesResponsables: Array.isArray((planData as any).docentesResponsables)
      ? (planData as any).docentesResponsables
      : [(planData as any).docentesResponsables].filter(Boolean),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(collection(db, PLANIFICACIONES_COLLECTION), payload);
  return docRef.id;
};

export const updatePlanificacion = async (planId: string, updatedData: Partial<PlanificacionInterdisciplinaria>): Promise<void> => {
  const { id, ...rest } = (updatedData as any);
  const docRef = doc(db, PLANIFICACIONES_COLLECTION, planId);
  await setDoc(docRef, {
    ...rest,
    contenidosPorAsignatura: Array.isArray((rest as any)?.contenidosPorAsignatura)
      ? (rest as any).contenidosPorAsignatura
      : (rest as any)?.contenidosPorAsignatura === undefined ? undefined : [],
    actividades: Array.isArray((rest as any)?.actividades)
      ? (rest as any).actividades
      : (rest as any)?.actividades === undefined ? undefined : [],
    fechasClave: Array.isArray((rest as any)?.fechasClave)
      ? (rest as any).fechasClave
      : (rest as any)?.fechasClave === undefined ? undefined : [],
    tareas: Array.isArray((rest as any)?.tareas)
      ? (rest as any).tareas
      : (rest as any)?.tareas === undefined ? undefined : [],
    docentesResponsables: Array.isArray((rest as any)?.docentesResponsables)
      ? (rest as any).docentesResponsables
      : (rest as any)?.docentesResponsables === undefined ? undefined : [(rest as any)?.docentesResponsables].filter(Boolean),
    updatedAt: Timestamp.now(),
  }, { merge: true });
};

// 🔥 Eliminación en cascada (entregas del proyecto + el proyecto)
export const deletePlanificacion = async (planId: string): Promise<void> => {
  const planRef = doc(db, PLANIFICACIONES_COLLECTION, planId);
  // borra entregas relacionadas primero
  const entregasQ = query(collection(db, ENTREGAS_COLLECTION), where('planificacionId', '==', planId));
  const snap = await getDocs(entregasQ);
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  batch.delete(planRef);
  await batch.commit();
};

export const subscribeToEntregas = (planId: string, callback: (data: EntregaTareaInterdisciplinaria[]) => void) => {
  const q = query(collection(db, ENTREGAS_COLLECTION), where('planificacionId', '==', planId));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const entregas = querySnapshot.docs.map(doc => convertFirestoreDoc<EntregaTareaInterdisciplinaria>(doc));
    callback(entregas);
  }, (error) => {
    console.error('Error al suscribirse a las entregas:', error);
    callback([]);
  });
  return unsubscribe;
};

export const saveFeedbackEntrega = async (entregaId: string, feedback: string): Promise<void> => {
  const docRef = doc(db, ENTREGAS_COLLECTION, entregaId);
  await setDoc(docRef, { feedbackProfesor: feedback, fechaFeedback: Timestamp.fromDate(new Date()) }, { merge: true });
};

export const subscribeToAllUsers = (callback: (data: User[]) => void) => {
  const q = query(collection(db, USERS_COLLECTION));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const users = querySnapshot.docs.map(doc => convertFirestoreDoc<User>(doc));
    callback(users);
  }, (error) => {
    console.error('Error al suscribirse a todos los usuarios:', error);
    callback([]);
  });
  return unsubscribe;
};
