import { onCall, onRequest } from "firebase-functions/v2/https";
import { callGemini, isAuthenticated } from "./aiHelpers";
import { HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from 'firebase-admin';

// Inicializar Firebase Admin si aún no se hizo (seguro si se importa desde otro módulo)
if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp();
}

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Tipos de datos (puedes moverlos a un archivo de tipos si es necesario)
interface Rubrica {
    nombre: string;
    descripcion: string;
    dimensiones: Dimension[];
}

interface Dimension {
    nombre: string;
    descripcion: string;
    descriptores: Descriptor[];
}

interface Descriptor {
    nivel: string;
    descripcion: string;
}

interface Prueba {
    nombre: string;
    objetivo: string;
    preguntas: Pregunta[];
}

interface Pregunta {
    enunciado: string;
    alternativas: { texto: string; esCorrecta: boolean }[];
    tipo: 'seleccion_multiple' | 'verdadero_falso' | 'respuesta_corta';
}


// ==========================
// Normalizador unificado → Pregunta para el frontend
// ==========================

const letterToIndex = (v: any): number => {
    const s = String(v ?? '').trim().toUpperCase();
    const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    if (s in map) return map[s];
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0;
};

const ensureFourStrings = (arr: any[]): string[] => {
    const out = (Array.isArray(arr) ? arr : []).map((x) =>
        typeof x === 'string' ? x : (typeof x?.texto === 'string' ? x.texto : String(x ?? ''))
    ).slice(0, 4);
    while (out.length < 4) out.push('');
    return out;
};

export const toFrontSM = (enunciado: string, opciones: string[], correctIdx: number): Pregunta => {
    const ops = ensureFourStrings(opciones);
    const idx = Math.max(0, Math.min(3, correctIdx | 0));
    const alternativas = ops.map((texto, i) => ({ texto, esCorrecta: i === idx }));
    return { enunciado: enunciado?.trim() || 'Pregunta', alternativas, tipo: 'seleccion_multiple' };
};

export const toFrontVF = (enunciado: string, verdadero: boolean): Pregunta => {
    const ops = ['Verdadero', 'Falso', '', ''];
    const idx = verdadero ? 0 : 1;
    const alternativas = ops.map((texto, i) => ({ texto, esCorrecta: i === idx }));
    return { enunciado: enunciado?.trim() || 'Afirmación', alternativas, tipo: 'verdadero_falso' };
};

export const toFrontDEV = (enunciado: string): Pregunta => {
    const alternativas = Array.from({ length: 4 }, () => ({ texto: '', esCorrecta: false }));
    return { enunciado: enunciado?.trim() || 'Pregunta abierta', alternativas, tipo: 'respuesta_corta' };
};

