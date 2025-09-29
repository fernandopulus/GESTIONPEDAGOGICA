// functions/src/api.ts (hardened)
import { onRequest } from "firebase-functions/v2/https";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// ---- Init admin SDK once ----
if (!getApps().length) initializeApp();

// ---- Secrets ----
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// ---- Express app ----
const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS global
app.use(
  cors({
    origin: ["https://plania-clase.web.app"],
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// ---- API Router ----
const apiRouter = express.Router();

// Endpoint de salud para monitoreo y pruebas
apiRouter.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: Date.now() });
});

// ---- Auth middleware (verify Firebase ID token) ----
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
    const token = auth.slice(7);
    const decoded = await getAuth().verifyIdToken(token);
    (req as any).uid = decoded.uid;
    return next();
  } catch (e) {
    console.error("Auth error:", e);
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ---- Gemini helper ----
const callGeminiText = async (prompt: string, modelName = "gemini-2.5-pro") => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No Gemini API Key configured");
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return result.response.text();
};

const respondJsonFromGemini = async (
  res: Response,
  prompt: string,
  modelName?: string
) => {
  let text = await callGeminiText(prompt, modelName);
  try {
    // Clean potential markdown code block from Gemini response
    const match = text.match(/```(json)?\n([\s\S]*?)\n```/);
    if (match && match[2]) {
      text = match[2].trim();
    }

    const json = JSON.parse(text);
    return res.status(200).json(json);
  } catch (e) {
    console.error("Gemini returned non-JSON or parsing failed:", text);
    console.error("Parsing error:", e);
    return res.status(502).json({ error: "Respuesta de IA no es un JSON válido", raw: text });
  }
};

// ---- Endpoints ----

