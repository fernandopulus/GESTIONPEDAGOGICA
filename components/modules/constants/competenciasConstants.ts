
// src/constants/competenciasConstants.ts
import { NivelLogro, ConfigEvaluacion } from "../types/competencias";

export const NIVEL_LOGRO_VALUES: NivelLogro[] = [
  'INCIPIENTE',
  'EN_DESARROLLO',
  'LOGRADO',
  'SOBRESALIENTE',
];

export const CONTEXTOS: Array<'AULA'|'TALLER'|'EMPRESA'> = ['AULA','TALLER','EMPRESA'];

export const TIPOS_INSTRUMENTO = [
  'RÚBRICA',
  'LISTA_DE_COTEJO',
  'GUÍA_DE_OBSERVACIÓN',
  'PRUEBA_PRÁCTICA',
  'PRUEBA_ESCRITA'
] as const;

export const DEFAULT_CONFIG_EVALUACION: ConfigEvaluacion = {
  escalaMin: 1,
  escalaMax: 7,
  porcentajeAprobacion: 60,
  notaAprobacion: 4,
  regla: 'lineal'
};

// Conversión sugerida de nivel a puntaje base (se puede sobrescribir en rúbrica)
export const NIVEL_A_PUNTAJE_BASE: Record<NivelLogro, number> = {
  INCIPIENTE: 25,
  'EN_DESARROLLO': 50,
  LOGRADO: 75,
  SOBRESALIENTE: 100,
};
