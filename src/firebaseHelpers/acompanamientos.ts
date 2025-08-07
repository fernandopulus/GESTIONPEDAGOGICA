import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    getDoc,
    setDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
// RUTA CORREGIDA: Apuntando a 'src/firebase.ts' desde 'src/firebaseHelpers/'
import { db } from '../firebase';
// RUTA CORREGIDA: Apuntando a 'types.ts' en la raíz desde 'src/firebaseHelpers/'
import { AcompanamientoDocente as AcompanamientoDocenteType, CicloOPR } from '../../types';

// --- DEFINICIÓN DE CONSTANTES PARA COLECCIONES ---
const ACOMPANAMIENTOS_COLLECTION = 'acompanamientos';
const CICLOS_OPR_SUBCOLLECTION = 'ciclosOPR';
const CONFIGURACION_COLLECTION = 'configuracion';


// =================================================================
// HELPERS PARA ACOMPAÑAMIENTOS (COLECCIÓN PRINCIPAL)
// =================================================================

/**
 * Obtiene todos los registros de acompañamiento docente desde Firestore, ordenados por fecha descendente.
 */
export const getAllAcompanamientos = async (): Promise<AcompanamientoDocenteType[]> => {
    try {
        const q = query(collection(db, ACOMPANAMIENTOS_COLLECTION), orderBy('fecha', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AcompanamientoDocenteType[];
    } catch (error) {
        console.error('Error al obtener acompañamientos:', error);
        throw new Error('No se pudieron cargar los registros de acompañamiento');
    }
};

/**
 * Obtener un registro de acompañamiento específico por ID.
 */
export const getAcompanamientoById = async (id: string): Promise<AcompanamientoDocenteType | null> => {
    try {
        const docRef = doc(db, ACOMPANAMIENTOS_COLLECTION, id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as AcompanamientoDocenteType : null;
    } catch (error) {
        console.error('Error al obtener acompañamiento por ID:', error);
        throw new Error('No se pudo obtener el registro de acompañamiento');
    }
};

/**
 * Crea un nuevo registro de acompañamiento docente en Firestore.
 * @param data - Los datos del acompañamiento a crear.
 * @returns El acompañamiento creado con su nuevo ID.
 */
export const createAcompanamiento = async (data: Omit<AcompanamientoDocenteType, 'id'>): Promise<AcompanamientoDocenteType> => {
    try {
        const docRef = await addDoc(collection(db, ACOMPANAMIENTOS_COLLECTION), {
            ...data,
            fecha: data.fecha || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return { id: docRef.id, ...data };
    } catch (error) {
        console.error('Error al crear acompañamiento:', error);
        throw new Error('No se pudo crear el registro de acompañamiento');
    }
};

/**
 * Actualiza un registro de acompañamiento docente existente en Firestore.
 * @param id - El ID del documento a actualizar.
 * @param data - Los datos a modificar.
 */
export const updateAcompanamiento = async (id: string, data: Partial<Omit<AcompanamientoDocenteType, 'id'>>): Promise<void> => {
    try {
        const docRef = doc(db, ACOMPANAMIENTOS_COLLECTION, id);
        await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
    } catch (error) {
        console.error('Error al actualizar acompañamiento:', error, 'ID:', id);
        throw new Error('No se pudo actualizar el registro de acompañamiento');
    }
};

/**
 * Elimina un registro de acompañamiento docente de Firestore.
 * NOTA: Esto no elimina las subcolecciones (ciclosOPR) ni los archivos en Storage.
 * Se requiere una Cloud Function para una eliminación en cascada.
 * @param id - El ID del documento a eliminar.
 */
export const deleteAcompanamiento = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, ACOMPANAMIENTOS_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error al eliminar acompañamiento:', error, 'ID:', id);
        throw new Error('No se pudo eliminar el registro de acompañamiento');
    }
};


// =================================================================
// HELPERS PARA CICLOS OPR (SUBCOLECCIÓN)
// =================================================================

/**
 * Obtiene todos los ciclos OPR para un acompañamiento específico.
 * @param acompanamientoId - El ID del documento de acompañamiento padre.
 * @returns Un array de ciclos OPR.
 */
export const getAllCiclosOPR = async (acompanamientoId: string): Promise<CicloOPR[]> => {
    try {
        const ciclosRef = collection(db, ACOMPANAMIENTOS_COLLECTION, acompanamientoId, CICLOS_OPR_SUBCOLLECTION);
        const q = query(ciclosRef, orderBy('fecha', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CicloOPR[];
    } catch (error) {
        console.error(`Error al obtener ciclos OPR para ${acompanamientoId}:`, error);
        throw new Error('No se pudieron cargar los ciclos OPR');
    }
};

/**
 * Crea un nuevo ciclo OPR dentro de un acompañamiento.
 * @param acompanamientoId - El ID del acompañamiento padre.
 * @param data - Los datos del nuevo ciclo OPR.
 * @returns El ciclo OPR creado con su nuevo ID.
 */
export const createCicloOPR = async (acompanamientoId: string, data: Omit<CicloOPR, 'id'>): Promise<CicloOPR> => {
    try {
        const ciclosRef = collection(db, ACOMPANAMIENTOS_COLLECTION, acompanamientoId, CICLOS_OPR_SUBCOLLECTION);
        const docRef = await addDoc(ciclosRef, { ...data, createdAt: new Date().toISOString() });
        return { id: docRef.id, ...data };
    } catch (error) {
        console.error(`Error al crear ciclo OPR para ${acompanamientoId}:`, error);
        throw new Error('No se pudo crear el ciclo OPR');
    }
};

/**
 * Actualiza un ciclo OPR existente.
 * @param acompanamientoId - El ID del acompañamiento padre.
 * @param cicloId - El ID del ciclo OPR a actualizar.
 * @param data - Los datos a modificar.
 */
export const updateCicloOPR = async (acompanamientoId: string, cicloId: string, data: Partial<CicloOPR>): Promise<void> => {
    try {
        const cicloRef = doc(db, ACOMPANAMIENTOS_COLLECTION, acompanamientoId, CICLOS_OPR_SUBCOLLECTION, cicloId);
        await updateDoc(cicloRef, { ...data, updatedAt: new Date().toISOString() });
    } catch (error) {
        console.error(`Error al actualizar ciclo OPR ${cicloId}:`, error);
        throw new Error('No se pudo actualizar el ciclo OPR');
    }
};


// =================================================================
// HELPER PARA FIREBASE STORAGE
// =================================================================

/**
 * Sube un archivo a Firebase Storage y devuelve su URL de descarga.
 * @param file - El archivo a subir.
 * @param path - La ruta en Storage donde se guardará el archivo (ej: "videos_opr/cicloId/nombreArchivo.mp4").
 * @returns La URL de descarga del archivo.
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
    try {
        const storage = getStorage();
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error(`Error al subir archivo a ${path}:`, error);
        throw new Error('No se pudo subir el archivo');
    }
};


// =================================================================
// FILTROS Y BÚSQUEDAS DE ACOMPAÑAMIENTOS
// =================================================================

/**
 * Obtener acompañamientos de un docente específico.
 */
export const getAcompanamientosByDocente = async (nombreDocente: string): Promise<AcompanamientoDocenteType[]> => {
    try {
        const q = query(collection(db, ACOMPANAMIENTOS_COLLECTION), where('docente', '==', nombreDocente), orderBy('fecha', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AcompanamientoDocenteType[];
    } catch (error) {
        console.error('Error al obtener acompañamientos por docente:', error);
        throw new Error('No se pudieron cargar los acompañamientos del docente');
    }
};

/**
 * Obtener acompañamientos por curso.
 */
export const getAcompanamientosByCurso = async (curso: string): Promise<AcompanamientoDocenteType[]> => {
    try {
        const q = query(collection(db, ACOMPANAMIENTOS_COLLECTION), where('curso', '==', curso), orderBy('fecha', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AcompanamientoDocenteType[];
    } catch (error) {
        console.error('Error al obtener acompañamientos por curso:', error);
        throw new Error('No se pudieron cargar los acompañamientos del curso');
    }
};

/**
 * Obtener acompañamientos por asignatura.
 */
export const getAcompanamientosByAsignatura = async (asignatura: string): Promise<AcompanamientoDocenteType[]> => {
    try {
        const q = query(collection(db, ACOMPANAMIENTOS_COLLECTION), where('asignatura', '==', asignatura), orderBy('fecha', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AcompanamientoDocenteType[];
    } catch (error) {
        console.error('Error al obtener acompañamientos por asignatura:', error);
        throw new Error('No se pudieron cargar los acompañamientos de la asignatura');
    }
};

/**
 * Obtener acompañamientos por rango de fechas.
 */
export const getAcompanamientosByDateRange = async (startDate: string, endDate: string): Promise<AcompanamientoDocenteType[]> => {
    try {
        const q = query(
            collection(db, ACOMPANAMIENTOS_COLLECTION),
            where('fecha', '>=', startDate),
            where('fecha', '<=', endDate),
            orderBy('fecha', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AcompanamientoDocenteType[];
    } catch (error) {
        console.error('Error al obtener acompañamientos por rango de fechas:', error);
        throw new Error('No se pudieron cargar los acompañamientos del rango especificado');
    }
};

/**
 * Obtener acompañamientos recientes (últimos N días).
 */
export const getAcompanamientosRecientes = async (diasAtras: number = 30): Promise<AcompanamientoDocenteType[]> => {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasAtras);
    return getAcompanamientosByDateRange(fechaLimite.toISOString(), new Date().toISOString());
};

/**
 * Buscar acompañamientos por texto (filtro en el cliente).
 */
export const searchAcompanamientos = async (searchTerm: string): Promise<AcompanamientoDocenteType[]> => {
    try {
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


// =================================================================
// HELPERS PARA RÚBRICA PERSONALIZADA
// =================================================================

/**
 * Obtener rúbrica personalizada si existe.
 */
export const getRubricaPersonalizada = async (): Promise<any | null> => {
    try {
        const docRef = doc(db, CONFIGURACION_COLLECTION, 'rubricaAcompanamiento');
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data().rubrica : null;
    } catch (error) {
        console.error('Error al obtener rúbrica personalizada:', error);
        return null; // No es un error crítico, se puede usar la rúbrica por defecto.
    }
};

/**
 * Guardar rúbrica personalizada.
 */
export const saveRubricaPersonalizada = async (rubrica: any): Promise<void> => {
    try {
        const docRef = doc(db, CONFIGURACION_COLLECTION, 'rubricaAcompanamiento');
        await setDoc(docRef, { rubrica, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
        console.error('Error al guardar rúbrica personalizada:', error);
        throw new Error('No se pudo guardar la rúbrica personalizada');
    }
};


// =================================================================
// ESTADÍSTICAS Y REPORTES
// =================================================================

/**
 * Obtener estadísticas de acompañamiento de un docente específico.
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
            return { totalAcompanamientos: 0, promedioGeneral: 0, ultimoAcompanamiento: null, tendencia: 'estable' };
        }

        const calcularPromedio = (acomp: AcompanamientoDocenteType) => {
            const puntos = Object.values(acomp.rubricaResultados).reduce((sum, score) => sum + (score || 0), 0);
            const criterios = Object.keys(acomp.rubricaResultados).length;
            return criterios > 0 ? puntos / criterios : 0;
        };

        const promedioGeneral = acompanamientos.reduce((sum, acomp) => sum + calcularPromedio(acomp), 0) / acompanamientos.length;

        let tendencia: 'mejorando' | 'estable' | 'declinando' = 'estable';
        if (acompanamientos.length >= 2) {
            const promedioUltimo = calcularPromedio(acompanamientos[0]);
            const promedioPenultimo = calcularPromedio(acompanamientos[1]);
            if (promedioUltimo > promedioPenultimo + 0.1) tendencia = 'mejorando';
            else if (promedioUltimo < promedioPenultimo - 0.1) tendencia = 'declinando';
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
 * Obtener resumen general de acompañamientos para un dashboard.
 */
export const getResumenAcompanamientos = async (): Promise<{
    totalAcompanamientos: number;
    docentesEvaluados: number;
    promedioGeneralInstitucion: number;
    acompanamientosEsteMes: number;
}> => {
    try {
        const allAcompanamientos = await getAllAcompanamientos();
        const docentesUnicos = new Set(allAcompanamientos.map(a => a.docente));

        let totalPuntos = 0;
        let totalCriterios = 0;
        allAcompanamientos.forEach(acomp => {
            const puntos = Object.values(acomp.rubricaResultados).reduce((sum, score) => sum + (score || 0), 0);
            const criterios = Object.keys(acomp.rubricaResultados).length;
            totalPuntos += puntos;
            totalCriterios += criterios;
        });
        const promedioGeneral = totalCriterios > 0 ? totalPuntos / totalCriterios : 0;

        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);
        const acompanamientosEsteMes = allAcompanamientos.filter(acomp => new Date(acomp.fecha) >= inicioMes).length;

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
