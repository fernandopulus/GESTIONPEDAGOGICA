// firebase/reemplazosHelper.ts
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
import { Reemplazo, User, Profile } from '../types';

// Colecciones de Firestore
const REEMPLAZOS_COLLECTION = 'reemplazos_docentes';
const USERS_COLLECTION = 'usuarios';

// Helper para convertir datos de Firestore
const convertFirestoreReemplazo = (doc: any): Reemplazo => {
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
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.()?.toISOString() || data.fechaCreacion
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
    
    // Verificar que el documento pertenece al usuario
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

export const getReemplazosByUser = async (userId: string, limitCount: number = 50): Promise<Reemplazo[]> => {
  try {
    const q = query(
      collection(db, REEMPLAZOS_COLLECTION),
      where('userId', '==', userId),
      orderBy('diaAusencia', 'desc'),
      orderBy('fechaCreacion', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertFirestoreReemplazo);
  } catch (error) {
    console.error('Error al obtener reemplazos:', error);
    return [];
  }
};

export const getReemplazosByDateRange = async (
  userId: string,
  startDate: string,
  endDate: string
): Promise<Reemplazo[]> => {
  try {
    const q = query(
      collection(db, REEMPLAZOS_COLLECTION),
      where('userId', '==', userId),
      where('diaAusencia', '>=', startDate),
      where('diaAusencia', '<=', endDate),
      orderBy('diaAusencia', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertFirestoreReemplazo);
  } catch (error) {
    console.error('Error al obtener reemplazos por rango de fecha:', error);
    return [];
  }
};

export const getReemplazosByDocente = async (
  userId: string,
  docenteName: string,
  tipo: 'ausente' | 'reemplazante' = 'ausente'
): Promise<Reemplazo[]> => {
  try {
    const field = tipo === 'ausente' ? 'docenteAusente' : 'docenteReemplazante';
    const q = query(
      collection(db, REEMPLAZOS_COLLECTION),
      where('userId', '==', userId),
      where(field, '==', docenteName),
      orderBy('diaAusencia', 'desc'),
      limit(100)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertFirestoreReemplazo);
  } catch (error) {
    console.error('Error al obtener reemplazos por docente:', error);
    return [];
  }
};

export const subscribeToReemplazos = (
  userId: string, 
  callback: (reemplazos: Reemplazo[]) => void,
  limitCount: number = 50
): (() => void) => {
  const q = query(
    collection(db, REEMPLAZOS_COLLECTION),
    where('userId', '==', userId),
    orderBy('diaAusencia', 'desc'),
    orderBy('fechaCreacion', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const reemplazos = snapshot.docs.map(convertFirestoreReemplazo);
    callback(reemplazos);
  }, (error) => {
    console.error('Error en suscripción a reemplazos:', error);
  });
};

// ===== PROFESORES =====

export const getProfesoresByUser = async (userId: string): Promise<User[]> => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('userId', '==', userId),
      where('profile', '==', Profile.PROFESORADO),
      orderBy('nombreCompleto', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertFirestoreUser);
  } catch (error) {
    console.error('Error al obtener profesores:', error);
    return [];
  }
};

export const subscribeToProfesores = (
  userId: string, 
  callback: (profesores: User[]) => void
): (() => void) => {
  const q = query(
    collection(db, USERS_COLLECTION),
    where('userId', '==', userId),
    where('profile', '==', Profile.PROFESORADO),
    orderBy('nombreCompleto', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const profesores = snapshot.docs.map(convertFirestoreUser);
    callback(profesores);
  }, (error) => {
    console.error('Error en suscripción a profesores:', error);
  });
};

// ===== ESTADÍSTICAS Y REPORTES =====

export const getReemplazosStats = async (userId: string, month?: string, year?: string) => {
  try {
    let q = query(
      collection(db, REEMPLAZOS_COLLECTION),
      where('userId', '==', userId)
    );

    // Filtrar por mes y año si se proporcionan
    if (year) {
      const startDate = month ? `${year}-${month.padStart(2, '0')}-01` : `${year}-01-01`;
      const endDate = month 
        ? `${year}-${month.padStart(2, '0')}-31` 
        : `${year}-12-31`;
      
      q = query(q, 
        where('diaAusencia', '>=', startDate),
        where('diaAusencia', '<=', endDate)
      );
    }

    const querySnapshot = await getDocs(q);
    const reemplazos = querySnapshot.docs.map(convertFirestoreReemplazo);

    // Calcular estadísticas
    const totalReemplazos = reemplazos.length;
    const horasRealizadas = reemplazos.filter(r => r.resultado === 'Hora realizada').length;
    const horasCubiertas = reemplazos.filter(r => r.resultado === 'Hora cubierta, no realizada').length;
    
    // Contar por docente
    const docentesAusentes = reemplazos.reduce((acc, r) => {
      acc[r.docenteAusente] = (acc[r.docenteAusente] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const docentesReemplazantes = reemplazos.reduce((acc, r) => {
      acc[r.docenteReemplazante] = (acc[r.docenteReemplazante] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Contar por curso
    const cursos = reemplazos.reduce((acc, r) => {
      acc[r.curso] = (acc[r.curso] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Contar por asignatura
    const asignaturas = reemplazos.reduce((acc, r) => {
      acc[r.asignaturaAusente] = (acc[r.asignaturaAusente] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalReemplazos,
      horasRealizadas,
      horasCubiertas,
      porcentajeRealizadas: totalReemplazos > 0 ? (horasRealizadas / totalReemplazos) * 100 : 0,
      docentesAusentes,
      docentesReemplazantes,
      cursos,
      asignaturas,
      reemplazos
    };
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    throw new Error('No se pudieron obtener las estadísticas');
  }
};

// ===== UTILIDADES =====

export const searchReemplazos = async (
  userId: string,
  searchTerm: string,
  searchField: 'docente' | 'curso' | 'fecha' | 'all' = 'all'
): Promise<Reemplazo[]> => {
  try {
    let q = query(
      collection(db, REEMPLAZOS_COLLECTION),
      where('userId', '==', userId),
      orderBy('diaAusencia', 'desc'),
      limit(100)
    );

    const querySnapshot = await getDocs(q);
    const allReemplazos = querySnapshot.docs.map(convertFirestoreReemplazo);

    // Filtrar en el cliente (Firestore tiene limitaciones en búsqueda de texto)
    const searchTermLower = searchTerm.toLowerCase();
    
    return allReemplazos.filter(reemplazo => {
      switch (searchField) {
        case 'docente':
          return reemplazo.docenteAusente.toLowerCase().includes(searchTermLower) ||
                 reemplazo.docenteReemplazante.toLowerCase().includes(searchTermLower);
        case 'curso':
          return reemplazo.curso.toLowerCase().includes(searchTermLower);
        case 'fecha':
          return reemplazo.diaAusencia.includes(searchTermLower);
        default:
          return reemplazo.docenteAusente.toLowerCase().includes(searchTermLower) ||
                 reemplazo.docenteReemplazante.toLowerCase().includes(searchTermLower) ||
                 reemplazo.curso.toLowerCase().includes(searchTermLower) ||
                 reemplazo.diaAusencia.includes(searchTermLower) ||
                 reemplazo.asignaturaAusente.toLowerCase().includes(searchTermLower) ||
                 reemplazo.asignaturaReemplazante.toLowerCase().includes(searchTermLower);
      }
    });
  } catch (error) {
    console.error('Error en búsqueda de reemplazos:', error);
    return [];
  }
};

// Operaciones por lotes
export const batchDeleteReemplazos = async (ids: string[], userId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);

    for (const id of ids) {
      const docRef = doc(db, REEMPLAZOS_COLLECTION, id);
      
      // Verificar que el documento pertenece al usuario
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        throw new Error(`No tienes permisos para eliminar el reemplazo ${id}`);
      }

      batch.delete(docRef);
    }

    await batch.commit();
  } catch (error) {
    console.error('Error en eliminación por lotes:', error);
    throw new Error('No se pudieron eliminar todos los reemplazos');
  }
};

// Paginación
export const getReemplazosWithPagination = async (
  userId: string,
  limitCount: number = 20,
  lastVisible?: QueryDocumentSnapshot
): Promise<{ reemplazos: Reemplazo[], lastVisible: QueryDocumentSnapshot | null }> => {
  try {
    let q = query(
      collection(db, REEMPLAZOS_COLLECTION),
      where('userId', '==', userId),
      orderBy('diaAusencia', 'desc'),
      orderBy('fechaCreacion', 'desc'),
      limit(limitCount)
    );

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    const querySnapshot = await getDocs(q);
    const reemplazos = querySnapshot.docs.map(convertFirestoreReemplazo);
    const newLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

    return { reemplazos, lastVisible: newLastVisible };
  } catch (error) {
    console.error('Error al obtener reemplazos con paginación:', error);
    return { reemplazos: [], lastVisible: null };
  }
};