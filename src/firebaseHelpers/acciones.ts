import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta según tu configuración
import { AccionPedagogica } from '../../types';

const COLLECTION_NAME = 'acciones';

/**
 * Obtener todas las acciones pedagógicas desde Firestore
 */
export const getAllAcciones = async (): Promise<AccionPedagogica[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('fechaRegistro', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AccionPedagogica[];
    } catch (error) {
        console.error('Error al obtener acciones:', error);
        throw new Error('No se pudieron cargar las acciones pedagógicas');
    }
};

/**
 * Crear una nueva acción pedagógica en Firestore
 */
export const createAccion = async (data: Omit<AccionPedagogica, 'id'>): Promise<AccionPedagogica> => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            fechaRegistro: data.fechaRegistro || new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        return {
            id: docRef.id,
            ...data
        };
    } catch (error) {
        console.error('Error al crear acción:', error);
        throw new Error('No se pudo crear la acción pedagógica');
    }
};

/**
 * Actualizar una acción pedagógica en Firestore
 */
export const updateAccion = async (id: string, data: Partial<Omit<AccionPedagogica, 'id'>>): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error al actualizar acción:', error, 'ID:', id);
        throw new Error('No se pudo actualizar la acción pedagógica');
    }
};

/**
 * Eliminar una acción pedagógica de Firestore
 */
export const deleteAccion = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error al eliminar acción:', error, 'ID:', id);
        throw new Error('No se pudo eliminar la acción pedagógica');
    }
};

/**
 * Obtener una acción específica por ID
 */
export const getAccionById = async (id: string): Promise<AccionPedagogica | null> => {
    try {
        const q = query(collection(db, COLLECTION_NAME));
        const querySnapshot = await getDocs(q);
        
        const foundDoc = querySnapshot.docs.find(doc => doc.id === id);
        if (foundDoc) {
            return {
                id: foundDoc.id,
                ...foundDoc.data()
            } as AccionPedagogica;
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener acción por ID:', error);
        throw new Error('No se pudo obtener la acción pedagógica');
    }
};