import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CheckCircle, AlertCircle, Save, RefreshCcw, Loader2 } from 'lucide-react';
import { Pregunta, AsignaturaSimce, SetPreguntas } from '../../../types/simce';
import { crearSetPreguntas, actualizarSetPreguntas } from '../../../src/firebaseHelpers/simceHelper';

interface CreadorPreguntasProps {
  currentUser: any;
  onPreguntasCreadas?: (preguntas: Pregunta[]) => void;
  setExistente?: SetPreguntas;
  onSaveComplete?: () => void;
}

const CreadorPreguntas: React.FC<CreadorPreguntasProps> = ({ 
  currentUser, 
  onPreguntasCreadas,
  setExistente,
  onSaveComplete
}) => {
  const [asignatura, setAsignatura] = useState<AsignaturaSimce>('matematica');
  const [nivel, setNivel] = useState<string>('2° básico');
  const [eje, setEje] = useState<string>('');
  const [objetivo, setObjetivo] = useState<string>('');
  const [cantidadPreguntas, setCantidadPreguntas] = useState<number>(5);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [titulo, setTitulo] = useState<string>(setExistente?.titulo || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoExitoso, setGuardadoExitoso] = useState<boolean>(false);
  const [editandoPregunta, setEditandoPregunta] = useState<number | null>(null);
  const [preguntaEditada, setPreguntaEditada] = useState<string>('');

  // Llenar datos si hay un set existente
  useEffect(() => {
    if (setExistente) {
      setAsignatura(setExistente.asignatura);
      setNivel(setExistente.nivel);
      setEje(setExistente.eje);
      setObjetivo(setExistente.objetivo);
      setTitulo(setExistente.titulo);
      setPreguntas(setExistente.preguntas);
    }
  }, [setExistente]);

  const niveles = [
    '2° básico',
    '4° básico',
    '6° básico',
    '8° básico',
    '2° medio'
  ];

  const ejesPorAsignatura: Record<AsignaturaSimce, string[]> = {
    matematica: [
      'Números y operaciones',
      'Patrones y álgebra',
      'Geometría',
      'Medición',
      'Datos y probabilidades'
    ],
    lectura: [
      'Información explícita',
      'Información implícita',
      'Reflexión sobre el texto',
      'Comprensión global'
    ],
    ciencias: [
      'Ciencias de la vida',
      'Ciencias físicas y químicas',
      'Ciencias de la Tierra y el universo'
    ],
    historia: [
      'Historia',
      'Geografía',
      'Formación ciudadana'
    ]
  };

  const generarPreguntas = async () => {
    if (!eje || !objetivo || !nivel || !asignatura) {
      setError('Por favor, completa todos los campos');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const prompt = `Genera ${cantidadPreguntas} preguntas tipo SIMCE para la asignatura de ${asignatura}, 
      nivel ${nivel}, eje ${eje}, con el objetivo de aprendizaje: ${objetivo}.
      
      Cada pregunta debe ser desafiante pero adecuada para el nivel, con 4 alternativas donde solo una es correcta.
      
      Devuelve solo un JSON array con objetos con la siguiente estructura, sin texto adicional:
      [
        {
          "enunciado": "Texto de la pregunta",
          "alternativas": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
          "respuestaCorrecta": 0, // Índice de la alternativa correcta (0-3)
          "explicacion": "Breve explicación de por qué esa es la respuesta correcta"
        }
      ]`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Extraer el JSON del texto
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        throw new Error("No se pudo generar el formato correcto de preguntas");
      }
      
      const jsonStr = jsonMatch[0];
      const preguntasGeneradas: Pregunta[] = JSON.parse(jsonStr);

      setPreguntas(preguntasGeneradas);
      if (onPreguntasCreadas) {
        onPreguntasCreadas(preguntasGeneradas);
      }
    } catch (err) {
      console.error('Error generando preguntas:', err);
      setError('Error al generar preguntas. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const guardarSet = async () => {
    if (!titulo) {
      setError('Debes agregar un título al set de preguntas');
      return;
    }

    if (preguntas.length === 0) {
      setError('No hay preguntas para guardar');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const setData: SetPreguntas = {
        id: setExistente?.id || '',
        titulo,
        asignatura,
        nivel,
        eje,
        objetivo,
        preguntas,
        creadorId: currentUser.uid,
        fechaCreacion: setExistente?.fechaCreacion || new Date().toISOString(),
        fechaActualizacion: new Date().toISOString()
      };

      if (setExistente?.id) {
        await actualizarSetPreguntas(setExistente.id, setData);
      } else {
        await crearSetPreguntas(setData);
      }
      
      setGuardadoExitoso(true);
      setTimeout(() => setGuardadoExitoso(false), 3000);
      
      if (onSaveComplete) {
        onSaveComplete();
      }
    } catch (err) {
      console.error('Error guardando set de preguntas:', err);
      setError('Error al guardar el set de preguntas');
    } finally {
      setLoading(false);
    }
  };

  const handleEditarPregunta = (index: number) => {
    setEditandoPregunta(index);
    setPreguntaEditada(preguntas[index].enunciado);
  };

  const guardarEdicionPregunta = (index: number) => {
    const nuevasPreguntas = [...preguntas];
    nuevasPreguntas[index] = {
      ...nuevasPreguntas[index],
      enunciado: preguntaEditada
    };
    setPreguntas(nuevasPreguntas);
    setEditandoPregunta(null);
  };

  const handleEditarAlternativa = (preguntaIndex: number, altIndex: number, valor: string) => {
    const nuevasPreguntas = [...preguntas];
    nuevasPreguntas[preguntaIndex].alternativas[altIndex] = valor;
    setPreguntas(nuevasPreguntas);
  };

  const handleCambiarRespuestaCorrecta = (preguntaIndex: number, altIndex: number) => {
    const nuevasPreguntas = [...preguntas];
    nuevasPreguntas[preguntaIndex].respuestaCorrecta = altIndex;
    setPreguntas(nuevasPreguntas);
  };

  const handleEditarExplicacion = (preguntaIndex: number, explicacion: string) => {
    const nuevasPreguntas = [...preguntas];
    nuevasPreguntas[preguntaIndex].explicacion = explicacion;
    setPreguntas(nuevasPreguntas);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Generador de Preguntas SIMCE</h2>
      
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Título del Set</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Ej. Repaso Números y operaciones 4° básico"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
        
        <div>
          <label className="block mb-2 font-semibold">Eje Temático</label>
          <select
            value={eje}
            onChange={(e) => setEje(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Selecciona un eje</option>
            {ejesPorAsignatura[asignatura].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block mb-2 font-semibold">Cantidad de Preguntas</label>
          <input
            type="number"
            value={cantidadPreguntas}
            onChange={(e) => setCantidadPreguntas(parseInt(e.target.value) || 1)}
            className="w-full p-2 border rounded"
            min="1"
            max="10"
          />
        </div>
      </div>
      
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Objetivo de Aprendizaje</label>
        <textarea
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          className="w-full p-2 border rounded"
          rows={2}
          placeholder="Describe el objetivo de aprendizaje"
        />
      </div>
      
      <div className="flex space-x-4 mb-8">
        <button
          onClick={generarPreguntas}
          disabled={loading}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          {setExistente ? 'Regenerar Preguntas' : 'Generar Preguntas'}
        </button>
        
        <button
          onClick={guardarSet}
          disabled={loading || preguntas.length === 0}
          className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          <Save className="mr-2 h-4 w-4" />
          Guardar Set
        </button>
      </div>
      
      {error && (
        <div className="mb-6 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 flex items-center">
          <AlertCircle className="mr-2 h-5 w-5" />
          <span>{error}</span>
        </div>
      )}
      
      {guardadoExitoso && (
        <div className="mb-6 p-3 bg-green-100 border-l-4 border-green-500 text-green-700 flex items-center">
          <CheckCircle className="mr-2 h-5 w-5" />
          <span>Set de preguntas guardado correctamente</span>
        </div>
      )}
      
      <div className="space-y-8">
        {preguntas.map((pregunta, idx) => (
          <div key={idx} className="border p-4 rounded-lg">
            <div className="mb-4">
              <div className="flex justify-between items-start">
                <div className="font-semibold text-lg mb-2">Pregunta {idx + 1}</div>
                <button 
                  onClick={() => handleEditarPregunta(idx)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Editar
                </button>
              </div>
              
              {editandoPregunta === idx ? (
                <div className="mb-2">
                  <textarea
                    value={preguntaEditada}
                    onChange={(e) => setPreguntaEditada(e.target.value)}
                    className="w-full p-2 border rounded"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => guardarEdicionPregunta(idx)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditandoPregunta(null)}
                      className="px-3 py-1 ml-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div>{pregunta.enunciado}</div>
              )}
            </div>
            
            <div className="mb-4">
              {pregunta.alternativas.map((alt, altIdx) => (
                <div key={altIdx} className="flex items-start mb-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id={`alt-${idx}-${altIdx}`}
                      name={`pregunta-${idx}`}
                      checked={pregunta.respuestaCorrecta === altIdx}
                      onChange={() => handleCambiarRespuestaCorrecta(idx, altIdx)}
                      className="mr-2"
                    />
                  </div>
                  <div className="flex-grow">
                    <input
                      type="text"
                      value={alt}
                      onChange={(e) => handleEditarAlternativa(idx, altIdx, e.target.value)}
                      className="w-full p-1 border rounded"
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div>
              <label className="block mb-1 font-semibold text-sm">Explicación</label>
              <textarea
                value={pregunta.explicacion}
                onChange={(e) => handleEditarExplicacion(idx, e.target.value)}
                className="w-full p-2 border rounded text-sm"
                rows={2}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CreadorPreguntas;
