// src/firebaseHelpers/asistenciaEmpresaHelper.ts
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config'; // Make sure the path to your config is correct
import { AsistenciaDual } from '../../types';

// --- COLLECTION CONSTANTS ---
const ASISTENCIA_COLLECTION = 'asistencia_dual';

// --- DATA CONVERSION HELPER ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    // Convert Firestore Timestamps to ISO strings for consistency
    fechaHora: data.fechaHora?.toDate?.().toISOString() || data.fechaHora,
  } as T;
};

// --- REAL-TIME SUBSCRIPTIONS ---

/**
 * Subscribes to the personal attendance history for a specific student.
 * @param studentEmail The email of the student to fetch records for.
 * @param callback The function to call with the updated attendance records.
 * @returns A function to unsubscribe from the listener.
 */
export const subscribeToPersonalAsistencia = (studentEmail: string, callback: (data: AsistenciaDual[]) => void) => {
  const q = query(
    collection(db, ASISTENCIA_COLLECTION),
    where('emailEstudiante', '==', studentEmail),
    orderBy('fechaHora', 'desc')
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const records = querySnapshot.docs.map(doc => convertFirestoreDoc<AsistenciaDual>(doc));
    callback(records);
  }, (error) => {
    console.error("Error subscribing to personal attendance:", error);
    callback([]);
  });

  return unsubscribe;
};

// --- DATA WRITING FUNCTIONS ---

/**
 * Adds a new attendance record to Firestore.
 * @param record The attendance record to add.
 */
export const addAsistenciaRecord = async (record: Omit<AsistenciaDual, 'id'>): Promise<void> => {
    try {
        const dataToSend = {
            ...record,
            fechaHora: Timestamp.fromDate(new Date(record.fechaHora)),
        };
        await addDoc(collection(db, ASISTENCIA_COLLECTION), dataToSend);
    } catch (error) {
        console.error("Error adding attendance record:", error);
        throw new Error("Could not save the attendance record.");
    }
};
