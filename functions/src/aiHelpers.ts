import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";

/**
 * Obtiene la API Key de Gemini desde variables de entorno.
 * @return {string} API Key de Gemini.
 * @throws Error si no está definida la variable de entorno.
 */
const getGeminiApiKey = (): string => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Falta la clave de Gemini en variables de entorno.");
  }
  return process.env.GEMINI_API_KEY;
};

/**
 * Verifica que el usuario esté autenticado en la solicitud.
 * @param {CallableRequest} request
 * @throws HttpsError si el usuario no está autenticado.
 * @return {void}
 */
const isAuthenticated = (request: CallableRequest): void => {
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
async function callGemini({
  prompt,
  config,
}: {
  prompt: string,
  config?: Record<string, unknown>,
}): Promise<string> {
  const apiKey = getGeminiApiKey();
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    "gemini-1.5-flash-latest:generateContent?key=" + apiKey;

  const response = await fetch(
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

  if (!response.ok) {
    throw new Error("API Error: " + response.status);
  }
  const data = await response.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Lo siento, no pude generar una respuesta."
  );
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
