import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { User } from "../types";

const collectionRef = collection(db, "usuarios");

export async function getAllUsers(): Promise<User[]> {
  const snapshot = await getDocs(collectionRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const q = query(collectionRef, where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
}

export async function createUser(user: Omit<User, "id">): Promise<void> {
  await setDoc(doc(collectionRef, user.email), user); // Usa el email como id
}

export async function updateUser(email: string, updates: Partial<User>): Promise<void> {
  await updateDoc(doc(collectionRef, email), updates);
}

export async function deleteUser(email: string): Promise<void> {
  await deleteDoc(doc(collectionRef, email));
}
