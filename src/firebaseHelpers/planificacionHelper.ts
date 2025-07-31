// firebase/planificacionHelper.ts
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './config';
import { 
  PlanificacionDocente, 
  PlanificacionUnidad, 
  PlanificacionClase, 
  ActividadPlanificada, 
  CalendarEvent,
  EventType,
  ActividadFocalizadaEvent
} from '../types';

// Colecciones de Firestore
const PLANIFICACIONES_COLLECTION = 'planificaciones';
const ACTIVIDADES_COLLECTION = 'actividades_calendario';
const CALENDAR_COLLECTION = 'eventos_calendario';

// Helper para convertir datos de Firestore
const convertFirestoreData = (doc: any) => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.()?.toISOString() || data.fechaCreacion
  };
};

// ===== PLANIFICACIONES =====

export const savePlanificacion = async (planificacion: Omit<PlanificacionDocente, 'id'>, userId: string): Promise<string> => {
  try {
    const planificacionData = {
      ...planificacion,
      userId,
      fechaCreacion: Timestamp.fromDate(new Date()),
      fechaActualizacion: Timestamp.fromDate(new Date())
    };

    const docRef = await addDoc(collection(db, PLANIFICACIONES_COLLECTION), planificacionData);
    return docRef.id;
  } catch (error) {
    console.error('Error al guardar planificación:', error);
    throw new Error('No se pudo guardar la planificación');
  }
};

export const updatePlanificacion = async (id: string, updates: Partial<PlanificacionDocente>, userId: string): Promise<void> => {
  try {
    const docRef = doc(db, PLANIFICACIONES_COLLECTION, id);
    
    // Verificar que el documento pertenece al usuario
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('No tienes permisos para actualizar esta planificación');
    }

    await updateDoc(docRef, {
      ...updates,
      fechaActualizacion: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.error('Error al actualizar planificación:', error);
    throw new Error('No se pudo actualizar la planificación');
  }
};

export const deletePlanificacion = async (id: string, userId: string): Promise<void> => {
  try {
    const docRef = doc(db, PLANIFICACIONES_COLLECTION, id);
    
    // Verificar que el documento pertenece al usuario
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('No tienes permisos para eliminar esta planificación');
    }

    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error al eliminar planificación:', error);
    throw new Error('No se pudo eliminar la planificación');
  }
};

