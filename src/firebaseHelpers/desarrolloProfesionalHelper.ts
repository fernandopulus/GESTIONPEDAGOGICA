
// src/firebaseHelpers/desarrolloProfesionalHelper.ts
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";

// Tipos locales para evitar dependencia fuerte
export type PerfilCreador = "PROFESORADO" | "SUBDIRECCION";

export type DPDQuestion =
  | {
      id: string;
      tipo: "abierta";
      enunciado: string;
      maxPalabras?: number; // default 500
    }
  | {
      id: string;
      tipo: "seleccion_multiple";
      enunciado: string;
      opciones: string[]; // al menos 3-5
      multiple?: boolean; // si permite seleccionar varias
    };

export interface DPDActivity {
  id: string;
  titulo: string;
  dimension: string;      // clave de PME_DIMENSIONES
  subdimension: string;   // item dentro de la dimensión
  creadorId: string;
  creadorNombre: string;
  creadorPerfil: PerfilCreador;
  preguntas: DPDQuestion[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isArchived?: boolean;
}

export interface DPDActivityInput extends Omit<DPDActivity, "id"|"createdAt"|"updatedAt"> {}

export interface DPDRespuesta {
  id: string;
  activityId: string;
  userId: string;
  userNombre: string;
  respuestas: Record<string, // questionId
    | { tipo: "abierta"; valorTexto: string }
    | { tipo: "seleccion_multiple"; seleccionados: string[] }
  >;
  createdAt: Timestamp;
}

// ======= Nombres de colecciones =======
const ACTIVIDADES_COL = "dpd_actividades";
const RESPUESTAS_COL = "dpd_respuestas";
const USERS_COL = "usuarios";

// ======= ACTIVIDADES =======
export function subscribeToActividades(
  onChange: (items: DPDActivity[]) => void,
  { includeArchived = false }: { includeArchived?: boolean } = {}
) {
  const ref = collection(db, ACTIVIDADES_COL);
  const q = includeArchived
    ? query(ref, orderBy("createdAt", "desc"))
    : query(ref, where("isArchived", "==", false), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const list: DPDActivity[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
    onChange(list);
  });
}

export async function createActividad(input: DPDActivityInput): Promise<string> {
  const ref = collection(db, ACTIVIDADES_COL);
  const docRef = await addDoc(ref, {
    ...input,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateActividad(id: string, patch: Partial<DPDActivityInput>) {
  const ref = doc(db, ACTIVIDADES_COL, id);
  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  } as any);
}

export async function deleteActividad(id: string) {
  const ref = doc(db, ACTIVIDADES_COL, id);
  await deleteDoc(ref);
}

export async function archiveActividad(id: string, archive = true) {
  const ref = doc(db, ACTIVIDADES_COL, id);
  await updateDoc(ref, { isArchived: archive, updatedAt: serverTimestamp() });
}

// ======= RESPUESTAS =======
export function subscribeToRespuestasByActividad(
  activityId: string,
  onChange: (items: DPDRespuesta[]) => void
) {
  const ref = collection(db, RESPUESTAS_COL);
  const q = query(ref, where("activityId", "==", activityId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const list: DPDRespuesta[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
    onChange(list);
  });
}

export async function createRespuesta(input: Omit<DPDRespuesta, "id"|"createdAt">): Promise<string> {
  const ref = collection(db, RESPUESTAS_COL);
  const docRef = await addDoc(ref, {
    ...input,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ======= USUARIOS (para selector de Creador) =======
export interface SimpleUser {
  id: string;
  nombre: string;
  profile?: string;
  email?: string;
}

export function subscribeToUsuariosByPerfiles(
  perfiles: PerfilCreador[],
  onChange: (items: SimpleUser[]) => void
) {
  const ref = collection(db, USERS_COL);
  const q = query(ref, where("profile", "in", perfiles)); // requiere que "profile" sea un campo con uno de esos valores
  return onSnapshot(q, (snap) => {
    const list: SimpleUser[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return { id: d.id, nombre: data?.displayName || data?.name || data?.email || "Sin nombre", profile: data?.profile, email: data?.email };
    });
    onChange(list);
  });
}

// ======= Utilidad para contar palabras =======
export function countWords(text: string): number {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}
