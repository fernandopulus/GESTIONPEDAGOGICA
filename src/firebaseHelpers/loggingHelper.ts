// src/firebaseHelpers/loggingHelper.ts
import {
  collection,
  addDoc,
  Timestamp,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate que la ruta a tu config sea correcta
import { ApiCallLog, User } from '../../types';

const LOGS_COLLECTION = 'api_logs';

/**
 * Registra una llamada a la API en una colección dedicada en Firestore.
 * @param moduleName El nombre del módulo que origina la llamada.
 * @param user El objeto del usuario que realiza la llamada.
 */
export const logApiCallToFirestore = async (moduleName: string, user: User): Promise<void> => {
  try {
    const newLog = {
      module: moduleName,
      userId: user.id,
      userEmail: user.email,
      userName: user.nombreCompleto, // Guardar también el nombre para fácil visualización
      timestamp: Timestamp.fromDate(new Date()),
    };
    // Simplemente añade el nuevo registro. No es necesario gestionar el límite aquí.
    await addDoc(collection(db, LOGS_COLLECTION), newLog);
  } catch (error) {
    console.error("Error al registrar la llamada a la API en Firestore:", error);
    // Es una tarea de fondo, por lo que no lanzamos un error para no interrumpir al usuario.
  }
};

/**
 * Se suscribe a los registros de llamadas a la API en tiempo real.
 * @param callback La función que se ejecutará con los datos actualizados.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToApiLogs = (callback: (data: ApiCallLog[]) => void) => {
    // Ordena por fecha y limita la lectura a los últimos 200 para optimizar
    const q = query(collection(db, LOGS_COLLECTION), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const logs = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate?.().toISOString() || data.timestamp,
            } as ApiCallLog;
        });
        callback(logs);
    }, (error) => {
        console.error("Error al suscribirse a los logs de API:", error);
        callback([]);
    });

    return unsubscribe;
};
