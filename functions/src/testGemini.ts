/**
 * Función de prueba para verificar conectividad con Gemini AI
 */
import { defineSecret } from "firebase-functions/params";
import { onCall } from "firebase-functions/v2/https";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const testGemini = onCall({ 
  secrets: [geminiApiKey],
  enforceAppCheck: false,
  maxInstances: 10
}, async (request) => {
  console.log('🧪 Iniciando prueba de Gemini API...');
  
  try {
    const apiKey = geminiApiKey.value();
    console.log('🔑 API Key configurada:', apiKey ? 'SÍ' : 'NO');
    
    if (!apiKey) {
      return {
        success: false,
        error: 'API Key de Gemini no configurada',
        details: 'Falta GEMINI_API_KEY en la configuración'
      };
    }
    
    console.log('🤖 Enviando prompt de prueba...');
    
    const prompt = `
    Responde con un JSON válido que contenga exactamente esto:
    {
      "status": "success",
      "message": "Gemini 1.5 Pro funcionando correctamente",
      "timestamp": "${new Date().toISOString()}"
    }
    `;

    // Primero probamos listar los modelos disponibles
    const listModelsUrl = "https://generativelanguage.googleapis.com/v1beta/models";
    console.log('📋 Listando modelos disponibles...');
    const listModelsResponse = await fetch(`${listModelsUrl}?key=${apiKey}`);
    console.log('📋 Estado de la respuesta:', listModelsResponse.status);
    const listModelsText = await listModelsResponse.text();
    console.log('📋 Respuesta:', listModelsText);

    // Si se solicita explícitamente, devolver la lista de modelos para diagnóstico
    if (request && (request as any).data && (request as any).data.action === 'listModels') {
      try {
        const parsed = JSON.parse(listModelsText);
        return { success: true, models: parsed };
      } catch (e) {
        return { success: true, rawModels: listModelsText };
      }
    }

  // Usar v1beta para los modelos que requieren esa versión y un modelo disponible que soporte generateContent
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
  // Alternativa más barata/rápida (flash):
  // const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const fetchResponse = await fetch(
      `${url}?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: prompt }] } // añade role en v1
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.text();
      console.error('❌ Error de API:', {
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        error: errorData
      });
      throw new Error(`Error en API Gemini (${fetchResponse.status}): ${errorData}`);
    }

    const data = await fetchResponse.json() as GeminiResponse;
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      console.error('❌ No se recibió respuesta de texto válida');
      return {
        success: false,
        error: 'No se recibió respuesta de texto válida',
        rawResponse: data
      };
    }
    
    console.log('📝 Respuesta recibida:', responseText.substring(0, 200));
    
    // Intentar parsear la respuesta
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          geminiResponse: parsed,
          rawResponse: responseText,
  model: 'gemini-2.5-pro'
        };
      } else {
        return {
          success: false,
          error: 'No se encontró JSON en la respuesta',
          rawResponse: responseText
        };
      }
    } catch (parseError) {
      return {
        success: false,
        error: 'Error al parsear JSON',
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
        rawResponse: responseText
      };
    }
    
  } catch (error) {
    console.error('❌ Error en prueba de Gemini:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      details: error instanceof Error ? error.stack : undefined
    };
  }
});
