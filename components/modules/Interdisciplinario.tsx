import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { PlanificacionInterdisciplinaria, ActividadInterdisciplinaria, FechaClave, TareaInterdisciplinaria, EntregaTareaInterdisciplinaria, User, Profile } from '../../types';
import { ASIGNATURAS, CURSOS } from '../../constants';
import { GoogleGenAI } from "@google/genai";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const PLANIFICACIONES_INTER_KEY = 'planificacionesInterdisciplinarias';
const ENTREGAS_TAREAS_KEY = 'entregasTareasInterdisciplinarias';
const USERS_KEY = 'usuariosLiceo';


const ProjectTimeline: React.FC<{
    planificaciones: PlanificacionInterdisciplinaria[],
    onActivityUpdate: (planId: string, activity: ActividadInterdisciplinaria) => void
}> = ({ planificaciones, onActivityUpdate }) => {
    const [editingActivity, setEditingActivity] = useState<{planId: string, activity: ActividadInterdisciplinaria} | null>(null);

    const allItems = useMemo(() => {
        const items: any[] = [];
        planificaciones.forEach(p => {
            p.actividades.forEach(a => items.push({ ...a, planId: p.id, type: 'activity' }));
            p.fechasClave.forEach(f => items.push({
                id: f.id,
                planId: p.id,
                type: 'keyDate',
                nombre: f.nombre,
                fechaInicio: f.fecha,
                fechaFin: f.fecha,
                responsables: p.docentesResponsables,
                asignaturaPrincipal: 'Milestone'
            }));
        });
        return items.sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
    }, [planificaciones]);

    const getStatus = useCallback((item: any) => {
        if (item.type === 'keyDate') {
            return { text: 'Fecha Clave', color: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300' };
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(`${item.fechaInicio}T00:00:00`);
        const endDate = new Date(`${item.fechaFin}T00:00:00`);

        if (endDate < today) {
            return { text: 'Completado', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' };
        } else if (startDate <= today && endDate >= today) {
            return { text: 'En Progreso', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' };
        } else {
            return { text: 'Planificado', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' };
        }
    }, []);

    const AssigneeAvatar: React.FC<{ name: string }> = ({ name }) => {
        const initials = (name || '').split(' ').map(n => n[0]).join('').toUpperCase();
        
        const hashCode = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            return hash;
        };

        const colors = [
            'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300', 
            'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300', 
            'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300', 
            'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300', 
            'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300', 
            'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
        ];
        
        const colorIndex = Math.abs(hashCode(name)) % colors.length;

        return (
            <div className={`w-9 h-9 rounded-full ${colors[colorIndex]} flex items-center justify-center font-bold text-sm ring-2 ring-white dark:ring-slate-800`}>
                {initials.slice(0, 2)}
            </div>
        );
    };
    
    const ActivityModal: React.FC<{
        data: {planId: string, activity: ActividadInterdisciplinaria};
        onClose: () => void;
        onSave: (planId: string, activity: ActividadInterdisciplinaria) => void;
    }> = ({data, onClose, onSave}) => {
        const [formData, setFormData] = useState(data.activity);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setFormData({...formData, [e.target.name]: e.target.value});
        };

        const handleSave = () => {
            onSave(data.planId, formData);
            onClose();
        };

        return (
             <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg p-6 animate-fade-in-up">
                    <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">Editar Actividad</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Nombre</label>
                            <input name="nombre" value={formData.nombre} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Responsables</label>
                            <input name="responsables" value={formData.responsables} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Fecha Inicio</label>
                                <input type="date" name="fechaInicio" value={formData.fechaInicio} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                            </div>
                            <div className="flex-1">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Fecha Fin</label>
                                <input type="date" name="fechaFin" value={formData.fechaFin} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-md font-semibold">Cancelar</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-amber-500 text-white rounded-md font-semibold">Guardar</button>
                    </div>
                </div>
            </div>
        )
    };

    if (allItems.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Cronograma del Proyecto</h2>
                 <p className="text-slate-500 dark:text-slate-400 mb-6">Visualice el progreso y las dependencias del proyecto.</p>
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">No hay actividades para mostrar. Cree una planificación primero.</p>
            </div>
        );
    }
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-200">Cronograma del Proyecto</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 mb-6">Visualice el progreso y las dependencias del proyecto.</p>

            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tarea</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Fecha de Inicio</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Fecha de Fin</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Asignado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {allItems.map((item) => {
                            const status = getStatus(item);
                            const isClickable = item.type === 'activity';
                            return (
                                <tr 
                                    key={item.id} 
                                    className={`${isClickable ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer' : ''}`}
                                    onClick={() => isClickable && setEditingActivity({ planId: item.planId, activity: item })}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-slate-900 dark:text-slate-200">{item.nombre}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${status.color}`}>
                                            {status.text}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-base text-slate-600 dark:text-slate-400">{item.fechaInicio}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-base text-slate-600 dark:text-slate-400">{item.fechaFin}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <AssigneeAvatar name={item.responsables || 'N/A'} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {editingActivity && <ActivityModal data={editingActivity} onClose={() => setEditingActivity(null)} onSave={onActivityUpdate} />}
        </div>
    );
};

// --- Icons and Sub-components for the Form (Moved outside PlanificacionForm) ---
const PencilSquareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 21a6 6 0 006-5.197M15 12a4 4 0 110-8 4 4 0 010 8z" /></svg>;
const AcademicCapIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" /></svg>;
const ClipboardDocumentListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const DocumentTextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const FlagIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>;
const ChartBarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const CalendarDaysIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;

const FormCard: React.FC<{ icon: React.ReactNode, label: string, children: React.ReactNode, aiButton?: React.ReactNode }> = ({ icon, label, children, aiButton }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-medium">
                {icon}
                <span>{label}</span>
            </div>
            {aiButton}
        </div>
        {children}
    </div>
);


const PlanificacionForm: React.FC<{
    initialPlan: PlanificacionInterdisciplinaria | null;
    onSave: (plan: PlanificacionInterdisciplinaria) => void;
}> = ({ initialPlan, onSave }) => {
    const [formData, setFormData] = useState<PlanificacionInterdisciplinaria>(
        initialPlan || {
            id: '', nombreProyecto: '', descripcionProyecto: '', asignaturas: [], cursos: [], docentesResponsables: '', objetivos: '',
            actividades: [], fechasClave: [], indicadoresLogro: '', tareas: []
        }
    );
    const [newActivity, setNewActivity] = useState<Omit<ActividadInterdisciplinaria, 'id'>>({ nombre: '', fechaInicio: '', fechaFin: '', responsables: '', asignaturaPrincipal: '' });
    const [newFechaClave, setNewFechaClave] = useState<Omit<FechaClave, 'id'>>({ nombre: '', fecha: '' });
    const [newTarea, setNewTarea] = useState({ instrucciones: '', fechaEntrega: '', recursoUrl: '' });
    const [isGeneratingObjectives, setIsGeneratingObjectives] = useState(false);
    const [isGeneratingIndicators, setIsGeneratingIndicators] = useState(false);

    useEffect(() => {
        setFormData(initialPlan || {
            id: '', nombreProyecto: '', descripcionProyecto: '', asignaturas: [], cursos: [], docentesResponsables: '', objetivos: '',
            actividades: [], fechasClave: [], indicadoresLogro: '', tareas: []
        });
    }, [initialPlan]);

    const handleAIGeneration = async (targetField: 'objetivos' | 'indicadoresLogro') => {
        if (!formData.descripcionProyecto.trim()) {
            alert("Por favor, ingrese una descripción del proyecto para usar la IA.");
            return;
        }

        if (targetField === 'objetivos') setIsGeneratingObjectives(true);
        else setIsGeneratingIndicators(true);

        let prompt = '';
        if (targetField === 'objetivos') {
            prompt = `Basado en la siguiente descripción de un proyecto escolar interdisciplinario, genera 3 a 5 objetivos de aprendizaje claros, medibles y concisos. La respuesta debe ser solo el texto de los objetivos, formateado en una lista.
            Descripción del Proyecto: "${formData.descripcionProyecto}"`;
        } else {
            prompt = `Basado en la siguiente descripción y objetivos de un proyecto escolar interdisciplinario, genera una lista de 5 a 7 indicadores de logro concretos y observables que permitan evaluar el cumplimiento de los objetivos. La respuesta debe ser solo el texto de los indicadores, formateado en una lista.
            Descripción del Proyecto: "${formData.descripcionProyecto}"
            Objetivos (si existen): "${formData.objetivos || 'Aún no definidos, genéralos a partir de la descripción.'}"`;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: "AIzaSyBwOEsVIeAjIhoJ5PKko5DvmJrcQTwJwHE" });
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setFormData(prev => ({ ...prev, [targetField]: response.text.replace(/(\*\*|\*)/g, '') }));
        } catch (error) {
            console.error(`Error al generar ${targetField}`, error);
            alert(`Hubo un error al generar los ${targetField}. Inténtelo de nuevo.`);
        } finally {
            if (targetField === 'objetivos') setIsGeneratingObjectives(false);
            else setIsGeneratingIndicators(false);
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleMultiSelectToggle = (field: 'asignaturas' | 'cursos', value: string) => {
        setFormData(prev => {
            const currentValues = prev[field];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(item => item !== value)
                : [...currentValues, value];
            return { ...prev, [field]: newValues };
        });
    };

    const handleAddActivity = () => {
        if (!newActivity.nombre || !newActivity.fechaInicio || !newActivity.fechaFin) {
            alert("Nombre y fechas son obligatorios para la actividad.");
            return;
        }
        setFormData(prev => ({ ...prev, actividades: [...prev.actividades, { ...newActivity, id: crypto.randomUUID() }] }));
        setNewActivity({ nombre: '', fechaInicio: '', fechaFin: '', responsables: '', asignaturaPrincipal: '' });
    };
    const handleAddFechaClave = () => {
        if (!newFechaClave.nombre || !newFechaClave.fecha) return;
        setFormData(prev => ({ ...prev, fechasClave: [...prev.fechasClave, { ...newFechaClave, id: crypto.randomUUID() }] }));
        setNewFechaClave({ nombre: '', fecha: '' });
    };

    const handleAddTarea = () => {
        if (!newTarea.instrucciones || !newTarea.fechaEntrega) {
            alert("Instrucciones y fecha son obligatorios para la tarea.");
            return;
        }
        const tareaToAdd: TareaInterdisciplinaria = { id: crypto.randomUUID(), numero: (formData.tareas?.length || 0) + 1, ...newTarea };
        setFormData(prev => ({ ...prev, tareas: [...(prev.tareas || []), tareaToAdd] }));
        setNewTarea({ instrucciones: '', fechaEntrega: '', recursoUrl: '' });
    };
    
    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="text-center mb-12">
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-200">Proyecto Interdisciplinario en Liceo Industrial Recoleta</h1>
            </div>
            <div className="space-y-6">
                <FormCard icon={<PencilSquareIcon />} label="Nombre del Proyecto">
                    <input name="nombreProyecto" value={formData.nombreProyecto} onChange={handleChange} placeholder="Ingrese el nombre del proyecto..." className="w-full mt-1 bg-transparent text-lg font-semibold focus:ring-0 border-none p-0 dark:text-slate-200 placeholder:text-slate-400" />
                </FormCard>

                <FormCard icon={<UsersIcon />} label="Profesores">
                    <input name="docentesResponsables" value={formData.docentesResponsables} onChange={handleChange} placeholder="Ingrese nombres separados por comas..." className="w-full mt-1 bg-transparent focus:ring-0 border-none p-0 dark:text-slate-200 placeholder:text-slate-400" />
                </FormCard>
                
                <FormCard icon={<AcademicCapIcon />} label="Cursos">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-2">
                        {CURSOS.map(curso => (<button type="button" key={curso} onClick={() => handleMultiSelectToggle('cursos', curso)} className={`w-full text-center p-2 rounded-md text-sm transition-colors ${formData.cursos.includes(curso) ? 'bg-amber-500 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'}`}>{curso}</button>))}
                    </div>
                </FormCard>
                
                <FormCard icon={<ClipboardDocumentListIcon />} label="Asignaturas">
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                        {ASIGNATURAS.map(asignatura => (<button type="button" key={asignatura} onClick={() => handleMultiSelectToggle('asignaturas', asignatura)} className={`w-full text-left p-2 rounded-md text-sm transition-colors ${formData.asignaturas.includes(asignatura) ? 'bg-amber-500 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'}`}>{asignatura}</button>))}
                    </div>
                </FormCard>
                
                <FormCard icon={<DocumentTextIcon />} label="Descripción del Proyecto">
                    <textarea name="descripcionProyecto" value={formData.descripcionProyecto} onChange={handleChange} placeholder="Detalle aquí la metodología, el producto final esperado y el propósito del proyecto. Esta información es clave para la IA." className="w-full mt-1 bg-transparent focus:ring-0 border-none p-0 min-h-[100px] resize-none dark:text-slate-200 placeholder:text-slate-400"/>
                </FormCard>
                
                <FormCard icon={<FlagIcon />} label="Objetivos" aiButton={<button type="button" onClick={() => handleAIGeneration('objetivos')} disabled={!formData.descripcionProyecto.trim() || isGeneratingObjectives} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50" title="Generar con IA"><SparklesIcon /></button>}>
                    {isGeneratingObjectives ? <div className="p-4 text-center">Generando...</div> : <textarea name="objetivos" value={formData.objetivos} onChange={handleChange} placeholder="Liste los objetivos de aprendizaje..." className="w-full mt-1 bg-transparent focus:ring-0 border-none p-0 min-h-[80px] resize-none dark:text-slate-200 placeholder:text-slate-400"/>}
                </FormCard>

                <FormCard icon={<ChartBarIcon />} label="Indicadores de Éxito" aiButton={<button type="button" onClick={() => handleAIGeneration('indicadoresLogro')} disabled={!formData.descripcionProyecto.trim() || isGeneratingIndicators} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50" title="Generar con IA"><SparklesIcon /></button>}>
                   {isGeneratingIndicators ? <div className="p-4 text-center">Generando...</div> : <textarea name="indicadoresLogro" value={formData.indicadoresLogro} onChange={handleChange} placeholder="Liste los indicadores de logro o evaluación..." className="w-full mt-1 bg-transparent focus:ring-0 border-none p-0 min-h-[80px] resize-none dark:text-slate-200 placeholder:text-slate-400"/>}
                </FormCard>
                
                <FormCard icon={<CalendarDaysIcon />} label="Carta Gantt">
                     <div className="space-y-4 mt-2">
                         <div className="space-y-2 p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                            <h4 className="text-sm font-semibold">Actividades</h4>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                                <input value={newActivity.nombre} onChange={e => setNewActivity({...newActivity, nombre: e.target.value})} placeholder="Nombre" className="w-full p-1 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 md:col-span-2"/>
                                <input type="date" value={newActivity.fechaInicio} onChange={e => setNewActivity({...newActivity, fechaInicio: e.target.value})} className="w-full p-1 border rounded bg-white dark:bg-slate-700 dark:border-slate-600"/>
                                <input type="date" value={newActivity.fechaFin} onChange={e => setNewActivity({...newActivity, fechaFin: e.target.value})} className="w-full p-1 border rounded bg-white dark:bg-slate-700 dark:border-slate-600"/>
                                <button onClick={handleAddActivity} className="bg-slate-200 dark:bg-slate-600 p-2 rounded h-8 text-sm font-semibold">Agregar</button>
                            </div>
                            <ul className="text-xs">{formData.actividades.map(a => <li key={a.id}>{a.nombre}</li>)}</ul>
                        </div>
                        <div className="space-y-2 p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                            <h4 className="text-sm font-semibold">Fechas Clave (Hitos)</h4>
                             <div className="grid grid-cols-3 gap-2 items-end">
                                <input value={newFechaClave.nombre} onChange={e => setNewFechaClave({...newFechaClave, nombre: e.target.value})} placeholder="Hito" className="w-full p-1 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 col-span-1"/>
                                <input type="date" value={newFechaClave.fecha} onChange={e => setNewFechaClave({...newFechaClave, fecha: e.target.value})} className="w-full p-1 border rounded bg-white dark:bg-slate-700 dark:border-slate-600"/>
                                <button onClick={handleAddFechaClave} className="bg-slate-200 dark:bg-slate-600 p-2 rounded h-8 text-sm font-semibold">Agregar</button>
                            </div>
                            <ul className="text-xs">{formData.fechasClave.map(f => <li key={f.id}>{f.nombre} ({f.fecha})</li>)}</ul>
                        </div>
                         <div className="space-y-2 p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                            <h4 className="text-sm font-semibold">Tareas para Estudiantes</h4>
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                                <input value={newTarea.instrucciones} onChange={e => setNewTarea({...newTarea, instrucciones: e.target.value})} placeholder="Instrucciones" className="w-full p-1 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 md:col-span-2"/>
                                <input type="date" value={newTarea.fechaEntrega} onChange={e => setNewTarea({...newTarea, fechaEntrega: e.target.value})} className="w-full p-1 border rounded bg-white dark:bg-slate-700 dark:border-slate-600"/>
                                <button type="button" onClick={handleAddTarea} className="bg-slate-200 dark:bg-slate-600 p-2 rounded h-8 text-sm font-semibold">Agregar</button>
                            </div>
                            <ul className="text-xs">{ (formData.tareas || []).map(t => <li key={t.id}>{t.numero}. {t.instrucciones}</li>)}</ul>
                        </div>
                    </div>
                </FormCard>
                <div className="flex justify-end pt-6">
                    <button onClick={() => onSave(formData)} className="px-8 py-3 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">
                       {initialPlan ? 'Guardar Cambios' : 'Guardar Proyecto'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Interdisciplinario: React.FC = () => {
    const [planificaciones, setPlanificaciones] = useState<PlanificacionInterdisciplinaria[]>([]);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingPlan, setEditingPlan] = useState<PlanificacionInterdisciplinaria | null>(null);
    const [isExportingId, setIsExportingId] = useState<string | null>(null);
    const [viewingSubmissionsForPlan, setViewingSubmissionsForPlan] = useState<PlanificacionInterdisciplinaria | null>(null);


    useEffect(() => {
        try {
            const data = localStorage.getItem(PLANIFICACIONES_INTER_KEY);
            if (data) setPlanificaciones(JSON.parse(data));
        } catch (e) {
            console.error("Error al cargar planificaciones interdisciplinarias", e);
        }
    }, []);

    const persistPlanificaciones = (data: PlanificacionInterdisciplinaria[]) => {
        setPlanificaciones(data);
        localStorage.setItem(PLANIFICACIONES_INTER_KEY, JSON.stringify(data));
    };
    
    const handleActivityUpdate = useCallback((planId: string, activity: ActividadInterdisciplinaria) => {
        const updated = planificaciones.map(p => {
            if (p.id === planId) {
                return {
                    ...p,
                    actividades: p.actividades.map(a => a.id === activity.id ? activity : a)
                }
            }
            return p;
        });
        persistPlanificaciones(updated);
    }, [planificaciones]);

    const handleSave = (plan: PlanificacionInterdisciplinaria) => {
        if (editingPlan) {
            persistPlanificaciones(planificaciones.map(p => p.id === editingPlan.id ? plan : p));
        } else {
            persistPlanificaciones([{ ...plan, id: crypto.randomUUID() }, ...planificaciones]);
        }
        setView('list');
        setEditingPlan(null);
    };

    const handleEdit = (plan: PlanificacionInterdisciplinaria) => {
        setEditingPlan(plan);
        setView('form');
    };

    const handleDelete = (id: string) => {
        if (window.confirm("¿Está seguro de eliminar esta planificación?")) {
            persistPlanificaciones(planificaciones.filter(p => p.id !== id));
        }
    };
    
    const handleCreateNew = () => {
        setEditingPlan(null);
        setView('form');
    };

    const handleExportProjectPDF = async (plan: PlanificacionInterdisciplinaria) => {
        setIsExportingId(plan.id);
    
        const doc = new jsPDF('p', 'mm', 'a4');
        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const contentWidth = pageWidth - margin * 2;
        let y = margin;
    
        const FONT_TITLE = 22;
        const FONT_HEADER = 14;
        const FONT_BODY = 11;
    
        const addPageHeader = () => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text('Proyecto Interdisciplinario', margin, 12);
            doc.text('Liceo Industrial de Recoleta', pageWidth - margin, 12, { align: 'right' });
            doc.setDrawColor(220);
            doc.line(margin, 15, pageWidth - margin, 15);
        };
        
        const checkPageBreak = (neededHeight: number) => {
            if (y + neededHeight > pageHeight - margin) {
                doc.addPage();
                addPageHeader();
                y = margin + 15;
            }
        };
    
        const addSection = (title: string, content: string | string[] | undefined) => {
            if (!content || (Array.isArray(content) && content.length === 0) || (typeof content === 'string' && !content.trim())) return;
            
            const titleHeight = 10;
            doc.setFontSize(FONT_BODY);
            const contentString = Array.isArray(content) ? content.join(', ') : String(content);
            const contentLines = doc.splitTextToSize(contentString, contentWidth);
            const contentHeight = contentLines.length * (FONT_BODY * 0.35 * 1.15);
            
            checkPageBreak(titleHeight + contentHeight + 12);
    
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FONT_HEADER);
            doc.setTextColor(40);
            doc.text(title, margin, y);
            y += 6;
    
            doc.setDrawColor(200);
            doc.line(margin, y, margin + 30, y);
            y += 8;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(FONT_BODY);
            doc.setTextColor(80);
            doc.text(contentLines, margin, y);
            y += contentHeight + 12;
        };
    
        addPageHeader();
        y = margin + 20;
    
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FONT_TITLE);
        doc.setTextColor(0);
        const titleLines = doc.splitTextToSize(plan.nombreProyecto, contentWidth);
        doc.text(titleLines, margin, y);
        y += titleLines.length * (FONT_TITLE * 0.4) + 10;
    
        autoTable(doc, {
            startY: y,
            body: [
                [{ content: 'Docentes Responsables:', styles: { fontStyle: 'bold' } }, plan.docentesResponsables],
                [{ content: 'Cursos Involucrados:', styles: { fontStyle: 'bold' } }, plan.cursos.join(', ')],
                [{ content: 'Asignaturas:', styles: { fontStyle: 'bold' } }, plan.asignaturas.join(', ')],
            ],
            theme: 'grid',
            styles: { fontSize: FONT_BODY, cellPadding: 3, lineColor: [220, 220, 220] },
            columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } },
        });
        y = (doc as any).lastAutoTable.finalY + 15;
    
        addSection('Descripción del Proyecto', plan.descripcionProyecto);
        addSection('Objetivos de Aprendizaje', plan.objetivos);
        addSection('Indicadores de Logro', plan.indicadoresLogro);
    
        if (plan.tareas && plan.tareas.length > 0) {
            const tasksBody = plan.tareas.map(t => [t.numero.toString(), t.instrucciones, t.fechaEntrega]);
            const tasksTableHeight = (tasksBody.length + 1) * 10 + 15;
            checkPageBreak(tasksTableHeight + 15);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FONT_HEADER);
            doc.setTextColor(40);
            doc.text("Tareas para Estudiantes", margin, y);
            y += 10;
            
            autoTable(doc, {
                startY: y,
                head: [['#', 'Instrucciones', 'Fecha de Entrega']],
                body: tasksBody,
                theme: 'striped',
                headStyles: { fillColor: [52, 73, 94] }
            });
            y = (doc as any).lastAutoTable.finalY + 15;
        }
    
        const timelineElement = document.getElementById('gantt-container-vertical');
        if (timelineElement) {
            try {
                const canvas = await html2canvas(timelineElement, { scale: 2, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                
                doc.addPage();
                addPageHeader();
                y = margin + 15;
    
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(FONT_HEADER);
                doc.setTextColor(40);
                doc.text('Cronograma del Proyecto', margin, y);
                y += 10;
                
                const imgProps = doc.getImageProperties(imgData);
                const imgWidth = contentWidth;
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                
                doc.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight);
            } catch (error) {
                console.error("Error generating timeline image:", error);
            }
        }
        
        const pageCount = (doc.internal as any).pages.length - 1;
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        }
    
        doc.save(`Proyecto_${plan.nombreProyecto.replace(/\s/g, '_')}.pdf`);
        setIsExportingId(null);
    };
    
    const SubmissionsViewer: React.FC<{
        plan: PlanificacionInterdisciplinaria;
        onBack: () => void;
    }> = ({ plan, onBack }) => {
        const [allUsers, setAllUsers] = useState<User[]>([]);
        const [entregas, setEntregas] = useState<EntregaTareaInterdisciplinaria[]>([]);
        const [selectedTask, setSelectedTask] = useState<TareaInterdisciplinaria | null>(plan.tareas?.[0] || null);

        useEffect(() => {
            try {
                const usersData = localStorage.getItem(USERS_KEY);
                if (usersData) setAllUsers(JSON.parse(usersData));

                const entregasData = localStorage.getItem(ENTREGAS_TAREAS_KEY);
                if (entregasData) setEntregas(JSON.parse(entregasData));
            } catch (e) { console.error(e) }
        }, []);

        const studentsInProject = useMemo(() => {
            return allUsers
                .filter(u => u.profile === Profile.ESTUDIANTE && plan.cursos.includes(u.curso || ''))
                .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
        }, [allUsers, plan.cursos]);

        const handleSaveFeedback = (entregaId: string, feedback: string) => {
            const updatedEntregas = entregas.map(e => e.id === entregaId ? { ...e, feedbackProfesor: feedback, fechaFeedback: new Date().toISOString() } : e);
            setEntregas(updatedEntregas);
            localStorage.setItem(ENTREGAS_TAREAS_KEY, JSON.stringify(updatedEntregas));
        };

        if (!selectedTask) return <div className="text-center p-8">Este proyecto no tiene tareas asignadas.</div>

        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">Entregas de Tareas</h2>
                    <button onClick={onBack} className="font-semibold">&larr; Volver</button>
                </div>
                <select value={selectedTask.id} onChange={e => setSelectedTask(plan.tareas?.find(t => t.id === e.target.value) || null)} className="mb-4 p-2 border rounded">
                    {plan.tareas?.map(t => <option key={t.id} value={t.id}>Tarea {t.numero}: {t.instrucciones}</option>)}
                </select>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {studentsInProject.map(student => {
                        const entrega = entregas.find(e => e.planificacionId === plan.id && e.tareaId === selectedTask.id && e.estudianteId === student.id);
                        return (
                            <div key={student.id} className="p-4 border rounded-lg bg-slate-50">
                                <p className="font-bold">{student.nombreCompleto} - {entrega?.completada ? <span className="text-green-600">Entregado</span> : <span className="text-red-600">Pendiente</span>}</p>
                                {entrega && (
                                    <div className="text-sm mt-2 space-y-2">
                                        {entrega.observacionesEstudiante && <p><strong>Comentario:</strong> {entrega.observacionesEstudiante}</p>}
                                        {entrega.enlaceUrl && <p><strong>Enlace:</strong> <a href={entrega.enlaceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{entrega.enlaceUrl}</a></p>}
                                        {entrega.archivoAdjunto && <p><strong>Archivo:</strong> <a href={entrega.archivoAdjunto.url} download={entrega.archivoAdjunto.nombre} className="text-blue-500 hover:underline">{entrega.archivoAdjunto.nombre}</a></p>}
                                        <textarea 
                                            placeholder="Escribir retroalimentación..." 
                                            defaultValue={entrega.feedbackProfesor || ''}
                                            onBlur={(e) => handleSaveFeedback(entrega.id, e.target.value)}
                                            rows={2}
                                            className="w-full mt-2 p-1 border rounded"
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    if (viewingSubmissionsForPlan) {
        return <SubmissionsViewer plan={viewingSubmissionsForPlan} onBack={() => setViewingSubmissionsForPlan(null)} />;
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {view === 'list' ? (
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Proyectos Interdisciplinarios</h1>
                        <button onClick={handleCreateNew} className="bg-slate-800 text-white font-bold py-2 px-5 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">Crear Nuevo</button>
                    </div>
                     <div className="space-y-4">
                        {planificaciones.map(plan => (
                            <div key={plan.id} className="p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">{plan.nombreProyecto}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Cursos: {plan.cursos.join(', ')}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button onClick={() => setViewingSubmissionsForPlan(plan)} className="text-green-600 hover:text-green-800 dark:text-green-400 font-semibold text-sm">Ver Entregas</button>
                                        <button 
                                            onClick={() => handleExportProjectPDF(plan)} 
                                            disabled={isExportingId === plan.id}
                                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold text-sm disabled:opacity-50"
                                        >
                                            {isExportingId === plan.id ? 'Exportando...' : 'Exportar PDF'}
                                        </button>
                                        <button onClick={() => handleEdit(plan)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-sm">Editar</button>
                                        <button onClick={() => handleDelete(plan.id)} title="Eliminar" className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40">🗑️</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : <PlanificacionForm initialPlan={editingPlan} onSave={handleSave} />}
            
            {planificaciones.length > 0 && <div id="gantt-container-vertical"><ProjectTimeline planificaciones={planificaciones} onActivityUpdate={handleActivityUpdate} /></div>}
        </div>
    );
};

export default Interdisciplinario;