import { ConfigEvaluacion, NivelLogroCompetencias, ContextoEvaluacion } from "../types";

// Niveles de logro ordenados por progresión
export const NIVEL_LOGRO_VALUES: NivelLogroCompetencias[] = [
    'INCIPIENTE',
    'EN_DESARROLLO',
    'LOGRADO',
    'SOBRESALIENTE'
];

// Mapeo de niveles a puntaje base (para cálculo de notas)
export const NIVEL_A_PUNTAJE_BASE: Record<NivelLogroCompetencias, number> = {
    'INCIPIENTE': 25,
    'EN_DESARROLLO': 50,
    'LOGRADO': 75,
    'SOBRESALIENTE': 100
};

// Contextos de evaluación posibles
export const CONTEXTOS: ContextoEvaluacion[] = ['AULA', 'TALLER', 'EMPRESA'];

// Configuración por defecto para cálculo de notas
export const DEFAULT_CONFIG_EVALUACION: ConfigEvaluacion = {
    escalaMin: 1.0,
    escalaMax: 7.0,
    porcentajeAprobacion: 60,
    notaAprobacion: 4.0,
    regla: 'lineal'
};