export const getPlanificacionesByUser = async (userId: string): Promise<PlanificacionDocente[]> => {
  try {
    const q = query(
      collection(db, PLANIFICACIONES_COLLECTION),
      where('userId', '==', userId),
      orderBy('fechaCreacion', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertFirestoreData);
  } catch (error) {
    console.error('Error al obtener planificaciones:', error);
    return [];
  }
};

export const getPlanificacionesByType = async (userId: string, tipo: 'Unidad' | 'Clase'): Promise<PlanificacionDocente[]> => {
  try {
    const q = query(
      collection(db, PLANIFICACIONES_COLLECTION),
      where('userId', '==', userId),
      where('tipo', '==', tipo),
      orderBy('fechaCreacion', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertFirestoreData);
  } catch (error) {
    console.error('Error al obtener planificaciones por tipo:', error);
    return [];
  }
};

export const subscribeToPlanificaciones = (
  userId: string, 
  callback: (planificaciones: PlanificacionDocente[]) => void
): (() => void) => {
  const q = query(
    collection(db, PLANIFICACIONES_COLLECTION),
    where('userId', '==', userId),
    orderBy('fechaCreacion', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const planificaciones = snapshot.docs.map(convertFirestoreData);
    callback(planificaciones);
  }, (error) => {
    console.error('Error en suscripción a planificaciones:', error);
  });
};

// ===== ACTIVIDADES CALENDARIO =====

export const saveActividad = async (actividad: Omit<ActividadPlanificada, 'id'>, userId: string): Promise<string> => {
  try {
    const actividadData = {
      ...actividad,
      userId,
      fechaCreacion: Timestamp.fromDate(new Date()),
      fechaActualizacion: Timestamp.fromDate(new Date())
    };

    const docRef = await addDoc(collection(db, ACTIVIDADES_COLLECTION), actividadData);
    return docRef.id;
  } catch (error) {
    console.error('Error al guardar actividad:', error);
    throw new Error('No se pudo guardar la actividad');
  }
};

export const updateActividad = async (id: string, updates: Partial<ActividadPlanificada>, userId: string): Promise<void> => {
  try {
    const docRef = doc(db, ACTIVIDADES_COLLECTION, id);
    
    // Verificar que el documento pertenece al usuario
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('No tienes permisos para actualizar esta actividad');
    }

    await updateDoc(docRef, {
      ...updates,
      fechaActualizacion: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.error('Error al actualizar actividad:', error);
    throw new Error('No se pudo actualizar la actividad');
  }
};

export const deleteActividad = async (id: string, userId: string): Promise<void> => {
  try {
    const docRef = doc(db, ACTIVIDADES_COLLECTION, id);
    
    // Verificar que el documento pertenece al usuario
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('No tienes permisos para eliminar esta actividad');
    }

    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error al eliminar actividad:', error);
    throw new Error('No se pudo eliminar la actividad');
  }
};

export const getActividadesByUser = async (userId: string): Promise<ActividadPlanificada[]> => {
  try {
    const q = query(
      collection(db, ACTIVIDADES_COLLECTION),
      where('userId', '==', userId),
      orderBy('fecha', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertFirestoreData);
  } catch (error) {
    console.error('Error al obtener actividades:', error);
    return [];
  }
};

export const subscribeToActividades = (
  userId: string, 
  callback: (actividades: ActividadPlanificada[]) => void
): (() => void) => {
  const q = query(
    collection(db, ACTIVIDADES_COLLECTION),
    where('userId', '==', userId),
    orderBy('fecha', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const actividades = snapshot.docs.map(convertFirestoreData);
    callback(actividades);
  }, (error) => {
    console.error('Error en suscripción a actividades:', error);
  });
};

// ===== EVENTOS CALENDARIO =====

export const saveCalendarEvent = async (evento: Omit<CalendarEvent, 'id'>, userId: string): Promise<string> => {
  try {
    const eventoData = {
      ...evento,
      userId,
      fechaCreacion: Timestamp.fromDate(new Date())
    };

    const docRef = await addDoc(collection(db, CALENDAR_COLLECTION), eventoData);
    return docRef.id;
  } catch (error) {
    console.error('Error al guardar evento:', error);
    throw new Error('No se pudo guardar el evento');
  }
};

export const deleteCalendarEvent = async (id: string, userId: string): Promise<void> => {
  try {
    const docRef = doc(db, CALENDAR_COLLECTION, id);
    
    // Verificar que el documento pertenece al usuario
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('No tienes permisos para eliminar este evento');
    }

    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error al eliminar evento:', error);
    throw new Error('No se pudo eliminar el evento');
  }
};

export const getCalendarEventsByUser = async (userId: string): Promise<CalendarEvent[]> => {
  try {
    const q = query(
      collection(db, CALENDAR_COLLECTION),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertFirestoreData);
  } catch (error) {
    console.error('Error al obtener eventos:', error);
    return [];
  }
};

export const subscribeToCalendarEvents = (
  userId: string, 
  callback: (eventos: CalendarEvent[]) => void
): (() => void) => {
  const q = query(
    collection(db, CALENDAR_COLLECTION),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const eventos = snapshot.docs.map(convertFirestoreData);
    callback(eventos);
  }, (error) => {
    console.error('Error en suscripción a eventos:', error);
  });
};

// ===== UTILIDADES =====

export const checkEventExists = async (
  userId: string,
  fecha: string,
  responsables: string,
  ubicacion: string
): Promise<boolean> => {
  try {
    const q = query(
      collection(db, CALENDAR_COLLECTION),
      where('userId', '==', userId),
      where('date', '==', fecha),
      where('type', '==', EventType.ACTIVIDAD_FOCALIZADA),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    // Verificar si existe un evento con los mismos datos
    return querySnapshot.docs.some(doc => {
      const data = doc.data() as ActividadFocalizadaEvent;
      return data.responsables === responsables && data.ubicacion === ubicacion;
    });
  } catch (error) {
    console.error('Error al verificar evento existente:', error);
    return false;
  }
};

// Batch operations para operaciones múltiples
export const batchDeletePlanificaciones = async (ids: string[], userId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);

    for (const id of ids) {
      const docRef = doc(db, PLANIFICACIONES_COLLECTION, id);
      
      // Verificar que el documento pertenece al usuario
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        throw new Error(`No tienes permisos para eliminar la planificación ${id}`);
      }

      batch.delete(docRef);
    }

    await batch.commit();
  } catch (error) {
    console.error('Error en eliminación por lotes:', error);
    throw new Error('No se pudieron eliminar todas las planificaciones');
  }
};