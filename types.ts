import React from 'react';
import type { Position, Node as ReactFlowNode, Edge as ReactFlowEdge } from 'reactflow';
// Para una mejor seguridad de tipos con Firestore, se recomienda importar estos tipos.
// Si no usas Firebase, puedes reemplazarlos por `string` y `any` respectivamente.
import type { Timestamp, FieldValue } from 'firebase/firestore';

// --- General ---

export enum Profile {
  SUBDIRECCION = 'SUBDIRECCION',
  PROFESORADO = 'PROFESORADO',
  COORDINACION_TP = 'COORDINACION_TP',
  ESTUDIANTE = 'ESTUDIANTE',
}

export interface Module {
  name: string;
  icon: React.ReactNode;
}

export interface User {
  id: string;
  nombreCompleto: string;
  email: string;
  rut?: string;
  profile: Profile;
  fotoUrl?: string;
  password?: string;
  curso?: string; // Para estudiantes
  cursos?: string[]; // Para profesores
  asignaturas?: string[]; // Para profesores
  resetPasswordToken?: string;
  resetPasswordExpires?: number; // Timestamp
}

// --- Muro de Anuncios ---

export type TipoDestinatario = 'Todos' | 'Cursos' | 'Profesores' | 'Coordinación TP';

export interface DestinatariosAnuncio {
    tipo: TipoDestinatario;
    cursos?: string[];
}

export interface Anuncio {
  id: string;
  titulo: string;
  mensaje: string;
  autor: string;
  fechaPublicacion: string; // ISO String
  adjunto?: string; // URL
  destacado: boolean;
  profileCreador: Profile;
  destinatarios?: DestinatariosAnuncio;
}

// --- Mensajería ---

export interface MensajeInterno {
    id: string;
    de: string;
    para: string;
    asunto: string;
    cuerpo: string;
    fecha: string; // ISO String
}

export interface ReadStatus {
    announcements: string[];
    messages: string[];
}

// --- Registro de Reemplazos ---

export interface Reemplazo {
  id:string;
  docenteAusente: string;
  asignaturaAusente: string;
  curso: string;
  diaAusencia: string;
  bloquesAfectados: number[];
  docenteReemplazante: string;
  asignaturaReemplazante: string;
  resultado: 'Hora realizada' | 'Hora cubierta, no realizada';
}

// --- Horarios ---

export interface AsignacionHorario {
  id: string;
  curso: string;
  asignatura: string;
  profesor: string;
}

export interface HorarioCelda {
  asignatura: string | null;
  profesor: string | null;
}

export type HorariosGenerados = Record<string, Record<string, Record<string, HorarioCelda>>>;

// --- Seguimiento de Acciones ---

export type EstadoAccion = 'Pendiente' | 'En Proceso' | 'Cumplida';

export interface AccionPedagogica {
    id: string;
    fechaRegistro: string;
    responsable: string;
    area: string;
    descripcion: string;
    fechaCumplimiento: string;
    estado: EstadoAccion;
}

// --- Planificación Docente ---

export type NivelPlanificacion = '1º Medio' | '2º Medio' | '3º Medio' | '4º Medio';

interface PlanificacionBase {
  id: string;
  fechaCreacion: string; // ISO String
  asignatura: string;
  nivel: NivelPlanificacion;
  contenidos: string;
  observaciones: string;
  autor?: string;
}

export interface DetalleLeccion {
    objetivosAprendizaje: string;
    contenidosConceptuales: string;
    habilidadesBloom: string;
    perfilEgreso: string;
    actividades: string;
    asignaturasInterdisciplinariedad: string;
}

export interface MomentosClase {
    inicio: string;
    desarrollo: string;
    cierre: string;
}

export interface ReflexionUnidad {
  fortalezas: string;
  debilidades: string;
  mejoras: string;
  ordenHabilidades?: string[];
}

