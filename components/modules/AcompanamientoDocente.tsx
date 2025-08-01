import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { AcompanamientoDocente, User, Profile } from '../../types';
import { ASIGNATURAS, CURSOS, RUBRICA_ACOMPANAMIENTO_DOCENTE as defaultRubric } from '../../constants';
import { GoogleGenAI } from "@google/genai";
import { read, utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logApiCall } from '../utils/apiLogger';
import {
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
} from '../../src/firebaseHelpers/users';
import {
    getAllAcompanamientos,
    createAcompanamiento,
    updateAcompanamiento,
    deleteAcompanamiento,
} from '../../src/firebaseHelpers/acompanamientos'; // AJUSTA la ruta según dónde guardes los helpers

type RubricStructure = typeof defaultRubric;

const AcompanamientoDocente: React.FC = () => {
    const [acompanamientos, setAcompanamientos] = useState<AcompanamientoDocente[]>([]);
    const [profesores, setProfesores] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingProfesores, setLoadingProfesores] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isConsolidating, setIsConsolidating] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    
    const rubrica: RubricStructure = defaultRubric;

    const initialFormState: Omit<AcompanamientoDocente, 'id'> = useMemo(() => ({
        fecha: new Date().toISOString(),
        docente: '',
        curso: '',
        asignatura: '',
        bloques: '',
        rubricaResultados: {},
        observacionesGenerales: '',
        retroalimentacionConsolidada: '',
    }), []);

    const [formData, setFormData] = useState<Omit<AcompanamientoDocente, 'id'>>(initialFormState);

    // Cargar acompañamientos desde Firestore
    const fetchAcompanamientos = useCallback(async () => {
        setLoading(true);
        try {
            const acompanamientosFS = await getAllAcompanamientos();
            setAcompanamientos(acompanamientosFS);
            setError(null);
        } catch (e) {
            console.error("Error al cargar acompañamientos desde Firestore", e);
            setError("No se pudieron cargar los registros de acompañamiento desde la nube.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Cargar profesores desde Firestore
    const fetchProfesores = useCallback(async () => {
        setLoadingProfesores(true);
        try {
            const allUsers = await getAllUsers();
            const teacherNames = allUsers
                .filter(user => user.profile === Profile.PROFESORADO)
                .map(user => user.nombreCompleto)
                .sort();
            setProfesores(teacherNames);
        } catch (e) {
            console.error("Error al cargar profesores desde Firestore", e);
            setError("No se pudieron cargar la lista de profesores desde la nube.");
        } finally {
            setLoadingProfesores(false);
        }
    }, []);

    useEffect(() => {
        fetchAcompanamientos();
        fetchProfesores();
    }, [fetchAcompanamientos, fetchProfesores]);

    const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRubricSelect = (criterionName: string, level: number) => {
        setFormData(prev => ({
            ...prev,
            rubricaResultados: {
                ...prev.rubricaResultados,
                [criterionName]: level,
            },
        }));
    };
    
    const handleConsolidarFeedback = async () => {
        setIsConsolidating(true);
        const { rubricaResultados, observacionesGenerales } = formData;

        let promptDetails = "Resultados de la Rúbrica:\n";
        rubrica.forEach(domain => {
            domain.criteria.forEach(criterion => {
                const score = rubricaResultados[criterion.name];
                if (score && criterion.levels[score - 1]) {
                    const levelDescription = criterion.levels[score - 1];
                    promptDetails += `- Criterio: "${criterion.name}" | Nivel: ${score} (${levelDescription})\n`;
                }
            });
        });

        promptDetails += `\nObservaciones Generales del Evaluador:\n${observacionesGenerales || "No se proveyeron observaciones adicionales."}`;

        const prompt = `
            Eres un asesor pedagógico experto. Tu tarea es generar una retroalimentación formal, técnica y constructiva para un docente, basada en una observación de clase.
            La retroalimentación debe ser estructurada y usar un lenguaje pedagógico preciso.

            A continuación, los datos de la observación:
            ${promptDetails}

            Genera una retroalimentación que incluya obligatoriamente los siguientes puntos en formato Markdown:
            - ## Fortalezas Observadas: Destaca 2 o 3 puntos positivos clave, conectándolos con los criterios de la rúbrica.
            - ## Áreas de Mejora: Identifica 2 o 3 aspectos donde el docente puede mejorar, explicando el porqué con base en la evidencia.
            - ## Sugerencias y Pasos a Seguir: Ofrece recomendaciones concretas, prácticas y accionables que el docente pueda implementar.
        `;

        try {
            logApiCall('Acompañamiento - Consolidar Feedback');
            const ai = new GoogleGenAI({ apiKey: "AIzaSyBwOEsVIeAjIhoJ5PKko5DvmJrcQTwJwHE" });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            const cleanedText = response.text.replace(/(\*\*|\*)/g, '');
            setFormData(prev => ({ ...prev, retroalimentacionConsolidada: cleanedText }));
        } catch (error) {
            console.error("Error al generar retroalimentación con IA", error);
            alert("No se pudo generar la retroalimentación. Inténtelo de nuevo.");
        } finally {
            setIsConsolidating(false);
        }
    };
    
    const handleGeneratePDF = async () => {
        const currentRecordId = editingId;
        if (!currentRecordId) return;
    
        setIsGeneratingPDF(true);
        const record = acompanamientos.find(a => a.id === currentRecordId);
    
        if (!record) {
            setIsGeneratingPDF(false);
            return;
        }
    
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });
    
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const contentWidth = pageWidth - margin * 2;
        let y = margin;
    
        const addHeader = (docInstance: jsPDF) => {
            docInstance.setFont('helvetica', 'bold');
            docInstance.setFontSize(10);
            docInstance.setTextColor(100);
            docInstance.text('LICEO INDUSTRIAL DE RECOLETA', pageWidth / 2, 15, { align: 'center' });
        };
    
        addHeader(doc);
    
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text('Informe de Acompañamiento Docente', pageWidth / 2, y + 10, { align: 'center' });
        y += 25;
    
        autoTable(doc, {
            startY: y,
            body: [
                [{ content: 'Docente:', styles: { fontStyle: 'bold' } }, record.docente],
                [{ content: 'Fecha:', styles: { fontStyle: 'bold' } }, new Date(record.fecha).toLocaleDateString('es-CL')],
                [{ content: 'Asignatura:', styles: { fontStyle: 'bold' } }, record.asignatura],
                [{ content: 'Curso:', styles: { fontStyle: 'bold' } }, record.curso],
            ],
            theme: 'plain',
            styles: { fontSize: 11, cellPadding: 2, textColor: [50,50,50] },
            columnStyles: { 0: { cellWidth: 35 } }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
        
        const tableBody: any[] = [];
        const niveles = ['Débil', 'Incipiente', 'Satisfactorio', 'Avanzado'];
        rubrica.forEach(domain => {
             tableBody.push([{ content: domain.domain, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [220, 220, 220], textColor: [40, 40, 40], halign: 'left' } }]);
            domain.criteria.forEach(criterion => {
                const score = record.rubricaResultados[criterion.name];
                const nivelTexto = score ? niveles[score - 1] : 'No evaluado';
                tableBody.push([criterion.name, nivelTexto]);
            });
        });

        autoTable(doc, {
            startY: y,
            head: [['Indicador', 'Nivel de Logro']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80], textColor: 255 },
            didDrawPage: (data) => { if (data.pageNumber > 1) addHeader(doc); }
        });
        y = (doc as any).lastAutoTable.finalY + 15;
        
        const addFlowingText = (text: string, options: { size: number; style: 'normal' | 'bold'; isTitle: boolean; }) => {
            if (y > pageHeight - margin - 10) { doc.addPage(); addHeader(doc); y = margin; }
            doc.setFont('helvetica', options.style); doc.setFontSize(options.size);
            const lines = doc.splitTextToSize(text, contentWidth);
            const textHeight = lines.length * (options.size * 0.352778 * 1.15);
            if (y + textHeight > pageHeight - margin) { doc.addPage(); addHeader(doc); y = margin; }
            doc.text(lines, margin, y, { align: 'left' });
            y += textHeight + (options.isTitle ? 5 : 8);
        };

        if (record.retroalimentacionConsolidada) {
            const sections = record.retroalimentacionConsolidada.split(/(?=## )/);
            sections.forEach(section => {
                if (section.trim()) {
                    const lines = section.trim().split('\n');
                    const title = lines[0].replace('## ', '');
                    const content = lines.slice(1).join('\n').trim();
                    addFlowingText(title, { size: 14, style: 'bold', isTitle: true });
                    addFlowingText(content, { size: 11, style: 'normal', isTitle: false });
                }
            });
        } else {
             addFlowingText('Retroalimentación Consolidada', { size: 14, style: 'bold', isTitle: true });
             addFlowingText('No se ha generado retroalimentación.', { size: 11, style: 'normal', isTitle: false });
        }

        doc.save(`Acompanamiento_${record.docente.replace(/\s/g, '_')}_${new Date(record.fecha).toLocaleDateString('es-CL')}.pdf`);
        setIsGeneratingPDF(false);
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!formData.docente || !formData.curso || !formData.asignatura) {
            alert('Docente, curso y asignatura son campos obligatorios.');
            return;
        }

        try {
            let savedRecordId = editingId;
            
            if (editingId) {
                // Actualizar registro existente
                await updateAcompanamiento(editingId, formData);
            } else {
                // Crear nuevo registro
                const newRecord = await createAcompanamiento(formData);
                setEditingId(newRecord.id); 
                setFormData({ ...formData });
                savedRecordId = newRecord.id;
            }
            
            // Recargar acompañamientos después de la operación
            await fetchAcompanamientos();
            
            if (savedRecordId) {
                alert("¡Guardado correctamente!");
            }
        } catch (err) {
            console.error("Error al guardar acompañamiento:", err);
            setError("Error al guardar el registro en la nube.");
        }
    };

    const handleCreateNew = () => {
        setFormData(initialFormState);
        setEditingId(null);
        setView('form');
        setError(null);
    };
    
    const handleEdit = (record: AcompanamientoDocente) => {
        setFormData(record);
        setEditingId(record.id);
        setView('form');
        setError(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Está seguro de que desea eliminar este registro de acompañamiento?")) {
            try {
                await deleteAcompanamiento(id);
                await fetchAcompanamientos(); // Recargar después de eliminar
            } catch (err) {
                console.error("Error al eliminar acompañamiento:", err);
                setError("No se pudo eliminar el registro en la nube.");
            }
        }
    };

    const renderListView = () => (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Registros de Acompañamiento</h2>
                <button onClick={handleCreateNew} className="bg-amber-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-amber-600 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">
                    Crear Nuevo
                </button>
            </div>

            {loading && <div className="text-center text-amber-600 py-4">Cargando registros desde la nube...</div>}
            {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</div>}

            {!loading && acompanamientos.length === 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-lg">
                    No hay registros de acompañamiento en la nube.
                </div>
            )}

            <div className="space-y-4">
                {!loading && acompanamientos.length > 0 && (
                    acompanamientos.map(record => (
                        <div key={record.id} className="p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{record.docente}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{record.curso} - {record.asignatura}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Fecha: {new Date(record.fecha).toLocaleDateString('es-CL')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleEdit(record)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-sm">Ver y Editar</button>
                                <button onClick={() => handleDelete(record.id)} title="Eliminar" className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40">🗑️</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
    
    const renderFormView = () => (
         <div className="animate-fade-in">
             <form onSubmit={handleSave} className="space-y-8">
                 <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{editingId ? "Editando Acompañamiento" : "Nuevo Acompañamiento Docente"}</h2>
                    <button type="button" onClick={() => setView('list')} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold">&larr; Volver al listado</button>
                 </div>

                {error && <div className="text-red-600 bg-red-100 p-3 rounded-md">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 dark:border-slate-700">
                     <div>
                        <label htmlFor="docente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Docente</label>
                        <select name="docente" value={formData.docente} onChange={handleFieldChange} required className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" disabled={loadingProfesores}>
                             <option value="">{loadingProfesores ? 'Cargando...' : 'Seleccione'}</option>
                             {profesores.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="curso" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Curso</label>
                        <select name="curso" value={formData.curso} onChange={handleFieldChange} required className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                            <option value="">Seleccione</option>
                            {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="asignatura" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
                        <select name="asignatura" value={formData.asignatura} onChange={handleFieldChange} required className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                            <option value="">Seleccione</option>
                            {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="bloques" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Bloques Horarios</label>
                        <input type="text" name="bloques" value={formData.bloques} onChange={handleFieldChange} placeholder="Ej: 3-4" className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                    </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                     <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-1/12">Dominio</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-3/12">Criterio</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">Débil (1)</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">Incipiente (2)</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">Satisfactorio (3)</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">Avanzado (4)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {rubrica.map(domain => (
                                <React.Fragment key={domain.domain}>
                                    {domain.criteria.map((criterion, critIndex) => (
                                        <tr key={criterion.name}>
                                            {critIndex === 0 && (
                                                <td rowSpan={domain.criteria.length} className="px-3 py-4 align-top text-sm font-semibold text-slate-800 dark:text-slate-200 border-r dark:border-slate-600">{domain.domain}</td>
                                            )}
                                            <td className="px-3 py-4 align-top text-sm font-medium text-slate-700 dark:text-slate-300 border-r dark:border-slate-600">{criterion.name}</td>
                                            {criterion.levels.map((levelText, levelIndex) => {
                                                const level = levelIndex + 1;
                                                const isSelected = formData.rubricaResultados[criterion.name] === level;
                                                return (
                                                    <td key={level} onClick={() => handleRubricSelect(criterion.name, level)} className={`px-3 py-4 align-top text-sm text-slate-600 dark:text-slate-300 border-r dark:border-slate-600 cursor-pointer transition-colors ${isSelected ? 'bg-amber-100 dark:bg-amber-900/30' : 'hover:bg-amber-50 dark:hover:bg-slate-700'}`}>
                                                        {levelText}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                     </table>
                </div>

                <div>
                    <label htmlFor="observacionesGenerales" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Observaciones Generales</label>
                    <textarea name="observacionesGenerales" value={formData.observacionesGenerales} onChange={handleFieldChange} rows={5} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"></textarea>
                </div>
                
                <div className="space-y-4">
                    <label htmlFor="retroalimentacionConsolidada" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Retroalimentación Consolidada</label>
                    <div className="flex items-start gap-4">
                        <textarea name="retroalimentacionConsolidada" value={formData.retroalimentacionConsolidada} onChange={handleFieldChange} rows={8} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" placeholder="Haga clic en 'Consolidar' para generar la retroalimentación aquí..."></textarea>
                        <button type="button" onClick={handleConsolidarFeedback} disabled={isConsolidating} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600 disabled:bg-slate-400">
                            {isConsolidating ? '...' : 'Consolidar'}
                        </button>
                    </div>
                </div>
                
                 <div className="flex justify-end gap-4 pt-4 border-t dark:border-slate-700">
                    <button type="button" onClick={handleGeneratePDF} disabled={!editingId || isGeneratingPDF} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 disabled:bg-slate-400">
                        {isGeneratingPDF ? '...' : 'Exportar PDF'}
                    </button>
                    <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">
                        Guardar Acompañamiento
                    </button>
                </div>
             </form>
        </div>
    );
    
    return (
        <div className="space-y-8 animate-fade-in">
             <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Acompañamiento Docente</h1>
             
             <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                {view === 'list' ? renderListView() : renderFormView()}
             </div>
        </div>
    );
};

export default AcompanamientoDocente;