// components/modules/Autoaprendizaje.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActividadRemota,
  RespuestaEstudianteActividad,
  User,
  TipoActividadRemota,
  QuizQuestion,
  ComprensionLecturaContent,
  DetailedFeedback,
  FeedbackAI
} from '../../types';
import {
  subscribeToActividadesDisponibles,
  subscribeToRespuestasEstudiante,
  saveRespuestaActividad,
  debugRespuestasEstudiante,
} from '../../src/firebaseHelpers/autoaprendizajeHelper';
import { calcularNota60 } from '../../src/utils/grades';
import { GoogleGenerativeAI } from '@google/generative-ai';

// —— Tipos defensivos para las variantes que pueden venir del generador —— //
type PareadoFromTeacher = { id?: number; concepto?: string; definicion?: string };
type PareadosContent =
  | PareadoFromTeacher[]
  | { pares: { izquierda: string; derecha: string; puntaje?: number }[] };

type DesarrolloItemFromTeacher = { pregunta?: string; enunciado?: string; texto?: string; rubrica?: string | object };
type DesarrolloContentTeacher =
  | DesarrolloItemFromTeacher[]
  | { preguntas: DesarrolloItemFromTeacher[] };

// —— UI —— //
const SpinnerIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// —— FUNCIONES DE MANEJO DE ERRORES MEJORADAS —— //

/**
 * Función mejorada para generar feedback con reintentos automáticos
 */
const generateAIFeedbackWithRetry = async (
  actividad: ActividadRemota, 
  feedback: DetailedFeedback, 
  maxRetries = 3
): Promise<FeedbackAI | null> => {
  // Lógica Gemini movida al backend. Llama a un endpoint seguro:
  try {
    const response = await fetch('/api/generarFeedbackAutoaprendizaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actividad, feedback })
    });
    if (!response.ok) throw new Error('Error al generar feedback con IA');
    const data = await response.json();
    return data as FeedbackAI;
  } catch (error) {
    console.error('Error al generar feedback con IA:', error);
    return null;
  }
};

/**
 * Función mejorada para guardar respuesta con manejo robusto de errores
 */
const saveRespuestaActivityWithFeedback = async (
  baseData: Omit<RespuestaEstudianteActividad, 'id' | 'retroalimentacionAI'>,
  actividad: ActividadRemota,
  detailedFeedback: DetailedFeedback
): Promise<RespuestaEstudianteActividad> => {
  console.log('💾 Iniciando guardado de respuesta...');
  
  try {
    // Paso 1: Guardar la respuesta base (prioridad máxima)
    const docId = await saveRespuestaActividad(baseData);
    console.log('✅ Respuesta base guardada con ID:', docId);

    const resultWithId = { id: docId, ...baseData };

    // Paso 2: Intentar generar feedback con IA (opcional, no bloquea el guardado)
    try {
      const feedbackIA = await generateAIFeedbackWithRetry(actividad, detailedFeedback);
      
      if (feedbackIA) {
        // Actualizar el documento con el feedback de IA
        const { updateDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../../src/firebase');
        
        await updateDoc(doc(db, 'respuestas_actividades', docId), { 
          retroalimentacionAI: feedbackIA 
        });
        
        console.log('🤖 Feedback de IA agregado exitosamente');
        return { ...resultWithId, retroalimentacionAI: feedbackIA };
      }
      
      return resultWithId;
      
    } catch (iaError) {
      console.warn('⚠️ No se pudo generar feedback de IA, pero la respuesta fue guardada:', iaError);
      return resultWithId;
    }

  } catch (error) {
    console.error('❌ Error crítico al guardar respuesta:', error);
    throw error;
  }
};

// —— Funciones auxiliares de normalización (mantenidas igual) —— //
const logSuspiciousObject = (obj: any, context: string) => {
  if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    const keys = Object.keys(obj);
    if (keys.some(key => ['comprension', 'analisis', 'argumentacion', 'creatividad', 'claridad', 'precision', 'organizacion'].includes(key))) {
      console.warn(`🚨 OBJETO SOSPECHOSO EN ${context}:`, obj);
      console.warn('Keys:', keys);
    }
  }
};

const ultraSafeStringify = (value: any, context?: string): string => {
  if (context) logSuspiciousObject(value, context);
  
  // Caso especial para panelDidactico
  if (context === 'panelDidactico' || context?.includes('panelDidactico')) {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    
    try {
      // Para objetos complejos en panelDidactico, intentar obtener el texto completo
      if (typeof value === 'object') {
        if (typeof value.texto === 'string') return value.texto;
        if (typeof value.contenido === 'string') return value.contenido;
        
        // Si es un objeto sin campos de texto reconocibles, convertirlo directamente
        return JSON.stringify(value);
      }
      return String(value);
    } catch {
      return '[Error al procesar el panel didáctico]';
    }
  }
  
  // Manejo normal para otros contextos
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(item => ultraSafeStringify(item, `${context}-array-item`)).join(', ');
    }
    
    const textFields = [
      'texto', 'contenido', 'descripcion', 'valor', 'name', 'title', 'label',
      'pregunta', 'enunciado', 'respuesta', 'opcion', 'concepto', 'definicion'
    ];
    
    for (const field of textFields) {
      if (value[field] && typeof value[field] === 'string') {
        return value[field];
      }
    }
    
    const keys = Object.keys(value);
    if (keys.some(key => ['comprension', 'analisis', 'argumentacion', 'creatividad', 'claridad', 'precision'].includes(key))) {
      return '[Criterios de evaluación]';
    }
    
    try {
      const json = JSON.stringify(value);
      if (json.length > 100) return '[Objeto complejo]';
      return json;
    } catch {
      return '[Objeto no serializable]';
    }
  }
  
  return String(value);
};

