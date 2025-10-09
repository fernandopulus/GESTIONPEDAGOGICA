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
import { auth } from '../firebase';

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
  const uid = auth.currentUser?.uid;
  // Dos consultas: por email y por uid, para cubrir ambos caminos de las reglas
  const unsubs: Array<() => void> = [];
  const combined = new Map<string, AsistenciaDual>();
  const emit = () => callback(Array.from(combined.values()));

  const qEmail = query(
    collection(db, ASISTENCIA_COLLECTION),
    where('emailEstudiante', '==', studentEmail),
    orderBy('fechaHora', 'desc')
  );
  unsubs.push(onSnapshot(qEmail, (querySnapshot) => {
    querySnapshot.docs.forEach(d => combined.set(d.id, convertFirestoreDoc<AsistenciaDual>(d)));
    emit();
  }, (error) => {
    if (error?.code !== 'permission-denied') {
      console.error("Error subscribing to personal attendance (email):", error);
    }
  }));

  if (uid) {
    const qUid = query(
      collection(db, ASISTENCIA_COLLECTION),
      where('estudianteId', '==', uid),
      orderBy('fechaHora', 'desc')
    );
    unsubs.push(onSnapshot(qUid, (querySnapshot) => {
      querySnapshot.docs.forEach(d => combined.set(d.id, convertFirestoreDoc<AsistenciaDual>(d)));
      emit();
    }, (error) => {
      if (error?.code !== 'permission-denied') {
        console.error("Error subscribing to personal attendance (uid):", error);
      }
    }));
  }

  return () => unsubs.forEach(u => u());
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
