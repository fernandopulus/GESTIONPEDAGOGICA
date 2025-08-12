// src/utils/grades.ts
import { EXIGENCIA_APROBACION } from '../firebaseHelpers/constants';

/**
 * Escala 2.0–7.0 con exigencia (por defecto 60%).
 * Devuelve string con 1 decimal (p.ej. "5.4").
 */
export const calcularNota60 = (
  puntaje: number,
  puntajeMaximo: number,
  exigencia = EXIGENCIA_APROBACION,
  minNota = 2.0
): string => {
  if (!puntajeMaximo || puntajeMaximo <= 0) return minNota.toFixed(1);

  const aprob = puntajeMaximo * exigencia;
  let nota: number;

  if (puntaje >= aprob) {
    // tramo superior: 4.0 → 7.0
    nota = 4 + (3 * (puntaje - aprob)) / (puntajeMaximo - aprob + 1e-9);
  } else {
    // tramo inferior: minNota → 4.0 (antes partía en 1.0; ahora se clampa a minNota)
    nota = 1 + (3 * puntaje) / (aprob + 1e-9);
  }

  // Ajuste de bordes: mínimo 2.0 y máximo 7.0
  nota = Math.max(minNota, Math.min(7, nota));
  return nota.toFixed(1);
};
