import { ApiCallLog, User } from '../../types';

const API_LOGS_KEY = 'apiCallLogs';
const SESSION_USER_KEY = 'lir-sessionUser';

/**
 * Registra una llamada a la API en el almacenamiento local.
 * Despacha un evento de 'storage' personalizado para notificar a otros componentes
 * (como el monitor de uso) que los datos han cambiado.
 * @param moduleName - El nombre del módulo que origina la llamada a la API.
 */
export const logApiCall = (moduleName: string) => {
    try {
        const userJson = localStorage.getItem(SESSION_USER_KEY);
        if (!userJson) {
            console.warn("No se pudo registrar la llamada a la API: no hay usuario en sesión.");
            return;
        }

        const user: User = JSON.parse(userJson);
        const logsJson = localStorage.getItem(API_LOGS_KEY);
        const logs: ApiCallLog[] = logsJson ? JSON.parse(logsJson) : [];
        
        const newLog: ApiCallLog = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            userId: user.id,
            userEmail: user.email,
            module: moduleName,
        };

        // Mantener un máximo de 2000 logs para evitar sobrecargar localStorage
        const updatedLogs = [newLog, ...logs].slice(0, 2000); 
        localStorage.setItem(API_LOGS_KEY, JSON.stringify(updatedLogs));

        // Despachar un evento de almacenamiento para que los componentes que escuchan se actualicen.
        // Esto es crucial para la reactividad en tiempo real del monitor de uso.
        window.dispatchEvent(new Event('storage'));

    } catch (error) {
        console.error("Error al registrar la llamada a la API:", error);
    }
};
