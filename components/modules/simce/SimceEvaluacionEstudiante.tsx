import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  BookOpen, 
  Calculator, 
  Send,
  RefreshCw,
  FileCheck,
  BarChart
} from 'lucide-react';
import { 
  SimceEvaluacion, 
  SimcePregunta, 
  SimceIntento 
} from '../../../types/simce';
import { 
  obtenerEvaluacionesEstudiante, 
  obtenerEvaluacionPorId,
  guardarIntentoEvaluacion,
  verificarIntentoExistente
} from '@/firebaseHelpers/simceHelper';

interface SimceEvaluacionEstudianteProps {
  currentUser: User;
}

export const SimceEvaluacionEstudiante: React.FC<SimceEvaluacionEstudianteProps> = ({ currentUser }) => {
  const [evaluaciones, setEvaluaciones] = useState<SimceEvaluacion[]>([]);
  const [evaluacionSeleccionada, setEvaluacionSeleccionada] = useState<SimceEvaluacion | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [intentoCompletado, setIntentoCompletado] = useState(false);
  const [resultados, setResultados] = useState<{
    porcentajeLogro: number;
    nivelLogro: "Adecuado" | "Elemental" | "Insuficiente";
    respuestasCorrectas: number;
    totalPreguntas: number;
    detalle: Array<{
      preguntaId: string;
      pregunta: SimcePregunta;
      respuestaSeleccionada: string;
      esCorrecta: boolean;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tiempoInicio, setTiempoInicio] = useState<number | null>(null);
  const [intentosExistentes, setIntentosExistentes] = useState<SimceIntento[]>([]);
  const [intentoActual, setIntentoActual] = useState<SimceIntento | null>(null);
  
  useEffect(() => {
    const cargarEvaluaciones = async () => {
      if (!currentUser.uid) return;
      
      try {
        setCargando(true);
        
        // Obtener evaluaciones asignadas al estudiante
        const evaluacionesData = await obtenerEvaluacionesEstudiante(
          currentUser.uid, 
          currentUser.curso || ''
        );
        
        setEvaluaciones(evaluacionesData);
      } catch (error) {
        console.error('Error al cargar evaluaciones:', error);
        setError('No se pudieron cargar las evaluaciones disponibles');
      } finally {
        setCargando(false);
      }
    };

    cargarEvaluaciones();
  }, [currentUser]);

  const seleccionarEvaluacion = async (evaluacionId: string) => {
    try {
      setCargando(true);
      setRespuestas({});
      setError(null);
      setResultados(null);
      setIntentoCompletado(false);
      
      // Verificar si ya existe un intento para esta evaluación
      const intentos = await verificarIntentoExistente(currentUser.uid || '', evaluacionId);
      setIntentosExistentes(intentos);
      
      if (intentos.length > 0) {
        // Ya existe un intento
        setIntentoActual(intentos[0]);
        setIntentoCompletado(true);
        
        // Cargar resultados del intento
        const evaluacion = await obtenerEvaluacionPorId(evaluacionId);
        if (evaluacion) {
          setEvaluacionSeleccionada(evaluacion);
          
          // Generar el detalle de resultados
          const intento = intentos[0];
          const detalleRespuestas = evaluacion.preguntas.map(pregunta => {
            const respuestaSeleccionada = intento.respuestas.find(r => r.preguntaId === pregunta.id)?.alternativaSeleccionada || '';
            return {
              preguntaId: pregunta.id,
              pregunta,
              respuestaSeleccionada,
              esCorrecta: respuestaSeleccionada === pregunta.respuestaCorrecta
            };
          });
          
          setResultados({
            porcentajeLogro: intento.porcentajeLogro,
            nivelLogro: intento.nivelLogro,
            respuestasCorrectas: detalleRespuestas.filter(d => d.esCorrecta).length,
            totalPreguntas: evaluacion.preguntas.length,
            detalle: detalleRespuestas
          });
        }
      } else {
        // Nuevo intento
        const evaluacion = await obtenerEvaluacionPorId(evaluacionId);
        if (evaluacion) {
          // Barajar las preguntas y alternativas
          const preguntasBarajadas = [...evaluacion.preguntas].sort(() => Math.random() - 0.5);
          
          // Barajar las alternativas dentro de cada pregunta
          preguntasBarajadas.forEach(pregunta => {
            pregunta.alternativas = [...pregunta.alternativas].sort(() => Math.random() - 0.5);
          });
          
          setEvaluacionSeleccionada({
            ...evaluacion,
            preguntas: preguntasBarajadas
          });
          
          setTiempoInicio(Date.now());
        }
      }
    } catch (error) {
      console.error('Error al seleccionar evaluación:', error);
      setError('No se pudo cargar la evaluación seleccionada');
    } finally {
      setCargando(false);
    }
  };

  const handleRespuesta = (preguntaId: string, alternativaId: string) => {
    setRespuestas({
      ...respuestas,
      [preguntaId]: alternativaId
    });
  };

  const handleEnviarRespuestas = async () => {
    if (!evaluacionSeleccionada) return;
    
    try {
      // Verificar que todas las preguntas tengan respuesta
      const preguntasIds = evaluacionSeleccionada.preguntas.map(p => p.id);
      const respondidas = Object.keys(respuestas);
      
      if (respondidas.length < preguntasIds.length) {
        setError(`Debe responder todas las preguntas antes de enviar (faltan ${preguntasIds.length - respondidas.length})`);
        return;
      }
      
      setEnviando(true);
      
      // Calcular resultados
      let respuestasCorrectas = 0;
      const detalleRespuestas = evaluacionSeleccionada.preguntas.map(pregunta => {
        const respuestaSeleccionada = respuestas[pregunta.id];
        const esCorrecta = respuestaSeleccionada === pregunta.respuestaCorrecta;
        
        if (esCorrecta) respuestasCorrectas++;
        
        return {
          preguntaId: pregunta.id,
          pregunta,
          respuestaSeleccionada,
          esCorrecta
        };
      });
      
      const totalPreguntas = evaluacionSeleccionada.preguntas.length;
      const porcentajeLogro = (respuestasCorrectas / totalPreguntas) * 100;
      
      // Determinar nivel de logro
      let nivelLogro: "Adecuado" | "Elemental" | "Insuficiente";
      if (porcentajeLogro >= 80) {
        nivelLogro = "Adecuado";
      } else if (porcentajeLogro >= 50) {
        nivelLogro = "Elemental";
      } else {
        nivelLogro = "Insuficiente";
      }
      
      // Guardar intento
      const tiempoFin = Date.now();
      const tiempoRealizacion = tiempoInicio ? Math.floor((tiempoFin - tiempoInicio) / 1000) : 0;
      
      const nuevoIntento: Omit<SimceIntento, 'id'> = {
        evaluacionId: evaluacionSeleccionada.id,
        estudianteId: currentUser.uid || '',
        estudianteNombre: currentUser.nombreCompleto || '',
        respuestas: Object.entries(respuestas).map(([preguntaId, alternativaSeleccionada]) => ({
          preguntaId,
          alternativaSeleccionada
        })),
        porcentajeLogro,
        nivelLogro,
        fechaRealizacion: new Date().toISOString(),
        tiempoRealizacion
      };
      
      await guardarIntentoEvaluacion(nuevoIntento);
      
      // Actualizar estado
      setResultados({
        porcentajeLogro,
        nivelLogro,
        respuestasCorrectas,
        totalPreguntas,
        detalle: detalleRespuestas
      });
      
      setIntentoCompletado(true);
    } catch (error) {
      console.error('Error al enviar respuestas:', error);
      setError('Ocurrió un error al enviar sus respuestas. Intente nuevamente.');
    } finally {
      setEnviando(false);
    }
  };
  
  const formatTiempo = (segundos: number) => {
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs < 10 ? '0' : ''}${segs}`;
  };

  const obtenerColorNivel = (nivel: string) => {
    switch (nivel) {
      case 'Adecuado':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Elemental':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Insuficiente':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
    }
  };

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
      {!evaluacionSeleccionada ? (
        // Lista de evaluaciones disponibles
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Evaluaciones disponibles
          </h2>
          
          {evaluaciones.length === 0 ? (
            <div className="text-center py-8">
              <FileCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">No hay evaluaciones asignadas para tu curso en este momento.</p>
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
                      evaluacion.asignatura === 'Lectura' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' 
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                    }`}>
                      {evaluacion.asignatura === 'Lectura' ? (
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
                          {new Date(evaluacion.fechaAsignacion).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : intentoCompletado ? (
        // Resultados de evaluación
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
              Resultados: {evaluacionSeleccionada.titulo}
            </h2>
            <button
              onClick={() => {
                setEvaluacionSeleccionada(null);
                setResultados(null);
                setIntentoCompletado(false);
              }}
              className="text-slate-600 hover:text-slate-900 font-semibold dark:text-slate-400 dark:hover:text-slate-200"
            >
              Volver a evaluaciones
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-lg mb-6">
            <div className="flex flex-col items-center">
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold mb-2">Tu nivel de logro</h3>
                <div className={`text-lg font-bold px-4 py-1 rounded-md ${obtenerColorNivel(resultados?.nivelLogro || '')}`}>
                  {resultados?.nivelLogro}
                </div>
                <div className="mt-4">
                  <BarChart className="w-16 h-16 mx-auto text-indigo-500 mb-2" />
                  <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                    {resultados?.porcentajeLogro.toFixed(1)}%
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    {resultados?.respuestasCorrectas} de {resultados?.totalPreguntas} correctas
                  </div>
                </div>
              </div>

              <div className="w-full max-w-md h-6 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden mt-4">
                <div 
                  className={`h-full ${
                    resultados?.nivelLogro === 'Adecuado' 
                      ? 'bg-green-500' 
                      : resultados?.nivelLogro === 'Elemental' 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                  }`}
                  style={{width: `${resultados?.porcentajeLogro || 0}%`}}
                ></div>
              </div>

              <div className="flex justify-between w-full max-w-md text-xs mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-4">Detalle de respuestas</h3>
          
          <div className="space-y-6">
            {resultados?.detalle.map((item, index) => (
              <div 
                key={item.preguntaId}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <h4 className="font-bold mb-2">
                  <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 py-0.5 px-2 rounded-md mr-2">
                    Pregunta {index + 1}
                  </span>
                  {item.pregunta.enunciado}
                </h4>
                
                <div className="ml-6 mt-3 space-y-2">
                  {item.pregunta.alternativas.map((alt) => (
                    <div 
                      key={alt.id} 
                      className={`flex items-start ${
                        alt.id === item.respuestaSeleccionada
                          ? alt.id === item.pregunta.respuestaCorrecta
                            ? 'text-green-700 dark:text-green-400 font-semibold'
                            : 'text-red-700 dark:text-red-400 font-semibold'
                          : alt.id === item.pregunta.respuestaCorrecta
                            ? 'text-green-700 dark:text-green-400 font-semibold'
                            : ''
                      }`}
                    >
                      <div className="font-bold mr-2 min-w-[20px]">{alt.id})</div>
                      <div>{alt.texto}</div>
                      {alt.id === item.respuestaSeleccionada && alt.id === item.pregunta.respuestaCorrecta && (
                        <CheckCircle2 className="w-4 h-4 ml-1 text-green-600 dark:text-green-400" />
                      )}
                      {alt.id === item.respuestaSeleccionada && alt.id !== item.pregunta.respuestaCorrecta && (
                        <XCircle className="w-4 h-4 ml-1 text-red-600 dark:text-red-400" />
                      )}
                      {alt.id !== item.respuestaSeleccionada && alt.id === item.pregunta.respuestaCorrecta && (
                        <CheckCircle2 className="w-4 h-4 ml-1 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 text-sm">
                  <div className="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 p-2 rounded-md">
                    <span className="font-semibold">Explicación:</span> {item.pregunta.explicacion}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => {
                setEvaluacionSeleccionada(null);
                setResultados(null);
                setIntentoCompletado(false);
              }}
              className="py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Volver a evaluaciones
            </button>
          </div>
        </div>
      ) : (
        // Realizar evaluación
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                {evaluacionSeleccionada.titulo}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {evaluacionSeleccionada.asignatura} - {evaluacionSeleccionada.preguntas.length} preguntas
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm('¿Está seguro que desea salir? Se perderán todas las respuestas.')) {
                  setEvaluacionSeleccionada(null);
                }
              }}
              className="text-slate-600 hover:text-slate-900 font-semibold dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancelar
            </button>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-6 flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-yellow-800 dark:text-yellow-400">Instrucciones</h3>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc pl-5">
                <li>Responde todas las preguntas antes de enviar.</li>
                <li>Solo tienes un intento para responder.</li>
                <li>Una vez enviado, podrás ver tu resultado y las respuestas correctas.</li>
                <li>No refresques ni cierres la página durante la evaluación.</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 rounded-md flex items-center">
              <XCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          <div className="space-y-6">
            {evaluacionSeleccionada.preguntas.map((pregunta, index) => (
              <div 
                key={pregunta.id}
                className={`p-4 rounded-lg border ${
                  respuestas[pregunta.id] 
                    ? 'border-green-200 dark:border-green-700/50' 
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <h4 className="font-bold mb-2">
                  <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 py-0.5 px-2 rounded-md mr-2">
                    Pregunta {index + 1}
                  </span>
                  {pregunta.enunciado}
                </h4>
                
                <div className="ml-6 mt-3 space-y-2">
                  {pregunta.alternativas.map((alt) => (
                    <div 
                      key={alt.id} 
                      className={`flex items-center p-2 rounded-md cursor-pointer ${
                        respuestas[pregunta.id] === alt.id
                          ? 'bg-indigo-100 dark:bg-indigo-900/50'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
                      }`}
                      onClick={() => handleRespuesta(pregunta.id, alt.id)}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${
                        respuestas[pregunta.id] === alt.id
                          ? 'border-indigo-600 dark:border-indigo-400'
                          : 'border-slate-400 dark:border-slate-500'
                      }`}>
                        {respuestas[pregunta.id] === alt.id && (
                          <div className="w-3 h-3 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                        )}
                      </div>
                      <div className="font-bold mr-2">{alt.id})</div>
                      <div>{alt.texto}</div>
                    </div>
                  ))}
                </div>
                
                {!respuestas[pregunta.id] && (
                  <div className="mt-2 text-amber-600 dark:text-amber-400 text-sm">
                    Por favor selecciona una respuesta
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-between items-center">
            <div className="text-slate-600 dark:text-slate-400 flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              <span className="text-sm">
                {tiempoInicio && (
                  <>Tiempo transcurrido: {formatTiempo(Math.floor((Date.now() - tiempoInicio) / 1000))}</>
                )}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {Object.keys(respuestas).length} de {evaluacionSeleccionada.preguntas.length} respondidas
              </span>
              <button
                onClick={handleEnviarRespuestas}
                disabled={enviando || Object.keys(respuestas).length !== evaluacionSeleccionada.preguntas.length}
                className="py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {enviando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar respuestas</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
