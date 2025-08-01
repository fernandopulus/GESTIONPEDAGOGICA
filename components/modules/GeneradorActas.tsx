import React, { useState, useEffect, useCallback, FormEvent, ChangeEvent, useRef } from 'react';
import { Acta, TipoReunion } from '../../types';
import { TIPOS_REUNION } from '../../constants';
import { GoogleGenAI, Type } from "@google/genai";
import { logApiCall } from '../utils/apiLogger';

const ACTAS_KEY = 'actasDeReunion';
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

const MicIcon: React.FC<{isListening: boolean}> = ({ isListening }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {isListening 
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        }
    </svg>
);

const GeneradorActas: React.FC = () => {
    const [actas, setActas] = useState<Acta[]>([]);
    const [selectedActa, setSelectedActa] = useState<Acta | null>(null);
    const [formData, setFormData] = useState<Omit<Acta, 'id' | 'fechaCreacion' | 'temas' | 'acuerdos' | 'plazos' | 'responsables'>>({
        tipoReunion: TIPOS_REUNION[0],
        asistentes: '',
        textoReunion: ''
    });
    const [isListening, setIsListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any | null>(null);

    useEffect(() => {
        try {
            const data = localStorage.getItem(ACTAS_KEY);
            if (data) {
                const parsedActas: Acta[] = JSON.parse(data);
                setActas(parsedActas);
                if (parsedActas.length > 0 && !selectedActa) {
                    setSelectedActa(parsedActas[0]);
                }
            }
        } catch (e) {
            console.error("Error al leer actas de localStorage", e);
        }
    }, [selectedActa]);

    const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleToggleListening = useCallback(() => {
        if (!isSpeechSupported) {
            setError("El reconocimiento de voz no es compatible con este navegador.");
            return;
        }

        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.lang = 'es-CL';
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + '. ';
                    }
                }
                setFormData(prev => ({ ...prev, textoReunion: prev.textoReunion + finalTranscript }));
            };

            recognitionRef.current.onstart = () => setIsListening(true);
            recognitionRef.current.onend = () => setIsListening(false);
            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setError(`Error de reconocimiento: ${event.error}`);
                setIsListening(false);
            };
            
            recognitionRef.current.start();
        }
    }, [isListening]);


    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const { tipoReunion, asistentes, textoReunion } = formData;
        if (!tipoReunion || !asistentes.trim() || !textoReunion.trim()) {
            setError('Todos los campos son obligatorios.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            logApiCall('Generador de Actas');
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_AI_API_KEY });
            const prompt = `
                Analiza el siguiente texto de un acta de reunión y extrae la información clave.
                El texto es una transcripción de lo hablado.
                - Identifica los temas principales discutidos.
                - Extrae un resumen de los acuerdos o decisiones específicas tomadas.
                - Lista cualquier plazo o fecha límite mencionada.
                - Identifica los nombres de las personas a las que se les asignaron responsabilidades o tareas.
                
                Texto del acta:
                "${textoReunion}"
                
                Asistentes a la reunión para referencia de nombres: ${asistentes}
            `;

            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    temas: {
                        type: Type.ARRAY,
                        description: "Lista de los principales temas tratados en la reunión.",
                        items: { type: Type.STRING }
                    },
                    acuerdos: {
                        type: Type.ARRAY,
                        description: "Lista de los acuerdos o decisiones tomadas.",
                        items: { type: Type.STRING }
                    },
                    plazos: {
                        type: Type.ARRAY,
                        description: "Lista de fechas límite o plazos mencionados en el texto.",
                        items: { type: Type.STRING }
                    },
                    responsables: {
                        type: Type.ARRAY,
                        description: "Lista de las personas asignadas como responsables de tareas.",
                        items: { type: Type.STRING }
                    }
                },
                required: ["temas", "acuerdos", "plazos", "responsables"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });

            const structuredData = JSON.parse(response.text);

            const newActa: Acta = {
                id: crypto.randomUUID(),
                fechaCreacion: new Date().toISOString(),
                ...formData,
                ...structuredData,
            };

            const updatedActas = [newActa, ...actas];
            setActas(updatedActas);
            localStorage.setItem(ACTAS_KEY, JSON.stringify(updatedActas));
            
            setFormData({
                tipoReunion: TIPOS_REUNION[0],
                asistentes: '',
                textoReunion: ''
            });
            setSelectedActa(newActa);
        } catch (e) {
            console.error("Error al analizar acta con IA:", e);
            setError("Ocurrió un error al procesar el acta con la IA. Por favor, revise el texto e inténtelo de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar esta acta?')) {
            const updatedActas = actas.filter(a => a.id !== id);
            setActas(updatedActas);
            localStorage.setItem(ACTAS_KEY, JSON.stringify(updatedActas));
            if (selectedActa?.id === id) {
                setSelectedActa(updatedActas.length > 0 ? updatedActas[0] : null);
            }
        }
    };

    const handleSelectActa = (acta: Acta) => {
        setSelectedActa(acta);
    };

    const renderAnalysisSection = (acta: Acta) => {
        const hasAnalysis = acta.temas || acta.acuerdos || acta.plazos || acta.responsables;

        if (!hasAnalysis) return null;

        return (
            <div className="mt-8 pt-6 border-t dark:border-slate-600">
                <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">Análisis con IA</h2>
                
                {acta.temas && acta.temas.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-300">Temas Tratados</h3>
                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 mt-2 space-y-1">
                            {acta.temas.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    </div>
                )}

                {acta.acuerdos && acta.acuerdos.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-300">Acuerdos</h3>
                         <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 mt-2 space-y-1">
                            {acta.acuerdos.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    </div>
                )}
                
                {acta.plazos && acta.plazos.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-300">Plazos</h3>
                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 mt-2 space-y-1">
                            {acta.plazos.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    </div>
                )}

                {acta.responsables && acta.responsables.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-300">Responsables</h3>
                         <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 mt-2 space-y-1">
                            {acta.responsables.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        );
    }
    
    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";


    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
            {/* Columna de Formulario e Historial */}
            <div className="md:col-span-1 space-y-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Generador de Actas</h1>
                    <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 rounded-r-lg">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.008a1 1 0 011 1v3.008a1 1 0 01-1 1h-.008a1 1 0 01-1-1V5z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm">
                                    Recuerda que las actas debes subirlas por intranet en <strong className="font-semibold">www.industrialderecoleta.cl</strong>. Esta es sólo una herramienta para agilizar redacción.
                                </p>
                            </div>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="tipoReunion" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Tipo de Reunión</label>
                            <select name="tipoReunion" value={formData.tipoReunion} onChange={handleFieldChange} required className={inputStyles}>
                                {TIPOS_REUNION.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="asistentes" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asistentes</label>
                            <textarea name="asistentes" value={formData.asistentes} onChange={handleFieldChange} required rows={3} placeholder="Nombres, separados por comas..." className={inputStyles}></textarea>
                        </div>
                        <div>
                            <label htmlFor="textoReunion" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Texto de la Reunión</label>
                            <div className="relative">
                                <textarea name="textoReunion" value={formData.textoReunion} onChange={handleFieldChange} required rows={6} placeholder="Escriba o use el micrófono para dictar..." className={inputStyles}></textarea>
                                {isSpeechSupported && (
                                    <button type="button" onClick={handleToggleListening} title={isListening ? 'Detener grabación' : 'Iniciar grabación'} className={`absolute top-2 right-2 p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500'}`}>
                                        <MicIcon isListening={isListening} />
                                    </button>
                                )}
                            </div>
                        </div>
                        {error && <p className="text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-300 p-3 rounded-md mt-4">{error}</p>}
                        <div className="pt-2 text-right">
                             <button type="submit" disabled={isLoading} className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 flex items-center justify-center min-w-[120px] disabled:bg-slate-400 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">
                                {isLoading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    'Crear Acta'
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Historial de Actas</h2>
                    <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                        {actas.length > 0 ? actas.sort((a,b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()).map(acta => (
                            <button key={acta.id} onClick={() => handleSelectActa(acta)} className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedActa?.id === acta.id ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/20 dark:border-amber-500/50' : 'bg-slate-50 hover:bg-slate-100 border-transparent dark:bg-slate-700/50 dark:hover:bg-slate-700'}`}>
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{acta.tipoReunion}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(acta.fechaCreacion).toLocaleDateString('es-CL')}</p>
                            </button>
                        )) : <p className="text-slate-500 dark:text-slate-400 text-sm">No hay actas guardadas.</p>}
                    </div>
                </div>
            </div>

            {/* Columna de Visualización */}
            <div className="md:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md">
                {selectedActa ? (
                    <div className="prose dark:prose-invert max-w-none prose-slate">
                        <div className="flex justify-between items-start mb-4">
                             <h1 className="text-3xl font-bold mt-0">{`Acta de Reunión: ${selectedActa.tipoReunion}`}</h1>
                             <button onClick={() => handleDelete(selectedActa.id)} title="Eliminar Acta" className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 -mt-2 -mr-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                        </div>
                       
                        <p className="text-sm text-slate-500 dark:text-slate-400"><strong>Fecha:</strong> {new Date(selectedActa.fechaCreacion).toLocaleString('es-CL')}</p>
                        
                        <h2>Asistentes</h2>
                        <ul className="list-disc pl-5">
                            {String(selectedActa.asistentes || '').split(',').map((name, i) => name.trim() && <li key={i}>{name.trim()}</li>)}
                        </ul>

                        {renderAnalysisSection(selectedActa)}

                        <h2 className="mt-8 pt-6 border-t dark:border-slate-600">Transcripción Original</h2>
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-md whitespace-pre-wrap">
                           <p>{selectedActa.textoReunion}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <span className="text-6xl mb-4 text-slate-400">📄</span>
                        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">Seleccione un Acta</h2>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mt-2">
                            Elija un acta del historial para ver sus detalles aquí, o cree una nueva usando el formulario.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeneradorActas;