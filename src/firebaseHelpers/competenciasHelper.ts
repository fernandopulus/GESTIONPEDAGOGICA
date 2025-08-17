
// src/firebaseHelpers/competenciasHelper.ts
// Helper de Firestore para Evaluación por Competencias EMTP

import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, where, getDoc, getDocs, Timestamp, setDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
  EspecialidadTP, ModuloTP, ResultadoAprendizaje, CriterioEvaluacion, Rubrica,
  Evidencia, EvaluacionRegistro, ConfigEvaluacion, NivelLogro, CEScore
} from '../types/competencias';
import { DEFAULT_CONFIG_EVALUACION, NIVEL_A_PUNTAJE_BASE } from '../../constants/competenciasConstants';

/** ============================
 *  Colecciones
 *  ============================ */
const COL_ESPECIALIDADES = 'tp_especialidades';
const COL_MODULOS       = 'tp_modulos';
const COL_RA            = 'tp_resultados_aprendizaje';
const COL_CE            = 'tp_criterios_evaluacion';
const COL_RUBRICAS      = 'tp_rubricas';
const COL_EVIDENCIAS    = 'tp_evidencias';
const COL_EVALUACIONES  = 'tp_evaluaciones_comp';
const DOC_CONFIG        = 'config_evaluacion/competencias';

/** ============================
 *  Utilidades
 *  ============================ */
export const nowMs = () => Date.now();

export const ensureConfig = async (): Promise<ConfigEvaluacion> => {
  const snap = await getDoc(doc(db, DOC_CONFIG));
  if (snap.exists()) {
    return snap.data() as ConfigEvaluacion;
  }
  await setDoc(doc(db, DOC_CONFIG), DEFAULT_CONFIG_EVALUACION);
  return DEFAULT_CONFIG_EVALUACION;
};

/** Lineal: mapea porcentaje (0..100) a nota en [min..max], fijando que
 *  porcentajeAprobacion -> notaAprobacion, y 0->min, 100->max.
 */
export const porcentajeANota = (
  porcentaje: number,
  config: ConfigEvaluacion
): number => {
  const { escalaMin, escalaMax, porcentajeAprobacion, notaAprobacion } = config;
  // Dos tramos lineales: [0..pA] y [pA..100]
  if (porcentaje <= porcentajeAprobacion) {
    const m = (notaAprobacion - escalaMin) / (porcentajeAprobacion - 0 || 1);
    return Number((escalaMin + m * (porcentaje - 0)).toFixed(1));
  } else {
    const m = (escalaMax - notaAprobacion) / (100 - porcentajeAprobacion || 1);
    return Number((notaAprobacion + m * (porcentaje - porcentajeAprobacion)).toFixed(1));
  }
};

export const calcularDesdeCEScores = async (
  ceIdScores: Record<string, CEScore>,
  ponderacionCE: Record<string, number>
): Promise<{puntajeTotal: number; porcentaje: number; nota: number}> => {
  const config = await ensureConfig();
  // Puntaje máximo considera 100 por CE, ponderado por peso
  let acumulado = 0;
  let total = 0;
  Object.entries(ponderacionCE).forEach(([ceId, peso]) => {
    total += peso; // pesos suman 100
    const score = ceIdScores[ceId];
    const valor = score?.puntaje ?? NIVEL_A_PUNTAJE_BASE['INCIPIENTE'];
    acumulado += (valor * peso) / 100;
  });
  const porcentaje = total ? (acumulado / total) * 100 : 0;
  const nota = porcentajeANota(porcentaje, config);
  return { puntajeTotal: acumulado, porcentaje, nota };
};

/** ============================
 *  CRUD: Estructura Curricular
 *  ============================ */
export const createEspecialidad = (data: Omit<EspecialidadTP,'id'>) =>
  addDoc(collection(db, COL_ESPECIALIDADES), data);

export const subscribeEspecialidades = (cb: (items: (EspecialidadTP & {id:string})[]) => void) => {
  const q = query(collection(db, COL_ESPECIALIDADES), orderBy('nombre'));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({id: d.id, ...(d.data() as any)})));
  });
};

