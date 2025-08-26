import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  orderBy 
} from 'firebase/firestore';
import { db } from './config';
import { Pregunta, SetPreguntas, ResultadoIntento } from '../../types/simce';

// Colecciones
const SETS_COLLECTION = 'simce_sets';
const RESULTADOS_COLLECTION = 'simce_resultados';

// Funciones para Sets de Preguntas
export async function crearSetPreguntas(setData: Omit<SetPreguntas, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, SETS_COLLECTION), setData);
    return docRef.id;
  } catch (error) {
    console.error('Error al crear set de preguntas:', error);
    throw new Error('No se pudo crear el set de preguntas');
  }
}

export async function actualizarSetPreguntas(id: string, data: Partial<SetPreguntas>): Promise<void> {
  try {
    await updateDoc(doc(db, SETS_COLLECTION, id), data);
  } catch (error) {
    console.error('Error al actualizar set de preguntas:', error);
    throw new Error('No se pudo actualizar el set de preguntas');
  }
}

export async function obtenerSetPreguntas(id: string): Promise<SetPreguntas> {
  try {
    const docSnap = await getDoc(doc(db, SETS_COLLECTION, id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as SetPreguntas;
    } else {
      throw new Error('El set de preguntas no existe');
    }
  } catch (error) {
    console.error('Error al obtener set de preguntas:', error);
    throw new Error('No se pudo obtener el set de preguntas');
  }
}

export async function obtenerSetsPreguntasPorProfesor(profesorId: string): Promise<SetPreguntas[]> {
  try {
    const q = query(
      collection(db, SETS_COLLECTION),
      where('creadorId', '==', profesorId),
      orderBy('fechaCreacion', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SetPreguntas));
  } catch (error) {
    console.error('Error al obtener sets de preguntas:', error);
    throw new Error('No se pudieron obtener los sets de preguntas');
  }
}

export async function obtenerSetsPreguntasPorCurso(cursoId: string): Promise<SetPreguntas[]> {
  try {
    const q = query(
      collection(db, SETS_COLLECTION),
      where('cursosAsignados', 'array-contains', cursoId),
      orderBy('fechaCreacion', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SetPreguntas));
  } catch (error) {
    console.error('Error al obtener sets de preguntas por curso:', error);
    throw new Error('No se pudieron obtener los sets de preguntas');
  }
}

export async function eliminarSetPreguntas(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, SETS_COLLECTION, id));
  } catch (error) {
    console.error('Error al eliminar set de preguntas:', error);
    throw new Error('No se pudo eliminar el set de preguntas');
  }
}

// Funciones para Resultados de Intentos
export async function guardarResultadoIntento(resultado: Omit<ResultadoIntento, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, RESULTADOS_COLLECTION), resultado);
    return docRef.id;
  } catch (error) {
    console.error('Error al guardar resultado de intento:', error);
    throw new Error('No se pudo guardar el resultado');
  }
}

export async function obtenerResultadosPorSet(setId: string): Promise<ResultadoIntento[]> {
  try {
    const q = query(
      collection(db, RESULTADOS_COLLECTION),
      where('setId', '==', setId),
      orderBy('fechaEnvio', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResultadoIntento));
  } catch (error) {
    console.error('Error al obtener resultados por set:', error);
    throw new Error('No se pudieron obtener los resultados');
  }
}

export async function obtenerResultadosPorCurso(setId: string, estudiantesIds: string[]): Promise<ResultadoIntento[]> {
  try {
    const q = query(
      collection(db, RESULTADOS_COLLECTION),
      where('setId', '==', setId),
      where('estudianteId', 'in', estudiantesIds)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResultadoIntento));
  } catch (error) {
    console.error('Error al obtener resultados por curso:', error);
    throw new Error('No se pudieron obtener los resultados del curso');
  }
}

export async function obtenerResultadosPorEstudiante(estudianteId: string): Promise<ResultadoIntento[]> {
  try {
    const q = query(
      collection(db, RESULTADOS_COLLECTION),
      where('estudianteId', '==', estudianteId),
      orderBy('fechaEnvio', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResultadoIntento));
  } catch (error) {
    console.error('Error al obtener resultados por estudiante:', error);
    throw new Error('No se pudieron obtener los resultados del estudiante');
  }
}

export async function verificarIntentoExistente(estudianteId: string, setId: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, RESULTADOS_COLLECTION),
      where('estudianteId', '==', estudianteId),
      where('setId', '==', setId)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error al verificar intento existente:', error);
    throw new Error('No se pudo verificar si ya existe un intento');
  }
}

export async function eliminarResultado(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, RESULTADOS_COLLECTION, id));
  } catch (error) {
    console.error('Error al eliminar resultado:', error);
    throw new Error('No se pudo eliminar el resultado');
  }
}
