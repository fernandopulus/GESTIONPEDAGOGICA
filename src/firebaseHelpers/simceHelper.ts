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
import { getAllUsers } from './users';
import { Pregunta, SetPreguntas, ResultadoIntento, AsignaturaSimce } from '../../types/simce';

// Utilidad local: normalizar fecha (Timestamp de Firestore o string) a ISO string
const normalizeFecha = (value: any): string => {
  try {
    if (!value) return new Date().toISOString();
    // Firestore Timestamp tiene método toDate()
    if (typeof value?.toDate === 'function') {
      return value.toDate().toISOString();
    }
    // Si ya es Date
    if (value instanceof Date) {
      return value.toISOString();
    }
    // Si es number (ms) o string parseable
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  // Fallback a ahora
  return new Date().toISOString();
};

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
  console.log(`[DEBUG] obtenerSetPreguntas - Buscando set con ID: ${id}`);

  // 1) Intentar primero en 'simce_evaluaciones' (flujo más común para estudiantes)
  try {
    const evalSnap = await getDoc(doc(db, 'simce_evaluaciones', id));
    if (evalSnap.exists()) {
      const data = evalSnap.data();
      console.log(`[DEBUG] obtenerSetPreguntas - Encontrado en simce_evaluaciones: ${data.titulo || 'Sin título'}`);
      console.log(`[DEBUG] obtenerSetPreguntas - Preguntas: ${data.preguntas?.length || 0}`);
      if (data.preguntas && data.preguntas.length > 0) {
        for (let i = 0; i < data.preguntas.length; i++) {
          const pregunta = data.preguntas[i];
          if (pregunta.textoBase) {
            console.log(`[DEBUG] obtenerSetPreguntas - Texto base (eval) en pregunta ${i + 1}`);
            break;
          }
        }
      }
      return { id: evalSnap.id, ...data } as SetPreguntas;
    }
  } catch (e) {
    console.warn('[DEBUG] obtenerSetPreguntas - Error al leer simce_evaluaciones, intentando simce_sets:', e);
  }

  // 2) Intentar luego en 'simce_sets'
  try {
    const setSnap = await getDoc(doc(db, SETS_COLLECTION, id));
    if (setSnap.exists()) {
      const data = setSnap.data();
      console.log(`[DEBUG] obtenerSetPreguntas - Encontrado en ${SETS_COLLECTION}: ${data.titulo || 'Sin título'}`);
      console.log(`[DEBUG] obtenerSetPreguntas - Preguntas: ${data.preguntas?.length || 0}`);
      if (data.preguntas && data.preguntas.length > 0) {
        for (let i = 0; i < data.preguntas.length; i++) {
          const pregunta = data.preguntas[i];
          if (pregunta.textoBase) {
            console.log(`[DEBUG] obtenerSetPreguntas - Texto base (set) en pregunta ${i + 1}`);
            break;
          }
        }
      }
      return { id: setSnap.id, ...data } as SetPreguntas;
    }
  } catch (e) {
    console.warn('[DEBUG] obtenerSetPreguntas - Error al leer simce_sets:', e);
  }

  console.log(`[DEBUG] obtenerSetPreguntas - No se encontró set con ID: ${id} en ninguna colección o sin permisos`);
  throw new Error('No se pudo obtener el set de preguntas');
}

export async function obtenerSetsPreguntasPorProfesor(profesorId: string): Promise<SetPreguntas[]> {
  try {
    // Buscar en la colección principal de sets
    const qSets = query(
      collection(db, SETS_COLLECTION),
      where('creadorId', '==', profesorId),
      orderBy('fechaCreacion', 'desc')
    );
    const querySnapshot = await getDocs(qSets);
    const setsA = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as SetPreguntas));

    // Buscar también en la colección de evaluaciones (compatibilidad)
    const qEvals = query(
      collection(db, 'simce_evaluaciones'),
      where('creadorId', '==', profesorId),
      orderBy('fechaCreacion', 'desc')
    );
    const evalsSnapshot = await getDocs(qEvals);
    const setsB = evalsSnapshot.docs.map(d => ({ id: d.id, ...d.data(), preguntas: (d.data() as any).preguntas || [] } as SetPreguntas));

    return [...setsA, ...setsB];
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
    let sets = [
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

    // Fallback: si no hay resultados (o por seguridad), traer todo y filtrar en cliente
    if (!sets.length) {
      console.warn('[DEBUG] obtenerSetsPreguntasPorCurso - Sin resultados por query; aplicando fallback (getDocs + filtro cliente)');
      const [allA, allB] = await Promise.all([
        getDocs(collection(db, SETS_COLLECTION)),
        getDocs(collection(db, 'simce_evaluaciones'))
      ]);
      const cursoNorm = cursoId;
      sets = [
        ...allA.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(s => Array.isArray(s.cursosAsignados) && s.cursosAsignados.includes(cursoNorm)) as SetPreguntas[],
        ...allB.docs
          .map(d => ({ id: d.id, ...d.data(), preguntas: ((d.data() as any).preguntas || []) } as any))
          .filter(s => Array.isArray(s.cursosAsignados) && s.cursosAsignados.includes(cursoNorm)) as SetPreguntas[]
      ];
      console.log(`[DEBUG] obtenerSetsPreguntasPorCurso - Fallback aplicó ${sets.length} sets`);
    }
    return sets;
  } catch (error) {
    console.error('Error al obtener sets de preguntas por curso:', error);
    throw new Error('No se pudieron obtener los sets de preguntas');
  }
}

