
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
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    }
  },
  {
    model: "gemini-1.5-pro",
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
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

// Adapter ligero exportado con nombre en español para compatibilidad
// con el código existente que importa `generarConIA`.
export async function generarConIA(prompt: string): Promise<string> {
  const model = await getWorkingModel();
  if (!model) {
    throw new Error('No se encontró un modelo de Gemini disponible');
  }

  try {
    const result = await model.generateContent(prompt);
    // Algunas versiones devuelven result.response.text()
    if (result?.response && typeof result.response.text === 'function') {
      return result.response.text();
    }
    // Fallback a stringify
    return typeof result === 'string' ? result : JSON.stringify(result);
  } catch (error) {
    console.error('Error al invocar Gemini en generarConIA:', error);
    throw error;
  }
}