export interface PlanificacionUnidad extends PlanificacionBase {
  tipo: 'Unidad';
  nombreUnidad: string;
  objetivosAprendizaje: string;
  indicadoresEvaluacion: string;
  cantidadClases: number;
  detallesLeccion: DetalleLeccion[];
  ideasParaUnidad?: string;
  progreso?: number; // Porcentaje de avance de la unidad (0-100)
  reflexionUnidad?: ReflexionUnidad;
}

export interface PlanificacionClase extends PlanificacionBase {
  tipo: 'Clase';
  nombreClase: string;
  duracionClase: number; // en minutos
  momentosClase: MomentosClase;
  detalleLeccionOrigen?: DetalleLeccion;
  progreso?: number; // Porcentaje de avance de la clase (0-100)
}

export type PlanificacionDocente = PlanificacionUnidad | PlanificacionClase;

// --- Generador de Actas ---

export type TipoReunion = 'Humanidades' | 'TP' | 'Ciencias' | 'Interdisciplinario' | 'Gestión Pedagógica' | 'Equipo Directivo' | 'Equipo de Gestión' | 'Consejo Escolar';

export interface Acta {
  id: string;
  fechaCreacion: string; // ISO String
  tipoReunion: TipoReunion;
  asistentes: string;
  textoReunion: string;
  temas?: string[];
  acuerdos?: string[];
  plazos?: string[];
  responsables?: string[];
}

// --- Calendario Académico ---

export enum EventType {
  EVALUACION = 'Evaluación',
  ACTO = 'Acto',
  ACTIVIDAD_FOCALIZADA = 'Actividad Focalizada',
  SALIDA_PEDAGOGICA = 'Salida Pedagógica',
}

export enum EvaluacionSubtype {
    PRUEBA_PARCIAL = 'Prueba parcial',
    GUIA_APRENDIZAJE = 'Guía de Aprendizaje',
    RUBRICA = 'Rúbrica',
    PAUTA_COTEJO = 'Pauta de Cotejo',
}

interface BaseEvent {
  id: string;
  date: string; // YYYY-MM-DD
}

export interface EvaluacionEvent extends BaseEvent {
  type: EventType.EVALUACION;
  subtype: EvaluacionSubtype;
  asignatura: string;
  curso: string;
  contenidos: string;
  enlace?: string;
}

export interface ActoEvent extends BaseEvent {
  type: EventType.ACTO;
  responsables: string;
  ubicacion: string;
  horario: string;
}

export interface ActividadFocalizadaEvent extends BaseEvent {
  type: EventType.ACTIVIDAD_FOCALIZADA;
  responsables: string;
  ubicacion: string;
  horario: string;
}

export interface SalidaPedagogicaEvent extends BaseEvent {
  type: EventType.SALIDA_PEDAGOGICA;
  responsable: string;
  ubicacion: string;
  cursos: string[];
}

export type CalendarEvent = EvaluacionEvent | ActoEvent | ActividadFocalizadaEvent | SalidaPedagogicaEvent;

// --- Evaluación de Aprendizajes ---

export type TipoInstrumento = 'Prueba' | 'Guía' | 'Rúbrica' | 'Lista de cotejo' | 'Pauta de observación' | 'Otro';
export type EscalaCalificacion = '1-7' | '1-100' | 'Texto Personalizado';
export type NivelLogro = 'Inicial' | 'Suficiente' | 'Competente' | 'Avanzado';

// --- Pruebas y Guías ---
export type PruebaItemTipo = 'Selección múltiple' | 'Verdadero o Falso' | 'Desarrollo' | 'Términos pareados' | 'Comprensión de lectura';

export interface PruebaItemBase {
  id: string;
  pregunta: string;
  puntaje: number;
  habilidadBloom?: string;
}

export interface SeleccionMultipleItem extends PruebaItemBase {
  tipo: 'Selección múltiple';
  opciones: string[];
  respuestaCorrecta: number; // index de la opción correcta
}

