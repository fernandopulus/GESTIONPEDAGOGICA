import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta según tu configuración
import { AcompanamientoDocente } from '../../types';

const COLLECTION_NAME = 'acompanamientos';

// ========================================
// FUNCIONES BÁSICAS CRUD (Para Administración)
// ========================================

/**
 * Obtener todos los registros de acompañamiento docente desde Firestore
 * Usado por: AcompanamientoDocente.tsx (administración)
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
 * Usado por: AcompanamientoDocente.tsx (administración)
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
 * Usado por: AcompanamientoDocente.tsx (administración)
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
 * Usado por: AcompanamientoDocente.tsx (administración)
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

// ========================================
// FUNCIONES ESPECÍFICAS PARA PROFESORES
// ========================================

/**
 * Obtener acompañamientos de un docente específico
 * Usado por: AcompanamientoDocenteProfesor.tsx (vista del profesor)
 */
export const getAcompanamientosByDocente = async (nombreDocente: string): Promise<AcompanamientoDocente[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME), 
            where('docente', '==', nombreDocente),
            orderBy('fecha', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AcompanamientoDocente[];
    } catch (error) {
        console.error('Error al obtener acompañamientos por docente:', error);
        throw new Error('No se pudieron cargar los acompañamientos del docente');
    }
};

/**
 * Obtener rúbrica personalizada si existe
 * Usado por: AcompanamientoDocenteProfesor.tsx y AcompanamientoDocente.tsx
 */
export const getRubricaPersonalizada = async (): Promise<any | null> => {
    try {
        const docRef = doc(db, 'configuracion', 'rubricaAcompanamiento');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data().rubrica;
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener rúbrica personalizada:', error);
        // No es crítico, devolver null para usar la rúbrica por defecto
        return null;
    }
};

// ========================================
// FUNCIONES ADICIONALES DE UTILIDAD
// ========================================

/**
 * Obtener un registro de acompañamiento específico por ID
 */
export const getAcompanamientoById = async (id: string): Promise<AcompanamientoDocente | null> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            } as AcompanamientoDocente;
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener acompañamiento por ID:', error);
        throw new Error('No se pudo obtener el registro de acompañamiento');
    }
};

/**
 * Guardar rúbrica personalizada
 * Usado por: Panel de configuración (si existe)
 */
