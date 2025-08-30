// Normaliza el formato de los cursos para asegurar coincidencia (igual que EvaluacionesFormativas)
export const normalizeCurso = (curso: string): string => {
  if (!curso) return '';
  let normalized = curso.trim().toLowerCase();
  normalized = normalized.replace(/°/g, 'º');
  normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
  normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
  normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
  normalized = normalized.replace(/\s+/g, '').toUpperCase();
  return normalized;
};
import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { 
  PenTool, 
  Plus, 
  ListFilter, 
  Search, 
  Trash2, 
  Edit, 
  PlusCircle, 
  Save,
  RefreshCw,
  BookOpen,
  Calculator,
  X,
  Check,
  HelpCircle,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Users
} from 'lucide-react';
import { 
  SetPreguntas, 
  Pregunta, 
  AsignaturaSimce, 
  Alternativa,
  estandaresLectura,
  estandaresMatematica
} from '../../types/simce';
import { 
  crearSetPreguntas, 
  actualizarSetPreguntas, 
  obtenerSetsPreguntasPorProfesor,
  eliminarSetPreguntas
} from '../../src/firebaseHelpers/simceHelper';
// Importamos tanto la versión local como la versión cloud para poder elegir
import { generarPreguntasSimce as generarPreguntasSimceLocal } from '../../src/ai/simceGenerator';
import { generarPreguntasSimceCloud } from '../../src/firebaseHelpers/simceCloudFunctions';
import UltraSafeRenderer from '../common/UltraSafeRenderer';
import { getAllUsers } from '../../src/firebaseHelpers/users';
import { CURSOS } from '../../constants';

interface SimceGeneradorPreguntasProps {
  currentUser: User;
}

// SOLUCIÓN 1: Función auxiliar para buscar texto base en cualquier pregunta
const encontrarTextoBase = (preguntas: Pregunta[]) => {
  // Buscar en todas las preguntas por si el texto base está en cualquiera
  for (const pregunta of preguntas) {
    if (pregunta.textoBase && pregunta.textoBase.trim()) {
      return pregunta.textoBase.trim();
    }
  }
  return null;
};

// SOLUCIÓN 4: Propagar el texto base a todas las preguntas de lectura
const propagarTextoBase = (preguntas: Pregunta[], textoBase: string): Pregunta[] => {
  if (!textoBase.trim()) return preguntas;
  
  return preguntas.map((pregunta, index) => {
    // Solo la primera pregunta debe tener el textoBase visible
    if (index === 0) {
      return { ...pregunta, textoBase: textoBase.trim() };
    }
    return pregunta;
  });
};

