import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { 
  BookOpen, 
  Calculator, 
  PlusCircle, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Trash2,
  RefreshCw,
  Edit2,
  FilePlus,
  Users
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

// Importar los tipos
import { SimcePregunta, SimceAlternativa, SimceEvaluacion } from '../../../types/simce';

// Importar helpers de Firebase
import { 
  crearEvaluacionSimce, 
  actualizarEvaluacionSimce, 
  obtenerEvaluacionesProfesor 
} from '@/firebaseHelpers/simceHelper';

interface SimceGeneradorPreguntasProps {
  currentUser: User;
}

export const SimceGeneradorPreguntas: React.FC<SimceGeneradorPreguntasProps> = ({ currentUser }) => {
  const [asignatura, setAsignatura] = useState<'Lectura' | 'Matemática'>('Lectura');
  const [cantidadPreguntas, setCantidadPreguntas] = useState<number>(4);
  const [titulo, setTitulo] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [preguntas, setPreguntas] = useState<SimcePregunta[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [editando, setEditando] = useState<string | null>(null); // ID de la pregunta que se está editando
  const [preguntaActual, setPreguntaActual] = useState<SimcePregunta | null>(null);
  const [modo, setModo] = useState<'creacion' | 'edicion'>('creacion');
  const [evaluaciones, setEvaluaciones] = useState<SimceEvaluacion[]>([]);
  const [evaluacionSeleccionada, setEvaluacionSeleccionada] = useState<string | null>(null);
  const [cursosDisponibles, setCursosDisponibles] = useState<string[]>([]);
  const [cursosSeleccionados, setCursosSeleccionados] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Cargar evaluaciones del profesor
  useEffect(() => {
    const cargarEvaluaciones = async () => {
      if (!currentUser.uid) return;
      
      try {
        const evaluacionesData = await obtenerEvaluacionesProfesor(currentUser.uid);
        setEvaluaciones(evaluacionesData);
      } catch (error) {
        console.error('Error al cargar evaluaciones:', error);
        setError('No se pudieron cargar las evaluaciones existentes');
      }
    };

    cargarEvaluaciones();
  }, [currentUser]);

  // Cargar cursos disponibles
  useEffect(() => {
    // En un caso real, esto vendría de la base de datos
    // Por ahora usamos los cursos asignados al profesor
    if (currentUser.cursos && Array.isArray(currentUser.cursos)) {
      setCursosDisponibles(currentUser.cursos);
    } else {
      setCursosDisponibles([]);
    }
  }, [currentUser]);

  // Cargar evaluación seleccionada
  useEffect(() => {
    if (evaluacionSeleccionada && modo === 'edicion') {
      const evaluacion = evaluaciones.find(e => e.id === evaluacionSeleccionada);
      if (evaluacion) {
        setTitulo(evaluacion.titulo);
        setDescripcion(evaluacion.descripcion);
        setAsignatura(evaluacion.asignatura);
        setPreguntas(evaluacion.preguntas);
        setCursosSeleccionados(evaluacion.cursoAsignado || []);
      }
    }
  }, [evaluacionSeleccionada, modo, evaluaciones]);

  const handleGenerarPreguntas = async () => {
    setError(null);
    setCargando(true);
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("La API Key de Gemini no está configurada.");
      }

      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ 
        model: "gemini-1.5-pro",
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 8192
        }
      });

      const estandares = {
        Lectura: [
          "Localizar información explícita",
          "Realizar inferencias a partir del texto",
          "Reflexionar sobre el contenido del texto",
          "Interpretar lenguaje figurado",
          "Evaluar elementos textuales y de diseño"
        ],
        Matemática: [
          "Números y operaciones",
          "Patrones y álgebra",
          "Geometría",
          "Medición",
          "Datos y probabilidad"
        ]
      };

      const habilidades = {
        Lectura: [
          "Extraer información",
          "Interpretar y relacionar",
          "Reflexionar",
          "Evaluar"
        ],
        Matemática: [
          "Resolver problemas",
          "Representar",
          "Modelar",
          "Argumentar y comunicar"
        ]
      };

      const prompt = `Genera ${cantidadPreguntas} preguntas tipo SIMCE para estudiantes de 2º medio de ${asignatura} alineadas con los estándares de aprendizaje del MINEDUC Chile. Cada pregunta debe tener:
1. Un enunciado claro
2. Cuatro alternativas (A, B, C y D), donde sólo una es correcta
3. La alternativa correcta (debe ser una letra: A, B, C o D)
4. Una explicación breve de por qué esa es la respuesta correcta
5. El estándar de aprendizaje al que corresponde
6. La habilidad que evalúa

Para Lectura, usa textos breves y variados (narrativos, informativos, argumentativos). Para Matemática, incluye problemas contextualizados.

Estándares de aprendizaje para ${asignatura}:
${estandares[asignatura].join(", ")}

Habilidades para ${asignatura}:
${habilidades[asignatura].join(", ")}

Devuelve la respuesta en formato JSON con esta estructura:
[
  {
    "enunciado": "Texto de la pregunta...",
    "alternativas": [
      {"id": "A", "texto": "Alternativa A..."},
      {"id": "B", "texto": "Alternativa B..."},
      {"id": "C", "texto": "Alternativa C..."},
      {"id": "D", "texto": "Alternativa D..."}
    ],
    "respuestaCorrecta": "B",
    "explicacion": "La respuesta es B porque...",
    "estandarAprendizaje": "Uno de los estándares listados arriba",
    "habilidad": "Una de las habilidades listadas arriba"
  }
]

Asegúrate de que cada pregunta sea desafiante pero apropiada para el nivel, y que no haya ambigüedades en las respuestas.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      
      // Limpiar el texto de posibles delimitadores de código
      if (text.includes('```')) {
        text = text.replace(/```json\s*|\s*```/g, '');
      }
      
      // Parsear el JSON
      const preguntasGeneradas: SimcePregunta[] = JSON.parse(text);
      
      // Añadir IDs únicos a las preguntas
      const preguntasConId = preguntasGeneradas.map(pregunta => ({
        ...pregunta,
        id: uuidv4()
      }));
      
      setPreguntas(preguntasConId);
      
    } catch (error) {
      console.error("Error al generar preguntas:", error);
      setError("Ocurrió un error al generar las preguntas. Intente nuevamente.");
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarEvaluacion = async () => {
    setError(null);
    setExito(null);
    
    // Validaciones
    if (!titulo.trim()) {
      setError("Debe ingresar un título para la evaluación");
      return;
    }
    
    if (preguntas.length === 0) {
      setError("Debe generar preguntas antes de guardar");
      return;
    }
    
    if (cursosSeleccionados.length === 0) {
      setError("Debe seleccionar al menos un curso");
      return;
    }
    
    setGuardando(true);
    
    try {
      const evaluacion: Omit<SimceEvaluacion, 'id'> = {
        titulo,
        descripcion,
        asignatura,
        preguntas,
        fechaCreacion: new Date().toISOString(),
        fechaAsignacion: new Date().toISOString(),
        activo: true,
        profesor: {
          id: currentUser.uid || currentUser.id || '',
          nombre: currentUser.nombreCompleto || 'Docente'
        },
        cursoAsignado: cursosSeleccionados
      };
      
      if (modo === 'creacion') {
        await crearEvaluacionSimce(evaluacion);
        setExito("¡Evaluación creada y asignada con éxito!");
        
        // Limpiar formulario
        setTitulo('');
        setDescripcion('');
        setPreguntas([]);
        setCursosSeleccionados([]);
      } else if (modo === 'edicion' && evaluacionSeleccionada) {
        await actualizarEvaluacionSimce(evaluacionSeleccionada, evaluacion);
        setExito("¡Evaluación actualizada con éxito!");
      }
      
      // Recargar evaluaciones
      const evaluacionesActualizadas = await obtenerEvaluacionesProfesor(currentUser.uid || currentUser.id || '');
      setEvaluaciones(evaluacionesActualizadas);
      
    } catch (error) {
      console.error("Error al guardar evaluación:", error);
      setError("Ocurrió un error al guardar la evaluación. Intente nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  const handleEditarPregunta = (preguntaId: string) => {
    const pregunta = preguntas.find(p => p.id === preguntaId);
    if (pregunta) {
      setEditando(preguntaId);
      setPreguntaActual({...pregunta});
    }
  };

  const handleGuardarEdicionPregunta = () => {
    if (!preguntaActual || !editando) return;
    
    const nuevasPreguntas = preguntas.map(p => 
      p.id === editando ? preguntaActual : p
    );
    
    setPreguntas(nuevasPreguntas);
    setEditando(null);
    setPreguntaActual(null);
  };

  const handleCancelarEdicionPregunta = () => {
    setEditando(null);
    setPreguntaActual(null);
  };

  const handleEliminarPregunta = (preguntaId: string) => {
    if (window.confirm("¿Está seguro que desea eliminar esta pregunta?")) {
      setPreguntas(preguntas.filter(p => p.id !== preguntaId));
    }
  };

  const handleCambioAlternativa = (index: number, valor: string) => {
    if (!preguntaActual) return;
    
    const nuevasAlternativas = [...preguntaActual.alternativas];
    nuevasAlternativas[index] = {
      ...nuevasAlternativas[index],
      texto: valor
    };
    
    setPreguntaActual({
      ...preguntaActual,
      alternativas: nuevasAlternativas
    });
  };

  return (
    <div className="space-y-8">
      {/* Panel de configuración */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Configuración del Set de Preguntas</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modo</label>
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => {
                  setModo('creacion');
                  setTitulo('');
                  setDescripcion('');
                  setPreguntas([]);
                  setCursosSeleccionados([]);
                  setEvaluacionSeleccionada(null);
                }}
                className={`flex-1 py-2 px-3 rounded-md ${
                  modo === 'creacion'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <FilePlus className="w-4 h-4" />
                  <span>Nuevo</span>
                </div>
              </button>
              <button
                onClick={() => setModo('edicion')}
                className={`flex-1 py-2 px-3 rounded-md ${
                  modo === 'edicion'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Edit2 className="w-4 h-4" />
                  <span>Editar</span>
                </div>
              </button>
            </div>
            
            {modo === 'edicion' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Seleccionar evaluación</label>
                <select 
                  value={evaluacionSeleccionada || ''}
                  onChange={(e) => setEvaluacionSeleccionada(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                >
                  <option value="">Seleccione una evaluación...</option>
                  {evaluaciones.map(evaluacion => (
                    <option key={evaluacion.id} value={evaluacion.id}>
                      {evaluacion.titulo} - {evaluacion.asignatura}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Título</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Evaluación SIMCE Matemática 2º medio"
                className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción (opcional)</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Evaluación diagnóstica para preparación SIMCE"
                className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                rows={3}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Asignatura</label>
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setAsignatura('Lectura')}
                className={`flex-1 py-2 px-3 rounded-md ${
                  asignatura === 'Lectura'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  <span>Lectura</span>
                </div>
              </button>
              <button
                onClick={() => setAsignatura('Matemática')}
                className={`flex-1 py-2 px-3 rounded-md ${
                  asignatura === 'Matemática'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Calculator className="w-4 h-4" />
                  <span>Matemática</span>
                </div>
              </button>
            </div>
            
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cantidad de preguntas</label>
            <div className="flex space-x-2 mb-4">
              {[2, 4, 6].map((cantidad) => (
                <button
                  key={cantidad}
                  onClick={() => setCantidadPreguntas(cantidad)}
                  className={`flex-1 py-2 px-3 rounded-md ${
                    cantidadPreguntas === cantidad
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {cantidad}
                </button>
              ))}
            </div>
            
            <div className="mt-4">
              <button
                onClick={handleGenerarPreguntas}
                disabled={cargando}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Generar preguntas</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Asignar a cursos</label>
            <div className="flex items-center mb-2">
              <Users className="w-4 h-4 mr-2 text-indigo-500" />
              <span>Seleccione los cursos para esta evaluación</span>
            </div>
            
            <div className="h-40 overflow-y-auto border border-slate-300 dark:border-slate-600 rounded-md p-2">
              {cursosDisponibles.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {cursosDisponibles.map((curso) => (
                    <div key={curso} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`curso-${curso}`}
                        checked={cursosSeleccionados.includes(curso)}
                        onChange={() => {
                          if (cursosSeleccionados.includes(curso)) {
                            setCursosSeleccionados(cursosSeleccionados.filter(c => c !== curso));
                          } else {
                            setCursosSeleccionados([...cursosSeleccionados, curso]);
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 mr-2"
                      />
                      <label htmlFor={`curso-${curso}`} className="text-sm">{curso}</label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500">
                  No hay cursos disponibles
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <button
                onClick={handleGuardarEvaluacion}
                disabled={guardando || preguntas.length === 0 || cursosSeleccionados.length === 0}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {guardando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{modo === 'creacion' ? 'Guardar y asignar evaluación' : 'Actualizar evaluación'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 rounded-md flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}
        
        {exito && (
          <div className="mt-4 p-3 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 rounded-md flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {exito}
          </div>
        )}
      </div>

      {/* Visualización de preguntas */}
      {preguntas.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Preguntas generadas ({preguntas.length})
          </h2>
          
          <div className="space-y-6">
            {preguntas.map((pregunta, index) => (
              <div 
                key={pregunta.id} 
                className={`p-4 rounded-lg border ${
                  editando === pregunta.id 
                    ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20' 
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {editando === pregunta.id ? (
                  // Modo edición de pregunta
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Enunciado</label>
                      <textarea
                        value={preguntaActual?.enunciado || ''}
                        onChange={(e) => preguntaActual && setPreguntaActual({...preguntaActual, enunciado: e.target.value})}
                        className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Alternativas</label>
                      {preguntaActual?.alternativas.map((alt, i) => (
                        <div key={alt.id} className="flex items-center mb-2">
                          <div className="font-bold w-8">{alt.id})</div>
                          <textarea
                            value={alt.texto}
                            onChange={(e) => handleCambioAlternativa(i, e.target.value)}
                            className="flex-1 rounded-md border border-slate-300 bg-white py-2 px-3 shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                            rows={2}
                          />
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Respuesta correcta</label>
                        <select
                          value={preguntaActual?.respuestaCorrecta || ''}
                          onChange={(e) => preguntaActual && setPreguntaActual({...preguntaActual, respuestaCorrecta: e.target.value})}
                          className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        >
                          {preguntaActual?.alternativas.map(alt => (
                            <option key={alt.id} value={alt.id}>{alt.id}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Explicación</label>
                        <textarea
                          value={preguntaActual?.explicacion || ''}
                          onChange={(e) => preguntaActual && setPreguntaActual({...preguntaActual, explicacion: e.target.value})}
                          className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                          rows={2}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estándar de Aprendizaje</label>
                        <input
                          type="text"
                          value={preguntaActual?.estandarAprendizaje || ''}
                          onChange={(e) => preguntaActual && setPreguntaActual({...preguntaActual, estandarAprendizaje: e.target.value})}
                          className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Habilidad</label>
                        <input
                          type="text"
                          value={preguntaActual?.habilidad || ''}
                          onChange={(e) => preguntaActual && setPreguntaActual({...preguntaActual, habilidad: e.target.value})}
                          className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleCancelarEdicionPregunta}
                        className="py-2 px-4 border border-slate-300 rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleGuardarEdicionPregunta}
                        className="py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Guardar cambios
                      </button>
                    </div>
                  </div>
                ) : (
                  // Modo visualización de pregunta
                  <div>
                    <h3 className="font-bold text-lg mb-2">
                      <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 py-0.5 px-2 rounded-md mr-2">
                        Pregunta {index + 1}
                      </span>
                      {pregunta.enunciado}
                    </h3>
                    
                    <div className="ml-6 mt-3 space-y-2">
                      {pregunta.alternativas.map((alt) => (
                        <div 
                          key={alt.id} 
                          className={`flex items-start ${
                            alt.id === pregunta.respuestaCorrecta
                              ? 'text-green-700 dark:text-green-400 font-semibold'
                              : ''
                          }`}
                        >
                          <div className="font-bold mr-2 min-w-[20px]">{alt.id})</div>
                          <div>{alt.texto}</div>
                          {alt.id === pregunta.respuestaCorrecta && (
                            <CheckCircle2 className="w-4 h-4 ml-1 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 text-sm">
                      <div className="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 p-2 rounded-md">
                        <span className="font-semibold">Explicación:</span> {pregunta.explicacion}
                      </div>
                      
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 p-2 rounded-md">
                          <span className="font-semibold">Estándar:</span> {pregunta.estandarAprendizaje}
                        </div>
                        <div className="bg-purple-50 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 p-2 rounded-md">
                          <span className="font-semibold">Habilidad:</span> {pregunta.habilidad}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        onClick={() => handleEliminarPregunta(pregunta.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Eliminar pregunta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditarPregunta(pregunta.id)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Editar pregunta"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