export const normalizeOneRawToFront = (raw: any): Pregunta[] => {
    const result: Pregunta[] = [];
    if (!raw) return result;

    const getEnun = (): string => raw.pregunta || raw.enunciado || raw.texto || raw.titulo || '';

    // 1) Comprensión de lectura: { texto, preguntas: [] }
    if (raw.texto && Array.isArray(raw.preguntas)) {
        const textoBase = typeof raw.texto === 'string' ? raw.texto : String(raw.texto);
        for (const sub of raw.preguntas) {
            const subs = normalizeOneRawToFront(sub);
            for (const p of subs) {
                result.push({
                    ...p,
                    enunciado: `${textoBase}\n\n${p.enunciado}`.trim(),
                });
            }
        }
        return result;
    }

    // 2) Términos pareados → 1–4 preguntas SM
    if (Array.isArray(raw.pares) && raw.pares.length > 0) {
        const pares = raw.pares.filter((p: any) => p?.concepto && p?.definicion);
        const defs = pares.map((p: any) => String(p.definicion));
        const maxQ = Math.min(4, pares.length);
        for (let i = 0; i < maxQ; i++) {
            const par = pares[i];
            const correct = String(par.definicion);
            const distractores = defs.filter((d: any) => d !== correct).slice(0, 3);
            const opciones = [correct, ...distractores];
            while (opciones.length < 4) opciones.push('');
            const enun = `¿Cuál definición corresponde a "${String(par.concepto)}"?`;
            result.push(toFrontSM(enun, opciones, 0));
        }
        return result;
    }

    // 3) Verdadero/Falso variantes
    const hasVF = ((): null | boolean => {
        if (typeof raw.respuestaCorrecta === 'boolean') return raw.respuestaCorrecta;
        if (typeof raw.esVerdadero === 'boolean') return raw.esVerdadero;
        const c = String(raw.correcta ?? raw.respuesta ?? '').trim().toUpperCase();
        if (c === 'V' || c === 'VERDADERO' || c === 'TRUE') return true;
        if (c === 'F' || c === 'FALSO' || c === 'FALSE') return false;
        return null;
    })();
    if (hasVF !== null) {
        result.push(toFrontVF(getEnun(), Boolean(hasVF)));
        return result;
    }

    // 4) Selección múltiple (opciones/alternativas con correcta)
    const opcionesSM = raw.opciones || raw.alternativas;
    if (Array.isArray(opcionesSM) && opcionesSM.length > 0) {
        const ops = ensureFourStrings(opcionesSM);
        let idx = 0;
        if (Array.isArray(raw.alternativas)) {
            const found = raw.alternativas.findIndex((a: any) => a && (a.esCorrecta === true || a.correcta === true));
            if (found >= 0) idx = Math.min(3, found);
        }
        if ('respuestaCorrecta' in raw || 'correcta' in raw || 'respuesta' in raw) {
            idx = letterToIndex(raw.respuestaCorrecta ?? raw.correcta ?? raw.respuesta);
        } else if (typeof raw.indiceCorrecto === 'number') {
            idx = Math.max(0, Math.min(3, raw.indiceCorrecto));
        }
        result.push(toFrontSM(getEnun(), ops, idx));
        return result;
    }

    // 5) Desarrollo / respuesta corta
    if (/desarrollo|respuesta corta|abierta/i.test(String(raw.tipo || '')) || (!raw.opciones && !raw.alternativas && !raw.pares)) {
        const enun = getEnun();
        if (typeof enun === 'string' && enun.trim().length > 0) {
            result.push(toFrontDEV(enun));
            return result;
        }
    }

    // 6) Sin reconocimiento → descartar
    return result;
};

export const normalizeManyToFront = (items: any[]): Pregunta[] => {
    const out: Pregunta[] = [];
    for (const it of Array.isArray(items) ? items : []) {
        const arr = normalizeOneRawToFront(it);
        for (const p of arr) {
            // Validación final
            const enunOk = typeof p.enunciado === 'string' && p.enunciado.trim().length > 0;
            const altOk = Array.isArray(p.alternativas) && p.alternativas.length === 4;
            const tipoOk = p.tipo === 'seleccion_multiple' || p.tipo === 'verdadero_falso' || p.tipo === 'respuesta_corta';
            if (enunOk && altOk && tipoOk) out.push(p);
        }
    }
    return out;
};


/**
 * Genera una rúbrica completa utilizando la IA de Gemini.
 */
export const generarRubricaConGemini = onCall({ secrets: [geminiApiKey] }, async (request) => {
    isAuthenticated(request);

    const { objetivo, niveles, dimensiones, contextoAdicional } = request.data;

    if (!objetivo || !niveles || !dimensiones) {
        throw new HttpsError("invalid-argument", "Faltan parámetros requeridos (objetivo, niveles, dimensiones).");
    }

    const prompt = `
        Por favor, genera una rúbrica de evaluación en formato JSON.
        La rúbrica debe evaluar el siguiente objetivo de aprendizaje: "${objetivo}".
        
        La estructura de la rúbrica debe ser la siguiente:
        - Nombre de la rúbrica (string)
        - Descripción de la rúbrica (string)
        - Un array de "dimensiones" (las dimensiones a evaluar).

        Las dimensiones que necesito son: ${dimensiones.join(", ")}.
        
        Cada dimensión debe tener:
        - Nombre de la dimensión (string).
        - Descripción de la dimensión (string).
        - Un array de "descriptores".

        Cada descriptor debe corresponder a un nivel de logro y tener:
        - Nivel (string, por ejemplo: "Logrado", "En Desarrollo", "Por Lograr").
        - Descripción (string, detallando qué se espera para ese nivel en esa dimensión).

        Los niveles de logro son: ${niveles.join(", ")}.

        ${contextoAdicional ? `Considera el siguiente contexto adicional: ${contextoAdicional}` : ""}

        Ejemplo de formato de salida JSON:
        {
          "nombre": "Rúbrica para evaluar la resolución de problemas",
          "descripcion": "Esta rúbrica evalúa la capacidad del estudiante para resolver problemas complejos.",
          "dimensiones": [
            {
              "nombre": "Análisis del Problema",
              "descripcion": "Capacidad para identificar y comprender los componentes clave de un problema.",
              "descriptores": [
                { "nivel": "Logrado", "descripcion": "Identifica completa y precisamente todos los componentes del problema." },
                { "nivel": "En Desarrollo", "descripcion": "Identifica la mayoría de los componentes del problema, pero con algunas omisiones." },
                { "nivel": "Por Lograr", "descripcion": "No logra identificar los componentes esenciales del problema." }
              ]
            }
          ]
        }

        IMPORTANTE: Responde únicamente con el objeto JSON, sin texto adicional, explicaciones o saltos de línea antes o después. El JSON debe ser válido.
    `;

    try {
    const { text: aiResponseText, modelUsed } = await callGemini({ prompt });
    // Intenta limpiar y parsear la respuesta
    const jsonString = aiResponseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const rubrica = JSON.parse(jsonString) as Rubrica;
    return { success: true, rubrica, modelUsed };
    } catch (error) {
        console.error("Error al generar o parsear la rúbrica:", error);
        throw new HttpsError("internal", "No se pudo generar la rúbrica con IA. Inténtalo de nuevo.");
    }
});


/**
 * Genera la descripción para un descriptor específico de una dimensión de la rúbrica.
 */
export const generarDescriptorDimensionConGemini = onCall({ secrets: [geminiApiKey] }, async (request) => {
    isAuthenticated(request);

    const { dimension, nivel, objetivo, contextoAdicional } = request.data;

    if (!dimension || !nivel || !objetivo) {
        throw new HttpsError("invalid-argument", "Faltan parámetros requeridos (dimension, nivel, objetivo).");
    }

    const prompt = `
        Por favor, genera una descripción detallada para un descriptor de una rúbrica de evaluación.

        - Objetivo de la evaluación: "${objetivo}"
        - Dimensión a evaluar: "${dimension}"
        - Nivel de logro: "${nivel}"
        
        ${contextoAdicional ? `Considera el siguiente contexto adicional: ${contextoAdicional}` : ""}

        La descripción debe ser clara, concisa y observable. Debe describir qué evidencia o rendimiento se espera de un estudiante que se encuentra en el nivel "${nivel}" para la dimensión "${dimension}".

        IMPORTANTE: Responde únicamente con el texto de la descripción, sin frases introductorias como "Aquí está la descripción:" o similar.
    `;

    try {
    const { text: descripcion, modelUsed } = await callGemini({ prompt });
    return { success: true, descripcion, modelUsed };
    } catch (error) {
        console.error("Error al generar el descriptor:", error);
        throw new HttpsError("internal", "No se pudo generar la descripción con IA. Inténtalo de nuevo.");
    }
});


/**
 * Genera una prueba o evaluación completa con preguntas y alternativas.
 */

export const generarPruebaConGemini = onCall({ secrets: [geminiApiKey] }, async (request) => {
    isAuthenticated(request);

    const { objetivo, cantidadesPorTipo, contextoAdicional } = request.data;

    if (!objetivo || !cantidadesPorTipo || typeof cantidadesPorTipo !== 'object') {
        throw new HttpsError("invalid-argument", "Faltan parámetros requeridos (objetivo, cantidadesPorTipo).");
    }

    try {
        // Reusar la lógica existente: construir array de preguntas usando helper por tipo
        const todasLasPreguntas: any[] = [];
        for (const tipo in cantidadesPorTipo) {
            const cantidad = cantidadesPorTipo[tipo];
            if (!cantidad || cantidad < 1) continue;
            const preguntasGeneradas = await generateQuestionsForTipo(tipo, cantidad, objetivo, contextoAdicional);
            todasLasPreguntas.push(...preguntasGeneradas);
        }

        // Normalizar a formato Pregunta[] para el frontend
        const preguntasFront: Pregunta[] = normalizeManyToFront(todasLasPreguntas);
        const prueba: Prueba = { nombre: 'Prueba generada', objetivo, preguntas: preguntasFront };
        return { success: true, prueba };
    } catch (error) {
        console.error(`Error al generar prueba:`, error);
        throw new HttpsError('internal', 'No se pudo generar la prueba con IA.');
    }
});

