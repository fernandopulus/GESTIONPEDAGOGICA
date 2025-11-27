// src/firebaseHelpers/authHelper.ts
import { 
    signInWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail,
    User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase"; // Ajusta la ruta si es necesario
import { User } from "../../types"; // Ajusta la ruta si es necesario

/**
 * Inicia sesión de un usuario con email y contraseña.
 * Devuelve el usuario de Firebase si tiene éxito.
 */
export const loginUser = async (email: string, password: string): Promise<FirebaseUser> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Error en loginUser helper:", error);
        throw error; // Re-lanza el error para que el componente lo maneje
    }
};

/**
 * Cierra la sesión del usuario actual.
 */
export const logoutUser = async (): Promise<void> => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error en logoutUser helper:", error);
        throw error;
    }
};

/**
 * Envía un correo para restablecer la contraseña.
 */
export const resetPassword = async (email: string): Promise<void> => {
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        console.error("Error en resetPassword helper:", error);
        throw error;
    }
};

/**
 * Obtiene el perfil de usuario desde la colección 'usuarios' en Firestore.
 * @param email El email del usuario a buscar.
 * @returns El objeto de usuario con datos de Firestore.
 */
export const getUserProfile = async (email?: string | null, uid?: string | null): Promise<User | null> => {
    if (!email && !uid) {
        throw new Error("Se requiere email o UID para obtener el perfil de usuario.");
    }

    const attemptedDocIds = [email, uid].filter((value, index, self) => !!value && self.indexOf(value) === index) as string[];
    try {
        for (const docId of attemptedDocIds) {
            const snapshot = await getDoc(doc(db, "usuarios", docId));
            if (snapshot.exists()) {
                return { ...snapshot.data(), id: snapshot.id } as User;
            }
        }

        if (email) {
            const usuariosRef = collection(db, "usuarios");
            const q = query(usuariosRef, where("email", "==", email));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
                const docSnap = querySnap.docs[0];
                return { ...docSnap.data(), id: docSnap.id } as User;
            }
        }

        console.warn(`No se encontró perfil en Firestore para identificadores: email=${email}, uid=${uid}`);
        return null;
    } catch (error) {
        console.error("Error en getUserProfile helper:", error);
        throw error;
    }
};

/**
 * Actualiza campos del perfil de usuario en Firestore.
 * Se usa para reflejar cambios hechos desde el modal de perfil (nombre/foto, etc.).
 */
export const updateUserProfile = async (docId: string, updates: Partial<User>): Promise<void> => {
    if (!docId) {
        throw new Error("No se pudo determinar el identificador del usuario a actualizar.");
    }

    try {
        const userDocRef = doc(db, "usuarios", docId);
        await updateDoc(userDocRef, updates);
    } catch (error) {
        console.error("Error en updateUserProfile helper:", error);
        throw error;
    }
};
