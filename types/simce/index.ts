export type AsignaturaSimce = 'matematica' | 'lectura' | 'ciencias' | 'historia';

export interface Pregunta {
  enunciado: string;
  alternativas: string[];
  respuestaCorrecta: number;
  explicacion: string;
}

// Alias para mantener compatibilidad con componentes nuevos
export type PreguntaSimce = Pregunta;

export interface SetPreguntas {
  id: string;
  titulo: string;
  asignatura: AsignaturaSimce;
  nivel: string;
  eje: string;
  objetivo: string;
  preguntas: Pregunta[];
  creadorId: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  cursosAsignados?: string[];
}

// Alias para mantener compatibilidad con componentes nuevos
export type SetPreguntasSimce = SetPreguntas;

export interface DetalleRespuesta {
  pregunta: string;
  respuestaSeleccionada: number;
  respuestaCorrecta: number;
  esCorrecta: boolean;
}

export interface ResultadoIntento {
  id: string;
  setId: string;
  titulo: string;
  estudianteId: string;
  estudianteNombre: string;
  asignatura: AsignaturaSimce;
  puntaje: number;
  porcentaje: number;
  fechaEnvio: string;
  tiempo: number;
  respuestas: {
    preguntaId: number;
    respuesta: number;
    correcta: boolean;
  }[];
}

// Alias para mantener compatibilidad con componentes nuevos
export interface ResultadoSimce {
  setId: string;
  titulo: string;
  asignatura: AsignaturaSimce;
  nivel: string;
  correctas: number;
  total: number;
  porcentaje: number;
  tiempoSegundos: number;
  fecha: string;
  detalleRespuestas: DetalleRespuesta[];
}

export interface EstadisticasSimce {
  id: string;
  userId: string;
  resultados: ResultadoSimce[];
  createdAt: string;
  updatedAt: string;
}
