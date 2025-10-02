
// src/ai/geminiHelper.ts
// Helper para integrar Gemini AI en el módulo DPD.
// Requiere instalar: npm i @google/generative-ai
// y definir la variable de entorno: VITE_GEMINI_API_KEY

import { GoogleGenerativeAI } from "@google/generative-ai";

// Tipos exportados
export type GeneratedChoiceQuestion = {
  enunciado: string;
  opciones: string[];
};

export type KeywordScore = {
  keyword: string;
  score: number;
};

// Configuraciones de modelos disponibles
const MODEL_CONFIGS = [
  {
    model: "gemini-2.5-pro",
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048, // Aumentado para contenido educativo complejo
    }
  },
  {
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    }
  }
];

// Funciones de utilidad
const getGenAI = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('No se encontró la API key de Gemini');
    return null;
  }
  try {
    return new GoogleGenerativeAI(apiKey);
  } catch (error) {
    console.error('Error al inicializar Gemini:', error);
    return null;
  }
};

async function tryModel(genAI: GoogleGenerativeAI, modelConfig: any): Promise<any> {
  try {
    const model = genAI.getGenerativeModel(modelConfig);
    await model.generateContent("test");
    return model;
  } catch (error) {
    console.warn(`Modelo ${modelConfig.model} no disponible:`, error);
    return null;
  }
}

async function getWorkingModel(): Promise<any> {
  const genAI = getGenAI();
  if (!genAI) return null;

  for (const config of MODEL_CONFIGS) {
    const model = await tryModel(genAI, config);
    if (model) {
      console.log(`Usando modelo ${config.model}`);
      return model;
    }
  }
  
  console.error('No se encontró ningún modelo de Gemini disponible');
  return null;
}

// Funciones de ayuda
function safeJSON(text: string): any {
  try {
    const clean = text.trim()
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "");
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Funciones principales exportadas
export async function generateMultipleChoiceQuestionsWithAI(
  tema: string, 
  cantidad: number = 3
): Promise<GeneratedChoiceQuestion[]> {
  const model = await getWorkingModel();
  if (!model) {
    return naiveChoices(tema, cantidad);
  }

  try {
    const prompt = `Genera ${cantidad} preguntas de selección múltiple sobre el tema "${tema}".
    Para cada pregunta, proporciona:
    1. Un enunciado claro y conciso
    2. 4 opciones de respuesta plausibles
    
    Devuelve las preguntas en formato JSON como este:
    {
      "preguntas": [
        {
          "enunciado": "¿Pregunta 1?",
          "opciones": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"]
        }
      ]
    }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = safeJSON(text);

    if (parsed?.preguntas?.length) {
      return parsed.preguntas.slice(0, cantidad);
    } else {
      console.warn('Formato inesperado de respuesta:', text);
      return naiveChoices(tema, cantidad);
    }
  } catch (error) {
    console.error('Error al generar preguntas:', error);
    return naiveChoices(tema, cantidad);
  }
}

export async function extractKeywordsWithAI(
  respuestas: string[],
  max: number = 30
): Promise<KeywordScore[]> {
  const model = await getWorkingModel();
  if (!model) {
    return naiveKeywords(respuestas);
  }

  try {
    const validAnswers = respuestas.filter(r => r && r.trim());
    if (validAnswers.length === 0) {
      return [];
    }

    const prompt = `Analiza estas respuestas y extrae los conceptos clave con su relevancia:
    ${validAnswers.join('\n---\n')}
    
    Responde en formato JSON:
    {
      "keywords": [
        { "keyword": "concepto1", "score": 0.9 },
        { "keyword": "concepto2", "score": 0.8 }
      ]
    }
    
    Incluye hasta ${max} conceptos más relevantes.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = safeJSON(text);

    if (parsed?.keywords?.length) {
      return parsed.keywords
        .filter(k => k.keyword && typeof k.score === 'number')
        .slice(0, max);
    } else {
      console.warn('Formato inesperado de respuesta:', text);
      return naiveKeywords(respuestas);
    }
  } catch (error) {
    console.error('Error al analizar respuestas:', error);
    return naiveKeywords(respuestas);
  }
}

// Fallbacks sin IA
function naiveChoices(tema: string, cantidad: number): GeneratedChoiceQuestion[] {
  const opciones = [
    "Totalmente de acuerdo",
    "De acuerdo",
    "Neutral",
    "En desacuerdo",
    "Totalmente en desacuerdo"
  ];
  return Array(cantidad).fill(null).map((_, i) => ({
    enunciado: `Pregunta ${i + 1} sobre ${tema}`,
    opciones: shuffle(opciones).slice(0, 4)
  }));
}

function naiveKeywords(respuestas: string[]): KeywordScore[] {
  const stopwords = new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "a", "ante", "con", "en", "para", "por", "sobre",
    "y", "o", "pero", "si", "no", "que", "cual", "quien", "como"
  ]);

  const freq: Record<string, number> = {};
  const words = respuestas.join(" ")
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3 && !stopwords.has(w));

  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  return Object.entries(freq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20)
    .map(([keyword, count]) => ({
      keyword,
      score: Math.min(1, count / words.length)
    }));
}

