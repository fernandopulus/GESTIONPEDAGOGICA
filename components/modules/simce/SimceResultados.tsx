import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { 
  BarChart2, 
  PieChart, 
  Download, 
  RefreshCw,
  CheckCircle2, 
  XCircle,
  Users,
  BookOpen,
  Calculator,
  TrendingUp,
  Award,
  School
} from 'lucide-react';
import { 
  SetPreguntas as SimceEvaluacion, 
  ResultadoIntento as SimceIntento
} from '../../../types/simce';
import { 
  obtenerEvaluacionesPorProfesor,
  obtenerIntentosPorEvaluacion,
  obtenerEvaluacionPorId,
  obtenerEstadisticasPorCurso
} from '@/firebaseHelpers/simceHelper';

interface SimceResultadosProps {
  currentUser: User;
}

export const SimceResultados: React.FC<SimceResultadosProps> = ({ currentUser }) => {
  const [evaluaciones, setEvaluaciones] = useState<SimceEvaluacion[]>([]);
  const [evaluacionSeleccionada, setEvaluacionSeleccionada] = useState<SimceEvaluacion | null>(null);
  const [intentos, setIntentos] = useState<SimceIntento[]>([]);
  // Interfaz local para estadísticas retornadas por helper
  const [estadisticasCurso, setEstadisticasCurso] = useState<{
    totalEstudiantes: number;
    promedioLogro: number;
    nivelPredominante: string;
    porcentajeAdecuado: number;
    porcentajeElemental: number;
    porcentajeInsuficiente: number;
    porEjeTematico: any[];
    porPregunta: any[];
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vistaActual, setVistaActual] = useState<'general' | 'porEstudiante' | 'porPregunta'>('general');
  const [filtroNivel, setFiltroNivel] = useState<'todos' | 'adecuado' | 'elemental' | 'insuficiente'>('todos');

  // Helpers de visualización con retrocompatibilidad de campos
  const getPorcentaje = (i: any): number => {
    if (typeof i?.porcentajeAciertos === 'number') return i.porcentajeAciertos;
    if (typeof (i as any)?.porcentajeLogro === 'number') return (i as any).porcentajeLogro;
    return 0;
  };
  const getFechaEnvio = (i: any): string => {
    const fecha = (i && (i.fechaEnvio || i.fechaRealizacion)) || null;
    return fecha ? new Date(fecha).toLocaleDateString() : '-';
  };
  const getRespuestasCorrectas = (i: any): number | string => {
    if (Array.isArray(i?.respuestas)) return i.respuestas.filter((r: any) => r?.esCorrecta).length;
    if (typeof i?.respuestasCorrectas === 'number') return i.respuestasCorrectas;
    return '-';
  };
  const getTiempoRealizacion = (i: any): string => {
    const s = (i && (i.tiempoRealizacion ?? i.duracionSegundos)) as number | undefined;
    if (typeof s === 'number' && s > 0) {
      const mm = Math.floor(s / 60);
      const ss = (s % 60).toString().padStart(2, '0');
      return `${mm}:${ss}`;
    }
    return '-';
  };
  
  useEffect(() => {
    const cargarEvaluaciones = async () => {
      try {
        setCargando(true);
        
        // Obtener evaluaciones creadas por el profesor
  const evaluacionesData = await obtenerEvaluacionesPorProfesor(currentUser.id || '');
        
        setEvaluaciones(evaluacionesData);
      } catch (error) {
        console.error('Error al cargar evaluaciones:', error);
        setError('No se pudieron cargar las evaluaciones');
      } finally {
        setCargando(false);
      }
    };

    cargarEvaluaciones();
  }, [currentUser]);

  const seleccionarEvaluacion = async (evaluacionId: string) => {
    try {
      setCargando(true);
      setError(null);
      
      // Obtener detalle de la evaluación
      const evaluacion = await obtenerEvaluacionPorId(evaluacionId);
      if (evaluacion) {
        setEvaluacionSeleccionada(evaluacion);
        
        // Obtener intentos de la evaluación
        const intentosData = await obtenerIntentosPorEvaluacion(evaluacionId);
        setIntentos(intentosData);
        
        // Obtener estadísticas por curso basadas en cursos asignados a la evaluación
        const cursosEval = Array.isArray((evaluacion as any).cursosAsignados)
          ? (evaluacion as any).cursosAsignados as string[]
          : [];
        if (cursosEval.length > 0) {
          const stats = await obtenerEstadisticasPorCurso(evaluacionId, cursosEval[0]);
          if (stats) setEstadisticasCurso(stats as any);
        } else {
          setEstadisticasCurso(null);
        }
      }
    } catch (error) {
      console.error('Error al seleccionar evaluación:', error);
      setError('No se pudo cargar la información de la evaluación seleccionada');
    } finally {
      setCargando(false);
    }
  };

  const generarExcel = async () => {
    // Aquí iría la lógica para generar un Excel con los resultados
    console.log('Generando Excel...');
  };
  
  const getColorNivelLogro = (nivel: string) => {
    switch(nivel) {
      case 'Adecuado': return 'text-green-600 dark:text-green-400';
      case 'Elemental': return 'text-yellow-600 dark:text-yellow-400';
      case 'Insuficiente': return 'text-red-600 dark:text-red-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  };
  
  const getBgColorNivelLogro = (nivel: string) => {
    switch(nivel) {
      case 'Adecuado': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Elemental': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Insuficiente': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
    }
  };

  const renderDistribucionNiveles = () => {
    if (!estadisticasCurso) return null;
    
    const { porcentajeAdecuado, porcentajeElemental, porcentajeInsuficiente } = estadisticasCurso;
    
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Distribución por niveles de logro</h3>
        
        <div className="w-full h-8 rounded-md overflow-hidden flex mb-2">
          <div 
            className="h-full bg-green-500 dark:bg-green-600 transition-all"
            style={{ width: `${porcentajeAdecuado}%` }}
          ></div>
          <div 
            className="h-full bg-yellow-500 dark:bg-yellow-600 transition-all"
            style={{ width: `${porcentajeElemental}%` }}
          ></div>
          <div 
            className="h-full bg-red-500 dark:bg-red-600 transition-all"
            style={{ width: `${porcentajeInsuficiente}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 dark:bg-green-600 rounded-sm mr-1"></div>
            <span>Adecuado: {porcentajeAdecuado.toFixed(1)}%</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 dark:bg-yellow-600 rounded-sm mr-1"></div>
            <span>Elemental: {porcentajeElemental.toFixed(1)}%</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 dark:bg-red-600 rounded-sm mr-1"></div>
            <span>Insuficiente: {porcentajeInsuficiente.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };
  
  const renderVistaGeneral = () => {
    if (!estadisticasCurso) {
      return (
        <div className="text-center py-8">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p>No hay datos disponibles para mostrar</p>
        </div>
      );
    }
    
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Estudiantes evaluados
                </h3>
                <div className="text-2xl font-bold">
                  {estadisticasCurso.totalEstudiantes}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                <BarChart2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Promedio de logro
                </h3>
                <div className="text-2xl font-bold">
                  {estadisticasCurso.promedioLogro.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/50">
                <Award className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Nivel predominante
                </h3>
                <div className={`text-2xl font-bold ${getColorNivelLogro(estadisticasCurso.nivelPredominante)}`}>
                  {estadisticasCurso.nivelPredominante}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {renderDistribucionNiveles()}
        
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3">Estadísticas por eje temático</h3>
          
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="space-y-4">
              {estadisticasCurso.porEjeTematico.map((eje, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{eje.eje}</span>
                    <span className="text-sm">{eje.promedio.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                    <div 
                      className={`h-full rounded-full ${
                        eje.promedio >= 80 ? 'bg-green-500' : 
                        eje.promedio >= 50 ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}
                      style={{ width: `${eje.promedio}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  };
  
  const renderVistaEstudiantes = () => {
    const estudiantesFiltrados = intentos.filter(intento => {
      if (filtroNivel === 'todos') return true;
      return intento.nivelLogro.toLowerCase() === filtroNivel;
    });
    
    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Resultados por estudiante</h3>
          
          <div className="flex space-x-2">
            <select 
              className="text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 px-2 py-1"
              value={filtroNivel}
              onChange={(e) => setFiltroNivel(e.target.value as any)}
            >
              <option value="todos">Todos los niveles</option>
              <option value="adecuado">Adecuado</option>
              <option value="elemental">Elemental</option>
              <option value="insuficiente">Insuficiente</option>
            </select>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50">
                  <th className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-200">Estudiante</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-200">Curso</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-200">% Logro</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-200">Nivel</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-200">Correctas</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-200">Tiempo</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-200">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {estudiantesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-600 dark:text-slate-400">
                      No hay datos para mostrar con los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  estudiantesFiltrados.map((intento) => (
                    <tr key={intento.id} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        {intento.estudianteNombre || 'Desconocido'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {intento.estudiante?.curso || '-'}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {getPorcentaje(intento).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getBgColorNivelLogro(intento.nivelLogro)}`}>
                          {intento.nivelLogro}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getRespuestasCorrectas(intento)}/{evaluacionSeleccionada?.preguntas.length || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {getTiempoRealizacion(intento)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {getFechaEnvio(intento)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };
  
  const renderVistaPorPregunta = () => {
    if (!evaluacionSeleccionada || !estadisticasCurso?.porPregunta || !estadisticasCurso.porPregunta.length) {
      return (
        <div className="text-center py-8">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p>No hay datos disponibles para mostrar</p>
        </div>
      );
    }
    
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Análisis por pregunta</h3>
        
        <div className="space-y-6">
          {estadisticasCurso.porPregunta.map((pregunta, index) => {
            // Buscar la pregunta correspondiente en la evaluación
            const preguntaOriginal = evaluacionSeleccionada.preguntas.find(p => p.id === pregunta.preguntaId);
            if (!preguntaOriginal) return null;
            
            return (
              <div 
                key={pregunta.preguntaId}
                className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold mb-2">
                      <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 py-0.5 px-2 rounded-md mr-2">
                        Pregunta {index + 1}
                      </span>
                      {preguntaOriginal.enunciado}
                    </h4>
                    
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium">Eje temático:</span> {preguntaOriginal.ejeTematico || 'No especificado'}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Porcentaje de acierto
                    </div>
                    <div className={`text-xl font-bold ${
                      pregunta.porcentajeAcierto >= 80 
                        ? 'text-green-600 dark:text-green-400' 
                        : pregunta.porcentajeAcierto >= 50 
                          ? 'text-yellow-600 dark:text-yellow-400' 
                          : 'text-red-600 dark:text-red-400'
                    }`}>
                      {pregunta.porcentajeAcierto.toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full mb-2">
                    <div 
                      className={`h-full rounded-full ${
                        pregunta.porcentajeAcierto >= 80 ? 'bg-green-500' : 
                        pregunta.porcentajeAcierto >= 50 ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}
                      style={{ width: `${pregunta.porcentajeAcierto}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div>
                    <h5 className="text-sm font-semibold mb-2">Distribución de respuestas</h5>
                    <div className="space-y-2">
                      {pregunta.distribucionRespuestas.map((resp) => (
                        <div key={resp.alternativaId} className="flex items-center">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                            resp.alternativaId === preguntaOriginal.respuestaCorrecta
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                          } mr-2`}>
                            {resp.alternativaId}
                          </div>
                          <div className="flex-1">
                            <div className="w-full h-4 bg-slate-200 dark:bg-slate-700 rounded-sm overflow-hidden">
                              <div 
                                className={`h-full ${
                                  resp.alternativaId === preguntaOriginal.respuestaCorrecta
                                    ? 'bg-green-500 dark:bg-green-600'
                                    : 'bg-red-500 dark:bg-red-600'
                                }`}
                                style={{width: `${resp.porcentaje}%`}}
                              ></div>
                            </div>
                          </div>
                          <div className="ml-2 w-10 text-right text-sm">
                            {resp.porcentaje.toFixed(0)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="text-sm font-semibold mb-2">Alternativa correcta</h5>
                    <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300">
                      <div className="flex items-start">
                        <div className="font-bold mr-2">{preguntaOriginal.respuestaCorrecta})</div>
                        <div>
                          {preguntaOriginal.alternativas.find(a => a.id === preguntaOriginal.respuestaCorrecta)?.texto}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h5 className="text-sm font-semibold mb-1">Dificultad</h5>
                      <div className={`inline-block px-3 py-1 rounded text-sm ${
                        pregunta.porcentajeAcierto >= 80 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                          : pregunta.porcentajeAcierto >= 50 
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {pregunta.porcentajeAcierto >= 80 ? 'Baja' : pregunta.porcentajeAcierto >= 50 ? 'Media' : 'Alta'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Cargando información...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!evaluacionSeleccionada ? (
        // Lista de evaluaciones disponibles
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Evaluaciones para analizar
          </h2>
          
          {evaluaciones.length === 0 ? (
            <div className="text-center py-8">
              <School className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">
                No hay evaluaciones SIMCE creadas aún.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {evaluaciones.map(evaluacion => (
                <div 
                  key={evaluacion.id}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                  onClick={() => seleccionarEvaluacion(evaluacion.id)}
                >
                  <div className="flex items-start">
                    <div className={`p-2 rounded-md mr-4 ${
                      (evaluacion.asignatura === 'Lectura' || evaluacion.asignatura === 'Competencia Lectora')
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' 
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                    }`}>
                      {(evaluacion.asignatura === 'Lectura' || evaluacion.asignatura === 'Competencia Lectora') ? (
                        <BookOpen className="w-6 h-6" />
                      ) : (
                        <Calculator className="w-6 h-6" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{evaluacion.titulo}</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">{evaluacion.descripcion}</p>
                      
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                          {evaluacion.asignatura}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                          {evaluacion.preguntas.length} preguntas
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                          {new Date(evaluacion.fechaCreacion).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Resultados de evaluación
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                {evaluacionSeleccionada.titulo}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {evaluacionSeleccionada.asignatura} • {intentos.length} estudiantes evaluados
              </p>
              {/* Mostrar cursos asignados si existen */}
              {Array.isArray(evaluacionSeleccionada.cursosAsignados) && evaluacionSeleccionada.cursosAsignados.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="font-semibold text-xs text-indigo-700 dark:text-indigo-300">Cursos asignados:</span>
                  {evaluacionSeleccionada.cursosAsignados.map((cursoId, idx) => (
                    <span key={cursoId+idx} className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 py-0.5 px-2 rounded-full text-xs">
                      {cursoId}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={generarExcel}
                className="py-2 px-3 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </button>
              
              <button
                onClick={() => setEvaluacionSeleccionada(null)}
                className="py-2 px-3 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 text-sm"
              >
                Volver
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 rounded-md flex items-center">
              <XCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}
          
          <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
            <button
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                vistaActual === 'general' 
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' 
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              onClick={() => setVistaActual('general')}
            >
              Vista general
            </button>
            <button
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                vistaActual === 'porEstudiante' 
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' 
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              onClick={() => setVistaActual('porEstudiante')}
            >
              Por estudiante
            </button>
            <button
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                vistaActual === 'porPregunta' 
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' 
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              onClick={() => setVistaActual('porPregunta')}
            >
              Por pregunta
            </button>
          </div>
          
          {vistaActual === 'general' && renderVistaGeneral()}
          {vistaActual === 'porEstudiante' && renderVistaEstudiantes()}
          {vistaActual === 'porPregunta' && renderVistaPorPregunta()}
        </div>
      )}
    </div>
  );
};
