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
  getDoc,
} from 'firebase/firestore';
import { db } from './config';
import { ActividadRemota, RespuestaEstudianteActividad, User } from '../../types';

// --- CONSTANTES DE COLECCIONES (DEBEN COINCIDIR CON actividadesRemotasHelper) ---
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
 * MEJORADO: Con mejor manejo de errores y logging
 */
export const subscribeToActividadesDisponibles = (
  currentUser: User,
  callback: (data: ActividadRemota[]) => void
) => {
  console.log('🔔 Suscribiéndose a actividades disponibles para:', currentUser.nombreCompleto);
  
  const q = query(collection(db, ACTIVIDADES_COLLECTION), orderBy('fechaCreacion', 'desc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    console.log('📋 Actividades recibidas desde Firestore:', querySnapshot.docs.length);
    
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
    
    console.log('✅ Actividades filtradas para el estudiante:', actividadesDisponibles.length);
    callback(actividadesDisponibles);
  }, (error) => {
    console.error("❌ Error al suscribirse a las actividades disponibles:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Se suscribe a las respuestas de un estudiante específico.
 * MEJORADO: Con logging detallado y mejor sincronización
 */
export const subscribeToRespuestasEstudiante = (
  estudianteId: string,
  callback: (data: RespuestaEstudianteActividad[]) => void
) => {
  console.log('🔔 Suscribiéndose a respuestas del estudiante:', estudianteId);
  
  const q = query(
    collection(db, RESPUESTAS_COLLECTION), 
    where('estudianteId', '==', estudianteId),
    orderBy('fechaCompletado', 'desc')
  );
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    console.log('📝 Respuestas recibidas desde Firestore:', querySnapshot.docs.length);
    
    const respuestas = querySnapshot.docs.map(doc => {
      const respuesta = convertFirestoreDoc<RespuestaEstudianteActividad>(doc);
      
      // LOG DETALLADO para debugging
      console.log(`📄 Respuesta ${doc.id}:`, {
        actividadId: respuesta.actividadId,
        puntaje: respuesta.puntaje,
        nota: respuesta.nota,
        requiereRevision: respuesta.requiereRevisionDocente,
        revisionCompletada: respuesta.revisionDocente?.completada,
        fechaCompletado: respuesta.fechaCompletado
      });
      
      return respuesta;
    });
    
    console.log('✅ Enviando respuestas procesadas al componente:', respuestas.length);
    callback(respuestas);
  }, (error) => {
    console.error("❌ Error al suscribirse a las respuestas del estudiante:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Guarda la respuesta de una actividad.
 * MEJORADO: Con mejor logging y validación
 */
export const saveRespuestaActividad = async (
  respuestaData: Omit<RespuestaEstudianteActividad, 'id'>
): Promise<string> => {
  try {
    console.log('💾 Guardando respuesta de actividad:', {
      actividadId: respuestaData.actividadId,
      estudianteId: respuestaData.estudianteId,
      puntaje: respuestaData.puntaje,
      nota: respuestaData.nota
    });
    
    // Asegura que la fecha se guarde como un Timestamp de Firestore
    const dataToSend = {
      ...respuestaData,
      fechaCompletado: Timestamp.fromDate(new Date(respuestaData.fechaCompletado)),
    };
    
    const docRef = await addDoc(collection(db, RESPUESTAS_COLLECTION), dataToSend);
    
    console.log('✅ Respuesta guardada exitosamente con ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error al guardar la respuesta de actividad:", error);
    throw new Error("No se pudo guardar la respuesta de la actividad.");
  }
};

/**
 * NUEVA: Función para obtener una respuesta específica (para debugging)
 */
export const getRespuestaById = async (respuestaId: string): Promise<RespuestaEstudianteActividad | null> => {
  try {
    const docSnap = await getDoc(doc(db, RESPUESTAS_COLLECTION, respuestaId));
    if (docSnap.exists()) {
      return convertFirestoreDoc<RespuestaEstudianteActividad>(docSnap);
    }
    return null;
  } catch (error) {
    console.error("Error al obtener respuesta por ID:", error);
    return null;
  }
};

/**
 * NUEVA: Función para obtener todas las respuestas de un estudiante (sin subscripción)
 */
export const getRespuestasEstudiante = async (estudianteId: string): Promise<RespuestaEstudianteActividad[]> => {
  try {
    console.log('🔍 Obteniendo respuestas del estudiante (sin suscripción):', estudianteId);
    
    const q = query(
      collection(db, RESPUESTAS_COLLECTION), 
      where('estudianteId', '==', estudianteId),
      orderBy('fechaCompletado', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const respuestas = querySnapshot.docs.map(doc => convertFirestoreDoc<RespuestaEstudianteActividad>(doc));
    
    console.log('📊 Respuestas obtenidas:', respuestas.length);
    return respuestas;
  } catch (error) {
    console.error("❌ Error al obtener respuestas del estudiante:", error);
    return [];
  }
};

/**
 * NUEVA: Función para verificar si una actividad específica fue completada
 */
export const checkActividadCompletada = async (actividadId: string, estudianteId: string): Promise<RespuestaEstudianteActividad | null> => {
  try {
    const q = query(
      collection(db, RESPUESTAS_COLLECTION),
      where('actividadId', '==', actividadId),
      where('estudianteId', '==', estudianteId)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.docs.length > 0) {
      return convertFirestoreDoc<RespuestaEstudianteActividad>(querySnapshot.docs[0]);
    }
    return null;
  } catch (error) {
    console.error("Error al verificar si actividad fue completada:", error);
    return null;
  }
};

/**
 * NUEVA: Función para debug - mostrar el estado actual de las respuestas
 */
export const debugRespuestasEstudiante = async (estudianteId: string) => {
  console.log('🐛 === DEBUG: Estado de respuestas del estudiante ===');
  
  const respuestas = await getRespuestasEstudiante(estudianteId);
  
  respuestas.forEach((respuesta, index) => {
    console.log(`📋 Respuesta ${index + 1}:`, {
      id: respuesta.id,
      actividadId: respuesta.actividadId,
      puntaje: `${respuesta.puntaje}/${respuesta.puntajeMaximo}`,
      nota: respuesta.nota,
      requiereRevision: respuesta.requiereRevisionDocente,
      revisionCompletada: respuesta.revisionDocente?.completada,
      puntajeDocente: respuesta.revisionDocente?.puntajeDocente,
      fechaCompletado: respuesta.fechaCompletado
    });
  });
  
  console.log('🐛 === FIN DEBUG ===');
  return respuestas;
};
