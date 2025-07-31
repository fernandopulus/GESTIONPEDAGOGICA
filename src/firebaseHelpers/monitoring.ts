import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta según tu configuración
import { ApiCallLog } from '../../types';

/**
 * Obtener todos los logs de llamadas a la API desde Firestore
 */
export const getAllApiLogs = async (): Promise<ApiCallLog[]> => {
    try {
        const q = query(collection(db, 'apiLogs'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ApiCallLog[];
    } catch (error) {
        console.error('Error al obtener logs de API:', error);
        throw new Error('No se pudieron cargar los logs de API');
    }
};

/**
 * Obtener estadísticas de uso de Firestore
 */
export const getFirestoreStats = async () => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Colecciones principales de la app
        const collections = ['usuarios', 'acompanamientos', 'anuncios', 'acciones', 'analisis', 'apiLogs'];
        
        let totalDocuments = 0;
        let documentsCreatedToday = 0;
        const collectionsActivity: { label: string; value: number }[] = [];
        
        // Estadísticas por colección
        for (const collectionName of collections) {
            try {
                const collectionRef = collection(db, collectionName);
                const snapshot = await getDocs(collectionRef);
                const count = snapshot.size;
                
                totalDocuments += count;
                collectionsActivity.push({
                    label: collectionName.charAt(0).toUpperCase() + collectionName.slice(1),
                    value: count
                });
                
                // Contar documentos creados hoy (si tienen campo createdAt)
                let todayCount = 0;
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.createdAt) {
                        const createdDate = new Date(data.createdAt);
                        if (createdDate >= todayStart) {
                            todayCount++;
                        }
                    }
                });
                documentsCreatedToday += todayCount;
                
            } catch (error) {
                console.warn(`Error accediendo a colección ${collectionName}:`, error);
                collectionsActivity.push({
                    label: collectionName.charAt(0).toUpperCase() + collectionName.slice(1),
                    value: 0
                });
            }
        }
        
        // Actividad diaria (últimos 7 días) basada en logs de API
        const dailyActivity: { label: string; value: number }[] = [];
        try {
            const apiLogsRef = collection(db, 'apiLogs');
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const recentLogsQuery = query(
                apiLogsRef, 
                where('timestamp', '>=', sevenDaysAgo.toISOString()),
                orderBy('timestamp', 'desc')
            );
            const recentLogs = await getDocs(recentLogsQuery);
            
            // Agrupar por día
            const dailyCounts: Record<string, number> = {};
            recentLogs.docs.forEach(doc => {
                const data = doc.data();
                const date = new Date(data.timestamp).toLocaleDateString('es-CL');
                dailyCounts[date] = (dailyCounts[date] || 0) + 1;
            });
            
            // Convertir a array para el gráfico
            Object.entries(dailyCounts)
                .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                .forEach(([date, count]) => {
                    dailyActivity.push({ label: date, value: count });
                });
                
        } catch (error) {
            console.warn('Error calculando actividad diaria:', error);
        }
        
        // Simular lecturas (en una implementación real, esto vendría de Firebase Analytics)
        const estimatedReadsToday = Math.floor(documentsCreatedToday * 2.5); // Estimación basada en creaciones
        
        return {
            documentsCreatedToday,
            readsToday: estimatedReadsToday,
            writesToday: documentsCreatedToday,
            totalDocuments,
            collectionsActivity: collectionsActivity.sort((a, b) => b.value - a.value),
            dailyActivity
        };
        
    } catch (error) {
        console.error('Error al obtener estadísticas de Firestore:', error);
        
        // Devolver valores por defecto en caso de error
        return {
            documentsCreatedToday: 0,
            readsToday: 0,
            writesToday: 0,
            totalDocuments: 0,
            collectionsActivity: [],
            dailyActivity: []
        };
    }
};

/**
 * Obtener logs de API de un usuario específico
 */
export const getApiLogsByUser = async (userId: string): Promise<ApiCallLog[]> => {
    try {
        const q = query(
            collection(db, 'apiLogs'), 
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ApiCallLog[];
    } catch (error) {
        console.error('Error al obtener logs por usuario:', error);
        throw new Error('No se pudieron cargar los logs del usuario');
    }
};

/**
 * Obtener logs de API de un módulo específico
 */
export const getApiLogsByModule = async (module: string): Promise<ApiCallLog[]> => {
    try {
        const q = query(
            collection(db, 'apiLogs'), 
            where('module', '==', module),
            orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ApiCallLog[];
    } catch (error) {
        console.error('Error al obtener logs por módulo:', error);
        throw new Error('No se pudieron cargar los logs del módulo');
    }
};