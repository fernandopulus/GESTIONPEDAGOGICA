// Hook local para planificaciones de unidad y clase
const usePlanificaciones = (userId: string | null, currentUser?: User | null) => {
  const [planificaciones, setPlanificaciones] = useState<(PlanificacionUnidad | PlanificacionClase)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Función para cargar planificaciones manualmente si la suscripción falla
  const cargarPlanificacionesDirectamente = useCallback(async () => {
    if (!userId) {
      console.warn('🛠️ cargarPlanificacionesDirectamente: userId nulo, no se pueden cargar planificaciones');
      setLoading(false);
      setError('No se pudo determinar la identidad del usuario');
      setPlanificaciones([]);
      return;
    }
    
    try {
      console.log(`🛠️ Cargando planificaciones directamente para ${userId}`);
      const { getPlanificacionesByUser } = await import('../../src/firebaseHelpers/planificacionHelper');
      const data = await getPlanificacionesByUser(userId);
      
      console.log(`🛠️ Obtenidas ${data.length} planificaciones directamente de Firestore`);
      
      // Corregir planificaciones inválidas
      const datosCorregidos = data.map(item => {
        if (item.tipo === 'Unidad' && !Array.isArray((item as any).detallesLeccion)) {
          console.log(`🛠️ Corrigiendo datos de planificación ${item.id}`);
          return { ...item, detallesLeccion: [] };
        }
        return item;
      });
      
      setPlanificaciones(datosCorregidos);
      setLoading(false);
    } catch (err) {
      console.error('🛠️ Error cargando planificaciones directamente:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar planificaciones directamente');
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      console.log('🛠️ usePlanificaciones: userId nulo o vacío, no se cargarán planificaciones');
      setLoading(false);
      setError('ID de usuario no disponible');
      setPlanificaciones([]); // Asegurar que el estado esté vacío
      return;
    }
    
    console.log(`🛠️ usePlanificaciones: Cargando planificaciones para usuario ${userId}`);
    setLoading(true);
    setError(null);
    
    let unsubscribe: (() => void) | null = null;
    
    try {
      unsubscribe = subscribeToPlanificaciones(userId, (data) => {
        console.log(`🛠️ usePlanificaciones: Recibidos ${data.length} documentos por suscripción`);
        
        if (data.length === 0) {
          // Si no hay datos por suscripción, intentar cargar directamente
          cargarPlanificacionesDirectamente();
          return;
        }
        
        // Corregir datos antes de actualizar el estado
        const datosCorregidos = data.map(item => {
          if (item.tipo === 'Unidad' && !Array.isArray((item as any).detallesLeccion)) {
            console.log(`🛠️ Corrigiendo datos de planificación ${item.id}`);
            return { ...item, detallesLeccion: [] };
          }
          return item;
        });
        
        setPlanificaciones(datosCorregidos);
        setLoading(false);
      });
    } catch (err) {
      console.error('🛠️ Error en hook usePlanificaciones:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar planificaciones');
      cargarPlanificacionesDirectamente(); // Intentar cargar directamente en caso de error
    }
    
    // Si después de 5 segundos no se han cargado datos, intentar cargar directamente
    const timeoutId = setTimeout(() => {
      if (loading && planificaciones.length === 0) {
        console.log('🛠️ Timeout: cargando planificaciones directamente como respaldo');
        cargarPlanificacionesDirectamente();
      }
    }, 5000);
    
    return () => {
      if (unsubscribe) unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [userId, cargarPlanificacionesDirectamente]);

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

  // Función de diagnóstico que puede ser invocada desde fuera
  const diagnosticarYReparar = useCallback(async () => {
    try {
      // Verificar identificador de usuario
      if (!userId) {
        return { 
          status: 'error', 
          message: 'No hay usuario identificado. Datos del usuario no disponibles.'
        };
      }
      
      // Mostrar información básica de diagnóstico
      console.log('📊 Diagnóstico - ID de usuario:', userId);
      
      const { getPlanificacionesByUser } = await import('../../src/firebaseHelpers/planificacionHelper');
      const data = await getPlanificacionesByUser(userId);
      
      // Análisis de problemas
      const unidades = data.filter(p => p.tipo === 'Unidad');
      const unidadesInvalidas = unidades.filter(p => 
        !Array.isArray((p as any).detallesLeccion) || (p as any).detallesLeccion === undefined
      );
      
      console.log(`📊 Diagnóstico - Total planificaciones: ${data.length}, Unidades: ${unidades.length}, Inválidas: ${unidadesInvalidas.length}`);
      
      // Reparación si es necesario
      if (unidadesInvalidas.length > 0) {
        const { updateDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../../src/firebaseHelpers/config');
        
        for (const plan of unidadesInvalidas) {
          await updateDoc(doc(db, 'planificaciones', plan.id), {
            detallesLeccion: []
          });
        }
        
        return { 
          status: 'repaired', 
          message: `Se repararon ${unidadesInvalidas.length} planificaciones de ${unidades.length} totales.` 
        };
      } else if (unidades.length === 0) {
        return { 
          status: 'empty', 
          message: `No se encontraron planificaciones de unidad para el usuario ${userId}. Cree una nueva planificación.` 
        };
      }
      
      return { 
        status: 'ok', 
        message: `Todo correcto. ${unidades.length} planificaciones de unidad encontradas.` 
      };
    } catch (err) {
      console.error('📊 Error en diagnóstico:', err);
      return { 
        status: 'error', 
        message: `Error: ${err instanceof Error ? err.message : 'Desconocido'}` 
      };
    }
  }, [userId]);

  return { 
    planificaciones, 
    loading, 
    error, 
    save, 
    update, 
    remove,
    diagnosticarYReparar
  };
};

import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { auth } from '../../src/firebase';
import type { PlanificacionUnidad, PlanificacionClase, DetalleLeccion, ActividadPlanificada, TareaActividad, User, NivelPlanificacion, ActividadFocalizadaEvent, MomentosClase, PlanificacionDocente } from '../../types';
import { useMemo } from 'react';
import { EventType } from '../../types';

import { 
  BookOpen, 
  Calendar, 
  CheckCircle2, 
  ChevronLeft, 
  Clock, 
  FileEdit, 
  Trash2,
  Plus,
  Save,
  RefreshCcw,
  BookMarked,
  School2,
  Sparkles,
  LayoutDashboard,
  PresentationIcon
} from 'lucide-react';
import MaterialesDidacticosSubmodule from './MaterialesDidacticosSubmodule';
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
// Documentación institucional (reutilizamos el backend de Documentación con tag "planificacion")
import { subscribeDocs, createDocMeta, uploadFileForDoc, indexDocument, deleteDocMeta, type DocuMeta } from '../../src/firebaseHelpers/documentacion';
import { storage } from '../../src/firebase';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';

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
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const unsubscribe = subscribeToActividades(userId, (data) => {
        setActividades(data);
        setLoading(false);
      });

      return unsubscribe;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar actividades');
      setLoading(false);
    }
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
  // Estado local para Reflexión de la Unidad
  const [fortalezas, setFortalezas] = useState<string>(plan.reflexionUnidad?.fortalezas || '');
  const [mejoras, setMejoras] = useState<string>(plan.reflexionUnidad?.mejoras || '');
  const [debilidades, setDebilidades] = useState<string>(plan.reflexionUnidad?.debilidades || '');
  const HABILIDADES_BLOOM = ['Recordar','Comprender','Aplicar','Analizar','Evaluar','Crear'];
  const initialRanks: Record<string, number | ''> = (() => {
    const ranks: Record<string, number | ''> = Object.fromEntries(HABILIDADES_BLOOM.map(h => [h, '']));
    (plan.reflexionUnidad?.ordenHabilidades || []).forEach((h, idx) => {
      if (HABILIDADES_BLOOM.includes(h)) ranks[h] = idx + 1;
    });
    return ranks;
  })();
  const [habilidadRanks, setHabilidadRanks] = useState<Record<string, number | ''>>(initialRanks);
  const [savingReflexion, setSavingReflexion] = useState(false);
  // Sincronizar cuando cambie el plan
  useEffect(() => {
    setFortalezas(plan.reflexionUnidad?.fortalezas || '');
    setMejoras(plan.reflexionUnidad?.mejoras || '');
    setDebilidades(plan.reflexionUnidad?.debilidades || '');
    const ranks: Record<string, number | ''> = Object.fromEntries(HABILIDADES_BLOOM.map(h => [h, '']));
    (plan.reflexionUnidad?.ordenHabilidades || []).forEach((h, idx) => {
      if (HABILIDADES_BLOOM.includes(h)) ranks[h] = idx + 1;
    });
    setHabilidadRanks(ranks);
  }, [plan.id]);

  // Chequeo de completitud de reflexión (Obligatoria)
  const isReflexionCompleta = () => {
    const textosOk = fortalezas.trim().length > 0 && mejoras.trim().length > 0 && debilidades.trim().length > 0;
    const orden = Object.entries(habilidadRanks)
      .filter(([, r]) => r !== '')
      .sort((a, b) => (a[1] as number) - (b[1] as number))
      .map(([h]) => h);
    const habilidadesOk = orden.length >= 1; // al menos una priorizada
    return textosOk && habilidadesOk;
  };
  
  const handleProgresoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    // Si intenta marcar 100% sin reflexión completa, bloquear
    if (value === 100 && !isReflexionCompleta()) {
      alert('Para marcar la unidad como 100% completada, primero debes completar y guardar la Reflexión Docente (fortalezas, mejoras, desafíos y priorización de habilidades).');
      return;
    }
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

  // Handlers Reflexión
  const setRank = (habilidad: string, rank: number | '') => {
    setHabilidadRanks(prev => {
      const next = { ...prev };
      // Si el rank ya lo usa otra habilidad, liberarlo
      if (rank !== '') {
        const usedBy = Object.keys(next).find(h => h !== habilidad && next[h] === rank);
        if (usedBy) next[usedBy] = '';
      }
      next[habilidad] = rank;
      return next;
    });
  };

  const buildOrdenHabilidades = (): string[] => {
    return Object.entries(habilidadRanks)
      .filter(([, r]) => r !== '')
      .sort((a, b) => (a[1] as number) - (b[1] as number))
      .map(([h]) => h);
  };

  const handleGuardarReflexion = async () => {
    if (!onUpdatePlan || !plan.id) return;
    // Validaciones obligatorias
    if (!isReflexionCompleta()) {
      alert('La Reflexión Docente es obligatoria: completa Fortalezas, Mejoras, Desafíos y prioriza al menos una habilidad de Bloom.');
      return;
    }
    setSavingReflexion(true);
    try {
      const ordenHabilidades = buildOrdenHabilidades();
      await onUpdatePlan(plan.id, {
        reflexionUnidad: {
          fortalezas: fortalezas.trim(),
          mejoras: mejoras.trim(),
          debilidades: debilidades.trim(),
          ordenHabilidades,
        },
      });
    } catch (err) {
      console.error('❌ Error al guardar reflexión:', err);
      alert(`Error al guardar la reflexión: ${err.message}`);
    } finally {
      setSavingReflexion(false);
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
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md">
              <p className="font-medium">
                <strong>Actividades sugeridas:</strong> {lesson.actividades}
              </p>
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

      {/* Reflexión Docente de la Unidad */}
      <div className="p-4 border dark:border-slate-700 rounded-lg">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">Reflexión Docente</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Obligatoria. Se usa en el módulo "Seguimiento Curricular" para análisis y visualización.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fortalezas <span className="text-red-500">*</span></label>
              <textarea value={fortalezas} onChange={e => setFortalezas(e.target.value)} rows={3} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mejoras <span className="text-red-500">*</span></label>
              <textarea value={mejoras} onChange={e => setMejoras(e.target.value)} rows={3} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Desafíos <span className="text-red-500">*</span></label>
              <textarea value={debilidades} onChange={e => setDebilidades(e.target.value)} rows={3} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Habilidades Bloom priorizadas (1 = mayor prioridad) <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HABILIDADES_BLOOM.map(h => (
                <div key={h} className="flex items-center justify-between gap-3 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                  <span className="text-slate-700 dark:text-slate-200">{h}</span>
                  <select
                    value={habilidadRanks[h] === '' ? '' : String(habilidadRanks[h])}
                    onChange={e => setRank(h, e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="">—</option>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Selecciona números sin repetir. Solo se guardan las habilidades con número asignado.
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleGuardarReflexion} disabled={savingReflexion || isLoading} className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50">
            {savingReflexion ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Guardar reflexión</span>
          </button>
        </div>
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
  
  // Asegurarnos de que los valores de momentosClase son strings y están formateados correctamente
  useEffect(() => {
    console.log("Plan inicial:", plan.momentosClase);
    
    // Función para procesar el contenido
    const procesarContenido = (contenido: any) => {
      // Si es un objeto, convertirlo a string JSON
      if (typeof contenido === 'object' && contenido !== null) {
        return JSON.stringify(contenido);
      }
      
      // Si es una cadena, comprobar si es JSON
      if (typeof contenido === 'string') {
        try {
          // Si parece un objeto JSON (empieza con '{'), intentar parsearlo
          if (contenido.trim().startsWith('{')) {
            const jsonObj = JSON.parse(contenido);
            return JSON.stringify(jsonObj);
          }
        } catch (e) {
          // Si no es JSON válido, devolver como está
          console.log("No es JSON válido:", e);
        }
      }
      
      return String(contenido);
    };
    
    // Procesar cada sección
    const inicio = procesarContenido(plan.momentosClase.inicio);
    const desarrollo = procesarContenido(plan.momentosClase.desarrollo);
    const cierre = procesarContenido(plan.momentosClase.cierre);
    
    console.log("Contenido procesado - inicio:", inicio);
    
    // Actualizar el estado con los valores convertidos
    setEditablePlan(prev => ({
      ...prev,
      momentosClase: {
        inicio: inicio,
        desarrollo: desarrollo,
        cierre: cierre
      }
    }));
  }, [plan]);
  
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
      // Procesar el contenido antes de guardar para preservar la estructura de objeto
      // si el usuario ha editado el texto formateado
      const procesarPlanParaGuardar = () => {
        const plan = {...editablePlan};
        
        // Procesar cada momento de clase
        Object.keys(plan.momentosClase).forEach(key => {
          const valor = plan.momentosClase[key];
          
          // Si es un string y parece contener una estructura de actividades
          if (typeof valor === 'string' && 
              (valor.includes('TIEMPO:') || valor.includes('OBJETIVO:') || valor.includes('ACTIVIDADES:'))) {
            try {
              // Intentar reconstruir el objeto a partir del texto formateado
              const tiempoMatch = valor.match(/TIEMPO:\s*(.*?)(?:\n\n|\n$)/s);
              const objetivoMatch = valor.match(/OBJETIVO:\s*(.*?)(?:\n\nACTIVIDADES:|\n$)/s);
              
              if (tiempoMatch || objetivoMatch) {
                // Mantener el texto formateado para la visualización
                console.log("Manteniendo formato para visualización");
              }
            } catch (e) {
              console.error("Error al procesar plan para guardar:", e);
            }
          }
        });
        
        return plan;
      };
      
      await onSave(procesarPlanParaGuardar());
    } catch (error) {
      console.error('Error al guardar plan de clase:', error);
    } finally {
      setSaving(false);
    }
  };
  
  // Función para dar formato al contenido JSON de manera más legible
  const formatearContenido = (contenido: any): string => {
    console.log("Formateando contenido:", typeof contenido, contenido?.substring ? contenido.substring(0, 50) : contenido);
    
    // Si es una cadena, tratar de parsearla como JSON primero
    if (typeof contenido === 'string') {
      try {
        // Si parece un objeto JSON (empieza con '{'), intentar parsearlo
        if (contenido.trim().startsWith('{')) {
          contenido = JSON.parse(contenido);
          console.log("Contenido parseado a objeto:", contenido);
        }
      } catch (e) {
        console.log("Error al parsear JSON:", e);
        // Si no es JSON válido, lo dejamos como está
      }
    }
    
    if (typeof contenido === 'object' && contenido !== null) {
      try {
        // Si es un objeto con estructura específica de plan de clase
        let resultado = '';
        
        // Formato especial para estructura de actividades
        if (contenido.actividades && Array.isArray(contenido.actividades)) {
          // Tiempo y objetivo con formato limpio
          resultado = `${contenido.tiempo ? 'TIEMPO: ' + contenido.tiempo + '\n\n' : ''}`;
          resultado += `${contenido.objetivo ? 'OBJETIVO:\n' + contenido.objetivo + '\n\n' : ''}`;
          
          // Sección de actividades con formato mejorado
          resultado += 'ACTIVIDADES:\n\n';
          contenido.actividades.forEach((act: any, index: number) => {
            // Nombre de la actividad resaltado
            resultado += `ACTIVIDAD ${index + 1}: ${act.nombre || 'Sin nombre'}\n`;
            
            // Descripción con sangría para mejor legibilidad
            resultado += `${act.descripcion || 'Sin descripción'}\n\n`;
            
            // Información adicional en formato de lista
            let detalles = '';
            if (act.tipo) detalles += `• Tipo: ${act.tipo}\n`;
            if (act.recursos) detalles += `• Recursos: ${act.recursos}\n`;
            if (act.evaluacion) detalles += `• Evaluación: ${act.evaluacion}\n`;
            
            if (detalles) {
              resultado += `${detalles}\n`;
            }
          });
          
          // Agregar otras propiedades si existen, con mejor formato
          let otrasProps = '';
          Object.keys(contenido).forEach(key => {
            if (key !== 'tiempo' && key !== 'objetivo' && key !== 'actividades') {
              otrasProps += `• ${key.charAt(0).toUpperCase() + key.slice(1)}: ${
                typeof contenido[key] === 'object' ? 
                JSON.stringify(contenido[key]) : contenido[key]
              }\n`;
            }
          });
          
          if (otrasProps) {
            resultado += `\nINFORMACIÓN ADICIONAL:\n${otrasProps}`;
          }
          
          return resultado;
        } 
        
        // Formato para elementos que tienen estructura genérica
        else {
          // Intentar detectar si es un texto con estructura de actividades
          if (typeof contenido === 'string') {
            try {
              // Intentar parsear como JSON
              const parsedObj = JSON.parse(contenido);
              
              if (parsedObj.actividades || parsedObj.tiempo || parsedObj.objetivo) {
                // Es un objeto de actividades en formato string, procesarlo
                return formatearContenido(parsedObj);
              }
            } catch (e) {
              // No es un JSON válido, continuar con el procesamiento normal
            }
          }
          
          // Convertir a JSON y formatear
          const formattedJSON = JSON.stringify(contenido, null, 2)
            .replace(/[{}"]/g, '') // Quitar llaves y comillas
            .replace(/,$/gm, '')   // Quitar comas al final de las líneas
            .replace(/^\s*\n/gm, ''); // Eliminar líneas vacías

          // Procesar líneas para mejorar formato
          const lines = formattedJSON.split('\n');
          let formattedText = '';
          
          lines.forEach(line => {
            // Detectar si es un array
            if (line.trim().startsWith("[")) {
              formattedText += '\n' + line.trim() + '\n';
            } 
            // Detectar si es un ítem de lista
            else if (line.trim().startsWith("-")) {
              formattedText += "• " + line.trim().substring(1) + '\n';
            }
            // Formato para pares clave-valor con términos clave resaltados
            else if (line.includes(':')) {
              const parts = line.split(':');
              if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(':').trim();
                
                // Términos clave en mayúsculas para resaltar
                if (['tiempo', 'duración', 'objetivo', 'actividad', 'tipo', 'recursos', 'evaluación'].includes(key.toLowerCase())) {
                  formattedText += `${key.toUpperCase()}: ${value}\n`;
                } else {
                  formattedText += `${key}: ${value}\n`;
                }
              } else {
                formattedText += line + '\n';
              }
            } 
            else {
              formattedText += line + '\n';
            }
          });
          
          return formattedText;
        }
      } catch (e) {
        console.error("Error al formatear contenido:", e);
        return String(contenido);
      }
    }
    return String(contenido);
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
      <div className="space-y-8">
        {/* Inicio de clase */}
        <div className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/30 dark:to-transparent p-4 rounded-lg border-l-4 border-blue-400 dark:border-blue-600">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-100 dark:bg-blue-800 p-1.5 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <label className="font-bold text-lg text-blue-700 dark:text-blue-300">Inicio de la Clase</label>
          </div>
          <textarea 
            name="momentosClase.inicio" 
            value={formatearContenido(editablePlan.momentosClase.inicio)}
            onChange={handleChange} 
            rows={5} 
            placeholder="Describe las actividades iniciales, activación de conocimientos previos, motivación y presentación del objetivo de la clase..."
            className="w-full p-3 border border-blue-200 dark:border-blue-700 rounded-md bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 focus:border-blue-300 focus:outline-none transition-all"
            disabled={isLoading || saving}
          />
        </div>
        
        {/* Desarrollo de clase */}
        <div className="bg-gradient-to-r from-green-50 to-transparent dark:from-green-900/30 dark:to-transparent p-4 rounded-lg border-l-4 border-green-400 dark:border-green-600">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-green-100 dark:bg-green-800 p-1.5 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <label className="font-bold text-lg text-green-700 dark:text-green-300">Desarrollo de la Clase</label>
          </div>
          <textarea 
            name="momentosClase.desarrollo" 
            value={formatearContenido(editablePlan.momentosClase.desarrollo)}
            onChange={handleChange} 
            rows={8} 
            placeholder="Describe las actividades principales de aprendizaje, secuencia didáctica, estrategias de enseñanza, actividades prácticas..."
            className="w-full p-3 border border-green-200 dark:border-green-700 rounded-md bg-white dark:bg-slate-800 focus:ring-2 focus:ring-green-300 dark:focus:ring-green-700 focus:border-green-300 focus:outline-none transition-all"
            disabled={isLoading || saving}
          />
        </div>
        
        {/* Cierre de clase */}
        <div className="bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-900/30 dark:to-transparent p-4 rounded-lg border-l-4 border-amber-400 dark:border-amber-600">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-amber-100 dark:bg-amber-800 p-1.5 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-600 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <label className="font-bold text-lg text-amber-700 dark:text-amber-300">Cierre de la Clase</label>
          </div>
          <textarea 
            name="momentosClase.cierre" 
            value={formatearContenido(editablePlan.momentosClase.cierre)}
            onChange={handleChange} 
            rows={5} 
            placeholder="Describe las actividades de cierre, síntesis, metacognición, evaluación formativa y retroalimentación..."
            className="w-full p-3 border border-amber-200 dark:border-amber-700 rounded-md bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-700 focus:border-amber-300 focus:outline-none transition-all"
            disabled={isLoading || saving}
          />
        </div>
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

    const prompt = `Eres un especialista en objetivos educacionales según el currículum nacional chileno. Basado en la siguiente información de una actividad pedagógica, genera un objetivo claro y conciso para esta.
    - Nombre: ${formData.nombre}
    - Descripción: ${formData.descripcion}
    - Tareas: ${formData.tareas.map(t => t.descripcion).join(', ')}
    
    El objetivo debe:
    - Ser breve y conciso (máximo 120 caracteres)
    - Empezar con un verbo en infinitivo (como establece el MINEDUC)
    - Enfocarse en el propósito principal de la actividad
    - Estar alineado con los aprendizajes esperados del currículum nacional
    - Ser medible y observable`;
    
    try {
      logApiCall('Planificación - Actividad Calendario');
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      if (!token) throw new Error('No se pudo obtener el token de autenticación');

      const response = await fetch('/api/generarObjetivoActividad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, formData })
      });

      let objetivo = 'No generado';
      if (response.ok) {
        const data = await response.json();
        objetivo = data.objetivo || objetivo;
      } else {
        console.error('Error al generar objetivo con IA:', await response.text());
        alert("Hubo un error al generar el objetivo. La actividad se guardará sin él.");
      }

      const newActividad: Omit<ActividadPlanificada, 'id'> = {
        ...formData,
        objetivo,
      };

      const actividadId = await saveActividad(newActividad);
      
      const actividadCompleta: ActividadPlanificada = {
        ...newActividad,
        id: actividadId,
      };

      setCurrentActividad(actividadCompleta);
      setView('summary');
    } catch (error) {
      console.error("Error al guardar actividad:", error);
      alert("Error al guardar la actividad. Por favor, intente nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCalendar = (actividad: ActividadPlanificada) => {
    // Lógica para agregar al calendario
    console.log("Agregando al calendario:", actividad);
    // Aquí iría la llamada a saveCalendarEvent si estuviera disponible
    setIsAddedToCalendar(true);
  };

  const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";

  if (view === 'form') {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <form onSubmit={handleSaveActivity} className="space-y-6">
          {/* Formulario de Actividad */}
          <div className="p-4 border rounded-lg dark:border-slate-700">
            <h3 className="text-lg font-bold mb-4">Detalles de la Actividad</h3>
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
  // Usa uid como identificador principal, luego id, luego email como fallbacks
  const userId = currentUser?.uid || currentUser?.id || currentUser?.email || '';
  console.log('🔑 PlanificacionDocente - Usuario actual:', { 
    uid: currentUser?.uid, 
    id: currentUser?.id,
    email: currentUser?.email,
    nombreCompleto: currentUser?.nombreCompleto,
    usuarioSeleccionado: userId
  });
  
  // Verifica si tenemos un usuario válido
  const userIdValido = userId && userId.length > 0;
  console.log('🔑 ID de usuario válido:', userIdValido);
  
  const { 
    planificaciones, 
    save: savePlan, 
    update: updatePlan, 
    remove: deletePlan, 
    loading: planificacionesLoading,
    diagnosticarYReparar
  } = usePlanificaciones(userIdValido ? userId : null, currentUser);
  
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
  const [activeTab, setActiveTab] = useState<'unidad' | 'clase' | 'calendario' | 'materiales' | 'config'>('unidad');
  const [viewingClassPlan, setViewingClassPlan] = useState<PlanificacionClase | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ planId: string; lessonIndex: number; lessonData: DetalleLeccion } | null>(null);
  // Documentos institucionales para planificación (tag: 'planificacion')
  const [planDocs, setPlanDocs] = useState<DocuMeta[]>([]);
  const [selectedPlanDocIds, setSelectedPlanDocIds] = useState<string[]>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadTags, setUploadTags] = useState<string>('planificacion');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const handleOpenEditModal = (lessonIndex: number, lessonData: DetalleLeccion) => {
    if (editingPlanificacion) {
      setEditingLesson({
        planId: editingPlanificacion.id,
        lessonIndex,
        lessonData,
      });
    }
  };

  const handleSelectForEdit = (plan: PlanificacionUnidad) => {
    setEditingPlanificacion(plan);
    setUnidadFormData({
      asignatura: plan.asignatura,
      nivel: plan.nivel,
      nombreUnidad: plan.nombreUnidad,
      contenidos: plan.contenidos,
      cantidadClases: plan.cantidadClases,
      observaciones: plan.observaciones,
      ideasParaUnidad: plan.ideasParaUnidad,
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta planificación?')) {
      try {
        await deletePlan(id);
        if (editingPlanificacion?.id === id) {
          setEditingPlanificacion(null);
        }
      } catch (error) {
        console.error("Error al eliminar planificación:", error);
        alert("No se pudo eliminar la planificación.");
      }
    }
  };

  const handleDeleteClassPlan = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este plan de clase?')) {
      try {
        await deletePlan(id);
        setViewingClassPlan(null);
      } catch (error) {
        console.error("Error al eliminar plan de clase:", error);
        alert("No se pudo eliminar el plan de clase.");
      }
    }
  };
  
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
    // Set initial form state based on assigned values (solo cuando cambian los valores asignados)
    setUnidadFormData(prev => ({
      ...prev,
      asignatura: assignedAsignaturas[0] || '',
      nivel: assignedNiveles[0] || '' as NivelPlanificacion,
    }));
  }, [assignedAsignaturas, assignedNiveles]); // Removed currentUser, userId, planificaciones to prevent infinite re-renders

  const handleUnidadFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setUnidadFormData(prev => ({
      ...prev,
      [name]: name === 'cantidadClases' ? parseInt(value, 10) : value
    }));
  };

  // Suscribirse a Documentación y filtrar por tag 'planificacion'
  useEffect(() => {
    const unsub = subscribeDocs((docs) => {
      const filtered = docs.filter(d => Array.isArray(d.tags) && d.tags.includes('planificacion'));
      setPlanDocs(filtered);
    });
    return () => {
      try { if (typeof unsub === 'function') unsub(); } catch {}
    };
  }, []);

  const toggleSelectPlanDoc = (id: string) => {
    setSelectedPlanDocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const buildUnidadPrompt = () => {
    const { asignatura, nivel, nombreUnidad, contenidos, cantidadClases, observaciones, ideasParaUnidad } = unidadFormData;
    const selectedDocs = planDocs.filter(d => selectedPlanDocIds.includes(d.id));
    const docsContext = selectedDocs.length > 0
      ? `\n\nDocumentos institucionales a considerar (Subdirección):\n${selectedDocs.map(d => `- ${d.title}${d.description ? `: ${d.description}` : ''}`).join('\n')}\n\nUsa estas referencias para alinear la planificación con los lineamientos institucionales.`
      : '';

    return `Eres un experto diseñador curricular para la educación media técnico profesional en Chile. Tu tarea es generar una planificación de unidad didáctica siguiendo fielmente las bases curriculares y los objetivos de aprendizaje del Currículum Nacional Chileno (MINEDUC) para ${asignatura} en ${nivel}. La planificación debe presentarse en formato JSON estructurado.

    **Información Base:**
    - Asignatura: ${asignatura}
    - Nivel: ${nivel}
    - Nombre de la Unidad: "${nombreUnidad}"
    - Contenidos clave a trabajar (insumo principal): "${contenidos}"
    - Cantidad de clases para la unidad: ${cantidadClases}
    - Ideas y perspectiva del docente para la unidad: "${ideasParaUnidad || "Ninguna. Sé creativo."}"
    - Observaciones y énfasis del docente: "${observaciones || "Ninguna"}"
    
    **Orientaciones Curriculares Nacionales:**
    - Asegúrate que los objetivos estén alineados con las Bases Curriculares del MINEDUC para ${asignatura} en ${nivel}.
    - Contempla los Objetivos de Aprendizaje (OA) oficiales del currículum en línea chileno.
    - Incorpora los Objetivos de Aprendizaje Transversales (OAT) cuando sea apropiado.
    - Para niveles técnico-profesionales, considera los perfiles de egreso de cada especialidad.

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

    Asegúrate de que el contenido generado sea coherente, pedagógicamente sólido y esté directamente relacionado con los contenidos clave proporcionados por el docente. El nombre de la unidad debe ser exactamente el proporcionado.${docsContext}`;
  };

  const handleGenerateUnidad = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      logApiCall('Planificación - Unidad');
      const prompt = buildUnidadPrompt();
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      if (!token) throw new Error('No se pudo obtener el token de autenticación');
      
      const response = await fetch('/api/generarUnidadPlanificacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, unidadFormData })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Error response from backend:", errorBody);
        throw new Error(`Error al generar la unidad con IA: ${response.statusText}`);
      }

      const generatedData = await response.json();

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
        documentosInstitucionales: planDocs.filter(d => selectedPlanDocIds.includes(d.id)).map(d => ({ id: d.id, title: d.title })),
      };
      if (editingPlanificacion) {
        await updatePlan(editingPlanificacion.id, newPlan);
        setEditingPlanificacion({ ...newPlan, id: editingPlanificacion.id });
      } else {
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
    
    const buildClasePrompt = () => `Eres un experto pedagogo chileno especialista en diseño de planes de clase alineados con el currículum nacional. A partir de la siguiente información de una clase dentro de una unidad, genera un plan de clase detallado con momentos de inicio, desarrollo y cierre. La clase debe durar 80 minutos.
    
    - Asignatura: ${unitPlan.asignatura}
    - Nivel: ${unitPlan.nivel}
    - Objetivo de la clase: ${lessonDetail.objetivosAprendizaje}
    - Contenidos: ${lessonDetail.contenidosConceptuales}
    - Actividades sugeridas: ${lessonDetail.actividades}
    
    **Orientaciones didácticas**:
    - El plan debe seguir el modelo de diseño instruccional del Ministerio de Educación de Chile.
    - Incluir estrategias de aprendizaje activo y centrado en el estudiante.
    - Incorporar metodologías que desarrollen habilidades del siglo XXI según el currículum chileno.
    - Considerar momentos para activación de conocimientos previos, desarrollo de aprendizajes y metacognición/evaluación.
    
    Responde SÓLO con un objeto JSON que contenga las claves "inicio", "desarrollo" y "cierre", con las actividades detalladas para cada momento.`;

    try {
      logApiCall('Planificación - Utilizar Clase');
      const prompt = buildClasePrompt();
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      if (!token) throw new Error('No se pudo obtener el token de autenticación');

      const response = await fetch('/api/generarClasePlanificacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, unitPlan, lessonDetail, currentUser })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Error response from backend:", errorBody);
        throw new Error(`Error al generar el plan de clase con IA: ${response.statusText}`);
      }
      
      const generatedData = await response.json();

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
  
  // Cargar planificaciones desde cero cuando sea necesario
const recargarPlanificaciones = async () => {
  try {
    console.log("🔄 Recargando planificaciones manualmente...");
    const { getPlanificacionesByUser } = await import('../../src/firebaseHelpers/planificacionHelper');
    
    if (!userId) {
      console.warn("🔄 No hay userId para recargar planificaciones");
      return;
    }
    
    const planificacionesFrescas = await getPlanificacionesByUser(userId);
    console.log(`🔄 Obtenidas ${planificacionesFrescas.length} planificaciones frescas`);
    
    // En vez de actualizar el estado directamente, informamos al usuario
    alert(`Se han encontrado ${planificacionesFrescas.length} planificaciones en la base de datos. Recargue la página para ver los cambios.`);
    
    // Forzamos una recarga de la página para asegurar que todo se cargue correctamente
    window.location.reload();
  } catch (error) {
    console.error("🔄 Error recargando planificaciones:", error);
    alert("Hubo un error al recargar las planificaciones. Intente recargar la página manualmente.");
  }
};

  // Estado para el diagnóstico
  const [diagnosticoEstado, setDiagnosticoEstado] = useState<{
    visible: boolean;
    ejecutando: boolean;
    resultado: { status?: string; message?: string } | null;
  }>({
    visible: false,
    ejecutando: false,
    resultado: null
  });

  // Ejecutar diagnóstico
  const ejecutarDiagnostico = async () => {
    setDiagnosticoEstado(prev => ({ ...prev, ejecutando: true, resultado: null }));
    const resultado = await diagnosticarYReparar();
    setDiagnosticoEstado(prev => ({ ...prev, ejecutando: false, resultado }));
  };

const renderUnidadTab = () => (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Generador de Planificaciones de Unidad</h2>
            <p className="text-slate-500 dark:text-slate-400">Complete los campos y use la IA para crear una planificación de unidad estructurada.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setDiagnosticoEstado(prev => ({ ...prev, visible: !prev.visible }))}
              className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded-md text-sm"
            >
              Diagnóstico
            </button>
            <button 
              onClick={recargarPlanificaciones}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>Recargar</span>
            </button>
          </div>
        </div>
        
        {/* Panel de diagnóstico */}
        {diagnosticoEstado.visible && (
          <div className="mb-6 p-4 border border-slate-300 dark:border-slate-600 rounded-lg">
            <h3 className="font-bold text-lg mb-2">Herramienta de Diagnóstico</h3>
            <p className="text-sm text-slate-500 mb-3">
              Esta herramienta intentará resolver problemas con las planificaciones que no aparecen en el historial.
            </p>
            
            {diagnosticoEstado.resultado && (
              <div className={`p-3 mb-3 rounded-md ${
                diagnosticoEstado.resultado.status === 'ok' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                diagnosticoEstado.resultado.status === 'repaired' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' :
                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
              }`}>
                {diagnosticoEstado.resultado.message}
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={ejecutarDiagnostico}
                disabled={diagnosticoEstado.ejecutando}
                className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-md flex items-center gap-2 disabled:opacity-50"
              >
                {diagnosticoEstado.ejecutando ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>Ejecutar diagnóstico</span>
                )}
              </button>
              
              {diagnosticoEstado.resultado?.status === 'repaired' && (
                <button
                  onClick={() => window.location.reload()}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md"
                >
                  Recargar página
                </button>
              )}
            </div>
          </div>
        )}
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
                  required
                  disabled={loading}
                >
                  {assignedAsignaturas.map(asig => <option key={asig} value={asig}>{asig}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nivel" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nivel</label>
                <select 
                  name="nivel" 
                  value={unidadFormData.nivel} 
                  onChange={handleUnidadFieldChange} 
                  className={inputStyles}
                  required
                  disabled={loading}
                >
                  {assignedNiveles.map(nivel => <option key={nivel} value={nivel}>{nivel}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-1">
                <label htmlFor="nombreUnidad" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre de la Unidad</label>
                <input 
                  type="text" 
                  name="nombreUnidad" 
                  value={unidadFormData.nombreUnidad} 
                  onChange={handleUnidadFieldChange} 
                  className={inputStyles} 
                  placeholder="Ej: Introducción a la Programación"
                  required
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label htmlFor="contenidos" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Contenidos Clave</label>
                <textarea 
                  name="contenidos" 
                  value={unidadFormData.contenidos} 
                  onChange={handleUnidadFieldChange} 
                  rows={3} 
                  placeholder="Describe los temas, conceptos y habilidades principales que se deben abordar en la unidad. Sé lo más específico posible." 
                  className={inputStyles}
                  required
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
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[180px] shadow-md hover:shadow-lg transition-all"
              >
                {loading ? (
                  <RefreshCcw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>{editingPlanificacion ? 'Regenerar Plan' : 'Generar con IA'}</span>
                  </>
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
            {console.log("💾 RENDERIZANDO HISTORIAL - Cantidad de planificaciones:", planificaciones.length)}
            {console.log("💾 RENDERIZANDO HISTORIAL - Cantidad de unidades:", planificaciones.filter(p => p.tipo === 'Unidad').length)}
            
            {/* Versión alternativa que muestra todas las planificaciones independientemente de su estructura */}
            {planificaciones.length > 0 ? 
              planificaciones
                .filter(p => p.tipo === 'Unidad')
                .map(plan => (
                <div 
                  key={plan.id} 
                  className={`p-5 border rounded-xl transition-all ${
                    editingPlanificacion?.id === plan.id 
                      ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-500/30 shadow-lg shadow-indigo-100/20 dark:shadow-indigo-900/10' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700/50'
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
                      <div className="mt-2 flex items-center gap-2">
                        {plan.reflexionUnidad && plan.reflexionUnidad.fortalezas && plan.reflexionUnidad.mejoras && plan.reflexionUnidad.debilidades ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Reflexión completa</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Reflexión pendiente</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleSelectForEdit(plan)} 
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        disabled={loading}
                      >
                        <FileEdit className="w-4 h-4" />
                        <span>Editar</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(plan.id)} 
                        title="Eliminar" 
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-300 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        disabled={loading}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Eliminar</span>
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
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-3 mb-6">
          <BookMarked className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Planes de Clase</h2>
        </div>
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

  // Panel de Configuración (Subdirección): subir y gestionar documentos institucionales de planificación
  const renderConfigTab = () => {
    const isSubdir = currentUser?.profile === 'SUBDIRECCION';
    if (!isSubdir) {
      return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
          <p className="text-slate-500 dark:text-slate-400">Esta sección está disponible solo para Subdirección.</p>
        </div>
      );
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] || null;
      setUploadFile(f);
    };

    const handleUpload = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!uploadFile || !uploadTitle.trim()) return;
      setUploading(true);
      try {
        const tags = uploadTags.split(',').map(t => t.trim()).filter(Boolean);
        if (!tags.includes('planificacion')) tags.push('planificacion');
        const docId = await createDocMeta(uploadTitle.trim(), uploadDesc.trim(), tags);
        const { storagePath, contentType } = await uploadFileForDoc(docId, uploadFile);
        await indexDocument(docId, storagePath, uploadTitle.trim(), uploadDesc.trim(), tags, contentType);
        setUploadTitle('');
        setUploadDesc('');
        setUploadTags('planificacion');
        setUploadFile(null);
        alert('Documento subido e indexado correctamente.');
      } catch (err) {
        console.error('Error subiendo documento de planificación:', err);
        alert('No se pudo subir/indexar el documento.');
      } finally {
        setUploading(false);
      }
    };

    const handleReindex = async (doc: DocuMeta) => {
      try {
        if (!doc.storagePath) return alert('El documento no tiene archivo asociado.');
        await indexDocument(doc.id, doc.storagePath, doc.title, doc.description || '', doc.tags || ['planificacion'], doc.contentType);
        alert('Reindexación encolada.');
      } catch (e) {
        console.error('Error reindexando:', e);
        alert('Error reindexando el documento.');
      }
    };

    const handleOpen = async (doc: DocuMeta) => {
      try {
        if (!doc.storagePath) return alert('No hay archivo asociado.');
        const url = await getDownloadURL(storageRef(storage, doc.storagePath));
        window.open(url, '_blank');
      } catch (e) {
        console.error('Error obteniendo URL:', e);
        alert('No se pudo abrir el documento.');
      }
    };

    const handleDelete = async (doc: DocuMeta) => {
      if (!confirm(`¿Eliminar "${doc.title}"? Esta acción no se puede deshacer.`)) return;
      try {
        await deleteDocMeta(doc.id);
      } catch (e) {
        console.error('Error eliminando documento:', e);
        alert('No se pudo eliminar el documento.');
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Repositorio institucional para Planificación</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Suba documentos (PDF/TXT/DOCX) que el profesorado podrá seleccionar al planificar. Se etiquetarán con <strong>planificacion</strong>.</p>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium mb-1">Título</label>
              <input value={uploadTitle} onChange={e=>setUploadTitle(e.target.value)} className={inputStyles} placeholder="Ej: PEI 2025" required />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium mb-1">Tags (coma)</label>
              <input value={uploadTags} onChange={e=>setUploadTags(e.target.value)} className={inputStyles} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <textarea value={uploadDesc} onChange={e=>setUploadDesc(e.target.value)} rows={2} className={inputStyles} placeholder="Breve descripción" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Archivo</label>
              <input type="file" accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} className="block w-full"/>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button disabled={uploading || !uploadFile || !uploadTitle.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2">
                {uploading ? <RefreshCcw className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
                <span>Subir e indexar</span>
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Documentos disponibles</h3>
          {planDocs.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">Aún no hay documentos institucionales con la etiqueta "planificacion".</p>
          ) : (
            <div className="space-y-3">
              {planDocs.map(d => (
                <div key={d.id} className="p-4 rounded-lg border dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{d.title}</p>
                    {d.description && <p className="text-sm text-slate-500 dark:text-slate-400">{d.description}</p>}
                    {Array.isArray(d.tags) && d.tags.length>0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {d.tags.map(t => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>handleOpen(d)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm">Abrir</button>
                    <button onClick={()=>handleReindex(d)} className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 text-sm">Reindexar</button>
                    <button onClick={()=>handleDelete(d)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Verificar datos de planificaciones
  useEffect(() => {
    // Obtención inicial directa de planificaciones para diagnóstico
    const obtenerPlanificacionesDirectas = async () => {
      try {
        console.log("📊 Diagnóstico de planificaciones - Inicio");
        console.log(`userId: ${userId}`);
        
        if (!userId) {
          console.warn("📊 Sin userId, no se pueden obtener planificaciones");
          return;
        }

        // Obtener planificaciones directamente sin usar la suscripción
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../src/firebaseHelpers/config');
        
        const q = query(
          collection(db, 'planificaciones'),
          where('userId', '==', userId)
        );
        
        const snapshot = await getDocs(q);
        console.log(`📊 Documentos en Firestore: ${snapshot.docs.length}`);
        
        if (snapshot.docs.length > 0) {
          console.log(`📊 Primer documento:`, snapshot.docs[0].data());
          
          // Comprobar cuántas son de tipo Unidad
          const unidades = snapshot.docs.filter(doc => doc.data().tipo === 'Unidad');
          console.log(`📊 Documentos de tipo Unidad: ${unidades.length}`);
          
          // Comprobar cuántas tienen detallesLeccion válidos
          const unidadesValidas = unidades.filter(doc => 
            Array.isArray(doc.data().detallesLeccion) && doc.data().detallesLeccion !== undefined
          );
          console.log(`📊 Unidades con detallesLeccion válidos: ${unidadesValidas.length}`);
          
          // Corregir las inválidas
          if (unidades.length > unidadesValidas.length) {
            console.log(`📊 Intentando corregir ${unidades.length - unidadesValidas.length} unidades inválidas...`);
            
            for (const doc of unidades) {
              const data = doc.data();
              if (!Array.isArray(data.detallesLeccion) || data.detallesLeccion === undefined) {
                try {
                  console.log(`📊 Corrigiendo documento ${doc.id}...`);
                  const { doc: docRef, updateDoc } = await import('firebase/firestore');
                  await updateDoc(docRef(db, 'planificaciones', doc.id), {
                    detallesLeccion: []
                  });
                  console.log(`📊 Documento ${doc.id} corregido con éxito`);
                } catch (e) {
                  console.error(`📊 Error al corregir documento ${doc.id}:`, e);
                }
              }
            }
          }
        }
        
        console.log("📊 Diagnóstico de planificaciones - Finalizado");
      } catch (error) {
        console.error("📊 Error en diagnóstico de planificaciones:", error);
      }
    };
    
    // Ejecutar diagnóstico solo una vez al montar el componente
    obtenerPlanificacionesDirectas();
    
    // Corregir planificaciones inválidas que llegan por la suscripción
    if (!planificacionesLoading) {
      console.log(`🔍 Verificando ${planificaciones.length} planificaciones recibidas...`);
      console.log(`🔍 Tipos de planificaciones:`, planificaciones.map(p => p.tipo));
      
      // Verificar planificaciones de unidad con detallesLeccion incorrectos
      const unidadesInvalidas = planificaciones.filter(p => 
        p.tipo === 'Unidad' && 
        (!Array.isArray((p as any).detallesLeccion) || (p as any).detallesLeccion === undefined)
      );
      
      if (unidadesInvalidas.length > 0) {
        console.warn(`🔍 Encontradas ${unidadesInvalidas.length} unidades con formato inválido`);
        
        // Intentar corregir las planificaciones inválidas
        unidadesInvalidas.forEach(async (plan) => {
          try {
            await updatePlan(plan.id, { 
              ...plan,
              detallesLeccion: [] 
            });
            console.log(`🔍 Reparada planificación ${plan.id}`);
          } catch (err) {
            console.error(`🔍 Error al reparar planificación ${plan.id}:`, err);
          }
        });
      }
    }
  }, [userId, planificaciones, planificacionesLoading, updatePlan]);

  // Verificar que el usuario está autenticado y tiene ID válido
  if (!currentUser) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 mb-2">Error: Usuario no autenticado</p>
          <p className="text-sm text-slate-400">No se recibieron datos de usuario</p>
        </div>
      </div>
    );
  }
  
  // Si no hay userId válido
  if (!userIdValido) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-8 max-w-2xl mx-auto my-8">
        <h2 className="text-2xl font-bold text-amber-800 dark:text-amber-300 mb-4">
          Error de identificación de usuario
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-md p-4 mb-4 overflow-auto max-h-40">
          <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
            {JSON.stringify(currentUser, null, 2)}
          </pre>
        </div>
        <p className="text-amber-700 dark:text-amber-400 mb-4">
          No se pudo determinar su identificador de usuario para cargar las planificaciones. 
          Este problema puede deberse a:
        </p>
        <ul className="list-disc pl-5 text-amber-700 dark:text-amber-400 mb-6 space-y-2">
          <li>La sesión no se ha inicializado correctamente</li>
          <li>Su cuenta no tiene asignado un ID válido</li>
          <li>Hay un problema en la sincronización con la base de datos</li>
        </ul>
        <div className="flex justify-center">
          <button
            onClick={() => window.location.reload()}
            className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-6 rounded-md transition-colors"
          >
            Recargar aplicación
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <LayoutDashboard className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Planificación Docente</h1>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-2">
        <nav className="flex space-x-2" aria-label="Tabs">
          <button 
            onClick={() => setActiveTab('unidad')} 
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'unidad' 
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Unidad</span>
          </button>
          <button 
            onClick={() => setActiveTab('clase')} 
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'clase' 
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50'
            }`}
          >
            <School2 className="w-4 h-4" />
            <span>Clase</span>
          </button>
          <button 
            onClick={() => setActiveTab('calendario')} 
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'calendario' 
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Actividades Calendario</span>
          </button>
          <button 
            onClick={() => setActiveTab('materiales')} 
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'materiales' 
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50'
            }`}
          >
            <PresentationIcon className="w-4 h-4" />
            <span>Mis Materiales</span>
          </button>
          {currentUser?.profile === 'SUBDIRECCION' && (
            <button 
              onClick={() => setActiveTab('config')} 
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'config' 
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50'
              }`}
            >
              <FileEdit className="w-4 h-4" />
              <span>Configuración</span>
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'unidad' && (
        <div className="space-y-6">
          {/* Filtro/selector de documentos institucionales */}
          <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Documentación institucional (opcional)</h3>
            {planDocs.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">Subdirección aún no ha cargado documentos. Cuando existan, podrás seleccionarlos aquí para considerar en la generación.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {planDocs.map(doc => (
                  <label key={doc.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={selectedPlanDocIds.includes(doc.id)} onChange={()=>toggleSelectPlanDoc(doc.id)} />
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{doc.title}</p>
                      {doc.description && <p className="text-sm text-slate-500 dark:text-slate-400">{doc.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          {renderUnidadTab()}
        </div>
      )}
      {activeTab === 'clase' && renderClaseTab()}
      {activeTab === 'calendario' && <ActividadesCalendarioSubmodule userId={userId} />}
      {activeTab === 'materiales' && <MaterialesDidacticosSubmodule userId={userId} planificaciones={planificaciones} />}
      {activeTab === 'config' && renderConfigTab()}

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