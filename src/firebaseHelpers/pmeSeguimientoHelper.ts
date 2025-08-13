// src/firebaseHelpers/pmeSeguimientoHelper.ts
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
} from "firebase/firestore";
import { db } from "./config";

import type { EstadoAccionPME } from "../../constants/pme";

export interface AccionPME {
  id: string;
  fechaRegistro: string;      // YYYY-MM-DD
  responsable: string;
  dimension: string;          // clave principal (e.g. "Liderazgo Curricular")
  subdimension: string;       // uno de los items de dimension
  descripcion: string;        // qué se hará
  objetivos?: string;         // propósito, metas cualitativas
  indicadores?: string[];     // lista simple
  cobertura?: string;         // niveles/cursos/matrícula
  fechaInicio?: string;       // YYYY-MM-DD
  fechaCumplimiento: string;  // YYYY-MM-DD
  estado: EstadoAccionPME;
  avance?: number;            // 0-100
  enlaces?: string[];         // evidencias (URLs)
  creadoTs?: number;          // epoch ms
}

const COLL = "pme_acciones";

export const fromFS = (id: string, data: any): AccionPME => {
  return {
    id,
    fechaRegistro: data.fechaRegistro ?? "",
    responsable: data.responsable ?? "",
    dimension: data.dimension ?? "",
    subdimension: data.subdimension ?? "",
    descripcion: data.descripcion ?? "",
    objetivos: data.objetivos ?? "",
    indicadores: Array.isArray(data.indicadores) ? data.indicadores : (data.indicadores ? String(data.indicadores).split(",").map((s:string)=>s.trim()).filter(Boolean) : []),
    cobertura: data.cobertura ?? "",
    fechaInicio: data.fechaInicio ?? "",
    fechaCumplimiento: data.fechaCumplimiento ?? "",
    estado: (data.estado ?? "Pendiente"),
    avance: typeof data.avance === "number" ? data.avance : 0,
    enlaces: Array.isArray(data.enlaces) ? data.enlaces : (data.enlaces ? [String(data.enlaces)] : []),
    creadoTs: typeof data.creadoTs === "number" ? data.creadoTs : (data.creadoTs?.toMillis?.() ?? Date.now()),
  };
};

export async function getAllAccionesPME(): Promise<AccionPME[]> {
  const q = query(collection(db, COLL), orderBy("creadoTs", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => fromFS(d.id, d.data()));
}

export async function createAccionPME(data: Omit<AccionPME, "id"|"creadoTs">) {
  const payload = {
    ...data,
    creadoTs: Timestamp.now(),
  };
  await addDoc(collection(db, COLL), payload);
}

export async function updateAccionPME(id: string, patch: Partial<AccionPME>) {
  const ref = doc(collection(db, COLL), id);
  await updateDoc(ref, patch as any);
}

export async function deleteAccionPME(id: string) {
  const ref = doc(collection(db, COLL), id);
  await deleteDoc(ref);
}

export async function getAccionPME(id: string): Promise<AccionPME | null> {
  const ref = doc(collection(db, COLL), id);
  const d = await getDoc(ref);
  if (!d.exists()) return null;
  return fromFS(d.id, d.data());
}