const extractTextSafely = (item: any, context: string, ...fields: string[]): string => {
  logSuspiciousObject(item, `extractTextSafely-${context}`);
  
  if (!item) return '';
  
  for (const field of fields) {
    if (item[field]) {
      const result = ultraSafeStringify(item[field], `${context}-${field}`);
      if (result && result !== '[Objeto complejo]' && result !== '[Objeto no serializable]') {
        return result;
      }
    }
  }
  
  const commonFields = ['texto', 'pregunta', 'enunciado', 'contenido', 'descripcion', 'value', 'label'];
  for (const field of commonFields) {
    if (item[field]) {
      const result = ultraSafeStringify(item[field], `${context}-${field}`);
      if (result && result !== '[Objeto complejo]' && result !== '[Objeto no serializable]') {
        return result;
      }
    }
  }
  
  if (typeof item === 'string') return item;
  return '[Sin contenido disponible]';
};

const UltraSafeRenderer = ({ content, context = 'unknown' }: { content: any; context?: string }) => {
  try {
    const safeText = ultraSafeStringify(content, `UltraSafeRenderer-${context}`);
    return <span>{safeText}</span>;
  } catch (error) {
    console.error('Error in UltraSafeRenderer:', error, 'Content:', content);
    return <span>[Error al mostrar contenido]</span>;
  }
};

// Funciones de normalización (mantenidas igual)
function ultraSafeNormalizeLectura(content: any): { texto: string; preguntas: QuizQuestion[] } {
  console.log('🔍 Normalizando lectura:', content);
  logSuspiciousObject(content, 'normalizeLectura-input');
  
  if (!content) return { texto: '', preguntas: [] };

  const normalizeQuestion = (q: any, index: number): QuizQuestion => {
    logSuspiciousObject(q, `normalizeQuestion-${index}`);
    
    const opciones = Array.isArray(q?.opciones) 
      ? q.opciones.map((op, i) => ultraSafeStringify(op, `opcion-${index}-${i}`)).filter(Boolean)
      : [];
    
    return {
      pregunta: extractTextSafely(q, `pregunta-${index}`, 'pregunta', 'texto'),
      opciones,
      respuestaCorrecta: ultraSafeStringify(q?.respuestaCorrecta, `respuestaCorrecta-${index}`),
      puntaje: typeof q?.puntaje === 'number' ? q.puntaje : 1
    };
  };

  if (!Array.isArray(content) && Array.isArray((content as ComprensionLecturaContent).preguntas)) {
    const c = content as ComprensionLecturaContent;
    return {
      texto: extractTextSafely(c, 'lectura-texto', 'texto'),
      preguntas: (c.preguntas || []).map(normalizeQuestion)
    };
  }

  if (Array.isArray(content)) {
    const texto = content
      .map((b: any, i) => extractTextSafely(b, `lectura-bloque-${i}`, 'texto'))
      .filter(Boolean)
      .join('\n\n---\n\n');
    const preguntas = content
      .flatMap((b: any, i) => {
        logSuspiciousObject(b, `lectura-bloque-preguntas-${i}`);
        return Array.isArray(b?.preguntas) ? b.preguntas : [];
      })
      .map(normalizeQuestion);
    return { texto, preguntas };
  }

  return { texto: '', preguntas: [] };
}

function ultraSafeNormalizePareados(content: PareadosContent): { izquierda: string; derecha: string; puntaje?: number }[] {
  console.log('🔍 Normalizando pareados:', content);
  logSuspiciousObject(content, 'normalizePareados-input');
  
  if (!content) return [];

  if (!Array.isArray(content) && Array.isArray(content.pares)) {
    return content.pares.map((p, i) => {
      logSuspiciousObject(p, `pareado-${i}`);
      return {
        izquierda: extractTextSafely(p, `pareado-izq-${i}`, 'izquierda', 'concepto'),
        derecha: extractTextSafely(p, `pareado-der-${i}`, 'derecha', 'definicion'),
        puntaje: typeof p?.puntaje === 'number' ? p.puntaje : 1
      };
    });
  }

  if (Array.isArray(content)) {
    return content.map((p, i) => {
      logSuspiciousObject(p, `pareado-array-${i}`);
      return {
        izquierda: extractTextSafely(p, `pareado-concepto-${i}`, 'concepto', 'izquierda'),
        derecha: extractTextSafely(p, `pareado-definicion-${i}`, 'definicion', 'derecha'),
        puntaje: 1
      };
    });
  }

  return [];
}

function ultraSafeNormalizeDesarrollo(content: DesarrolloContentTeacher): { enunciado: string; puntajeMax?: number }[] {
  console.log('🔍 Normalizando desarrollo:', content);
  logSuspiciousObject(content, 'normalizeDesarrollo-input');
  
  if (!content) return [];

  if (!Array.isArray(content) && Array.isArray(content.preguntas)) {
    return content.preguntas.map((d, i) => {
      logSuspiciousObject(d, `desarrollo-pregunta-${i}`);
      return {
        enunciado: extractTextSafely(d, `desarrollo-enunciado-${i}`, 'enunciado', 'pregunta', 'texto'),
        puntajeMax: undefined
      };
    });
  }

  if (Array.isArray(content)) {
    return content.map((d, i) => {
      logSuspiciousObject(d, `desarrollo-array-${i}`);
      if (d?.rubrica && typeof d.rubrica === 'object') {
        console.warn(`🚨 Rubrica detectada como objeto en item ${i}, ignorando`, d.rubrica);
      }
      return {
        enunciado: extractTextSafely(d, `desarrollo-array-enunciado-${i}`, 'enunciado', 'pregunta', 'texto'),
        puntajeMax: undefined
      };
    });
  }

  return [];
}

