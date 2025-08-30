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
    console.log(`[DEBUG] obtenerSetPreguntas - Buscando set con ID: ${id}`);
    
    // Intentar primero en la colección principal de sets
    let docSnap = await getDoc(doc(db, SETS_COLLECTION, id));
    
    // Si no está en la colección principal, intentar en la colección de evaluaciones
    if (!docSnap.exists()) {
      console.log(`[DEBUG] obtenerSetPreguntas - No encontrado en ${SETS_COLLECTION}, buscando en simce_evaluaciones`);
      docSnap = await getDoc(doc(db, 'simce_evaluaciones', id));
    }
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log(`[DEBUG] obtenerSetPreguntas - Set encontrado: ${data.titulo || 'Sin título'}`);
      console.log(`[DEBUG] obtenerSetPreguntas - Cantidad de preguntas: ${data.preguntas?.length || 0}`);
      
      // Verificar y registrar detalles del set
      if (data.preguntas && data.preguntas.length > 0) {
        // Verificar si alguna pregunta tiene textoBase
        for (let i = 0; i < data.preguntas.length; i++) {
          const pregunta = data.preguntas[i];
          if (pregunta.textoBase) {
            console.log(`[DEBUG] obtenerSetPreguntas - Texto base encontrado en pregunta ${i + 1}`);
            console.log(`[DEBUG] obtenerSetPreguntas - Extracto del texto base: ${pregunta.textoBase.substring(0, 50)}...`);
            break;
          }
        }
      }
      
      return { id: docSnap.id, ...data } as SetPreguntas;
    } else {
      console.log(`[DEBUG] obtenerSetPreguntas - No se encontró set con ID: ${id} en ninguna colección`);
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
    console.log(`[DEBUG] obtenerSetsPreguntasPorCurso - Buscando sets para curso ${cursoId}`);
    
    if (!cursoId) {
      console.error("[DEBUG] obtenerSetsPreguntasPorCurso - Error: cursoId es undefined o vacío");
      return [];
    }
    
    // Primero intentamos en la colección principal de sets
    const q = query(
      collection(db, SETS_COLLECTION),
      where('cursosAsignados', 'array-contains', cursoId),
      orderBy('fechaCreacion', 'desc')
    );
    
    console.log(`[DEBUG] obtenerSetsPreguntasPorCurso - Query ejecutando en ${SETS_COLLECTION}:`, q);
    
    const querySnapshot = await getDocs(q);
    console.log(`[DEBUG] obtenerSetsPreguntasPorCurso - Resultados encontrados en ${SETS_COLLECTION}: ${querySnapshot.docs.length}`);
    
    // Después intentamos en la colección de evaluaciones (donde se guardan las nuevas)
    const qEvals = query(
      collection(db, 'simce_evaluaciones'),
      where('cursosAsignados', 'array-contains', cursoId),
      orderBy('fechaCreacion', 'desc')
    );
    
    console.log(`[DEBUG] obtenerSetsPreguntasPorCurso - Query ejecutando en simce_evaluaciones:`, qEvals);
    
    const evalsSnapshot = await getDocs(qEvals);
    console.log(`[DEBUG] obtenerSetsPreguntasPorCurso - Resultados encontrados en simce_evaluaciones: ${evalsSnapshot.docs.length}`);
    
    // Combinamos los resultados de ambas colecciones
    const sets = [
      ...querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`[DEBUG] obtenerSetsPreguntasPorCurso - Set encontrado en ${SETS_COLLECTION}: ${doc.id}, cursosAsignados:`, data.cursosAsignados);
        return { id: doc.id, ...data } as SetPreguntas;
      }),
      ...evalsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`[DEBUG] obtenerSetsPreguntasPorCurso - Set encontrado en simce_evaluaciones: ${doc.id}, cursosAsignados:`, data.cursosAsignados);
        return { 
          id: doc.id, 
          ...data,
          preguntas: data.preguntas || []
        } as SetPreguntas;
      })
    ];
    
    console.log(`[DEBUG] obtenerSetsPreguntasPorCurso - Total sets combinados: ${sets.length}`);
    return sets;
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


export async function eliminarResultado(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, RESULTADOS_COLLECTION, id));
  } catch (error) {
    console.error('Error al eliminar resultado:', error);
    throw new Error('No se pudo eliminar el resultado');
  }
}

// Wrappers/aliases para compatibilidad con componentes SIMCE existentes
// Algunos componentes importan funciones con nombres diferentes; aquí añadimos
// adaptadores mínimos que reutilizan las funciones ya implementadas arriba.

