import {
  subscribeToPruebas,
  savePrueba,
  deletePrueba,
  subscribeToRubricasEstaticas,
  saveRubricaEstatica,
  deleteRubricaEstatica,
  subscribeToRubricasInteractivas,
  createRubricaInteractiva,
  subscribeToAllUsers
} from '../../src/firebaseHelpers/evaluacionHelper';

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
import { addGoogleSansCodeFont } from '../../utils/fonts/googleSansCode';

// -------------------------------------------------------------------
// Constantes y utilidades
// -------------------------------------------------------------------

const ITEM_QUANTITIES: Record<string, number[]> = {
  "Selección múltiple": [5, 10, 15],
  "Verdadero o Falso": [5, 10, 15],
  "Términos pareados": [5, 10, 15],
  "Desarrollo": [1, 2, 3],
  "Comprensión de lectura": [1, 2, 3]
};

const TIPOS_ACTIVIDAD_PRUEBA: PruebaItemTipo[] = [
  'Selección múltiple',
  'Verdadero o Falso',
  'Términos pareados',
  'Comprensión de lectura',
  'Desarrollo',
];

const normalizeCurso = (curso: string): string => {
  if (!curso) return '';
  let normalized = curso.trim().toLowerCase();
  normalized = normalized.replace(/°/g, 'º');
  normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
  normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
  normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
  normalized = normalized.replace(/\s+/g, '').toUpperCase();
  return normalized;
};

const EyeIcon: React.FC<{ open?: boolean }> = ({ open }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    {open ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59"
      />
    ) : (
      <>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </>
    )}
  </svg>
);

