
// src/ai/geminiHelper.ts
// Helper delgado para integrar Gemini Flash 2.5 Lite en el módulo DPD.
// Requiere instalar: npm i @google/generative-ai
// y definir la variable de entorno: VITE_GEMINI_API_KEY

import { GoogleGenerativeAI } from "@google/generative-ai";

const getGenAI = () => {
  const apiKey = (import.meta as any)?.env?.VITE_GEMINI_API_KEY || (process as any)?.env?.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI;
  } catch {
    return null;
  }
};

// -----------------------------
// Generación de preguntas tipo selección múltiple
// -----------------------------
export type GeneratedChoiceQuestion = {
  enunciado: string;
  opciones: string[];
};

export async function generateMultipleChoiceQuestionsWithAI(
  topic: string,
  count: number
): Promise<GeneratedChoiceQuestion[]> {
  const genAI = getGenAI();
  if (!genAI) return naiveChoices(topic, count);

  try {
    // Gemini Flash 2.5 Lite (puede variar el id según disponibilidad del SDK)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite-preview-02-05" });

    const prompt = `Genera ${count} preguntas breves en español de selección múltiple (selección múltiple posible, sin señalar cuál es correcta) sobre el tema "${topic}".
Responde SOLO en JSON estricto con el siguiente formato:
{
  "items": [
    { "enunciado": "...", "opciones": ["...", "...", "...", "..."] },
    ...
  ]
}
Asegúrate de que cada pregunta tenga entre 4 y 5 opciones, variadas y plausibles. No expliques nada fuera del JSON.`;

    const result = await model.generateContent(prompt as any);
    const text = result?.response?.text?.() ?? "";
    const parsed = safeJSON(text);
    if (parsed?.items?.length) return parsed.items.slice(0, count);
    return naiveChoices(topic, count);
  } catch (err) {
    console.warn("Gemini generateMultipleChoiceQuestions error:", err);
    return naiveChoices(topic, count);
  }
}

// -----------------------------
// Extracción de palabras/conceptos clave desde respuestas abiertas
// -----------------------------
export type KeywordScore = { keyword: string; score: number };

export async function extractKeywordsWithAI(
  answers: string[],
  max = 30
): Promise<KeywordScore[]> {
  const genAI = getGenAI();
  if (!genAI) return naiveKeywords(answers, max);

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite-preview-02-05" });
    const joined = answers.filter(Boolean).join("\n- ");
    const prompt = `Analiza estas respuestas de docentes (en español) y devuelve un JSON con las principales palabras o conceptos clave y un puntaje de relevancia de 0 a 1.
Respuestas:
${joined}

Responde SOLO el JSON con el formato:
{ "keywords": [ { "keyword": "..." , "score": 0.85 }, ... ] } 
Incluye hasta ${max} elementos, sin texto adicional.`;

    const result = await model.generateContent(prompt as any);
    const text = result?.response?.text?.() ?? "";
    const parsed = safeJSON(text);
    if (parsed?.keywords?.length) {
      return parsed.keywords.slice(0, max);
    }
    return naiveKeywords(answers, max);
  } catch (err) {
    console.warn("Gemini extractKeywords error:", err);
    return naiveKeywords(answers, max);
  }
}

// -----------------------------
// Fallbacks locales sin IA
// -----------------------------
function naiveChoices(topic: string, count: number): GeneratedChoiceQuestion[] {
  const bank = [
    "Siempre", "Frecuentemente", "A veces", "Rara vez", "Nunca",
    "Totalmente de acuerdo", "De acuerdo", "Ni de acuerdo ni en desacuerdo", "En desacuerdo", "Totalmente en desacuerdo"
  ];
  return Array.from({ length: count }).map((_, i) => ({
    enunciado: `Sobre "${topic}", seleccione las opciones que mejor describen su práctica (${i + 1}).`,
    opciones: shuffle(bank).slice(0, 5),
  }));
}

function naiveKeywords(answers: string[], max: number): KeywordScore[] {
  const text = answers.join(" ").toLowerCase();
  const tokens = text.split(/[^a-záéíóúüñ]+/i).filter(t => t.length > 3);
  const stop = new Set("para como donde tanto entre sobre pero esta este esta estas estos solo muy entonces tiene tienen desde hacia eran eran sera será así asi aún aun los las unos unas con sin ante bajo cabe contra desde hacia hasta para por segun según tras durante".split(/\s+/));
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    if (stop.has(t)) continue;
    freq[t] = (freq[t] || 0) + 1;
  }
  const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0, max);
  const total = sorted.reduce((s, [,n])=>s+n, 0) || 1;
  return sorted.map(([k, n]) => ({ keyword: k, score: Math.min(1, n/total) }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function safeJSON(text: string): any {
  try {
    // limpia posibles envoltorios de markdown
    const clean = text.trim().replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "");
    return JSON.parse(clean);
  } catch {
    return null;
  }
}
