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
  orderBy,
  writeBatch
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

/**
 * Actualiza las horas de contrato de un docente existente.
 * @param docenteId El ID del docente a actualizar.
 * @param horasContrato Las nuevas horas de contrato.
 * @returns Promise<void>
 */
export const actualizarHorasContrato = async (docenteId: string, horasContrato: number): Promise<void> => {
  try {
    const docRef = doc(db, USUARIOS_COLLECTION, docenteId);
    await setDoc(docRef, {
      horasContrato,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`Horas de contrato actualizadas para ${docenteId}: ${horasContrato}h`);
  } catch (error) {
    console.error("Error al actualizar horas de contrato:", error);
    throw new Error("No se pudieron actualizar las horas de contrato.");
  }
};

/**
 * Elimina un docente de Firestore.
 * @param id El ID del docente a eliminar.
 */
export const eliminarDocente = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, USUARIOS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error al eliminar docente:", error);
    throw new Error("No se pudo eliminar el docente.");
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

// --- UTILIDADES INTERNAS ---
const cleanUndefined = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => cleanUndefined(v));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = cleanUndefined(value);
      }
      return acc;
    }, {} as any);
  }
  return obj;
};

/**
 * Guarda todas las asignaciones en batch (útil para importación).
 * @param asignaciones Array de asignaciones a guardar.
 * @param reemplazarTodo Si es true, elimina todas las asignaciones existentes antes de agregar las nuevas.
 */
