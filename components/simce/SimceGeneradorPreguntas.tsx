import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { 
  PenTool, 
  Plus, 
  ListFilter, 
  Search, 
  Trash2, 
  Edit, 
  PlusCircle, 
  Save,
  RefreshCw,
  BookOpen,
  Calculator,
  X,
  Check,
  HelpCircle,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Eye,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { 
  SetPreguntas, 
  Pregunta, 
  AsignaturaSimce, 
  Alternativa,
  estandaresLectura,
  estandaresMatematica
} from '../../../types/simce';
import { 
  crearSetPreguntas, 
  actualizarSetPreguntas, 
  obtenerSetsPreguntasPorProfesor,
  eliminarSetPreguntas
} from '../../../src/firebaseHelpers/simceHelper';
import { generarPreguntasSimce } from '../../../src/ai/simceGenerator';

interface SimceGeneradorPreguntasProps {
  currentUser: User;
}

export const SimceGeneradorPreguntas: React.FC<SimceGeneradorPreguntasProps> = ({ currentUser }) => {
  // Estados para las evaluaciones existentes
  const [setsPreguntas, setSetsPreguntas] = useState<SetPreguntas[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modoVisualizacion, setModoVisualizacion] = useState<'lista' | 'detalle'>('lista');
  const [setSeleccionado, setSetSeleccionado] = useState<SetPreguntas | null>(null);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroAsignatura, setFiltroAsignatura] = useState<'todas' | AsignaturaSimce>('todas');

  // Estados para crear/editar evaluaciones
  const [modoEdicion, setModoEdicion] = useState(false);
  const [nuevaEvaluacion, setNuevaEvaluacion] = useState<Partial<SetPreguntas>>({
    titulo: '',
    descripcion: '',
    asignatura: 'Lectura',
    preguntas: [],
    cursosAsignados: [],
    barajarPreguntas: true,
    barajarAlternativas: true
  });
  const [generandoPreguntas, setGenerandoPreguntas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursos, setCursos] = useState<{id: string, nombre: string}[]>([
    { id: '1A', nombre: '1° Básico A' },
    { id: '1B', nombre: '1° Básico B' },
    { id: '2A', nombre: '2° Básico A' },
    { id: '2B', nombre: '2° Básico B' },
    { id: '3A', nombre: '3° Básico A' },
    { id: '3B', nombre: '3° Básico B' },
    { id: '4A', nombre: '4° Básico A' },
    { id: '4B', nombre: '4° Básico B' }
  ]);
  const [cursosFiltrados, setCursosFiltrados] = useState<{id: string, nombre: string}[]>([]);
  const [searchCurso, setSearchCurso] = useState('');
  const [showCursoDropdown, setShowCursoDropdown] = useState(false);
  const [preguntaSeleccionada, setPreguntaSeleccionada] = useState<Pregunta | null>(null);
  const [preguntaEnEdicion, setPreguntaEnEdicion] = useState<Pregunta | null>(null);
  
  // Cargar sets de preguntas del profesor
  useEffect(() => {
    const cargarSetsPreguntas = async () => {
      try {
        setCargando(true);
        const sets = await obtenerSetsPreguntasPorProfesor(currentUser.uid || '');
        setSetsPreguntas(sets);
      } catch (error) {
        console.error('Error al cargar sets de preguntas:', error);
        setError('No se pudieron cargar los sets de preguntas');
      } finally {
        setCargando(false);
      }
    };
    
    cargarSetsPreguntas();
  }, [currentUser]);

  useEffect(() => {
    if (searchCurso) {
      setCursosFiltrados(
        cursos.filter(curso => 
          curso.nombre.toLowerCase().includes(searchCurso.toLowerCase())
        )
      );
    } else {
      setCursosFiltrados([]);
    }
  }, [searchCurso, cursos]);

  const filtrarSetsPreguntas = () => {
    return setsPreguntas.filter(set => {
      const coincideTitulo = set.titulo.toLowerCase().includes(filtroBusqueda.toLowerCase());
      const coincideAsignatura = filtroAsignatura === 'todas' || set.asignatura === filtroAsignatura;
      return coincideTitulo && coincideAsignatura;
    });
  };

  const handleCrearEvaluacion = () => {
    setModoEdicion(true);
    setSetSeleccionado(null);
    setNuevaEvaluacion({
      titulo: '',
      descripcion: '',
      asignatura: 'Lectura',
      preguntas: [],
      cursosAsignados: [],
      barajarPreguntas: true,
      barajarAlternativas: true
    });
    setPreguntaSeleccionada(null);
    setPreguntaEnEdicion(null);
    setModoVisualizacion('detalle');
  };

  const handleEditarSet = (set: SetPreguntas) => {
    setModoEdicion(true);
    setSetSeleccionado(set);
    setNuevaEvaluacion({ ...set });
    setModoVisualizacion('detalle');
  };

  const handleEliminarSet = async (set: SetPreguntas) => {
    if (window.confirm(`¿Estás seguro de eliminar el set "${set.titulo}"? Esta acción no se puede deshacer.`)) {
      try {
        await eliminarSetPreguntas(set.id);
        setSetsPreguntas(prev => prev.filter(s => s.id !== set.id));
      } catch (error) {
        console.error('Error al eliminar set:', error);
        setError('No se pudo eliminar el set de preguntas');
      }
    }
  };

  const handleGuardarEvaluacion = async () => {
    try {
      if (!nuevaEvaluacion.titulo) {
        setError('El título es obligatorio');
        return;
      }

      if (!nuevaEvaluacion.preguntas || nuevaEvaluacion.preguntas.length === 0) {
        setError('Debe agregar al menos una pregunta');
        return;
      }

      setCargando(true);

      if (setSeleccionado) {
        // Actualizar set existente
        await actualizarSetPreguntas(setSeleccionado.id, nuevaEvaluacion);
        
        // Actualizar la lista de sets
        setSetsPreguntas(prev => prev.map(set => 
          set.id === setSeleccionado.id ? { ...set, ...nuevaEvaluacion } as SetPreguntas : set
        ));
      } else {
        // Crear nuevo set
        const nuevoSet = {
          ...nuevaEvaluacion,
          creadorId: currentUser.uid || '',
          creadorNombre: currentUser.nombreCompleto || '',
          fechaCreacion: new Date().toISOString()
        } as Omit<SetPreguntas, 'id'>;
        
        const nuevoId = await crearSetPreguntas(nuevoSet);
        const setCompleto = { id: nuevoId, ...nuevoSet } as SetPreguntas;
        
        // Agregar a la lista
        setSetsPreguntas(prev => [setCompleto, ...prev]);
      }

      setModoEdicion(false);
      setModoVisualizacion('lista');
      setError(null);
    } catch (error) {
      console.error('Error al guardar evaluación:', error);
      setError('No se pudo guardar la evaluación');
    } finally {
      setCargando(false);
    }
  };

  const handleGenerarPreguntas = async () => {
    try {
      if (!nuevaEvaluacion.asignatura) {
        setError('Seleccione una asignatura para generar preguntas');
        return;
      }
      
      setGenerandoPreguntas(true);
      setError(null);
      
      const preguntasGeneradas = await generarPreguntasSimce(
        nuevaEvaluacion.asignatura,
        5 // Cantidad de preguntas a generar
      );
      
      // Actualizar el estado con las nuevas preguntas
      setNuevaEvaluacion(prev => ({
        ...prev,
        preguntas: [...(prev.preguntas || []), ...preguntasGeneradas]
      }));
    } catch (error) {
      console.error('Error al generar preguntas:', error);
      setError('No se pudieron generar las preguntas. Intente nuevamente.');
    } finally {
      setGenerandoPreguntas(false);
    }
  };

  const handleAgregarPregunta = () => {
    const nuevaPregunta: Pregunta = {
      id: `p${Date.now()}`,
      enunciado: '',
      alternativas: [
        { id: 'A', texto: '', esCorrecta: true, explicacion: '' },
        { id: 'B', texto: '', esCorrecta: false },
        { id: 'C', texto: '', esCorrecta: false },
        { id: 'D', texto: '', esCorrecta: false }
      ],
      estandarAprendizaje: nuevaEvaluacion.asignatura === 'Lectura'
        ? estandaresLectura[0]
        : estandaresMatematica[0]
    };
    
    setPreguntaEnEdicion(nuevaPregunta);
  };

  const handleEditarPregunta = (pregunta: Pregunta) => {
    setPreguntaEnEdicion({ ...pregunta });
  };

  const handleGuardarPregunta = () => {
    if (!preguntaEnEdicion) return;
    
    if (!preguntaEnEdicion.enunciado) {
      setError('El enunciado de la pregunta es obligatorio');
      return;
    }
    
    const alternativaCorrecta = preguntaEnEdicion.alternativas.find(alt => alt.esCorrecta);
    if (!alternativaCorrecta) {
      setError('Debe marcar una alternativa como correcta');
      return;
    }
    
    const alternativasSinTexto = preguntaEnEdicion.alternativas.filter(alt => !alt.texto);
    if (alternativasSinTexto.length > 0) {
      setError('Todas las alternativas deben tener texto');
      return;
    }
    
    if (preguntaEnEdicion.id.startsWith('p')) {
      // Es una pregunta nueva
      setNuevaEvaluacion(prev => ({
        ...prev,
        preguntas: [...(prev.preguntas || []), preguntaEnEdicion]
      }));
    } else {
      // Actualizar pregunta existente
      setNuevaEvaluacion(prev => ({
        ...prev,
        preguntas: prev.preguntas?.map(p => 
          p.id === preguntaEnEdicion.id ? preguntaEnEdicion : p
        ) || []
      }));
    }
    
    setPreguntaEnEdicion(null);
    setError(null);
  };

  const handleEliminarPregunta = (id: string) => {
    setNuevaEvaluacion(prev => ({
      ...prev,
      preguntas: prev.preguntas?.filter(p => p.id !== id) || []
    }));
  };

  const handleCambiarAlternativaCorrecta = (preguntaId: string, alternativaId: string) => {
    setNuevaEvaluacion(prev => ({
      ...prev,
      preguntas: prev.preguntas?.map(p => {
        if (p.id === preguntaId) {
          return {
            ...p,
            alternativas: p.alternativas.map(alt => ({
              ...alt,
              esCorrecta: alt.id === alternativaId
            }))
          };
        }
        return p;
      }) || []
    }));
  };

  const handleToggleCurso = (cursoId: string) => {
    setNuevaEvaluacion(prev => {
      const cursosAsignados = prev.cursosAsignados || [];
      if (cursosAsignados.includes(cursoId)) {
        return {
          ...prev,
          cursosAsignados: cursosAsignados.filter(id => id !== cursoId)
        };
      } else {
        return {
          ...prev,
          cursosAsignados: [...cursosAsignados, cursoId]
        };
      }
    });
  };

  // Renderizar modo lista de evaluaciones
  const renderListaEvaluaciones = () => {
    const setsFiltrados = filtrarSetsPreguntas();
    
    if (cargando) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Cargando evaluaciones...</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar evaluaciones..."
                className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
              />
            </div>
            
            <select
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={filtroAsignatura}
              onChange={(e) => setFiltroAsignatura(e.target.value as 'todas' | AsignaturaSimce)}
            >
              <option value="todas">Todas las asignaturas</option>
              <option value="Lectura">Lectura</option>
              <option value="Matemática">Matemática</option>
            </select>
          </div>
          
          <button
            onClick={handleCrearEvaluacion}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
          >
            <Plus className="w-4 h-4" />
            Nueva evaluación
          </button>
        </div>
        
        <div className="space-y-4">
          {setsFiltrados.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">
                {filtroBusqueda || filtroAsignatura !== 'todas' 
                  ? 'No se encontraron evaluaciones con los filtros seleccionados' 
                  : 'No hay evaluaciones creadas aún. Crea tu primera evaluación SIMCE.'}
              </p>
              
              {(filtroBusqueda || filtroAsignatura !== 'todas') && (
                <button
                  onClick={() => {
                    setFiltroBusqueda('');
                    setFiltroAsignatura('todas');
                  }}
                  className="mt-4 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:dark:text-indigo-300 text-sm font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            setsFiltrados.map(set => (
              <div
                key={set.id}
                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4 flex items-start justify-between">
                  <div className="flex items-start">
                    <div className={`p-2 rounded-md mr-3 ${
                      set.asignatura === 'Lectura' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' 
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                    }`}>
                      {set.asignatura === 'Lectura' ? (
                        <BookOpen className="w-5 h-5" />
                      ) : (
                        <Calculator className="w-5 h-5" />
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">
                        {set.titulo}
                      </h3>
                      
                      {set.descripcion && (
                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                          {set.descripcion}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-xs">
                          {set.preguntas.length} preguntas
                        </span>
                        
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-xs">
                          {set.asignatura}
                        </span>
                        
                        {set.cursosAsignados && set.cursosAsignados.length > 0 && (
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-xs flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {set.cursosAsignados.length} {set.cursosAsignados.length === 1 ? 'curso' : 'cursos'}
                          </span>
                        )}
                        
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-xs">
                          {new Date(set.fechaCreacion).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSetSeleccionado(set)}
                      className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 hover:dark:text-slate-200 rounded-full hover:bg-slate-100 hover:dark:bg-slate-700"
                      title="Ver detalles"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleEditarSet(set)}
                      className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 hover:dark:text-slate-200 rounded-full hover:bg-slate-100 hover:dark:bg-slate-700"
                      title="Editar evaluación"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleEliminarSet(set)}
                      className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 hover:dark:text-red-300 rounded-full hover:bg-red-50 hover:dark:bg-red-900/20"
                      title="Eliminar evaluación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {setSeleccionado?.id === set.id && (
                  <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                    <h4 className="font-medium mb-3">Preguntas ({set.preguntas.length})</h4>
                    
                    <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                      {set.preguntas.map((pregunta, index) => (
                        <div 
                          key={pregunta.id} 
                          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
                        >
                          <p className="font-medium">
                            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 py-0.5 px-1.5 rounded text-xs mr-1.5">{index + 1}</span>
                            {pregunta.enunciado}
                          </p>
                          
                          <div className="mt-2 ml-6 space-y-1">
                            {pregunta.alternativas.map(alt => (
                              <div 
                                key={alt.id}
                                className={`flex items-center ${alt.esCorrecta ? 'text-green-700 dark:text-green-500 font-medium' : ''}`}
                              >
                                <span className="mr-1.5 min-w-[16px]">{alt.id})</span>
                                <span>{alt.texto}</span>
                                {alt.esCorrecta && <CheckCircle2 className="ml-1 w-3.5 h-3.5 text-green-600 dark:text-green-500" />}
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold">Estándar:</span> {pregunta.estandarAprendizaje}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setSetSeleccionado(null)}
                        className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 hover:dark:text-slate-200"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };
  
  // Renderizar modo edición de evaluación
  const renderEditorEvaluacion = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {setSeleccionado ? 'Editar evaluación' : 'Nueva evaluación'}
          </h3>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                setModoEdicion(false);
                setModoVisualizacion('lista');
                setError(null);
              }}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md text-sm"
            >
              Cancelar
            </button>
            
            <button
              onClick={handleGuardarEvaluacion}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm flex items-center gap-1.5"
              disabled={cargando}
            >
              <Save className="w-4 h-4" />
              Guardar evaluación
            </button>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 p-3 rounded-md flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Título de la evaluación *
              </label>
              <input
                type="text"
                value={nuevaEvaluacion.titulo}
                onChange={(e) => setNuevaEvaluacion({ ...nuevaEvaluacion, titulo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                placeholder="Ej: Evaluación SIMCE 4° Básico - Lectura"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Asignatura *
              </label>
              <select
                value={nuevaEvaluacion.asignatura}
                onChange={(e) => setNuevaEvaluacion({ ...nuevaEvaluacion, asignatura: e.target.value as AsignaturaSimce })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
              >
                <option value="Lectura">Lectura</option>
                <option value="Matemática">Matemática</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Descripción (opcional)
              </label>
              <textarea
                value={nuevaEvaluacion.descripcion}
                onChange={(e) => setNuevaEvaluacion({ ...nuevaEvaluacion, descripcion: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 resize-none"
                placeholder="Breve descripción de la evaluación"
                rows={3}
              />
            </div>
          </div>
          
          <div className="mt-6">
            <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              Asignar a cursos
            </label>
            
            <div className="relative">
              <input
                type="text"
                value={searchCurso}
                onChange={(e) => {
                  setSearchCurso(e.target.value);
                  setShowCursoDropdown(true);
                }}
                onFocus={() => setShowCursoDropdown(true)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                placeholder="Buscar curso..."
              />
              
              {showCursoDropdown && (cursosFiltrados.length > 0 || searchCurso) && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-md max-h-60 overflow-y-auto">
                  {cursosFiltrados.length === 0 && searchCurso ? (
                    <div className="p-3 text-center text-slate-500 dark:text-slate-400">
                      No se encontraron cursos
                    </div>
                  ) : (
                    cursosFiltrados.map(curso => (
                      <div
                        key={curso.id}
                        className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center"
                        onClick={() => {
                          handleToggleCurso(curso.id);
                          setSearchCurso('');
                        }}
                      >
                        <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${
                          (nuevaEvaluacion.cursosAsignados || []).includes(curso.id)
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-slate-400 dark:border-slate-500'
                        }`}>
                          {(nuevaEvaluacion.cursosAsignados || []).includes(curso.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span>{curso.nombre}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {(nuevaEvaluacion.cursosAsignados || []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(nuevaEvaluacion.cursosAsignados || []).map(cursoId => {
                  const curso = cursos.find(c => c.id === cursoId);
                  return (
                    <div
                      key={cursoId}
                      className="flex items-center bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md text-sm"
                    >
                      <span>{curso?.nombre || cursoId}</span>
                      <button
                        onClick={() => handleToggleCurso(cursoId)}
                        className="ml-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:dark:text-slate-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Configuración de presentación
              </label>
            </div>
            
            <div className="flex space-x-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={nuevaEvaluacion.barajarPreguntas}
                  onChange={(e) => setNuevaEvaluacion({ ...nuevaEvaluacion, barajarPreguntas: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Barajar preguntas
                </span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={nuevaEvaluacion.barajarAlternativas}
                  onChange={(e) => setNuevaEvaluacion({ ...nuevaEvaluacion, barajarAlternativas: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Barajar alternativas
                </span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Sección de preguntas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">
              Preguntas ({(nuevaEvaluacion.preguntas || []).length})
            </h3>
            
            <div className="flex gap-2">
              <button
                onClick={handleGenerarPreguntas}
                disabled={generandoPreguntas}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm flex items-center gap-1.5"
              >
                {generandoPreguntas ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <PenTool className="w-4 h-4" />
                    Generar con IA
                  </>
                )}
              </button>
              
              <button
                onClick={handleAgregarPregunta}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Agregar manualmente
              </button>
            </div>
          </div>
          
          {preguntaEnEdicion ? (
            // Editor de pregunta
            <div className="bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="mb-4">
                <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Enunciado de la pregunta *
                </label>
                <textarea
                  value={preguntaEnEdicion.enunciado}
                  onChange={(e) => setPreguntaEnEdicion({...preguntaEnEdicion, enunciado: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 resize-none"
                  placeholder="Escribe el enunciado de la pregunta..."
                  rows={3}
                />
              </div>
              
              <div className="mb-4">
                <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Estándar de aprendizaje *
                </label>
                <select
                  value={preguntaEnEdicion.estandarAprendizaje}
                  onChange={(e) => setPreguntaEnEdicion({...preguntaEnEdicion, estandarAprendizaje: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                >
                  {nuevaEvaluacion.asignatura === 'Lectura' ? (
                    estandaresLectura.map((estandar, index) => (
                      <option key={index} value={estandar}>{estandar}</option>
                    ))
                  ) : (
                    estandaresMatematica.map((estandar, index) => (
                      <option key={index} value={estandar}>{estandar}</option>
                    ))
                  )}
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Habilidad (opcional)
                </label>
                <input
                  type="text"
                  value={preguntaEnEdicion.habilidad || ''}
                  onChange={(e) => setPreguntaEnEdicion({...preguntaEnEdicion, habilidad: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                  placeholder="Ej: Interpretar, Analizar, Resolver problemas..."
                />
              </div>
              
              <div className="mb-6">
                <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Alternativas * (marca una como correcta)
                </label>
                
                <div className="space-y-3">
                  {preguntaEnEdicion.alternativas.map((alt, index) => (
                    <div key={alt.id} className="flex items-start">
                      <div className="flex items-center mt-1 mr-2">
                        <input
                          type="radio"
                          checked={alt.esCorrecta}
                          onChange={() => {
                            setPreguntaEnEdicion({
                              ...preguntaEnEdicion,
                              alternativas: preguntaEnEdicion.alternativas.map(a => ({
                                ...a,
                                esCorrecta: a.id === alt.id
                              }))
                            });
                          }}
                          className="rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-1 font-semibold">{alt.id})</span>
                      </div>
                      
                      <div className="flex-1">
                        <textarea
                          value={alt.texto}
                          onChange={(e) => {
                            setPreguntaEnEdicion({
                              ...preguntaEnEdicion,
                              alternativas: preguntaEnEdicion.alternativas.map(a => 
                                a.id === alt.id ? {...a, texto: e.target.value} : a
                              )
                            });
                          }}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 resize-none"
                          placeholder={`Texto de la alternativa ${alt.id}...`}
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Explicación para alternativa correcta (recomendado)
                </label>
                <textarea
                  value={
                    preguntaEnEdicion.alternativas.find(alt => alt.esCorrecta)?.explicacion || ''
                  }
                  onChange={(e) => {
                    setPreguntaEnEdicion({
                      ...preguntaEnEdicion,
                      alternativas: preguntaEnEdicion.alternativas.map(a => 
                        a.esCorrecta ? {...a, explicacion: e.target.value} : a
                      )
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 resize-none"
                  placeholder="Explica por qué esta es la respuesta correcta..."
                  rows={2}
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setPreguntaEnEdicion(null);
                    setError(null);
                  }}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md text-sm"
                >
                  Cancelar
                </button>
                
                <button
                  onClick={handleGuardarPregunta}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Guardar pregunta
                </button>
              </div>
            </div>
          ) : (
            // Lista de preguntas
            <div className="space-y-4">
              {(nuevaEvaluacion.preguntas || []).length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                  <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400">
                    No hay preguntas agregadas aún. 
                    Puedes generar preguntas automáticamente o agregarlas manualmente.
                  </p>
                </div>
              ) : (
                (nuevaEvaluacion.preguntas || []).map((pregunta, index) => (
                  <div 
                    key={pregunta.id} 
                    className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">
                          <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 py-0.5 px-2 rounded-md mr-2">
                            Pregunta {index + 1}
                          </span>
                          {pregunta.enunciado}
                        </p>
                        
                        <div className="mt-3 ml-6 space-y-1">
                          {pregunta.alternativas.map(alt => (
                            <div 
                              key={alt.id}
                              className={`flex items-center ${alt.esCorrecta ? 'text-green-700 dark:text-green-500 font-medium' : ''}`}
                            >
                              <span className="mr-2">{alt.id})</span>
                              <span>{alt.texto}</span>
                              {alt.esCorrecta && <CheckCircle2 className="ml-1.5 w-4 h-4 text-green-600 dark:text-green-500" />}
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                          <div><span className="font-semibold">Estándar:</span> {pregunta.estandarAprendizaje}</div>
                          {pregunta.habilidad && <div><span className="font-semibold">Habilidad:</span> {pregunta.habilidad}</div>}
                          {pregunta.alternativas.find(alt => alt.esCorrecta)?.explicacion && (
                            <div className="mt-1 bg-green-50 dark:bg-green-900/20 p-2 rounded-md border border-green-100 dark:border-green-800/30 text-green-800 dark:text-green-300">
                              <span className="font-semibold">Explicación:</span> {pregunta.alternativas.find(alt => alt.esCorrecta)?.explicacion}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1 ml-3">
                        <button
                          onClick={() => handleEditarPregunta(pregunta)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 hover:dark:text-slate-200 rounded hover:bg-slate-100 hover:dark:bg-slate-700"
                          title="Editar pregunta"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleEliminarPregunta(pregunta.id)}
                          className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 hover:dark:text-red-300 rounded hover:bg-red-50 hover:dark:bg-red-900/20"
                          title="Eliminar pregunta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {modoVisualizacion === 'lista' && !modoEdicion && renderListaEvaluaciones()}
      {(modoVisualizacion === 'detalle' || modoEdicion) && renderEditorEvaluacion()}
    </>
  );
};
