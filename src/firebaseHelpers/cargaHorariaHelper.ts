// src/firebaseHelpers/cargaHorariaHelper.ts
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  getDoc,
  getDocs,
  setDoc,
  where,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from './config';
import { AsignacionCargaHoraria, DocenteCargaHoraria, ValidationResultCarga, TotalesDocenteCarga, CursoId } from '../../types';

// --- CONSTANTES DE COLECCIONES ---
const ASIGNACIONES_CARGA_COLLECTION = 'carga_horaria_asignaciones';
const USUARIOS_COLLECTION = 'usuarios';

// --- HELPERS DE CONVERSIÓN ---
const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
  } as T;
};

// --- GESTIÓN DE DOCENTES ---

/**
 * Se suscribe en tiempo real a la lista de usuarios con perfiles relevantes para la carga horaria.
 * @param callback La función que se ejecutará con los datos actualizados.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToDocentes = (callback: (data: DocenteCargaHoraria[]) => void) => {
  // Incluimos PROFESORADO, SUBDIRECCION y COORDINACION_TP
  const q = query(
    collection(db, USUARIOS_COLLECTION), 
    where("profile", "in", ["PROFESORADO", "SUBDIRECCION", "COORDINACION_TP"]),
    orderBy("nombreCompleto", "asc")
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const docentes = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        nombre: data.nombreCompleto || data.nombre || data.email || "Sin nombre",
        departamento: data.departamento || "General",
        horasContrato: data.horasContrato || 44,
        perfil: data.profile || "PROFESORADO",
        email: data.email
      };
    });
    callback(docentes);
  }, (error) => {
    console.error("Error al suscribirse a los docentes:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Crea un nuevo docente en Firestore.
 * @param docenteData Los datos del docente a crear.
 * @returns El ID del nuevo documento.
 */
export const crearNuevoDocente = async (docenteData: {
  nombre: string;
  email: string;
  departamento?: string;
  horasContrato: number;
  perfil: "PROFESORADO" | "SUBDIRECCION" | "COORDINACION_TP";
}): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, USUARIOS_COLLECTION), {
      nombreCompleto: docenteData.nombre,
      email: docenteData.email,
      departamento: docenteData.departamento || "General",
      horasContrato: docenteData.horasContrato,
      profile: docenteData.perfil,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error al crear nuevo docente:", error);
    throw new Error("No se pudo crear el docente.");
  }
};

// --- GESTIÓN DE ASIGNACIONES ---

/**
 * Se suscribe en tiempo real a la lista de asignaciones de carga horaria.
 * @param callback La función que se ejecutará con los datos actualizados.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToAsignacionesCarga = (callback: (data: AsignacionCargaHoraria[]) => void) => {
  const q = query(collection(db, ASIGNACIONES_CARGA_COLLECTION), orderBy("docenteNombre", "asc"));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const asignaciones = querySnapshot.docs.map(doc => convertFirestoreDoc<AsignacionCargaHoraria>(doc));
    callback(asignaciones);
  }, (error) => {
    console.error("Error al suscribirse a las asignaciones:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Agrega una nueva asignación de carga horaria a Firestore.
 * @param asignacionData Los datos de la asignación a crear.
 * @returns El ID del nuevo documento.
 */
export const addAsignacionCarga = async (asignacionData: Omit<AsignacionCargaHoraria, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, ASIGNACIONES_CARGA_COLLECTION), {
      ...asignacionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error al agregar asignación:", error);
    throw new Error("No se pudo agregar la asignación.");
  }
};

/**
 * Actualiza una asignación de carga horaria existente.
 * @param id El ID de la asignación a actualizar.
 * @param asignacionData Los datos actualizados.
 */
export const updateAsignacionCarga = async (id: string, asignacionData: Partial<AsignacionCargaHoraria>): Promise<void> => {
  try {
    const docRef = doc(db, ASIGNACIONES_CARGA_COLLECTION, id);
    await setDoc(docRef, {
      ...asignacionData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error al actualizar asignación:", error);
    throw new Error("No se pudo actualizar la asignación.");
  }
};

/**
 * Elimina una asignación de carga horaria de Firestore.
 * @param id El ID de la asignación a eliminar.
 */
export const deleteAsignacionCarga = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, ASIGNACIONES_CARGA_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error al eliminar asignación:", error);
    throw new Error("No se pudo eliminar la asignación.");
  }
};

/**
 * Guarda todas las asignaciones en batch (útil para importación).
 * @param asignaciones Array de asignaciones a guardar.
 * @param reemplazarTodo Si es true, elimina todas las asignaciones existentes antes de agregar las nuevas.
 */
