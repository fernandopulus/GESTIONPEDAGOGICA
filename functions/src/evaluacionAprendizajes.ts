import { onCall } from "firebase-functions/v2/https";
import { callGemini, isAuthenticated } from "./aiHelpers";
import { HttpsError } from "firebase-functions/v2/https";

// Tipos de datos (puedes moverlos a un archivo de tipos si es necesario)
interface Rubrica {
    nombre: string;
    descripcion: string;
    dimensiones: Dimension[];
}

interface Dimension {
    nombre: string;
    descripcion: string;
    descriptores: Descriptor[];
}

interface Descriptor {
    nivel: string;
    descripcion: string;
}

interface Prueba {
    nombre: string;
    objetivo: string;
    preguntas: Pregunta[];
}

interface Pregunta {
    enunciado: string;
    alternativas: { texto: string; esCorrecta: boolean }[];
    tipo: 'seleccion_multiple' | 'verdadero_falso' | 'respuesta_corta';
}


/**
 * Genera una rúbrica completa utilizando la IA de Gemini.
 */
export const generarRubricaConGemini = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
    isAuthenticated(request);

    const { objetivo, niveles, dimensiones, contextoAdicional } = request.data;

    if (!objetivo || !niveles || !dimensiones) {
        throw new HttpsError("invalid-argument", "Faltan parámetros requeridos (objetivo, niveles, dimensiones).");
    }

    const prompt = `
        Por favor, genera una rúbrica de evaluación en formato JSON.
        La rúbrica debe evaluar el siguiente objetivo de aprendizaje: "${objetivo}".
        
        La estructura de la rúbrica debe ser la siguiente:
        - Nombre de la rúbrica (string)
        - Descripción de la rúbrica (string)
        - Un array de "dimensiones" (las dimensiones a evaluar).

        Las dimensiones que necesito son: ${dimensiones.join(", ")}.
        
        Cada dimensión debe tener:
        - Nombre de la dimensión (string).
        - Descripción de la dimensión (string).
        - Un array de "descriptores".

        Cada descriptor debe corresponder a un nivel de logro y tener:
        - Nivel (string, por ejemplo: "Logrado", "En Desarrollo", "Por Lograr").
        - Descripción (string, detallando qué se espera para ese nivel en esa dimensión).

        Los niveles de logro son: ${niveles.join(", ")}.

        ${contextoAdicional ? `Considera el siguiente contexto adicional: ${contextoAdicional}` : ""}

        Ejemplo de formato de salida JSON:
        {
          "nombre": "Rúbrica para evaluar la resolución de problemas",
          "descripcion": "Esta rúbrica evalúa la capacidad del estudiante para resolver problemas complejos.",
          "dimensiones": [
            {
              "nombre": "Análisis del Problema",
              "descripcion": "Capacidad para identificar y comprender los componentes clave de un problema.",
              "descriptores": [
                { "nivel": "Logrado", "descripcion": "Identifica completa y precisamente todos los componentes del problema." },
                { "nivel": "En Desarrollo", "descripcion": "Identifica la mayoría de los componentes del problema, pero con algunas omisiones." },
                { "nivel": "Por Lograr", "descripcion": "No logra identificar los componentes esenciales del problema." }
              ]
            }
          ]
        }

        IMPORTANTE: Responde únicamente con el objeto JSON, sin texto adicional, explicaciones o saltos de línea antes o después. El JSON debe ser válido.
    `;

    try {
        const aiResponse = await callGemini({ prompt });
        // Intenta limpiar y parsear la respuesta
        const jsonString = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        const rubrica = JSON.parse(jsonString) as Rubrica;
        return { success: true, rubrica };
    } catch (error) {
        console.error("Error al generar o parsear la rúbrica:", error);
        throw new HttpsError("internal", "No se pudo generar la rúbrica con IA. Inténtalo de nuevo.");
    }
});


/**
 * Genera la descripción para un descriptor específico de una dimensión de la rúbrica.
 */
