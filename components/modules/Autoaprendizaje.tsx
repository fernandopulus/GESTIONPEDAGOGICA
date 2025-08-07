import React, { useState, useEffect, useCallback } from 'react';
import {
    ActividadRemota,
    RespuestaEstudianteActividad,
    User,
    TipoActividadRemota,
    QuizQuestion,
    PareadoItem,
    ComprensionLecturaContent,
    DesarrolloContent,
    DetailedFeedback,
    PuntajesPorSeccion,
    PruebaEstandarizada,
    RespuestaPruebaEstandarizada,
} from '../../types'; // Ajusta la ruta a tu archivo de types
import { logApiCall } from '../utils/apiLogger'; // Ajusta la ruta a tus utils
import {
    subscribeToActividadesDisponibles,
    subscribeToRespuestasEstudiante,
    saveRespuestaActividad,
    getPruebasParaEstudiante,
    subscribeToRespuestasPruebasEstudiante,
    saveRespuestaPrueba,
} from '../../src/firebaseHelpers/autoaprendizajeHelper'; // Ajusta la ruta a tus helpers de Firebase

{/* La importación de la IA generativa con el comentario corregido */}
import { GoogleGenerativeAI } from '@google/generative-ai';


// --- Funciones de Utilidad y Componentes Genéricos ---

const shuffleArray = (array: any[]) => {
    return [...array].sort(() => Math.random() - 0.5);
};

const calculateGrade = (score: number, maxScore: number): string => {
    if (maxScore === 0) return '1.0';
    const exigencia = 0.6;
    const puntajeAprobacion = maxScore * exigencia;
    let nota = 1.0;
    if (score >= puntajeAprobacion) {
        if ((maxScore - puntajeAprobacion) > 0) {
            nota = 4.0 + (score - puntajeAprobacion) * 3.0 / (maxScore - puntajeAprobacion);
        } else {
            nota = 7.0;
        }
    } else {
        if (puntajeAprobacion > 0) {
            nota = 1.0 + score * 3.0 / puntajeAprobacion;
        }
    }
    nota = Math.max(1.0, Math.min(7.0, nota));
    return nota.toFixed(1);
};

