// Extensiones para el helper de SIMCE

import { collection, addDoc } from 'firebase/firestore';
import { db } from './config';

// Constante para la colección
const SIMCE_EVALUACIONES_COLLECTION = 'simce_evaluaciones';

/**
 * Crea una nueva evaluación SIMCE en la base de datos
 * @param evaluacionData Los datos de la evaluación a crear
 * @returns El ID de la evaluación creada
 */
export async function crearEvaluacionSimce(evaluacionData: any): Promise<string> {
  try {
    console.log('[DEBUG] crearEvaluacionSimce - Creando evaluación con datos:', evaluacionData);
    console.log('[DEBUG] crearEvaluacionSimce - Cursos asignados:', evaluacionData.cursosAsignados);
    
    // Asegurarnos de que tengamos el campo cursosAsignados para compatibilidad
    if (!evaluacionData.cursosAsignados && evaluacionData.cursoAsignado) {
      evaluacionData.cursosAsignados = Array.isArray(evaluacionData.cursoAsignado) 
        ? evaluacionData.cursoAsignado 
        : [evaluacionData.cursoAsignado];
    }
    
    const docRef = await addDoc(collection(db, SIMCE_EVALUACIONES_COLLECTION), evaluacionData);
    console.log('[DEBUG] crearEvaluacionSimce - Evaluación creada con ID:', docRef.id);
    
    return docRef.id;
  } catch (error) {
    console.error('Error al crear evaluación SIMCE:', error);
    throw new Error('No se pudo crear la evaluación SIMCE');
  }
}

/**
 * Actualiza una evaluación SIMCE existente
 * @param id ID de la evaluación
 * @param data Datos a actualizar
 */
export async function actualizarEvaluacionSimce(id: string, data: any): Promise<void> {
  try {
    // Implementación pendiente
    console.log('[DEBUG] actualizarEvaluacionSimce - Pendiente de implementar');
  } catch (error) {
    console.error('Error al actualizar evaluación SIMCE:', error);
    throw new Error('No se pudo actualizar la evaluación SIMCE');
  }
}

/**
 * Obtiene evaluaciones creadas por un profesor
 * @param profesorId ID del profesor
 * @returns Lista de evaluaciones
 */
export async function obtenerEvaluacionesProfesor(profesorId: string): Promise<any[]> {
  try {
    console.log('[DEBUG] obtenerEvaluacionesProfesor - Pendiente de implementar');
    return [];
  } catch (error) {
    console.error('Error al obtener evaluaciones del profesor:', error);
    return [];
  }
}
