import React, { useState, useEffect, useCallback, useRef, FC } from 'react';
import { Timeline, TimelineEvent, User } from '../../../types';
// ✅ IA: Importar la librería de Google Generative AI
import { GoogleGenerativeAI } from '@google/generative-ai';
import { toPng } from 'html-to-image';
import {
    subscribeToTimelines,
    createTimeline,
    saveTimeline,
    deleteTimeline
} from '../../../src/firebaseHelpers/recursosHelper';

const Spinner = () => (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);
const SparklesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>);

const TimelineEditor: FC<{
    timeline: Timeline;
    onSave: (updatedTimeline: Timeline) => void;
    onBack: () => void;
}> = ({ timeline, onSave, onBack }) => {
    const [editedTimeline, setEditedTimeline] = useState<Timeline>(timeline);
    // ✅ IA: Estado para saber qué hito se está generando
    const [aiLoadingEventId, setAiLoadingEventId] = useState<string | null>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    const handleEventChange = (eventId: string, field: 'date' | 'description' | 'icon', value: string) => {
        setEditedTimeline(prev => ({
            ...prev,
            events: prev.events.map(event =>
                event.id === eventId ? { ...event, [field]: value } : event
            ),
        }));
    };

    const handleAddEvent = () => {
        const newEvent: TimelineEvent = {
            id: crypto.randomUUID(),
            date: new Date().getFullYear().toString(),
            description: 'Nuevo hito',
            icon: '🗓️',
        };
        const updatedEvents = [...editedTimeline.events, newEvent].sort((a,b) => parseInt(a.date) - parseInt(b.date));
        setEditedTimeline(prev => ({ ...prev, events: updatedEvents }));
    };

    const handleDeleteEvent = (eventId: string) => {
        setEditedTimeline(prev => ({ ...prev, events: prev.events.filter(e => e.id !== eventId) }));
    };

    // ✅ IA: Nueva función para autocompletar un hito
    const handleAIGenerateEvent = async (event: TimelineEvent) => {
        if (!event.description.trim()) {
            alert("Escribe al menos una idea en la descripción para que la IA la complete.");
            return;
        }
        setAiLoadingEventId(event.id);
        
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            alert("La API Key de Gemini no está configurada.");
            setAiLoadingEventId(null);
            return;
        }

        const prompt = `
            Para una línea de tiempo sobre "${editedTimeline.tema}", toma la siguiente idea para un hito y mejórala.
            Idea del usuario: "${event.description}"

            Tu respuesta DEBE ser un único objeto JSON válido sin texto adicional, con tres claves:
            1. "date": El año o fecha más precisa y relevante para esta idea.
            2. "description": Una descripción concisa (máximo 15 palabras) para la línea de tiempo.
            3. "icon": Un único emoji que represente el hito.
        `;

        try {
            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
            const generated = JSON.parse(cleanedText);
            
            // Actualizar el hito con la nueva información
            setEditedTimeline(prev => ({
                ...prev,
                events: prev.events.map(e =>
                    e.id === event.id ? { ...e, date: generated.date, description: generated.description, icon: generated.icon } : e
                ).sort((a,b) => parseInt(a.date) - parseInt(b.date))
            }));

        } catch (error) {
            console.error("Error al generar descripción del hito:", error);
            alert("No se pudo autocompletar el hito.");
        } finally {
            setAiLoadingEventId(null);
        }
    };


    const handleDownloadPNG = () => {
        if (!timelineRef.current) return;
        toPng(timelineRef.current, { cacheBust: true, backgroundColor: '#f1f5f9', quality: 0.95, pixelRatio: 2 })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `linea-tiempo-${editedTimeline.tema.replace(/\s+/g, '_')}.png`;
                link.href = dataUrl;
                link.click();
            })
            .catch((err) => {
                console.error('Error al generar la imagen:', err);
                alert('No se pudo generar la imagen. Inténtelo de nuevo.');
            });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{editedTimeline.tema}</h2>
                <button onClick={onBack} className="text-sm font-semibold text-slate-500 hover:underline">&larr; Volver a la lista</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visualizer */}
                <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-900 rounded-lg">
                    <div ref={timelineRef} className="relative p-10">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-full bg-slate-300 dark:bg-slate-600 rounded"></div>
                        <div className="relative">
                            {editedTimeline.events.sort((a, b) => parseInt(a.date) - parseInt(b.date)).map((event, index) => {
                                const isLeft = index % 2 === 0;
                                return (
                                    <div key={event.id} className="mb-8 flex justify-between items-center w-full">
                                        <div className="w-1/2">
                                            {isLeft && (
                                                <div className="text-right pr-8">
                                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg border dark:border-slate-700 inline-block max-w-xs">
                                                        <p className="text-2xl mb-1 text-center w-full">{event.icon}</p>
                                                        <p className="font-bold text-slate-800 dark:text-slate-200">{event.date}</p>
                                                        <p className="text-sm text-slate-600 dark:text-slate-400 break-words">{event.description}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="z-10 flex-shrink-0">
                                            <div className="w-5 h-5 bg-white dark:bg-slate-500 border-4 border-slate-400 dark:border-slate-300 rounded-full"></div>
                                        </div>
                                        <div className="w-1/2">
                                            {!isLeft && (
                                                <div className="text-left pl-8">
                                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg border dark:border-slate-700 inline-block max-w-xs">
                                                        <p className="text-2xl mb-1 text-center w-full">{event.icon}</p>
                                                        <p className="font-bold text-slate-800 dark:text-slate-200">{event.date}</p>
                                                        <p className="text-sm text-slate-600 dark:text-slate-400 break-words">{event.description}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Editor Panel */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-700 h-[70vh] flex flex-col">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Editar Hitos</h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {editedTimeline.events.map(event => (
                            <div key={event.id} className="p-3 bg-white dark:bg-slate-700 rounded-md border dark:border-slate-600 space-y-2">
                                <input type="text" value={event.date} onChange={(e) => handleEventChange(event.id, 'date', e.target.value)} placeholder="Año/Fecha" className="w-full bg-transparent font-semibold dark:text-slate-200"/>
                                <div className="flex items-start gap-2">
                                    <textarea value={event.description} onChange={(e) => handleEventChange(event.id, 'description', e.target.value)} placeholder="Descripción" rows={2} className="flex-grow w-full bg-transparent text-sm dark:text-slate-300"/>
                                    {/* ✅ IA: Botón para autocompletar hito */}
                                    <button onClick={() => handleAIGenerateEvent(event)} disabled={aiLoadingEventId === event.id} className="p-2 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50" title="Autocompletar con IA">
                                        {aiLoadingEventId === event.id ? <div className="w-4 h-4 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin"></div> : <SparklesIcon />}
                                    </button>
                                </div>
                                <button onClick={() => handleDeleteEvent(event.id)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t dark:border-slate-700 flex flex-col gap-2">
                         <button onClick={handleAddEvent} className="w-full bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200">Añadir Hito</button>
                         <div className="flex gap-2">
                            <button onClick={handleDownloadPNG} className="flex-1 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">Descargar PNG</button>
                            <button onClick={() => onSave(editedTimeline)} className="flex-1 bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">Guardar</button>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LineasDeTiempo: FC<{ onBack: () => void; currentUser: User }> = ({ onBack, currentUser }) => {
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [timelines, setTimelines] = useState<Timeline[]>([]);
    const [currentTimeline, setCurrentTimeline] = useState<Timeline | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    
    const [tema, setTema] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');

    useEffect(() => {
        setDataLoading(true);
        const unsubscribe = subscribeToTimelines((data) => {
            setTimelines(data);
            setDataLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // ✅ IA: Función de generación completamente corregida y mejorada
    const handleGenerateTimeline = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tema.trim()) { alert("El tema es obligatorio."); return; }
        setIsLoading(true);

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            alert("La API Key de Gemini no está configurada.");
            setIsLoading(false);
            return;
        }

        const dateInfo = fechaInicio && fechaFin ? `entre ${fechaInicio} y ${fechaFin}` : (fechaInicio ? `a partir de ${fechaInicio}` : (fechaFin ? `hasta ${fechaFin}`: ''));
        const prompt = `
            Genera una línea de tiempo sobre el tema "${tema}" ${dateInfo}.
            Tu respuesta DEBE ser un único objeto JSON válido sin texto adicional ni bloques \`\`\`json.
            El objeto debe tener una clave "events", que es un array de 5 a 10 objetos.
            Cada objeto en el array "events" debe tener tres claves:
            1. "date": Un string con la fecha o el año del hito.
            2. "description": Un string con la descripción breve del hito (máximo 15 palabras).
            3. "icon": Un string con un único emoji que represente el hito.
            Ordena los eventos cronológicamente.
        `;
        
        try {
            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
            const resultJson = JSON.parse(cleanedText);

            if (!resultJson.events || !Array.isArray(resultJson.events)) {
                throw new Error("La respuesta de la IA no tiene el formato de eventos esperado.");
            }

            const newTimelineData: Omit<Timeline, 'id' | 'createdAt'> = {
                tema,
                fechaInicio,
                fechaFin,
                events: resultJson.events.map((e: any) => ({ 
                    id: crypto.randomUUID(),
                    date: e.date || 'Sin fecha',
                    description: e.description || 'Sin descripción',
                    icon: e.icon || '🗓️',
                }))
            };
            
            const newId = await createTimeline(newTimelineData, currentUser);
            setCurrentTimeline({ ...newTimelineData, id: newId, createdAt: new Date().toISOString() });
            setView('editor');
            
        } catch (error) {
            console.error("AI Generation Error:", error);
            alert("Hubo un error al generar la línea de tiempo. Por favor, revisa el formato del tema o inténtalo de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveTimeline = async (timelineToSave: Timeline) => {
        try {
            await saveTimeline(timelineToSave, currentUser);
            setView('list');
            setCurrentTimeline(null);
        } catch (error) {
            console.error("Error saving timeline:", error);
            alert("No se pudo guardar la línea de tiempo.");
        }
    };

    const handleDeleteTimeline = async (id: string) => {
        if (window.confirm("¿Eliminar esta línea de tiempo?")) {
            try {
                await deleteTimeline(id);
            } catch (error) {
                console.error("Error deleting timeline:", error);
                alert("No se pudo eliminar la línea de tiempo.");
            }
        }
    };

    if (view === 'editor' && currentTimeline) {
        return <TimelineEditor timeline={currentTimeline} onSave={handleSaveTimeline} onBack={() => setView('list')} />;
    }

    if (dataLoading) {
        return <div className="text-center py-10">Cargando líneas de tiempo...</div>;
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md space-y-6">
            <div className="flex items-center gap-4">
                <span className="text-4xl">🕒</span>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Líneas de Tiempo</h1>
                    <button onClick={onBack} className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:underline">&larr; Volver a Recursos</button>
                </div>
            </div>

            <div className="p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Crear nueva Línea de Tiempo</h2>
                <form onSubmit={handleGenerateTimeline} className="space-y-4">
                     <div>
                        <label htmlFor="tema" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tema <span className="text-red-500">*</span></label>
                        <input type="text" id="tema" value={tema} onChange={e => setTema(e.target.value)} required className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md shadow-sm"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="fechaInicio" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de Inicio (Opcional)</label>
                            <input type="text" id="fechaInicio" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} placeholder="Ej: 1947" className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md shadow-sm"/>
                        </div>
                        <div>
                            <label htmlFor="fechaFin" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de Término (Opcional)</label>
                            <input type="text" id="fechaFin" value={fechaFin} onChange={e => setFechaFin(e.target.value)} placeholder="Ej: 1991" className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md shadow-sm"/>
                        </div>
                    </div>
                    <div className="text-right">
                         <button type="submit" disabled={isLoading} className="bg-amber-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-600 disabled:bg-slate-400 flex items-center justify-center min-w-[180px]">
                            {isLoading ? <Spinner /> : 'Generar con IA'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Líneas de Tiempo Guardadas</h2>
                 {timelines.length > 0 ? timelines.map(tl => (
                    <div key={tl.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200">{tl.tema}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Creada: {new Date(tl.createdAt).toLocaleDateString('es-CL')}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setCurrentTimeline(tl); setView('editor'); }} className="text-sm font-semibold bg-slate-200 dark:bg-slate-600 py-1 px-3 rounded-md">Editar</button>
                            <button onClick={() => handleDeleteTimeline(tl.id)} className="text-sm font-semibold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 py-1 px-3 rounded-md">Eliminar</button>
                        </div>
                    </div>
                )) : <p className="text-center text-slate-500 dark:text-slate-400 py-6">No hay líneas de tiempo guardadas.</p>}
            </div>
        </div>
    );
};

export default LineasDeTiempo;
