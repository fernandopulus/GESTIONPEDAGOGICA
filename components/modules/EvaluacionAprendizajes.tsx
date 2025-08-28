import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { User, Profile, RubricaInteractiva, ResultadoInteractivo, Prueba, PruebaItemTipo, PruebaActividad, PruebaItem, SeleccionMultipleItem, TerminosPareadosItem, RubricaEstatica, DimensionRubrica, NivelDescriptor, VerdaderoFalsoItem, ComprensionLecturaItem, DesarrolloItem, DificultadAprendizaje } from '../../types';
import { ASIGNATURAS, CURSOS, NIVELES, PDFIcon, DIFICULTADES_APRENDIZAJE } from '../../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logApiCall } from '../utils/apiLogger';
import {
    subscribeToPruebas,
    savePrueba,
    deletePrueba,
    subscribeToRubricasEstaticas,
    saveRubricaEstatica,
    deleteRubricaEstatica,
    subscribeToRubricasInteractivas,
    saveRubricaInteractiva,
    createRubricaInteractiva,
    subscribeToAllUsers
} from '../../src/firebaseHelpers/evaluacionHelper';

import { GoogleGenerativeAI } from '@google/generative-ai';


const TIPOS_ACTIVIDAD_PRUEBA: PruebaItemTipo[] = ['Selección múltiple', 'Verdadero o Falso', 'Desarrollo', 'Términos pareados', 'Comprensión de lectura'];

const ITEM_QUANTITIES: Record<PruebaItemTipo, number[]> = {
    'Selección múltiple': [5, 10, 15],
    'Verdadero o Falso': [5, 10, 15],
    'Términos pareados': [5, 10, 15],
    'Desarrollo': [1, 2, 3],
    'Comprensión de lectura': [1, 2, 3],
};

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
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    {open ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59" />
    ) : (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </>
    )}
  </svg>
);

