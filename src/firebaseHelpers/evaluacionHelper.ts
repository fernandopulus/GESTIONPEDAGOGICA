// src/firebaseHelpers/evaluacionHelper.ts (completo)
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { Prueba, RubricaEstatica, RubricaInteractiva, User } from "../../types";

// --- Colecciones ---
const PRUEBAS_COLLECTION = "evaluaciones_pruebas";
const RUBRICAS_ESTATICAS_COLLECTION = "rubricas_estaticas";
const RUBRICAS_INTERACTIVAS_COLLECTION = "rubricas_interactivas";
const USERS_COLLECTION = "usuarios";

// --- Helper de conversión ---
const convertFirestoreDoc = <T>(docSnap: any): T => {
  const data = docSnap.data() || {};
  const fecha = data.fechaCreacion;
  const fechaISO =
    fecha?.toDate?.()?.toISOString?.() ??
    (typeof fecha === "string" ? fecha : undefined);
  return { id: docSnap.id, ...data, fechaCreacion: fechaISO } as T;
};

// --- PRUEBAS ---
export const subscribeToPruebas = (cb: (rows: Prueba[]) => void) => {
  const qRef = query(collection(db, PRUEBAS_COLLECTION), orderBy("fechaCreacion", "desc"));
  const unsub = onSnapshot(
    qRef,
    (snap) => cb(snap.docs.map((d) => convertFirestoreDoc<Prueba>(d))),
    (err) => {
      console.error("[subscribeToPruebas]", err);
      cb([]);
    }
  );
  return unsub;
};

export const savePrueba = async (p: Prueba) => {
  const { id, fechaCreacion, ...rest } = p;
  const ref = doc(db, PRUEBAS_COLLECTION, id);
  const payload: any = {
    ...rest,
    // si viene fecha ISO la preservamos; si no, serverTimestamp()
    fechaCreacion:
      fechaCreacion ? Timestamp.fromDate(new Date(fechaCreacion)) : serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
};

export const deletePrueba = async (id: string) => {
  await deleteDoc(doc(db, PRUEBAS_COLLECTION, id));
};

// --- RÚBRICAS ESTÁTICAS ---
export const subscribeToRubricasEstaticas = (cb: (rows: RubricaEstatica[]) => void) => {
  const qRef = query(
    collection(db, RUBRICAS_ESTATICAS_COLLECTION),
    orderBy("fechaCreacion", "desc")
  );
  return onSnapshot(
    qRef,
    (snap) => cb(snap.docs.map((d) => convertFirestoreDoc<RubricaEstatica>(d))),
    (err) => {
      console.error("[subscribeToRubricasEstaticas]", err);
      cb([]);
    }
  );
};

export const saveRubricaEstatica = async (r: RubricaEstatica) => {
  const { id, fechaCreacion, ...rest } = r;
  const ref = doc(db, RUBRICAS_ESTATICAS_COLLECTION, id);
  const payload: any = {
    ...rest,
    fechaCreacion:
      fechaCreacion ? Timestamp.fromDate(new Date(fechaCreacion)) : serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
};

export const deleteRubricaEstatica = async (id: string) => {
  await deleteDoc(doc(db, RUBRICAS_ESTATICAS_COLLECTION, id));
};

// --- RÚBRICAS INTERACTIVAS ---
export const subscribeToRubricasInteractivas = (cb: (rows: RubricaInteractiva[]) => void) => {
  const qRef = query(
    collection(db, RUBRICAS_INTERACTIVAS_COLLECTION),
    orderBy("curso", "asc")
  );
  return onSnapshot(
    qRef,
    (snap) => cb(snap.docs.map((d) => convertFirestoreDoc<RubricaInteractiva>(d))),
    (err) => {
      console.error("[subscribeToRubricasInteractivas]", err);
      cb([]);
    }
  );
};

export const createRubricaInteractiva = async (
  r: Omit<RubricaInteractiva, "id">
): Promise<string> => {
  const payload: any = {
    ...r,
    fechaCreacion: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, RUBRICAS_INTERACTIVAS_COLLECTION), payload);
  return ref.id;
};

export const updateRubricaInteractiva = async (
  id: string,
  patch: Partial<RubricaInteractiva>
): Promise<void> => {
  const ref = doc(db, RUBRICAS_INTERACTIVAS_COLLECTION, id);
  await setDoc(ref, patch as any, { merge: true });
};

// --- USUARIOS ---
export const subscribeToAllUsers = (cb: (rows: User[]) => void) => {
  const qRef = query(collection(db, USERS_COLLECTION), orderBy("nombreCompleto", "asc"));
  return onSnapshot(
    qRef,
    (snap) => cb(snap.docs.map((d) => convertFirestoreDoc<User>(d))),
    (err) => {
      console.error("[subscribeToAllUsers]", err);
      cb([]);
    }
  );
};
