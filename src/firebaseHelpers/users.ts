import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { User } from "../../types";

const collectionRef = collection(db, "usuarios");

export async function getAllUsers(): Promise<User[]> {
  try {
    console.log("🔍 [DEBUG] Obteniendo usuarios de Firestore...");
    console.log("🔍 [DEBUG] Collection ref:", collectionRef);
    
    const snapshot = await getDocs(collectionRef);
    console.log(`📊 [DEBUG] Encontrados ${snapshot.docs.length} documentos en la colección usuarios`);
    
    if (snapshot.empty) {
      console.log("⚠️  [DEBUG] La colección usuarios está vacía");
      return [];
    }
    
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`👤 [DEBUG] Usuario encontrado:`, { id: doc.id, ...data });
      return { id: doc.id, ...data } as User;
    });
    
    console.log("✅ [DEBUG] Usuarios procesados correctamente:", users.length);
    console.log("✅ [DEBUG] Lista completa de usuarios:", users);
    return users;
  } catch (error) {
    console.error("❌ [DEBUG] Error al obtener usuarios:", error);
    console.error("❌ [DEBUG] Error details:", {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    console.log(`🔍 [DEBUG] Buscando usuario por email: ${email}`);
    const q = query(collectionRef, where("email", "==", email));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log(`⚠️  [DEBUG] No se encontró usuario con email: ${email}`);
      return null;
    }
    
    const userData = { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
    console.log(`✅ [DEBUG] Usuario encontrado:`, userData);
    return userData;
  } catch (error) {
    console.error(`❌ [DEBUG] Error al buscar usuario por email ${email}:`, error);
    throw error;
  }
}

export async function createUser(user: Omit<User, "id">): Promise<void> {
  try {
    console.log(`🔨 [DEBUG] Creando usuario:`, user);
    await setDoc(doc(collectionRef, user.email), user);
    console.log(`✅ [DEBUG] Usuario creado exitosamente: ${user.email}`);
  } catch (error) {
    console.error(`❌ [DEBUG] Error al crear usuario ${user.email}:`, error);
    throw error;
  }
}

export async function updateUser(email: string, updates: Partial<User>): Promise<void> {
  try {
    console.log(`🔄 [DEBUG] Actualizando usuario ${email}:`, updates);
    await updateDoc(doc(collectionRef, email), updates);
    console.log(`✅ [DEBUG] Usuario actualizado exitosamente: ${email}`);
  } catch (error) {
    console.error(`❌ [DEBUG] Error al actualizar usuario ${email}:`, error);
    throw error;
  }
}

export async function deleteUser(email: string): Promise<void> {
  try {
    console.log(`🗑️  [DEBUG] Eliminando usuario: ${email}`);
    await deleteDoc(doc(collectionRef, email));
    console.log(`✅ [DEBUG] Usuario eliminado exitosamente: ${email}`);
  } catch (error) {
    console.error(`❌ [DEBUG] Error al eliminar usuario ${email}:`, error);
    throw error;
  }
}