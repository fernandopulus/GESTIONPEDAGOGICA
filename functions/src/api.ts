import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { defineSecret } from "firebase-functions/params";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const app = express();
app.use(express.json());

// Endpoint para generar evaluaciones (ajusta la lógica según tu prompt y procesamiento)
app.post("/generarEvaluacion", async (req, res) => {
  try {
    const { prompt, formData } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "No Gemini API Key configured" });
      return;
    }
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    // Aquí puedes procesar el texto y devolver el JSON esperado por el frontend
    res.json({ resultado: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar evaluación" });
  }
});

// Puedes agregar más endpoints aquí, por ejemplo /generarRubrica, /generarFeedback, etc.

// Endpoint para AcompanamientoDocente
app.post("/generarAcompanamientoDocente", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, formData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY as string;
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    res.json({ resultado: text });
  } catch (error) {
    res.status(500).json({ error: "Error al generar acompañamiento docente" });
  }
});

// Endpoint para ActividadesRemotas
app.post("/generarActividadRemota", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, formData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY as string;
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    res.json({ resultado: text });
  } catch (error) {
    res.status(500).json({ error: "Error al generar actividad remota" });
  }
});

// Endpoint para AnalisisTaxonomico
app.post("/analisisTaxonomico", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, fileData, documentName, nivelForm, asignaturaForm, userId } = req.body;
  const apiKey = process.env.GEMINI_API_KEY as string;
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    // Aquí podrías usar fileData si tu modelo lo soporta
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    res.json({ resultado: text });
  } catch (error) {
    res.status(500).json({ error: "Error en análisis taxonómico" });
  }
});

// Endpoint para Autoaprendizaje
app.post("/generarFeedbackAutoaprendizaje", async (req: express.Request, res: express.Response) => {
  try {
    const { actividad, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY as string;
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const prompt = JSON.stringify({ actividad, feedback });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    res.json({ resultado: text });
  } catch (error) {
    res.status(500).json({ error: "Error al generar feedback de autoaprendizaje" });
  }
});

// Endpoint para DashboardOPR
app.post("/generarDashboardOPR", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, formData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY as string;
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    res.json({ resultado: text });
  } catch (error) {
    res.status(500).json({ error: "Error al generar dashboard OPR" });
  }
});

// Endpoint para DesarrolloProfesionalDocente
app.post("/generarDesarrolloProfesionalDocente", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, formData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY as string;
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    res.json({ resultado: text });
  } catch (error) {
    res.status(500).json({ error: "Error al generar desarrollo profesional docente" });
  }
});

// Endpoint para Interdisciplinario
app.post("/generarInterdisciplinario", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, formData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY as string;
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    res.json({ resultado: text });
  } catch (error) {
    res.status(500).json({ error: "Error al generar interdisciplinario" });
  }
});

// Endpoint para PlanificacionDocente
app.post("/generarPlanificacionDocente", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, formData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY as string;
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    res.json({ resultado: text });
  } catch (error) {
    res.status(500).json({ error: "Error al generar planificación docente" });
  }
});

// Endpoint para RecursosAprendizaje
app.post("/generarRecursosAprendizaje", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, formData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY as string;
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    res.json({ resultado: text });
  } catch (error) {
    res.status(500).json({ error: "Error al generar recursos de aprendizaje" });
  }
});

// Endpoint para RubricaEditor
app.post("/generarRubricaEditor", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, formData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY as string;
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    res.json({ resultado: text });
  } catch (error) {
    res.status(500).json({ error: "Error al generar rúbrica" });
  }
});

export const api = onRequest({ secrets: [GEMINI_API_KEY] }, app);
