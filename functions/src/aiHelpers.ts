import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";

// Definir variable secreta para la API key de Gemini
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Definir tipo de modo de generación
type GenerationMode = "standard" | "flash";

// Definir interfaces para los tipos de Gemini
interface GeminiPart {
  text: string;
}

interface GeminiContent {
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER";
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  promptFeedback?: {
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  };
}

/**
 * Obtiene la API Key de Gemini desde las variables secretas.
 * @return {string} API Key de Gemini.
 * @throws Error si no está definida.
 */
const getGeminiApiKey = (): string => {
  const apiKey = geminiApiKey.value();
  if (!apiKey) {
    throw new Error("Falta la API Key de Gemini en las variables secretas");
  }
  return apiKey;
};

/**
 * Verifica que el usuario esté autenticado en la solicitud.
 * @param {CallableRequest} request
 * @throws HttpsError si el usuario no está autenticado.
 * @return {void}
 */
export const isAuthenticated = (request: CallableRequest): void => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Debes estar autenticado para usar la IA.",
    );
  }
};

/**
 * Llama a la API de Gemini para obtener una respuesta IA.
 * @param {object} params
 * @param {string} params.prompt - Texto prompt para la IA.
 * @param {Record<string, unknown>=} params.config - Config extra (opcional).
 * @return {Promise<string>} Respuesta generada por Gemini.
 */