// Endpoints bajo /api
apiRouter.post("/generarEvaluacion", requireAuth, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    return await respondJsonFromGemini(res, prompt);
  } catch (error) {
    console.error("generarEvaluacion error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

apiRouter.post("/generarRubricaEditor", requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    return await respondJsonFromGemini(res, prompt);
  } catch (error) {
    console.error("generarRubricaEditor error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

// Ejemplo genérico de texto libre (no JSON)
apiRouter.post("/generarTexto", requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    const text = await callGeminiText(prompt);
    return res.status(200).json({ resultado: text });
  } catch (error) {
    console.error("generarTexto error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

apiRouter.post("/generarActividadRemota", requireAuth, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    return await respondJsonFromGemini(res, prompt);
  } catch (error) {
    console.error("generarActividadRemota error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

apiRouter.post("/generarPruebaRemota", requireAuth, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    return await respondJsonFromGemini(res, prompt);
  } catch (error) {
    console.error("generarPruebaRemota error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

const simpleStringify = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return '[Objeto no serializable]';
      }
  }
  return String(value);
}

const generateFeedbackPromptFromBackend = (actividad: any, feedback: any): string => {
  const errores = feedback.items.filter((item: any) => item.esCorrecta === false);
  const desarrollo = feedback.items.filter((item: any) => item.tipo === 'Desarrollo');

  const erroresString = errores.map((e: any) =>
    `- Pregunta: "${simpleStringify(e.pregunta)}"
  - Respuesta del estudiante: "${simpleStringify(e.respuestaUsuario)}"
  - Respuesta correcta: "${simpleStringify(e.respuestaCorrecta)}"`
  ).join('\n');

  const desarrolloString = desarrollo.map((d: any) =>
    `- Pregunta abierta: "${simpleStringify(d.pregunta)}"
  - Respuesta del estudiante: """${simpleStringify(d.respuestaUsuario)}"""`
  ).join('\n');

  return `
Eres un tutor pedagógico. Actividad de "${simpleStringify(actividad.asignatura)}" sobre "${simpleStringify(actividad.contenido)}".
Devuelve SOLO un JSON con esta forma:

{
  "logros": "1 párrafo motivador, reconociendo aciertos",
  "desafios": [
    { "pregunta": "...", "explicacionDelError": "≤50 palabras, por qué la correcta es adecuada" }
  ],
  "comentariosDesarrollo": [
    { "pregunta": "...", "retroalimentacionBreve": "≤60 palabras, concreta y constructiva. No asignes nota." }
  ]
}

ERRORES (alternativa / lectura / pareados):
${erroresString || "- Sin errores de alternativa."}

RESPUESTAS DE DESARROLLO:
${desarrolloString || "- Sin preguntas de desarrollo."}
`.trim();
};

apiRouter.post("/generarFeedbackAutoaprendizaje", requireAuth, async (req, res) => {
  try {
    const { actividad, feedback } = req.body || {};
    if (!actividad || !feedback) return res.status(400).json({ error: "actividad y feedback son requeridos" });
    
    const prompt = generateFeedbackPromptFromBackend(actividad, feedback);
    
    return await respondJsonFromGemini(res, prompt);
  } catch (error) {
    console.error("generarFeedbackAutoaprendizaje error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});
 
// --- Feedback IA para Acompañamiento Docente ---
apiRouter.post("/generarFeedbackAcompanamientoDocente", requireAuth, async (req, res) => {
  try {
    const { formData } = req.body || {};
    if (!formData) return res.status(400).json({ error: "formData requerido" });

    // Prompt para Gemini
    const prompt = `Eres un experto en acompañamiento pedagógico. Analiza el siguiente registro y genera una retroalimentación breve, concreta y constructiva para el docente observador. Sé motivador, pero también señala oportunidades de mejora. Devuelve SOLO el texto, sin saludos ni despedidas.

Datos del acompañamiento:
Docente: ${formData.docente}
Curso: ${formData.curso}
Asignatura: ${formData.asignatura}
Fecha: ${formData.fecha}
Bloques: ${formData.bloques || "No especificado"}

Observaciones generales:
${formData.observacionesGenerales || "Sin observaciones"}

Resultados de rúbrica:
${JSON.stringify(formData.rubricaResultados || {})}
`;

    const resultado = await callGeminiText(prompt);
    return res.status(200).json({ feedback: resultado });
  } catch (error) {
    console.error("generarFeedbackAcompanamientoDocente error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

apiRouter.post("/mejorarTextoOPR", requireAuth, async (req, res) => {
  try {
    const { formData } = req.body || {};
    if (!formData || !formData.retroalimentacion) {
      return res.status(400).json({ error: "formData con retroalimentacion es requerido" });
    }

    const { exito, foco, elementosIdentificar } = formData.retroalimentacion;

    const improve = async (text: string, label: string) => {
      if (!text || !text.trim()) return text;
      const prompt = `Mejora la redacción del siguiente texto con un tono técnico-pedagógico propio de informes educativos. Mantén el sentido original y NO agregues información nueva ni ejemplos inventados. Devuelve SOLO el texto mejorado, sin comillas ni nada más.\n\nTexto (${label}):\n"""${text}"""`;
      return callGeminiText(prompt);
    };

    const [exitoMejorado, focoMejorado, elementosMejorados] = await Promise.all([
      improve(exito, 'Éxito'),
      improve(foco, 'Foco'),
      improve(elementosIdentificar, 'Elementos a Identificar'),
    ]);

    const improvedRetroalimentacion = {
      ...formData.retroalimentacion,
      exito: exitoMejorado.trim(),
      foco: focoMejorado.trim(),
      elementosIdentificar: elementosMejorados.trim(),
    };

    return res.status(200).json({ retroalimentacion: improvedRetroalimentacion });
  } catch (error) {
    console.error("mejorarTextoOPR error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

// --- Planificación Docente ---
apiRouter.post("/generarIdeasPlanificacion", requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    const resultado = await callGeminiText(prompt);
    return res.status(200).json({ ideas: resultado });
  } catch (error) {
    console.error("generarIdeasPlanificacion error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

apiRouter.post("/generarDetallesPlanificacion", requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    const resultado = await callGeminiText(prompt);
    return res.status(200).json({ detalles: resultado });
  } catch (error) {
    console.error("generarDetallesPlanificacion error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

apiRouter.post("/generarConceptosPlanificacion", requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    const resultado = await callGeminiText(prompt);
    return res.status(200).json({ conceptos: resultado });
  } catch (error) {
    console.error("generarConceptosPlanificacion error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

apiRouter.post("/generarUnidadPlanificacion", requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    return await respondJsonFromGemini(res, prompt);
  } catch (error) {
    console.error("generarUnidadPlanificacion error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

apiRouter.post("/generarClasePlanificacion", requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    return await respondJsonFromGemini(res, prompt);
  } catch (error) {
    console.error("generarClasePlanificacion error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

apiRouter.post("/generarObjetivoActividad", requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });
    const resultado = await callGeminiText(prompt);
    return res.status(200).json({ objetivo: resultado });
  } catch (error) {
    console.error("generarObjetivoActividad error:", error);
    return res.status(500).json({ error: "IA call failed" });
  }
});

// --- Analisis Taxonomico ---
apiRouter.post("/analisisTaxonomico", requireAuth, async (req: Request, res: Response) => {
    try {
      const { prompt, fileData } = req.body || {};
      if (!prompt || !fileData) {
        return res.status(400).json({ error: "Prompt y fileData son requeridos" });
      }
  
      // Llama a Gemini con el archivo
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No se ha configurado la API Key de Gemini");
      
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: "gemini-2.5-pro" });
  
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: fileData.mimeType,
            data: fileData.data,
          },
        },
      ]);
      
      let text = result.response.text();
  
      // Limpia el resultado para obtener solo el JSON
      const match = text.match(/```(json)?\n([\s\S]*?)\n```/);
      if (match && match[2]) {
        text = match[2].trim();
      }
  
      const json = JSON.parse(text);
      return res.status(200).json(json);
  
    } catch (error) {
      console.error("analisisTaxonomico error:", error);
      if (error instanceof Error) {
          return res.status(500).json({ error: "Llamada a IA falló", details: error.message });
      }
      return res.status(500).json({ error: "Llamada a IA falló con un error desconocido" });
    }
  });

// Montar el router bajo /api
app.use("/api", apiRouter);

// Exporta una sola función Express; añade el rewrite en firebase.json:
// { "hosting": { "rewrites": [ { "source": "/api/**", "function": { "functionId": "api", "region": "us-central1" } } ] } }
export const api = onRequest(
  { region: "us-central1", secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: "512MiB" },
  app
);

