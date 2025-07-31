import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { ActividadRemota, RespuestaEstudianteActividad, TipoActividadRemota, NivelPlanificacion, QuizQuestion, PareadoItem, ComprensionLecturaContent, DesarrolloContent, User, Profile, ArchivoAdjuntoRecurso } from '../../types';
import { ASIGNATURAS, NIVELES, TIPOS_ACTIVIDAD_REMOTA, CURSOS } from '../../constants';
import { GoogleGenAI, Type } from "@google/genai";
import { logApiCall } from '../utils/apiLogger';

const ACTIVIDADES_KEY = 'actividadesRemotas';
const RESPUESTAS_KEY = 'respuestasActividades';
const USERS_KEY = 'usuariosLiceo';

const ITEM_QUANTITIES: Record<TipoActividadRemota, number[]> = {
    'Quiz': [5, 10, 15],
    'Términos Pareados': [5, 10, 15],
    'Desarrollo': [1, 2, 3],
    'Comprensión de Lectura': [1, 2, 3],
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};


const ActividadesRemotas: React.FC = () => {
    const [actividades, setActividades] = useState<ActividadRemota[]>([]);
    const [respuestas, setRespuestas] = useState<RespuestaEstudianteActividad[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [selectedActividad, setSelectedActividad] = useState<ActividadRemota | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [studentSearch, setStudentSearch] = useState('');
    const [previewData, setPreviewData] = useState<ActividadRemota | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    
    const initialFormState: Omit<ActividadRemota, 'id' | 'fechaCreacion' | 'generatedContent' | 'introduccion'> = {
        asignatura: ASIGNATURAS[0],
        nivel: NIVELES[0],
        contenido: '',
        plazoEntrega: new Date().toISOString().split('T')[0],
        tipos: [],
        cantidadPreguntas: {},
        cursosDestino: [],
        estudiantesDestino: [],
        recursos: {
            instrucciones: '',
            enlaces: '',
            archivos: []
        }
    };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        try {
            const storedActividades = localStorage.getItem(ACTIVIDADES_KEY);
            if (storedActividades) setActividades(JSON.parse(storedActividades));

            const storedRespuestas = localStorage.getItem(RESPUESTAS_KEY);
            if (storedRespuestas) setRespuestas(JSON.parse(storedRespuestas));
            
            const storedUsers = localStorage.getItem(USERS_KEY);
            if (storedUsers) setAllUsers(JSON.parse(storedUsers));
        } catch (e) {
            console.error("Error al cargar datos desde localStorage", e);
        }
    }, []);

    const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRecursoChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            recursos: {
                ...prev.recursos,
                [e.target.name]: e.target.value
            }
        }));
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };
    
    const handleTipoChange = (tipo: TipoActividadRemota) => {
        setFormData(prev => {
            const newTipos = prev.tipos.includes(tipo)
                ? prev.tipos.filter(t => t !== tipo)
                : [...prev.tipos, tipo];

            const newCantidades = { ...prev.cantidadPreguntas };
            if (newTipos.includes(tipo)) {
                 if (!newCantidades[tipo]) {
                    newCantidades[tipo] = ITEM_QUANTITIES[tipo][0];
                }
            } else {
                delete newCantidades[tipo];
            }
            
            return { ...prev, tipos: newTipos, cantidadPreguntas: newCantidades };
        });
    };

    const handleQuantityChange = (tipo: TipoActividadRemota, cantidad: number) => {
        setFormData(prev => ({
            ...prev,
            cantidadPreguntas: {
                ...prev.cantidadPreguntas,
                [tipo]: cantidad,
            }
        }));
    };

    const handleCursoDestinoChange = (curso: string) => {
        setFormData(prev => {
            const newCursos = prev.cursosDestino?.includes(curso)
                ? prev.cursosDestino.filter(c => c !== curso)
                : [...(prev.cursosDestino || []), curso];
            return { ...prev, cursosDestino: newCursos };
        });
    };

    const handleEstudianteDestinoChange = (nombre: string) => {
        setFormData(prev => {
            const newEstudiantes = prev.estudiantesDestino?.includes(nombre)
                ? prev.estudiantesDestino.filter(e => e !== nombre)
                : [...(prev.estudiantesDestino || []), nombre];
            return { ...prev, estudiantesDestino: newEstudiantes };
        });
    };

    const getResponseSchema = (tipos: TipoActividadRemota[]) => {
        const individualSchemas: Record<string, object> = {
            'Quiz': { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { pregunta: { type: Type.STRING }, opciones: { type: Type.ARRAY, items: { type: Type.STRING } }, respuestaCorrecta: { type: Type.STRING } } } },
            'Comprensión de Lectura': { type: Type.OBJECT, properties: { texto: { type: Type.STRING }, preguntas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { pregunta: { type: Type.STRING }, opciones: { type: Type.ARRAY, items: { type: Type.STRING } }, respuestaCorrecta: { type: Type.STRING } } } } } },
            'Términos Pareados': { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, concepto: { type: Type.STRING }, definicion: { type: Type.STRING } } } },
            'Desarrollo': { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { pregunta: { type: Type.STRING }, rubrica: { type: Type.STRING } } } }
        };

        const activitiesProperties: any = {};
        tipos.forEach(tipo => {
            activitiesProperties[tipo] = individualSchemas[tipo];
        });

        return {
            type: Type.OBJECT,
            properties: {
                introduccion: { type: Type.STRING, description: "Una breve introducción motivadora para el estudiante sobre el tema." },
                actividades: { type: Type.OBJECT, properties: activitiesProperties, required: tipos }
            },
            required: ["introduccion", "actividades"]
        };
    };
    
    const buildPrompt = () => {
        const { tipos, contenido, asignatura, nivel, cantidadPreguntas } = formData;
        let prompt = `Eres un experto diseñador de actividades pedagógicas. Genera un objeto JSON que se ajuste al esquema, sin texto adicional.\n\nContenido base: "${contenido}"\nAsignatura: ${asignatura}\nNivel: ${nivel}\n\nGenera los siguientes elementos:\n- **introduccion**: Una breve introducción motivadora para el estudiante sobre el tema: "${contenido}".\n- **actividades**: Un objeto que contiene las actividades. Cada actividad es una propiedad con su nombre como clave:\n`;
        tipos.forEach(tipo => {
            const cantidad = cantidadPreguntas[tipo] || ITEM_QUANTITIES[tipo][0];
            switch (tipo) {
                case 'Quiz': prompt += `- **Quiz**: Genera un quiz de ${cantidad} preguntas de selección múltiple sobre el contenido. Cada una con 4 opciones.\n`; break;
                case 'Comprensión de Lectura': prompt += `- **Comprensión de Lectura**: Genera ${cantidad} actividad(es) de comprensión. Cada una con un texto de 150-200 palabras y 4 preguntas de selección múltiple.\n`; break;
                case 'Términos Pareados': prompt += `- **Términos Pareados**: Genera ${cantidad} pares de términos pareados (concepto y definición).\n`; break;
                case 'Desarrollo': prompt += `- **Desarrollo**: Genera ${cantidad} pregunta(s) de desarrollo con una rúbrica simple en texto.\n`; break;
            }
        });
        return prompt;
    };


    const handleGeneratePreview = async (e: FormEvent) => {
        e.preventDefault();
        if (!formData.contenido.trim() || formData.tipos.length === 0) {
            setError("Contenido y al menos un tipo de actividad son obligatorios.");
            return;
        }
        setIsLoading(true);
        setError(null);
        
        try {
            // Process files
            const processedFiles: ArchivoAdjuntoRecurso[] = await Promise.all(
                selectedFiles.map(async file => ({
                    nombre: file.name,
                    url: await fileToBase64(file),
                }))
            );

            logApiCall('Actividades Remotas');
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = buildPrompt();
            const schema = getResponseSchema(formData.tipos);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: schema }
            });
            
            const generatedData = JSON.parse(response.text);

            const newActividad: ActividadRemota = {
                id: crypto.randomUUID(),
                fechaCreacion: new Date().toISOString(),
                ...formData,
                recursos: {
                    ...formData.recursos,
                    archivos: processedFiles
                },
                introduccion: generatedData.introduccion,
                generatedContent: generatedData.actividades,
            };

            setPreviewData(newActividad);

        } catch (e) {
            console.error("Error al generar actividad con IA", e);
            setError("Error al generar la actividad. Por favor, revise el contenido e inténtelo de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleConfirmAndSave = () => {
        if (!previewData) return;
        const updatedActividades = [previewData, ...actividades];
        setActividades(updatedActividades);
        localStorage.setItem(ACTIVIDADES_KEY, JSON.stringify(updatedActividades));
        
        setFormData(initialFormState);
        setSelectedFiles([]);
        setIsCreating(false);
        setPreviewData(null);
        setSelectedActividad(previewData); // Go to results view after saving
    };

    const estudiantesAsignados = useMemo(() => {
        if (!selectedActividad || !allUsers) return [];
        const estudiantesPorCurso = allUsers.filter(u => u.profile === Profile.ESTUDIANTE && selectedActividad.cursosDestino?.includes(u.curso || '')).map(u => u.nombreCompleto);
        const estudiantesIndividuales = selectedActividad.estudiantesDestino || [];
        if (!selectedActividad.cursosDestino?.length && !selectedActividad.estudiantesDestino?.length) {
            const nivelNum = selectedActividad.nivel.charAt(0);
            return allUsers.filter(u => u.profile === Profile.ESTUDIANTE && u.curso?.startsWith(nivelNum)).map(u => u.nombreCompleto).sort();
        }
        return Array.from(new Set([...estudiantesPorCurso, ...estudiantesIndividuales])).sort();
    }, [selectedActividad, allUsers]);

    const resultadosDeActividad = useMemo(() => {
        return respuestas.filter(r => r.actividadId === selectedActividad?.id);
    }, [respuestas, selectedActividad]);
    
    const students = useMemo(() => {
        return allUsers.filter(u => u.profile === Profile.ESTUDIANTE).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    }, [allUsers]);

    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return students;
        return students.filter(s => s.nombreCompleto.toLowerCase().includes(studentSearch.toLowerCase()));
    }, [students, studentSearch]);

    const renderActivityView = () => (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedActividad?.asignatura} - {selectedActividad?.tipos.join(', ')}</h2>
                    <p className="text-slate-500">Nivel: {selectedActividad?.nivel} | Plazo: {selectedActividad?.plazoEntrega}</p>
                </div>
                <button onClick={() => setSelectedActividad(null)} className="text-slate-600 hover:text-slate-900 font-semibold">&larr; Volver al listado</button>
            </div>
            <div className="mt-6 border-t pt-6">
                <h3 className="text-xl font-bold text-slate-700 mb-4">Resultados de Estudiantes</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Puntaje</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha Completado</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {estudiantesAsignados.map(nombre => {
                                const resultado = resultadosDeActividad.find(r => r.estudianteId === nombre);
                                return (
                                    <tr key={nombre}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{nombre}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            {resultado ? <span className="px-2 py-1 font-semibold text-xs rounded-full bg-green-100 text-green-800">Completado</span> : <span className="px-2 py-1 font-semibold text-xs rounded-full bg-yellow-100 text-yellow-800">Pendiente</span>}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{resultado ? `${resultado.puntaje}/${resultado.puntajeMaximo}` : '-'}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{resultado ? new Date(resultado.fechaCompletado).toLocaleString('es-CL') : '-'}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
    
    const renderCreationForm = () => (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold text-slate-800">Nueva Actividad Remota</h2>
                <button onClick={() => setIsCreating(false)} className="text-slate-600 hover:text-slate-900 font-semibold">&larr; Volver al listado</button>
            </div>
             <p className="text-slate-500 mt-1 mb-6">Complete el formulario y la IA generará una actividad interactiva para sus estudiantes.</p>
            <form onSubmit={handleGeneratePreview} className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Asignatura</label>
                        <select name="asignatura" value={formData.asignatura} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm">{ASIGNATURAS.map(a=><option key={a} value={a}>{a}</option>)}</select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Nivel</label>
                        <select name="nivel" value={formData.nivel} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm">{NIVELES.map(n=><option key={n} value={n}>{n}</option>)}</select>
                    </div>

                    <div className="md:col-span-2 p-4 border rounded-lg space-y-4 bg-slate-50">
                        <h3 className="text-lg font-semibold text-slate-700">Recursos de Aprendizaje (Opcional)</h3>
                        <div>
                             <label className="block text-sm font-medium text-slate-600 mb-1">Instrucciones de estudio</label>
                            <textarea name="instrucciones" value={formData.recursos?.instrucciones} onChange={handleRecursoChange} placeholder="Ej: Lee el siguiente texto y luego responde..." rows={3} className="w-full border-slate-300 rounded-md shadow-sm"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Enlaces (videos, documentos, etc.)</label>
                            <textarea name="enlaces" value={formData.recursos?.enlaces} onChange={handleRecursoChange} placeholder="Pega un enlace por línea..." rows={3} className="w-full border-slate-300 rounded-md shadow-sm"/>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-600 mb-1">Adjuntar archivos (PDF, imágenes, etc.)</label>
                             <input type="file" multiple onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"/>
                        </div>
                    </div>


                    <div className="md:col-span-2 p-4 border rounded-lg space-y-4 bg-slate-50">
                        <h3 className="text-lg font-semibold text-slate-700">Destinatarios</h3>
                        <p className="text-sm text-slate-500">Seleccione cursos o estudiantes. Si no selecciona ninguno, la actividad será visible para todo el nivel.</p>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Cursos</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-40 overflow-y-auto p-2 bg-white rounded">
                                {CURSOS.map(curso => (<label key={curso} className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 cursor-pointer"><input type="checkbox" checked={formData.cursosDestino?.includes(curso)} onChange={() => handleCursoDestinoChange(curso)} className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"/><span className="text-sm font-medium text-slate-700">{curso}</span></label>))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Estudiantes</label>
                            <input type="text" placeholder="Buscar..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm mb-2"/>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-2 bg-white rounded">
                                {filteredStudents.map(student => (<label key={student.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 cursor-pointer"><input type="checkbox" checked={formData.estudiantesDestino?.includes(student.nombreCompleto)} onChange={() => handleEstudianteDestinoChange(student.nombreCompleto)} className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"/><span className="text-sm font-medium text-slate-700 truncate" title={student.nombreCompleto}>{student.nombreCompleto}</span></label>))}
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-600 mb-2">Tipos de Actividad</label>
                        <div className="space-y-3">
                           {TIPOS_ACTIVIDAD_REMOTA.map(tipo => (
                                <div key={tipo} className="p-3 border rounded-lg has-[:checked]:bg-amber-50 has-[:checked]:border-amber-300">
                                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={formData.tipos.includes(tipo)} onChange={() => handleTipoChange(tipo)} className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"/><span className="text-sm font-medium text-slate-700 flex-grow">{tipo}</span></label>
                                    {formData.tipos.includes(tipo) && (<div className="mt-3 pl-8 flex items-center gap-2"><span className="text-xs text-slate-500">Cantidad:</span>{ITEM_QUANTITIES[tipo].map(qty => (<button type="button" key={qty} onClick={() => handleQuantityChange(tipo, qty)} className={`px-3 py-1 rounded-full font-semibold text-xs ${formData.cantidadPreguntas[tipo] === qty ? 'bg-amber-500 text-white' : 'bg-slate-200'}`}>{qty}</button>))}</div>)}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="contenido" className="block text-sm font-medium text-slate-600 mb-1">Contenido <span className="text-red-500">*</span></label>
                        <textarea name="contenido" value={formData.contenido} onChange={handleFieldChange} required rows={4} placeholder="Ingrese los temas, conceptos clave o el texto base..." className="w-full border-slate-300 rounded-md shadow-sm"></textarea>
                    </div>
                    <div>
                        <label htmlFor="plazoEntrega" className="block text-sm font-medium text-slate-600 mb-1">Plazo de Entrega</label>
                        <input type="date" name="plazoEntrega" value={formData.plazoEntrega} onChange={handleFieldChange} required className="w-full border-slate-300 rounded-md shadow-sm" />
                    </div>
                </div>
                 {error && <p className="text-red-600 bg-red-100 p-3 rounded-md mt-4">{error}</p>}
                <div className="pt-4 text-right">
                    <button type="submit" disabled={isLoading} className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 flex items-center justify-center min-w-[180px]">
                        {isLoading ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'Generar y Previsualizar'}
                    </button>
                </div>
            </form>
        </div>
    );
    
    const renderPreview = () => (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-slate-800">Previsualización de la Actividad</h2>
            <p className="text-slate-500 mt-1 mb-6">Revisa el contenido generado. Si todo está correcto, confirma para asignar la actividad.</p>
            <div className="space-y-6 max-h-[60vh] overflow-y-auto p-4 bg-slate-50 rounded-lg border">
                 <div className="p-4 bg-sky-50 border-l-4 border-sky-400 rounded-r-lg"><h3 className="font-bold text-sky-800 mb-2">Introducción para el Estudiante</h3><p className="text-slate-700 whitespace-pre-wrap">{previewData?.introduccion}</p></div>
                 
                 {previewData?.recursos && (previewData.recursos.instrucciones || previewData.recursos.enlaces || previewData.recursos.archivos?.length) && (
                    <div className="p-4 bg-indigo-50 border-l-4 border-indigo-400 rounded-r-lg">
                        <h3 className="font-bold text-indigo-800 mb-2">Recursos de Aprendizaje</h3>
                        <div className="space-y-3">
                            {previewData.recursos.instrucciones && <p className="text-slate-700 whitespace-pre-wrap">{previewData.recursos.instrucciones}</p>}
                            {previewData.recursos.enlaces && (
                                <div>{previewData.recursos.enlaces.split('\n').map((link, i) => link.trim() && <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline truncate">{link}</a>)}</div>
                            )}
                            {previewData.recursos.archivos && previewData.recursos.archivos.length > 0 && (
                                <ul className="list-disc list-inside">
                                    {previewData.recursos.archivos.map(file => <li key={file.nombre} className="text-slate-700">{file.nombre}</li>)}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                 {previewData?.tipos.map(tipo => {
                     const content = previewData.generatedContent[tipo];
                     if (!content) return null;
                     return (<div key={tipo} className="p-4 border rounded-lg bg-white"><h3 className="text-xl font-bold mb-4">{tipo}</h3><div className="space-y-4 text-sm">
                        {tipo === 'Quiz' && (content as QuizQuestion[]).map((q, i) => (<div key={i}><p className="font-semibold">{i+1}. {q.pregunta}</p><ul className="list-disc pl-5 mt-1">{q.opciones.map(o => <li key={o}>{o}</li>)}</ul><p className="text-xs text-green-600">R: {q.respuestaCorrecta}</p></div>))}
                        {tipo === 'Comprensión de Lectura' && <div><p className="whitespace-pre-wrap bg-slate-100 p-2 rounded">{(content as ComprensionLecturaContent).texto}</p>{(content as ComprensionLecturaContent).preguntas.map((q,i) => (<div key={i} className="mt-2"><p className="font-semibold">{i+1}. {q.pregunta}</p><ul className="list-disc pl-5 mt-1">{q.opciones.map(o => <li key={o}>{o}</li>)}</ul><p className="text-xs text-green-600">R: {q.respuestaCorrecta}</p></div>))}</div>}
                        {tipo === 'Términos Pareados' && <ul className="list-disc pl-5">{(content as PareadoItem[]).map(p => <li key={p.id}><strong>{p.concepto}:</strong> {p.definicion}</li>)}</ul>}
                        {tipo === 'Desarrollo' && (content as DesarrolloContent[]).map((d,i) => <div key={i}><p className="font-semibold">{d.pregunta}</p><p className="text-xs italic mt-1">Rúbrica: {d.rubrica}</p></div>)}
                     </div></div>)
                 })}
            </div>
            <div className="pt-6 flex justify-end gap-4">
                <button onClick={() => setPreviewData(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300">Cancelar</button>
                <button onClick={handleConfirmAndSave} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700">Confirmar y Asignar</button>
            </div>
        </div>
    );

    const renderActivityList = () => (
         <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">Actividades Remotas</h1>
                <button onClick={() => setIsCreating(true)} className="bg-amber-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-amber-600">Crear Nueva</button>
            </div>
            <div className="space-y-4">
                {actividades.length > 0 ? actividades.map(act => {
                    const destinations = [];
                    if (act.cursosDestino?.length) destinations.push(`Cursos: ${act.cursosDestino.join(', ')}`);
                    if (act.estudiantesDestino?.length) destinations.push(`Estudiantes: ${act.estudiantesDestino.length}`);
                    const destinationText = destinations.length ? destinations.join(' | ') : `Todo ${act.nivel}`;

                    return (
                        <div key={act.id} className="p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-800">{act.asignatura} - {act.tipos.join(', ')}</p>
                                    <p className="text-sm text-slate-500">Destino: {destinationText} | Creado: {new Date(act.fechaCreacion).toLocaleDateString('es-CL')}</p>
                                </div>
                                <button onClick={() => setSelectedActividad(act)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">Ver Resultados</button>
                            </div>
                        </div>
                    )
                }) : <p className="text-slate-500 text-center py-6">No hay actividades creadas. Haga clic en "Crear Nueva" para comenzar.</p>}
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in">
            {previewData ? renderPreview() : selectedActividad ? renderActivityView() : (isCreating ? renderCreationForm() : renderActivityList())}
        </div>
    );
};

export default ActividadesRemotas;