// Función optimizada para obtener específicamente el modelo Pro para contenido educativo complejo
async function getProModel(): Promise<any> {
  const genAI = getGenAI();
  if (!genAI) return null;
  
  // Configuración específica para el modelo Pro
  const proConfig = {
    model: "gemini-2.5-pro",
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    }
  };
  
  try {
    const model = genAI.getGenerativeModel(proConfig);
    // Verificar disponibilidad
    await model.generateContent("test");
    console.log(`Usando modelo optimizado: ${proConfig.model}`);
    return model;
  } catch (error) {
    console.warn(`Modelo Pro no disponible, usando fallback:`, error);
    return getWorkingModel(); // Fallback al método estándar
  }
}

// Adapter ligero exportado con nombre en español para compatibilidad general
export async function generarConIA(prompt: string, maxRetries = 2, useProModel = true): Promise<string> {
  // Registrar el tipo de solicitud para diagnóstico
  const promptPreview = prompt.substring(0, 50).replace(/\n/g, ' ') + '...';
  console.log(`Iniciando generación con IA. Prompt: "${promptPreview}"`);
  console.log(`Configuración: maxRetries=${maxRetries}, useProModel=${useProModel}`);
  
  // Intentar usar el modelo Pro para mejor calidad si se especifica
  let model;
  try {
    if (useProModel) {
      console.log("Intentando usar modelo Pro prioritariamente...");
      model = await getProModel();
      
      if (!model) {
        console.warn("Modelo Pro no disponible, intentando fallback a modelos alternativos");
        model = await getWorkingModel();
      }
    } else {
      model = await getWorkingModel();
    }
    
    if (!model) {
      console.error("No se pudo inicializar ningún modelo de Gemini");
      throw new Error('No se encontró un modelo de Gemini disponible. Verifique su conexión a internet y la API key.');
    }
  } catch (initError) {
    console.error("Error al inicializar modelo de Gemini:", initError);
    throw new Error(`Error al inicializar el modelo de IA: ${initError.message}`);
  }

  let attempts = 0;
  let lastError;
  let bestResponse = "";
  let bestResponseLength = 0;

  while (attempts <= maxRetries) {
    try {
      console.log(`Intento ${attempts + 1}/${maxRetries + 1} de generación con IA`);
      
      // Agregar metadatos al prompt para mejorar la calidad de la respuesta
      const enhancedPrompt = prompt + `\n\nIMPORTANTE: Devuelve SOLO el JSON estructurado sin comentarios adicionales. El JSON debe ser válido y parseable.`;
      
      const result = await model.generateContent(enhancedPrompt);
      
      // Algunas versiones devuelven result.response.text()
      if (result?.response && typeof result.response.text === 'function') {
        const text = result.response.text();
        
        // Verificar que la respuesta contiene información útil
        if (text && text.length > 100) {  // Una respuesta válida debería tener al menos cierta longitud
          console.log(`Respuesta generada exitosamente (${text.length} caracteres)`);
          
          // Comprobar si la respuesta contiene JSON
          if ((text.includes('{') && text.includes('}')) || 
              (text.includes('[') && text.includes(']'))) {
            console.log("La respuesta contiene estructuras JSON");
            return text;
          } else {
            console.warn("La respuesta no parece contener JSON válido");
            
            // Guardar esta respuesta si es la mejor hasta ahora
            if (text.length > bestResponseLength) {
              bestResponse = text;
              bestResponseLength = text.length;
            }
            
            // Si estamos en el último intento, devolver la mejor respuesta que tengamos
            if (attempts === maxRetries) {
              console.log("Usando la mejor respuesta disponible en el último intento");
              return bestResponse;
            }
          }
        } else {
          console.warn("Respuesta de IA demasiado corta, reintentando...");
        }
      } else if (result) {
        // Fallback a stringify
        const resultString = typeof result === 'string' ? result : JSON.stringify(result);
        console.warn("Formato de respuesta inesperado, usando fallback a string");
        return resultString;
      } else {
        console.warn("No se recibió respuesta válida del modelo");
      }
    } catch (error) {
      console.error(`Error en intento ${attempts + 1}:`, error);
      lastError = error;
      
      // Si el error indica un problema con el prompt o límite de tokens, intentar dividir el prompt
      if (error.message && (
          error.message.includes('token') || 
          error.message.includes('length') || 
          error.message.includes('limit'))) {
        console.log("Error relacionado con límites de tokens, intentando simplificar el prompt");
        // Simplificar el prompt para el próximo intento
        prompt = prompt.substring(0, Math.floor(prompt.length * 0.75));
      }
    }
    
    attempts++;
    
    // Esperar un poco antes de reintentar (backoff exponencial)
    if (attempts <= maxRetries) {
      const waitTime = Math.min(1000 * Math.pow(2, attempts), 8000); // max 8 segundos
      console.log(`Esperando ${waitTime}ms antes de reintentar...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Si llegamos aquí y tenemos alguna respuesta, devolverla aunque no sea ideal
  if (bestResponse) {
    console.log("Devolviendo la mejor respuesta disponible después de agotar reintentos");
    return bestResponse;
  }

  // Si llegamos aquí, todos los intentos fallaron y no hay respuesta
  console.error(`Todos los intentos de generación fallaron después de ${maxRetries + 1} intentos`);
  throw lastError || new Error('No se pudo generar contenido después de múltiples intentos. Por favor, intente nuevamente.');
}
