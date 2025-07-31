import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../firebase';
import { AcompanamientoDocente, User } from '../types';

// Colección principal
const ACOMPANAMIENTOS_COLLECTION = 'acompanamientos';
const CONFIGURACION_COLLECTION = 'configuracion';

/**
 * Crear un nuevo acompañamiento docente
 */
export const createAcompanamiento = async (acompanamiento: Omit<AcompanamientoDocente, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, ACOMPANAMIENTOS_COLLECTION), {
      ...acompanamiento,
      fecha: acompanamiento.fecha instanceof Date ? Timestamp.fromDate(acompanamiento.fecha) : acompanamiento.fecha,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error al crear acompañamiento:', error);
    throw new Error('Error al guardar el acompañamiento');
  }
};

/**
 * Actualizar un acompañamiento existente
 */
export const updateAcompanamiento = async (id: string, updates: Partial<Omit<AcompanamientoDocente, 'id'>>): Promise<void> => {
  try {
    const docRef = doc(db, ACOMPANAMIENTOS_COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
      ...(updates.fecha && { fecha: updates.fecha instanceof Date ? Timestamp.fromDate(updates.fecha) : updates.fecha })
    });
  } catch (error) {
    console.error('Error al actualizar acompañamiento:', error);
    throw new Error('Error al actualizar el acompañamiento');
  }
};

/**
 * Eliminar un acompañamiento
 */
export const deleteAcompanamiento = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, ACOMPANAMIENTOS_COLLECTION, id));
  } catch (error) {
    console.error('Error al eliminar acompañamiento:', error);
    throw new Error('Error al eliminar el acompañamiento');
  }
};

/**
 * Obtener un acompañamiento por ID
 */
export const getAcompanamientoById = async (id: string): Promise<AcompanamientoDocente | null> => {
  try {
    const docRef = doc(db, ACOMPANAMIENTOS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        fecha: data.fecha?.toDate?.() || data.fecha
      } as AcompanamientoDocente;
    }
    return null;
  } catch (error) {
    console.error('Error al obtener acompañamiento:', error);
    throw new Error('Error al cargar el acompañamiento');
  }
};

/**
 * Obtener todos los acompañamientos de un docente
 */
export const getAcompanamientosByDocente = async (nombreDocente: string): Promise<AcompanamientoDocente[]> => {
  try {
    const q = query(
      collection(db, ACOMPANAMIENTOS_COLLECTION),
      where('docente', '==', nombreDocente),
      orderBy('fecha', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fecha: doc.data().fecha?.toDate?.() || doc.data().fecha
    })) as AcompanamientoDocente[];
  } catch (error) {
    console.error('Error al obtener acompañamientos del docente:', error);
    throw new Error('Error al cargar los acompañamientos');
  }
};

/**
 * Suscripción en tiempo real a los acompañamientos de un docente
 */
export const subscribeToAcompanamientosByDocente = (
  nombreDocente: string,
  callback: (acompanamientos: AcompanamientoDocente[]) => void,
  onError?: (error: Error) => void
) => {
  try {
    const q = query(
      collection(db, ACOMPANAMIENTOS_COLLECTION),
      where('docente', '==', nombreDocente),
      orderBy('fecha', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const acompanamientos = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            fecha: data.fecha?.toDate?.() || data.fecha
          } as AcompanamientoDocente;
        });
        callback(acompanamientos);
      },
      (error) => {
        console.error('Error en suscripción a acompañamientos:', error);
        if (onError) {
          onError(new Error('Error al cargar los acompañamientos'));
        }
      }
    );
  } catch (error) {
    console.error('Error al configurar suscripción:', error);
    if (onError) {
      onError(new Error('Error al configurar la consulta'));
    }
  }
};

/**
 * Obtener todos los acompañamientos (para administradores)
 */
export const getAllAcompanamientos = async (filters?: {
  startDate?: Date;
  endDate?: Date;
  docente?: string;
  curso?: string;
  asignatura?: string;
}): Promise<AcompanamientoDocente[]> => {
  try {
    const constraints: QueryConstraint[] = [orderBy('fecha', 'desc')];
    
    // Aplicar filtros
    if (filters?.docente) {
      constraints.push(where('docente', '==', filters.docente));
    }
    if (filters?.curso) {
      constraints.push(where('curso', '==', filters.curso));
    }
    if (filters?.asignatura) {
      constraints.push(where('asignatura', '==', filters.asignatura));
    }
    if (filters?.startDate) {
      constraints.push(where('fecha', '>=', Timestamp.fromDate(filters.startDate)));
    }
    if (filters?.endDate) {
      constraints.push(where('fecha', '<=', Timestamp.fromDate(filters.endDate)));
    }

    const q = query(collection(db, ACOMPANAMIENTOS_COLLECTION), ...constraints);
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fecha: doc.data().fecha?.toDate?.() || doc.data().fecha
    })) as AcompanamientoDocente[];
  } catch (error) {
    console.error('Error al obtener todos los acompañamientos:', error);
    throw new Error('Error al cargar los acompañamientos');
  }
};

