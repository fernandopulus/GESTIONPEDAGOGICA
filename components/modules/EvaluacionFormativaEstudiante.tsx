import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, EvaluacionFormativa, CalificacionesFormativas, TrabajoGrupal, Insignia, GamificacionEstudiante } from '../../types';
import { ROLES_TRABAJO_GRUPAL, INSIGNIAS_GAMIFICACION } from '../../constants';


const EVALUACIONES_KEY = 'evaluacionesFormativas';
const CALIFICACIONES_KEY = 'calificacionesFormativas';
const TRABAJOS_GRUPALES_KEY = 'trabajosGrupalesFormativos';

const asignaturaEmojis: Record<string, string> = {
    'Lengua y Literatura': '📚', 'Matemática': '➗', 'Inglés': '🇬🇧', 'Filosofía': '🤔',
    'Historia y Geografía': '🌍', 'Educación Ciudadana': '🏛️', 'Ciencias': '🔬', 'Ciencias para la Ciudadanía': '💡',
    'Artes': '🎨', 'Música': '🎵', 'Educación Física': '🏃‍♂️', 'Orientación': '🧭', 'Mecánica Industrial': '⚙️',
    'Mecánica Automotriz': '🚗', 'Emprendimiento': '💼', 'Tecnología': '💻', 'Pensamiento Lógico': '🧠', 'Competencia Lectora': '📖',
    'Default': '✏️'
};

interface EvaluacionFormativaEstudianteProps {
    currentUser: User;
}

interface ResultadoAsignatura {
    asignatura: string;
    promedio: string;
    actividades: {
        id: string;
        nombreActividad: string;
        fecha: string;
        estado: 'Trabajado' | 'No Trabajado';
    }[];
}

const EvaluacionFormativaEstudiante: React.FC<EvaluacionFormativaEstudianteProps> = ({ currentUser }) => {
    const [evaluaciones, setEvaluaciones] = useState<EvaluacionFormativa[]>([]);
    const [calificaciones, setCalificaciones] = useState<CalificacionesFormativas>({});
    const [trabajosGrupales, setTrabajosGrupales] = useState<TrabajoGrupal[]>([]);
    const [gamificacion, setGamificacion] = useState<GamificacionEstudiante | null>(null);
    const [isLogrosModalOpen, setIsLogrosModalOpen] = useState(false);
    const [newlyAchievedRank, setNewlyAchievedRank] = useState<Insignia | null>(null);
    const prevPromedioRef = useRef<number | null>(null);

    useEffect(() => {
        try {
            const storedEvaluaciones = localStorage.getItem(EVALUACIONES_KEY);
            if (storedEvaluaciones) setEvaluaciones(JSON.parse(storedEvaluaciones));

            const storedCalificaciones = localStorage.getItem(CALIFICACIONES_KEY);
            if (storedCalificaciones) setCalificaciones(JSON.parse(storedCalificaciones));
            
            const storedTrabajos = localStorage.getItem(TRABAJOS_GRUPALES_KEY);
            if(storedTrabajos) setTrabajosGrupales(JSON.parse(storedTrabajos));
        } catch (e) {
            console.error("Error al cargar datos desde localStorage", e);
        }
    }, []);

    const resultadosPorAsignatura = useMemo<ResultadoAsignatura[]>(() => {
        if (!currentUser.curso) return [];

        const evsDelCurso = evaluaciones.filter(ev => ev.curso === currentUser.curso);
        
        const evsPorAsignatura = evsDelCurso.reduce((acc, ev) => {
            (acc[ev.asignatura] = acc[ev.asignatura] || []).push(ev);
            return acc;
        }, {} as Record<string, EvaluacionFormativa[]>);

        return Object.entries(evsPorAsignatura).map(([asignatura, evs]) => {
            let sumaNotas = 0;
            let count = 0;

            const actividadesDetalle = evs.map(ev => {
                const calificacion = calificaciones[ev.id]?.[currentUser.nombreCompleto];
                let estado: 'Trabajado' | 'No Trabajado' = 'No Trabajado';

                if (calificacion === 'trabajado') {
                    sumaNotas += 7.0;
                    count++;
                    estado = 'Trabajado';
                } else if (calificacion === 'no trabajado') {
                    sumaNotas += 2.0;
                    count++;
                    estado = 'No Trabajado';
                }

                return {
                    id: ev.id,
                    nombreActividad: ev.nombreActividad,
                    fecha: ev.fecha,
                    estado,
                };
            }).filter(act => calificaciones[act.id]?.[currentUser.nombreCompleto]);

            const promedio = count > 0 ? (sumaNotas / count).toFixed(1) : 'N/A';
            
            return {
                asignatura,
                promedio,
                actividades: actividadesDetalle.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
            };
        }).filter(res => res.actividades.length > 0)
         .sort((a,b) => a.asignatura.localeCompare(b.asignatura));

    }, [evaluaciones, calificaciones, currentUser]);
    
    useEffect(() => {
        const totalActividades = resultadosPorAsignatura.reduce((acc, curr) => acc + curr.actividades.length, 0);
        if (totalActividades === 0) {
            setGamificacion(null);
            return;
        }

        const sumaPromedios = resultadosPorAsignatura.reduce((acc, curr) => {
            const prom = parseFloat(curr.promedio);
            return isNaN(prom) ? acc : acc + prom;
        }, 0);
        
        const promedioGeneral = resultadosPorAsignatura.length > 0 ? (sumaPromedios / resultadosPorAsignatura.length) : 0;
        const rangoActual = INSIGNIAS_GAMIFICACION.find(i => promedioGeneral >= i.promedioMin && promedioGeneral <= i.promedioMax) || null;
        const insigniasGanadas = INSIGNIAS_GAMIFICACION.filter(i => promedioGeneral >= i.promedioMin);

        setGamificacion({
            puntajeTotal: 0, // Simplified for now, can be expanded later
            promedio: promedioGeneral,
            rangoActual,
            insigniasGanadas,
        });
        
        if (prevPromedioRef.current !== null) {
            const prevRank = INSIGNIAS_GAMIFICACION.find(i => prevPromedioRef.current! >= i.promedioMin && prevPromedioRef.current! <= i.promedioMax) || null;
            if (rangoActual && (!prevRank || rangoActual.nombre !== prevRank.nombre)) {
                setNewlyAchievedRank(rangoActual);
            }
        }
        prevPromedioRef.current = promedioGeneral;

    }, [resultadosPorAsignatura]);


     const misTrabajosGrupales = useMemo(() => {
        if (!currentUser.curso) return [];
        
        return trabajosGrupales
            .filter(trabajo => trabajo.curso === currentUser.curso)
            .map(trabajo => {
                const miGrupo = trabajo.grupos.find(g => g.integrantes.some(i => i.nombre === currentUser.nombreCompleto));
                if (!miGrupo) return null;

                return {
                    ...trabajo,
                    miGrupo,
                };
            })
            .filter((t): t is (TrabajoGrupal & { miGrupo: NonNullable<TrabajoGrupal['grupos'][0]> }) => t !== null)
            .sort((a,b) => new Date(b.fechaPresentacion).getTime() - new Date(a.fechaPresentacion).getTime());
    }, [trabajosGrupales, currentUser]);

    const handleRoleSelection = (trabajoId: string, newRole: string) => {
        const allTrabajosData = localStorage.getItem(TRABAJOS_GRUPALES_KEY);
        const allTrabajos: TrabajoGrupal[] = allTrabajosData ? JSON.parse(allTrabajosData) : [];

        const updatedTrabajos = allTrabajos.map(trabajo => {
            if (trabajo.id === trabajoId) {
                const updatedGrupos = trabajo.grupos.map(grupo => {
                    const isMyGroup = grupo.integrantes.some(i => i.nombre === currentUser.nombreCompleto);
                    if (isMyGroup) {
                        const updatedIntegrantes = grupo.integrantes.map(integrante => {
                            if (integrante.nombre === currentUser.nombreCompleto) {
                                return { ...integrante, rol: newRole || undefined };
                            }
                            return integrante;
                        });
                        return { ...grupo, integrantes: updatedIntegrantes };
                    }
                    return grupo;
                });
                return { ...trabajo, grupos: updatedGrupos };
            }
            return trabajo;
        });

        localStorage.setItem(TRABAJOS_GRUPALES_KEY, JSON.stringify(updatedTrabajos));
        setTrabajosGrupales(updatedTrabajos);
    };

    const getPromedioColor = (promedio: string) => {
        const nota = parseFloat(promedio);
        if (isNaN(nota)) return 'bg-slate-400';
        if (nota < 4.0) return 'bg-red-500';
        if (nota < 5.5) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="space-y-8 animate-fade-in">
             {newlyAchievedRank && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={() => setNewlyAchievedRank(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md text-center p-8 animate-fade-in-up transform transition-all" onClick={e => e.stopPropagation()}>
                        <div className="text-8xl animate-bounce">{newlyAchievedRank.emoji}</div>
                        <h2 className="text-3xl font-bold text-slate-800 mt-4">¡Subiste de Rango!</h2>
                        <p className="text-2xl font-semibold text-amber-500 mt-2">{newlyAchievedRank.nombre}</p>
                        <p className="text-slate-600 mt-4">{newlyAchievedRank.mensaje}</p>
                        <button onClick={() => setNewlyAchievedRank(null)} className="mt-6 bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700">¡Genial!</button>
                    </div>
                </div>
            )}
             {isLogrosModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setIsLogrosModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                         <h2 className="text-2xl font-bold text-slate-800 mb-4">Mis Logros</h2>
                         <div className="overflow-y-auto space-y-3">
                             {INSIGNIAS_GAMIFICACION.map(insignia => {
                                 const isUnlocked = gamificacion?.insigniasGanadas.some(g => g.nombre === insignia.nombre);
                                 return (
                                     <div key={insignia.nombre} className={`flex items-center gap-4 p-4 rounded-lg border ${isUnlocked ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                                        <div className="text-5xl">{insignia.emoji}</div>
                                        <div>
                                            <h3 className={`font-bold ${isUnlocked ? 'text-amber-700' : 'text-slate-600'}`}>{insignia.nombre}</h3>
                                            <p className="text-sm text-slate-500">Requisito: Promedio entre {insignia.promedioMin} y {insignia.promedioMax}</p>
                                        </div>
                                     </div>
                                 )
                             })}
                         </div>
                    </div>
                </div>
            )}
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Mi Rendimiento Formativo</h1>
                <p className="text-slate-500 mb-6">Aquí puedes ver un resumen de tu trabajo en clases por cada asignatura.</p>
                
                {gamificacion && gamificacion.rangoActual && (
                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6 rounded-xl mb-8 flex items-center justify-between">
                        <div>
                            <p className="text-sm opacity-80">RANGO ACTUAL</p>
                            <h2 className="text-3xl font-bold">{gamificacion.rangoActual.nombre}</h2>
                            <button onClick={() => setIsLogrosModalOpen(true)} className="mt-2 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full">Ver todos los logros</button>
                        </div>
                        <div className="text-right">
                             <div className="text-7xl">{gamificacion.rangoActual.emoji}</div>
                             <p className="font-bold text-2xl mt-2">{gamificacion.promedio.toFixed(1)}</p>
                             <p className="text-sm opacity-80">Promedio General</p>
                        </div>
                    </div>
                )}

                {resultadosPorAsignatura.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {resultadosPorAsignatura.map(res => (
                            <div key={res.asignatura} className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">{res.asignatura}</h2>
                                        <p className="text-sm text-slate-500">Promedio Formativo</p>
                                    </div>
                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl ${getPromedioColor(res.promedio)}`}>
                                        {res.promedio}
                                    </div>
                                </div>
                                <div className="flex-grow space-y-2 pt-4 border-t border-slate-200">
                                    <h3 className="text-sm font-semibold text-slate-600 mb-2">Detalle de Actividades:</h3>
                                    {res.actividades.map(act => (
                                        <div key={act.id} className="flex justify-between items-center text-sm bg-white p-2 rounded">
                                            <div>
                                                <p className="font-medium text-slate-700">{act.nombreActividad}</p>
                                                <p className="text-xs text-slate-500">{new Date(act.fecha + 'T12:00:00').toLocaleDateString('es-CL')}</p>
                                            </div>
                                            <span className={`font-semibold ${act.estado === 'Trabajado' ? 'text-green-600' : 'text-red-600'}`}>
                                                {act.estado === 'Trabajado' ? '✅ Trabajado' : '❌ No Trabajado'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-slate-50 rounded-lg">
                        <span className="text-5xl">📊</span>
                        <h2 className="mt-4 text-xl font-bold text-slate-700">Aún sin registros</h2>
                        <p className="text-slate-500 mt-2">Todavía no tienes evaluaciones formativas registradas por tus profesores.</p>
                    </div>
                )}
            </div>

            {misTrabajosGrupales.length > 0 && (
                 <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Mis Trabajos Grupales</h2>
                     <div className="space-y-4">
                        {misTrabajosGrupales.map(trabajo => {
                             const usedRoles = trabajo.miGrupo.integrantes
                                .filter(i => i.nombre !== currentUser.nombreCompleto && i.rol)
                                .map(i => i.rol as string);
                             const availableRoles = ROLES_TRABAJO_GRUPAL.filter(r => !usedRoles.includes(r));

                            return (
                            <div key={trabajo.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                                <h3 className="font-bold text-slate-800">{trabajo.nombreActividad}</h3>
                                <p className="text-sm text-slate-500">{trabajo.asignatura} - Presentación: {new Date(trabajo.fechaPresentacion + 'T12:00:00').toLocaleDateString('es-CL')}</p>
                                <div className="mt-3 pt-3 border-t">
                                    <h4 className="font-semibold text-sm">Grupo {trabajo.miGrupo.numero}</h4>
                                    <ul className="list-disc list-inside text-sm mt-2 space-y-2">
                                        {trabajo.miGrupo.integrantes.map(integrante => (
                                            <li key={integrante.nombre} className="grid grid-cols-2 items-center">
                                                <span className={integrante.nombre === currentUser.nombreCompleto ? 'font-bold' : ''}>
                                                    {integrante.nombre}
                                                </span>
                                                {integrante.nombre === currentUser.nombreCompleto ? (
                                                    <select
                                                        value={integrante.rol || ''}
                                                        onChange={(e) => handleRoleSelection(trabajo.id, e.target.value)}
                                                        className="text-sm p-1 border rounded w-full"
                                                    >
                                                        <option value="">-- Seleccionar rol --</option>
                                                        {integrante.rol && !availableRoles.includes(integrante.rol) && <option value={integrante.rol}>{integrante.rol}</option>}
                                                        {availableRoles.map(rol => <option key={rol} value={rol}>{rol}</option>)}
                                                    </select>
                                                ) : (
                                                    <span className="text-xs italic bg-slate-200 px-2 py-1 rounded-full">{integrante.rol || 'Sin rol'}</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )})}
                     </div>
                </div>
            )}
        </div>
    );
};

export default EvaluacionFormativaEstudiante;