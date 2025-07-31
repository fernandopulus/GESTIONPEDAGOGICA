import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PlanificacionDocente, NivelPlanificacion, PlanificacionUnidad, PlanificacionClase } from '../../types';
import { ASIGNATURAS } from '../../constants';

const PLANIFICACIONES_KEY = 'planificacionesDocente';

// Icons
const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
);


// Detail Modal Component
const PlanDetailModal: React.FC<{ plan: PlanificacionDocente; onClose: () => void }> = ({ plan, onClose }) => {
    
    const renderUnidadDetails = (p: PlanificacionUnidad) => (
        <div className="space-y-4">
            <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <p><strong>Objetivo de Aprendizaje:</strong> {p.objetivosAprendizaje}</p>
                <p><strong>Indicadores de Evaluación:</strong> {p.indicadoresEvaluacion}</p>
                 <p className="text-sm text-slate-500 dark:text-slate-400 mt-2"><strong>Contenidos Clave:</strong> {p.contenidos}</p>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b pb-2">Secuencia de Clases ({p.cantidadClases})</h3>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                {p.detallesLeccion.map((lesson, index) => (
                    <div key={index} className="p-3 border dark:border-slate-600 rounded-md bg-white dark:bg-slate-800">
                        <h4 className="font-semibold text-slate-700 dark:text-slate-300">Clase {index + 1}: {lesson.actividades}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm text-slate-600 dark:text-slate-400">
                            <span><strong>Objetivo:</strong> {lesson.objetivosAprendizaje}</span>
                            <span><strong>Contenidos:</strong> {lesson.contenidosConceptuales}</span>
                            <span><strong>Habilidad (Bloom):</strong> {lesson.habilidadesBloom}</span>
                            <span><strong>Perfil de Egreso:</strong> {lesson.perfilEgreso}</span>
                            <span className="md:col-span-2"><strong>Interdisciplinariedad:</strong> {lesson.asignaturasInterdisciplinariedad}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderClaseDetails = (p: PlanificacionClase) => (
        <div className="space-y-4">
            <p className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg"><strong>Contenidos:</strong> {p.contenidos}</p>
            <div className="space-y-3">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Inicio</h3>
                    <p className="p-3 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-600 whitespace-pre-wrap">{p.momentosClase.inicio}</p>
                </div>
                 <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Desarrollo</h3>
                    <p className="p-3 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-600 whitespace-pre-wrap">{p.momentosClase.desarrollo}</p>
                </div>
                 <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Cierre</h3>
                    <p className="p-3 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-600 whitespace-pre-wrap">{p.momentosClase.cierre}</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                           {plan.tipo === 'Unidad' ? plan.nombreUnidad : plan.nombreClase}
                        </h2>
                         <p className="text-sm text-slate-500 dark:text-slate-400">
                            {plan.asignatura} | {plan.nivel} | Autor: {plan.autor || 'N/A'}
                        </p>
                    </div>
                     <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <CloseIcon />
                    </button>
                </header>
                <main className="p-4 flex-1 overflow-y-auto">
                    {plan.tipo === 'Unidad' ? renderUnidadDetails(plan) : renderClaseDetails(plan)}
                </main>
            </div>
        </div>
    );
};


const SeguimientoCurricular: React.FC = () => {
    const [planificaciones, setPlanificaciones] = useState<PlanificacionDocente[]>([]);
    const [selectedNivel, setSelectedNivel] = useState<string>('1º');
    const [openAsignatura, setOpenAsignatura] = useState<string | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<PlanificacionDocente | null>(null);

    const loadData = useCallback(() => {
        try {
            const data = localStorage.getItem(PLANIFICACIONES_KEY);
            if (data) {
                setPlanificaciones(JSON.parse(data));
            }
        } catch (e) {
            console.error("Error al leer planificaciones de localStorage", e);
        }
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('storage', loadData);
        return () => {
            window.removeEventListener('storage', loadData);
        };
    }, [loadData]);

    const planesPorNivel = useMemo(() => {
        const nivelMap: Record<string, NivelPlanificacion> = {
            '1º': '1º Medio',
            '2º': '2º Medio',
            '3º': '3º Medio',
            '4º': '4º Medio',
        };
        const nivelCompleto = nivelMap[selectedNivel];
        return planificaciones.filter(p => p.nivel === nivelCompleto);
    }, [planificaciones, selectedNivel]);

    const handleToggleAsignatura = (asignatura: string) => {
        setOpenAsignatura(prev => (prev === asignatura ? null : asignatura));
    };

    const nivelesParaTabs = [
        { key: '1º', label: '1º Medio' },
        { key: '2º', label: '2º Medio' },
        { key: '3º', label: '3º Medio' },
        { key: '4º', label: '4º Medio' },
    ];

    return (
        <>
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-6">Seguimiento Curricular</h1>

                <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {nivelesParaTabs.map(nivel => (
                            <button
                                key={nivel.key}
                                onClick={() => setSelectedNivel(nivel.key)}
                                className={`${
                                    selectedNivel === nivel.key
                                        ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors focus:outline-none`}
                            >
                                {nivel.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="space-y-4">
                    {ASIGNATURAS.map(asignatura => {
                        const planesParaAsignatura = planesPorNivel.filter(p => p.asignatura === asignatura);
                        if (planesParaAsignatura.length === 0) {
                            return null;
                        }
                        const isOpen = openAsignatura === asignatura;
                        return (
                            <div key={asignatura} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <button
                                    onClick={() => handleToggleAsignatura(asignatura)}
                                    className="w-full flex justify-between items-center p-4 text-left"
                                >
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{asignatura}</span>
                                    <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                                        <ChevronDownIcon />
                                    </span>
                                </button>
                                {isOpen && (
                                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 animate-fade-in-up">
                                        <ul className="space-y-3">
                                            {planesParaAsignatura.length > 0 ? planesParaAsignatura.map(plan => (
                                                <li key={plan.id}>
                                                    <button onClick={() => setSelectedPlan(plan)} className="w-full text-left p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                        <p className="font-medium text-slate-800 dark:text-slate-200">
                                                            {plan.tipo === 'Unidad' ? plan.nombreUnidad : plan.nombreClase}
                                                        </p>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                                            Autor: {plan.autor || 'No especificado'} - Creado: {new Date(plan.fechaCreacion).toLocaleDateString('es-CL')}
                                                        </p>
                                                    </button>
                                                </li>
                                            )) : (
                                                <li className="text-sm text-slate-500 dark:text-slate-400">No hay planificaciones para esta asignatura.</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedPlan && <PlanDetailModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
        </>
    );
};

export default SeguimientoCurricular;
