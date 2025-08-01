import React, { useState, useEffect, useMemo } from 'react';
import { Reemplazo, AcompanamientoDocente, CalendarEvent, EventType, User } from '../../types';
import { RUBRICA_ACOMPANAMIENTO_DOCENTE as defaultRubric, EVENT_TYPE_CONFIG } from '../../constants';
// Opción 1: Si el archivo está en src/firebaseHelpers/
import { 
    subscribeToAllReemplazos, 
    subscribeToAllAcompanamientos, 
    subscribeToAllCalendarEvents 
} from '../../src/firebaseHelpers/dashboardSubdireccionHelper';

// Opción 2: Si tienes una estructura diferente, prueba:
// import { 
//     subscribeToAllReemplazos, 
//     subscribeToAllAcompanamientos, 
//     subscribeToAllCalendarEvents 
// } from '../firebaseHelpers/dashboardSubdireccionHelper';

type RubricStructure = typeof defaultRubric;

interface StatCardProps {
    title: string;
    value: string | number;
    description: string;
    isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description, isLoading = false }) => (
    <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</h3>
        {isLoading ? (
            <div className="flex items-center mt-2">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-2 text-slate-500 dark:text-slate-400">Cargando...</span>
            </div>
        ) : (
            <>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-200 mt-2">{value}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
            </>
        )}
    </div>
);

