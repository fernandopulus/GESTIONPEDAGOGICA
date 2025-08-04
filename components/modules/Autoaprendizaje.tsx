import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ActividadRemota, RespuestaEstudianteActividad, User, TipoActividadRemota, QuizQuestion, PareadoItem, ComprensionLecturaContent, DesarrolloContent, DetailedFeedback, PuntajesPorSeccion } from '../../types';
import { logApiCall } from '../utils/apiLogger';
import {
    subscribeToActividadesDisponibles,
    subscribeToRespuestasEstudiante,
    saveRespuestaActividad
} from '../../src/firebaseHelpers/autoaprendizajeHelper';

// ✅ CORRECCIÓN 1: Importar la librería de Google Generative AI
import { GoogleGenerativeAI } from '@google/generative-ai';


const shuffleArray = (array: any[]) => {
    return [...array].sort(() => Math.random() - 0.5);
};

const calculateGrade = (score: number, maxScore: number): string => {
    if (maxScore === 0) return '1.0';
    const exigencia = 0.6;
    const puntajeAprobacion = maxScore * exigencia;

    let nota;
    if (score >= puntajeAprobacion) {
        nota = 4.0 + (score - puntajeAprobacion) * 3.0 / (maxScore - puntajeAprobacion);
    } else {
        nota = 1.0 + score * 3.0 / (puntajeAprobacion || 1); // Avoid division by zero
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


// --- Activity Player Component ---
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
    const [shuffledData, setShuffledData] = useState<Record<string, any>>({});
    
    const progressKey = `progress-${currentUser.id}-${actividad.id}`;

    useEffect(() => {
        const newShuffledData: Record<string, any> = {};
        actividad.tipos.forEach(tipo => {
            if (tipo === 'Términos Pareados') {
                const content = actividad.generatedContent[tipo] as PareadoItem[];
                if (content) {
                    newShuffledData[tipo] = shuffleArray(content.map(p => p.definicion));
                }
            }
        });
        setShuffledData(newShuffledData);

        try {
            const savedProgress = localStorage.getItem(progressKey);
            if (savedProgress) {
                setUserAnswers(JSON.parse(savedProgress));
            }
        } catch (e) {
            console.error("Could not load saved progress", e);
        }

    }, [actividad, progressKey]);

    const handleAnswerChange = (tipo: TipoActividadRemota, answerData: any) => {
        setUserAnswers(prev => ({ ...prev, [tipo]: answerData }));
    };

    const handleSaveProgress = () => {
        setIsSaving(true);
        setSaveSuccess(false);

        setTimeout(() => {
            try {
                localStorage.setItem(progressKey, JSON.stringify(userAnswers));
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
            } catch (e) {
                console.error("Could not save progress", e);
                alert('Error al guardar el progreso.');
            } finally {
                setIsSaving(false);
            }
        }, 500);
    };


    const handleSubmit = async () => {
        setIsLoading(true);
        let totalPuntaje = 0;
        let totalPuntajeMaximo = 0;
        const feedbackResults: string[] = [];
        const puntajesPorSeccion: PuntajesPorSeccion = {};

        // ✅ CORRECCIÓN 2: Cargar la API Key desde el entorno
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        let ai: GoogleGenerativeAI | null = null;
        if(apiKey) {
            // ✅ CORRECCIÓN 3: Instanciar la IA directamente
            ai = new GoogleGenerativeAI(apiKey);
        } else {
            console.error("VITE_GEMINI_API_KEY no está configurada. La evaluación de desarrollo y la retroalimentación detallada no funcionarán.");
        }


        for (const tipo of actividad.tipos) {
            const content = actividad.generatedContent[tipo];
            const answers = userAnswers[tipo];

            if (tipo === 'Quiz' || tipo === 'Comprensión de Lectura') {
                const questions = (tipo === 'Quiz') ? content as QuizQuestion[] : (content as ComprensionLecturaContent).preguntas;
                const currentAnswers = answers as Record<number, string> || {};
                let puntajeParcial = 0;
                let puntajeMaxParcial = 0;
                questions.forEach((q, index) => {
                    puntajeMaxParcial += 1;
                    if (currentAnswers[index] === q.respuestaCorrecta) puntajeParcial += 1;
                });
                totalPuntaje += puntajeParcial;
                totalPuntajeMaximo += puntajeMaxParcial;
                feedbackResults.push(`${tipo}: ${puntajeParcial}/${puntajeMaxParcial} correctas.`);
                puntajesPorSeccion[tipo] = { puntaje: puntajeParcial, puntajeMaximo: puntajeMaxParcial };
            } else if (tipo === 'Términos Pareados') {
                const items = content as PareadoItem[];
                const currentAnswers = answers as Record<string, string> || {};
                let puntajeParcial = 0;
                let puntajeMaxParcial = 0;
                items.forEach(item => {
                    puntajeMaxParcial += 2;
                    if (currentAnswers[item.id] === item.definicion) puntajeParcial += 2;
                });
                totalPuntaje += puntajeParcial;
                totalPuntajeMaximo += puntajeMaxParcial;
                feedbackResults.push(`${tipo}: ${puntajeParcial / 2}/${items.length} correctas.`);
                puntajesPorSeccion[tipo] = { puntaje: puntajeParcial, puntajeMaximo: puntajeMaxParcial };
            } else if (tipo === 'Desarrollo') {
                const devContentArray = content as DesarrolloContent[];
                const devAnswer = answers as Record<number, string> || {};
                
                let puntajeParcial = 0;
                let puntajeMaxParcial = 0;

                for(let i = 0; i < devContentArray.length; i++) {
                    const devContent = devContentArray[i];
                    puntajeMaxParcial += 3;
                    if (!ai) { // Si la IA no se pudo inicializar
                        feedbackResults.push(`${tipo} #${i+1}: No se pudo evaluar automáticamente.`);
                        continue;
                    }

                    try {
                        logApiCall('Autoaprendizaje - Evaluar Desarrollo');
                        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
                        
                        // ✅ MEJORA 4: Prompt fortalecido pidiendo JSON explícitamente
                        const prompt = `Evalúa la siguiente respuesta de un estudiante a la pregunta de desarrollo, basándote en la rúbrica proporcionada.
                        Pregunta: "${devContent.pregunta}".
                        Rúbrica: "${devContent.rubrica}".
                        Respuesta del estudiante: "${devAnswer[i] || ''}".
                        
                        Tu respuesta DEBE ser un objeto JSON con dos claves:
                        1. "puntaje": un número entero de 0 a 3.
                        2. "feedback": una frase corta y constructiva para el estudiante.`;
                        
                        const result = await model.generateContent(prompt);
                        const response = await result.response;
                        const text = response.text();

                        const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
                        const resultJson = JSON.parse(cleanedText);
                        const score = Math.max(0, Math.min(3, parseInt(resultJson.puntaje, 10) || 0));
                        
                        puntajeParcial += score;
                        feedbackResults.push(`${tipo} #${i+1}: Puntaje ${score}/3. (${resultJson.feedback})`);
                    } catch(e) {
                        console.error("Error evaluating development question:", e);
                        feedbackResults.push(`${tipo} #${i+1}: No se pudo evaluar automáticamente.`);
                    }
                }
                 totalPuntaje += puntajeParcial;
                 totalPuntajeMaximo += puntajeMaxParcial;
                 puntajesPorSeccion[tipo] = { puntaje: puntajeParcial, puntajeMaximo: puntajeMaxParcial };
            }
        }
        
        let detailedFeedback: DetailedFeedback | undefined = undefined;
        if(ai) { // Solo intentar generar feedback si la IA está disponible
             const feedbackPrompt = `
                Un estudiante ha completado una actividad sobre "${actividad.contenido}".
                Su puntaje total fue ${totalPuntaje} de ${totalPuntajeMaximo}.
                Detalle por sección: ${JSON.stringify(puntajesPorSeccion)}
                Respuestas de desarrollo: ${JSON.stringify(userAnswers['Desarrollo'] || {})}
                
                Genera una retroalimentación detallada y constructiva en español. La respuesta DEBE ser un objeto JSON con la siguiente estructura:
                {
                  "resumenGeneral": "Un párrafo breve y motivador sobre el desempeño general.",
                  "areasDeFortaleza": ["Un array de 2 o 3 strings destacando lo que hizo bien."],
                  "areasDeMejora": ["Un array de 2 o 3 strings con áreas a mejorar."],
                  "planDeMejora": [{ "paso": "Repasar conceptos clave", "detalle": "Una sugerencia concreta."}],
                  "feedbackPorSeccion": { "Quiz": "Feedback específico para esta sección." }
                }
            `;
            try {
                logApiCall('Autoaprendizaje - Retroalimentación Detallada');
                const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
                const result = await model.generateContent(feedbackPrompt);
                const response = await result.response;
                const text = response.text();
                
                const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
                detailedFeedback = JSON.parse(cleanedText);
            } catch (e) {
                console.error("Error generating detailed feedback:", e);
                // No detenemos el flujo, el feedback detallado será opcional
            }
        }


        onComplete({
            respuestas: userAnswers,
            puntaje: totalPuntaje,
            puntajeMaximo: totalPuntajeMaximo,
            retroalimentacion: `¡Buen trabajo! Tu puntaje total es ${totalPuntaje} de ${totalPuntajeMaximo}.`,
            calificacion: calculateGrade(totalPuntaje, totalPuntajeMaximo),
            puntajesPorSeccion: puntajesPorSeccion
        }, detailedFeedback);

        localStorage.removeItem(progressKey);
        setIsLoading(false);
    };

    const hasRecursos = actividad.recursos && (actividad.recursos.instrucciones || actividad.recursos.enlaces || actividad.recursos.archivos?.length);

    // El resto del componente ActivityPlayer (la parte JSX) no necesita cambios...
    return (
        <div className="space-y-8">
            <div className="p-4 bg-sky-50 dark:bg-sky-900/30 border-l-4 border-sky-400 rounded-r-lg">
                <h2 className="text-xl font-bold text-sky-800 dark:text-sky-200 mb-2">¡Hola!</h2>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{actividad.introduccion}</p>
            </div>

            {hasRecursos && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border-l-4 border-indigo-400 rounded-r-lg">
                    <h2 className="text-xl font-bold text-indigo-800 dark:text-indigo-200 mb-3">Material de Estudio</h2>
                    <div className="space-y-4">
                        {actividad.recursos?.instrucciones && (
                            <div>
                                <h3 className="font-semibold text-slate-700 dark:text-slate-300">Instrucciones:</h3>
                                <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{actividad.recursos.instrucciones}</p>
                            </div>
                        )}
                        {actividad.recursos?.enlaces && (
                            <div>
                                <h3 className="font-semibold text-slate-700 dark:text-slate-300">Enlaces:</h3>
                                {actividad.recursos.enlaces.split('\n').map((link, i) => link.trim() && (
                                    <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block text-blue-500 hover:underline truncate">{link}</a>
                                ))}
                            </div>
                        )}
                        {actividad.recursos?.archivos && actividad.recursos.archivos.length > 0 && (
                             <div>
                                <h3 className="font-semibold text-slate-700 dark:text-slate-300">Archivos:</h3>
                                <ul className="list-disc list-inside">
                                {actividad.recursos.archivos.map((file, i) => (
                                    <li key={i}>
                                        <a href={file.url} download={file.nombre} className="text-blue-500 hover:underline">{file.nombre}</a>
                                    </li>
                                ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {actividad.tipos.map(tipo => {
                const content = actividad.generatedContent[tipo];
                if (!content) return null;

                switch (tipo) {
                    case 'Quiz':
                    case 'Comprensión de Lectura': {
                        const isQuiz = tipo === 'Quiz';
                        const quizContent = content;
                        const questions = isQuiz ? (quizContent as QuizQuestion[]) : (quizContent as ComprensionLecturaContent).preguntas;
                        return (
                            <div key={tipo} className="p-4 border rounded-lg bg-white dark:bg-slate-800">
                                <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">{tipo}</h3>
                                {!isQuiz && <div className="mb-4 whitespace-pre-wrap bg-slate-50 dark:bg-slate-700/50 p-3 rounded text-slate-700 dark:text-slate-300">{ (quizContent as ComprensionLecturaContent).texto}</div>}
                                <div className="space-y-6">
                                    {questions.map((q, qIndex) => (
                                        <div key={`${tipo}-${qIndex}`}>
                                            <p className="font-semibold text-slate-700 dark:text-slate-300">{qIndex + 1}. {q.pregunta}</p>
                                            <div className="mt-2 space-y-2">
                                                {q.opciones.map((op, opIndex) => (
                                                    <label key={opIndex} className="flex items-center gap-3 p-3 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-600 dark:text-slate-300">
                                                        <input
                                                            type="radio"
                                                            name={`q-${tipo}-${qIndex}-${actividad.id}`}
                                                            value={op}
                                                            checked={userAnswers[tipo]?.[qIndex] === op}
                                                            onChange={() => handleAnswerChange(tipo, { ...(userAnswers[tipo] || {}), [qIndex]: op })}
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
                    case 'Términos Pareados': {
                        const pareadosContent = content as PareadoItem[];
                        const shuffledDefinitions = shuffledData[tipo] || [];
                        return (
                            <div key={tipo} className="p-4 border rounded-lg bg-white dark:bg-slate-800">
                                <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">{tipo}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-center text-slate-600 dark:text-slate-400">Concepto</h4>
                                        {pareadosContent.map(item => (
                                            <div key={item.id} className="p-3 bg-slate-100 dark:bg-slate-700 rounded h-14 flex items-center justify-center text-center font-medium text-slate-700 dark:text-slate-300">{item.concepto}</div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-center text-slate-600 dark:text-slate-400">Definición</h4>
                                        {pareadosContent.map(item => (
                                            <div key={item.id} className="h-14 flex items-center">
                                                <select
                                                    value={userAnswers[tipo]?.[item.id] || ''}
                                                    onChange={e => handleAnswerChange(tipo, { ...(userAnswers[tipo] || {}), [item.id]: e.target.value })}
                                                    className="w-full h-full border-slate-300 rounded-md shadow-sm text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300"
                                                >
                                                    <option value="">Seleccionar definición...</option>
                                                    {shuffledDefinitions.map((def: string, i: number) => <option key={i} value={def}>{def}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    case 'Desarrollo': {
                        const desarrolloContent = content as DesarrolloContent[];
                        return (
                             <div key={tipo} className="p-4 border rounded-lg bg-white dark:bg-slate-800">
                                <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">{tipo}</h3>
                                {desarrolloContent.map((item, index) => (
                                     <div key={index} className="mb-6">
                                        <p className="font-semibold mb-2 text-slate-700 dark:text-slate-300">{item.pregunta}</p>
                                        <p className="text-sm italic text-slate-500 dark:text-slate-400 mb-4"><strong>Rúbrica:</strong> {item.rubrica}</p>
                                        <textarea
                                            value={userAnswers[tipo]?.[index] || ''}
                                            onChange={e => handleAnswerChange(tipo, { ...(userAnswers[tipo] || {}), [index]: e.target.value })}
                                            rows={8}
                                            className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300"
                                        />
                                    </div>
                                ))}
                            </div>
                        );
                    }
                    default:
                        return null;
                }
            })}
            <div className="text-right mt-8 flex justify-end gap-4">
                <button
                    onClick={handleSaveProgress}
                    disabled={isLoading || isSaving || saveSuccess}
                    className="bg-sky-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center min-w-[200px] transition-colors duration-200"
                >
                    {isSaving ? (
                        <><SpinnerIcon /> Guardando...</>
                    ) : saveSuccess ? (
                        '✓ Guardado'
                    ) : (
                        'Guardar Progreso'
                    )}
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isLoading || isSaving}
                    className="bg-slate-800 text-white font-bold py-3 px-8 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 flex items-center justify-center min-w-[200px]"
                >
                    {isLoading ? <><SpinnerIcon /> Evaluando...</> : 'Entregar Actividad'}
                </button>
            </div>
        </div>
    );
};

interface AutoaprendizajeProps {
    currentUser: User;
}

const Autoaprendizaje: React.FC<AutoaprendizajeProps> = ({ currentUser }) => {
    const [actividadesDisponibles, setActividadesDisponibles] = useState<ActividadRemota[]>([]);
    const [respuestas, setRespuestas] = useState<RespuestaEstudianteActividad[]>([]);
    const [selectedActividad, setSelectedActividad] = useState<ActividadRemota | null>(null);
    const [view, setView] = useState<'list' | 'activity' | 'result'>('list');
    const [lastResult, setLastResult] = useState<RespuestaEstudianteActividad | null>(null);
    const [confirmingActivity, setConfirmingActivity] = useState<ActividadRemota | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const unsubActividades = subscribeToActividadesDisponibles(currentUser, setActividadesDisponibles);
        const unsubRespuestas = subscribeToRespuestasEstudiante(currentUser.nombreCompleto, (data) => {
            setRespuestas(data);
            setLoading(false);
        });

        return () => {
            unsubActividades();
            unsubRespuestas();
        };
    }, [currentUser]);

    const handleStartActivity = (actividad: ActividadRemota) => {
        setConfirmingActivity(actividad);
    };

    const handleConfirmStart = () => {
        if (confirmingActivity) {
            setSelectedActividad(confirmingActivity);
            setView('activity');
            setConfirmingActivity(null);
        }
    };

    // Ajustamos la firma para recibir el feedback detallado por separado
    const handleCompleteActivity = useCallback(async (
        submission: Omit<RespuestaEstudianteActividad, 'id' | 'actividadId' | 'estudianteId' | 'fechaCompletado' | 'retroalimentacionDetallada'>,
        detailedFeedback?: DetailedFeedback
    ) => {
        if (!selectedActividad) return;
        
        const newRespuesta: Omit<RespuestaEstudianteActividad, 'id'> = {
            actividadId: selectedActividad.id,
            estudianteId: currentUser.nombreCompleto,
            fechaCompletado: new Date().toISOString(),
            ...submission,
            // Aquí asignamos el feedback, que puede ser undefined si la IA falló
            retroalimentacionDetallada: detailedFeedback, 
        };
        
        try {
            const newId = await saveRespuestaActividad(newRespuesta);
            setLastResult({ ...newRespuesta, id: newId });
            setView('result');
        } catch (error) {
            // Este error ya lo maneja el 'try-catch' interno del helper de Firebase, pero por si acaso.
            console.error("Error saving submission:", error);
            alert("No se pudo guardar tu respuesta. El error fue: " + (error as Error).message);
        }

    }, [selectedActividad, currentUser.nombreCompleto]);
    
    // El resto del componente Autoaprendizaje (la parte JSX) no necesita cambios...
    if (loading) {
        return <div className="text-center py-10">Cargando actividades...</div>;
    }

    if (view === 'activity' && selectedActividad) {
        return (
             <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
                 <h1 className="text-3xl font-bold text-slate-800">{selectedActividad.asignatura}: {selectedActividad.tipos.join(', ')}</h1>
                 <p className="text-slate-500 mb-6">Plazo: {selectedActividad.plazoEntrega}</p>
                 <ActivityPlayer actividad={selectedActividad} onComplete={handleCompleteActivity} currentUser={currentUser} />
            </div>
        )
    }

    if (view === 'result' && lastResult) {
        const feedback = lastResult.retroalimentacionDetallada;
        const puntajes: PuntajesPorSeccion = lastResult.puntajesPorSeccion || {};
        
        const getScoreColor = (score: number, maxScore: number) => {
            const ratio = maxScore > 0 ? score / maxScore : 0;
            if (ratio < 0.4) return 'bg-red-100 text-red-800';
            if (ratio < 0.7) return 'bg-yellow-100 text-yellow-800';
            return 'bg-green-100 text-green-800';
        };

        return (
            <div className="space-y-6">
                 <h1 className="text-3xl font-bold text-slate-800">Retroalimentación de la Actividad</h1>
                 {feedback ? (
                    <>
                        <div className="p-6 bg-white rounded-lg shadow-md border">
                             <h2 className="text-2xl font-bold mb-4">Retroalimentación General</h2>
                             <p className="text-slate-600 mb-6">{feedback.resumenGeneral}</p>
                             <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg mb-6">
                                <span className="text-lg font-bold">Puntaje Total:</span>
                                <span className={`px-4 py-2 text-xl font-bold rounded-full ${getScoreColor(lastResult.puntaje, lastResult.puntajeMaximo)}`}>
                                    {lastResult.puntaje} / {lastResult.puntajeMaximo}
                                </span>
                             </div>
                             <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-semibold text-green-600 mb-2">✓ Áreas de Fortaleza</h3>
                                    <ul className="list-disc list-inside space-y-1 text-slate-600">
                                        {feedback.areasDeFortaleza.map((item, i) => <li key={i}>{item}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-red-600 mb-2">✗ Áreas de Mejora</h3>
                                    <ul className="list-disc list-inside space-y-1 text-slate-600">
                                        {feedback.areasDeMejora.map((item, i) => <li key={i}>{item}</li>)}
                                    </ul>
                                </div>
                             </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                            {Object.entries(puntajes).map(([seccion, { puntaje, puntajeMaximo }]) => (
                                 <div key={seccion} className="p-6 bg-white rounded-lg shadow-md border">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-xl font-bold">{seccion}</h3>
                                        <span className={`px-3 py-1 text-sm font-bold rounded-full ${getScoreColor(puntaje, puntajeMaximo)}`}>{puntaje} / {puntajeMaximo}</span>
                                    </div>
                                    <p className="text-slate-500 text-sm">{feedback.feedbackPorSeccion?.[seccion]}</p>
                                 </div>
                            ))}
                        </div>

                        <div className="p-6 bg-white rounded-lg shadow-md border">
                             <h2 className="text-2xl font-bold mb-4">Plan de Mejora Sugerido</h2>
                             <div className="space-y-4">
                                {feedback.planDeMejora.map((item, i) => (
                                     <div key={i} className="flex items-start gap-4">
                                        <div className="bg-blue-500 text-white rounded-full h-8 w-8 flex-shrink-0 flex items-center justify-center font-bold mt-1">✓</div>
                                        <div>
                                            <h4 className="font-semibold">{item.paso}</h4>
                                            <p className="text-slate-600 text-sm">{item.detalle}</p>
                                        </div>
                                     </div>
                                ))}
                             </div>
                        </div>

                    </>
                 ) : (
                    <div className="bg-white p-6 md:p-8 rounded-xl shadow-md text-center">
                        <h2 className="text-3xl font-bold text-green-600 mb-4">¡Actividad Completada!</h2>
                        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto my-8">
                            <div className="p-4 bg-slate-100 rounded-lg"><p className="text-sm text-slate-500">Puntaje</p><p className="text-2xl font-bold">{lastResult.puntaje} / {lastResult.puntajeMaximo}</p></div>
                            <div className="p-4 bg-slate-100 rounded-lg"><p className="text-sm text-slate-500">Calificación</p><p className="text-2xl font-bold">{lastResult.calificacion}</p></div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg text-left"><h3 className="font-bold text-blue-800 mb-2">Retroalimentación</h3><p className="text-blue-700 whitespace-pre-wrap">{lastResult.retroalimentacion}</p></div>
                    </div>
                 )}
                 <button onClick={() => { setView('list'); setLastResult(null); }} className="w-full mt-4 bg-slate-800 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-700">Volver a Actividades</button>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            {confirmingActivity && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full animate-fade-in-up">
                        <h2 className="text-xl font-bold text-slate-800">Confirmar inicio de actividad</h2>
                        <p className="mt-4 text-slate-600">
                            ¿Estás seguro de que deseas comenzar esta actividad? <strong>Tendrás solo una oportunidad para responder.</strong>
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                            Sin embargo, puedes guardar tu progreso antes de enviarlo. Una vez enviado, no habrá una segunda oportunidad.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setConfirmingActivity(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300">
                                Cancelar
                            </button>
                            <button onClick={handleConfirmStart} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">
                                Sí, comenzar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Auto-aprendizaje</h1>
            <p className="text-slate-500 mb-6">Completa las actividades remotas asignadas por tus profesores.</p>
             <div className="space-y-4">
                {actividadesDisponibles.length > 0 ? actividadesDisponibles.map(act => {
                    const miRespuesta = respuestas.find(r => r.actividadId === act.id);
                    const isCompleted = !!miRespuesta;
                    return (
                         <div key={act.id} className={`p-4 border rounded-lg ${isCompleted ? 'bg-green-50' : 'bg-slate-50'}`}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-800">{act.asignatura} - {act.tipos.join(', ')}</p>
                                    <p className="text-sm text-slate-500">Plazo: {act.plazoEntrega}</p>
                                </div>
                                {isCompleted ? (
                                    <div className="text-right">
                                        <button onClick={() => {setLastResult(miRespuesta); setView('result');}} className="font-semibold text-blue-700 hover:underline">Ver Resultados</button>
                                        <p className="text-sm text-slate-600">Puntaje: {miRespuesta.puntaje}/{miRespuesta.puntajeMaximo}</p>
                                    </div>
                                ) : (
                                    <button onClick={() => handleStartActivity(act)} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">Comenzar</button>
                                )}
                            </div>
                        </div>
                    )
                }) : (
                    <p className="text-center text-slate-500 py-10">No hay actividades disponibles en este momento.</p>
                )}
            </div>
        </div>
    );
};

export default Autoaprendizaje;