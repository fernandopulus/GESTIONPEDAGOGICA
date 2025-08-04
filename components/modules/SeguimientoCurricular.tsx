import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PlanificacionDocente, NivelPlanificacion, PlanificacionUnidad, PlanificacionClase, User } from '../../types';
import { ASIGNATURAS } from '../../constants';
import { 
    subscribeToAllPlanificaciones, 
    subscribeToUserPlanificaciones 
} from '../../src/firebaseHelpers/seguimientoCurricularHelper';

// Icons
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

// Detail Modal Component
const PlanDetailModal: React.FC<{ plan: PlanificacionDocente; onClose: () => void }> = ({ plan, onClose }) => {
    
    const renderUnidadDetails = (p: PlanificacionUnidad) => (
        <div className="space-y-4">
            <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <p><strong>Objetivo de Aprendizaje:</strong> {p.objetivosAprendizaje}</p>
                <p><strong>Indicadores de Evaluación:</strong> {p.indicadoresEvaluacion}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2"><strong>Contenidos Clave:</strong> {p.contenidos}</p>
                <div className="mt-2">
                  <span className="inline-block bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-sm font-semibold">
                    Avance de la Unidad: {typeof p.progreso === 'number' ? `${p.progreso}%` : 'No registrado'}
                  </span>
                </div>
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
            <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <p><strong>Contenidos:</strong> {p.contenidos}</p>
              <div className="mt-2">
                <span className="inline-block bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-sm font-semibold">
                  Avance de la Clase: {typeof p.progreso === 'number' ? `${p.progreso}%` : 'No registrado'}
                </span>
              </div>
            </div>
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

// Hook para cargar planificaciones desde Firestore
const usePlanificacionesGlobales = (currentUser: User) => {
    const [planificaciones, setPlanificaciones] = useState<PlanificacionDocente[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const canViewAllPlans = useMemo(() => {
        return currentUser?.profile === 'SUBDIRECCION';
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser?.email && !currentUser?.id) {
            setError('Usuario no autenticado');
            setLoading(false);
            return;
        }

        console.log('🔄 Configurando suscripción a planificaciones...');
        console.log('🔍 Usuario actual:', {
            email: currentUser.email,
            id: currentUser.id,
            profile: currentUser.profile,
            canViewAll: canViewAllPlans
        });
        
        try {
            let unsubscribe: (() => void) | undefined;

            if (canViewAllPlans) {
                // SUBDIRECCION ve todas las planificaciones
                console.log('👑 Cargando todas las planificaciones (vista admin)');
                unsubscribe = subscribeToAllPlanificaciones((data) => {
                    console.log('✅ Planificaciones admin cargadas:', data.length);
                    setPlanificaciones(data);
                    setLoading(false);
                    setError(null);
                });
            } else {
                // Otros usuarios solo ven sus planificaciones
                const userId = currentUser.email || currentUser.id || '';
                console.log('👤 Cargando planificaciones del usuario:', userId);
                unsubscribe = subscribeToUserPlanificaciones(userId, (data) => {
                    console.log('✅ Planificaciones del usuario cargadas:', data.length);
                    setPlanificaciones(data);
                    setLoading(false);
                    setError(null);
                });
            }

            return unsubscribe;
        } catch (err) {
            console.error('❌ Error al configurar suscripción:', err);
            setError(err instanceof Error ? err.message : 'Error al conectar con la base de datos');
            setLoading(false);
        }
    }, [currentUser, canViewAllPlans]);

    return { planificaciones, loading, error, canViewAllPlans };
};

// Componente principal
interface SeguimientoCurricularProps {
    currentUser: User;
}

const SeguimientoCurricular: React.FC<SeguimientoCurricularProps> = ({ currentUser }) => {
    // LOGS DE DEBUG TEMPORALES
    console.log('🔍 SeguimientoCurricular - currentUser recibido:', currentUser);
    console.log('🔍 currentUser.email:', currentUser?.email);
    console.log('🔍 currentUser.id:', currentUser?.id);
    console.log('🔍 currentUser.profile:', currentUser?.profile);

    const { planificaciones, loading, error, canViewAllPlans } = usePlanificacionesGlobales(currentUser);
    const [selectedNivel, setSelectedNivel] = useState<string>('1º');
    const [openAsignatura, setOpenAsignatura] = useState<string | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<PlanificacionDocente | null>(null);

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

    // Verificar autenticación
    if (!currentUser || (!currentUser.email && !currentUser.id)) {
        return (
            <div className="flex justify-center items-center py-8">
                <div className="text-center">
                    <p className="text-slate-500 dark:text-slate-400 mb-2">Error: Usuario no autenticado</p>
                    <p className="text-sm text-slate-400">Datos recibidos: {JSON.stringify(currentUser)}</p>
                </div>
            </div>
        );
    }

    // Estado de carga
    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-6">Seguimiento Curricular</h1>
                <div className="flex justify-center items-center py-12">
                    <div className="flex items-center gap-3">
                        <LoadingIcon />
                        <span className="text-slate-600 dark:text-slate-400">Cargando planificaciones...</span>
                    </div>
                </div>
            </div>
        );
    }

    // Estado de error
    if (error) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-6">Seguimiento Curricular</h1>
                <div className="flex justify-center items-center py-12">
                    <div className="text-center">
                        <p className="text-red-600 dark:text-red-400 mb-2">Error al cargar las planificaciones</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Seguimiento Curricular</h1>
                    {canViewAllPlans && (
                        <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                            👑 Vista administrativa - Todas las planificaciones
                        </div>
                    )}
                </div>

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

                {planificaciones.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-slate-500 dark:text-slate-400 text-lg">
                            No hay planificaciones disponibles
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                            {canViewAllPlans 
                                ? "Ningún profesor ha creado planificaciones aún" 
                                : "Crea planificaciones desde el módulo de Planificación"}
                        </p>
                    </div>
                ) : (
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
                                        className="w-full flex justify-between items-center p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">{asignatura}</span>
                                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-full text-xs font-medium">
                                                {planesParaAsignatura.length} planificación{planesParaAsignatura.length !== 1 ? 'es' : ''}
                                            </span>
                                        </div>
                                        <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                                            <ChevronDownIcon />
                                        </span>
                                    </button>
                                    {isOpen && (
                                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 animate-fade-in-up">
                                            <ul className="space-y-3">
                                                {planesParaAsignatura.map(plan => (
                                                    <li key={plan.id}>
                                                        <button 
                                                            onClick={() => setSelectedPlan(plan)} 
                                                            className="w-full text-left p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex-1">
                                                                    <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                                                        {plan.tipo === 'Unidad' ? plan.nombreUnidad : plan.nombreClase}
                                                                    </p>
                                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                                        <span className="font-medium">Autor:</span> {plan.autor || 'No especificado'}
                                                                    </p>
                                                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                                                        Creado: {new Date(plan.fechaCreacion).toLocaleDateString('es-CL')}
                                                                    </p>
                                                                </div>
                                                                <div className="ml-3">
                                                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                                        plan.tipo === 'Unidad' 
                                                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                                                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                    }`}>
                                                                        {plan.tipo}
                                                                    </span>
                                                                </div>
                                                            </div>
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
            </div>

            {selectedPlan && <PlanDetailModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
        </>
    );
};

export default SeguimientoCurricular;