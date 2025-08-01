import React, { useState, useEffect, useMemo, useCallback, ChangeEvent } from 'react';
import { User, AnalisisTaxonomico, BloomLevel } from '../../types';
import { GoogleGenAI, Type } from "@google/genai";
import { logApiCall } from '../utils/apiLogger';
import {
    getAllAnalisis,
    createAnalisis,
    deleteAnalisis,
} from '../../src/firebaseHelpers/analisis'; // AJUSTA la ruta según dónde guardes los helpers

const BLOOM_LEVELS: BloomLevel[] = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar', 'Crear'];
const bloomColors: Record<BloomLevel, string> = {
    Recordar: 'bg-sky-500',
    Comprender: 'bg-blue-500',
    Aplicar: 'bg-green-500',
    Analizar: 'bg-yellow-500',
    Evaluar: 'bg-orange-500',
    Crear: 'bg-red-500',
};

const Spinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

interface AnalisisTaxonomicoProps {
    currentUser: User;
}

const AnalisisTaxonomico: React.FC<AnalisisTaxonomicoProps> = ({ currentUser }) => {
    const [history, setHistory] = useState<AnalisisTaxonomico[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedAnalysis, setSelectedAnalysis] = useState<AnalisisTaxonomico | null>(null);
    const [documentName, setDocumentName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileData, setFileData] = useState<{ mimeType: string; data: string } | null>(null);

    // Cargar análisis desde Firestore
    const fetchAnalisis = useCallback(async () => {
        setLoading(true);
        try {
            const analisisFS = await getAllAnalisis();
            setHistory(analisisFS);
            setError(null);
        } catch (e) {
            console.error("Error al cargar análisis desde Firestore", e);
            setError("No se pudieron cargar los análisis desde la nube.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalisis();
    }, [fetchAnalisis]);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!validTypes.includes(file.type)) {
                setError('Por favor, suba un archivo PDF o DOCX válido.');
                setSelectedFile(null);
                setFileData(null);
                setDocumentName('');
                return;
            }
            
            setSelectedFile(file);
            setDocumentName(file.name);
            setError(null);
    
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                if (!base64String) {
                    setError("No se pudo procesar el archivo. Puede que esté vacío o corrupto.");
                    setFileData(null);
                    return;
                }
                setFileData({
                    mimeType: file.type,
                    data: base64String,
                });
            };
            reader.onerror = () => {
                 setError("Error al leer el archivo.");
                 setFileData(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async () => {
        if (!documentName.trim() || !fileData) {
            setError("Debe subir un documento PDF o DOCX y asignarle un nombre para analizar.");
            return;
        }
        setIsLoading(true);
        setError(null);
        
        const prompt = `
            Eres un experto en pedagogía y en la Taxonomía de Bloom. Analiza el siguiente documento de una evaluación educativa.
            Tu tarea es:
            1. Identificar cada pregunta o ítem de evaluación en el documento.
            2. Clasificar cada pregunta en uno de los seis niveles de la Taxonomía de Bloom: Recordar, Comprender, Aplicar, Analizar, Evaluar, Crear.
            3. Devolver un objeto JSON estructurado con los resultados.
        `;
        
        const schema = {
            type: Type.OBJECT,
            properties: {
                analysisResults: {
                    type: Type.ARRAY,
                    description: "Un array con cada pregunta identificada y su clasificación de Bloom.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING, description: "El texto exacto de la pregunta." },
                            habilidadBloom: { type: Type.STRING, description: "El nivel de Bloom correspondiente.", enum: BLOOM_LEVELS }
                        },
                        required: ["question", "habilidadBloom"]
                    }
                },
                summary: {
                    type: Type.OBJECT,
                    description: "Un resumen con el conteo de preguntas por cada nivel de Bloom.",
                    properties: {
                        Recordar: { type: Type.INTEGER }, Comprender: { type: Type.INTEGER }, Aplicar: { type: Type.INTEGER },
                        Analizar: { type: Type.INTEGER }, Evaluar: { type: Type.INTEGER }, Crear: { type: Type.INTEGER }
                    },
                }
            },
            required: ["analysisResults", "summary"]
        };

        try {
            logApiCall('Análisis Taxonómico');
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_AI_API_KEY });

            const filePart = {
                inlineData: {
                    mimeType: fileData.mimeType,
                    data: fileData.data,
                },
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: prompt }, filePart] },
                config: { responseMimeType: "application/json", responseSchema: schema },
            });

            const result = JSON.parse(response.text);
            const newAnalysis: Omit<AnalisisTaxonomico, 'id'> = {
                documentName,
                uploadDate: new Date().toISOString(),
                userId: currentUser.id,
                analysisResults: result.analysisResults,
                summary: result.summary,
            };
            
            // Guardar en Firestore
            const savedAnalysis = await createAnalisis(newAnalysis);
            
            // Recargar historial
            await fetchAnalisis();
            
            // Seleccionar el análisis recién creado
            setSelectedAnalysis(savedAnalysis);
            
            // Limpiar formulario
            setDocumentName('');
            setSelectedFile(null);
            setFileData(null);

        } catch (err) {
            console.error(err);
            setError("Hubo un error al analizar el documento. Asegúrese de que el archivo no esté protegido o vacío. Inténtelo de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Está seguro de eliminar este análisis?")) {
            try {
                await deleteAnalisis(id);
                await fetchAnalisis(); // Recargar después de eliminar
                
                if (selectedAnalysis?.id === id) {
                    setSelectedAnalysis(null);
                }
            } catch (err) {
                console.error("Error al eliminar análisis:", err);
                setError("No se pudo eliminar el análisis en la nube.");
            }
        }
    };

    const totalQuestions = useMemo(() => {
        if (!selectedAnalysis) return 0;
        return Object.values(selectedAnalysis.summary).reduce((sum, count) => sum + (count || 0), 0);
    }, [selectedAnalysis]);

    return (
        <div className="space-y-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Análisis Taxonómico de Evaluaciones</h1>

            {loading && <div className="text-center text-amber-600 py-4">Cargando análisis desde la nube...</div>}
            {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Analizar Nuevo Documento</h2>
                        <div className="space-y-4">
                             <div>
                                <label htmlFor="file-upload" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Subir Archivo (.pdf, .docx)</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                         <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <div className="flex text-sm text-slate-600 dark:text-slate-400">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-amber-600 hover:text-amber-500 focus-within:outline-none">
                                                <span>Cargue un archivo</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
                                            </label>
                                            <p className="pl-1">o arrástrelo aquí</p>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-500">{selectedFile ? selectedFile.name : "PDF, DOCX hasta 10MB"}</p>
                                    </div>
                                </div>
                            </div>
                             <div>
                                <label htmlFor="documentName" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre del Documento/Prueba</label>
                                <input type="text" id="documentName" value={documentName} onChange={(e) => setDocumentName(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                            </div>
                            
                            <button onClick={handleAnalyze} disabled={isLoading || !fileData} className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 flex items-center justify-center">
                                {isLoading ? <Spinner /> : 'Analizar con IA'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                         <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Historial de Análisis</h2>
                         
                         {!loading && history.length === 0 && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-lg text-sm">
                                No hay análisis guardados en la nube.
                            </div>
                         )}

                         <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {!loading && history.length > 0 && history.map(item => (
                                <button key={item.id} onClick={() => setSelectedAnalysis(item)} className={`w-full text-left p-3 rounded-md border ${selectedAnalysis?.id === item.id ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700' : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700'}`}>
                                    <p className="font-semibold truncate">{item.documentName}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(item.uploadDate).toLocaleString('es-CL')}</p>
                                </button>
                            ))}
                         </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    {selectedAnalysis ? (
                        <div className="space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{selectedAnalysis.documentName}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Analizado el {new Date(selectedAnalysis.uploadDate).toLocaleString('es-CL')}</p>
                                </div>
                                <button onClick={() => handleDelete(selectedAnalysis.id)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Eliminar</button>
                            </div>
                            
                            <div>
                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-3">Consolidado Taxonómico ({totalQuestions} preguntas)</h3>
                                <div className="space-y-3">
                                    {BLOOM_LEVELS.map(level => {
                                        const count = selectedAnalysis.summary[level] || 0;
                                        const percentage = totalQuestions > 0 ? (count / totalQuestions) * 100 : 0;
                                        return (
                                            <div key={level}>
                                                <div className="flex justify-between items-center text-sm mb-1">
                                                    <span className="font-medium text-slate-600 dark:text-slate-300">{level}</span>
                                                    <span className="font-semibold text-slate-500 dark:text-slate-400">{count} ({percentage.toFixed(0)}%)</span>
                                                </div>
                                                <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-4">
                                                    <div className={`${bloomColors[level]} h-4 rounded-full`} style={{ width: `${percentage}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-3">Detalle del Análisis</h3>
                                <div className="overflow-x-auto max-h-96 border rounded-lg dark:border-slate-700">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                        <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase w-3/4">Pregunta / Ítem</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Habilidad (Bloom)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                            {selectedAnalysis.analysisResults.map((res, i) => (
                                                <tr key={i}>
                                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{res.question}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${bloomColors[res.habilidadBloom]}`}>{res.habilidadBloom}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <span className="text-6xl mb-4 text-slate-400">📊</span>
                            <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">Resultados del Análisis</h2>
                            <p className="text-slate-500 dark:text-slate-400 max-w-sm mt-2">
                                Realice un nuevo análisis o seleccione uno del historial para ver los resultados aquí.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalisisTaxonomico;