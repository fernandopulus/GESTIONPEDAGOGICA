/**
 * Función de prueba para verificar conectividad con Gemini AI
 */
import { defineString } from "firebase-functions/params";
import { onCall } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = defineString("GEMINI_API_KEY");

export const testGemini = onCall(async (request) => {
  console.log('🧪 Iniciando prueba de Gemini API...');
  
  try {
    const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;
    console.log('🔑 API Key configurada:', apiKey ? 'SÍ' : 'NO');
    
    if (!apiKey) {
      return {
        success: false,
        error: 'API Key de Gemini no configurada',
        details: 'Falta GEMINI_API_KEY en la configuración'
      };
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    console.log('🤖 Modelo cargado, enviando prompt de prueba...');
    
    const prompt = `
    Responde con un JSON válido que contenga exactamente esto:
    {
      "status": "success",
      "message": "Gemini 1.5 Pro funcionando correctamente",
      "timestamp": "${new Date().toISOString()}"
    }
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
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
          model: 'gemini-1.5-pro'
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
