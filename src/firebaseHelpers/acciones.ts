// src/firebaseHelpers/acciones.ts
// Drop-in replacement: mantiene los mismos nombres de funciones (getAllAcciones, createAccion, updateAccion, deleteAccion)
// Compatible con tus registros antiguos (area/enlaceDocumento) y con el nuevo esquema PME.

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';
import { ESTADOS_ACCION_PME, EstadoAccionPME } from '../../constants';

export interface AccionPME {
  id: string;
  fechaRegistro: string;      // YYYY-MM-DD
  responsable: string;
  dimension: string;          // PME dimension
  subdimension: string;       // PME subdimension
  descripcion: string;
  objetivos?: string;
  indicadores?: string[];
  cobertura?: string;
  fechaInicio?: string;       // YYYY-MM-DD
  fechaCumplimiento: string;  // YYYY-MM-DD
  estado: EstadoAccionPME;
  avance?: number;            // 0-100
  enlaces?: string[];         // evidencias (URLs)
  creadoTs?: number;          // epoch ms
}

// ===== Compatibilidad hacia atrás =====
type LegacyDoc = {
  fechaRegistro?: string;
  responsable?: string;
  area?: string;
  descripcion?: string;
  fechaCumplimiento?: string;
  estado?: string;
  enlaceDocumento?: string;
  creadoTs?: any;
};

// Ajusta el nombre si tu colección histórica es otra
const COLL_PRIMARY = 'acciones_pedagogicas';

const normalize = (id: string, data: any): AccionPME => {
  // Esquema v2 (PME)
  if (data.dimension || data.subdimension || data.indicadores || data.avance !== undefined) {
    return {
      id,
      fechaRegistro: data.fechaRegistro ?? '',
      responsable: data.responsable ?? '',
      dimension: data.dimension ?? '',
      subdimension: data.subdimension ?? '',
      descripcion: data.descripcion ?? '',
      objetivos: data.objetivos ?? '',
      indicadores: Array.isArray(data.indicadores) ? data.indicadores : (data.indicadores ? String(data.indicadores).split(',').map((s:string)=>s.trim()).filter(Boolean) : []),
      cobertura: data.cobertura ?? '',
      fechaInicio: data.fechaInicio ?? '',
      fechaCumplimiento: data.fechaCumplimiento ?? '',
      estado: (data.estado ?? 'Pendiente') as EstadoAccionPME,
      avance: typeof data.avance === 'number' ? data.avance : 0,
      enlaces: Array.isArray(data.enlaces) ? data.enlaces : (data.enlaces ? [String(data.enlaces)] : []),
      creadoTs: typeof data.creadoTs === 'number' ? data.creadoTs : (data.creadoTs?.toMillis?.() ?? Date.now()),
    };
  }

  // Esquema v1 (legacy)
  const l = data as LegacyDoc;
  const enlace = l.enlaceDocumento ? [String(l.enlaceDocumento)] : [];
  return {
    id,
    fechaRegistro: l.fechaRegistro ?? '',
    responsable: l.responsable ?? '',
    dimension: l.area ?? '',
    subdimension: '',
    descripcion: l.descripcion ?? '',
    objetivos: '',
    indicadores: [],
    cobertura: '',
    fechaInicio: '',
    fechaCumplimiento: l.fechaCumplimiento ?? '',
    estado: ((l.estado as EstadoAccionPME) ?? 'Pendiente'),
    avance: 0,
    enlaces: enlace,
    creadoTs: typeof l.creadoTs === 'number' ? l.creadoTs : (l.creadoTs?.toMillis?.() ?? Date.now()),
  };
};

export async function getAllAcciones(): Promise<AccionPME[]> {
  const rows: AccionPME[] = [];
  try {
    const q1 = query(collection(db, COLL_PRIMARY), orderBy('creadoTs', 'desc'));
    const s1 = await getDocs(q1);
    s1.docs.forEach(d => rows.push(normalize(d.id, d.data())));
  } catch (_e) {
    // si no existe la colección, retorna vacío
  }
  return rows.sort((a,b)=> (b.creadoTs ?? 0) - (a.creadoTs ?? 0));
}

// create con esquema PME en la colección histórica
export async function createAccion(data: Partial<AccionPME>) {
  const payload: any = {
    fechaRegistro: data.fechaRegistro ?? new Date().toISOString().slice(0,10),
    responsable: data.responsable ?? '',
    dimension: (data as any).dimension ?? (data as any).area ?? '',
    subdimension: (data as any).subdimension ?? '',
    descripcion: data.descripcion ?? '',
    objetivos: (data as any).objetivos ?? '',
    indicadores: Array.isArray((data as any).indicadores) ? (data as any).indicadores : ((data as any).indicadores ? String((data as any).indicadores).split(',').map((s:string)=>s.trim()).filter(Boolean) : []),
    cobertura: (data as any).cobertura ?? '',
    fechaInicio: (data as any).fechaInicio ?? '',
    fechaCumplimiento: data.fechaCumplimiento ?? '',
    estado: ((data.estado as EstadoAccionPME) ?? 'Pendiente'),
    avance: typeof (data as any).avance === 'number' ? (data as any).avance : 0,
    enlaces: Array.isArray((data as any).enlaces) ? (data as any).enlaces : ((data as any).enlaces ? [String((data as any).enlaces)] : ((data as any).enlaceDocumento ? [String((data as any).enlaceDocumento)] : [])),
    creadoTs: Timestamp.now(),
  };
  await addDoc(collection(db, COLL_PRIMARY), payload);
}

export async function updateAccion(id: string, patch: Partial<AccionPME>) {
  const ref = doc(collection(db, COLL_PRIMARY), id);
  const toPatch: any = { ...patch };
  // Normaliza campos comunes
  if ((toPatch as any).area && !toPatch.dimension) {
    toPatch.dimension = (toPatch as any).area;
    delete (toPatch as any).area;
  }
  if ((toPatch as any).enlaceDocumento) {
    toPatch.enlaces = [String((toPatch as any).enlaceDocumento)];
    delete (toPatch as any).enlaceDocumento;
  }
  if (Array.isArray(toPatch.indicadores) === false && typeof toPatch.indicadores === 'string') {
    toPatch.indicadores = String(toPatch.indicadores).split(',').map(s=>s.trim()).filter(Boolean);
  }
  await updateDoc(ref, toPatch as any);
}

export async function deleteAccion(id: string) {
  const ref = doc(collection(db, COLL_PRIMARY), id);
  await deleteDoc(ref);
}
