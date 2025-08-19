import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Upload, 
  Download, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Filter,
  BarChart3,
  Plus,
  Trash2,
  FileText,
  Eye,
  AlertCircle,
  UserPlus
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Imports desde constants.tsx (fuente única de verdad)
import {
  CURSOS,
  ASIGNATURAS,
  LECTIVAS_PCT,
  NO_LECTIVAS_PCT
} from "../../constants";

import { 
  subscribeToDocentes,
  subscribeToAsignacionesCarga,
  addAsignacionCarga,
  updateAsignacionCarga,
  deleteAsignacionCarga,
  saveAsignacionesBatch,
  calcularHA,
  calcularHB,
  sumarHorasCursos,
  calcularTotalesDocente,
  validarDocente,
  normalizarHeaderCurso,
  crearNuevoDocente
} from '../../src/firebaseHelpers/cargaHorariaHelper';

// Importación de tipos desde types.ts
import { AsignacionCargaHoraria, FuncionLectiva as FuncionLectivaType } from '../../types';

// --- TIPOS Y UTILIDADES ---

type CursoId = typeof CURSOS[number];

interface Docente {
  id: string;
  nombre: string;
  departamento?: string;
  horasContrato: number;
  perfil: "PROFESORADO";
  email?: string;
}

interface FuncionLectiva {
  id: string;
  nombre: string;
  horas: number;
}

interface Asignacion {
  id: string;
  docenteId: string;
  docenteNombre: string;
  asignaturaOModulo?: string;
  otraFuncion?: string; // Mantener por compatibilidad
  funcionesLectivas?: FuncionLectiva[];
  funcionesNoLectivas?: FuncionLectiva[]; // Para compatibilidad
  horasPorCurso: Partial<Record<CursoId, number>>;
  horasXAsig?: number;
}

interface TotalesDocente {
  HA: number;
  HB: number;
  sumCursos: number;
  sumFunciones: number;
  restantesHA: number;
  restantesHB: number;
  valido: boolean;
  warnings: string[];
  errors: string[];
}

interface ValidationResult {
  asignacionId: string;
  docenteId: string;
  tipo: 'error' | 'warning';
  mensaje: string;
}

// Utilizamos las utilidades del helper

// --- COMPONENTE PRINCIPAL ---

