import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
// ...existing code...
// ASUMO QUE ESTAS RUTAS SON CORRECTAS
import { AcompanamientoDocente as AcompanamientoDocenteType, User, Profile, CicloOPR, DetalleObservacionRow } from '../../types';
import { ASIGNATURAS, CURSOS, RUBRICA_ACOMPANAMIENTO_DOCENTE as defaultRubric } from '../../constants';
// import { GoogleGenAI } from "@google/genai"; // Descomentar si se usa
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logApiCall } from '../utils/apiLogger';

// --- INICIO: IMPORTACIÓN DE HELPERS DE FIREBASE ---
// RUTA CORREGIDA: Apuntando al archivo correcto 'acompanamientos.ts'
import {
    getAllAcompanamientos,
    createAcompanamiento,
    updateAcompanamiento,
    deleteAcompanamiento,
    getAllCiclosOPR,
    createCicloOPR,
    updateCicloOPR,
    uploadFile
} from '../../src/firebaseHelpers/acompanamientos';

// Importar el helper real de Firebase para obtener usuarios
import { getAllUsers as getAllUsersFromFirebase } from '../../src/firebaseHelpers/users';

const getAllUsers = async (): Promise<any[]> => {
    return await getAllUsersFromFirebase();
};
// --- FIN: IMPORTACIÓN DE HELPERS DE FIREBASE ---


// --- COMPONENTE REUTILIZABLE PARA SUBIR ARCHIVOS ---
interface FileUploadProps {
    label: string;
    onFileChange: (file: File) => void;
    uploadedUrl?: string;
    onRemove: () => void;
    isUploading: boolean;
    accept?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, onFileChange, uploadedUrl, onRemove, isUploading, accept = "video/mp4,video/quicktime" }) => {
    const inputId = `file-upload-${label.replace(/\s+/g, '-')}`;

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</label>
            {uploadedUrl ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700">
                    <a href={uploadedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 dark:text-green-300 hover:underline truncate">Ver video cargado</a>
                    <button type="button" onClick={onRemove} className="text-red-500 hover:text-red-700 ml-auto">✖</button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <input
                        id={inputId}
                        type="file"
                        onChange={(e) => e.target.files && onFileChange(e.target.files[0])}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                        disabled={isUploading}
                        accept={accept}
                    />
                    {isUploading && <div className="text-sm text-amber-600">Cargando...</div>}
                </div>
            )}
        </div>
    );
};


// --- COMPONENTE PARA EL FORMULARIO DEL CICLO OPR ---
interface CicloOPRFormProps {
    acompanamiento: AcompanamientoDocenteType;
    cicloToEdit: CicloOPR | null;
    onSave: (data: Omit<CicloOPR, 'id'> | CicloOPR) => Promise<void>;
    onCancel: () => void;
}

