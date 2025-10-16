import { db } from './config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, Timestamp, DocumentData, doc, updateDoc, deleteDoc } from 'firebase/firestore';

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

export type EvaluacionEnsayoDoc = EvaluacionEnsayoData & {
  id: string;
  createdAt?: Timestamp | null;
  tipo?: string;
  indicadores?: number;
};

/**
 * Lista evaluaciones de ensayo guardadas, ordenadas por createdAt desc.
 * Para evitar requerir índices compuestos, los filtros se aplican client-side.
 */
export async function listarEvaluacionesEnsayo(params?: {
  max?: number;
  filtroCurso?: string;
  filtroAsignatura?: string;
  filtroProfesorId?: string;
  filtroCreadorId?: string;
}): Promise<EvaluacionEnsayoDoc[]> {
  const col = collection(db, 'ensayo_evaluaciones');
  const q = query(col, orderBy('createdAt', 'desc'), limit(params?.max ?? 100));
  const snap = await getDocs(q);
  const rows: EvaluacionEnsayoDoc[] = [];
  snap.forEach((doc) => {
    const d = doc.data() as DocumentData;
    rows.push({ id: doc.id, ...(d as EvaluacionEnsayoData), createdAt: (d.createdAt as Timestamp) ?? null, tipo: d.tipo, indicadores: d.indicadores });
  });
  // Filtros en cliente (opcionales)
  let filtered = rows;
  if (params?.filtroCurso) filtered = filtered.filter(r => (r.curso || '').toUpperCase() === params!.filtroCurso!.toUpperCase());
  if (params?.filtroAsignatura) filtered = filtered.filter(r => (r.asignatura || '') === params!.filtroAsignatura);
  if (params?.filtroProfesorId) filtered = filtered.filter(r => (r.profesorId || '') === params!.filtroProfesorId);
  if (params?.filtroCreadorId) filtered = filtered.filter(r => (r.creadorId || '') === params!.filtroCreadorId);
  return filtered;
}

function sanitize(obj: any): any {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === 'object') {
    const out: any = {};
    Object.entries(obj).forEach(([k, v]) => {
      const sv = sanitize(v as any);
      if (sv !== undefined) out[k] = sv;
    });
    return out;
  }
  return obj;
}

export async function actualizarEvaluacionEnsayo(id: string, data: Partial<EvaluacionEnsayoData>) {
  const ref = doc(db, 'ensayo_evaluaciones', id);
  const payload = sanitize({ ...data });
  await updateDoc(ref, payload as any);
}

export async function eliminarEvaluacionEnsayo(id: string) {
  const ref = doc(db, 'ensayo_evaluaciones', id);
  await deleteDoc(ref);
}
