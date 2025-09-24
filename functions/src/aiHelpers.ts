import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {defineString} from "firebase-functions/params";

const geminiApiKey = defineString("GEMINI_API_KEY");

/**
 * Obtiene la API Key de Gemini desde variables de entorno.
 * @return {string} API Key de Gemini.
 * @throws Error si no está definida la variable de entorno.
 */
const getGeminiApiKey = (): string => {
  const key = geminiApiKey.value();
  if (!key) {
    throw new Error("Falta la clave de Gemini en las variables de entorno (GEMINI_API_KEY).");
  }
  return key;
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
}: {
  prompt: string,
  config?: Record<string, unknown>,
}): Promise<string> {
  const apiKey = getGeminiApiKey();
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    "gemini-1.5-pro-latest:generateContent?key=" + apiKey;

  const fetchResponse = await fetch(
    url,
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        contents: [{parts: [{text: prompt}]}],
        generationConfig: config || {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    },
  );

  if (!fetchResponse.ok) {
    throw new Error("API Error: " + fetchResponse.status);
  }
  const data = await fetchResponse.json();
  // Log de depuración: mostrar el objeto completo de la respuesta
  console.log("[DEBUG] Respuesta completa de Gemini:", data);
  // Obtener el texto completo de la respuesta
  let responseText = "";
  if (typeof data === "string") {
    responseText = data;
  } else if (
    typeof data === "object" &&
    data !== null &&
    "candidates" in data &&
    Array.isArray((data as any).candidates) &&
    (data as any).candidates.length > 0 &&
    (data as any).candidates[0].content &&
    Array.isArray((data as any).candidates[0].content.parts) &&
    (data as any).candidates[0].content.parts.length > 0
  ) {
    // Gemini puede devolver candidates
    responseText = (data as any).candidates[0].content.parts[0].text || "";
  }
  // Log de depuración: mostrar el texto extraído
  console.log("[DEBUG] Texto extraído de Gemini:", responseText);
  if (!responseText || responseText.length < 10) {
    console.error("[ERROR] La respuesta de la IA está vacía o truncada:", responseText);
    throw new Error("La respuesta de la IA no contiene texto o está incompleta.");
  }
  return responseText;
}

/**
 * Cloud Function onCall para solicitud general a Gemini.
 * @return {Promise<object>} Objeto con resultado, respuesta IA y metadata.
 */
export const callGeminiAI = onCall(async (request) => {
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
    const aiResponse = await callGemini({prompt: composedPrompt});
    console.log(
      "IA utilizada en módulo: " +
      module +
      " por usuario: " +
      request.auth?.token?.email,
    );
    return {
      success: true,
      response: aiResponse,
      module: module,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error llamando a Gemini AI:", error);
    throw new HttpsError("internal", "Error interno del servidor de IA.");
  }
});
