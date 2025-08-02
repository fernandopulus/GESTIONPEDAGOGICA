import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Inicializa la app de admin para tener acceso a los servicios de Firebase
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// Función para verificar si el que llama es un Subdirector
const esSubdirector = (request: CallableRequest) => {
  if (request.auth?.token?.profile !== "SUBDIRECCION") {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para realizar esta acción."
    );
  }
};

/**
 * Crea un usuario en Auth y un documento en Firestore.
 */
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
      password: password || "recoleta", // Contraseña por defecto
      displayName: nombreCompleto,
    });


    const userData = {email, nombreCompleto, profile, ...otrosDatos};
    await db.collection("usuarios").doc(email).set(userData);

    return {status: "success", uid: userRecord.uid};
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    throw new HttpsError("unknown", errorMessage);
  }
});


/**
 * Actualiza un usuario en Auth y en Firestore.
 */
export const updateUser = onCall(async (request) => {
  esSubdirector(request);

  const {email, password, ...datosParaActualizar} = request.data;
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

    await db.collection("usuarios").doc(email).update(datosParaActualizar);

    return {status: "success"};
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    throw new HttpsError("unknown", errorMessage);
  }
});

/**
 * Elimina un usuario de Auth y de Firestore.
 */
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
