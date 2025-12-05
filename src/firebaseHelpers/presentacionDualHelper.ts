import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import {
  PresentacionDualEvaluation,
  PresentacionDualRubricSelection,
  Profile,
} from '../../types';
import {
  PRESENTACION_DUAL_INDICADORES,
  PRESENTACION_DUAL_MAX_SCORE,
  PRESENTACION_DUAL_EXIGENCIA,
} from '../../constants/presentacionDualRubric';
import {
  calcularNotaPresentacionDual,
  determinarEstadoPresentacionDual,
  isRubricComplete,
  sumRubricScore,
} from '../utils/presentacionDual';

const COLLECTION = 'presentacion_dual_evaluaciones';

const collectionRef = collection(db, COLLECTION);

const normalizeRubric = (rubric: PresentacionDualRubricSelection[] = []): PresentacionDualRubricSelection[] => {
  const rubricById = new Map(rubric.map(item => [item.indicadorId, item]));

  return PRESENTACION_DUAL_INDICADORES.map(indicador => {
    const existing = rubricById.get(indicador.id);

    return {
      indicadorId: indicador.id,
      nivel: existing?.nivel ?? 'DEBIL',
      puntaje: existing?.puntaje ?? 0,
      comentario: existing?.comentario,
      updatedAt: existing?.updatedAt,
      updatedBy: existing?.updatedBy,
    };
  });
};

const toIsoString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return undefined;
};

const withComputedScores = (data: Partial<PresentacionDualEvaluation>) => {
  const rubric = normalizeRubric(data.rubric ?? []);
  const puntajeTotal = sumRubricScore(rubric);
  const puntajeMaximo = data.puntajeMaximo ?? PRESENTACION_DUAL_MAX_SCORE;
  const notaFinal = calcularNotaPresentacionDual(puntajeTotal, puntajeMaximo);
  const estado = determinarEstadoPresentacionDual(
    puntajeTotal,
    puntajeMaximo,
    isRubricComplete(rubric),
    PRESENTACION_DUAL_EXIGENCIA
  );

  return {
    ...data,
    rubric,
    puntajeTotal,
    puntajeMaximo,
    notaFinal,
    notaTexto: notaFinal.toFixed(1),
    exigencia: PRESENTACION_DUAL_EXIGENCIA,
    estado,
  };
};

const mapDocToEvaluation = (docSnap: any): PresentacionDualEvaluation => {
  const data = docSnap.data();
  const evaluation = withComputedScores({ id: docSnap.id, ...data }) as PresentacionDualEvaluation;
  return {
    ...evaluation,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
};

export const subscribeToPresentacionDualEvaluations = (
  callback: (evaluations: PresentacionDualEvaluation[]) => void,
  onError?: (error: unknown) => void
) => {
  const q = query(collectionRef, orderBy('fechaPresentacion', 'desc'));

  return onSnapshot(
    q,
    snapshot => {
      const evaluations = snapshot.docs.map(mapDocToEvaluation);
      callback(evaluations);
    },
    error => {
      console.error('[PresentacionDual] Error en snapshot', error);
      onError?.(error);
      callback([]);
    }
  );
};

interface ActorInfo {
  id?: string;
  nombre?: string;
  profile?: Profile;
}

const stampAudit = (actor?: ActorInfo) =>
  actor
    ? {
        id: actor.id,
        nombre: actor.nombre,
        profile: actor.profile,
      }
    : undefined;

export const createPresentacionDualEvaluation = async (
  data: Omit<PresentacionDualEvaluation, 'id' | 'puntajeTotal' | 'puntajeMaximo' | 'notaFinal' | 'notaTexto' | 'estado' | 'exigencia'>,
  actor?: ActorInfo
): Promise<string> => {
  if (!data.rubric || data.rubric.length === 0) {
    throw new Error('La rúbrica es obligatoria para registrar una evaluación.');
  }
  const payload = withComputedScores({ ...data, creadoPor: stampAudit(actor), actualizadoPor: stampAudit(actor) });
  const docRef = await addDoc(collectionRef, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updatePresentacionDualEvaluation = async (
  id: string,
  updates: Partial<PresentacionDualEvaluation>,
  actor?: ActorInfo
) => {
  const docRef = doc(collectionRef, id);
  const payload = updates.rubric
    ? withComputedScores({ ...updates, actualizadoPor: stampAudit(actor) })
    : { ...updates, actualizadoPor: stampAudit(actor) };
  await updateDoc(docRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const deletePresentacionDualEvaluation = async (id: string) => {
  const docRef = doc(collectionRef, id);
  await deleteDoc(docRef);
};

export const getPresentacionDualEvaluationForStudent = async (
  studentId?: string,
  studentEmail?: string
): Promise<PresentacionDualEvaluation | null> => {
  if (!studentId && !studentEmail) return null;

  const filters = [];
  if (studentId) {
    filters.push(where('estudianteId', '==', studentId));
  }
  if (studentEmail) {
    filters.push(where('estudianteEmail', '==', studentEmail));
  }

  let q = query(collectionRef, orderBy('fechaPresentacion', 'desc'));
  if (filters.length === 1) {
    q = query(collectionRef, filters[0], orderBy('fechaPresentacion', 'desc'));
  } else if (filters.length === 2) {
    q = query(collectionRef, filters[0], filters[1], orderBy('fechaPresentacion', 'desc'));
  }

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  return mapDocToEvaluation(docSnap);
};