const PruebaItemViewer: React.FC<{ item: PruebaItem, index: number, showAnswers: boolean }> = ({ item, index, showAnswers }) => {
    const shuffledDefinitions = useMemo(() =>
        item.tipo === 'Términos pareados'
            ? [...(item as TerminosPareadosItem).pares.map(p => p.definicion)].sort(() => Math.random() - 0.5)
            : [],
        [item]
    );

    return (
        <div key={item.id}>
            <div className="flex justify-between items-start">
                <p className="font-semibold flex-grow pr-4">{index + 1}. {item.pregunta} ({item.puntaje} pts)</p>
                {item.habilidadBloom && (
                    <span className="flex-shrink-0 text-xs font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">{item.habilidadBloom}</span>
                )}
            </div>
            {item.tipo === 'Selección múltiple' && (
                <div className="ml-4 mt-2 space-y-2">
                    {(item as SeleccionMultipleItem).opciones.map((op, i) => {
                        const isCorrect = showAnswers && i === (item as SeleccionMultipleItem).respuestaCorrecta;
                        return (
                            <div key={i} className={`flex items-center gap-2 p-1 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/50' : ''}`}>
                                <div className="w-5 h-5 border rounded-full"></div>
                                <span>{String.fromCharCode(65 + i)}) {op}</span>
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
                            Respuesta: {(item as VerdaderoFalsoItem).respuestaCorrecta ? 'VERDADERO' : 'FALSO'}
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
                                    <div key={idx} className="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg min-h-[50px] flex items-center">
                                        {idx + 1}. {par.concepto}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-center mb-2">Columna B: Definición</h4>
                            <div className="space-y-2">
                                {shuffledDefinitions.map((def, idx) => (
                                    <div key={idx} className="bg-sky-100 dark:bg-sky-900/50 p-3 rounded-lg min-h-[50px] flex items-center">
                                        {def}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {showAnswers && (
                        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                            <h4 className="font-bold text-green-800 dark:text-green-200">Respuestas Correctas:</h4>
                            <ul className="list-disc list-inside mt-2 text-sm text-slate-700 dark:text-slate-300">
                                {(item as TerminosPareadosItem).pares.map((par, idx) => (
                                    <li key={idx}><strong>{par.concepto}</strong> &rarr; {par.definicion}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
             {item.tipo === 'Comprensión de lectura' && (
                <div className="ml-4 mt-2 space-y-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-md whitespace-pre-wrap">{ (item as ComprensionLecturaItem).texto}</div>
                    {(item as ComprensionLecturaItem).preguntas.map((sub, subIndex) => {
                        if (sub.tipo === 'Selección múltiple') {
                            const smSub = sub as SeleccionMultipleItem;
                             return (
                                <div key={sub.id} className="pt-2">
                                     <div className="flex justify-between items-start">
                                        <p className="font-semibold flex-grow pr-4">{subIndex + 1}. {smSub.pregunta} ({smSub.puntaje} pts)</p>
                                        {smSub.habilidadBloom && (
                                            <span className="flex-shrink-0 text-xs font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">{smSub.habilidadBloom}</span>
                                        )}
                                    </div>
                                    <div className="ml-4 mt-2 space-y-2">
                                        {smSub.opciones.map((op, i) => {
                                            const isCorrect = showAnswers && i === smSub.respuestaCorrecta;
                                            return (
                                                <div key={i} className={`flex items-center gap-2 p-1 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/50' : ''}`}>
                                                    <div className="w-5 h-5 border rounded-full"></div>
                                                    <span>{String.fromCharCode(65 + i)}) {op}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        }
                         if (sub.tipo === 'Desarrollo') {
                            const dSub = sub as DesarrolloItem;
                             return (
                                <div key={sub.id} className="pt-2">
                                    <div className="flex justify-between items-start">
                                        <p className="font-semibold flex-grow pr-4">{subIndex + 1}. {dSub.pregunta} ({dSub.puntaje} pts)</p>
                                        {dSub.habilidadBloom && (
                                            <span className="flex-shrink-0 text-xs font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">{dSub.habilidadBloom}</span>
                                        )}
                                    </div>
                                     <div className="mt-2 p-2 border rounded-md min-h-[96px] bg-slate-50 dark:bg-slate-700/50"></div>
                                </div>
                            )
                        }
                        return null;
                    })}
                </div>
            )}
        </div>
    );
};

// --- SUB-MÓDULO 1: PRUEBAS ---
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

    const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleTipoActividadToggle = (tipo: PruebaItemTipo) => {
        setFormData(prev => {
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
        setFormData(prev => ({
            ...prev,
            tiposActividad: {
                ...prev.tiposActividad,
                [tipo]: cantidad,
            }
        }));
    };
    
    const handleNeeChange = (dificultad: DificultadAprendizaje) => {
        setFormData(prev => {
            const newSelection = prev.selectedNee.includes(dificultad)
                ? prev.selectedNee.filter(d => d !== dificultad)
                : [...prev.selectedNee, dificultad];
            return { ...prev, selectedNee: newSelection };
        });
    };

    const handleGeneratePrueba = async (e: FormEvent) => {
        e.preventDefault();
        if (!formData.nombre.trim() || !formData.contenido.trim() || Object.keys(formData.tiposActividad).length === 0) {
            setError("Nombre, Contenido y al menos un tipo de actividad son obligatorios.");
            return;
        }
        setIsGenerating(true);
        setError(null);

        const promptInstructions = Object.entries(formData.tiposActividad)
            .map(([tipo, cantidad]) => `- ${cantidad} ítem(s) de tipo '${tipo}'`)
            .join('\n');

        const neeAdaptationPrompt = formData.isNee && formData.selectedNee.length > 0
            ? `
            **Adaptación CRÍTICA para Necesidades Educativas Especiales (NEE):**
            Adapta esta prueba para estudiantes con las siguientes características: ${formData.selectedNee.join(', ')}.
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
                       - Para 'Comprensión de lectura': 'texto' (un string que DEBE contener un texto original y coherente de 150 a 250 palabras, generado por ti, sobre el contenido a evaluar) y 'preguntas' (un array de sub-preguntas basadas en el texto que acabas de generar, las cuales pueden ser 'Selección múltiple' o 'Desarrollo', y cada una debe tener su propia 'id', 'pregunta', 'puntaje', 'habilidadBloom', etc.).
                       - Para 'Desarrollo': no necesita campos adicionales.
        `;

        try {
            logApiCall('Evaluación - Pruebas');
            
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                setError("La API Key de Gemini no está configurada.");
                setIsGenerating(false);
                return;
            }

            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ 
              model: "gemini-1.5-pro-latest",
              generationConfig: {
                temperature: 0.3, // Menos creatividad, más precisión para contexto educativo
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 8192,
              }
            });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
            const generatedData = JSON.parse(cleanedText);

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

            // ✅ CORRECCIÓN FIRESTORE: Usar "spread condicional" para evitar el valor 'undefined'.
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

        } catch(err) {
            console.error(err);
            setError("Error al generar la prueba con IA. Revisa la consola para más detalles.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    // ... (El resto del componente sigue igual)
    const handleSavePrueba = async () => {
        if (!currentPrueba) return;
        try {
            await savePrueba(currentPrueba);
            alert('Prueba guardada con éxito.');
        } catch (error) {
            console.error(error);
            alert("No se pudo guardar la prueba.");
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
                alert("No se pudo eliminar la prueba.");
            }
        }
    };
    
    const handleDownloadPDF = async (prueba: Prueba) => {
        setIsDownloading(true);
        const doc = new jsPDF('p', 'mm', 'a4');
        const margin = 20;
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        // Imagen de encabezado
        const addHeader = (docInstance: jsPDF) => {
            try {
                // Añadir la imagen del encabezado (20cm de ancho x 2cm de alto)
                const headerImgUrl = 'https://res.cloudinary.com/dwncmu1wu/image/upload/v1756260600/Captura_de_pantalla_2025-08-26_a_la_s_10.09.17_p._m._aakgkt.png';
                const imgWidth = 200; // 20cm en mm
                const imgHeight = 20; // 2cm en mm
                
                // Colocar la imagen centrada en el encabezado
                docInstance.addImage(headerImgUrl, 'PNG', (pageWidth - imgWidth) / 2, 0, imgWidth, imgHeight);
            } catch (error) {
                // Si hay un error con la imagen, usar el encabezado de respaldo
                docInstance.setFillColor(230, 230, 230);
                docInstance.rect(0, 0, pageWidth, 25, 'F');
                docInstance.setFontSize(9);
                docInstance.setTextColor(0, 0, 0);
                docInstance.text('LICEO INDUSTRIAL DE RECOLETA', margin, 15, { align: 'left' });
                docInstance.text('SUBDIRECCIÓN DE GESTIÓN PEDAGÓGICA', pageWidth - margin, 15, { align: 'right' });
                console.error('Error al cargar la imagen de encabezado:', error);
            }
        };
        
        addHeader(doc);
        y = 25;

        doc.setTextColor(0, 0, 0);

        // Título más llamativo
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(prueba.nombre, pageWidth / 2, y, { align: 'center' });
        y += 15;

        // Datos de la prueba en una tabla mejorada
        autoTable(doc, {
            startY: y,
            body: [
                [{ content: 'Asignatura:', styles: { fontStyle: 'bold' } }, prueba.asignatura, { content: 'Puntaje Ideal:', styles: { fontStyle: 'bold' } }, prueba.puntajeIdeal.toString()],
                [{ content: 'Nivel:', styles: { fontStyle: 'bold' } }, prueba.nivel, { content: 'Fecha:', styles: { fontStyle: 'bold' } }, new Date().toLocaleDateString()],
                [{ content: 'Objetivo de Aprendizaje:', styles: { fontStyle: 'bold', valign: 'top' } }, { content: prueba.objetivo, colSpan: 3 }],
                [{ content: 'Instrucciones Generales:', styles: { fontStyle: 'bold', valign: 'top' } }, { content: prueba.instruccionesGenerales, colSpan: 3 }],
            ],
            theme: 'grid',
            styles: { 
                fontSize: 11, 
                cellPadding: 5, 
                textColor: [0, 0, 0], 
                lineColor: [100, 100, 100], 
                lineWidth: 0.1,
                halign: 'left'
            },
            columnStyles: { 
                0: { cellWidth: 45, fillColor: [245, 245, 245] }, 
                2: { cellWidth: 30, fillColor: [245, 245, 245] } 
            },
            didDrawPage: (data) => {
                addHeader(doc);
            },
            // Asegurar que las celdas se expandan verticalmente si el contenido es largo
            rowPageBreak: 'auto'
        });

        y = (doc as any).lastAutoTable.finalY + 15; // Más espacio después de la tabla de información

        const checkPageBreak = (requiredHeight: number) => {
            // Si no hay suficiente espacio para el elemento completo, hacer salto de página
            if (y + requiredHeight > pageHeight - margin) {
                doc.addPage();
                addHeader(doc);
                y = 30; // Ajustado para considerar la altura de la imagen de encabezado
                doc.setTextColor(0,0,0);
                return true;
            }
            return false;
        };
        
        const estimateHeight = (text: string | string[], options: { fontSize: number, width: number, isBold?: boolean }): number => {
            doc.setFont('helvetica', options.isBold ? 'bold' : 'normal');
            doc.setFontSize(options.fontSize);
            const textToMeasure = Array.isArray(text) ? text.join('\n') : text;
            const dims = doc.getTextDimensions(textToMeasure, { maxWidth: options.width });
            // Añadir un pequeño margen extra para asegurar que haya suficiente espacio
            return dims.h * 1.1;
        };

        for (const actividad of prueba.actividades) {
            // Estimar la altura para el encabezado de la actividad
            let activityHeaderHeight = estimateHeight(actividad.titulo, { fontSize: 12, width: contentWidth, isBold: true }) +
                                       estimateHeight(actividad.instrucciones, { fontSize: 10, width: contentWidth }) + 15;
            
            // Asegurarse de que el encabezado de la actividad no se corte
            checkPageBreak(activityHeaderHeight);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(0,0,0);
            doc.text(actividad.titulo, margin, y);
            y += 8;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const instruccionesLines = doc.splitTextToSize(actividad.instrucciones, contentWidth);
            doc.text(instruccionesLines, margin, y);
            y += instruccionesLines.length * (10 * 0.35 * 1.15) + 6; // Incrementado ligeramente para mejor espaciado

            for (const [index, item] of actividad.items.entries()) {
                // Calcular la altura estimada para este ítem completo
                let itemHeight = 0;
                const preguntaText = `${index + 1}. ${item.pregunta} (${item.puntaje} pts)`;
                itemHeight += estimateHeight(preguntaText, { fontSize: 10, width: contentWidth, isBold: true }) + 5;
                
                switch (item.tipo) {
                    case 'Selección múltiple':
                        (item as SeleccionMultipleItem).opciones.forEach(op => {
                            itemHeight += estimateHeight(op, { fontSize: 10, width: contentWidth - 5 }) + 4;
                        });
                        itemHeight += 8;
                        break;
                    case 'Verdadero o Falso':
                        itemHeight += 15; // Un poco más de espacio
                        break;
                    case 'Desarrollo':
                        itemHeight += 35; // Más espacio para escribir
                        break;
                    case 'Términos pareados':
                        itemHeight += (item as TerminosPareadosItem).pares.length * 15 + 25; // Más espacio para cada par
                        break;
                    case 'Comprensión de lectura':
                        const ci = item as ComprensionLecturaItem;
                        // El texto de lectura es más largo, necesita más espacio
                        itemHeight += estimateHeight(ci.texto, { fontSize: 10, width: contentWidth - 10 }) + 15;
                        
                        ci.preguntas.forEach(subItem => {
                           const subPreguntaText = `${subItem.pregunta} (${subItem.puntaje} pts)`;
                           itemHeight += estimateHeight(subPreguntaText, {fontSize: 10, width: contentWidth - 5, isBold: true}) + 5;
                           
                           if (subItem.tipo === 'Selección múltiple') {
                              (subItem as SeleccionMultipleItem).opciones.forEach(op => {
                                   itemHeight += estimateHeight(op, { fontSize: 10, width: contentWidth - 10 }) + 4;
                               });
                               itemHeight += 8;
                           } else if (subItem.tipo === 'Desarrollo') {
                               itemHeight += 35;
                           }
                           itemHeight += 10; // Mayor espaciado entre sub-preguntas
                        });
                        itemHeight += 20; // Más espacio después de la comprensión de lectura
                        break;
                }
                
                // Verificar si se necesita un salto de página para esta pregunta completa
                // Importante: no cortar preguntas entre páginas
                if (checkPageBreak(itemHeight)) {
                    // Si se hizo un salto de página, asegurarnos de que tenemos el contexto correcto
                    doc.setTextColor(0,0,0);
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(0,0,0);
                const preguntaLines = doc.splitTextToSize(preguntaText, contentWidth);
                doc.text(preguntaLines, margin, y);
                y += preguntaLines.length * 5 + 5; // Incrementado para mejor espaciado
                doc.setFont('helvetica', 'normal');

                if (item.tipo === 'Selección múltiple') {
                    (item as SeleccionMultipleItem).opciones.forEach((opcion, i) => {
                        // Mejorar la presentación de opciones de selección múltiple con interlineado sencillo
                        const opLines = doc.splitTextToSize(`${String.fromCharCode(65 + i)}) ${opcion}`, contentWidth - 15);
                        doc.text(opLines, margin + 5, y);
                        // Interlineado sencillo (no añadir espacio adicional entre líneas de la misma opción)
                        y += opLines.length * 4; // Reducido para tener interlineado sencillo
                    });
                    y += 6; // Espacio de 1.5 entre preguntas
                } else if (item.tipo === 'Verdadero o Falso') {
                    doc.text('V ______    F ______', margin + 5, y);
                    y += 6; // Espacio de 1.5 entre preguntas
                } else if (item.tipo === 'Desarrollo') {
                    // Mejora del área de desarrollo con líneas punteadas para escribir
                    doc.setDrawColor(200, 200, 200);
                    doc.setFillColor(248, 248, 248);
                    const developHeight = 30; // Altura estándar para desarrollo
                    doc.rect(margin, y, contentWidth, developHeight, 'FD');
                    
                    // Agregar líneas punteadas para escribir
                    doc.setDrawColor(180, 180, 180);
                    doc.setLineDashPattern([0.5, 1], 0);
                    // Interlineado sencillo para líneas de escritura
                    for (let lineY = y + 4; lineY < y + developHeight; lineY += 4) {
                        doc.line(margin + 2, lineY, margin + contentWidth - 2, lineY);
                    }
                    doc.setLineDashPattern([1], 0);
                    y += developHeight + 6; // Espacio de 1.5 entre preguntas
                } else if (item.tipo === 'Términos pareados') {
                    const shuffledDefs = [...(item as TerminosPareadosItem).pares.map(p => p.definicion)].sort(() => Math.random() - 0.5);
                    const body = (item as TerminosPareadosItem).pares.map((par, i) => [`${i + 1}. ${par.concepto}`, `(   ) ${shuffledDefs[i]}`]);
                    
                    // Calcular la altura promedio del texto para ajustar la altura de las celdas
                    const avgTextHeight = doc.getTextDimensions('X').h * 1.2;
                    
                    // Mejorar la tabla de términos pareados
                    autoTable(doc, {
                        startY: y,
                        head: [['Columna A: Concepto', 'Columna B: Definición']],
                        body: body,
                        theme: 'grid',
                        styles: { 
                            fontSize: 10, 
                            textColor: [0, 0, 0], 
                            lineColor: [0, 0, 0], 
                            lineWidth: 0.1,
                            cellPadding: 2,  // Reducido para tener celdas menos altas
                            minCellHeight: avgTextHeight, // Altura mínima similar a la altura del texto
                            valign: 'middle', // Centrar verticalmente el contenido
                            // lineHeight ajustado con padding para interlineado sencillo
                        },
                        headStyles: { 
                            fontStyle: 'bold', 
                            fillColor: [230, 230, 230], 
                            textColor: [0,0,0], 
                            halign: 'center'
                        },
                        didDrawPage: (data) => addHeader(doc),
                        // Configurar el ancho de columnas más equilibrado
                        columnStyles: {
                            0: { cellWidth: contentWidth * 0.45 },
                            1: { cellWidth: contentWidth * 0.55 }
                        }
                    });
                    y = (doc as any).lastAutoTable.finalY + 6; // Espacio de 1.5 después de la tabla
                } else if (item.tipo === 'Comprensión de lectura') {
                    const lecturaItem = item as ComprensionLecturaItem;
                    
                    // Mejorar el formato del texto de comprensión de lectura
                    doc.setFillColor(245, 245, 245);
                    doc.setDrawColor(200, 200, 200);
                    const textLines = doc.splitTextToSize(lecturaItem.texto, contentWidth - 20);
                    // Aplicar interlineado sencillo al texto de comprensión
                    const lineHeight = 10 * 0.35 * 1.0; // 1.0 para interlineado sencillo
                    const boxHeight = textLines.length * lineHeight + 12;
                    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD'); // Bordes redondeados
                    y += 6; // Espacio superior
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    
                    // Dibujar el texto línea por línea con interlineado controlado
                    let currentY = y;
                    textLines.forEach(line => {
                        doc.text(line, margin + 10, currentY);
                        currentY += lineHeight;
                    });
                    
                    y += boxHeight + 6; // Espacio de 1.5 después del texto

                    // Comprobar si hay espacio para al menos la primera subpregunta
                    // Si no, hacer un salto de página para evitar que las preguntas queden separadas del texto
                    if (lecturaItem.preguntas.length > 0) {
                        const firstSubItem = lecturaItem.preguntas[0];
                        const subPreguntaHeight = estimateHeight(
                            `1. ${firstSubItem.pregunta} (${firstSubItem.puntaje} pts)`,
                            {fontSize: 10, width: contentWidth - 10, isBold: true}
                        );
                        let optionsHeight = 0;
                        
                        if (firstSubItem.tipo === 'Selección múltiple') {
                            optionsHeight = (firstSubItem as SeleccionMultipleItem).opciones.length * 8;
                        } else if (firstSubItem.tipo === 'Desarrollo') {
                            optionsHeight = 35;
                        }
                        
                        if (y + subPreguntaHeight + optionsHeight > pageHeight - margin) {
                            doc.addPage();
                            addHeader(doc);
                            y = 30;
                            doc.setTextColor(0,0,0);
                        }
                    }

                    for (const [subIndex, subItem] of lecturaItem.preguntas.entries()) {
                        const subPreguntaText = `${subIndex + 1}. ${subItem.pregunta} (${subItem.puntaje} pts)`;
                        doc.setFont('helvetica', 'bold');
                        const subPreguntaLines = doc.splitTextToSize(subPreguntaText, contentWidth - 10);
                        doc.text(subPreguntaLines, margin + 5, y);
                        y += subPreguntaLines.length * 5 + 4;
                        doc.setFont('helvetica', 'normal');
                        
                        if (subItem.tipo === 'Selección múltiple') {
                            (subItem as SeleccionMultipleItem).opciones.forEach((op, i) => {
                                const opLines = doc.splitTextToSize(`${String.fromCharCode(65 + i)}) ${op}`, contentWidth - 20);
                                doc.text(opLines, margin + 10, y);
                                // Interlineado sencillo dentro de cada opción
                                y += opLines.length * 4;
                            });
                            y += 6; // Espacio de 1.5 después de las opciones
                        } else if (subItem.tipo === 'Desarrollo') {
                            // Mejora del área de desarrollo con líneas punteadas
                            doc.setDrawColor(200, 200, 200);
                            doc.setFillColor(248, 248, 248);
                            doc.rect(margin + 5, y, contentWidth - 10, 25, 'FD');
                            
                            // Agregar líneas punteadas para escribir con interlineado sencillo
                            doc.setDrawColor(180, 180, 180);
                            doc.setLineDashPattern([0.5, 1], 0);
                            // Interlineado sencillo para líneas de escritura
                            for (let lineY = y + 4; lineY < y + 25; lineY += 4) {
                                doc.line(margin + 7, lineY, margin + contentWidth - 7, lineY);
                            }
                            doc.setLineDashPattern([1], 0);
                            
                            y += 25 + 6; // Altura + espacio de 1.5 después
                        }
                        // No añadir espacio adicional entre subpreguntas ya que se ha ajustado al final de cada tipo
                    }
                }
                y += 6; // Espacio de 1.5 entre preguntas principales
            }
        }
    
        // Crear un nombre de archivo más descriptivo con la fecha
        const fechaStr = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        const fileName = `${prueba.nombre.replace(/\s/g, '_')}_${prueba.asignatura.replace(/\s/g, '_')}_${fechaStr}.pdf`;
        
        doc.save(fileName);
        setIsDownloading(false);
        
        // Notificar al usuario que el PDF se ha descargado correctamente
        alert(`PDF generado y descargado como "${fileName}"`);
        
    };

    if (currentPrueba) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setCurrentPrueba(null)} className="text-sm font-semibold text-slate-500 hover:underline">&larr; Volver</button>
                    <div className="flex gap-2">
                        <button onClick={() => setShowAnswers(!showAnswers)} className="bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                           <EyeIcon open={!showAnswers}/> <span>{showAnswers ? 'Ocultar' : 'Mostrar'} Respuestas</span>
                        </button>
                        <button onClick={handleSavePrueba} className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg">Guardar Prueba</button>
                        <button onClick={() => handleDownloadPDF(currentPrueba)} disabled={isDownloading} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">{isDownloading ? '...' : <PDFIcon />} PDF</button>
                    </div>
                </div>
                {/* Viewer */}
                <div className="border rounded-lg p-8 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                        <span>LICEO INDUSTRIAL DE RECOLETA</span>
                        <span>SUBDIRECCIÓN DE GESTIÓN PEDAGÓGICA</span>
                    </div>
                    <h2 className="text-center text-2xl font-bold my-4 text-slate-800 dark:text-slate-200">{currentPrueba.nombre}</h2>
                    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300 border p-4 rounded-lg bg-white dark:bg-slate-800">
                        <div className="grid grid-cols-2 gap-x-8">
                            <p><strong>Asignatura:</strong> {currentPrueba.asignatura}</p>
                            <p className="text-right"><strong>Puntaje Ideal:</strong> {currentPrueba.puntajeIdeal}</p>
                            <p><strong>Nivel:</strong> {currentPrueba.nivel}</p>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
                            <span className="font-semibold bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 px-2 py-1 rounded-full text-xs">Dificultad: {currentPrueba.dificultad || 'Intermedio'}</span>
                            {currentPrueba.adaptacionNEE && currentPrueba.adaptacionNEE.length > 0 && (
                                <span className="font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-1 rounded-full text-xs">Adaptado para NEE: {currentPrueba.adaptacionNEE.join(', ')}</span>
                            )}
                        </div>
                        <p><strong>Objetivo de Aprendizaje:</strong> {currentPrueba.objetivo}</p>
                        <p><strong>Instrucciones Generales:</strong> {currentPrueba.instruccionesGenerales}</p>
                    </div>

                    {currentPrueba.actividades.map(act => (
                        <div key={act.id} className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-lg border dark:border-slate-700">
                            <h3 className="text-lg font-bold border-b pb-2 mb-4 dark:border-slate-600">{act.titulo}</h3>
                            <p className="italic text-sm mb-4">{act.instrucciones}</p>
                            <div className="space-y-6">
                                {act.items.map((item, index) => (
                                    <PruebaItemViewer key={item.id} item={item} index={index} showAnswers={showAnswers} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Generar Nueva Prueba o Guía</h2>
                <form onSubmit={handleGeneratePrueba} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                           <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1 block">Nombre de la Prueba/Guía <span className="text-red-500">*</span></label>
                           <input type="text" name="nombre" value={formData.nombre} onChange={handleFormChange} placeholder="Ej: Guía N°1 - La Célula" className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" required />
                       </div>
                       <div></div>
                        <select name="asignatura" value={formData.asignatura} onChange={handleFormChange} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">{ASIGNATURAS.map(a => <option key={a}>{a}</option>)}</select>
                        <select name="nivel" value={formData.nivel} onChange={handleFormChange} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">{NIVELES.map(n => <option key={n}>{n}</option>)}</select>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t dark:border-slate-700">
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2 block">Dificultad de la Prueba</label>
                            <div className="flex rounded-lg shadow-sm">
                                {(['Fácil', 'Intermedio', 'Avanzado'] as const).map((level, index) => (
                                    <button
                                        type="button"
                                        key={level}
                                        onClick={() => setFormData(prev => ({...prev, dificultad: level}))}
                                        className={`w-1/3 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50
                                            ${index === 0 ? 'rounded-l-lg' : ''} ${index === 2 ? 'rounded-r-lg' : ''}
                                            ${formData.dificultad === level ? 'bg-amber-500 text-white z-10' : 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200'}`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isNee}
                                    onChange={(e) => setFormData(prev => ({...prev, isNee: e.target.checked, selectedNee: e.target.checked ? prev.selectedNee : []}))}
                                    className="h-5 w-5 rounded text-amber-500 focus:ring-amber-400 border-slate-300 dark:bg-slate-600 dark:border-slate-500"
                                />
                                <span className="font-medium text-slate-700 dark:text-slate-300">Adaptar para Necesidades Educativas Especiales (NEE)</span>
                            </label>
                             {formData.isNee && (
                                <div className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-700/50 dark:border-slate-600 animate-fade-in">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Seleccione Dificultades de Aprendizaje</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                        {DIFICULTADES_APRENDIZAJE.map(dif => (
                                            <label key={dif} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                                                <input type="checkbox" checked={formData.selectedNee.includes(dif)} onChange={() => handleNeeChange(dif)} className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"/>
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{dif}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <textarea name="contenido" value={formData.contenido} onChange={handleFormChange} placeholder="Contenido a evaluar..." rows={3} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                    <div className="space-y-3">
                        {TIPOS_ACTIVIDAD_PRUEBA.map(tipo => (
                            <div key={tipo} className="p-3 border rounded-lg has-[:checked]:bg-amber-50 has-[:checked]:border-amber-300 dark:border-slate-700 dark:has-[:checked]:bg-amber-900/20 dark:has-[:checked]:border-amber-700">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={!!formData.tiposActividad[tipo]} onChange={() => handleTipoActividadToggle(tipo)} className="h-5 w-5 rounded text-amber-500 focus:ring-amber-400 bg-slate-200 dark:bg-slate-600 border-slate-300 dark:border-slate-500" />
                                    <span className="font-medium text-slate-700 dark:text-slate-300 flex-grow">{tipo}</span>
                                </label>
                                {formData.tiposActividad[tipo] && (
                                    <div className="mt-3 pl-8 flex items-center gap-2">
                                        <span className="text-sm text-slate-500 dark:text-slate-400">Cantidad:</span>
                                        {ITEM_QUANTITIES[tipo].map(qty => (
                                            <button 
                                                type="button" 
                                                key={qty} 
                                                onClick={() => handleQuantityChange(tipo, qty)}
                                                className={`px-3 py-1 rounded-full font-semibold text-xs transition-colors ${formData.tiposActividad[tipo] === qty ? 'bg-amber-500 text-white' : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500'}`}
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
                        <button type="submit" disabled={isGenerating} className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">{isGenerating ? 'Generando...' : 'Generar Prueba'}</button>
                    </div>
                </form>
            </div>

             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Historial de Pruebas Guardadas</h2>
                <div className="space-y-2">
                    {pruebas.length > 0 ? pruebas.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{p.nombre}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{p.asignatura} - {p.nivel} ({new Date(p.fechaCreacion).toLocaleDateString()})</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPrueba(p)} className="text-sm font-semibold text-blue-600 hover:underline">Ver</button>
                                <button onClick={() => handleDeletePrueba(p.id)} className="text-sm font-semibold text-red-600 hover:underline">Eliminar</button>
                            </div>
                        </div>
                    )) : <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">No hay pruebas guardadas.</p>}
                </div>
             </div>
        </div>
    );
};

// --- SUB-MÓDULO 2: RÚBRICAS (ESTÁTICAS) ---
const RubricasSubmodule: React.FC<{
    rubricas: RubricaEstatica[];
    onSave: (rubrica: RubricaEstatica) => void;
    onDelete: (id: string) => void;
    onCreate: (rubrica: RubricaEstatica) => void;
}> = ({ rubricas, onSave, onDelete, onCreate }) => {
    const [currentRubrica, setCurrentRubrica] = useState<RubricaEstatica | null>(null);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [isLoading, setIsLoading] = useState(false);
    const [newDimensionName, setNewDimensionName] = useState('');

    const handleGenerateRubrica = async (title: string, description: string) => {
        if (!title.trim() || !description.trim()) {
            alert("El título y la descripción son obligatorios.");
            return;
        }
        setIsLoading(true);
        const prompt = `Crea una rúbrica de evaluación detallada sobre "${title}" con el propósito de "${description}". Genera entre 3 y 5 dimensiones de evaluación. Para cada dimensión, crea un descriptor para 4 niveles: Insuficiente, Suficiente, Competente, y Avanzado. Tu respuesta DEBE ser un único objeto JSON válido sin texto introductorio, explicaciones, ni el bloque \`\`\`json.`;
        const schema = {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    dimension: { type: "STRING" },
                    insuficiente: { type: "STRING" },
                    suficiente: { type: "STRING" },
                    competente: { type: "STRING" },
                    avanzado: { type: "STRING" }
                },
                required: ["dimension", "insuficiente", "suficiente", "competente", "avanzado"]
            }
        };

        try {
            logApiCall('Evaluación - Rúbricas', null);

            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                alert("La API Key de Gemini no está configurada.");
                setIsLoading(false);
                return;
            }

            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ 
              model: "gemini-1.5-pro-latest",
              generationConfig: {
                temperature: 0.3, // Menos creatividad, más precisión para contexto educativo
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 8192,
              }
            });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const generatedDimensions = JSON.parse(text);
            
            const newRubrica: RubricaEstatica = {
                id: crypto.randomUUID(),
                titulo: title,
                descripcion: description,
                fechaCreacion: new Date().toISOString(),
                dimensiones: generatedDimensions.map((d: any) => ({
                    id: crypto.randomUUID(),
                    nombre: d.dimension,
                    niveles: { insuficiente: d.insuficiente, suficiente: d.suficiente, competente: d.competente, avanzado: d.avanzado }
                }))
            };
            setCurrentRubrica(newRubrica);
        } catch (error) {
            console.error(error);
            alert("Error al generar la rúbrica con IA.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAddDimensionWithAI = async () => {
        if (!newDimensionName.trim() || !currentRubrica) return;

        const newDimId = crypto.randomUUID();
        const placeholderDimension: DimensionRubrica = {
            id: newDimId,
            nombre: newDimensionName,
            niveles: { insuficiente: '', suficiente: '', competente: '', avanzado: '' },
            isLoading: true,
        };
        
        setCurrentRubrica(prev => prev ? { ...prev, dimensiones: [...prev.dimensiones, placeholderDimension] } : null);
        setNewDimensionName('');

        const prompt = `Para una rúbrica sobre "${currentRubrica.titulo}", genera los descriptores para los 4 niveles de logro (Insuficiente, Suficiente, Competente, Avanzado) para la nueva dimensión: "${newDimensionName}". Considera las dimensiones existentes como contexto: ${currentRubrica.dimensiones.map(d => d.nombre).join(', ')}. Tu respuesta DEBE ser un único objeto JSON válido sin texto introductorio, explicaciones, ni el bloque \`\`\`json.`;
        const schema = {
            type: "OBJECT",
            properties: {
                insuficiente: { type: "STRING" },
                suficiente: { type: "STRING" },
                competente: { type: "STRING" },
                avanzado: { type: "STRING" }
            },
            required: ["insuficiente", "suficiente", "competente", "avanzado"]
        };

        try {
            logApiCall('Evaluación - Rúbricas (Añadir Dimensión)', null);
            
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                alert("La API Key de Gemini no está configurada.");
                setCurrentRubrica(prev => prev ? { ...prev, dimensiones: prev.dimensiones.filter(d => d.id !== newDimId) } : null);
                return;
            }

            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ 
              model: "gemini-1.5-pro-latest",
              generationConfig: {
                temperature: 0.3, // Menos creatividad, más precisión para contexto educativo
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 8192,
              }
            });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const generatedLevels = JSON.parse(text);

            setCurrentRubrica(prev => prev ? {
                ...prev,
                dimensiones: prev.dimensiones.map(d => d.id === newDimId ? { ...d, niveles: generatedLevels, isLoading: false } : d)
            } : null);

        } catch (error) {
            console.error("Error generating dimension descriptors:", error);
            alert("No se pudieron generar los descriptores.");
            setCurrentRubrica(prev => prev ? { ...prev, dimensiones: prev.dimensiones.filter(d => d.id !== newDimId) } : null);
        }
    };
    
    // ... (El resto del componente RubricasSubmodule no cambia)
    const handleSave = () => {
        if (!currentRubrica) return;
        const exists = rubricas.some(r => r.id === currentRubrica.id);
        if (exists) {
            onSave(currentRubrica);
        } else {
            onCreate(currentRubrica);
        }
        setView('list');
        setCurrentRubrica(null);
    };
    
    const handleEdit = (rubrica: RubricaEstatica) => {
        setCurrentRubrica(rubrica);
        setView('form');
    };

    const handleCreateNew = () => {
        setCurrentRubrica({ id: crypto.randomUUID(), titulo: '', descripcion: '', fechaCreacion: new Date().toISOString(), dimensiones: [] });
        setView('form');
    };
    
    const handleDimensionChange = (dimId: string, field: 'nombre' | keyof NivelDescriptor, value: string) => {
        if (!currentRubrica) return;
        setCurrentRubrica(prev => prev ? {
            ...prev,
            dimensiones: prev.dimensiones.map(dim => {
                if (dim.id !== dimId) return dim;
                if (field === 'nombre') {
                    return { ...dim, nombre: value };
                } else {
                    return { ...dim, niveles: { ...dim.niveles, [field]: value } };
                }
            })
        } : null);
    };

    const handleTitleOrDescriptionChange = (field: 'titulo' | 'descripcion', value: string) => {
        setCurrentRubrica(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleDeleteDimension = (dimId: string) => {
        if (!currentRubrica) return;
        setCurrentRubrica(prev => prev ? { ...prev, dimensiones: prev.dimensiones.filter(d => d.id !== dimId) } : null);
    };

    const renderFormView = () => {
        if (!currentRubrica) return null;
        
        const inputStyles = "w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500 dark:bg-slate-700 dark:border-slate-600";
        const textareaStyles = `${inputStyles} resize-none text-sm`;
    
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md space-y-6">
                 <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Crear Rúbrica de Aprendizaje</h2>
                    <button onClick={() => setView('list')} className="text-sm font-semibold text-slate-500 hover:underline">&larr; Volver</button>
                 </div>
                 <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Título de la Rúbrica</label>
                        <input value={currentRubrica.titulo} onChange={(e) => handleTitleOrDescriptionChange('titulo', e.target.value)} placeholder="Ej. Rúbrica de Presentaciones Orales" className={`${inputStyles} mt-1`} />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción de la Rúbrica</label>
                        <textarea value={currentRubrica.descripcion} onChange={(e) => handleTitleOrDescriptionChange('descripcion', e.target.value)} placeholder="Describe el propósito y los criterios de evaluación de esta rúbrica." rows={3} className={`${inputStyles} mt-1`}/>
                    </div>
                 </div>
                 {currentRubrica.dimensiones.length === 0 && (
                    <div className="text-center py-4">
                        <button onClick={() => handleGenerateRubrica(currentRubrica.titulo, currentRubrica.descripcion)} disabled={isLoading || !currentRubrica.titulo || !currentRubrica.descripcion} className="bg-sky-500 text-white font-semibold py-2 px-5 rounded-lg disabled:bg-slate-400 flex items-center gap-2 mx-auto">
                            {isLoading ? 'Generando...' : '✨ Generar Rúbrica con IA'}
                        </button>
                    </div>
                 )}
                
                {currentRubrica.dimensiones.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Dimensiones a Evaluar</h3>
                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-700/50">
                                    <tr>
                                        {['Dimensión', 'Insuficiente', 'Suficiente', 'Competente', 'Avanzado', ''].map(header => (
                                            <th key={header} className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {currentRubrica.dimensiones.map(dim => (
                                        <tr key={dim.id}>
                                            <td className="p-2 w-1/5"><textarea value={dim.nombre} onChange={e => handleDimensionChange(dim.id, 'nombre', e.target.value)} rows={4} className={textareaStyles}/></td>
                                            {(Object.keys(dim.niveles) as (keyof NivelDescriptor)[]).map(level => (
                                                <td key={level} className="p-2 w-1/5">
                                                    {dim.isLoading ? (
                                                         <div className="flex justify-center items-center h-full"><div className="w-5 h-5 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin"></div></div>
                                                    ) : (
                                                        <textarea value={dim.niveles[level]} onChange={e => handleDimensionChange(dim.id, level, e.target.value)} rows={4} className={textareaStyles}/>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="p-2 w-[5%] text-center align-middle">
                                                <button onClick={() => handleDeleteDimension(dim.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full text-lg">🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex items-end gap-2 pt-2">
                             <div className="flex-grow">
                                <label className="text-sm font-medium">Añadir Dimensión</label>
                                <input value={newDimensionName} onChange={e => setNewDimensionName(e.target.value)} placeholder="Escribe el nombre de la nueva dimensión..." className={`${inputStyles} mt-1`} />
                             </div>
                             <button onClick={handleAddDimensionWithAI} disabled={!newDimensionName.trim()} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 h-10 disabled:opacity-50">Generar con IA</button>
                        </div>
                    </div>
                )}

                 <div className="flex justify-end pt-6 border-t dark:border-slate-700">
                    <button onClick={handleSave} className="bg-amber-500 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-amber-600">Guardar Rúbrica</button>
                 </div>
            </div>
        );
    };

    if (view === 'list') {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Mis Rúbricas</h2>
                    <button onClick={handleCreateNew} className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900">Crear Nueva</button>
                </div>
                {rubricas.length > 0 ? rubricas.map(r => (
                    <div key={r.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{r.titulo}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-lg">{r.descripcion}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => handleEdit(r)} className="text-sm font-semibold text-blue-600 hover:underline">Editar</button>
                            <button onClick={() => onDelete(r.id)} className="text-sm font-semibold text-red-600 hover:underline">Eliminar</button>
                        </div>
                    </div>
                )) : <p className="text-slate-500 dark:text-slate-400 text-center py-4">No hay rúbricas guardadas.</p>}
            </div>
        );
    }
    
    return renderFormView();
};

// --- SUB-MÓDULO 3: RÚBRICAS INTERACTIVAS ---
const RubricasInteractivas: React.FC<{
    allUsers: User[];
    rubricasEstaticas: RubricaEstatica[];
}> = ({ allUsers, rubricasEstaticas }) => {
    const [rubricasInteractivas, setRubricasInteractivas] = useState<RubricaInteractiva[]>([]);
    const [selectedRubrica, setSelectedRubrica] = useState<RubricaInteractiva | null>(null);
    const [modifiedRubrica, setModifiedRubrica] = useState<RubricaInteractiva | null>(null);
    
    const [formState, setFormState] = useState({ rubricaEstaticaId: '', curso: '' });
    const [feedbackLoadingStudent, setFeedbackLoadingStudent] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeToRubricasInteractivas(setRubricasInteractivas);
        return () => unsubscribe();
    }, []);

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        const selectedStatic = rubricasEstaticas.find(r => r.id === formState.rubricaEstaticaId);
        if (!selectedStatic || !formState.curso) {
            alert("Debe seleccionar una rúbrica y un curso.");
            return;
        }

        const newInteractiveRubric: Omit<RubricaInteractiva, 'id'> = {
            nombre: selectedStatic.titulo,
            curso: formState.curso,
            asignatura: 'N/A',
            rubricaEstaticaId: selectedStatic.id,
            resultados: {}
        };
        
        try {
            await createRubricaInteractiva(newInteractiveRubric);
            setFormState({ rubricaEstaticaId: '', curso: '' });
        } catch (error) {
            console.error(error);
            alert("No se pudo crear la evaluación con rúbrica.");
        }
    };
    
    const handleSelectRubrica = (rubrica: RubricaInteractiva) => {
        setSelectedRubrica(rubrica);
        setModifiedRubrica(JSON.parse(JSON.stringify(rubrica)));
    };

    const handleScoreChange = (estudiante: string, dimensionId: string, score: number) => {
        if (!modifiedRubrica) return;
        setModifiedRubrica(prev => {
            if (!prev) return null;
            const updated = JSON.parse(JSON.stringify(prev));
            if (!updated.resultados[estudiante]) {
                updated.resultados[estudiante] = { puntajes: {}, feedback: '' };
            }
            updated.resultados[estudiante].puntajes[dimensionId] = score;
            return updated;
        });
    };
    
    const handleSaveChanges = async () => {
        if (!modifiedRubrica) return;
        try {
            await saveRubricaInteractiva(modifiedRubrica);
            setSelectedRubrica(modifiedRubrica);
            alert("Cambios guardados.");
        } catch (error) {
            console.error(error);
            alert("No se pudieron guardar los cambios.");
        }
    };

    const calculateScoreAndGrade = useCallback((studentName: string) => {
        const rubrica = modifiedRubrica;
        const staticRubric = rubricasEstaticas.find(r => r.id === rubrica?.rubricaEstaticaId);
        if (!rubrica || !staticRubric) return { score: 0, maxScore: 0, grade: 'N/A' };
        
        const maxScore = staticRubric.dimensiones.length * 4;
        const studentResult = rubrica.resultados[studentName];
        if (!studentResult) return { score: 0, maxScore, grade: '1.0' };

        // Usamos as para especificar el tipo y evitar error de compilación
        const score = Object.values(studentResult.puntajes).reduce((acc: number, s: unknown) => acc + (s as number), 0);
        
        // Asegurarnos de que score y maxScore sean tratados como números
        const scoreNum = Number(score);
        const maxScoreNum = Number(maxScore);
        const nota = 1 + (6 * (scoreNum / maxScoreNum));
        const grade = maxScoreNum > 0 ? nota.toFixed(1) : '1.0';
        
        return { score, maxScore, grade };
    }, [modifiedRubrica, rubricasEstaticas]);
    
    const handleGenerateFeedback = async (studentName: string) => {
        if (!modifiedRubrica) return;
        const staticRubric = rubricasEstaticas.find(r => r.id === modifiedRubrica.rubricaEstaticaId);
        const studentResult = modifiedRubrica.resultados[studentName];
        if (!staticRubric || !studentResult || Object.keys(studentResult.puntajes).length === 0) {
            alert("El estudiante no tiene puntajes para generar feedback.");
            return;
        }
        
        setFeedbackLoadingStudent(studentName);
        const performance = staticRubric.dimensiones.map(d => `${d.nombre}: ${studentResult.puntajes[d.id] || 'N/A'}/4`).join('; ');
        const prompt = `Genera una retroalimentación constructiva para un estudiante basada en estos puntajes de rúbrica (de 1 a 4): ${performance}. El nombre de la evaluación es "${staticRubric.titulo}". Destaca fortalezas y sugiere 1-2 áreas de mejora concretas. Sé breve y motivador.`;
        
        try {
            logApiCall('Evaluación - Rúbricas Interactivas (Feedback)', null);
            
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                alert("La API Key de Gemini no está configurada.");
                setFeedbackLoadingStudent(null);
                return;
            }

            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ 
              model: "gemini-1.5-pro-latest",
              generationConfig: {
                temperature: 0.3, // Menos creatividad, más precisión para contexto educativo
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 8192,
              }
            });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            setModifiedRubrica(prev => {
                if (!prev) return null;
                const updated = JSON.parse(JSON.stringify(prev));
                updated.resultados[studentName].feedback = text.replace(/(\*\*|\*)/g, '');
                return updated;
            });
        } catch(e) {
            console.error(e);
            alert("Error al generar feedback.");
        } finally {
            setFeedbackLoadingStudent(null);
        }
    };
    
    if (selectedRubrica && modifiedRubrica) {
        const staticRubric = rubricasEstaticas.find(r => r.id === selectedRubrica.rubricaEstaticaId);
        const studentList = allUsers.filter(u => u.profile === Profile.ESTUDIANTE && normalizeCurso(u.curso || '') === selectedRubrica.curso).map(u => u.nombreCompleto).sort();

        if (!staticRubric) return <div>Error: Rúbrica base no encontrada. <button onClick={() => setSelectedRubrica(null)}>Volver</button></div>;

        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{selectedRubrica.nombre}</h2>
                        <p className="text-slate-500">{selectedRubrica.curso}</p>
                    </div>
                    <button onClick={() => setSelectedRubrica(null)} className="font-semibold text-slate-600">&larr; Volver</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>
                                <th className="p-2 border dark:border-slate-600 sticky left-0 bg-slate-100 dark:bg-slate-700 z-10 w-48">Estudiante</th>
                                {staticRubric.dimensiones.map(d => <th key={d.id} className="p-2 border dark:border-slate-600 text-sm">{d.nombre}</th>)}
                                <th className="p-2 border dark:border-slate-600 text-sm">Puntaje</th>
                                <th className="p-2 border dark:border-slate-600 text-sm">Nota</th>
                                <th className="p-2 border dark:border-slate-600 text-sm w-64">Retroalimentación</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentList.map(studentName => {
                                const { score, maxScore, grade } = calculateScoreAndGrade(studentName);
                                return (
                                <tr key={studentName} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="p-2 border dark:border-slate-600 font-semibold sticky left-0 bg-white dark:bg-slate-800 w-48">{studentName}</td>
                                    {staticRubric.dimensiones.map(dim => (
                                        <td key={dim.id} className="p-2 border dark:border-slate-600 text-center">
                                            <div className="flex justify-center gap-1">
                                                {[1,2,3,4].map(s => (
                                                    <button key={s} onClick={() => handleScoreChange(studentName, dim.id, s)} className={`w-7 h-7 rounded-md font-semibold transition-colors ${modifiedRubrica.resultados[studentName]?.puntajes[dim.id] === s ? 'bg-amber-400 text-white' : 'bg-slate-200 dark:bg-slate-600 hover:bg-slate-300'}`}>
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                    ))}
                                    <td className="p-2 border dark:border-slate-600 text-center font-bold">{score}/{maxScore}</td>
                                    <td className="p-2 border dark:border-slate-600 text-center font-bold">{grade}</td>
                                    <td className="p-2 border dark:border-slate-600 text-sm">
                                        <div className="flex flex-col gap-2 items-center">
                                            <p className="text-xs w-full">{modifiedRubrica.resultados[studentName]?.feedback || 'Sin generar'}</p>
                                            <button onClick={() => handleGenerateFeedback(studentName)} disabled={feedbackLoadingStudent === studentName} className="text-xs bg-sky-100 text-sky-700 font-semibold px-2 py-1 rounded-md w-full disabled:opacity-50">
                                                {feedbackLoadingStudent === studentName ? '...' : 'Generar IA'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                 <div className="mt-6 flex justify-end">
                    <button onClick={handleSaveChanges} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">Guardar Cambios</button>
                 </div>
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Crear Evaluación con Rúbrica</h2>
                 <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <select value={formState.rubricaEstaticaId} onChange={e => setFormState({...formState, rubricaEstaticaId: e.target.value})} className="w-full border-slate-300 rounded-md dark:bg-slate-700" required>
                        <option value="">Seleccione una Rúbrica Guardada</option>
                        {rubricasEstaticas.map(r => <option key={r.id} value={r.id}>{r.titulo}</option>)}
                    </select>
                    <select value={formState.curso} onChange={e => setFormState({...formState, curso: e.target.value})} className="w-full border-slate-300 rounded-md dark:bg-slate-700" required>
                        <option value="">Seleccione un Curso</option>
                        {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 h-10">Crear Evaluación</button>
                </form>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Evaluaciones Creadas</h2>
                <div className="space-y-2">
                    {rubricasInteractivas.map(r => (
                        <button key={r.id} onClick={() => handleSelectRubrica(r)} className="w-full text-left p-3 rounded-md bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600">
                            <p className="font-semibold">{r.nombre}</p>
                            <p className="text-sm text-slate-500">{r.curso}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};


// --- SUB-MÓDULO 4: GESTIÓN DE NÓMINAS (Read-only view) ---
const GestionNominas: React.FC<{ allUsers: User[] }> = ({ allUsers }) => {
    const [selectedCourse, setSelectedCourse] = useState('');

    const availableCourses = useMemo(() => {
        return Array.from(new Set(allUsers.filter(u => u.profile === Profile.ESTUDIANTE && u.curso).map(u => normalizeCurso(u.curso!)))).sort();
    }, [allUsers]);

    const filteredStudents = useMemo(() => {
        const baseStudentList = allUsers.filter(u => u.profile === Profile.ESTUDIANTE);
        if (!selectedCourse) {
            return baseStudentList.sort((a,b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
        }
        return baseStudentList
            .filter(u => normalizeCurso(u.curso || '') === selectedCourse)
            .sort((a,b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    }, [allUsers, selectedCourse]);
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Nóminas de Cursos</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
                Este es un visor de las nóminas de estudiantes. Para agregar, editar o eliminar estudiantes, utilice el módulo de <strong className="font-semibold">Administración</strong>.
            </p>
            <div className="mb-4">
                <label htmlFor="curso-filter" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Filtrar por Curso</label>
                <select 
                    id="curso-filter"
                    value={selectedCourse}
                    onChange={e => setSelectedCourse(e.target.value)}
                    className="w-full max-w-xs border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                >
                    <option value="">Mostrar Todos los Estudiantes</option>
                    {availableCourses.map(curso => (
                        <option key={curso} value={curso}>{curso}</option>
                    ))}
                </select>
            </div>
            <div className="overflow-x-auto border rounded-lg dark:border-slate-700 max-h-[60vh]">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Nombre Completo</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Curso</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Email</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {filteredStudents.length > 0 ? filteredStudents.map(est => (
                            <tr key={est.id}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">{est.nombreCompleto}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{normalizeCurso(est.curso || '')}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{est.email}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={3} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
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

// --- MAIN COMPONENT ---
const EvaluacionAprendizajes: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'pruebas' | 'rubricas' | 'rubricasInteractivas' | 'nominas'>('pruebas');
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
            alert("No se pudo guardar la rúbrica.");
        }
    };

    const handleDeleteRubrica = async (id: string) => {
        try {
            await deleteRubricaEstatica(id);
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar la rúbrica.");
        }
    };

    const TabButton: React.FC<{ tabName: typeof activeTab, label: string }> = ({ tabName, label }) => (
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
             <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Evaluación de Aprendizajes</h1>
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
                {activeTab === 'rubricas' && <RubricasSubmodule rubricas={rubricasEstaticas} onSave={handleSaveRubrica} onDelete={handleDeleteRubrica} onCreate={handleSaveRubrica} />}
                {activeTab === 'rubricasInteractivas' && <RubricasInteractivas allUsers={allUsers} rubricasEstaticas={rubricasEstaticas} />}
                {activeTab === 'nominas' && <GestionNominas allUsers={allUsers} />}
            </div>
        </div>
    );
};

export default EvaluacionAprendizajes;