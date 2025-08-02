import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Inicializa la app de admin para tener acceso a los servicios de Firebase
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// Función para verificar si el que llama es un Subdirector
const esSubdirector = (context: functions.https.CallableContext) => {
  if (context.auth?.token.profile !== "SUBDIRECCION") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No tienes permiso para realizar esta acción."
    );
  }
};

/**
 * Crea un usuario en Auth y un documento en Firestore.
 */
export const createUser = functions.https.onCall(async (data, context) => {
  esSubdirector(context);

  const {email, password, nombreCompleto, profile, ...otrosDatos} = data;
  if (!email || !nombreCompleto || !profile) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Faltan datos requeridos."
    );
  }

  try {
    const userRecord = await auth.createUser({
      email,
      password: password || "recoleta", // Contraseña por defecto
      displayName: nombreCompleto,
    });

    const userData = {email, nombreCompleto, profile, ...otrosDatos};
    await db.collection("usuarios").doc(email).set(userData);

    return {status: "success", uid: userRecord.uid};
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    throw new functions.https.HttpsError("unknown", errorMessage);
  }
});

/**
 * Actualiza un usuario en Auth y en Firestore.
 */
export const updateUser = functions.https.onCall(async (data, context) => {
  esSubdirector(context);

  const {email, password, ...datosParaActualizar} = data;
  if (!email) {
    throw new functions.https.HttpsError(
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

    await db.collection("usuarios").doc(email).update(datosParaActualizar);

    return {status: "success"};
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    throw new functions.https.HttpsError("unknown", errorMessage);
  }
});

/**
 * Elimina un usuario de Auth y de Firestore.
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
  esSubdirector(context);

  const {email} = data;
  if (!email) {
    throw new functions.https.HttpsError(
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
    throw new functions.https.HttpsError("unknown", errorMessage);
  }
});
