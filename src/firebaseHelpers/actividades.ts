import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { ActividadRemota } from "../types";

const collectionRef = collection(db, "actividadesRemotas");

export async function getAllActividades(): Promise<ActividadRemota[]> {
  const snapshot = await getDocs(collectionRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ActividadRemota[];
}

export async function createActividad(actividad: Omit<ActividadRemota, "id">): Promise<void> {
  const newRef = doc(collectionRef); // autogenera ID
  await setDoc(newRef, actividad);
}

export async function updateActividad(id: string, updates: Partial<ActividadRemota>): Promise<void> {
  await updateDoc(doc(collectionRef, id), updates);
}

export async function deleteActividad(id: string): Promise<void> {
  await deleteDoc(doc(collectionRef, id));
}
