// components/modules/ActividadesRemotas.tsx
import React, {
  useState,
  useEffect,
  useMemo,
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
  TIPOS_ACTIVIDAD_REMOTA,
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
  updateActividad,
} from '../../src/firebaseHelpers/actividadesRemotasHelper';
import { auth } from '../../src/firebase';



// Íconos Lucide
import {
  FolderOpen,
  FileText,
  CheckCircle2,
  Clock,
  Search,
  User as UserIcon,
  ArrowLeft,
  PlusCircle,
  BarChart2,
} from 'lucide-react';

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
type TabKey = 'carpetas' | 'actividades' | 'pruebas' | 'gestion';

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
  const [activeTab, setActiveTab] = useState<TabKey>('carpetas');
  // Filtros nueva vista Gestión
  const [filtroAsignatura, setFiltroAsignatura] = useState<string>('Todas');
  const [filtroNivel, setFiltroNivel] = useState<string>('Todos');
  // Reasignación
  const [reasignandoActividad, setReasignandoActividad] = useState<ActividadRemota | null>(null);
  const [reasignEstudiantes, setReasignEstudiantes] = useState<string[]>([]);
  const [isReassignSaving, setIsReassignSaving] = useState(false);

  // NUEVO: carpeta/historial por estudiante
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

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
    // nivel y cursosDestino se mantienen en el modelo pero NO se piden por UI
    nivel: '—', 
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
    nivel: '—',
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
    let prompt = `Eres un experto diseñador de actividades pedagógicas con énfasis en la Taxonomía de Bloom y metodologías activas de aprendizaje. Genera un objeto JSON que se ajuste al esquema, sin texto adicional.

Contenido base: "${contenido}"
Asignatura: ${asignatura}
Nivel educativo: ${nivel}

REQUISITOS PEDAGÓGICOS:
1. Asegura que las preguntas sean claras, concisas y libres de ambigüedades
2. Distribuye las preguntas según Taxonomía de Bloom: 20% conocimiento, 30% comprensión, 30% aplicación, 20% análisis/evaluación 
3. Evita preguntas demasiado simples o demasiado complejas para el nivel educativo
4. Incluye contextos reales y aplicaciones prácticas cuando sea posible
5. Para múltiple opción, todas las opciones deben ser plausibles (no incluir opciones obviamente incorrectas)
6. Las rúbricas de desarrollo deben incluir criterios específicos y niveles de desempeño claros
7. En comprensión lectora, genera textos originales y preguntas de distinta complejidad cognitiva

Genera los siguientes elementos:
- introduccion: breve y motivadora que contextualice el aprendizaje
- panelDidactico: Un objeto JSON con la siguiente estructura:
  {
    "titulo": "Título descriptivo del tema central",
    "subtitulos": [
      {
        "titulo": "Primer subtítulo",
        "texto": "Explicación detallada (80-120 palabras) con ejemplos y definiciones"
      },
      {
        "titulo": "Segundo subtítulo",
        "texto": "Explicación detallada (80-120 palabras) con ejemplos y definiciones"
      },
      {
        "titulo": "Tercer subtítulo (opcional)",
        "texto": "Explicación detallada (80-120 palabras) con ejemplos y definiciones"
      }
    ],
    "conceptosClave": [
      "Concepto 1: breve definición",
      "Concepto 2: breve definición",
      "Concepto 3: breve definición"
    ]
  }
  En total debe tener entre 300-500 palabras con contenido educativo detallado que explique los conceptos clave del tema, incluya ejemplos claros y conocimiento esencial que el estudiante necesita para responder las actividades.
- actividades: objeto con propiedades por tipo:\n`;
    
    tipos.forEach((tipo) => {
      const cantidad = cantidadPreguntas[tipo] || ITEM_QUANTITIES[tipo][0];
      switch (tipo) {
        case 'Quiz':
          prompt += `- "Quiz": Array de ${cantidad} objetos { 
  pregunta: clara y contextualizada,
  opciones: array de 4 alternativas plausibles con opciones de distinta dificultad,
  respuestaCorrecta: la opción correcta (no ambigua),
  puntaje: 1 para cada pregunta
}\n`;
          break;
        case 'Comprensión de Lectura':
          prompt += `- "Comprensión de Lectura": Objeto { 
  texto: texto original de 200-300 palabras adaptado al nivel con información relevante,
  preguntas: Array de ${cantidad} objetos {
    pregunta: enfocadas en distintos niveles de comprensión (literal, inferencial y crítica),
    opciones: array de 4 alternativas plausibles sin pistas obvias,
    respuestaCorrecta: la opción correcta basada en el texto,
    puntaje: 1 para cada pregunta
  }
}\n`; 
          break;
        case 'Términos Pareados':
          prompt += `- "Términos Pareados": Array de ${cantidad} objetos {
  concepto: término clave del contenido, claro y específico,
  definicion: explicación precisa y única que no sea ambigua
}\n`;
          break;
        case 'Desarrollo':
          prompt += `- "Desarrollo": Array de ${cantidad} objetos {
  pregunta: pregunta que fomente el pensamiento crítico y la aplicación de conocimientos,
  rubrica: criterios de evaluación detallados con niveles de desempeño específicos (sobresaliente, adecuado, en desarrollo, inicial)
}\n`;
          break;
      }
    });
    
    // Agregar ejemplos de alta calidad para cada tipo de actividad
    prompt += "\nEJEMPLOS DE ALTA CALIDAD POR TIPO:\n";
    
    if (tipos.includes('Quiz')) {
      prompt += `
Quiz de ejemplo: {
  "pregunta": "En el contexto de la función fotosintética de las plantas, ¿qué ocurriría si una planta se expone a luz con longitudes de onda exclusivamente verdes?",
  "opciones": [
    "La planta aumentaría su tasa fotosintética debido a la mayor disponibilidad de luz",
    "La planta moriría inmediatamente por exceso de radiación",
    "La tasa fotosintética disminuiría significativamente ya que el pigmento clorofila refleja la luz verde",
    "No habría cambios en la fotosíntesis porque las plantas no dependen del espectro luminoso"
  ],
  "respuestaCorrecta": "La tasa fotosintética disminuiría significativamente ya que el pigmento clorofila refleja la luz verde",
  "puntaje": 1
}\n`;
    }
    
    if (tipos.includes('Comprensión de Lectura')) {
      prompt += `
Comprensión de Lectura de ejemplo: {
  "texto": "La revolución industrial transformó profundamente las estructuras sociales y económicas de Europa durante el siglo XIX. El paso de una economía agraria y artesanal a una dominada por la industria y la manufactura mecanizada significó cambios sin precedentes en las condiciones laborales. Las jornadas extenuantes de 14-16 horas, el trabajo infantil y la falta de seguridad caracterizaron los primeros años de industrialización. No obstante, este periodo también representó un aumento en la producción de bienes, mejoras en el transporte y comunicaciones, y eventualmente, el surgimiento de una clase media con mayor acceso a productos manufacturados. Estos cambios sentaron las bases para movimientos obreros que, con el tiempo, lograron mejoras significativas en los derechos laborales que persisten hasta la actualidad.",
  "preguntas": [
    {
      "pregunta": "Según el texto, ¿cuál fue una consecuencia negativa inmediata de la revolución industrial?",
      "opciones": [
        "El desplome de los sistemas de transporte",
        "Las extenuantes jornadas laborales de 14-16 horas",
        "La disminución en la producción de bienes manufacturados",
        "La eliminación de la clase media europea"
      ],
      "respuestaCorrecta": "Las extenuantes jornadas laborales de 14-16 horas",
      "puntaje": 1
    }
  ]
}\n`;
    }
    
    return prompt;
  };

  const buildPruebaPrompt = () => {
    const { contenido, objetivosAprendizaje, asignatura, nivel } = pruebaFormData;
    return `Eres un experto pedagogo especializado en evaluación educativa y diseño de pruebas estandarizadas tipo SIMCE.
Responde EXCLUSIVAMENTE con JSON válido según la estructura solicitada.

INFORMACIÓN CURRICULAR:
- Asignatura: ${asignatura}
- Nivel educativo: ${nivel}
- Contenido principal: ${contenido}
- Objetivos de Aprendizaje: ${objetivosAprendizaje}

REQUISITOS PEDAGÓGICOS:
1. Genera preguntas equilibradas en dificultad: 25% básicas, 50% intermedias, 25% avanzadas
2. Usa contextos reales y significativos para los estudiantes
3. Distribuye las habilidades cognitivas de manera equilibrada según taxonomía SIMCE
4. Las preguntas deben evaluar aprendizajes significativos, no memorización de detalles irrelevantes
5. Los distractores (opciones incorrectas) deben ser plausibles y revelar concepciones erróneas comunes
6. Los textos deben ser originales, apropiados para el nivel, y con complejidad adecuada
7. Las preguntas deben evaluar distintos niveles de comprensión y aplicación

FORMATO REQUERIDO:
{
  "titulo": "Título descriptivo de la prueba",
  "instrucciones": "Instrucciones claras y detalladas para los estudiantes",
  "textos": [
    {
      "id": 1,
      "titulo": "Título representativo del texto",
      "contenido": "Texto original y apropiado de 250-350 palabras con complejidad adecuada al nivel",
      "tipo": "narrativo/informativo/argumentativo/poetico",
      "palabras": 300
    }
  ],
  "preguntas": [
    {
      "numero": 1,
      "pregunta": "Enunciado claro que evalúe una habilidad específica",
      "opciones": ["Alternativa correcta", "Distractor plausible 1", "Distractor plausible 2", "Distractor plausible 3"],
      "respuestaCorrecta": "A",
      "habilidad": "Habilidad SIMCE específica que evalúa",
      "justificacion": "Explicación pedagógica de por qué es correcta y los errores conceptuales en los distractores",
      "textoId": 1
    }
  ]
}

REQUISITOS ESPECÍFICOS:
- ${asignatura === 'Lenguaje y Comunicación' || asignatura === 'Lengua y Literatura' ? 
  '3-4 textos de distintos tipos (narrativo, informativo, argumentativo y/o poético) con temáticas complementarias' : 
  '2-3 textos informativos con contenido relevante para el objetivo de aprendizaje'}
- Exactamente 30 preguntas numeradas del 1 al 30
- 4 opciones por pregunta (A-D) con una única respuesta correcta
- Habilidades a evaluar según SIMCE: ${HABILIDADES_SIMCE.join(', ')}
- Para preguntas basadas en textos: incluir el "textoId" correspondiente
- Sin comentarios, explicaciones ni marcas fuera de la estructura JSON

IMPORTANTE: Generar un instrumento de evaluación de ALTA CALIDAD que pueda ser usado directamente en un contexto escolar real.`;
  };

  /* ---------------------- Adaptación de contenido IA ULTRA SEGURA ---------------------- */
  function ultraSafeAutoAdaptContent(tipo: TipoActividadRemota, content: any) {
    if (tipo === 'Desarrollo') {
      if (Array.isArray(content)) {
        return content.map((item, index) => {
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
      if (content && typeof content === 'object' && !Array.isArray(content) && Array.isArray(content.preguntas)) {
        return {
          texto: extractTextSafely(content, 'comprension-texto', 'texto'),
          preguntas: content.preguntas.map((q: any, i: number) => ({
            pregunta: extractTextSafely(q, `comprension-pregunta-${i}`, 'pregunta'),
            opciones: Array.isArray(q.opciones) ? q.opciones.map((op: any) => ultraSafeStringify(op, `comprension-opcion-${i}`)) : [],
            respuestaCorrecta: ultraSafeStringify(q.respuestaCorrecta, `comprension-respuesta-${i}`),
            puntaje: typeof q.puntaje === 'number' ? q.puntaje : 1,
          })),
        };
      }
      
      if (Array.isArray(content)) {
        const combinedText = content.map((c, i) => extractTextSafely(c, `comprension-bloque-${i}`, 'texto')).join('\n\n---\n\n');
        const combinedQuestions = content.flatMap((c) => (Array.isArray(c.preguntas) ? c.preguntas : []));
        
        return {
          texto: combinedText,
          preguntas: combinedQuestions.map((q: any, i: number) => ({
            pregunta: extractTextSafely(q, `comprension-combined-pregunta-${i}`, 'pregunta'),
            opciones: Array.isArray(q.opciones) ? q.opciones.map((op: any) => ultraSafeStringify(op, `comprension-combined-opcion-${i}`)) : [],
            respuestaCorrecta: ultraSafeStringify(q.respuestaCorrecta, `comprension-combined-respuesta-${i}`),
            puntaje: typeof q.puntaje === 'number' ? q.puntaje : 1,
          })),
        };
      }
    }
    
    if (tipo === 'Quiz' && Array.isArray(content)) {
      return content.map((q, i) => ({
        pregunta: extractTextSafely(q, `quiz-pregunta-${i}`, 'pregunta'),
        opciones: Array.isArray(q.opciones) ? q.opciones.map((op: any) => ultraSafeStringify(op, `quiz-opcion-${i}`)) : [],
        respuestaCorrecta: ultraSafeStringify(q.respuestaCorrecta, `quiz-respuesta-${i}`),
        puntaje: typeof q.puntaje === 'number' ? q.puntaje : 1,
      }));
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


      // Lógica Gemini movida al backend. Llama a un endpoint seguro:
      const prompt = buildPrompt();
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/generarActividadRemota', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, formData, selectedFiles })
      });
      if (!response.ok) throw new Error('Error al generar la actividad con IA');
      const generatedData = await response.json();

      const adaptedContent: Record<string, any> = {};
      for (const tipo of formData.tipos) {
        const rawContent = generatedData.actividades?.[tipo];
        adaptedContent[tipo] = ultraSafeAutoAdaptContent(tipo, rawContent);
      }

      // Procesar el panel didáctico de manera especial para evitar truncamiento
      let panelContent = '';
      if (generatedData.panelDidactico) {
        panelContent = typeof generatedData.panelDidactico === 'string' 
          ? generatedData.panelDidactico 
          : JSON.stringify(generatedData.panelDidactico);
      }

      const newActividad: ActividadRemota = {
        id: '',
        fechaCreacion: new Date().toISOString(),
        ...formData,
        recursos: { ...formData.recursos, archivos: processedFiles },
        introduccion: ultraSafeStringify(generatedData.introduccion, 'introduccion') || 'Actividad generada para reforzar el aprendizaje.',
        panelDidactico: panelContent,
        generatedContent: adaptedContent,
      };

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

      // Lógica Gemini movida al backend. Llama a un endpoint seguro:
      const prompt = buildPruebaPrompt();
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/generarPruebaRemota', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, pruebaFormData })
      });
      if (!response.ok) throw new Error('Error al generar la prueba con IA');
      const generatedData = await response.json();

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
      // En este módulo sólo trabajamos por estudiante; si no hay destino explícito no mostramos nada
      return [];
    } else {
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

  // NUEVO: conjunto de estudiantes que pertenecen a este programa (tienen actividades/pruebas/entregas)
  const programStudents = useMemo(() => {
    const set = new Set<string>(); // ids
    // por nombre en destinos
    actividades.forEach(a => {
      (a.estudiantesDestino || []).forEach(nombre => {
        const u = allUsers.find(x => x.profile === Profile.ESTUDIANTE && x.nombreCompleto === nombre);
        if (u) set.add(u.id);
      });
    });
    pruebasEstandarizadas.forEach(p => {
      (p.estudiantesDestino || []).forEach(nombre => {
        const u = allUsers.find(x => x.profile === Profile.ESTUDIANTE && x.nombreCompleto === nombre);
        if (u) set.add(u.id);
      });
    });
    // por respuestas
    respuestas.forEach(r => set.add(r.estudianteId));
    return allUsers.filter(u => u.profile === Profile.ESTUDIANTE && set.has(u.id))
      .sort((a,b)=>a.nombreCompleto.localeCompare(b.nombreCompleto));
  }, [actividades, pruebasEstandarizadas, respuestas, allUsers]);

  const selectedStudent = useMemo(
    () => allUsers.find(u => u.id === selectedStudentId) || null,
    [allUsers, selectedStudentId]
  );

  const studentHistory = useMemo(() => {
    if (!selectedStudent) return { asignadas: [], respuestas: [] as RespuestaEstudianteActividad[] };
    const asignadas = [
      ...actividades
        .filter(a => (a.estudiantesDestino || []).includes(selectedStudent.nombreCompleto))
        .map(a => ({ tipo: 'Actividad', item: a })),
      ...pruebasEstandarizadas
        .filter(p => (p.estudiantesDestino || []).includes(selectedStudent.nombreCompleto))
        .map(p => ({ tipo: 'Prueba', item: p })),
    ] as Array<{ tipo: 'Actividad'|'Prueba'; item: any }>;
    const resp = respuestas.filter(r => r.estudianteId === selectedStudent.id);
    return { asignadas, respuestas: resp };
  }, [selectedStudent, actividades, pruebasEstandarizadas, respuestas]);

  /* ============================================================
     Render
  ============================================================ */
  const renderTabs = () => (
    <div className="flex flex-wrap gap-2 mb-6">
      {(['carpetas','actividades','pruebas','gestion'] as TabKey[]).map(tab => (
        <button
          key={tab}
          onClick={() => { setActiveTab(tab); setSelectedActividad(null); setSelectedPrueba(null); setSelectedStudentId(null); }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition
            ${activeTab === tab ? 'bg-amber-500 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
        >
          {tab === 'carpetas' && <FolderOpen size={18} />}
          {tab === 'actividades' && <FileText size={18} />}
          {tab === 'pruebas' && <BarChart2 size={18} />}
          {tab === 'carpetas' ? 'Carpetas de Estudiantes' : tab === 'actividades' ? 'Actividades Remotas' : tab === 'pruebas' ? 'Pruebas Estandarizadas' : 'Gestión de Trabajos'}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" size={18} />
          <input
            type="text"
            placeholder="Buscar estudiante..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="pl-10 pr-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        {activeTab === 'actividades' && !previewData && !selectedActividad && (
          <button onClick={() => setIsCreating(true)} className="inline-flex items-center gap-2 bg-amber-500 text-white font-semibold py-2 px-3 rounded-xl hover:bg-amber-600">
            <PlusCircle size={18} /> Nueva
          </button>
        )}
        {activeTab === 'pruebas' && !previewPrueba && !selectedPrueba && (
          <button onClick={() => setIsCreatingPrueba(true)} className="inline-flex items-center gap-2 bg-amber-500 text-white font-semibold py-2 px-3 rounded-xl hover:bg-amber-600">
            <PlusCircle size={18} /> Nueva
          </button>
        )}
      </div>
    </div>
  );

  /* ---------------------- Nueva vista: Gestión de Trabajos ---------------------- */
  // Opciones de filtros a partir de actividades
  const opcionesAsignatura = useMemo(() => {
    const set = new Set<string>();
    actividades.forEach(a => a?.asignatura && set.add(a.asignatura));
    return ['Todas', ...Array.from(set).sort()];
  }, [actividades]);

  const opcionesNivel = useMemo(() => {
    const set = new Set<string>();
    actividades.forEach(a => a?.nivel && set.add(a.nivel));
    const arr = Array.from(set).filter(x => !!x && x !== '—').sort();
    return ['Todos', '—', ...arr];
  }, [actividades]);

  type TrabajoRow = {
    actividad: ActividadRemota;
    estudiante: User | null;
    estado: 'Completado' | 'Pendiente';
    respuesta?: RespuestaEstudianteActividad;
  };

  const trabajos: TrabajoRow[] = useMemo(() => {
    const rows: TrabajoRow[] = [];
    for (const a of actividades) {
      const asignados = a.estudiantesDestino || [];
      for (const nombre of asignados) {
        const u = allUsers.find(x => x.profile === Profile.ESTUDIANTE && x.nombreCompleto === nombre) || null;
        const r = u ? respuestas.find(rr => rr.estudianteId === u.id && rr.actividadId === a.id) : undefined;
        rows.push({ actividad: a, estudiante: u, estado: r ? 'Completado' : 'Pendiente', respuesta: r });
      }
    }
    return rows;
  }, [actividades, allUsers, respuestas]);

  const trabajosFiltrados = useMemo(() => {
    return trabajos.filter(t => {
      const okAsignatura = filtroAsignatura === 'Todas' || t.actividad.asignatura === filtroAsignatura;
      const okNivel = filtroNivel === 'Todos' || t.actividad.nivel === filtroNivel;
      return okAsignatura && okNivel;
    });
  }, [trabajos, filtroAsignatura, filtroNivel]);

  const renderGestionView = () => (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Gestión de Trabajos</h2>
          <p className="text-slate-500">Organiza envíos y realizados por asignatura y nivel. Reasigna actividades ya creadas sin consumir tokens.</p>
        </div>
        <div className="md:ml-auto flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Asignatura</label>
            <select value={filtroAsignatura} onChange={e => setFiltroAsignatura(e.target.value)} className="border-slate-300 rounded-md">
              {opcionesAsignatura.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nivel</label>
            <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)} className="border-slate-300 rounded-md">
              {opcionesNivel.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Asignatura</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nivel</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estudiante</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipos</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Puntaje</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nota</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {trabajosFiltrados.map((t, idx) => (
              <tr key={`${t.actividad.id}-${t.estudiante?.id || idx}`} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800"><UltraSafeRenderer content={t.actividad.asignatura} context="gestion-asig"/></td>
                <td className="px-4 py-3 text-sm">{t.actividad.nivel || '—'}</td>
                <td className="px-4 py-3 text-sm">{t.estudiante?.nombreCompleto || '—'}</td>
                <td className="px-4 py-3 text-sm">{t.actividad.tipos?.join(', ')}</td>
                <td className="px-4 py-3 text-sm">
                  {t.estado === 'Completado' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800"><CheckCircle2 size={14}/> Completado</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800"><Clock size={14}/> Pendiente</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{t.respuesta ? `${t.respuesta.puntaje}/${t.respuesta.puntajeMaximo}` : '—'}</td>
                <td className="px-4 py-3 text-sm font-semibold">{t.respuesta ? t.respuesta.nota : '—'}</td>
                <td className="px-4 py-3 text-sm">{t.respuesta ? formatDateTime(t.respuesta.fechaCompletado) : '—'}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <button
                    onClick={() => { setReasignandoActividad(t.actividad); setReasignEstudiantes([]); }}
                    className="text-blue-600 hover:text-blue-800 font-semibold"
                    title="Reasignar a nuevos estudiantes"
                  >Reasignar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Reasignación */}
      {reasignandoActividad && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-2">Reasignar Actividad</h3>
            <p className="text-sm text-slate-600 mb-4">Selecciona estudiantes adicionales para la actividad de <strong>{reasignandoActividad.asignatura}</strong> — {reasignandoActividad.tipos?.join(', ')}.</p>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Buscar estudiante..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full border-slate-300 rounded-md shadow-sm"
              />
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-md p-2 bg-slate-50">
              {(studentSearch ? filteredStudents : students).map((student) => {
                const yaAsignado = (reasignandoActividad.estudiantesDestino || []).includes(student.nombreCompleto);
                return (
                  <label key={student.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${yaAsignado ? 'opacity-50' : 'hover:bg-slate-100'}`}>
                    <input
                      type="checkbox"
                      disabled={yaAsignado}
                      checked={reasignEstudiantes.includes(student.nombreCompleto)}
                      onChange={() => {
                        setReasignEstudiantes(prev => prev.includes(student.nombreCompleto)
                          ? prev.filter(n => n !== student.nombreCompleto)
                          : [...prev, student.nombreCompleto]);
                      }}
                      className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span className="text-sm font-medium text-slate-700 truncate" title={student.nombreCompleto}>
                      {student.nombreCompleto}
                    </span>
                    {yaAsignado && <span className="ml-auto text-xs text-slate-400">Ya asignado</span>}
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setReasignandoActividad(null); setReasignEstudiantes([]); }}
                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300"
              >Cancelar</button>
              <button
                disabled={isReassignSaving || reasignEstudiantes.length === 0}
                onClick={async () => {
                  if (!reasignandoActividad) return;
                  try {
                    setIsReassignSaving(true);
                    const actuales = reasignandoActividad.estudiantesDestino || [];
                    const merged = Array.from(new Set([...actuales, ...reasignEstudiantes]));
                    await updateActividad(reasignandoActividad.id, { estudiantesDestino: merged });
                    setReasignandoActividad(null);
                    setReasignEstudiantes([]);
                  } catch (e) {
                    console.error('Error reasignando actividad:', e);
                    setError('No se pudo reasignar la actividad.');
                  } finally {
                    setIsReassignSaving(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-400"
              >{isReassignSaving ? 'Guardando...' : 'Confirmar reasignación'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ---------------------- Carpetas por Estudiante ---------------------- */
  const renderStudentFolders = () => {
    const list = (studentSearch ? filteredStudents : programStudents);
    if (!list.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow text-center text-slate-500">
          No hay estudiantes asignados aún.
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        {list.map((s) => {
          const entregas = respuestas.filter(r => r.estudianteId === s.id);
          const completadas = entregas.length;
          const asignadas = actividades.filter(a => (a.estudiantesDestino || []).includes(s.nombreCompleto)).length
            + pruebasEstandarizadas.filter(p => (p.estudiantesDestino || []).includes(s.nombreCompleto)).length;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStudentId(s.id)}
              className="group text-left rounded-2xl border border-slate-200 bg-white hover:shadow-md transition overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-amber-50 to-white">
                <div className="rounded-xl p-3 bg-amber-100 text-amber-700">
                  <FolderOpen />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{s.nombreCompleto}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1"><UserIcon size={14}/> {s.curso || '—'}</p>
                </div>
              </div>
              <div className="p-4 grid grid-cols-3 text-center text-sm text-slate-600">
                <div><p className="font-semibold">{asignadas}</p><p className="text-xs">Asignadas</p></div>
                <div><p className="font-semibold">{completadas}</p><p className="text-xs">Entregas</p></div>
                <div className="flex flex-col items-center">
                  <Clock size={16} className="opacity-70" />
                  <span className="text-xs mt-1">
                    {entregas.length ? formatDateOnly(entregas.sort((a,b)=> (a.fechaCompletado || '').localeCompare(b.fechaCompletado || '')).slice(-1)[0].fechaCompletado) : '—'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderStudentHistory = () => {
    if (!selectedStudent) return null;
    const { asignadas, respuestas: resp } = studentHistory;

    return (
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setSelectedStudentId(null)}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={18}/> Volver
          </button>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            Historial — {selectedStudent.nombreCompleto}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Título / Asignatura</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Plazo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Puntaje</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nota</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {asignadas.map(({ tipo, item }) => {
                const r = resp.find(x => x.actividadId === item.id);
                const titulo = tipo === 'Actividad' ? `${item.asignatura} — ${item.tipos?.join(', ')}` : item.titulo;
                const plazo = item.plazoEntrega ? formatDateOnly(item.plazoEntrega) : '—';
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">{tipo}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">
                      <UltraSafeRenderer content={titulo} context="hist-titulo"/>
                    </td>
                    <td className="px-4 py-3 text-sm">{plazo}</td>
                    <td className="px-4 py-3 text-sm">
                      {r ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          <CheckCircle2 size={14}/> Completado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          <Clock size={14}/> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{r ? `${r.puntaje}/${r.puntajeMaximo}` : '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{r ? r.nota : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ---------------------- Vista Actividad seleccionada ---------------------- */
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
            Plazo:{' '}
            {formatDateOnly(selectedActividad?.plazoEntrega || selectedPrueba?.plazoEntrega)}
            {selectedPrueba && ` | Duración: ${selectedPrueba.duracionMinutos} min`}
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedActividad(null);
            setSelectedPrueba(null);
          }}
          className="text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-2"
        >
          <ArrowLeft size={18}/> Volver al listado
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

                    const puntajeAuto = Number(revisionTarget.puntaje) || 0;
                    const puntajeMaximo = Number(revisionTarget.puntajeMaximo) || 0;

                    const puntajeDocente = (revisionDetalle || []).reduce(
                      (acc, d) => acc + (Number(d.puntaje) || 0),
                      0
                    );

                    const nuevoPuntajeTotal = puntajeAuto + puntajeDocente;
                    const nuevaNota = calcularNota60(nuevoPuntajeTotal, puntajeMaximo);

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

  /* ---------------------- Formularios: sólo por ESTUDIANTES ---------------------- */
  const renderCreationForm = () => (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Nueva Actividad Remota</h2>
        <button onClick={() => setIsCreating(false)} className="text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-2">
          <ArrowLeft size={18}/> Volver
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

          {/* Nivel y Cursos REMOVIDOS de la UI por requerimiento */}

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
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Destinatarios (Sólo estudiantes)</h3>
            <div>
              <input
                type="text"
                placeholder="Buscar estudiante..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full border-slate-300 rounded-md shadow-sm mb-2"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-56 overflow-y-auto p-2 bg-white rounded">
                {(studentSearch ? filteredStudents : students).map((student) => (
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
        </div>

        {error && <p className="text-red-600 bg-red-100 p-3 rounded-md mt-2">{error}</p>}

        <div className="pt-2 text-right">
          <button
            type="submit"
            disabled={isGenerating}
            className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 inline-flex items-center justify-center gap-2"
          >
            {isGenerating ? <Clock className="animate-spin" size={18}/> : null}
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

        {previewData?.panelDidactico && (
          <div className="p-5 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg shadow-md">
            <h3 className="font-bold text-emerald-800 text-lg mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Panel Didáctico - Material de Apoyo
            </h3>
            <div className="prose prose-emerald max-w-none text-slate-700">
              {(() => {
                try {
                  // Intentar analizar como JSON si comienza con '{'
                  if (typeof previewData.panelDidactico === 'string' && previewData.panelDidactico.trim().startsWith('{')) {
                    const jsonData = JSON.parse(previewData.panelDidactico);
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
                  return <p className="whitespace-pre-wrap">{previewData.panelDidactico}</p>;
                } catch (err) {
                  // Si hay error en el parseo, mostrar como texto plano
                  return <p className="whitespace-pre-wrap">{previewData.panelDidactico}</p>;
                }
              })()}
            </div>
          </div>
        )}

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
          if (!content) return null;
          return (
            <div key={tipo} className="p-4 border rounded-lg bg-white">
              <h3 className="text-xl font-bold mb-4">{tipo}</h3>
              <div className="space-y-4 text-sm">
                {tipo === 'Quiz' &&
                  Array.isArray(content) &&
                  content.map((q: QuizQuestion, i: number) => (
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
                  ))}

                {tipo === 'Comprensión de Lectura' &&
                  content &&
                  typeof content === 'object' &&
                  'preguntas' in content &&
                  Array.isArray(content.preguntas) && (
                    <div>
                      <p className="whitespace-pre-wrap bg-slate-100 p-3 rounded-md mb-4">
                        <UltraSafeRenderer content={content.texto} context="preview-lectura-texto" />
                      </p>
                      {content.preguntas.map((q: QuizQuestion, i: number) => (
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
                      ))}
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
                        {content.map((p: PareadoItem, i: number) => (
                          <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50">
                            <td className="p-2 align-top font-semibold text-slate-800">
                              <UltraSafeRenderer content={p.concepto} context={`preview-pareado-concepto-${i}`} />
                            </td>
                            <td className="p-2 align-top text-slate-700">
                              <UltraSafeRenderer content={p.definicion} context={`preview-pareado-definicion-${i}`} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {tipo === 'Desarrollo' &&
                  Array.isArray(content) &&
                  content.map((d: any, i: number) => (
                    <div key={i} className="border-t pt-3 first:border-t-0">
                      <p className="font-semibold">
                        {i + 1}. <UltraSafeRenderer content={d.pregunta} context={`preview-desarrollo-pregunta-${i}`} />
                      </p>
                      <p className="text-sm text-slate-600 mt-2 p-2 bg-slate-100 rounded-md">
                        <strong className="font-semibold">Rúbrica:</strong> <UltraSafeRenderer content={d.rubrica} context={`preview-desarrollo-rubrica-${i}`} />
                      </p>
                    </div>
                  ))}

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

  /* ---------------------- PRUEBAS ---------------------- */
  const renderPruebaCreationForm = () => (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify_between items-start">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Nueva Prueba Estandarizada</h2>
        <button onClick={() => setIsCreatingPrueba(false)} className="text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-2">
          <ArrowLeft size={18}/> Volver
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

          {/* Nivel/Cursos removidos de UI */}

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

          <div className="md:col-span-2 p-4 border rounded-lg space-y-4 bg-slate-50 dark:bg-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Destinatarios (Sólo estudiantes)</h3>
            <div>
              <input
                type="text"
                placeholder="Buscar estudiante..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full border-slate-300 rounded-md shadow-sm mb-2"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-56 overflow-y-auto p-2 bg-white rounded">
                {(studentSearch ? filteredStudents : students).map((student) => (
                  <label key={student.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pruebaFormData.estudiantesDestino?.includes(student.nombreCompleto)}
                      onChange={() => handleEstudianteDestinoChange(student.nombreCompleto, true)}
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
        </div>

        {error && <p className="text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}

        <div className="text-right">
          <button
            type="submit"
            disabled={isGenerating}
            className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 inline-flex items-center gap-2"
          >
            {isGenerating ? <Clock className="animate-spin" size={18}/> : null}
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
              {previewPrueba.textos.map((t, i) => (
                <li key={t.id}>
                  <p className="font-semibold">
                    <UltraSafeRenderer content={t.titulo} context={`preview-texto-titulo-${i}`} /> 
                    <span className="text-xs text-slate-500">({t.tipo})</span>
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">
                    <UltraSafeRenderer content={t.contenido} context={`preview-texto-contenido-${i}`} />
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {previewPrueba?.preguntas?.length ? (
          <div className="p-4 border rounded-lg bg-white">
            <h3 className="text-xl font-bold mb-4">Preguntas (muestra)</h3>
            {previewPrueba.preguntas.slice(0, 10).map((p, i) => (
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
            ))}
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

  /* ---------------------- Listados ---------------------- */
  const renderActivityList = () => (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Actividades Remotas</h1>
        <button onClick={() => setIsCreating(true)} className="inline-flex items-center gap-2 bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">
          <PlusCircle size={18}/> Crear Nueva
        </button>
      </div>

      <div className="space-y-4">
        {actividades.length > 0 ? (
          actividades.map((act) => {
            const destinations: string[] = [];
            if (act.estudiantesDestino?.length) destinations.push(`Estudiantes: ${act.estudiantesDestino.length}`);
            const destinationText = destinations.length ? destinations.join(' | ') : `Estudiantes seleccionados`;
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

  const renderPruebasList = () => (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Pruebas Estandarizadas</h1>
        <button onClick={() => setIsCreatingPrueba(true)} className="inline-flex items-center gap-2 bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">
          <PlusCircle size={18}/> Crear Nueva
        </button>
      </div>

      <div className="space-y-4">
        {pruebasEstandarizadas.length > 0 ? (
          pruebasEstandarizadas.map((p) => (
            <div key={p.id} className="p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">
                    <UltraSafeRenderer content={p.titulo} context={`lista-prueba-titulo-${p.id}`} />
                  </p>
                  <p className="text-sm text-slate-500">
                    Creado: {formatDateOnly(p.fechaCreacion)}
                  </p>
                </div>
                <button onClick={() => setSelectedPrueba(p)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">
                  Ver Resultados
                </button>
              </div>
            </div>
          ))
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
      {/* Vistas por prioridad */}
      {selectedStudentId ? (
        renderStudentHistory()
      ) : previewPrueba ? (
        renderPruebaPreview()
      ) : previewData ? (
        renderPreview()
      ) : selectedActividad || selectedPrueba ? (
        renderActivityView()
      ) : activeTab === 'gestion' ? (
        renderGestionView()
      ) : activeTab === 'pruebas' ? (
        isCreatingPrueba ? renderPruebaCreationForm() : renderPruebasList()
      ) : activeTab === 'actividades' ? (
        isCreating ? renderCreationForm() : renderActivityList()
      ) : (
        renderStudentFolders()
      )}
    </div>
  );
};

export default ActividadesRemotas;