import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta según tu configuración
import { CalendarEvent } from '../../types';

const COLLECTION_NAME = 'events';

/**
 * Obtener todos los eventos del calendario desde Firestore
 */
export const getAllEvents = async (): Promise<CalendarEvent[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'asc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CalendarEvent[];
    } catch (error) {
        console.error('Error al obtener eventos:', error);
        throw new Error('No se pudieron cargar los eventos del calendario');
    }
};

/**
 * Crear un nuevo evento en el calendario en Firestore
 */
export const createEvent = async (data: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        return {
            id: docRef.id,
            ...data
        };
    } catch (error) {
        console.error('Error al crear evento:', error);
        throw new Error('No se pudo crear el evento del calendario');
    }
};

/**
 * Actualizar un evento del calendario en Firestore
 */
export const updateEvent = async (id: string, data: Partial<Omit<CalendarEvent, 'id'>>): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error al actualizar evento:', error, 'ID:', id);
        throw new Error('No se pudo actualizar el evento del calendario');
    }
};

/**
 * Eliminar un evento del calendario de Firestore
 */
export const deleteEvent = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error al eliminar evento:', error, 'ID:', id);
        throw new Error('No se pudo eliminar el evento del calendario');
    }
};

/**
 * Obtener eventos de un mes específico
 */
export const getEventsByMonth = async (year: number, month: number): Promise<CalendarEvent[]> => {
    try {
        // Crear fechas de inicio y fin del mes
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
        
        const q = query(
            collection(db, COLLECTION_NAME),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CalendarEvent[];
    } catch (error) {
        console.error('Error al obtener eventos por mes:', error);
        throw new Error('No se pudieron cargar los eventos del mes');
    }
};

/**
 * Obtener eventos de un rango de fechas
 */
export const getEventsByDateRange = async (startDate: string, endDate: string): Promise<CalendarEvent[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CalendarEvent[];
    } catch (error) {
        console.error('Error al obtener eventos por rango:', error);
        throw new Error('No se pudieron cargar los eventos del rango de fechas');
    }
};

/**
 * Obtener eventos de un tipo específico
 */
export const getEventsByType = async (eventType: string): Promise<CalendarEvent[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('type', '==', eventType),
            orderBy('date', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CalendarEvent[];
    } catch (error) {
        console.error('Error al obtener eventos por tipo:', error);
        throw new Error('No se pudieron cargar los eventos del tipo especificado');
    }
};

/**
 * Obtener eventos de un curso específico (para evaluaciones)
 */
export const getEventsByCourse = async (curso: string): Promise<CalendarEvent[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('curso', '==', curso),
            orderBy('date', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CalendarEvent[];
    } catch (error) {
        console.error('Error al obtener eventos por curso:', error);
        throw new Error('No se pudieron cargar los eventos del curso');
    }
};

/**
 * Obtener un evento específico por ID
 */
export const getEventById = async (id: string): Promise<CalendarEvent | null> => {
    try {
        const q = query(collection(db, COLLECTION_NAME));
        const querySnapshot = await getDocs(q);
        
        const foundDoc = querySnapshot.docs.find(doc => doc.id === id);
        if (foundDoc) {
            return {
                id: foundDoc.id,
                ...foundDoc.data()
            } as CalendarEvent;
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener evento por ID:', error);
        throw new Error('No se pudo obtener el evento del calendario');
    }
};

/**
 * Obtener eventos próximos (siguientes 7 días)
 */
export const getUpcomingEvents = async (): Promise<CalendarEvent[]> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        return await getEventsByDateRange(today, nextWeek);
    } catch (error) {
        console.error('Error al obtener eventos próximos:', error);
        throw new Error('No se pudieron cargar los eventos próximos');
    }
};

/**
 * Buscar eventos por texto (en contenidos, ubicación, etc.)
 */
export const searchEvents = async (searchTerm: string): Promise<CalendarEvent[]> => {
    try {
        // Nota: Firestore no soporta búsqueda de texto completo nativa
        // Esta función obtiene todos los eventos y filtra en el cliente
        const allEvents = await getAllEvents();
        
        const searchLower = searchTerm.toLowerCase();
        
        return allEvents.filter(event => {
            // Buscar en diferentes campos según el tipo de evento
            switch (event.type) {
                case 'Evaluación':
                    return (
                        event.asignatura?.toLowerCase().includes(searchLower) ||
                        event.contenidos?.toLowerCase().includes(searchLower) ||
                        event.curso?.toLowerCase().includes(searchLower)
                    );
                case 'Acto':
                case 'Actividad Focalizada':
                    return (
                        event.ubicacion?.toLowerCase().includes(searchLower) ||
                        event.responsables?.toLowerCase().includes(searchLower)
                    );
                case 'Salida Pedagógica':
                    return (
                        event.ubicacion?.toLowerCase().includes(searchLower) ||
                        event.responsable?.toLowerCase().includes(searchLower) ||
                        event.cursos?.some(curso => curso.toLowerCase().includes(searchLower))
                    );
                default:
                    return false;
            }
        });
    } catch (error) {
        console.error('Error al buscar eventos:', error);
        throw new Error('No se pudieron buscar los eventos');
    }
};