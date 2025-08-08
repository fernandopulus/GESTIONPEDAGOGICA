import React, { useState, useEffect, useCallback } from 'react';
import {
    ActividadRemota,
    RespuestaEstudianteActividad,
    User,
    TipoActividadRemota,
    QuizQuestion,
    ComprensionLecturaContent,
    DetailedFeedback,
} from '../../types'; // Ajusta la ruta a tu archivo de types
import {
    subscribeToActividadesDisponibles,
    saveRespuestaActividad,
} from '../../src/firebaseHelpers/autoaprendizajeHelper'; // Ajusta la ruta a tus helpers de Firebase

// --- Funciones de Utilidad y Componentes Genéricos ---

const calculateGrade = (score: number, maxScore: number): string => {
    if (maxScore === 0) return '1.0';
    const exigencia = 0.6;
    const puntajeAprobacion = maxScore * exigencia;
    let nota = 1.0;
    if (score >= puntajeAprobacion) {
        nota = 4.0 + (score - puntajeAprobacion) * 3.0 / (maxScore - puntajeAprobacion);
    } else {
        nota = 1.0 + score * 3.0 / puntajeAprobacion;
    }
    nota = Math.max(1.0, Math.min(7.0, nota));
    return nota.toFixed(1);
};

const SpinnerIcon = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- Componente para Rendir Actividades Remotas ---

interface ActivityPlayerProps {
    actividad: ActividadRemota;
    onComplete: (submission: Omit<RespuestaEstudianteActividad, 'id' | 'actividadId' | 'estudianteId' | 'fechaCompletado'>, detailedFeedback: DetailedFeedback) => void;
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
        setUserAnswers(prev => {
            const newAnswers = { ...prev, [tipo]: answerData };
            // Guarda el progreso automáticamente al cambiar una respuesta
            localStorage.setItem(progressKey, JSON.stringify(newAnswers));
            return newAnswers;
        });
    };
    
    // ✅ FUNCIÓN CORREGIDA: Lógica para guardar progreso
    const handleSaveProgress = () => {
        setIsSaving(true);
        localStorage.setItem(progressKey, JSON.stringify(userAnswers));
        setTimeout(() => {
            setIsSaving(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }, 1000);
    };

    // ✅ FUNCIÓN CORREGIDA: Lógica para evaluar y enviar
    const handleSubmit = async () => {
        setIsLoading(true);

        let puntajeTotal = 0;
        let puntajeMaximoTotal = 0;
        const retroalimentacionDetallada: DetailedFeedback = { items: [] };

        actividad.tipos.forEach(tipo => {
            const content = actividad.generatedContent[tipo];
            const answers = userAnswers[tipo];

            if (tipo === 'Quiz' || tipo === 'Comprensión de Lectura') {
                const questions: QuizQuestion[] = tipo === 'Quiz'
                    ? (content as QuizQuestion[])
                    : (content as ComprensionLecturaContent).preguntas;

                questions.forEach((q, qIndex) => {
                    const userAnswer = answers?.[qIndex];
                    const isCorrect = userAnswer === q.respuestaCorrecta;
                    const puntajePregunta = isCorrect ? (q.puntaje || 1) : 0;

                    puntajeTotal += puntajePregunta;
                    puntajeMaximoTotal += (q.puntaje || 1);

                    retroalimentacionDetallada.items.push({
                        pregunta: q.pregunta,
                        respuestaUsuario: userAnswer || 'No respondida',
                        respuestaCorrecta: q.respuestaCorrecta,
                        esCorrecta: isCorrect,
                        puntajeObtenido: puntajePregunta,
                        tipo: tipo,
                    });
                });
            }
            // Aquí puedes agregar la lógica para otros tipos de actividad como 'Términos Pareados'
        });

        const submissionData = {
            puntaje: puntajeTotal,
            puntajeMaximo: puntajeMaximoTotal,
            respuestas: userAnswers,
            nota: calculateGrade(puntajeTotal, puntajeMaximoTotal),
        };

        localStorage.removeItem(progressKey);
        onComplete(submissionData, retroalimentacionDetallada);
        // setIsLoading(false) se maneja en el componente padre después de guardar
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="p-4 bg-sky-50 border-l-4 border-sky-400 rounded-r-lg">
                <h2 className="text-2xl font-bold text-sky-800 mb-2">{actividad.asignatura}</h2>
                <p className="text-slate-700 whitespace-pre-wrap">{actividad.introduccion}</p>
            </div>

            {actividad.tipos.map(tipo => {
                const content = actividad.generatedContent[tipo];
                if (!content) return null;

                switch (tipo) {
                    case 'Quiz':
                    case 'Comprensión de Lectura': {
                        const isQuiz = tipo === 'Quiz';
                        const questions: QuizQuestion[] = isQuiz
                            ? (content as QuizQuestion[])
                            : (content as ComprensionLecturaContent).preguntas;
                        
                        return (
                            <div key={tipo} className="p-6 border rounded-lg bg-white shadow-sm">
                                <h3 className="text-xl font-bold mb-4 text-slate-700">{tipo}</h3>
                                {!isQuiz && (
                                    <div className="mb-6 p-4 rounded bg-slate-50 border whitespace-pre-wrap text-slate-800 leading-relaxed">
                                        {(content as ComprensionLecturaContent).texto}
                                    </div>
                                )}
                                <div className="space-y-6">
                                    {questions.map((q, qIndex) => (
                                        <div key={qIndex} className="border-t pt-4 first:border-t-0 first:pt-0">
                                            <p className="font-semibold text-slate-800">{`${qIndex + 1}. ${q.pregunta}`}</p>
                                            <div className="mt-2 space-y-2">
                                                {q.opciones.map((op, opIndex) => (
                                                    <label key={opIndex} className="flex items-center gap-3 p-3 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors has-[:checked]:bg-amber-100 has-[:checked]:font-semibold">
                                                        <input
                                                            type="radio"
                                                            name={`q-${tipo}-${qIndex}`}
                                                            value={op}
                                                            checked={userAnswers[tipo]?.[qIndex] === op}
                                                            onChange={() => handleAnswerChange(tipo, { ...(userAnswers[tipo] || {}), [qIndex]: op })}
                                                            className="h-5 w-5 text-amber-500 focus:ring-amber-400 border-slate-300"
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
                    // Agrega aquí los 'case' para otros tipos de actividad si los implementas
                    default:
                        return null;
                }
            })}

            <div className="text-right mt-8 flex justify-end gap-4">
                <button
                    onClick={handleSaveProgress}
                    disabled={isLoading || isSaving || saveSuccess}
                    className="bg-sky-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 flex items-center justify-center min-w-[180px] transition-all"
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
    const [error, setError] = useState<string | null>(null);

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

    // ✅ FUNCIÓN CORREGIDA: Guarda en la base de datos y luego muestra los resultados
    const handleCompleteActivity = useCallback(async (submission: any, detailedFeedback: DetailedFeedback) => {
        if (!selectedActividad) return;
        
        const newResult: Omit<RespuestaEstudianteActividad, 'id'> = {
            actividadId: selectedActividad.id,
            estudianteId: currentUser.id,
            fechaCompletado: new Date().toISOString(),
            ...submission,
            retroalimentacionDetallada: detailedFeedback,
        };

        try {
            await saveRespuestaActividad(newResult as Omit<RespuestaEstudianteActividad, 'id'>);
            setLastResult({ id: '', ...newResult }); // Guardamos el resultado en el estado para mostrarlo
            setView('result');
        } catch (err) {
            console.error("Error al guardar la respuesta:", err);
            setError("Hubo un problema al guardar tu actividad. Por favor, inténtalo de nuevo.");
            // Opcional: podrías querer volver a la vista de actividad o lista
        }
    }, [selectedActividad, currentUser.id]);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><SpinnerIcon /> <span className="ml-2">Cargando actividades...</span></div>;
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
    
    // ✅ VISTA DE RESULTADOS CORREGIDA: Muestra la retroalimentación detallada
    if (view === 'result' && lastResult) {
        const nota = lastResult.nota;
        return (
            <div className="p-6 bg-white rounded-lg shadow-lg animate-fade-in">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Resultados de la Actividad</h1>
                <div className="flex items-baseline gap-4 mb-6 p-4 bg-slate-50 rounded-lg border">
                    <p className="text-lg text-slate-600">
                        Puntaje: <span className="font-bold text-2xl text-slate-800">{lastResult.puntaje} / {lastResult.puntajeMaximo}</span>
                    </p>
                    <p className="text-lg text-slate-600">
                        Nota: <span className={`font-bold text-2xl ${parseFloat(nota) >= 4.0 ? 'text-green-600' : 'text-red-600'}`}>{nota}</span>
                    </p>
                </div>
    
                {lastResult.retroalimentacionDetallada && lastResult.retroalimentacionDetallada.items.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-slate-700 mt-6 mb-4">Revisión de Respuestas</h2>
                        {lastResult.retroalimentacionDetallada.items.map((item, index) => (
                            <div key={index} className={`p-4 border-l-4 rounded-r-lg ${item.esCorrecta ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                                <div className="flex justify-between items-start">
                                    <p className="font-semibold text-slate-800 flex-1 pr-4">{index + 1}. {item.pregunta}</p>
                                    <span className="font-bold text-lg">{item.esCorrecta ? '✅' : '❌'}</span>
                                </div>
                                <div className="mt-2 text-sm pl-4">
                                    <p className="text-slate-700">Tu respuesta: <span className="font-medium">{item.respuestaUsuario}</span></p>
                                    {!item.esCorrecta && (
                                         <p className="text-slate-700">Respuesta correcta: <span className="font-medium text-green-700">{item.respuestaCorrecta}</span></p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
    
                <button
                    onClick={() => {
                        setView('list');
                        setSelectedActividad(null);
                        setLastResult(null);
                    }}
                    className="mt-8 w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    Volver a la Lista de Actividades
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Auto-aprendizaje</h1>
            <p className="text-slate-500 mb-6">Completa las actividades asignadas por tus profesores.</p>
            {error && <p className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</p>}
            <div className="space-y-4">
                {actividades.length > 0 ? (
                    actividades.map(act => (
                        <div key={act.id} className="p-4 border rounded-lg bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-100 transition-colors">
                            <div>
                                <p className="font-bold text-slate-800">{act.asignatura} - {act.tipos.join(', ')}</p>
                                <p className="text-sm text-slate-500">Plazo: {act.plazoEntrega}</p>
                            </div>
                            <button 
                                onClick={() => handleStartActivity(act)}
                                className="bg-amber-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-600 w-full sm:w-auto"
                            >
                                Comenzar
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <div className="text-6xl mb-4">📚</div>
                        <h3 className="text-xl font-semibold text-slate-700">¡Todo al día!</h3>
                        <p className="text-slate-500 mt-1">No hay actividades nuevas disponibles en este momento.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Autoaprendizaje;