/**
 * Obtener evaluaciones asignadas a un estudiante.
 * Implementación simple: busca sets de preguntas asignados al curso del estudiante.
 */
export async function obtenerEvaluacionesEstudiante(estudianteId: string, cursoId: string): Promise<any[]> {
  try {
    console.log(`[DEBUG] obtenerEvaluacionesEstudiante - Buscando evaluaciones para estudiante ${estudianteId} en curso ${cursoId}`);
    
    // Reutilizamos obtenerSetsPreguntasPorCurso para listar sets asignados al curso
    const sets = await obtenerSetsPreguntasPorCurso(cursoId);
    console.log(`[DEBUG] obtenerEvaluacionesEstudiante - Encontradas ${sets.length} evaluaciones asignadas al curso ${cursoId}`);
    
    // Mapear a una estructura de evaluación esperada por la UI y asegurar que el texto base esté presente
    const evaluacionesMapeadas = sets.map(set => {
      // Crear la estructura base
      const evaluacion = {
        id: set.id,
        titulo: set.titulo,
        descripcion: set.descripcion || '',
        asignatura: set.asignatura,
        preguntas: [...set.preguntas], // Copia las preguntas para no modificar el original
        fechaAsignacion: set.fechaCreacion || new Date().toISOString(),
        textoBase: '' // Campo adicional para almacenar el texto base a nivel de evaluación
      };
      
  // Si es una evaluación de Competencia Lectora, buscar y asegurar que el texto base esté disponible
  if (set.asignatura === 'Competencia Lectora') {
        // Buscar texto base en cualquiera de las preguntas
        let textoBase = '';
        for (const pregunta of set.preguntas) {
          if (pregunta.textoBase && pregunta.textoBase.trim()) {
            textoBase = pregunta.textoBase.trim();
            console.log(`[DEBUG] Texto base encontrado en pregunta ${pregunta.id}:`, textoBase.substring(0, 50) + '...');
            break;
          }
        }
        
        // Si se encontró texto base, asegurarse de que esté en la primera pregunta
        if (textoBase && evaluacion.preguntas.length > 0) {
          console.log(`[DEBUG] Asignando texto base a la evaluación y primera pregunta: ${set.id}`);
          evaluacion.textoBase = textoBase;
          evaluacion.preguntas[0].textoBase = textoBase;
        }
      }
      
      return evaluacion;
    });
    
    console.log(`[DEBUG] obtenerEvaluacionesEstudiante - Evaluaciones mapeadas: ${evaluacionesMapeadas.length}`);
    return evaluacionesMapeadas;
  } catch (error) {
    console.error('Error en obtenerEvaluacionesEstudiante:', error);
    return [];
  }
}

/**
 * Obtener una evaluación (set) por su id.
 */
export async function obtenerEvaluacionPorId(id: string): Promise<any | null> {
  try {
    console.log(`[DEBUG] obtenerEvaluacionPorId - Buscando evaluación con ID: ${id}`);
    const set = await obtenerSetPreguntas(id);
    
    if (set) {
      console.log(`[DEBUG] obtenerEvaluacionPorId - Evaluación encontrada: ${set.titulo}`);
      console.log(`[DEBUG] obtenerEvaluacionPorId - Asignatura: ${set.asignatura}`);
      console.log(`[DEBUG] obtenerEvaluacionPorId - Cantidad de preguntas: ${set.preguntas?.length || 0}`);
      
      // Verificar si alguna pregunta tiene textoBase
      const tieneTextoBase = set.preguntas.some(p => p.textoBase);
      console.log(`[DEBUG] obtenerEvaluacionPorId - ¿Tiene texto base?: ${tieneTextoBase}`);
      
      if (tieneTextoBase) {
        const preguntaConTexto = set.preguntas.find(p => p.textoBase);
        console.log(`[DEBUG] obtenerEvaluacionPorId - Texto base encontrado en pregunta: ${preguntaConTexto?.id}`);
        console.log(`[DEBUG] obtenerEvaluacionPorId - Texto base (primeros 50 caracteres): ${preguntaConTexto?.textoBase?.substring(0, 50)}...`);
      }
    } else {
      console.log(`[DEBUG] obtenerEvaluacionPorId - No se encontró evaluación con ID: ${id}`);
    }
    
    return set || null;
  } catch (error) {
    console.error('Error en obtenerEvaluacionPorId:', error);
    return null;
  }
}

/**
 * Guardar un intento/resultado de evaluación.
 * Alias a guardarResultadoIntento adaptando nombres de campos si es necesario.
 */
