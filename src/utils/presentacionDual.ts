import { PresentacionDualEstado, PresentacionDualRubricSelection } from '../../types';
import {
  PRESENTACION_DUAL_INDICADORES,
  PRESENTACION_DUAL_MAX_SCORE,
  PRESENTACION_DUAL_EXIGENCIA,
} from '../../constants/presentacionDualRubric';

export const PRESENTACION_DUAL_MIN_GRADE = 2;
export const PRESENTACION_DUAL_MAX_GRADE = 4;

export const sumRubricScore = (rubric: PresentacionDualRubricSelection[] = []): number =>
  rubric.reduce((acc, item) => acc + (item.puntaje ?? 0), 0);

export const isRubricComplete = (rubric: PresentacionDualRubricSelection[] = []): boolean =>
  rubric.length === PRESENTACION_DUAL_INDICADORES.length && rubric.every(item => item.puntaje && item.puntaje > 0);

export const calcularNotaPresentacionDual = (
  puntajeTotal: number,
  puntajeMaximo: number = PRESENTACION_DUAL_MAX_SCORE
): number => {
  if (!puntajeMaximo || puntajeMaximo <= 0) {
    return PRESENTACION_DUAL_MIN_GRADE;
  }

  const porcentaje = Math.max(0, Math.min(1, puntajeTotal / puntajeMaximo));
  const nota = PRESENTACION_DUAL_MIN_GRADE + porcentaje * (PRESENTACION_DUAL_MAX_GRADE - PRESENTACION_DUAL_MIN_GRADE);
  return parseFloat(nota.toFixed(1));
};

export const determinarEstadoPresentacionDual = (
  puntajeTotal: number,
  puntajeMaximo: number,
  rubricComplete: boolean,
  exigencia: number = PRESENTACION_DUAL_EXIGENCIA
): PresentacionDualEstado => {
  if (!rubricComplete || puntajeTotal <= 0 || !puntajeMaximo) {
    return 'Pendiente';
  }

  const porcentaje = puntajeTotal / puntajeMaximo;
  return porcentaje >= exigencia ? 'Aprobada' : 'Retroalimentada';
};

export const buildEmptyRubricSelections = (): PresentacionDualRubricSelection[] =>
  PRESENTACION_DUAL_INDICADORES.map(indicador => ({
    indicadorId: indicador.id,
    nivel: 'DEBIL',
    puntaje: 0,
  }));