export const saveRubricaPersonalizada = async (rubrica: any): Promise<void> => {
    try {
        const docRef = doc(db, 'configuracion', 'rubricaAcompanamiento');
        await setDoc(docRef, {
            rubrica,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error('Error al guardar rúbrica personalizada:', error);
        throw new Error('No se pudo guardar la rúbrica personalizada');
    }
};

/**
 * Obtener estadísticas de acompañamiento de un docente específico
 * Usado por: Dashboard del profesor o reportes
 */
export const getEstadisticasDocente = async (nombreDocente: string): Promise<{
    totalAcompanamientos: number;
    promedioGeneral: number;
    ultimoAcompanamiento: string | null;
    tendencia: 'mejorando' | 'estable' | 'declinando';
}> => {
    try {
        const acompanamientos = await getAcompanamientosByDocente(nombreDocente);
        
        if (acompanamientos.length === 0) {
            return {
                totalAcompanamientos: 0,
                promedioGeneral: 0,
                ultimoAcompanamiento: null,
                tendencia: 'estable'
            };
        }
        
        // Calcular promedio general
        let totalPuntos = 0;
        let totalCriterios = 0;
        
        acompanamientos.forEach(acomp => {
            const puntos = Object.values(acomp.rubricaResultados).reduce((sum, score) => sum + (score || 0), 0);
            const criterios = Object.keys(acomp.rubricaResultados).length;
            
            totalPuntos += puntos;
            totalCriterios += criterios;
        });
        
        const promedioGeneral = totalCriterios > 0 ? totalPuntos / totalCriterios : 0;
        
        // Calcular tendencia (comparar últimos 2 acompañamientos)
        let tendencia: 'mejorando' | 'estable' | 'declinando' = 'estable';
        
        if (acompanamientos.length >= 2) {
            const ultimo = acompanamientos[0];
            const penultimo = acompanamientos[1];
            
            const calcularPromedio = (acomp: AcompanamientoDocente) => {
                const puntos = Object.values(acomp.rubricaResultados).reduce((sum, score) => sum + (score || 0), 0);
                const criterios = Object.keys(acomp.rubricaResultados).length;
                return criterios > 0 ? puntos / criterios : 0;
            };
            
            const promedioUltimo = calcularPromedio(ultimo);
            const promedioPenultimo = calcularPromedio(penultimo);
            
            if (promedioUltimo > promedioPenultimo + 0.1) {
                tendencia = 'mejorando';
            } else if (promedioUltimo < promedioPenultimo - 0.1) {
                tendencia = 'declinando';
            }
        }
        
        return {
            totalAcompanamientos: acompanamientos.length,
            promedioGeneral: Math.round(promedioGeneral * 100) / 100,
            ultimoAcompanamiento: acompanamientos[0]?.fecha || null,
            tendencia
        };
        
    } catch (error) {
        console.error('Error al calcular estadísticas del docente:', error);
        throw new Error('No se pudieron calcular las estadísticas');
    }
};

/**
 * Obtener acompañamientos recientes (últimos N días)
 * Usado por: Dashboard, reportes
 */
export const getAcompanamientosRecientes = async (diasAtras: number = 30): Promise<AcompanamientoDocente[]> => {
    try {
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - diasAtras);
        const fechaLimiteStr = fechaLimite.toISOString();
        
        const q = query(
            collection(db, COLLECTION_NAME),
            where('fecha', '>=', fechaLimiteStr),
            orderBy('fecha', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AcompanamientoDocente[];
    } catch (error) {
        console.error('Error al obtener acompañamientos recientes:', error);
        throw new Error('No se pudieron cargar los acompañamientos recientes');
    }
};

/**
 * Obtener acompañamientos por rango de fechas
 * Usado por: Reportes, filtros avanzados
 */
export const getAcompanamientosByDateRange = async (startDate: string, endDate: string): Promise<AcompanamientoDocente[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('fecha', '>=', startDate),
            where('fecha', '<=', endDate),
            orderBy('fecha', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AcompanamientoDocente[];
    } catch (error) {
        console.error('Error al obtener acompañamientos por rango de fechas:', error);
        throw new Error('No se pudieron cargar los acompañamientos del rango especificado');
    }
};

/**
 * Obtener acompañamientos por curso
 * Usado por: Filtros, reportes por curso
 */
export const getAcompanamientosByCurso = async (curso: string): Promise<AcompanamientoDocente[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('curso', '==', curso),
            orderBy('fecha', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AcompanamientoDocente[];
    } catch (error) {
        console.error('Error al obtener acompañamientos por curso:', error);
        throw new Error('No se pudieron cargar los acompañamientos del curso');
    }
};

/**
 * Obtener acompañamientos por asignatura
 * Usado por: Filtros, reportes por asignatura
 */
export const getAcompanamientosByAsignatura = async (asignatura: string): Promise<AcompanamientoDocente[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('asignatura', '==', asignatura),
            orderBy('fecha', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AcompanamientoDocente[];
    } catch (error) {
        console.error('Error al obtener acompañamientos por asignatura:', error);
        throw new Error('No se pudieron cargar los acompañamientos de la asignatura');
    }
};

/**
 * Buscar acompañamientos por texto
 * Usado por: Barra de búsqueda
 */
export const searchAcompanamientos = async (searchTerm: string): Promise<AcompanamientoDocente[]> => {
    try {
        // Firestore no soporta búsqueda de texto completo nativa
        // Esta función obtiene todos los acompañamientos y filtra en el cliente
        const allAcompanamientos = await getAllAcompanamientos();
        
        const searchLower = searchTerm.toLowerCase();
        
        return allAcompanamientos.filter(acomp => 
            acomp.docente.toLowerCase().includes(searchLower) ||
            acomp.curso.toLowerCase().includes(searchLower) ||
            acomp.asignatura.toLowerCase().includes(searchLower) ||
            (acomp.observacionesGenerales && acomp.observacionesGenerales.toLowerCase().includes(searchLower))
        );
    } catch (error) {
        console.error('Error al buscar acompañamientos:', error);
        throw new Error('No se pudieron buscar los acompañamientos');
    }
};

/**
 * Obtener resumen general de acompañamientos (para dashboard)
 * Usado por: Dashboard principal, estadísticas generales
 */
export const getResumenAcompanamientos = async (): Promise<{
    totalAcompanamientos: number;
    docentesEvaluados: number;
    promedioGeneralInstitucion: number;
    acompanamientosEsteMes: number;
}> => {
    try {
        const allAcompanamientos = await getAllAcompanamientos();
        
        // Docentes únicos
        const docentesUnicos = new Set(allAcompanamientos.map(a => a.docente));
        
        // Promedio general de la institución
        let totalPuntos = 0;
        let totalCriterios = 0;
        
        allAcompanamientos.forEach(acomp => {
            const puntos = Object.values(acomp.rubricaResultados).reduce((sum, score) => sum + (score || 0), 0);
            const criterios = Object.keys(acomp.rubricaResultados).length;
            
            totalPuntos += puntos;
            totalCriterios += criterios;
        });
        
        const promedioGeneral = totalCriterios > 0 ? totalPuntos / totalCriterios : 0;
        
        // Acompañamientos este mes
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);
        
        const acompanamientosEsteMes = allAcompanamientos.filter(
            acomp => new Date(acomp.fecha) >= inicioMes
        ).length;
        
        return {
            totalAcompanamientos: allAcompanamientos.length,
            docentesEvaluados: docentesUnicos.size,
            promedioGeneralInstitucion: Math.round(promedioGeneral * 100) / 100,
            acompanamientosEsteMes
        };
        
    } catch (error) {
        console.error('Error al obtener resumen de acompañamientos:', error);
        throw new Error('No se pudo obtener el resumen de acompañamientos');
    }
};