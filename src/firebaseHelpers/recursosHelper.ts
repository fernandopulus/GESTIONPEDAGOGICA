// src/firebaseHelpers/recursosHelper.ts
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate de que la ruta a tu config sea correcta
import { CrosswordPuzzle, Timeline, MindMap, WordSearchPuzzle, User } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const CRUCIGRAMAS_COLLECTION = 'recursos_crucigramas';
const TIMELINES_COLLECTION = 'recursos_lineas_de_tiempo';
const MINDMAPS_COLLECTION = 'recursos_mapas_mentales';
const SOPAS_DE_LETRAS_COLLECTION = 'recursos_sopas_de_letras';


// --- HELPERS DE CONVERSIÓN ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.().toISOString() || data.fechaCreacion,
    createdAt: data.createdAt?.toDate?.().toISOString() || data.createdAt,
  } as T;
};

// --- GESTIÓN DE CRUCIGRAMAS ---

export const subscribeToCrucigramas = (callback: (data: CrosswordPuzzle[]) => void) => {
  const q = query(collection(db, CRUCIGRAMAS_COLLECTION), orderBy('fechaCreacion', 'desc'));
  
  return onSnapshot(q, (querySnapshot) => {
    const crucigramas = querySnapshot.docs.map(doc => convertFirestoreDoc<CrosswordPuzzle>(doc));
    callback(crucigramas);
  }, (error) => {
    console.error("Error al suscribirse a los crucigramas:", error);
    callback([]);
  });
};

export const saveCrucigrama = async (puzzleData: Omit<CrosswordPuzzle, 'id' | 'fechaCreacion'>, creador: User): Promise<string> => {
  try {
    const dataToSend = {
      ...puzzleData,
      creadorId: creador.id,
      creadorNombre: creador.nombreCompleto,
      fechaCreacion: Timestamp.fromDate(new Date()),
    };
    const docRef = await addDoc(collection(db, CRUCIGRAMAS_COLLECTION), dataToSend);
    return docRef.id;
  } catch (error) {
    console.error("Error al guardar el crucigrama:", error);
    throw new Error("No se pudo guardar el crucigrama.");
  }
};

export const deleteCrucigrama = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, CRUCIGRAMAS_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error al eliminar el crucigrama:", error);
        throw new Error("No se pudo eliminar el crucigrama.");
    }
};

// --- GESTIÓN DE LÍNEAS DE TIEMPO ---

export const subscribeToTimelines = (callback: (data: Timeline[]) => void) => {
    const q = query(collection(db, TIMELINES_COLLECTION), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
        const timelines = querySnapshot.docs.map(doc => convertFirestoreDoc<Timeline>(doc));
        callback(timelines);
    }, (error) => {
        console.error("Error al suscribirse a las líneas de tiempo:", error);
        callback([]);
    });
};

export const saveTimeline = async (timelineData: Timeline, creador: User): Promise<void> => {
    try {
        const { id, ...dataToSave } = timelineData;
        const docRef = doc(db, TIMELINES_COLLECTION, id);
        await setDoc(docRef, {
            ...dataToSave,
            creadorId: creador.id,
            creadorNombre: creador.nombreCompleto,
            createdAt: Timestamp.fromDate(new Date(dataToSave.createdAt || Date.now())), 
        }, { merge: true });
    } catch (error) {
        console.error("Error al guardar la línea de tiempo:", error);
        throw new Error("No se pudo guardar la línea de tiempo.");
    }
};

export const createTimeline = async (timelineData: Omit<Timeline, 'id' | 'createdAt'>, creador: User): Promise<string> => {
    try {
        const dataToSend = {
            ...timelineData,
            creadorId: creador.id,
            creadorNombre: creador.nombreCompleto,
            createdAt: Timestamp.fromDate(new Date()),
        };
        const docRef = await addDoc(collection(db, TIMELINES_COLLECTION), dataToSend);
        return docRef.id;
    } catch (error) {
        console.error("Error al crear la línea de tiempo:", error);
        throw new Error("No se pudo crear la línea de tiempo.");
    }
};

export const deleteTimeline = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, TIMELINES_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error al eliminar la línea de tiempo:", error);
        throw new Error("No se pudo eliminar la línea de tiempo.");
    }
};

// --- GESTIÓN DE MAPAS MENTALES ---

export const subscribeToMindMaps = (callback: (data: MindMap[]) => void) => {
    const q = query(collection(db, MINDMAPS_COLLECTION), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
        const maps = querySnapshot.docs.map(doc => convertFirestoreDoc<MindMap>(doc));
        callback(maps);
    }, (error) => {
        console.error("Error al suscribirse a los mapas mentales:", error);
        callback([]);
    });
};

export const saveMindMap = async (mapData: MindMap, creador: User): Promise<void> => {
    try {
        const { id, ...dataToSave } = mapData;
        const docRef = doc(db, MINDMAPS_COLLECTION, id);
        await setDoc(docRef, {
            ...dataToSave,
            creadorId: creador.id,
            creadorNombre: creador.nombreCompleto,
            createdAt: Timestamp.fromDate(new Date(dataToSave.createdAt || Date.now())),
        }, { merge: true });
    } catch (error) {
        console.error("Error al guardar el mapa mental:", error);
        throw new Error("No se pudo guardar el mapa mental.");
    }
};

export const createMindMap = async (mapData: Omit<MindMap, 'id' | 'createdAt'>, creador: User): Promise<string> => {
    try {
        const dataToSend = {
            ...mapData,
            creadorId: creador.id,
            creadorNombre: creador.nombreCompleto,
            createdAt: Timestamp.fromDate(new Date()),
        };
        const docRef = await addDoc(collection(db, MINDMAPS_COLLECTION), dataToSend);
        return docRef.id;
    } catch (error) {
        console.error("Error al crear el mapa mental:", error);
        throw new Error("No se pudo crear el mapa mental.");
    }
};

export const deleteMindMap = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, MINDMAPS_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error al eliminar el mapa mental:", error);
        throw new Error("No se pudo eliminar el mapa mental.");
    }
};

// --- GESTIÓN DE SOPAS DE LETRAS ---

export const subscribeToSopasDeLetras = (callback: (data: WordSearchPuzzle[]) => void) => {
    const q = query(collection(db, SOPAS_DE_LETRAS_COLLECTION), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
        const puzzles = querySnapshot.docs.map(doc => convertFirestoreDoc<WordSearchPuzzle>(doc));
        callback(puzzles);
    }, (error) => {
        console.error("Error al suscribirse a las sopas de letras:", error);
        callback([]);
    });
};

export const saveSopaDeLetras = async (puzzleData: Omit<WordSearchPuzzle, 'id' | 'createdAt'>, creador: User): Promise<string> => {
    try {
        const dataToSend = {
            ...puzzleData,
            creadorId: creador.id,
            creadorNombre: creador.nombreCompleto,
            createdAt: Timestamp.fromDate(new Date()),
        };
        const docRef = await addDoc(collection(db, SOPAS_DE_LETRAS_COLLECTION), dataToSend);
        return docRef.id;
    } catch (error) {
        console.error("Error al guardar la sopa de letras:", error);
        throw new Error("No se pudo guardar la sopa de letras.");
    }
};

export const deleteSopaDeLetras = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, SOPAS_DE_LETRAS_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error al eliminar la sopa de letras:", error);
        throw new Error("No se pudo eliminar la sopa de letras.");
    }
};
