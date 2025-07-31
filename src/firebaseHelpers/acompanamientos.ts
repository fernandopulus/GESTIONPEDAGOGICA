import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta según tu configuración
import { AcompanamientoDocente } from '../../types';

const COLLECTION_NAME = 'acompanamientos';

/**
 * Obtener todos los registros de acompañamiento docente desde Firestore
 */
export const getAllAcompanamientos = async (): Promise<AcompanamientoDocente[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('fecha', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AcompanamientoDocente[];
    } catch (error) {
        console.error('Error al obtener acompañamientos:', error);
        throw new Error('No se pudieron cargar los registros de acompañamiento');
    }
};

/**
 * Crear un nuevo registro de acompañamiento docente en Firestore
 */
export const createAcompanamiento = async (data: Omit<AcompanamientoDocente, 'id'>): Promise<AcompanamientoDocente> => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            fecha: data.fecha || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        return {
            id: docRef.id,
            ...data
        };
    } catch (error) {
        console.error('Error al crear acompañamiento:', error);
        throw new Error('No se pudo crear el registro de acompañamiento');
    }
};

/**
 * Actualizar un registro de acompañamiento docente en Firestore
 */
export const updateAcompanamiento = async (id: string, data: Partial<Omit<AcompanamientoDocente, 'id'>>): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error al actualizar acompañamiento:', error, 'ID:', id);
        throw new Error('No se pudo actualizar el registro de acompañamiento');
    }
};

/**
 * Eliminar un registro de acompañamiento docente de Firestore
 */
export const deleteAcompanamiento = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error al eliminar acompañamiento:', error, 'ID:', id);
        throw new Error('No se pudo eliminar el registro de acompañamiento');
    }
};

/**
 * Obtener un registro de acompañamiento específico por ID
 */
export const getAcompanamientoById = async (id: string): Promise<AcompanamientoDocente | null> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDocs(query(collection(db, COLLECTION_NAME)));
        
        const foundDoc = docSnap.docs.find(doc => doc.id === id);
        if (foundDoc) {
            return {
                id: foundDoc.id,
                ...foundDoc.data()
            } as AcompanamientoDocente;
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener acompañamiento por ID:', error);
        throw new Error('No se pudo obtener el registro de acompañamiento');
    }
};