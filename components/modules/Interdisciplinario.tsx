import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { 
    PlanificacionInterdisciplinaria, 
    ActividadInterdisciplinaria, 
    FechaClave, 
    TareaInterdisciplinaria, 
    EntregaTareaInterdisciplinaria, 
    User, 
    Profile 
} from '../../types';
import { ASIGNATURAS, CURSOS } from '../../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import {
    subscribeToPlanificaciones,
    createPlanificacion,
    updatePlanificacion,
    deletePlanificacion,
    subscribeToEntregas,
    saveFeedbackEntrega,
    subscribeToAllUsers
} from '../../src/firebaseHelpers/interdisciplinarioHelper';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    Calendar,
    Users,
    BookOpen,
    FileText,
    Target,
    BarChart3,
    Clock,
    Plus,
    Edit,
    Trash2,
    Download,
    ChevronLeft,
    Sparkles,
    GraduationCap,
    Brain,
    CheckCircle,
    AlertCircle,
    User,
    Building2
} from 'lucide-react';

// Taxonomía de Bloom para habilidades
const BLOOM_TAXONOMY = {
    'Recordar': ['Enumerar', 'Definir', 'Identificar', 'Nombrar', 'Reconocer', 'Reproducir'],
    'Comprender': ['Explicar', 'Interpretar', 'Resumir', 'Parafrasear', 'Ejemplificar', 'Clasificar'],
    'Aplicar': ['Ejecutar', 'Implementar', 'Usar', 'Demostrar', 'Operar', 'Programar'],
    'Analizar': ['Diferenciar', 'Organizar', 'Atribuir', 'Comparar', 'Deconstruir', 'Delinear'],
    'Evaluar': ['Comprobar', 'Criticar', 'Revisar', 'Formular hipótesis', 'Experimentar', 'Juzgar'],
    'Crear': ['Generar', 'Planificar', 'Producir', 'Diseñar', 'Construir', 'Idear']
};

// Interfaz extendida para contenidos por asignatura
interface ContenidoAsignatura {
    asignatura: string;
    contenidos: string;
    habilidades: string[];
}

interface PlanificacionExtendida extends Omit<PlanificacionInterdisciplinaria, 'docentesResponsables'> {
    docentesResponsables: string[];
    contenidosPorAsignatura: ContenidoAsignatura[];
}

// Componente para el cronograma del proyecto
const ProjectTimeline: React.FC<{
    planificaciones: PlanificacionExtendida[],
    onActivityUpdate: (planId: string, activity: ActividadInterdisciplinaria) => void
}> = ({ planificaciones, onActivityUpdate }) => {
    const [editingActivity, setEditingActivity] = useState<{planId: string, activity: ActividadInterdisciplinaria} | null>(null);

    const allItems = useMemo(() => {
        const items: any[] = [];
        planificaciones.forEach(p => {
            (p.actividades || []).forEach(a => items.push({ ...a, planId: p.id, type: 'activity' }));
            (p.fechasClave || []).forEach(f => items.push({
                id: f.id,
                planId: p.id,
                type: 'keyDate',
                nombre: f.nombre,
                fechaInicio: f.fecha,
                fechaFin: f.fecha,
                responsables: p.docentesResponsables.join(', '),
                asignaturaPrincipal: 'Milestone'
            }));
        });
        return items.sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
    }, [planificaciones]);

    const getStatus = useCallback((item: any) => {
        if (item.type === 'keyDate') {
            return { text: 'Fecha Clave', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' };
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
            return { text: 'Planificado', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' };
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
            'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300', 
            'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', 
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300', 
            'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300', 
            'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300', 
            'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
            'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
        ];
        
        const colorIndex = Math.abs(hashCode(name)) % colors.length;

        return (
            <div className={`w-10 h-10 rounded-full ${colors[colorIndex]} flex items-center justify-center font-semibold text-sm ring-2 ring-white dark:ring-slate-800 shadow-sm`}>
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-8 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                            <Edit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Editar Actividad</h3>
                    </div>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                <FileText className="w-4 h-4" />
                                Nombre de la Actividad
                            </label>
                            <input 
                                name="nombre" 
                                value={formData.nombre} 
                                onChange={handleChange} 
                                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="Ingrese el nombre de la actividad..."
                            />
                        </div>
                        
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                <Users className="w-4 h-4" />
                                Responsables
                            </label>
                            <input 
                                name="responsables" 
                                value={formData.responsables} 
                                onChange={handleChange} 
                                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="Responsables de la actividad..."
                            />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    <Calendar className="w-4 h-4" />
                                    Fecha de Inicio
                                </label>
                                <input 
                                    type="date" 
                                    name="fechaInicio" 
                                    value={formData.fechaInicio} 
                                    onChange={handleChange} 
                                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    <Calendar className="w-4 h-4" />
                                    Fecha de Fin
                                </label>
                                <input 
                                    type="date" 
                                    name="fechaFin" 
                                    value={formData.fechaFin} 
                                    onChange={handleChange} 
                                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end gap-4 mt-8">
                        <button 
                            onClick={onClose} 
                            className="px-6 py-3 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
                        >
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (allItems.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl">
                        <Clock className="w-8 h-8 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Cronograma del Proyecto</h2>
                        <p className="text-slate-600 dark:text-slate-400">Visualice el progreso y las dependencias del proyecto</p>
                    </div>
                </div>
                <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 text-lg">No hay actividades para mostrar</p>
                    <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">Cree una planificación primero para ver el cronograma</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                    <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-200">Cronograma del Proyecto</h2>
                    <p className="text-slate-600 dark:text-slate-400">Visualice el progreso y las dependencias del proyecto</p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tarea</th>
                            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Inicio</th>
                            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Fin</th>
                            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Asignado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {allItems.map((item) => {
                            const status = getStatus(item);
                            const isClickable = item.type === 'activity';
                            return (
                                <tr 
                                    key={item.id} 
                                    className={`${isClickable ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors' : ''}`}
                                    onClick={() => isClickable && setEditingActivity({ planId: item.planId, activity: item })}
                                >
                                    <td className="px-6 py-4 text-base font-semibold text-slate-900 dark:text-slate-200">{item.nombre}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${status.color}`}>
                                            {status.text}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-base text-slate-600 dark:text-slate-400">{item.fechaInicio}</td>
                                    <td className="px-6 py-4 text-base text-slate-600 dark:text-slate-400">{item.fechaFin}</td>
                                    <td className="px-6 py-4">
                                        <AssigneeAvatar name={item.responsables || 'Sin asignar'} />
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

// Componente para tarjetas de formulario
const FormCard: React.FC<{ 
    icon: React.ReactNode, 
    label: string, 
    children: React.ReactNode, 
    aiButton?: React.ReactNode,
    className?: string 
}> = ({ icon, label, children, aiButton, className = "" }) => (
    <div className={`bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 ${className}`}>
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    {icon}
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{label}</span>
            </div>
            {aiButton}
        </div>
        {children}
    </div>
);

// Componente principal del formulario
const PlanificacionForm: React.FC<{
    initialPlan: PlanificacionExtendida | null;
    onSave: (plan: Omit<PlanificacionExtendida, 'id'> | PlanificacionExtendida) => void;
    onCancel: () => void;
    availableTeachers: User[];
}> = ({ initialPlan, onSave, onCancel, availableTeachers }) => {
    const [formData, setFormData] = useState<PlanificacionExtendida>(
        initialPlan || {
            id: '',
            nombreProyecto: '',
            descripcionProyecto: '',
            asignaturas: [],
            cursos: [],
            docentesResponsables: [],
            contenidosPorAsignatura: [],
            objetivos: '',
            actividades: [],
            fechasClave: [],
            indicadoresLogro: '',
            tareas: []
        }
    );

    const [newActivity, setNewActivity] = useState<Omit<ActividadInterdisciplinaria, 'id'>>({ 
        nombre: '', 
        fechaInicio: '', 
        fechaFin: '', 
        responsables: '', 
        asignaturaPrincipal: '' 
    });
    const [newFechaClave, setNewFechaClave] = useState<Omit<FechaClave, 'id'>>({ nombre: '', fecha: '' });
    const [newTarea, setNewTarea] = useState({ instrucciones: '', fechaEntrega: '', recursoUrl: '' });
    
    const [isGeneratingObjectives, setIsGeneratingObjectives] = useState(false);
    const [isGeneratingIndicators, setIsGeneratingIndicators] = useState(false);
    const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);

    useEffect(() => {
        setFormData(initialPlan || {
            id: '',
            nombreProyecto: '',
            descripcionProyecto: '',
            asignaturas: [],
            cursos: [],
            docentesResponsables: [],
            contenidosPorAsignatura: [],
            objetivos: '',
            actividades: [],
            fechasClave: [],
            indicadoresLogro: '',
            tareas: []
        });
    }, [initialPlan]);

    const handleAIGeneration = async (targetField: 'objetivos' | 'indicadoresLogro') => {
        if (!formData.descripcionProyecto.trim()) {
            alert("Por favor, ingrese una descripción del proyecto para usar la IA.");
            return;
        }

        if (targetField === 'objetivos') setIsGeneratingObjectives(true);
        else setIsGeneratingIndicators(true);

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            alert("La API Key de Gemini no está configurada.");
            setIsGeneratingObjectives(false);
            setIsGeneratingIndicators(false);
            return;
        }

        let prompt = '';
        if (targetField === 'objetivos') {
            prompt = `Basado en la siguiente descripción de un proyecto escolar interdisciplinario, genera 3 a 5 objetivos de aprendizaje claros, medibles y concisos. La respuesta debe ser solo el texto de los objetivos, formateado en una lista con guiones.
            
            Descripción del Proyecto: "${formData.descripcionProyecto}"
            Asignaturas involucradas: "${formData.asignaturas.join(', ')}"`;
        } else {
            prompt = `Basado en la siguiente descripción y objetivos de un proyecto escolar interdisciplinario, genera una lista de 5 a 7 indicadores de logro concretos y observables que permitan evaluar el cumplimiento de los objetivos. La respuesta debe ser solo el texto de los indicadores, formateado en una lista con guiones.
            
            Descripción del Proyecto: "${formData.descripcionProyecto}"
            Objetivos: "${formData.objetivos || 'Aún no definidos, genéralos a partir de la descripción.'}"
            Asignaturas involucradas: "${formData.asignaturas.join(', ')}"`;
        }

        try {
            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            setFormData(prev => ({ ...prev, [targetField]: text.replace(/(\*\*|\*)/g, '') }));
        } catch (error) {
            console.error(`Error al generar ${targetField}`, error);
            alert(`Hubo un error al generar los ${targetField}. Inténtelo de nuevo.`);
        } finally {
            if (targetField === 'objetivos') setIsGeneratingObjectives(false);
            else setIsGeneratingIndicators(false);
        }
    };

    const handleAIGenerateStructure = async () => {
        if (!formData.descripcionProyecto.trim()) {
            alert("Por favor, ingrese una descripción del proyecto para usar la IA.");
            return;
        }
        setIsGeneratingStructure(true);
        
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            alert("La API Key de Gemini no está configurada.");
            setIsGeneratingStructure(false);
            return;
        }

        const prompt = `
            Basado en la descripción de un proyecto escolar, genera una estructura completa. La respuesta DEBE ser un único objeto JSON válido sin texto adicional ni bloques \`\`\`json.
            
            Descripción del proyecto: "${formData.descripcionProyecto}"
            Docentes responsables: "${formData.docentesResponsables.join(', ')}"
            Asignaturas involucradas: "${formData.asignaturas.join(', ')}"

            El JSON debe tener tres claves: 'actividades', 'fechasClave', y 'tareas'.
            1. 'actividades': Un array de 3 a 5 objetos. Cada objeto debe tener: "nombre" (string), "fechaInicio" (string "YYYY-MM-DD"), "fechaFin" (string "YYYY-MM-DD"), y "responsables" (string, uno de los docentes).
            2. 'fechasClave': Un array de 2 a 3 objetos (hitos importantes). Cada objeto debe tener: "nombre" (string) y "fecha" (string "YYYY-MM-DD").
            3. 'tareas': Un array de 2 a 3 objetos (tareas para estudiantes). Cada objeto debe tener: "instrucciones" (string detallado) y "fechaEntrega" (string "YYYY-MM-DD").
            Las fechas deben ser lógicas y secuenciales. Asume que el proyecto comienza hoy.
        `;
        
        try {
            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
            const structure = JSON.parse(cleanedText);

            setFormData(prev => ({
                ...prev,
                actividades: structure.actividades?.map((a: any) => ({ ...a, id: crypto.randomUUID() })) || prev.actividades,
                fechasClave: structure.fechasClave?.map((f: any) => ({ ...f, id: crypto.randomUUID() })) || prev.fechasClave,
                tareas: structure.tareas?.map((t: any, i: number) => ({ ...t, id: crypto.randomUUID(), numero: i + 1 })) || prev.tareas,
            }));

        } catch (error) {
            console.error('Error al generar la estructura del proyecto:', error);
            alert('No se pudo generar la estructura del proyecto. Intente de nuevo.');
        } finally {
            setIsGeneratingStructure(false);
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleAsignaturaToggle = (asignatura: string) => {
        setFormData(prev => {
            const currentAsignaturas = prev.asignaturas;
            const newAsignaturas = currentAsignaturas.includes(asignatura)
                ? currentAsignaturas.filter(item => item !== asignatura)
                : [...currentAsignaturas, asignatura];
            
            // Actualizar contenidos por asignatura
            let newContenidos = prev.contenidosPorAsignatura;
            if (newAsignaturas.includes(asignatura) && !currentAsignaturas.includes(asignatura)) {
                // Agregar nueva asignatura
                newContenidos = [...newContenidos, { asignatura, contenidos: '', habilidades: [] }];
            } else if (!newAsignaturas.includes(asignatura) && currentAsignaturas.includes(asignatura)) {
                // Remover asignatura
                newContenidos = newContenidos.filter(c => c.asignatura !== asignatura);
            }
            
            return { 
                ...prev, 
                asignaturas: newAsignaturas,
                contenidosPorAsignatura: newContenidos
            };
        });
    };

    const handleCursoToggle = (curso: string) => {
        setFormData(prev => {
            const currentCursos = prev.cursos;
            const newCursos = currentCursos.includes(curso)
                ? currentCursos.filter(item => item !== curso)
                : [...currentCursos, curso];
            return { ...prev, cursos: newCursos };
        });
    };

    const handleTeacherToggle = (teacherId: string) => {
        setFormData(prev => {
            const currentTeachers = prev.docentesResponsables;
            const newTeachers = currentTeachers.includes(teacherId)
                ? currentTeachers.filter(id => id !== teacherId)
                : [...currentTeachers, teacherId];
            return { ...prev, docentesResponsables: newTeachers };
        });
    };

    const handleContenidoChange = (asignatura: string, field: 'contenidos', value: string) => {
        setFormData(prev => ({
            ...prev,
            contenidosPorAsignatura: prev.contenidosPorAsignatura.map(c => 
                c.asignatura === asignatura ? { ...c, [field]: value } : c
            )
        }));
    };

    const handleHabilidadToggle = (asignatura: string, habilidad: string) => {
        setFormData(prev => ({
            ...prev,
            contenidosPorAsignatura: prev.contenidosPorAsignatura.map(c => 
                c.asignatura === asignatura 
                    ? { 
                        ...c, 
                        habilidades: c.habilidades.includes(habilidad)
                            ? c.habilidades.filter(h => h !== habilidad)
                            : [...c.habilidades, habilidad]
                    } 
                    : c
            )
        }));
    };

    const handleAddActivity = () => {
        if (!newActivity.nombre || !newActivity.fechaInicio || !newActivity.fechaFin) {
            alert("Nombre y fechas son obligatorios para la actividad.");
            return;
        }
        setFormData(prev => ({ 
            ...prev, 
            actividades: [...(prev.actividades || []), { ...newActivity, id: crypto.randomUUID() }] 
        }));
        setNewActivity({ nombre: '', fechaInicio: '', fechaFin: '', responsables: '', asignaturaPrincipal: '' });
    };

    const handleAddFechaClave = () => {
        if (!newFechaClave.nombre || !newFechaClave.fecha) return;
        setFormData(prev => ({ 
            ...prev, 
            fechasClave: [...(prev.fechasClave || []), { ...newFechaClave, id: crypto.randomUUID() }] 
        }));
        setNewFechaClave({ nombre: '', fecha: '' });
    };

    const handleAddTarea = () => {
        if (!newTarea.instrucciones || !newTarea.fechaEntrega) {
            alert("Instrucciones y fecha son obligatorios para la tarea.");
            return;
        }
        const tareaToAdd: TareaInterdisciplinaria = { 
            id: crypto.randomUUID(), 
            numero: (formData.tareas?.length || 0) + 1, 
            ...newTarea 
        };
        setFormData(prev => ({ 
            ...prev, 
            tareas: [...(prev.tareas || []), tareaToAdd] 
        }));
        setNewTarea({ instrucciones: '', fechaEntrega: '', recursoUrl: '' });
    };

    const getTeacherName = (teacherId: string) => {
        const teacher = availableTeachers.find(t => t.id === teacherId);
        return teacher ? teacher.nombreCompleto : teacherId;
    };
    
    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            {/* Header */}
            <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
                        <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {initialPlan ? 'Editando Proyecto' : 'Nuevo Proyecto Interdisciplinario'}
                    </h1>
                </div>
                <p className="text-lg text-slate-600 dark:text-slate-400">
                    Diseñe experiencias de aprendizaje colaborativo e innovador
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Información Básica */}
                <div className="space-y-6">
                    <FormCard icon={<FileText className="w-6 h-6 text-slate-600" />} label="Información del Proyecto">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Nombre del Proyecto
                                </label>
                                <input 
                                    name="nombreProyecto" 
                                    value={formData.nombreProyecto} 
                                    onChange={handleChange} 
                                    placeholder="Ingrese el nombre del proyecto..." 
                                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Descripción del Proyecto
                                </label>
                                <textarea 
                                    name="descripcionProyecto" 
                                    value={formData.descripcionProyecto} 
                                    onChange={handleChange} 
                                    placeholder="Detalle aquí la metodología, el producto final esperado y el propósito del proyecto..." 
                                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[120px] resize-none"
                                />
                            </div>
                        </div>
                    </FormCard>

                    <FormCard icon={<Users className="w-6 h-6 text-slate-600" />} label="Profesores Responsables">
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                                {availableTeachers.map(teacher => (
                                    <button
                                        key={teacher.id}
                                        type="button"
                                        onClick={() => handleTeacherToggle(teacher.id)}
                                        className={`p-3 rounded-lg text-left transition-all duration-200 ${
                                            formData.docentesResponsables.includes(teacher.id)
                                                ? 'bg-blue-100 border-2 border-blue-500 text-blue-800 dark:bg-blue-900/50 dark:border-blue-400 dark:text-blue-300'
                                                : 'bg-slate-50 border-2 border-slate-200 hover:border-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:border-slate-500'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                                                formData.docentesResponsables.includes(teacher.id)
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-300'
                                            }`}>
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm">{teacher.nombreCompleto}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{teacher.email}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {formData.docentesResponsables.length > 0 && (
                                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Profesores Seleccionados:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.docentesResponsables.map(teacherId => (
                                            <span key={teacherId} className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-md text-xs font-medium">
                                                {getTeacherName(teacherId)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </FormCard>

                    <FormCard icon={<Building2 className="w-6 h-6 text-slate-600" />} label="Cursos Participantes">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {CURSOS.map(curso => (
                                <button 
                                    type="button" 
                                    key={curso} 
                                    onClick={() => handleCursoToggle(curso)} 
                                    className={`p-3 rounded-lg text-center text-sm font-semibold transition-all duration-200 ${
                                        formData.cursos.includes(curso) 
                                            ? 'bg-amber-500 text-white shadow-lg transform scale-105' 
                                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    {curso}
                                </button>
                            ))}
                        </div>
                    </FormCard>
                </div>

                {/* Asignaturas y Contenidos */}
                <div className="space-y-6">
                    <FormCard icon={<BookOpen className="w-6 h-6 text-slate-600" />} label="Asignaturas y Contenidos">
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Seleccionar Asignaturas:</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {ASIGNATURAS.map(asignatura => (
                                        <button 
                                            type="button" 
                                            key={asignatura} 
                                            onClick={() => handleAsignaturaToggle(asignatura)} 
                                            className={`p-2 rounded-lg text-left text-sm font-medium transition-all duration-200 ${
                                                formData.asignaturas.includes(asignatura) 
                                                    ? 'bg-green-500 text-white shadow-md' 
                                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            {asignatura}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Contenidos por asignatura */}
                            {formData.contenidosPorAsignatura.length > 0 && (
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contenidos y Habilidades por Asignatura:</h4>
                                    {formData.contenidosPorAsignatura.map(contenido => (
                                        <div key={contenido.asignatura} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                                            <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                                                <BookOpen className="w-4 h-4" />
                                                {contenido.asignatura}
                                            </h5>
                                            
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                        Contenidos a trabajar:
                                                    </label>
                                                    <textarea
                                                        value={contenido.contenidos}
                                                        onChange={(e) => handleContenidoChange(contenido.asignatura, 'contenidos', e.target.value)}
                                                        placeholder={`Detalle los contenidos específicos de ${contenido.asignatura}...`}
                                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm min-h-[80px] resize-none"
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                                        Habilidades según Taxonomía de Bloom:
                                                    </label>
                                                    <div className="space-y-2">
                                                        {Object.entries(BLOOM_TAXONOMY).map(([categoria, habilidades]) => (
                                                            <div key={categoria} className="border border-slate-200 dark:border-slate-600 rounded-md p-2">
                                                                <h6 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{categoria}:</h6>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {habilidades.map(habilidad => (
                                                                        <button
                                                                            key={habilidad}
                                                                            type="button"
                                                                            onClick={() => handleHabilidadToggle(contenido.asignatura, habilidad)}
                                                                            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                                                                contenido.habilidades.includes(habilidad)
                                                                                    ? 'bg-blue-500 text-white'
                                                                                    : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500'
                                                                            }`}
                                                                        >
                                                                            {habilidad}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    {contenido.habilidades.length > 0 && (
                                                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                                                            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">Habilidades seleccionadas:</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {contenido.habilidades.map(habilidad => (
                                                                    <span key={habilidad} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded text-xs">
                                                                        {habilidad}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </FormCard>
                </div>
            </div>

            {/* Objetivos e Indicadores */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <FormCard 
                    icon={<Target className="w-6 h-6 text-slate-600" />} 
                    label="Objetivos de Aprendizaje" 
                    aiButton={
                        <button 
                            type="button" 
                            onClick={() => handleAIGeneration('objetivos')} 
                            disabled={!formData.descripcionProyecto.trim() || isGeneratingObjectives} 
                            className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50 transition-colors" 
                            title="Generar con IA"
                        >
                            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </button>
                    }
                >
                    {isGeneratingObjectives ? (
                        <div className="flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                            <span className="ml-3 text-slate-600 dark:text-slate-400">Generando objetivos...</span>
                        </div>
                    ) : (
                        <textarea 
                            name="objetivos" 
                            value={formData.objetivos} 
                            onChange={handleChange} 
                            placeholder="Liste los objetivos de aprendizaje del proyecto..." 
                            className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[120px] resize-none"
                        />
                    )}
                </FormCard>

                <FormCard 
                    icon={<BarChart3 className="w-6 h-6 text-slate-600" />} 
                    label="Indicadores de Éxito" 
                    aiButton={
                        <button 
                            type="button" 
                            onClick={() => handleAIGeneration('indicadoresLogro')} 
                            disabled={!formData.descripcionProyecto.trim() || isGeneratingIndicators} 
                            className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50 transition-colors" 
                            title="Generar con IA"
                        >
                            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </button>
                    }
                >
                    {isGeneratingIndicators ? (
                        <div className="flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                            <span className="ml-3 text-slate-600 dark:text-slate-400">Generando indicadores...</span>
                        </div>
                    ) : (
                        <textarea 
                            name="indicadoresLogro" 
                            value={formData.indicadoresLogro} 
                            onChange={handleChange} 
                            placeholder="Liste los indicadores de logro o evaluación..." 
                            className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[120px] resize-none"
                        />
                    )}
                </FormCard>
            </div>

            {/* Planificación y Cronograma */}
            <FormCard icon={<Calendar className="w-6 h-6 text-slate-600" />} label="Planificación y Cronograma">
                <div className="space-y-6">
                    {/* Botón para generar estructura con IA */}
                    <div className="text-center border-b border-slate-200 dark:border-slate-700 pb-6">
                        <button 
                            type="button" 
                            onClick={handleAIGenerateStructure} 
                            disabled={isGeneratingStructure || !formData.descripcionProyecto} 
                            className="inline-flex items-center gap-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed hover:from-sky-600 hover:to-blue-700 transition-all duration-200 shadow-lg"
                        >
                            {isGeneratingStructure ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Generando estructura...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Sugerir Estructura Completa con IA
                                </>
                            )}
                        </button>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                            La IA generará actividades, fechas clave y tareas basadas en la descripción del proyecto
                        </p>
                    </div>
                    
                    {/* Actividades */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Actividades del Proyecto</h4>
                        </div>
                        
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                                <div className="lg:col-span-4">
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nombre de la Actividad</label>
                                    <input 
                                        value={newActivity.nombre} 
                                        onChange={e => setNewActivity({...newActivity, nombre: e.target.value})} 
                                        placeholder="Nombre de la actividad" 
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                                    />
                                </div>
                                <div className="lg:col-span-3">
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fecha de Inicio</label>
                                    <input 
                                        type="date" 
                                        value={newActivity.fechaInicio} 
                                        onChange={e => setNewActivity({...newActivity, fechaInicio: e.target.value})} 
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                                    />
                                </div>
                                <div className="lg:col-span-3">
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fecha de Fin</label>
                                    <input 
                                        type="date" 
                                        value={newActivity.fechaFin} 
                                        onChange={e => setNewActivity({...newActivity, fechaFin: e.target.value})} 
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <button 
                                        type="button"
                                        onClick={handleAddActivity} 
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar
                                    </button>
                                </div>
                            </div>
                            
                            {formData.actividades.length > 0 && (
                                <div className="mt-4">
                                    <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Actividades Agregadas:</h5>
                                    <div className="space-y-2">
                                        {formData.actividades.map(actividad => (
                                            <div key={actividad.id} className="p-2 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium text-slate-800 dark:text-slate-200">{actividad.nombre}</span>
                                                    <span className="text-slate-500 dark:text-slate-400 text-xs">
                                                        {actividad.fechaInicio} - {actividad.fechaFin}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Fechas Clave */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Fechas Clave (Hitos)</h4>
                        </div>
                        
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nombre del Hito</label>
                                    <input 
                                        value={newFechaClave.nombre} 
                                        onChange={e => setNewFechaClave({...newFechaClave, nombre: e.target.value})} 
                                        placeholder="Nombre del hito" 
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fecha</label>
                                    <input 
                                        type="date" 
                                        value={newFechaClave.fecha} 
                                        onChange={e => setNewFechaClave({...newFechaClave, fecha: e.target.value})} 
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={handleAddFechaClave} 
                                    className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-1"
                                >
                                    <Plus className="w-4 h-4" />
                                    Agregar
                                </button>
                            </div>
                            
                            {formData.fechasClave.length > 0 && (
                                <div className="mt-4">
                                    <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Fechas Clave Agregadas:</h5>
                                    <div className="space-y-2">
                                        {formData.fechasClave.map(fecha => (
                                            <div key={fecha.id} className="p-2 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium text-slate-800 dark:text-slate-200">{fecha.nombre}</span>
                                                    <span className="text-slate-500 dark:text-slate-400 text-xs">{fecha.fecha}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tareas para Estudiantes */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Brain className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Tareas para Estudiantes</h4>
                        </div>
                        
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                                <div className="lg:col-span-6">
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Instrucciones de la Tarea</label>
                                    <input 
                                        value={newTarea.instrucciones} 
                                        onChange={e => setNewTarea({...newTarea, instrucciones: e.target.value})} 
                                        placeholder="Descripción detallada de la tarea" 
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                                    />
                                </div>
                                <div className="lg:col-span-3">
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fecha de Entrega</label>
                                    <input 
                                        type="date" 
                                        value={newTarea.fechaEntrega} 
                                        onChange={e => setNewTarea({...newTarea, fechaEntrega: e.target.value})} 
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                                    />
                                </div>
                                <div className="lg:col-span-3">
                                    <button 
                                        type="button"
                                        onClick={handleAddTarea} 
                                        className="w-full bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar Tarea
                                    </button>
                                </div>
                            </div>
                            
                            {formData.tareas && formData.tareas.length > 0 && (
                                <div className="mt-4">
                                    <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Tareas Agregadas:</h5>
                                    <div className="space-y-2">
                                        {formData.tareas.map(tarea => (
                                            <div key={tarea.id} className="p-3 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <span className="inline-block bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 text-xs font-bold px-2 py-1 rounded mb-1">
                                                            Tarea #{tarea.numero}
                                                        </span>
                                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{tarea.instrucciones}</p>
                                                    </div>
                                                    <span className="text-slate-500 dark:text-slate-400 text-xs ml-3">
                                                        {tarea.fechaEntrega}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </FormCard>

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-slate-200 dark:border-slate-700">
                <button 
                    onClick={onCancel} 
                    className="px-8 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 transition-colors order-2 sm:order-1"
                >
                    Cancelar
                </button>
                <button 
                    onClick={() => onSave(formData)} 
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg order-1 sm:order-2"
                >
                    {initialPlan ? 'Guardar Cambios' : 'Crear Proyecto'}
                </button>
            </div>
        </div>
    );
};

// Componente para visualizar entregas de estudiantes
const SubmissionsViewer: React.FC<{
    plan: PlanificacionExtendida;
    onBack: () => void;
    availableTeachers: User[];
}> = ({ plan, onBack, availableTeachers }) => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [entregas, setEntregas] = useState<EntregaTareaInterdisciplinaria[]>([]);
    const [selectedTask, setSelectedTask] = useState<TareaInterdisciplinaria | null>(plan.tareas?.[0] || null);
    const [isGeneratingFeedbackFor, setIsGeneratingFeedbackFor] = useState<string | null>(null);

    useEffect(() => {
        const unsubUsers = subscribeToAllUsers(setAllUsers);
        const unsubEntregas = subscribeToEntregas(plan.id, setEntregas);

        return () => {
            unsubUsers();
            unsubEntregas();
        }
    }, [plan.id]);

    const studentsInProject = useMemo(() => {
        return allUsers
            .filter(u => u.profile === Profile.ESTUDIANTE && plan.cursos.includes(u.curso || ''))
            .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    }, [allUsers, plan.cursos]);

    const handleAIGenerateFeedback = async (entrega: EntregaTareaInterdisciplinaria) => {
        setIsGeneratingFeedbackFor(entrega.id);

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            alert("La API Key de Gemini no está configurada.");
            setIsGeneratingFeedbackFor(null);
            return;
        }

        const prompt = `
            Eres un profesor asistente. Genera una retroalimentación constructiva para la entrega de un estudiante.
            - Instrucciones de la tarea: "${selectedTask?.instrucciones}"
            - Comentario del estudiante: "${entrega.observacionesEstudiante || 'No dejó comentarios.'}"
            - Enlace entregado: "${entrega.enlaceUrl || 'No aplica'}"
            - Archivo entregado: "${entrega.archivoAdjunto?.nombre || 'No aplica'}"
            
            La retroalimentación debe ser breve (2-3 frases), motivadora, y enfocada en cómo podría mejorar.
        `;

        try {
            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const feedbackText = response.text().replace(/(\*\*|\*)/g, '');
            
            await saveFeedbackEntrega(entrega.id, feedbackText);
        } catch (error) {
            console.error("Error al generar feedback con IA:", error);
            alert("No se pudo generar la retroalimentación.");
        } finally {
            setIsGeneratingFeedbackFor(null);
        }
    };

    const getTeacherNames = (teacherIds: string[]) => {
        return teacherIds.map(id => {
            const teacher = availableTeachers.find(t => t.id === id);
            return teacher ? teacher.nombreCompleto : id;
        }).join(', ');
    };

    if (!selectedTask) {
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <p className="text-lg text-slate-600 dark:text-slate-400">Este proyecto no tiene tareas asignadas</p>
                    <button 
                        onClick={onBack} 
                        className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Volver a Proyectos
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Entregas de Tareas</h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">{plan.nombreProyecto}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                        Profesores: {getTeacherNames(plan.docentesResponsables)}
                    </p>
                </div>
                <button 
                    onClick={onBack} 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Volver a Proyectos
                </button>
            </div>

            <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Seleccionar Tarea:
                </label>
                <select 
                    value={selectedTask.id} 
                    onChange={e => setSelectedTask(plan.tareas?.find(t => t.id === e.target.value) || null)} 
                    className="w-full sm:w-auto p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                    {plan.tareas?.map(t => (
                        <option key={t.id} value={t.id}>
                            Tarea {t.numero}: {t.instrucciones}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {studentsInProject.map(student => {
                    const entrega = entregas.find(e => e.tareaId === selectedTask.id && e.estudianteId === student.id);
                    return (
                        <div key={student.id} className="p-6 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                        {student.nombreCompleto.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200">{student.nombreCompleto}</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">{student.curso}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {entrega?.completada ? (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-full text-sm font-semibold">
                                            <CheckCircle className="w-4 h-4" />
                                            Entregado
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded-full text-sm font-semibold">
                                            <AlertCircle className="w-4 h-4" />
                                            Pendiente
                                        </span>
                                    )}
                                </div>
                            </div>

                            {entrega ? (
                                <div className="space-y-4">
                                    {entrega.observacionesEstudiante && (
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Comentario del estudiante:</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-3 rounded-md border border-slate-200 dark:border-slate-600">
                                                {entrega.observacionesEstudiante}
                                            </p>
                                        </div>
                                    )}
                                    
                                    {entrega.enlaceUrl && (
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Enlace entregado:</p>
                                            <a 
                                                href={entrega.enlaceUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                                            >
                                                <FileText className="w-4 h-4" />
                                                {entrega.enlaceUrl}
                                            </a>
                                        </div>
                                    )}
                                    
                                    {entrega.archivoAdjunto && (
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Archivo adjunto:</p>
                                            <a 
                                                href={entrega.archivoAdjunto.url} 
                                                download={entrega.archivoAdjunto.nombre} 
                                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                                            >
                                                <Download className="w-4 h-4" />
                                                {entrega.archivoAdjunto.nombre}
                                            </a>
                                        </div>
                                    )}
                                    
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Retroalimentación del profesor:</p>
                                        <div className="flex gap-2">
                                            <textarea 
                                                key={entrega.id} 
                                                placeholder="Escribir retroalimentación..." 
                                                defaultValue={entrega.feedbackProfesor || ''}
                                                onBlur={(e) => saveFeedbackEntrega(entrega.id, e.target.value)}
                                                rows={3}
                                                className="flex-1 p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm resize-none"
                                            />
                                            <button 
                                                onClick={() => handleAIGenerateFeedback(entrega)} 
                                                disabled={isGeneratingFeedbackFor === entrega.id}
                                                className="p-3 rounded-md bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50 transition-colors" 
                                                title="Generar Feedback con IA"
                                            >
                                                {isGeneratingFeedbackFor === entrega.id ? (
                                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                                                ) : (
                                                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">El estudiante aún no ha realizado la entrega</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Componente principal
const Interdisciplinario: React.FC = () => {
    const [planificaciones, setPlanificaciones] = useState<PlanificacionExtendida[]>([]);
    const [availableTeachers, setAvailableTeachers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingPlan, setEditingPlan] = useState<PlanificacionExtendida | null>(null);
    const [isExportingId, setIsExportingId] = useState<string | null>(null);
    const [viewingSubmissionsForPlan, setViewingSubmissionsForPlan] = useState<PlanificacionExtendida | null>(null);

    useEffect(() => {
        setLoading(true);
        
        // Suscribirse a profesores
        const unsubscribeTeachers = subscribeToAllUsers((users) => {
            const teachers = users.filter(u => u.profile === Profile.PROFESOR);
            setAvailableTeachers(teachers);
        });

        // Suscribirse a planificaciones
        const unsubscribePlans = subscribeToPlanificaciones((data) => {
            // Convertir el formato de docentesResponsables si es necesario
            const convertedData = data.map(plan => ({
                ...plan,
                docentesResponsables: Array.isArray(plan.docentesResponsables) 
                    ? plan.docentesResponsables 
                    : [plan.docentesResponsables].filter(Boolean),
                contenidosPorAsignatura: plan.contenidosPorAsignatura || []
            })) as PlanificacionExtendida[];
            
            setPlanificaciones(convertedData);
            setLoading(false);
        });

        return () => {
            unsubscribeTeachers();
            unsubscribePlans();
        };
    }, []);

    const handleActivityUpdate = useCallback(async (planId: string, activity: ActividadInterdisciplinaria) => {
        const planToUpdate = planificaciones.find(p => p.id === planId);
        if (planToUpdate) {
            const updatedPlan = {
                ...planToUpdate,
                actividades: (planToUpdate.actividades || []).map(a => a.id === activity.id ? activity : a)
            };
            await updatePlanificacion(planId, updatedPlan);
        }
    }, [planificaciones]);

    const handleSave = async (plan: Omit<PlanificacionExtendida, 'id'> | PlanificacionExtendida) => {
        try {
            // Convertir el plan al formato esperado por la base de datos
            const planToSave = {
                ...plan,
                docentesResponsables: Array.isArray(plan.docentesResponsables) 
                    ? plan.docentesResponsables.join(', ')
                    : plan.docentesResponsables
            };

            if ('id' in plan && plan.id) {
                await updatePlanificacion(plan.id, planToSave as any);
            } else {
                await createPlanificacion(planToSave as any);
            }
            setView('list');
            setEditingPlan(null);
        } catch (error) {
            console.error("Error al guardar la planificación:", error);
            alert("No se pudo guardar la planificación.");
        }
    };

    const handleEdit = (plan: PlanificacionExtendida) => {
        setEditingPlan(plan);
        setView('form');
    };

    const handleDelete = async (id: string) => {
        if (!id) {
            console.error('handleDelete fue llamado con un ID inválido:', id);
            alert('Error: No se puede eliminar un proyecto sin un ID válido.');
            return;
        }
        if (window.confirm("¿Está seguro de eliminar esta planificación?")) {
            try {
                await deletePlanificacion(id);
            } catch (error) {
                console.error("Error al eliminar la planificación:", error);
                alert("No se pudo eliminar la planificación.");
            }
        }
    };
    
    const handleCreateNew = () => {
        setEditingPlan(null);
        setView('form');
    };

    const handleExportProjectPDF = async (plan: PlanificacionExtendida) => {
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

        const getTeacherNames = (teacherIds: string[]) => {
            return teacherIds.map(id => {
                const teacher = availableTeachers.find(t => t.id === id);
                return teacher ? teacher.nombreCompleto : id;
            }).join(', ');
        };
    
        autoTable(doc, {
            startY: y,
            body: [
                [{ content: 'Docentes Responsables:', styles: { fontStyle: 'bold' } }, getTeacherNames(plan.docentesResponsables)],
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

        // Agregar contenidos por asignatura
        if (plan.contenidosPorAsignatura && plan.contenidosPorAsignatura.length > 0) {
            checkPageBreak(50);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FONT_HEADER);
            doc.setTextColor(40);
            doc.text("Contenidos por Asignatura", margin, y);
            y += 10;

            plan.contenidosPorAsignatura.forEach(contenido => {
                checkPageBreak(30);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(FONT_BODY);
                doc.text(`${contenido.asignatura}:`, margin, y);
                y += 6;
                
                doc.setFont('helvetica', 'normal');
                if (contenido.contenidos) {
                    const contenidoLines = doc.splitTextToSize(`Contenidos: ${contenido.contenidos}`, contentWidth - 10);
                    doc.text(contenidoLines, margin + 5, y);
                    y += contenidoLines.length * 4 + 3;
                }
                
                if (contenido.habilidades && contenido.habilidades.length > 0) {
                    const habilidadesText = `Habilidades: ${contenido.habilidades.join(', ')}`;
                    const habilidadesLines = doc.splitTextToSize(habilidadesText, contentWidth - 10);
                    doc.text(habilidadesLines, margin + 5, y);
                    y += habilidadesLines.length * 4 + 8;
                }
            });
            y += 10;
        }
    
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

    const getTeacherNames = (teacherIds: string[]) => {
        return teacherIds.map(id => {
            const teacher = availableTeachers.find(t => t.id === id);
            return teacher ? teacher.nombreCompleto : id;
        }).join(', ');
    };
    
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-lg text-slate-600 dark:text-slate-400">Cargando proyectos...</p>
                </div>
            </div>
        );
    }

    if (viewingSubmissionsForPlan) {
        return (
            <SubmissionsViewer 
                plan={viewingSubmissionsForPlan} 
                onBack={() => setViewingSubmissionsForPlan(null)} 
                availableTeachers={availableTeachers}
            />
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {view === 'list' ? (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                                    <GraduationCap className="w-8 h-8 text-white" />
                                </div>
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                    Proyectos Interdisciplinarios
                                </h1>
                            </div>
                            <p className="text-lg text-slate-600 dark:text-slate-400">
                                Gestione experiencias de aprendizaje colaborativo e innovador
                            </p>
                        </div>
                        <button 
                            onClick={handleCreateNew} 
                            className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
                        >
                            <Plus className="w-5 h-5" />
                            Crear Nuevo Proyecto
                        </button>
                    </div>

                    {planificaciones.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                                <GraduationCap className="w-12 h-12 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                No hay proyectos creados
                            </h3>
                            <p className="text-slate-500 dark:text-slate-500 mb-6">
                                Comience creando su primer proyecto interdisciplinario
                            </p>
                            <button 
                                onClick={handleCreateNew} 
                                className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Crear Primer Proyecto
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            {planificaciones.map(plan => (
                                <div key={plan.id} className="group bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-xl text-slate-800 dark:text-slate-200 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {plan.nombreProyecto}
                                            </h3>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                    <Building2 className="w-4 h-4" />
                                                    <span>Cursos: {plan.cursos.join(', ')}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                    <Users className="w-4 h-4" />
                                                    <span>Profesores: {getTeacherNames(plan.docentesResponsables)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                    <BookOpen className="w-4 h-4" />
                                                    <span>Asignaturas: {plan.asignaturas.length}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {plan.descripcionProyecto && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">
                                            {plan.descripcionProyecto}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-600">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setViewingSubmissionsForPlan(plan)} 
                                                className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-semibold text-sm transition-colors"
                                                title="Ver entregas de estudiantes"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Entregas
                                            </button>
                                            <button 
                                                onClick={() => handleExportProjectPDF(plan)} 
                                                disabled={isExportingId === plan.id}
                                                className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold text-sm transition-colors disabled:opacity-50"
                                                title="Exportar a PDF"
                                            >
                                                {isExportingId === plan.id ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                                ) : (
                                                    <Download className="w-4 h-4" />
                                                )}
                                                PDF
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleEdit(plan)} 
                                                className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                                                title="Editar proyecto"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(plan.id)} 
                                                className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                                                title="Eliminar proyecto"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <PlanificacionForm 
                    initialPlan={editingPlan} 
                    onSave={handleSave} 
                    onCancel={() => { setView('list'); setEditingPlan(null); }} 
                    availableTeachers={availableTeachers}
                />
            )}
            
            {planificaciones.length > 0 && view === 'list' && (
                <div id="gantt-container-vertical">
                    <ProjectTimeline 
                        planificaciones={planificaciones} 
                        onActivityUpdate={handleActivityUpdate} 
                    />
                </div>
            )}
        </div>
    );
};

export default Interdisciplinario;