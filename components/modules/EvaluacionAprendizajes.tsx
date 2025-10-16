import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../src/firebase';
import {
  subscribeToPruebas,
  savePrueba,
  deletePrueba,
  subscribeToRubricasEstaticas,
  saveRubricaEstatica,
  deleteRubricaEstatica,
  subscribeToRubricasInteractivas,
  subscribeToAllUsers,
  createRubricaInteractiva,
  updateRubricaInteractiva,
} from '../../src/firebaseHelpers/evaluacionHelper';
import { auth } from '../../src/firebase';

import React, { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { useAuth } from '../../src/hooks/useAuth';
import {
  User,
  Profile,
  RubricaInteractiva,
  ResultadoInteractivo,
  Prueba,
  PruebaItemTipo,
  PruebaActividad,
  PruebaItem,
  SeleccionMultipleItem,
  TerminosPareadosItem,
  RubricaEstatica,
  DimensionRubrica,
  NivelDescriptor,
  VerdaderoFalsoItem,
  ComprensionLecturaItem,
  DesarrolloItem,
  DificultadAprendizaje,
} from '../../types';
import { ASIGNATURAS, NIVELES, PDFIcon, DIFICULTADES_APRENDIZAJE } from '../../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logApiCall } from '../utils/apiLogger';
import { normalizeCurso } from '../simce/SimceGeneradorPreguntas';
// EyeIcon importado desde AlternanciaTP
const EyeIcon: React.FC<{ className?: string; open?: boolean }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
import { addGoogleSansCodeFont } from '../../utils/fonts/googleSansCode';

// -------------------------------------------------------------------
// Tipos de ítem válidos para la prueba
const TIPOS_PRUEBA_ITEM: PruebaItemTipo[] = [
  'Selección múltiple',
  'Verdadero o Falso',
  'Términos pareados',
  'Desarrollo',
  'Comprensión de lectura'
];
// Constantes y utilidades
// -------------------------------------------------------------------

const functions = getFunctions(app);
const generarRubricaConGeminiFn = httpsCallable(functions, 'generarRubricaConGemini');
const generarDescriptorDimensionConGeminiFn = httpsCallable(functions, 'generarDescriptorDimensionConGemini');
// Nota: Usaremos fetch al endpoint HTTP con CORS para evitar problemas desde el navegador.
const generarPruebaConGeminiFn = null as unknown as (...args: any[]) => Promise<any>;


const ITEM_QUANTITIES: Record<string, number[]> = {
  "Selección múltiple": [5, 10, 15],
  "Verdadero o Falso": [5, 10, 15],
  "Términos pareados": [5, 10, 15],
  "Desarrollo": [5, 10, 15],
  "Comprensión de lectura": [5, 10, 15]
};
// -------------------------------------------------------------------
// Submódulo: PruebaItemViewer
// -------------------------------------------------------------------
export const PruebaItemViewer: React.FC<{ item: PruebaItem; showAnswers?: boolean; shuffledDefinitions?: string[] }> = ({ item, showAnswers = false, shuffledDefinitions = [] }) => {
  const puntaje = (item as any).puntaje ?? 1;
  // Utilidades para visualización
  const ensureFourOptions = (ops: string[] | undefined): string[] => {
    const arr = Array.isArray(ops) ? ops.slice(0, 4) : [];
    while (arr.length < 4) arr.push('');
    return arr;
  };

  const getRotated = (arr: string[]): string[] => {
    if (arr.length <= 1) return arr;
    return [...arr.slice(1), arr[0]]; // rotación simple y determinística
  };

  return (
    <div className="p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700">
      {/* Enunciado común */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {item.tipo}
          </span>
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            {item.pregunta || (item.tipo === 'Comprensión de lectura' ? 'Comprensión de lectura' : '')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {('habilidadBloom' in item) && (item as any).habilidadBloom && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">Bloom: {(item as any).habilidadBloom}</span>
          )}
          <div className="text-xs text-slate-500 dark:text-slate-400">{puntaje} pts</div>
        </div>
      </div>

      {/* Contenido según tipo */}
      {item.tipo === 'Selección múltiple' && (
        <div className="ml-1 mt-2 space-y-2">
          <div className="text-xs italic text-slate-500 dark:text-slate-400 mb-1">Marca la alternativa correcta.</div>
          {ensureFourOptions((item as SeleccionMultipleItem).opciones).map((op, i) => {
            const isCorrect = showAnswers && i === (item as SeleccionMultipleItem).respuestaCorrecta;
            return (
              <div key={i} className={`flex items-center gap-2 p-1 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/30' : ''}`}>
                <div className="w-5 h-5 border rounded-full flex-shrink-0"></div>
                <span>{String.fromCharCode(65 + i)}) {op}</span>
              </div>
            );
          })}
        </div>
      )}

      {item.tipo === 'Verdadero o Falso' && (
        <div className="ml-1 mt-2 flex items-center gap-6">
          <div className="text-xs italic text-slate-500 dark:text-slate-400">Indica si la afirmación es verdadera (V) o falsa (F).</div>
          <div className="flex-1" />
          <div className={`px-3 py-1 rounded ${showAnswers && (item as any).respuestaCorrecta === true ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>V</div>
          <div className={`px-3 py-1 rounded ${showAnswers && (item as any).respuestaCorrecta === false ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>F</div>
        </div>
      )}

      {item.tipo === 'Desarrollo' && (
        <div className="mt-3 border rounded-md h-24 bg-slate-50 dark:bg-slate-700/40"></div>
      )}

      {item.tipo === 'Términos pareados' && (() => {
        const pares = (item as TerminosPareadosItem).pares || [];
        const conceptos = pares.map(p => p.concepto);
        const definiciones = getRotated(pares.map(p => p.definicion));
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        return (
          <div className="mt-2">
            <div className="text-xs italic text-slate-500 dark:text-slate-400 mb-2">Une cada concepto (columna izquierda) con su definición (columna derecha).</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-semibold mb-1">Columna A: Conceptos</div>
                <div className="space-y-1">
                  {conceptos.map((c, i) => (
                    <div key={i} className="flex gap-2"><span className="font-semibold w-6 text-right">{i + 1}.</span><span>{c}</span></div>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-semibold mb-1">Columna B: Definiciones</div>
                <div className="space-y-1">
                  {definiciones.map((d, i) => (
                    <div key={i} className="flex gap-2"><span className="font-semibold w-6 text-right">{letters[i] || '?' }.</span><span>{d}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {item.tipo === 'Comprensión de lectura' && (
        <div className="mt-2 space-y-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-md whitespace-pre-wrap">
            {(item as ComprensionLecturaItem).texto}
          </div>
          <div className="space-y-3">
            {(item as ComprensionLecturaItem).preguntas?.map((sub, sIdx) => (
              <div key={sIdx} className="p-3 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-700">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">CL-{sIdx + 1}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">{sub.tipo}</span>
                    <div className="font-medium">{sub.pregunta}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {('habilidadBloom' in sub) && (sub as any).habilidadBloom && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">Bloom: {(sub as any).habilidadBloom}</span>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400">{(sub as any).puntaje ?? 1} pts</div>
                  </div>
                </div>
                {sub.tipo === 'Selección múltiple' ? (
                  <div className="ml-1 mt-1 space-y-1">
                    {(sub as SeleccionMultipleItem).opciones?.map((op, i) => {
                      const isCorrect = showAnswers && i === (sub as SeleccionMultipleItem).respuestaCorrecta;
                      return (
                        <div key={i} className={`flex items-center gap-2 p-1 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/30' : ''}`}>
                          <div className="w-4 h-4 border rounded-full flex-shrink-0"></div>
                          <span>{String.fromCharCode(65 + i)}) {op}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 border rounded-md h-16 bg-slate-50 dark:bg-slate-700/40"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

    // -------------------------------------------------------------------
    // Submódulo 1: Pruebas
    // -------------------------------------------------------------------
    const PruebasSubmodule: React.FC = () => {
      const defaultTiposActividad = useMemo(() => {
        return TIPOS_PRUEBA_ITEM.reduce((acc, tipo) => {
          acc[tipo] = 0;
          return acc;
        }, {} as Record<PruebaItemTipo, number>);
      }, []);

      const initialFormState: {
        nombre: string;
        asignatura: string;
        nivel: string;
        contenido: string;
        tiposActividad: Record<PruebaItemTipo, number>;
        dificultad: 'Fácil' | 'Intermedio' | 'Avanzado';
        isNee: boolean;
        selectedNee: DificultadAprendizaje[];
      } = useMemo(() => ({
        nombre: '',
        asignatura: ASIGNATURAS?.[0] || '',
        nivel: NIVELES?.[0] || '',
        contenido: '',
        tiposActividad: defaultTiposActividad,
        dificultad: 'Intermedio',
        isNee: false,
        selectedNee: [],
      }), [defaultTiposActividad]);  const [formData, setFormData] = useState(initialFormState);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrueba, setCurrentPrueba] = useState<Prueba | null>(null);
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sortByType, setSortByType] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      const unsubscribe = subscribeToPruebas(setPruebas);
      return () => unsubscribe();
    }
  }, [currentUser]);

  const handleFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTipoActividadToggle = (tipo: PruebaItemTipo) => {
    setFormData((prev) => {
      const newTipos = { ...prev.tiposActividad };
      if (newTipos[tipo] > 0) {
        newTipos[tipo] = 0;
      } else {
        newTipos[tipo] = ITEM_QUANTITIES[tipo]?.[0] || 1;
      }
      return { ...prev, tiposActividad: newTipos };
    });
  };

  const handleQuantityChange = (tipo: PruebaItemTipo, qty: number) => {
    setFormData((prev) => ({
      ...prev,
      tiposActividad: { ...prev.tiposActividad, [tipo]: qty },
    }));
  };

  const handleNeeChange = (dificultad: DificultadAprendizaje) => {
    setFormData((prev) => {
      const newSelection = prev.selectedNee.includes(dificultad)
        ? prev.selectedNee.filter((d) => d !== dificultad)
        : [...prev.selectedNee, dificultad];
      return { ...prev, selectedNee: newSelection };
    });
  };

  // --- Normalizadores reutilizables (para generación y para "Regenerar ítem") ---
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
  const defaultBloomForType = (tipo: PruebaItemTipo): string => {
    switch (tipo) {
      case 'Selección múltiple': return 'Comprender';
      case 'Verdadero o Falso': return 'Recordar';
      case 'Desarrollo': return 'Analizar';
      case 'Términos pareados': return 'Comprender';
      case 'Comprensión de lectura': return 'Comprender';
      default: return 'Comprender';
    }
  };
  const toFourOptionsOuter = (ops: any): string[] => {
    const arr: string[] = Array.isArray(ops)
      ? ops.map((o) => (typeof o === 'string' ? o : (o?.texto ?? '')))
      : [];
    const four = arr.slice(0, 4);
    while (four.length < 4) four.push('');
    return four;
  };
  const indexFromCorrectOuter = (raw: any): number => {
    if (typeof raw?.respuestaCorrecta === 'number') return Math.max(0, Math.min(3, raw.respuestaCorrecta));
    if (Array.isArray(raw?.alternativas)) {
      const idx = raw.alternativas.findIndex((a: any) => a && (a.esCorrecta === true || a.correcta === true));
      if (idx >= 0 && idx < 4) return idx;
    }
    const c = String(raw?.correcta || raw?.respuesta || raw?.respuestaCorrecta || '').trim().toUpperCase();
    const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    if (c in map) return map[c];
    return 0;
  };
  const normalizeSMOuter = (raw: any): SeleccionMultipleItem => {
    const opciones = toFourOptionsOuter(raw.opciones ?? raw.alternativas);
    const respuestaCorrecta = indexFromCorrectOuter(raw);
    const habilidadBloom = normalizeBloom(raw.habilidadBloom) || defaultBloomForType('Selección múltiple');
    return {
      id: raw.id || crypto.randomUUID(),
      tipo: 'Selección múltiple',
      pregunta: raw.pregunta || raw.enunciado || 'Pregunta',
      puntaje: raw.puntaje ?? 1,
      opciones,
      respuestaCorrecta,
      habilidadBloom,
    } as SeleccionMultipleItem;
  };
  const normalizeVFOuter = (raw: any): VerdaderoFalsoItem => {
    let respuestaCorrecta: boolean = false;
    if (typeof raw?.respuestaCorrecta === 'boolean') respuestaCorrecta = raw.respuestaCorrecta;
    else if (typeof raw?.esVerdadero === 'boolean') respuestaCorrecta = raw.esVerdadero;
    else if (raw?.correcta) respuestaCorrecta = String(raw.correcta).toUpperCase().startsWith('V');
    const habilidadBloom = normalizeBloom(raw.habilidadBloom) || defaultBloomForType('Verdadero o Falso');
    return {
      id: raw.id || crypto.randomUUID(),
      tipo: 'Verdadero o Falso',
      pregunta: raw.pregunta || raw.enunciado || 'Afirmación',
      puntaje: raw.puntaje ?? 1,
      respuestaCorrecta,
      habilidadBloom,
    } as VerdaderoFalsoItem;
  };
  const normalizeDEVOuter = (raw: any): DesarrolloItem => {
    const habilidadBloom = normalizeBloom(raw.habilidadBloom) || defaultBloomForType('Desarrollo');
    return {
      id: raw.id || crypto.randomUUID(),
      tipo: 'Desarrollo',
      pregunta: raw.pregunta || raw.enunciado || 'Pregunta abierta',
      puntaje: raw.puntaje ?? 1,
      habilidadBloom,
    } as DesarrolloItem;
  };
  const normalizePAREADOSOuter = (raw: any): TerminosPareadosItem => {
    let pares = Array.isArray(raw?.pares) ? raw.pares : [];
    if ((!pares || pares.length === 0) && Array.isArray(raw?.conceptos) && Array.isArray(raw?.definiciones)) {
      const n = Math.min(raw.conceptos.length, raw.definiciones.length);
      pares = Array.from({ length: n }, (_, i) => ({ concepto: raw.conceptos[i], definicion: raw.definiciones[i] }));
    }
    pares = (pares || []).map((p: any) => ({ concepto: p?.concepto ?? '', definicion: p?.definicion ?? '' }));
    const habilidadBloom = normalizeBloom(raw.habilidadBloom) || defaultBloomForType('Términos pareados');
    return {
      id: raw.id || crypto.randomUUID(),
      tipo: 'Términos pareados',
      pregunta: raw.pregunta || raw.enunciado || 'Relaciona los términos',
      puntaje: raw.puntaje ?? 1,
      pares,
      habilidadBloom,
    } as TerminosPareadosItem;
  };
  const normalizeCLOuter = (raw: any): ComprensionLecturaItem => {
    const texto = typeof raw?.texto === 'string' ? raw.texto : Array.isArray(raw?.texto) ? raw.texto.join('\n') : (raw?.lectura || '');
    const sub = Array.isArray(raw?.preguntas) ? raw.preguntas : [];
    const preguntas = sub
      .map((q: any) => {
        const qb = normalizeBloom(q?.habilidadBloom);
        const t = (q?.tipo || '').toLowerCase();
        if (t.includes('multiple') || t.includes('seleccion')) {
          const item = normalizeSMOuter(q);
          if (!item.habilidadBloom) (item as any).habilidadBloom = qb || defaultBloomForType('Selección múltiple');
          return item;
        }
        if (t.includes('desarrollo') || t.includes('abierta')) {
          const item = normalizeDEVOuter(q);
          if (!item.habilidadBloom) (item as any).habilidadBloom = qb || defaultBloomForType('Desarrollo');
          return item;
        }
        if (q?.alternativas || q?.opciones) {
          const item = normalizeSMOuter(q);
          if (!item.habilidadBloom) (item as any).habilidadBloom = qb || defaultBloomForType('Selección múltiple');
          return item;
        }
        return null;
      })
      .filter(Boolean) as (SeleccionMultipleItem | DesarrolloItem)[];
    const habilidadBloom = normalizeBloom(raw.habilidadBloom) || defaultBloomForType('Comprensión de lectura');
    return {
      id: raw.id || crypto.randomUUID(),
      tipo: 'Comprensión de lectura',
      pregunta: raw.pregunta || raw.enunciado || 'Comprensión de lectura',
      puntaje: raw.puntaje ?? Math.max(1, preguntas.reduce((acc: number, p: any) => acc + (p.puntaje ?? 1), 0)),
      texto,
      preguntas,
      habilidadBloom,
    } as ComprensionLecturaItem;
  };

  // La función debe estar dentro del componente para acceder a los estados
  const handleGeneratePrueba = async (e: FormEvent) => {
    e.preventDefault();
    // Validar usuario completo antes de continuar
    if (!currentUser || !currentUser.uid || !currentUser.email || !currentUser.id) {
      setError("Debes iniciar sesión para generar una evaluación.");
      return;
    }
  const totalSeleccionado = Object.values(formData.tiposActividad || {}).reduce<number>((acc: number, n: unknown) => acc + (Number(n) || 0), 0);
    if (!formData.nombre.trim() || !formData.contenido.trim() || totalSeleccionado === 0) {
      setError('Nombre, Contenido y al menos un tipo con cantidad (> 0) son obligatorios.');
      return;
    }
    setIsGenerating(true);
    setError(null);

    try {
      logApiCall('Evaluación - Pruebas', currentUser);

      // Nuevo formato: enviar cantidadesPorTipo
      // Enviar solo los tipos con cantidad > 0
      const cantidadesPorTipo = Object.entries(formData.tiposActividad).reduce((acc, [k, v]) => {
        const n = Number(v) || 0;
        if (n > 0) (acc as any)[k] = n;
        return acc;
      }, {} as Record<string, number>);
      // Preparar payload y endpoint
      const payload = {
        objetivo: '',
        cantidadesPorTipo,
        metadata: {
          nombre: formData.nombre,
          asignatura: formData.asignatura,
          nivel: formData.nivel,
          contenido: formData.contenido,
          dificultad: formData.dificultad,
          nee: formData.isNee ? formData.selectedNee : [],
        },
        contextoAdicional: `Directrices: vocabulario y contexto adecuados al nivel educativo en Chile. Si hay NEE, usar lenguaje claro, reducir complejidad, textos más cortos y distractores no ambiguos.`,
      } as any;

      // URL base de funciones: permite ajustar a emulador o-prod
      const FUNCTIONS_BASE = process.env.REACT_APP_FUNCTIONS_BASE_URL || 'https://us-central1-plania-clase.cloudfunctions.net';
      const url = `${FUNCTIONS_BASE}/generarPruebaConGeminiHttp`;

      // Obtener idToken del usuario para autorización
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('No se pudo obtener token de autenticación.');
      }

      const fetchResp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!fetchResp.ok) {
        const errText = await fetchResp.text();
        throw new Error(`Error en función: ${fetchResp.status} ${errText}`);
      }

      const result = await fetchResp.json();

  // Compatibilidad: si el endpoint devuelve { success:true, prueba } usamos result.prueba, si es callable, mantenemos compatibilidad
  const generatedData = (result.prueba || (result.data && (result.data as any).prueba)) as any;

      // --- Normalización de ítems generados por IA ---
      const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const norm = (s: string) => stripDiacritics((s || '').toLowerCase());

      const normalizeTipo = (t: any): PruebaItemTipo | null => {
        const s = norm(String(t || ''));
        if (!s) return null;
        if (s.includes('comprension') || s.includes('lectura') || s.includes('reading')) return 'Comprensión de lectura';
        if (s.includes('multiple') || s.includes('seleccion') || s.includes('mcq')) return 'Selección múltiple';
        if (s.includes('verdadero') || s.includes('falso') || s === 'vf' || s.includes('true') || s.includes('false')) return 'Verdadero o Falso';
        if (s.includes('paread') || s.includes('matching') || s.includes('emparejar')) return 'Términos pareados';
        if (s.includes('desarrollo') || s.includes('respuesta corta') || s.includes('abierta')) return 'Desarrollo';
        return null;
      };

      const toFourOptions = (ops: any): string[] => {
        const arr: string[] = Array.isArray(ops)
          ? ops.map((o) => (typeof o === 'string' ? o : (o?.texto ?? '')))
          : [];
        const four = arr.slice(0, 4);
        while (four.length < 4) four.push('');
        return four;
      };

      const indexFromCorrect = (raw: any): number => {
        if (typeof raw?.respuestaCorrecta === 'number') return Math.max(0, Math.min(3, raw.respuestaCorrecta));
        if (Array.isArray(raw?.alternativas)) {
          const idx = raw.alternativas.findIndex((a: any) => a && (a.esCorrecta === true || a.correcta === true));
          if (idx >= 0 && idx < 4) return idx;
        }
        const c = String(raw?.correcta || raw?.respuesta || '').trim().toUpperCase();
        const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
        if (c in map) return map[c];
        return 0;
      };

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
      const defaultBloomForType = (tipo: PruebaItemTipo): string => {
        switch (tipo) {
          case 'Selección múltiple': return 'Comprender';
          case 'Verdadero o Falso': return 'Recordar';
          case 'Desarrollo': return 'Analizar';
          case 'Términos pareados': return 'Comprender';
          case 'Comprensión de lectura': return 'Comprender';
          default: return 'Comprender';
        }
      };

      // Usar los normalizadores externos ya definidos
      const normalizeSM = normalizeSMOuter;
      const normalizeVF = normalizeVFOuter;
      const normalizeDEV = normalizeDEVOuter;
      const normalizePAREADOS = normalizePAREADOSOuter;
      const normalizeCL = normalizeCLOuter;

      const normalizeItem = (raw: any): PruebaItem | null => {
        const t = normalizeTipo(raw.tipo) || (raw?.alternativas || raw?.opciones ? 'Selección múltiple' : null);
        switch (t) {
          case 'Selección múltiple':
            return normalizeSM(raw);
          case 'Verdadero o Falso':
            return normalizeVF(raw);
          case 'Desarrollo':
            return normalizeDEV(raw);
          case 'Términos pareados':
            return normalizePAREADOS(raw);
          case 'Comprensión de lectura':
            return normalizeCL(raw);
          default:
            if (raw?.alternativas || raw?.opciones) return normalizeSM(raw);
            if (raw?.pares || (raw?.conceptos && raw?.definiciones)) return normalizePAREADOS(raw);
            if ((raw?.texto || raw?.lectura) && Array.isArray(raw?.preguntas)) return normalizeCL(raw);
            if (typeof raw?.respuestaCorrecta === 'boolean' || typeof raw?.esVerdadero === 'boolean' || /^(v|f)$/i.test(String(raw?.correcta || ''))) return normalizeVF(raw);
            return normalizeDEV(raw);
        }
      };

      const itemsConId = (Array.isArray(generatedData?.preguntas) ? generatedData.preguntas : [])
        .map((it: any, idx: number) => {
          const normalized = normalizeItem(it);
          if (!normalized) return null;
          return {
            ...normalized,
            id: normalized.id || crypto.randomUUID(),
            pregunta: normalized.pregunta || `Ítem ${idx + 1}`,
            puntaje: (normalized as any).puntaje ?? 1,
          } as PruebaItem;
        })
        .filter(Boolean) as PruebaItem[];

      const instruccionesFallback =
        generatedData.instruccionesGenerales && generatedData.instruccionesGenerales.trim().length > 0
          ? generatedData.instruccionesGenerales
          : 'Lee atentamente y responde cada ítem según se indique. Marca solo una alternativa cuando corresponda. Justifica tus respuestas en los ítems de desarrollo.';

      // Recalcular puntaje ideal considerando subpreguntas en Comprensión de lectura
      const newPuntajeIdeal = (itemsConId || []).reduce((acc: number, it: any) => {
        if (it.tipo === 'Comprensión de lectura' && Array.isArray(it.preguntas)) {
          const subSum = it.preguntas.reduce((s: number, sub: any) => s + (sub.puntaje ?? 1), 0);
          return acc + subSum;
        }
        return acc + (it.puntaje ?? 1);
      }, 0);

      const newPrueba: Prueba = {
        id: crypto.randomUUID(),
        fechaCreacion: new Date().toISOString(),
        nombre: formData.nombre,
        asignatura: formData.asignatura,
        nivel: formData.nivel,
        contenidoOriginal: formData.contenido,
        tiposActividadOriginal: formData.tiposActividad,
        objetivo: generatedData.objetivo || '',
        instruccionesGenerales: instruccionesFallback,
        puntajeIdeal: newPuntajeIdeal,
        actividades: [
          {
            id: crypto.randomUUID(),
            titulo: formData.nombre,
            instrucciones: instruccionesFallback,
            items: itemsConId,
          },
        ],
        dificultad: formData.dificultad,
        ...(formData.isNee && { adaptacionNEE: formData.selectedNee }),
      };

      setCurrentPrueba(newPrueba);
      setShowAnswers(false);
    } catch (err) {
      console.error(err);
      setError(
        'Error al generar la prueba con IA. Revisa la consola para más detalles.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePrueba = async () => {
    if (!currentPrueba) return;
    try {
      await savePrueba(currentPrueba);
      alert('Prueba guardada con éxito.');
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar la prueba.');
    }
  };

  const handleDeletePrueba = async (id: string) => {
    if (window.confirm('¿Eliminar esta prueba?')) {
      try {
        await deletePrueba(id);
        if (currentPrueba?.id === id) {
          setCurrentPrueba(null);
        }
      } catch (error) {
        console.error(error);
        alert('No se pudo eliminar la prueba.');
      }
    }
  };

  // Generación de PDF simplificada y auto-contenida (sin helpers externos faltantes)
  const handleDownloadPDF = async (prueba: Prueba) => {
    try {
      setIsDownloading(true);
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      try {
        addGoogleSansCodeFont(doc);
        doc.setFont('GoogleSansCode', 'normal');
      } catch {
        // Si la fuente no está, continuamos con la default
      }

      const margin = 40;
      let y = margin;

      // Encabezado simple
      doc.setFontSize(12);
      doc.text('LICEO INDUSTRIAL DE RECOLETA', margin, y);
      doc.text('SUBDIRECCIÓN DE GESTIÓN PEDAGÓGICA', doc.internal.pageSize.getWidth() - margin, y, { align: 'right' });
      y += 24;

      doc.setFont(undefined, 'bold');
      doc.setFontSize(18);
      doc.text(prueba.nombre, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
      doc.setFont(undefined, 'normal');
      y += 18;

      // Tabla de info básica
      autoTable(doc, {
        startY: y + 6,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 6 },
        head: [['Campo', 'Valor']],
        body: [
          ['Fecha', new Date(prueba.fechaCreacion).toLocaleDateString()],
          ['Asignatura', prueba.asignatura],
          ['Nivel', prueba.nivel],
          ['Puntaje Ideal', String(prueba.puntajeIdeal)],
          ['Objetivo', prueba.objetivo],
          ['Instrucciones Generales', prueba.instruccionesGenerales],
        ],
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 16;

      // Actividades e ítems (simplificado)
      prueba.actividades.forEach((act, aIdx) => {
        // Salto si falta espacio
        if (y > doc.internal.pageSize.getHeight() - 120) {
          doc.addPage();
          y = margin;
        }
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.text(`Actividad ${aIdx + 1}: ${act.titulo}`, margin, y);
        y += 14;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        const instr = doc.splitTextToSize(act.instrucciones, doc.internal.pageSize.getWidth() - margin * 2);
        doc.text(instr, margin, y);
        y += instr.length * 12 + 6;

        act.items.forEach((item, iIdx) => {
          const bloomLabel = (item as any).habilidadBloom ? ` [Bloom: ${(item as any).habilidadBloom}]` : '';
          const enun = `${iIdx + 1}. ${item.pregunta} (${item.puntaje} pts)${bloomLabel}`;
          const enunLines = doc.splitTextToSize(enun, doc.internal.pageSize.getWidth() - margin * 2);
          if (y > doc.internal.pageSize.getHeight() - 100) {
            doc.addPage();
            y = margin;
          }
          doc.setFont(undefined, 'bold');
          doc.text(enunLines, margin, y);
          y += enunLines.length * 12 + 4;
          doc.setFont(undefined, 'normal');

          switch (item.tipo) {
            case 'Selección múltiple': {
              (item as SeleccionMultipleItem).opciones.forEach((op, idx) => {
                const line = `${String.fromCharCode(65 + idx)}) ${op}`;
                const lines = doc.splitTextToSize(line, doc.internal.pageSize.getWidth() - margin * 2 - 16);
                doc.text(lines, margin + 16, y);
                y += lines.length * 12;
              });
              y += 8;
              break;
            }
            case 'Verdadero o Falso': {
              doc.text('V ____    F ____', margin + 16, y);
              y += 18;
              break;
            }
            case 'Desarrollo': {
              // Área para responder
              const h = 60;
              doc.rect(margin, y - 10, doc.internal.pageSize.getWidth() - margin * 2, h);
              y += h + 10;
              break;
            }
            case 'Términos pareados': {
              const pares = (item as TerminosPareadosItem).pares;
              autoTable(doc, {
                startY: y,
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 6 },
                head: [['Columna A: Concepto', 'Columna B: Definición']],
                body: pares.map((p, idx) => [`${idx + 1}. ${p.concepto}`, p.definicion]),
              });
              // @ts-ignore
              y = (doc as any).lastAutoTable.finalY + 8;
              break;
            }
            case 'Comprensión de lectura': {
              const lectura = item as ComprensionLecturaItem;
              const textLines = doc.splitTextToSize(lectura.texto, doc.internal.pageSize.getWidth() - margin * 2);
              doc.text(textLines, margin, y);
              y += textLines.length * 12 + 8;

              lectura.preguntas.forEach((sub, sIdx) => {
                const subBloomLabel = (sub as any).habilidadBloom ? ` [Bloom: ${(sub as any).habilidadBloom}]` : '';
                const subEnun = `CL-${sIdx + 1}. ${sub.pregunta} (${sub.puntaje} pts)${subBloomLabel}`;
                const subLines = doc.splitTextToSize(subEnun, doc.internal.pageSize.getWidth() - margin * 2);
                if (y > doc.internal.pageSize.getHeight() - 100) {
                  doc.addPage();
                  y = margin;
                }
                doc.setFont(undefined, 'bold');
                doc.text(subLines, margin + 8, y);
                y += subLines.length * 12 + 4;
                doc.setFont(undefined, 'normal');

                if (sub.tipo === 'Selección múltiple') {
                  (sub as SeleccionMultipleItem).opciones.forEach((op, idx) => {
                    const line = `${String.fromCharCode(65 + idx)}) ${op}`;
                    const lines = doc.splitTextToSize(line, doc.internal.pageSize.getWidth() - margin * 2 - 24);
                    doc.text(lines, margin + 24, y);
                    y += lines.length * 12;
                  });
                  y += 6;
                } else {
                  // Desarrollo
                  const h = 50;
                  doc.rect(margin + 8, y - 10, doc.internal.pageSize.getWidth() - margin * 2 - 16, h);
                  y += h + 8;
                }
              });
              break;
            }
          }
        });
      });

      const fechaStr = new Date().toISOString().split('T')[0];
      const fileName = `${prueba.nombre.replace(/\s/g, '_')}_${prueba.asignatura.replace(/\s/g, '_')}_${fechaStr}.pdf`;
      doc.save(fileName);
      setIsDownloading(false);
      alert(`PDF generado y descargado como "${fileName}"`);
    } catch (e) {
      console.error(e);
      setIsDownloading(false);
      alert('No se pudo generar el PDF.');
    }
  };

  if (currentPrueba) {
    // Utilidad: regenerar un ítem específico llamando al endpoint HTTP con 1 unidad del tipo
    const regenerateItemAt = async (actividadId: string, itemId: string) => {
      try {
        const actividadIdx = currentPrueba.actividades.findIndex(a => a.id === actividadId);
        if (actividadIdx < 0) return;
        const act = currentPrueba.actividades[actividadIdx];
        const itemIdx = act.items.findIndex(i => i.id === itemId);
        if (itemIdx < 0) return;
        const original = act.items[itemIdx];

        const mapTipo = (t: PruebaItemTipo): string => t; // mismos labels usados por backend

        // Reconstruir objetivo aproximado
        const objetivo = currentPrueba.objetivo && currentPrueba.objetivo.trim().length > 0 ? currentPrueba.objetivo : '';

        const cantidadesPorTipo: Record<string, number> = { [mapTipo(original.tipo)]: 1 };
        const payload: any = { 
          objetivo,
          cantidadesPorTipo,
          metadata: {
            nombre: currentPrueba.nombre,
            asignatura: currentPrueba.asignatura,
            nivel: currentPrueba.nivel,
            contenido: currentPrueba.contenidoOriginal,
            dificultad: currentPrueba.dificultad || 'Intermedio',
            nee: (currentPrueba as any).adaptacionNEE || [],
          },
          contextoAdicional: `Regenerar 1 ítem del tipo ${original.tipo} manteniendo nivel y asignatura indicados.`,
        };

        const FUNCTIONS_BASE = process.env.REACT_APP_FUNCTIONS_BASE_URL || 'https://us-central1-plania-clase.cloudfunctions.net';
        const url = `${FUNCTIONS_BASE}/generarPruebaConGeminiHttp`;
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('No se pudo obtener token de autenticación.');

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error(await resp.text());
        const data = await resp.json();
        const rawList: any[] = Array.isArray(data?.prueba?.preguntas) ? data.prueba.preguntas : [];
        if (rawList.length === 0) throw new Error('La IA no devolvió ítems nuevos.');

        // Normalizar el primer ítem recibido al tipo local
        const raw = rawList[0];
        const t = ((): PruebaItemTipo | null => {
          const s = (raw?.tipo || '').toLowerCase();
          if (s.includes('múltiple') || s.includes('multiple') || s.includes('seleccion')) return 'Selección múltiple';
          if (s.includes('verdadero') || s.includes('falso') || s === 'vf') return 'Verdadero o Falso';
          if (s.includes('paread') || s.includes('matching') || s.includes('emparejar')) return 'Términos pareados';
          if (s.includes('comprension') || s.includes('lectura')) return 'Comprensión de lectura';
          if (s.includes('desarrollo') || s.includes('respuesta corta') || s.includes('abierta')) return 'Desarrollo';
          return null;
        })();

  let nuevo: PruebaItem | null = null;
  if (t === 'Selección múltiple') nuevo = normalizeSMOuter(raw);
  else if (t === 'Verdadero o Falso') nuevo = normalizeVFOuter(raw);
  else if (t === 'Desarrollo') nuevo = normalizeDEVOuter(raw);
  else if (t === 'Términos pareados') nuevo = normalizePAREADOSOuter(raw);
  else if (t === 'Comprensión de lectura') nuevo = normalizeCLOuter(raw);
  else if (raw?.opciones || raw?.alternativas) nuevo = normalizeSMOuter(raw);
        if (!nuevo) throw new Error('No se pudo normalizar el ítem generado.');

        const updated = { ...currentPrueba } as Prueba;
        updated.actividades = currentPrueba.actividades.map((a, aIdx) => {
          if (aIdx !== actividadIdx) return a;
          return { ...a, items: a.items.map((it, idx) => idx === itemIdx ? { ...nuevo!, id: it.id } : it) };
        });
        setCurrentPrueba(updated);
      } catch (e) {
        console.error('No se pudo regenerar el ítem:', e);
        alert('No se pudo regenerar el ítem. Intenta de nuevo.');
      }
    };

    return (
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setCurrentPrueba(null)}
            className="text-sm font-semibold text-slate-500 hover:underline"
          >
            &larr; Volver
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAnswers(!showAnswers)}
              className="bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              <EyeIcon open={!showAnswers} />{' '}
              <span>{showAnswers ? 'Ocultar' : 'Mostrar'} Respuestas</span>
            </button>
            <button
              onClick={() => setSortByType((v) => !v)}
              className="bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              {sortByType ? 'Orden original' : 'Ordenar por tipo'}
            </button>
            <button
              onClick={handleSavePrueba}
              className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg"
            >
              Guardar Prueba
            </button>
            <button
              onClick={() => currentPrueba && handleDownloadPDF(currentPrueba)}
              disabled={isDownloading}
              className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
            >
              {isDownloading ? '...' : <PDFIcon />} PDF
            </button>
          </div>
        </div>

        {/* Viewer */}
        <div className="border rounded-lg p-8 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
            <span>LICEO INDUSTRIAL DE RECOLETA</span>
            <span>SUBDIRECCIÓN DE GESTIÓN PEDAGÓGICA</span>
          </div>
          <h2 className="text-center text-2xl font-bold my-4 text-slate-800 dark:text-slate-200">
            {currentPrueba.nombre}
          </h2>
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300 border p-4 rounded-lg bg-white dark:bg-slate-800">
            <div className="grid grid-cols-2 gap-x-8">
              <p>
                <strong>Asignatura:</strong> {currentPrueba.asignatura}
              </p>
              <p className="text-right">
                <strong>Puntaje Ideal:</strong> {currentPrueba.puntajeIdeal}
              </p>
              <p>
                <strong>Nivel:</strong> {currentPrueba.nivel}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
              <span className="font-semibold bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 px-2 py-1 rounded-full text-xs">
                Dificultad: {currentPrueba.dificultad || 'Intermedio'}
              </span>
              {currentPrueba.adaptacionNEE &&
                currentPrueba.adaptacionNEE.length > 0 && (
                  <span className="font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-1 rounded-full text-xs">
                    Adaptado para NEE: {currentPrueba.adaptacionNEE.join(', ')}
                  </span>
                )}
            </div>
            <p>
              <strong>Objetivo de Aprendizaje:</strong> {currentPrueba.objetivo}
            </p>
            <p>
              <strong>Instrucciones Generales:</strong>{' '}
              {currentPrueba.instruccionesGenerales}
            </p>
          </div>

          {currentPrueba.actividades.map((act) => (
            <div
              key={act.id}
              className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-lg border dark:border-slate-700"
            >
              <h3 className="text-lg font-bold border-b pb-2 mb-4 dark:border-slate-600">
                {act.titulo}
              </h3>
              <p className="italic text-sm mb-4">{act.instrucciones}</p>
              <div className="space-y-6">
                {(() => {
                  const order: Record<PruebaItemTipo, number> = {
                    'Comprensión de lectura': 0,
                    'Selección múltiple': 1,
                    'Verdadero o Falso': 2,
                    'Términos pareados': 3,
                    'Desarrollo': 4,
                  };
                  const itemsToShow = sortByType
                    ? [...(act.items || [])].sort((a, b) => (order[a.tipo] ?? 99) - (order[b.tipo] ?? 99))
                    : (act.items || []);
                  return itemsToShow.map((item) => (
                    <div key={item.id} className="space-y-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => regenerateItemAt(act.id, item.id)}
                          className="text-xs bg-sky-600 text-white px-3 py-1 rounded hover:bg-sky-700"
                        >
                          Regenerar ítem
                        </button>
                      </div>
                      <PruebaItemViewer
                        item={item}
                        showAnswers={showAnswers}
                      />
                    </div>
                  ));
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
          Generar Nueva Prueba o Guía
        </h2>
        <form onSubmit={handleGeneratePrueba} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Nombre de la Prueba/Guía <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleFormChange}
                placeholder="Ej: Guía N°1 - La Célula"
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Asignatura
              </label>
              <select
                name="asignatura"
                value={formData.asignatura}
                onChange={handleFormChange}
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
              >
                {ASIGNATURAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Nivel
              </label>
              <select
                name="nivel"
                value={formData.nivel}
                onChange={handleFormChange}
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
              >
                {NIVELES.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
            <div></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t dark:border-slate-700">
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2 block">
                Dificultad de la Prueba
              </label>
              <div className="flex rounded-lg shadow-sm">
                {(['Fácil', 'Intermedio', 'Avanzado'] as const).map(
                  (level, index) => (
                    <button
                      type="button"
                      key={level}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, dificultad: level }))
                      }
                      className={`w-1/3 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 ${
                        index === 0 ? 'rounded-l-lg' : ''
                      } ${index === 2 ? 'rounded-r-lg' : ''} ${
                        formData.dificultad === level
                          ? 'bg-amber-500 text-white z-10'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200'
                      }`}
                    >
                      {level}
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isNee}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isNee: e.target.checked,
                      selectedNee: e.target.checked ? prev.selectedNee : [],
                    }))
                  }
                  className="h-5 w-5 rounded text-amber-500 focus:ring-amber-400 border-slate-300 dark:bg-slate-600 dark:border-slate-500"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Adaptar para Necesidades Educativas Especiales (NEE)
                </span>
              </label>
              {formData.isNee && (
                <div className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-700/50 dark:border-slate-600 animate-fade-in">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Seleccione Dificultades de Aprendizaje
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {DIFICULTADES_APRENDIZAJE.map((dif) => (
                      <label
                        key={dif}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedNee.includes(dif)}
                          onChange={() => handleNeeChange(dif)}
                          className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                        />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {dif}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1 block">
            Contenido a evaluar
          </label>
          <textarea
            name="contenido"
            value={formData.contenido}
            onChange={handleFormChange}
            placeholder="Contenido a evaluar..."
            rows={3}
            className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
          />

          <div className="space-y-3">
            {TIPOS_PRUEBA_ITEM.map((tipo) => (
              <div
                key={tipo}
                className="p-3 border rounded-lg has-[:checked]:bg-amber-50 has-[:checked]:border-amber-300 dark:border-slate-700 dark:has-[:checked]:bg-amber-900/20 dark:has-[:checked]:border-amber-700"
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.tiposActividad[tipo]}
                    onChange={() => handleTipoActividadToggle(tipo)}
                    className="h-5 w-5 rounded text-amber-500 focus:ring-amber-400 bg-slate-200 dark:bg-slate-600 border-slate-300 dark:border-slate-500"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300 flex-grow">
                    {tipo}
                  </span>
                </label>
                {formData.tiposActividad[tipo] && ITEM_QUANTITIES[tipo] && (
                  <div className="mt-3 pl-8 flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Cantidad:
                    </span>
                    {ITEM_QUANTITIES[tipo]?.map((qty) => (
                      <button
                        type="button"
                        key={qty}
                        onClick={() => handleQuantityChange(tipo, qty)}
                        className={`px-3 py-1 rounded-full font-semibold text-xs transition-colors ${
                          formData.tiposActividad[tipo] === qty
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500'
                        }`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="text-right">
            <button
              type="submit"
              disabled={isGenerating}
              className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600"
            >
              {isGenerating ? 'Generando...' : 'Generar Prueba'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
          Historial de Pruebas Guardadas
        </h2>
        <div className="space-y-2">
          {pruebas.length > 0 ? (
            pruebas.map((p) => (
              <div
                key={p.id}
                className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md"
              >
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {p.nombre}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {p.asignatura} - {p.nivel} (
                    {new Date(p.fechaCreacion).toLocaleDateString()})
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPrueba(p)}
                    className="text-sm font-semibold text-blue-600 hover:underline"
                  >
                    Ver
                  </button>
                  <button
                    onClick={() => handleDeletePrueba(p.id)}
                    className="text-sm font-semibold text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">
              No hay pruebas guardadas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------------
// Submódulo 2: Rúbricas estáticas
// -------------------------------------------------------------------
const RubricasSubmodule: React.FC<{
  rubricas: RubricaEstatica[];
  onSave: (rubrica: RubricaEstatica) => void;
  onDelete: (id: string) => void;
  onCreate: (rubrica: RubricaEstatica) => void;
  allUsers: User[];
  onCreatedInteractiva?: (id: string) => void;
}> = ({ rubricas, onSave, onDelete, onCreate, allUsers, onCreatedInteractiva }) => {
  const [currentRubrica, setCurrentRubrica] = useState<RubricaEstatica | null>(
    null
  );
  const [view, setView] = useState<'list' | 'form'>('list');
  const [isLoading, setIsLoading] = useState(false);
  const [newDimensionName, setNewDimensionName] = useState('');
  const { currentUser } = useAuth();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const availableCourses = useMemo(() => {
    return Array.from(
      new Set(
        allUsers
          .filter((u) => u.profile === Profile.ESTUDIANTE && u.curso)
          .map((u) => normalizeCurso(u.curso!))
      )
    ).sort();
  }, [allUsers]);

  const createInteractiveFromRubrica = async (rubrica: RubricaEstatica, curso: string, asignatura: string) => {
    try {
      // Asegurar que la rúbrica está guardada en Firestore
      if (!rubrica.id) {
        rubrica.id = crypto.randomUUID();
      }
      await saveRubricaEstatica(rubrica);

      // Construir resultados iniciales por estudiante
      const estudiantes = allUsers.filter(
        (u) => u.profile === Profile.ESTUDIANTE && normalizeCurso(u.curso || '') === curso
      );
      const resultados: Record<string, ResultadoInteractivo> = {};
      estudiantes.forEach((est) => {
        resultados[est.id] = { puntajes: {}, feedback: '' };
      });

      const nueva = {
        nombre: rubrica.titulo,
        curso,
        asignatura,
        rubricaEstaticaId: rubrica.id,
        resultados,
      } as Omit<RubricaInteractiva, 'id'>;

  const id = await createRubricaInteractiva(nueva);
      setShowAssignModal(false);
      alert('Rúbrica interactiva creada.');
      onCreatedInteractiva?.(id);
    } catch (e) {
      console.error(e);
      alert('No se pudo crear la rúbrica interactiva.');
    }
  };

  const handleGenerateRubrica = async (title: string, description: string) => {
    if (!title.trim() || !description.trim()) {
      alert('El título y la descripción son obligatorios.');
      return;
    }
    setIsLoading(true);
    
    try {
      logApiCall('Evaluación - Rúbricas', currentUser);
      
      const result = await generarRubricaConGeminiFn({
        objetivo: title,
        niveles: ["Insuficiente", "Suficiente", "Competente", "Avanzado"],
        dimensiones: [],
        contextoAdicional: `El propósito de la rúbrica es: "${description}". Por favor, genera entre 3 y 5 dimensiones de evaluación relevantes.`,
      });

      const rubrica = (result.data as any).rubrica;

      const newRubrica: RubricaEstatica = {
        id: crypto.randomUUID(),
        titulo: rubrica.nombre,
        descripcion: rubrica.descripcion,
        fechaCreacion: new Date().toISOString(),
        dimensiones: rubrica.dimensiones.map((d: any) => ({
          id: crypto.randomUUID(),
          nombre: d.nombre,
          niveles: d.descriptores.reduce((acc: any, desc: any) => {
            const levelMap: { [key: string]: string } = {
              "Insuficiente": "insuficiente",
              "Suficiente": "suficiente",
              "Competente": "competente",
              "Avanzado": "avanzado"
            };
            const key = levelMap[desc.nivel] || desc.nivel.toLowerCase().replace(/\s/g, '');
            if (key) {
              acc[key] = desc.descripcion;
            }
            return acc;
          }, { insuficiente: '', suficiente: '', competente: '', avanzado: '' }),
        })),
      };

      // Guardar inmediatamente y abrir modal para asignar curso
      await onCreate(newRubrica);
      setCurrentRubrica(newRubrica);
      setView('form');
      setShowAssignModal(true);
    } catch (error) {
      console.error(error);
      alert('Error al generar la rúbrica con IA.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setCurrentRubrica({
      id: '', // ID se generará al guardar
      titulo: '',
      descripcion: '',
      fechaCreacion: new Date().toISOString(),
      dimensiones: [],
    });
    setView('form');
  };

  const handleEdit = (rubrica: RubricaEstatica) => {
    setCurrentRubrica(rubrica);
    setView('form');
  };

  const handleSave = () => {
    if (!currentRubrica) return;
    if (currentRubrica.id) {
      onSave(currentRubrica);
    } else {
      onCreate({ ...currentRubrica, id: crypto.randomUUID() });
    }
    setView('list');
    setCurrentRubrica(null);
  };

  const handleAddDimensionWithAI = async () => {
    if (!currentRubrica || !newDimensionName.trim()) return;

    const dimensionName = newDimensionName;
    setNewDimensionName('');

    const tempDimId = `temp-${crypto.randomUUID()}`;
    setCurrentRubrica(prev => prev ? {
      ...prev,
      dimensiones: [
        ...prev.dimensiones,
        { id: tempDimId, nombre: dimensionName, niveles: { insuficiente: '', suficiente: '', competente: '', avanzado: '' }, isLoading: true } as any
      ]
    } : null);

    try {
      const result = await generarDescriptorDimensionConGeminiFn({
        objetivo: currentRubrica.titulo,
        dimension: dimensionName,
        nivel: "todos", // Pedimos todos los niveles
        contextoAdicional: `Genera descriptores para los 4 niveles: Insuficiente, Suficiente, Competente y Avanzado. La respuesta debe ser un objeto JSON con claves "insuficiente", "suficiente", "competente", "avanzado".`
      });

      const niveles = (result.data as any).descriptores;

      setCurrentRubrica(prev => prev ? {
        ...prev,
        dimensiones: prev.dimensiones.map(d => d.id === tempDimId ? { ...d, niveles, isLoading: false } : d)
      } : null);

    } catch (error) {
      console.error(error);
      alert('No se pudo generar la dimensión con IA.');
      // Eliminar la dimensión temporal en caso de error
      setCurrentRubrica(prev => prev ? {
        ...prev,
        dimensiones: prev.dimensiones.filter(d => d.id !== tempDimId)
      } : null);
    }
  };

  const handleDimensionChange = (
    dimId: string,
    field: 'nombre' | keyof NivelDescriptor,
    value: string
  ) => {
    if (!currentRubrica) return;
    setCurrentRubrica((prev) =>
      prev
        ? {
            ...prev,
            dimensiones: prev.dimensiones.map((dim) => {
              if (dim.id !== dimId) return dim;
              if (field === 'nombre') {
                return { ...dim, nombre: value };
              } else {
                return { ...dim, niveles: { ...dim.niveles, [field]: value } };
              }
            }),
          }
        : null
    );
  };

  const handleTitleOrDescriptionChange = (
    field: 'titulo' | 'descripcion',
    value: string
  ) => {
    setCurrentRubrica((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleDeleteDimension = (dimId: string) => {
    if (!currentRubrica) return;
    setCurrentRubrica((prev) =>
      prev ? { ...prev, dimensiones: prev.dimensiones.filter((d) => d.id !== dimId) } : null
    );
  };

  const renderFormView = () => {
    if (!currentRubrica) return null;

    const inputStyles =
      'w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500 dark:bg-slate-700 dark:border-slate-600';
    const textareaStyles = `${inputStyles} resize-none text-sm`;

    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            Crear Rúbrica de Aprendizaje
          </h2>
          <button
            onClick={() => setView('list')}
            className="text-sm font-semibold text-slate-500 hover:underline"
          >
            &larr; Volver
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Título de la Rúbrica
            </label>
            <input
              value={currentRubrica.titulo}
              onChange={(e) => handleTitleOrDescriptionChange('titulo', e.target.value)}
              placeholder="Ej. Rúbrica de Presentaciones Orales"
              className={`${inputStyles} mt-1`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Descripción de la Rúbrica
            </label>
            <textarea
              value={currentRubrica.descripcion}
              onChange={(e) => handleTitleOrDescriptionChange('descripcion', e.target.value)}
              placeholder="Describe el propósito y los criterios de evaluación de esta rúbrica."
              rows={3}
              className={`${inputStyles} mt-1`}
            />
          </div>
        </div>
        {currentRubrica.dimensiones.length === 0 && (
          <div className="text-center py-4">
            <button
              onClick={() =>
                handleGenerateRubrica(currentRubrica.titulo, currentRubrica.descripcion)
              }
              disabled={isLoading || !currentRubrica.titulo || !currentRubrica.descripcion}
              className="bg-sky-500 text-white font-semibold py-2 px-5 rounded-lg disabled:bg-slate-400 flex items-center gap-2 mx-auto"
            >
              {isLoading ? 'Generando...' : '✨ Generar Rúbrica con IA'}
            </button>
          </div>
        )}

        {currentRubrica.dimensiones.length > 0 && (
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Dimensiones a Evaluar</h3>
            <button
              type="button"
              onClick={() => setShowAssignModal(true)}
              className="bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg"
            >
              Usar como Rúbrica Interactiva
            </button>
          </div>
        )}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {['Dimensión', 'Insuficiente', 'Suficiente', 'Competente', 'Avanzado', ''].map(
                  (header) => (
                    <th
                      key={header}
                      className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300"
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {currentRubrica.dimensiones.map((dim) => (
                <tr key={dim.id}>
                  <td className="p-2 w-1/5">
                    <textarea
                      value={dim.nombre}
                      onChange={(e) => handleDimensionChange(dim.id, 'nombre', e.target.value)}
                      rows={4}
                      className={textareaStyles}
                    />
                  </td>
                  {(Object.keys(dim.niveles) as (keyof NivelDescriptor)[]).map((level) => (
                    <td key={level} className="p-2 w-1/5">
                      {'isLoading' in dim && (dim as any).isLoading ? (
                        <div className="flex justify-center items-center h-full">
                          <div className="w-5 h-5 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        <textarea
                          value={dim.niveles[level]}
                          onChange={(e) =>
                            handleDimensionChange(dim.id, level, e.target.value)
                          }
                          rows={4}
                          className={textareaStyles}
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-2 w-[5%] text-center align-middle">
                    <button
                      onClick={() => handleDeleteDimension(dim.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-full text-lg"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-end gap-2 pt-2">
          <div className="flex-grow">
            <label className="text-sm font-medium">Añadir Dimensión</label>
            <input
              value={newDimensionName}
              onChange={(e) => setNewDimensionName(e.target.value)}
              placeholder="Escribe el nombre de la nueva dimensión..."
              className={`${inputStyles} mt-1`}
            />
          </div>
          <button
            onClick={handleAddDimensionWithAI}
            disabled={!newDimensionName.trim()}
            className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 h-10 disabled:opacity-50"
          >
            Generar con IA
          </button>
        </div>

        {/* Modal simple para asignar curso */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-full max-w-md space-y-4">
              <h3 className="text-lg font-bold">Asignar a Curso</h3>
              <label className="text-sm font-medium">Curso</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full border rounded p-2 dark:bg-slate-700"
              >
                <option value="">Selecciona un curso...</option>
                {availableCourses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <label className="text-sm font-medium">Asignatura</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full border rounded p-2 dark:bg-slate-700"
              >
                <option value="">Selecciona una asignatura...</option>
                {ASIGNATURAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAssignModal(false)} className="px-4 py-2">Cancelar</button>
                <button
                  disabled={!selectedCourse || !currentRubrica || !selectedSubject}
                  onClick={() => currentRubrica && createInteractiveFromRubrica(currentRubrica, selectedCourse, selectedSubject)}
                  className="bg-emerald-600 text-white px-4 py-2 rounded"
                >
                  Crear Interactiva
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (view === 'list') {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Mis Rúbricas</h2>
          <button
            onClick={handleCreateNew}
            className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900"
          >
            Crear Nueva
          </button>
        </div>
        {rubricas.length > 0 ? (
          rubricas.map((r) => (
            <div
              key={r.id}
              className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md flex justify-between items-center"
            >
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{r.titulo}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-lg">
                  {r.descripcion}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(r)}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  className="text-sm font-semibold text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-center py-4">
            No hay rúbricas guardadas.
          </p>
        )}
      </div>
    );
  }

  return renderFormView();
};

// -------------------------------------------------------------------
// Submódulo 3: Rúbricas Interactivas (implementación básica)
// -------------------------------------------------------------------
const RubricasInteractivas: React.FC<{
  allUsers: User[];
  rubricasEstaticas: RubricaEstatica[];
}> = ({ allUsers, rubricasEstaticas }) => {
  const [rubricasInteractivas, setRubricasInteractivas] = useState<
    RubricaInteractiva[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToRubricasInteractivas(setRubricasInteractivas);
    return () => unsubscribe();
  }, []);

  const selected = useMemo(
    () => rubricasInteractivas.find((r) => r.id === selectedId) || null,
    [rubricasInteractivas, selectedId]
  );

  const rubricaBase = useMemo(() => {
    if (!selected) return null;
    return rubricasEstaticas.find((r) => r.id === selected.rubricaEstaticaId) || null;
  }, [selected, rubricasEstaticas]);

  const estudiantesCurso = useMemo(() => {
    if (!selected) return [] as User[];
    return allUsers.filter(
      (u) => u.profile === Profile.ESTUDIANTE && normalizeCurso(u.curso || '') === normalizeCurso(selected.curso)
    );
  }, [selected, allUsers]);

  const setPuntaje = async (estId: string, dimName: string, value: number) => {
    if (!selected) return;
    const current = selected.resultados[estId] || { puntajes: {}, feedback: '' };
    const updated = {
      ...selected.resultados,
      [estId]: { ...current, puntajes: { ...current.puntajes, [dimName]: value } },
    };
    await updateRubricaInteractiva(selected.id, { resultados: updated });
  };

  const calcNota = (estId: string): number => {
    if (!rubricaBase) return 1;
    const dims = rubricaBase.dimensiones.map((d) => d.nombre);
    const res = selected?.resultados[estId];
    if (!res) return 1;
    const sum = dims.reduce((acc, name) => acc + (res.puntajes[name] || 0), 0);
    const max = dims.length * 4; // niveles 1-4
    const pct = max > 0 ? sum / max : 0;
    const nota = 1 + 6 * pct; // escala 1-7
    return Math.round(nota * 10) / 10;
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4">Rúbricas Interactivas</h2>
      <div className="flex gap-4">
        <div className="w-1/3 space-y-2">
          {rubricasInteractivas.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`w-full text-left p-3 rounded border ${selectedId === r.id ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-slate-50 dark:bg-slate-700/50'}`}
            >
              <div className="font-semibold">{r.nombre}</div>
              <div className="text-xs text-slate-500">Curso: {r.curso} · Asignatura: {r.asignatura}</div>
            </button>
          ))}
          {rubricasInteractivas.length === 0 && (
            <p className="text-slate-500 text-sm">No hay rúbricas interactivas.</p>
          )}
        </div>
        <div className="flex-1">
          {selected && rubricaBase ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">{selected.nombre} — {selected.curso}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="p-2 text-left">Estudiante</th>
                      {rubricaBase.dimensiones.map((d) => (
                        <th key={d.id} className="p-2 text-left">{d.nombre}</th>
                      ))}
                      <th className="p-2 text-left">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estudiantesCurso.map((est) => (
                      <tr key={est.id} className="border-t">
                        <td className="p-2">{est.nombreCompleto}</td>
                        {rubricaBase.dimensiones.map((d) => {
                          const current = selected.resultados[est.id]?.puntajes?.[d.nombre] || 0;
                          return (
                            <td key={d.id} className="p-2">
                              <select
                                value={current}
                                onChange={(e) => setPuntaje(est.id, d.nombre, Number(e.target.value))}
                                className="border rounded p-1 dark:bg-slate-700"
                              >
                                <option value={0}>—</option>
                                <option value={1}>1 - Insuficiente</option>
                                <option value={2}>2 - Suficiente</option>
                                <option value={3}>3 - Competente</option>
                                <option value={4}>4 - Avanzado</option>
                              </select>
                            </td>
                          );
                        })}
                        <td className="p-2 font-semibold">{calcNota(est.id).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-slate-500">Selecciona una rúbrica interactiva para calificar.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------------
// Componente principal
// -------------------------------------------------------------------
const EvaluacionAprendizajes: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'pruebas' | 'rubricas' | 'rubricasInteractivas' | 'nominas'
  >('pruebas');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [rubricasEstaticas, setRubricasEstaticas] = useState<RubricaEstatica[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubUsers = subscribeToAllUsers(setAllUsers);
    const unsubRubricas = subscribeToRubricasEstaticas((data) => {
      setRubricasEstaticas(data);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubRubricas();
    };
  }, []);

  if (loading) {
    return <div className="text-center py-10 text-lg">Cargando datos...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded-lg font-semibold ${activeTab === 'pruebas' ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 dark:text-slate-200'}`}
          onClick={() => setActiveTab('pruebas')}
        >
          Pruebas
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-semibold ${activeTab === 'rubricas' ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 dark:text-slate-200'}`}
          onClick={() => setActiveTab('rubricas')}
        >
          Rúbricas
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-semibold ${activeTab === 'rubricasInteractivas' ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 dark:text-slate-200'}`}
          onClick={() => setActiveTab('rubricasInteractivas')}
        >
          Rúbricas Interactivas
        </button>
      </div>
      {activeTab === 'pruebas' && <PruebasSubmodule />}
      {activeTab === 'rubricas' && (
        <RubricasSubmodule
          rubricas={rubricasEstaticas}
          onSave={saveRubricaEstatica}
          onDelete={deleteRubricaEstatica}
          onCreate={saveRubricaEstatica}
          allUsers={allUsers}
          onCreatedInteractiva={() => setActiveTab('rubricasInteractivas')}
        />
      )}
      {activeTab === 'rubricasInteractivas' && (
        <RubricasInteractivas allUsers={allUsers} rubricasEstaticas={rubricasEstaticas} />
      )}
    </div>
  );
};

export default EvaluacionAprendizajes;
