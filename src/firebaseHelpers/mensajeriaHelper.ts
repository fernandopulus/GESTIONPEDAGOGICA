// src/firebaseHelpers/mensajeriaHelper.ts
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  setDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { MensajeInterno, User, ReadStatus, Profile } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const MESSAGES_COLLECTION = 'mensajes_internos';
const USERS_COLLECTION = 'usuarios';
const READ_STATUS_COLLECTION = 'mensajes_read_status';

// --- HELPERS DE CONVERSIÓN ---

const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    // Convierte Timestamps de Firestore a strings ISO si existen
    fecha: data.fecha?.toDate?.().toISOString() || data.fecha,
  } as T;
};

// --- GESTIÓN DE MENSAJES ---

/**
 * Se suscribe a los mensajes donde el usuario actual es participante (emisor o receptor).
 * @param currentUserEmail El email del usuario logueado.
 * @param callback Función a ejecutar con los mensajes actualizados.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToMessages = (currentUserEmail: string, callback: (data: MensajeInterno[]) => void) => {
  const q = query(
    collection(db, MESSAGES_COLLECTION),
    where('participants', 'array-contains', currentUserEmail),
    orderBy('fecha', 'desc')
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const messages = querySnapshot.docs.map(doc => convertFirestoreDoc<MensajeInterno>(doc));
    callback(messages);
  }, (error) => {
    console.error("Error al suscribirse a los mensajes:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Envía un nuevo mensaje guardándolo en Firestore.
 * @param messageData Datos del mensaje a enviar.
 */
export const sendMessage = async (messageData: Omit<MensajeInterno, 'id' | 'fecha'>): Promise<void> => {
  try {
    const dataToSend = {
      ...messageData,
      participants: [messageData.de, messageData.para], // Array para facilitar las queries
      fecha: Timestamp.fromDate(new Date()),
    };
    await addDoc(collection(db, MESSAGES_COLLECTION), dataToSend);
  } catch (error) {
    console.error("Error al enviar el mensaje:", error);
    throw new Error("No se pudo enviar el mensaje.");
  }
};

/**
 * Elimina un mensaje de Firestore.
 * @param messageId El ID del mensaje a eliminar.
 */
export const deleteMessage = async (messageId: string): Promise<void> => {
  try {
    const docRef = doc(db, MESSAGES_COLLECTION, messageId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error al eliminar el mensaje:", error);
    throw new Error("No se pudo eliminar el mensaje.");
  }
};

// --- GESTIÓN DE ESTADO DE LECTURA ---

/**
 * Se suscribe al estado de lectura de los mensajes del usuario.
 * @param userId El ID del usuario actual.
 * @param callback Función a ejecutar con los datos de lectura.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToReadStatus = (userId: string, callback: (data: ReadStatus) => void) => {
  const docRef = doc(db, READ_STATUS_COLLECTION, userId);

  const unsubscribe = onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as ReadStatus);
    } else {
      // Si no existe, devuelve un estado inicial vacío
      callback({ announcements: [], messages: [] });
    }
  }, (error) => {
    console.error("Error al suscribirse al estado de lectura:", error);
    callback({ announcements: [], messages: [] });
  });

  return unsubscribe;
};

/**
 * Marca un mensaje como leído para el usuario actual.
 * @param userId El ID del usuario.
 * @param messageId El ID del mensaje a marcar como leído.
 */
export const markMessageAsRead = async (userId: string, messageId: string): Promise<void> => {
    try {
        const docRef = doc(db, READ_STATUS_COLLECTION, userId);
        // arrayUnion se asegura de que no se añadan IDs duplicados.
        await setDoc(docRef, { messages: arrayUnion(messageId) }, { merge: true });
    } catch (error) {
        console.error("Error al marcar mensaje como leído:", error);
        throw new Error("No se pudo actualizar el estado de lectura.");
    }
};


// --- GESTIÓN DE USUARIOS ---

/**
 * Se suscribe a la lista completa de usuarios para el selector de destinatarios.
 */
export const subscribeToAllUsers = (callback: (data: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION), orderBy("nombreCompleto", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const users = querySnapshot.docs.map(doc => convertFirestoreDoc<User>(doc));
        callback(users);
    }, (error) => {
        console.error("Error al suscribirse a todos los usuarios:", error);
        callback([]);
    });

    return unsubscribe;
};