export interface VerdaderoFalsoItem extends PruebaItemBase {
  tipo: 'Verdadero o Falso';
  respuestaCorrecta: boolean;
}

export interface DesarrolloItem extends PruebaItemBase {
  tipo: 'Desarrollo';
}

export interface TerminosPareadosItem extends PruebaItemBase {
  tipo: 'Términos pareados';
  pares: { concepto: string; definicion: string }[];
}

export interface ComprensionLecturaItem extends PruebaItemBase {
  tipo: 'Comprensión de lectura';
  texto: string;
  preguntas: (SeleccionMultipleItem | DesarrolloItem)[];
}

export type PruebaItem = SeleccionMultipleItem | VerdaderoFalsoItem | DesarrolloItem | TerminosPareadosItem | ComprensionLecturaItem;

export interface PruebaActividad {
  id: string;
  titulo: string;
  instrucciones: string;
  items: PruebaItem[];
}

export interface Prueba {
  id: string;
  nombre: string;
  fechaCreacion: string; // ISO String
  asignatura: string;
  nivel: string;
  objetivo: string;
  instruccionesGenerales: string;
  puntajeIdeal: number;
  actividades: PruebaActividad[];
  contenidoOriginal: string;
  tiposActividadOriginal: Partial<Record<PruebaItemTipo, number>>;
  dificultad?: 'Fácil' | 'Intermedio' | 'Avanzado';
  adaptacionNEE?: DificultadAprendizaje[];
}

// --- Rúbricas (Estáticas y Interactivas) ---
export interface NivelDescriptor {
  insuficiente: string;
  suficiente: string;
  competente: string;
  avanzado: string;
}

export interface DimensionRubrica {
  id: string;
  nombre: string;
  niveles: NivelDescriptor;
  isLoading?: boolean;
}

export interface RubricaEstatica {
  id: string;
  titulo: string;
  descripcion: string;
  fechaCreacion: string; // ISO String
  dimensiones: DimensionRubrica[];
}

export interface ResultadoInteractivo {
  puntajes: Record<string, number>; // { [nombreDimension]: puntaje 1-4 }
  feedback: string;
}

export interface RubricaInteractiva {
  id: string;
  nombre: string;
  curso: string;
  asignatura: string;
  rubricaEstaticaId: string; // Enlace a la rúbrica estática
  resultados: Record<string, ResultadoInteractivo>; // { [nombreEstudiante]: ResultadoInteractivo }
}

// --- Seguimiento Dual ---

export type EstadoSeguimientoDual = 'Vinculado' | 'Desvinculado' | 'En proceso' | 'Empresa';

export interface SeguimientoDualRecord {
  id: string;
  nombreEstudiante: string;
  rutEstudiante: string;
  curso: string;
  profesorTutorEmpresa: string;
  rutEmpresa: string;
  nombreEmpresa: string;
  direccionEmpresa: string;
  comuna: string;
  estado: EstadoSeguimientoDual;
  fechaDesvinculacion?: string;
  motivoDesvinculacion?: string;
  fecha1raSupervision1erSemestre?: string;
  realizada1raSupervision1erSemestre?: boolean;
  fecha2daSupervision1erSemestre?: string;
  realizada2daSupervision1erSemestre?: boolean;
  fecha1raSupervision2doSemestre?: string;
  realizada1raSupervision2doSemestre?: boolean;
  fecha2daSupervision2doSemestre?: string;
  realizada2daSupervision2doSemestre?: boolean;
  fechaSupervisionExcepcional?: string;
  realizadaSupervisionExcepcional?: boolean;
  nombreMaestroGuia?: string;
  contactoMaestroGuia?: string;
}

// --- Asistencia Dual & Empresa ---

export interface AsistenciaDual {
  id: string;
  nombreEstudiante: string;
  emailEstudiante: string;
  curso: string;
  tipo: 'Entrada' | 'Salida';
  fechaHora: string; // ISO string
  ubicacion: {
    latitud: number;
    longitud: number;
  };
}

