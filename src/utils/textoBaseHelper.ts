/**
 * Utilidades para manejar el texto base en evaluaciones SIMCE
 */

import { Pregunta, SetPreguntas, AsignaturaSimce } from '../../types/simce';

/**
 * Busca el texto base en cualquier pregunta del conjunto
 * @param preguntas Lista de preguntas a revisar
 * @returns El texto base encontrado o null si no existe
 */
export function encontrarTextoBase(preguntas: Pregunta[]): string | null {
  // Buscar en todas las preguntas por si el texto base está en cualquiera
  for (const pregunta of preguntas) {
    if (pregunta.textoBase && pregunta.textoBase.trim()) {
      return pregunta.textoBase.trim();
    }
  }
  return null;
}

/**
 * Asegura que todas las preguntas tengan acceso al texto base
 * Solo la primera pregunta tendrá el texto base, las demás tendrán un marcador
 * @param set El conjunto de preguntas a procesar
 * @returns El conjunto de preguntas con el texto base propagado
 */
export function asegurarTextoBaseEnSet(set: SetPreguntas): SetPreguntas {
  // Solo aplicar a evaluaciones de Lectura
  if (set.asignatura !== 'Lectura') return set;
  
  // Buscar texto base existente
  const textoBase = encontrarTextoBase(set.preguntas);
  if (!textoBase) return set;
  
  // Clonar el set para no modificar el original
  const setConTextoBase = {
    ...set,
    preguntas: set.preguntas.map((pregunta, index) => {
      // Solo la primera pregunta debe tener el textoBase completo
      if (index === 0) {
        return { ...pregunta, textoBase };
      }
      // Las demás preguntas tienen un marcador para indicar que usan el mismo texto
      return { 
        ...pregunta,
        // No incluimos textoBase en las otras preguntas para ahorrar espacio
      };
    })
  };
  
  // También añadir el textoBase como propiedad de nivel superior para fácil acceso
  (setConTextoBase as any).textoBase = textoBase;
  
  return setConTextoBase;
}

/**
 * Asegura que una evaluación tenga texto base si es de Lectura
 * Si no tiene, intentará usar la descripción como texto base
 * @param evaluacion La evaluación a procesar
 * @returns La evaluación con texto base asegurado
 */
export function asegurarTextoBaseEnEvaluacion(evaluacion: any): any {
  if (evaluacion.asignatura !== 'Lectura') return evaluacion;
  
  // Clonar para no modificar el original
  const evaluacionCopia = { ...evaluacion };
  
  // Buscar texto base existente
  let textoBase = encontrarTextoBase(evaluacionCopia.preguntas || []);
  
  // Si no hay texto base pero hay descripción, usarla como texto base
  if (!textoBase && evaluacionCopia.descripcion && evaluacionCopia.descripcion.length > 100) {
    textoBase = evaluacionCopia.descripcion;
    
    // Añadir el textoBase a la primera pregunta si hay preguntas
    if (evaluacionCopia.preguntas && evaluacionCopia.preguntas.length > 0) {
      evaluacionCopia.preguntas[0] = {
        ...evaluacionCopia.preguntas[0],
        textoBase
      };
    }
  }
  
  // Añadir el textoBase como propiedad de nivel superior para fácil acceso
  if (textoBase) {
    evaluacionCopia.textoBase = textoBase;
  }
  
  return evaluacionCopia;
}
