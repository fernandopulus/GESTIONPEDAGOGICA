import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta según tu configuración
import { Anuncio } from '../../types';

const COLLECTION_NAME = 'anuncios';

/**
 * Obtener todos los anuncios desde Firestore
 */
export const getAllAnuncios = async (): Promise<Anuncio[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('fechaPublicacion', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Anuncio[];
    } catch (error) {
        console.error('Error al obtener anuncios:', error);
        throw new Error('No se pudieron cargar los anuncios');
    }
};

/**
 * Crear un nuevo anuncio en Firestore
 */
export const createAnuncio = async (data: Omit<Anuncio, 'id'>): Promise<Anuncio> => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            fechaPublicacion: data.fechaPublicacion || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        return {
            id: docRef.id,
            ...data
        };
    } catch (error) {
        console.error('Error al crear anuncio:', error);
        throw new Error('No se pudo crear el anuncio');
    }
};

/**
 * Actualizar un anuncio en Firestore
 */
export const updateAnuncio = async (id: string, data: Partial<Omit<Anuncio, 'id'>>): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error al actualizar anuncio:', error, 'ID:', id);
        throw new Error('No se pudo actualizar el anuncio');
    }
};

/**
 * Eliminar un anuncio de Firestore
 */
export const deleteAnuncio = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error al eliminar anuncio:', error, 'ID:', id);
        throw new Error('No se pudo eliminar el anuncio');
    }
};

/**
 * Obtener un anuncio específico por ID
 */
export const getAnuncioById = async (id: string): Promise<Anuncio | null> => {
    try {
        const q = query(collection(db, COLLECTION_NAME));
        const querySnapshot = await getDocs(q);
        
        const foundDoc = querySnapshot.docs.find(doc => doc.id === id);
        if (foundDoc) {
            return {
                id: foundDoc.id,
                ...foundDoc.data()
            } as Anuncio;
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener anuncio por ID:', error);
        throw new Error('No se pudo obtener el anuncio');
    }
};