/**
 * Genera preguntas para un tipo dado. Para evitar truncamientos, genera preguntas
 * en llamadas pequeñas (una por una) y para Comprensión de lectura genera el texto
 * y luego sus preguntas.
 */
async function generateQuestionsForTipo(tipo: string, cantidad: number, objetivo: string, contextoAdicional?: string): Promise<any[]> {
    const results: any[] = [];
    const useFlash = tipo === 'Verdadero o Falso' || tipo === 'Desarrollo' || cantidad <= 3;

    // Helper para parsear respuesta JSON sostenible
    const parseJsonResponse = (raw: string): any => {
        const s = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        try { return JSON.parse(s); } catch (e) {
            const m = s.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
            if (m && m[0]) {
                try { return JSON.parse(m[0]); } catch (e2) { return null; }
            }
            return null;
        }
    };

    // Normalizar etiqueta de Bloom a un conjunto estándar
    const normalizeBloom = (v: any): string | undefined => {
        const s = String(v || '').trim().toLowerCase();
        if (!s) return undefined;
        if (s.includes('record')) return 'Recordar';
        if (s.includes('comprend') || s.includes('entend')) return 'Comprender';
        if (s.includes('aplic')) return 'Aplicar';
        if (s.includes('analiz')) return 'Analizar';
        if (s.includes('evalu')) return 'Evaluar';
        if (s.includes('crea') || s.includes('sintet')) return 'Crear';
        return undefined;
    };

    // Heurísticas de calidad para evitar placeholders
    const isGenericText = (v: any): boolean => {
        const s = String(v || '').trim().toLowerCase();
        if (!s) return true;
        if (s === 'a' || s === 'b' || s === 'c' || s === 'd') return true;
        if (/^opci[óo]n\s*[abcd]$/.test(s)) return true;
        if (/^definici[óo]n\s*\d+$/.test(s)) return true;
        if (/^concepto\s*\d+$/.test(s)) return true;
        if (s.length < 4) return true;
        return false;
    };
    const needsRepairSM = (ops: any[]): boolean => {
        const arr = Array.isArray(ops) ? ops.slice(0,4).map((x) => String(x || '')) : [];
        if (arr.length < 4) return true;
        if (arr.some(isGenericText)) return true;
        const uniq = new Set(arr.map((x) => x.toLowerCase()));
        return uniq.size < 4;
    };
    const needsRepairPareados = (pares: any[]): boolean => {
        if (!Array.isArray(pares) || pares.length < 3) return true;
        for (const p of pares) {
            if (isGenericText(p?.concepto) || isGenericText(p?.definicion)) return true;
        }
        return false;
    };
    const tryRepairSM = async (obj: any, rcLetter: string): Promise<any | null> => {
        const prompt = `Reescribe esta pregunta de selección múltiple con alternativas específicas y plausibles relacionadas al tema. No uses textos genéricos como "Opción A/B/C/D" ni letras sueltas. Mantén la letra de la respuesta correcta en "respuestaCorrecta": "${rcLetter}".

Tema: "${objetivo}"
Pregunta original: ${obj.pregunta || ''}
Opciones originales: ${JSON.stringify(obj.opciones || [])}

Devuelve SOLO JSON válido con este esquema exacto:
{
  "tipo": "Selección múltiple",
  "pregunta": "...",
  "opciones": ["...A", "...B", "...C", "...D"],
  "respuestaCorrecta": "A|B|C|D",
  "puntaje": 1
}`;
        const { text } = await callGemini({ prompt, mode: 'flash', config: { maxOutputTokens: 600, temperature: 0.2 } });
        const parsed = parseJsonResponse(text);
        const rep = Array.isArray(parsed) ? parsed[0] : parsed;
        if (rep && rep.opciones && !needsRepairSM(rep.opciones)) return rep;
        return null;
    };
    const tryRepairPareados = async (obj: any): Promise<any | null> => {
        const prompt = `Genera una actividad de "Términos pareados" con conceptos y definiciones relevantes al tema. Evita textos genéricos como "Concepto 1" o "Definición 1". Devuelve entre 4 y 6 pares.

Tema: "${objetivo}"

Devuelve SOLO JSON válido:
{
  "tipo": "Términos pareados",
  "pregunta": "instrucción breve",
  "pares": [ { "concepto": "...", "definicion": "..." }, ... ],
  "puntaje": 1
}`;
        const { text } = await callGemini({ prompt, mode: 'flash', config: { maxOutputTokens: 600, temperature: 0.2 } });
        const parsed = parseJsonResponse(text);
        const rep = Array.isArray(parsed) ? parsed[0] : parsed;
        if (rep && Array.isArray(rep.pares) && !needsRepairPareados(rep.pares)) return rep;
        return null;
    };

    if (tipo === 'Comprensión de lectura') {
        // Paso 1: generar texto breve (acotar longitud para evitar truncamientos)
    const promptText = `Eres diseñador de evaluaciones. Devuelve SOLO JSON válido, sin bloques de código ni texto adicional.

Esquema:
{ "texto": "120-180 palabras, original, adecuado al nivel, con información suficiente para formular preguntas" }

Tema: "${objetivo}"
${contextoAdicional ? `Contexto adicional: ${contextoAdicional}` : ''}`;
    const { text: textResp } = await callGemini({ prompt: promptText, mode: 'flash', config: { maxOutputTokens: 800 } });
    // Sanitizar posibles bloques de código
    const clean = (s: string) => s.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedText = parseJsonResponse(clean(textResp));
        const texto = parsedText && parsedText.texto ? parsedText.texto : (typeof parsedText === 'string' ? parsedText : textResp);

        // Paso 2: generar preguntas basadas en el texto, UNA A UNA con reintentos
        const preguntasCL: any[] = [];
    for (let q = 0; q < Math.max(1, Math.min(10, cantidad)); q++) {
            let intentos = 0;
            let agregada = false;
            while (intentos < 2 && !agregada) {
                intentos++;
                                const promptQ = `Eres diseñador de evaluaciones. Devuelve SOLO JSON válido (un objeto), sin bloques de código.

Texto base:
"""
${texto}
"""

Genera 1 pregunta de opción múltiple basada EXCLUSIVAMENTE en el texto. Esquema exacto:
{
  "tipo": "Selección múltiple",
  "pregunta": "enunciado claro y breve (1 oración)",
  "opciones": ["alternativa A", "alternativa B", "alternativa C", "alternativa D"],
  "respuestaCorrecta": "A|B|C|D",
    "puntaje": 1,
    "habilidadBloom": "Recordar|Comprender|Aplicar|Analizar|Evaluar|Crear"
}`;
                try {
                    const { text: respQ } = await callGemini({ prompt: promptQ, mode: 'flash', config: { maxOutputTokens: 600 } });
                    const parsedQ = parseJsonResponse(clean(respQ));
                    let obj = Array.isArray(parsedQ) ? parsedQ[0] : parsedQ;
                    if (obj && typeof obj === 'object') {
                        // Validación y saneamiento mínimo
                        const opciones = Array.isArray(obj.opciones) ? obj.opciones.slice(0, 4) : [];
                        while (opciones.length < 4) opciones.push('');
                        let rc = String(obj.respuestaCorrecta || obj.correcta || obj.respuesta || '').toUpperCase();
                        if (!['A', 'B', 'C', 'D'].includes(rc)) rc = 'A';
                        preguntasCL.push({
                            tipo: 'Selección múltiple',
                            pregunta: obj.pregunta || 'Pregunta basada en el texto',
                            opciones,
                            respuestaCorrecta: rc,
                            puntaje: typeof obj.puntaje === 'number' ? obj.puntaje : 1,
                            habilidadBloom: normalizeBloom(obj.habilidadBloom) || 'Comprender',
                        });
                        agregada = true;
                    }
                } catch (e) {
                    if (intentos >= 2) {
                        // Fallback seguro para no abortar todo el conjunto
                        preguntasCL.push({
                            tipo: 'Selección múltiple',
                            pregunta: 'Según el texto, ¿cuál de las siguientes opciones es correcta?',
                            opciones: ['A', 'B', 'C', 'D'],
                            respuestaCorrecta: 'A',
                            puntaje: 1,
                            habilidadBloom: 'Comprender',
                        });
                        agregada = true;
                    }
                }
            }
        }

        results.push({ tipo: 'Comprensión de lectura', texto, preguntas: preguntasCL });
        return results;
    }

    // Validadores por tipo
    const isNonEmptyString = (v: any) => typeof v === 'string' && v.trim().length > 0;
    const isValidSM = (o: any) => o && o.tipo && /selecci/i.test(String(o.tipo)) && isNonEmptyString(o.pregunta) && Array.isArray(o.opciones) && o.opciones.length >= 4 && o.opciones.every((x: any) => isNonEmptyString(x)) && ['A','B','C','D'].includes(String(o.respuestaCorrecta || o.correcta || o.respuesta).toUpperCase());
    const isValidVF = (o: any) => o && /verdadero|falso|vf|true|false/i.test(String(o.tipo || '')) && isNonEmptyString(o.pregunta) && (typeof o.respuestaCorrecta === 'boolean' || typeof o.esVerdadero === 'boolean' || /^[VF]$/i.test(String(o.correcta || '')));
    const isValidDEV = (o: any) => o && /desarrollo|abierta|respuesta corta/i.test(String(o.tipo || '')) && isNonEmptyString(o.pregunta);
    const isValidPareados = (o: any) => o && /paread|emparejar|matching/i.test(String(o.tipo || '')) && Array.isArray(o.pares) && o.pares.length >= 3 && o.pares.every((p: any) => isNonEmptyString(p?.concepto) && isNonEmptyString(p?.definicion));

    // Para otros tipos: generar de uno en uno con esquemas explícitos (respetando cantidad y evitando excesos)
    for (let i = 0; i < Math.max(1, Math.min(50, cantidad)); i++) {
        let esquema = '';
        if (tipo === 'Selección múltiple') {
            esquema = `{
  "tipo": "Selección múltiple",
  "pregunta": "enunciado claro y contextualizado",
  "opciones": ["alternativa A", "alternativa B", "alternativa C", "alternativa D"],
  "respuestaCorrecta": "A|B|C|D",
  "puntaje": 1
}`;
        } else if (tipo === 'Verdadero o Falso') {
            esquema = `{
  "tipo": "Verdadero o Falso",
  "pregunta": "afirmación que pueda evaluarse como verdadera o falsa",
  "respuestaCorrecta": true,
  "puntaje": 1
}`;
        } else if (tipo === 'Desarrollo') {
            esquema = `{
  "tipo": "Desarrollo",
  "pregunta": "pregunta abierta que requiera explicación o justificación",
  "puntaje": 1
}`;
        } else if (tipo === 'Términos pareados') {
            esquema = `{
  "tipo": "Términos pareados",
  "pregunta": "instrucción breve para emparejar conceptos y definiciones",
  "pares": [ { "concepto": "...", "definicion": "..." }, { "concepto": "...", "definicion": "..." } ],
  "puntaje": 1
}`;
        }

    const promptQ = `Eres diseñador de evaluaciones. Genera SOLO JSON válido sin bloques de código ni texto adicional.

Tipo: ${tipo}
Tema: "${objetivo}"
${contextoAdicional ? `Contexto adicional: ${contextoAdicional}` : ''}

Usa exactamente este esquema:
${esquema}`;
        // Hasta 2 intentos: modo preferido y modo alternativo
        let finalObj: any | null = null;
        for (const modeTry of [useFlash ? 'flash' : 'standard', useFlash ? 'standard' : 'flash'] as const) {
            const { text: resp } = await callGemini({ prompt: promptQ, mode: modeTry, config: { maxOutputTokens: 1024 } });
            const parsed = parseJsonResponse(resp.replace(/```json/gi, '').replace(/```/g, '').trim());
            const obj = Array.isArray(parsed) ? parsed[0] : parsed;
            if (!obj || typeof obj !== 'object') continue;
            // Validar según tipo
            let ok = false;
            if (tipo === 'Selección múltiple') ok = isValidSM(obj);
            else if (tipo === 'Verdadero o Falso') ok = isValidVF(obj);
            else if (tipo === 'Desarrollo') ok = isValidDEV(obj);
            else if (tipo === 'Términos pareados') ok = isValidPareados(obj);
            if (!ok) continue;
            finalObj = obj;
            break;
        }
        if (!finalObj) {
            // Intento de reparación/generación estricta en un segundo paso
            if (tipo === 'Selección múltiple') {
                const repaired = await tryRepairSM({ pregunta: `Según el contenido: ${objetivo}, responde.`, opciones: [] }, 'A');
                if (repaired && !needsRepairSM(repaired.opciones)) {
                    const opciones = repaired.opciones.slice(0,4);
                    results.push({ tipo, pregunta: repaired.pregunta, opciones, respuestaCorrecta: String(repaired.respuestaCorrecta || 'A').toUpperCase(), puntaje: typeof repaired.puntaje === 'number' ? repaired.puntaje : 1 });
                }
                continue;
            } else if (tipo === 'Verdadero o Falso') {
                // Pequeño generador enfocado
                const prompt = `Genera una afirmación breve (verdadera o falsa) relacionada con el tema y devuelve JSON {"tipo":"Verdadero o Falso","pregunta":"...","respuestaCorrecta":true|false,"puntaje":1}. Tema: "${objetivo}"`;
                try {
                    const { text } = await callGemini({ prompt, mode: 'flash', config: { maxOutputTokens: 300, temperature: 0.2 } });
                    const parsed = parseJsonResponse(text);
                    const rep = Array.isArray(parsed) ? parsed[0] : parsed;
                    if (rep && typeof rep.pregunta === 'string' && (typeof rep.respuestaCorrecta === 'boolean' || typeof rep.esVerdadero === 'boolean')) {
                        results.push({ tipo, pregunta: rep.pregunta, respuestaCorrecta: typeof rep.respuestaCorrecta === 'boolean' ? rep.respuestaCorrecta : rep.esVerdadero, puntaje: typeof rep.puntaje === 'number' ? rep.puntaje : 1 });
                    }
                } catch {}
                continue;
            } else if (tipo === 'Desarrollo') {
                const prompt = `Genera una pregunta abierta de desarrollo relacionada con el tema y devuelve JSON {"tipo":"Desarrollo","pregunta":"...","puntaje":1}. Tema: "${objetivo}"`;
                try {
                    const { text } = await callGemini({ prompt, mode: 'flash', config: { maxOutputTokens: 300, temperature: 0.2 } });
                    const parsed = parseJsonResponse(text);
                    const rep = Array.isArray(parsed) ? parsed[0] : parsed;
                    if (rep && typeof rep.pregunta === 'string') {
                        results.push({ tipo, pregunta: rep.pregunta, puntaje: typeof rep.puntaje === 'number' ? rep.puntaje : 1 });
                    }
                } catch {}
                continue;
            } else if (tipo === 'Términos pareados') {
                try {
                    const repaired = await tryRepairPareados({});
                    if (repaired && Array.isArray(repaired.pares)) {
                        results.push({ tipo, pregunta: repaired.pregunta || 'Relaciona los términos', pares: repaired.pares, puntaje: typeof repaired.puntaje === 'number' ? repaired.puntaje : 1 });
                    }
                } catch {}
                continue;
            }
            continue;
        }
        // Normalizar salida para que encaje con el normalizador posterior
        if (tipo === 'Selección múltiple') {
            let opciones = finalObj.opciones.slice(0,4);
            const rcLetter = String(finalObj.respuestaCorrecta || finalObj.correcta || finalObj.respuesta).toUpperCase();
            if (needsRepairSM(opciones)) {
                const repaired = await tryRepairSM(finalObj, rcLetter);
                if (repaired && repaired.opciones && !needsRepairSM(repaired.opciones)) {
                    opciones = repaired.opciones.slice(0,4);
                }
            }
            results.push({ tipo, pregunta: finalObj.pregunta, opciones, respuestaCorrecta: rcLetter, puntaje: typeof finalObj.puntaje === 'number' ? finalObj.puntaje : 1 });
        } else if (tipo === 'Verdadero o Falso') {
            let respBool = typeof finalObj.respuestaCorrecta === 'boolean' ? finalObj.respuestaCorrecta : (typeof finalObj.esVerdadero === 'boolean' ? finalObj.esVerdadero : String(finalObj.correcta||'').toUpperCase().startsWith('V'));
            results.push({ tipo, pregunta: finalObj.pregunta, respuestaCorrecta: respBool, puntaje: typeof finalObj.puntaje === 'number' ? finalObj.puntaje : 1 });
        } else if (tipo === 'Desarrollo') {
            results.push({ tipo, pregunta: finalObj.pregunta, puntaje: typeof finalObj.puntaje === 'number' ? finalObj.puntaje : 1 });
        } else if (tipo === 'Términos pareados') {
            let pares = finalObj.pares;
            if (needsRepairPareados(pares)) {
                const repaired = await tryRepairPareados(finalObj);
                if (repaired && Array.isArray(repaired.pares) && !needsRepairPareados(repaired.pares)) {
                    pares = repaired.pares;
                }
            }
            results.push({ tipo, pregunta: finalObj.pregunta || 'Relaciona los términos', pares, puntaje: typeof finalObj.puntaje === 'number' ? finalObj.puntaje : 1 });
        }
    }

    return results;
}

