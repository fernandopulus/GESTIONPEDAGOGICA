import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
// *** INICIO DE LA CORRECCIÓN: Se cambia el paquete de IA ***
import {GoogleGenerativeAI} from "@google/generative-ai";
import {defineString} from "firebase-functions/params";
// *** FIN DE LA CORRECCIÓN ***

// Inicializa Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// =================================================================
// INICIO: CÓDIGO CORREGIDO PARA LA FUNCIÓN DE IA
// =================================================================

// Define un parámetro secreto para la API Key de Gemini.
// Deberás configurar este valor en tu proyecto de Firebase.
const geminiApiKey = defineString("GEMINI_API_KEY");

// Definición de tu función en la nube 'callGeminiAI'
export const callGeminiAI = onCall({
  enforceAppCheck: true, // Habilita la seguridad de App Check
  timeoutSeconds: 120, // Aumenta el tiempo de espera a 2 minutos
}, async (request: CallableRequest) => {
  // Verifica que la llamada provenga de una aplicación verificada.
  if (request.app == undefined) {
    throw new HttpsError(
      "failed-precondition",
      "La función debe ser llamada desde una app verificada por App Check.",
    );
  }

  // Extrae el objeto 'contexto' enviado desde tu aplicación.
  const {contexto} = request.data;

  // Valida que el objeto 'contexto' exista y no esté vacío.
  if (!contexto) {
    throw new HttpsError(
      "invalid-argument",
      "La función debe ser llamada con un objeto 'contexto' con datos.",
    );
  }

  try {
    // *** NUEVA LÓGICA DE INICIALIZACIÓN Y LLAMADA ***
    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({model: "gemini-pro"});

    // El prompt se construye aquí en el servidor
    const prompt = `
Genera una retroalimentación pedagógica detallada y un resumen de 
observaciones basado en estos datos del acompañamiento docente:

DATOS DEL ACOMPAÑAMIENTO:
- Docente: ${contexto.docente}
- Curso: ${contexto.curso}
- Asignatura: ${contexto.asignatura}
- Fecha: ${contexto.fecha}
- Bloques horarios: ${contexto.bloques}

RESULTADOS DE RÚBRICA:
${contexto.rubricaResultados}

OBSERVACIONES GENERALES:
${contexto.observacionesGenerales}

Por favor genera una retroalimentación con tono técnico pedagógico, clara y 
constructiva, con la siguiente estructura:
1. INTRODUCCIÓN: Contextualización del acompañamiento
2. FORTALEZAS OBSERVADAS: Aspectos destacados del desempeño docente
3. OPORTUNIDADES DE MEJORA: Áreas a desarrollar
4. RECOMENDACIONES ESPECÍFICAS: Estrategias concretas para implementar
5. CONCLUSIÓN: Síntesis y próximos pasos

La retroalimentación debe ser profesional, constructiva y orientada al 
desarrollo profesional docente.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();

    if (!responseText) {
      throw new Error("La respuesta de la IA no contiene texto.");
    }

    return {response: responseText};
  } catch (error) {
    console.error("Error al llamar a la API de Gemini:", error);
    throw new HttpsError(
      "internal",
      "Error interno del servidor de IA.",
      error,
    );
  }
});

// =================================================================
// FIN: CÓDIGO CORREGIDO PARA LA FUNCIÓN DE IA
// =================================================================

// =================================================================
// NOTA: La función para generar presentaciones se ha movido al archivo
// materialesDidacticos.ts y se importa a continuación
// =================================================================

import {generateSlides} from "./materialesDidacticos";
import {onRequest} from "firebase-functions/v2/https";
import {SlidesIntegration} from "./slidesIntegration";

export {generateSlides};

// Inicializar el servicio de integración con Google Slides
const slidesIntegration = new SlidesIntegration();

// Función para manejar el callback de OAuth de Google
export const oauthCallback = onRequest({
  timeoutSeconds: 60,
  cors: true,
}, async (req, res) => {
  try {
    const {code, state} = req.query;
    
    if (!code || !state) {
      throw new Error("Parámetros de callback incompletos");
    }
    
    // Procesar el callback con nuestro nuevo servicio de integración
    const userId = await slidesIntegration.handleOAuthCallback(
      code.toString(),
      state.toString()
    );
    
    // Redirigir al usuario de vuelta a la aplicación
    res.redirect(`/auth/callback?auth=success&userId=${userId}`);
  } catch (error: any) {
    console.error("Error en el callback de OAuth:", error);
    res.status(500).send(`Error en la autorización: ${error.message}`);
  }
});

// Función para obtener la URL de autorización de Google
export const slidesAuthorize = onRequest({
  timeoutSeconds: 30,
  cors: true,
}, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      throw new Error("Se requiere el ID de usuario para autorizar");
    }
    
    const authUrl = slidesIntegration.getAuthorizationUrl(userId.toString());
    
    // Si es una solicitud GET, redirigir directamente
    if (req.method === 'GET') {
      res.redirect(authUrl);
      return;
    }
    
    // Si es otra solicitud, devolver la URL como JSON
    res.json({ success: true, url: authUrl });
  } catch (error: any) {
    console.error("Error al generar URL de autorización:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al generar URL de autorización"
    });
  }
});

// Función para verificar el estado de autorización de Google Slides
export const checkGoogleSlidesAuth = onRequest({
  timeoutSeconds: 30,
  cors: true,
}, async (req, res) => {
  try {
    // Verificar autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Token de autorización requerido'
      });
      return;
    }
    
    const token = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;
    
    // Verificar si el usuario tiene tokens de OAuth almacenados
    const tokenDoc = await admin.firestore()
      .collection('userTokens')
      .doc(userId)
      .get();
    
    const isAuthorized = tokenDoc.exists && tokenDoc.data()?.access_token;
    
    res.json({
      success: true,
      isAuthorized,
      message: isAuthorized 
        ? 'Usuario autorizado para Google Slides'
        : 'Usuario no ha autorizado Google Slides'
    });
  } catch (error: any) {
    console.error("Error al verificar autorización:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al verificar autorización"
    });
  }
});

// =================================================================
// FIN: IMPORTACIÓN DE LA FUNCIÓN PARA GENERAR PRESENTACIONES
// =================================================================

// --- TUS FUNCIONES EXISTENTES (SIN CAMBIOS) ---

const esSubdirector = (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La función debe ser llamada por un usuario autenticado."
    );
  }
  if (request.auth.token?.profile !== "SUBDIRECCION") {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para realizar esta acción."
    );
  }
};

export const addCustomClaim = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La función debe ser llamada por un usuario autenticado."
    );
  }

  const {email, profile} = request.data;
  if (!email || !profile) {
    throw new HttpsError(
      "invalid-argument",
      "Email y profile son requeridos."
    );
  }

  try {
    const userDoc = await db.collection("usuarios").doc(email).get();
    if (!userDoc.exists || userDoc.data()?.profile !== "SUBDIRECCION") {
      throw new HttpsError(
        "permission-denied",
        "Solo usuarios con perfil SUBDIRECCION pueden obtener custom claims."
      );
    }

    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, {profile: profile});

    console.log(`Custom claim agregado: ${email} -> ${profile}`);
    return {status: "success", message: "Custom claim agregado exitosamente"};
  } catch (error) {
    console.error("Error al agregar custom claim:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    throw new HttpsError("unknown", errorMessage);
  }
});

export const createUser = onCall(async (request) => {
  esSubdirector(request);

  const {email, password, nombreCompleto, profile, ...otrosDatos} =
    request.data;
  if (!email || !nombreCompleto || !profile) {
    throw new HttpsError(
      "invalid-argument",
      "Faltan datos requeridos."
    );
  }

  try {
    const userRecord = await auth.createUser({
      email,
      password: password || "recoleta",
      displayName: nombreCompleto,
    });

    await auth.setCustomUserClaims(userRecord.uid, {profile: profile});

    const userData = {email, nombreCompleto, profile, ...otrosDatos};
    await db.collection("usuarios").doc(email).set(userData);

    return {status: "success", uid: userRecord.uid};
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    throw new HttpsError("unknown", errorMessage);
  }
});

export const updateUser = onCall(async (request) => {
  esSubdirector(request);

  const {email, password, profile, ...datosParaActualizar} = request.data;
  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "El email es requerido para actualizar."
    );
  }

  try {
    const user = await auth.getUserByEmail(email);
    const updatePayload: {password?: string; displayName?: string} = {};

    if (password) {
      updatePayload.password = password;
    }
    if (datosParaActualizar.nombreCompleto) {
      updatePayload.displayName = datosParaActualizar.nombreCompleto;
    }

    if (Object.keys(updatePayload).length > 0) {
      await auth.updateUser(user.uid, updatePayload);
    }

    if (profile) {
      await auth.setCustomUserClaims(user.uid, {profile: profile});
    }

    await db.collection("usuarios").doc(email).update({
      profile,
      ...datosParaActualizar,
    });

    return {status: "success"};
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    throw new HttpsError("unknown", errorMessage);
  }
});

export const deleteUser = onCall(async (request) => {
  esSubdirector(request);

  const {email} = request.data;
  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "El email es requerido para eliminar."
    );
  }

  try {
    const user = await auth.getUserByEmail(email);
    await auth.deleteUser(user.uid);
    await db.collection("usuarios").doc(email).delete();

    return {status: "success"};
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    throw new HttpsError("unknown", errorMessage);
  }
});
