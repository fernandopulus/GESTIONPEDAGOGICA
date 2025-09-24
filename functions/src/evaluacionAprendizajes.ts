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

    const { objetivo, cantidadesPorTipo, contextoAdicional } = request.data;

    if (!objetivo || !cantidadesPorTipo || typeof cantidadesPorTipo !== 'object') {
        throw new HttpsError("invalid-argument", "Faltan parámetros requeridos (objetivo, cantidadesPorTipo).");
    }

    // Generar preguntas por cada tipo y cantidad
    let todasLasPreguntas: Pregunta[] = [];
    for (const tipo in cantidadesPorTipo) {
        const cantidad = cantidadesPorTipo[tipo];
        if (!cantidad || cantidad < 1) continue;
        const prompt = `
            GENERA ${cantidad} PREGUNTAS DEL TIPO "${tipo}" EN FORMATO JSON COMPACTO.
            - Objetivo: "${objetivo}".
            - NO incluyas explicaciones, comentarios ni texto adicional.
            - Cada pregunta debe tener:
                - enunciado (string)
                - tipo (string): '${tipo}'
                - alternativas (array):
                    - 'seleccion_multiple': 4 o 5 objetos, solo una correcta
                    - 'verdadero_falso': dos objetos, uno correcto
                    - 'respuesta_corta': array vacío
            ${contextoAdicional ? `- Contexto adicional: ${contextoAdicional}` : ""}
            FORMATO DE SALIDA:
            [ ... ]
            RESPONDE ÚNICAMENTE CON EL ARRAY JSON, SIN TEXTO ADICIONAL, SIN ENCABEZADOS, SIN EXPLICACIONES. EL JSON DEBE SER VÁLIDO Y COMPACTO.`;

        try {
            const aiResponse = await callGemini({ prompt });
            let jsonString = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            let preguntas: Pregunta[];
            try {
                preguntas = JSON.parse(jsonString) as Pregunta[];
            } catch (error) {
                // Fallback: intentar parsear hasta el último cierre de corchete
                const lastBrace = jsonString.lastIndexOf('}]');
                if (lastBrace !== -1) {
                    const arrayStart = jsonString.indexOf('[');
                    if (arrayStart !== -1) {
                        const preguntasJson = jsonString.substring(arrayStart, lastBrace + 2);
                        try {
                            preguntas = JSON.parse(preguntasJson) as Pregunta[];
                        } catch (e2) {
                                throw new HttpsError("internal", `No se pudo recuperar preguntas válidas para tipo ${tipo}.`);
                        }
                    } else {
                            throw new HttpsError("internal", `No se pudo generar preguntas para tipo ${tipo}.`);
                    }
                } else {
                        throw new HttpsError("internal", `No se pudo generar preguntas para tipo ${tipo}.`);
                }
            }
            todasLasPreguntas = todasLasPreguntas.concat(preguntas);
        } catch (error) {
            console.error(`Error al generar o parsear preguntas para tipo ${tipo}:`, error);
                throw new HttpsError("internal", `No se pudo generar preguntas para tipo ${tipo}.`);
        }
    }

    // Construir el objeto de prueba final
    const prueba: Prueba = {
        nombre: "Prueba generada",
        objetivo,
        preguntas: todasLasPreguntas
    };
    return { success: true, prueba };
});
