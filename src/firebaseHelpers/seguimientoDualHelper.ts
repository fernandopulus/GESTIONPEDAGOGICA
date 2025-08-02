// src/firebaseHelpers/seguimientoDualHelper.ts
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  writeBatch,
  getDocs,
  where,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { SeguimientoDualRecord } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const SEGUIMIENTO_DUAL_COLLECTION = 'seguimiento_dual_records';

// --- HELPERS DE CONVERSIÓN ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  // Función para convertir Timestamps a strings de fecha YYYY-MM-DD si existen
  const convertTimestampToDateString = (timestamp: any) => {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString().split('T')[0];
    }
    return timestamp;
  };

  return {
    id: docSnapshot.id,
    ...data,
    fechaDesvinculacion: convertTimestampToDateString(data.fechaDesvinculacion),
    fecha1raSupervision1erSemestre: convertTimestampToDateString(data.fecha1raSupervision1erSemestre),
    fecha2daSupervision1erSemestre: convertTimestampToDateString(data.fecha2daSupervision1erSemestre),
    fecha1raSupervision2doSemestre: convertTimestampToDateString(data.fecha1raSupervision2doSemestre),
    fecha2daSupervision2doSemestre: convertTimestampToDateString(data.fecha2daSupervision2doSemestre),
    fechaSupervisionExcepcional: convertTimestampToDateString(data.fechaSupervisionExcepcional),
  } as T;
};

// --- GESTIÓN DE REGISTROS DE SEGUIMIENTO ---

export const subscribeToSeguimientoDual = (callback: (data: SeguimientoDualRecord[]) => void) => {
  const q = query(collection(db, SEGUIMIENTO_DUAL_COLLECTION), orderBy('nombreEstudiante', 'asc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const records = querySnapshot.docs.map(doc => convertFirestoreDoc<SeguimientoDualRecord>(doc));
    callback(records);
  }, (error) => {
    console.error("Error al suscribirse a los registros de seguimiento:", error);
    callback([]);
  });

  return unsubscribe;
};

const convertDatesToTimestamps = (data: any) => {
    const newData = { ...data };
    const dateFields = [
        'fechaDesvinculacion', 'fecha1raSupervision1erSemestre', 'fecha2daSupervision1erSemestre',
        'fecha1raSupervision2doSemestre', 'fecha2daSupervision2doSemestre', 'fechaSupervisionExcepcional'
    ];
    dateFields.forEach(field => {
        if (newData[field] && typeof newData[field] === 'string') {
            newData[field] = Timestamp.fromDate(new Date(newData[field] + 'T00:00:00'));
        }
    });
    return newData;
};

export const createSeguimientoRecord = async (recordData: Omit<SeguimientoDualRecord, 'id'>): Promise<string> => {
  try {
    const dataToSend = convertDatesToTimestamps(recordData);
    const docRef = await addDoc(collection(db, SEGUIMIENTO_DUAL_COLLECTION), dataToSend);
    return docRef.id;
  } catch (error) {
    console.error("Error al crear el registro:", error);
    throw new Error("No se pudo crear el registro de seguimiento.");
  }
};

export const updateSeguimientoRecord = async (recordId: string, data: Partial<SeguimientoDualRecord>): Promise<void> => {
    try {
        const docRef = doc(db, SEGUIMIENTO_DUAL_COLLECTION, recordId);
        const dataToSend = convertDatesToTimestamps(data);
        await setDoc(docRef, dataToSend, { merge: true });
    } catch (error) {
        console.error("Error al actualizar el registro:", error);
        throw new Error("No se pudo actualizar el registro.");
    }
};

export const deleteSeguimientoRecord = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, SEGUIMIENTO_DUAL_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error al eliminar el registro:", error);
        throw new Error("No se pudo eliminar el registro.");
    }
};

/**
 * Procesa una carga masiva de registros, actualizando existentes y creando nuevos.
 */
export const batchUpdateSeguimiento = async (newRecords: Omit<SeguimientoDualRecord, 'id'>[]): Promise<{ updated: number, created: number }> => {
    const batch = writeBatch(db);
    const collectionRef = collection(db, SEGUIMIENTO_DUAL_COLLECTION);
    
    let updated = 0;
    let created = 0;

    for (const record of newRecords) {
        // Busca si ya existe un registro con el mismo RUT de estudiante
        const q = query(collectionRef, where('rutEstudiante', '==', record.rutEstudiante));
        const existingDocs = await getDocs(q);

        if (!existingDocs.empty) {
            // Si existe, actualiza el primer documento encontrado
            const docId = existingDocs.docs[0].id;
            const docRef = doc(db, SEGUIMIENTO_DUAL_COLLECTION, docId);
            batch.set(docRef, convertDatesToTimestamps(record), { merge: true });
            updated++;
        } else {
            // Si no existe, crea un nuevo documento
            const newDocRef = doc(collectionRef);
            batch.set(newDocRef, convertDatesToTimestamps(record));
            created++;
        }
    }

    await batch.commit();
    return { updated, created };
};