export const createModulo = (data: Omit<ModuloTP,'id'>) =>
  addDoc(collection(db, COL_MODULOS), data);

export const getModulosByEspecialidad = async (especialidadId: string) => {
  const q = query(collection(db, COL_MODULOS), where('especialidadId','==', especialidadId), orderBy('nombre'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as ModuloTP));
};

export const createRA = (data: Omit<ResultadoAprendizaje,'id'>) =>
  addDoc(collection(db, COL_RA), data);

export const getRAByModulo = async (moduloId: string) => {
  const q = query(collection(db, COL_RA), where('moduloId','==', moduloId), orderBy('codigo'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as ResultadoAprendizaje));
};

export const createCE = (data: Omit<CriterioEvaluacion,'id'>) =>
  addDoc(collection(db, COL_CE), data);

export const getCEByRA = async (raId: string) => {
  const q = query(collection(db, COL_CE), where('raId','==', raId), orderBy('codigo'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as CriterioEvaluacion));
};

/** ============================
 *  Rúbricas
 *  ============================ */
export const saveRubrica = async (rubrica: Omit<Rubrica, 'id' | 'updatedAt'> & {id?: string}) => {
  if (rubrica.id) {
    await updateDoc(doc(db, COL_RUBRICAS, rubrica.id), { ...rubrica, updatedAt: nowMs() });
    return rubrica.id;
  } else {
    const ref = await addDoc(collection(db, COL_RUBRICAS), { ...rubrica, updatedAt: nowMs() });
    return ref.id;
  }
};

export const getRubricaByRA = async (raId: string) => {
  const q = query(collection(db, COL_RUBRICAS), where('raId','==', raId));
  const snap = await getDocs(q);
  const d = snap.docs[0];
  return d ? ({id: d.id, ...(d.data() as any)} as Rubrica) : null;
};

/** ============================
 *  Evidencias
 *  ============================ */
export const uploadEvidencia = async (file: File, path: string) => {
  const storageRef = ref(storage, path);
  const up = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(up.ref);
  return { url, path: up.ref.fullPath };
};

export const saveEvidencia = (data: Omit<Evidencia,'id'>) =>
  addDoc(collection(db, COL_EVIDENCIAS), data);

export const subscribeEvidenciasByRA = (raId: string, cb: (items: (Evidencia & {id:string})[]) => void) => {
  const q = query(collection(db, COL_EVIDENCIAS), where('raId','==', raId), orderBy('fecha','desc'));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({id: d.id, ...(d.data() as any)})));
  });
};

/** ============================
 *  Evaluaciones
 *  ============================ */
export const saveEvaluacion = async (data: Omit<EvaluacionRegistro,'id'|'puntajeTotal'|'porcentaje'|'nota'>) => {
  // Obtener rúbrica para ponderaciones
  const rubrica = await getRubricaByRA(data.raId);
  const ponderacionCE = rubrica?.ponderacionCE ?? {};
  const { puntajeTotal, porcentaje, nota } = await calcularDesdeCEScores(data.ceIdScores, ponderacionCE);
  return addDoc(collection(db, COL_EVALUACIONES), {
    ...data,
    puntajeTotal,
    porcentaje,
    nota
  });
};

export const subscribeEvaluacionesByRA = (raId: string, cb: (items: (EvaluacionRegistro & {id:string})[]) => void) => {
  const q = query(collection(db, COL_EVALUACIONES), where('raId','==', raId), orderBy('fecha','desc'));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({id: d.id, ...(d.data() as any)})));
  });
};

export const subscribeEvaluacionesByCurso = (curso: string, cb: (items: (EvaluacionRegistro & {id:string})[]) => void) => {
  const q = query(collection(db, COL_EVALUACIONES), where('curso','==', curso), orderBy('fecha','desc'));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({id: d.id, ...(d.data() as any)})));
  });
};

/** ============================
 *  Config
 *  ============================ */
export const setConfigEvaluacion = async (config: Partial<ConfigEvaluacion>) => {
  const current = await ensureConfig();
  await setDoc(doc(db, DOC_CONFIG), { ...current, ...config }, { merge: true });
};