const CrearHorarios: React.FC = () => {
  // Estados principales
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [filtros, setFiltros] = useState({
    busqueda: '',
    curso: '',
    asignatura: '',
    departamento: ''
  });
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [validaciones, setValidaciones] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Estado para modal de nuevo docente
  const [showAddDocenteModal, setShowAddDocenteModal] = useState(false);
  const [nuevoDocente, setNuevoDocente] = useState<{
    nombre: string;
    email: string;
    departamento: string;
    horasContrato: number;
    perfil: "PROFESORADO" | "SUBDIRECCION" | "COORDINACION_TP";
  }>({
    nombre: '',
    email: '',
    departamento: 'General',
    horasContrato: 44,
    perfil: 'PROFESORADO'
  });
  const [docenteSearch, setDocenteSearch] = useState('');

  // Suscripción a docentes con perfil PROFESORADO
  useEffect(() => {
    const unsubscribe = subscribeToDocentes((docentesData) => {
      setDocentes(docentesData);
    });

    return unsubscribe;
  }, []);
  
  // Suscripción a asignaciones de carga horaria
  useEffect(() => {
    const unsubscribe = subscribeToAsignacionesCarga((asignacionesData) => {
      // Convertir las asignaciones de Firestore al formato local
      const asignacionesConvertidas = asignacionesData.map(asig => {
        // Convertir las funcionesNoLectivas (campo antiguo) a funcionesLectivas si es necesario
        let funcionesLectivas = asig.funcionesLectivas || [];
        
        if (!funcionesLectivas.length && asig.funcionesNoLectivas && asig.funcionesNoLectivas.length) {
          funcionesLectivas = asig.funcionesNoLectivas;
        } else if (!funcionesLectivas.length && asig.otraFuncion) {
          funcionesLectivas = [{
            id: `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nombre: asig.otraFuncion,
            horas: parseInt(asig.otraFuncion) || 0
          }];
        }
        
        return {
          ...asig,
          funcionesLectivas
        };
      });
      
      setAsignaciones(asignacionesConvertidas);
    });

    return unsubscribe;
  }, []);

  // Calcular totales por docente
  const totalesByDocente = useMemo(() => {
    const totales: Record<string, TotalesDocente> = {};
    docentes.forEach(docente => {
      const asignacionesDocente = asignaciones.filter(a => a.docenteId === docente.id);
      totales[docente.id] = calcularTotalesDocente(docente, asignacionesDocente);
    });
    return totales;
  }, [docentes, asignaciones]);

  // Validaciones en tiempo real
  useEffect(() => {
    const nuevasValidaciones: ValidationResult[] = [];
    docentes.forEach(docente => {
      const validacionesDocente = validarDocente(docente, asignaciones);
      nuevasValidaciones.push(...validacionesDocente);
    });
    setValidaciones(nuevasValidaciones);
  }, [docentes, asignaciones]);

  // Filtrar docentes por búsqueda
  const docentesFiltrados = useMemo(() => {
    if (!docenteSearch) return docentes;
    
    return docentes.filter(docente => 
      docente.nombre.toLowerCase().includes(docenteSearch.toLowerCase()) ||
      docente.email?.toLowerCase().includes(docenteSearch.toLowerCase())
    );
  }, [docentes, docenteSearch]);

  // Filtrar asignaciones
  const asignacionesFiltradas = useMemo(() => {
    const filtradas = asignaciones.filter(asignacion => {
      const docente = docentes.find(d => d.id === asignacion.docenteId);
      if (!docente) return false;

      if (filtros.busqueda && !docente.nombre.toLowerCase().includes(filtros.busqueda.toLowerCase())) {
        return false;
      }
      if (filtros.asignatura && asignacion.asignaturaOModulo !== filtros.asignatura) {
        return false;
      }
      if (filtros.departamento && docente.departamento !== filtros.departamento) {
        return false;
      }
      if (filtros.curso) {
        const tieneCurso = Object.keys(asignacion.horasPorCurso).includes(filtros.curso);
        if (!tieneCurso) return false;
      }

      return true;
    });
    
    // Ordenar por docenteId para agrupar visualmente las asignaciones del mismo docente
    return filtradas.sort((a, b) => {
      // Primero ordenar por docenteId
      if (a.docenteId !== b.docenteId) {
        return a.docenteId.localeCompare(b.docenteId);
      }
      // Si son del mismo docente, ordenar por asignatura
      return (a.asignaturaOModulo || '').localeCompare(b.asignaturaOModulo || '');
    });
  }, [asignaciones, docentes, filtros]);

  // Manejar creación de nuevo docente
  const handleCrearDocente = async () => {
    try {
      setLoading(true);
      if (!nuevoDocente.nombre || !nuevoDocente.email) {
        alert('El nombre y email son obligatorios');
        setLoading(false);
        return;
      }
      
      await crearNuevoDocente(nuevoDocente);
      setShowAddDocenteModal(false);
      setNuevoDocente({
        nombre: '',
        email: '',
        departamento: 'General',
        horasContrato: 44,
        perfil: 'PROFESORADO'
      });
      alert('Docente creado exitosamente');
    } catch (error) {
      console.error('Error al crear docente:', error);
      alert('Error al crear docente');
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  // Función para agregar una asignación general (al primer docente por defecto)
  const agregarAsignacion = useCallback(() => {
    if (docentes.length === 0) return;
    
    const nuevaAsignacion: Asignacion = {
      id: `asig_${Date.now()}`,
      docenteId: docentes[0].id,
      docenteNombre: docentes[0].nombre,
      asignaturaOModulo: ASIGNATURAS[0],
      funcionesLectivas: [], // Inicializar con array vacío
      horasPorCurso: {},
      horasXAsig: 0
    };
    
    setAsignaciones(prev => [...prev, nuevaAsignacion]);
  }, [docentes]);
  
  // Función para agregar una asignación a un docente específico
  const agregarAsignaturaMismoDocente = useCallback((docenteId: string, docenteNombre: string) => {
    // Buscar asignaturas que ya tiene el docente
    const asignaturasActuales = asignaciones
      .filter(a => a.docenteId === docenteId)
      .map(a => a.asignaturaOModulo);
    
    // Buscar la primera asignatura que no tenga asignada
    let nuevaAsignatura = ASIGNATURAS[0];
    for (const asignatura of ASIGNATURAS) {
      if (!asignaturasActuales.includes(asignatura)) {
        nuevaAsignatura = asignatura;
        break;
      }
    }
    
    const nuevaAsignacion: Asignacion = {
      id: `asig_${Date.now()}`,
      docenteId,
      docenteNombre,
      asignaturaOModulo: nuevaAsignatura,
      funcionesLectivas: [], // Inicializar con array vacío
      horasPorCurso: {},
      horasXAsig: 0
    };
    
    setAsignaciones(prev => [...prev, nuevaAsignacion]);
  }, [asignaciones]);

  const eliminarAsignacion = useCallback((id: string) => {
    setAsignaciones(prev => prev.filter(a => a.id !== id));
  }, []);

  // Función para agregar una nueva función lectiva a una asignación
  const agregarFuncionLectiva = useCallback((asignacionId: string) => {
    setAsignaciones(prev => prev.map(asig => {
      if (asig.id !== asignacionId) return asig;
      
      const nuevaFuncion: FuncionLectiva = {
        id: `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nombre: '',
        horas: 0
      };
      
      const funcionesActuales = asig.funcionesLectivas || [];
      
      return {
        ...asig,
        funcionesLectivas: [...funcionesActuales, nuevaFuncion]
      };
    }));
  }, []);
  
  // Función para actualizar una función lectiva
  const actualizarFuncionLectiva = useCallback((asignacionId: string, funcionId: string, campo: string, valor: any) => {
    setAsignaciones(prev => prev.map(asig => {
      if (asig.id !== asignacionId) return asig;
      
      const funcionesActualizadas = (asig.funcionesLectivas || []).map(func => {
        if (func.id !== funcionId) return func;
        return { ...func, [campo]: valor };
      });
      
      return {
        ...asig,
        funcionesLectivas: funcionesActualizadas
      };
    }));
  }, []);
  
  // Función para eliminar una función lectiva
  const eliminarFuncionLectiva = useCallback((asignacionId: string, funcionId: string) => {
    setAsignaciones(prev => prev.map(asig => {
      if (asig.id !== asignacionId) return asig;
      
      const funcionesActualizadas = (asig.funcionesLectivas || []).filter(func => func.id !== funcionId);
      
      return {
        ...asig,
        funcionesLectivas: funcionesActualizadas
      };
    }));
  }, []);

  const actualizarAsignacion = useCallback((id: string, campo: string, valor: any) => {
    setAsignaciones(prev => prev.map(asig => {
      if (asig.id !== id) return asig;
      
      const nuevaAsignacion = { ...asig, [campo]: valor };
      
      // Si cambió el docente, actualizar el nombre
      if (campo === 'docenteId') {
        const docente = docentes.find(d => d.id === valor);
        if (docente) {
          nuevaAsignacion.docenteNombre = docente.nombre;
        }
      }
      
      // Recalcular horasXAsig si cambió horasPorCurso
      if (campo === 'horasPorCurso') {
        nuevaAsignacion.horasXAsig = sumarHorasCursos(valor);
      }
      
      return nuevaAsignacion;
    }));
  }, [docentes]);

  const actualizarHorasCurso = useCallback((asignacionId: string, curso: CursoId, horas: number) => {
    setAsignaciones(prev => prev.map(asig => {
      if (asig.id !== asignacionId) return asig;
      
      const nuevasHoras = { ...asig.horasPorCurso };
      if (horas === 0) {
        delete nuevasHoras[curso];
      } else {
        nuevasHoras[curso] = horas;
      }
      
      return {
        ...asig,
        horasPorCurso: nuevasHoras,
        horasXAsig: sumarHorasCursos(nuevasHoras)
      };
    }));
  }, []);

  // Importar Excel
  const importarExcel = useCallback((file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets['Docentes 2025'] || workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Buscar fila de encabezado
        let headerRowIndex = -1;
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row && row.some((cell: any) => 
            typeof cell === 'string' && 
            (cell.includes('Docente') || cell.includes('ASIGNATURA') || CURSOS.some(curso => cell.includes(curso.replace('º', ''))))
          )) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          alert('No se encontró la fila de encabezado en el archivo');
          return;
        }

        const headers = jsonData[headerRowIndex];
        const nuevasAsignaciones: Asignacion[] = [];

        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const docenteNombre = row[headers.indexOf('Docente')] || '';
          if (!docenteNombre) continue;

          // Buscar docente en la lista
          const docente = docentes.find(d => d.nombre.toLowerCase().includes(docenteNombre.toLowerCase()));
          if (!docente) continue;

          const horasPorCurso: Partial<Record<CursoId, number>> = {};
          
          // Mapear columnas de cursos
          headers.forEach((header: string, index: number) => {
            if (typeof header === 'string') {
              const cursoNormalizado = normalizarHeaderCurso(header.trim());
              if (CURSOS.includes(cursoNormalizado as CursoId)) {
                const horas = parseInt(row[index]) || 0;
                if (horas > 0) {
                  horasPorCurso[cursoNormalizado as CursoId] = horas;
                }
              }
            }
          });

          // Procesar el campo de funciones lectivas
          let funcionesLectivas: FuncionLectiva[] = [];
          const funcionesTexto = row[headers.indexOf('FUNCIONES LECTIVAS')] || row[headers.indexOf('FUNCIONES NO LECTIVAS')] || row[headers.indexOf('OTRA FUNCIÓN')] || '';
          
          // Si hay funciones con el formato "nombre: horas" separadas por comas, procesarlas
          if (funcionesTexto.includes(':')) {
            const funcionesArray = funcionesTexto.split(',').map(f => f.trim());
            funcionesLectivas = funcionesArray.map(funcStr => {
              const [nombre, horasStr] = funcStr.split(':').map(p => p.trim());
              const horas = parseInt(horasStr) || 0;
              return {
                id: `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                nombre,
                horas
              };
            });
          }
          // Si es un formato antiguo, mantener la compatibilidad
          else if (funcionesTexto) {
            funcionesLectivas = [{
              id: `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              nombre: funcionesTexto,
              horas: 0
            }];
          }
          
          const asignacion: Asignacion = {
            id: `import_${Date.now()}_${i}`,
            docenteId: docente.id,
            docenteNombre: docente.nombre,
            asignaturaOModulo: row[headers.indexOf('ASIGNATURA O MÓDULO')] || '',
            funcionesLectivas,
            horasPorCurso,
            horasXAsig: sumarHorasCursos(horasPorCurso)
          };

          nuevasAsignaciones.push(asignacion);
        }

        setAsignaciones(nuevasAsignaciones);
        alert(`Se importaron ${nuevasAsignaciones.length} asignaciones exitosamente`);
      } catch (error) {
        console.error('Error al importar:', error);
        alert('Error al procesar el archivo. Verifique el formato.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [docentes]);

  // Exportar Excel
  const exportarExcel = useCallback(() => {
    const datos = asignaciones.map(asig => {
      const docente = docentes.find(d => d.id === asig.docenteId);
      const totales = totalesByDocente[asig.docenteId];
      
      // Determinar la descripción de funciones para Excel
      let funcionesTexto = '';
      
      if (asig.funcionesLectivas && asig.funcionesLectivas.length > 0) {
        funcionesTexto = asig.funcionesLectivas.map(f => `${f.nombre}: ${f.horas}h`).join(', ');
      } else if (asig.funcionesNoLectivas && asig.funcionesNoLectivas.length > 0) {
        // Para compatibilidad con datos anteriores
        funcionesTexto = asig.funcionesNoLectivas.map(f => `${f.nombre}: ${f.horas}h`).join(', ');
      } else if (asig.otraFuncion) {
        funcionesTexto = asig.otraFuncion;
      }
      
      const fila: any = {
        'Docente': asig.docenteNombre,
        'ASIGNATURA O MÓDULO': asig.asignaturaOModulo || '',
        'FUNCIONES LECTIVAS': funcionesTexto,
        'HORAS X ASIG.': asig.horasXAsig || 0
      };

      // Agregar columnas por curso
      CURSOS.forEach(curso => {
        fila[curso] = asig.horasPorCurso[curso] || 0;
      });

      if (totales) {
        fila['HORAS LECTIVAS (HA)'] = totales.HA;
        fila['HORAS NO LECTIVAS (HB)'] = totales.HB;
        fila['HORAS CONTRATO'] = docente?.horasContrato || 0;
      }

      return fila;
    });

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Horarios');
    XLSX.writeFile(wb, `horarios_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [asignaciones, docentes, totalesByDocente]);

  // Guardar
  const guardar = useCallback(async () => {
    const errores = validaciones.filter(v => v.tipo === 'error');
    if (errores.length > 0) {
      alert('No se puede guardar. Hay errores que deben corregirse primero.');
      return;
    }
    
    try {
      setLoading(true);
      
      // Recopilar asignaciones para actualizar
      const asignacionesConId: AsignacionCargaHoraria[] = [];
      // Recopilar asignaciones nuevas para agregar
      const asignacionesNuevas: Omit<AsignacionCargaHoraria, 'id'>[] = [];
      
      // Procesar cada asignación
      asignaciones.forEach(asignacion => {
        // Asegurarse de que todas las asignaciones tengan el campo funcionesLectivas
        // y convertir otraFuncion o funcionesNoLectivas (antiguo) a funcionesLectivas si es necesario
        let funcionesLectivasActualizadas = asignacion.funcionesLectivas || [];
        
        // Si hay funcionesNoLectivas pero no hay funcionesLectivas, migrar al nuevo formato
        if (asignacion.funcionesNoLectivas && asignacion.funcionesNoLectivas.length > 0 && funcionesLectivasActualizadas.length === 0) {
          funcionesLectivasActualizadas = asignacion.funcionesNoLectivas.map(f => ({
            id: `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nombre: f.nombre,
            horas: f.horas
          }));
        }
        // Si hay otraFuncion pero no hay funcionesLectivas, convertir a nuevo formato
        else if (asignacion.otraFuncion && funcionesLectivasActualizadas.length === 0) {
          funcionesLectivasActualizadas = [{
            id: `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nombre: asignacion.otraFuncion,
            horas: parseInt(asignacion.otraFuncion) || 0
          }];
        }
        
        // Eliminamos los campos antiguos para no guardarlos en Firestore
        const { funcionesNoLectivas, otraFuncion, ...restSinCamposAntiguos } = asignacion;
        
        // Preparar asignación actualizada
        const asignacionActualizada = {
          ...restSinCamposAntiguos,
          funcionesLectivas: funcionesLectivasActualizadas
        };
        
        // Si tiene ID que comienza con "asig_" o "import_", es una asignación nueva
        if (asignacion.id.startsWith('asig_') || asignacion.id.startsWith('import_')) {
          const { id, ...sinId } = asignacionActualizada;
          asignacionesNuevas.push(sinId);
        } else {
          asignacionesConId.push(asignacionActualizada);
        }
      });
      
      // Eliminar asignaciones existentes y añadir todas las asignaciones nuevamente
      // Esto asegura que los cambios se reflejen completamente
      if (asignacionesConId.length > 0 || asignacionesNuevas.length > 0) {
        // Convertir asignaciones con ID para guardarlas también
        const asignacionesParaGuardar = [
          ...asignacionesConId.map(({ id, ...rest }) => rest),
          ...asignacionesNuevas
        ];
        
        // Guardar en Firestore reemplazando todo
        await saveAsignacionesBatch(asignacionesParaGuardar, true);
        
        alert('Horarios guardados exitosamente');
      } else {
        alert('No hay cambios para guardar');
      }
    } catch (error) {
      console.error('Error al guardar horarios:', error);
      alert(`Error al guardar los horarios: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  }, [validaciones, asignaciones]);

  // Obtener color de semáforo
  const getSemaforoColor = (docenteId: string) => {
    const totales = totalesByDocente[docenteId];
    if (!totales) return 'gray';
    if (totales.errors.length > 0) return 'red';
    if (totales.warnings.length > 0) return 'yellow';
    return 'green';
  };

  // Modal para agregar docente
  const AddDocenteModal = () => {
    if (!showAddDocenteModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-96 max-w-full">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Añadir Nuevo Docente</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={nuevoDocente.nombre}
                onChange={e => setNuevoDocente({...nuevoDocente, nombre: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                placeholder="Nombre Apellido"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={nuevoDocente.email}
                onChange={e => setNuevoDocente({...nuevoDocente, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                placeholder="correo@ejemplo.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Departamento
              </label>
              <input
                type="text"
                value={nuevoDocente.departamento}
                onChange={e => setNuevoDocente({...nuevoDocente, departamento: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                placeholder="Departamento"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Horas Contrato
              </label>
              <input
                type="number"
                value={nuevoDocente.horasContrato}
                onChange={e => setNuevoDocente({...nuevoDocente, horasContrato: parseInt(e.target.value) || 0})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                min="1"
                max="44"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Perfil
              </label>
              <select
                value={nuevoDocente.perfil}
                onChange={e => setNuevoDocente({...nuevoDocente, perfil: e.target.value as "PROFESORADO" | "SUBDIRECCION" | "COORDINACION_TP"})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="PROFESORADO">Profesorado</option>
                <option value="SUBDIRECCION">Subdirección</option>
                <option value="COORDINACION_TP">Coordinación TP</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setShowAddDocenteModal(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleCrearDocente}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Crear Horarios
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gestión de carga horaria docente con validación 65%/35%
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Buscador de Docentes */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar docente..."
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={docenteSearch}
                onChange={(e) => setDocenteSearch(e.target.value)}
              />
            </div>
            
            {/* Botón para agregar docente */}
            <button
              onClick={() => setShowAddDocenteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <UserPlus className="w-4 h-4" />
              Nuevo Docente
            </button>

            {/* Filtros */}
            <select
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={filtros.curso}
              onChange={(e) => setFiltros(prev => ({ ...prev, curso: e.target.value }))}
            >
              <option value="">Todos los cursos</option>
              {CURSOS.map(curso => (
                <option key={curso} value={curso}>{curso}</option>
              ))}
            </select>

            <select
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={filtros.asignatura}
              onChange={(e) => setFiltros(prev => ({ ...prev, asignatura: e.target.value }))}
            >
              <option value="">Todas las asignaturas</option>
              {ASIGNATURAS.map(asig => (
                <option key={asig} value={asig}>{asig}</option>
              ))}
            </select>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2">
            <button
              onClick={agregarAsignacion}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Agregar docente con asignatura
            </button>

            <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
              <Upload className="w-4 h-4" />
              Importar
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importarExcel(file);
                }}
              />
            </label>

            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>

            <button
              onClick={() => setMostrarResumen(!mostrarResumen)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <BarChart3 className="w-4 h-4" />
              Resumen
            </button>

            <button
              onClick={guardar}
              disabled={validaciones.filter(v => v.tipo === 'error').length > 0 || loading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {/* Panel de validaciones */}
      {validaciones.length > 0 && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Validaciones ({validaciones.length})
          </h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {validaciones.map((validacion, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 p-2 rounded ${
                  validacion.tipo === 'error' 
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' 
                    : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                }`}
              >
                {validacion.tipo === 'error' ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span className="text-sm">{validacion.mensaje}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla principal */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-12 bg-gray-50 dark:bg-gray-700">
                  Docente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Asignatura/Módulo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Funciones Lectivas
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Horas X Asig.
                </th>
                {CURSOS.map(curso => (
                  <th key={curso} className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {curso}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  HA/HB
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {asignacionesFiltradas.map((asignacion, index) => {
                const docente = docentes.find(d => d.id === asignacion.docenteId);
                const totales = totalesByDocente[asignacion.docenteId];
                const semaforoColor = getSemaforoColor(asignacion.docenteId);
                
                // Determinar si es la primera asignación del docente (para mostrar borde superior)
                const esPrimeraAsignacionDocente = index === 0 || 
                  asignacionesFiltradas[index - 1].docenteId !== asignacion.docenteId;
                
                // Determinar si es la última asignación del docente (para mostrar borde inferior)
                const esUltimaAsignacionDocente = index === asignacionesFiltradas.length - 1 || 
                  asignacionesFiltradas[index + 1].docenteId !== asignacion.docenteId;
                
                // Determinar cuántas asignaciones tiene este docente
                const asignacionesDocente = asignacionesFiltradas.filter(a => a.docenteId === asignacion.docenteId);
                const tieneMultiplesAsignaturas = asignacionesDocente.length > 1;
                
                // Determinar estilo de borde y fondo
                let estiloFila = "hover:bg-gray-50 dark:hover:bg-gray-750 ";
                
                if (tieneMultiplesAsignaturas) {
                  if (esPrimeraAsignacionDocente) {
                    estiloFila += "border-t-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 ";
                  } else {
                    estiloFila += "bg-blue-50 dark:bg-blue-900/10 ";
                  }
                  
                  if (esUltimaAsignacionDocente) {
                    estiloFila += "border-b-2 border-blue-200 dark:border-blue-800 mb-1 ";
                  }
                }

                return (
                  <tr key={asignacion.id} className={estiloFila}>
                    {/* Estado (semáforo) */}
                    <td className="px-4 py-4 sticky left-0 bg-white dark:bg-gray-800">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          semaforoColor === 'green' ? 'bg-green-500' :
                          semaforoColor === 'yellow' ? 'bg-yellow-500' :
                          semaforoColor === 'red' ? 'bg-red-500' : 'bg-gray-500'
                        }`} />
                        {tieneMultiplesAsignaturas && esPrimeraAsignacionDocente && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                            {asignacionesDocente.length} asig.
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Docente */}
                    <td className="px-4 py-4 sticky left-12 bg-white dark:bg-gray-800">
                      {/* Si tiene múltiples asignaturas, solo mostrar el selector en la primera fila */}
                      {(!tieneMultiplesAsignaturas || esPrimeraAsignacionDocente) ? (
                        <div>
                          <select
                            value={asignacion.docenteId}
                            onChange={(e) => actualizarAsignacion(asignacion.id, 'docenteId', e.target.value)}
                            className={`w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ${tieneMultiplesAsignaturas ? 'font-medium' : ''}`}
                          >
                            {docentesFiltrados.length > 0 ? docentesFiltrados.map(docente => (
                              <option key={docente.id} value={docente.id}>
                                {docente.nombre} ({docente.perfil})
                              </option>
                            )) : docentes.map(docente => (
                              <option key={docente.id} value={docente.id}>
                                {docente.nombre} ({docente.perfil})
                              </option>
                            ))}
                          </select>
                          {tieneMultiplesAsignaturas && (
                            <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                              {asignacionesDocente.length} asignaturas
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="pl-6 italic text-gray-500 dark:text-gray-400 text-sm">
                          ↳ Misma docente
                        </div>
                      )}
                    </td>

                    {/* Asignatura/Módulo */}
                    <td className="px-4 py-4">
                      <select
                        value={asignacion.asignaturaOModulo || ''}
                        onChange={(e) => actualizarAsignacion(asignacion.id, 'asignaturaOModulo', e.target.value)}
                        className={`w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ${tieneMultiplesAsignaturas ? 'border-blue-300 dark:border-blue-700' : ''}`}
                      >
                        <option value="">Seleccionar...</option>
                        {ASIGNATURAS.map(asig => (
                          <option key={asig} value={asig}>{asig}</option>
                        ))}
                      </select>
                      {tieneMultiplesAsignaturas && !esPrimeraAsignacionDocente && (
                        <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                          Asignatura adicional
                        </div>
                      )}
                    </td>

                    {/* Funciones no lectivas */}
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {/* Lista de funciones existentes */}
                        {(asignacion.funcionesLectivas || []).map((funcion) => (
                          <div key={funcion.id} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={funcion.nombre}
                              onChange={(e) => actualizarFuncionLectiva(asignacion.id, funcion.id, 'nombre', e.target.value)}
                              placeholder="Nombre de función"
                              className="flex-grow px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <input
                              type="number"
                              value={funcion.horas}
                              onChange={(e) => actualizarFuncionLectiva(asignacion.id, funcion.id, 'horas', parseInt(e.target.value) || 0)}
                              min="0"
                              max="44"
                              className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-center"
                            />
                            <button
                              onClick={() => eliminarFuncionLectiva(asignacion.id, funcion.id)}
                              className="text-red-500 hover:text-red-700"
                              title="Eliminar función"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        
                        {/* Para mantener compatibilidad con el campo anterior */}
                        {!asignacion.funcionesLectivas && (
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={asignacion.otraFuncion || ''}
                              onChange={(e) => actualizarAsignacion(asignacion.id, 'otraFuncion', e.target.value)}
                              placeholder="Ej: Coordinador"
                              className="flex-grow px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                          </div>
                        )}
                        
                        {/* Botón para agregar nueva función */}
                        <button 
                          onClick={() => agregarFuncionLectiva(asignacion.id)}
                          className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700"
                        >
                          <Plus className="w-3 h-3" /> Agregar función
                        </button>
                      </div>
                    </td>

                    {/* Horas X Asig. */}
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {asignacion.horasXAsig || 0}
                      </span>
                    </td>

                    {/* Columnas por curso */}
                    {CURSOS.map(curso => (
                      <td key={curso} className="px-3 py-4">
                        <input
                          type="number"
                          min="0"
                          value={asignacion.horasPorCurso[curso] || ''}
                          onChange={(e) => actualizarHorasCurso(asignacion.id, curso, parseInt(e.target.value) || 0)}
                          className="w-16 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-center"
                        />
                      </td>
                    ))}

                    {/* HA/HB */}
                    <td className="px-4 py-4 text-center text-sm">
                      {totales && (
                        <div className="space-y-1">
                          <div className="text-blue-600 dark:text-blue-400">
                            HA: {totales.HA} ({totales.restantesHA >= 0 ? '+' : ''}{totales.restantesHA})
                          </div>
                          <div className="text-green-600 dark:text-green-400">
                            HB: {totales.HB} ({totales.restantesHB >= 0 ? '+' : ''}{totales.restantesHB})
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => agregarAsignaturaMismoDocente(asignacion.docenteId, asignacion.docenteNombre)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Agregar otra asignatura a este docente"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => eliminarAsignacion(asignacion.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Eliminar esta asignación"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel de resumen */}
      {mostrarResumen && (
        <div className="mt-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">Resumen por Docente</h3>
          <div className="grid gap-4">
            {docentes.map(docente => {
              const totales = totalesByDocente[docente.id];
              const asignacionesDocente = asignaciones.filter(a => a.docenteId === docente.id);
              
              return (
                <div key={docente.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">{docente.nombre}</h4>
                    <div className={`w-3 h-3 rounded-full ${
                      getSemaforoColor(docente.id) === 'green' ? 'bg-green-500' :
                      getSemaforoColor(docente.id) === 'yellow' ? 'bg-yellow-500' :
                      getSemaforoColor(docente.id) === 'red' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                  </div>
                  
                  {totales && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-2">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Contrato:</span>
                          <span className="ml-1 font-medium">{docente.horasContrato}h</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">HA:</span>
                          <span className="ml-1 font-medium text-blue-600 dark:text-blue-400">
                            {totales.sumCursos}/{totales.HA}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">HB:</span>
                          <span className="ml-1 font-medium text-green-600 dark:text-green-400">
                            {totales.sumFunciones}/{totales.HB}
                        </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Asignaciones:</span>
                          <span className="ml-1 font-medium">{asignacionesDocente.length}</span>
                        </div>
                      </div>
                      
                      {asignacionesDocente.length > 1 && (
                        <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                          <h5 className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                            Asignaturas asignadas:
                          </h5>
                          <ul className="text-xs text-gray-800 dark:text-gray-200 space-y-1 ml-2">
                            {asignacionesDocente.map(asig => (
                              <li key={asig.id} className="flex justify-between">
                                <span>{asig.asignaturaOModulo || 'Sin asignatura'}</span>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">{asig.horasXAsig || 0}h</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tooltip de ayuda */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Distribución de Horas
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          • <strong>Horas Lectivas (HA):</strong> Según tabla oficial (ej: 44h → {calcularHA(44)}h, 30h → {calcularHA(30)}h)
          <br />
          • <strong>Funciones Lectivas:</strong> Las horas de las funciones se suman a las horas lectivas (HA)
          <br />
          • <strong>Horas No Lectivas (HB):</strong> El resto del contrato (ej: 44h → {calcularHB(44)}h, 30h → {calcularHB(30)}h)
          <br />
          • <strong>Semáforo:</strong> 🟢 Completo | 🟡 Faltan horas | 🔴 Excede límites
        </p>
      </div>

      {/* Modal para añadir nuevo docente */}
      <AddDocenteModal />

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Procesando...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrearHorarios;
