import React, { useState, useEffect } from 'react';
import { Loader2, BookOpen, Check, X, ChevronRight, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { obtenerSetsPreguntasPorProfesor, obtenerSetPreguntas } from '../../../src/firebaseHelpers/simceHelper';
import { SetPreguntas, Pregunta, AsignaturaSimce, ResultadoIntento } from '../../../types/simce';

interface EvaluacionSimceProps {
  currentUser: any;
}

const EvaluacionSimce: React.FC<EvaluacionSimceProps> = ({ currentUser }) => {
  const [asignatura, setAsignatura] = useState<AsignaturaSimce>('matematica');
  const [nivel, setNivel] = useState<string>('4° básico');
  const [sets, setSets] = useState<SetPreguntas[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentSet, setCurrentSet] = useState<SetPreguntas | null>(null);
  const [enModoEvaluacion, setEnModoEvaluacion] = useState<boolean>(false);
  const [preguntaActual, setPreguntaActual] = useState<number>(0);
  const [respuestas, setRespuestas] = useState<number[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState<boolean>(false);
  const [resultados, setResultados] = useState<ResultadoIntento | null>(null);
  const [tiempoInicio, setTiempoInicio] = useState<Date | null>(null);

  const niveles = [
    '2° básico',
    '4° básico',
    '6° básico',
    '8° básico',
    '2° medio'
  ];

  useEffect(() => {
    cargarSets();
  }, [asignatura, nivel]);

  const cargarSets = async () => {
    setLoading(true);
    setError(null);
    try {
      // Usaremos obtenerSetsPreguntasPorProfesor y filtraremos manualmente por asignatura
      const setsData = await obtenerSetsPreguntasPorProfesor(currentUser.uid);
      // Filtramos por asignatura ya que el nivel puede no estar definido en SetPreguntas
      const setsFiltrados = setsData.filter(
        set => set.asignatura === asignatura
      );
      setSets(setsFiltrados);
      setSelectedSetId('');
    } catch (err) {
      console.error('Error cargando sets de preguntas:', err);
      setError('No se pudieron cargar los sets de preguntas');
      setSets([]);
    } finally {
      setLoading(false);
    }
  };

  const iniciarEvaluacion = async () => {
    if (!selectedSetId) {
      setError('Debes seleccionar un set de preguntas');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const setData = await obtenerSetPreguntas(selectedSetId);
      if (!setData) {
        throw new Error('No se encontró el set de preguntas');
      }
      
      setCurrentSet(setData);
      setRespuestas(new Array(setData.preguntas.length).fill(-1));
      setPreguntaActual(0);
      setEnModoEvaluacion(true);
      setMostrarResultados(false);
      setTiempoInicio(new Date());
    } catch (err) {
      console.error('Error cargando set de preguntas:', err);
      setError('No se pudo cargar el set de preguntas seleccionado');
    } finally {
      setLoading(false);
    }
  };

  const getNombreAsignatura = (codigo: string): string => {
    const asignaturas: Record<string, string> = {
      matematica: 'Matemática',
      lectura: 'Lectura',
      ciencias: 'Ciencias Naturales',
      historia: 'Historia y Geografía'
    };
    return asignaturas[codigo] || codigo;
  };

  const handleSelectRespuesta = (index: number) => {
    const nuevasRespuestas = [...respuestas];
    nuevasRespuestas[preguntaActual] = index;
    setRespuestas(nuevasRespuestas);
  };

  const avanzarPregunta = () => {
    if (preguntaActual < (currentSet?.preguntas.length || 0) - 1) {
      setPreguntaActual(preguntaActual + 1);
    }
  };

  const retrocederPregunta = () => {
    if (preguntaActual > 0) {
      setPreguntaActual(preguntaActual - 1);
    }
  };

  const finalizarEvaluacion = () => {
    if (!currentSet) return;
    
    const tiempoFin = new Date();
    const tiempoTranscurrido = tiempoInicio ? 
      Math.floor((tiempoFin.getTime() - tiempoInicio.getTime()) / 1000) : 0;
    
    let correctas = 0;
    const detalleRespuestas = currentSet.preguntas.map((pregunta, idx) => {
      const esCorrecta = respuestas[idx] === pregunta.respuestaCorrecta;
      if (esCorrecta) correctas++;
      
      return {
        pregunta: pregunta.enunciado,
        respuestaSeleccionada: respuestas[idx],
        respuestaCorrecta: pregunta.respuestaCorrecta,
        esCorrecta
      };
    });
    
    const porcentaje = Math.round((correctas / currentSet.preguntas.length) * 100);
    
    setResultados({
      id: '',
      setId: currentSet.id,
      titulo: currentSet.titulo,
      estudianteId: currentUser.uid,
      estudianteNombre: currentUser.displayName || 'Usuario',
      asignatura: currentSet.asignatura,
      puntaje: correctas,
      porcentaje,
      fechaEnvio: new Date().toISOString(),
      tiempo: tiempoTranscurrido,
      respuestas: detalleRespuestas.map((detalle, idx) => ({
        preguntaId: idx,
        respuesta: detalle.respuestaSeleccionada,
        correcta: detalle.esCorrecta
      }))
    });
    
    setMostrarResultados(true);
  };

  const reiniciarEvaluacion = () => {
    setEnModoEvaluacion(false);
    setCurrentSet(null);
    setPreguntaActual(0);
    setRespuestas([]);
    setMostrarResultados(false);
    setResultados(null);
    setSelectedSetId('');
  };

  const formatTiempo = (segundos: number): string => {
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs < 10 ? '0' + segs : segs}`;
  };

  if (enModoEvaluacion && !mostrarResultados && currentSet) {
    const pregunta = currentSet.preguntas[preguntaActual];
    
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-bold">{currentSet.titulo}</h2>
          <div className="text-sm text-gray-500">
            Pregunta {preguntaActual + 1} de {currentSet.preguntas.length}
          </div>
        </div>
        
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-lg font-medium mb-6">{pregunta.enunciado}</p>
          
          <div className="space-y-4">
            {pregunta.alternativas.map((alt, idx) => (
              <div 
                key={idx} 
                className={`p-3 border rounded-lg cursor-pointer flex items-center
                  ${respuestas[preguntaActual] === idx ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-100'}`}
                onClick={() => handleSelectRespuesta(idx)}
              >
                <div className={`w-6 h-6 flex items-center justify-center rounded-full mr-3
                  ${respuestas[preguntaActual] === idx ? 'bg-blue-500 text-white' : 'border'}`}>
                  {['A', 'B', 'C', 'D'][idx]}
                </div>
                <div>{alt}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-between">
          <button
            onClick={retrocederPregunta}
            disabled={preguntaActual === 0}
            className="px-4 py-2 flex items-center text-gray-700 disabled:text-gray-400"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Anterior
          </button>
          
          {preguntaActual < currentSet.preguntas.length - 1 ? (
            <button
              onClick={avanzarPregunta}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            >
              Siguiente <ArrowRight className="ml-1 h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={finalizarEvaluacion}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
            >
              Finalizar Evaluación <Check className="ml-1 h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }
  
  if (mostrarResultados && resultados) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6">Resultados de la Evaluación</h2>
        
        <div className="mb-8">
          <h3 className="text-xl mb-4">{resultados.titulo}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Asignatura</div>
              <div className="font-semibold">{getNombreAsignatura(resultados.asignatura)}</div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Estudiante</div>
              <div className="font-semibold">{resultados.estudianteNombre}</div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Tiempo</div>
              <div className="font-semibold">{formatTiempo(resultados.tiempo)}</div>
            </div>
          </div>
          
          <div className="flex flex-col items-center p-8 mb-8 bg-gray-50 rounded-lg">
            <div className="text-5xl font-bold mb-2 text-blue-600">{resultados.porcentaje}%</div>
            <div className="text-xl">{resultados.puntaje} de {resultados.respuestas.length} correctas</div>
          </div>
          
          <h4 className="text-lg font-semibold mb-4">Detalle de respuestas</h4>
          
          <div className="space-y-4">
            {resultados.respuestas.map((detalle, idx) => (
              <div key={idx} className="p-4 border rounded-lg">
                <div className="flex items-center mb-3">
                  <div className={`w-6 h-6 rounded-full mr-2 flex items-center justify-center text-white
                    ${detalle.correcta ? 'bg-green-500' : 'bg-red-500'}`}>
                    {detalle.correcta ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </div>
                  <div className="font-medium">Pregunta {idx + 1}</div>
                </div>
                
                <div className="mb-3">
                  {currentSet && currentSet.preguntas[detalle.preguntaId] ? 
                    currentSet.preguntas[detalle.preguntaId].enunciado : 'Pregunta no disponible'}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="p-2 bg-gray-50 rounded text-sm">
                    <span className="text-gray-500">Tu respuesta:</span>{' '}
                    {detalle.respuesta === -1 
                      ? 'Sin respuesta' 
                      : `Alternativa ${['A', 'B', 'C', 'D'][detalle.respuesta]}`}
                  </div>
                  
                  <div className="p-2 bg-gray-50 rounded text-sm">
                    <span className="text-gray-500">Resultado:</span>{' '}
                    {detalle.correcta ? 'Correcta' : 'Incorrecta'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={reiniciarEvaluacion}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Realizar otra evaluación
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Evaluación SIMCE</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block mb-2 font-semibold">Asignatura</label>
          <select
            value={asignatura}
            onChange={(e) => setAsignatura(e.target.value as AsignaturaSimce)}
            className="w-full p-2 border rounded"
          >
            <option value="matematica">Matemática</option>
            <option value="lectura">Lectura</option>
            <option value="ciencias">Ciencias Naturales</option>
            <option value="historia">Historia y Geografía</option>
          </select>
        </div>
        
        <div>
          <label className="block mb-2 font-semibold">Nivel</label>
          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
            className="w-full p-2 border rounded"
          >
            {niveles.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
      
      {loading && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}
      
      {error && (
        <div className="p-4 border-l-4 border-red-500 bg-red-50 text-red-700 mb-6">
          {error}
        </div>
      )}
      
      {!loading && sets.length === 0 && (
        <div className="text-center py-8 border rounded">
          <p className="text-gray-500">No hay sets de preguntas disponibles para esta asignatura y nivel</p>
        </div>
      )}
      
      {sets.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mb-4">Sets de preguntas disponibles</h3>
          <div className="space-y-2 mb-8">
            {sets.map((set) => (
              <div
                key={set.id}
                className={`p-4 border rounded-lg cursor-pointer flex justify-between items-center
                  ${selectedSetId === set.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-100'}`}
                onClick={() => setSelectedSetId(set.id)}
              >
                <div>
                  <div className="font-medium">{set.titulo}</div>
                  <div className="text-sm text-gray-500">{set.eje} - {set.preguntas.length} preguntas</div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            ))}
          </div>
          
          <div className="flex justify-center">
            <button
              onClick={iniciarEvaluacion}
              disabled={!selectedSetId || loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              <BookOpen className="mr-2 h-5 w-5" />
              Iniciar Evaluación
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default EvaluacionSimce;
