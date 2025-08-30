import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '../../types';
import { 
  FileSpreadsheet, 
  Search, 
  Users, 
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Download,
  BarChart2,
  HelpCircle,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { 
  obtenerResultadosPorCurso,
  obtenerEvaluacionesPorProfesor,
  obtenerEstadisticasPorCurso
} from '../../src/firebaseHelpers/simceHelper';
import { getAllUsers } from '../../src/firebaseHelpers/users';
import { ResultadoIntento, NivelLogro } from '../../types/simce';

// Utility functions
const normalizeCurso = (curso: string): string => {
  if (!curso) return '';
  let normalized = curso.trim().toLowerCase();
  normalized = normalized.replace(/°/g, 'º');
  normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
  normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
  normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
  normalized = normalized.replace(/\s+/g, '').toUpperCase();
  return normalized;
};

// Type definitions
interface EstudianteInfo {
  id: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  curso: string;
}

interface EvaluacionInfo {
  id: string;
  titulo: string;
  asignatura: string;
  fechaCreacion: string;
}

interface ResultadoEstudiante {
  evaluacionId: string;
  porcentajeLogro: number;
  nivelLogro: NivelLogro;
  fechaRealizacion: string;
}

interface FilaLibroClases {
  estudiante: EstudianteInfo;
  resultados: { [evaluacionId: string]: ResultadoEstudiante | null };
}

interface EstadisticasEvaluacion {
  promedioLogro: number;
  porcentajeAdecuado: number;
  porcentajeElemental: number;
  porcentajeInsuficiente: number;
  totalEstudiantes: number;
}

interface SimceResultadosLibroClasesProps {
  currentUser: User;
}

// Helper functions
const getColorNivelLogro = (nivel: NivelLogro | string): string => {
  switch (nivel) {
    case 'Adecuado':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'Elemental':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'Insuficiente':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
  }
};

const calcularNivelLogro = (porcentaje: number): NivelLogro => {
  if (porcentaje >= 70) return 'Adecuado';
  if (porcentaje >= 50) return 'Elemental';
  return 'Insuficiente';
};

const formatearFecha = (fecha: string): string => {
  try {
    return new Date(fecha).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return fecha;
  }
};

export const SimceResultadosLibroClases: React.FC<SimceResultadosLibroClasesProps> = ({ currentUser }) => {
  // Estados principales
  const [vista, setVista] = useState<'estudiante' | 'curso'>('estudiante');
  const [cursoSeleccionado, setCursoSeleccionado] = useState<string>('');
  const [cursosDisponibles, setCursosDisponibles] = useState<string[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionInfo[]>([]);
  const [evaluacionesSeleccionadas, setEvaluacionesSeleccionadas] = useState<string[]>([]);
  const [estudiantes, setEstudiantes] = useState<EstudianteInfo[]>([]);
  const [filasLibro, setFilasLibro] = useState<FilaLibroClases[]>([]);
  const [estadisticasPorEvaluacion, setEstadisticasPorEvaluacion] = useState<{ [evaluacionId: string]: EstadisticasEvaluacion }>({});
  
  // Estados de UI
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchEstudiante, setSearchEstudiante] = useState<string>('');
  const [ordenarPor, setOrdenarPor] = useState<string>('nombre');
  const [ordenAscendente, setOrdenAscendente] = useState<boolean>(true);
  const [showEvaluacionDropdown, setShowEvaluacionDropdown] = useState<boolean>(false);

  // Cargar datos iniciales
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        setCargando(true);
        setError(null);
        
        // Cargar cursos del profesor
        if (currentUser.cursos && Array.isArray(currentUser.cursos) && currentUser.cursos.length > 0) {
          const cursosNormalizados = currentUser.cursos.map(normalizeCurso);
          setCursosDisponibles(cursosNormalizados);
          setCursoSeleccionado(cursosNormalizados[0]);
        } else {
          throw new Error('No hay cursos asignados al profesor');
        }
        
        // Cargar evaluaciones del profesor
        if (!currentUser.uid) {
          throw new Error('ID de usuario no válido');
        }

        const evaluacionesProfesor = await obtenerEvaluacionesPorProfesor(currentUser.uid);
        const evaluacionesInfo = evaluacionesProfesor.map(ev => ({
          id: ev.id,
          titulo: ev.titulo,
          asignatura: ev.asignatura,
          fechaCreacion: ev.fechaCreacion
        }));
        
        setEvaluaciones(evaluacionesInfo);
        
        // Seleccionar las primeras 5 evaluaciones por defecto
        if (evaluacionesInfo.length > 0) {
          setEvaluacionesSeleccionadas(evaluacionesInfo.slice(0, 5).map(ev => ev.id));
        }
      } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        setError(error instanceof Error ? error.message : 'Error al cargar los datos iniciales');
      } finally {
        setCargando(false);
      }
    };
    
    cargarDatosIniciales();
  }, [currentUser]);
  
  // Cargar estudiantes cuando cambia el curso
  useEffect(() => {
    const cargarEstudiantes = async () => {
      if (!cursoSeleccionado) return;
      
      try {
        setCargando(true);
        setError(null);
        
        const todosUsuarios = await getAllUsers();
        
        const estudiantesCurso = todosUsuarios
          .filter(user => user.profile === 'ESTUDIANTE' && normalizeCurso(user.curso || '') === cursoSeleccionado)
          .map(user => {
            const nombreCompleto = user.nombreCompleto || '';
            const partesNombre = nombreCompleto.split(' ');
            
            return {
              id: user.id,
              nombre: partesNombre[0] || '',
              apellido: partesNombre.slice(1).join(' ') || '',
              nombreCompleto: nombreCompleto,
              curso: user.curso || ''
            };
          });
        
        setEstudiantes(estudiantesCurso);
      } catch (error) {
        console.error('Error al cargar estudiantes:', error);
        setError('Error al cargar los estudiantes del curso');
      } finally {
        setCargando(false);
      }
    };
    
    cargarEstudiantes();
  }, [cursoSeleccionado]);
  
  // Cargar resultados cuando cambian curso, estudiantes o evaluaciones seleccionadas
  useEffect(() => {
    const cargarResultados = async () => {
      if (!cursoSeleccionado || estudiantes.length === 0 || evaluacionesSeleccionadas.length === 0) {
        setFilasLibro([]);
        setEstadisticasPorEvaluacion({});
        return;
      }
      
      try {
        setCargando(true);
        setError(null);
        
        // Inicializar estructura de datos
        const filasIniciales: FilaLibroClases[] = estudiantes.map(est => ({
          estudiante: est,
          resultados: {}
        }));
        
        // Inicializar resultados como null
        evaluacionesSeleccionadas.forEach(evalId => {
          filasIniciales.forEach(fila => {
            fila.resultados[evalId] = null;
          });
        });
        
        const estadisticasTemp: { [evalId: string]: EstadisticasEvaluacion } = {};
        const estudiantesIds = estudiantes.map(est => est.id);
        
        // Cargar resultados para cada evaluación
        for (const evalId of evaluacionesSeleccionadas) {
          try {
            const resultadosEval = await obtenerResultadosPorCurso(evalId, estudiantesIds);
            
            // Mapear resultados a estudiantes
            resultadosEval.forEach(resultado => {
              const filaIndex = filasIniciales.findIndex(f => f.estudiante.id === resultado.estudianteId);
              if (filaIndex !== -1) {
                filasIniciales[filaIndex].resultados[evalId] = {
                  evaluacionId: evalId,
                  porcentajeLogro: resultado.porcentajeAciertos || 0,
                  nivelLogro: resultado.nivelLogro || calcularNivelLogro(resultado.porcentajeAciertos || 0),
                  fechaRealizacion: resultado.fechaEnvio || ''
                };
              }
            });
            
            // Calcular estadísticas
            if (resultadosEval.length > 0) {
              const porcentajes = resultadosEval.map(r => r.porcentajeAciertos || 0);
              const promedioLogro = porcentajes.reduce((sum, p) => sum + p, 0) / porcentajes.length;
              
              const niveles = resultadosEval.map(r => r.nivelLogro || calcularNivelLogro(r.porcentajeAciertos || 0));
              const porcentajeAdecuado = (niveles.filter(n => n === 'Adecuado').length / niveles.length) * 100;
              const porcentajeElemental = (niveles.filter(n => n === 'Elemental').length / niveles.length) * 100;
              const porcentajeInsuficiente = (niveles.filter(n => n === 'Insuficiente').length / niveles.length) * 100;
              
              estadisticasTemp[evalId] = {
                promedioLogro,
                porcentajeAdecuado,
                porcentajeElemental,
                porcentajeInsuficiente,
                totalEstudiantes: resultadosEval.length
              };
            }
          } catch (evalError) {
            console.warn(`Error al cargar resultados para evaluación ${evalId}:`, evalError);
          }
        }
        
        setFilasLibro(filasIniciales);
        setEstadisticasPorEvaluacion(estadisticasTemp);
        
      } catch (error) {
        console.error('Error al cargar resultados:', error);
        setError('Error al cargar los resultados');
      } finally {
        setCargando(false);
      }
    };
    
    cargarResultados();
  }, [cursoSeleccionado, estudiantes, evaluacionesSeleccionadas]);

  // Funciones de utilidad
  const toggleEvaluacionSeleccionada = useCallback((evaluacionId: string) => {
    setEvaluacionesSeleccionadas(prev => {
      if (prev.includes(evaluacionId)) {
        return prev.filter(id => id !== evaluacionId);
      } else {
        return [...prev, evaluacionId];
      }
    });
  }, []);

  const handleOrdenar = useCallback((campo: string) => {
    if (ordenarPor === campo) {
      setOrdenAscendente(!ordenAscendente);
    } else {
      setOrdenarPor(campo);
      setOrdenAscendente(true);
    }
  }, [ordenarPor, ordenAscendente]);

  // Filtrar y ordenar filas
  const filasFiltradas = useMemo(() => {
    let filasFiltradas = filasLibro.filter(fila =>
      fila.estudiante.nombreCompleto.toLowerCase().includes(searchEstudiante.toLowerCase())
    );

    // Ordenar
    filasFiltradas.sort((a, b) => {
      let valorA: string | number;
      let valorB: string | number;

      switch (ordenarPor) {
        case 'nombre':
          valorA = a.estudiante.nombreCompleto;
          valorB = b.estudiante.nombreCompleto;
          break;
        case 'promedio':
          const resultadosA = Object.values(a.resultados).filter((r): r is ResultadoEstudiante => r !== null);
          const resultadosB = Object.values(b.resultados).filter((r): r is ResultadoEstudiante => r !== null);
          valorA = resultadosA.length > 0 
            ? resultadosA.reduce((sum, r) => sum + (r.porcentajeLogro || 0), 0) / resultadosA.length 
            : 0;
          valorB = resultadosB.length > 0 
            ? resultadosB.reduce((sum, r) => sum + (r.porcentajeLogro || 0), 0) / resultadosB.length 
            : 0;
          break;
        default:
          valorA = a.estudiante.nombreCompleto;
          valorB = b.estudiante.nombreCompleto;
      }

      if (typeof valorA === 'string' && typeof valorB === 'string') {
        return ordenAscendente 
          ? valorA.localeCompare(valorB) 
          : valorB.localeCompare(valorA);
      } else {
        return ordenAscendente 
          ? (valorA as number) - (valorB as number) 
          : (valorB as number) - (valorA as number);
      }
    });

    return filasFiltradas;
  }, [filasLibro, searchEstudiante, ordenarPor, ordenAscendente]);

  // Calcular promedio general del curso
  const promedioGeneral = useMemo(() => {
    const promedios = Object.values(estadisticasPorEvaluacion)
      .map(est => (typeof est === 'object' && est !== null && 'promedioLogro' in est && typeof (est as any).promedioLogro === 'number') ? (est as { promedioLogro: number }).promedioLogro : 0);
    return promedios.length > 0 
      ? promedios.reduce((sum, p) => sum + p, 0) / promedios.length 
      : 0;
  }, [estadisticasPorEvaluacion]);

  // Render functions
  const renderControles = () => (
    <div className="space-y-4">
      {/* Selección de curso */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Curso
        </label>
        <select
          value={cursoSeleccionado}
          onChange={(e) => setCursoSeleccionado(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
        >
          <option value="">Seleccionar curso</option>
          {cursosDisponibles.map(curso => (
            <option key={curso} value={curso}>
              {curso}
            </option>
          ))}
        </select>
      </div>

      {/* Selección de evaluaciones */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Evaluaciones ({evaluacionesSeleccionadas.length} seleccionadas)
        </label>
        <div className="relative">
          <button
            onClick={() => setShowEvaluacionDropdown(!showEvaluacionDropdown)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-left flex items-center justify-between"
          >
            <span>
              {evaluacionesSeleccionadas.length === 0 
                ? 'Seleccionar evaluaciones' 
                : `${evaluacionesSeleccionadas.length} evaluación${evaluacionesSeleccionadas.length !== 1 ? 'es' : ''} seleccionada${evaluacionesSeleccionadas.length !== 1 ? 's' : ''}`
              }
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {showEvaluacionDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {evaluaciones.length === 0 ? (
                <div className="p-3 text-center text-slate-500 dark:text-slate-400">
                  No hay evaluaciones disponibles
                </div>
              ) : (
                evaluaciones.map(evaluacion => (
                  <div
                    key={evaluacion.id}
                    className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center"
                    onClick={() => toggleEvaluacionSeleccionada(evaluacion.id)}
                  >
                    <input
                      type="checkbox"
                      checked={evaluacionesSeleccionadas.includes(evaluacion.id)}
                      onChange={() => {}} // Manejado por onClick del div
                      className="mr-2 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {evaluacion.titulo.length > 30 
                          ? `${evaluacion.titulo.substring(0, 30)}...` 
                          : evaluacion.titulo}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {evaluacion.asignatura} • {formatearFecha(evaluacion.fechaCreacion)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Búsqueda de estudiantes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Buscar estudiante
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Nombre del estudiante..."
            className="pl-9 pr-4 py-2 w-full border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
            value={searchEstudiante}
            onChange={(e) => setSearchEstudiante(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const renderTablaResultados = () => {
    if (cargando) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Cargando resultados...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
          <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
        </div>
      );
    }

    if (filasFiltradas.length === 0) {
      return (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-400">
            No se encontraron estudiantes o resultados para mostrar.
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleOrdenar('nombre')}
                  className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  Estudiante
                  {ordenarPor === 'nombre' && (
                    ordenAscendente ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              {evaluaciones
                .filter(ev => evaluacionesSeleccionadas.includes(ev.id))
                .map(evaluacion => (
                  <th key={evaluacion.id} className="px-4 py-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center">
                      <div className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                        {evaluacion.titulo.length > 20 
                          ? `${evaluacion.titulo.substring(0, 20)}...` 
                          : evaluacion.titulo}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {evaluacion.asignatura}
                      </div>
                    </div>
                  </th>
                ))}
              <th className="px-4 py-3 text-center">
                <button
                  onClick={() => handleOrdenar('promedio')}
                  className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  Promedio
                  {ordenarPor === 'promedio' && (
                    ordenAscendente ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filasFiltradas.map((fila, index) => {
              const resultadosConDatos = Object.values(fila.resultados).filter((r): r is ResultadoEstudiante => r !== null);
              const promedioEstudiante = resultadosConDatos.length > 0 
                ? resultadosConDatos.reduce((sum, r) => sum + (r.porcentajeLogro || 0), 0) / resultadosConDatos.length 
                : null;
              const nivelLogroPromedio = promedioEstudiante !== null ? calcularNivelLogro(promedioEstudiante) : null;

              return (
                <tr key={fila.estudiante.id} className={`border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {fila.estudiante.nombreCompleto}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {fila.estudiante.curso}
                    </div>
                  </td>
                  {evaluacionesSeleccionadas.map(evalId => (
                    <td key={evalId} className="px-4 py-3 text-center">
                      {fila.resultados[evalId] ? (
                        <div className="flex flex-col items-center">
                          <div className={`font-medium px-2 py-1 rounded-md text-xs ${getColorNivelLogro(fila.resultados[evalId]!.nivelLogro)}`}>
                            {Math.round(fila.resultados[evalId]!.porcentajeLogro)}%
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {formatearFecha(fila.resultados[evalId]!.fechaRealizacion)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 dark:text-slate-500">
                          —
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    {promedioEstudiante !== null ? (
                      <div className="flex flex-col items-center">
                        <div className={`font-medium px-2 py-1 rounded-md text-xs ${getColorNivelLogro(nivelLogroPromedio!)}`}>
                          {Math.round(promedioEstudiante)}%
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {nivelLogroPromedio}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400 dark:text-slate-500">
                        —
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 dark:bg-slate-700/50">
              <td className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300">
                Promedio del curso
              </td>
              {evaluacionesSeleccionadas.map(evalId => (
                <td key={evalId} className="px-4 py-3 text-center border-t border-slate-200 dark:border-slate-700">
                  {estadisticasPorEvaluacion[evalId] ? (
                    <div className="font-medium text-slate-700 dark:text-slate-300">
                      {Math.round(estadisticasPorEvaluacion[evalId].promedioLogro)}%
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400 dark:text-slate-500">
                      —
                    </div>
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-center border-t border-slate-200 dark:border-slate-700">
                {Object.values(estadisticasPorEvaluacion).length > 0 ? (
                  <div className="font-medium text-slate-700 dark:text-slate-300">
                    {Math.round(promedioGeneral)}%
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 dark:text-slate-500">
                    —
                  </div>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderLeyenda = () => (
    <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4 text-xs">
      <span className="flex items-center">
        <HelpCircle className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />
        <span className="text-slate-600 dark:text-slate-300">Niveles de logro:</span>
      </span>
      <span className={`px-2 py-0.5 rounded-md ${getColorNivelLogro('Adecuado')}`}>
        Adecuado (≥70%)
      </span>
      <span className={`px-2 py-0.5 rounded-md ${getColorNivelLogro('Elemental')}`}>
        Elemental (50-69%)
      </span>
      <span className={`px-2 py-0.5 rounded-md ${getColorNivelLogro('Insuficiente')}`}>
        Insuficiente (&lt;50%)
      </span>
    </div>
  );

  // Componente principal
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* ...contenido del componente... */}
    </div>
  );
}