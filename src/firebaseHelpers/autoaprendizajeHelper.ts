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
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';
import { ActividadRemota, RespuestaEstudianteActividad, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const ACTIVIDADES_COLLECTION = 'actividades_remotas';
const RESPUESTAS_COLLECTION = 'respuestas_actividades';

// --- TIPOS PARA MANEJO DE ERRORES ---
interface FirestoreError extends Error {
  code?: string;
  message: string;
}

interface SubscriptionCallbacks<T> {
  onSuccess: (data: T) => void;
  onError?: (error: FirestoreError) => void;
}

// --- HELPERS DE CONVERSIÓN ---
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
    fechaCreacion: toISO(data.fechaCreacion) || data.fechaCreacion,
    plazoEntrega: toYYYYMMDD(data.plazoEntrega) || data.plazoEntrega,
    fechaCompletado: toISO(data.fechaCompletado) || data.fechaCompletado,
  } as T;
};

// --- FUNCIONES DE MANEJO DE ERRORES ---
const handleFirestoreError = (error: any, context: string): FirestoreError => {
  console.error(`❌ Error en ${context}:`, error);
  
  const firestoreError: FirestoreError = {
    name: 'FirestoreError',
    message: error.message || 'Error desconocido',
    code: error.code
  };

  // Mensajes específicos para errores comunes
  if (error.code === 'failed-precondition' && error.message?.includes('requires an index')) {
    firestoreError.message = 'Se requiere configurar un índice en la base de datos. Contacta al administrador.';
    console.log('🔗 Enlace para crear índice:', error.message.match(/https:\/\/[^\s]+/)?.[0]);
  } else if (error.code === 'permission-denied') {
    firestoreError.message = 'No tienes permisos para acceder a estos datos.';
  } else if (error.code === 'unavailable') {
    firestoreError.message = 'Servicio temporalmente no disponible. Intenta nuevamente.';
  }

  return firestoreError;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Implementa reintento con backoff exponencial para operaciones de Firestore
 */
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  context = 'operación'
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      console.log(`⚠️ Intento ${attempt} falló en ${context}:`, error.code || error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Solo reintentar en errores temporales
      if (['unavailable', 'deadline-exceeded', 'internal'].includes(error.code)) {
        const delayMs = Math.pow(2, attempt) * 1000; // Backoff exponencial
        console.log(`⏱️ Reintentando en ${delayMs}ms...`);
        await delay(delayMs);
      } else {
        // Error no temporal, no reintentar
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
};

// --- GESTIÓN DE ACTIVIDADES REMOTAS MEJORADA ---

/**
 * Suscripción a actividades con manejo robusto de errores
 */
export const subscribeToActividadesDisponibles = (
  currentUser: User,
  onSuccess: (data: ActividadRemota[]) => void,
  onError?: (error: FirestoreError) => void
) => {
  console.log('🔔 Suscribiéndose a actividades disponibles para:', currentUser.nombreCompleto);
  
  const q = query(collection(db, ACTIVIDADES_COLLECTION), orderBy('fechaCreacion', 'desc'));
  
  const unsubscribe = onSnapshot(
    q, 
    {
      next: (querySnapshot) => {
        try {
          console.log('📋 Actividades recibidas desde Firestore:', querySnapshot.docs.length);
          
          const todasActividades = querySnapshot.docs.map(doc => convertFirestoreDoc<ActividadRemota>(doc));
          
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
          onSuccess(actividadesDisponibles);
        } catch (processingError: any) {
          console.error('❌ Error procesando datos de actividades:', processingError);
          const error = handleFirestoreError(processingError, 'procesamiento de actividades');
          onError?.(error);
        }
      },
      error: (error) => {
        const firestoreError = handleFirestoreError(error, 'suscripción a actividades');
        onError?.(firestoreError);
      }
    }
  );

  return unsubscribe;
};

/**
 * Suscripción a respuestas con manejo de error de índice
 */
export const subscribeToRespuestasEstudiante = (
  estudianteId: string,
  onSuccess: (data: RespuestaEstudianteActividad[]) => void,
  onError?: (error: FirestoreError) => void
) => {
  console.log('🔔 Suscribiéndose a respuestas del estudiante:', estudianteId);
  
  // Intentar primero con la consulta completa (con índice)
  const qWithIndex = query(
    collection(db, RESPUESTAS_COLLECTION), 
    where('estudianteId', '==', estudianteId),
    orderBy('fechaCompletado', 'desc')
  );
  
  const unsubscribe = onSnapshot(
    qWithIndex,
    {
      next: (querySnapshot) => {
        try {
          console.log('📝 Respuestas recibidas desde Firestore:', querySnapshot.docs.length);
          
          const respuestas = querySnapshot.docs.map(doc => {
            const respuesta = convertFirestoreDoc<RespuestaEstudianteActividad>(doc);
            
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
          onSuccess(respuestas);
        } catch (processingError: any) {
          console.error('❌ Error procesando respuestas:', processingError);
          const error = handleFirestoreError(processingError, 'procesamiento de respuestas');
          onError?.(error);
        }
      },
      error: (error) => {
        const firestoreError = handleFirestoreError(error, 'suscripción a respuestas');
        
        // Si es error de índice, intentar consulta alternativa
        if (error.code === 'failed-precondition' && error.message?.includes('requires an index')) {
          console.log('⚠️ Error de índice detectado, intentando consulta alternativa...');
          return subscribeToRespuestasEstudianteAlternative(estudianteId, onSuccess, onError);
        }
        
        onError?.(firestoreError);
      }
    }
  );

  return unsubscribe;
};

/**
 * Consulta alternativa sin ordenamiento para casos donde falta el índice
 */
const subscribeToRespuestasEstudianteAlternative = (
  estudianteId: string,
  onSuccess: (data: RespuestaEstudianteActividad[]) => void,
  onError?: (error: FirestoreError) => void
) => {
  console.log('🔄 Usando consulta alternativa sin ordenamiento...');
  
  const qSimple = query(
    collection(db, RESPUESTAS_COLLECTION), 
    where('estudianteId', '==', estudianteId)
  );
  
  const unsubscribe = onSnapshot(
    qSimple,
    {
      next: (querySnapshot) => {
        try {
          console.log('📝 Respuestas recibidas (consulta alternativa):', querySnapshot.docs.length);
          
          const respuestas = querySnapshot.docs
            .map(doc => convertFirestoreDoc<RespuestaEstudianteActividad>(doc))
            .sort((a, b) => new Date(b.fechaCompletado).getTime() - new Date(a.fechaCompletado).getTime());
          
          console.log('✅ Respuestas ordenadas manualmente:', respuestas.length);
          onSuccess(respuestas);
        } catch (processingError: any) {
          console.error('❌ Error procesando respuestas (alternativa):', processingError);
          const error = handleFirestoreError(processingError, 'procesamiento de respuestas alternativo');
          onError?.(error);
        }
      },
      error: (error) => {
        const firestoreError = handleFirestoreError(error, 'suscripción alternativa a respuestas');
        onError?.(firestoreError);
      }
    }
  );

  return unsubscribe;
};

/**
 * Guardado de respuesta con reintentos automáticos
 */
export const saveRespuestaActividad = async (
  respuestaData: Omit<RespuestaEstudianteActividad, 'id'>
): Promise<string> => {
  return withRetry(async () => {
    console.log('💾 Guardando respuesta de actividad:', {
      actividadId: respuestaData.actividadId,
      estudianteId: respuestaData.estudianteId,
      puntaje: respuestaData.puntaje,
      nota: respuestaData.nota
    });
    
    const dataToSend = {
      ...respuestaData,
      fechaCompletado: Timestamp.fromDate(new Date(respuestaData.fechaCompletado)),
    };
    
    const docRef = await addDoc(collection(db, RESPUESTAS_COLLECTION), dataToSend);
    
    console.log('✅ Respuesta guardada exitosamente con ID:', docRef.id);
    return docRef.id;
  }, 3, 'guardado de respuesta');
};

/**
 * Actualización de documento con manejo de errores
 */
export const updateRespuestaActividad = async (
  respuestaId: string,
  updateData: Partial<RespuestaEstudianteActividad>
): Promise<void> => {
  return withRetry(async () => {
    console.log('🔄 Actualizando respuesta:', respuestaId, updateData);
    
    const docRef = doc(db, RESPUESTAS_COLLECTION, respuestaId);
    await updateDoc(docRef, updateData);
    
    console.log('✅ Respuesta actualizada exitosamente');
  }, 3, 'actualización de respuesta');
};

/**
 * Obtener respuesta específica con manejo de errores
 */
export const getRespuestaById = async (respuestaId: string): Promise<RespuestaEstudianteActividad | null> => {
  return withRetry(async () => {
    const docSnap = await getDoc(doc(db, RESPUESTAS_COLLECTION, respuestaId));
    if (docSnap.exists()) {
      return convertFirestoreDoc<RespuestaEstudianteActividad>(docSnap);
    }
    return null;
  }, 2, `obtención de respuesta ${respuestaId}`);
};

/**
 * Obtener todas las respuestas de un estudiante (sin suscripción)
 */
export const getRespuestasEstudiante = async (estudianteId: string): Promise<RespuestaEstudianteActividad[]> => {
  return withRetry(async () => {
    console.log('🔍 Obteniendo respuestas del estudiante (sin suscripción):', estudianteId);
    
    // Intentar primero con ordenamiento
    try {
      const q = query(
        collection(db, RESPUESTAS_COLLECTION), 
        where('estudianteId', '==', estudianteId),
        orderBy('fechaCompletado', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const respuestas = querySnapshot.docs.map(doc => convertFirestoreDoc<RespuestaEstudianteActividad>(doc));
      
      console.log('📊 Respuestas obtenidas con ordenamiento:', respuestas.length);
      return respuestas;
    } catch (error: any) {
      if (error.code === 'failed-precondition' && error.message?.includes('requires an index')) {
        console.log('⚠️ Índice no disponible, usando consulta alternativa...');
        
        const qSimple = query(
          collection(db, RESPUESTAS_COLLECTION), 
          where('estudianteId', '==', estudianteId)
        );
        
        const querySnapshot = await getDocs(qSimple);
        const respuestas = querySnapshot.docs
          .map(doc => convertFirestoreDoc<RespuestaEstudianteActividad>(doc))
          .sort((a, b) => new Date(b.fechaCompletado).getTime() - new Date(a.fechaCompletado).getTime());
        
        console.log('📊 Respuestas obtenidas sin ordenamiento:', respuestas.length);
        return respuestas;
      }
      throw error;
    }
  }, 2, `obtención de respuestas del estudiante ${estudianteId}`);
};

/**
 * Verificar si una actividad específica fue completada
 */
export const checkActividadCompletada = async (
  actividadId: string, 
  estudianteId: string
): Promise<RespuestaEstudianteActividad | null> => {
  return withRetry(async () => {
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
  }, 2, `verificación de actividad completada ${actividadId}`);
};

/**
 * Función de debug mejorada con manejo de errores
 */
export const debugRespuestasEstudiante = async (estudianteId: string) => {
  console.log('🐛 === DEBUG: Estado de respuestas del estudiante ===');
  
  try {
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
  } catch (error: any) {
    console.error('❌ Error en debug de respuestas:', error);
    return [];
  }
};

/**
 * NUEVA: Función para verificar el estado de la conexión
 */
export const checkFirestoreConnection = async (): Promise<boolean> => {
  try {
    // Intenta una consulta simple para verificar conectividad
    const testQuery = query(collection(db, RESPUESTAS_COLLECTION), where('__name__', '==', 'test-connectivity'));
    await getDocs(testQuery);
    console.log('✅ Conexión a Firestore verificada');
    return true;
  } catch (error: any) {
    console.error('❌ Error de conexión a Firestore:', error);
    return false;
  }
};

/**
 * NUEVA: Función para limpiar datos temporales/cache
 */
export const clearLocalCache = () => {
  try {
    // Limpiar datos específicos del localStorage si los hay
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('progress-') || key.startsWith('autoaprendizaje-')) {
        localStorage.removeItem(key);
        console.log('🧹 Limpiado cache local:', key);
      }
    });
    console.log('✅ Cache local limpiado');
  } catch (error) {
    console.warn('⚠️ Error al limpiar cache local:', error);
  }
};