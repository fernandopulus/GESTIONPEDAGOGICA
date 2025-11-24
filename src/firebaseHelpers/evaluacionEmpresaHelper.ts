import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import { EvaluacionEmpresaEstudiante } from '../../types';

const EVALUACIONES_COLLECTION = 'evaluaciones_empresas_dual';

const convertDoc = <T>(snap: any): T => ({ id: snap.id, ...snap.data() } as T);

const sanitizePayload = (data: Record<string, any>) => {
  const sanitized: Record<string, any> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      sanitized[key] = value;
    }
  });
  return sanitized;
};

const normalizeFechaSupervision = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString().slice(0, 10);
    } catch (error) {
      console.warn('No se pudo convertir fecha de supervisión', error);
    }
  }
  return undefined;
};

export const subscribeEvaluacionesEmpresa = (
  callback: (data: Record<string, EvaluacionEmpresaEstudiante[]>) => void
) => {
  const colRef = collection(db, EVALUACIONES_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const map: Record<string, EvaluacionEmpresaEstudiante[]> = {};
      snapshot.forEach((docSnap) => {
        const raw = convertDoc<EvaluacionEmpresaEstudiante>(docSnap);
        if (!raw.estudianteId) return;
        const data: EvaluacionEmpresaEstudiante = {
          ...raw,
          fechaSupervision: normalizeFechaSupervision(raw.fechaSupervision),
        };
        if (!map[data.estudianteId]) {
          map[data.estudianteId] = [];
        }
        map[data.estudianteId].push(data);
      });

      Object.values(map).forEach((lista) => {
        lista.sort((a, b) => {
          const toNumber = (item?: EvaluacionEmpresaEstudiante): number => {
            if (!item) return 0;
            if (item.fechaSupervision) {
              const ts = new Date(item.fechaSupervision).getTime();
              return Number.isNaN(ts) ? 0 : ts;
            }
            const updatedAt = (item.updatedAt as any)?.toMillis?.();
            if (typeof updatedAt === 'number') return updatedAt;
            return 0;
          };
          return toNumber(b) - toNumber(a);
        });
      });
      callback(map);
    },
    (error) => {
      console.error('Error al suscribirse a evaluaciones de empresa:', error);
      callback({});
    }
  );
};

export const saveEvaluacionEmpresa = async (
  evaluacion: EvaluacionEmpresaEstudiante
): Promise<string> => {
  if (!evaluacion.estudianteId) {
    throw new Error('Falta estudianteId en la evaluación');
  }

  if (!evaluacion.fechaSupervision) {
    throw new Error('Falta fecha de supervisión en la evaluación');
  }

  const { id, createdAt, ...rest } = evaluacion;
  const colRef = collection(db, EVALUACIONES_COLLECTION);
  const docRef = id ? doc(db, EVALUACIONES_COLLECTION, id) : doc(colRef);
  const payload = sanitizePayload({
    ...rest,
    updatedAt: serverTimestamp(),
  });

  if (!id) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(docRef, payload, { merge: true });
  return docRef.id;
};