// --- Archivos y Recursos (Refactorizado para claridad) ---

/** Representa un archivo que se va a subir, típicamente en formato Base64. */
export interface ArchivoParaSubir {
    nombre: string;
    url: string; // Base64 Data URL
}

/** Representa un archivo ya guardado en el almacenamiento, con su ID y URL de acceso. */
export interface ArchivoGuardado {
  id: string;
  nombre: string;
  url: string; // URL al archivo en el storage
  fechaSubida: string; // ISO String
}


// --- Actividades Remotas & Auto-aprendizaje ---
export type TipoActividadRemota = 'Quiz' | 'Comprensión de Lectura' | 'Términos Pareados' | 'Desarrollo';

export interface QuizQuestion {
  pregunta: string;
  opciones: string[];
  respuestaCorrecta: string;
}

export interface ComprensionLecturaContent {
  texto: string;
  preguntas: QuizQuestion[];
}

export interface PareadoItem {
  id: string;
  concepto: string;
  definicion: string;
}

export interface DesarrolloContent {
  pregunta: string;
  rubrica: string;
}

export interface ActividadRemota {
  id: string;
  fechaCreacion: string; // ISO String
  asignatura: string;
  nivel: NivelPlanificacion;
  contenido: string;
  plazoEntrega: string; // YYYY-MM-DD
  tipos: TipoActividadRemota[];
  cantidadPreguntas: Partial<Record<TipoActividadRemota, number>>;
  introduccion: string;
  generatedContent: Partial<{
    'Quiz': QuizQuestion[];
    'Comprensión de Lectura': ComprensionLecturaContent;
    'Términos Pareados': PareadoItem[];
    'Desarrollo': DesarrolloContent[];
  }>;
  cursosDestino?: string[];
  estudiantesDestino?: string[];
  recursos?: {
    instrucciones?: string;
    enlaces?: string; // Separados por nueva línea
    archivos?: ArchivoParaSubir[];
  };
}

export type PuntajesPorSeccion = Record<string, { puntaje: number; puntajeMaximo: number }>;

export interface PlanDeMejoraItem {
    paso: string;
    detalle: string;
}

export interface DetailedFeedback {
    resumenGeneral: string;
    areasDeFortaleza: string[];
    areasDeMejora: string[];
    planDeMejora: PlanDeMejoraItem[];
    feedbackPorSeccion?: Record<string, string>;
}

export interface RespuestaEstudianteActividad {
  id: string;
  actividadId: string;
  estudianteId: string;
  fechaCompletado: string; // ISO String
  respuestas: Partial<Record<TipoActividadRemota, any>>;
  puntaje: number;
  puntajeMaximo: number;
  retroalimentacion: string;
  retroalimentacionDetallada?: DetailedFeedback;
  calificacion?: string;
  puntajesPorSeccion?: PuntajesPorSeccion;
}

// --- Inclusión ---

export type DificultadAprendizaje =
  | 'Discapacidad Intelectual Leve'
  | 'Funcionamiento Intelectual Limítrofe'
  | 'Trastorno Déficit Atencional (TDA)'
  | 'Trastorno Déficit Atencional con Hiperactividad (TDAH)'
  | 'Trastorno del Lenguaje'
  | 'Dificultad Específica del Aprendizaje'
  | 'Dificultad Específica de Aprendizaje en Matemáticas'
  | 'Dificultades de Aprendizaje'
  | 'Problemas de Idioma y de Escolarización';

export interface Intervencion {
  id: string;
  fecha: string; // ISO String
  responsable: string;
  accion: string;
  observaciones: string;
  participantes?: string;
}

export interface ReunionApoderados {
  id: string;
  fecha: string; // ISO String
  motivo: string;
  acuerdos: string;
  asistentes: string;
}

export interface MetaProgreso {
  id: string;
  trimestre: 'T1' | 'T2' | 'T3';
  meta: string;
  cumplida: boolean;
}

