// Generador de horarios con IA (Gemini) y fallback determinístico
// Crea un horario semanal sin topes de profesor a partir de asignaciones de carga horaria.

import { generarConIA } from './geminiHelper';
import { DIAS_SEMANA, HORARIO_BLOQUES } from '../../constants';
import type { AsignacionCargaHoraria, DocenteCargaHoraria, HorariosGenerados, HorarioCelda } from '../../types';

export type ReglasGeneracion = {
	maxConsecutivasMecanica?: number; // 1-10
	maxConsecutivasPlanGeneral?: number; // 1-3
	practicasPM?: boolean;
	terceroSoloPlanGeneral?: boolean;
};

export type ResultadoGeneracionHorario = {
	horarios: HorariosGenerados;
	conflictos: string[];
	fuente: 'IA' | 'fallback';
};

type SolicitudIA = {
	dias: string[];
	bloques: { bloque: number; inicio: string; fin: string }[];
	cursos: string[];
	demanda: Array<{
		curso: string;
		asignatura: string;
		docente: string;
		horas: number;
	}>;
};

type SesionCurso = {
	curso: string;
	dia: string; // "Lunes" ...
	bloque: number; // 1..N
	asignatura: string;
	docente: string;
};

type RespuestaIA = {
	sesiones: SesionCurso[];
};

// Helpers de tiempo y reglas
const minutos = (hhmm: string): number => {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
};

const esViernes = (dia: string) => dia === 'Viernes';
const bloquePermitido = (dia: string, bloque: number): boolean => {
	if (!esViernes(dia)) return true;
	const b = HORARIO_BLOQUES.find(x => x.bloque === bloque);
	return !!b && minutos(b.fin) <= minutos('13:00');
};

// Clasificadores simples de asignaturas (ajustables a futuro)
const esMecanica = (asignatura: string): boolean => {
	const a = (asignatura || '').toLowerCase();
	return [
		'mecánica', 'mecanica', 'taller', 'máquinas', 'maquinas', 'automotriz', 'electromecánica', 'electromecanica', 'metal', 'soldadura', 'tp'
	].some(k => a.includes(k));
};

const esPlanGeneral = (asignatura: string): boolean => {
	const a = (asignatura || '').toLowerCase();
	return [
		'lenguaje', 'matem', 'historia', 'inglés', 'ingles', 'ciencias', 'biología', 'biologia', 'química', 'quimica', 'física', 'fisica', 'ed. física', 'educación física', 'ciudadanía', 'ciudadania'
	].some(k => a.includes(k));
};

const esPractica = (asignatura: string): boolean => {
	const a = (asignatura || '').toLowerCase();
	return [ 'taller', 'práctica', 'practica', 'laboratorio', 'mecánica', 'mecanica', 'electr', 'maquin', 'tp' ].some(k => a.includes(k));
};

const esPM = (bloque: number): boolean => {
	const b = HORARIO_BLOQUES.find(x => x.bloque === bloque);
	if (!b) return false;
	return minutos(b.inicio) >= minutos('13:40');
};

function shapeVacia(): HorariosGenerados {
	const horarios: any = {};
	for (const dia of DIAS_SEMANA) {
		horarios[dia] = {};
		for (const b of HORARIO_BLOQUES) {
			const bloqueKey = String(b.bloque);
			horarios[dia][bloqueKey] = {};
		}
	}
	return horarios as HorariosGenerados;
}

function validarConflictos(horarios: HorariosGenerados): string[] {
	const conflictos: string[] = [];
	for (const dia of Object.keys(horarios)) {
		const bloques = horarios[dia];
		for (const bloqueKey of Object.keys(bloques)) {
			const cursos = bloques[bloqueKey];
			const docentesEnBloque = new Map<string, string[]>(); // docente -> cursos
			for (const curso of Object.keys(cursos)) {
				const celda = cursos[curso];
				if (celda?.profesor) {
					const lista = docentesEnBloque.get(celda.profesor) || [];
					lista.push(curso);
					docentesEnBloque.set(celda.profesor, lista);
				}
			}
			for (const [docente, cs] of docentesEnBloque.entries()) {
				if (cs.length > 1) {
					conflictos.push(`Tope docente ${docente} el ${dia} bloque ${bloqueKey} en cursos: ${cs.join(', ')}`);
				}
			}
		}
	}
	return conflictos;
}

