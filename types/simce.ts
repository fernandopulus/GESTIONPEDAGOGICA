// Tipos para el módulo SIMCE

export type AsignaturaSimce = 'Lectura' | 'Matemática';

export type NivelLogro = 'Adecuado' | 'Elemental' | 'Insuficiente';

export interface Alternativa {
  id: string;
  texto: string;
  esCorrecta: boolean;
  explicacion?: string;
}

export interface Pregunta {
  id: string;
  enunciado: string;
  alternativas: Alternativa[];
  estandarAprendizaje: string; // Estándar de aprendizaje al que está alineada la pregunta
  habilidad?: string; // Habilidad específica que evalúa (ej: "Interpretar" para Lectura, "Resolver problemas" para Matemática)
  textoBase?: string; // Texto base para preguntas de Lectura (solo en la primera pregunta de un set)
  createdAt?: any; // Timestamp de creación (para Firebase)
  dificultad?: 'baja' | 'media' | 'alta'; // Nivel de dificultad
}

export interface SetPreguntas {
  id: string;
  titulo: string;
  descripcion?: string;
  asignatura: AsignaturaSimce;
  preguntas: Pregunta[];
  creadorId: string;
  creadorNombre: string;
  fechaCreacion: string;
  cursosAsignados: string[]; // IDs de los cursos a los que está asignado
  barajarPreguntas: boolean; // Si se deben barajar las preguntas al mostrar
  barajarAlternativas: boolean; // Si se deben barajar las alternativas al mostrar
}

export interface RespuestaEstudiante {
  preguntaId: string;
  alternativaSeleccionadaId: string;
  esCorrecta: boolean;
}

export interface ResultadoIntento {
  id: string;
  estudianteId: string;
  estudianteNombre: string;
  setId: string;
  respuestas: RespuestaEstudiante[];
  porcentajeAciertos: number;
  nivelLogro: NivelLogro;
  fechaEnvio: string;
}

// Utilidades para calcular el nivel de logro
export function calcularNivelLogro(porcentajeAciertos: number): NivelLogro {
  if (porcentajeAciertos >= 80) {
    return 'Adecuado';
  } else if (porcentajeAciertos >= 50) {
    return 'Elemental';
  } else {
    return 'Insuficiente';
  }
}

// Funciones para obtener el color de nivel de logro
export function getColorNivelLogro(nivel: NivelLogro): string {
  switch (nivel) {
    case 'Adecuado':
      return 'bg-green-500 text-white';
    case 'Elemental':
      return 'bg-yellow-500 text-white';
    case 'Insuficiente':
      return 'bg-red-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

// Estándares de aprendizaje para 2º medio según las bases curriculares
export const estandaresLectura = [
  'Localizar información explícita',
  'Realizar inferencias a partir del texto',
  'Interpretar y relacionar información del texto',
  'Reflexionar sobre el texto y evaluarlo',
  'Analizar aspectos formales del texto',
  'Reconocer tipos de texto según su propósito comunicativo',
  'Comprender vocabulario en contexto'
];

export const estandaresMatematica = [
  'Números y operaciones',
  'Álgebra y funciones',
  'Geometría',
  'Probabilidad y estadística',
  'Resolución de problemas',
  'Modelamiento matemático',
  'Argumentación y comunicación matemática'
];