const generateFeedbackPrompt = (actividad: ActividadRemota, feedback: DetailedFeedback): string => {
  const errores = feedback.items.filter(item => item.esCorrecta === false);
  const desarrollo = feedback.items.filter(item => item.tipo === 'Desarrollo');

  const erroresString = errores.map(e =>
    `- Pregunta: "${ultraSafeStringify(e.pregunta, 'feedback-prompt-pregunta')}"\n  - Respuesta del estudiante: "${ultraSafeStringify(e.respuestaUsuario, 'feedback-prompt-respuesta')}"\n  - Respuesta correcta: "${ultraSafeStringify(e.respuestaCorrecta, 'feedback-prompt-correcta')}"`
  ).join('\n');

  const desarrolloString = desarrollo.map(d =>
    `- Pregunta abierta: "${ultraSafeStringify(d.pregunta, 'feedback-prompt-desarrollo-pregunta')}"\n  - Respuesta del estudiante: """${ultraSafeStringify(d.respuestaUsuario, 'feedback-prompt-desarrollo-respuesta')}"""`
  ).join('\n');

  return `
Eres tutor pedagógico. Actividad de "${ultraSafeStringify(actividad.asignatura, 'feedback-prompt-asignatura')}" sobre "${ultraSafeStringify(actividad.contenido, 'feedback-prompt-contenido')}".
Devuelve SOLO un JSON con esta forma:

{
  "logros": "1 párrafo motivador, reconociendo aciertos",
  "desafios": [
    { "pregunta": "...", "explicacionDelError": "≤50 palabras, por qué la correcta es adecuada" }
  ],
  "comentariosDesarrollo": [
    { "pregunta": "...", "retroalimentacionBreve": "≤60 palabras, concreta y constructiva. No asignes nota." }
  ]
}

ERRORES (alternativa / lectura / pareados):
${erroresString || "- Sin errores de alternativa."}

RESPUESTAS DE DESARROLLO:
${desarrolloString || "- Sin preguntas de desarrollo."}
`.trim();
};

// —— Player de Actividad (mantenido igual) —— //
interface ActivityPlayerProps {
  actividad: ActividadRemota;
  onComplete: (
    submission: Omit<RespuestaEstudianteActividad,
      'id' | 'actividadId' | 'estudianteId' | 'fechaCompletado' | 'retroalimentacionDetallada'>,
    detailedFeedback: DetailedFeedback
  ) => void;
  currentUser: User;
}

