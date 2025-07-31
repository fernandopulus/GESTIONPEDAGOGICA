import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { EstudianteInclusion, DificultadAprendizaje, Intervencion, MetaProgreso, AlertaInclusion, ArchivoAdjunto, User, Profile, ReunionApoderados } from '../../types';
import { CURSOS, DIFICULTADES_APRENDIZAJE, PROFESORES } from '../../constants';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


const INCLUSION_KEY = 'estudiantesInclusion';
const USERS_KEY = 'usuariosLiceo';

const FichaEstudianteModal: React.FC<{
    student: EstudianteInclusion;
    onClose: () => void;
    onSave: (updatedStudent: EstudianteInclusion) => void;
    profesores: string[];
}> = ({ student, onClose, onSave, profesores }) => {
    const [activeTab, setActiveTab] = useState<'intervenciones' | 'seguimiento' | 'alertas' | 'reuniones'>('intervenciones');
    const [localStudentData, setLocalStudentData] = useState<EstudianteInclusion>(student);
    
    // State for Interventions tab
    const [editingIntervencion, setEditingIntervencion] = useState<Intervencion | null>(null);
    const initialIntervencionState: Omit<Intervencion, 'id' | 'fecha'> = { responsable: '', accion: '', observaciones: '' };
    const [newIntervencion, setNewIntervencion] = useState(initialIntervencionState);

    // State for Seguimiento y Metas tab
    const [newMeta, setNewMeta] = useState({ trimestre: 'T1' as 'T1' | 'T2' | 'T3', meta: '' });
    
    // State for Alertas y Archivos tab
    const [newAlerta, setNewAlerta] = useState({ titulo: '', fecha: new Date().toISOString().split('T')[0] });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // State for Reuniones tab
    const initialReunionState: Omit<ReunionApoderados, 'id' | 'fecha'> = { motivo: '', acuerdos: '', asistentes: '' };
    const [newReunion, setNewReunion] = useState(initialReunionState);


    const handleSaveLocal = () => {
        onSave(localStudentData);
    };

    // --- Interventions Logic ---
    const handleAddOrUpdateIntervencion = () => {
        if (!newIntervencion.responsable || !newIntervencion.accion) {
            alert('Responsable y Acción son campos obligatorios.');
            return;
        }

        let updatedInterventions;
        if (editingIntervencion) {
            updatedInterventions = (localStudentData.intervenciones || []).map(i => i.id === editingIntervencion.id ? { ...i, ...newIntervencion } : i);
        } else {
            const newRecord: Intervencion = { id: crypto.randomUUID(), fecha: new Date().toISOString(), ...newIntervencion };
            updatedInterventions = [newRecord, ...(localStudentData.intervenciones || [])];
        }
        
        const sorted = updatedInterventions.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        setLocalStudentData(prev => ({ ...prev, intervenciones: sorted }));
        setNewIntervencion(initialIntervencionState);
        setEditingIntervencion(null);
    };

    const handleEditIntervencion = (intervencion: Intervencion) => {
        setEditingIntervencion(intervencion);
        setNewIntervencion({ responsable: intervencion.responsable, accion: intervencion.accion, observaciones: intervencion.observaciones });
    };

    const handleDeleteIntervencion = (id: string) => {
        if (window.confirm("¿Eliminar esta intervención?")) {
            setLocalStudentData(prev => ({ ...prev, intervenciones: (prev.intervenciones || []).filter(i => i.id !== id) }));
        }
    };
    
    // --- Seguimiento y Metas Logic ---
    const handleSupportChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setLocalStudentData(prev => ({
            ...prev,
            [name]: value,
            fechaActualizacionApoyos: new Date().toISOString(),
        }));
    };

    const handleAddMeta = () => {
        if (!newMeta.meta.trim()) return;
        const metaToAdd: MetaProgreso = { ...newMeta, id: crypto.randomUUID(), cumplida: false };
        setLocalStudentData(prev => ({
            ...prev,
            metasProgreso: [...(prev.metasProgreso || []), metaToAdd]
        }));
        setNewMeta({ trimestre: 'T1', meta: '' });
    };

    const handleToggleMeta = (metaId: string) => {
        setLocalStudentData(prev => ({
            ...prev,
            metasProgreso: (prev.metasProgreso || []).map(m => m.id === metaId ? { ...m, cumplida: !m.cumplida } : m)
        }));
    };
    
    const handleDeleteMeta = (metaId: string) => {
         setLocalStudentData(prev => ({ ...prev, metasProgreso: (prev.metasProgreso || []).filter(m => m.id !== metaId) }));
    };

    const progresoMetas = useMemo(() => {
        const metas = localStudentData.metasProgreso || [];
        if (metas.length === 0) return { percent: 0, color: 'bg-slate-300' };
        const cumplidas = metas.filter(m => m.cumplida).length;
        const percent = Math.round((cumplidas / metas.length) * 100);
        const color = percent < 40 ? 'bg-red-500' : percent < 75 ? 'bg-yellow-500' : 'bg-green-500';
        return { percent, color };
    }, [localStudentData.metasProgreso]);

    const needsUpdate = useMemo(() => {
        if (!localStudentData.fechaActualizacionApoyos) return true;
        const lastUpdate = new Date(localStudentData.fechaActualizacionApoyos);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return lastUpdate < threeMonthsAgo;
    }, [localStudentData.fechaActualizacionApoyos]);

    // --- Alertas y Archivos Logic ---
    const handleAddAlerta = () => {
        if (!newAlerta.titulo.trim() || !newAlerta.fecha) return;
        const alertaToAdd: AlertaInclusion = { ...newAlerta, id: crypto.randomUUID(), resuelta: false };
        setLocalStudentData(prev => ({
            ...prev,
            alertas: [...(prev.alertas || []), alertaToAdd].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
        }));
        setNewAlerta({ titulo: '', fecha: new Date().toISOString().split('T')[0] });
    };

    const handleToggleAlerta = (alertaId: string) => {
        setLocalStudentData(prev => ({
            ...prev,
            alertas: (prev.alertas || []).map(a => a.id === alertaId ? { ...a, resuelta: !a.resuelta } : a)
        }));
    };
    
    const handleDeleteAlerta = (alertaId: string) => {
        setLocalStudentData(prev => ({ ...prev, alertas: (prev.alertas || []).filter(a => a.id !== alertaId) }));
    };
    
    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUploadFile = () => {
        if (!selectedFile) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onloadend = () => {
            const newFile: ArchivoAdjunto = {
                id: crypto.randomUUID(),
                nombre: selectedFile.name,
                url: reader.result as string, // Store as Base64 Data URL
                fechaSubida: new Date().toISOString(),
            };
            setLocalStudentData(prev => ({
                ...prev,
                archivos: [newFile, ...(prev.archivos || [])]
            }));
            setSelectedFile(null);
            setIsUploading(false);
        };
        reader.onerror = () => {
            alert("Error al leer el archivo.");
            setIsUploading(false);
        };
    };

    const handleDeleteFile = (fileId: string) => {
        if (window.confirm("¿Eliminar este archivo?")) {
            setLocalStudentData(prev => ({
                ...prev,
                archivos: (prev.archivos || []).filter(f => f.id !== fileId)
            }));
        }
    };

    // --- Reuniones Logic ---
    const handleAddReunion = () => {
        if (!newReunion.motivo.trim() || !newReunion.asistentes.trim()) {
            alert("Motivo y asistentes son obligatorios.");
            return;
        }
        const reunionToAdd: ReunionApoderados = { ...newReunion, id: crypto.randomUUID(), fecha: new Date().toISOString() };
        setLocalStudentData(prev => ({
            ...prev,
            reuniones: [reunionToAdd, ...(prev.reuniones || [])].sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        }));
        setNewReunion(initialReunionState);
    };

    const handleDeleteReunion = (reunionId: string) => {
        if(window.confirm("¿Eliminar este registro de reunión?")) {
            setLocalStudentData(prev => ({
                ...prev,
                reuniones: (prev.reuniones || []).filter(r => r.id !== reunionId)
            }));
        }
    };

    const handleExportFichaPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        let y = margin;
    
        const addHeader = (docInstance: jsPDF) => {
            docInstance.setFontSize(10); docInstance.setTextColor(100);
            docInstance.text('Ficha de Seguimiento - Módulo Inclusión', margin, 15);
        };
    
        addHeader(doc);
    
        doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(40);
        doc.text(localStudentData.nombre, margin, y + 10);
        y += 15;
    
        doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
        doc.text(`Curso: ${localStudentData.curso}`, margin, y);
        doc.text(`Dificultad: ${localStudentData.dificultad}`, margin, y + 6);
        y += 15;
    
        const checkPageBreak = (needed: number) => {
            if (y + needed > pageHeight - margin) {
                doc.addPage();
                addHeader(doc);
                y = margin;
            }
        };
    
        const addSectionTitle = (title: string) => {
            checkPageBreak(15);
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text(title, margin, y);
            y += 10;
        };
    
        if (localStudentData.intervenciones?.length) {
            addSectionTitle('Historial de Intervenciones');
            autoTable(doc, {
                startY: y,
                head: [['Fecha', 'Responsable', 'Acción', 'Observaciones']],
                body: localStudentData.intervenciones.map(i => [new Date(i.fecha).toLocaleDateString('es-CL'), i.responsable, i.accion, i.observaciones]),
                theme: 'grid',
                didDrawPage: data => addHeader(doc),
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }
    
        if (localStudentData.adaptacionesCurriculares || localStudentData.apoyosRecibidos) {
            checkPageBreak(30);
            addSectionTitle('Seguimiento y Apoyos');
            doc.setFontSize(11); doc.setFont('helvetica', 'normal');
            const text = `Adaptaciones: ${localStudentData.adaptacionesCurriculares || 'No registradas.'}\nApoyos: ${localStudentData.apoyosRecibidos || 'No registrados.'}`;
            const lines = doc.splitTextToSize(text, pageWidth - margin*2);
            doc.text(lines, margin, y);
            y += lines.length * 5 + 10;
        }
    
        if (localStudentData.metasProgreso?.length) {
            checkPageBreak(30);
            addSectionTitle('Metas de Progreso');
            autoTable(doc, {
                startY: y,
                head: [['Trimestre', 'Meta', 'Estado']],
                body: localStudentData.metasProgreso.map(m => [m.trimestre, m.meta, m.cumplida ? 'Cumplida' : 'Pendiente']),
                theme: 'grid',
                didDrawPage: data => addHeader(doc),
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        if (localStudentData.reuniones?.length) {
            addSectionTitle('Reuniones con Apoderados');
            autoTable(doc, {
                startY: y,
                head: [['Fecha', 'Motivo', 'Acuerdos', 'Asistentes']],
                body: localStudentData.reuniones.map(r => [new Date(r.fecha).toLocaleDateString('es-CL'), r.motivo, r.acuerdos, r.asistentes]),
                theme: 'grid',
                didDrawPage: data => addHeader(doc),
            });
        }
    
        doc.save(`Ficha_Inclusion_${localStudentData.nombre.replace(/\s/g, '_')}.pdf`);
    };
    
    const renderIntervenciones = () => (
        <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 space-y-3">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">{editingIntervencion ? 'Editando Intervención' : 'Registrar Nueva Intervención'}</h4>
                 <select value={newIntervencion.responsable} onChange={(e) => setNewIntervencion(prev => ({ ...prev, responsable: e.target.value }))} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                    <option value="">Seleccione Responsable...</option>
                    {profesores.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <textarea value={newIntervencion.accion} onChange={(e) => setNewIntervencion(prev => ({ ...prev, accion: e.target.value }))} placeholder="Acción realizada..." rows={2} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                <textarea value={newIntervencion.observaciones} onChange={(e) => setNewIntervencion(prev => ({ ...prev, observaciones: e.target.value }))} placeholder="Observaciones adicionales..." rows={2} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                <div className="flex justify-end gap-2">
                    {editingIntervencion && <button onClick={() => { setEditingIntervencion(null); setNewIntervencion(initialIntervencionState); }} className="text-sm bg-slate-200 dark:bg-slate-600 px-3 py-1 rounded-md">Cancelar Edición</button>}
                    <button onClick={handleAddOrUpdateIntervencion} className="text-sm bg-amber-500 text-white font-semibold px-3 py-1 rounded-md">{editingIntervencion ? 'Actualizar' : 'Guardar'}</button>
                </div>
            </div>
            <div className="space-y-3">
                 {(localStudentData.intervenciones || []).map(i => (
                    <div key={i.id} className="p-3 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-600">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{i.accion}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{i.observaciones}</p>
                                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{new Date(i.fecha).toLocaleString('es-CL')} - {i.responsable}</p>
                            </div>
                            <div className="flex-shrink-0 ml-4 flex gap-2">
                                <button onClick={() => handleEditIntervencion(i)} className="text-blue-500">✏️</button>
                                <button onClick={() => handleDeleteIntervencion(i.id)} className="text-red-500">🗑️</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    
    const renderSeguimiento = () => (
        <div className="space-y-6">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-600 space-y-3">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">Adaptaciones y Apoyos</h4>
                    {needsUpdate && <span title="Información no actualizada en los últimos 3 meses" className="text-yellow-500 text-xl">⚠️</span>}
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Adaptaciones Curriculares Implementadas</label>
                    <textarea name="adaptacionesCurriculares" value={localStudentData.adaptacionesCurriculares || ''} onChange={handleSupportChange} rows={3} className="w-full mt-1 border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Apoyos Recibidos (PIE, dupla, etc.)</label>
                    <textarea name="apoyosRecibidos" value={localStudentData.apoyosRecibidos || ''} onChange={handleSupportChange} rows={3} className="w-full mt-1 border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-600 space-y-3">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">Indicadores de Progreso</h4>
                <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Progreso Anual de Metas: {progresoMetas.percent}%</p>
                    <div className="w-full bg-slate-200 rounded-full h-4 dark:bg-slate-700">
                        <div className={`${progresoMetas.color} h-4 rounded-full transition-all duration-500`} style={{ width: `${progresoMetas.percent}%` }}></div>
                    </div>
                </div>
                {/* Add Meta Form */}
                <div className="flex gap-2 items-end pt-2">
                    <select value={newMeta.trimestre} onChange={e => setNewMeta(p => ({ ...p, trimestre: e.target.value as any }))} className="border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                        <option value="T1">T1</option><option value="T2">T2</option><option value="T3">T3</option>
                    </select>
                    <input value={newMeta.meta} onChange={e => setNewMeta(p => ({ ...p, meta: e.target.value }))} placeholder="Definir nueva meta trimestral..." className="flex-grow border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                    <button onClick={handleAddMeta} className="bg-slate-200 dark:bg-slate-600 px-3 py-2 rounded-md font-semibold text-sm">Agregar</button>
                </div>
                {/* Metas List */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(localStudentData.metasProgreso || []).map(meta => (
                         <div key={meta.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                            <input type="checkbox" checked={meta.cumplida} onChange={() => handleToggleMeta(meta.id)} className="h-5 w-5 rounded text-amber-500" />
                            <span className={`flex-grow text-sm ${meta.cumplida ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                                <strong>{meta.trimestre}:</strong> {meta.meta}
                            </span>
                            <button onClick={() => handleDeleteMeta(meta.id)} className="text-red-500 text-sm">🗑️</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
    
    const renderAlertasYArchivos = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">Alertas y Recordatorios</h4>
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 space-y-3">
                    <h5 className="font-medium">Agendar Nueva Alerta</h5>
                    <input type="text" value={newAlerta.titulo} onChange={e => setNewAlerta(p => ({...p, titulo: e.target.value}))} placeholder="Título de la alerta" className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700"/>
                    <input type="date" value={newAlerta.fecha} onChange={e => setNewAlerta(p => ({...p, fecha: e.target.value}))} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700"/>
                    <button onClick={handleAddAlerta} className="w-full text-sm bg-amber-500 text-white font-semibold px-3 py-1.5 rounded-md">Agendar</button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(localStudentData.alertas || []).map(alerta => (
                         <div key={alerta.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-600">
                            <input type="checkbox" checked={alerta.resuelta} onChange={() => handleToggleAlerta(alerta.id)} className="h-5 w-5 rounded text-amber-500" />
                            <span className={`flex-grow text-sm ${alerta.resuelta ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                                {alerta.titulo} ({new Date(alerta.fecha + 'T12:00:00').toLocaleDateString()})
                            </span>
                            <button onClick={() => handleDeleteAlerta(alerta.id)} className="text-red-500 text-sm">🗑️</button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="space-y-4">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">Archivos Adjuntos</h4>
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 space-y-3">
                    <h5 className="font-medium">Subir Nuevo Archivo</h5>
                    <input type="file" onChange={handleFileSelect} className="w-full text-sm"/>
                    <button onClick={handleUploadFile} disabled={!selectedFile || isUploading} className="w-full text-sm bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-md disabled:bg-slate-400">
                        {isUploading ? 'Subiendo...' : 'Subir'}
                    </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(localStudentData.archivos || []).map(file => (
                        <div key={file.id} className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-600">
                            <a href={file.url} download={file.nombre} className="text-sm text-blue-600 hover:underline truncate">{file.nombre}</a>
                            <button onClick={() => handleDeleteFile(file.id)} className="text-red-500 text-sm ml-2">🗑️</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderReuniones = () => (
        <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 space-y-3">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">Registrar Nueva Reunión</h4>
                <input value={newReunion.motivo} onChange={e => setNewReunion(p => ({ ...p, motivo: e.target.value }))} placeholder="Motivo de la reunión..." className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                <textarea value={newReunion.acuerdos} onChange={e => setNewReunion(p => ({ ...p, acuerdos: e.target.value }))} placeholder="Acuerdos..." rows={3} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                <input value={newReunion.asistentes} onChange={e => setNewReunion(p => ({ ...p, asistentes: e.target.value }))} placeholder="Asistentes (separados por coma)..." className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                <div className="text-right">
                    <button onClick={handleAddReunion} className="text-sm bg-amber-500 text-white font-semibold px-3 py-1 rounded-md">Guardar Reunión</button>
                </div>
            </div>
            <div className="space-y-3">
                {(localStudentData.reuniones || []).map(r => (
                    <div key={r.id} className="p-3 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-600">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{r.motivo}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300"><strong>Acuerdos:</strong> {r.acuerdos}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{new Date(r.fecha).toLocaleString('es-CL')} - Asistentes: {r.asistentes}</p>
                            </div>
                            <button onClick={() => handleDeleteReunion(r.id)} className="text-red-500 flex-shrink-0 ml-4">🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-slate-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Ficha de Seguimiento: {student.nombre}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{student.curso} - {student.dificultad}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExportFichaPDF} className="text-sm bg-red-100 text-red-700 font-semibold px-3 py-1.5 rounded-md hover:bg-red-200">Exportar PDF</button>
                        <button onClick={onClose} className="text-2xl text-slate-500 hover:text-slate-800">&times;</button>
                    </div>
                </div>
                <div className="border-b dark:border-slate-700 px-4">
                    <nav className="-mb-px flex space-x-6">
                        {(['intervenciones', 'seguimiento', 'reuniones', 'alertas'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`${activeTab === tab ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm capitalize`}
                            >
                                {tab === 'alertas' ? 'Alertas y Archivos' : tab === 'seguimiento' ? 'Seguimiento y Metas' : tab}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="p-6 overflow-y-auto flex-grow bg-slate-50 dark:bg-slate-900/50">
                    {activeTab === 'intervenciones' && renderIntervenciones()}
                    {activeTab === 'seguimiento' && renderSeguimiento()}
                    {activeTab === 'reuniones' && renderReuniones()}
                    {activeTab === 'alertas' && renderAlertasYArchivos()}
                </div>
                <div className="bg-slate-100 dark:bg-slate-700/50 px-6 py-4 rounded-b-xl flex justify-end gap-3 mt-auto">
                    <button onClick={onClose} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300">Cerrar</button>
                    <button onClick={handleSaveLocal} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">Guardar Cambios</button>
                </div>
            </div>
        </div>
    );
};

const AddStudentInclusionModal: React.FC<{
    student: User;
    onClose: () => void;
    onConfirm: (student: User, dificultad: DificultadAprendizaje) => void;
}> = ({ student, onClose, onConfirm }) => {
    const [selectedDificultad, setSelectedDificultad] = useState<DificultadAprendizaje>(DIFICULTADES_APRENDIZAJE[0]);

    const handleConfirm = () => {
        onConfirm(student, selectedDificultad);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Agregar a {student.nombreCompleto} al PIE</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Por favor, seleccione la dificultad de aprendizaje principal para este estudiante.</p>
                <div className="space-y-2">
                    <label htmlFor="dificultad" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Dificultad de Aprendizaje</label>
                    <select
                        id="dificultad"
                        value={selectedDificultad}
                        onChange={(e) => setSelectedDificultad(e.target.value as DificultadAprendizaje)}
                        className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                    >
                        {DIFICULTADES_APRENDIZAJE.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-300">Cancelar</button>
                    <button type="button" onClick={handleConfirm} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">Confirmar e Ingresar</button>
                </div>
            </div>
        </div>
    );
};


interface InclusionProps {
    currentUser: User;
}

const Inclusion: React.FC<InclusionProps> = ({ currentUser }) => {
    const [estudiantes, setEstudiantes] = useState<EstudianteInclusion[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<EstudianteInclusion | null>(null);
    const [studentToAdd, setStudentToAdd] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCurso, setFilterCurso] = useState('');
    const [filterDificultad, setFilterDificultad] = useState('');

    useEffect(() => {
        try {
            const data = localStorage.getItem(INCLUSION_KEY);
            if (data) setEstudiantes(JSON.parse(data));

            const usersData = localStorage.getItem(USERS_KEY);
            if (usersData) setAllUsers(JSON.parse(usersData));
        } catch (e) {
            console.error("Error al cargar datos de Inclusión desde localStorage", e);
        }
    }, []);

    const persistEstudiantes = useCallback((data: EstudianteInclusion[]) => {
        setEstudiantes(data);
        localStorage.setItem(INCLUSION_KEY, JSON.stringify(data));
    }, []);

    const handleAddStudentFromNomina = (user: User, dificultad: DificultadAprendizaje) => {
        if (estudiantes.some(e => e.nombre === user.nombreCompleto)) {
            alert("Este estudiante ya está en el programa de inclusión.");
            return;
        }

        const newStudent: EstudianteInclusion = {
            id: crypto.randomUUID(),
            nombre: user.nombreCompleto,
            curso: user.curso || '',
            dificultad: dificultad,
            intervenciones: [],
            archivos: [],
            reuniones: [],
        };

        persistEstudiantes([newStudent, ...estudiantes]);
        setSelectedStudent(newStudent);
    };

    const handleUpdateStudent = (updatedStudent: EstudianteInclusion) => {
        persistEstudiantes(estudiantes.map(s => s.id === updatedStudent.id ? updatedStudent : s));
        setSelectedStudent(updatedStudent); // Keep the modal open with updated data
    };

    const handleDeleteStudent = (id: string) => {
        if (window.confirm("¿Está seguro de que desea eliminar a este estudiante del programa de inclusión?")) {
            persistEstudiantes(estudiantes.filter(s => s.id !== id));
            if (selectedStudent?.id === id) {
                setSelectedStudent(null);
            }
        }
    };
    
    const handleExport = (format: 'xlsx' | 'pdf') => {
        const dataToExport = filteredEstudiantes.map(s => ({
            "Nombre": s.nombre,
            "Curso": s.curso,
            "Dificultad": s.dificultad,
            "N° Intervenciones": s.intervenciones.length,
            "Alertas Pendientes": (s.alertas || []).filter(a => !a.resuelta).length,
        }));

        if (format === 'xlsx') {
            const ws = utils.json_to_sheet(dataToExport);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Estudiantes_Inclusion");
            writeFile(wb, "Estudiantes_Inclusion.xlsx");
        } else {
            const doc = new jsPDF();
            doc.text("Listado de Estudiantes - Programa de Inclusión", 14, 15);
            autoTable(doc, {
                startY: 20,
                head: [Object.keys(dataToExport[0])],
                body: dataToExport.map(Object.values),
            });
            doc.save("Estudiantes_Inclusion.pdf");
        }
    };

    const estudiantesEnNomina = useMemo(() => {
        return allUsers.filter(u => u.profile === Profile.ESTUDIANTE && (currentUser.cursos?.includes(u.curso || '') || currentUser.profile === Profile.SUBDIRECCION))
            .filter(u => !estudiantes.some(e => e.nombre === u.nombreCompleto));
    }, [allUsers, estudiantes, currentUser]);

    const filteredEstudiantes = useMemo(() => {
        return estudiantes.filter(s =>
            (s.nombre.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (filterCurso === '' || s.curso === filterCurso) &&
            (filterDificultad === '' || s.dificultad === filterDificultad)
        ).sort((a,b) => a.nombre.localeCompare(b.nombre));
    }, [estudiantes, searchTerm, filterCurso, filterDificultad]);
    
    const profesores = useMemo(() => allUsers
        .filter(u => u.profile === Profile.PROFESORADO)
        .map(u => u.nombreCompleto)
        .sort(), [allUsers]);

    return (
        <div className="space-y-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Programa de Inclusión Escolar (PIE)</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main List */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                         <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Estudiantes en PIE</h2>
                         <div className="flex gap-2">
                            <button onClick={() => handleExport('xlsx')} className="text-sm bg-green-100 text-green-700 font-semibold py-1 px-3 rounded-lg">Excel</button>
                            <button onClick={() => handleExport('pdf')} className="text-sm bg-red-100 text-red-700 font-semibold py-1 px-3 rounded-lg">PDF</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <input type="text" placeholder="Buscar por nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                        <select value={filterCurso} onChange={e => setFilterCurso(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"><option value="">Todos los Cursos</option>{CURSOS.map(c => <option key={c}>{c}</option>)}</select>
                        <select value={filterDificultad} onChange={e => setFilterDificultad(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"><option value="">Todas las Dificultades</option>{DIFICULTADES_APRENDIZAJE.map(d => <option key={d}>{d}</option>)}</select>
                    </div>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {filteredEstudiantes.map(s => (
                            <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md border dark:border-slate-700 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200">{s.nombre}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{s.curso} - {s.dificultad}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                     <button onClick={() => setSelectedStudent(s)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">Ver Ficha</button>
                                     <button onClick={() => handleDeleteStudent(s.id)} title="Eliminar" className="text-red-600 hover:text-red-800 p-1 rounded-full text-lg">🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add from Nomina */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Agregar Estudiante desde Nómina</h2>
                    <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {estudiantesEnNomina.map(user => (
                            <li key={user.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 p-2 rounded">
                                <div>
                                    <p className="font-medium text-sm text-slate-800 dark:text-slate-200">{user.nombreCompleto}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.curso}</p>
                                </div>
                                <button onClick={() => setStudentToAdd(user)} className="text-2xl text-green-500 hover:text-green-700">+</button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            
            {studentToAdd && (
                <AddStudentInclusionModal 
                    student={studentToAdd} 
                    onClose={() => setStudentToAdd(null)} 
                    onConfirm={(student, dificultad) => {
                        handleAddStudentFromNomina(student, dificultad);
                        setStudentToAdd(null);
                    }}
                />
            )}

            {selectedStudent && (
                <FichaEstudianteModal
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    onSave={handleUpdateStudent}
                    profesores={profesores}
                />
            )}
        </div>
    );
};

export default Inclusion;