interface BarChartProps {
    title: string;
    data: { label: string; value: number | string }[];
    colorClass: string;
    valueFormatter?: (value: number | string) => string;
    isLoading?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({ 
    title, 
    data, 
    colorClass, 
    valueFormatter = (v) => String(v),
    isLoading = false 
}) => {
    const numericData = useMemo(() => 
        data.map(d => typeof d.value === 'number' ? d.value : parseFloat(String(d.value)) || 0), 
        [data]
    );
    const maxValue = useMemo(() => Math.max(...numericData, 1), [numericData]);
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">{title}</h3>
            {isLoading ? (
                <div className="flex justify-center items-center py-8">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-2 text-slate-500 dark:text-slate-400">Cargando datos...</span>
                </div>
            ) : (
                <div className="space-y-4">
                    {data.length > 0 ? (
                        data.sort((a,b) => (typeof b.value === 'number' ? b.value : 0) - (typeof a.value === 'number' ? a.value : 0))
                            .map((item, index) => {
                                const numericValue = typeof item.value === 'number' ? item.value : parseFloat(String(item.value)) || 0;
                                return (
                                    <div key={item.label + index}>
                                        <div className="flex justify-between items-center text-sm mb-1">
                                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2">{item.label}</span>
                                            <span className="font-semibold text-slate-600 dark:text-slate-400">{valueFormatter(item.value)}</span>
                                        </div>
                                        <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                                            <div 
                                                className={`${colorClass} h-3 rounded-full transition-all duration-500 ease-out`}
                                                style={{ width: `${(numericValue / maxValue) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })
                    ) : (
                        <p className="text-slate-500 dark:text-slate-400 text-sm">No hay datos para mostrar.</p>
                    )}
                </div>
            )}
        </div>
    );
};

// Hook para cargar datos del dashboard desde Firestore
const useDashboardData = () => {
    const [registros, setRegistros] = useState<Reemplazo[]>([]);
    const [acompanamientos, setAcompanamientos] = useState<AcompanamientoDocente[]>([]);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        console.log('🔄 Iniciando carga de datos del dashboard...');
        
        let loadedSources = 0;
        const totalSources = 3;
        
        const checkAllLoaded = () => {
            loadedSources++;
            if (loadedSources >= totalSources) {
                setLoading(false);
                console.log('✅ Todos los datos del dashboard cargados');
            }
        };

        try {
            // Suscribirse a reemplazos
            const unsubscribeReemplazos = subscribeToAllReemplazos((data) => {
                setRegistros(data);
                checkAllLoaded();
            });

            // Suscribirse a acompañamientos
            const unsubscribeAcompanamientos = subscribeToAllAcompanamientos((data) => {
                setAcompanamientos(data);
                checkAllLoaded();
            });

            // Suscribirse a eventos del calendario
            const unsubscribeCalendar = subscribeToAllCalendarEvents((data) => {
                setCalendarEvents(data);
                checkAllLoaded();
            });

            // Cleanup function
            return () => {
                unsubscribeReemplazos();
                unsubscribeAcompanamientos();
                unsubscribeCalendar();
            };
        } catch (err) {
            console.error('❌ Error al configurar suscripciones del dashboard:', err);
            setError(err instanceof Error ? err.message : 'Error al cargar datos del dashboard');
            setLoading(false);
        }
    }, []);

    return { registros, acompanamientos, calendarEvents, loading, error };
};

interface DashboardSubdireccionProps {
    currentUser: User;
}

const DashboardSubdireccion: React.FC<DashboardSubdireccionProps> = ({ currentUser }) => {
    // LOGS DE DEBUG DETALLADOS
    console.log('=== DASHBOARD SUBDIRECCION DEBUG ===');
    console.log('🔍 Dashboard - currentUser completo:', currentUser);
    console.log('🔍 Dashboard - currentUser.profile:', currentUser?.profile);
    console.log('🔍 Dashboard - Verificación de perfil:', currentUser?.profile === 'SUBDIRECCION');
    console.log('🔍 Dashboard - Typeof profile:', typeof currentUser?.profile);
    console.log('🔍 Dashboard - Profile length:', currentUser?.profile?.length);
    console.log('🔍 Dashboard - Profile con comillas:', `"${currentUser?.profile}"`);
    console.log('🔍 Dashboard - Comparación con trim:', currentUser?.profile?.trim() === 'SUBDIRECCION');
    console.log('=====================================');
    
    const { registros, acompanamientos, calendarEvents, loading, error } = useDashboardData();
    const [rubrica, setRubrica] = useState<RubricStructure>(defaultRubric);

    console.log('🔍 Dashboard - Datos recibidos:', {
        registros: registros.length,
        acompanamientos: acompanamientos.length,
        calendarEvents: calendarEvents.length,
        loading,
        error,
        currentUser: currentUser?.profile
    });

    // Cargar rúbrica personalizada desde localStorage (si existe)
    useEffect(() => {
        try {
            const customRubricData = localStorage.getItem('acompanamientoDocenteCustomRubrica');
            if (customRubricData) {
                setRubrica(JSON.parse(customRubricData));
            } else {
                setRubrica(defaultRubric);
            }
        } catch (e) {
            console.error("Error al leer rúbrica personalizada", e);
            setRubrica(defaultRubric);
        }
    }, []);

    // Verificar permisos con debug detallado
    console.log('🔍 Dashboard - Verificando permisos...');
    console.log('🔍 Dashboard - currentUser existe:', !!currentUser);
    console.log('🔍 Dashboard - profile value:', `"${currentUser?.profile}"`);
    console.log('🔍 Dashboard - comparación exacta:', currentUser?.profile === 'SUBDIRECCION');
    
    if (!currentUser) {
        console.log('❌ Dashboard - currentUser es null/undefined');
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md h-full w-full flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Cargando usuario...</h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md">
                    Esperando datos del usuario autenticado...
                </p>
            </div>
        );
    }

    if (currentUser.profile !== 'SUBDIRECCION') {
        console.log('❌ Dashboard - Perfil no autorizado:', currentUser.profile);
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md h-full w-full flex flex-col items-center justify-center text-center animate-fade-in">
                <span className="text-6xl mb-4">🚫</span>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Acceso Restringido</h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mb-4">
                    Este dashboard está disponible solo para usuarios con perfil de Subdirección.
                </p>
                <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-400">
                    <p><strong>Debug Info:</strong></p>
                    <p>Su perfil actual: "{currentUser.profile}"</p>
                    <p>Perfil requerido: "SUBDIRECCION"</p>
                    <p>Usuario: {currentUser.email || currentUser.nombreCompleto}</p>
                </div>
            </div>
        );
    }

    console.log('✅ Dashboard - Permisos verificados correctamente');

    // Estado de error
    if (error) {
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md h-full w-full flex flex-col items-center justify-center text-center animate-fade-in">
                <span className="text-6xl mb-4">⚠️</span>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Error al Cargar Datos</h1>
                <p className="text-red-500 dark:text-red-400 text-lg max-w-md mb-4">
                    {error}
                </p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
                >
                    Recargar Página
                </button>
            </div>
        );
    }

    const inasistenciaStats = useMemo(() => {
        const totalInasistencias = registros.length;
        if (totalInasistencias === 0) {
            return {
                totalInasistencias: 0,
                horasRealizadas: 0,
                horasCubiertas: 0,
                tasaCobertura: '0%',
                inasistenciasPorDocente: [],
                reemplazosPorDocente: [],
                distribucionResultados: [],
                inasistenciasPorCurso: []
            };
        }

        const horasRealizadas = registros.filter(r => r.resultado === 'Hora realizada').length;
        const horasCubiertas = totalInasistencias - horasRealizadas;
        const tasaCobertura = `${((horasRealizadas / totalInasistencias) * 100).toFixed(1)}%`;
        
        const countBy = (arr: Reemplazo[], key: keyof Reemplazo) => arr.reduce((acc, item) => {
            const itemKey = item[key];
            if (typeof itemKey === 'string') {
               acc[itemKey] = (acc[itemKey] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const inasistenciasMap = countBy(registros, 'docenteAusente');
        const reemplazosMap = countBy(registros, 'docenteReemplazante');
        const cursosMap = countBy(registros, 'curso');
        
        return {
            totalInasistencias,
            horasRealizadas,
            horasCubiertas,
            tasaCobertura,
            inasistenciasPorDocente: Object.entries(inasistenciasMap).map(([label, value]) => ({ label, value })),
            reemplazosPorDocente: Object.entries(reemplazosMap).map(([label, value]) => ({ label, value })),
            inasistenciasPorCurso: Object.entries(cursosMap).map(([label, value]) => ({ label, value })),
            distribucionResultados: [
                { label: 'Hora Realizada', value: horasRealizadas },
                { label: 'Hora Cubierta', value: horasCubiertas }
            ]
        };
    }, [registros]);
    
    const acompanamientoStats = useMemo(() => {
        const totalAcompanamientos = acompanamientos.length;
        if (totalAcompanamientos === 0) {
            return { totalAcompanamientos: 0, promedioGeneral: 'N/A', desempenoPorDocente: [], desempenoPorDominio: [] };
        }

        const criterionToDomainMap = new Map<string, string>();
        rubrica.forEach(domain => {
            domain.criteria.forEach(criterion => {
                criterionToDomainMap.set(criterion.name, domain.domain);
            });
        });

        let totalScore = 0;
        let totalCriteriaCount = 0;
        const scoresByTeacher: { [name: string]: { total: number, count: number } } = {};
        const scoresByDomain: { [name: string]: { total: number, count: number } } = {};

        acompanamientos.forEach(record => {
            if (!scoresByTeacher[record.docente]) {
                scoresByTeacher[record.docente] = { total: 0, count: 0 };
            }

            Object.entries(record.rubricaResultados).forEach(([criterion, score]) => {
                totalScore += score;
                totalCriteriaCount++;

                scoresByTeacher[record.docente].total += score;
                scoresByTeacher[record.docente].count++;

                const domain = criterionToDomainMap.get(criterion);
                if (domain) {
                    if (!scoresByDomain[domain]) {
                        scoresByDomain[domain] = { total: 0, count: 0 };
                    }
                    scoresByDomain[domain].total += score;
                    scoresByDomain[domain].count++;
                }
            });
        });

        const promedioGeneral = totalCriteriaCount > 0 ? (totalScore / totalCriteriaCount).toFixed(2) : 'N/A';
        
        const desempenoPorDocente = Object.entries(scoresByTeacher).map(([label, data]) => ({
            label,
            value: data.count > 0 ? (data.total / data.count).toFixed(2) : 0
        }));

        const desempenoPorDominio = Object.entries(scoresByDomain).map(([label, data]) => ({
            label,
            value: data.count > 0 ? (data.total / data.count).toFixed(2) : 0
        }));

        return { totalAcompanamientos, promedioGeneral, desempenoPorDocente, desempenoPorDominio };
    }, [acompanamientos, rubrica]);
    
    const calendarStats = useMemo(() => {
        const counts: Record<EventType, number> = {
            [EventType.EVALUACION]: 0,
            [EventType.ACTO]: 0,
            [EventType.ACTIVIDAD_FOCALIZADA]: 0,
            [EventType.SALIDA_PEDAGOGICA]: 0,
        };
    
        for (const event of calendarEvents) {
            if (counts.hasOwnProperty(event.type)) {
                counts[event.type]++;
            }
        }
    
        const chartData = Object.entries(counts).map(([label, value]) => ({
            label: EVENT_TYPE_CONFIG[label as EventType].label,
            value,
        }));
    
        return {
            totalEvaluaciones: counts[EventType.EVALUACION],
            totalActos: counts[EventType.ACTO],
            totalActividadesFocalizadas: counts[EventType.ACTIVIDAD_FOCALIZADA],
            totalSalidasPedagogicas: counts[EventType.SALIDA_PEDAGOGICA],
            distribucionEventos: chartData,
        };
    }, [calendarEvents]);

    // Estado de carga inicial
    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md h-full w-full flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Cargando Dashboard</h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md">
                    Obteniendo datos desde la base de datos...
                </p>
            </div>
        );
    }

    // Pantalla cuando no hay datos
    if (inasistenciaStats.totalInasistencias === 0 && acompanamientoStats.totalAcompanamientos === 0 && calendarEvents.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md h-full w-full flex flex-col items-center justify-center text-center animate-fade-in">
                <span className="text-6xl mb-4">📊</span>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Dashboard de Subdirección</h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mb-4">
                    Aún no hay datos para mostrar. Comience por añadir registros en los módulos correspondientes.
                </p>
                <div className="text-sm text-slate-400 dark:text-slate-500">
                    <p>• Módulo de Inasistencias y Reemplazos</p>
                    <p>• Módulo de Acompañamiento Docente</p>
                    <p>• Calendario Académico</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-fade-in">
            {/* Header del Dashboard */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white p-6 rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold mb-2">Dashboard de Subdirección</h1>
                <p className="text-amber-100">Vista consolidada de datos institucionales</p>
                <p className="text-sm text-amber-200 mt-2">
                    Última actualización: {new Date().toLocaleString('es-CL')}
                </p>
            </div>

            {/* Inasistencias Dashboard */}
            {registros.length > 0 && (
                <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
                        📋 Dashboard de Inasistencias y Reemplazos
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            title="Total Inasistencias" 
                            value={inasistenciaStats.totalInasistencias} 
                            description="Registros totales" 
                            isLoading={loading}
                        />
                        <StatCard 
                            title="Horas Realizadas" 
                            value={inasistenciaStats.horasRealizadas} 
                            description="Reemplazo con misma asignatura" 
                            isLoading={loading}
                        />
                        <StatCard 
                            title="Horas Cubiertas" 
                            value={inasistenciaStats.horasCubiertas} 
                            description="Reemplazo con otra asignatura" 
                            isLoading={loading}
                        />
                        <StatCard 
                            title="Tasa de Cobertura Efectiva" 
                            value={inasistenciaStats.tasaCobertura} 
                            description="% de horas realizadas" 
                            isLoading={loading}
                        />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <BarChart 
                            title="Inasistencias por Docente" 
                            data={inasistenciaStats.inasistenciasPorDocente} 
                            colorClass="bg-red-400" 
                            isLoading={loading}
                        />
                        <BarChart 
                            title="Reemplazos por Docente" 
                            data={inasistenciaStats.reemplazosPorDocente} 
                            colorClass="bg-sky-400" 
                            isLoading={loading}
                        />
                        <BarChart 
                            title="Inasistencias por Curso" 
                            data={inasistenciaStats.inasistenciasPorCurso} 
                            colorClass="bg-amber-400" 
                            isLoading={loading}
                        />
                        <BarChart 
                            title="Distribución de Resultados" 
                            data={inasistenciaStats.distribucionResultados} 
                            colorClass="bg-green-400" 
                            isLoading={loading}
                        />
                    </div>
                </div>
            )}
           
            {/* Acompañamiento Dashboard */}
            {acompanamientos.length > 0 && (
                <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
                        👥 Dashboard de Acompañamiento Docente
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            title="Total Acompañamientos" 
                            value={acompanamientoStats.totalAcompanamientos} 
                            description="Registros realizados" 
                            isLoading={loading}
                        />
                        <StatCard 
                            title="Promedio General" 
                            value={acompanamientoStats.promedioGeneral} 
                            description="Calificación promedio (1-4)" 
                            isLoading={loading}
                        />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <BarChart 
                            title="Desempeño Promedio por Docente" 
                            data={acompanamientoStats.desempenoPorDocente} 
                            colorClass="bg-indigo-400"
                            valueFormatter={(v) => Number(v).toFixed(2)}
                            isLoading={loading}
                        />
                        <BarChart 
                            title="Desempeño Promedio por Dominio" 
                            data={acompanamientoStats.desempenoPorDominio} 
                            colorClass="bg-teal-400" 
                            valueFormatter={(v) => Number(v).toFixed(2)}
                            isLoading={loading}
                        />
                    </div>
                </div>
            )}

            {/* Calendar Dashboard */}
            {calendarEvents.length > 0 && (
                <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
                        📅 Resumen del Calendario Académico
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            title="Evaluaciones" 
                            value={calendarStats.totalEvaluaciones} 
                            description="Eventos registrados" 
                            isLoading={loading}
                        />
                        <StatCard 
                            title="Actos" 
                            value={calendarStats.totalActos} 
                            description="Eventos registrados" 
                            isLoading={loading}
                        />
                        <StatCard 
                            title="Act. Focalizadas" 
                            value={calendarStats.totalActividadesFocalizadas} 
                            description="Eventos registrados" 
                            isLoading={loading}
                        />
                        <StatCard 
                            title="Salidas Pedagógicas" 
                            value={calendarStats.totalSalidasPedagogicas} 
                            description="Eventos registrados" 
                            isLoading={loading}
                        />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <BarChart 
                            title="Distribución de Eventos del Calendario" 
                            data={calendarStats.distribucionEventos} 
                            colorClass="bg-violet-400" 
                            isLoading={loading}
                        />
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Próximos Eventos</h3>
                            {loading ? (
                                <div className="flex justify-center items-center py-8">
                                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="ml-2 text-slate-500 dark:text-slate-400">Cargando eventos...</span>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {calendarEvents
                                        .filter(event => new Date(event.date) >= new Date())
                                        .slice(0, 5)
                                        .map((event, index) => (
                                            <div key={event.id || index} className="p-3 border dark:border-slate-600 rounded-md">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-slate-200">
                                                            {event.responsables || 'Evento sin título'}
                                                        </p>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                                            {new Date(event.date).toLocaleDateString('es-CL')}
                                                        </p>
                                                        {event.ubicacion && (
                                                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                                                📍 {event.ubicacion}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                        EVENT_TYPE_CONFIG[event.type]?.color || 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {EVENT_TYPE_CONFIG[event.type]?.label || event.type}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {calendarEvents.filter(event => new Date(event.date) >= new Date()).length === 0 && (
                                        <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">
                                            No hay eventos próximos programados
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Resumen General */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 p-6 rounded-xl">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
                    📈 Resumen Ejecutivo
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                            {registros.length + acompanamientos.length + calendarEvents.length}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Total de registros en el sistema
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {new Set([...registros.map(r => r.docenteAusente), ...acompanamientos.map(a => a.docente)]).size}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Docentes con registros
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {Math.round(((registros.filter(r => r.resultado === 'Hora realizada').length) / Math.max(registros.length, 1)) * 100)}%
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Efectividad en cobertura
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer con información del sistema */}
            <div className="text-center text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-6">
                <p>Dashboard de Subdirección - Sistema de Gestión Pedagógica</p>
                <p>Los datos se actualizan en tiempo real desde la base de datos</p>
            </div>
        </div>
    );
};

export default DashboardSubdireccion;