export const generarDescriptorDimensionConGemini = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
    isAuthenticated(request);

    const { dimension, nivel, objetivo, contextoAdicional } = request.data;

    if (!dimension || !nivel || !objetivo) {
        throw new HttpsError("invalid-argument", "Faltan parámetros requeridos (dimension, nivel, objetivo).");
    }

    const prompt = `
        Por favor, genera una descripción detallada para un descriptor de una rúbrica de evaluación.

        - Objetivo de la evaluación: "${objetivo}"
        - Dimensión a evaluar: "${dimension}"
        - Nivel de logro: "${nivel}"
        
        ${contextoAdicional ? `Considera el siguiente contexto adicional: ${contextoAdicional}` : ""}

        La descripción debe ser clara, concisa y observable. Debe describir qué evidencia o rendimiento se espera de un estudiante que se encuentra en el nivel "${nivel}" para la dimensión "${dimension}".

        IMPORTANTE: Responde únicamente con el texto de la descripción, sin frases introductorias como "Aquí está la descripción:" o similar.
    `;

    try {
        const descripcion = await callGemini({ prompt });
        return { success: true, descripcion };
    } catch (error) {
        console.error("Error al generar el descriptor:", error);
        throw new HttpsError("internal", "No se pudo generar la descripción con IA. Inténtalo de nuevo.");
    }
});


/**
 * Genera una prueba o evaluación completa con preguntas y alternativas.
 */
export const generarPruebaConGemini = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
    isAuthenticated(request);

    const { objetivo, numeroPreguntas, tiposPregunta, contextoAdicional } = request.data;

    if (!objetivo || !numeroPreguntas || !tiposPregunta) {
        throw new HttpsError("invalid-argument", "Faltan parámetros requeridos (objetivo, numeroPreguntas, tiposPregunta).");
    }

    const prompt = `
        Por favor, genera una prueba de evaluación en formato JSON.
        La prueba debe evaluar el siguiente objetivo de aprendizaje: "${objetivo}".
        Debe contener exactamente ${numeroPreguntas} preguntas.
        Los tipos de pregunta permitidos son: ${tiposPregunta.join(", ")}.

        La estructura de la prueba debe ser la siguiente:
        - Nombre de la prueba (string).
        - Objetivo de la prueba (string, el mismo que se proporciona).
        - Un array de "preguntas".

        Cada pregunta debe tener:
        - enunciado (string): El texto de la pregunta.
        - tipo (string): Puede ser 'seleccion_multiple', 'verdadero_falso', o 'respuesta_corta'.
        - alternativas (array de objetos):
            - Para 'seleccion_multiple', un array de 4 o 5 objetos, cada uno con "texto" (string) y "esCorrecta" (boolean). Solo una debe ser correcta.
            - Para 'verdadero_falso', un array de 2 objetos: { "texto": "Verdadero", "esCorrecta": boolean } y { "texto": "Falso", "esCorrecta": boolean }.
            - Para 'respuesta_corta', un array vacío.

        ${contextoAdicional ? `Considera el siguiente contexto adicional: ${contextoAdicional}` : ""}

        Ejemplo de formato de salida JSON:
        {
          "nombre": "Prueba sobre el Ciclo del Agua",
          "objetivo": "Comprender las fases del ciclo del agua.",
          "preguntas": [
            {
              "enunciado": "¿Qué fase del ciclo del agua implica la conversión de vapor de agua en líquido?",
              "tipo": "seleccion_multiple",
              "alternativas": [
                { "texto": "Evaporación", "esCorrecta": false },
                { "texto": "Condensación", "esCorrecta": true },
                { "texto": "Precipitación", "esCorrecta": false },
                { "texto": "Infiltración", "esCorrecta": false }
              ]
            },
            {
              "enunciado": "El sol es el principal motor del ciclo del agua.",
              "tipo": "verdadero_falso",
              "alternativas": [
                { "texto": "Verdadero", "esCorrecta": true },
                { "texto": "Falso", "esCorrecta": false }
              ]
            },
            {
              "enunciado": "Nombra el proceso por el cual las plantas liberan vapor de agua a la atmósfera.",
              "tipo": "respuesta_corta",
              "alternativas": []
            }
          ]
        }

        IMPORTANTE: Responde únicamente con el objeto JSON, sin texto adicional, explicaciones o saltos de línea. El JSON debe ser válido y completo.
    `;

    try {
        const aiResponse = await callGemini({ prompt });
        const jsonString = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        const prueba = JSON.parse(jsonString) as Prueba;
        return { success: true, prueba };
    } catch (error) {
        console.error("Error al generar o parsear la prueba:", error);
        throw new HttpsError("internal", "No se pudo generar la prueba con IA. Inténtalo de nuevo.");
    }
});
