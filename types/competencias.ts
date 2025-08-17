
// src/types/competencias.ts
// Tipos para módulo de Evaluación por Competencias EMTP

export type ID = string;

export interface EspecialidadTP {
  id: ID;
  nombre: string;
}

export interface ModuloTP {
  id: ID;
  especialidadId: ID;
  nombre: string;
  codigo?: string;
}

export interface ResultadoAprendizaje {
  id: ID;
  moduloId: ID;
  codigo: string; // p.ej. RA1
  enunciado: string;
  nivelMCTP?: number; // opcional
}

export interface CriterioEvaluacion {
  id: ID;
  raId: ID;
  codigo: string; // p.ej. CE1
  descriptor: string;
  evidenciaEsperada?: string;
  peso: number; // porcentaje relativo dentro del RA (sumar 100)
}

export type NivelLogro = 'INCIPIENTE' | 'EN_DESARROLLO' | 'LOGRADO' | 'SOBRESALIENTE';

export interface RubricaDescriptor {
  ceId: ID;
  nivel: NivelLogro;
  descriptor: string;
  puntaje: number; // puntaje sugerido para el nivel en este CE
}

export interface Rubrica {
  id: ID;
  raId: ID;
  niveles: NivelLogro[];
  descriptores: RubricaDescriptor[];
  ponderacionCE: Record<ID, number>; // ceId -> peso %
  updatedAt: number;
  createdBy: ID;
}

export type ContextoEvaluacion = 'AULA' | 'TALLER' | 'EMPRESA';

export interface Evidencia {
  id: ID;
  estudianteId: ID;
  raId: ID;
  ceId?: ID;
  url: string;
  tipo: 'imagen' | 'video' | 'documento' | 'otro';
  fecha: number; // epoch ms
  autorId: ID;   // docente o tutor
  contexto: ContextoEvaluacion;
  observaciones?: string;
  storagePath?: string;
}

export interface CEScore {
  nivel: NivelLogro;
  puntaje: number;
}

export interface EvaluacionRegistro {
  id: ID;
  estudianteId: ID;
  curso?: string;
  raId: ID;
  ceIdScores: Record<ID, CEScore>;
  puntajeTotal: number;
  porcentaje: number; // 0..100
  nota: number;       // 1.0 .. 7.0
  evaluadorId: ID;
  fecha: number; // epoch ms
  contexto: ContextoEvaluacion;
  retroalimentacion?: string;
  firmaTutorEmpresa?: {
    tutorId: ID;
    nombre: string;
    fecha: number;
  };
}

export interface ConfigEvaluacion {
  escalaMin: number;          // 1
  escalaMax: number;          // 7
  porcentajeAprobacion: number; // 60 por defecto
  notaAprobacion: number;     // 4.0
  regla?: 'lineal' | 'tramos';
  tramos?: Array<{desde: number; hasta: number; nota: number;}>;
}

export interface UserLite {
  id: ID;
  displayName: string;
  email?: string;
  role?: 'Docente' | 'JefeEspecialidad' | 'Estudiante' | 'TutorEmpresa' | 'Directivo';
}
