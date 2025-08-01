import React, { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { ActividadRemota, RespuestaEstudianteActividad, TipoActividadRemota, QuizQuestion, PareadoItem, ComprensionLecturaContent, DesarrolloContent, User, Profile, ArchivoAdjuntoRecurso } from '../../types';
import { ASIGNATURAS, NIVELES, TIPOS_ACTIVIDAD_REMOTA, CURSOS } from '../../constants';
import { GoogleGenAI, Type } from "@google/genai";
import { logApiCall } from '../utils/apiLogger';

// Importa helpers de Firestore
import {
  getAllActividades,
  createActividad,
} from '../../src/firebaseHelpers/actividades';
import { getAllUsers } from '../../src/firebaseHelpers/users';

const ITEM_QUANTITIES: Record<TipoActividadRemota, number[]> = {
  'Quiz': [5, 10, 15],
  'Términos Pareados': [5, 10, 15],
  'Desarrollo': [1, 2, 3],
  'Comprensión de Lectura': [1, 2, 3],
};

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
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedActividad, setSelectedActividad] = useState<ActividadRemota | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [previewData, setPreviewData] = useState<ActividadRemota | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Estado del formulario
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
  const [formData, setFormData] = useState(initialFormState);

  // Cargar actividades y usuarios desde Firestore al iniciar
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const acts = await getAllActividades();
        setActividades(acts);
        const users = await getAllUsers();
        setAllUsers(users);
      } catch {
        setError("No se pudieron cargar los datos desde la nube.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Manejadores para el formulario (sin cambios, mismos que ya usabas)
  const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
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

  const handleCursoDestinoChange = (curso: string) => {
    setFormData(prev => {
      const newCursos = prev.cursosDestino?.includes(curso)
        ? prev.cursosDestino.filter(c => c !== curso)
        : [...(prev.cursosDestino || []), curso];
      return { ...prev, cursosDestino: newCursos };
    });
  };

  const handleEstudianteDestinoChange = (nombre: string) => {
    setFormData(prev => {
      const newEstudiantes = prev.estudiantesDestino?.includes(nombre)
        ? prev.estudiantesDestino.filter(e => e !== nombre)
        : [...(prev.estudiantesDestino || []), nombre];
      return { ...prev, estudiantesDestino: newEstudiantes };
    });
  };

  // --- IA: Prompt y schema ---
  const getResponseSchema = (tipos: TipoActividadRemota[]) => {
    const individualSchemas: Record<string, object> = {
      'Quiz': { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { pregunta: { type: Type.STRING }, opciones: { type: Type.ARRAY, items: { type: Type.STRING } }, respuestaCorrecta: { type: Type.STRING } } } },
      'Comprensión de Lectura': { type: Type.OBJECT, properties: { texto: { type: Type.STRING }, preguntas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { pregunta: { type: Type.STRING }, opciones: { type: Type.ARRAY, items: { type: Type.STRING } }, respuestaCorrecta: { type: Type.STRING } } } } } },
      'Términos Pareados': { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, concepto: { type: Type.STRING }, definicion: { type: Type.STRING } } } },
      'Desarrollo': { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { pregunta: { type: Type.STRING }, rubrica: { type: Type.STRING } } } }
    };

    const activitiesProperties: any = {};
    tipos.forEach(tipo => {
      activitiesProperties[tipo] = individualSchemas[tipo];
    });

    return {
      type: Type.OBJECT,
      properties: {
        introduccion: { type: Type.STRING, description: "Una breve introducción motivadora para el estudiante sobre el tema." },
        actividades: { type: Type.OBJECT, properties: activitiesProperties, required: tipos }
      },
      required: ["introduccion", "actividades"]
    };
  };

  const buildPrompt = () => {
    const { tipos, contenido, asignatura, nivel, cantidadPreguntas } = formData;
    let prompt = `Eres un experto diseñador de actividades pedagógicas. Genera un objeto JSON que se ajuste al esquema, sin texto adicional.\n\nContenido base: "${contenido}"\nAsignatura: ${asignatura}\nNivel: ${nivel}\n\nGenera los siguientes elementos:\n- **introduccion**: Una breve introducción motivadora para el estudiante sobre el tema: "${contenido}".\n- **actividades**: Un objeto que contiene las actividades. Cada actividad es una propiedad con su nombre como clave:\n`;
    tipos.forEach(tipo => {
      const cantidad = cantidadPreguntas[tipo] || ITEM_QUANTITIES[tipo][0];
      switch (tipo) {
        case 'Quiz': prompt += `- **Quiz**: Genera un quiz de ${cantidad} preguntas de selección múltiple sobre el contenido. Cada una con 4 opciones.\n`; break;
        case 'Comprensión de Lectura': prompt += `- **Comprensión de Lectura**: Genera ${cantidad} actividad(es) de comprensión. Cada una con un texto de 150-200 palabras y 4 preguntas de selección múltiple.\n`; break;
        case 'Términos Pareados': prompt += `- **Términos Pareados**: Genera ${cantidad} pares de términos pareados (concepto y definición).\n`; break;
        case 'Desarrollo': prompt += `- **Desarrollo**: Genera ${cantidad} pregunta(s) de desarrollo con una rúbrica simple en texto.\n`; break;
      }
    });
    return prompt;
  };

  // --- IA: Generar actividad y previsualizar ---
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

      logApiCall('Actividades Remotas');
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_AI_API_KEY });
      const prompt = buildPrompt();
      const schema = getResponseSchema(formData.tipos);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: schema }
      });

      const generatedData = JSON.parse(response.text);

      const newActividad: ActividadRemota = {
        id: crypto.randomUUID(),
        fechaCreacion: new Date().toISOString(),
        ...formData,
        recursos: {
          ...formData.recursos,
          archivos: processedFiles
        },
        introduccion: generatedData.introduccion,
        generatedContent: generatedData.actividades,
      };

      setPreviewData(newActividad);

    } catch (e) {
      setError("Error al generar la actividad. Por favor, revise el contenido e inténtelo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Confirmar y guardar en Firestore ---
  const handleConfirmAndSave = async () => {
    if (!previewData) return;
    try {
      await createActividad({ ...previewData, id: undefined }); // id generado por Firestore
      const acts = await getAllActividades();
      setActividades(acts);
      setFormData(initialFormState);
      setSelectedFiles([]);
      setIsCreating(false);
      setPreviewData(null);
      setSelectedActividad(null);
    } catch {
      setError("No se pudo guardar la actividad en la nube.");
    }
  };

  // --- Para mostrar usuarios destinatarios ---
  const students = useMemo(() => {
    return allUsers.filter(u => u.profile === Profile.ESTUDIANTE).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }, [allUsers]);
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    return students.filter(s => s.nombreCompleto.toLowerCase().includes(studentSearch.toLowerCase()));
  }, [students, studentSearch]);

  // --- Renderizado igual que tu código original ---
  // (Por espacio, si quieres una sección renderizada explícitamente avísame)
  // Puedes copiar los métodos renderActivityView, renderCreationForm, renderPreview, renderActivityList ¡TAL CUAL! de tu código,
  // porque no cambian (solo el manejo de datos es distinto).

  return (
    <div className="animate-fade-in">
      {previewData ? (
        // ... renderPreview (copia tu método aquí)
        // Incluye el botón Confirmar que llama a handleConfirmAndSave
        <div>
          <h2>Previsualización</h2>
          <button onClick={handleConfirmAndSave}>Confirmar y Guardar</button>
        </div>
      ) : selectedActividad ? (
        // ... renderActivityView (copia aquí)
        <div>Ver resultados</div>
      ) : (isCreating ? (
        // ... renderCreationForm (copia aquí, el form llama a handleGeneratePreview)
        <div>Crear nueva actividad</div>
      ) : (
        // ... renderActivityList (copia aquí)
        <div>Listado de actividades</div>
      ))}
      {isLoading && <div>Cargando...</div>}
      {error && <div className="text-red-500">{error}</div>}
    </div>
  );
};

export default ActividadesRemotas;