export const saveAsignacionesBatch = async (
  asignaciones: (AsignacionCargaHoraria | Omit<AsignacionCargaHoraria, 'id'>)[],
  reemplazarTodo: boolean = false
): Promise<void> => {
  try {
    // Obtener todas las asignaciones existentes si vamos a reemplazarlas
    if (reemplazarTodo) {
      const querySnapshot = await getDocs(collection(db, ASIGNACIONES_CARGA_COLLECTION));
      const existingDocs = new Map(querySnapshot.docs.map(doc => [doc.id, doc.ref]));
      
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      const commitBatch = async () => {
        if (operationCount > 0) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      };

      // 1. Actualizar o Crear
      for (const asignacion of asignaciones) {
        const asig = asignacion as any;
        // Verificar si es un documento existente válido por ID exacto en Firestore
        const esExistente = !!asig.id && existingDocs.has(asig.id);

        if (esExistente) {
          // Actualizar existente
          const docRef = existingDocs.get(asig.id)!;
          const { id, ...data } = asig;
          const cleanData = cleanUndefined(data);
          
          // FIX: Asegurar que horasPorCurso se procese correctamente
          // Forzamos la inclusión directa para evitar que cleanUndefined elimine algo indebido
          // o que se pierda en la limpieza si es un objeto vacío
          if (asig.horasPorCurso) {
            // Copia profunda para asegurar que es un objeto plano y evitar referencias extrañas
            const horasCopy = JSON.parse(JSON.stringify(asig.horasPorCurso));
            cleanData.horasPorCurso = horasCopy;
            console.log(`[saveAsignacionesBatch] Actualizando ${asig.docenteNombre} (docId=${docRef.id}):`, horasCopy);
          }

          currentBatch.set(docRef, { ...cleanData, updatedAt: serverTimestamp() }, { merge: true });
          existingDocs.delete(asig.id); // Marcar como procesado (no eliminar)
        } else {
          // Crear nuevo
          const newDocRef = doc(collection(db, ASIGNACIONES_CARGA_COLLECTION));
          const { id, ...data } = asig; // Ignoramos ID temporal
          const cleanData = cleanUndefined(data);

          if (asig.horasPorCurso) {
            // Copia profunda para asegurar que es un objeto plano
            const horasCopy = JSON.parse(JSON.stringify(asig.horasPorCurso));
            cleanData.horasPorCurso = horasCopy;
            console.log(`[saveAsignacionesBatch] Creando ${asig.docenteNombre}:`, horasCopy);
          }

          currentBatch.set(newDocRef, { ...cleanData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }

        operationCount++;
        if (operationCount >= 450) await commitBatch();
      }

      // 2. Eliminar los restantes (que estaban en Firestore pero no en la nueva lista)
      for (const [id, ref] of existingDocs) {
        currentBatch.delete(ref);
        operationCount++;
        if (operationCount >= 450) await commitBatch();
      }

      // Commit final
      await commitBatch();
      console.log("Sincronización de asignaciones completada exitosamente.");
      return;
    }
    
    // Agregar nuevas asignaciones (modo append legacy)
    const addPromises = asignaciones.map(asignacion => {
      const cleanData = cleanUndefined(asignacion);
      
      // FIX: Asegurar horasPorCurso también en modo legacy
      if ((asignacion as any).horasPorCurso) {
        cleanData.horasPorCurso = JSON.parse(JSON.stringify((asignacion as any).horasPorCurso));
      }

      return addDoc(collection(db, ASIGNACIONES_CARGA_COLLECTION), {
        ...cleanData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    
    await Promise.all(addPromises);
    console.log(`Se guardaron ${addPromises.length} asignaciones`);
    
  } catch (error) {
    console.error("Error al guardar asignaciones en batch:", error);
    throw error; // Re-lanzar para que el componente lo capture
  }
};

// --- UTILIDADES DE CÁLCULO ---

export const TEACHING_TO_CONTRACT_MAP: Record<number, number> = {
  38: 44,
  37: 43,
  36: 42,
  35: 40,
  34: 39,
  33: 38,
  32: 37,
  31: 36,
  30: 35,
  29: 33,
  28: 32,
  27: 31,
  26: 30,
  25: 29,
  24: 28,
  23: 27,
  22: 25,
  21: 24,
  20: 23,
  19: 22,
  18: 21,
  17: 20,
  16: 18,
  15: 17,
  14: 16,
  13: 15,
  12: 14,
  11: 13,
  10: 11,
  9: 10,
  8: 9,
  7: 8,
  6: 7,
  5: 6,
  4: 5,
  3: 4,
  2: 4,
  1: 1
};

export const calculateRequiredContractHours = (teachingHours: number): number => {
  const contractHours = TEACHING_TO_CONTRACT_MAP[teachingHours];
  if (contractHours === undefined) {
     throw new Error(`No contract hours defined for ${teachingHours} teaching hours.`);
  }
  return contractHours;
};

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
 * Calcula las horas no lectivas disponibles (remanente) basado en el contrato y las horas lectivas máximas.
 * Retorna el valor en horas pedagógicas (45 min).
 */
export const calcularHB = (horasContrato: number): number => {
  const HA = calcularHA(horasContrato);
  const minutosContrato = horasContrato * 60;
  const minutosClases = HA * 45;
  const minutosRestantes = minutosContrato - minutosClases;
  return parseFloat((minutosRestantes / 45).toFixed(1));
};

/**
 * Suma las horas por curso de una asignación.
 */
export const sumarHorasCursos = (horasPorCurso: Partial<Record<CursoId, number>>): number => {
  return Object.values(horasPorCurso).reduce((sum, horas) => sum + (horas || 0), 0);
};

/**
 * Calcula los totales de un docente basado en sus asignaciones.
 * Ajuste: Contrato (cronológico) vs Clases/Funciones (pedagógicas 45 min).
 * Ajuste 2: "Otras Funciones" se consideran horas lectivas (suman a HA).
 */
export const calcularTotalesDocente = (
  docente: DocenteCargaHoraria, 
  asignaciones: AsignacionCargaHoraria[]
): TotalesDocenteCarga => {
  // 1. HA (Max Horas Lectivas - Clases + Otras Funciones) según tabla oficial
  const HA = calcularHA(docente.horasContrato);
  
  const asignacionesDocente = asignaciones.filter(a => a.docenteId === docente.id);
  
  // 2. Calcular horas por cursos (Clases - Pedagógicas)
  const sumCursos = asignacionesDocente.reduce((sum, asig) => sum + sumarHorasCursos(asig.horasPorCurso), 0);
  
  // 3. Calcular horas de otras funciones (Pedagógicas)
  // AHORA: Se consideran parte de la carga lectiva (HA)
  const sumFunciones = asignacionesDocente.reduce((sum, asig) => {
    if (asig.funcionesLectivas && asig.funcionesLectivas.length > 0) {
      return sum + asig.funcionesLectivas.reduce((funcSum, func) => funcSum + func.horas, 0);
    }
    else if (asig.funcionesNoLectivas && asig.funcionesNoLectivas.length > 0) {
      return sum + asig.funcionesNoLectivas.reduce((funcSum, func) => funcSum + func.horas, 0);
    } 
    else {
      const horas = asig.otraFuncion ? parseInt(asig.otraFuncion) || 0 : 0;
      return sum + horas;
    }
  }, 0);
  
  // Total de horas lectivas (Clases + Otras Funciones)
  const totalHorasLectivas = sumCursos + sumFunciones;

  // 4. Conversión a minutos para cálculo exacto
  const minutosContrato = docente.horasContrato * 60;
  const minutosLectivos = totalHorasLectivas * 45; // Clases + Funciones
  
  const minutosRestantesParaHB = minutosContrato - minutosLectivos;
  
  // 5. HB (Capacidad Disponible para No Lectivas REALES - recreos, planificación, etc.)
  // Es el remanente del contrato después de lo lectivo asignado
  const HB = parseFloat((minutosRestantesParaHB / 45).toFixed(1));
  
  // 6. Restantes
  const restantesHA = HA - totalHorasLectivas;
  const restantesHB = HB; // HB es lo que queda disponible
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validación 1: Total Lectivo (Clases + Funciones) no debe superar el 65% (HA)
  if (totalHorasLectivas > HA) {
    errors.push(`Excede horas lectivas (Clases + Funciones): ${totalHorasLectivas}/${HA}`);
  }

  // Validación 2: Total asignado no debe superar el contrato
  if (minutosLectivos > minutosContrato) {
    const exceso = ((minutosLectivos - minutosContrato) / 45).toFixed(1);
    errors.push(`Excede contrato total por ${exceso} hrs ped.`);
  }
  
  if (totalHorasLectivas < HA && totalHorasLectivas > 0) {
    warnings.push(`Faltan ${restantesHA} horas lectivas`);
  }
  
  return {
    HA,
    HB,
    sumCursos,
    sumFunciones,
    sumFuncionesLectivas: sumFunciones, 
    totalHorasLectivas: totalHorasLectivas,      
    restantesHA,
    restantesHB,
    horasContrato: docente.horasContrato,
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
