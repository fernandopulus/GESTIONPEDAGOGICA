import { User } from '../../types';
import { logApiCallToFirestore } from '../../src/firebaseHelpers/loggingHelper';

/**
 * Registra una llamada a la API en Firestore.
 * @param moduleName - El nombre del módulo que origina la llamada a la API.
 * @param user - El objeto del usuario actual en sesión. Debe ser pasado desde el componente que llama.
 */
export const logApiCall = (moduleName: string, user: User | null) => {
    // Si no hay un usuario válido, no se puede registrar la llamada.
    if (!user || !user.id || !user.email) {
        console.warn("No se pudo registrar la llamada a la API: el objeto de usuario es inválido o no está en sesión.");
        return;
    }

    // Llama a la función del helper para registrar en Firestore.
    // Es una operación "fire-and-forget", no necesitamos esperar a que termine.
    logApiCallToFirestore(moduleName, user);
};
