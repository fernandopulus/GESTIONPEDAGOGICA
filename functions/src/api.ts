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
const callGeminiText = async (prompt: string, modelName = "gemini-1.5-pro") => {
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
  const text = await callGeminiText(prompt, modelName);
  try {
    const json = JSON.parse(text);
    return res.status(200).json(json);
  } catch {
    console.error("Gemini returned non-JSON:", text);
    return res.status(502).json({ error: "Respuesta de IA no JSON", raw: text });
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

// Montar el router bajo /api
app.use("/api", apiRouter);

// Exporta una sola función Express; añade el rewrite en firebase.json:
// { "hosting": { "rewrites": [ { "source": "/api/**", "function": { "functionId": "api", "region": "us-central1" } } ] } }
export const api = onRequest(
  { region: "us-central1", secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: "512MiB" },
  app
);