export const SimceGeneradorPreguntas: React.FC<SimceGeneradorPreguntasProps> = ({ currentUser }) => {
  // Estados para las evaluaciones existentes
  const [setsPreguntas, setSetsPreguntas] = useState<SetPreguntas[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modoVisualizacion, setModoVisualizacion] = useState<'lista' | 'detalle'>('lista');
  const [setSeleccionado, setSetSeleccionado] = useState<SetPreguntas | null>(null);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroAsignatura, setFiltroAsignatura] = useState<'todas' | AsignaturaSimce>('todas');

  // Estados para crear/editar evaluaciones
  const [modoEdicion, setModoEdicion] = useState(false);
  const [nuevaEvaluacion, setNuevaEvaluacion] = useState<Partial<SetPreguntas>>({
    titulo: '',
    descripcion: '',
    asignatura: 'Lectura',
    preguntas: [],
    cursosAsignados: [],
    barajarPreguntas: true,
    barajarAlternativas: true
  });
  const [generandoPreguntas, setGenerandoPreguntas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursos, setCursos] = useState<{id: string, nombre: string}[]>([]);
  const [cursosFiltrados, setCursosFiltrados] = useState<{id: string, nombre: string}[]>([]);
  const [searchCurso, setSearchCurso] = useState('');
  const [showCursoDropdown, setShowCursoDropdown] = useState(false);
  const [preguntaSeleccionada, setPreguntaSeleccionada] = useState<Pregunta | null>(null);
  const [preguntaEnEdicion, setPreguntaEnEdicion] = useState<Pregunta | null>(null);
  
  // Cargar sets de preguntas del profesor y los cursos disponibles
  useEffect(() => {
    const inicializarDatos = async () => {
      try {
        setCargando(true);

        // Cargar los sets de preguntas
        const sets = await obtenerSetsPreguntasPorProfesor(currentUser.uid || '');
        setSetsPreguntas(sets);

        // Cargar los usuarios (estudiantes) para obtener cursos reales
        const usuarios = await getAllUsers();

        // Obtener cursos únicos (normalizados)
        const cursosUnicos = new Set<string>();

        // Primero agregamos los cursos del profesor actual (normalizados)
        if (currentUser.cursos && currentUser.cursos.length > 0) {
          currentUser.cursos.forEach(curso => cursosUnicos.add(normalizeCurso(curso)));
        } else {
          // Si no tiene cursos asignados, usamos los de las constantes como respaldo (normalizados)
          CURSOS.forEach(curso => cursosUnicos.add(normalizeCurso(curso)));
        }

        // Extraemos los cursos de los estudiantes registrados (normalizados)
        usuarios
          .filter(user => user.profile === 'ESTUDIANTE' && user.curso)
          .forEach(user => {
            if (user.curso) {
              // Normalizar el curso del estudiante y sobreescribir el valor en el usuario
              user.curso = normalizeCurso(user.curso);
              cursosUnicos.add(user.curso);
            }
          });

        // Convertimos a formato {id, nombre} usando el id normalizado
        const cursosList = Array.from(cursosUnicos).sort().map(curso => ({
          id: curso,
          nombre: formatearNombreCurso(curso)
        }));

        setCursos(cursosList);
      } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        setError('No se pudieron cargar los datos necesarios');
      } finally {
        setCargando(false);
      }
    };

    inicializarDatos();
  }, [currentUser]);
  
  // Función para dar formato al nombre del curso
  const formatearNombreCurso = (cursoId: string): string => {
    // Ejemplos: "1ºA" -> "1º Medio A", "3ºC" -> "3º Medio C"
    const match = cursoId.match(/^(\d+)º?([A-E])$/i);
    
    if (match) {
      const nivel = match[1];
      const letra = match[2].toUpperCase();
      return `${nivel}º Medio ${letra}`;
    }
    
    return cursoId; // Devolver original si no coincide con el formato esperado
  };

  useEffect(() => {
    if (searchCurso) {
      setCursosFiltrados(
        cursos.filter(curso => 
          curso.nombre.toLowerCase().includes(searchCurso.toLowerCase())
        )
      );
    } else {
      setCursosFiltrados([]);
    }
  }, [searchCurso, cursos]);

  const filtrarSetsPreguntas = () => {
    return setsPreguntas.filter(set => {
      const coincideTitulo = set.titulo.toLowerCase().includes(filtroBusqueda.toLowerCase());
      const coincideAsignatura = filtroAsignatura === 'todas' || set.asignatura === filtroAsignatura;
      return coincideTitulo && coincideAsignatura;
    });
  };

  const handleCrearEvaluacion = () => {
    setModoEdicion(true);
    setSetSeleccionado(null);
    setNuevaEvaluacion({
      titulo: '',
      descripcion: '',
      asignatura: 'Lectura',
      preguntas: [],
      cursosAsignados: [],
      barajarPreguntas: true,
      barajarAlternativas: true
    });
    setPreguntaSeleccionada(null);
    setPreguntaEnEdicion(null);
    setOpcionesGeneracion(prev => ({
      ...prev,
      textoProporcionado: ''
    }));
    setModoVisualizacion('detalle');
  };

  const handleEditarSet = (set: SetPreguntas) => {
    setModoEdicion(true);
    setSetSeleccionado(set);
    setNuevaEvaluacion({ ...set });
    setModoVisualizacion('detalle');
  };

  const handleEliminarSet = async (set: SetPreguntas) => {
    if (window.confirm(`¿Estás seguro de eliminar el set "${set.titulo}"? Esta acción no se puede deshacer.`)) {
      try {
        await eliminarSetPreguntas(set.id);
        setSetsPreguntas(prev => prev.filter(s => s.id !== set.id));
      } catch (error) {
        console.error('Error al eliminar set:', error);
        setError('No se pudo eliminar el set de preguntas');
      }
    }
  };

  const handleGuardarEvaluacion = async () => {
    try {
      if (!nuevaEvaluacion.titulo) {
        setError('El título es obligatorio');
        return;
      }

      if (!nuevaEvaluacion.preguntas || nuevaEvaluacion.preguntas.length === 0) {
        setError('Debe agregar al menos una pregunta');
        return;
      }

      // Mensaje basado en si está asignando o solo guardando
      const tieneAsignaciones = (nuevaEvaluacion.cursosAsignados || []).length > 0;
      const accion = tieneAsignaciones ? 'guardando y asignando' : 'guardando';
      
      setCargando(true);
      setInfoGeneracion({
        tipo: 'warning',
        mensaje: `Estamos ${accion} la evaluación...`
      });

      // Asegurar que el texto base se propague correctamente si existe
      let preguntasFinales = [...(nuevaEvaluacion.preguntas || [])];
      
      // Si es una evaluación de lectura, revisar si hay texto base
      if (nuevaEvaluacion.asignatura === 'Lectura') {
        const textoBase = encontrarTextoBase(preguntasFinales);
        if (textoBase) {
          preguntasFinales = propagarTextoBase(preguntasFinales, textoBase);
          console.log("Texto base propagado a la primera pregunta:", textoBase);
        }
      }
      // Normalizar todos los cursos asignados antes de guardar
      const cursosAsignadosNormalizados = Array.isArray(nuevaEvaluacion.cursosAsignados)
        ? nuevaEvaluacion.cursosAsignados.map(normalizeCurso)
        : [];

      // Construir el objeto evaluacionActualizada con todos los campos requeridos
      const evaluacionActualizada: Omit<SetPreguntas, 'id'> = {
        titulo: nuevaEvaluacion.titulo || '',
        descripcion: nuevaEvaluacion.descripcion || '',
        asignatura: nuevaEvaluacion.asignatura || 'Lectura',
        preguntas: preguntasFinales,
        creadorId: currentUser.uid || '', // SIEMPRE usar uid
        creadorNombre: currentUser.nombreCompleto || '',
        fechaCreacion: setSeleccionado?.fechaCreacion || new Date().toISOString(),
        cursosAsignados: cursosAsignadosNormalizados,
        barajarPreguntas: typeof nuevaEvaluacion.barajarPreguntas === 'boolean' ? nuevaEvaluacion.barajarPreguntas : true,
        barajarAlternativas: typeof nuevaEvaluacion.barajarAlternativas === 'boolean' ? nuevaEvaluacion.barajarAlternativas : true
      };

      if (setSeleccionado) {
        // Actualizar set existente
        await actualizarSetPreguntas(setSeleccionado.id, evaluacionActualizada);

        // Actualizar la lista de sets
        setSetsPreguntas(prev => prev.map(set =>
          set.id === setSeleccionado.id ? { ...set, ...evaluacionActualizada } as SetPreguntas : set
        ));
      } else {
        // Crear nuevo set
        const nuevoId = await crearSetPreguntas(evaluacionActualizada);
        const setCompleto = { id: nuevoId, ...evaluacionActualizada } as SetPreguntas;

        // Agregar a la lista
        setSetsPreguntas(prev => [setCompleto, ...prev]);
      }

      // Mostrar mensaje de éxito
      setInfoGeneracion({
        tipo: 'success',
        mensaje: tieneAsignaciones 
          ? `Evaluación guardada y asignada a ${nuevaEvaluacion.cursosAsignados?.length} curso${nuevaEvaluacion.cursosAsignados?.length !== 1 ? 's' : ''} correctamente`
          : 'Evaluación guardada correctamente'
      });
      
      // Limpiar el mensaje después de 3 segundos
      setTimeout(() => {
        setInfoGeneracion({ tipo: '', mensaje: '' });
      }, 3000);

      setModoEdicion(false);
      setModoVisualizacion('lista');
      setError(null);
    } catch (error) {
      console.error('Error al guardar evaluación:', error);
      setError('No se pudo guardar la evaluación');
      
      setInfoGeneracion({
        tipo: 'error',
        mensaje: 'Ocurrió un error al guardar la evaluación'
      });
      
      // Limpiar el mensaje de error después de 3 segundos
      setTimeout(() => {
        setInfoGeneracion({ tipo: '', mensaje: '' });
      }, 3000);
    } finally {
      setCargando(false);
    }
  };

  // Estado para opciones de generación
  const [opcionesGeneracion, setOpcionesGeneracion] = useState({
    cantidadPreguntas: '4',
    dificultad: 'media',
    textoProporcionado: '',
    habilidadesLectura: {
      'Localizar información': true,
      'Relacionar información': true,
      'Interpretar': true,
      'Reflexionar y evaluar': true
    },
    ejesMatematica: {
      'Números': true,
      'Álgebra y Funciones': true,
      'Geometría': true,
      'Probabilidad y Estadística': true
    }
  });

  // Estado para mostrar información de generación
  const [infoGeneracion, setInfoGeneracion] = useState({
    tipo: '' as 'success' | 'error' | 'warning' | '',
    mensaje: ''
  });

  // SOLUCIÓN 2: Mejorar el manejo de errores JSON en la generación de IA
  const handleGenerarPreguntas = async () => {
    try {
      if (!nuevaEvaluacion.asignatura) {
        setError('Seleccione una asignatura para generar preguntas');
        return;
      }
      
      setGenerandoPreguntas(true);
      setError(null);
      setInfoGeneracion({ tipo: '', mensaje: '' });
      
      // Obtener las habilidades o ejes seleccionados
      let habilidadesLectura: string[] | undefined;
      let ejesMatematica: string[] | undefined;
      
      if (nuevaEvaluacion.asignatura === 'Lectura') {
        habilidadesLectura = Object.entries(opcionesGeneracion.habilidadesLectura)
          .filter(([_, seleccionado]) => seleccionado)
          .map(([habilidad]) => habilidad);
          
        if (habilidadesLectura.length === 0) {
          habilidadesLectura = ['Localizar información', 'Relacionar información', 'Interpretar', 'Reflexionar y evaluar'];
        }
      } else if (nuevaEvaluacion.asignatura === 'Matemática') {
        ejesMatematica = Object.entries(opcionesGeneracion.ejesMatematica)
          .filter(([_, seleccionado]) => seleccionado)
          .map(([eje]) => eje);
          
        if (ejesMatematica.length === 0) {
          ejesMatematica = ['Números', 'Álgebra y Funciones', 'Geometría', 'Probabilidad y Estadística'];
        }
      }
      
      // Mostrar mensaje de carga específico
      setInfoGeneracion({
        tipo: 'warning',
        mensaje: `Generando ${opcionesGeneracion.cantidadPreguntas} preguntas de ${nuevaEvaluacion.asignatura}. Este proceso puede tardar unos segundos...`
      });
      
      // Crear las opciones para la generación de preguntas
      const opcionesGeneracionSimce = {
        asignatura: nuevaEvaluacion.asignatura,
        cantidad: parseInt(opcionesGeneracion.cantidadPreguntas), 
        opcionesPorPregunta: 4,
        habilidadesLectura,
        ejesMatematica,
        dificultad: opcionesGeneracion.dificultad as 'baja' | 'media' | 'alta',
        contextoCurricular: nuevaEvaluacion.descripcion,
        textoProporcionado: opcionesGeneracion.textoProporcionado?.trim() || undefined
      };
      
      let preguntasGeneradas;
      let metodosIntentos = [];
      
      try {
        // Método 1: Cloud Function
        console.log('Intentando generar preguntas usando Cloud Function...');
        metodosIntentos.push('Cloud Function');
        preguntasGeneradas = await generarPreguntasSimceCloud(opcionesGeneracionSimce);
        
        // Validar que la respuesta sea válida
        if (!Array.isArray(preguntasGeneradas) || preguntasGeneradas.length === 0) {
          throw new Error('La respuesta de Cloud Function no es válida');
        }
        
        // Validar estructura de cada pregunta
        preguntasGeneradas.forEach((pregunta, index) => {
          if (!pregunta.enunciado || !Array.isArray(pregunta.alternativas) || pregunta.alternativas.length !== 4) {
            throw new Error(`Pregunta ${index + 1} tiene estructura inválida`);
          }
        });
        
      } catch (cloudError) {
        console.error('Error con Cloud Function:', cloudError);
        
        try {
          // Método 2: Generación local como fallback
          console.log('Usando generación local como respaldo...');
          metodosIntentos.push('Local');
          
          setInfoGeneracion({
            tipo: 'warning',
            mensaje: `Usando generación local como respaldo. Procesando...`
          });
          
          preguntasGeneradas = await generarPreguntasSimceLocal(opcionesGeneracionSimce);
          
          // Validar respuesta local también
          if (!Array.isArray(preguntasGeneradas) || preguntasGeneradas.length === 0) {
            throw new Error('La generación local no produjo resultados válidos');
          }
          
          // Validar estructura
          preguntasGeneradas.forEach((pregunta, index) => {
            if (!pregunta.enunciado || !Array.isArray(pregunta.alternativas) || pregunta.alternativas.length !== 4) {
              throw new Error(`Pregunta ${index + 1} generada localmente tiene estructura inválida`);
            }
          });
          
        } catch (localError) {
          console.error('Error con generación local:', localError);
          
          // Si ambos métodos fallan, crear mensaje de error detallado
          const erroresDetallados = [];
          
          if (cloudError.message?.includes('JSON')) {
            erroresDetallados.push('Problema de formato en servidor remoto');
          }
          if (localError.message?.includes('JSON')) {
            erroresDetallados.push('Problema de formato en generación local');
          }
          
          throw new Error(
            `No se pudieron generar preguntas con ningún método (intentos: ${metodosIntentos.join(', ')}). ` +
            `Errores: ${erroresDetallados.join(', ') || 'Problemas de conexión o formato'}. ` +
            `Por favor, intente nuevamente o genere preguntas manualmente.`
          );
        }
      }
      
      // Verificación final
      if (!preguntasGeneradas || preguntasGeneradas.length === 0) {
        throw new Error('No se generaron preguntas válidas después de todos los intentos');
      }
      
      // Procesar preguntas válidas y agregar textoBase SIEMPRE en Lectura
      if (nuevaEvaluacion.asignatura === 'Lectura') {
        let textoBase = opcionesGeneracion.textoProporcionado?.trim();
        // Si el usuario no lo ingresó, intentar obtenerlo de la IA (asumimos que viene en preguntasGeneradas[0].textoBase o en otro campo)
        if (!textoBase) {
          textoBase = preguntasGeneradas[0].textoBase?.trim();
        }
        // Si aún no hay texto base, usar un mensaje por defecto (esto no debería ocurrir si la IA funciona bien)
        if (!textoBase) {
          textoBase = 'Texto de comprensión generado automáticamente.';
        }
        preguntasGeneradas[0].textoBase = textoBase;
        // Log para depuración
        console.log("[DEBUG] Texto base final asignado a la primera pregunta:", textoBase.substring(0, 50) + "...");
      }
      
      // Actualizar el estado con las nuevas preguntas
      setNuevaEvaluacion(prev => ({
        ...prev,
        preguntas: [...(prev.preguntas || []), ...preguntasGeneradas]
      }));
      
      // Mostrar mensaje de éxito
      setInfoGeneracion({
        tipo: 'success',
        mensaje: `¡Se generaron ${preguntasGeneradas.length} preguntas correctamente usando ${metodosIntentos[metodosIntentos.length - 1]}!`
      });
      
      // Limpiar el mensaje después de 5 segundos
      setTimeout(() => {
        setInfoGeneracion({ tipo: '', mensaje: '' });
      }, 5000);
      
    } catch (error) {
      console.error('Error general al generar preguntas:', error);
      
      // Mensaje de error más específico y útil
      let mensajeError = 'No se pudieron generar las preguntas.';
      
      if (error instanceof Error) {
        if (error.message.includes('JSON')) {
          mensajeError = 'Hubo un problema con el formato de las respuestas del servidor. Esto puede deberse a sobrecarga del sistema de IA. Intente nuevamente en unos minutos.';
        } else if (error.message.includes('red') || error.message.includes('network')) {
          mensajeError = 'Problema de conexión. Verifique su conexión a internet e intente nuevamente.';
        } else if (error.message.length > 10) {
          // Usar el mensaje de error específico si es informativo
          mensajeError = error.message;
        }
      }
      
      setError(mensajeError);
      setInfoGeneracion({
        tipo: 'error',
        mensaje: mensajeError + ' Puede agregar preguntas manualmente como alternativa.'
      });
      
      // Limpiar el mensaje de error después de 8 segundos
      setTimeout(() => {
        setInfoGeneracion({ tipo: '', mensaje: '' });
      }, 8000);
      
    } finally {
      setGenerandoPreguntas(false);
    }
  };

  const handleAgregarPregunta = () => {
    const nuevaPregunta: Pregunta = {
      id: `p${Date.now()}`,
      enunciado: '',
      alternativas: [
        { id: 'A', texto: '', esCorrecta: true, explicacion: '' },
        { id: 'B', texto: '', esCorrecta: false },
        { id: 'C', texto: '', esCorrecta: false },
        { id: 'D', texto: '', esCorrecta: false }
      ],
      estandarAprendizaje: nuevaEvaluacion.asignatura === 'Lectura'
        ? estandaresLectura[0]
        : estandaresMatematica[0]
    };
    
    setPreguntaEnEdicion(nuevaPregunta);
  };

  const handleEditarPregunta = (pregunta: Pregunta) => {
    setPreguntaEnEdicion({ ...pregunta });
  };

  const handleGuardarPregunta = () => {
    if (!preguntaEnEdicion) return;
    
    if (!preguntaEnEdicion.enunciado) {
      setError('El enunciado de la pregunta es obligatorio');
      return;
    }
    
    const alternativaCorrecta = preguntaEnEdicion.alternativas.find(alt => alt.esCorrecta);
    if (!alternativaCorrecta) {
      setError('Debe marcar una alternativa como correcta');
      return;
    }
    
    const alternativasSinTexto = preguntaEnEdicion.alternativas.filter(alt => !alt.texto);
    if (alternativasSinTexto.length > 0) {
      setError('Todas las alternativas deben tener texto');
      return;
    }
    
    // Verificar si esta pregunta tiene textoBase y es para Lectura
    const contieneTextoBase = preguntaEnEdicion.textoBase && nuevaEvaluacion.asignatura === 'Lectura';
    
    if (preguntaEnEdicion.id.startsWith('p')) {
      // Es una pregunta nueva
      if (contieneTextoBase) {
        console.log("Nueva pregunta con texto base detectado:", preguntaEnEdicion.textoBase);
        // Si es una nueva pregunta con texto base, asegurarnos de que sea la primera
        const preguntasActualizadas = [...(nuevaEvaluacion.preguntas || [])];
        setNuevaEvaluacion(prev => ({
          ...prev,
          preguntas: [preguntaEnEdicion, ...preguntasActualizadas]
        }));
      } else {
        // Pregunta normal sin texto base
        setNuevaEvaluacion(prev => ({
          ...prev,
          preguntas: [...(prev.preguntas || []), preguntaEnEdicion]
        }));
      }
    } else {
      // Actualizar pregunta existente
      if (contieneTextoBase) {
        console.log("Actualizando pregunta con texto base:", preguntaEnEdicion.textoBase);
        // Si se actualizó el texto base, actualizar la pregunta y propagarlo
        const preguntasActualizadas = nuevaEvaluacion.preguntas?.map(p => 
          p.id === preguntaEnEdicion.id ? preguntaEnEdicion : p
        ) || [];
        
        // Si es la primera pregunta con texto base, propagarlo a las demás
        if (preguntaEnEdicion === nuevaEvaluacion.preguntas?.[0]) {
          const textoBase = preguntaEnEdicion.textoBase || '';
          const preguntasPropagadas = propagarTextoBase(preguntasActualizadas, textoBase);
          setNuevaEvaluacion(prev => ({
            ...prev,
            preguntas: preguntasPropagadas
          }));
        } else {
          setNuevaEvaluacion(prev => ({
            ...prev,
            preguntas: preguntasActualizadas
          }));
        }
      } else {
        // Actualización normal sin cambios en texto base
        setNuevaEvaluacion(prev => ({
          ...prev,
          preguntas: prev.preguntas?.map(p => 
            p.id === preguntaEnEdicion.id ? preguntaEnEdicion : p
          ) || []
        }));
      }
    }
    
    setPreguntaEnEdicion(null);
    setError(null);
  };

  const handleEliminarPregunta = (id: string) => {
    setNuevaEvaluacion(prev => ({
      ...prev,
      preguntas: prev.preguntas?.filter(p => p.id !== id) || []
    }));
  };

  const handleCambiarAlternativaCorrecta = (preguntaId: string, alternativaId: string) => {
    setNuevaEvaluacion(prev => ({
      ...prev,
      preguntas: prev.preguntas?.map(p => {
        if (p.id === preguntaId) {
          return {
            ...p,
            alternativas: p.alternativas.map(alt => ({
              ...alt,
              esCorrecta: alt.id === alternativaId
            }))
          };
        }
        return p;
      }) || []
    }));
  };

  const handleToggleCurso = (cursoId: string) => {
    // Siempre normalizar el ID antes de agregar o quitar
    const normalizedId = normalizeCurso(cursoId);
    setNuevaEvaluacion(prev => {
      const cursosAsignados = (prev.cursosAsignados || []).map(normalizeCurso);
      if (cursosAsignados.includes(normalizedId)) {
        return {
          ...prev,
          cursosAsignados: cursosAsignados.filter(id => id !== normalizedId)
        };
      } else {
        return {
          ...prev,
          cursosAsignados: [...cursosAsignados, normalizedId]
        };
      }
    });
  };

  // Renderizar modo lista de evaluaciones
  const renderListaEvaluaciones = () => {
    const setsFiltrados = filtrarSetsPreguntas();
    
    if (cargando) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Cargando evaluaciones...</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar evaluaciones..."
                className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
              />
            </div>
            
            <select
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={filtroAsignatura}
              onChange={(e) => setFiltroAsignatura(e.target.value as 'todas' | AsignaturaSimce)}
            >
              <option value="todas">Todas las asignaturas</option>
              <option value="Lectura">Lectura</option>
              <option value="Matemática">Matemática</option>
            </select>
          </div>
          
          <button
            onClick={handleCrearEvaluacion}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
          >
            <Plus className="w-4 h-4" />
            Nueva evaluación
          </button>
        </div>
        
        <div className="space-y-4">
          {setsFiltrados.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">
                {filtroBusqueda || filtroAsignatura !== 'todas' 
                  ? 'No se encontraron evaluaciones con los filtros seleccionados' 
                  : 'No hay evaluaciones creadas aún. Crea tu primera evaluación SIMCE.'}
              </p>
              
              {(filtroBusqueda || filtroAsignatura !== 'todas') && (
                <button
                  onClick={() => {
                    setFiltroBusqueda('');
                    setFiltroAsignatura('todas');
                  }}
                  className="mt-4 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:dark:text-indigo-300 text-sm font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            setsFiltrados.map(set => (
              <div
                key={set.id}
                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4 flex items-start justify-between">
                  <div className="flex items-start">
                    <div className={`p-2 rounded-md mr-3 ${
                      set.asignatura === 'Lectura' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' 
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                    }`}>
                      {set.asignatura === 'Lectura' ? (
                        <BookOpen className="w-5 h-5" />
                      ) : (
                        <Calculator className="w-5 h-5" />
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">
                        {set.titulo}
                      </h3>
                      
                      {set.descripcion && (
                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                          {set.descripcion}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-xs">
                          {set.preguntas.length} preguntas
                        </span>
                        
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-xs">
                          {set.asignatura}
                        </span>
                        
                        {set.cursosAsignados && set.cursosAsignados.length > 0 && (
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-xs flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {set.cursosAsignados.length} {set.cursosAsignados.length === 1 ? 'curso' : 'cursos'}
                          </span>
                        )}
                        
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-xs">
                          {new Date(set.fechaCreacion).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSetSeleccionado(set)}
                      className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 hover:dark:text-slate-200 rounded-full hover:bg-slate-100 hover:dark:bg-slate-700"
                      title="Ver detalles"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleEditarSet(set)}
                      className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 hover:dark:text-slate-200 rounded-full hover:bg-slate-100 hover:dark:bg-slate-700"
                      title="Editar evaluación"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleEliminarSet(set)}
                      className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 hover:dark:text-red-300 rounded-full hover:bg-red-50 hover:dark:bg-red-900/20"
                      title="Eliminar evaluación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {setSeleccionado?.id === set.id && (
                  <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                    
                    {/* NUEVO: Mostrar texto de lectura de forma prominente */}
                    {set.asignatura === 'Lectura' && (() => {
                      const textoBase = encontrarTextoBase(set.preguntas);
                      if (textoBase) {
                        return (
                          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700 shadow-sm">
                            <div className="flex items-center mb-3">
                              <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg mr-3">
                                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                              </div>
                              <div>
                                <h4 className="font-bold text-blue-800 dark:text-blue-200 text-lg">
                                  📖 Texto de Comprensión Lectora
                                </h4>
                                <p className="text-blue-600 dark:text-blue-400 text-sm">
                                  Lee atentamente el siguiente texto antes de responder las preguntas
                                </p>
                              </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-md border border-blue-100 dark:border-blue-800">
                              <UltraSafeRenderer content={textoBase} context="simce-texto-base" />
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    <h4 className="font-medium mb-3 flex items-center">
                      <span className="mr-2">❓</span>
                      Preguntas ({set.preguntas.length})
                    </h4>
                    
                    <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                      {set.preguntas.map((pregunta, index) => (
                        <div 
                          key={pregunta.id} 
                          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:shadow-md transition-shadow"
                        >
                          <p className="font-medium">
                            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 py-1 px-2 rounded-md text-sm mr-2 font-semibold">
                              {index + 1}
                            </span>
                            {pregunta.enunciado}
                          </p>
                          
                          <div className="mt-3 ml-6 space-y-2">
                            {pregunta.alternativas.map(alt => (
                              <div 
                                key={alt.id}
                                className={`flex items-start p-2 rounded-md transition-colors ${
                                  alt.esCorrecta 
                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-medium border border-green-200 dark:border-green-800' 
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                              >
                                <span className="font-semibold mr-2 min-w-[20px]">{alt.id})</span>
                                <span className="flex-1">{alt.texto}</span>
                                {alt.esCorrecta && (
                                  <CheckCircle2 className="ml-2 w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                                )}
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                            <div><span className="font-semibold">📚 Estándar:</span> {pregunta.estandarAprendizaje}</div>
                            {pregunta.habilidad && (
                              <div><span className="font-semibold">🎯 Habilidad:</span> {pregunta.habilidad}</div>
                            )}
                            {pregunta.alternativas.find(alt => alt.esCorrecta)?.explicacion && (
                              <div className="mt-2 bg-green-50 dark:bg-green-900/20 p-2 rounded-md border border-green-100 dark:border-green-800">
                                <span className="font-semibold text-green-800 dark:text-green-300">💡 Explicación:</span>
                                <span className="text-green-700 dark:text-green-300 ml-1">
                                  {pregunta.alternativas.find(alt => alt.esCorrecta)?.explicacion}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setSetSeleccionado(null)}
                        className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 hover:dark:text-slate-200 px-3 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        ✕ Cerrar vista detallada
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };
  
  // Renderizar modo edición de evaluación
  const renderEditorEvaluacion = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {setSeleccionado ? 'Editar evaluación' : 'Nueva evaluación'}
          </h3>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                setModoEdicion(false);
                setModoVisualizacion('lista');
                setError(null);
              }}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md text-sm"
            >
              Cancelar
            </button>
            
            <button
              onClick={handleGuardarEvaluacion}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm flex items-center gap-1.5"
              disabled={cargando}
            >
              <Save className="w-4 h-4" />
              {(nuevaEvaluacion.cursosAsignados || []).length > 0 ? 'Guardar y asignar' : 'Guardar evaluación'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 p-3 rounded-md flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Título de la evaluación *
              </label>
              <input
                type="text"
                value={nuevaEvaluacion.titulo}
                onChange={(e) => setNuevaEvaluacion({ ...nuevaEvaluacion, titulo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                placeholder="Ej: Evaluación SIMCE 4° Básico - Lectura"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Descripción (opcional)
              </label>
              <textarea
                value={nuevaEvaluacion.descripcion}
                onChange={(e) => setNuevaEvaluacion({ ...nuevaEvaluacion, descripcion: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 resize-none"
                placeholder="Breve descripción de la evaluación"
                rows={3}
              />
            </div>
          </div>
          
          <div className="mt-6 border-t dark:border-slate-700 pt-6">
            <label className="flex items-center mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Users className="w-4 h-4 mr-1.5" />
              Asignar a cursos
              {(nuevaEvaluacion.cursosAsignados || []).length > 0 && (
                <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 py-0.5 px-1.5 rounded-full">
                  {(nuevaEvaluacion.cursosAsignados || []).length} seleccionado{(nuevaEvaluacion.cursosAsignados || []).length !== 1 ? 's' : ''}
                </span>
              )}
            </label>
            
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Seleccione los cursos a los que estará asignada esta evaluación. Estará disponible para los estudiantes en cuanto guarde.
            </p>
            
            <div className="relative">
              {/* El input y dropdown usan el nombre formateado solo para mostrar, pero el valor seleccionado es el id real */}
              <input
                type="text"
                value={searchCurso}
                onChange={(e) => {
                  setSearchCurso(e.target.value);
                  setShowCursoDropdown(true);
                }}
                onFocus={() => setShowCursoDropdown(true)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                placeholder="Buscar curso..."
              />
              
              {showCursoDropdown && (cursosFiltrados.length > 0 || searchCurso) && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-md max-h-60 overflow-y-auto">
                  {cursosFiltrados.length === 0 && searchCurso ? (
                    <div className="p-3 text-center text-slate-500 dark:text-slate-400">
                      No se encontraron cursos
                    </div>
                  ) : (
                    cursosFiltrados.map(curso => (
                      <div
                        key={curso.id}
                        className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center"
                        onClick={() => {
                          handleToggleCurso(curso.id);
                          setSearchCurso('');
                        }}
                      >
                        <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${
                          (nuevaEvaluacion.cursosAsignados || []).includes(curso.id)
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-slate-400 dark:border-slate-500'
                        }`}>
                          {(nuevaEvaluacion.cursosAsignados || []).includes(curso.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span>{curso.nombre}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {(nuevaEvaluacion.cursosAsignados || []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(nuevaEvaluacion.cursosAsignados || []).map(cursoId => {
                  const curso = cursos.find(c => c.id === cursoId);
                  return (
                    <div
                      key={cursoId}
                      className="flex items-center bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md text-sm"
                    >
                      <span>{curso?.nombre || cursoId}</span>
                      <button
                        onClick={() => handleToggleCurso(cursoId)}
                        className="ml-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:dark:text-slate-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Configuración de presentación
              </label>
            </div>
            
            <div className="flex space-x-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={nuevaEvaluacion.barajarAlternativas}
                  onChange={(e) => setNuevaEvaluacion({ ...nuevaEvaluacion, barajarAlternativas: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Barajar alternativas
                </span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Opciones de generación con IA */}
        <div className="mb-5 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-md font-semibold mb-3">Opciones de generación con IA</h3>
          
          {/* Mensaje de información/error de generación */}
          {infoGeneracion.mensaje && (
            <div className={`mb-4 p-3 rounded-md flex items-center gap-2 ${
              infoGeneracion.tipo === 'error' 
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                : infoGeneracion.tipo === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            }`}>
              {infoGeneracion.tipo === 'error' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
              {infoGeneracion.tipo === 'warning' && <RefreshCw className="w-5 h-5 flex-shrink-0 animate-spin" />}
              {infoGeneracion.tipo === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
              <span>{infoGeneracion.mensaje}</span>
            </div>
          )}

          {/* Texto proporcionado por el usuario */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Texto base (opcional)
            </label>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Si proporciona un texto, las preguntas se generarán basadas en él. Si lo deja vacío, la IA generará automáticamente un texto adecuado.
            </div>
            <textarea
              className="w-full rounded-md border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm focus:border-indigo-500 focus:ring-indigo-500 resize-y"
              value={opcionesGeneracion.textoProporcionado || ''}
              onChange={(e) => setOpcionesGeneracion({...opcionesGeneracion, textoProporcionado: e.target.value})}
              placeholder={nuevaEvaluacion.asignatura === 'Lectura' 
                ? "Ingrese aquí un texto para generar preguntas de comprensión lectora..." 
                : "Ingrese aquí un texto para crear problemas matemáticos relacionados..."}
              rows={6}
            ></textarea>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Nivel */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nivel
              </label>
              <select
                className="w-full rounded-md border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={opcionesGeneracion.nivel}
                onChange={(e) => setOpcionesGeneracion({...opcionesGeneracion, nivel: e.target.value})}
              >
                <option value="1M">1º Medio</option>
                <option value="2M">2º Medio</option>
              </select>
            </div>

            {/* Cantidad de preguntas */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cantidad de preguntas
              </label>
              <select
                className="w-full rounded-md border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={opcionesGeneracion.cantidadPreguntas}
                onChange={(e) => setOpcionesGeneracion({...opcionesGeneracion, cantidadPreguntas: e.target.value})}
              >
                <option value="2">2 preguntas</option>
                <option value="4">4 preguntas</option>
                <option value="6">6 preguntas</option>
              </select>
            </div>

            {/* Dificultad */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Dificultad
              </label>
              <select
                className="w-full rounded-md border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={opcionesGeneracion.dificultad}
                onChange={(e) => setOpcionesGeneracion({...opcionesGeneracion, dificultad: e.target.value as 'baja' | 'media' | 'alta'})}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>

          {/* Habilidades específicas según asignatura */}
          {nuevaEvaluacion.asignatura === 'Lectura' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Habilidades de Lectura
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(opcionesGeneracion.habilidadesLectura).map(([habilidad, seleccionada]) => (
                  <label key={habilidad} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={seleccionada}
                      onChange={() => {
                        setOpcionesGeneracion({
                          ...opcionesGeneracion,
                          habilidadesLectura: {
                            ...opcionesGeneracion.habilidadesLectura,
                            [habilidad]: !seleccionada
                          }
                        });
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                    />
                    <span className="text-sm">{habilidad}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {nuevaEvaluacion.asignatura === 'Matemática' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Ejes de Matemática
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(opcionesGeneracion.ejesMatematica).map(([eje, seleccionado]) => (
                  <label key={eje} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={seleccionado}
                      onChange={() => {
                        setOpcionesGeneracion({
                          ...opcionesGeneracion,
                          ejesMatematica: {
                            ...opcionesGeneracion.ejesMatematica,
                            [eje]: !seleccionado
                          }
                        });
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                    />
                    <span className="text-sm">{eje}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Botón de generación */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleGenerarPreguntas}
              disabled={generandoPreguntas}
              className={`px-4 py-2 text-white rounded-md text-sm flex items-center gap-2 ${
                generandoPreguntas 
                  ? 'bg-amber-500 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {generandoPreguntas ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generando preguntas...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Generar preguntas automáticamente
                </>
              )}
            </button>
          </div>
          
          {preguntaEnEdicion ? (
            // Editor de pregunta
            <div className="bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 rounded-lg">
              {/* Campo de texto base (solo visible para la primera pregunta de Lectura) */}
              {nuevaEvaluacion.asignatura === 'Lectura' && 
               nuevaEvaluacion.preguntas[0]?.id === preguntaEnEdicion.id && (
                <div className="mb-4">
                  <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Texto base para preguntas de comprensión
                  </label>
                  <textarea
                    value={preguntaEnEdicion.textoBase || ''}
                    onChange={(e) => setPreguntaEnEdicion({...preguntaEnEdicion, textoBase: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 resize-none"
                    placeholder="Texto de lectura para las preguntas..."
                    rows={5}
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Enunciado de la pregunta *
                </label>
                <textarea
                  value={preguntaEnEdicion.enunciado}
                  onChange={(e) => setPreguntaEnEdicion({...preguntaEnEdicion, enunciado: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 resize-none"
                  placeholder="Escribe el enunciado de la pregunta..."
                  rows={3}
                />
              </div>
              
              <div className="mb-4">
                <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Estándar de aprendizaje *
                </label>
                <select
                  value={preguntaEnEdicion.estandarAprendizaje}
                  onChange={(e) => setPreguntaEnEdicion({...preguntaEnEdicion, estandarAprendizaje: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                >
                  {nuevaEvaluacion.asignatura === 'Lectura'
                    ? estandaresLectura.map((estandar, index) => (
                        <option key={index} value={estandar}>{estandar}</option>
                      ))
                    : estandaresMatematica.map((estandar, index) => (
                        <option key={index} value={estandar}>{estandar}</option>
                      ))
                  }
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Habilidad (opcional)
                </label>
                <input
                  value={preguntaEnEdicion.habilidad || ''}
                  onChange={(e) => setPreguntaEnEdicion({...preguntaEnEdicion, habilidad: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                  placeholder="Ej: Interpretar, Analizar, Resolver problemas..."
                />
              </div>
              
              <div className="mb-6">
                <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Alternativas * (marca una como correcta)
                </label>
                
                <div className="space-y-3">
                  {preguntaEnEdicion.alternativas.map((alt, index) => (
                    <div key={alt.id} className="flex items-start">
                      <div className="flex items-center mt-1 mr-2">
                        <input
                          type="radio"
                          checked={alt.esCorrecta}
                          onChange={() => {
                            setPreguntaEnEdicion({
                              ...preguntaEnEdicion,
                              alternativas: preguntaEnEdicion.alternativas.map(a => ({
                                ...a,
                                esCorrecta: a.id === alt.id
                              }))
                            });
                          }}
                          className="rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-1 font-semibold">{alt.id})</span>
                      </div>
                      
                      <div className="flex-1">
                        <textarea
                          value={alt.texto}
                          onChange={(e) => {
                            setPreguntaEnEdicion({
                              ...preguntaEnEdicion,
                              alternativas: preguntaEnEdicion.alternativas.map(a => 
                                a.id === alt.id ? {...a, texto: e.target.value} : a
                              )
                            });
                          }}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 resize-none"
                          placeholder={`Texto de la alternativa ${alt.id}...`}
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Explicación para alternativa correcta (recomendado)
                </label>
                <textarea
                  value={
                    preguntaEnEdicion.alternativas.find(alt => alt.esCorrecta)?.explicacion || ''
                  }
                  onChange={(e) => {
                    setPreguntaEnEdicion({
                      ...preguntaEnEdicion,
                      alternativas: preguntaEnEdicion.alternativas.map(a => 
                        a.esCorrecta ? {...a, explicacion: e.target.value} : a
                      )
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 resize-none"
                  placeholder="Explica por qué esta es la respuesta correcta..."
                  rows={2}
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setPreguntaEnEdicion(null);
                    setError(null);
                  }}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md text-sm"
                >
                  Cancelar
                </button>
                
                <button
                  onClick={handleGuardarPregunta}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Guardar pregunta
                </button>
              </div>
            </div>
          ) : (
            // Lista de preguntas
            <div className="space-y-4">
              {(nuevaEvaluacion.preguntas || []).length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                  <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400">
                    No hay preguntas agregadas aún. 
                    Puedes generar preguntas automáticamente o agregarlas manualmente.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mostrar texto base global antes de las preguntas */}
                  {nuevaEvaluacion.asignatura === 'Lectura' && nuevaEvaluacion.preguntas?.[0]?.textoBase && (
                    <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700 shadow-sm mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg mr-3">
                            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                          </div>
                          <div>
                            <h4 className="font-bold text-blue-800 dark:text-blue-200 text-lg">
                              Texto Base de Comprensión Lectora
                            </h4>
                            <p className="text-blue-600 dark:text-blue-400 text-sm">
                              Este texto acompañará a todas las preguntas de lectura
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            // Editar la primera pregunta para modificar el texto base
                            const primeraPregunta = nuevaEvaluacion.preguntas?.[0];
                            if (primeraPregunta) {
                              handleEditarPregunta(primeraPregunta);
                            }
                          }}
                          className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:dark:text-blue-200 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800/50"
                          title="Editar texto base"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-4 rounded-md border border-blue-100 dark:border-blue-800 shadow-inner">
                        <div className="prose prose-sm max-w-none text-slate-800 dark:text-slate-200">
                          <p className="whitespace-pre-wrap leading-relaxed text-base">
                            {nuevaEvaluacion.preguntas[0].textoBase}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {(nuevaEvaluacion.preguntas || []).map((pregunta, index) => (
                    <div 
                      key={pregunta.id} 
                      className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">
                            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 py-1 px-2.5 rounded-md mr-2 text-sm font-semibold">
                              Pregunta {index + 1}
                            </span>
                            {pregunta.enunciado}
                          </p>
                          
                          <div className="mt-3 ml-6 space-y-2">
                            {pregunta.alternativas.map(alt => (
                              <div 
                                key={alt.id}
                                className={`flex items-start p-2 rounded-md transition-colors ${
                                  alt.esCorrecta 
                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-medium border border-green-200 dark:border-green-800' 
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                              >
                                <span className="font-semibold mr-2 min-w-[20px]">{alt.id})</span>
                                <span className="flex-1">{alt.texto}</span>
                                {alt.esCorrecta && <CheckCircle2 className="ml-2 w-4 h-4 text-green-600 dark:text-green-400" />}
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                            <div><span className="font-semibold">Estándar:</span> {pregunta.estandarAprendizaje}</div>
                            {pregunta.habilidad && <div><span className="font-semibold">Habilidad:</span> {pregunta.habilidad}</div>}
                            {pregunta.alternativas.find(alt => alt.esCorrecta)?.explicacion && (
                              <div className="mt-2 bg-green-50 dark:bg-green-900/20 p-2 rounded-md border border-green-100 dark:border-green-800">
                                <span className="font-semibold text-green-800 dark:text-green-300">Explicación:</span>
                                <span className="text-green-700 dark:text-green-300 ml-1">
                                  {pregunta.alternativas.find(alt => alt.esCorrecta)?.explicacion}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-1 ml-3">
                          <button
                            onClick={() => handleEditarPregunta(pregunta)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 hover:dark:text-slate-200 rounded hover:bg-slate-100 hover:dark:bg-slate-700"
                            title="Editar pregunta"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleEliminarPregunta(pregunta.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 hover:dark:text-red-300 rounded hover:bg-red-50 hover:dark:bg-red-900/20"
                            title="Eliminar pregunta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {modoVisualizacion === 'lista' && !modoEdicion && renderListaEvaluaciones()}
      {(modoVisualizacion === 'detalle' || modoEdicion) && renderEditorEvaluacion()}
    </>
  );
};
