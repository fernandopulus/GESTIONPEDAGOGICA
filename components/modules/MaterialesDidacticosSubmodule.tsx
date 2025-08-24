import React, { useState, useEffect } from 'react';
import { 
  Presentation, 
  Book, 
  Files, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  X, 
  Loader2, 
  ExternalLink,
  FileDown,
  Trash2
} from 'lucide-react';
import { 
  savePresentacion, 
  subscribeToPresentaciones, 
  deletePresentacion, 
  generateSlides 
} from '../../src/firebaseHelpers/materialesDidacticos';
import type { 
  PlanificacionUnidad, 
  PlanificacionClase, 
  EstiloPresentacion, 
  PresentacionDidactica,
  PlanificacionDocente
} from '../../types';

interface MaterialesDidacticosSubmoduleProps {
  userId: string;
  planificaciones: (PlanificacionUnidad | PlanificacionClase)[];
}

type TabMateriales = 'presentaciones' | 'guias' | 'recursos';

const MaterialesDidacticosSubmodule: React.FC<MaterialesDidacticosSubmoduleProps> = ({ 
  userId,
  planificaciones
}) => {
  // Estado para las tabs dentro del submódulo
  const [activeTabMateriales, setActiveTabMateriales] = useState<TabMateriales>('presentaciones');
  
  // Estado para la planificación seleccionada
  const [planificacionSeleccionada, setPlanificacionSeleccionada] = useState<PlanificacionDocente | null>(null);
  
  // Estado para el formulario de presentación
  const [formData, setFormData] = useState({
    tema: '',
    objetivosAprendizaje: [] as string[],
    numDiapositivas: 8,
    estilo: 'sobrio' as EstiloPresentacion,
    incluirImagenes: true,
    contenidoFuente: '',
    enlaces: ''
  });
  
  // Estado para las presentaciones existentes
  const [presentaciones, setPresentaciones] = useState<PresentacionDidactica[]>([]);
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener presentaciones del usuario
  useEffect(() => {
    if (!userId) return;
    
    const unsubscribe = subscribeToPresentaciones(userId, (data) => {
      setPresentaciones(data);
    });
    
    return unsubscribe;
  }, [userId]);

  // Actualizar datos del formulario cuando se selecciona una planificación
  useEffect(() => {
    if (planificacionSeleccionada) {
      // Si es una unidad, usar el nombre de la unidad como tema
      if ('nombreUnidad' in planificacionSeleccionada) {
        setFormData(prev => ({
          ...prev,
          tema: planificacionSeleccionada.nombreUnidad
        }));
      } 
      // Si es una clase, usar el nombre de la clase como tema
      else if ('nombreClase' in planificacionSeleccionada) {
        setFormData(prev => ({
          ...prev,
          tema: planificacionSeleccionada.nombreClase
        }));
      }
    }
  }, [planificacionSeleccionada]);

  // Obtener los objetivos de aprendizaje de la planificación seleccionada
  const getObjetivosAprendizaje = () => {
    if (!planificacionSeleccionada) return [];
    
    if ('lecciones' in planificacionSeleccionada) {
      // Es una planificación de unidad, extraer OAs de las lecciones
      const objetivos: string[] = [];
      planificacionSeleccionada.lecciones?.forEach(leccion => {
        if (leccion.objetivosAprendizaje && !objetivos.includes(leccion.objetivosAprendizaje)) {
          objetivos.push(leccion.objetivosAprendizaje);
        }
      });
      return objetivos;
    } else if (planificacionSeleccionada.detalleLeccionOrigen) {
      // Es una planificación de clase con detalle de lección de origen
      return [planificacionSeleccionada.detalleLeccionOrigen.objetivosAprendizaje];
    }
    
    return [];
  };

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Manejar cambios en los objetivos de aprendizaje (multiselect)
  const handleObjetivosChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(
      e.target.selectedOptions, 
      (option: HTMLOptionElement) => option.value
    );
    setFormData(prev => ({ ...prev, objetivosAprendizaje: selectedOptions }));
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planificacionSeleccionada) {
      setError('Debes seleccionar una planificación');
      return;
    }
    
    if (formData.objetivosAprendizaje.length === 0) {
      setError('Debes seleccionar al menos un objetivo de aprendizaje');
      return;
    }

    setError(null);
    setGenerando(true);
    
    try {
      // Preparar datos para la presentación
      const presentacionData = {
        planificacionId: planificacionSeleccionada.id,
        tema: formData.tema,
        curso: planificacionSeleccionada.nivel,
        asignatura: planificacionSeleccionada.asignatura,
        objetivosAprendizaje: formData.objetivosAprendizaje,
        numDiapositivas: formData.numDiapositivas,
        estilo: formData.estilo,
        incluirImagenes: formData.incluirImagenes,
        contenidoFuente: formData.contenidoFuente,
        enlaces: formData.enlaces ? formData.enlaces.split(/[\s,]+/).filter(Boolean) : [],
      };
      
      console.log('Datos para presentación:', presentacionData);
      
      // Llamar a la Cloud Function para generar la presentación
      // La función generateSlides ya maneja la creación del documento en Firestore
      const result = await generateSlides({
        ...presentacionData,
        userId
      });
      
      console.log('Resultado de la función:', result);
      
      // Actualizar la presentación con la URL generada
      if (result && result.url) {
        // La presentación se actualizará automáticamente a través de la suscripción
        console.log('Presentación generada:', result.url);
      }
    } catch (err: any) {
      console.error('Error al generar presentación:', err);
      // Mostrar más detalles del error
      const errorMessage = err?.message || 'Error desconocido';
      const errorCode = err?.code || 'unknown';
      setError(`Error (${errorCode}): ${errorMessage}`);
    } finally {
      setGenerando(false);
    }
  };

  // Eliminar presentación
  const handleDeletePresentacion = async (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta presentación?')) {
      try {
        setLoading(true);
        await deletePresentacion(id);
      } catch (err) {
        console.error('Error al eliminar presentación:', err);
        setError('Error al eliminar la presentación');
      } finally {
        setLoading(false);
      }
    }
  };

  // Renderizar la pestaña de presentaciones
  const renderPresentacionesTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formulario para generar presentación */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">
            Generar Presentación con IA
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selector de planificación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Seleccionar Planificación
              </label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md bg-white dark:bg-slate-700 dark:border-slate-600"
                value={planificacionSeleccionada?.id || ''}
                onChange={(e) => {
                  const selected = planificaciones.find(p => p.id === e.target.value);
                  setPlanificacionSeleccionada(selected || null);
                }}
                required
              >
                <option value="">Seleccione una planificación</option>
                <optgroup label="Unidades">
                  {planificaciones
                    .filter(p => p.tipo === 'Unidad')
                    .map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.tipo === 'Unidad' ? plan.nombreUnidad : ''} - {plan.asignatura} ({plan.nivel})
                      </option>
                    ))
                  }
                </optgroup>
                <optgroup label="Clases">
                  {planificaciones
                    .filter(p => p.tipo === 'Clase')
                    .map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.tipo === 'Clase' ? plan.nombreClase : ''} - {plan.asignatura} ({plan.nivel})
                      </option>
                    ))
                  }
                </optgroup>
              </select>
            </div>

            {/* Tema de la presentación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tema
              </label>
              <input
                type="text"
                name="tema"
                value={formData.tema}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md bg-white dark:bg-slate-700 dark:border-slate-600"
                required
              />
            </div>
            
            {/* Objetivos de Aprendizaje */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Objetivos de Aprendizaje (selecciona al menos uno)
              </label>
              <select
                multiple
                name="objetivosAprendizaje"
                value={formData.objetivosAprendizaje}
                onChange={handleObjetivosChange}
                className="w-full p-2 border border-gray-300 rounded-md bg-white dark:bg-slate-700 dark:border-slate-600"
                size={3}
                required
              >
                {getObjetivosAprendizaje().map((objetivo, index) => (
                  <option key={index} value={objetivo}>
                    {objetivo}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Mantén presionado Ctrl (o Cmd) para seleccionar múltiples opciones</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Número de diapositivas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nº de diapositivas
                </label>
                <input
                  type="number"
                  name="numDiapositivas"
                  value={formData.numDiapositivas}
                  onChange={handleChange}
                  min={4}
                  max={20}
                  className="w-full p-2 border border-gray-300 rounded-md bg-white dark:bg-slate-700 dark:border-slate-600"
                />
              </div>
              
              {/* Estilo de presentación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estilo
                </label>
                <select
                  name="estilo"
                  value={formData.estilo}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md bg-white dark:bg-slate-700 dark:border-slate-600"
                >
                  <option value="sobrio">Sobrio</option>
                  <option value="visual">Visual</option>
                </select>
              </div>
            </div>
            
            {/* Incluir imágenes libres */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="incluirImagenes"
                name="incluirImagenes"
                checked={formData.incluirImagenes}
                onChange={(e) => setFormData(prev => ({ ...prev, incluirImagenes: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="incluirImagenes" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Incluir imágenes libres de derechos
              </label>
            </div>
            
            {/* Contenido fuente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Texto/recursos fuente (opcional)
              </label>
              <textarea
                name="contenidoFuente"
                value={formData.contenidoFuente}
                onChange={handleChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md bg-white dark:bg-slate-700 dark:border-slate-600"
                placeholder="Pega aquí cualquier contenido de referencia para la presentación..."
              />
            </div>
            
            {/* Enlaces */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Enlaces (opcional)
              </label>
              <input
                type="text"
                name="enlaces"
                value={formData.enlaces}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md bg-white dark:bg-slate-700 dark:border-slate-600"
                placeholder="URLs separadas por comas o espacios"
              />
            </div>
            
            {/* Mensaje de error */}
            {error && (
              <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                {error}
              </div>
            )}
            
            {/* Botón de envío */}
            <div>
              <button
                type="submit"
                disabled={generando || !planificacionSeleccionada}
                className="w-full flex items-center justify-center gap-2 p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Presentation className="w-4 h-4" />
                    Generar Presentación
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Listado de presentaciones previas */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md h-full">
          <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">
            Mis Presentaciones
          </h2>
          
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : presentaciones.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No has generado presentaciones todavía
              </p>
            ) : (
              presentaciones.map(presentacion => (
                <div 
                  key={presentacion.id} 
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                      {presentacion.tema}
                    </h3>
                    
                    {presentacion.estado === 'generando' ? (
                      <span className="flex items-center text-amber-500 text-xs gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Generando
                      </span>
                    ) : presentacion.estado === 'error' ? (
                      <span className="flex items-center text-red-500 text-xs gap-1">
                        <X className="w-3 h-3" />
                        Error
                      </span>
                    ) : (
                      <span className="flex items-center text-green-500 text-xs gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Lista
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {presentacion.asignatura} - {presentacion.curso}
                  </p>
                  
                  <div className="flex items-center text-xs text-gray-500 space-x-4 mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(presentacion.fechaCreacion).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Files className="w-3 h-3" />
                      {presentacion.numDiapositivas} diapositivas
                    </span>
                  </div>
                  
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Objetivos de Aprendizaje:
                    </p>
                    <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400">
                      {presentacion.objetivosAprendizaje.map((obj, i) => (
                        <li key={i} className="truncate">
                          {obj.length > 60 ? obj.substring(0, 57) + '...' : obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Mensaje de error o nota de demostración */}
                  {presentacion.mensajeError && (
                    <div className="mt-2 text-xs italic text-amber-600 dark:text-amber-400">
                      {presentacion.mensajeError}
                    </div>
                  )}
                  
                  <div className="mt-3 flex justify-between">
                    {presentacion.estado === 'completada' ? (
                      <a
                        href={presentacion.esDemoMode || presentacion.urlPresentacion.includes("example.com") 
                          ? "#" // Evitar navegar a URLs de ejemplo
                          : presentacion.urlPresentacion}
                        onClick={(e) => {
                          if (presentacion.esDemoMode || presentacion.urlPresentacion.includes("example.com")) {
                            e.preventDefault();
                            alert("Esta es una versión de demostración. En la versión final, aquí verás una presentación real de Google Slides.");
                          }
                        }}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-sm ${
                          presentacion.esDemoMode || presentacion.urlPresentacion.includes("example.com") 
                            ? "text-amber-600 hover:text-amber-800"
                            : "text-blue-600 hover:text-blue-800"
                        }`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {presentacion.esDemoMode || presentacion.urlPresentacion.includes("example.com") ? "Ver Demo" : "Abrir en Google Slides"}
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm italic">
                        En progreso...
                      </span>
                    )}
                    
                    <button
                      onClick={() => handleDeletePresentacion(presentacion.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Renderizar la pestaña de guías (placeholder)
  const renderGuiasTab = () => (
    <div className="bg-white dark:bg-slate-800 p-10 rounded-xl shadow-md text-center">
      <Book className="w-16 h-16 mx-auto text-gray-400" />
      <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mt-4">
        Sección de Guías Didácticas
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mt-2">
        Esta función estará disponible próximamente.
      </p>
    </div>
  );

  // Renderizar la pestaña de recursos (placeholder)
  const renderRecursosTab = () => (
    <div className="bg-white dark:bg-slate-800 p-10 rounded-xl shadow-md text-center">
      <Files className="w-16 h-16 mx-auto text-gray-400" />
      <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mt-4">
        Repositorio de Recursos
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mt-2">
        Esta función estará disponible próximamente.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Pestañas secundarias */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-1">
        <nav className="flex space-x-2" aria-label="Tabs">
          <button 
            onClick={() => setActiveTabMateriales('presentaciones')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTabMateriales === 'presentaciones' 
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50'
            }`}
          >
            <Presentation className="w-4 h-4" />
            <span>Presentaciones</span>
          </button>
          
          <button 
            onClick={() => setActiveTabMateriales('guias')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTabMateriales === 'guias' 
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50'
            }`}
          >
            <Book className="w-4 h-4" />
            <span>Guías</span>
          </button>
          
          <button 
            onClick={() => setActiveTabMateriales('recursos')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTabMateriales === 'recursos' 
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50'
            }`}
          >
            <Files className="w-4 h-4" />
            <span>Recursos</span>
          </button>
        </nav>
      </div>
      
      {/* Contenido según la tab seleccionada */}
      <div>
        {activeTabMateriales === 'presentaciones' && renderPresentacionesTab()}
        {activeTabMateriales === 'guias' && renderGuiasTab()}
        {activeTabMateriales === 'recursos' && renderRecursosTab()}
      </div>
    </div>
  );
};

export default MaterialesDidacticosSubmodule;
