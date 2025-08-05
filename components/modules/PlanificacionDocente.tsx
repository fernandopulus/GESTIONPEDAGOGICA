// Hook local para planificaciones de unidad y clase
const usePlanificaciones = (userId: string) => {
  const [planificaciones, setPlanificaciones] = useState<(PlanificacionUnidad | PlanificacionClase)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const unsubscribe = subscribeToPlanificaciones(userId, (data) => {
      setPlanificaciones(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  const save = async (plan: Omit<PlanificacionUnidad | PlanificacionClase, 'id'>) => {
    try {
      setError(null);
      return await savePlanificacion(plan, userId);
    } catch (err: any) {
      setError(err.message || 'Error al guardar planificación');
      throw err;
    }
  };

  const update = async (id: string, updates: Partial<PlanificacionUnidad | PlanificacionClase>) => {
    try {
      setError(null);
      await updatePlanificacion(id, updates, userId);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar planificación');
      throw err;
    }
  };

  const remove = async (id: string) => {
    try {
      setError(null);
      await deletePlanificacion(id, userId);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar planificación');
      throw err;
    }
  };

  return { planificaciones, loading, error, save, update, remove };
};

import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import type { PlanificacionUnidad, PlanificacionClase, DetalleLeccion, ActividadPlanificada, TareaActividad, User, NivelPlanificacion, ActividadFocalizadaEvent, MomentosClase, PlanificacionDocente } from '../../types';
import { useMemo } from 'react';
import { EventType } from '../../types';
import { GoogleGenerativeAI } from '@google/generative-ai';
// import { saveCalendarEvent } from '../../src/firebaseHelpers/calendar'; // Función no disponible
// Firebase helpers
import {
  savePlanificacion,
  updatePlanificacion,
  deletePlanificacion,
  subscribeToPlanificaciones,
  saveActividad,
  subscribeToActividades
} from '../../src/firebaseHelpers/planificacionHelper';

// Función de logging simple
const logApiCall = (action: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] API Call: ${action}`);
};

// Hook para manejar actividades con Firebase
const useActividades = (userId: string) => {
  const [actividades, setActividades] = useState<ActividadPlanificada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToActividades(userId, (data) => {
      setActividades(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const save = useCallback(async (actividad: Omit<ActividadPlanificada, 'id'>) => {
    try {
      setError(null);
      return await saveActividad(actividad, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar actividad');
      throw err;
    }
  }, [userId]);

  return { actividades, loading, error, save };
};

// ===== SUB-COMPONENTES =====

// EditLessonModal
interface EditLessonModalProps {
  lesson: DetalleLeccion;
  onClose: () => void;
  onSave: (updatedLesson: DetalleLeccion) => void;
  isLoading?: boolean;
}

const EditLessonModal: React.FC<EditLessonModalProps> = ({ lesson, onClose, onSave, isLoading = false }) => {
  const [editedLesson, setEditedLesson] = useState<DetalleLeccion>(lesson);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedLesson({ ...editedLesson, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      await onSave(editedLesson);
      onClose();
    } catch (error) {
      console.error('Error al guardar lección:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 p-6 border-b dark:border-slate-700">Editar Detalle de Lección</h2>
        <div className="p-6 space-y-4 overflow-y-auto">
          {Object.entries(editedLesson).map(([key, value]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 capitalize mb-1">
                {key.replace(/([A-Z])/g, ' $1')}
              </label>
              <textarea
                name={key}
                value={value as string}
                onChange={handleChange}
                rows={3}
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                disabled={isLoading}
              />
            </div>
          ))}
        </div>
        <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 rounded-b-xl flex justify-end gap-3 mt-auto">
          <button 
            onClick={onClose} 
            className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 disabled:opacity-50"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit} 
            className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

// LessonPlanViewer
interface LessonPlanViewerProps {
  plan: PlanificacionUnidad;
  onEditLesson: (lessonIndex: number, lesson: DetalleLeccion) => void;
  onUseLesson: (lesson: DetalleLeccion, unitPlan: PlanificacionUnidad) => void;
  onUpdatePlan?: (id: string, updates: Partial<PlanificacionUnidad>) => Promise<void>;
  isLoading?: boolean;
}

const LessonPlanViewer: React.FC<LessonPlanViewerProps> = ({ plan, onEditLesson, onUseLesson, isLoading = false, onUpdatePlan }) => {
  const [progreso, setProgreso] = useState<number>(plan.progreso ?? 0);
  const [saving, setSaving] = useState(false);
  
  const handleProgresoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setProgreso(value);
    setSaving(true);
    try {
      if (plan.id && onUpdatePlan) {
        // Usar la función del hook principal en lugar de importar directamente
        await onUpdatePlan(plan.id, { progreso: value });
        console.log('✅ Progreso actualizado exitosamente');
      }
    } catch (err) {
      console.error('❌ Error completo:', err);
      alert(`Error al guardar el avance: ${err.message}`);
      // Revertir el progreso en caso de error
      setProgreso(plan.progreso ?? 0);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
        <p><strong>Objetivo de Aprendizaje:</strong> {plan.objetivosAprendizaje}</p>
        <p><strong>Indicadores de Evaluación:</strong> {plan.indicadoresEvaluacion}</p>
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Avance de la Unidad</label>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={100} value={progreso} onChange={handleProgresoChange} disabled={saving || isLoading} />
            <span className="font-bold w-12">{progreso}%</span>
            {saving && <span className="text-xs text-slate-400">Guardando...</span>}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {plan.detallesLeccion.map((lesson, index) => (
          <div key={index} className="p-4 border dark:border-slate-700 rounded-lg">
            <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200">
              Clase {index + 1}: {lesson.actividades}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-2 text-sm">
              <p><strong>Objetivo:</strong> {lesson.objetivosAprendizaje}</p>
              <p><strong>Contenidos:</strong> {lesson.contenidosConceptuales}</p>
              <p><strong>Habilidad (Bloom):</strong> {lesson.habilidadesBloom}</p>
              <p><strong>Perfil de Egreso:</strong> {lesson.perfilEgreso}</p>
              <p><strong>Interdisciplinariedad:</strong> {lesson.asignaturasInterdisciplinariedad}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => onEditLesson(index, lesson)} 
                className="text-sm font-semibold bg-slate-200 dark:bg-slate-600 py-1 px-3 rounded-md hover:bg-slate-300 disabled:opacity-50"
                disabled={isLoading}
              >
                Editar
              </button>
              <button 
                onClick={() => onUseLesson(lesson, plan)} 
                className="text-sm font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 py-1 px-3 rounded-md hover:bg-blue-200 disabled:opacity-50"
                disabled={isLoading}
              >
                Usar para Plan de Clase
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ClassPlanViewer
interface ClassPlanViewerProps {
  plan: PlanificacionClase;
  onBack: () => void;
  onSave: (updatedPlan: PlanificacionClase) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

const ClassPlanViewer: React.FC<ClassPlanViewerProps> = ({ plan, onBack, onSave, onDelete, isLoading = false }) => {
  const [editablePlan, setEditablePlan] = useState<PlanificacionClase>(plan);
  const [saving, setSaving] = useState(false);
  // Eliminar lógica de progreso para clase
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    const [moment, momentKey] = name.split('.') as [string, string];
    if (moment === 'momentosClase') {
      setEditablePlan(prev => ({
        ...prev,
        momentosClase: {
          ...prev.momentosClase,
          [momentKey]: value,
        }
      }));
    } else {
      setEditablePlan(prev => ({ ...prev, [name]: value } as PlanificacionClase));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editablePlan);
    } catch (error) {
      console.error('Error al guardar plan de clase:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{plan.nombreClase}</h2>
        <button 
          onClick={onBack} 
          className="text-slate-600 hover:text-slate-900 font-semibold disabled:opacity-50"
          disabled={isLoading || saving}
        >
          &larr; Volver
        </button>
      </div>
      <div className="space-y-6">
        <div>
          <label className="font-bold text-lg text-slate-700 dark:text-slate-300">Inicio</label>
          <textarea 
            name="momentosClase.inicio" 
            value={editablePlan.momentosClase.inicio} 
            onChange={handleChange} 
            rows={4} 
            className="w-full mt-2 p-2 border rounded-md bg-slate-50 dark:bg-slate-700"
            disabled={isLoading || saving}
          />
        </div>
        <div>
          <label className="font-bold text-lg text-slate-700 dark:text-slate-300">Desarrollo</label>
          <textarea 
            name="momentosClase.desarrollo" 
            value={editablePlan.momentosClase.desarrollo} 
            onChange={handleChange} 
            rows={8} 
            className="w-full mt-2 p-2 border rounded-md bg-slate-50 dark:bg-slate-700"
            disabled={isLoading || saving}
          />
        </div>
        <div>
          <label className="font-bold text-lg text-slate-700 dark:text-slate-300">Cierre</label>
          <textarea 
            name="momentosClase.cierre" 
            value={editablePlan.momentosClase.cierre} 
            onChange={handleChange} 
            rows={4} 
            className="w-full mt-2 p-2 border rounded-md bg-slate-50 dark:bg-slate-700"
            disabled={isLoading || saving}
          />
        </div>
        {/* Avance de la Clase eliminado, solo se permite en planificación de unidad */}
      </div>
      <div className="text-right mt-6">
        <div className="flex justify-between items-center">
          <button 
            onClick={() => onDelete(plan.id)} 
            className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            disabled={isLoading || saving}
          >
            🗑️ Eliminar Plan
          </button>
          <button 
            onClick={handleSave} 
            className="bg-amber-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
            disabled={isLoading || saving}
          >
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== SUBMÓDULO ACTIVIDADES CALENDARIO =====
interface ActividadesCalendarioProps {
  userId: string;
}

const ActividadesCalendarioSubmodule: React.FC<ActividadesCalendarioProps> = ({ userId }) => {
  const { actividades, save: saveActividad } = useActividades(userId);
  const [view, setView] = useState<'list' | 'form' | 'summary'>('list');
  const [currentActividad, setCurrentActividad] = useState<ActividadPlanificada | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddedToCalendar, setIsAddedToCalendar] = useState(false);

  const initialFormState = {
    nombre: '',
    fecha: '',
    hora: '',
    descripcion: '',
    ubicacion: '',
    participantes: '',
    recursosGenerales: '',
    tareas: [{ id: crypto.randomUUID(), descripcion: '', responsable: '', recursos: '' }],
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (view === 'summary' && currentActividad) {
      checkCalendarEvent();
    }
  }, [view, currentActividad, userId]);

  const checkCalendarEvent = async () => {
    if (!currentActividad) return;
    
    try {
      // Función checkEventExists no está disponible, siempre false por ahora
      setIsAddedToCalendar(false);
    } catch (error) {
      console.error("Error al verificar evento en calendario:", error);
    }
  };

  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleTareaChange = (id: string, field: keyof Omit<TareaActividad, 'id'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      tareas: prev.tareas.map(t => t.id === id ? { ...t, [field]: value } : t),
    }));
  };

  const handleAddTarea = () => {
    setFormData(prev => ({
      ...prev,
      tareas: [...prev.tareas, { id: crypto.randomUUID(), descripcion: '', responsable: '', recursos: '' }],
    }));
  };

  const handleRemoveTarea = (id: string) => {
    setFormData(prev => ({
      ...prev,
      tareas: prev.tareas.filter(t => t.id !== id),
    }));
  };
  
  const handleSaveActivity = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const prompt = `Basado en la siguiente información de una actividad, genera un objetivo claro y conciso para esta.
    - Nombre: ${formData.nombre}
    - Descripción: ${formData.descripcion}
    - Tareas: ${formData.tareas.map(t => t.descripcion).join(', ')}
    El objetivo debe ser breve, empezar con un verbo en infinitivo y enfocarse en el propósito principal de la actividad.`;
    
    try {
      logApiCall('Planificación - Actividad Calendario');
      
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        alert("La API Key de Gemini no está configurada.");
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const newActividad: Omit<ActividadPlanificada, 'id'> = {
        ...formData,
        objetivo: text.replace(/(\*\*|\*)/g, ''),
      };

      const actividadId = await saveActividad(newActividad);
      
      // Crear el objeto con ID para mostrar en summary
      const actividadCompleta: ActividadPlanificada = {
        ...newActividad,
        id: actividadId,
      };

      setCurrentActividad(actividadCompleta);
      setView('summary');
    } catch (error) {
      console.error("Error al generar objetivo con IA:", error);
      alert("Hubo un error al generar el objetivo. La actividad se guardará sin él.");
      
      try {
        const newActividad: Omit<ActividadPlanificada, 'id'> = { 
          ...formData, 
          objetivo: 'No generado' 
        };
        const actividadId = await saveActividad(newActividad);
        
        const actividadCompleta: ActividadPlanificada = {
          ...newActividad,
          id: actividadId,
        };
        
        setCurrentActividad(actividadCompleta);
        setView('summary');
      } catch (saveError) {
        console.error("Error al guardar actividad:", saveError);
        alert("Error al guardar la actividad. Por favor, intente nuevamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddToCalendar = async (actividad: ActividadPlanificada) => {
    if (!actividad) return;

    // const newEvent: Omit<ActividadFocalizadaEvent, 'id'> = {
    //   date: actividad.fecha,
    //   type: EventType.ACTIVIDAD_FOCALIZADA,
    //   responsables: actividad.nombre,
    //   ubicacion: actividad.ubicacion,
    //   horario: actividad.hora,
    // };

    try {
      // await saveCalendarEvent(newEvent, userId); // Función no disponible
      // Implementación temporal - solo actualiza el estado
      setIsAddedToCalendar(true);
      alert("Actividad marcada como añadida al calendario (funcionalidad en desarrollo).");
    } catch (error) {
      console.error("Error adding to calendar:", error);
      alert("Hubo un error al agregar la actividad al calendario.");
    }
  };
  
  const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white";

  if (view === 'form') {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <form onSubmit={handleSaveActivity} className="space-y-8">
          {/* General Info */}
          <div className="p-4 border rounded-lg dark:border-slate-700">
            <h3 className="text-lg font-bold mb-4">Información General</h3>
            <div className="space-y-4">
              <input 
                name="nombre" 
                value={formData.nombre} 
                onChange={handleFormChange} 
                placeholder="Nombre de la Actividad" 
                className={inputStyles} 
                required
                disabled={isLoading}
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  name="fecha" 
                  type="date" 
                  value={formData.fecha} 
                  onChange={handleFormChange} 
                  className={inputStyles} 
                  required
                  disabled={isLoading}
                />
                <input 
                  name="hora" 
                  type="time" 
                  value={formData.hora} 
                  onChange={handleFormChange} 
                  className={inputStyles} 
                  required
                  disabled={isLoading}
                />
              </div>
              <textarea 
                name="descripcion" 
                value={formData.descripcion} 
                onChange={handleFormChange} 
                placeholder="Descripción (objetivos, contenidos, metodología)" 
                rows={4} 
                className={inputStyles} 
                required
                disabled={isLoading}
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  name="ubicacion" 
                  value={formData.ubicacion} 
                  onChange={handleFormChange} 
                  placeholder="Ubicación" 
                  className={inputStyles} 
                  required
                  disabled={isLoading}
                />
                <input 
                  name="participantes" 
                  value={formData.participantes} 
                  onChange={handleFormChange} 
                  placeholder="Participantes" 
                  className={inputStyles} 
                  required
                  disabled={isLoading}
                />
              </div>
              <textarea 
                name="recursosGenerales" 
                value={formData.recursosGenerales} 
                onChange={handleFormChange} 
                placeholder="Recursos Generales Necesarios" 
                rows={2} 
                className={inputStyles}
                disabled={isLoading}
              />
            </div>
          </div>
          
          {/* Tareas */}
          <div className="p-4 border rounded-lg dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Tareas Asociadas</h3>
              <button 
                type="button" 
                onClick={handleAddTarea} 
                className="bg-slate-200 dark:bg-slate-600 text-sm font-semibold px-3 py-1 rounded-md disabled:opacity-50"
                disabled={isLoading}
              >
                + Agregar Tarea
              </button>
            </div>
            <div className="space-y-4 max-h-60 overflow-y-auto">
              {formData.tareas.map((tarea, index) => (
                <div key={tarea.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md relative">
                  <button 
                    type="button" 
                    onClick={() => handleRemoveTarea(tarea.id)} 
                    className="absolute top-1 right-1 text-red-500 text-lg disabled:opacity-50"
                    disabled={isLoading}
                  >
                    &times;
                  </button>
                  <textarea 
                    value={tarea.descripcion} 
                    onChange={e => handleTareaChange(tarea.id, 'descripcion', e.target.value)} 
                    placeholder={`Descripción de la Tarea ${index + 1}`} 
                    rows={2} 
                    className={inputStyles} 
                    required
                    disabled={isLoading}
                  />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input 
                      value={tarea.responsable} 
                      onChange={e => handleTareaChange(tarea.id, 'responsable', e.target.value)} 
                      placeholder="Responsable" 
                      className={inputStyles} 
                      required
                      disabled={isLoading}
                    />
                    <input 
                      value={tarea.recursos} 
                      onChange={e => handleTareaChange(tarea.id, 'recursos', e.target.value)} 
                      placeholder="Recursos Necesarios" 
                      className={inputStyles}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg text-center">
            <h3 className="font-bold">Objetivo de la Actividad</h3>
            <p className="text-sm">Este objetivo se generará automáticamente a partir de la descripción y las tareas ingresadas. Una vez guardada la actividad, podrá revisar y ajustar el objetivo propuesto por el sistema.</p>
          </div>

          <div className="flex justify-end gap-4">
            <button 
              type="button" 
              onClick={() => setView('list')} 
              className="bg-slate-200 dark:bg-slate-600 font-semibold px-6 py-2 rounded-lg disabled:opacity-50"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isLoading} 
              className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg flex items-center min-w-[150px] justify-center disabled:opacity-50"
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Guardar Actividad'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (view === 'summary' && currentActividad) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md space-y-6">
        <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg flex items-center gap-4">
          <span className="text-2xl">✓</span>
          <div>
            <h2 className="font-bold text-lg">¡Actividad Planificada con Éxito!</h2>
            <p className="text-sm">La actividad ha sido creada. Revisa los detalles a continuación.</p>
          </div>
        </div>
        <div className="border rounded-lg p-6 dark:border-slate-700">
          <h3 className="text-xl font-bold mb-4">Resumen de la Actividad</h3>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between border-b pb-2 dark:border-slate-600">
              <strong className="text-slate-500">Nombre:</strong> 
              <span>{currentActividad.nombre}</span>
            </div>
            <div className="flex justify-between border-b pb-2 dark:border-slate-600">
              <strong className="text-slate-500">Fecha y Hora:</strong> 
              <span>{new Date(`${currentActividad.fecha}T${currentActividad.hora}`).toLocaleString('es-CL')}</span>
            </div>
            <div className="border-b pb-2 dark:border-slate-600">
              <p className="font-bold text-slate-500">Descripción:</p>
              <p>{currentActividad.descripcion}</p>
            </div>
            <div className="flex justify-between border-b pb-2 dark:border-slate-600">
              <strong className="text-slate-500">Ubicación:</strong> 
              <span>{currentActividad.ubicacion}</span>
            </div>
            <div className="flex justify-between border-b pb-2 dark:border-slate-600">
              <strong className="text-slate-500">Participantes:</strong> 
              <span>{currentActividad.participantes}</span>
            </div>
            <div className="border-b pb-2 dark:border-slate-600">
              <p className="font-bold text-slate-500">Recursos Necesarios:</p>
              <p>{currentActividad.recursosGenerales}</p>
            </div>
            <div className="border-b pb-2 dark:border-slate-600">
              <p className="font-bold text-slate-500">Objetivo (Generado por IA):</p>
              <p>{currentActividad.objetivo}</p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg flex justify-between items-center">
            <p className="text-sm">¿Quieres agregar esta actividad a tu calendario para recibir recordatorios?</p>
            <button 
              onClick={() => handleAddToCalendar(currentActividad)}
              disabled={isAddedToCalendar}
              className={`font-bold px-4 py-2 rounded-lg transition-colors ${
                isAddedToCalendar
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isAddedToCalendar ? '✓ Añadido al Calendario' : 'Añadir al Calendario'}
            </button>
          </div>
        </div>
        <button 
          onClick={() => { setView('list'); setCurrentActividad(null); }} 
          className="w-full text-center font-semibold text-blue-600 hover:underline"
        >
          Volver al panel de actividades
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Actividades del Calendario</h2>
        <button 
          onClick={() => { setView('form'); setFormData(initialFormState); }} 
          className="bg-amber-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-amber-600"
        >
          Planificar Actividad
        </button>
      </div>
      <div className="space-y-3">
        {actividades.length > 0 ? (
          actividades.map(act => (
            <div key={act.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md border dark:border-slate-700">
              <p className="font-bold text-slate-800 dark:text-slate-200">{act.nombre}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {new Date(act.fecha+'T12:00:00').toLocaleDateString('es-CL')} - {act.ubicacion}
              </p>
            </div>
          ))
        ) : (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8">No hay actividades planificadas.</p>
        )}
      </div>
    </div>
  );
};

// ===== COMPONENTE PRINCIPAL =====
interface PlanificacionDocenteProps {
  currentUser: User;
}

const PlanificacionDocente: React.FC<PlanificacionDocenteProps> = ({ currentUser }) => {
  // Usa uid como identificador principal, luego email como fallback
  const userId = currentUser.uid || currentUser.email || currentUser.id || '';
  const { planificaciones, save: savePlan, update: updatePlan, remove: deletePlan, loading: planificacionesLoading } = usePlanificaciones(userId);
  
  const initialUnidadFormState = {
    asignatura: '',
    nivel: '' as NivelPlanificacion,
    nombreUnidad: '',
    contenidos: '',
    cantidadClases: 8,
    observaciones: '',
    ideasParaUnidad: '',
  };
  const [unidadFormData, setUnidadFormData] = useState(initialUnidadFormState);

  const [editingPlanificacion, setEditingPlanificacion] = useState<PlanificacionUnidad | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'unidad' | 'clase' | 'calendario'>('unidad');
  const [viewingClassPlan, setViewingClassPlan] = useState<PlanificacionClase | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ planId: string; lessonIndex: number; lessonData: DetalleLeccion } | null>(null);

  const assignedAsignaturas = useMemo(() => currentUser.asignaturas || [], [currentUser.asignaturas]);
  const assignedNiveles = useMemo(() => {
    const assignedCursos = currentUser.cursos || [];
    const nivelesSet = new Set<NivelPlanificacion>();
    assignedCursos.forEach(curso => {
      if (curso.startsWith('1º')) nivelesSet.add('1º Medio');
      else if (curso.startsWith('2º')) nivelesSet.add('2º Medio');
      else if (curso.startsWith('3º')) nivelesSet.add('3º Medio');
      else if (curso.startsWith('4º')) nivelesSet.add('4º Medio');
    });
    return Array.from(nivelesSet);
  }, [currentUser.cursos]);

  useEffect(() => {
    // Set initial form state based on assigned values
    setUnidadFormData(prev => ({
      ...prev,
      asignatura: assignedAsignaturas[0] || '',
      nivel: assignedNiveles[0] || '' as NivelPlanificacion,
    }));
    
    // Debug para entender el problema de permisos
    console.log('🔍 Debug datos usuario y planificaciones:', {
      currentUser: {
        uid: currentUser.uid,
        email: currentUser.email,
        id: currentUser.id,
        nombreCompleto: currentUser.nombreCompleto
      },
      userId,
      planificacionesCount: planificaciones.length,
      planificacionesAutores: planificaciones.map(p => ({
        id: p.id,
        autor: p.autor,
        tipo: p.tipo,
        coincideConUserId: p.autor === userId
      }))
    });
  }, [assignedAsignaturas, assignedNiveles, currentUser, userId, planificaciones]);

  const handleUnidadFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setUnidadFormData(prev => ({
      ...prev,
      [name]: name === 'cantidadClases' ? parseInt(value, 10) : value
    }));
  };

  const buildUnidadPrompt = () => {
    const { asignatura, nivel, nombreUnidad, contenidos, cantidadClases, observaciones, ideasParaUnidad } = unidadFormData;

    return `Eres un experto diseñador curricular para la educación media técnico profesional en Chile. Tu tarea es generar una planificación de unidad didáctica completa en formato JSON estructurado, basándote en la información proporcionada.

    **Información Base:**
    - Asignatura: ${asignatura}
    - Nivel: ${nivel}
    - Nombre de la Unidad: "${nombreUnidad}"
    - Contenidos clave a trabajar (insumo principal): "${contenidos}"
    - Cantidad de clases para la unidad: ${cantidadClases}
    - Ideas y perspectiva del docente para la unidad: "${ideasParaUnidad || "Ninguna. Sé creativo."}"
    - Observaciones y énfasis del docente: "${observaciones || "Ninguna"}"

    Debes generar un objeto JSON que se ajuste al esquema proporcionado. El JSON debe contener:
    1.  **objetivosAprendizaje**: Un objetivo de aprendizaje general y conciso para la unidad.
    2.  **indicadoresEvaluacion**: Un indicador de evaluación general y observable para la unidad.
    3.  **detallesLeccion**: Un array con EXACTAMENTE ${cantidadClases} objetos, donde cada objeto representa una clase o sub-tema de la unidad. Cada objeto en el array debe tener:
        - **objetivosAprendizaje**: Un objetivo de aprendizaje específico para la lección, redactado en infinitivo.
        - **contenidosConceptuales**: Los conceptos clave que se abordarán en la lección.
        - **habilidadesBloom**: La habilidad principal de la Taxonomía de Bloom que se trabajará (ej: Analizar, Crear, Evaluar).
        - **perfilEgreso**: Conecta la lección con una habilidad del perfil de egreso (ej: "Pensamiento crítico", "Colaboración").
        - **actividades**: Sugiere 1 o 2 actividades concretas, indicando el número de clase entre paréntesis (ej: "Debate grupal (Clase 1)").
        - **asignaturasInterdisciplinariedad**: Sugiere una asignatura con la que se podría realizar un trabajo interdisciplinario.

    Asegúrate de que el contenido generado sea coherente, pedagógicamente sólido y esté directamente relacionado con los contenidos clave proporcionados por el docente. El nombre de la unidad debe ser exactamente el proporcionado.`;
  };

  const handleGenerateUnidad = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if(!unidadFormData.contenidos || !unidadFormData.nombreUnidad){
      setError("Los campos 'Nombre de Unidad' y 'Contenidos Clave' son obligatorios.");
      setLoading(false);
      return;
    }

    try {
      logApiCall('Planificación - Unidad');
      
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setError("La API Key de Gemini no está configurada.");
        setLoading(false);
        return;
      }

      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const prompt = buildUnidadPrompt();
      
      const responseSchema = {
        type: "object",
        properties: {
          objetivosAprendizaje: { type: "string" },
          indicadoresEvaluacion: { type: "string" },
          detallesLeccion: {
            type: "array",
            items: {
              type: "object",
              properties: {
                objetivosAprendizaje: { type: "string" },
                contenidosConceptuales: { type: "string" },
                habilidadesBloom: { type: "string" },
                perfilEgreso: { type: "string" },
                actividades: { type: "string" },
                asignaturasInterdisciplinariedad: { type: "string" }
              },
              required: ["objetivosAprendizaje", "contenidosConceptuales", "habilidadesBloom", "perfilEgreso", "actividades", "asignaturasInterdisciplinariedad"]
            }
          }
        },
        required: ["objetivosAprendizaje", "indicadoresEvaluacion", "detallesLeccion"]
      };
      
      const result = await model.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: "application/json", 
          responseSchema 
        }
      });
      
      const response = await result.response;
      const text = response.text();
      const generatedData = JSON.parse(text);

      const newPlan: Omit<PlanificacionUnidad, 'id'> = {
        fechaCreacion: new Date().toISOString(),
        autor: currentUser.nombreCompleto,
        tipo: 'Unidad',
        asignatura: unidadFormData.asignatura,
        nivel: unidadFormData.nivel,
        nombreUnidad: unidadFormData.nombreUnidad,
        contenidos: unidadFormData.contenidos,
        cantidadClases: unidadFormData.cantidadClases,
        observaciones: unidadFormData.observaciones,
        ideasParaUnidad: unidadFormData.ideasParaUnidad,
        objetivosAprendizaje: generatedData.objetivosAprendizaje,
        indicadoresEvaluacion: generatedData.indicadoresEvaluacion,
        detallesLeccion: generatedData.detallesLeccion,
      };
      
      if (editingPlanificacion) {
        // Actualizar planificación existente
        await updatePlan(editingPlanificacion.id, newPlan);
        setEditingPlanificacion({ ...newPlan, id: editingPlanificacion.id });
      } else {
        // Crear nueva planificación
        const planId = await savePlan(newPlan);
        setEditingPlanificacion({ ...newPlan, id: planId });
      }

    } catch (e) {
      console.error("Error al generar planificación con IA", e);
      setError("Ocurrió un error al contactar con la IA. Verifique la configuración y reintente.");
    } finally {
      setLoading(false);
    }
  };

  const handleUseLessonAsClassPlan = async (lessonDetail: DetalleLeccion, unitPlan: PlanificacionUnidad) => {
    setLoading(true);
    setError(null);
    
    const prompt = `A partir de la siguiente información de una clase dentro de una unidad, genera un plan de clase detallado con momentos de inicio, desarrollo y cierre. La clase debe durar 80 minutos.
    
    - Asignatura: ${unitPlan.asignatura}
    - Nivel: ${unitPlan.nivel}
    - Objetivo de la clase: ${lessonDetail.objetivosAprendizaje}
    - Contenidos: ${lessonDetail.contenidosConceptuales}
    - Actividades sugeridas: ${lessonDetail.actividades}
    
    Responde SÓLO con un objeto JSON que contenga las claves "inicio", "desarrollo" y "cierre", con las actividades detalladas para cada momento.`;

    try {
      logApiCall('Planificación - Utilizar Clase');
      
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setError("La API Key de Gemini no está configurada.");
        setLoading(false);
        return;
      }

      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      
      const schema = {
        type: "object",
        properties: {
          inicio: { type: "string" },
          desarrollo: { type: "string" },
          cierre: { type: "string" },
        },
        required: ["inicio", "desarrollo", "cierre"],
      };

      const result = await model.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema },
      });

      const response = await result.response;
      const text = response.text();
      const generatedData: MomentosClase = JSON.parse(text);

      const newClassPlan: Omit<PlanificacionClase, 'id'> = {
        fechaCreacion: new Date().toISOString(),
        autor: currentUser.nombreCompleto,
        tipo: 'Clase',
        asignatura: unitPlan.asignatura,
        nivel: unitPlan.nivel,
        contenidos: lessonDetail.contenidosConceptuales,
        observaciones: '',
        nombreClase: lessonDetail.actividades,
        duracionClase: 80,
        momentosClase: generatedData,
        detalleLeccionOrigen: lessonDetail,
      };

      await savePlan(newClassPlan);
      alert('¡Plan de clase generado y guardado en la pestaña "Clase"!');
      setActiveTab('clase');

    } catch (e) {
      console.error("Error al generar plan de clase con IA", e);
      setError("No se pudo generar el plan de clase. Inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectForEdit = (plan: PlanificacionDocente) => {
    if (plan.tipo === 'Unidad') {
      setUnidadFormData({
        asignatura: plan.asignatura,
        nivel: plan.nivel,
        nombreUnidad: plan.nombreUnidad,
        contenidos: plan.contenidos,
        cantidadClases: plan.cantidadClases,
        observaciones: plan.observaciones,
        ideasParaUnidad: plan.ideasParaUnidad || '',
      });
      setEditingPlanificacion(plan);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar esta planificación?")) {
      try {
        await deletePlan(id);
        if (editingPlanificacion?.id === id) {
          setEditingPlanificacion(null);
          setUnidadFormData(initialUnidadFormState);
        }
      } catch (error) {
        console.error('Error al eliminar planificación:', error);
        alert('Error al eliminar la planificación. Por favor, intente nuevamente.');
      }
    }
  };

  const handleDeleteClassPlan = async (id: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar este plan de clase?")) {
      try {
        await deletePlan(id);
        // Si estamos viendo el plan que se eliminó, volver a la lista
        if (viewingClassPlan?.id === id) {
          setViewingClassPlan(null);
        }
        console.log('✅ Plan de clase eliminado exitosamente');
      } catch (error) {
        console.error('Error al eliminar plan de clase:', error);
        alert('Error al eliminar el plan de clase. Por favor, intente nuevamente.');
      }
    }
  };

  const handleOpenEditModal = (lessonIndex: number, lessonData: DetalleLeccion) => {
    if (!editingPlanificacion) return;
    setEditingLesson({
      planId: editingPlanificacion.id,
      lessonIndex,
      lessonData,
    });
  };

  const handleSaveEditedLesson = async (updatedLesson: DetalleLeccion) => {
    if (!editingLesson) return;
    
    try {
      const { planId, lessonIndex } = editingLesson;
      const planToUpdate = planificaciones.find(p => p.id === planId && p.tipo === 'Unidad') as PlanificacionUnidad;
      
      if (!planToUpdate) return;

      const newDetallesLeccion = [...planToUpdate.detallesLeccion];
      newDetallesLeccion[lessonIndex] = updatedLesson;
      
      const updatedPlan = { ...planToUpdate, detallesLeccion: newDetallesLeccion };
      
      await updatePlan(planId, updatedPlan);
      setEditingPlanificacion(updatedPlan);
      setEditingLesson(null);
    } catch (error) {
      console.error('Error al actualizar lección:', error);
      alert('Error al actualizar la lección. Por favor, intente nuevamente.');
    }
  };
  
  const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";
  
  const renderUnidadTab = () => (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Generador de Planificaciones de Unidad</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">Complete los campos y use la IA para crear una planificación de unidad estructurada.</p>
        {planificacionesLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <form onSubmit={handleGenerateUnidad} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label htmlFor="asignatura" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
                <select 
                  name="asignatura" 
                  value={unidadFormData.asignatura} 
                  onChange={handleUnidadFieldChange} 
                  className={inputStyles}
                  disabled={loading}
                >
                  {assignedAsignaturas.length > 0 ? (
                    assignedAsignaturas.map(a => <option key={a} value={a}>{a}</option>)
                  ) : (
                    <option disabled>No tiene asignaturas asignadas</option>
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="nivel" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nivel</label>
                <select 
                  name="nivel" 
                  value={unidadFormData.nivel} 
                  onChange={handleUnidadFieldChange} 
                  className={inputStyles}
                  disabled={loading}
                >
                  {assignedNiveles.length > 0 ? (
                    assignedNiveles.map(n => <option key={n} value={n}>{n}</option>)
                  ) : (
                    <option disabled>No tiene cursos/niveles asignados</option>
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="nombreUnidad" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Nombre de Unidad <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  name="nombreUnidad" 
                  value={unidadFormData.nombreUnidad} 
                  onChange={handleUnidadFieldChange} 
                  className={inputStyles} 
                  placeholder="Ej: La Célula y sus procesos"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label htmlFor="contenidos" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Contenidos Clave <span className="text-red-500">*</span>
                </label>
                <textarea 
                  name="contenidos" 
                  value={unidadFormData.contenidos} 
                  onChange={handleUnidadFieldChange} 
                  rows={3} 
                  placeholder="Ingrese los temas, conceptos clave o unidades que la planificación debe abordar." 
                  className={inputStyles}
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label htmlFor="ideasParaUnidad" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Ideas para la unidad</label>
                <textarea 
                  name="ideasParaUnidad" 
                  value={unidadFormData.ideasParaUnidad} 
                  onChange={handleUnidadFieldChange} 
                  rows={3} 
                  placeholder="Plantea tus ideas y perspectiva para que la IA construya una mejor planificación (ej: enfocar en trabajo colaborativo, usar casos prácticos, conectar con la actualidad)." 
                  className={inputStyles}
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="cantidadClases" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Cantidad de Clases</label>
                <input 
                  type="number" 
                  name="cantidadClases" 
                  value={unidadFormData.cantidadClases} 
                  onChange={handleUnidadFieldChange} 
                  className={inputStyles} 
                  min="1" 
                  max="20"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="observaciones" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Observaciones (Énfasis)</label>
                <textarea 
                  name="observaciones" 
                  value={unidadFormData.observaciones} 
                  onChange={handleUnidadFieldChange} 
                  rows={1} 
                  placeholder="Ej: clase práctica, modelo ABP, juego, reforzamiento..." 
                  className={inputStyles}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="pt-4 text-right">
              <button 
                type="submit" 
                disabled={loading || planificacionesLoading} 
                className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 flex items-center justify-center min-w-[150px] dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  editingPlanificacion ? 'Regenerar' : 'Generar Plan'
                )}
              </button>
            </div>
            {error && <p className="text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-300 p-3 rounded-md mt-4">{error}</p>}
          </form>
        )}
      </div>
      
      {editingPlanificacion && (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md space-y-8">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Revisión y Edición</h2>
          <LessonPlanViewer 
            plan={editingPlanificacion} 
            onEditLesson={handleOpenEditModal}
            onUseLesson={handleUseLessonAsClassPlan}
            onUpdatePlan={updatePlan}
            isLoading={loading}
          />
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Historial de Planificaciones de Unidad</h2>
        {planificacionesLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {planificaciones.filter(p => p.tipo === 'Unidad').length > 0 ? 
              planificaciones.filter((p): p is PlanificacionUnidad => p.tipo === 'Unidad').map(plan => (
                <div 
                  key={plan.id} 
                  className={`p-4 border rounded-lg ${
                    editingPlanificacion?.id === plan.id 
                      ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-500/50' 
                      : 'bg-slate-50 dark:bg-slate-700/50 dark:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{plan.nombreUnidad}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Creado: {new Date(plan.fechaCreacion).toLocaleString('es-CL')}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-md">
                        Contenidos: {plan.contenidos}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleSelectForEdit(plan)} 
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-sm disabled:opacity-50"
                        disabled={loading}
                      >
                        Ver y Editar
                      </button>
                      <button 
                        onClick={() => handleDelete(plan.id)} 
                        title="Eliminar" 
                        className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
                        disabled={loading}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-slate-500 dark:text-slate-400">No hay planificaciones de unidad guardadas.</p>
              )
            }
          </div>
        )}
      </div>
    </div>
  );
  
  const renderClaseTab = () => {
    const planesClase = planificaciones.filter((p): p is PlanificacionClase => p.tipo === 'Clase')
      .sort((a,b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());

    if (viewingClassPlan) {
      return (
        <ClassPlanViewer 
          plan={viewingClassPlan}
          onBack={() => setViewingClassPlan(null)}
          onDelete={handleDeleteClassPlan}
          onSave={async (updatedPlan) => {
            try {
              await updatePlan(updatedPlan.id, updatedPlan);
              setViewingClassPlan(updatedPlan);
            } catch (error) {
              console.error('Error al actualizar plan de clase:', error);
              alert('Error al actualizar el plan de clase. Por favor, intente nuevamente.');
            }
          }}
          isLoading={loading}
        />
      );
    }

    return (
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Planes de Clase Guardados</h2>
        {planificacionesLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {planesClase.length > 0 ? planesClase.map(plan => (
              <div key={plan.id} className="p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{plan.nombreClase}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Creado: {new Date(plan.fechaCreacion).toLocaleString('es-CL')}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-md">
                    Contenidos: {plan.contenidos}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setViewingClassPlan(plan)} 
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-sm"
                  >
                    Ver Plan de Clase
                  </button>
                </div>
              </div>
            )) : (
              <p className="text-slate-500 dark:text-slate-400 text-center py-6">
                No hay planes de clase guardados. Puede generarlos desde una unidad en la pestaña 'Unidad'.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };
  
  // Verificar que el usuario está autenticado
  if (!currentUser || (!currentUser.email && !currentUser.id)) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 mb-2">Error: Usuario no autenticado</p>
          <p className="text-sm text-slate-400">Datos recibidos: {JSON.stringify(currentUser)}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Planificación</h1>
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button 
            onClick={() => setActiveTab('unidad')} 
            className={`${
              activeTab === 'unidad' 
                ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
          >
            Unidad
          </button>
          <button 
            onClick={() => setActiveTab('clase')} 
            className={`${
              activeTab === 'clase' 
                ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
          >
            Clase
          </button>
          <button 
            onClick={() => setActiveTab('calendario')} 
            className={`${
              activeTab === 'calendario' 
                ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
          >
            Actividades Calendario
          </button>
        </nav>
      </div>

      {activeTab === 'unidad' && renderUnidadTab()}
      {activeTab === 'clase' && renderClaseTab()}
      {activeTab === 'calendario' && <ActividadesCalendarioSubmodule userId={userId} />}

      {editingLesson && (
        <EditLessonModal
          lesson={editingLesson.lessonData}
          onClose={() => setEditingLesson(null)}
          onSave={handleSaveEditedLesson}
          isLoading={loading}
        />
      )}
    </div>
  );
};

export default PlanificacionDocente;