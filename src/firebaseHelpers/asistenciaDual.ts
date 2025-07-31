import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta según tu configuración
import { AsistenciaDual } from '../../types';

const COLLECTION_NAME = 'asistenciaDual';

/**
 * Obtener todos los registros de asistencia dual desde Firestore
 */
export const getAllAsistenciaRecords = async (): Promise<AsistenciaDual[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('fechaHora', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AsistenciaDual[];
    } catch (error) {
        console.error('Error al obtener registros de asistencia:', error);
        throw new Error('No se pudieron cargar los registros de asistencia');
    }
};

/**
 * Crear un nuevo registro de asistencia dual en Firestore
 */
export const createAsistenciaRecord = async (data: Omit<AsistenciaDual, 'id'>): Promise<AsistenciaDual> => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            fechaHora: data.fechaHora || new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        
        return {
            id: docRef.id,
            ...data
        };
    } catch (error) {
        console.error('Error al crear registro de asistencia:', error);
        throw new Error('No se pudo crear el registro de asistencia');
    }
};

/**
 * Actualizar un registro de asistencia dual en Firestore
 */
export const updateAsistenciaRecord = async (id: string, data: Partial<Omit<AsistenciaDual, 'id'>>): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error al actualizar registro de asistencia:', error, 'ID:', id);
        throw new Error('No se pudo actualizar el registro de asistencia');
    }
};

/**
 * Eliminar un registro de asistencia dual de Firestore
 */
export const deleteAsistenciaRecord = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error al eliminar registro de asistencia:', error, 'ID:', id);
        throw new Error('No se pudo eliminar el registro de asistencia');
    }
};

/**
 * Obtener registros de asistencia de un mes específico (optimización)
 */
export const getAsistenciaByMonth = async (year: number, month: number): Promise<AsistenciaDual[]> => {
    try {
        // Crear fechas de inicio y fin del mes
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
        
        const q = query(
            collection(db, COLLECTION_NAME),
            where('fechaHora', '>=', startDate.toISOString()),
            where('fechaHora', '<=', endDate.toISOString()),
            orderBy('fechaHora', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AsistenciaDual[];
    } catch (error) {
        console.error('Error al obtener registros por mes:', error);
        throw new Error('No se pudieron cargar los registros del mes');
    }
};

/**
 * Obtener registros de asistencia de un estudiante específico
 */
export const getAsistenciaByStudent = async (nombreEstudiante: string): Promise<AsistenciaDual[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('nombreEstudiante', '==', nombreEstudiante),
            orderBy('fechaHora', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AsistenciaDual[];
    } catch (error) {
        console.error('Error al obtener registros por estudiante:', error);
        throw new Error('No se pudieron cargar los registros del estudiante');
    }
};

/**
 * Obtener registros de asistencia por curso
 */
export const getAsistenciaByCurso = async (curso: string): Promise<AsistenciaDual[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('curso', '==', curso),
            orderBy('fechaHora', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AsistenciaDual[];
    } catch (error) {
        console.error('Error al obtener registros por curso:', error);
        throw new Error('No se pudieron cargar los registros del curso');
    }
};

/**
 * Obtener registros de asistencia por rango de fechas
 */
export const getAsistenciaByDateRange = async (startDate: string, endDate: string): Promise<AsistenciaDual[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('fechaHora', '>=', startDate),
            where('fechaHora', '<=', endDate),
            orderBy('fechaHora', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AsistenciaDual[];
    } catch (error) {
        console.error('Error al obtener registros por rango:', error);
        throw new Error('No se pudieron cargar los registros del rango especificado');
    }
};

/**
 * Obtener registros de asistencia por tipo (Entrada/Salida)
 */
export const getAsistenciaByTipo = async (tipo: 'Entrada' | 'Salida'): Promise<AsistenciaDual[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('tipo', '==', tipo),
            orderBy('fechaHora', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AsistenciaDual[];
    } catch (error) {
        console.error('Error al obtener registros por tipo:', error);
        throw new Error('No se pudieron cargar los registros del tipo especificado');
    }
};

/**
 * Obtener estadísticas de asistencia
 */
export const getEstadisticasAsistencia = async (): Promise<{
    totalRegistros: number;
    estudiantesActivos: number;
    registrosHoy: number;
    promedioRegistrosDiarios: number;
}> => {
    try {
        const allRecords = await getAllAsistenciaRecords();
        
        // Estudiantes únicos
        const estudiantesUnicos = new Set(allRecords.map(r => r.nombreEstudiante));
        
        // Registros de hoy
        const hoy = new Date();
        const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        const registrosHoy = allRecords.filter(
            r => new Date(r.fechaHora) >= inicioHoy
        ).length;
        
        // Promedio de registros diarios (últimos 30 días)
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);
        
        const registrosUltimos30Dias = allRecords.filter(
            r => new Date(r.fechaHora) >= hace30Dias
        ).length;
        
        const promedioRegistrosDiarios = registrosUltimos30Dias / 30;
        
        return {
            totalRegistros: allRecords.length,
            estudiantesActivos: estudiantesUnicos.size,
            registrosHoy,
            promedioRegistrosDiarios: Math.round(promedioRegistrosDiarios * 100) / 100
        };
        
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        throw new Error('No se pudieron obtener las estadísticas de asistencia');
    }
};

/**
 * Buscar registros de asistencia por texto
 */
export const searchAsistenciaRecords = async (searchTerm: string): Promise<AsistenciaDual[]> => {
    try {
        // Firestore no soporta búsqueda de texto completo nativa
        // Esta función obtiene todos los registros y filtra en el cliente
        const allRecords = await getAllAsistenciaRecords();
        
        const searchLower = searchTerm.toLowerCase();
        
        return allRecords.filter(record => 
            record.nombreEstudiante.toLowerCase().includes(searchLower) ||
            (record.curso && record.curso.toLowerCase().includes(searchLower)) ||
            record.tipo.toLowerCase().includes(searchLower)
        );
    } catch (error) {
        console.error('Error al buscar registros:', error);
        throw new Error('No se pudieron buscar los registros');
    }
};