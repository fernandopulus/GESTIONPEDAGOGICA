import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta según tu configuración
import { AnalisisTaxonomico } from '../../types';

const COLLECTION_NAME = 'analisisTaxonomicos'; // Unificamos el nombre de la colección

/**
 * Obtener todos los análisis taxonómicos desde Firestore (para Subdirección)
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
        console.error('Error al obtener todos los análisis:', error);
        throw new Error('No se pudieron cargar los análisis taxonómicos');
    }
};

/**
 * Obtener análisis por un usuario específico (más eficiente)
 */
export const getUserAnalisis = async (userId: string): Promise<AnalisisTaxonomico[]> => {
    if (!userId) return [];
    try {
        const q = query(
            collection(db, COLLECTION_NAME), 
            where('userId', '==', userId),
            orderBy('uploadDate', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AnalisisTaxonomico[];
    } catch (error) {
        console.error('Error al obtener análisis por usuario:', error);
        throw new Error('No se pudieron cargar los análisis del usuario');
    }
};

/**
 * Crear un nuevo análisis taxonómico en Firestore
 */
export const createAnalisis = async (data: Omit<AnalisisTaxonomico, 'id'>): Promise<AnalisisTaxonomico> => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
        return { id: docRef.id, ...data };
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
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as AnalisisTaxonomico;
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener análisis por ID:', error);
        throw new Error('No se pudo obtener el análisis taxonómico');
    }
};