export async function callGemini({
  prompt,
  config,
  mode = "standard",
}: {
  prompt: string,
  config?: Record<string, unknown>,
  mode?: GenerationMode,
}): Promise<{ text: string; modelUsed: string }> {
  const apiKey = getGeminiApiKey();
  const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  // Lista de modelos candidatos — intentaremos en orden hasta que uno funcione.
  const candidateModels = mode === 'flash'
    ? [
      'gemini-2.5-flash',
      'gemini-2.5-flash-preview-05-20',
      'gemini-flash-latest',
    ]
    : [
      'gemini-2.5-pro',
      'gemini-pro-latest',
    ];

  console.log('[DEBUG] Iniciando llamada a Gemini API - Modo:', mode, 'Candidates:', candidateModels.join(', '));

  let lastError: Error | null = null;

  for (const modelName of candidateModels) {
    const url = `${baseUrl}/${modelName}:generateContent`;
    // Intentos por modelo (para manejar MAX_TOKENS aumentando maxOutputTokens)
    let attempt = 0;
  const maxAttemptsPerModel = 3;
  // Base tokens (puede venir desde config). En flash elevamos para evitar MAX_TOKENS frecuentes.
  let baseMaxTokens = mode === 'flash' ? 1024 : ((config?.maxOutputTokens as number) || 2048);

    for (; attempt < maxAttemptsPerModel; attempt++) {
      try {
  const attemptMaxTokens = Math.min(8192, baseMaxTokens * Math.pow(2, attempt));
        const fetchResponse = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: prompt }] }
            ],
            generationConfig: {
              temperature: mode === 'flash' ? 0.2 : ((config?.temperature as number) || 0.7),
              topK: mode === 'flash' ? 16 : ((config?.topK as number) || 40),
              topP: mode === 'flash' ? 0.85 : ((config?.topP as number) || 0.95),
              maxOutputTokens: attemptMaxTokens,
              candidateCount: 1,
              // No forzamos stopSequences en flash para evitar cortes prematuros
            },
          }),
        });

        if (!fetchResponse.ok) {
          const errorData = await fetchResponse.text();
          console.error('[WARN] Modelo', modelName, 'respondió con status', fetchResponse.status);

          if (fetchResponse.status === 404) {
            lastError = new Error(`Error en API Gemini (404): ${errorData}`);
            // No tiene sentido reintentar el mismo modelo si no existe
            break;
          }

          console.error('[ERROR] Error de Gemini API:', {
            model: modelName,
            status: fetchResponse.status,
            statusText: fetchResponse.statusText,
            error: errorData,
          });
          throw new Error(`Error en API Gemini (${fetchResponse.status}): ${errorData}`);
        }

        const data = await fetchResponse.json() as GeminiResponse;
        console.log('[DEBUG] Respuesta completa de Gemini (modelo:', modelName, '):', JSON.stringify(data, null, 2));

        // Función auxiliar para extraer texto de distintas formas que devuelve la API
        const extractTextFromCandidate = (cand: any): string => {
          try {
            if (!cand || !cand.content) return '';
            // content.parts[].text (forma esperada)
            if (Array.isArray(cand.content.parts)) {
              for (const p of cand.content.parts) {
                if (p && typeof p.text === 'string' && p.text.trim().length > 0) return p.text.trim();
              }
            }
            // content.text
            if (typeof cand.content.text === 'string' && cand.content.text.trim().length > 0) return cand.content.text.trim();
            // content.output or output_text
            if (typeof cand.content.output === 'string' && cand.content.output.trim().length > 0) return cand.content.output.trim();
            if (typeof cand.content.output_text === 'string' && cand.content.output_text.trim().length > 0) return cand.content.output_text.trim();
            // Si no hay texto, devolver stringified content para diagnóstico
            const s = JSON.stringify(cand.content);
            return s && s !== '{}' ? s : '';
          } catch (e) {
            return '';
          }
        };

        const candidate = (data as any)?.candidates?.[0];
        const responseText = extractTextFromCandidate(candidate);

        // Si no hay texto, pero el modelo indicó que terminó por max tokens, intentar reintentar con mayor límite
        const finishReason = candidate?.finishReason || '';
        if ((!responseText || responseText.length < 10) && finishReason === 'MAX_TOKENS') {
          console.error('[ERROR] La respuesta de la IA está vacía o truncada (finishReason=MAX_TOKENS). Intentando con más tokens...');
          // Si no es el último intento, continuar para reintentar con más tokens
          if (attempt < maxAttemptsPerModel - 1) {
            continue;
          }
          // Si ya no quedan intentos, marcar como error y salir de attempts
          throw new Error('La respuesta de la IA no contiene texto o está incompleta.');
        }

        if (!responseText || responseText.length < 10) {
          console.error('[ERROR] La respuesta de la IA está vacía o truncada:', responseText);
          throw new Error('La respuesta de la IA no contiene texto o está incompleta.');
        }

        // Respuesta satisfactoria: devolver texto y modelo usado
        return { text: responseText, modelUsed: modelName };
      } catch (error) {
        console.error('[WARN] Falló llamada (intento', attempt + 1, 'de', maxAttemptsPerModel, ') con modelo', modelName, ':', error instanceof Error ? error.message : String(error));
        if (error instanceof Error) lastError = error;
        // Si fue un 404 en fetch, no reintentar con el mismo modelo
        if (error instanceof Error && error.message.includes('404')) break;
        // si quedan intentos, el for continuará y volverá a intentar con más tokens
      }
    }
  }

  // Si llegamos aquí, ningún modelo candidato funcionó. Intentar ListModels para diagnóstico.
  try {
    const listModelsUrl = baseUrl;
    const listResp = await fetch(`${listModelsUrl}?key=${apiKey}`);
    const listText = await listResp.text();
    console.error('[ERROR] Ningún modelo candidato funcionó. ListModels status:', listResp.status);
    console.error('[ERROR] ListModels response body (truncated):', listText.slice(0, 2000));
    throw new Error(`Ningún modelo candidato soportó generateContent. ListModels status=${listResp.status}. Ver logs para detalles.`);
  } catch (listErr) {
    console.error('[ERROR] Falló ListModels al diagnosticar modelos disponibles:', listErr);
    // Lanzar el último error conocido si existe, si no uno genérico
    if (lastError) throw lastError;
    throw new Error('Falló la llamada a Gemini y no se pudo recuperar la lista de modelos.');
  }
}

/**
 * Obtiene un embedding para un texto usando el modelo de embeddings de Google.
 * Por defecto usa text-embedding-005.
 */
