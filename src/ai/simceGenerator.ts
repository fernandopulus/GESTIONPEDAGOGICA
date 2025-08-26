import { Pregunta, AsignaturaSimce } from '../../types/simce';
import { generarConIA } from './geminiHelper';

/**
 * Genera preguntas tipo SIMCE usando el modelo de IA
 * @param asignatura La asignatura para la cual generar preguntas (Lectura o Matemática)
 * @param cantidad Número de preguntas a generar (1-10)
 * @returns Array de preguntas generadas
 */
export async function generarPreguntasSimce(
  asignatura: AsignaturaSimce,
  cantidad: number = 5
): Promise<Pregunta[]> {
  try {
    // Validar cantidad
    if (cantidad < 1) cantidad = 1;
    if (cantidad > 10) cantidad = 10; // Limitamos a 10 por llamada para evitar tokens excesivos

    // Construir el prompt para el modelo
    const prompt = construirPromptGeneracion(asignatura, cantidad);
    
    // Llamar al modelo de IA
    const respuesta = await generarConIA(prompt);
    
    // Procesar la respuesta para extraer las preguntas
    const preguntas = procesarRespuestaIA(respuesta, asignatura);
    
    return preguntas;
  } catch (error) {
    console.error('Error al generar preguntas SIMCE:', error);
    throw new Error('No se pudieron generar las preguntas SIMCE');
  }
}

function construirPromptGeneracion(asignatura: AsignaturaSimce, cantidad: number): string {
  const estandares = asignatura === 'Lectura' 
    ? `- Localizar información explícita
- Realizar inferencias a partir del texto
- Interpretar y relacionar información del texto
- Reflexionar sobre el texto y evaluarlo
- Analizar aspectos formales del texto
- Reconocer tipos de texto según su propósito comunicativo
- Comprender vocabulario en contexto`
    : `- Números y operaciones
- Álgebra y funciones
- Geometría
- Probabilidad y estadística
- Resolución de problemas
- Modelamiento matemático
- Argumentación y comunicación matemática`;
  
  let prompt = `Genera ${cantidad} preguntas tipo SIMCE de ${asignatura} para estudiantes de educación básica (primaria) en Chile. 

La evaluación SIMCE (Sistema de Medición de la Calidad de la Educación) es una prueba estandarizada que mide los conocimientos y habilidades de los estudiantes según el currículum nacional chileno.

Para ${asignatura}, los estándares de aprendizaje evaluados incluyen:
${estandares}

Cada pregunta debe tener:
1. Un enunciado claro
2. Cuatro alternativas (identificadas como A, B, C y D)
3. Una única respuesta correcta
4. Indicación de qué estándar de aprendizaje evalúa
5. Una explicación de por qué la alternativa correcta es la respuesta

IMPORTANTE: Necesito que el formato de respuesta sea un JSON válido con este formato exacto:
\`\`\`json
[
  {
    "id": "p1",
    "enunciado": "Texto de la pregunta...",
    "alternativas": [
      {"id": "A", "texto": "Primera alternativa", "esCorrecta": true, "explicacion": "Explicación de por qué es correcta..."},
      {"id": "B", "texto": "Segunda alternativa", "esCorrecta": false},
      {"id": "C", "texto": "Tercera alternativa", "esCorrecta": false},
      {"id": "D", "texto": "Cuarta alternativa", "esCorrecta": false}
    ],
    "estandarAprendizaje": "Uno de los estándares listados arriba",
    "habilidad": "Habilidad específica evaluada (opcional)"
  }
  // Más preguntas aquí...
]
\`\`\`

Asegúrate de que:
- Las preguntas sean adecuadas para el nivel educativo (básica/primaria).
- Las alternativas incorrectas sean plausibles pero claramente incorrectas.
- Solo una alternativa sea marcada como correcta.
- La explicación esté solo en la alternativa correcta.
- El estándar de aprendizaje corresponda exactamente a uno de los listados.
- El JSON sea válido y siga estrictamente el formato solicitado.`;

  if (asignatura === 'Lectura') {
    prompt += `\n\nPara las preguntas de Lectura, primero genera un texto breve adecuado para el nivel (puede ser narrativo, informativo, etc.) y luego formula las preguntas basadas en ese texto.`;
  }

  return prompt;
}

function procesarRespuestaIA(respuesta: string, asignatura: AsignaturaSimce): Pregunta[] {
  try {
    // Extraer el JSON de la respuesta (puede estar dentro de bloques de código markdown)
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)```|(\[[\s\S]*\])/;
    const match = respuesta.match(jsonRegex);
    
    if (!match) {
      throw new Error('No se encontró un JSON válido en la respuesta');
    }
    
    const jsonString = (match[1] || match[2]).trim();
    const preguntas = JSON.parse(jsonString) as Pregunta[];
    
    // Validar y limpiar las preguntas
    return preguntas.map((pregunta, index) => {
      // Asegurar que los IDs sean únicos
      const id = `p${Date.now()}_${index}`;
      
      // Asegurar que haya exactamente una alternativa correcta
      const tieneCorrecta = pregunta.alternativas.some(alt => alt.esCorrecta);
      if (!tieneCorrecta) {
        pregunta.alternativas[0].esCorrecta = true;
      }
      
      // Asegurar que todas las alternativas tengan IDs correctos
      pregunta.alternativas = pregunta.alternativas.map((alt, i) => {
        const letraId = String.fromCharCode(65 + i); // A, B, C, D...
        return {
          ...alt,
          id: letraId
        };
      });
      
      // Asegurar que el estándar exista
      if (!pregunta.estandarAprendizaje) {
        pregunta.estandarAprendizaje = asignatura === 'Lectura' 
          ? 'Interpretar y relacionar información del texto' 
          : 'Resolución de problemas';
      }
      
      return {
        ...pregunta,
        id
      };
    });
  } catch (error) {
    console.error('Error al procesar la respuesta del modelo:', error);
    throw new Error('No se pudo procesar la respuesta del modelo de IA');
  }
}
