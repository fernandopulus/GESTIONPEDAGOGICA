import { getFunctions, httpsCallable } from "firebase/functions";
import { GeneracionSimceOptions, Pregunta } from "../../types/simce";

/**
 * Cliente para llamar a la función Cloud de generación de preguntas SIMCE
 */
export async function generarPreguntasSimceCloud(
  options: GeneracionSimceOptions
): Promise<Pregunta[]> {
  try {
    // Inicializar Firebase Functions
    const functions = getFunctions();
    
    // Llamar a la función Cloud
    const generarPreguntasSimceFunc = httpsCallable<
      { options: GeneracionSimceOptions },
      { preguntas: Pregunta[], textoBase?: string, metadata: any }
    >(functions, 'generarPreguntasSimce');
    
    console.log('Llamando a Cloud Function para generar preguntas SIMCE...');
    
    const result = await generarPreguntasSimceFunc({
      options
    });
    
    // Extraer las preguntas y el texto base del resultado
    const { preguntas, textoBase } = result.data;
    
    if (!preguntas || !Array.isArray(preguntas) || preguntas.length === 0) {
      throw new Error('La respuesta no contiene preguntas válidas');
    }
    
    console.log(`Se generaron ${preguntas.length} preguntas correctamente mediante Cloud Function`);
    
    // Si hay un texto base, añadirlo a la primera pregunta
    if (textoBase && preguntas.length > 0) {
      preguntas[0].textoBase = textoBase;
    }
    
    return preguntas;
  } catch (error) {
    console.error('Error al generar preguntas SIMCE mediante Cloud Function:', error);
    throw error;
  }
}
