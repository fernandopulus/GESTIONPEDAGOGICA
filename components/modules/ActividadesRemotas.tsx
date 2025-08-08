import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { 
    ActividadRemota, 
    RespuestaEstudianteActividad, 
    TipoActividadRemota, 
    QuizQuestion, 
    PareadoItem, 
    ComprensionLecturaContent, 
    DesarrolloContent, 
    User, 
    Profile, 
    ArchivoAdjuntoRecurso, 
    PruebaEstandarizada 
} from '../../types';
import { ASIGNATURAS, NIVELES, TIPOS_ACTIVIDAD_REMOTA, CURSOS } from '../../constants';
import { 
    subscribeToActividades,
    subscribeToRespuestas,
    subscribeToAllUsers,
    createActividad,
    createPruebaEstandarizada,
    subscribeToPruebasEstandarizadas // Asegúrate de que esta función exista en tus helpers
} from '../../src/firebaseHelpers/actividadesRemotasHelper';
import { GoogleGenerativeAI as GoogleGenAI } from '@google/generative-ai';

const ITEM_QUANTITIES: Record<TipoActividadRemota, number[]> = {
    'Quiz': [5, 10, 15],
    'Términos Pareados': [5, 10, 15],
    'Desarrollo': [1, 2, 3],
    'Comprensión de Lectura': [1, 2, 3],
};

