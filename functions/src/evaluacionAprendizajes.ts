import { onCall } from "firebase-functions/v2/https";
import { callGemini, isAuthenticated } from "./aiHelpers";
import { HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

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
export const generarRubricaConGemini = onCall({ secrets: [geminiApiKey] }, async (request) => {
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
    const { text: aiResponseText, modelUsed } = await callGemini({ prompt });
    // Intenta limpiar y parsear la respuesta
    const jsonString = aiResponseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const rubrica = JSON.parse(jsonString) as Rubrica;
    return { success: true, rubrica, modelUsed };
    } catch (error) {
        console.error("Error al generar o parsear la rúbrica:", error);
        throw new HttpsError("internal", "No se pudo generar la rúbrica con IA. Inténtalo de nuevo.");
    }
});


/**
 * Genera la descripción para un descriptor específico de una dimensión de la rúbrica.
 */
export const generarDescriptorDimensionConGemini = onCall({ secrets: [geminiApiKey] }, async (request) => {
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
    const { text: descripcion, modelUsed } = await callGemini({ prompt });
    return { success: true, descripcion, modelUsed };
    } catch (error) {
        console.error("Error al generar el descriptor:", error);
        throw new HttpsError("internal", "No se pudo generar la descripción con IA. Inténtalo de nuevo.");
    }
});


/**
 * Genera una prueba o evaluación completa con preguntas y alternativas.
 */

export const generarPruebaConGemini = onCall({ secrets: [geminiApiKey] }, async (request) => {
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
        
        // Decidir si usar modo flash basado en el tipo y cantidad de preguntas
        const useFlash = tipo === 'verdadero_falso' || tipo === 'respuesta_corta' || cantidad <= 3;
        
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
            const { text: aiResponse, modelUsed: _modelUsed } = await callGemini({ 
                prompt, 
                mode: useFlash ? "flash" : "standard",
                config: {
                    temperature: useFlash ? 0.4 : 0.7,
                    topK: useFlash ? 16 : 40,
                    maxOutputTokens: useFlash ? 512 : 1024
                }
            });
            // Logging para diagnóstico (truncado)
            console.log(`[DEBUG] generarPruebaConGemini - tipo=${tipo} modelo=${_modelUsed} respuesta_truncada=`, aiResponse.substring(0, 2000));

            let jsonString = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            let preguntas: Pregunta[];
            try {
                preguntas = JSON.parse(jsonString) as Pregunta[];
            } catch (error) {
                // Fallback: intentar extraer el primer array JSON que aparezca en la respuesta
                const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
                if (arrayMatch && arrayMatch[0]) {
                    try {
                        preguntas = JSON.parse(arrayMatch[0]) as Pregunta[];
                    } catch (e2) {
                        console.error('[ERROR] Falló parseo del array extraído:', e2, 'array_truncado=', arrayMatch[0].substring(0,2000));
                        throw new HttpsError("internal", `No se pudo recuperar preguntas válidas para tipo ${tipo}.`);
                    }
                } else {
                    // Intentar heurística: tomar desde primer '[' hasta último ']' si existen
                    const firstBracket = jsonString.indexOf('[');
                    const lastBracket = jsonString.lastIndexOf(']');
                    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                        const preguntasJson = jsonString.substring(firstBracket, lastBracket + 1);
                        try {
                            preguntas = JSON.parse(preguntasJson) as Pregunta[];
                        } catch (e3) {
                            console.error('[ERROR] Heurística de parseo falló:', e3, 'payload_truncado=', preguntasJson.substring(0,2000));
                            throw new HttpsError("internal", `No se pudo recuperar preguntas válidas para tipo ${tipo}.`);
                        }
                    } else {
                        console.error('[ERROR] No se encontró un array JSON en la respuesta de Gemini. respuesta_truncada=', jsonString.substring(0,2000));
                        throw new HttpsError("internal", `No se pudo generar preguntas para tipo ${tipo}.`);
                    }
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