const CicloOPRForm: React.FC<CicloOPRFormProps> = ({ acompanamiento, cicloToEdit, onSave, onCancel }) => {
    // Estado para retroalimentación IA
    const [iaFeedback, setIaFeedback] = useState<string>('');
    const [iaLoading, setIaLoading] = useState<boolean>(false);

    // Función para solicitar retroalimentación IA
    const handleIAFeedback = async () => {
        setIaLoading(true);
        setIaFeedback('');
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            // Construir contexto con datos generales y rúbrica
            const context = {
                docente: acompanamiento.docente,
                curso: acompanamiento.curso,
                asignatura: acompanamiento.asignatura,
                fecha: acompanamiento.fecha,
                rubrica: defaultRubric
            };
            const prompt = `Genera una retroalimentación pedagógica para el docente considerando los datos generales y la rúbrica. Sé específico y constructivo.`;
            const result: any = await callGeminiAI({ prompt, context, module: 'AcompanamientoDocente' });
            setIaFeedback(result.data.response || 'No se obtuvo respuesta de la IA.');
        } catch (err) {
            setIaFeedback('Error al obtener retroalimentación IA.');
        }
        setIaLoading(false);
    };
    const initialCicloState: Omit<CicloOPR, 'id'> = useMemo(() => ({
        registroN: 1,
        nombreCiclo: '',
        fecha: new Date().toISOString().split('T')[0],
        horaInicio: '',
        horaTermino: '',
        videoObservacionUrl: '',
        detallesObservacion: [{ id: `row_${Date.now()}`, minuto: '0-5', accionesDocente: '', accionesEstudiantes: '', actividades: '' }],
        retroalimentacion: {
            exito: '', modelo: '', videoModeloUrl: '', foco: '', elementosIdentificar: '',
            brecha: { videoUrl: '', minutoInicial: '', minutoFinal: '', preguntas: '', indicadores: '' }
        },
        planificacion: { preparacion: '', objetivo: '', actividad: '', tiempo: '' },
        seguimiento: { fecha: '', curso: acompanamiento.curso, profesor: acompanamiento.docente, firma: '' },
        acompanamientoId: acompanamiento.id,
    }), [acompanamiento]);

    const [formData, setFormData] = useState<Omit<CicloOPR, 'id'> | CicloOPR>(cicloToEdit || initialCicloState);
    const [uploading, setUploading] = useState<Record<string, boolean>>({});

    const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const keys = name.split('.');
        
        if (keys.length > 1) {
            setFormData(prev => {
                const newState = JSON.parse(JSON.stringify(prev)); // Deep copy para evitar mutaciones
                let current: any = newState;
                for (let i = 0; i < keys.length - 1; i++) {
                    current = current[keys[i]];
                }
                current[keys[keys.length - 1]] = value;
                return newState;
            });
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleDetalleChange = (id: string, field: keyof DetalleObservacionRow, value: string) => {
        setFormData(prev => ({
            ...prev,
            detallesObservacion: prev.detallesObservacion.map(row => 
                row.id === id ? { ...row, [field]: value } : row
            )
        }));
    };

    const addDetalleRow = () => {
        const lastRow = formData.detallesObservacion[formData.detallesObservacion.length - 1];
        const lastMin = lastRow ? parseInt(lastRow.minuto.split('-')[1]) : 0;
        const newMinuto = `${lastMin + 1}-${lastMin + 5}`;

        setFormData(prev => ({
            ...prev,
            detallesObservacion: [...prev.detallesObservacion, { id: `row_${Date.now()}`, minuto: newMinuto, accionesDocente: '', accionesEstudiantes: '', actividades: '' }]
        }));
    };

    const removeDetalleRow = (id: string) => {
        setFormData(prev => ({
            ...prev,
            detallesObservacion: prev.detallesObservacion.filter(row => row.id !== id)
        }));
    };
    
    const handleFileUpload = async (fieldName: string, file: File) => {
        if (!acompanamiento.id) {
            alert("Por favor, guarde el acompañamiento general primero.");
            return;
        }

        setUploading(prev => ({ ...prev, [fieldName]: true }));
        try {
            const uniqueFileName = `${Date.now()}-${file.name}`;
            const path = `videos_opr/${acompanamiento.id}/${(formData as CicloOPR).id || 'temp'}/${uniqueFileName}`;
            const url = await uploadFile(file, path);

            const keys = fieldName.split('.');
            if (keys.length > 1) {
                 setFormData(prev => {
                    const newState = JSON.parse(JSON.stringify(prev));
                    let current: any = newState;
                    for (let i = 0; i < keys.length - 1; i++) {
                        current = current[keys[i]];
                    }
                    current[keys[keys.length - 1]] = url;
                    return newState;
                });
            } else {
                setFormData(prev => ({ ...prev, [fieldName]: url }));
            }

        } catch (error) {
            console.error("Error al subir archivo:", error);
            alert("No se pudo subir el archivo. Inténtelo de nuevo.");
        } finally {
            setUploading(prev => ({ ...prev, [fieldName]: false }));
        }
    };

    const handleFileRemove = (fieldName: string) => {
        const keys = fieldName.split('.');
        if (keys.length > 1) {
            setFormData(prev => {
                const newState = JSON.parse(JSON.stringify(prev));
                let current: any = newState;
                for (let i = 0; i < keys.length - 1; i++) {
                    current = current[keys[i]];
                }
                current[keys[keys.length - 1]] = '';
                return newState;
            });
        } else {
            setFormData(prev => ({ ...prev, [fieldName]: '' }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await onSave(formData);
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg animate-fade-in">
            {/* --- Retroalimentación IA en acompañamiento general --- */}
            <div className="mb-6 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/30">
                <h4 className="text-lg font-semibold mb-2 text-amber-700 dark:text-amber-300">Retroalimentación automática con IA</h4>
                <button type="button" onClick={handleIAFeedback} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md mb-2" disabled={iaLoading}>
                    {iaLoading ? 'Generando...' : 'Solicitar retroalimentación IA'}
                </button>
                {iaFeedback && (
                    <div className="mt-2 p-3 border rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-line">
                        {iaFeedback}
                    </div>
                )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{cicloToEdit ? 'Editando' : 'Nuevo'} Ciclo OPR</h3>
                
                <fieldset className="p-4 border rounded-lg dark:border-slate-700 space-y-4">
                    <legend className="text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">Datos Generales</legend>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input type="text" name="nombreCiclo" value={formData.nombreCiclo} onChange={handleFieldChange} placeholder="Nombre o N° del Ciclo" className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                        <input type="date" name="fecha" value={formData.fecha} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                        <input type="number" name="registroN" value={formData.registroN} onChange={handleFieldChange} placeholder="Registro de Observación N°" className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                        <input type="time" name="horaInicio" value={formData.horaInicio} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                        <input type="time" name="horaTermino" value={formData.horaTermino} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                    </div>
                    <FileUpload
                        label="Subir video de observación de clase"
                        onFileChange={(file) => handleFileUpload('videoObservacionUrl', file)}
                        uploadedUrl={formData.videoObservacionUrl}
                        onRemove={() => handleFileRemove('videoObservacionUrl')}
                        isUploading={uploading.videoObservacionUrl}
                    />
                </fieldset>

                <fieldset className="p-4 border rounded-lg dark:border-slate-700 space-y-4">
                    <legend className="text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">Registro Detallado de Observación</legend>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr>
                                    <th className="text-left p-2">Minuto</th>
                                    <th className="text-left p-2">Acciones del Docente</th>
                                    <th className="text-left p-2">Acciones de Estudiantes</th>
                                    <th className="text-left p-2">Actividades</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.detallesObservacion.map((row) => (
                                    <tr key={row.id}>
                                        <td><input type="text" value={row.minuto} onChange={(e) => handleDetalleChange(row.id, 'minuto', e.target.value)} className="w-24 border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/></td>
                                        <td><textarea value={row.accionesDocente} onChange={(e) => handleDetalleChange(row.id, 'accionesDocente', e.target.value)} rows={2} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/></td>
                                        <td><textarea value={row.accionesEstudiantes} onChange={(e) => handleDetalleChange(row.id, 'accionesEstudiantes', e.target.value)} rows={2} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/></td>
                                        <td><textarea value={row.actividades} onChange={(e) => handleDetalleChange(row.id, 'actividades', e.target.value)} rows={2} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/></td>
                                        <td>
                                            {formData.detallesObservacion.length > 1 && <button type="button" onClick={() => removeDetalleRow(row.id)} className="text-red-500 p-1">✖</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" onClick={addDetalleRow} className="text-sm bg-slate-200 dark:bg-slate-600 px-3 py-1 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">
                        + Agregar Fila
                    </button>
                </fieldset>

                 <fieldset className="p-4 border rounded-lg dark:border-slate-700 space-y-4">
                    <legend className="text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">Retroalimentación Docente</legend>
                    <textarea name="retroalimentacion.exito" value={formData.retroalimentacion.exito} onChange={handleFieldChange} placeholder="Éxito" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                    <textarea name="retroalimentacion.modelo" value={formData.retroalimentacion.modelo} onChange={handleFieldChange} placeholder="Modelo" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                    <FileUpload label="Subir video para 'Modelo'" onFileChange={(file) => handleFileUpload('retroalimentacion.videoModeloUrl', file)} uploadedUrl={formData.retroalimentacion.videoModeloUrl} onRemove={() => handleFileRemove('retroalimentacion.videoModeloUrl')} isUploading={uploading['retroalimentacion.videoModeloUrl']} />
                    <textarea name="retroalimentacion.foco" value={formData.retroalimentacion.foco} onChange={handleFieldChange} placeholder="Foco" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                    <textarea name="retroalimentacion.elementosIdentificar" value={formData.retroalimentacion.elementosIdentificar} onChange={handleFieldChange} placeholder="Elementos a Identificar" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                    
                    <div className="p-3 border rounded-md dark:border-slate-600 space-y-3">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">Brecha</p>
                        <FileUpload label="Subir video para 'Brecha'" onFileChange={(file) => handleFileUpload('retroalimentacion.brecha.videoUrl', file)} uploadedUrl={formData.retroalimentacion.brecha.videoUrl} onRemove={() => handleFileRemove('retroalimentacion.brecha.videoUrl')} isUploading={uploading['retroalimentacion.brecha.videoUrl']} />
                        <div className="flex gap-4">
                            <input type="text" name="retroalimentacion.brecha.minutoInicial" value={formData.retroalimentacion.brecha.minutoInicial} onChange={handleFieldChange} placeholder="Minuto inicial" className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                            <input type="text" name="retroalimentacion.brecha.minutoFinal" value={formData.retroalimentacion.brecha.minutoFinal} onChange={handleFieldChange} placeholder="Minuto final" className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                        </div>
                        <textarea name="retroalimentacion.brecha.preguntas" value={formData.retroalimentacion.brecha.preguntas} onChange={handleFieldChange} placeholder="Preguntas" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                        <textarea name="retroalimentacion.brecha.indicadores" value={formData.retroalimentacion.brecha.indicadores} onChange={handleFieldChange} placeholder="Indicadores" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                    </div>
                </fieldset>

                <fieldset className="p-4 border rounded-lg dark:border-slate-700 space-y-4">
                    <legend className="text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">Planificación de Práctica y Seguimiento</legend>
                    <textarea name="planificacion.preparacion" value={formData.planificacion.preparacion} onChange={handleFieldChange} placeholder="Preparación" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                    <textarea name="planificacion.objetivo" value={formData.planificacion.objetivo} onChange={handleFieldChange} placeholder="Objetivo" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                    <textarea name="planificacion.actividad" value={formData.planificacion.actividad} onChange={handleFieldChange} placeholder="Actividad" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                    <input type="text" name="planificacion.tiempo" value={formData.planificacion.tiempo} onChange={handleFieldChange} placeholder="Tiempo" className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                    
                    <div className="p-3 border rounded-md dark:border-slate-600 space-y-3">
                         <p className="font-semibold text-slate-700 dark:text-slate-300">Seguimiento</p>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input type="date" name="seguimiento.fecha" value={formData.seguimiento.fecha} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                            <input type="text" name="seguimiento.firma" value={formData.seguimiento.firma} onChange={handleFieldChange} placeholder="Firma (Nombre de quien registra)" className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                         </div>
                    </div>
                </fieldset>

                <div className="flex justify-end gap-4">
                    <button type="button" onClick={onCancel} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancelar</button>
                    <button type="submit" className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">Guardar Ciclo OPR</button>
                </div>
            </form>
        </div>
    );
};


// --- COMPONENTE PARA LA VISTA DEL CICLO OPR (LISTADO Y FORMULARIO) ---
interface CicloOPRViewProps {
    acompanamiento: AcompanamientoDocenteType;
}

const CicloOPRView: React.FC<CicloOPRViewProps> = ({ acompanamiento }) => {
    const [ciclos, setCiclos] = useState<CicloOPR[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingCiclo, setEditingCiclo] = useState<CicloOPR | null>(null);

    const fetchCiclos = useCallback(async () => {
        if (!acompanamiento.id) return;
        setLoading(true);
        try {
            const data = await getAllCiclosOPR(acompanamiento.id);
            setCiclos(data);
        } catch (e) {
            console.error(e);
            setError("No se pudieron cargar los ciclos OPR.");
        } finally {
            setLoading(false);
        }
    }, [acompanamiento.id]);

    useEffect(() => {
        fetchCiclos();
    }, [fetchCiclos]);

    const handleSave = async (data: Omit<CicloOPR, 'id'> | CicloOPR) => {
        if (!acompanamiento.id) return;
        try {
            if ('id' in data && data.id) {
                await updateCicloOPR(acompanamiento.id, data.id, data);
            } else {
                await createCicloOPR(acompanamiento.id, data);
            }
            await fetchCiclos();
            setView('list');
            setEditingCiclo(null);
        } catch (e) {
            console.error(e);
            setError("Error al guardar el ciclo OPR.");
        }
    };

    const handleCreateNew = () => {
        setEditingCiclo(null);
        setView('form');
    };

    const handleEdit = (ciclo: CicloOPR) => {
        setEditingCiclo(ciclo);
        setView('form');
    };

    if (loading) return <div>Cargando ciclos OPR...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    if (view === 'form') {
        return <CicloOPRForm 
                    acompanamiento={acompanamiento} 
                    cicloToEdit={editingCiclo} 
                    onSave={handleSave} 
                    onCancel={() => setView('list')} 
                />;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Historial de Ciclos OPR</h3>
                <button onClick={handleCreateNew} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">
                    + Nuevo Ciclo
                </button>
            </div>
            {ciclos.length === 0 ? (
                <p>No hay ciclos OPR registrados para este acompañamiento.</p>
            ) : (
                ciclos.map(ciclo => (
                    <div key={ciclo.id} className="p-4 border dark:border-slate-700 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-bold">{ciclo.nombreCiclo || `Ciclo del ${new Date(ciclo.fecha).toLocaleDateString()}`}</p>
                            <p className="text-sm text-slate-500">Registro N°: {ciclo.registroN}</p>
                        </div>
                        <button onClick={() => handleEdit(ciclo)} className="text-blue-600 hover:underline">Ver / Editar</button>
                    </div>
                ))
            )}
        </div>
    );
};


// --- COMPONENTE PRINCIPAL ---
const AcompanamientoDocente: React.FC = () => {
    const [acompanamientos, setAcompanamientos] = useState<AcompanamientoDocenteType[]>([]);
    const [profesores, setProfesores] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingProfesores, setLoadingProfesores] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isConsolidating, setIsConsolidating] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'opr'>('general');

    const rubrica = defaultRubric;

    const initialFormState: Omit<AcompanamientoDocenteType, 'id'> = useMemo(() => ({
        fecha: new Date().toISOString(),
        docente: '',
        curso: '',
        asignatura: '',
        bloques: '',
        rubricaResultados: {},
        observacionesGenerales: '',
        retroalimentacionConsolidada: '',
    }), []);

    const [formData, setFormData] = useState<Omit<AcompanamientoDocenteType, 'id' | 'ciclosOPR'>>(initialFormState);

    const fetchAcompanamientos = useCallback(async () => {
        setLoading(true);
        try {
            const acompanamientosFS = await getAllAcompanamientos();
            setAcompanamientos(acompanamientosFS);
        } catch (e) {
            setError("No se pudieron cargar los registros.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchProfesores = useCallback(async () => {
        setLoadingProfesores(true);
        try {
            const allUsers = await getAllUsers();
            const teacherNames = allUsers
                .filter((user: any) => user.profile === 'PROFESORADO')
                .map((user: any) => user.nombreCompleto)
                .sort();
            setProfesores(teacherNames);
        } catch (e) {
            setError("No se pudo cargar la lista de profesores.");
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
            rubricaResultados: { ...prev.rubricaResultados, [criterionName]: level },
        }));
    };
    
    const handleConsolidarFeedback = async () => { /* ... tu lógica existente ... */ };
    
    const handleGeneratePDF = async () => { /* ... tu lógica existente ... */ };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!formData.docente || !formData.curso || !formData.asignatura) {
            alert('Docente, curso y asignatura son campos obligatorios.');
            return;
        }
        try {
            if (editingId) {
                await updateAcompanamiento(editingId, formData);
                alert("¡Actualizado correctamente!");
            } else {
                const newRecord = await createAcompanamiento(formData);
                setEditingId(newRecord.id);
                setFormData(prev => ({...prev, id: newRecord.id} as any));
                alert("¡Guardado correctamente! Ahora puedes agregar Ciclos OPR.");
            }
            await fetchAcompanamientos();
        } catch (err) {
            setError("Error al guardar el registro.");
        }
    };

    const handleCreateNew = () => {
        setFormData(initialFormState);
        setEditingId(null);
        setView('form');
        setActiveTab('general');
        setError(null);
    };
    
    const handleEdit = (record: AcompanamientoDocenteType) => {
        setFormData(record);
        setEditingId(record.id);
        setView('form');
        setActiveTab('general');
        setError(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Está seguro de que desea eliminar este registro? Esto no eliminará los ciclos OPR asociados.")) {
            try {
                await deleteAcompanamiento(id);
                await fetchAcompanamientos();
            } catch (err) {
                setError("No se pudo eliminar el registro.");
            }
        }
    };

    const renderListView = () => (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Registros de Acompañamiento</h2>
                <button onClick={handleCreateNew} className="bg-amber-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-amber-600">
                    Crear Nuevo
                </button>
            </div>
             <div className="space-y-4">
                {loading && <p>Cargando...</p>}
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
    
    const renderFormView = () => {
        const currentAcompanamiento = editingId ? acompanamientos.find(a => a.id === editingId) : null;

        return (
         <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{editingId ? "Editando Acompañamiento" : "Nuevo Acompañamiento"}</h2>
                <button type="button" onClick={() => setView('list')} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold">&larr; Volver al listado</button>
             </div>

            <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('general')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'general' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                        Acompañamiento General
                    </button>
                    <button onClick={() => setActiveTab('opr')} disabled={!editingId} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'opr' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} disabled:text-slate-400 disabled:cursor-not-allowed`}>
                        Ciclo OPR {!editingId && <span className="text-xs">(Guarde primero)</span>}
                    </button>
                </nav>
            </div>

            {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</div>}

            {activeTab === 'general' && (
                <form onSubmit={handleSave} className="space-y-8">
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

                    <div className="flex justify-end gap-4 pt-4 border-t dark:border-slate-700">
                        <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">
                            {editingId ? 'Guardar Cambios' : 'Crear y Continuar'}
                        </button>
                    </div>
                </form>
            )}

            {activeTab === 'opr' && editingId && currentAcompanamiento && (
                <CicloOPRView acompanamiento={currentAcompanamiento} />
            )}
        </div>
    )};
    
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