// Nuevo: obtener sets asignados a un estudiante explícitamente (si el set guarda estudiantesAsignados)
export async function obtenerSetsPreguntasPorEstudiante(estudianteId: string): Promise<SetPreguntas[]> {
  try {
    if (!estudianteId) return [];
    // Buscar en colección principal
    const qA = query(
      collection(db, SETS_COLLECTION),
      where('estudiantesAsignados', 'array-contains', estudianteId),
      orderBy('fechaCreacion', 'desc')
    );
    const snapA = await getDocs(qA);
    // Buscar en colección de compatibilidad
    const qB = query(
      collection(db, 'simce_evaluaciones'),
      where('estudiantesAsignados', 'array-contains', estudianteId),
      orderBy('fechaCreacion', 'desc')
    );
    const snapB = await getDocs(qB);

    return [
      ...snapA.docs.map(d => ({ id: d.id, ...d.data() } as SetPreguntas)),
      ...snapB.docs.map(d => ({ id: d.id, ...d.data(), preguntas: (d.data() as any).preguntas || [] } as SetPreguntas))
    ];
  } catch (error) {
    console.error('Error al obtener sets por estudiante:', error);
    return [];
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
    if (!estudiantesIds || estudiantesIds.length === 0) return [];

    // Firestore limita el operador 'in' a un número máximo de elementos.
    // Usamos lotes pequeños (10) para máxima compatibilidad.
    const MAX_IN = 10;
    const chunks: string[][] = [];
    for (let i = 0; i < estudiantesIds.length; i += MAX_IN) {
      chunks.push(estudiantesIds.slice(i, i + MAX_IN));
    }

    const resultados: ResultadoIntento[] = [];
    for (const ids of chunks) {
      const q = query(
        collection(db, RESULTADOS_COLLECTION),
        where('setId', '==', setId),
        where('estudianteId', 'in', ids)
      );
      const snapshot = await getDocs(q);
      resultados.push(
        ...snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ResultadoIntento))
      );
    }

    // Eliminar duplicados por id por seguridad
    const dedup = new Map<string, ResultadoIntento>();
    for (const r of resultados) dedup.set(r.id as string, r);
    return Array.from(dedup.values());
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
    // Normalizar cursoId a formato consistente (p.e. 1ºA)
    const normalizeCurso = (curso: string): string => {
      if (!curso) return '';
      let normalized = curso.trim().toLowerCase();
      normalized = normalized.replace(/°/g, 'º');
      normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
      normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
      normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
      normalized = normalized.replace(/\s+/g, '').toUpperCase();
      return normalized;
    };
    const cursoNorm = normalizeCurso(cursoId);
    
    // Reutilizamos obtenerSetsPreguntasPorCurso y combinamos con sets por estudiante
    const [setsPorCurso, setsPorEstudiante] = await Promise.all([
      obtenerSetsPreguntasPorCurso(cursoNorm),
      obtenerSetsPreguntasPorEstudiante(estudianteId)
    ]);
    // Deduplicar por id
    const map = new Map<string, SetPreguntas>();
    [...setsPorCurso, ...setsPorEstudiante].forEach(s => map.set(s.id, s));
    const sets = Array.from(map.values());
    console.log(`[DEBUG] obtenerEvaluacionesEstudiante - Encontradas ${sets.length} evaluaciones asignadas al curso ${cursoId}`);
    
    // Mapear a una estructura de evaluación esperada por la UI y asegurar que el texto base esté presente
  const evaluacionesMapeadas = sets.map(set => {
      // Crear la estructura base
      const evaluacion = {
        id: set.id,
        titulo: set.titulo,
        descripcion: set.descripcion || '',
        // Normalizar etiqueta de asignatura para la UI del estudiante
        // Normalizar etiqueta de asignatura a los valores esperados por la UI
        asignatura: ((): AsignaturaSimce => {
          const a = String((set as any).asignatura || '').toLowerCase();
          if (a.includes('lect')) return 'Competencia Lectora';
          if (a.includes('lóg') || a.includes('log') || a.includes('mat')) return 'Pensamiento Lógico';
          return (set as any).asignatura as AsignaturaSimce;
        })(),
        preguntas: [...set.preguntas], // Copia las preguntas para no modificar el original
        fechaAsignacion: (set as any).fechaCreacion || new Date().toISOString(),
        textoBase: '' // Campo adicional para almacenar el texto base a nivel de evaluación
      };
      
  // Si es una evaluación de Competencia Lectora, buscar y asegurar que el texto base esté disponible
  const asignaturaStr = String((evaluacion.asignatura || '')).toLowerCase();
  if (asignaturaStr.includes('lect')) {
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
      porcentajeAciertos: resultado.porcentajeAciertos ?? resultado.porcentajeLogro ?? 0,
      porcentajeLogro: resultado.porcentajeLogro ?? resultado.porcentajeAciertos ?? 0,
      nivelLogro: resultado.nivelLogro || 'Insuficiente',
      fechaEnvio: resultado.fechaRealizacion || new Date().toISOString(),
      tiempoRealizacion: resultado.tiempoRealizacion ?? resultado.duracionSegundos ?? null,
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
    let sets: SetPreguntas[] = [];
    try {
      sets = await obtenerSetsPreguntasPorProfesor(profesorId);
    } catch (e) {
      console.warn('[DEBUG] obtenerEvaluacionesPorProfesor - Falla query directa, intento fallback:', e);
    }
    // Fallback: si está vacío, traer todo y filtrar en cliente
    if (!sets.length) {
      console.warn('[DEBUG] obtenerEvaluacionesPorProfesor - Sin resultados, aplicando fallback (getDocs + filtro por creadorId)');
      const [allA, allB] = await Promise.all([
        getDocs(collection(db, SETS_COLLECTION)),
        getDocs(collection(db, 'simce_evaluaciones'))
      ]);
      sets = [
        ...allA.docs.map(d => ({ id: d.id, ...d.data() } as SetPreguntas)),
        ...allB.docs.map(d => ({ id: d.id, ...d.data(), preguntas: (d.data() as any).preguntas || [] } as SetPreguntas))
      ].filter(s => (s as any).creadorId === profesorId);
      console.log(`[DEBUG] obtenerEvaluacionesPorProfesor - Fallback encontró ${sets.length} sets`);
    }
    return sets.map(set => ({
      id: set.id,
      titulo: set.titulo,
      descripcion: set.descripcion || '',
      asignatura: set.asignatura,
      preguntas: Array.isArray((set as any).preguntas) ? (set as any).preguntas : [],
      // Normalizar fecha por compatibilidad (puede venir como Timestamp)
      fechaCreacion: normalizeFecha((set as any).fechaCreacion),
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
    // Normalizar cursoId
    const normalizeCurso = (curso: string): string => {
      if (!curso) return '';
      let normalized = curso.trim().toLowerCase();
      normalized = normalized.replace(/°/g, 'º');
      normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
      normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
      normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
      normalized = normalized.replace(/\s+/g, '').toUpperCase();
      return normalized;
    };
    const cursoNorm = normalizeCurso(cursoId);

    // Obtener estudiantes del curso
    const usuarios = await getAllUsers();
    const estudiantesIds = usuarios
      .filter((u: any) => u.profile === 'ESTUDIANTE' && normalizeCurso(u.curso || '') === cursoNorm)
      .map((u: any) => u.id);

    if (estudiantesIds.length === 0) {
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

    // Obtener resultados filtrados por set y estudiantes del curso
    const resultados = await obtenerResultadosPorCurso(evaluacionId, estudiantesIds);
    const totalEstudiantes = resultados.length;
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

    const porcentajeList = resultados.map((r: any) => r.porcentajeAciertos || r.porcentajeLogro || 0);
    const promedioLogro = porcentajeList.reduce((a: number, b: number) => a + b, 0) / totalEstudiantes;

    let cntAdecuado = 0; let cntElemental = 0; let cntInsuficiente = 0;
    porcentajeList.forEach((p: number) => {
      if (p >= 80) cntAdecuado++;
      else if (p >= 50) cntElemental++;
      else cntInsuficiente++;
    });

    const porcentajeAdecuado = (cntAdecuado / totalEstudiantes) * 100;
    const porcentajeElemental = (cntElemental / totalEstudiantes) * 100;
    const porcentajeInsuficiente = (cntInsuficiente / totalEstudiantes) * 100;

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