export async function guardarIntentoEvaluacion(resultado: any): Promise<string> {
  try {
    // Adaptar campos si vienen con nombres distintos
    const payload = {
      ...resultado,
      setId: resultado.evaluacionId || resultado.setId || null,
      respuestas: resultado.respuestas || [],
      porcentajeAciertos: resultado.porcentajeLogro || resultado.porcentajeAciertos || 0,
      nivelLogro: resultado.nivelLogro || 'Insuficiente',
      fechaEnvio: resultado.fechaRealizacion || new Date().toISOString(),
    };

    return await guardarResultadoIntento(payload as any);
  } catch (error) {
    console.error('Error en guardarIntentoEvaluacion:', error);
    throw error;
  }
}

/**
 * Verificar si existe un intento del estudiante para un set/evaluación.
 * Devuelve un array con los intentos (vacío si no hay).
 */
export async function verificarIntentoExistente(estudianteId: string, setId: string): Promise<any[]> {
  try {
    const resultados = await obtenerResultadosPorEstudiante(estudianteId);
    const encontrados = resultados.filter(r => r.setId === setId);
    return encontrados;
  } catch (error) {
    console.error('Error en verificarIntentoExistente:', error);
    return [];
  }
}

// Compatibilidad: obtener evaluaciones creadas por un profesor
export async function obtenerEvaluacionesPorProfesor(profesorId: string): Promise<any[]> {
  try {
    const sets = await obtenerSetsPreguntasPorProfesor(profesorId);
    return sets.map(set => ({
      id: set.id,
      titulo: set.titulo,
      descripcion: set.descripcion || '',
      asignatura: set.asignatura,
      preguntas: set.preguntas,
      fechaCreacion: set.fechaCreacion || new Date().toISOString(),
      cursosAsignados: set.cursosAsignados || []
    }));
  } catch (error) {
    console.error('Error en obtenerEvaluacionesPorProfesor:', error);
    return [];
  }
}

// Compatibilidad: obtener intentos/resultados por evaluación (set)
export async function obtenerIntentosPorEvaluacion(evaluacionId: string): Promise<ResultadoIntento[]> {
  try {
    return await obtenerResultadosPorSet(evaluacionId);
  } catch (error) {
    console.error('Error en obtenerIntentosPorEvaluacion:', error);
    return [];
  }
}

// Compatibilidad: calcular estadísticas por curso a partir de los resultados
export async function obtenerEstadisticasPorCurso(evaluacionId: string, cursoId: string): Promise<any> {
  try {
    const resultados = await obtenerResultadosPorSet(evaluacionId);
    const resultadosCurso = resultados.filter(r => (r as any).estudianteId && (r as any).curso === cursoId);

    const totalEstudiantes = resultadosCurso.length;
    if (totalEstudiantes === 0) {
      return {
        totalEstudiantes: 0,
        promedioLogro: 0,
        nivelPredominante: 'Insuficiente',
        porcentajeAdecuado: 0,
        porcentajeElemental: 0,
        porcentajeInsuficiente: 0,
        porEjeTematico: [],
        porPregunta: []
      };
    }

    const promedioLogro = resultadosCurso.reduce((acc, r) => acc + ((r as any).porcentajeAciertos || (r as any).porcentajeLogro || 0), 0) / totalEstudiantes;

    // Niveles
    let cntAdecuado = 0; let cntElemental = 0; let cntInsuficiente = 0;
    resultadosCurso.forEach(r => {
      const porcentaje = (r as any).porcentajeAciertos || (r as any).porcentajeLogro || 0;
      if (porcentaje >= 80) cntAdecuado++;
      else if (porcentaje >= 50) cntElemental++;
      else cntInsuficiente++;
    });

    const porcentajeAdecuado = (cntAdecuado / totalEstudiantes) * 100;
    const porcentajeElemental = (cntElemental / totalEstudiantes) * 100;
    const porcentajeInsuficiente = (cntInsuficiente / totalEstudiantes) * 100;

    // Simplificado: no calculamos por eje temático ni por pregunta detallado aquí
    return {
      totalEstudiantes,
      promedioLogro,
      nivelPredominante: porcentajeAdecuado >= Math.max(porcentajeElemental, porcentajeInsuficiente) ? 'Adecuado' : (porcentajeElemental >= porcentajeInsuficiente ? 'Elemental' : 'Insuficiente'),
      porcentajeAdecuado,
      porcentajeElemental,
      porcentajeInsuficiente,
      porEjeTematico: [],
      porPregunta: []
    };
  } catch (error) {
    console.error('Error en obtenerEstadisticasPorCurso:', error);
    return null;
  }
}

// Exportar explícitamente todas las funciones para compatibilidad con el bundler