export async function getTextEmbedding(text: string, {
  model,
}: { model?: string } = {}): Promise<{ embedding: number[]; modelUsed: string }> {
  const apiKey = getGeminiApiKey();
  // Estrategia de fallback:
  // - Modelos preferidos: text-embedding-004, text-embedding-005, embedding-001 (legacy)
  // - Versiones API: v1 (preferida), v1beta (fallback)
  // - Métodos: embedContent (preferido), embedText (fallback para modelos legacy)
  const modelCandidates = [
    model || 'text-embedding-004',
    'text-embedding-005',
    'embedding-001',
  ];
  const apiVersions = ['v1', 'v1beta'];
  const methods = [
    { name: 'embedContent', body: (t: string) => ({ content: { parts: [{ text: t }] } }) },
    { name: 'embedText', body: (t: string) => ({ text: t }) },
  ];

  let lastErr: string | null = null;

  for (const ver of apiVersions) {
    const baseUrl = `https://generativelanguage.googleapis.com/${ver}/models`;
    for (const m of modelCandidates) {
      for (const method of methods) {
        try {
          const url = `${baseUrl}/${m}:${method.name}?key=${apiKey}`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(method.body(text)),
          });
          if (!resp.ok) {
            const errText = await resp.text();
            lastErr = `[${ver}] ${m}:${method.name} -> ${resp.status} ${errText.slice(0, 300)}`;
            console.warn('[Embedding] Intento fallido:', lastErr);
            // Si 404, probar siguiente combinación
            if (resp.status === 404) continue;
            // Si 400 por método, continuar con siguiente método
            if (resp.status === 400) continue;
            // Otros errores: intentar siguiente candidato
            continue;
          }
          const data = await resp.json() as any;
          const vector = (data?.embedding?.values || data?.embedding || data?.vector) as number[] | undefined;
          if (!Array.isArray(vector) || vector.length === 0) {
            lastErr = `[${ver}] ${m}:${method.name} -> vector vacío`;
            console.warn('[Embedding] Vector vacío con', m, 'en', ver, 'método', method.name);
            continue;
          }
          return { embedding: vector, modelUsed: `${m}@${ver}` };
        } catch (e: any) {
          lastErr = `${m}:${method.name} error ${(e?.message || String(e)).slice(0, 200)}`;
          console.warn('[Embedding] Excepción en intento:', lastErr);
          continue;
        }
      }
    }
  }

  // Como diagnóstico final, listar modelos disponibles (truncado)
  try {
    const listV1 = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const listText = await listV1.text();
    console.error('[Embedding] Ningún candidato funcionó. ListModels v1 (truncado):', listText.slice(0, 1500));
  } catch {}
  try {
    const listV1b = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listText = await listV1b.text();
    console.error('[Embedding] ListModels v1beta (truncado):', listText.slice(0, 1500));
  } catch {}

  throw new Error(`No se pudo obtener embedding. Último error: ${lastErr || 'desconocido'}`);
}

/**
 * Cloud Function onCall para solicitud general a Gemini.
 * @return {Promise<object>} Objeto con resultado, respuesta IA y metadata.
 */
export const callGeminiAI = onCall({ 
  secrets: [geminiApiKey]
}, async (request) => {
  isAuthenticated(request);
  const {prompt, context, module} = request.data;
  if (!prompt) {
    throw new HttpsError("invalid-argument", "El prompt es requerido.");
  }
  const composedPrompt =
    "Contexto del módulo: " + (module || "General") + "\n" +
    (context ? "Información adicional: " + context + "\n" : "") +
    "Prompt del usuario: " + prompt + "\n\n" +
    "Por favor, proporciona una respuesta útil y educativa.";
  try {
    const { text: aiResponseText, modelUsed } = await callGemini({prompt: composedPrompt});
    console.log(
      "IA utilizada en módulo: " +
      module +
      " por usuario: " +
      request.auth?.token?.email,
    );
    return {
      success: true,
      response: aiResponseText,
      modelUsed,
      module: module,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error llamando a Gemini AI:", error);
    throw new HttpsError("internal", "Error interno del servidor de IA.");
  }
});