export const saveAsignacionesBatch = async (
  asignaciones: Omit<AsignacionCargaHoraria, 'id'>[],
  reemplazarTodo: boolean = false
): Promise<void> => {
  try {
    // Obtener todas las asignaciones existentes si vamos a reemplazarlas
    if (reemplazarTodo) {
      const querySnapshot = await getDocs(collection(db, ASIGNACIONES_CARGA_COLLECTION));
      
      // Eliminar las asignaciones existentes antes de agregar nuevas
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`Se eliminaron ${deletePromises.length} asignaciones existentes`);
    }
    
    // Agregar nuevas asignaciones
    const addPromises = asignaciones.map(asignacion => 
      addDoc(collection(db, ASIGNACIONES_CARGA_COLLECTION), {
        ...asignacion,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
    
    await Promise.all(addPromises);
    console.log(`Se guardaron ${addPromises.length} asignaciones`);
    
  } catch (error) {
    console.error("Error al guardar asignaciones en batch:", error);
    throw new Error("No se pudieron guardar todas las asignaciones.");
  }
};

// --- UTILIDADES DE CÁLCULO ---

/**
 * Calcula las horas lectivas basado en el contrato según la tabla oficial.
 */
export const calcularHA = (horasContrato: number): number => {
  // Tabla oficial de horas lectivas
  const tablaHorasLectivas: Record<number, number> = {
    44: 38, 43: 37, 42: 36, 41: 35, 40: 35, 39: 34, 38: 33, 37: 32,
    36: 31, 35: 30, 34: 29, 33: 29, 32: 28, 31: 27, 30: 26, 29: 25,
    28: 24, 27: 23, 26: 22, 25: 22, 24: 21, 23: 20, 22: 19, 21: 18,
    20: 17, 19: 16, 18: 16, 17: 15, 16: 14, 15: 13, 14: 12, 13: 11,
    12: 10, 11: 10, 10: 9, 9: 8, 8: 7, 7: 6, 6: 5, 5: 4, 4: 3, 3: 2, 2: 1, 1: 1
  };
  
  // Si la cantidad de horas está en la tabla, devolvemos el valor correspondiente
  if (tablaHorasLectivas[horasContrato] !== undefined) {
    return tablaHorasLectivas[horasContrato];
  }
  
  // Si no está en la tabla (caso poco común), usamos el 65%
  return Math.round(horasContrato * 0.65);
};

/**
 * Calcula las horas no lectivas basado en el contrato y las horas lectivas.
 */
export const calcularHB = (horasContrato: number): number => {
  // Las horas no lectivas son la diferencia entre el total y las lectivas
  const horasLectivas = calcularHA(horasContrato);
  return horasContrato - horasLectivas;
};

/**
 * Suma las horas por curso de una asignación.
 */
export const sumarHorasCursos = (horasPorCurso: Partial<Record<CursoId, number>>): number => {
  return Object.values(horasPorCurso).reduce((sum, horas) => sum + (horas || 0), 0);
};

/**
 * Calcula los totales de un docente basado en sus asignaciones.
 */
export const calcularTotalesDocente = (
  docente: DocenteCargaHoraria, 
  asignaciones: AsignacionCargaHoraria[]
): TotalesDocenteCarga => {
  const HA = calcularHA(docente.horasContrato);
  const HB = calcularHB(docente.horasContrato);
  
  const asignacionesDocente = asignaciones.filter(a => a.docenteId === docente.id);
  
  // Calcular horas por cursos
  const sumCursos = asignacionesDocente.reduce((sum, asig) => sum + sumarHorasCursos(asig.horasPorCurso), 0);
  
  // Calcular horas de funciones lectivas (sumadas a HA)
  const sumFuncionesLectivas = asignacionesDocente.reduce((sum, asig) => {
    // Usar funcionesLectivas si existen
    if (asig.funcionesLectivas && asig.funcionesLectivas.length > 0) {
      return sum + asig.funcionesLectivas.reduce((funcSum, func) => funcSum + func.horas, 0);
    }
    // Para compatibilidad, revisar si hay funcionesNoLectivas (campo antiguo)
    else if (asig.funcionesNoLectivas && asig.funcionesNoLectivas.length > 0) {
      return sum + asig.funcionesNoLectivas.reduce((funcSum, func) => funcSum + func.horas, 0);
    } 
    // Caso de compatibilidad con el campo anterior (otraFuncion)
    else {
      const horas = asig.otraFuncion ? parseInt(asig.otraFuncion) || 0 : 0;
      return sum + horas;
    }
  }, 0);
  
  // Total de horas lectivas es la suma de horas por cursos + horas de funciones lectivas
  const totalHorasLectivas = sumCursos + sumFuncionesLectivas;
  
  // No hay funciones no lectivas, todas las funciones son lectivas
  const sumFunciones = 0;
  
  const restantesHA = HA - totalHorasLectivas;
  const restantesHB = HB - sumFunciones;
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (totalHorasLectivas > HA) {
    errors.push(`Excede horas lectivas: ${totalHorasLectivas}/${HA}`);
  }
  if (sumFunciones > HB) {
    errors.push(`Excede horas no lectivas: ${sumFunciones}/${HB}`);
  }
  if (totalHorasLectivas < HA && totalHorasLectivas > 0) {
    warnings.push(`Faltan ${restantesHA} horas lectivas`);
  }
  if (sumFunciones < HB && sumFunciones > 0) {
    warnings.push(`Faltan ${restantesHB} horas no lectivas`);
  }
  
  return {
    HA,
    HB,
    sumCursos,
    sumFunciones,
    sumFuncionesLectivas,
    totalHorasLectivas,
    restantesHA,
    restantesHB,
    valido: errors.length === 0,
    warnings,
    errors
  };
};

/**
 * Valida un docente y sus asignaciones.
 */
export const validarDocente = (
  docente: DocenteCargaHoraria, 
  asignaciones: AsignacionCargaHoraria[]
): ValidationResultCarga[] => {
  const totales = calcularTotalesDocente(docente, asignaciones);
  const results: ValidationResultCarga[] = [];
  
  totales.errors.forEach(error => {
    results.push({
      asignacionId: '',
      docenteId: docente.id,
      tipo: 'error',
      mensaje: `${docente.nombre}: ${error}`
    });
  });
  
  totales.warnings.forEach(warning => {
    results.push({
      asignacionId: '',
      docenteId: docente.id,
      tipo: 'warning',
      mensaje: `${docente.nombre}: ${warning}`
    });
  });
  
  return results;
};

/**
 * Normaliza encabezados de curso (1A → 1ºA).
 */
export const normalizarHeaderCurso = (header: string): string => {
  const match = header.match(/^(\d+)([A-E])$/i);
  if (match) {
    return `${match[1]}º${match[2].toUpperCase()}`;
  }
  return header;
};
