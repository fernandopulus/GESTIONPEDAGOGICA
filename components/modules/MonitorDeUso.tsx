import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ApiCallLog } from '../../types';
import {
    getAllApiLogs,
    getFirestoreStats,
} from '../../src/firebaseHelpers/monitoring'; // AJUSTA la ruta según dónde guardes los helpers

const DAILY_API_CALL_LIMIT = 500;

const StatCard: React.FC<{ title: string; value: string | number; description?: string; alert?: boolean }> = ({ title, value, description, alert }) => (
    <div className={`p-5 rounded-xl border ${alert ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</h3>
        <p className={`text-3xl font-bold mt-2 ${alert ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{value}</p>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
    </div>
);

const BarChart: React.FC<{ title: string; data: { label: string; value: number }[]; colorClass: string; }> = ({ title, data, colorClass }) => {
    const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md h-full">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">{title}</h3>
            <div className="space-y-4">
                {data.length > 0 ? (
                    data.map(item => (
                        <div key={item.label}>
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2">{item.label}</span>
                                <span className="font-semibold text-slate-600 dark:text-slate-400">{item.value}</span>
                            </div>
                            <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                                <div className={`${colorClass} h-3 rounded-full transition-all duration-500 ease-out`} style={{ width: `${(item.value / maxValue) * 100}%` }}></div>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">No hay datos para mostrar.</p>
                )}
            </div>
        </div>
    );
};

const MonitorDeUso: React.FC = () => {
    const [logs, setLogs] = useState<ApiCallLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [firestoreStats, setFirestoreStats] = useState({
        documentsCreatedToday: 0,
        readsToday: 0,
        writesToday: 0,
        totalDocuments: 0,
        collectionsActivity: [] as { label: string; value: number }[],
        dailyActivity: [] as { label: string; value: number }[]
    });

    // Cargar logs de API desde Firestore
    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const apiLogs = await getAllApiLogs();
            setLogs(apiLogs);
            setError(null);
        } catch (e) {
            console.error("Error al cargar logs de la API desde Firestore:", e);
            setError("No se pudieron cargar los logs de API desde la nube.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Cargar estadísticas de Firestore
    const loadFirestoreStats = useCallback(async () => {
        try {
            const stats = await getFirestoreStats();
            setFirestoreStats(stats);
        } catch (e) {
            console.error("Error al cargar estadísticas de Firestore:", e);
            // No setear error aquí para no interferir con los logs de API
        }
    }, []);

    useEffect(() => {
        loadLogs();
        loadFirestoreStats();
        
        // Recargar cada 5 minutos
        const interval = setInterval(() => {
            loadLogs();
            loadFirestoreStats();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [loadLogs, loadFirestoreStats]);

    const { stats, userStats, moduleStats } = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const weekStart = todayStart - now.getDay() * 24 * 60 * 60 * 1000;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        const stats = { today: 0, week: 0, month: 0 };
        const userStats: Record<string, { email: string, today: number, month: number, total: number }> = {};
        const moduleStats: Record<string, number> = {};

        logs.forEach(log => {
            const logTime = new Date(log.timestamp).getTime();
            
            if (logTime >= todayStart) stats.today++;
            if (logTime >= weekStart) stats.week++;
            if (logTime >= monthStart) stats.month++;

            if (!userStats[log.userId]) {
                userStats[log.userId] = { email: log.userEmail, today: 0, month: 0, total: 0 };
            }
            userStats[log.userId].total++;
            if (logTime >= todayStart) userStats[log.userId].today++;
            if (logTime >= monthStart) userStats[log.userId].month++;

            moduleStats[log.module] = (moduleStats[log.module] || 0) + 1;
        });

        const sortedUserStats = Object.values(userStats).sort((a, b) => b.total - a.total);
        const sortedModuleStats = Object.entries(moduleStats).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

        return { stats, userStats: sortedUserStats, moduleStats: sortedModuleStats };
    }, [logs]);

    return (
        <div className="space-y-8">
            {loading && <div className="text-center text-amber-600 py-4">Cargando estadísticas desde la nube...</div>}
            {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</div>}

            {/* API Call Monitoring */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Monitor de Llamadas a la API de IA</h2>
                
                {!loading && logs.length === 0 && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-lg mb-6">
                        No hay registros de llamadas a la API en la nube.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard 
                        title="Llamadas Hoy" 
                        value={loading ? '--' : stats.today} 
                        description={`Límite recomendado: ${DAILY_API_CALL_LIMIT}`} 
                        alert={stats.today > DAILY_API_CALL_LIMIT} 
                    />
                    <StatCard 
                        title="Llamadas esta Semana" 
                        value={loading ? '--' : stats.week} 
                    />
                    <StatCard 
                        title="Llamadas este Mes" 
                        value={loading ? '--' : stats.month} 
                    />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <BarChart title="Uso por Módulo" data={moduleStats} colorClass="bg-sky-500" />
                    <div className="bg-white dark:bg-slate-800 rounded-xl">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Uso por Usuario</h3>
                        <div className="overflow-x-auto max-h-96">
                             <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Usuario</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Hoy</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Mes</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                    {!loading && userStats.length > 0 ? userStats.map(user => (
                                        <tr key={user.email}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">{user.email}</td>
                                            <td className="px-4 py-2 text-center text-sm">{user.today}</td>
                                            <td className="px-4 py-2 text-center text-sm">{user.month}</td>
                                            <td className="px-4 py-2 text-center text-sm font-bold">{user.total}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="text-center py-6 text-slate-500">
                                            {loading ? 'Cargando...' : 'No hay registros.'}
                                        </td></tr>
                                    )}
                                </tbody>
                             </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Firestore Monitoring - Ahora funcional */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Monitor de Almacenamiento Firestore</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Estadísticas de uso de Firestore en tiempo real.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard 
                        title="Documentos Creados (Hoy)" 
                        value={firestoreStats.documentsCreatedToday} 
                        description="Nuevos documentos"
                    />
                    <StatCard 
                        title="Lecturas de Firestore (Hoy)" 
                        value={firestoreStats.readsToday} 
                        description="Operaciones de lectura"
                    />
                    <StatCard 
                        title="Total de Documentos" 
                        value={firestoreStats.totalDocuments} 
                        description="En todas las colecciones"
                    />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <BarChart 
                        title="Actividad por Colección" 
                        data={firestoreStats.collectionsActivity} 
                        colorClass="bg-green-500" 
                    />
                    <BarChart 
                        title="Actividad Diaria (Últimos 7 días)" 
                        data={firestoreStats.dailyActivity} 
                        colorClass="bg-purple-500" 
                    />
                </div>
            </div>
        </div>
    );
};

export default MonitorDeUso;