import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { callGemini } from './aiHelpers';

// Inicializa Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// =================================================================
// INICIO: CÓDIGO CORREGIDO PARA LA FUNCIÓN DE IA
// =================================================================

// El secreto GEMINI_API_KEY se declara en la configuración de la función
// mediante 'secrets' en onCall. No es necesario leerlo aquí.

// Definición de tu función en la nube 'callGeminiAI'
export const callGeminiAI = onCall({
  secrets: ["GEMINI_API_KEY"], // Declara el secreto aquí
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
    // Construir prompt a partir del contexto (manteniendo compatibilidad)
    const prompt = `
Genera una retroalimentación pedagógica detallada y un resumen de observaciones basado en estos datos del acompañamiento docente:

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

Por favor genera una retroalimentación con tono técnico pedagógico, clara y constructiva, con la siguiente estructura:
1. INTRODUCCIÓN: Contextualización del acompañamiento
2. FORTALEZAS OBSERVADAS: Aspectos destacados del desempeño docente
3. OPORTUNIDADES DE MEJORA: Áreas a desarrollar
4. RECOMENDACIONES ESPECÍFICAS: Estrategias concretas para implementar
5. CONCLUSIÓN: Síntesis y próximos pasos

La retroalimentación debe ser profesional, constructiva y orientada al desarrollo profesional docente.`;

    // Usar helper centralizado que prioriza gemini-2.5-pro
    const { text: aiResponseText, modelUsed } = await callGemini({
      prompt,
      mode: 'standard',
      config: { maxOutputTokens: 2048, temperature: 0.7, topK: 40, topP: 0.95 }
    });

    if (!aiResponseText) {
      throw new Error("La respuesta de la IA no contiene texto.");
    }

    return { response: aiResponseText, modelUsed };
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
  res.redirect(`https://plania-clase.web.app/?auth=success&userId=${userId}&module=materialesDidacticos`);
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
    let tokenDoc = await admin.firestore()
      .collection('userTokens')
      .doc(userId)
      .get();
    
    let isAuthorized = tokenDoc.exists && tokenDoc.data()?.access_token;
    
    // Si no encuentra tokens con el userId, buscar por email como fallback
    // (para usuarios que fueron autorizados cuando se usaba email como ID)
    if (!isAuthorized) {
      const tokenQuery = await admin.firestore()
        .collection('userTokens')
        .get();
      
      for (const doc of tokenQuery.docs) {
        const data = doc.data();
        if (data?.access_token && doc.id.includes('@')) {
          // Migrar tokens al documento correcto
          await admin.firestore()
            .collection('userTokens')
            .doc(userId)
            .set(data);
          isAuthorized = true;
          break;
        }
      }
    }
    
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

/**
 * Cambio masivo de contraseñas por perfil y (opcional) curso si son estudiantes.
 * Requiere claim SUBDIRECCION.
 */
export const bulkUpdatePasswords = onCall(async (request) => {
  esSubdirector(request);

  const { newPassword, profile, curso } = request.data || {};

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    throw new HttpsError(
      "invalid-argument",
      "La nueva contraseña es obligatoria y debe tener al menos 6 caracteres."
    );
  }

  if (!profile || typeof profile !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "El perfil es obligatorio."
    );
  }

  try {
    // Query base por perfil
    let queryRef: admin.firestore.Query = db.collection("usuarios").where("profile", "==", profile);
    // Si es estudiante y se indicó curso, filtrar por curso exacto
    if (profile === "ESTUDIANTE" && typeof curso === "string" && curso.trim() !== "") {
      queryRef = queryRef.where("curso", "==", curso);
    }

    const snap = await queryRef.get();
    if (snap.empty) {
      return { matched: 0, processed: 0, updated: 0, failed: 0, errors: [] as Array<{ email: string; error: string }> };
    }

    // Límite defensivo
    const docs = snap.docs.slice(0, 500);
    const errors: Array<{ email: string; error: string }> = [];
    let updated = 0;

    for (const d of docs) {
      const data = d.data() as any;
      const email = data?.email;
      if (!email) {
        errors.push({ email: "(sin email)", error: "Documento sin email" });
        continue;
      }
      try {
        const userRecord = await auth.getUserByEmail(email);
        await auth.updateUser(userRecord.uid, { password: newPassword });
        updated += 1;
      } catch (e: any) {
        errors.push({ email, error: e?.message || String(e) });
      }
    }

    return {
      matched: snap.size,
      processed: docs.length,
      updated,
      failed: errors.length,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    throw new HttpsError("unknown", errorMessage);
  }
});

// Función de prueba para Gemini
export {testGemini} from "./testGemini";

// Función para generar preguntas SIMCE
export {generarPreguntasSimce} from "./simceGenerator";

// Notificaciones por correo de Multicopias
export * from './triggers/multicopiasEmail';

// Funciones para generar evaluaciones con IA
export {
  generarRubricaConGemini,
  generarDescriptorDimensionConGemini,
  generarPruebaConGemini,
  generarPruebaConGeminiHttp,
} from "./evaluacionAprendizajes";

export { api } from "./api";

// Exportar función genérica de IA basada en secreto (sin App Check)
export { callGeminiAI as callGeminiGeneric } from './aiHelpers';