const HABILIDADES_SIMCE = [
    'Localizar información',
    'Interpretar y relacionar',
    'Reflexionar',
    'Extraer información explícita',
    'Realizar inferencias',
    'Interpretar el sentido global del texto',
    'Evaluar contenido y forma'
];

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const ActividadesRemotas: React.FC = () => {
    const [actividades, setActividades] = useState<ActividadRemota[]>([]);
    const [pruebasEstandarizadas, setPruebasEstandarizadas] = useState<PruebaEstandarizada[]>([]);
    const [respuestas, setRespuestas] = useState<RespuestaEstudianteActividad[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [selectedActividad, setSelectedActividad] = useState<ActividadRemota | null>(null);
    const [selectedPrueba, setSelectedPrueba] = useState<PruebaEstandarizada | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreatingPrueba, setIsCreatingPrueba] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [studentSearch, setStudentSearch] = useState('');
    const [previewData, setPreviewData] = useState<ActividadRemota | null>(null);
    const [previewPrueba, setPreviewPrueba] = useState<PruebaEstandarizada | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [activeTab, setActiveTab] = useState<'actividades' | 'pruebas'>('actividades');
    
    const initialFormState: Omit<ActividadRemota, 'id' | 'fechaCreacion' | 'generatedContent' | 'introduccion'> = {
        asignatura: ASIGNATURAS[0],
        nivel: NIVELES[0],
        contenido: '',
        plazoEntrega: new Date().toISOString().split('T')[0],
        tipos: [],
        cantidadPreguntas: {},
        cursosDestino: [],
        estudiantesDestino: [],
        recursos: {
            instrucciones: '',
            enlaces: '',
            archivos: []
        }
    };

    const initialPruebaState: Omit<PruebaEstandarizada, 'id' | 'fechaCreacion' | 'preguntas' | 'titulo' | 'instrucciones' | 'textos'> = {
        asignatura: ASIGNATURAS[0],
        nivel: NIVELES[0],
        contenido: '',
        objetivosAprendizaje: '',
        plazoEntrega: new Date().toISOString().split('T')[0],
        cursosDestino: [],
        estudiantesDestino: [],
        duracionMinutos: 90
    };

    const [formData, setFormData] = useState(initialFormState);
    const [pruebaFormData, setPruebaFormData] = useState(initialPruebaState);

    useEffect(() => {
        setDataLoading(true);
        const unsubActividades = subscribeToActividades(setActividades);
        const unsubPruebas = subscribeToPruebasEstandarizadas(setPruebasEstandarizadas);
        const unsubRespuestas = subscribeToRespuestas(setRespuestas);
        const unsubUsers = subscribeToAllUsers((users) => {
            setAllUsers(users);
            setDataLoading(false);
        });

        return () => {
            unsubActividades();
            unsubPruebas();
            unsubRespuestas();
            unsubUsers();
        };
    }, []);

    const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePruebaFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setPruebaFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRecursoChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            recursos: {
                ...prev.recursos,
                [e.target.name]: e.target.value
            }
        }));
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };
    
    const handleTipoChange = (tipo: TipoActividadRemota) => {
        setFormData(prev => {
            const newTipos = prev.tipos.includes(tipo)
                ? prev.tipos.filter(t => t !== tipo)
                : [...prev.tipos, tipo];

            const newCantidades = { ...prev.cantidadPreguntas };
            if (newTipos.includes(tipo)) {
                if (!newCantidades[tipo]) {
                    newCantidades[tipo] = ITEM_QUANTITIES[tipo][0];
                }
            } else {
                delete newCantidades[tipo];
            }
            
            return { ...prev, tipos: newTipos, cantidadPreguntas: newCantidades };
        });
    };

    const handleQuantityChange = (tipo: TipoActividadRemota, cantidad: number) => {
        setFormData(prev => ({
            ...prev,
            cantidadPreguntas: {
                ...prev.cantidadPreguntas,
                [tipo]: cantidad,
            }
        }));
    };

    const handleCursoDestinoChange = (curso: string, isPrueba = false) => {
        const updater = isPrueba ? setPruebaFormData : setFormData;
        updater(prev => {
            const currentCursos = prev.cursosDestino || [];
            const newCursos = currentCursos.includes(curso)
                ? currentCursos.filter(c => c !== curso)
                : [...currentCursos, curso];
            return { ...prev, cursosDestino: newCursos };
        });
    };

    const handleEstudianteDestinoChange = (nombre: string, isPrueba = false) => {
        const updater = isPrueba ? setPruebaFormData : setFormData;
        updater(prev => {
            const currentEstudiantes = prev.estudiantesDestino || [];
            const newEstudiantes = currentEstudiantes.includes(nombre)
                ? currentEstudiantes.filter(e => e !== nombre)
                : [...currentEstudiantes, nombre];
            return { ...prev, estudiantesDestino: newEstudiantes };
        });
    };
    
    const buildPrompt = () => {
        const { tipos, contenido, asignatura, nivel, cantidadPreguntas } = formData;
        let prompt = `Eres un experto diseñador de actividades pedagógicas. Genera un objeto JSON que se ajuste al esquema, sin texto adicional.\n\nContenido base: "${contenido}"\nAsignatura: ${asignatura}\nNivel: ${nivel}\n\nGenera los siguientes elementos:\n- **introduccion**: Una breve introducción motivadora para el estudiante sobre el tema: "${contenido}".\n- **actividades**: Un objeto que contiene las actividades. Cada actividad es una propiedad con su nombre como clave:\n`;
        tipos.forEach(tipo => {
            const cantidad = cantidadPreguntas[tipo] || ITEM_QUANTITIES[tipo][0];
            switch (tipo) {
                case 'Quiz': prompt += `- **Quiz**: Un array de ${cantidad} objetos. Cada objeto debe tener: "pregunta" (string), "opciones" (array de 4 strings), "respuestaCorrecta" (string), y "puntaje" (number, usualmente 1).\n`; break;
                case 'Comprensión de Lectura': prompt += `- **Comprensión de Lectura**: Un objeto que debe tener "texto" (string de 150-200 palabras) y "preguntas" (un array de ${cantidad} objetos, cada uno con "pregunta", "opciones", "respuestaCorrecta" y "puntaje").\n`; break;
                case 'Términos Pareados': prompt += `- **Términos Pareados**: Un array de ${cantidad} objetos. Cada objeto debe tener "concepto" (string) y "definicion" (string).\n`; break;
                case 'Desarrollo': prompt += `- **Desarrollo**: Un array de ${cantidad} objetos. Cada objeto debe tener una clave "pregunta" (string con la pregunta) y una clave "rubrica" (string con la rúbrica de evaluación).\n`; break;
            }
        });
        return prompt;
    };

    const buildPruebaPrompt = () => {
        const { contenido, objetivosAprendizaje, asignatura, nivel } = pruebaFormData;
        return `Eres un experto en evaluación educativa y diseño de pruebas SIMCE. 

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin comentarios, sin texto adicional, sin explicaciones.

INFORMACIÓN DE LA PRUEBA:
- Asignatura: ${asignatura}
- Nivel: ${nivel}
- Contenido: ${contenido}
- Objetivos: ${objetivosAprendizaje}

RESPONDE SOLO CON ESTE JSON (sin comentarios, sin texto extra):
{
  "titulo": "Título descriptivo de la prueba",
  "instrucciones": "Instrucciones claras para el estudiante",
  "textos": [
    {
      "id": 1,
      "titulo": "Título del texto",
      "contenido": "Texto completo de 200-300 palabras",
      "tipo": "narrativo",
      "palabras": 250
    }
  ],
  "preguntas": [
    {
      "numero": 1,
      "pregunta": "Texto de la pregunta",
      "opciones": ["Opción A completa", "Opción B completa", "Opción C completa", "Opción D completa"],
      "respuestaCorrecta": "A",
      "habilidad": "Localizar información",
      "justificacion": "Explicación breve de por qué es correcta",
      "textoId": 1
    }
  ]
}

REGLAS OBLIGATORIAS:
- ${asignatura === 'Lenguaje y Comunicación' || asignatura === 'Lengua y Literatura' ? '3-4 textos de lectura de diferentes tipos' : '2-3 textos informativos'}
- Exactamente 30 preguntas numeradas del 1 al 30
- Cada pregunta con exactamente 4 opciones completas y específicas
- Respuesta correcta: solo "A", "B", "C" o "D"
- Habilidades: ${HABILIDADES_SIMCE.join(', ')}
- Para preguntas basadas en textos: incluir "textoId"
- Sin comentarios en el JSON
- Texto tipo debe ser: "narrativo", "informativo", "argumentativo" o "poetico"

JSON válido sin comentarios:`;
    };

    function autoAdaptContent(tipo: TipoActividadRemota, content: any) {
        if (tipo === 'Desarrollo') {
            if (Array.isArray(content)) {
                return content.map(item => {
                    if (typeof item === 'string') {
                        const match = item.match(/^(.*?)(?:R[úu]brica:|RUBRICA:|Rubrica:)(.*)$/is);
                        if (match) {
                            return { pregunta: match[1].trim(), rubrica: match[2].trim() };
                        }
                        return { pregunta: item.trim(), rubrica: '' };
                    }
                    if (item && typeof item === 'object') {
                        return {
                            pregunta: item.pregunta || item.Pregunta || item.texto || '',
                            rubrica: item.rubrica || item.Rubrica || item.rúbrica || item.Rúbrica || ''
                        };
                    }
                    return { pregunta: String(item), rubrica: '' };
                });
            } else if (typeof content === 'string') {
                return content.split(/\n\n|\n- |\d+\. /).map(str => {
                    const match = str.match(/^(.*?)(?:R[úu]brica:|RUBRICA:|Rubrica:)(.*)$/is);
                    if (match) {
                        return { pregunta: match[1].trim(), rubrica: match[2].trim() };
                    }
                    return { pregunta: str.trim(), rubrica: '' };
                }).filter(obj => obj.pregunta);
            }
        }
        if (tipo === 'Términos Pareados') {
            if (Array.isArray(content)) {
                return content.map((item, idx) => {
                    if (typeof item === 'string') {
                        const match = item.match(/^(.+?)[\s:-–]+(.+)$/);
                        if (match) {
                            return { id: idx, concepto: match[1].trim(), definicion: match[2].trim() };
                        }
                        return { id: idx, concepto: item.trim(), definicion: '' };
                    }
                    if (item && typeof item === 'object') {
                        return { id: idx, concepto: item.concepto || item.termino || '', definicion: item.definicion || item.significado || '' };
                    }
                    return { id: idx, concepto: String(item), definicion: '' };
                });
            } else if (typeof content === 'object' && content !== null) {
                return Object.entries(content).map(([concepto, definicion], idx) => ({ id: idx, concepto, definicion: String(definicion) }));
            } else if (typeof content === 'string') {
                return content.split(/\n|;/).map((str, idx) => {
                    const match = str.match(/^(.+?)[\s:-–]+(.+)$/);
                    if (match) {
                        return { id: idx, concepto: match[1].trim(), definicion: match[2].trim() };
                    }
                    return { id: idx, concepto: str.trim(), definicion: '' };
                }).filter(obj => obj.concepto);
            }
        }
        if (tipo === 'Comprensión de Lectura') {
            if (content && typeof content === 'object' && Array.isArray(content.preguntas)) {
                return {
                    texto: content.texto || '',
                    preguntas: content.preguntas.map((q: any) => ({
                        pregunta: q.pregunta || q.Pregunta || '',
                        opciones: q.opciones || q.Opciones || [],
                        respuestaCorrecta: q.respuestaCorrecta || q.respuesta || '',
                        puntaje: q.puntaje || 1
                    }))
                };
            }
            if (Array.isArray(content)) {
                const first = content.find(c => c && typeof c === 'object' && 'texto' in c && 'preguntas' in c);
                if (first) {
                    return {
                        texto: first.texto || '',
                        preguntas: (first.preguntas || []).map((q: any) => ({
                            pregunta: q.pregunta || q.Pregunta || '',
                            opciones: q.opciones || q.Opciones || [],
                            respuestaCorrecta: q.respuestaCorrecta || q.respuesta || '',
                            puntaje: q.puntaje || 1
                        }))
                    };
                }
                return {
                    texto: content.map(c => (typeof c === 'string' ? c : JSON.stringify(c))).join('\n'),
                    preguntas: []
                };
            }
            if (typeof content === 'string') {
                const [texto, preguntasStr] = content.split(/Preguntas:|\nPreguntas:/i);
                let preguntas = [];
                if (preguntasStr) {
                    preguntas = preguntasStr.split(/\n- |\n\d+\. /).filter(Boolean).map(q => {
                        const partes = q.split(/Opciones:|\nOpciones:/i);
                        const pregunta = partes[0].trim();
                        let opciones: string[] = [];
                        let respuestaCorrecta = '';
                        if (partes[1]) {
                            opciones = partes[1].split(/;|\n|,/).map(o => o.trim()).filter(Boolean);
                        }
                        const respMatch = q.match(/Respuesta\s*correcta\s*:?\s*(.*)/i);
                        if (respMatch) {
                            respuestaCorrecta = respMatch[1].trim();
                        }
                        return { pregunta, opciones, respuestaCorrecta, puntaje: 1 };
                    });
                }
                return {
                    texto: texto?.trim() || content,
                    preguntas
                };
            }
        }
        // Para Quiz, si es un array, asegurarse de que tenga puntaje
        if (tipo === 'Quiz' && Array.isArray(content)) {
            return content.map(q => ({ ...q, puntaje: q.puntaje || 1 }));
        }
        return content;
    }

    const handleGeneratePreview = async (e: FormEvent) => {
        e.preventDefault();
        if (!formData.contenido.trim() || formData.tipos.length === 0) {
            setError("Contenido y al menos un tipo de actividad son obligatorios.");
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            const processedFiles: ArchivoAdjuntoRecurso[] = await Promise.all(
                selectedFiles.map(async file => ({
                    nombre: file.name,
                    url: await fileToBase64(file),
                }))
            );

            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("No se encontró la API Key de Gemini. Configura VITE_GEMINI_API_KEY en tu entorno.");
            }
            
            const ai = new GoogleGenAI(apiKey);
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

            const prompt = buildPrompt();

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = await response.text();
            
            console.log("Respuesta cruda de la IA (actividad):", text); 
            
            text = text.replace(/```json\s*/gi, '').replace(/```\s*$/g, '');
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No se encontró un objeto JSON válido en la respuesta de la IA");
            }
            
            const jsonText = jsonMatch[0];
            console.log("JSON extraído (actividad):", jsonText);
            
            const generatedData = JSON.parse(jsonText);

            const adaptedContent: Record<string, any> = {};
            for (const tipo of formData.tipos) {
                adaptedContent[tipo] = autoAdaptContent(tipo, generatedData.actividades?.[tipo]);
            }

            const newActividad: ActividadRemota = {
                id: '',
                fechaCreacion: new Date().toISOString(),
                ...formData,
                recursos: {
                    ...formData.recursos,
                    archivos: processedFiles
                },
                introduccion: generatedData.introduccion || 'Actividad generada para reforzar el aprendizaje.',
                generatedContent: adaptedContent,
            };

            setPreviewData(newActividad);

        } catch (e) {
            console.error("Error al generar actividad con IA", e);
            const errorMessage = e instanceof Error ? e.message : "Error desconocido";
            setError(`Error al generar la actividad: ${errorMessage}. Por favor, inténtelo de nuevo.`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGeneratePruebaPreview = async (e: FormEvent) => {
        e.preventDefault();
        if (!pruebaFormData.contenido.trim() || !pruebaFormData.objetivosAprendizaje.trim()) {
            setError("Contenido y objetivos de aprendizaje son obligatorios.");
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("No se encontró la API Key de Gemini. Configura VITE_GEMINI_API_KEY en tu entorno.");
            }
            
            const ai = new GoogleGenAI(apiKey);
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

            const prompt = buildPruebaPrompt();

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = await response.text();
            
            console.log("Respuesta cruda de la IA:", text);
            
            text = text.replace(/```json\s*/gi, '').replace(/```\s*$/g, '');
            text = text.replace(/\/\/.*$/gm, '');
            text = text.replace(/\/\*[\s\S]*?\*\//g, '');
            text = text.trim();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No se encontró un objeto JSON válido en la respuesta de la IA");
            }
            
            let jsonText = jsonMatch[0];
            console.log("JSON extraído:", jsonText);
            
            jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
            
            console.log("JSON limpio:", jsonText);
            
            const generatedData = JSON.parse(jsonText);

            if (!generatedData.preguntas || !Array.isArray(generatedData.preguntas)) {
                throw new Error("La respuesta de la IA no contiene un array de preguntas válido");
            }

            if (generatedData.preguntas.length !== 30) {
                console.warn(`Se esperaban 30 preguntas, pero se recibieron ${generatedData.preguntas.length}`);
            }

            const textosValidos = (generatedData.textos || []).map((texto: any, index: number) => ({
                id: texto.id || (index + 1),
                titulo: texto.titulo || `Texto ${index + 1}`,
                contenido: texto.contenido || 'Contenido del texto no disponible',
                tipo: ['narrativo', 'informativo', 'argumentativo', 'poetico'].includes(texto.tipo) 
                    ? texto.tipo : 'informativo',
                palabras: texto.palabras || texto.contenido?.split(' ').length || 0
            }));

            const preguntasValidas = generatedData.preguntas.slice(0, 30).map((pregunta: any, index: number) => {
                return {
                    numero: pregunta.numero || (index + 1),
                    pregunta: pregunta.pregunta || `Pregunta ${index + 1}`,
                    opciones: Array.isArray(pregunta.opciones) && pregunta.opciones.length >= 4 
                        ? pregunta.opciones.slice(0, 4)
                        : ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
                    respuestaCorrecta: ['A', 'B', 'C', 'D'].includes(pregunta.respuestaCorrecta) 
                        ? pregunta.respuestaCorrecta 
                        : 'A',
                    habilidad: HABILIDADES_SIMCE.includes(pregunta.habilidad) 
                        ? pregunta.habilidad 
                        : HABILIDADES_SIMCE[0],
                    justificacion: pregunta.justificacion || 'Justificación no disponible',
                    ...(pregunta.textoId && typeof pregunta.textoId === 'number' ? { textoId: pregunta.textoId } : {})
                };
            });

            console.log("Textos procesados:", textosValidos);
            console.log("Preguntas procesadas:", preguntasValidas.slice(0, 2));

            const newPrueba: PruebaEstandarizada = {
                id: '',
                fechaCreacion: new Date().toISOString(),
                ...pruebaFormData,
                titulo: generatedData.titulo || `Prueba ${pruebaFormData.asignatura} - ${pruebaFormData.nivel}`,
                instrucciones: generatedData.instrucciones || 'Lee cada pregunta cuidadosamente y selecciona la mejor respuesta.',
                textos: textosValidos,
                preguntas: preguntasValidas
            };

            setPreviewPrueba(newPrueba);

        } catch (e) {
            console.error("Error al generar prueba con IA", e);
            const errorMessage = e instanceof Error ? e.message : "Error desconocido";
            
            if (errorMessage.includes('JSON')) {
                setError(`Error al procesar la respuesta de la IA. El formato de respuesta no es válido. Inténtalo de nuevo.`);
            } else {
                setError(`Error al generar la prueba estandarizada: ${errorMessage}. Por favor, inténtelo de nuevo.`);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleConfirmAndSave = async () => {
        if (!previewData) return;
        try {
            await createActividad(previewData);
            setFormData(initialFormState);
            setSelectedFiles([]);
            setIsCreating(false);
            setPreviewData(null);
        } catch (error) {
            console.error("Error al guardar la actividad:", error);
            setError("No se pudo guardar la actividad en la base de datos.");
        }
    };

    const handleConfirmAndSavePrueba = async () => {
        if (!previewPrueba) return;
        try {
            const pruebaToSave: PruebaEstandarizada = {
                ...previewPrueba,
                cursosDestino: previewPrueba.cursosDestino || [],
                estudiantesDestino: previewPrueba.estudiantesDestino || [],
                textos: previewPrueba.textos || [],
                preguntas: previewPrueba.preguntas.map(pregunta => ({
                    ...pregunta,
                    textoId: pregunta.textoId || null 
                }))
            };

            await createPruebaEstandarizada(pruebaToSave);
            setPruebaFormData(initialPruebaState);
            setIsCreatingPrueba(false);
            setPreviewPrueba(null);
        } catch (error) {
            console.error("Error al guardar la prueba:", error);
            setError("No se pudo guardar la prueba en la base de datos.");
        }
    };

    // ✅ HOOK CORREGIDO: Devuelve un array de objetos User completos.
    const estudiantesAsignados = useMemo((): User[] => {
        const actividad = selectedActividad || selectedPrueba;
        if (!actividad || !allUsers.length) return [];
    
        const estudiantesPotenciales = new Map<string, User>();
    
        // Si no hay destino, se asigna a todo el nivel
        if (!actividad.cursosDestino?.length && !actividad.estudiantesDestino?.length) {
            const nivelNum = actividad.nivel.charAt(0);
            allUsers
                .filter(u => u.profile === Profile.ESTUDIANTE && u.curso?.startsWith(nivelNum))
                .forEach(u => estudiantesPotenciales.set(u.id, u));
        } else {
            // Estudiantes por cursos seleccionados
            if (actividad.cursosDestino?.length) {
                const estudiantesPorCurso = allUsers.filter(u =>
                    u.profile === Profile.ESTUDIANTE && actividad.cursosDestino.includes(u.curso || '')
                );
                estudiantesPorCurso.forEach(u => estudiantesPotenciales.set(u.id, u));
            }
    
            // Estudiantes individuales seleccionados (por nombre completo)
            if (actividad.estudiantesDestino?.length) {
                const estudiantesIndividuales = allUsers.filter(u =>
                    u.profile === Profile.ESTUDIANTE && actividad.estudiantesDestino.includes(u.nombreCompleto)
                );
                estudiantesIndividuales.forEach(u => estudiantesPotenciales.set(u.id, u));
            }
        }
    
        return Array.from(estudiantesPotenciales.values()).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    }, [selectedActividad, selectedPrueba, allUsers]);

    const resultadosDeActividad = useMemo(() => {
        const actividadId = selectedActividad?.id || selectedPrueba?.id;
        return respuestas.filter(r => r.actividadId === actividadId);
    }, [respuestas, selectedActividad, selectedPrueba]);
    
    const students = useMemo(() => {
        return allUsers.filter(u => u.profile === Profile.ESTUDIANTE).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    }, [allUsers]);

    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return students;
        return students.filter(s => s.nombreCompleto.toLowerCase().includes(studentSearch.toLowerCase()));
    }, [students, studentSearch]);

    const renderTabs = () => (
        <div className="flex space-x-1 mb-6">
            <button
                onClick={() => setActiveTab('actividades')}
                className={`px-4 py-2 rounded-lg font-semibold ${
                    activeTab === 'actividades'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
            >
                Actividades Remotas
            </button>
            <button
                onClick={() => setActiveTab('pruebas')}
                className={`px-4 py-2 rounded-lg font-semibold ${
                    activeTab === 'pruebas'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
            >
                Pruebas Estandarizadas
            </button>
        </div>
    );

    const renderPruebaCreationForm = () => (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
            <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Nueva Prueba Estandarizada SIMCE</h2>
                <button onClick={() => setIsCreatingPrueba(false)} className="text-slate-600 hover:text-slate-900 font-semibold">&larr; Volver al listado</button>
            </div>
            <p className="text-slate-500 mt-1 mb-6">La IA generará una prueba de 30 preguntas con estándar SIMCE, indicando qué habilidad se mide en cada pregunta.</p>
            
            <form onSubmit={handleGeneratePruebaPreview} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Asignatura</label>
                        <select name="asignatura" value={pruebaFormData.asignatura} onChange={handlePruebaFieldChange} className="w-full border-slate-300 rounded-md shadow-sm">
                            {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Nivel</label>
                        <select name="nivel" value={pruebaFormData.nivel} onChange={handlePruebaFieldChange} className="w-full border-slate-300 rounded-md shadow-sm">
                            {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="duracionMinutos" className="block text-sm font-medium text-slate-600 mb-1">Duración (minutos)</label>
                        <input 
                            type="number" 
                            name="duracionMinutos" 
                            value={pruebaFormData.duracionMinutos} 
                            onChange={handlePruebaFieldChange} 
                            min="30" 
                            max="180" 
                            className="w-full border-slate-300 rounded-md shadow-sm" 
                        />
                    </div>
                    <div>
                        <label htmlFor="plazoEntrega" className="block text-sm font-medium text-slate-600 mb-1">Fecha límite</label>
                        <input type="date" name="plazoEntrega" value={pruebaFormData.plazoEntrega} onChange={handlePruebaFieldChange} required className="w-full border-slate-300 rounded-md shadow-sm" />
                    </div>

                    <div className="md:col-span-2 p-4 border rounded-lg space-y-4 bg-slate-50 dark:bg-slate-700/50">
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Destinatarios</h3>
                        <p className="text-sm text-slate-500">Seleccione cursos o estudiantes. Si no selecciona ninguno, la prueba será visible para todo el nivel.</p>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Cursos</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-40 overflow-y-auto p-2 bg-white rounded">
                                {CURSOS.map(curso => (
                                    <label key={curso} className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={pruebaFormData.cursosDestino?.includes(curso)} 
                                            onChange={() => handleCursoDestinoChange(curso, true)} 
                                            className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                                        />
                                        <span className="text-sm font-medium text-slate-700">{curso}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Estudiantes</label>
                            <input 
                                type="text" 
                                placeholder="Buscar..." 
                                value={studentSearch} 
                                onChange={(e) => setStudentSearch(e.target.value)} 
                                className="w-full border-slate-300 rounded-md shadow-sm mb-2"
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-2 bg-white rounded">
                                {filteredStudents.map(student => (
                                    <label key={student.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={pruebaFormData.estudiantesDestino?.includes(student.nombreCompleto)} 
                                            onChange={() => handleEstudianteDestinoChange(student.nombreCompleto, true)} 
                                            className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                                        />
                                        <span className="text-sm font-medium text-slate-700 truncate" title={student.nombreCompleto}>{student.nombreCompleto}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label htmlFor="contenido" className="block text-sm font-medium text-slate-600 mb-1">Contenido a evaluar <span className="text-red-500">*</span></label>
                        <textarea 
                            name="contenido" 
                            value={pruebaFormData.contenido} 
                            onChange={handlePruebaFieldChange} 
                            required 
                            rows={4} 
                            placeholder="Describa los contenidos que se evaluarán en la prueba..." 
                            className="w-full border-slate-300 rounded-md shadow-sm"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label htmlFor="objetivosAprendizaje" className="block text-sm font-medium text-slate-600 mb-1">Objetivos de Aprendizaje <span className="text-red-500">*</span></label>
                        <textarea 
                            name="objetivosAprendizaje" 
                            value={pruebaFormData.objetivosAprendizaje} 
                            onChange={handlePruebaFieldChange} 
                            required 
                            rows={4} 
                            placeholder="Liste los objetivos de aprendizaje que se evaluarán..." 
                            className="w-full border-slate-300 rounded-md shadow-sm"
                        />
                    </div>
                </div>
                
                {error && <p className="text-red-600 bg-red-100 p-3 rounded-md mt-4">{error}</p>}
                
                <div className="pt-4 text-right">
                    <button type="submit" disabled={isLoading} className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 flex items-center justify-center min-w-[180px]">
                        {isLoading ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : 'Generar y Previsualizar'}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderPruebaPreview = () => (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-slate-800">Previsualización de la Prueba Estandarizada</h2>
            <p className="text-slate-500 mt-1 mb-6">Revisa las preguntas generadas. Si todo está correcto, confirma para asignar la prueba.</p>
            
            <div className="space-y-6 max-h-[70vh] overflow-y-auto p-4 bg-slate-50 rounded-lg border">
                <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                    <h3 className="font-bold text-blue-800 mb-2">{previewPrueba?.titulo}</h3>
                    <p className="text-slate-700 mb-2"><strong>Duración:</strong> {previewPrueba?.duracionMinutos} minutos</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{previewPrueba?.instrucciones}</p>
                </div>

                {previewPrueba?.textos && previewPrueba.textos.length > 0 && (
                    <div className="p-4 bg-emerald-50 border-l-4 border-emerald-400 rounded-r-lg">
                        <h3 className="font-bold text-emerald-800 mb-4">Textos de Lectura ({previewPrueba.textos.length})</h3>
                        <div className="space-y-4">
                            {previewPrueba.textos.map((texto) => (
                                <div key={texto.id} className="bg-white p-4 rounded-lg border border-emerald-200">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-slate-800">Texto {texto.id}: {texto.titulo}</h4>
                                        <div className="flex gap-2">
                                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                                {texto.tipo}
                                            </span>
                                            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                                                {texto.palabras} palabras
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded border">
                                        {texto.contenido}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="p-4 border rounded-lg bg-white">
                    <h3 className="text-xl font-bold mb-4">Preguntas ({previewPrueba?.preguntas?.length || 0}/30)</h3>
                    <div className="space-y-6">
                        {previewPrueba?.preguntas?.map((pregunta, index) => (
                            <div key={index} className="border-t pt-4 first:border-t-0 first:pt-0">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="font-semibold text-slate-800">
                                        {pregunta.numero}. {pregunta.pregunta}
                                        {pregunta.textoId && (
                                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                                Basada en Texto {pregunta.textoId}
                                            </span>
                                        )}
                                    </p>
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                                        {pregunta.habilidad}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 mb-3">
                                    {pregunta.opciones?.map((opcion, opIndex) => {
                                        const letra = String.fromCharCode(65 + opIndex);
                                        const esCorrecta = pregunta.respuestaCorrecta === letra;
                                        return (
                                            <div 
                                                key={opIndex} 
                                                className={`p-2 rounded border ${
                                                    esCorrecta 
                                                        ? 'bg-green-50 border-green-300 text-green-800' 
                                                        : 'bg-slate-50 border-slate-200'
                                                }`}
                                            >
                                                <strong>{letra}.</strong> {opcion}
                                                {esCorrecta && <span className="ml-2 text-xs">✓</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                                {pregunta.justificacion && (
                                    <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded mt-2">
                                        <strong>Justificación:</strong> {pregunta.justificacion}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="pt-6 flex justify-end gap-4">
                <button onClick={() => setPreviewPrueba(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300">
                    Cancelar
                </button>
                <button onClick={handleConfirmAndSavePrueba} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700">
                    Confirmar y Asignar Prueba
                </button>
            </div>
        </div>
    );

    const renderPruebasList = () => (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">Pruebas Estandarizadas</h1>
                <button onClick={() => setIsCreatingPrueba(true)} className="bg-amber-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-amber-600">
                    Crear Nueva Prueba
                </button>
            </div>
            <div className="space-y-4">
                {pruebasEstandarizadas.length > 0 ? pruebasEstandarizadas.map(prueba => {
                    const destinations = [];
                    if (prueba.cursosDestino?.length) destinations.push(`Cursos: ${prueba.cursosDestino.join(', ')}`);
                    if (prueba.estudiantesDestino?.length) destinations.push(`Estudiantes: ${prueba.estudiantesDestino.length}`);
                    const destinationText = destinations.length ? destinations.join(' | ') : `Todo ${prueba.nivel}`;

                    return (
                        <div key={prueba.id} className="p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-800">{prueba.titulo || `${prueba.asignatura} - Prueba SIMCE`}</p>
                                    <p className="text-sm text-slate-500">
                                        {prueba.nivel} | {prueba.duracionMinutos} min | Destino: {destinationText}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        Creado: {new Date(prueba.fechaCreacion).toLocaleDateString('es-CL')} | 
                                        Preguntas: {prueba.preguntas?.length || 0}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedPrueba(prueba)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">
                                    Ver Resultados
                                </button>
                            </div>
                        </div>
                    );
                }) : (
                    <p className="text-slate-500 text-center py-6">
                        No hay pruebas estandarizadas creadas. Haga clic en "Crear Nueva Prueba" para comenzar.
                    </p>
                )}
            </div>
        </div>
    );

    // ✅ VISTA DE RESULTADOS CORREGIDA
    const renderActivityView = () => (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                        {selectedActividad ? 
                            `${selectedActividad.asignatura} - ${selectedActividad.tipos.join(', ')}` :
                            `${selectedPrueba?.titulo || 'Prueba Estandarizada'}`
                        }
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        Nivel: {selectedActividad?.nivel || selectedPrueba?.nivel} | 
                        Plazo: {selectedActividad?.plazoEntrega || selectedPrueba?.plazoEntrega}
                        {selectedPrueba && ` | Duración: ${selectedPrueba.duracionMinutos} min`}
                    </p>
                </div>
                <button 
                    onClick={() => {
                        setSelectedActividad(null);
                        setSelectedPrueba(null);
                    }} 
                    className="text-slate-600 hover:text-slate-900 font-semibold"
                >
                    &larr; Volver al listado
                </button>
            </div>
            <div className="mt-6 border-t dark:border-slate-700 pt-6">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-4">Resultados de Estudiantes</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Puntaje</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nota</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha Completado</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {estudiantesAsignados.map(estudiante => {
                                const resultado = resultadosDeActividad.find(r => r.estudianteId === estudiante.id);
                                return (
                                    <tr key={estudiante.id}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">{estudiante.nombreCompleto}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            {resultado ? (
                                                <span className="px-2 py-1 font-semibold text-xs rounded-full bg-green-100 text-green-800">Completado</span>
                                            ) : (
                                                <span className="px-2 py-1 font-semibold text-xs rounded-full bg-yellow-100 text-yellow-800">Pendiente</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {resultado ? `${resultado.puntaje}/${resultado.puntajeMaximo}` : '-'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-slate-600">
                                            {resultado ? (
                                                <span className={parseFloat(resultado.nota) >= 4.0 ? 'text-green-600' : 'text-red-600'}>
                                                    {resultado.nota}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {resultado ? new Date(resultado.fechaCompletado).toLocaleString('es-CL') : '-'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
    
    const renderCreationForm = () => (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
            <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Nueva Actividad Remota</h2>
                <button onClick={() => setIsCreating(false)} className="text-slate-600 hover:text-slate-900 font-semibold">&larr; Volver al listado</button>
            </div>
             <p className="text-slate-500 mt-1 mb-6">Complete el formulario y la IA generará una actividad interactiva para sus estudiantes.</p>
            <form onSubmit={handleGeneratePreview} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Asignatura</label>
                        <select name="asignatura" value={formData.asignatura} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm">{ASIGNATURAS.map(a=><option key={a} value={a}>{a}</option>)}</select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Nivel</label>
                        <select name="nivel" value={formData.nivel} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm">{NIVELES.map(n=><option key={n} value={n}>{n}</option>)}</select>
                    </div>

                    <div className="md:col-span-2 p-4 border rounded-lg space-y-4 bg-slate-50 dark:bg-slate-700/50">
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Recursos de Aprendizaje (Opcional)</h3>
                        <div>
                             <label className="block text-sm font-medium text-slate-600 mb-1">Instrucciones de estudio</label>
                            <textarea name="instrucciones" value={formData.recursos?.instrucciones} onChange={handleRecursoChange} placeholder="Ej: Lee el siguiente texto y luego responde..." rows={3} className="w-full border-slate-300 rounded-md shadow-sm"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Enlaces (videos, documentos, etc.)</label>
                            <textarea name="enlaces" value={formData.recursos?.enlaces} onChange={handleRecursoChange} placeholder="Pega un enlace por línea..." rows={3} className="w-full border-slate-300 rounded-md shadow-sm"/>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-600 mb-1">Adjuntar archivos (PDF, imágenes, etc.)</label>
                             <input type="file" multiple onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"/>
                        </div>
                    </div>


                    <div className="md:col-span-2 p-4 border rounded-lg space-y-4 bg-slate-50 dark:bg-slate-700/50">
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Destinatarios</h3>
                        <p className="text-sm text-slate-500">Seleccione cursos o estudiantes. Si no selecciona ninguno, la actividad será visible para todo el nivel.</p>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Cursos</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-40 overflow-y-auto p-2 bg-white rounded">
                                {CURSOS.map(curso => (<label key={curso} className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 cursor-pointer"><input type="checkbox" checked={formData.cursosDestino?.includes(curso)} onChange={() => handleCursoDestinoChange(curso)} className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"/><span className="text-sm font-medium text-slate-700">{curso}</span></label>))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Estudiantes</label>
                            <input type="text" placeholder="Buscar..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm mb-2"/>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-2 bg-white rounded">
                                {filteredStudents.map(student => (<label key={student.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 cursor-pointer"><input type="checkbox" checked={formData.estudiantesDestino?.includes(student.nombreCompleto)} onChange={() => handleEstudianteDestinoChange(student.nombreCompleto)} className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"/><span className="text-sm font-medium text-slate-700 truncate" title={student.nombreCompleto}>{student.nombreCompleto}</span></label>))}
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-600 mb-2">Tipos de Actividad</label>
                        <div className="space-y-3">
                           {TIPOS_ACTIVIDAD_REMOTA.map(tipo => (
                                <div key={tipo} className="p-3 border rounded-lg has-[:checked]:bg-amber-50 has-[:checked]:border-amber-300">
                                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={formData.tipos.includes(tipo)} onChange={() => handleTipoChange(tipo)} className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"/><span className="text-sm font-medium text-slate-700 flex-grow">{tipo}</span></label>
                                    {formData.tipos.includes(tipo) && (<div className="mt-3 pl-8 flex items-center gap-2"><span className="text-xs text-slate-500">Cantidad:</span>{ITEM_QUANTITIES[tipo].map(qty => (<button type="button" key={qty} onClick={() => handleQuantityChange(tipo, qty)} className={`px-3 py-1 rounded-full font-semibold text-xs ${formData.cantidadPreguntas[tipo] === qty ? 'bg-amber-500 text-white' : 'bg-slate-200'}`}>{qty}</button>))}</div>)}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="contenido" className="block text-sm font-medium text-slate-600 mb-1">Contenido <span className="text-red-500">*</span></label>
                        <textarea name="contenido" value={formData.contenido} onChange={handleFieldChange} required rows={4} placeholder="Ingrese los temas, conceptos clave o el texto base..." className="w-full border-slate-300 rounded-md shadow-sm"></textarea>
                    </div>
                    <div>
                        <label htmlFor="plazoEntrega" className="block text-sm font-medium text-slate-600 mb-1">Plazo de Entrega</label>
                        <input type="date" name="plazoEntrega" value={formData.plazoEntrega} onChange={handleFieldChange} required className="w-full border-slate-300 rounded-md shadow-sm" />
                    </div>
                </div>
                 {error && <p className="text-red-600 bg-red-100 p-3 rounded-md mt-4">{error}</p>}
                <div className="pt-4 text-right">
                    <button type="submit" disabled={isLoading} className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 flex items-center justify-center min-w-[180px]">
                        {isLoading ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'Generar y Previsualizar'}
                    </button>
                </div>
            </form>
        </div>
    );
    
    const renderPreview = () => (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-slate-800">Previsualización de la Actividad</h2>
            <p className="text-slate-500 mt-1 mb-6">Revisa el contenido generado. Si todo está correcto, confirma para asignar la actividad.</p>
            <div className="space-y-6 max-h-[60vh] overflow-y-auto p-4 bg-slate-50 rounded-lg border">
                <div className="p-4 bg-sky-50 border-l-4 border-sky-400 rounded-r-lg"><h3 className="font-bold text-sky-800 mb-2">Introducción para el Estudiante</h3><p className="text-slate-700 whitespace-pre-wrap">{previewData?.introduccion}</p></div>
                
                {previewData?.recursos && (previewData.recursos.instrucciones || previewData.recursos.enlaces || previewData.recursos.archivos?.length) && (
                    <div className="p-4 bg-indigo-50 border-l-4 border-indigo-400 rounded-r-lg">
                        <h3 className="font-bold text-indigo-800 mb-2">Recursos de Aprendizaje</h3>
                        <div className="space-y-3">
                            {previewData.recursos.instrucciones && <p className="text-slate-700 whitespace-pre-wrap">{previewData.recursos.instrucciones}</p>}
                            {previewData.recursos.enlaces && (
                                <div>{previewData.recursos.enlaces.split('\n').map((link, i) => link.trim() && <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline truncate">{link}</a>)}</div>
                            )}
                            {previewData.recursos.archivos && previewData.recursos.archivos.length > 0 && (
                                <ul className="list-disc list-inside">
                                    {previewData.recursos.archivos.map(file => <li key={file.nombre} className="text-slate-700">{file.nombre}</li>)}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {previewData?.tipos.map(tipo => {
                    const content = previewData.generatedContent[tipo];
                    if (!content) return null;
                    return (
                        <div key={tipo} className="p-4 border rounded-lg bg-white">
                            <h3 className="text-xl font-bold mb-4">{tipo}</h3>
                            <div className="space-y-4 text-sm">
                                {tipo === 'Quiz' && Array.isArray(content) && content.map((q, i) => (
                                    <div key={i} className="border-t pt-3 first:border-t-0">
                                        <p className="font-semibold">{i+1}. {q.pregunta}</p>
                                        <ul className="list-none pl-5 mt-2 space-y-1">
                                            {q.opciones.map((o: string, index: number) => (
                                                <li key={index}>
                                                    <strong>{String.fromCharCode(65 + index)}.</strong> {o}
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="text-xs text-green-600 font-semibold mt-2 p-1 bg-green-50 rounded inline-block">R: {q.respuestaCorrecta}</p>
                                    </div>
                                ))}
                                {tipo === 'Comprensión de Lectura' && content && typeof content === 'object' && 'preguntas' in content && Array.isArray(content.preguntas) && (
                                    <div>
                                        <p className="whitespace-pre-wrap bg-slate-100 p-3 rounded-md mb-4">{content.texto}</p>
                                        {content.preguntas.map((q: QuizQuestion, i: number) => (
                                            <div key={i} className="border-t pt-3 first:border-t-0">
                                                <p className="font-semibold">{i+1}. {q.pregunta}</p>
                                                <ul className="list-none pl-5 mt-2 space-y-1">
                                                    {q.opciones.map((o, index) => (
                                                        <li key={index}>
                                                            <strong>{String.fromCharCode(65 + index)}.</strong> {o}
                                                        </li>
                                                    ))}
                                                </ul>
                                                <p className="text-xs text-green-600 font-semibold mt-2 p-1 bg-green-50 rounded inline-block">R: {q.respuestaCorrecta}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {tipo === 'Términos Pareados' && Array.isArray(content) && (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full border border-slate-200">
                                            <thead className="bg-slate-100">
                                                <tr>
                                                    <th className="text-left font-semibold p-2 border-b">Concepto</th>
                                                    <th className="text-left font-semibold p-2 border-b">Definición</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {content.map((p: PareadoItem) => (
                                                    <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50">
                                                        <td className="p-2 align-top font-semibold text-slate-800">{p.concepto}</td>
                                                        <td className="p-2 align-top text-slate-700">{p.definicion}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {tipo === 'Desarrollo' && Array.isArray(content) && content.map((d,i) => (
                                    <div key={i} className="border-t pt-3 first:border-t-0">
                                        <p className="font-semibold">{i+1}. {d.pregunta}</p>
                                        <p className="text-sm text-slate-600 mt-2 p-2 bg-slate-100 rounded-md"><strong className="font-semibold">Rúbrica:</strong> {d.rubrica}</p>
                                    </div>
                                ))}
                                
                                {((tipo === 'Quiz' || tipo === 'Términos Pareados' || tipo === 'Desarrollo') && !Array.isArray(content)) && (
                                    <div className="text-red-600 text-sm p-3 bg-red-50 border border-red-200 rounded-md">El contenido generado para "<strong>{tipo}</strong>" no tiene el formato de array esperado. La IA pudo haber devuelto una respuesta en un formato no válido.</div>
                                )}
                                {tipo === 'Comprensión de Lectura' && (!content || typeof content !== 'object' || !Array.isArray((content as any).preguntas)) && (
                                    <div className="text-red-600 text-sm p-3 bg-red-50 border border-red-200 rounded-md">El contenido generado para "<strong>Comprensión de Lectura</strong>" no tiene el formato de objeto con preguntas esperado.</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="pt-6 flex justify-end gap-4">
                <button onClick={() => setPreviewData(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300">Cancelar</button>
                <button onClick={handleConfirmAndSave} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700">Confirmar y Asignar</button>
            </div>
        </div>
    );

    const renderActivityList = () => (
       <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">Actividades Remotas</h1>
                <button onClick={() => setIsCreating(true)} className="bg-amber-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-amber-600">Crear Nueva</button>
            </div>
            <div className="space-y-4">
                {actividades.length > 0 ? actividades.map(act => {
                    const destinations = [];
                    if (act.cursosDestino?.length) destinations.push(`Cursos: ${act.cursosDestino.join(', ')}`);
                    if (act.estudiantesDestino?.length) destinations.push(`Estudiantes: ${act.estudiantesDestino.length}`);
                    const destinationText = destinations.length ? destinations.join(' | ') : `Todo ${act.nivel}`;

                    return (
                        <div key={act.id} className="p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-800">{act.asignatura} - {act.tipos.join(', ')}</p>
                                    <p className="text-sm text-slate-500">Destino: {destinationText} | Creado: {new Date(act.fechaCreacion).toLocaleDateString('es-CL')}</p>
                                </div>
                                <button onClick={() => setSelectedActividad(act)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">Ver Resultados</button>
                            </div>
                        </div>
                    )
                }) : <p className="text-slate-500 text-center py-6">No hay actividades creadas. Haga clic en "Crear Nueva" para comenzar.</p>}
            </div>
        </div>
    );

    if (dataLoading) {
        return <div className="text-center py-10">Cargando datos...</div>;
    }

    return (
        <div className="animate-fade-in">
            {renderTabs()}
            {previewPrueba ? (
                renderPruebaPreview()
            ) : previewData ? (
                renderPreview()
            ) : selectedActividad || selectedPrueba ? (
                renderActivityView()
            ) : activeTab === 'pruebas' ? (
                isCreatingPrueba ? renderPruebaCreationForm() : renderPruebasList()
            ) : (
                isCreating ? renderCreationForm() : renderActivityList()
            )}
        </div>
    );
};

export default ActividadesRemotas;