const ActivityPlayer: React.FC<ActivityPlayerProps> = ({ actividad, onComplete, currentUser }) => {
  const [userAnswers, setUserAnswers] = useState<Partial<Record<TipoActividadRemota, any>>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleAnswerChange = (tipo: TipoActividadRemota, answerData: any) => {
    const newAnswers = { ...userAnswers, [tipo]: answerData };
    setUserAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    let puntajeTotal = 0;
    let puntajeMaximoTotal = 0;
    const retroalimentacionDetallada: DetailedFeedback = { items: [] };

    actividad.tipos.forEach((tipo) => {
      const content = actividad.generatedContent[tipo as keyof typeof actividad.generatedContent];
      const answers = userAnswers[tipo];

      console.log(`🔍 Procesando tipo: ${tipo}`, content);
      logSuspiciousObject(content, `handleSubmit-${tipo}`);

      if (!content) return;

      // QUIZ + COMPRENSIÓN
      if (tipo === 'Quiz' || tipo === 'Comprensión de Lectura') {
        const questions: QuizQuestion[] =
          tipo === 'Quiz'
            ? (Array.isArray(content) ? content.map((q, i) => {
                logSuspiciousObject(q, `quiz-question-${i}`);
                return {
                  pregunta: extractTextSafely(q, `quiz-pregunta-${i}`, 'pregunta'),
                  opciones: Array.isArray(q?.opciones) ? q.opciones.map((op, j) => ultraSafeStringify(op, `quiz-opcion-${i}-${j}`)) : [],
                  respuestaCorrecta: ultraSafeStringify(q?.respuestaCorrecta, `quiz-respuesta-${i}`),
                  puntaje: typeof q?.puntaje === 'number' ? q.puntaje : 1
                };
              }) : [])
            : ultraSafeNormalizeLectura(content).preguntas;

        questions.forEach((q, idx) => {
          const userAnswer = answers?.[idx];
          const isCorrect = userAnswer === q.respuestaCorrecta;
          const p = q.puntaje ?? 1;
          if (isCorrect) puntajeTotal += p;
          puntajeMaximoTotal += p;

          retroalimentacionDetallada.items.push({
            pregunta: q.pregunta,
            respuestaUsuario: ultraSafeStringify(userAnswer, `feedback-respuesta-${idx}`) || 'No respondida',
            respuestaCorrecta: q.respuestaCorrecta,
            esCorrecta: isCorrect,
            puntajeObtenido: isCorrect ? p : 0,
            tipo,
          });
        });
      }

      // TÉRMINOS PAREADOS
      if (tipo === 'Términos Pareados') {
        const pares = ultraSafeNormalizePareados(content as PareadosContent);
        const resp = (answers || {}) as Record<number, string>;

        pares.forEach((par, idx) => {
          const userMatch = resp[idx];
          const isCorrect = userMatch === par.derecha;
          const p = par.puntaje ?? 1;
          if (isCorrect) puntajeTotal += p;
          puntajeMaximoTotal += p;

          retroalimentacionDetallada.items.push({
            pregunta: `${par.izquierda} → ¿?`,
            respuestaUsuario: ultraSafeStringify(userMatch, `pareado-feedback-${idx}`) || 'No respondida',
            respuestaCorrecta: par.derecha,
            esCorrecta: isCorrect,
            puntajeObtenido: isCorrect ? p : 0,
            tipo,
          });
        });
      }

      // DESARROLLO (no autocorregible)
      if (tipo === 'Desarrollo') {
        const items = ultraSafeNormalizeDesarrollo(content as DesarrolloContentTeacher);
        const resp = (answers || {}) as Record<number, string>;

        items.forEach((it, idx) => {
          const userText = ultraSafeStringify(resp[idx], `desarrollo-feedback-${idx}`).trim();

          retroalimentacionDetallada.items.push({
            pregunta: it.enunciado,
            respuestaUsuario: userText || 'No respondida',
            respuestaCorrecta: 'Revisión docente',
            // @ts-ignore: usamos null para marcar "pendiente"
            esCorrecta: null,
            puntajeObtenido: 0,
            tipo,
          });
        });
      }
    });

    const submissionData = {
      puntaje: puntajeTotal,
      puntajeMaximo: puntajeMaximoTotal,
      respuestas: userAnswers,
      nota: calcularNota60(puntajeTotal, puntajeMaximoTotal),
      requiereRevisionDocente: actividad.tipos.includes('Desarrollo'),
    };
    
    onComplete(submissionData, retroalimentacionDetallada);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="p-4 bg-sky-50 border-l-4 border-sky-400 rounded-r-lg">
        <h2 className="text-2xl font-bold text-sky-800 mb-2">
          <UltraSafeRenderer content={actividad.asignatura} context="actividad-asignatura" />
        </h2>
        <div className="text-slate-700 whitespace-pre-wrap">
          <UltraSafeRenderer content={actividad.introduccion} context="actividad-introduccion" />
        </div>
        
        {/* Panel didáctico */}
        {actividad.panelDidactico && (
          <div className="mt-5 p-5 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg shadow-md">
            <h3 className="font-bold text-emerald-800 text-lg mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Material de Estudio - Lee con Atención
            </h3>
            <div className="prose prose-emerald max-w-none text-slate-700">
              {(() => {
                try {
                  // Intentar analizar como JSON si comienza con '{'
                  if (typeof actividad.panelDidactico === 'string' && actividad.panelDidactico.trim().startsWith('{')) {
                    const jsonData = JSON.parse(actividad.panelDidactico);
                    return (
                      <div className="space-y-4">
                        {/* Título principal si existe */}
                        {jsonData.titulo && (
                          <h2 className="text-xl font-bold text-emerald-800">{jsonData.titulo}</h2>
                        )}
                        
                        {/* Subtítulos con su contenido */}
                        {Array.isArray(jsonData.subtitulos) && jsonData.subtitulos.map((sub, i) => (
                          <div key={i} className="mb-4">
                            <h3 className="text-lg font-semibold text-emerald-700 mb-2">{sub.titulo}</h3>
                            <p className="whitespace-pre-line">{sub.texto}</p>
                          </div>
                        ))}
                        
                        {/* Conceptos clave si existen */}
                        {Array.isArray(jsonData.conceptosClave) && jsonData.conceptosClave.length > 0 && (
                          <div className="mt-4">
                            <h3 className="text-lg font-semibold text-emerald-700 mb-2">Conceptos Clave</h3>
                            <ul className="list-disc pl-5 space-y-1">
                              {jsonData.conceptosClave.map((concepto, i) => (
                                <li key={i} className="text-emerald-800">{concepto}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Contenido adicional si no hay estructura específica */}
                        {!jsonData.subtitulos && !jsonData.conceptosClave && (
                          <div className="whitespace-pre-line">{JSON.stringify(jsonData, null, 2)}</div>
                        )}
                      </div>
                    );
                  }
                  // Si no es JSON o hay error, mostrar como texto plano
                  return <p className="whitespace-pre-wrap">{actividad.panelDidactico}</p>;
                } catch (err) {
                  // Si hay error en el parseo, mostrar como texto plano
                  return <p className="whitespace-pre-wrap">{actividad.panelDidactico}</p>;
                }
              })()}
            </div>
          </div>
        )}
        
        {/* Recursos adicionales (enlaces y archivos) */}
        {actividad.recursos && (
          <div className="mt-4 pt-4 border-t border-sky-200">
            {actividad.recursos.instrucciones && (
              <div className="mb-3">
                <h3 className="font-semibold text-sky-700">Instrucciones adicionales:</h3>
                <p className="text-slate-700 whitespace-pre-wrap">
                  <UltraSafeRenderer content={actividad.recursos.instrucciones} context="actividad-instrucciones" />
                </p>
              </div>
            )}
            
            {actividad.recursos.enlaces && (
              <div className="mb-3">
                <h3 className="font-semibold text-sky-700">Enlaces complementarios:</h3>
                <div className="space-y-1 mt-1">
                  {actividad.recursos.enlaces.split('\n').filter(Boolean).map((enlace, idx) => (
                    <div key={idx} className="flex items-center">
                      <span className="text-sky-500 mr-2">🔗</span>
                      <a 
                        href={enlace.startsWith('http') ? enlace : `https://${enlace}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-800 hover:underline break-all"
                      >
                        {enlace}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {actividad.recursos.archivos && actividad.recursos.archivos.length > 0 && (
              <div>
                <h3 className="font-semibold text-sky-700">Archivos complementarios:</h3>
                <div className="space-y-1 mt-1">
                  {actividad.recursos.archivos.map((archivo, idx) => (
                    <div key={idx} className="flex items-center">
                      <span className="text-sky-500 mr-2">📄</span>
                      <a 
                        href={archivo.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-800 hover:underline"
                      >
                        {archivo.nombre || `Archivo ${idx + 1}`}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {actividad.tipos.map((tipo) => {
        const content = actividad.generatedContent[tipo as keyof typeof actividad.generatedContent];
        console.log(`🔍 Renderizando tipo: ${tipo}`, content);
        logSuspiciousObject(content, `render-${tipo}`);
        
        if (!content) return null;

        switch (tipo) {
          case 'Quiz': {
            const questions: QuizQuestion[] = Array.isArray(content) ? content.map((q, i) => {
              logSuspiciousObject(q, `render-quiz-question-${i}`);
              return {
                pregunta: extractTextSafely(q, `render-quiz-pregunta-${i}`, 'pregunta'),
                opciones: Array.isArray(q?.opciones) ? q.opciones.map((op, j) => ultraSafeStringify(op, `render-quiz-opcion-${i}-${j}`)) : [],
                respuestaCorrecta: ultraSafeStringify(q?.respuestaCorrecta, `render-quiz-respuesta-${i}`),
                puntaje: typeof q?.puntaje === 'number' ? q.puntaje : 1
              };
            }) : [];
            
            return (
              <div key={tipo} className="p-6 border rounded-lg bg-white shadow-sm">
                <h3 className="text-xl font-bold mb-4 text-slate-700">Quiz</h3>
                <div className="space-y-6">
                  {questions.map((q, qIndex) => (
                    <div key={qIndex} className="border-t pt-4 first:border-t-0 first:pt-0">
                      <p className="font-semibold text-slate-800">
                        {qIndex + 1}. <UltraSafeRenderer content={q.pregunta} context={`quiz-pregunta-${qIndex}`} />
                      </p>
                      <div className="mt-2 space-y-2">
                        {q.opciones.map((op, opIndex) => (
                          <label key={opIndex} className="flex items-center gap-3 p-3 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors has-[:checked]:bg-amber-100 has-[:checked]:font-semibold">
                            <input
                              type="radio"
                              name={`q-${tipo}-${qIndex}`}
                              value={op}
                              checked={userAnswers[tipo]?.[qIndex] === op}
                              onChange={() =>
                                handleAnswerChange(tipo, { ...(userAnswers[tipo] || {}), [qIndex]: op })
                              }
                              className="h-5 w-5 text-amber-500 focus:ring-amber-400 border-slate-300"
                            />
                            <span><UltraSafeRenderer content={op} context={`quiz-opcion-${qIndex}-${opIndex}`} /></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          case 'Comprensión de Lectura': {
            const lectura = ultraSafeNormalizeLectura(content);
            return (
              <div key={tipo} className="p-6 border rounded-lg bg-white shadow-sm">
                <h3 className="text-xl font-bold mb-4 text-slate-700">Comprensión de Lectura</h3>
                <div className="mb-6 p-4 rounded bg-slate-50 border whitespace-pre-wrap">
                  <UltraSafeRenderer content={lectura.texto} context="lectura-texto" />
                </div>
                <div className="space-y-6">
                  {lectura.preguntas.map((q, qIndex) => (
                    <div key={qIndex} className="border-t pt-4 first:border-t-0 first:pt-0">
                      <p className="font-semibold text-slate-800">
                        {qIndex + 1}. <UltraSafeRenderer content={q.pregunta} context={`lectura-pregunta-${qIndex}`} />
                      </p>
                      <div className="mt-2 space-y-2">
                        {q.opciones.map((op, opIndex) => (
                          <label key={opIndex} className="flex items-center gap-3 p-3 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors has-[:checked]:bg-amber-100 has-[:checked]:font-semibold">
                            <input
                              type="radio"
                              name={`q-${tipo}-${qIndex}`}
                              value={op}
                              checked={userAnswers[tipo]?.[qIndex] === op}
                              onChange={() =>
                                handleAnswerChange(tipo, { ...(userAnswers[tipo] || {}), [qIndex]: op })
                              }
                              className="h-5 w-5 text-amber-500 focus:ring-amber-400 border-slate-300"
                            />
                            <span><UltraSafeRenderer content={op} context={`lectura-opcion-${qIndex}-${opIndex}`} /></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          case 'Términos Pareados': {
            const pares = ultraSafeNormalizePareados(content as PareadosContent);
            const respuestas = (userAnswers[tipo] || {}) as Record<number, string>;
            const derechaBarajada = [...new Set(pares.map(p => p.derecha))];
            for (let i = derechaBarajada.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [derechaBarajada[i], derechaBarajada[j]] = [derechaBarajada[j], derechaBarajada[i]];
            }

            return (
              <div key={tipo} className="p-6 border rounded-lg bg-white shadow-sm">
                <h3 className="text-xl font-bold mb-4 text-slate-700">Términos Pareados</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {pares.map((p, i) => (
                    <div key={`${p.izquierda}-${i}`} className="p-3 rounded border bg-slate-50">
                      <p className="font-semibold text-slate-800 mb-2">
                        {i + 1}. <UltraSafeRenderer content={p.izquierda} context={`pareado-izq-${i}`} />
                      </p>
                      <select
                        className="w-full border rounded p-2 bg-white"
                        value={respuestas[i] ?? ''}
                        onChange={(e) =>
                          handleAnswerChange(tipo, { ...respuestas, [i]: e.target.value })
                        }
                      >
                        <option value="">— Selecciona la pareja —</option>
                        {derechaBarajada.map((d, idx) => (
                          <option key={idx} value={d}>
                            {ultraSafeStringify(d, `pareado-opcion-${i}-${idx}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          case 'Desarrollo': {
            const items = ultraSafeNormalizeDesarrollo(content as DesarrolloContentTeacher);
            const respuestas = (userAnswers[tipo] || {}) as Record<number, string>;

            return (
              <div key={tipo} className="p-6 border rounded-lg bg-white shadow-sm">
                <h3 className="text-xl font-bold mb-4 text-slate-700">Preguntas de Desarrollo</h3>
                <div className="space-y-6">
                  {items.map((p, i) => (
                    <div key={i} className="space-y-2">
                      <p className="font-semibold text-slate-800">
                        {i + 1}. <UltraSafeRenderer content={p.enunciado} context={`desarrollo-enunciado-${i}`} />
                      </p>
                      <textarea
                        className="w-full min-h-[120px] border rounded p-3"
                        placeholder="Escribe tu respuesta…"
                        value={respuestas[i] ?? ''}
                        onChange={(e) => handleAnswerChange(tipo, { ...respuestas, [i]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-slate-500">Este apartado será revisado y calificado por tu profesor/a.</p>
              </div>
            );
          }

          default:
            return null;
        }
      })}

      <div className="text-right mt-8 flex justify-end gap-4">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="bg-slate-800 text-white font-bold py-3 px-8 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 flex items-center justify-center min-w-[180px]"
        >
          {isLoading ? <SpinnerIcon className="w-5 h-5 mr-2" /> : null}
          {isLoading ? 'Evaluando...' : 'Entregar Actividad'}
        </button>
      </div>
    </div>
  );
};

// —— Componente principal MEJORADO —— //
interface AutoaprendizajeProps {
  currentUser: User;
}

const Autoaprendizaje: React.FC<AutoaprendizajeProps> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'activity' | 'result'>('list');
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [actividades, setActividades] = useState<ActividadRemota[]>([]);
  const [respuestas, setRespuestas] = useState<RespuestaEstudianteActividad[]>([]);
  const [selectedActividad, setSelectedActividad] = useState<ActividadRemota | null>(null);
  const [lastResult, setLastResult] = useState<RespuestaEstudianteActividad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  // MEJORADO: Estado de conexión más robusto
  useEffect(() => {
    console.log('🚀 Iniciando carga de datos para usuario:', currentUser.nombreCompleto);
    
    let actLoaded = false;
    let respLoaded = false;
    let actError = false;
    let respError = false;
    
    const checkCompletion = () => { 
      if ((actLoaded || actError) && (respLoaded || respError)) {
        if (actError && respError) {
          setConnectionStatus('error');
          setError('Error al cargar datos. Verifica tu conexión e intenta nuevamente.');
        } else {
          setConnectionStatus('connected');
        }
        setLoading(false);
        console.log('✅ Carga completada - Actividades:', actLoaded, 'Respuestas:', respLoaded);
      }
    };

    // SUSCRIPCIÓN A ACTIVIDADES con manejo de errores
    const unsubActividades = subscribeToActividadesDisponibles(
      currentUser, 
      (data) => {
        console.log('📋 Actividades recibidas:', data.length);
        data.forEach((act, i) => {
          console.log(`  ${i + 1}. ${act.asignatura} (ID: ${act.id})`);
          logSuspiciousObject(act, `actividad-${i}`);
        });
        setActividades(data);
        actLoaded = true;
        checkCompletion();
      },
      (error) => {
        console.error('❌ Error en suscripción de actividades:', error);
        actError = true;
        checkCompletion();
      }
    );

    // SUSCRIPCIÓN A RESPUESTAS con manejo de errores robusto
    const unsubRespuestas = subscribeToRespuestasEstudiante(
      currentUser.id, 
      (data) => {
        console.log('📝 Respuestas del estudiante recibidas:', data.length);
        data.forEach((resp, i) => {
          console.log(`  ${i + 1}. Actividad ${resp.actividadId} - Fecha: ${resp.fechaCompletado}`);
          // Comprobaciones seguras para evitar errores de tipos
          if ((resp as any).nota) {
            console.log(`    Nota: ${(resp as any).nota}`);
          }
          if ((resp as any).revisionDocente?.completada) {
            console.log(`    ✅ Con revisión docente completada`);
          }
          logSuspiciousObject(resp, `respuesta-${i}`);
        });
        
        setRespuestas(data);
        respLoaded = true;
        checkCompletion();
      },
      (error) => {
        console.error('❌ Error en suscripción de respuestas:', error);
        
        // Si es el error del índice, intentar consulta alternativa
        if (error.message?.includes('requires an index')) {
          console.log('⚠️ Detectado error de índice, intentando consulta alternativa...');
          setError('Se detectó un problema de configuración. Las actividades completadas pueden no mostrarse correctamente hasta que se resuelva.');
        }
        
        respError = true;
        checkCompletion();
      }
    );

    return () => { 
      console.log('🧹 Limpiando subscripciones');
      unsubActividades?.(); 
      unsubRespuestas?.(); 
    };
  }, [currentUser]);

  // MEJORADO: Monitoreo de cambios con menos verbosidad
  useEffect(() => {
    if (!loading) {
      console.log('🔄 ESTADO ACTUALIZADO:', {
        actividades: actividades.length,
        respuestas: respuestas.length,
        vista: view,
        conexion: connectionStatus
      });
    }
  }, [actividades.length, respuestas.length, view, connectionStatus, loading]);

  const handleStartActivity = (actividad: ActividadRemota) => {
    console.log('🔍 Iniciando actividad:', actividad.asignatura);
    
    // Verificar si la actividad ya ha sido completada anteriormente
    if (completedActivityIds.has(actividad.id)) {
      // Si ya fue completada, mostrar mensaje de error y no permitir iniciarla nuevamente
      setError("Esta actividad ya ha sido completada. No es posible realizarla nuevamente.");
      return;
    }
    
    setSelectedActividad(actividad);
    setView('activity');
    setError(null);
  };

  const handleViewResult = (respuesta: RespuestaEstudianteActividad) => {
    console.log('🔍 Viendo resultado:', respuesta.actividadId);
    const actividadOriginal = actividades.find(a => a.id === respuesta.actividadId);
    if (actividadOriginal) {
      setSelectedActividad(actividadOriginal);
      setLastResult(respuesta);
      setView('result');
      setError(null);
    } else {
      setError("No se pudieron cargar los detalles de esta actividad completada.");
    }
  };

  // MEJORADO: handleCompleteActivity con manejo robusto de errores
  const handleCompleteActivity = useCallback(async (submission: any, detailedFeedback: DetailedFeedback) => {
    if (!selectedActividad) return;

    console.log('🚀 COMPLETANDO ACTIVIDAD:', {
      actividadId: selectedActividad.id,
      estudianteId: currentUser.id,
      puntaje: submission.puntaje,
      nota: submission.nota
    });

    setView('result');
    setIsGeneratingFeedback(true);
    setError(null);

    const baseResult: Omit<RespuestaEstudianteActividad, 'id'> = {
      actividadId: selectedActividad.id,
      estudianteId: currentUser.id,
      fechaCompletado: new Date().toISOString(),
      ...submission,
      retroalimentacionDetallada: detailedFeedback,
    };
    
    console.log('💾 Guardando respuesta...');
    
    try {
      const finalResult = await saveRespuestaActivityWithFeedback(
        baseResult,
        selectedActividad,
        detailedFeedback
      );
      
      console.log('✅ Respuesta completada con ID:', finalResult.id);
      setLastResult(finalResult);
      
      // Pequeño delay para permitir que las suscripciones se actualicen
      setTimeout(() => {
        console.log('🔄 Datos sincronizados');
      }, 1500);
      
    } catch (err: any) {
      console.error("❌ Error crítico al completar actividad:", err);
      setError(
        "Ocurrió un error al guardar tu actividad. Por favor, intenta nuevamente. " +
        "Si el problema persiste, contacta a tu profesor."
      );
      
      // Intentar crear resultado mínimo para mostrar al usuario
      setLastResult({
        id: 'error-temp',
        ...baseResult,
        retroalimentacionAI: {
          logros: "Tu actividad fue completada pero hubo un problema técnico al generar el resumen.",
          desafios: [],
          comentariosDesarrollo: []
        }
      });
      
    } finally {
      setIsGeneratingFeedback(false);
    }
  }, [selectedActividad, currentUser.id]);

  // OPTIMIZADO: Cálculos con mejor manejo de errores
  // Esta función mantiene un registro de las actividades que ya han sido completadas
  const completedActivityIds = useMemo(() => {
    if (respuestas.length === 0) return new Set<string>();
    
    const ids = new Set(respuestas.map(r => r.actividadId));
    console.log('🎯 IDs completados calculados:', ids.size);
    return ids;
  }, [respuestas]);

  // Esta función filtra las actividades para mostrar solo las que NO han sido completadas
  const actividadesPendientes = useMemo(() => {
    if (actividades.length === 0) return [];
    
    // Solo muestra actividades que NO están en el conjunto de IDs completados
    const pendientes = actividades.filter(act => !completedActivityIds.has(act.id));
    console.log('⏳ Actividades pendientes:', pendientes.length);
    return pendientes;
  }, [actividades, completedActivityIds]);

  const actividadesCompletadas = useMemo(() => {
    if (respuestas.length === 0) return [];
    
    const completadas = respuestas
      .map(resp => {
        const actividad = actividades.find(a => a.id === resp.actividadId);
        return { 
          ...resp, 
          asignatura: actividad?.asignatura || 'Actividad no disponible', 
          tipos: actividad?.tipos || [] 
        };
      })
      .sort((a, b) => new Date(b.fechaCompletado).getTime() - new Date(a.fechaCompletado).getTime());
    
    console.log('📖 Historial preparado:', completadas.length);
    return completadas;
  }, [respuestas, actividades]);

  // ESTADOS DE CARGA Y ERROR
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <SpinnerIcon className="w-8 h-8 text-slate-500" />
        <div className="text-center">
          <p className="text-slate-500">Cargando actividades...</p>
          <p className="text-sm text-slate-400 mt-1">
            Estado: {connectionStatus === 'connecting' ? 'Conectando...' : 
                     connectionStatus === 'connected' ? 'Conectado' : 'Error de conexión'}
          </p>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'error' && actividades.length === 0 && respuestas.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-red-200 rounded-lg bg-red-50">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-red-700 mb-2">Error de Conexión</h3>
        <p className="text-red-600 mb-4">No se pudieron cargar las actividades.</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (view === 'activity' && selectedActividad) {
    return <ActivityPlayer actividad={selectedActividad} onComplete={handleCompleteActivity} currentUser={currentUser} />;
  }

  if (view === 'result' && lastResult) {
    console.log('🔍 Renderizando resultado:', lastResult);
    
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Resultados de la Actividad</h1>
        <div className="flex items-baseline gap-4 mb-6 p-4 bg-slate-50 rounded-lg border">
          <p className="text-lg text-slate-600">
            Puntaje: <span className="font-bold text-2xl text-slate-800">{lastResult.puntaje} / {lastResult.puntajeMaximo}</span>
          </p>
          <p className="text-lg text-slate-600">
            Nota: <span className={`font-bold text-2xl ${parseFloat(lastResult.nota) >= 4.0 ? 'text-green-600' : 'text-red-600'}`}>
              {lastResult.nota}
            </span>
          </p>
        </div>
        
        {/* Recursos adicionales en la vista de resultados */}
        {selectedActividad?.recursos && (
          <div className="mb-6 p-4 bg-sky-50 border border-sky-200 rounded-lg">
            <h2 className="text-lg font-bold text-sky-800 mb-2">Material complementario</h2>
            
            {selectedActividad.recursos.instrucciones && (
              <div className="mb-3">
                <h3 className="font-semibold text-sky-700">Instrucciones adicionales:</h3>
                <p className="text-slate-700 whitespace-pre-wrap">
                  <UltraSafeRenderer content={selectedActividad.recursos.instrucciones} context="resultado-instrucciones" />
                </p>
              </div>
            )}
            
            {selectedActividad.recursos.enlaces && (
              <div className="mb-3">
                <h3 className="font-semibold text-sky-700">Enlaces complementarios:</h3>
                <div className="space-y-1 mt-1">
                  {selectedActividad.recursos.enlaces.split('\n').filter(Boolean).map((enlace, idx) => (
                    <div key={idx} className="flex items-center">
                      <span className="text-sky-500 mr-2">🔗</span>
                      <a 
                        href={enlace.startsWith('http') ? enlace : `https://${enlace}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-800 hover:underline break-all"
                      >
                        {enlace}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {selectedActividad.recursos.archivos && selectedActividad.recursos.archivos.length > 0 && (
              <div>
                <h3 className="font-semibold text-sky-700">Archivos complementarios:</h3>
                <div className="space-y-1 mt-1">
                  {selectedActividad.recursos.archivos.map((archivo, idx) => (
                    <div key={idx} className="flex items-center">
                      <span className="text-sky-500 mr-2">📄</span>
                      <a 
                        href={archivo.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-800 hover:underline"
                      >
                        {archivo.nombre || `Archivo ${idx + 1}`}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium">⚠️ {error}</p>
          </div>
        )}

        {isGeneratingFeedback && (
          <div className="flex flex-col items-center justify-center p-6 bg-blue-50 border border-blue-200 rounded-lg text-center mb-6">
            <SpinnerIcon className="w-8 h-8 text-blue-500" />
            <p className="mt-3 font-semibold text-blue-700">Generando resumen personalizado...</p>
            <p className="mt-1 text-sm text-blue-600">Esto puede tomar unos segundos</p>
          </div>
        )}

        {lastResult.retroalimentacionAI && !isGeneratingFeedback && (
          <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg space-y-4 mb-6">
            <h2 className="text-2xl font-semibold text-blue-800">Resumen de tu Desempeño 💡</h2>
            <div>
              <h3 className="font-bold text-green-700">✅ Principales Logros</h3>
              <p className="text-slate-700 mt-1">
                <UltraSafeRenderer content={lastResult.retroalimentacionAI.logros} context="feedback-logros" />
              </p>
            </div>
            {lastResult.retroalimentacionAI.desafios?.length > 0 && (
              <div>
                <h3 className="font-bold text-amber-700">🎯 Áreas de Mejora</h3>
                <div className="space-y-3 mt-2">
                  {lastResult.retroalimentacionAI.desafios.map((d, i) => (
                    <div key={i} className="p-3 bg-white border rounded-md">
                      <p className="font-semibold text-slate-800">
                        <UltraSafeRenderer content={d.pregunta} context={`feedback-desafio-pregunta-${i}`} />
                      </p>
                      <p className="mt-2 text-sm text-slate-600 bg-slate-50 p-2 rounded">
                        <UltraSafeRenderer content={d.explicacionDelError} context={`feedback-desafio-explicacion-${i}`} />
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(lastResult.retroalimentacionAI as any)?.comentariosDesarrollo?.length > 0 && (
              <div>
                <h3 className="font-bold text-sky-700">📝 Retroalimentación de Desarrollo</h3>
                <div className="space-y-3 mt-2">
                  {(lastResult.retroalimentacionAI as any).comentariosDesarrollo.map((c: any, i: number) => (
                    <div key={i} className="p-3 bg-white border rounded-md">
                      <p className="font-semibold text-slate-800">
                        <UltraSafeRenderer content={c.pregunta} context={`feedback-desarrollo-pregunta-${i}`} />
                      </p>
                      <p className="mt-2 text-sm text-slate-600 bg-slate-50 p-2 rounded">
                        <UltraSafeRenderer content={c.retroalimentacionBreve} context={`feedback-desarrollo-retro-${i}`} />
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {lastResult.retroalimentacionDetallada && (
          <div className="space-y-4 mb-6">
            <h2 className="text-2xl font-semibold text-slate-700">Revisión Detallada</h2>
            {lastResult.retroalimentacionDetallada.items.map((item, index) => {
              const isPending = item.esCorrecta === null;
              const cardClass = isPending
                ? 'border-slate-400 bg-slate-50'
                : item.esCorrecta
                  ? 'border-green-500 bg-green-50'
                  : 'border-red-500 bg-red-50';
              const mark = isPending ? '🕓' : (item.esCorrecta ? '✅' : '❌');

              return (
                <div key={index} className={`p-4 border-l-4 rounded-r-lg ${cardClass}`}>
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-slate-800 flex-1 pr-4">
                      {index + 1}. <UltraSafeRenderer content={item.pregunta} context={`feedback-item-pregunta-${index}`} />
                    </p>
                    <span className="font-bold text-lg">{mark}</span>
                  </div>
                  <div className="mt-2 text-sm pl-4">
                    <p className="text-slate-700">
                      Tu respuesta: <span className="font-medium">
                        <UltraSafeRenderer content={item.respuestaUsuario} context={`feedback-item-respuesta-${index}`} />
                      </span>
                    </p>
                    {!isPending && !item.esCorrecta && (
                      <p className="text-slate-700">
                        Respuesta correcta: <span className="font-medium text-green-700">
                          <UltraSafeRenderer content={item.respuestaCorrecta} context={`feedback-item-correcta-${index}`} />
                        </span>
                      </p>
                    )}
                    {isPending && (
                      <p className="text-slate-600 italic">Pendiente de revisión docente.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => { 
              setView('list'); 
              setSelectedActividad(null); 
              setLastResult(null); 
              setError(null); 
            }}
            className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Volver a Actividades
          </button>
          {/* Se eliminó el botón "Repetir Actividad" para que los estudiantes no puedan repetir una actividad ya completada */}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-md space-y-10">
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800">⚠️ {error}</p>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Actividades Pendientes</h2>
        <p className="text-slate-500 mb-2">Completa las actividades asignadas por tus profesores.</p>
        <p className="text-amber-600 text-sm font-medium mb-6">
          <span className="bg-amber-100 p-1 rounded inline-flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Importante: Cada actividad solo puede ser respondida una vez.
          </span>
        </p>
        
        <div className="space-y-4">
          {actividadesPendientes.length > 0 ? (
            actividadesPendientes.map(act => (
              <div key={act.id} className="p-4 border rounded-lg bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-100 transition-colors">
                <div>
                  <p className="font-bold text-slate-800">
                    <UltraSafeRenderer content={act.asignatura} context={`actividad-asignatura-${act.id}`} /> - {act.tipos.join(', ')}
                  </p>
                  <p className="text-sm text-slate-500">
                    Plazo: <UltraSafeRenderer content={typeof act.plazoEntrega === 'string' ? act.plazoEntrega : ''} context={`actividad-plazo-${act.id}`} />
                  </p>
                </div>
                <button
                  onClick={() => handleStartActivity(act)}
                  className="bg-amber-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-600 w-full sm:w-auto transition-colors"
                >
                  Comenzar
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-semibold text-slate-700">¡Todo al día!</h3>
              <p className="text-slate-500 mt-1">No tienes actividades pendientes.</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Historial de Actividades</h2>
        <p className="text-slate-500 mb-6">Revisa tus resultados y la retroalimentación de las actividades completadas.</p>
        <div className="space-y-4">
          {actividadesCompletadas.length > 0 ? (
            actividadesCompletadas.map(resp => (
              <div key={resp.id} className="p-4 border rounded-lg bg-white flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div>
                  <p className="font-bold text-slate-800">
                    <UltraSafeRenderer content={resp.asignatura} context={`completada-asignatura-${resp.id}`} /> - {resp.tipos.join(', ')}
                  </p>
                  <p className="text-sm text-slate-500">
                    Completado: {new Date(resp.fechaCompletado).toLocaleDateString('es-CL')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-semibold">
                    Nota: <span className={`font-bold text-lg ${parseFloat(resp.nota) >= 4.0 ? 'text-green-600' : 'text-red-600'}`}>
                      {resp.nota}
                    </span>
                  </p>
                  <button
                    onClick={() => handleViewResult(resp)}
                    className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 w-full sm:w-auto transition-colors"
                  >
                    Ver Resultados
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-slate-700">Aún no hay historial</h3>
              <p className="text-slate-500 mt-1">Tus actividades completadas aparecerán aquí.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Autoaprendizaje;