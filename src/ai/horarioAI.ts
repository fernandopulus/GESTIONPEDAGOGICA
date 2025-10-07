// Generador de horarios con IA (Gemini) y fallback determinístico
// Crea un horario semanal sin topes de profesor a partir de asignaciones de carga horaria.

import { generarConIA } from './geminiHelper';
import { DIAS_SEMANA, HORARIO_BLOQUES } from '../../constants';
import type { AsignacionCargaHoraria, DocenteCargaHoraria, HorariosGenerados, HorarioCelda } from '../../types';

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
): ResultadoGeneracionHorario {
	const horarios = shapeVacia();
	const pendiente = demanda.map(d => ({ ...d }));

	// Índices de ocupación por slot (dia|bloque)
	const ocupadoCurso: Record<string, Record<string, boolean>> = {}; // curso -> slot -> ocupado
	const ocupadoDocente: Record<string, Record<string, boolean>> = {}; // docente -> slot -> ocupado

	function slotKey(dia: string, bloque: number) {
		return `${dia}|${bloque}`;
	}

	for (const curso of cursos) ocupadoCurso[curso] = {};

	// Materias con más horas primero
	pendiente.sort((a, b) => b.horas - a.horas);

	for (const item of pendiente) {
		let restantes = item.horas;
		outer: while (restantes > 0) {
			let asignado = false;
			for (const dia of DIAS_SEMANA) {
				for (const b of HORARIO_BLOQUES) {
					const bk = b.bloque;
					const sKey = slotKey(dia, bk);
					const cursoYa = ocupadoCurso[item.curso]?.[sKey];
					const docenteYa = ocupadoDocente[item.docente]?.[sKey];
					const celdaActual = horarios[dia][String(bk)][item.curso];
					if (!cursoYa && !docenteYa && !celdaActual) {
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

	conflictos.push(...validarConflictos(horarios));
	return { horarios, conflictos, fuente: 'fallback' };
}

export async function generarHorarioSemanalConIA(
	asignaciones: AsignacionCargaHoraria[],
	docentes: DocenteCargaHoraria[],
	cursos: string[],
): Promise<ResultadoGeneracionHorario> {
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
- Distribuye equilibradamente a lo largo de la semana.

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
		return { horarios, conflictos, fuente: 'IA' };
	} catch (e) {
		if (e instanceof Error && e.message === 'IA_NOT_AVAILABLE') {
			console.warn('IA no disponible. Generando horario con algoritmo fallback.');
		} else {
			console.warn('Falla IA en generación de horario, usando fallback:', e);
		}
		return generarFallback(demanda, cursos);
	}
}

