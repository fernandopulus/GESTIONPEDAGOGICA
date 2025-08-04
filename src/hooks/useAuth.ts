// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebaseHelpers/config'; // Asegúrate que la ruta sea correcta
import { getUserProfile } from '../firebaseHelpers/authHelper'; // ✅ IMPORTAMOS TU HELPER
import type { User } from '../../types';

export const useAuth = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true); // Opcional: para saber si la auth está cargando

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser && firebaseUser.email) {
                // El usuario está autenticado en Firebase, ahora buscamos su perfil en Firestore
                try {
                    const userProfile = await getUserProfile(firebaseUser.email); // ✅ USAMOS TU FUNCIÓN
                    setCurrentUser(userProfile);
                } catch (error) {
                    console.error("Error al obtener el perfil del usuario:", error);
                    setCurrentUser(null);
                }
            } else {
                // El usuario no está autenticado
                setCurrentUser(null);
            }
            setLoading(false);
        });

        // Limpiar la suscripción al desmontar el componente
        return () => unsubscribe();
    }, []);

    return { currentUser, loading };
};
