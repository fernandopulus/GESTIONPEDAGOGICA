import { db } from './config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface ResultadoEnsayo {
  estudianteId: string;
  estudianteNombre: string;
  indicadores: number[]; // 10 valores 7.0/2.0
  promedio: number | null;
  ausente?: boolean;
}

export interface EvaluacionEnsayoData {
  curso: string; // normalizado (p.ej., 2ºA)
  asignatura: string;
  profesorId: string;
  profesorNombre: string;
  creadorId: string;
  creadorNombre: string;
  fecha: string; // ISO
  resultados: ResultadoEnsayo[];
}

export async function guardarEvaluacionEnsayo(data: EvaluacionEnsayoData) {
  const col = collection(db, 'ensayo_evaluaciones');
  // Guardamos documento principal con estructura plana
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
    tipo: 'evaluacion_ensayo',
    indicadores: 10,
  };
  const ref = await addDoc(col, payload);
  return ref.id;
}
