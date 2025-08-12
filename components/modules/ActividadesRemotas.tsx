import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  FormEvent,
  ChangeEvent,
} from 'react';
import {
  ActividadRemota,
  RespuestaEstudianteActividad,
  TipoActividadRemota,
  QuizQuestion,
  PareadoItem,
  User,
  Profile,
  ArchivoAdjuntoRecurso,
  PruebaEstandarizada,
} from '../../types';
import {
  ASIGNATURAS,
  NIVELES,
  TIPOS_ACTIVIDAD_REMOTA,
  CURSOS,
} from '../../constants';

import {
  subscribeToActividades,
  subscribeToRespuestas,
  subscribeToAllUsers,
  createPruebaEstandarizada,
  subscribeToPruebasEstandarizadas,
  updateRespuestaActividadDocente,
  saveActividadFromPreview,
  calcularNota60,
} from '../../src/firebaseHelpers/actividadesRemotasHelper';

import { GoogleGenerativeAI as GoogleGenAI } from '@google/generative-ai';

/* ============================================================
   Helpers de UI
============================================================ */
const formatDateOnly = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('es-CL') : '';
const formatDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('es-CL') : '';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = (err) => reject(err);
  });

// —— Funciones auxiliares ULTRA seguras para evitar React error #31 —— //
const logSuspiciousObject = (obj: any, context: string) => {
  if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    const keys = Object.keys(obj);
    if (keys.some(key => 
      key.includes('punto') || key.includes('Punto') || 
      key.includes('Factor') || key.includes('factor') ||
      key.includes('Criterio') || key.includes('criterio') ||
      key.includes('Aspecto') || key.includes('aspecto')
    )) {
      console.warn(`🚨 OBJETO SOSPECHOSO EN ${context}:`, obj);
      console.warn('Keys:', keys);
    }
  }
};

const ultraSafeStringify = (value: any, context?: string): string => {
  if (context) logSuspiciousObject(value, context);
  
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(item => ultraSafeStringify(item, `${context}-array-item`)).join(', ');
    }
    
    // Detectar rúbricas y objetos de evaluación
    const keys = Object.keys(value);
    if (keys.some(key => 
      key.includes('punto') || key.includes('Punto') || 
      key.includes('Factor') || key.includes('factor') ||
      key.includes('Criterio') || key.includes('criterio')
    )) {
      return '[Rúbrica de evaluación]';
    }
    
    // Si es un objeto, intentamos extraer propiedades de texto conocidas
    const textFields = [
      'texto', 'contenido', 'descripcion', 'valor', 'name', 'title', 'label',
      'pregunta', 'enunciado', 'respuesta', 'opcion', 'concepto', 'definicion'
    ];
    
    for (const field of textFields) {
      if (value[field] && typeof value[field] === 'string') {
        return value[field];
      }
    }
    
    // Último recurso: convertir a JSON de forma segura
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
  
  // Primero intentamos con los campos especificados
  for (const field of fields) {
    if (item[field]) {
      const result = ultraSafeStringify(item[field], `${context}-${field}`);
      if (result && result !== '[Objeto complejo]' && result !== '[Objeto no serializable]') {
        return result;
      }
    }
  }
  
  // Si es un string directamente
  if (typeof item === 'string') return item;
  
  // Si nada funciona, devolvemos algo seguro
  return '[Sin contenido disponible]';
};

// —— Componente ULTRA seguro para renderizar cualquier cosa —— //
const UltraSafeRenderer = ({ content, context = 'unknown' }: { content: any; context?: string }) => {
  try {
    const safeText = ultraSafeStringify(content, `UltraSafeRenderer-${context}`);
    return <span>{safeText}</span>;
  } catch (error) {
    console.error('Error in UltraSafeRenderer:', error, 'Content:', content);
    return <span>[Error al mostrar contenido]</span>;
  }
};

/* ============================================================
   Constantes de generación IA
============================================================ */
const ITEM_QUANTITIES: Record<TipoActividadRemota, number[]> = {
  Quiz: [5, 10, 15],
  'Términos Pareados': [5, 10, 15],
  Desarrollo: [1, 2, 3],
  'Comprensión de Lectura': [1, 2, 3, 4, 5],
};

const HABILIDADES_SIMCE = [
  'Localizar información',
  'Interpretar y relacionar',
  'Reflexionar',
  'Extraer información explícita',
  'Realizar inferencias',
  'Interpretar el sentido global del texto',
  'Evaluar contenido y forma',
];