// -------------------------------------------------------------------
// Render de ítems de prueba (visor)
// -------------------------------------------------------------------
const PruebaItemViewer: React.FC<{
  item: PruebaItem;
  index: number;
  showAnswers: boolean;
}> = ({ item, index, showAnswers }) => {
  const shuffledDefinitions = useMemo(
    () =>
      item.tipo === 'Términos pareados'
        ? [
            ...(item as TerminosPareadosItem).pares.map((p) => p.definicion),
          ].sort(() => Math.random() - 0.5)
        : [],
    [item]
  );

  return (
    <div key={item.id}>
      <div className="flex justify-between items-start">
        <p className="font-semibold flex-grow pr-4">
          {index + 1}. {item.pregunta} ({item.puntaje} pts)
        </p>
        {item.habilidadBloom && (
          <span className="flex-shrink-0 text-xs font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">
            {item.habilidadBloom}
          </span>
        )}
      </div>

      {item.tipo === 'Selección múltiple' && (
        <div className="ml-4 mt-2 space-y-2">
          {(item as SeleccionMultipleItem).opciones.map((op, i) => {
            const isCorrect =
              showAnswers &&
              i === (item as SeleccionMultipleItem).respuestaCorrecta;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 p-1 rounded ${
                  isCorrect ? 'bg-green-100 dark:bg-green-900/50' : ''
                }`}
              >
                <div className="w-5 h-5 border rounded-full"></div>
                <span>
                  {String.fromCharCode(65 + i)}) {op}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {item.tipo === 'Desarrollo' && (
        <div className="mt-2 p-2 border rounded-md min-h-[96px] bg-slate-50 dark:bg-slate-700/50"></div>
      )}

      {item.tipo === 'Verdadero o Falso' && (
        <div className="mt-2 ml-4 flex items-center gap-4">
          <span>V ___ F ___</span>
          {showAnswers && (
            <span className="font-bold p-1 rounded bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
              Respuesta:{' '}
              {(item as VerdaderoFalsoItem).respuestaCorrecta
                ? 'VERDADERO'
                : 'FALSO'}
            </span>
          )}
        </div>
      )}

      {item.tipo === 'Términos pareados' && (
        <div className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-center mb-2">Columna A: Concepto</h4>
              <div className="space-y-2">
                {(item as TerminosPareadosItem).pares.map((par, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg min-h-[50px] flex items-center"
                  >
                    {idx + 1}. {par.concepto}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-center mb-2">
                Columna B: Definición
              </h4>
              <div className="space-y-2">
                {shuffledDefinitions.map((def, idx) => (
                  <div
                    key={idx}
                    className="bg-sky-100 dark:bg-sky-900/50 p-3 rounded-lg min-h-[50px] flex items-center"
                  >
                    {def}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {showAnswers && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
              <h4 className="font-bold text-green-800 dark:text-green-200">
                Respuestas Correctas:
              </h4>
              <ul className="list-disc list-inside mt-2 text-sm text-slate-700 dark:text-slate-300">
                {(item as TerminosPareadosItem).pares.map((par, idx) => (
                  <li key={idx}>
                    <strong>{par.concepto}</strong> &rarr; {par.definicion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {item.tipo === 'Comprensión de lectura' && (
        <div className="ml-4 mt-2 space-y-4">
          <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-md whitespace-pre-wrap">
            {(item as ComprensionLecturaItem).texto}
          </div>
          {(item as ComprensionLecturaItem).preguntas.map((sub, subIndex) => {
            if (sub.tipo === 'Selección múltiple') {
              const smSub = sub as SeleccionMultipleItem;
              return (
                <div key={sub.id} className="pt-2">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold flex-grow pr-4">
                      {subIndex + 1}. {smSub.pregunta} ({smSub.puntaje} pts)
                    </p>
                    {smSub.habilidadBloom && (
                      <span className="flex-shrink-0 text-xs font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">
                        {smSub.habilidadBloom}
                      </span>
                    )}
                  </div>
                  <div className="ml-4 mt-2 space-y-2">
                    {smSub.opciones.map((op, i) => {
                      const isCorrect = showAnswers && i === smSub.respuestaCorrecta;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 p-1 rounded ${
                            isCorrect ? 'bg-green-100 dark:bg-green-900/50' : ''
                          }`}
                        >
                          <div className="w-5 h-5 border rounded-full"></div>
                          <span>
                            {String.fromCharCode(65 + i)}) {op}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            if (sub.tipo === 'Desarrollo') {
              const dSub = sub as DesarrolloItem;
              return (
                <div key={sub.id} className="pt-2">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold flex-grow pr-4">
                      {subIndex + 1}. {dSub.pregunta} ({dSub.puntaje} pts)
                    </p>
                    {dSub.habilidadBloom && (
                      <span className="flex-shrink-0 text-xs font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">
                        {dSub.habilidadBloom}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 p-2 border rounded-md min-h-[96px] bg-slate-50 dark:bg-slate-700/50"></div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------------
// Submódulo 1: Pruebas
// -------------------------------------------------------------------
const PruebasSubmodule: React.FC = () => {
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [currentPrueba, setCurrentPrueba] = useState<Prueba | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  const initialFormState = {
    nombre: '',
    asignatura: ASIGNATURAS[0],
    nivel: NIVELES[0],
    contenido: '',
    tiposActividad: {} as Partial<Record<PruebaItemTipo, number>>,
    dificultad: 'Intermedio' as 'Fácil' | 'Intermedio' | 'Avanzado',
    isNee: false,
    selectedNee: [] as DificultadAprendizaje[],
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    const unsubscribe = subscribeToPruebas(setPruebas);
    return () => unsubscribe();
  }, []);

  const handleFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTipoActividadToggle = (tipo: PruebaItemTipo) => {
    setFormData((prev) => {
      const newTipos = { ...prev.tiposActividad };
      if (newTipos[tipo]) {
        delete newTipos[tipo];
      } else {
        newTipos[tipo] = ITEM_QUANTITIES[tipo][0];
      }
      return { ...prev, tiposActividad: newTipos };
    });
  };

  const handleQuantityChange = (tipo: PruebaItemTipo, cantidad: number) => {
    setFormData((prev) => ({
      ...prev,
      tiposActividad: {
        ...prev.tiposActividad,
        [tipo]: cantidad,
      },
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

  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div style={{textAlign: 'center', marginTop: '2rem'}}>Cargando sesión...</div>;
  }
  if (!currentUser || !currentUser.uid) {
    return <div style={{textAlign: 'center', marginTop: '2rem'}}>Debes iniciar sesión.</div>;
  }

  const handleGeneratePrueba = async (e: FormEvent) => {
    if (!currentUser || !currentUser.uid) {
      setError("Debes iniciar sesión para generar una evaluación.");
      return;
    }
    e.preventDefault();
    if (!currentUser) {
      setError('Debes iniciar sesión para generar una prueba con IA.');
      return;
    }
    if (
      !formData.nombre.trim() ||
      !formData.contenido.trim() ||
      Object.keys(formData.tiposActividad).length === 0
    ) {
      setError(
        'Nombre, Contenido y al menos un tipo de actividad son obligatorios.'
      );
      return;
    }
    setIsGenerating(true);
    setError(null);

    const promptInstructions = Object.entries(formData.tiposActividad)
      .map(([tipo, cantidad]) => `- ${cantidad} ítem(s) de tipo '${tipo}'`)
      .join('\n');

    const neeAdaptationPrompt =
      formData.isNee && formData.selectedNee.length > 0
        ? `
**Adaptación CRÍTICA para Necesidades Educativas Especiales (NEE):**
Adapta esta prueba para estudiantes con las siguientes características: ${formData.selectedNee.join(
            ', '
          )}.
Esto implica las siguientes modificaciones OBLIGATORIAS:
- Usa un lenguaje claro, simple y directo en todas las preguntas e instrucciones.
- Evita preguntas con doble negación o estructuras gramaticales complejas.
- En preguntas de desarrollo, desglosa la pregunta en partes más pequeñas si es posible.
- Para 'Comprensión de Lectura', usa textos más cortos (100-150 palabras) y con vocabulario accesible.
- Para 'Selección Múltiple', asegúrate de que los distractores sean claramente incorrectos y no ambiguos.`
        : '';

    const prompt = `
Eres un experto en evaluación educativa para la educación media en Chile.
Genera una prueba o guía de trabajo completa en formato JSON estructurado.

Información base:
- Nombre de la prueba: ${formData.nombre}
- Asignatura: ${formData.asignatura}
- Nivel: ${formData.nivel}
- Contenido a evaluar: "${formData.contenido}"
- Tipos y cantidad de ítems solicitados:
  ${promptInstructions}
- Nivel de Dificultad General: ${formData.dificultad}. 'Fácil' implica preguntas directas y de recuerdo. 'Intermedio' incluye aplicación y análisis simple. 'Avanzado' requiere síntesis, evaluación y resolución de problemas complejos.

${neeAdaptationPrompt}

Tu respuesta DEBE ser un único objeto JSON válido sin texto introductorio, explicaciones, ni el bloque \`\`\`json. El objeto debe contener:
1. 'objetivo': Un objetivo de aprendizaje claro para la evaluación.
2. 'instruccionesGenerales': Instrucciones claras para el estudiante.
3. 'actividades': Un array de objetos, donde cada objeto es una actividad por cada tipo de ítem solicitado. Cada actividad debe tener:
   - 'id': Un UUID generado por ti.
   - 'titulo': Un título descriptivo (ej: "Actividad 1: Selección Múltiple").
   - 'instrucciones': Instrucciones para esa actividad específica.
   - 'items': Un array de preguntas con la cantidad exacta solicitada. Cada pregunta (item) debe tener:
       - 'id': Un UUID generado por ti.
       - 'tipo': El tipo de ítem.
       - 'pregunta': El enunciado de la pregunta.
       - 'puntaje': Un puntaje numérico.
       - 'habilidadBloom': La habilidad principal de la Taxonomía de Bloom que se trabaja (ej: Analizar, Crear, Evaluar).
       - Campos adicionales según el tipo:
           - Para 'Selección múltiple': 'opciones' (array de EXACTAMENTE 4 strings sin la letra de la alternativa) y 'respuestaCorrecta' (índice numérico de la respuesta correcta, de 0 a 3).
           - Para 'Verdadero o Falso': 'respuestaCorrecta' (booleano).
           - Para 'Términos pareados': 'pares' (array de objetos con 'concepto' y 'definicion').
           - Para 'Comprensión de lectura': 'texto' (150 a 250 palabras, generado por ti) y 'preguntas' (array de sub-preguntas tipo 'Selección múltiple' o 'Desarrollo').
           - Para 'Desarrollo': no necesita campos adicionales.
`;

    try {
      logApiCall('Evaluación - Pruebas', null);

      const response = await fetch('/api/generarEvaluacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, formData, uid: currentUser.uid }),
      });
      if (!response.ok) throw new Error('Error al generar la prueba con IA');
      const generatedData = await response.json();

      let puntajeIdeal = 0;
      generatedData.actividades.forEach((act: PruebaActividad) => {
        act.items.forEach((item: any) => {
          puntajeIdeal += item.puntaje || 0;
          if (item.tipo === 'Comprensión de lectura' && item.preguntas) {
            item.preguntas.forEach((subItem: any) => {
              puntajeIdeal += subItem.puntaje || 0;
            });
          }
        });
      });

      const newPrueba: Prueba = {
        id: crypto.randomUUID(),
        fechaCreacion: new Date().toISOString(),
        nombre: formData.nombre,
        asignatura: formData.asignatura,
        nivel: formData.nivel,
        contenidoOriginal: formData.contenido,
        tiposActividadOriginal: formData.tiposActividad,
        objetivo: generatedData.objetivo,
        instruccionesGenerales: generatedData.instruccionesGenerales,
        puntajeIdeal,
        actividades: generatedData.actividades,
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
          const enun = `${iIdx + 1}. ${item.pregunta} (${item.puntaje} pts)`;
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
                const subEnun = `${sIdx + 1}. ${sub.pregunta} (${sub.puntaje} pts)`;
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
                {act.items.map((item, index) => (
                  <PruebaItemViewer
                    key={item.id}
                    item={item}
                    index={index}
                    showAnswers={showAnswers}
                  />
                ))}
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
            {TIPOS_ACTIVIDAD_PRUEBA.map((tipo) => (
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
                {formData.tiposActividad[tipo] && (
                  <div className="mt-3 pl-8 flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Cantidad:
                    </span>
                    {ITEM_QUANTITIES[tipo].map((qty) => (
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
}> = ({ rubricas, onSave, onDelete, onCreate }) => {
  const [currentRubrica, setCurrentRubrica] = useState<RubricaEstatica | null>(
    null
  );
  const [view, setView] = useState<'list' | 'form'>('list');
  const [isLoading, setIsLoading] = useState(false);
  const [newDimensionName, setNewDimensionName] = useState('');

  const handleGenerateRubrica = async (title: string, description: string) => {
    if (!title.trim() || !description.trim()) {
      alert('El título y la descripción son obligatorios.');
      return;
    }
    setIsLoading(true);
    const prompt = `Crea una rúbrica de evaluación detallada sobre "${title}" con el propósito de "${description}". Genera entre 3 y 5 dimensiones de evaluación. Para cada dimensión, crea un descriptor para 4 niveles: Insuficiente, Suficiente, Competente, y Avanzado. Tu respuesta DEBE ser un único objeto JSON válido sin texto introductorio, explicaciones, ni el bloque \`\`\`json.`;

    try {
      logApiCall('Evaluación - Rúbricas', null);
      const response = await fetch('/api/generarRubrica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, title, description }),
      });
      if (!response.ok) throw new Error('Error al generar la rúbrica con IA');
      const generatedDimensions = await response.json();

      const newRubrica: RubricaEstatica = {
        id: crypto.randomUUID(),
        titulo: title,
        descripcion: description,
        fechaCreacion: new Date().toISOString(),
        dimensiones: generatedDimensions.map((d: any) => ({
          id: crypto.randomUUID(),
          nombre: d.dimension,
          niveles: {
            insuficiente: d.insuficiente,
            suficiente: d.suficiente,
            competente: d.competente,
            avanzado: d.avanzado,
          },
        })),
      };
      setCurrentRubrica(newRubrica);
      setView('form');
    } catch (error) {
      console.error(error);
      alert('Error al generar la rúbrica con IA.');
    } finally {
      setIsLoading(false);
    }
  };

  // ...existing code...
  const handleGeneratePrueba = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.uid) {
      setError("Debes iniciar sesión para generar una evaluación.");
      return;
    }
    if (
      !formData.nombre.trim() ||
      !formData.contenido.trim() ||
      Object.keys(formData.tiposActividad).length === 0
    ) {
      setError(
        'Nombre, Contenido y al menos un tipo de actividad son obligatorios.'
      );
      return;
    }
    setIsGenerating(true);
    setError(null);

    const promptInstructions = Object.entries(formData.tiposActividad)
      .map(([tipo, cantidad]) => `- ${cantidad} ítem(s) de tipo '${tipo}'`)
      .join('\n');

    const neeAdaptationPrompt =
      formData.isNee && formData.selectedNee.length > 0
        ? `\n**Adaptación CRÍTICA para Necesidades Educativas Especiales (NEE):**\nAdapta esta prueba para estudiantes con las siguientes características: ${formData.selectedNee.join(
            ', '
          )}.\nEsto implica las siguientes modificaciones OBLIGATORIAS:\n- Usa un lenguaje claro, simple y directo en todas las preguntas e instrucciones.\n- Evita preguntas con doble negación o estructuras gramaticales complejas.\n- En preguntas de desarrollo, desglosa la pregunta en partes más pequeñas si es posible.\n- Para 'Comprensión de Lectura', usa textos más cortos (100-150 palabras) y con vocabulario accesible.\n- Para 'Selección Múltiple', asegúrate de que los distractores sean claramente incorrectos y no ambiguos.`
        : '';

    const prompt = `\nEres un experto en evaluación educativa para la educación media en Chile.\nGenera una prueba o guía de trabajo completa en formato JSON estructurado.\n\nInformación base:\n- Nombre de la prueba: ${formData.nombre}\n- Asignatura: ${formData.asignatura}\n- Nivel: ${formData.nivel}\n- Contenido a evaluar: "${formData.contenido}"\n- Tipos y cantidad de ítems solicitados:\n  ${promptInstructions}\n- Nivel de Dificultad General: ${formData.dificultad}. 'Fácil' implica preguntas directas y de recuerdo. 'Intermedio' incluye aplicación y análisis simple. 'Avanzado' requiere síntesis, evaluación y resolución de problemas complejos.\n\n${neeAdaptationPrompt}\n\nTu respuesta DEBE ser un único objeto JSON válido sin texto introductorio, explicaciones, ni el bloque \`\`\`json. El objeto debe contener:\n1. 'objetivo': Un objetivo de aprendizaje claro para la evaluación.\n2. 'instruccionesGenerales': Instrucciones claras para el estudiante.\n3. 'actividades': Un array de objetos, donde cada objeto es una actividad por cada tipo de ítem solicitado. Cada actividad debe tener:\n   - 'id': Un UUID generado por ti.\n   - 'titulo': Un título descriptivo (ej: "Actividad 1: Selección Múltiple").\n   - 'instrucciones': Instrucciones para esa actividad específica.\n   - 'items': Un array de preguntas con la cantidad exacta solicitada. Cada pregunta (item) debe tener:\n       - 'id': Un UUID generado por ti.\n       - 'tipo': El tipo de ítem.\n       - 'pregunta': El enunciado de la pregunta.\n       - 'puntaje': Un puntaje numérico.\n       - 'habilidadBloom': La habilidad principal de la Taxonomía de Bloom que se trabaja (ej: Analizar, Crear, Evaluar).\n       - Campos adicionales según el tipo:\n           - Para 'Selección múltiple': 'opciones' (array de EXACTAMENTE 4 strings sin la letra de la alternativa) y 'respuestaCorrecta' (índice numérico de la respuesta correcta, de 0 a 3).\n           - Para 'Verdadero o Falso': 'respuestaCorrecta' (booleano).\n           - Para 'Términos pareados': 'pares' (array de objetos con 'concepto' y 'definicion').\n           - Para 'Comprensión de lectura': 'texto' (150 a 250 palabras, generado por ti) y 'preguntas' (array de sub-preguntas tipo 'Selección múltiple' o 'Desarrollo').\n           - Para 'Desarrollo': no necesita campos adicionales.\n`;

    try {
      logApiCall('Evaluación - Pruebas', null);
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/generarEvaluacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, formData, uid: currentUser.uid }),
      });
      if (!response.ok) throw new Error('Error al generar la prueba con IA');
      const generatedData = await response.json();

      let puntajeIdeal = 0;
      generatedData.actividades.forEach((act: PruebaActividad) => {
        act.items.forEach((item: any) => {
          puntajeIdeal += item.puntaje || 0;
          if (item.tipo === 'Comprensión de lectura' && item.preguntas) {
            item.preguntas.forEach((subItem: any) => {
              puntajeIdeal += subItem.puntaje || 0;
            });
          }
        });
      });

      const newPrueba: Prueba = {
        id: crypto.randomUUID(),
        fechaCreacion: new Date().toISOString(),
        nombre: formData.nombre,
        asignatura: formData.asignatura,
        nivel: formData.nivel,
        contenidoOriginal: formData.contenido,
        tiposActividadOriginal: formData.tiposActividad,
        objetivo: generatedData.objetivo,
        instruccionesGenerales: generatedData.instruccionesGenerales,
        puntajeIdeal,
        actividades: generatedData.actividades,
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
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              Dimensiones a Evaluar
            </h3>
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
          </div>
        )}

        <div className="flex justify-end pt-6 border-t dark:border-slate-700">
          <button
            onClick={handleSave}
            className="bg-amber-500 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-amber-600"
          >
            Guardar Rúbrica
          </button>
        </div>
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
// Submódulo 3: Rúbricas Interactivas (vista mínima para compilar)
// -------------------------------------------------------------------
const RubricasInteractivas: React.FC<{
  allUsers: User[];
  rubricasEstaticas: RubricaEstatica[];
}> = ({ allUsers, rubricasEstaticas }) => {
  const [rubricasInteractivas, setRubricasInteractivas] = useState<
    RubricaInteractiva[]
  >([]);

  useEffect(() => {
    const unsubscribe = subscribeToRubricasInteractivas(setRubricasInteractivas);
    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
        Rúbricas Interactivas
      </h2>
      <p className="text-slate-600 dark:text-slate-400">
        Módulo en desarrollo. Próximamente podrás asignar y calificar con rúbricas interactivas.
      </p>
      <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Total de rúbricas activas: {rubricasInteractivas.length}
      </div>
    </div>
  );
};

// -------------------------------------------------------------------
// Submódulo 4: Gestión de Nóminas (Read-only)
// -------------------------------------------------------------------
const GestionNominas: React.FC<{ allUsers: User[] }> = ({ allUsers }) => {
  const [selectedCourse, setSelectedCourse] = useState('');

  const availableCourses = useMemo(() => {
    return Array.from(
      new Set(
        allUsers
          .filter((u) => u.profile === Profile.ESTUDIANTE && u.curso)
          .map((u) => normalizeCurso(u.curso!))
      )
    ).sort();
  }, [allUsers]);

  const filteredStudents = useMemo(() => {
    const baseStudentList = allUsers.filter((u) => u.profile === Profile.ESTUDIANTE);
    if (!selectedCourse) {
      return baseStudentList.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    }
    return baseStudentList
      .filter((u) => normalizeCurso(u.curso || '') === selectedCourse)
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }, [allUsers, selectedCourse]);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Nóminas de Cursos</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6">
        Este es un visor de las nóminas de estudiantes. Para agregar, editar o eliminar estudiantes,
        utilice el módulo de <strong className="font-semibold">Administración</strong>.
      </p>
      <div className="mb-4">
        <label
          htmlFor="curso-filter"
          className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1"
        >
          Filtrar por Curso
        </label>
        <select
          id="curso-filter"
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="w-full max-w-xs border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
        >
          <option value="">Mostrar Todos los Estudiantes</option>
          {availableCourses.map((curso) => (
            <option key={curso} value={curso}>
              {curso}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto border rounded-lg dark:border-slate-700 max-h-[60vh]">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Nombre Completo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Curso
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Email
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {filteredStudents.length > 0 ? (
              filteredStudents.map((est) => (
                <tr key={est.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                    {est.nombreCompleto}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                    {normalizeCurso(est.curso || '')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                    {est.email}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-10 text-center text-slate-500 dark:text-slate-400"
                >
                  No hay estudiantes que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

  const handleSaveRubrica = async (rubrica: RubricaEstatica) => {
    try {
      await saveRubricaEstatica(rubrica);
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar la rúbrica.');
    }
  };

  const handleDeleteRubrica = async (id: string) => {
    try {
      await deleteRubricaEstatica(id);
    } catch (error) {
      console.error(error);
      alert('No se pudo eliminar la rúbrica.');
    }
  };

  const TabButton: React.FC<{ tabName: typeof activeTab; label: string }> = ({
    tabName,
    label,
  }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`${
        activeTab === tabName
          ? 'border-amber-500 text-amber-600 dark:text-amber-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
      } whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
    >
      {label}
    </button>
  );

  if (loading) {
    return <div className="text-center py-10">Cargando módulo de evaluaciones...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
        Evaluación de Aprendizajes
      </h1>
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <TabButton tabName="pruebas" label="Pruebas y Guías" />
          <TabButton tabName="rubricas" label="Generador de Rúbricas" />
          <TabButton tabName="rubricasInteractivas" label="Rúbricas Interactivas" />
          <TabButton tabName="nominas" label="Gestión de Nóminas" />
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === 'pruebas' && <PruebasSubmodule />}
        {activeTab === 'rubricas' && (
          <RubricasSubmodule
            rubricas={rubricasEstaticas}
            onSave={handleSaveRubrica}
            onDelete={handleDeleteRubrica}
            onCreate={handleSaveRubrica}
          />
        )}
        {activeTab === 'rubricasInteractivas' && (
          <RubricasInteractivas allUsers={allUsers} rubricasEstaticas={rubricasEstaticas} />
        )}
        {activeTab === 'nominas' && <GestionNominas allUsers={allUsers} />}
      </div>
    </div>
  );
};

export default EvaluacionAprendizajes;