export interface AlertaInclusion {
  id: string;
  fecha: string; // ISO String
  titulo: string;
  resuelta: boolean;
}

export interface EstudianteInclusion {
  id: string;
  curso: string;
  nombre: string;
  dificultad: DificultadAprendizaje;
  intervenciones: Intervencion[];
  archivos: ArchivoGuardado[]; // Usando el tipo refactorizado
  reuniones: ReunionApoderados[];
  adaptacionesCurriculares?: string;
  apoyosRecibidos?: string;
  fechaActualizacionApoyos?: string; // ISO Date String
  metasProgreso?: MetaProgreso[];
  alertas?: AlertaInclusion[];
}

// --- Acompañamiento Docente ---

export interface AcompanamientoDocente {
  id: string;
  fecha: string; // YYYY-MM-DD
  docente: string;
  curso: string;
  asignatura: string;
  bloques: string;
  rubricaResultados: Record<string, number>; // { [nombreCriterio]: puntaje }
  observacionesGenerales: string;
  retroalimentacionConsolidada: string;
}

// --- Evaluaciones Formativas y Gamificación ---

export interface EvaluacionFormativa {
    id: string;
    asignatura: string;
    curso: string;
    fecha: string; // YYYY-MM-DD
    nombreActividad: string;
}

export interface GrupoIntegrante {
    nombre: string;
    rol?: string;
}

export interface TrabajoGrupal {
    id: string;
    curso: string;
    asignatura: string;
    nombreActividad: string;
    fechaPresentacion: string; // YYYY-MM-DD
    grupos: {
        numero: number;
        integrantes: GrupoIntegrante[];
    }[];
}

export type CalificacionesFormativas = Record<string, Record<string, string>>; // { [idEvaluacion]: { [nombreEstudiante]: calificacion } }

export interface Insignia {
    nombre: string;
    emoji: string;
    promedioMin: number;
    promedioMax: number;
    mensaje: string;
}

export interface GamificacionEstudiante {
    puntajeTotal: number;
    promedio: number;
    rangoActual: Insignia | null;
    insigniasGanadas: Insignia[];
}


// --- Interdisciplinario ---
export interface ActividadInterdisciplinaria {
    id: string;
    nombre: string;
    fechaInicio: string; // YYYY-MM-DD
    fechaFin: string; // YYYY-MM-DD
    responsables: string;
    asignaturaPrincipal: string;
}

export interface FechaClave {
    id: string;
    nombre: string;
    fecha: string; // YYYY-MM-DD
}

export interface TareaInterdisciplinaria {
    id: string;
    numero: number;
    instrucciones: string;
    fechaEntrega: string; // YYYY-MM-DD
    recursoUrl?: string;
}

export interface EntregaTareaInterdisciplinaria {
    id: string;
    planificacionId: string;
    tareaId: string;
    estudianteId: string;
    estudianteNombre: string;
    fechaCompletado?: string; // ISO String
    completada: boolean;
    observacionesEstudiante?: string;
    archivoAdjunto?: ArchivoParaSubir;
    enlaceUrl?: string;
    feedbackProfesor?: string;
    fechaFeedback?: string; // ISO String
}

export interface PlanificacionInterdisciplinaria {
    id: string;
    nombreProyecto: string;
    descripcionProyecto: string;
    asignaturas: string[];
    cursos: string[];
    docentesResponsables: string;
    objetivos: string;
    indicadoresLogro: string;
    actividades: ActividadInterdisciplinaria[];
    fechasClave: FechaClave[];
    tareas?: TareaInterdisciplinaria[];
}

// --- Pañol ---
export interface Maquina {
    id: string;
    nombre: string;
    especialidad: 'Industrial' | 'Automotriz';
}

export interface RegistroPañol {
    id: string;
    fecha: string; // YYYY-MM-DD
    curso: string;
    profesorResponsable: string;
    maquinaId: string;
    totalHoras: number;
    observaciones: string;
}