function construirDesdeSesiones(sesiones: SesionCurso[], cursos: string[]): HorariosGenerados {
	const horarios = shapeVacia();
	for (const ses of sesiones) {
		if (!horarios[ses.dia]) continue;
		const bloqueKey = String(ses.bloque);
		if (!horarios[ses.dia][bloqueKey]) continue;
		if (!cursos.includes(ses.curso)) continue;
		horarios[ses.dia][bloqueKey][ses.curso] = {
			asignatura: ses.asignatura,
			profesor: ses.docente,
		} as HorarioCelda;
	}
	return horarios;
}

function generarFallback(
	demanda: SolicitudIA['demanda'],
	cursos: string[],
	reglas: ReglasGeneracion,
): ResultadoGeneracionHorario {
	const horarios = shapeVacia();
	const pendiente = demanda.map(d => ({ ...d }));

	// Índices de ocupación por slot (dia|bloque)
	const ocupadoCurso: Record<string, Record<string, boolean>> = {}; // curso -> slot -> ocupado
	const ocupadoDocente: Record<string, Record<string, boolean>> = {}; // docente -> slot -> ocupado

	const slotKey = (dia: string, bloque: number) => `${dia}|${bloque}`;

	for (const curso of cursos) ocupadoCurso[curso] = {};

	// Materias con más horas primero
	pendiente.sort((a, b) => b.horas - a.horas);

	// Helper para obtener bloques ocupados de un curso en un día
	const bloquesOcupadosCursoEnDia = (curso: string, dia: string): number[] => {
		return HORARIO_BLOQUES
			.map(b => b.bloque)
			.filter(bk => !!horarios[dia][String(bk)][curso]);
	};

	for (const item of pendiente) {
		let restantes = item.horas;
		outer: while (restantes > 0) {
			let asignado = false;

			// Ordenar días: primero los que ya tienen algo del curso (para evitar más dispersión),
			// luego los vacíos. Dentro de cada día, intentar ubicar en tramos contiguos.
			const diasOrdenados = [...DIAS_SEMANA].sort((d1, d2) => {
				const o1 = bloquesOcupadosCursoEnDia(item.curso, d1).length;
				const o2 = bloquesOcupadosCursoEnDia(item.curso, d2).length;
				return o2 - o1; // más ocupados primero para agrupar
			});

			for (const dia of diasOrdenados) {
				// Regla: 3º medio solo plan general
				if (reglas.terceroSoloPlanGeneral && typeof item.curso === 'string' && item.curso.trim().startsWith('3º')) {
					if (!esPlanGeneral(item.asignatura)) {
						// No ubicar, salta a siguiente día para intentar, pero en la práctica nunca asignará
						continue;
					}
				}
				// Intentar recorrer bloques respetando límite de viernes y agrupando contiguo
				for (let bi = 0; bi < HORARIO_BLOQUES.length; bi++) {
					const b = HORARIO_BLOQUES[bi];
					const bk = b.bloque;
					if (!bloquePermitido(dia, bk)) continue;
					// Regla: prácticas en PM
					if (reglas.practicasPM && esPractica(item.asignatura) && !esPM(bk)) continue;
					const sKey = slotKey(dia, bk);
					const cursoYa = ocupadoCurso[item.curso]?.[sKey];
					const docenteYa = ocupadoDocente[item.docente]?.[sKey];
					const celdaActual = horarios[dia][String(bk)][item.curso];
					if (!cursoYa && !docenteYa && !celdaActual) {
						// Reglas de máximos consecutivos por categoría
						const categoriaMec = esMecanica(item.asignatura);
						const categoriaPG = esPlanGeneral(item.asignatura);
						const maxMec = Math.max(1, Math.min(10, reglas.maxConsecutivasMecanica ?? 10));
						const maxPG = Math.max(1, Math.min(3, reglas.maxConsecutivasPlanGeneral ?? 3));
						// Calcular racha actual contigua de la misma categoría para el curso este día alrededor del bloque
						const countConsecutivos = (categoria: 'mec' | 'pg'): number => {
							const esCat = (asig: string) => categoria === 'mec' ? esMecanica(asig) : esPlanGeneral(asig);
							let count = 0;
							// hacia atrás
							for (let bj = bi - 1; bj >= 0; bj--) {
								const bkPrev = HORARIO_BLOQUES[bj].bloque;
								const celda = horarios[dia][String(bkPrev)][item.curso];
								if (!celda) break;
								if (esCat(celda.asignatura)) count++; else break;
							}
							// hacia adelante
							for (let bj = bi + 1; bj < HORARIO_BLOQUES.length; bj++) {
								const bkNext = HORARIO_BLOQUES[bj].bloque;
								const celda = horarios[dia][String(bkNext)][item.curso];
								if (!celda) break;
								if (esCat(celda.asignatura)) count++; else break;
							}
							return count;
						};

						if (categoriaMec && countConsecutivos('mec') + 1 > maxMec) continue;
						if (categoriaPG && countConsecutivos('pg') + 1 > maxPG) continue;

						horarios[dia][String(bk)][item.curso] = {
							asignatura: item.asignatura,
							profesor: item.docente,
						};
						ocupadoCurso[item.curso][sKey] = true;
						ocupadoDocente[item.docente] = ocupadoDocente[item.docente] || {};
						ocupadoDocente[item.docente][sKey] = true;
						restantes--;
						asignado = true;
						if (restantes === 0) break outer;

						// Intentar inmediatamente el siguiente bloque contiguo en el mismo día para evitar ventanas
						const siguiente = HORARIO_BLOQUES[bi + 1];
						if (siguiente && bloquePermitido(dia, siguiente.bloque)) {
							const s2 = slotKey(dia, siguiente.bloque);
							const c2 = horarios[dia][String(siguiente.bloque)][item.curso];
							const d2 = ocupadoDocente[item.docente]?.[s2];
							// Repetir contiguo sólo si no viola máximos por categoría y reglas PM
							const puedeColocarContiguo = () => {
							  if (reglas.practicasPM && esPractica(item.asignatura) && !esPM(siguiente.bloque)) return false;
							  const categoriaMec2 = esMecanica(item.asignatura);
							  const categoriaPG2 = esPlanGeneral(item.asignatura);
							  // Calcular racha si se colocara también el siguiente
							  const countCat = (categoria: 'mec' | 'pg'): number => {
								const esCat = (asig: string) => categoria === 'mec' ? esMecanica(asig) : esPlanGeneral(asig);
								let count = 1; // incluir el ya colocado actual
								// hacia atrás del bloque actual
								for (let bj = bi - 1; bj >= 0; bj--) {
								  const bkPrev = HORARIO_BLOQUES[bj].bloque;
								  const celda = horarios[dia][String(bkPrev)][item.curso];
								  if (!celda) break;
								  if (esCat(celda.asignatura)) count++; else break;
								}
								// sumar el siguiente si fuese de la misma categoría (lo será por ser misma asignatura)
								count++;
								return count;
							  };
							  if (categoriaMec2 && countCat('mec') > (reglas.maxConsecutivasMecanica ?? 10)) return false;
							  if (categoriaPG2 && countCat('pg') > (reglas.maxConsecutivasPlanGeneral ?? 3)) return false;
							  return true;
							};
							if (restantes > 0 && !ocupadoCurso[item.curso]?.[s2] && !d2 && !c2 && puedeColocarContiguo()) {
								horarios[dia][String(siguiente.bloque)][item.curso] = {
									asignatura: item.asignatura,
									profesor: item.docente,
								};
								ocupadoCurso[item.curso][s2] = true;
								ocupadoDocente[item.docente][s2] = true;
								restantes--;
								if (restantes === 0) break outer;
							}
						}
					}
				}
			}
			if (!asignado) break; // no hay slot disponible para este ítem
		}
	}

	// Conflictos por horas no ubicadas
	const conflictos: string[] = [];
	for (const d of pendiente) {
		let ubicadas = 0;
		for (const dia of DIAS_SEMANA) {
			for (const b of HORARIO_BLOQUES) {
				const celda = horarios[dia][String(b.bloque)][d.curso];
				if (celda && celda.asignatura === d.asignatura && celda.profesor === d.docente) {
					ubicadas++;
				}
			}
		}
		const faltan = d.horas - ubicadas;
		if (faltan > 0) conflictos.push(`No se pudieron ubicar ${faltan} bloque(s) para ${d.asignatura} (${d.curso}) con ${d.docente}`);
	}

	// Validación de ventanas: detectar huecos innecesarios por curso en cada día
	for (const curso of cursos) {
		for (const dia of DIAS_SEMANA) {
			const ocupados = HORARIO_BLOQUES
				.map(b => b.bloque)
				.filter(bk => !!horarios[dia][String(bk)][curso]);
			if (ocupados.length > 0) {
				const minBk = Math.min(...ocupados);
				const maxBk = Math.max(...ocupados);
				for (let bk = minBk; bk <= maxBk; bk++) {
					if (!horarios[dia][String(bk)][curso]) {
						conflictos.push(`Ventana detectada en ${curso} el ${dia} entre bloques ${minBk}–${maxBk}`);
						break;
					}
				}
			}
		}
	}

	conflictos.push(...validarConflictos(horarios));
	return { horarios, conflictos, fuente: 'fallback' };
}