/* ============================================================
   Componente principal
============================================================ */
const ActividadesRemotas: React.FC = () => {
  // Datos
  const [actividades, setActividades] = useState<ActividadRemota[]>([]);
  const [pruebasEstandarizadas, setPruebasEstandarizadas] = useState<PruebaEstandarizada[]>([]);
  const [respuestas, setRespuestas] = useState<RespuestaEstudianteActividad[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // UI/flujo
  const [selectedActividad, setSelectedActividad] = useState<ActividadRemota | null>(null);
  const [selectedPrueba, setSelectedPrueba] = useState<PruebaEstandarizada | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingPrueba, setIsCreatingPrueba] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [previewData, setPreviewData] = useState<ActividadRemota | null>(null);
  const [previewPrueba, setPreviewPrueba] = useState<PruebaEstandarizada | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<'actividades' | 'pruebas'>('actividades');

  // Revisión docente (Desarrollo)
  const [revisionTarget, setRevisionTarget] = useState<RespuestaEstudianteActividad | null>(null);
  const [revisionDetalle, setRevisionDetalle] = useState<Array<{ index: number; puntaje: number; observacion?: string }>>([]);
  const [revisionObsGeneral, setRevisionObsGeneral] = useState('');

  // Form: actividad
  const initialFormState: Omit<
    ActividadRemota,
    'id' | 'fechaCreacion' | 'generatedContent' | 'introduccion'
  > = {
    asignatura: ASIGNATURAS[0],
    nivel: NIVELES[0],
    contenido: '',
    plazoEntrega: new Date().toISOString().split('T')[0],
    tipos: [],
    cantidadPreguntas: {},
    cursosDestino: [],
    estudiantesDestino: [],
    recursos: { instrucciones: '', enlaces: '', archivos: [] },
  };
  const [formData, setFormData] = useState(initialFormState);

  // Form: prueba estandarizada
  const initialPruebaState: Omit<
    PruebaEstandarizada,
    'id' | 'fechaCreacion' | 'preguntas' | 'titulo' | 'instrucciones' | 'textos'
  > = {
    asignatura: ASIGNATURAS[0],
    nivel: NIVELES[0],
    contenido: '',
    objetivosAprendizaje: '',
    plazoEntrega: new Date().toISOString().split('T')[0],
    cursosDestino: [],
    estudiantesDestino: [],
    duracionMinutos: 90,
  };
  const [pruebaFormData, setPruebaFormData] = useState(initialPruebaState);

  /* ---------------------- Subscriptions ---------------------- */
  useEffect(() => {
    setDataLoading(true);
    const unsubActividades = subscribeToActividades(setActividades);
    const unsubPruebas = subscribeToPruebasEstandarizadas(setPruebasEstandarizadas);
    const unsubRespuestas = subscribeToRespuestas(setRespuestas);
    const unsubUsers = subscribeToAllUsers((users) => {
      setAllUsers(users);
      setDataLoading(false);
    });
    return () => {
      unsubActividades();
      unsubPruebas();
      unsubRespuestas();
      unsubUsers();
    };
  }, []);

  /* ---------------------- Handlers básicos ---------------------- */
  const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handlePruebaFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setPruebaFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleRecursoChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      recursos: { ...prev.recursos, [e.target.name]: e.target.value },
    }));
  };
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(Array.from(e.target.files));
  };
  const handleTipoChange = (tipo: TipoActividadRemota) => {
    setFormData((prev) => {
      const newTipos = prev.tipos.includes(tipo) ? prev.tipos.filter((t) => t !== tipo) : [...prev.tipos, tipo];
      const newCantidades = { ...prev.cantidadPreguntas };
      if (newTipos.includes(tipo)) {
        if (!newCantidades[tipo]) newCantidades[tipo] = ITEM_QUANTITIES[tipo][0];
      } else {
        delete newCantidades[tipo];
      }
      return { ...prev, tipos: newTipos, cantidadPreguntas: newCantidades };
    });
  };
  const handleQuantityChange = (tipo: TipoActividadRemota, cantidad: number) => {
    setFormData((prev) => ({
      ...prev,
      cantidadPreguntas: { ...prev.cantidadPreguntas, [tipo]: cantidad },
    }));
  };
  const handleCursoDestinoChange = (curso: string, isPrueba = false) => {
    const updater = isPrueba ? setPruebaFormData : setFormData;
    updater((prev: any) => {
      const current = prev.cursosDestino || [];
      const newCursos = current.includes(curso) ? current.filter((c: string) => c !== curso) : [...current, curso];
      return { ...prev, cursosDestino: newCursos };
    });
  };
  const handleEstudianteDestinoChange = (nombre: string, isPrueba = false) => {
    const updater = isPrueba ? setPruebaFormData : setFormData;
    updater((prev: any) => {
      const current = prev.estudiantesDestino || [];
      const newEst = current.includes(nombre) ? current.filter((n: string) => n !== nombre) : [...current, nombre];
      return { ...prev, estudiantesDestino: newEst };
    });
  };

  /* ---------------------- Prompts IA ---------------------- */
  const buildPrompt = () => {
    const { tipos, contenido, asignatura, nivel, cantidadPreguntas } = formData;
    let prompt = `Eres un experto diseñador de actividades pedagógicas. Genera un objeto JSON que se ajuste al esquema, sin texto adicional.

Contenido base: "${contenido}"
Asignatura: ${asignatura}
Nivel: ${nivel}

Genera los siguientes elementos:
- introduccion: breve y motivadora
- actividades: objeto con propiedades por tipo:\n`;
    tipos.forEach((tipo) => {
      const cantidad = cantidadPreguntas[tipo] || ITEM_QUANTITIES[tipo][0];
      switch (tipo) {
        case 'Quiz':
          prompt += `- "Quiz": Array de ${cantidad} objetos { pregunta, opciones[4], respuestaCorrecta, puntaje(1) }\n`;
          break;
        case 'Comprensión de Lectura':
          prompt += `- "Comprensión de Lectura": Objeto { texto(150-200 palabras), preguntas: Array de ${cantidad} { pregunta, opciones[4], respuestaCorrecta, puntaje } }\n`;
          break;
        case 'Términos Pareados':
          prompt += `- "Términos Pareados": Array de ${cantidad} { concepto, definicion }\n`;
          break;
        case 'Desarrollo':
          prompt += `- "Desarrollo": Array de ${cantidad} { pregunta, rubrica }\n`;
          break;
      }
    });
    return prompt;
  };

  const buildPruebaPrompt = () => {
    const { contenido, objetivosAprendizaje, asignatura, nivel } = pruebaFormData;
    return `Eres experto en evaluación educativa y diseño de pruebas SIMCE.
Responde SOLO con JSON válido.

INFORMACIÓN:
- Asignatura: ${asignatura}
- Nivel: ${nivel}
- Contenido: ${contenido}
- Objetivos: ${objetivosAprendizaje}

{
  "titulo": "Título",
  "instrucciones": "Instrucciones",
  "textos": [
    {
      "id": 1,
      "titulo": "Título del texto",
      "contenido": "200-300 palabras",
      "tipo": "narrativo",
      "palabras": 250
    }
  ],
  "preguntas": [
    {
      "numero": 1,
      "pregunta": "Enunciado",
      "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "respuestaCorrecta": "A",
      "habilidad": "Localizar información",
      "justificacion": "Breve explicación",
      "textoId": 1
    }
  ]
}

Reglas:
- ${asignatura === 'Lenguaje y Comunicación' || asignatura === 'Lengua y Literatura' ? '3-4 textos de distintos tipos' : '2-3 textos informativos'}
- Exactamente 30 preguntas numeradas 1..30
- 4 opciones por pregunta (A-D)
- Habilidades válidas: ${HABILIDADES_SIMCE.join(', ')}
- Para preguntas basadas en textos: incluir "textoId"
- Sin comentarios fuera del JSON`;
  };

  /* ---------------------- Adaptación de contenido IA ULTRA SEGURA ---------------------- */
  function ultraSafeAutoAdaptContent(tipo: TipoActividadRemota, content: any) {
    console.log(`🔍 Adaptando contenido para ${tipo}:`, content);
    logSuspiciousObject(content, `autoAdaptContent-${tipo}`);
    
    if (tipo === 'Desarrollo') {
      if (Array.isArray(content)) {
        return content.map((item, index) => {
          logSuspiciousObject(item, `desarrollo-item-${index}`);
          
          if (typeof item === 'string') {
            const match = item.match(/^(.*?)(?:R[úu]brica:|RUBRICA:|Rubrica:)(.*)$/is);
            if (match) {
              return { 
                pregunta: extractTextSafely(match[1], `desarrollo-pregunta-${index}`), 
                rubrica: extractTextSafely(match[2], `desarrollo-rubrica-${index}`) 
              };
            }
            return { 
              pregunta: extractTextSafely(item, `desarrollo-pregunta-simple-${index}`), 
              rubrica: '' 
            };
          }
          
          if (item && typeof item === 'object') {
            // CRÍTICO: Aquí puede estar el problema - la rúbrica puede ser un objeto complejo
            const preguntaText = extractTextSafely(item, `desarrollo-obj-pregunta-${index}`, 'pregunta', 'Pregunta', 'texto');
            let rubricaText = '';
            
            if (item.rubrica || item.Rubrica || item['rúbrica'] || item['Rúbrica']) {
              const rubricaValue = item.rubrica || item.Rubrica || item['rúbrica'] || item['Rúbrica'];
              rubricaText = ultraSafeStringify(rubricaValue, `desarrollo-rubrica-${index}`);
            }
            
            return {
              pregunta: preguntaText,
              rubrica: rubricaText,
            };
          }
          
          return { 
            pregunta: ultraSafeStringify(item, `desarrollo-fallback-${index}`), 
            rubrica: '' 
          };
        });
      }
    }
    
    if (tipo === 'Términos Pareados') {
      if (Array.isArray(content)) {
        return content.map((it, idx) => {
          logSuspiciousObject(it, `pareados-item-${idx}`);
          
          if (typeof it === 'string') {
            const m = it.match(/^(.+?)[\s:-–]+(.+)$/);
            if (m) {
              return { 
                id: idx, 
                concepto: extractTextSafely(m[1], `pareados-concepto-${idx}`), 
                definicion: extractTextSafely(m[2], `pareados-definicion-${idx}`) 
              };
            }
            return { 
              id: idx, 
              concepto: extractTextSafely(it, `pareados-concepto-simple-${idx}`), 
              definicion: '' 
            };
          }
          
          if (it && typeof it === 'object') {
            return {
              id: idx,
              concepto: extractTextSafely(it, `pareados-obj-concepto-${idx}`, 'concepto', 'termino'),
              definicion: extractTextSafely(it, `pareados-obj-definicion-${idx}`, 'definicion', 'significado'),
            };
          }
          
          return { 
            id: idx, 
            concepto: ultraSafeStringify(it, `pareados-fallback-${idx}`), 
            definicion: '' 
          };
        });
      }
    }
    
    if (tipo === 'Comprensión de Lectura') {
      logSuspiciousObject(content, 'comprension-lectura-input');
      
      if (content && typeof content === 'object' && !Array.isArray(content) && Array.isArray(content.preguntas)) {
        return {
          texto: extractTextSafely(content, 'comprension-texto', 'texto'),
          preguntas: content.preguntas.map((q: any, i: number) => {
            logSuspiciousObject(q, `comprension-pregunta-${i}`);
            return {
              pregunta: extractTextSafely(q, `comprension-pregunta-${i}`, 'pregunta'),
              opciones: Array.isArray(q.opciones) ? q.opciones.map((op: any, j: number) => 
                ultraSafeStringify(op, `comprension-opcion-${i}-${j}`)
              ) : [],
              respuestaCorrecta: ultraSafeStringify(q.respuestaCorrecta, `comprension-respuesta-${i}`),
              puntaje: typeof q.puntaje === 'number' ? q.puntaje : 1,
            };
          }),
        };
      }
      
      if (Array.isArray(content)) {
        const combinedText = content.map((c, i) => extractTextSafely(c, `comprension-bloque-${i}`, 'texto')).join('\n\n---\n\n');
        const combinedQuestions = content.flatMap((c, i) => {
          logSuspiciousObject(c, `comprension-bloque-preguntas-${i}`);
          return Array.isArray(c.preguntas) ? c.preguntas : [];
        });
        
        return {
          texto: combinedText,
          preguntas: combinedQuestions.map((q: any, i: number) => {
            logSuspiciousObject(q, `comprension-combined-pregunta-${i}`);
            return {
              pregunta: extractTextSafely(q, `comprension-combined-pregunta-${i}`, 'pregunta'),
              opciones: Array.isArray(q.opciones) ? q.opciones.map((op: any, j: number) => 
                ultraSafeStringify(op, `comprension-combined-opcion-${i}-${j}`)
              ) : [],
              respuestaCorrecta: ultraSafeStringify(q.respuestaCorrecta, `comprension-combined-respuesta-${i}`),
              puntaje: typeof q.puntaje === 'number' ? q.puntaje : 1,
            };
          }),
        };
      }
    }
    
    if (tipo === 'Quiz' && Array.isArray(content)) {
      return content.map((q, i) => {
        logSuspiciousObject(q, `quiz-item-${i}`);
        return { 
          pregunta: extractTextSafely(q, `quiz-pregunta-${i}`, 'pregunta'),
          opciones: Array.isArray(q.opciones) ? q.opciones.map((op: any, j: number) => 
            ultraSafeStringify(op, `quiz-opcion-${i}-${j}`)
          ) : [],
          respuestaCorrecta: ultraSafeStringify(q.respuestaCorrecta, `quiz-respuesta-${i}`),
          puntaje: typeof q.puntaje === 'number' ? q.puntaje : 1 
        };
      });
    }
    
    return content;
  }

  /* ---------------------- IA: Generar previsualización actividad ---------------------- */
  const handleGeneratePreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.contenido.trim() || formData.tipos.length === 0) {
      setError('Contenido y al menos un tipo de actividad son obligatorios.');
      return;
    }
    setIsGenerating(true);
    setError(null);

    try {
      const processedFiles: ArchivoAdjuntoRecurso[] = await Promise.all(
        selectedFiles.map(async (file) => ({
          nombre: file.name,
          url: await fileToBase64(file),
        }))
      );

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('No se encontró la API Key de Gemini.');

      const ai = new GoogleGenAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      const prompt = buildPrompt();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = await response.text();
      text = text.replace(/```json\s*/gi, '').replace(/```\s*$/g, '');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('La IA no devolvió JSON válido.');
      
      const generatedData = JSON.parse(jsonMatch[0]);
      console.log('🔍 Datos generados por IA:', generatedData);
      logSuspiciousObject(generatedData, 'generated-data');

      const adaptedContent: Record<string, any> = {};
      for (const tipo of formData.tipos) {
        const rawContent = generatedData.actividades?.[tipo];
        console.log(`🔍 Contenido crudo para ${tipo}:`, rawContent);
        logSuspiciousObject(rawContent, `raw-content-${tipo}`);
        
        adaptedContent[tipo] = ultraSafeAutoAdaptContent(tipo, rawContent);
        
        console.log(`🔍 Contenido adaptado para ${tipo}:`, adaptedContent[tipo]);
        logSuspiciousObject(adaptedContent[tipo], `adapted-content-${tipo}`);
      }

      const newActividad: ActividadRemota = {
        id: '',
        fechaCreacion: new Date().toISOString(),
        ...formData,
        recursos: { ...formData.recursos, archivos: processedFiles },
        introduccion: ultraSafeStringify(generatedData.introduccion, 'introduccion') || 'Actividad generada para reforzar el aprendizaje.',
        generatedContent: adaptedContent,
      };

      console.log('🔍 Actividad final:', newActividad);
      logSuspiciousObject(newActividad, 'new-actividad');

      setPreviewData(newActividad);
    } catch (e: any) {
      setError(`Error al generar la actividad: ${e?.message || e}`);
    } finally {
      setIsGenerating(false);
    }
  };

  /* ---------------------- IA: Generar previsualización prueba ---------------------- */
  const handleGeneratePruebaPreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!pruebaFormData.contenido.trim() || !pruebaFormData.objetivosAprendizaje.trim()) {
      setError('Contenido y objetivos de aprendizaje son obligatorios.');
      return;
    }
    setIsGenerating(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('No se encontró la API Key de Gemini.');

      const ai = new GoogleGenAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      const prompt = buildPruebaPrompt();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = await response.text();
      text = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*$/g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No se encontró JSON válido en la respuesta.');

      const jsonText = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
      const generatedData = JSON.parse(jsonText);

      if (!generatedData.preguntas || !Array.isArray(generatedData.preguntas)) {
        throw new Error('La respuesta de la IA no contiene un array de preguntas válido');
      }

      const textosValidos = (generatedData.textos || []).map((tx: any, idx: number) => ({
        id: tx.id || idx + 1,
        titulo: ultraSafeStringify(tx.titulo, `texto-titulo-${idx}`) || `Texto ${idx + 1}`,
        contenido: ultraSafeStringify(tx.contenido, `texto-contenido-${idx}`) || 'Contenido no disponible',
        tipo: ['narrativo', 'informativo', 'argumentativo', 'poetico'].includes(tx.tipo) ? tx.tipo : 'informativo',
        palabras: tx.palabras || (tx.contenido ? String(tx.contenido).split(' ').length : 0),
      }));

      const preguntasValidas = generatedData.preguntas.slice(0, 30).map((p: any, idx: number) => ({
        numero: p.numero || idx + 1,
        pregunta: ultraSafeStringify(p.pregunta, `pregunta-${idx}`) || `Pregunta ${idx + 1}`,
        opciones: Array.isArray(p.opciones) && p.opciones.length >= 4 ? p.opciones.slice(0, 4).map((op: any, i: number) => ultraSafeStringify(op, `pregunta-opcion-${idx}-${i}`)) : ['A', 'B', 'C', 'D'],
        respuestaCorrecta: ['A', 'B', 'C', 'D'].includes(p.respuestaCorrecta) ? p.respuestaCorrecta : 'A',
        habilidad: HABILIDADES_SIMCE.includes(p.habilidad) ? p.habilidad : HABILIDADES_SIMCE[0],
        justificacion: ultraSafeStringify(p.justificacion, `justificacion-${idx}`) || 'Justificación no disponible',
        ...(p.textoId && typeof p.textoId === 'number' ? { textoId: p.textoId } : {}),
      }));

      const newPrueba: PruebaEstandarizada = {
        id: '',
        fechaCreacion: new Date().toISOString(),
        ...pruebaFormData,
        titulo: ultraSafeStringify(generatedData.titulo, 'prueba-titulo') || `Prueba ${pruebaFormData.asignatura}`,
        instrucciones: ultraSafeStringify(generatedData.instrucciones, 'prueba-instrucciones') || 'Lee y responde.',
        textos: textosValidos,
        preguntas: preguntasValidas,
      };

      setPreviewPrueba(newPrueba);
    } catch (e: any) {
      setError(`Error al generar la prueba: ${e?.message || e}`);
    } finally {
      setIsGenerating(false);
    }
  };

  /* ---------------------- Guardar actividad (sube archivos) ---------------------- */
  const handleConfirmAndSave = async () => {
    if (!previewData) return;
    try {
      setIsSaving(true);
      await saveActividadFromPreview(previewData); // maneja Data URLs -> Storage
      setFormData(initialFormState);
      setSelectedFiles([]);
      setIsCreating(false);
      setPreviewData(null);
    } catch (err) {
      console.error('Error al guardar la actividad con archivos:', err);
      setError('No se pudo guardar la actividad. Revisa los archivos adjuntos.');
    } finally {
      setIsSaving(false);
    }
  };

  /* ---------------------- Guardar prueba ---------------------- */
  const handleConfirmAndSavePrueba = async () => {
    if (!previewPrueba) return;
    try {
      setIsSaving(true);
      const pruebaToSave: PruebaEstandarizada = {
        ...previewPrueba,
        cursosDestino: previewPrueba.cursosDestino || [],
        estudiantesDestino: previewPrueba.estudiantesDestino || [],
        textos: previewPrueba.textos || [],
        preguntas: previewPrueba.preguntas.map((p) => ({ ...p, textoId: p.textoId || null })),
      };
      await createPruebaEstandarizada(pruebaToSave);
      setPruebaFormData(initialPruebaState);
      setIsCreatingPrueba(false);
      setPreviewPrueba(null);
    } catch (err) {
      console.error('Error al guardar la prueba:', err);
      setError('No se pudo guardar la prueba.');
    } finally {
      setIsSaving(false);
    }
  };

  /* ---------------------- Selecciones / cálculos ---------------------- */
  const estudiantesAsignados = useMemo((): User[] => {
    const actividad = selectedActividad || selectedPrueba;
    if (!actividad || !allUsers.length) return [];
    const mapa = new Map<string, User>();
    if (!actividad.cursosDestino?.length && !actividad.estudiantesDestino?.length) {
      const nivelNum = actividad.nivel.charAt(0);
      allUsers
        .filter((u) => u.profile === Profile.ESTUDIANTE && u.curso?.startsWith(nivelNum))
        .forEach((u) => mapa.set(u.id, u));
    } else {
      if (actividad.cursosDestino?.length) {
        allUsers
          .filter((u) => u.profile === Profile.ESTUDIANTE && actividad.cursosDestino.includes(u.curso || ''))
          .forEach((u) => mapa.set(u.id, u));
      }
      if (actividad.estudiantesDestino?.length) {
        allUsers
          .filter((u) => u.profile === Profile.ESTUDIANTE && actividad.estudiantesDestino.includes(u.nombreCompleto))
          .forEach((u) => mapa.set(u.id, u));
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }, [selectedActividad, selectedPrueba, allUsers]);

  const resultadosDeActividad = useMemo(() => {
    const actividadId = selectedActividad?.id || selectedPrueba?.id;
    return respuestas.filter((r) => r.actividadId === actividadId);
  }, [respuestas, selectedActividad, selectedPrueba]);

  const students = useMemo(
    () => allUsers.filter((u) => u.profile === Profile.ESTUDIANTE).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)),
    [allUsers]
  );
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    return students.filter((s) => s.nombreCompleto.toLowerCase().includes(studentSearch.toLowerCase()));
  }, [students, studentSearch]);

  /* ============================================================
     Render
  ============================================================ */
  const renderTabs = () => (
    <div className="flex space-x-1 mb-6">
      <button
        onClick={() => setActiveTab('actividades')}
        className={`px-4 py-2 rounded-lg font-semibold ${
          activeTab === 'actividades' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
        }`}
      >
        Actividades Remotas
      </button>
      <button
        onClick={() => setActiveTab('pruebas')}
        className={`px-4 py-2 rounded-lg font-semibold ${
          activeTab === 'pruebas' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
        }`}
      >
        Pruebas Estandarizadas
      </button>
    </div>
  );

  const renderActivityView = () => (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            {selectedActividad ? (
              <>
                <UltraSafeRenderer content={selectedActividad.asignatura} context="actividad-asignatura" /> - {selectedActividad.tipos.join(', ')}
              </>
            ) : (
              <UltraSafeRenderer content={selectedPrueba?.titulo || 'Prueba Estandarizada'} context="prueba-titulo" />
            )}
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Nivel: {selectedActividad?.nivel || selectedPrueba?.nivel} | Plazo:{' '}
            {formatDateOnly(selectedActividad?.plazoEntrega || selectedPrueba?.plazoEntrega)}
            {selectedPrueba && ` | Duración: ${selectedPrueba.duracionMinutos} min`}
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedActividad(null);
            setSelectedPrueba(null);
          }}
          className="text-slate-600 hover:text-slate-900 font-semibold"
        >
          &larr; Volver al listado
        </button>
      </div>

      <div className="mt-6 border-t dark:border-slate-700 pt-6">
        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-4">Resultados de Estudiantes</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Puntaje</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nota</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha Completado</th>
                {selectedActividad?.tipos?.includes('Desarrollo') && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {estudiantesAsignados.map((estudiante) => {
                const resultado = resultadosDeActividad.find((r) => r.estudianteId === estudiante.id);
                return (
                  <tr key={estudiante.id}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                      {estudiante.nombreCompleto}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {resultado ? (
                        <span className="px-2 py-1 font-semibold text-xs rounded-full bg-green-100 text-green-800">Completado</span>
                      ) : (
                        <span className="px-2 py-1 font-semibold text-xs rounded-full bg-yellow-100 text-yellow-800">Pendiente</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                      {resultado ? `${resultado.puntaje}/${resultado.puntajeMaximo}` : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold">
                      {resultado ? (
                        <span className={parseFloat(resultado.nota) >= 4.0 ? 'text-green-600' : 'text-red-600'}>
                          {resultado.nota}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                      {resultado ? formatDateTime(resultado.fechaCompletado) : '-'}
                    </td>
                    {selectedActividad?.tipos?.includes('Desarrollo') && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {resultado ? (
                          <button
                            onClick={() => {
                              setRevisionTarget(resultado);
                              // inicializar detalle con 0s si no hay
                              const devItems: Array<{ index: number; puntaje: number; observacion?: string }> =
                                Array.from({ length: (selectedActividad.generatedContent?.['Desarrollo']?.length || 0) }, (_, i) => ({
                                  index: i,
                                  puntaje: 0,
                                  observacion: '',
                                }));
                              setRevisionDetalle(devItems);
                              setRevisionObsGeneral(resultado?.revisionDocente?.observacionesGenerales || '');
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            Revisar Desarrollo
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Revisión Desarrollo */}
      {revisionTarget && selectedActividad?.tipos?.includes('Desarrollo') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">Revisión de Desarrollo — {revisionTarget?.estudianteNombre || ''}</h3>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              {(selectedActividad.generatedContent?.['Desarrollo'] || []).map(
                (item: { pregunta: string; rubrica?: string }, idx: number) => {
                  console.log(`🔍 Renderizando item desarrollo ${idx}:`, item);
                  logSuspiciousObject(item, `revision-item-${idx}`);
                  
                  return (
                    <div key={idx} className="p-3 border rounded-lg">
                      <p className="font-semibold">
                        {idx + 1}. <UltraSafeRenderer content={item.pregunta} context={`revision-pregunta-${idx}`} />
                      </p>
                      {item.rubrica && (
                        <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                          <strong>Rúbrica:</strong> <UltraSafeRenderer content={item.rubrica} context={`revision-rubrica-${idx}`} />
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-3">
                        <label className="text-sm text-slate-700">Puntaje:</label>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={revisionDetalle[idx]?.puntaje ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setRevisionDetalle((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...(copy[idx] || { index: idx, puntaje: 0 }), puntaje: val };
                              return copy;
                            });
                          }}
                          className="w-24 border-slate-300 rounded-md"
                        />
                        <input
                          type="text"
                          placeholder="Observación (opcional)"
                          value={revisionDetalle[idx]?.observacion || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRevisionDetalle((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...(copy[idx] || { index: idx, puntaje: 0 }), observacion: val };
                              return copy;
                            });
                          }}
                          className="flex-1 border-slate-300 rounded-md"
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones Generales</label>
              <textarea
                rows={3}
                value={revisionObsGeneral}
                onChange={(e) => setRevisionObsGeneral(e.target.value)}
                className="w-full border-slate-300 rounded-md"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setRevisionTarget(null);
                  setRevisionDetalle([]);
                  setRevisionObsGeneral('');
                }}
                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!revisionTarget) return;
                  try {
                    setIsSavingReview(true);

                    // 1) Puntaje autocorregido y máximo existentes
                    const puntajeAuto = Number(revisionTarget.puntaje) || 0;
                    const puntajeMaximo = Number(revisionTarget.puntajeMaximo) || 0;

                    // 2) Puntaje docente (solo desarrollo)
                    const puntajeDocente = (revisionDetalle || []).reduce(
                      (acc, d) => acc + (Number(d.puntaje) || 0),
                      0
                    );

                    // 3) Total y nota nueva
                    const nuevoPuntajeTotal = puntajeAuto + puntajeDocente;
                    const nuevaNota = calcularNota60(nuevoPuntajeTotal, puntajeMaximo);

                    // 4) Persistir
                    await updateRespuestaActividadDocente(revisionTarget.id, {
                      puntaje: nuevoPuntajeTotal,
                      puntajeMaximo,
                      nota: nuevaNota,
                      revisionDocente: {
                        completada: true,
                        observacionesGenerales: revisionObsGeneral || '',
                        detalle: revisionDetalle || [],
                        puntajeDocente,
                      },
                    });

                    // 5) Reset
                    setRevisionTarget(null);
                    setRevisionDetalle([]);
                    setRevisionObsGeneral('');
                  } catch (e) {
                    console.error('Error guardando revisión:', e);
                    setError('No se pudo guardar la revisión del docente.');
                  } finally {
                    setIsSavingReview(false);
                  }
                }}
                disabled={isSavingReview}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-400"
              >
                {isSavingReview ? 'Guardando...' : 'Guardar Revisión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCreationForm = () => (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Nueva Actividad Remota</h2>
        <button onClick={() => setIsCreating(false)} className="text-slate-600 hover:text-slate-900 font-semibold">
          &larr; Volver al listado
        </button>
      </div>
      <p className="text-slate-500 mt-1 mb-6">Complete el formulario y la IA generará una actividad.</p>

      <form onSubmit={handleGeneratePreview} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Asignatura</label>
            <select
              name="asignatura"
              value={formData.asignatura}
              onChange={handleFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm"
            >
              {ASIGNATURAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nivel</label>
            <select
              name="nivel"
              value={formData.nivel}
              onChange={handleFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm"
            >
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 p-4 border rounded-lg space-y-4 bg-slate-50 dark:bg-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Recursos (Opcional)</h3>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Instrucciones</label>
              <textarea
                name="instrucciones"
                value={formData.recursos?.instrucciones}
                onChange={handleRecursoChange}
                rows={3}
                className="w-full border-slate-300 rounded-md shadow-sm"
                placeholder="Ej: Lee y luego responde..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Enlaces</label>
              <textarea
                name="enlaces"
                value={formData.recursos?.enlaces}
                onChange={handleRecursoChange}
                rows={3}
                className="w-full border-slate-300 rounded-md shadow-sm"
                placeholder="Pega un enlace por línea..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Adjuntar archivos</label>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
              />
            </div>
          </div>

          <div className="md:col-span-2 p-4 border rounded-lg space-y-4 bg-slate-50 dark:bg-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Destinatarios</h3>
            <p className="text-sm text-slate-500">
              Si no seleccionas nada, será visible para todo el nivel.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Cursos</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-40 overflow-y-auto p-2 bg-white rounded">
                {CURSOS.map((curso) => (
                  <label key={curso} className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.cursosDestino?.includes(curso)}
                      onChange={() => handleCursoDestinoChange(curso)}
                      className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span className="text-sm font-medium text-slate-700">{curso}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Estudiantes</label>
              <input
                type="text"
                placeholder="Buscar..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full border-slate-300 rounded-md shadow-sm mb-2"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-2 bg-white rounded">
                {filteredStudents.map((student) => (
                  <label key={student.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.estudiantesDestino?.includes(student.nombreCompleto)}
                      onChange={() => handleEstudianteDestinoChange(student.nombreCompleto)}
                      className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span className="text-sm font-medium text-slate-700 truncate" title={student.nombreCompleto}>
                      {student.nombreCompleto}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-2">Tipos de Actividad</label>
            <div className="space-y-3">
              {TIPOS_ACTIVIDAD_REMOTA.map((tipo) => (
                <div key={tipo} className="p-3 border rounded-lg has-[:checked]:bg-amber-50 has-[:checked]:border-amber-300">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.tipos.includes(tipo)}
                      onChange={() => handleTipoChange(tipo)}
                      className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span className="text-sm font-medium text-slate-700 flex-grow">{tipo}</span>
                  </label>
                  {formData.tipos.includes(tipo) && (
                    <div className="mt-3 pl-8 flex items-center gap-2">
                      <span className="text-xs text-slate-500">Cantidad:</span>
                      {ITEM_QUANTITIES[tipo].map((qty) => (
                        <button
                          type="button"
                          key={qty}
                          onClick={() => handleQuantityChange(tipo, qty)}
                          className={`px-3 py-1 rounded-full font-semibold text-xs ${
                            formData.cantidadPreguntas[tipo] === qty ? 'bg-amber-500 text-white' : 'bg-slate-200'
                          }`}
                        >
                          {qty}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="contenido" className="block text-sm font-medium text-slate-600 mb-1">
              Contenido <span className="text-red-500">*</span>
            </label>
            <textarea
              name="contenido"
              value={formData.contenido}
              onChange={handleFieldChange}
              required
              rows={4}
              placeholder="Temas, conceptos clave o texto base..."
              className="w-full border-slate-300 rounded-md shadow-sm"
            />
          </div>

          <div>
            <label htmlFor="plazoEntrega" className="block text-sm font-medium text-slate-600 mb-1">
              Plazo de Entrega
            </label>
            <input
              type="date"
              name="plazoEntrega"
              value={formData.plazoEntrega}
              onChange={handleFieldChange}
              required
              className="w-full border-slate-300 rounded-md shadow-sm"
            />
          </div>
        </div>

        {error && <p className="text-red-600 bg-red-100 p-3 rounded-md mt-4">{error}</p>}

        <div className="pt-4 text-right">
          <button
            type="submit"
            disabled={isGenerating}
            className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 flex items-center justify-center min-w-[180px]"
          >
            {isGenerating ? 'Generando...' : 'Generar y Previsualizar'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderPreview = () => (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
      <h2 className="text-2xl font-bold text-slate-800">Previsualización de la Actividad</h2>
      <p className="text-slate-500 mt-1 mb-6">Revisa el contenido generado. Si todo está correcto, confirma para asignar.</p>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto p-4 bg-slate-50 rounded-lg border">
        <div className="p-4 bg-sky-50 border-l-4 border-sky-400 rounded-r-lg">
          <h3 className="font-bold text-sky-800 mb-2">Introducción para el Estudiante</h3>
          <p className="text-slate-700 whitespace-pre-wrap">
            <UltraSafeRenderer content={previewData?.introduccion} context="preview-introduccion" />
          </p>
        </div>

        {previewData?.recursos && (previewData.recursos.instrucciones || previewData.recursos.enlaces || previewData.recursos.archivos?.length) && (
          <div className="p-4 bg-indigo-50 border-l-4 border-indigo-400 rounded-r-lg">
            <h3 className="font-bold text-indigo-800 mb-2">Recursos de Aprendizaje</h3>
            <div className="space-y-3">
              {previewData.recursos.instrucciones && (
                <p className="text-slate-700 whitespace-pre-wrap">
                  <UltraSafeRenderer content={previewData.recursos.instrucciones} context="preview-instrucciones" />
                </p>
              )}
              {previewData.recursos.enlaces && (
                <div>
                  {previewData.recursos.enlaces
                    .split('\n')
                    .map((link, i) => link.trim() && (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline truncate">
                        {link}
                      </a>
                    ))}
                </div>
              )}
              {previewData.recursos.archivos && previewData.recursos.archivos.length > 0 && (
                <ul className="list-disc list-inside">
                  {previewData.recursos.archivos.map((file) => (
                    <li key={file.nombre} className="text-slate-700">
                      {file.nombre}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {previewData?.tipos.map((tipo) => {
          const content = (previewData as any).generatedContent[tipo];
          console.log(`🔍 Renderizando preview para ${tipo}:`, content);
          logSuspiciousObject(content, `preview-${tipo}`);
          
          if (!content) return null;
          return (
            <div key={tipo} className="p-4 border rounded-lg bg-white">
              <h3 className="text-xl font-bold mb-4">{tipo}</h3>
              <div className="space-y-4 text-sm">
                {tipo === 'Quiz' &&
                  Array.isArray(content) &&
                  content.map((q: QuizQuestion, i: number) => {
                    logSuspiciousObject(q, `preview-quiz-${i}`);
                    return (
                      <div key={i} className="border-t pt-3 first:border-t-0">
                        <p className="font-semibold">
                          {i + 1}. <UltraSafeRenderer content={q.pregunta} context={`preview-quiz-pregunta-${i}`} />
                        </p>
                        <ul className="list-none pl-5 mt-2 space-y-1">
                          {q.opciones.map((o: string, idx: number) => (
                            <li key={idx}>
                              <strong>{String.fromCharCode(65 + idx)}.</strong> <UltraSafeRenderer content={o} context={`preview-quiz-opcion-${i}-${idx}`} />
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-green-600 font-semibold mt-2 p-1 bg-green-50 rounded inline-block">
                          R: <UltraSafeRenderer content={q.respuestaCorrecta} context={`preview-quiz-respuesta-${i}`} />
                        </p>
                      </div>
                    );
                  })}

                {tipo === 'Comprensión de Lectura' &&
                  content &&
                  typeof content === 'object' &&
                  'preguntas' in content &&
                  Array.isArray(content.preguntas) && (
                    <div>
                      <p className="whitespace-pre-wrap bg-slate-100 p-3 rounded-md mb-4">
                        <UltraSafeRenderer content={content.texto} context="preview-lectura-texto" />
                      </p>
                      {content.preguntas.map((q: QuizQuestion, i: number) => {
                        logSuspiciousObject(q, `preview-lectura-pregunta-${i}`);
                        return (
                          <div key={i} className="border-t pt-3 first:border-t-0">
                            <p className="font-semibold">
                              {i + 1}. <UltraSafeRenderer content={q.pregunta} context={`preview-lectura-pregunta-${i}`} />
                            </p>
                            <ul className="list-none pl-5 mt-2 space-y-1">
                              {q.opciones.map((o: string, idx: number) => (
                                <li key={idx}>
                                  <strong>{String.fromCharCode(65 + idx)}.</strong> <UltraSafeRenderer content={o} context={`preview-lectura-opcion-${i}-${idx}`} />
                                </li>
                              ))}
                            </ul>
                            <p className="text-xs text-green-600 font-semibold mt-2 p-1 bg-green-50 rounded inline-block">
                              R: <UltraSafeRenderer content={q.respuestaCorrecta} context={`preview-lectura-respuesta-${i}`} />
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                {tipo === 'Términos Pareados' && Array.isArray(content) && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-slate-200">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left font-semibold p-2 border-b">Concepto</th>
                          <th className="text-left font-semibold p-2 border-b">Definición</th>
                        </tr>
                      </thead>
                      <tbody>
                        {content.map((p: PareadoItem, i: number) => {
                          logSuspiciousObject(p, `preview-pareado-${i}`);
                          return (
                            <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50">
                              <td className="p-2 align-top font-semibold text-slate-800">
                                <UltraSafeRenderer content={p.concepto} context={`preview-pareado-concepto-${i}`} />
                              </td>
                              <td className="p-2 align-top text-slate-700">
                                <UltraSafeRenderer content={p.definicion} context={`preview-pareado-definicion-${i}`} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {tipo === 'Desarrollo' &&
                  Array.isArray(content) &&
                  content.map((d: any, i: number) => {
                    console.log(`🔍 Renderizando desarrollo ${i}:`, d);
                    logSuspiciousObject(d, `preview-desarrollo-${i}`);
                    return (
                      <div key={i} className="border-t pt-3 first:border-t-0">
                        <p className="font-semibold">
                          {i + 1}. <UltraSafeRenderer content={d.pregunta} context={`preview-desarrollo-pregunta-${i}`} />
                        </p>
                        <p className="text-sm text-slate-600 mt-2 p-2 bg-slate-100 rounded-md">
                          <strong className="font-semibold">Rúbrica:</strong> <UltraSafeRenderer content={d.rubrica} context={`preview-desarrollo-rubrica-${i}`} />
                        </p>
                      </div>
                    );
                  })}

                {((tipo === 'Quiz' || tipo === 'Términos Pareados' || tipo === 'Desarrollo') && !Array.isArray(content)) && (
                  <div className="text-red-600 text-sm p-3 bg-red-50 border border-red-200 rounded-md">
                    El contenido para <strong>{tipo}</strong> no tiene el formato esperado.
                  </div>
                )}
                {tipo === 'Comprensión de Lectura' &&
                  (!content || typeof content !== 'object' || !Array.isArray((content as any).preguntas)) && (
                    <div className="text-red-600 text-sm p-3 bg-red-50 border border-red-200 rounded-md">
                      El contenido de <strong>Comprensión de Lectura</strong> no tiene el formato esperado.
                    </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-6 flex justify-end gap-4">
        <button onClick={() => setPreviewData(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300">
          Cancelar
        </button>
        <button
          onClick={handleConfirmAndSave}
          disabled={isSaving}
          className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-green-400"
        >
          {isSaving ? 'Guardando...' : 'Confirmar y Asignar'}
        </button>
      </div>
    </div>
  );

  const renderActivityList = () => (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Actividades Remotas</h1>
        <button onClick={() => setIsCreating(true)} className="bg-amber-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-amber-600">
          Crear Nueva
        </button>
      </div>

      <div className="space-y-4">
        {actividades.length > 0 ? (
          actividades.map((act) => {
            logSuspiciousObject(act, `lista-actividad-${act.id}`);
            const destinations: string[] = [];
            if (act.cursosDestino?.length) destinations.push(`Cursos: ${act.cursosDestino.join(', ')}`);
            if (act.estudiantesDestino?.length) destinations.push(`Estudiantes: ${act.estudiantesDestino.length}`);
            const destinationText = destinations.length ? destinations.join(' | ') : `Todo ${act.nivel}`;
            return (
              <div key={act.id} className="p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800">
                      <UltraSafeRenderer content={act.asignatura} context={`lista-asignatura-${act.id}`} /> — {act.tipos.join(', ')}
                    </p>
                    <p className="text-sm text-slate-500">
                      Destino: {destinationText} | Creado: {formatDateOnly(act.fechaCreacion)}
                    </p>
                  </div>
                  <button onClick={() => setSelectedActividad(act)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">
                    Ver Resultados
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-slate-500 text-center py-6">No hay actividades creadas. Use "Crear Nueva".</p>
        )}
      </div>
    </div>
  );

  const renderPruebaCreationForm = () => (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Nueva Prueba Estandarizada</h2>
        <button onClick={() => setIsCreatingPrueba(false)} className="text-slate-600 hover:text-slate-900 font-semibold">
          &larr; Volver
        </button>
      </div>

      <form onSubmit={handleGeneratePruebaPreview} className="space-y-6 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Asignatura</label>
            <select
              name="asignatura"
              value={pruebaFormData.asignatura}
              onChange={handlePruebaFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm"
            >
              {ASIGNATURAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nivel</label>
            <select
              name="nivel"
              value={pruebaFormData.nivel}
              onChange={handlePruebaFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm"
            >
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">Objetivos de Aprendizaje</label>
            <textarea
              name="objetivosAprendizaje"
              value={pruebaFormData.objetivosAprendizaje}
              onChange={handlePruebaFieldChange}
              rows={3}
              className="w-full border-slate-300 rounded-md shadow-sm"
              placeholder="Describe OA o contenidos evaluados..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">Contenido Base</label>
            <textarea
              name="contenido"
              value={pruebaFormData.contenido}
              onChange={handlePruebaFieldChange}
              rows={4}
              className="w-full border-slate-300 rounded-md shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Plazo de Entrega</label>
            <input
              type="date"
              name="plazoEntrega"
              value={pruebaFormData.plazoEntrega}
              onChange={handlePruebaFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm"
            />
          </div>
        </div>

        {error && <p className="text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}

        <div className="text-right">
          <button
            type="submit"
            disabled={isGenerating}
            className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 disabled:bg-slate-400"
          >
            {isGenerating ? 'Generando...' : 'Generar y Previsualizar'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderPruebaPreview = () => (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
      <h2 className="text-2xl font-bold text-slate-800">Previsualización Prueba</h2>
      <p className="text-slate-500 mt-1 mb-6">Revisa y confirma.</p>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto p-4 bg-slate-50 rounded-lg border">
        <div className="p-4 bg-sky-50 border-l-4 border-sky-400 rounded-r-lg">
          <h3 className="font-bold text-sky-800 mb-2">
            <UltraSafeRenderer content={previewPrueba?.titulo} context="preview-prueba-titulo" />
          </h3>
          <p className="text-slate-700 whitespace-pre-wrap">
            <UltraSafeRenderer content={previewPrueba?.instrucciones} context="preview-prueba-instrucciones" />
          </p>
        </div>

        {previewPrueba?.textos?.length ? (
          <div className="p-4 bg-indigo-50 border-l-4 border-indigo-400 rounded-r-lg">
            <h3 className="font-bold text-indigo-800 mb-2">Textos</h3>
            <ol className="space-y-2 list-decimal list-inside">
              {previewPrueba.textos.map((t, i) => {
                logSuspiciousObject(t, `preview-texto-${i}`);
                return (
                  <li key={t.id}>
                    <p className="font-semibold">
                      <UltraSafeRenderer content={t.titulo} context={`preview-texto-titulo-${i}`} /> 
                      <span className="text-xs text-slate-500">({t.tipo})</span>
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">
                      <UltraSafeRenderer content={t.contenido} context={`preview-texto-contenido-${i}`} />
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

        {previewPrueba?.preguntas?.length ? (
          <div className="p-4 border rounded-lg bg-white">
            <h3 className="text-xl font-bold mb-4">Preguntas (muestra)</h3>
            {previewPrueba.preguntas.slice(0, 10).map((p, i) => {
              logSuspiciousObject(p, `preview-pregunta-${i}`);
              return (
                <div key={p.numero} className="border-t pt-3 first:border-t-0">
                  <p className="font-semibold">
                    {p.numero}. <UltraSafeRenderer content={p.pregunta} context={`preview-pregunta-texto-${i}`} />
                  </p>
                  <ul className="list-disc pl-6 text-sm mt-1">
                    {p.opciones.map((o: string, j: number) => (
                      <li key={j}>
                        <UltraSafeRenderer content={o} context={`preview-pregunta-opcion-${i}-${j}`} />
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-green-600 font-semibold mt-1">Correcta: {p.respuestaCorrecta}</p>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="pt-6 flex justify-end gap-4">
        <button onClick={() => setPreviewPrueba(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300">
          Cancelar
        </button>
        <button
          onClick={handleConfirmAndSavePrueba}
          disabled={isSaving}
          className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-green-400"
        >
          {isSaving ? 'Guardando...' : 'Confirmar y Asignar'}
        </button>
      </div>
    </div>
  );

  const renderPruebasList = () => (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Pruebas Estandarizadas</h1>
        <button onClick={() => setIsCreatingPrueba(true)} className="bg-amber-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-amber-600">
          Crear Nueva
        </button>
      </div>

      <div className="space-y-4">
        {pruebasEstandarizadas.length > 0 ? (
          pruebasEstandarizadas.map((p) => {
            logSuspiciousObject(p, `lista-prueba-${p.id}`);
            return (
              <div key={p.id} className="p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800">
                      <UltraSafeRenderer content={p.titulo} context={`lista-prueba-titulo-${p.id}`} />
                    </p>
                    <p className="text-sm text-slate-500">
                      Nivel: {p.nivel} | Creado: {formatDateOnly(p.fechaCreacion)}
                    </p>
                  </div>
                  <button onClick={() => setSelectedPrueba(p)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">
                    Ver Resultados
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-slate-500 text-center py-6">No hay pruebas creadas.</p>
        )}
      </div>
    </div>
  );

  if (dataLoading) return <div className="text-center py-10">Cargando datos...</div>;

  return (
    <div className="animate-fade-in">
      {renderTabs()}
      {previewPrueba
        ? renderPruebaPreview()
        : previewData
        ? renderPreview()
        : selectedActividad || selectedPrueba
        ? renderActivityView()
        : activeTab === 'pruebas'
        ? isCreatingPrueba
          ? renderPruebaCreationForm()
          : renderPruebasList()
        : isCreating
        ? renderCreationForm()
        : renderActivityList()}
    </div>
  );
};

export default ActividadesRemotas;