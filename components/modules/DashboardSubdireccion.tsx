import React, { useState, useEffect, useMemo } from 'react';
import { Reemplazo, AcompanamientoDocente, CalendarEvent, EventType } from '../../types';
import { RUBRICA_ACOMPANAMIENTO_DOCENTE as defaultRubric, EVENT_TYPE_CONFIG } from '../../constants';

const ACOMPANAMIENTO_KEY = 'acompanamientoDocenteRecords';
const CALENDAR_KEY = 'eventosCalendario';
const CUSTOM_RUBRICA_KEY = 'acompanamientoDocenteCustomRubrica';

type RubricStructure = typeof defaultRubric;

interface StatCardProps {
    title: string;
    value: string | number;
    description: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description }) => (
    <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</h3>
        <p className="text-3xl font-bold text-slate-800 dark:text-slate-200 mt-2">{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
);

interface BarChartProps {
    title: string;
    data: { label: string; value: number | string }[];
    colorClass: string;
    valueFormatter?: (value: number | string) => string;
}

const BarChart: React.FC<BarChartProps> = ({ title, data, colorClass, valueFormatter = (v) => String(v) }) => {
    const numericData = useMemo(() => data.map(d => typeof d.value === 'number' ? d.value : parseFloat(String(d.value)) || 0), [data]);
    const maxValue = useMemo(() => Math.max(...numericData, 1), [numericData]);
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">{title}</h3>
            <div className="space-y-4">
                {data.length > 0 ? data.sort((a,b) => (typeof b.value === 'number' ? b.value : 0) - (typeof a.value === 'number' ? a.value : 0)).map((item, index) => {
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
                }) : <p className="text-slate-500 dark:text-slate-400 text-sm">No hay datos para mostrar.</p>}
            </div>
        </div>
    );
};

const DashboardSubdireccion: React.FC = () => {
    const [registros, setRegistros] = useState<Reemplazo[]>([]);
    const [acompanamientos, setAcompanamientos] = useState<AcompanamientoDocente[]>([]);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [rubrica, setRubrica] = useState<RubricStructure>(defaultRubric);


    useEffect(() => {
        const loadData = () => {
            try {
                const reemplazosData = localStorage.getItem('reemplazosDocentes');
                if (reemplazosData) setRegistros(JSON.parse(reemplazosData));
                
                const acompanamientosData = localStorage.getItem(ACOMPANAMIENTO_KEY);
                if (acompanamientosData) setAcompanamientos(JSON.parse(acompanamientosData));

                const calendarData = localStorage.getItem(CALENDAR_KEY);
                if (calendarData) setCalendarEvents(JSON.parse(calendarData));

                const customRubricData = localStorage.getItem(CUSTOM_RUBRICA_KEY);
                if (customRubricData) {
                    setRubrica(JSON.parse(customRubricData));
                } else {
                    setRubrica(defaultRubric);
                }

            } catch (e) {
                console.error("Error al leer datos de localStorage para el dashboard", e);
            }
        }
        loadData();
        // Listener para actualizar el dashboard si se cambia en otra pestaña/componente
        window.addEventListener('storage', loadData);
        return () => window.removeEventListener('storage', loadData);
    }, []);

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


    if (inasistenciaStats.totalInasistencias === 0 && acompanamientoStats.totalAcompanamientos === 0 && calendarEvents.length === 0) {
        return (
             <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md h-full w-full flex flex-col items-center justify-center text-center animate-fade-in">
                <span className="text-6xl mb-4">📊</span>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Dashboard de Subdirección</h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md">
                    Aún no hay datos para mostrar. Comience por añadir registros en los módulos correspondientes (Inasistencias, Acompañamiento, etc).
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-fade-in">
            {/* Inasistencias Dashboard */}
            {inasistenciaStats.totalInasistencias > 0 && (
                 <div className="space-y-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Dashboard de Inasistencias</h1>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="Total Inasistencias" value={inasistenciaStats.totalInasistencias} description="Registros totales" />
                        <StatCard title="Horas Realizadas" value={inasistenciaStats.horasRealizadas} description="Reemplazo con misma asignatura" />
                        <StatCard title="Horas Cubiertas" value={inasistenciaStats.horasCubiertas} description="Reemplazo con otra asignatura" />
                        <StatCard title="Tasa de Cobertura Efectiva" value={inasistenciaStats.tasaCobertura} description="% de horas realizadas" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <BarChart title="Inasistencias por Docente" data={inasistenciaStats.inasistenciasPorDocente} colorClass="bg-red-400" />
                        <BarChart title="Reemplazos por Docente" data={inasistenciaStats.reemplazosPorDocente} colorClass="bg-sky-400" />
                        <BarChart title="Inasistencias por Curso" data={inasistenciaStats.inasistenciasPorCurso} colorClass="bg-amber-400" />
                        <BarChart title="Distribución de Resultados" data={inasistenciaStats.distribucionResultados} colorClass="bg-green-400" />
                    </div>
                </div>
            )}
           
            {/* Acompañamiento Dashboard */}
            {acompanamientoStats.totalAcompanamientos > 0 && (
                <div className="space-y-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Dashboard de Acompañamiento Docente</h1>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="Total Acompañamientos" value={acompanamientoStats.totalAcompanamientos} description="Registros realizados" />
                        <StatCard title="Promedio General" value={acompanamientoStats.promedioGeneral} description="Calificación promedio (1-4)" />
                    </div>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <BarChart 
                          title="Desempeño Promedio por Docente" 
                          data={acompanamientoStats.desempenoPorDocente} 
                          colorClass="bg-indigo-400"
                          valueFormatter={(v) => Number(v).toFixed(2)}
                        />
                        <BarChart 
                          title="Desempeño Promedio por Dominio" 
                          data={acompanamientoStats.desempenoPorDominio} 
                          colorClass="bg-teal-400" 
                          valueFormatter={(v) => Number(v).toFixed(2)}
                        />
                    </div>
                </div>
            )}

            {/* Calendar Dashboard */}
            {calendarEvents.length > 0 && (
                <div className="space-y-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Resumen del Calendario Académico</h1>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="Evaluaciones" value={calendarStats.totalEvaluaciones} description="Eventos registrados" />
                        <StatCard title="Actos" value={calendarStats.totalActos} description="Eventos registrados" />
                        <StatCard title="Act. Focalizadas" value={calendarStats.totalActividadesFocalizadas} description="Eventos registrados" />
                        <StatCard title="Salidas Pedagógicas" value={calendarStats.totalSalidasPedagogicas} description="Eventos registrados" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       <BarChart title="Distribución de Eventos del Calendario" data={calendarStats.distribucionEventos} colorClass="bg-violet-400" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardSubdireccion;