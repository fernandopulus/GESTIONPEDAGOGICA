import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PlanificacionDocente, NivelPlanificacion, PlanificacionUnidad, User } from '../../types';
import { ASIGNATURAS } from '../../constants';
import { 
    subscribeToAllPlanificaciones, 
    subscribeToUserPlanificaciones 
} from '../../src/firebaseHelpers/seguimientoCurricularHelper';
import * as d3 from 'd3';
import d3Cloud from 'd3-cloud';

// =================================================================================
// SUB-COMPONENTES Y HOOKS
// =================================================================================

// --- Iconos ---
const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const LoadingIcon = () => (
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- Hook de Datos ---
const usePlanificacionesGlobales = (currentUser: User) => {
    const [planificaciones, setPlanificaciones] = useState<PlanificacionDocente[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const canViewAllPlans = useMemo(() => currentUser?.profile === 'SUBDIRECCION', [currentUser]);

    useEffect(() => {
        if (!currentUser?.email && !currentUser?.id) {
            setError('Usuario no autenticado');
            setLoading(false);
            return;
        }
        
        try {
            let unsubscribe;
            const handleData = (data: PlanificacionDocente[]) => {
                setPlanificaciones(data);
                setLoading(false);
                setError(null);
            };

            if (canViewAllPlans) {
                unsubscribe = subscribeToAllPlanificaciones(handleData);
            } else {
                const userId = currentUser.email || currentUser.id || '';
                unsubscribe = subscribeToUserPlanificaciones(handleData, userId);
            }

            return unsubscribe;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al conectar con la base de datos');
            setLoading(false);
        }
    }, [currentUser, canViewAllPlans]);

    return { planificaciones, loading, error, canViewAllPlans };
};

// --- Componente Modal ---
const PlanDetailModal: React.FC<{ plan: PlanificacionUnidad; onClose: () => void }> = ({ plan, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{plan.nombreUnidad}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{plan.asignatura} | {plan.nivel} | Autor: {plan.autor || 'N/A'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><CloseIcon /></button>
                </header>
                <main className="p-6 flex-1 overflow-y-auto space-y-6">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <p><strong>Objetivo de Aprendizaje:</strong> {plan.objetivosAprendizaje}</p>
                        <p className="mt-2"><strong>Indicadores de Evaluación:</strong> {plan.indicadoresEvaluacion}</p>
                        <div className="mt-3">
                            <span className="inline-block bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-sm font-semibold">
                                Avance de la Unidad: {typeof plan.progreso === 'number' ? `${plan.progreso}%` : 'No registrado'}
                            </span>
                        </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b pb-2">Secuencia de Clases ({plan.detallesLeccion.length})</h3>
                    <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2">
                        {plan.detallesLeccion.map((lesson, index) => (
                            <div key={index} className="p-3 border dark:border-slate-700 rounded-md bg-white dark:bg-slate-800">
                                <h4 className="font-semibold text-slate-700 dark:text-slate-300">Clase {index + 1}: {lesson.actividades}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm text-slate-600 dark:text-slate-400">
                                    <span><strong>Objetivo:</strong> {lesson.objetivosAprendizaje}</span>
                                    <span><strong>Contenidos:</strong> {lesson.contenidosConceptuales}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {plan.reflexionUnidad && (
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b pb-2 mt-6">Reflexión Docente</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg mt-4">
                                <div>
                                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Habilidades Desarrolladas (Priorizadas)</h4>
                                    {plan.reflexionUnidad.ordenHabilidades && plan.reflexionUnidad.ordenHabilidades.length > 0 ? (
                                        <ul className="space-y-2">
                                            {plan.reflexionUnidad.ordenHabilidades.map((habilidad, index) => (
                                                <li key={habilidad} className="p-2 bg-white dark:bg-slate-700 rounded-md flex items-center gap-2 shadow-sm">
                                                    <span className="font-bold text-amber-500">{index + 1}.</span> {habilidad}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : <p className="text-sm text-slate-500 dark:text-slate-400">No priorizadas.</p>}
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Fortalezas</h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 p-2 bg-white dark:bg-slate-700 rounded-md">{plan.reflexionUnidad.fortalezas || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Mejoras</h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 p-2 bg-white dark:bg-slate-700 rounded-md">{plan.reflexionUnidad.mejoras || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Desafíos</h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 p-2 bg-white dark:bg-slate-700 rounded-md">{plan.reflexionUnidad.debilidades || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

// --- Componente de Visualización de Reflexiones ---
const HABILIDADES_BLOOM = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar', 'Crear'];
const NIVELES: NivelPlanificacion[] = ['1º Medio', '2º Medio', '3º Medio', '4º Medio'];

interface WordCloudProps { words: { text: string; value: number }[] }

const WordCloud: React.FC<WordCloudProps> = ({ words }) => {
    const ref = useRef<SVGSVGElement>(null);
    useEffect(() => {
        if (!words.length || !ref.current) return;
        const svg = d3.select(ref.current);
        svg.selectAll("*").remove();
        const layout = d3Cloud().size([500, 350]).words(words.map(d => ({ ...d }))).padding(5).rotate(() => (~~(Math.random() * 6) - 3) * 15).font("Impact").fontSize(d => Math.sqrt(d.value) * 12).on("end", draw);
        layout.start();
        function draw(words: d3Cloud.Word[]) {
            svg.attr("width", layout.size()[0]).attr("height", layout.size()[1]).append("g").attr("transform", `translate(${layout.size()[0] / 2},${layout.size()[1] / 2})`).selectAll("text").data(words).enter().append("text").style("font-size", d => `${d.size}px`).style("font-family", "Impact").style("fill", (d, i) => d3.scaleOrdinal(d3.schemeCategory10)(i.toString())).attr("text-anchor", "middle").attr("transform", d => `translate(${[d.x, d.y]})rotate(${d.rotate})`).text(d => d.text);
        }
    }, [words]);
    return <svg ref={ref}></svg>;
};

const VisualizacionReflexiones: React.FC<{ planificaciones: PlanificacionUnidad[] }> = ({ planificaciones }) => {
    const [selectedNivel, setSelectedNivel] = useState<NivelPlanificacion | 'todos'>('todos');
    const [selectedAsignatura, setSelectedAsignatura] = useState<string>('todos');
    const asignaturasUnicas = useMemo(() => ['todos', ...Array.from(new Set(planificaciones.map(p => p.asignatura)))], [planificaciones]);
    const filteredPlanificaciones = useMemo(() => planificaciones.filter(p => (selectedNivel === 'todos' || p.nivel === selectedNivel) && (selectedAsignatura === 'todos' || p.asignatura === selectedAsignatura) && p.reflexionUnidad), [planificaciones, selectedNivel, selectedAsignatura]);
    const rankingHabilidades = useMemo(() => {
        const scores = HABILIDADES_BLOOM.reduce((acc, skill) => ({ ...acc, [skill]: 0 }), {} as Record<string, number>);
        filteredPlanificaciones.forEach(p => p.reflexionUnidad?.ordenHabilidades?.forEach((skill, index) => { if (scores[skill] !== undefined) scores[skill] += HABILIDADES_BLOOM.length - index; }));
        return Object.entries(scores).map(([text, value]) => ({ text, value })).sort((a, b) => b.value - a.value);
    }, [filteredPlanificaciones]);
    const wordCloudData = useMemo(() => {
        const stopWords = new Set(['y', 'e', 'o', 'u', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'a', 'con', 'que', 'se', 'del', 'al', 'no', 'si', 'fue', 'es', 'son', 'muy', 'mas', 'lo', 'como', 'sus', 'para', 'por', 'este', 'esta', 'actividad', 'clase', 'alumnos', 'estudiantes']);
        const text = filteredPlanificaciones.map(p => `${p.reflexionUnidad?.fortalezas || ''} ${p.reflexionUnidad?.debilidades || ''}`).join(' ');
        const wordCounts = (text.toLowerCase().match(/\b(\w{4,})\b/g) || []).reduce((acc, word) => { if (!stopWords.has(word)) acc[word] = (acc[word] || 0) + 1; return acc; }, {} as Record<string, number>);
        return Object.entries(wordCounts).map(([text, value]) => ({ text, value })).sort((a, b) => b.value - a.value).slice(0, 50);
    }, [filteredPlanificaciones]);
    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600";
    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nivel</label>
                    <select value={selectedNivel} onChange={e => setSelectedNivel(e.target.value as NivelPlanificacion | 'todos')} className={inputStyles}>
                        <option value="todos">Todos los Niveles</option>
                        {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
                    <select value={selectedAsignatura} onChange={e => setSelectedAsignatura(e.target.value)} className={inputStyles}>
                        {asignaturasUnicas.map(a => <option key={a} value={a}>{a === 'todos' ? 'Todas las Asignaturas' : a}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-6 border dark:border-slate-700 rounded-lg">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Ranking de Habilidades</h2>
                    {rankingHabilidades.every(h => h.value === 0) ? <p className="text-center py-10 text-slate-500">No hay datos</p> : <ul className="space-y-3">{rankingHabilidades.map((skill, i) => <li key={skill.text} className="flex items-center gap-4"><span className="font-bold text-lg text-amber-500 w-6 text-center">{i + 1}</span><div className="flex-1"><p className="font-semibold text-slate-700 dark:text-slate-300">{skill.text}</p><div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5"><div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${(skill.value / (rankingHabilidades[0].value || 1)) * 100}%` }}></div></div></div></li>)}</ul>}
                </div>
                <div className="p-6 border dark:border-slate-700 rounded-lg flex flex-col items-center justify-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Nube de Contenidos</h2>
                    {wordCloudData.length > 0 ? <WordCloud words={wordCloudData} /> : <p className="text-center py-10 text-slate-500">No hay datos suficientes</p>}
                </div>
            </div>
        </div>
    );
};


// =================================================================================
// COMPONENTE PRINCIPAL
// =================================================================================
interface SeguimientoCurricularProps {
    currentUser: User;
}

const SeguimientoCurricular: React.FC<SeguimientoCurricularProps> = ({ currentUser }) => {
    const { planificaciones, loading, error, canViewAllPlans } = usePlanificacionesGlobales(currentUser);
    const [activeView, setActiveView] = useState<'seguimiento' | 'analisis'>('seguimiento');
    const [selectedNivel, setSelectedNivel] = useState<string>('1º');
    const [openAsignatura, setOpenAsignatura] = useState<string | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<PlanificacionUnidad | null>(null);

    const planesPorNivel = useMemo(() => {
        const nivelMap: Record<string, NivelPlanificacion> = { '1º': '1º Medio', '2º': '2º Medio', '3º': '3º Medio', '4º': '4º Medio' };
        return planificaciones.filter((p): p is PlanificacionUnidad => p.nivel === nivelMap[selectedNivel] && p.tipo === 'Unidad');
    }, [planificaciones, selectedNivel]);

    const nivelesParaTabs = [{ key: '1º', label: '1º Medio' }, { key: '2º', label: '2º Medio' }, { key: '3º', label: '3º Medio' }, { key: '4º', label: '4º Medio' }];

    if (!currentUser?.id) return <div className="text-center py-8"><p>Usuario no autenticado.</p></div>;
    if (loading) return <div className="text-center py-8 flex justify-center items-center gap-3"><LoadingIcon /><span>Cargando planificaciones...</span></div>;
    if (error) return <div className="text-center py-8"><p className="text-red-500">Error: {error}</p></div>;

    const renderSeguimientoView = () => (
        <>
            <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {nivelesParaTabs.map(nivel => (
                        <button key={nivel.key} onClick={() => setSelectedNivel(nivel.key)}
                            className={`${selectedNivel === nivel.key ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg`}>
                            {nivel.label}
                        </button>
                    ))}
                </nav>
            </div>
            {planesPorNivel.length === 0 ? (
                <div className="text-center py-12"><p className="text-slate-500">No hay planificaciones de unidad para este nivel.</p></div>
            ) : (
                <div className="space-y-4">
                    {ASIGNATURAS.map(asignatura => {
                        const planesParaAsignatura = planesPorNivel.filter(p => p.asignatura === asignatura);
                        if (planesParaAsignatura.length === 0) return null;
                        const isOpen = openAsignatura === asignatura;
                        return (
                            <div key={asignatura} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <button onClick={() => setOpenAsignatura(isOpen ? null : asignatura)} className="w-full flex justify-between items-center p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{asignatura}</span>
                                        <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-full text-xs font-medium">{planesParaAsignatura.length} unidad{planesParaAsignatura.length > 1 ? 'es' : ''}</span>
                                    </div>
                                    <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}><ChevronDownIcon /></span>
                                </button>
                                {isOpen && (
                                    <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                                        <ul className="space-y-3">
                                            {planesParaAsignatura.map(plan => (
                                                <li key={plan.id}>
                                                    <button onClick={() => setSelectedPlan(plan)} className="w-full text-left p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 group">
                                                        <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-amber-600">{plan.nombreUnidad}</p>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Autor: {plan.autor || 'N/A'}</p>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );

    return (
        <>
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Seguimiento Curricular</h1>
                    {canViewAllPlans && <div className="text-sm text-amber-600 font-medium">👑 Vista administrativa</div>}
                </div>

                <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button onClick={() => setActiveView('seguimiento')} className={`${activeView === 'seguimiento' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'} py-4 px-1 border-b-2 font-medium text-lg`}>
                            Seguimiento por Nivel
                        </button>
                        <button onClick={() => setActiveView('analisis')} className={`${activeView === 'analisis' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'} py-4 px-1 border-b-2 font-medium text-lg`}>
                            Análisis de Reflexiones
                        </button>
                    </nav>
                </div>

                {activeView === 'seguimiento' && renderSeguimientoView()}
                {activeView === 'analisis' && <VisualizacionReflexiones planificaciones={planificaciones.filter((p): p is PlanificacionUnidad => p.tipo === 'Unidad')} />}
            </div>

            {selectedPlan && <PlanDetailModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
        </>
    );
};

export default SeguimientoCurricular;