// Endpoint HTTP para llamadas directas desde el frontend (CORS)
export const generarPruebaConGeminiHttp = onRequest({ timeoutSeconds: 300, cors: true, secrets: [geminiApiKey] }, async (req, res) => {
    // CORS dinámico con whitelist para TODAS las respuestas
    const ALLOWED_ORIGINS = new Set([
        'https://plania-clase.web.app',
        'https://plania-clase.firebaseapp.com',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]);
    const setCors = () => {
        const origin = String(req.headers.origin || '');
        const allowOrigin = ALLOWED_ORIGINS.has(origin)
            ? origin
            : 'https://plania-clase.web.app';
        res.set('Access-Control-Allow-Origin', allowOrigin);
        res.set('Vary', 'Origin');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        // Importante: usar minúsculas para mayor compatibilidad con preflight
        res.set('Access-Control-Allow-Headers', 'content-type, authorization');
        // Si más adelante usamos cookies/credenciales, habilitar esta línea:
        // res.set('Access-Control-Allow-Credentials', 'true');
        res.set('Access-Control-Max-Age', '86400');
    };
    setCors();
    if (req.method === 'OPTIONS') {
        setCors();
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        setCors();
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }

    try {
        const { objetivo, cantidadesPorTipo, contextoAdicional } = req.body;
        if (!objetivo || !cantidadesPorTipo) {
            setCors();
            res.status(400).json({ success: false, error: 'Missing objetivo or cantidadesPorTipo' });
            return;
        }

        // Verificar token Firebase (Authorization: Bearer <idToken>)
        const authHeader = req.headers.authorization as string | undefined;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            setCors();
            res.status(401).json({ success: false, error: 'Unauthorized: missing Bearer token' });
            return;
        }
        const idToken = authHeader.split(' ')[1];
        try {
            await admin.auth().verifyIdToken(idToken);
        } catch (err) {
            console.error('Invalid ID token in generarPruebaConGeminiHttp:', err);
            setCors();
            res.status(401).json({ success: false, error: 'Invalid ID token' });
            return;
        }

                // Reusar la misma lógica robusta que el onCall: generar por tipo con helper
                let todasLasPreguntas: any[] = [];
        for (const tipo in cantidadesPorTipo) {
            const cantidad = cantidadesPorTipo[tipo];
            if (!cantidad || cantidad < 1) continue;
            const preguntasGeneradas = await generateQuestionsForTipo(tipo, cantidad, objetivo, contextoAdicional);
            todasLasPreguntas.push(...preguntasGeneradas);
        }
                // IMPORTANTE: devolver la estructura RAW que espera el frontend
                // (incluye tipos: 'Selección múltiple', 'Verdadero o Falso', 'Desarrollo', 'Términos pareados', 'Comprensión de lectura')
                // para que el normalizador del frontend construya los viewers adecuados.
                setCors();
                res.json({ success: true, prueba: { nombre: 'Prueba generada', objetivo, preguntas: todasLasPreguntas } });
    } catch (error: any) {
        console.error('Error en generarPruebaConGeminiHttp:', error);
        setCors();
        res.status(500).json({ success: false, error: error.message || String(error) });
    }
});
