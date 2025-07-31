import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta según tu configuración
import { AnalisisTaxonomico } from '../../types';

const COLLECTION_NAME = 'analisis';

/**
 * Obtener todos los análisis taxonómicos desde Firestore
 */
export const getAllAnalisis = async (): Promise<AnalisisTaxonomico[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('uploadDate', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AnalisisTaxonomico[];
    } catch (error) {
        console.error('Error al obtener análisis:', error);
        throw new Error('No se pudieron cargar los análisis taxonómicos');
    }
};

/**
 * Crear un nuevo análisis taxonómico en Firestore
 */
export const createAnalisis = async (data: Omit<AnalisisTaxonomico, 'id'>): Promise<AnalisisTaxonomico> => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            uploadDate: data.uploadDate || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        return {
            id: docRef.id,
            ...data
        };
    } catch (error) {
        console.error('Error al crear análisis:', error);
        throw new Error('No se pudo crear el análisis taxonómico');
    }
};

/**
 * Eliminar un análisis taxonómico de Firestore
 */
export const deleteAnalisis = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error al eliminar análisis:', error, 'ID:', id);
        throw new Error('No se pudo eliminar el análisis taxonómico');
    }
};

/**
 * Obtener un análisis específico por ID
 */
export const getAnalisisById = async (id: string): Promise<AnalisisTaxonomico | null> => {
    try {
        const q = query(collection(db, COLLECTION_NAME));
        const querySnapshot = await getDocs(q);
        
        const foundDoc = querySnapshot.docs.find(doc => doc.id === id);
        if (foundDoc) {
            return {
                id: foundDoc.id,
                ...foundDoc.data()
            } as AnalisisTaxonomico;
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener análisis por ID:', error);
        throw new Error('No se pudo obtener el análisis taxonómico');
    }
};

/**
 * Obtener análisis por usuario específico
 */
export const getAnalisisByUserId = async (userId: string): Promise<AnalisisTaxonomico[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('uploadDate', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }) as AnalisisTaxonomico)
            .filter(analisis => analisis.userId === userId);
    } catch (error) {
        console.error('Error al obtener análisis por usuario:', error);
        throw new Error('No se pudieron cargar los análisis del usuario');
    }
};