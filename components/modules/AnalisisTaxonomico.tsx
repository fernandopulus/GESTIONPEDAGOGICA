
import React, { useState, useEffect, useMemo, useCallback, ChangeEvent } from 'react';
import { User, AnalisisTaxonomico as AnalisisTaxonomicoType, BloomLevel } from '../../types';

import { auth } from '../../src/firebase';
import { logApiCall } from '../utils/apiLogger';
import { ASIGNATURAS } from '../../constants';
import {
    getAllAnalisis,
    getUserAnalisis,
    createAnalisis,
    deleteAnalisis,
} from '../../src/firebaseHelpers/analisis';

const NIVELES_MEDIO = ["1º Medio","2º Medio","3º Medio","4º Medio"] as const;

/** === Constantes === */
const BLOOM_LEVELS: BloomLevel[] = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar', 'Crear'];
const bloomColors: Record<BloomLevel, string> = {
    Recordar: 'bg-sky-500',
    Comprender: 'bg-blue-500',
    Aplicar: 'bg-green-500',
    Analizar: 'bg-yellow-500',
    Evaluar: 'bg-orange-500',
    Crear: 'bg-red-500',
};

/** Extensión local del tipo para añadir metadatos opcionales */
type AnalisisTaxonomicoExt = AnalisisTaxonomicoType & {
    nivel?: string | null;
    asignatura?: string | null;
};

const Spinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

interface AnalisisTaxonomicoProps {
    currentUser: User;
}

type ChartsTab = 'resumen' | 'comparacion';