export async function generarHorarioSemanalConIA(
	asignaciones: AsignacionCargaHoraria[],
	docentes: DocenteCargaHoraria[],
	cursos: string[],
	reglas?: ReglasGeneracion,
): Promise<ResultadoGeneracionHorario> {
	const reglasCfg: ReglasGeneracion = {
		maxConsecutivasMecanica: reglas?.maxConsecutivasMecanica ?? 10,
		maxConsecutivasPlanGeneral: reglas?.maxConsecutivasPlanGeneral ?? 3,
		practicasPM: reglas?.practicasPM ?? false,
		terceroSoloPlanGeneral: reglas?.terceroSoloPlanGeneral ?? false,
	};
	// Preparar demanda a partir de horasPorCurso
	const demanda: SolicitudIA['demanda'] = [];
	for (const asig of asignaciones) {
		const docenteNombre = asig.docenteNombre || docentes.find(d => d.id === asig.docenteId)?.nombre || 'Docente';
		for (const [curso, horas] of Object.entries(asig.horasPorCurso || {})) {
			const h = typeof horas === 'number' ? horas : 0;
			if (h > 0 && curso) {
				demanda.push({
					curso,
					asignatura: asig.asignaturaOModulo || 'Asignatura',
					docente: docenteNombre,
					horas: h,
				});
			}
		}
	}

	if (demanda.length === 0) {
		return { horarios: shapeVacia(), conflictos: [], fuente: 'fallback' };
	}

	// Intentar IA primero
	try {
		const solicitud: SolicitudIA = {
			dias: DIAS_SEMANA,
			bloques: HORARIO_BLOQUES,
			cursos,
			demanda,
		};

		const prompt = `Genera un horario semanal sin topes de profesor entre cursos.
Reglas:
- Un docente no puede estar en más de un curso en el mismo día y bloque.
- Cada item de demanda representa cuántos bloques deben ubicarse.
- Usa solamente los días y bloques provistos.
- Distribuye equilibradamente a lo largo de la semana evitando ventanas (huecos) y procurando no dejar días completamente vacíos por curso.
- El día Viernes no se pueden asignar bloques que terminen después de las 13:00.
 - Máximo de bloques consecutivos de asignaturas de mecánica: ${reglasCfg.maxConsecutivasMecanica}.
 - Máximo de bloques consecutivos de asignaturas de plan general: ${reglasCfg.maxConsecutivasPlanGeneral}.
 - ${reglasCfg.practicasPM ? 'Las asignaturas prácticas (taller/práctica/laboratorio/TP) deben ubicarse en horario PM (desde 13:40).' : 'Preferir, si es posible, las asignaturas prácticas en PM, pero no obligatorio.'}
 - ${reglasCfg.terceroSoloPlanGeneral ? 'Para cursos de 3º medio (3ºA, 3ºB, etc.), solo ubicar asignaturas de plan general.' : 'Sin restricción especial para 3º medio.'}

Entrada JSON:
${JSON.stringify(solicitud, null, 2)}

Devuelve SOLO JSON válido con el formato:
{
	"sesiones": [
		{ "curso": "1ºA", "dia": "Lunes", "bloque": 1, "asignatura": "Matemática", "docente": "Nombre" }
	]
}`;

		const texto = await generarConIA(prompt, 1, true);
		let jsonText = texto;
		const codeMatch = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (codeMatch && codeMatch[1]) jsonText = codeMatch[1];
		const parsed = JSON.parse(jsonText) as RespuestaIA;
		if (!parsed?.sesiones?.length) throw new Error('Respuesta IA sin sesiones');

		const horarios = construirDesdeSesiones(parsed.sesiones, cursos);
		const conflictos = validarConflictos(horarios);
		// Validación adicional sobre reglas (por si IA incumple)
		const conflictosReglas: string[] = [];
		// Revisar rachas por curso/día
		for (const curso of cursos) {
			for (const dia of DIAS_SEMANA) {
				let rachaMec = 0; let rachaPG = 0;
				for (const b of HORARIO_BLOQUES) {
					const celda = horarios[dia][String(b.bloque)][curso];
					if (celda) {
						if (esMecanica(celda.asignatura)) { rachaMec++; } else rachaMec = 0;
						if (esPlanGeneral(celda.asignatura)) { rachaPG++; } else rachaPG = 0;
						if (rachaMec > (reglasCfg.maxConsecutivasMecanica ?? 10)) conflictosReglas.push(`Exceso mecánica consecutiva en ${curso} ${dia}`);
						if (rachaPG > (reglasCfg.maxConsecutivasPlanGeneral ?? 3)) conflictosReglas.push(`Exceso plan general consecutiva en ${curso} ${dia}`);
						if (reglasCfg.practicasPM && esPractica(celda.asignatura) && !esPM(b.bloque)) conflictosReglas.push(`Práctica fuera de PM en ${curso} ${dia} bloque ${b.bloque}`);
						if (reglasCfg.terceroSoloPlanGeneral && curso.trim().startsWith('3º') && !esPlanGeneral(celda.asignatura)) conflictosReglas.push(`3º medio con asignatura no plan general en ${curso} ${dia} bloque ${b.bloque}`);
					}
				}
			}
		}
		return { horarios, conflictos: [...conflictos, ...conflictosReglas], fuente: 'IA' };
	} catch (e) {
		if (e instanceof Error && e.message === 'IA_NOT_AVAILABLE') {
			console.warn('IA no disponible. Generando horario con algoritmo fallback.');
		} else {
			console.warn('Falla IA en generación de horario, usando fallback:', e);
		}
		return generarFallback(demanda, cursos, reglasCfg);
	}
}

