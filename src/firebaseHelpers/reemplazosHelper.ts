// src/firebaseHelpers/reemplazosHelper.ts

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
  writeBatch,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from './config';
import { Reemplazo, User, Profile } from '../../types';

// Interfaz extendida para Firebase (agrega campos de metadatos)
interface ReemplazoFirebase extends Reemplazo {
  userId?: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

// Colecciones de Firestore
const REEMPLAZOS_COLLECTION = 'reemplazos_docentes';
const USERS_COLLECTION = 'usuarios';

// Helper para convertir datos de Firestore
const convertFirestoreReemplazo = (doc: any): ReemplazoFirebase => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.()?.toISOString() || data.fechaCreacion,
    fechaActualizacion: data.fechaActualizacion?.toDate?.()?.toISOString() || data.fechaActualizacion
  };
};

const convertFirestoreUser = (doc: any): User => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data
  };
};

// ===== REEMPLAZOS =====

export const saveReemplazo = async (reemplazo: Omit<Reemplazo, 'id'>, userId: string): Promise<string> => {
  try {
    const reemplazoData = {
      ...reemplazo,
      userId,
      fechaCreacion: Timestamp.fromDate(new Date()),
      fechaActualizacion: Timestamp.fromDate(new Date())
    };

    const docRef = await addDoc(collection(db, REEMPLAZOS_COLLECTION), reemplazoData);
    return docRef.id;
  } catch (error) {
    console.error('Error al guardar reemplazo:', error);
    throw new Error('No se pudo guardar el reemplazo');
  }
};

export const updateReemplazo = async (id: string, updates: Partial<Reemplazo>, userId: string): Promise<void> => {
  try {
    const docRef = doc(db, REEMPLAZOS_COLLECTION, id);
    
    // Verificar que el documento pertenece al usuario
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('No tienes permisos para actualizar este reemplazo');
    }

    await updateDoc(docRef, {
      ...updates,
      fechaActualizacion: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.error('Error al actualizar reemplazo:', error);
    throw new Error('No se pudo actualizar el reemplazo');
  }
};

export const deleteReemplazo = async (id: string, userId: string): Promise<void> => {
  try {
    const docRef = doc(db, REEMPLAZOS_COLLECTION, id);
    
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('No tienes permisos para eliminar este reemplazo');
    }

    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error al eliminar reemplazo:', error);
    throw new Error('No se pudo eliminar el reemplazo');
  }
};

export const getReemplazosByUser = async (userId: string, limitCount: number = 50): Promise<ReemplazoFirebase[]> => {
  try {
    const q = query(
      collection(db, REEMPLAZOS_COLLECTION),
      where('userId', '==', userId),
      orderBy('diaAusencia', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertFirestoreReemplazo);
  } catch (error) {
    console.error('Error al obtener reemplazos:', error);
    return [];
  }
};

export const subscribeToReemplazos = (
  userId: string, 
  callback: (reemplazos: ReemplazoFirebase[]) => void,
  limitCount: number = 50
): (() => void) => {
  const q = query(
    collection(db, REEMPLAZOS_COLLECTION),
    where('userId', '==', userId),
    orderBy('diaAusencia', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const reemplazos = snapshot.docs.map(convertFirestoreReemplazo);
    callback(reemplazos);
  }, (error) => {
    console.error('Error en suscripción a reemplazos:', error);
  });
};

// ===== PROFESORES (SECCIÓN CORREGIDA) =====

/**
 * Se suscribe en tiempo real a la lista de usuarios que tienen el perfil de "Profesorado".
 * Esta función NO depende del usuario actual, ya que debe obtener la lista completa para los menús desplegables.
 *
 * @param callback La función que se ejecutará cada vez que la lista de profesores cambie.
 * @returns Una función para cancelar la suscripción y evitar fugas de memoria.
 */
export const subscribeToProfesores = (
  callback: (profesores: User[]) => void
): (() => void) => {
  
  // La consulta correcta: trae todos los documentos de la colección 'usuarios'
  // donde el campo 'profile' es exactamente 'Profesorado'.
  // Usamos el enum 'Profile' importado para evitar errores de tipeo.
  const q = query(
    collection(db, USERS_COLLECTION), 
    where('profile', '==', Profile.PROFESORADO)
  );

  const unsubscribe = onSnapshot(q, 
    (querySnapshot) => {
      // Mapeamos cada documento al tipo 'User' usando el helper
      const profesores = querySnapshot.docs.map(convertFirestoreUser);
      
      // Entregamos la lista de profesores al componente que nos llamó
      callback(profesores);
    }, 
    (error) => {
      // Es crucial manejar los errores aquí. Si las reglas de seguridad fallan,
      // el error se mostrará en la consola del navegador.
      console.error("Error al obtener la lista de profesores:", error);
      // En caso de error, devolvemos un array vacío para no romper la UI.
      callback([]);
    }
  );

  // Devolvemos la función de desuscripción que nos da onSnapshot.
  // React la usará para limpiar el listener cuando el componente se desmonte.
  return unsubscribe;
};

// ===== ESTADÍSTICAS Y REPORTES =====

export const getReemplazosStats = async (userId: string, month?: string, year?: string) => {
  try {
    let q = query(
      collection(db, REEMPLAZOS_COLLECTION),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const reemplazos = querySnapshot.docs.map(convertFirestoreReemplazo);

    const totalReemplazos = reemplazos.length;
    const horasRealizadas = reemplazos.filter(r => r.resultado === 'Hora realizada').length;
    const horasCubiertas = reemplazos.filter(r => r.resultado === 'Hora cubierta, no realizada').length;
    
    return {
      totalReemplazos,
      horasRealizadas,
      horasCubiertas,
      porcentajeRealizadas: totalReemplazos > 0 ? (horasRealizadas / totalReemplazos) * 100 : 0
    };
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    throw new Error('No se pudieron obtener las estadísticas');
  }
};

// ===== UTILIDADES =====

export const searchReemplazos = async (
  userId: string,
  searchTerm: string
): Promise<ReemplazoFirebase[]> => {
  try {
    const q = query(
      collection(db, REEMPLAZOS_COLLECTION),
      where('userId', '==', userId),
      orderBy('diaAusencia', 'desc'),
      limit(100)
    );

    const querySnapshot = await getDocs(q);
    const allReemplazos = querySnapshot.docs.map(convertFirestoreReemplazo);

    // Filtrar en el cliente. Para datasets muy grandes, considera usar un servicio de búsqueda como Algolia.
    const searchTermLower = searchTerm.toLowerCase();
    
    return allReemplazos.filter(reemplazo => {
      return reemplazo.docenteAusente.toLowerCase().includes(searchTermLower) ||
             reemplazo.docenteReemplazante.toLowerCase().includes(searchTermLower) ||
             reemplazo.curso.toLowerCase().includes(searchTermLower) ||
             reemplazo.diaAusencia.includes(searchTermLower) ||
             reemplazo.asignaturaAusente.toLowerCase().includes(searchTermLower) ||
             reemplazo.asignaturaReemplazante.toLowerCase().includes(searchTermLower);
    });
  } catch (error) {
    console.error('Error en búsqueda de reemplazos:', error);
    return [];
  }
};