// --- Recursos de Aprendizaje ---

// Sopa de Letras
export interface WordSearchPuzzle {
    grid: string[][];
    words: string[];
}

// Mapas Mentales (React Flow)
export type MindMapNode = ReactFlowNode<{ label: string }>;
export type MindMapEdge = ReactFlowEdge;

export interface MindMapTreeNode {
    id: string;
    label: string;
    children: MindMapTreeNode[];
}

export interface MindMap {
    id: string;
    tema: string;
    nivel: string;
    createdAt: string; // ISO String
    treeData: MindMapTreeNode;
    nodes: MindMapNode[];
    edges: MindMapEdge[];
}

// Líneas de Tiempo
export interface TimelineEvent {
    id: string;
    date: string; // Puede ser "YYYY" o "YYYY-MM-DD"
    description: string;
    icon?: string; // Emoji
}

export interface Timeline {
    id: string;
    tema: string;
    fechaInicio?: string;
    fechaFin?: string;
    createdAt: string; // ISO String
    events: TimelineEvent[];
}

// Crucigramas
export interface CrosswordClue {
    number: number;
    clue: string;
    word: string;
    direction: 'across' | 'down';
    row: number;
    col: number;
}
  
export interface CrosswordGridCell {
    char: string | null;
    number: number | null;
}

export interface CrosswordPuzzle {
    id: string;
    fechaCreacion: string; // ISO String
    creadorId: string;
    creadorNombre: string;
    tema: string;
    grid: CrosswordGridCell[][];
    clues: {
        across: CrosswordClue[];
        down: CrosswordClue[];
    };
}

// --- Administración: Monitor de Uso ---
export interface ApiCallLog {
    id: string;
    timestamp: string; // ISO String
    userId: string;
    userEmail: string;
    module: string;
}

// Planificación de Actividades
export interface TareaActividad {
    id: string;
    descripcion: string;
    responsable: string;
    recursos: string;
}

export interface ActividadPlanificada {
    id: string;
    nombre: string;
    fecha: string; // YYYY-MM-DD
    hora: string; // HH:mm
    descripcion: string;
    ubicacion: string;
    participantes: string;
    objetivo: string;
    tareas: TareaActividad[];
    recursosGenerales: string;
    calendarEventId?: string;
}

// --- Análisis Taxonómico ---
export type BloomLevel = 'Recordar' | 'Comprender' | 'Aplicar' | 'Analizar' | 'Evaluar' | 'Crear';

export interface AnalisisTaxonomico {
    id: string;
    documentName: string;
    uploadDate: string; // ISO String
    userId: string;
    analysisResults: {
        question: string;
        habilidadBloom: BloomLevel;
    }[];
    summary: Record<BloomLevel, number>;
}

// --- Gestión de Empresas y Prácticas TP (Refactorizado) ---

export interface CalificacionItem {
  elemento: string; // Ej: "Cumplimiento legal y formalidad"
  score: 1 | 2 | 3 | null; // 1: Insatisfactorio, 2: Regular, 3: Óptimo
}

/** Representa una empresa con datos leídos desde Firestore. */
export interface Empresa {
  id: string;
  nombre: string;
  rut: string;
  direccion: string;
  contacto: string; // Email, teléfono, o nombre de contacto.
  cupos: number; // Vacantes para práctica
  calificaciones: CalificacionItem[];
  estudiantesAsignados: string[]; // IDs de los estudiantes
  puntajeTotal?: number; // Suma de todos los 'scores'
  createdAt: Timestamp; // Tipo de dato para fechas de Firestore
}

/** Representa el objeto de datos para crear/actualizar una empresa en Firestore. */
export interface EmpresaData extends Omit<Empresa, 'id' | 'createdAt' | 'puntajeTotal'> {
    createdAt: FieldValue; // Tipo para `serverTimestamp()` de Firestore
}