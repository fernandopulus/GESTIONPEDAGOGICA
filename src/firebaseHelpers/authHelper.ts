// src/firebaseHelpers/authHelper.ts
import { 
    signInWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail,
    User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
export const getUserProfile = async (email: string): Promise<User | null> => {
    try {
        const userDocRef = doc(db, "usuarios", email);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            return { id: userDocSnap.id, ...userDocSnap.data() } as User;
        } else {
            console.warn(`No se encontró perfil en Firestore para: ${email}`);
            return null;
        }
    } catch (error) {
        console.error("Error en getUserProfile helper:", error);
        throw error;
    }
};