const SpinnerIcon = () => (
    <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- Componente para Rendir Pruebas Estandarizadas ---

interface PruebaPlayerProps {
    prueba: PruebaEstandarizada;
    onComplete: (submission: Omit<RespuestaPruebaEstandarizada, 'id' | 'pruebaId' | 'estudianteId' | 'fechaCompletado'>) => void;
}

const PruebaPlayer: React.FC<PruebaPlayerProps> = ({ prueba, onComplete }) => {
    // Lógica y estado del reproductor de pruebas
    return <div>Reproductor de Prueba Estandarizada</div>;
};


// --- Componente para Rendir Actividades Remotas ---

interface ActivityPlayerProps {
    actividad: ActividadRemota;
    onComplete: (submission: Omit<RespuestaEstudianteActividad, 'id' | 'actividadId' | 'estudianteId' | 'fechaCompletado' | 'retroalimentacionDetallada'>, detailedFeedback?: DetailedFeedback) => void;
    currentUser: User;
}

const ActivityPlayer: React.FC<ActivityPlayerProps> = ({ actividad, onComplete, currentUser }) => {
    const [userAnswers, setUserAnswers] = useState<Partial<Record<TipoActividadRemota, any>>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const progressKey = `progress-${currentUser.id}-${actividad.id}`;

    useEffect(() => {
        const savedProgress = localStorage.getItem(progressKey);
        if (savedProgress) {
            setUserAnswers(JSON.parse(savedProgress));
        }
    }, [progressKey]);

    const handleAnswerChange = (tipo: TipoActividadRemota, answerData: any) => {
        setUserAnswers(prev => ({ ...prev, [tipo]: answerData }));
    };
    
    const handleSaveProgress = () => { /* ... Lógica para guardar ... */ };
    const handleSubmit = async () => { /* ... Lógica para enviar y evaluar ... */ };

    return (
        <div className="space-y-8">
            <div className="p-4 bg-sky-50 border-l-4 border-sky-400 rounded-r-lg">
                <h2 className="text-xl font-bold text-sky-800 mb-2">Instrucciones</h2>
                <p className="text-slate-700 whitespace-pre-wrap">{actividad.introduccion}</p>
            </div>

            {actividad.tipos.map(tipo => {
                const content = actividad.generatedContent[tipo];
                if (!content) return null;

                switch (tipo) {
                    case 'Quiz':
                    case 'Comprensión de Lectura': {
                        const isQuiz = tipo === 'Quiz';
                        const quizContent = content as any;
                        const questions = isQuiz ? (quizContent as QuizQuestion[]) : (quizContent as ComprensionLecturaContent).preguntas;
                        
                        return (
                            <div key={tipo} className="p-4 border rounded-lg bg-white">
                                <h3 className="text-xl font-bold mb-4">{tipo}</h3>
                                {!isQuiz && <div className="mb-4 p-3 rounded bg-slate-50 whitespace-pre-wrap">{(quizContent as ComprensionLecturaContent).texto}</div>}
                                <div className="space-y-6">
                                    {questions.map((q, qIndex) => (
                                        <div key={qIndex}>
                                            <p className="font-semibold">{`${qIndex + 1}. ${q.pregunta}`}</p>
                                            <div className="mt-2 space-y-2">
                                                {q.opciones.map((op, opIndex) => (
                                                    <label key={opIndex} className="flex items-center gap-3 p-3 rounded hover:bg-slate-100 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name={`q-${tipo}-${qIndex}`}
                                                            value={op}
                                                            checked={userAnswers[tipo]?.[qIndex] === op}
                                                            onChange={() => handleAnswerChange(tipo, { ...userAnswers[tipo], [qIndex]: op })}
                                                            className="h-5 w-5 text-amber-500 focus:ring-amber-400"
                                                        />
                                                        <span>{op}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    }
                    // Aquí irían los otros 'case' para Términos Pareados, Desarrollo, etc.
                    default:
                        return null;
                }
            })}

            <div className="text-right mt-8 flex justify-end gap-4">
                <button
                    onClick={handleSaveProgress}
                    disabled={isLoading || isSaving || saveSuccess}
                    className="bg-sky-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 flex items-center justify-center min-w-[180px]"
                >
                    {isSaving ? <><SpinnerIcon /> Guardando...</> : saveSuccess ? '✓ Guardado' : 'Guardar Progreso'}
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isLoading || isSaving}
                    className="bg-slate-800 text-white font-bold py-3 px-8 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 flex items-center justify-center min-w-[180px]"
                >
                    {isLoading ? <><SpinnerIcon /> Evaluando...</> : 'Entregar Actividad'}
                </button>
            </div>
        </div>
    );
};


// --- Componente Principal ---

interface AutoaprendizajeProps {
    currentUser: User;
}

const Autoaprendizaje: React.FC<AutoaprendizajeProps> = ({ currentUser }) => {
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'activity' | 'result'>('list');
    const [actividades, setActividades] = useState<ActividadRemota[]>([]);
    const [selectedActividad, setSelectedActividad] = useState<ActividadRemota | null>(null);
    const [lastResult, setLastResult] = useState<RespuestaEstudianteActividad | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsub = subscribeToActividadesDisponibles(currentUser, (data) => {
            setActividades(data);
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser]);

    const handleStartActivity = (actividad: ActividadRemota) => {
        setSelectedActividad(actividad);
        setView('activity');
    };

    const handleCompleteActivity = useCallback((submission: any, detailedFeedback?: DetailedFeedback) => {
        if (!selectedActividad) return;
        const newResult = {
            actividadId: selectedActividad.id,
            estudianteId: currentUser.id,
            fechaCompletado: new Date().toISOString(),
            ...submission,
            retroalimentacionDetallada: detailedFeedback,
        };
        // Aquí llamarías a saveRespuestaActividad(newResult)
        setLastResult(newResult);
        setView('result');
    }, [selectedActividad, currentUser.id]);

    if (loading) {
        return <div className="text-center p-10"><SpinnerIcon /> Cargando actividades...</div>;
    }

    if (view === 'activity' && selectedActividad) {
        return (
            <ActivityPlayer
                actividad={selectedActividad}
                onComplete={handleCompleteActivity}
                currentUser={currentUser}
            />
        );
    }

    if (view === 'result' && lastResult) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h1 className="text-3xl font-bold mb-4">Resultados de la Actividad</h1>
                {/* Aquí renderizarías los resultados detallados desde lastResult */}
                <p>Puntaje: {lastResult.puntaje} / {lastResult.puntajeMaximo}</p>
                <button 
                    onClick={() => setView('list')} 
                    className="mt-6 w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-700"
                >
                    Volver a la lista
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Auto-aprendizaje</h1>
            <p className="text-slate-500 mb-6">Completa las actividades asignadas por tus profesores.</p>
            <div className="space-y-4">
                {actividades.length > 0 ? (
                    actividades.map(act => (
                        <div key={act.id} className="p-4 border rounded-lg bg-slate-50 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-slate-800">{act.asignatura} - {act.tipos.join(', ')}</p>
                                <p className="text-sm text-slate-500">Plazo: {act.plazoEntrega}</p>
                            </div>
                            <button 
                                onClick={() => handleStartActivity(act)}
                                className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600"
                            >
                                Comenzar
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📚</div>
                        <p className="text-slate-500 text-lg">No hay actividades disponibles en este momento.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Autoaprendizaje;