const AnalisisTaxonomico: React.FC<AnalisisTaxonomicoProps> = ({ currentUser }) => {
    const [history, setHistory] = useState<AnalisisTaxonomicoExt[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Selección de análisis individual
    const [selectedAnalysis, setSelectedAnalysis] = useState<AnalisisTaxonomicoExt | null>(null);

    // Formulario de carga
    const [documentName, setDocumentName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileData, setFileData] = useState<{ mimeType: string; data: string } | null>(null);
    const [nivelForm, setNivelForm] = useState<string>('');       // Nuevo
    const [asignaturaForm, setAsignaturaForm] = useState<string>(''); // Nuevo

    // Filtros del resumen global
    const [filterNivel, setFilterNivel] = useState<string>('');
    const [filterAsignatura, setFilterAsignatura] = useState<string>('');

    // Tab de gráficos
    const [chartsTab, setChartsTab] = useState<ChartsTab>('resumen');

    const fetchAnalisis = useCallback(async () => {
        if (!currentUser?.id) return;
        setLoading(true);
        try {
            const analisisFS = currentUser.profile === 'SUBDIRECCION'
                ? await getAllAnalisis()
                : await getUserAnalisis(currentUser.id);

            setHistory(analisisFS as AnalisisTaxonomicoExt[]);
            setError(null);
        } catch (e) {
            console.error("Error al cargar análisis:", e);
            setError("No se pudieron cargar los análisis.");
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchAnalisis();
    }, [fetchAnalisis]);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!validTypes.includes(file.type)) {
                setError('Por favor, suba un archivo PDF o DOCX válido.');
                return;
            }

            setSelectedFile(file);
            setDocumentName(file.name);
            setError(null);

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string)?.split(',')[1];
                if (!base64String) {
                    setError("No se pudo procesar el archivo. Puede que esté vacío o corrupto.");
                    setFileData(null);
                    return;
                }
                setFileData({ mimeType: file.type, data: base64String });
            };
            reader.onerror = () => setError("Error al leer el archivo.");
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async () => {
        if (!documentName.trim() || !fileData) {
            setError("Debe subir un documento y asignarle un nombre para analizar.");
            return;
        }
        if (!nivelForm || !asignaturaForm) {
            setError("Seleccione Nivel y Asignatura antes de analizar.");
            return;
        }
        setIsLoading(true);
        setError(null);

        const prompt = `
            Eres un experto en pedagogía y en la Taxonomía de Bloom. Analiza el siguiente documento de una evaluación educativa.
            Tu tarea es:
            1. Identificar cada pregunta o ítem de evaluación en el documento.
            2. Clasificar cada pregunta en uno de los seis niveles de la Taxonomía de Bloom: Recordar, Comprender, Aplicar, Analizar, Evaluar, Crear.
            3. Devolver un objeto JSON estructurado con los resultados. El JSON debe ser válido y tener la siguiente estructura:
               {
                 "analysisResults": [
                   { "question": "...", "habilidadBloom": "..." }
                 ],
                 "summary": {
                   "Recordar": 0,
                   "Comprender": 0,
                   "Aplicar": 0,
                   "Analizar": 0,
                   "Evaluar": 0,
                   "Crear": 0
                 }
               }
            Donde "summary" contiene el conteo total de preguntas por cada nivel de Bloom.
        `;

        const schema = {
            type: "object",
            properties: {
                analysisResults: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            question: { type: "string" },
                            habilidadBloom: { type: "string", enum: BLOOM_LEVELS }
                        },
                        required: ["question", "habilidadBloom"]
                    }
                },
                summary: {
                    type: "object",
                    properties: BLOOM_LEVELS.reduce((acc, level) => ({ ...acc, [level]: { type: "number" } }), {})
                }
            },
            required: ["analysisResults", "summary"]
        };

        try {
            logApiCall('Análisis Taxonómico', currentUser);

            const user = auth.currentUser;
            if (!user) throw new Error("Usuario no autenticado.");
            const token = await user.getIdToken();

            // Lógica Gemini movida al backend. Llama a un endpoint seguro:
            const response = await fetch('/api/analisisTaxonomico', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ prompt, fileData, documentName, nivelForm, asignaturaForm, userId: currentUser.id })
            });
            if (!response.ok) {
                const errorBody = await response.text();
                console.error("Error response from backend:", errorBody);
                throw new Error(`Error al analizar el documento con IA: ${response.statusText}`);
            }
            const parsedResult = await response.json();

            const newAnalysis: Omit<AnalisisTaxonomicoExt, 'id'> = {
                documentName,
                uploadDate: new Date().toISOString(),
                userId: currentUser.id,
                analysisResults: parsedResult.analysisResults,
                summary: parsedResult.summary,
                nivel: nivelForm,
                asignatura: asignaturaForm,
            };

            const saved = await createAnalisis(newAnalysis as any);
            await fetchAnalisis();
            setSelectedAnalysis(saved as AnalisisTaxonomicoExt);
            setDocumentName('');
            setSelectedFile(null);
            setFileData(null);
            setNivelForm('');
            setAsignaturaForm('');

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : "Hubo un error al analizar el documento.";
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Está seguro de eliminar este análisis?")) {
            try {
                await deleteAnalisis(id);
                await fetchAnalisis();
                if (selectedAnalysis?.id === id) setSelectedAnalysis(null);
            } catch (err) {
                setError("No se pudo eliminar el análisis.");
            }
        }
    };

    /** === Derivados === */
    const filteredHistory = useMemo(() => {
        return history.filter(item => {
            const matchNivel = filterNivel ? (item.nivel === filterNivel) : true;
            const matchAsignatura = filterAsignatura ? (item.asignatura === filterAsignatura) : true;
            return matchNivel && matchAsignatura;
        });
    }, [history, filterNivel, filterAsignatura]);

    const globalSummary = useMemo(() => {
        const acc: Record<BloomLevel, number> = { Recordar:0, Comprender:0, Aplicar:0, Analizar:0, Evaluar:0, Crear:0 };
        filteredHistory.forEach(item => {
            BLOOM_LEVELS.forEach(level => {
                const val = (item.summary?.[level] as number) || 0;
                acc[level] += val;
            });
        });
        const total = Object.values(acc).reduce((s, n) => s + n, 0);
        return { acc, total };
    }, [filteredHistory]);

    // Agrupación por asignatura para vista de comparación
    const comparisonBySubject = useMemo(() => {
        const map = new Map<string, Record<BloomLevel, number>>();
        filteredHistory.forEach(item => {
            const subj = item.asignatura || 'Sin asignatura';
            if (!map.has(subj)) {
                map.set(subj, { Recordar:0, Comprender:0, Aplicar:0, Analizar:0, Evaluar:0, Crear:0 });
            }
            const bucket = map.get(subj)!;
            BLOOM_LEVELS.forEach(level => {
                bucket[level] += (item.summary?.[level] as number) || 0;
            });
        });
        // Transform to array and compute totals for sort descending
        const rows = Array.from(map.entries()).map(([asignatura, counts]) => ({
            asignatura,
            counts,
            total: Object.values(counts).reduce((s, n) => s + (n as number), 0)
        }));
        rows.sort((a, b) => b.total - a.total);
        return rows;
    }, [filteredHistory]);

    const totalQuestions = useMemo(() => {
        if (!selectedAnalysis) return 0;
        return Object.values(selectedAnalysis.summary).reduce((sum, count) => sum + (count || 0), 0);
    }, [selectedAnalysis]);

    return (
        <div className="space-y-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Análisis Taxonomico de Evaluaciones</h1>

            {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Columna izquierda: carga e historial */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Analizar Nuevo Documento</h2>
                        <div className="space-y-4">
                            {/* Selección de archivo */}
                            <div>
                                <label htmlFor="file-upload" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Subir Archivo (.pdf, .docx)</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                        <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        <div className="flex text-sm text-slate-600 dark:text-slate-400">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-amber-600 hover:text-amber-500">
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
                                                <span>Cargue un archivo</span>
                                            </label>
                                            <p className="pl-1">o arrástrelo aquí</p>
                                        </div>
                                        <p className="text-xs text-slate-500">{selectedFile ? selectedFile.name : "PDF, DOCX hasta 10MB"}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Campos nuevos: Nivel y Asignatura */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nivel</label>
                                    <select value={nivelForm} onChange={(e) => setNivelForm(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                                        <option value="">Seleccione</option>
                                        {NIVELES_MEDIO.map(nv => <option key={nv} value={nv}>{nv}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
                                    <select value={asignaturaForm} onChange={(e) => setAsignaturaForm(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                                        <option value="">Seleccione</option>
                                        {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="documentName" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre del Documento</label>
                                <input type="text" id="documentName" value={documentName} onChange={(e) => setDocumentName(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                            </div>

                            <button onClick={handleAnalyze} disabled={isLoading || !fileData} className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 flex items-center justify-center">
                                {isLoading ? <Spinner /> : 'Analizar con IA'}
                            </button>
                        </div>
                    </div>

                    {/* Historial */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Historial de Análisis</h2>
                        {loading ? <p className="text-sm text-slate-500">Cargando...</p> : history.length === 0 ? (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-lg text-sm">No hay análisis guardados.</div>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {history.map(item => (
                                    <button key={item.id} onClick={() => setSelectedAnalysis(item)} className={`w-full text-left p-3 rounded-md border ${selectedAnalysis?.id === item.id ? 'bg-amber-100 border-amber-300' : 'bg-slate-50 hover:bg-slate-100'}`}>
                                        <p className="font-semibold truncate">{item.documentName}</p>
                                        <p className="text-xs text-slate-500">{new Date(item.uploadDate).toLocaleString('es-CL')}</p>
                                        {(item.nivel || item.asignatura) && (
                                            <p className="text-xs text-slate-500">{item.nivel || 'Nivel s/i'} • {item.asignatura || 'Asignatura s/i'}</p>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna derecha: Filtros + Vistas de gráficos + detalle */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Filtros globales */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md">
                        <div className="flex flex-col md:flex-row md:items-end gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Filtrar por Nivel</label>
                                <select value={filterNivel} onChange={(e) => setFilterNivel(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                                    <option value="">Todos</option>
                                    {NIVELES_MEDIO.map(nv => <option key={nv} value={nv}>{nv}</option>)}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Filtrar por Asignatura</label>
                                <select value={filterAsignatura} onChange={(e) => setFilterAsignatura(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                                    <option value="">Todas</option>
                                    {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setFilterNivel(''); setFilterAsignatura(''); }}
                                className="px-4 py-2 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold"
                            >
                                Limpiar filtros
                            </button>
                        </div>
                    </div>

                    {/* Tabs de gráficos */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md">
                        <div className="border-b border-slate-200 dark:border-slate-700 px-4">
                            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                <button
                                    onClick={() => setChartsTab('resumen')}
                                    className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${chartsTab === 'resumen' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                                >
                                    Resumen Global
                                </button>
                                <button
                                    onClick={() => setChartsTab('comparacion')}
                                    className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${chartsTab === 'comparacion' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                                >
                                    Comparación por Asignatura
                                </button>
                            </nav>
                        </div>

                        {chartsTab === 'resumen' ? (
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Resumen Global de Habilidades</h2>
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                        {filteredHistory.length} análisis considerados
                                    </span>
                                </div>

                                {/* Barras horizontales */}
                                <div className="space-y-3">
                                    {BLOOM_LEVELS.map(level => {
                                        const count = globalSummary.acc[level];
                                        const percentage = globalSummary.total > 0 ? (count / globalSummary.total) * 100 : 0;
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

                                {/* Chips resumen */}
                                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {BLOOM_LEVELS.map(level => (
                                        <div key={level} className="flex items-center justify-between px-3 py-2 rounded-lg border dark:border-slate-700">
                                            <span className="text-sm">{level}</span>
                                            <span className={`text-xs font-bold text-white px-2 py-1 rounded ${bloomColors[level]}`}>
                                                {globalSummary.acc[level]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Comparación por Asignatura</h2>
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                        {comparisonBySubject.length} asignaturas comparadas
                                    </span>
                                </div>

                                {comparisonBySubject.length === 0 ? (
                                    <div className="text-sm text-slate-500">No hay datos con los filtros actuales.</div>
                                ) : (
                                    <div className="space-y-5">
                                        {comparisonBySubject.map(row => {
                                            const total = row.total || 1;
                                            return (
                                                <div key={row.asignatura}>
                                                    <div className="flex justify-between items-center text-sm mb-1">
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{row.asignatura}</span>
                                                        <span className="text-slate-500 dark:text-slate-400">{row.total} ítems</span>
                                                    </div>
                                                    {/* barra apilada por niveles Bloom */}
                                                    <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-5 overflow-hidden flex">
                                                        {BLOOM_LEVELS.map(level => {
                                                            const count = row.counts[level] || 0;
                                                            const pct = (count / total) * 100;
                                                            return (
                                                                <div
                                                                    key={level}
                                                                    className={`${bloomColors[level]} h-5`}
                                                                    style={{ width: `${pct}%` }}
                                                                    title={`${level}: ${count} (${pct.toFixed(0)}%)`}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    {/* leyenda mini */}
                                                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                                                        {BLOOM_LEVELS.map(level => (
                                                            <div key={level} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                                                <span className={`inline-block w-3 h-3 rounded ${bloomColors[level]}`} />
                                                                <span>{level}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Detalle del análisis seleccionado */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        {selectedAnalysis ? (
                            <div className="space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{selectedAnalysis.documentName}</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Analizado el {new Date(selectedAnalysis.uploadDate).toLocaleString('es-CL')}
                                            {(selectedAnalysis.nivel || selectedAnalysis.asignatura) && (
                                                <>
                                                    {' '}• {selectedAnalysis.nivel || 'Nivel s/i'} • {selectedAnalysis.asignatura || 'Asignatura s/i'}
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <button onClick={() => handleDelete(selectedAnalysis.id)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Eliminar</button>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-3">Consolidado del Documento ({totalQuestions} preguntas)</h3>
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
                                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${bloomColors[res.habilidadBloom]}`}>
                                                                {res.habilidadBloom}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">Resultados del Análisis</h2>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mt-2">
                                    Realice un nuevo análisis o seleccione uno del historial para ver los resultados aquí.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalisisTaxonomico;
