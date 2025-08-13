
import React, { useState, useEffect, useMemo, useCallback, ChangeEvent } from 'react';
import {
  PlanificacionInterdisciplinaria,
  ActividadInterdisciplinaria,
  FechaClave,
  TareaInterdisciplinaria,
  EntregaTareaInterdisciplinaria,
  User as AppUser,
  Profile
} from '../../types';
import { ASIGNATURAS, CURSOS } from '../../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  User as UserIcon,
  Building2,
  TrendingUp,
  PieChart,
  Activity,
  LayoutList,
  Link as LinkIcon
} from 'lucide-react';

/* =========================
   Extensiones locales (no tocan tus types globales)
   ========================= */
type ActividadWithResource = ActividadInterdisciplinaria & { recursoUrl?: string };
type FechaClaveWithResource = FechaClave & { recursoUrl?: string };

/* =========================
   Taxonomía de Bloom
   ========================= */
const BLOOM_TAXONOMY: Record<string, string[]> = {
  Recordar: ['Enumerar', 'Definir', 'Identificar', 'Nombrar', 'Reconocer', 'Reproducir'],
  Comprender: ['Explicar', 'Interpretar', 'Resumir', 'Parafrasear', 'Ejemplificar', 'Clasificar'],
  Aplicar: ['Ejecutar', 'Implementar', 'Usar', 'Demostrar', 'Operar', 'Programar'],
  Analizar: ['Diferenciar', 'Organizar', 'Atribuir', 'Comparar', 'Deconstruir', 'Delinear'],
  Evaluar: ['Comprobar', 'Criticar', 'Revisar', 'Formular hipótesis', 'Experimentar', 'Juzgar'],
  Crear: ['Generar', 'Planificar', 'Producir', 'Diseñar', 'Construir', 'Idear']
};

/* =========================
   Tipos auxiliares
   ========================= */
interface ContenidoAsignatura {
  asignatura: string;
  contenidos: string;
  habilidades: string[];
}

interface PlanificacionExtendida extends Omit<PlanificacionInterdisciplinaria, 'docentesResponsables' | 'actividades' | 'fechasClave'> {
  docentesResponsables: string[];
  contenidosPorAsignatura: ContenidoAsignatura[];
  actividades: ActividadWithResource[];
  fechasClave: FechaClaveWithResource[];
}

/* =========================
   UI helpers
   ========================= */
const ExternalLink: React.FC<{ href?: string }> = ({ href }) => {
  if (!href) return <span className="text-slate-400">—</span>;
  const url = href.startsWith('http') ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
      <LinkIcon className="w-4 h-4" /><span className="truncate max-w-[180px] md:max-w-[260px]">{href}</span>
    </a>
  );
};

/* =========================
   Card reutilizable
   ========================= */
const FormCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  aiButton?: React.ReactNode;
  className?: string;
}> = ({ icon, label, children, aiButton, className = '' }) => (
  <div className={`bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">{icon}</div>
        <span className="font-semibold text-slate-700 dark:text-slate-300">{label}</span>
      </div>
      {aiButton}
    </div>
    {children}
  </div>
);

/* =========================
   Cronograma agrupado por proyecto + recurso
   ========================= */
const ProjectTimeline: React.FC<{
  planificaciones: PlanificacionExtendida[];
  onActivityUpdate: (planId: string, activity: ActividadWithResource) => void;
}> = ({ planificaciones, onActivityUpdate }) => {
  const [editingActivity, setEditingActivity] = useState<{ planId: string; activity: ActividadWithResource } | null>(null);

  const grouped = useMemo(() => {
    return planificaciones.map((p) => {
      const items: any[] = [];
      (p.actividades || []).forEach((a) => items.push({ ...a, planId: p.id, type: 'activity' }));
      (p.fechasClave || []).forEach((f) =>
        items.push({
          id: f.id,
          planId: p.id,
          type: 'keyDate',
          nombre: f.nombre,
          fechaInicio: f.fecha,
          fechaFin: f.fecha,
          responsables: p.docentesResponsables.join(', '),
          asignaturaPrincipal: 'Milestone',
          recursoUrl: f.recursoUrl
        })
      );
      items.sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
      return { plan: p, items };
    });
  }, [planificaciones]);

  const getStatus = useCallback((item: any) => {
    if (item.type === 'keyDate') {
      return { text: 'Fecha Clave', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' };
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const startDate = new Date(`${item.fechaInicio}T00:00:00`);
    const endDate = new Date(`${item.fechaFin}T00:00:00`);
    if (endDate < today) return { text: 'Completado', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' };
    if (startDate <= today && endDate >= today) return { text: 'En Progreso', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' };
    return { text: 'Planificado', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' };
  }, []);

  const AssigneeAvatar: React.FC<{ name: string }> = ({ name }) => {
    const initials = (name || '').split(' ').map((n) => n[0]).join('').toUpperCase();
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-semibold text-sm ring-2 ring-white dark:ring-slate-800 shadow-sm">
        {initials.slice(0, 2)}
      </div>
    );
  };

  const ActivityModal: React.FC<{
    data: { planId: string; activity: ActividadWithResource };
    onClose: () => void;
    onSave: (planId: string, activity: ActividadWithResource) => void;
  }> = ({ data, onClose, onSave }) => {
    const [formData, setFormData] = useState(data.activity);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSave = () => { onSave(data.planId, formData); onClose(); };
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg"><Edit className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Editar Actividad</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Nombre</label>
              <input name="nombre" value={formData.nombre} onChange={handleChange} className="w-full p-3 border rounded-lg bg-white dark:bg-slate-700" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Responsables</label>
              <input name="responsables" value={formData.responsables} onChange={handleChange} className="w-full p-3 border rounded-lg bg-white dark:bg-slate-700" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Inicio</label>
              <input type="date" name="fechaInicio" value={formData.fechaInicio} onChange={handleChange} className="w-full p-3 border rounded-lg bg-white dark:bg-slate-700" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Fin</label>
              <input type="date" name="fechaFin" value={formData.fechaFin} onChange={handleChange} className="w-full p-3 border rounded-lg bg-white dark:bg-slate-700" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-1">Recurso (enlace)</label>
              <input name="recursoUrl" placeholder="https://..." value={formData.recursoUrl || ''} onChange={handleChange} className="w-full p-3 border rounded-lg bg-white dark:bg-slate-700" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-lg">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Guardar</button>
          </div>
        </div>
      </div>
    );
  };

  if (!grouped.length || grouped.every(g => g.items.length === 0)) {
    return (
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 text-lg">No hay actividades para mostrar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(({ plan, items }) => (
        <div key={plan.id} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl"><Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" /></div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-200">{plan.nombreProyecto}</h2>
                <p className="text-slate-600 dark:text-slate-400">Cronograma del proyecto</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                  <th className="px-6 py-4 text-left text-sm font-bold">Tarea</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Estado</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Inicio</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Fin</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Recurso</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Asignado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {items.map((item: any) => {
                  const status = getStatus(item);
                  const isClickable = item.type === 'activity';
                  return (
                    <tr key={item.id} className={`${isClickable ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer' : ''}`} onClick={() => isClickable && setEditingActivity({ planId: item.planId, activity: item })}>
                      <td className="px-6 py-4 font-semibold">{item.nombre}</td>
                      <td className="px-6 py-4"><span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${status.color}`}>{status.text}</span></td>
                      <td className="px-6 py-4">{item.fechaInicio}</td>
                      <td className="px-6 py-4">{item.fechaFin}</td>
                      <td className="px-6 py-4"><ExternalLink href={item.recursoUrl} /></td>
                      <td className="px-6 py-4"><AssigneeAvatar name={item.responsables || 'Sin asignar'} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {editingActivity && <ActivityModal data={editingActivity} onClose={() => setEditingActivity(null)} onSave={onActivityUpdate} />}
    </div>
  );
};

/* =========================
   Dashboard analítico
   ========================= */
const Dashboard: React.FC<{ planificaciones: PlanificacionExtendida[]; onBack: () => void; }> = ({ planificaciones, onBack }) => {
  const habilidadesAnalysis = useMemo(() => {
    const habilidadesCount: Record<string, number> = {};
    const categoriaCount: Record<string, number> = {};
    planificaciones.forEach((plan) => {
      plan.contenidosPorAsignatura?.forEach((contenido) => {
        contenido.habilidades?.forEach((habilidad) => {
          habilidadesCount[habilidad] = (habilidadesCount[habilidad] || 0) + 1;
          Object.entries(BLOOM_TAXONOMY).forEach(([categoria, hs]) => {
            if (hs.includes(habilidad)) categoriaCount[categoria] = (categoriaCount[categoria] || 0) + 1;
          });
        });
      });
    });
    return { habilidadesCount, categoriaCount };
  }, [planificaciones]);

  const contenidosAnalysis = useMemo(() => {
    const palabrasCount: Record<string, number> = {};
    const asignaturasCount: Record<string, number> = {};
    planificaciones.forEach((plan) => {
      plan.asignaturas.forEach((asignatura) => { asignaturasCount[asignatura] = (asignaturasCount[asignatura] || 0) + 1; });
      plan.contenidosPorAsignatura?.forEach((contenido) => {
        if (contenido.contenidos) {
          const palabras = contenido.contenidos.toLowerCase().split(/[\s,.-]+/).filter((p) => p.length > 3).filter((p) => !['para','con','por','las','los','una','del','que','este','esta','son','como','más','desde','hasta','entre'].includes(p));
          palabras.forEach((p) => { palabrasCount[p] = (palabrasCount[p] || 0) + 1; });
        }
      });
    });
    return { palabrasCount, asignaturasCount };
  }, [planificaciones]);

  const estadisticas = useMemo(() => {
    const totalProyectos = planificaciones.length;
    const totalActividades = planificaciones.reduce((sum, p) => sum + (p.actividades?.length || 0), 0);
    const totalTareas = planificaciones.reduce((sum, p) => sum + (p.tareas?.length || 0), 0);
    const asignaturasUnicas = new Set(planificaciones.flatMap((p) => p.asignaturas)).size;
    return { totalProyectos, totalActividades, totalTareas, asignaturasUnicas };
  }, [planificaciones]);

  const WordCloud: React.FC<{ data: Record<string, number>; title: string; }> = ({ data, title }) => {
    const entries = Object.entries(data);
    if (!entries.length) return null;
    const sorted = entries.sort((a,b)=>b[1]-a[1]).slice(0,20);
    const maxCount = Math.max(...sorted.map(([,v])=>v));
    if (!maxCount) return null;
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">{title}</h3>
        <div className="flex flex-wrap gap-2 justify-center min-h-[100px]">
          {sorted.map(([word,count])=>{
            const size = Math.max(0.8,(count/maxCount)*2);
            const opacity = Math.max(0.6,count/maxCount);
            return <span key={word} className="inline-block px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full font-semibold transition-transform hover:scale-110" style={{fontSize:`${size}rem`,opacity}} title={`${word}: ${count} veces`}>{word}</span>
          })}
        </div>
      </div>
    );
  };

  const BloomChart: React.FC<{ data: Record<string, number>; }> = ({ data }) => {
    const values = Object.values(data);
    const maxValue = values.length ? Math.max(...values) : 0;
    const bloomColors: Record<string,string> = { Recordar:'bg-red-500', Comprender:'bg-orange-500', Aplicar:'bg-yellow-500', Analizar:'bg-green-500', Evaluar:'bg-blue-500', Crear:'bg-purple-500' };
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg"><Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" /></div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Taxonomía de Bloom</h3>
        </div>
        <div className="space-y-4">
          {Object.keys(BLOOM_TAXONOMY).map((categoria)=>{
            const count = data[categoria] || 0;
            const percentage = maxValue>0 ? (count/maxValue)*100 : 0;
            const colorClass = bloomColors[categoria] || 'bg-slate-400';
            return (
              <div key={categoria} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{categoria}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{count} habilidades</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                  <div className={`h-3 rounded-full ${colorClass} transition-all duration-500`} style={{width:`${percentage}%`}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: number; description: string; color: string; }> = ({icon,title,value,description,color}) => (
    <div className={`bg-gradient-to-br ${color} p-6 rounded-2xl shadow-lg text-white`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-white/20 rounded-xl">{icon}</div>
        <div className="text-right">
          <div className="text-3xl font-bold">{value}</div>
          <div className="text-white/80 text-sm">{title}</div>
        </div>
      </div>
      <p className="text-white/90 text-sm">{description}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl"><TrendingUp className="w-8 h-8 text-white" /></div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">Dashboard Analítico</h1>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-400">Análisis de habilidades y contenidos desarrollados</p>
          </div>
          <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Volver a Proyectos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<GraduationCap className="w-8 h-8" />} title="Proyectos" value={estadisticas.totalProyectos} description="Proyectos interdisciplinarios creados" color="from-blue-500 to-blue-600" />
        <StatCard icon={<Activity className="w-8 h-8" />} title="Actividades" value={estadisticas.totalActividades} description="Actividades planificadas en total" color="from-green-500 to-green-600" />
        <StatCard icon={<FileText className="w-8 h-8" />} title="Tareas" value={estadisticas.totalTareas} description="Tareas asignadas a estudiantes" color="from-purple-500 to-purple-600" />
        <StatCard icon={<BookOpen className="w-8 h-8" />} title="Asignaturas" value={estadisticas.asignaturasUnicas} description="Asignaturas involucradas" color="from-orange-500 to-orange-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <BloomChart data={habilidadesAnalysis.categoriaCount} />
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg"><PieChart className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Distribución de Asignaturas</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(contenidosAnalysis.asignaturasCount).sort(([,a],[,b])=>b-a).map(([asignatura,count])=>{
              const maxCount = Math.max(...Object.values(contenidosAnalysis.asignaturasCount));
              const percentage = maxCount>0 ? (count/maxCount)*100 : 0;
              return (
                <div key={asignatura} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{asignatura}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{count} proyecto{count!==1?'s':''}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500" style={{width:`${percentage}%`}}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <WordCloud data={contenidosAnalysis.palabrasCount} title="Contenidos Más Frecuentes" />
        <WordCloud data={habilidadesAnalysis.habilidadesCount} title="Habilidades Más Desarrolladas" />
      </div>
    </div>
  );
};

/* =========================
   Submissions (entregas)
   ========================= */
const SubmissionsViewer: React.FC<{ plan: PlanificacionExtendida; onBack: () => void; availableTeachers: AppUser[]; }> =
({ plan, onBack, availableTeachers }) => {
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [entregas, setEntregas] = useState<EntregaTareaInterdisciplinaria[]>([]);
  const [selectedTask, setSelectedTask] = useState<TareaInterdisciplinaria | null>(plan.tareas?.[0] || null);
  const [isGeneratingFeedbackFor, setIsGeneratingFeedbackFor] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = subscribeToAllUsers(setAllUsers);
    const unsubEntregas = subscribeToEntregas(plan.id, setEntregas);
    return () => { unsubUsers(); unsubEntregas(); };
  }, [plan.id]);

  const studentsInProject = useMemo(() =>
    allUsers.filter(u => u.profile === Profile.ESTUDIANTE && plan.cursos.includes(u.curso || '')).sort((a,b)=> (a.nombreCompleto || '').localeCompare(b.nombreCompleto || '')),
  [allUsers, plan.cursos]);

  const handleAIGenerateFeedback = async (entrega: EntregaTareaInterdisciplinaria) => {
    setIsGeneratingFeedbackFor(entrega.id);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) { alert('La API Key de Gemini no está configurada.'); setIsGeneratingFeedbackFor(null); return; }
    const prompt = `Eres un profesor asistente. Genera una retroalimentación breve (2-3 frases) para la entrega de un estudiante.
Instrucciones de la tarea: "${selectedTask?.instrucciones}"
Comentario del estudiante: "${entrega.observacionesEstudiante || 'Sin comentarios.'}"`.trim();
    try {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const feedbackText = response.text().replace(/(\*\*|\*)/g,'');
      await saveFeedbackEntrega(entrega.id, feedbackText);
    } catch (e) {
      console.error(e);
      alert('No se pudo generar la retroalimentación.');
    } finally {
      setIsGeneratingFeedbackFor(null);
    }
  };

  const getTeacherNames = (ids: string[]) => ids.map(id => (availableTeachers.find(t=>t.id===id)?.nombreCompleto || id)).join(', ');

  if (!selectedTask) {
    return (
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-lg text-slate-600 dark:text-slate-400">Este proyecto no tiene tareas asignadas</p>
          <button onClick={onBack} className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold">
            <ChevronLeft className="w-4 h-4" /> Volver a Proyectos
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
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Profesores: {getTeacherNames(plan.docentesResponsables)}</p>
        </div>
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Volver a Proyectos
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Seleccionar Tarea:</label>
        <select value={selectedTask.id} onChange={(e)=> setSelectedTask(plan.tareas?.find(t => t.id===e.target.value) || null)} className="w-full sm:w-auto p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
          {plan.tareas?.map(t => <option key={t.id} value={t.id}>Tarea {t.numero}: {t.instrucciones}</option>)}
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
                    {(student.nombreCompleto || 'NA').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{student.nombreCompleto}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{student.curso}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {entrega?.completada ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-full text-sm font-semibold">
                      <CheckCircle className="w-4 h-4" /> Entregado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded-full text-sm font-semibold">
                      <AlertCircle className="w-4 h-4" /> Pendiente
                    </span>
                  )}
                </div>
              </div>

              {entrega ? (
                <div className="space-y-4">
                  {entrega.observacionesEstudiante && (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Comentario del estudiante:</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-3 rounded-md border border-slate-200 dark:border-slate-600">{entrega.observacionesEstudiante}</p>
                    </div>
                  )}
                  {entrega.enlaceUrl && (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Enlace entregado:</p>
                      <ExternalLink href={entrega.enlaceUrl} />
                    </div>
                  )}
                  {entrega.archivoAdjunto && (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Archivo adjunto:</p>
                      <a href={entrega.archivoAdjunto.url} download={entrega.archivoAdjunto.nombre} className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium">
                        <Download className="w-4 h-4" /> {entrega.archivoAdjunto.nombre}
                      </a>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Retroalimentación del profesor:</p>
                    <div className="flex gap-2">
                      <textarea key={entrega.id} placeholder="Escribir retroalimentación..." defaultValue={entrega.feedbackProfesor || ''} onBlur={(e)=> saveFeedbackEntrega(entrega.id, e.target.value)} rows={3} className="flex-1 p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm resize-none" />
                      <button onClick={()=>handleAIGenerateFeedback(entrega)} disabled={isGeneratingFeedbackFor===entrega.id} className="p-3 rounded-md bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50 transition-colors" title="Generar Feedback con IA">
                        {isGeneratingFeedbackFor===entrega.id ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" /> : <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
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

/* =========================
   Generador AI (objetivos, indicadores, estructura)
   ========================= */
const AIButtons: React.FC<{
  descripcion: string;
  asignaturas: string[];
  docentes: string[];
  onObjetivos: (texto: string) => void;
  onIndicadores: (texto: string) => void;
  onEstructura: (payload: { actividades?: ActividadWithResource[]; fechasClave?: FechaClaveWithResource[]; tareas?: any[]; }) => void;
  availableTeachers: AppUser[];
}> = ({ descripcion, asignaturas, docentes, onObjetivos, onIndicadores, onEstructura, availableTeachers }) => {
  const [loading, setLoading] = useState<'obj' | 'ind' | 'est' | null>(null);
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;

  const getTeacherNames = (ids: string[]) => ids.map(id => (availableTeachers.find(t=>t.id===id)?.nombreCompleto || id)).join(', ');

  const runAI = async (mode: 'obj'|'ind'|'est') => {
    if (!apiKey) { alert('La API Key de Gemini no está configurada.'); return; }
    if (!descripcion.trim()) { alert('Ingrese una descripción del proyecto.'); return; }
    setLoading(mode);
    try {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash-latest'});
      if (mode === 'obj') {
        const prompt = `Genera 3 a 5 objetivos de aprendizaje claros y medibles.
Descripción: "${descripcion}"
Asignaturas: "${asignaturas.join(', ')}"
Formato: lista con guiones.`;
        const res = await model.generateContent(prompt);
        onObjetivos(res.response.text().replace(/(\*\*|\*)/g,''));
      } else if (mode === 'ind') {
        const prompt = `Genera 5 a 7 indicadores de logro observables.
Descripción: "${descripcion}"
Asignaturas: "${asignaturas.join(', ')}"
Formato: lista con guiones.`;
        const res = await model.generateContent(prompt);
        onIndicadores(res.response.text().replace(/(\*\*|\*)/g,''));
      } else {
        const prompt = `Devuelve SOLO un JSON válido (sin backticks) con claves: actividades, fechasClave y tareas para un proyecto escolar.
Descripción: "${descripcion}"
Docentes responsables: "${getTeacherNames(docentes)}"
Asignaturas: "${asignaturas.join(', ')}"
Estructura:
- actividades: 3 a 5 objetos { "nombre", "fechaInicio" (YYYY-MM-DD), "fechaFin" (YYYY-MM-DD), "responsables", "recursoUrl" }
- fechasClave: 2 a 3 objetos { "nombre", "fecha" (YYYY-MM-DD), "recursoUrl" }
- tareas: 2 a 3 objetos { "instrucciones", "fechaEntrega" (YYYY-MM-DD), "recursoUrl" }`;
        const res = await model.generateContent(prompt);
        const text = res.response.text().replace(/^```json\s*|```\s*$/g, '');
        const obj = JSON.parse(text);
        onEstructura({
          actividades: obj.actividades?.map((a: any) => ({ ...a, id: crypto.randomUUID() })),
          fechasClave: obj.fechasClave?.map((f: any) => ({ id: crypto.randomUUID(), nombre: f.nombre, fecha: f.fecha, recursoUrl: f.recursoUrl })),
          tareas: obj.tareas?.map((t: any, i: number) => ({ ...t, id: crypto.randomUUID(), numero: i+1 }))
        });
      }
    } catch (e) {
      console.error(e);
      alert('No se pudo completar la generación con IA.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2">
      <button type="button" onClick={()=>runAI('obj')} disabled={loading!==null} className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50 transition-colors" title="Generar objetivos con IA">
        {loading==='obj'? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" /> : <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
      </button>
      <button type="button" onClick={()=>runAI('ind')} disabled={loading!==null} className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50 transition-colors" title="Generar indicadores con IA">
        {loading==='ind'? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" /> : <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
      </button>
      <button type="button" onClick={()=>runAI('est')} disabled={loading!==null} className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold py-2 px-3 rounded-lg disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed hover:from-sky-600 hover:to-blue-700 transition-all duration-200 shadow-lg">
        {loading==='est'? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> <span>Generando...</span></>) : (<><Sparkles className="w-4 h-4" /> <span>Estructura IA</span></>)}
      </button>
    </div>
  );
};

/* =========================
   Formulario de Planificación (con recursos)
   ========================= */
const PlanificacionForm: React.FC<{
  initialPlan: PlanificacionExtendida | null;
  onSave: (plan: Omit<PlanificacionExtendida, 'id'> | PlanificacionExtendida) => void;
  onCancel: () => void;
  availableTeachers: AppUser[];
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

  const [newActivity, setNewActivity] = useState<Omit<ActividadWithResource, 'id'>>({ nombre: '', fechaInicio: '', fechaFin: '', responsables: '', asignaturaPrincipal: '', recursoUrl: '' });
  const [newFechaClave, setNewFechaClave] = useState<Omit<FechaClaveWithResource, 'id'>>({ nombre: '', fecha: '', recursoUrl: '' });
  const [newTarea, setNewTarea] = useState({ instrucciones: '', fechaEntrega: '', recursoUrl: '' });

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

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAsignaturaToggle = (asignatura: string) => {
    setFormData(prev => {
      const current = prev.asignaturas;
      const next = current.includes(asignatura) ? current.filter(a=>a!==asignatura) : [...current, asignatura];
      let contenidos = prev.contenidosPorAsignatura;
      if (next.includes(asignatura) && !current.includes(asignatura)) contenidos = [...contenidos, { asignatura, contenidos: '', habilidades: [] }];
      if (!next.includes(asignatura) && current.includes(asignatura)) contenidos = contenidos.filter(c=>c.asignatura!==asignatura);
      return { ...prev, asignaturas: next, contenidosPorAsignatura: contenidos };
    });
  };

  const handleCursoToggle = (curso: string) => setFormData(prev => ({ ...prev, cursos: prev.cursos.includes(curso) ? prev.cursos.filter(c=>c!==curso) : [...prev.cursos, curso] }));
  const handleTeacherToggle = (id: string) => setFormData(prev => ({ ...prev, docentesResponsables: prev.docentesResponsables.includes(id) ? prev.docentesResponsables.filter(x=>x!==id) : [...prev.docentesResponsables, id] }));
  const handleContenidoChange = (asig: string, field: 'contenidos', value: string) =>
    setFormData(prev => ({ ...prev, contenidosPorAsignatura: prev.contenidosPorAsignatura.map(c => c.asignatura===asig ? { ...c, [field]: value } : c) }));
  const handleHabilidadToggle = (asig: string, habilidad: string) =>
    setFormData(prev => ({ ...prev, contenidosPorAsignatura: prev.contenidosPorAsignatura.map(c => c.asignatura===asig ? { ...c, habilidades: c.habilidades.includes(habilidad) ? c.habilidades.filter(h=>h!==habilidad) : [...c.habilidades, habilidad] } : c) }));

  const handleAddActivity = () => {
    if (!newActivity.nombre || !newActivity.fechaInicio || !newActivity.fechaFin) { alert('Nombre y fechas son obligatorios.'); return; }
    setFormData(prev => ({ ...prev, actividades: [...(prev.actividades || []), { ...newActivity, id: crypto.randomUUID() }] }));
    setNewActivity({ nombre: '', fechaInicio: '', fechaFin: '', responsables: '', asignaturaPrincipal: '', recursoUrl: '' });
  };
  const handleAddFechaClave = () => {
    if (!newFechaClave.nombre || !newFechaClave.fecha) return;
    setFormData(prev => ({ ...prev, fechasClave: [...(prev.fechasClave || []), { ...newFechaClave, id: crypto.randomUUID() }] }));
    setNewFechaClave({ nombre: '', fecha: '', recursoUrl: '' });
  };
  const handleAddTarea = () => {
    if (!newTarea.instrucciones || !newTarea.fechaEntrega) { alert('Instrucciones y fecha son obligatorios.'); return; }
    const tarea = { id: crypto.randomUUID(), numero: (formData.tareas?.length || 0) + 1, ...newTarea } as any;
    setFormData(prev => ({ ...prev, tareas: [...(prev.tareas || []), tarea] }));
    setNewTarea({ instrucciones: '', fechaEntrega: '', recursoUrl: '' });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl"><GraduationCap className="w-10 h-10 text-white" /></div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{initialPlan ? 'Editando Proyecto' : 'Nuevo Proyecto Interdisciplinario'}</h1>
        </div>
        <p className="text-lg text-slate-600 dark:text-slate-400">Diseñe experiencias de aprendizaje colaborativo e innovador</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-6">
          <FormCard icon={<FileText className="w-6 h-6 text-slate-600" />} label="Información del Proyecto" aiButton={
            <AIButtons
              descripcion={formData.descripcionProyecto}
              asignaturas={formData.asignaturas}
              docentes={formData.docentesResponsables}
              availableTeachers={[] as any}
              onObjetivos={(txt)=> setFormData(prev=>({...prev, objetivos: txt}))}
              onIndicadores={(txt)=> setFormData(prev=>({...prev, indicadoresLogro: txt}))}
              onEstructura={(payload)=> setFormData(prev=>({...prev,
                actividades: payload.actividades?.length ? payload.actividades as any : prev.actividades,
                fechasClave: payload.fechasClave?.length ? payload.fechasClave as any : prev.fechasClave,
                tareas: payload.tareas?.length ? payload.tareas as any : prev.tareas
              }))}
            />
          }>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Nombre del Proyecto</label>
                <input name="nombreProyecto" value={formData.nombreProyecto} onChange={handleChange} placeholder="Ingrese el nombre del proyecto..." className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg font-semibold" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Descripción del Proyecto</label>
                <textarea name="descripcionProyecto" value={formData.descripcionProyecto} onChange={handleChange} placeholder="Detalle metodología, producto final y propósito..." className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[120px] resize-none" />
              </div>
            </div>
          </FormCard>

          <FormCard icon={<Users className="w-6 h-6 text-slate-600" />} label="Profesores Responsables">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {availableTeachers.map(t => (
                  <button key={t.id} type="button" onClick={()=>{
                    setFormData(prev => ({
                      ...prev,
                      docentesResponsables: prev.docentesResponsables.includes(t.id)
                        ? prev.docentesResponsables.filter(x=>x!==t.id)
                        : [...prev.docentesResponsables, t.id]
                    }));
                  }} className={`p-3 rounded-lg text-left transition-all duration-200 ${formData.docentesResponsables.includes(t.id) ? 'bg-blue-100 border-2 border-blue-500 text-blue-800 dark:bg-blue-900/50 dark:border-blue-400 dark:text-blue-300' : 'bg-slate-50 border-2 border-slate-200 hover:border-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:border-slate-500'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${formData.docentesResponsables.includes(t.id) ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-300'}`}>
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{t.nombreCompleto}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.email}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </FormCard>

          <FormCard icon={<Building2 className="w-6 h-6 text-slate-600" />} label="Cursos Participantes">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {CURSOS.map(curso => (
                <button type="button" key={curso} onClick={()=>{
                  setFormData(prev => ({
                    ...prev,
                    cursos: prev.cursos.includes(curso) ? prev.cursos.filter(c=>c!==curso) : [...prev.cursos, curso]
                  }));
                }} className={`p-3 rounded-lg text-center text-sm font-semibold transition-all duration-200 ${formData.cursos.includes(curso) ? 'bg-amber-500 text-white shadow-lg scale-105' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'}`}>
                  {curso}
                </button>
              ))}
            </div>
          </FormCard>
        </div>

        <div className="space-y-6">
          <FormCard icon={<BookOpen className="w-6 h-6 text-slate-600" />} label="Asignaturas y Contenidos">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Seleccionar Asignaturas:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ASIGNATURAS.map(asignatura => (
                    <button type="button" key={asignatura} onClick={()=>{
                      setFormData(prev => {
                        const current = prev.asignaturas;
                        const next = current.includes(asignatura) ? current.filter(a=>a!==asignatura) : [...current, asignatura];
                        let contenidos = prev.contenidosPorAsignatura;
                        if (next.includes(asignatura) && !current.includes(asignatura)) contenidos = [...contenidos, { asignatura, contenidos: '', habilidades: [] }];
                        if (!next.includes(asignatura) && current.includes(asignatura)) contenidos = contenidos.filter(c=>c.asignatura!==asignatura);
                        return { ...prev, asignaturas: next, contenidosPorAsignatura: contenidos };
                      });
                    }} className={`p-2 rounded-lg text-left text-sm font-medium transition-all duration-200 ${formData.asignaturas.includes(asignatura) ? 'bg-green-500 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'}`}>
                      {asignatura}
                    </button>
                  ))}
                </div>
              </div>

              {formData.contenidosPorAsignatura.length > 0 && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contenidos y Habilidades por Asignatura:</h4>
                  {formData.contenidosPorAsignatura.map(contenido => (
                    <div key={contenido.asignatura} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                      <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" /> {contenido.asignatura}</h5>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Contenidos a trabajar:</label>
                          <textarea value={contenido.contenidos} onChange={(e)=>handleContenidoChange(contenido.asignatura, 'contenidos', e.target.value)} placeholder={`Detalle los contenidos específicos de ${contenido.asignatura}...`} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm min-h-[80px] resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Habilidades según Taxonomía de Bloom:</label>
                          <div className="space-y-2">
                            {Object.entries(BLOOM_TAXONOMY).map(([categoria, habilidades]) => (
                              <div key={categoria} className="border border-slate-200 dark:border-slate-600 rounded-md p-2">
                                <h6 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{categoria}:</h6>
                                <div className="flex flex-wrap gap-1">
                                  {habilidades.map(h => (
                                    <button key={h} type="button" onClick={()=>handleHabilidadToggle(contenido.asignatura, h)} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${contenido.habilidades.includes(h) ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500'}`}>
                                      {h}
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
                                {contenido.habilidades.map(h => <span key={h} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded text-xs">{h}</span>)}
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

          <FormCard icon={<Target className="w-6 h-6 text-slate-600" />} label="Objetivos de Aprendizaje">
            <textarea name="objetivos" value={formData.objetivos} onChange={handleChange} placeholder="Liste los objetivos de aprendizaje..." className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[120px] resize-none" />
          </FormCard>

          <FormCard icon={<BarChart3 className="w-6 h-6 text-slate-600" />} label="Indicadores de Éxito">
            <textarea name="indicadoresLogro" value={formData.indicadoresLogro} onChange={handleChange} placeholder="Liste los indicadores de logro..." className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[120px] resize-none" />
          </FormCard>

          <FormCard icon={<Calendar className="w-6 h-6 text-slate-600" />} label="Planificación y Cronograma">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3"><Clock className="w-5 h-5 text-slate-600 dark:text-slate-400" /><h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Actividades del Proyecto</h4></div>
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nombre</label>
                      <input value={newActivity.nombre} onChange={e=>setNewActivity({...newActivity, nombre: e.target.value})} placeholder="Nombre de la actividad" className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm" />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Inicio</label>
                      <input type="date" value={newActivity.fechaInicio} onChange={e=>setNewActivity({...newActivity, fechaInicio: e.target.value})} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm" />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fin</label>
                      <input type="date" value={newActivity.fechaFin} onChange={e=>setNewActivity({...newActivity, fechaFin: e.target.value})} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm" />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Recurso (enlace)</label>
                      <input value={newActivity.recursoUrl || ''} onChange={e=>setNewActivity({...newActivity, recursoUrl: e.target.value})} placeholder="https://..." className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm" />
                    </div>
                    <div className="lg:col-span-2">
                      <button type="button" onClick={handleAddActivity} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-4 h-4" /> Agregar
                      </button>
                    </div>
                  </div>
                  {!!formData.actividades.length && (
                    <div className="mt-4">
                      <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Actividades Agregadas:</h5>
                      <div className="space-y-2">
                        {formData.actividades.map(a => (
                          <div key={a.id} className="p-2 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 text-sm">
                            <div className="flex justify-between items-center gap-2">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{a.nombre}</span>
                              <span className="text-slate-500 dark:text-slate-400 text-xs">{a.fechaInicio} - {a.fechaFin}</span>
                              <ExternalLink href={a.recursoUrl} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3"><CheckCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" /><h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Fechas Clave (Hitos)</h4></div>
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nombre del Hito</label>
                      <input value={newFechaClave.nombre} onChange={e=>setNewFechaClave({...newFechaClave, nombre: e.target.value})} placeholder="Nombre del hito" className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fecha</label>
                      <input type="date" value={newFechaClave.fecha} onChange={e=>setNewFechaClave({...newFechaClave, fecha: e.target.value})} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm" />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Recurso (enlace)</label>
                      <input value={newFechaClave.recursoUrl || ''} onChange={e=>setNewFechaClave({...newFechaClave, recursoUrl: e.target.value})} placeholder="https://..." className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm" />
                    </div>
                    <button type="button" onClick={handleAddFechaClave} className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-4 h-4" /> Agregar
                    </button>
                  </div>
                  {!!formData.fechasClave.length && (
                    <div className="mt-4">
                      <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Fechas Clave Agregadas:</h5>
                      <div className="space-y-2">
                        {formData.fechasClave.map(f => (
                          <div key={f.id} className="p-2 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 text-sm">
                            <div className="flex justify-between items-center gap-2">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{f.nombre}</span>
                              <span className="text-slate-500 dark:text-slate-400 text-xs">{f.fecha}</span>
                              <ExternalLink href={f.recursoUrl} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3"><Brain className="w-5 h-5 text-slate-600 dark:text-slate-400" /><h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Tareas para Estudiantes</h4></div>
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                    <div className="lg:col-span-5">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Instrucciones de la Tarea</label>
                      <input value={newTarea.instrucciones} onChange={e=>setNewTarea({...newTarea, instrucciones: e.target.value})} placeholder="Descripción detallada de la tarea" className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm" />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fecha de Entrega</label>
                      <input type="date" value={newTarea.fechaEntrega} onChange={e=>setNewTarea({...newTarea, fechaEntrega: e.target.value})} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm" />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Recurso (enlace)</label>
                      <input value={newTarea.recursoUrl || ''} onChange={e=>setNewTarea({...newTarea, recursoUrl: e.target.value})} placeholder="https://..." className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm" />
                    </div>
                    <div className="lg:col-span-1">
                      <button type="button" onClick={handleAddTarea} className="w-full bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-4 h-4" /> Agregar
                      </button>
                    </div>
                  </div>
                  {!!formData.tareas.length && (
                    <div className="mt-4">
                      <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Tareas Agregadas:</h5>
                      <div className="space-y-2">
                        {formData.tareas.map(t => (
                          <div key={t.id} className="p-3 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1">
                                <span className="inline-block bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 text-xs font-bold px-2 py-1 rounded mb-1">Tarea #{t.numero}</span>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{t.instrucciones}</p>
                              </div>
                              <div className="text-right space-y-1">
                                <span className="block text-slate-500 dark:text-slate-400 text-xs">{t.fechaEntrega}</span>
                                {'recursoUrl' in t ? <ExternalLink href={(t as any).recursoUrl} /> : <span className="text-slate-400 text-xs">—</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-slate-200 dark:border-slate-700">
              <button onClick={onCancel} className="px-8 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 transition-colors order-2 sm:order-1">Cancelar</button>
              <button onClick={()=> onSave(formData)} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg order-1 sm:order-2">
                {initialPlan ? 'Guardar Cambios' : 'Crear Proyecto'}
              </button>
            </div>
          </FormCard>
        </div>
      </div>
    </div>
  );
};

/* =========================
   Vista principal con tabs (Proyectos | Dashboard)
   ========================= */
type ViewMode = 'list' | 'form' | 'dashboard';

const Interdisciplinario: React.FC = () => {
  const [planificaciones, setPlanificaciones] = useState<PlanificacionExtendida[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [editingPlan, setEditingPlan] = useState<PlanificacionExtendida | null>(null);
  const [isExportingId, setIsExportingId] = useState<string | null>(null);
  const [viewingSubmissionsForPlan, setViewingSubmissionsForPlan] = useState<PlanificacionExtendida | null>(null);
  const [timelineFilterId, setTimelineFilterId] = useState<'all' | string>('all');

  // ✅ useMemo declarado ARRIBA (top-level), nunca tras returns condicionales
  const filteredForGantt = useMemo(() => {
    if (timelineFilterId === 'all') return planificaciones;
    return planificaciones.filter(p => p.id === timelineFilterId);
  }, [planificaciones, timelineFilterId]);

  useEffect(() => {
    setLoading(true);
    const unsubscribeTeachers = subscribeToAllUsers((users) => {
      const teachers = users.filter(u => u.profile === Profile.PROFESORADO);
      setAvailableTeachers(teachers);
    });
    const unsubscribePlans = subscribeToPlanificaciones((data) => {
      const converted = data.map(plan => ({
        ...plan,
        docentesResponsables: Array.isArray(plan.docentesResponsables) ? plan.docentesResponsables : [plan.docentesResponsables].filter(Boolean),
        contenidosPorAsignatura: plan.contenidosPorAsignatura || [],
        actividades: (plan.actividades || []) as any,
        fechasClave: (plan.fechasClave || []) as any
      })) as PlanificacionExtendida[];
      setPlanificaciones(converted);
      setLoading(false);
    });
    return () => { unsubscribeTeachers(); unsubscribePlans(); };
  }, []);

  const handleActivityUpdate = useCallback(async (planId: string, activity: ActividadWithResource) => {
    const plan = planificaciones.find(p => p.id === planId);
    if (!plan) return;
    const updated = { ...plan, actividades: (plan.actividades || []).map(a => a.id === activity.id ? activity : a) };
    await updatePlanificacion(planId, updated as any);
  }, [planificaciones]);

  const handleSave = async (plan: Omit<PlanificacionExtendida, 'id'> | PlanificacionExtendida) => {
    try {
      const isEdit = (plan as any).id && String((plan as any).id).length > 0;
      const dataToPersist: any = { ...plan };
      if (isEdit) {
        const { id, ...rest } = dataToPersist;
        await updatePlanificacion((plan as any).id, rest);
      } else {
        delete dataToPersist.id;
        await createPlanificacion(dataToPersist);
      }
      setView('list'); setEditingPlan(null);
    } catch (e) {
      console.error('Error al guardar la planificación:', e);
      alert('No se pudo guardar la planificación.');
    }
  };

  const handleEdit = (plan: PlanificacionExtendida) => { setEditingPlan(plan); setView('form'); };
  const handleDelete = async (id: string) => {
    if (!id) { alert('Error: ID inválido.'); return; }
    if (window.confirm('¿Está seguro de eliminar esta planificación?')) {
      try { await deletePlanificacion(id); } catch (e) { console.error(e); alert('No se pudo eliminar la planificación.'); }
    }
  };
  const handleCreateNew = () => { setEditingPlan(null); setView('form'); };

  const handleExportProjectPDF = async (plan: PlanificacionExtendida) => {
    setIsExportingId(plan.id);
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let y = margin + 20;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(0);
    const titleLines = doc.splitTextToSize(plan.nombreProyecto, contentWidth); doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 10;

    const getTeacherNames = (ids: string[]) => ids.map(id => (availableTeachers.find(t=>t.id===id)?.nombreCompleto || id)).join(', ');
    autoTable(doc, {
      startY: y,
      body: [
        [{ content: 'Docentes Responsables:', styles: { fontStyle: 'bold' } }, getTeacherNames(plan.docentesResponsables)],
        [{ content: 'Cursos Involucrados:', styles: { fontStyle: 'bold' } }, plan.cursos.join(', ')],
        [{ content: 'Asignaturas:', styles: { fontStyle: 'bold' } }, plan.asignaturas.join(', ')]
      ],
      theme: 'grid',
      styles: { fontSize: 11, cellPadding: 3, lineColor: [220, 220, 220] },
      columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } }
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 15;

    const addSection = (title: string, content?: string | string[]) => {
      if (!content || (Array.isArray(content) && !content.length) || (typeof content === 'string' && !content.trim())) return;
      const text = Array.isArray(content) ? content.join(', ') : String(content);
      const lines = doc.splitTextToSize(text, contentWidth);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(40); doc.text(title, margin, y); y += 8;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(80); doc.text(lines, margin, y); y += lines.length * 5 + 10;
    };

    addSection('Descripción del Proyecto', plan.descripcionProyecto);
    addSection('Objetivos de Aprendizaje', plan.objetivos);
    addSection('Indicadores de Logro', plan.indicadoresLogro);

    if (plan.contenidosPorAsignatura && plan.contenidosPorAsignatura.length > 0) {
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('Contenidos por Asignatura', margin, y); y += 10;
      plan.contenidosPorAsignatura.forEach(c => {
        doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text(`${c.asignatura}:`, margin, y); y += 6;
        doc.setFont('helvetica','normal'); doc.setFontSize(11);
        if (c.contenidos) { const lines = doc.splitTextToSize(`Contenidos: ${c.contenidos}`, contentWidth - 10); doc.text(lines, margin + 5, y); y += lines.length * 5 + 3; }
        if (c.habilidades?.length) { const text = `Habilidades: ${c.habilidades.join(', ')}`; const lines = doc.splitTextToSize(text, contentWidth - 10); doc.text(lines, margin + 5, y); y += lines.length * 5 + 8; }
      });
      y += 10;
    }

    if (plan.actividades && plan.actividades.length > 0) {
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('Actividades', margin, y); y += 10;
      autoTable(doc, { startY: y, head: [['Actividad','Inicio','Fin','Recurso']], body: plan.actividades.map(a => [a.nombre, a.fechaInicio, a.fechaFin, a.recursoUrl || '—']), theme: 'striped' });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (plan.fechasClave && plan.fechasClave.length > 0) {
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('Fechas Clave', margin, y); y += 10;
      autoTable(doc, { startY: y, head: [['Hito','Fecha','Recurso']], body: plan.fechasClave.map(f => [f.nombre, f.fecha, f.recursoUrl || '—']), theme: 'striped' });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (plan.tareas && plan.tareas.length > 0) {
      const tasksBody = plan.tareas.map((t: any) => [String(t.numero || ''), t.instrucciones, t.fechaEntrega, t.recursoUrl || '—']);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('Tareas para Estudiantes', margin, y); y += 10;
      autoTable(doc, { startY: y, head: [['#', 'Instrucciones', 'Entrega', 'Recurso']], body: tasksBody, theme: 'striped', headStyles: { fillColor: [52,73,94] } });
    }

    doc.save(`Proyecto_${plan.nombreProyecto.replace(/\s/g,'_')}.pdf`);
    setIsExportingId(null);
  };

  const getTeacherNames = (ids: string[]) => ids.map(id => (availableTeachers.find(t=>t.id===id)?.nombreCompleto || id)).join(', ');

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
    return <SubmissionsViewer plan={viewingSubmissionsForPlan} onBack={()=>setViewingSubmissionsForPlan(null)} availableTeachers={availableTeachers} />;
  }

  if (view === 'dashboard') {
    return <div className="space-y-8">
      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <button type="button" onClick={()=>setView('list')} className="px-4 py-2 rounded-xl font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
            Proyectos
          </button>
          <button type="button" className="px-4 py-2 rounded-xl font-semibold bg-gradient-to-r from-green-600 to-teal-600 text-white shadow">
            Dashboard
          </button>
        </div>
      </div>
      <Dashboard planificaciones={planificaciones} onBack={()=>setView('list')} />
    </div>;
  }

  if (view === 'form') {
    return <div className="space-y-8">
      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <button type="button" onClick={()=>{ setView('list'); setEditingPlan(null); }} className="px-4 py-2 rounded-xl font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
            Proyectos
          </button>
          <button type="button" onClick={()=>setView('dashboard')} className="px-4 py-2 rounded-xl font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
            Dashboard
          </button>
        </div>
      </div>
      <PlanificacionForm initialPlan={editingPlan} onSave={handleSave} onCancel={()=>{ setView('list'); setEditingPlan(null); }} availableTeachers={availableTeachers} />
    </div>;
  }

  // view === 'list'
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <button type="button" className="px-4 py-2 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow">
            Proyectos
          </button>
          <button type="button" onClick={()=>setView('dashboard')} className="px-4 py-2 rounded-xl font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
            Dashboard
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl"><GraduationCap className="w-8 h-8 text-white" /></div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Proyectos Interdisciplinarios</h1>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-400">Gestione experiencias de aprendizaje colaborativo e innovador</p>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={()=>setView('dashboard')} className="inline-flex items-center gap-3 bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-700 hover:to-teal-700 transition-all duration-200 shadow-lg">
              <TrendingUp className="w-5 h-5" /> Ver Dashboard
            </button>
            <button type="button" onClick={handleCreateNew} className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg">
              <Plus className="w-5 h-5" /> Crear Nuevo Proyecto
            </button>
          </div>
        </div>

        {planificaciones.length === 0 ? (
          <div className="text-center py-16">
            <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <GraduationCap className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">No hay proyectos creados</h3>
            <p className="text-slate-500 dark:text-slate-500 mb-6">Comience creando su primer proyecto interdisciplinario</p>
            <button type="button" onClick={handleCreateNew} className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> Crear Primer Proyecto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {planificaciones.map(plan => (
              <div key={plan.id} className="group bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-xl text-slate-800 dark:text-slate-200 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{plan.nombreProyecto}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Building2 className="w-4 h-4" /><span>Cursos: {plan.cursos.join(', ')}</span></div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Users className="w-4 h-4" /><span>Profesores: {getTeacherNames(plan.docentesResponsables)}</span></div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><BookOpen className="w-4 h-4" /><span>Asignaturas: {plan.asignaturas.length}</span></div>
                    </div>
                  </div>
                </div>

                {!!plan.descripcionProyecto && <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">{plan.descripcionProyecto}</p>}

                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-600">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={()=>setViewingSubmissionsForPlan(plan)} className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-semibold text-sm transition-colors" title="Ver entregas de estudiantes">
                      <CheckCircle className="w-4 h-4" /> Entregas
                    </button>
                    <button type="button" onClick={()=>handleExportProjectPDF(plan)} disabled={isExportingId===plan.id} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold text-sm transition-colors disabled:opacity-50" title="Exportar a PDF">
                      {isExportingId===plan.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" /> : <Download className="w-4 h-4" />}
                      PDF
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={()=>handleEdit(plan)} className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors" title="Editar proyecto">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={()=>handleDelete(plan.id)} className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors" title="Eliminar proyecto">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {planificaciones.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutList className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-800">Cronograma (Gantt)</h3>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Proyecto:</label>
              <select value={timelineFilterId} onChange={(e)=> setTimelineFilterId(e.target.value as any)} className="p-2 border border-slate-300 rounded-lg bg-white dark:bg-slate-700 text-sm">
                <option value="all">Todos</option>
                {planificaciones.map(p => (<option key={p.id} value={p.id}>{p.nombreProyecto}</option>))}
              </select>
            </div>
          </div>

          <div id="gantt-container-vertical">
            <ProjectTimeline planificaciones={filteredForGantt} onActivityUpdate={handleActivityUpdate} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Interdisciplinario;