/**
 * Suscripción en tiempo real a todos los acompañamientos
 */
export const subscribeToAllAcompanamientos = (
  callback: (acompanamientos: AcompanamientoDocente[]) => void,
  onError?: (error: Error) => void,
  filters?: {
    docente?: string;
    curso?: string;
    asignatura?: string;
  }
) => {
  try {
    const constraints: QueryConstraint[] = [orderBy('fecha', 'desc')];
    
    // Aplicar filtros
    if (filters?.docente) {
      constraints.push(where('docente', '==', filters.docente));
    }
    if (filters?.curso) {
      constraints.push(where('curso', '==', filters.curso));
    }
    if (filters?.asignatura) {
      constraints.push(where('asignatura', '==', filters.asignatura));
    }

    const q = query(collection(db, ACOMPANAMIENTOS_COLLECTION), ...constraints);

    return onSnapshot(
      q,
      (snapshot) => {
        const acompanamientos = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            fecha: data.fecha?.toDate?.() || data.fecha
          } as AcompanamientoDocente;
        });
        callback(acompanamientos);
      },
      (error) => {
        console.error('Error en suscripción a todos los acompañamientos:', error);
        if (onError) {
          onError(new Error('Error al cargar los acompañamientos'));
        }
      }
    );
  } catch (error) {
    console.error('Error al configurar suscripción:', error);
    if (onError) {
      onError(new Error('Error al configurar la consulta'));
    }
  }
};

/**
 * Obtener la configuración de la rúbrica
 */
export const getRubricaConfiguration = async () => {
  try {
    const docRef = doc(db, CONFIGURACION_COLLECTION, 'rubricaAcompanamiento');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data().rubrica;
    }
    return null;
  } catch (error) {
    console.error('Error al obtener configuración de rúbrica:', error);
    throw new Error('Error al cargar la configuración de la rúbrica');
  }
};

/**
 * Actualizar la configuración de la rúbrica
 */
export const updateRubricaConfiguration = async (rubrica: any): Promise<void> => {
  try {
    const docRef = doc(db, CONFIGURACION_COLLECTION, 'rubricaAcompanamiento');
    await updateDoc(docRef, {
      rubrica,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error al actualizar configuración de rúbrica:', error);
    throw new Error('Error al guardar la configuración de la rúbrica');
  }
};

/**
 * Obtener estadísticas de acompañamientos por docente
 */
export const getAcompanamientoStats = async (nombreDocente?: string) => {
  try {
    const constraints: QueryConstraint[] = [];
    
    if (nombreDocente) {
      constraints.push(where('docente', '==', nombreDocente));
    }

    const q = query(collection(db, ACOMPANAMIENTOS_COLLECTION), ...constraints);
    const querySnapshot = await getDocs(q);
    
    const acompanamientos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fecha: doc.data().fecha?.toDate?.() || doc.data().fecha
    })) as AcompanamientoDocente[];

    // Calcular estadísticas
    const total = acompanamientos.length;
    const thisMonth = acompanamientos.filter(a => {
      const fecha = new Date(a.fecha);
      const now = new Date();
      return fecha.getMonth() === now.getMonth() && fecha.getFullYear() === now.getFullYear();
    }).length;

    const thisYear = acompanamientos.filter(a => {
      const fecha = new Date(a.fecha);
      const now = new Date();
      return fecha.getFullYear() === now.getFullYear();
    }).length;

    return {
      total,
      thisMonth,
      thisYear,
      acompanamientos: acompanamientos.slice(0, 5) // Últimos 5 para preview
    };
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    throw new Error('Error al cargar las estadísticas');
  }
};

/**
 * Buscar acompañamientos por texto
 */
export const searchAcompanamientos = async (searchTerm: string, nombreDocente?: string): Promise<AcompanamientoDocente[]> => {
  try {
    const constraints: QueryConstraint[] = [];
    
    if (nombreDocente) {
      constraints.push(where('docente', '==', nombreDocente));
    }
    
    constraints.push(orderBy('fecha', 'desc'));

    const q = query(collection(db, ACOMPANAMIENTOS_COLLECTION), ...constraints);
    const querySnapshot = await getDocs(q);
    
    const allAcompanamientos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fecha: doc.data().fecha?.toDate?.() || doc.data().fecha
    })) as AcompanamientoDocente[];

    // Filtrar en el cliente (Firestore no soporta búsqueda de texto completo nativa)
    const searchTermLower = searchTerm.toLowerCase();
    return allAcompanamientos.filter(acomp => 
      acomp.docente?.toLowerCase().includes(searchTermLower) ||
      acomp.curso?.toLowerCase().includes(searchTermLower) ||
      acomp.asignatura?.toLowerCase().includes(searchTermLower) ||
      acomp.observacionesGenerales?.toLowerCase().includes(searchTermLower) ||
      acomp.retroalimentacionConsolidada?.toLowerCase().includes(searchTermLower)
    );
  } catch (error) {
    console.error('Error en búsqueda:', error);
    throw new Error('Error al realizar la búsqueda');
  }
};