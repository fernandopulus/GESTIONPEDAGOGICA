import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Upload,
  Download,
  Save,
  AlertTriangle,
  XCircle,
  BarChart3,
  Plus,
  Trash2,
  AlertCircle,
  UserPlus,
  X as CloseIcon,
  FilterIcon,
  Clock,
  Check,
  School,
  BookOpen,
  UserCog,
  Briefcase,
  PieChart,
  RefreshCw,
  Calendar,
  FileSpreadsheet,
  Loader2,
  HelpCircle,
  Users,
} from 'lucide-react';

// Estilos para animaciones y scrollbar personalizado
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  @keyframes slideInFromBottom {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
  }

  .animate-scaleIn {
    animation: scaleIn 0.3s ease-out forwards;
  }

  .animate-slideIn {
    animation: slideInFromBottom 0.3s ease-out forwards;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.05);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.15);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0,0,0,0.25);
  }

  .dark .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.05);
  }

  .dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
  }

  .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.25);
  }
`;
import * as XLSX from 'xlsx';

import { CURSOS, ASIGNATURAS, DIAS_SEMANA, HORARIO_BLOQUES } from '../../constants';
import {
  subscribeToDocentes,
  subscribeToAsignacionesCarga,
  saveAsignacionesBatch,
  calcularHA,
  calcularHB,
  sumarHorasCursos,
  calcularTotalesDocente,
  validarDocente,
  normalizarHeaderCurso,
  crearNuevoDocente,
} from '../../src/firebaseHelpers/cargaHorariaHelper';
import { saveHorarios, subscribeToHorarios } from '../../src/firebaseHelpers/horariosHelper';
import { generarHorarioSemanalConIA, ResultadoGeneracionHorario } from '../../src/ai/horarioAI';
import type { 
  HorariosGenerados, 
  CursoId, 
  AsignacionCargaHoraria, 
  DocenteCargaHoraria, 
  ValidationResultCarga, 
  TotalesDocenteCarga, 
  FuncionLectiva 
} from '../../types';

const CrearHorarios: React.FC = () => {
  // Añadir estilos CSS para animaciones y elementos personalizados
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = styles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const [docentes, setDocentes] = useState<DocenteCargaHoraria[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionCargaHoraria[]>([]);
  const [filtros, setFiltros] = useState({ busqueda: '', curso: '', asignatura: '', departamento: '' });
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [vistaResumen, setVistaResumen] = useState<'docentes' | 'cursos' | 'funciones' | 'totales'>('docentes');
  const [validaciones, setValidaciones] = useState<ValidationResultCarga[]>([]);
  const [loading, setLoading] = useState(false);
  // Horarios generados/guardados y vista
  const [horariosActuales, setHorariosActuales] = useState<HorariosGenerados | null>(null);
  const [horariosGenerados, setHorariosGenerados] = useState<HorariosGenerados | null>(null);
  const [conflictosHorario, setConflictosHorario] = useState<string[]>([]);
  const [fuenteHorario, setFuenteHorario] = useState<'IA' | 'fallback' | null>(null);
  const [cursoVista, setCursoVista] = useState<string>(CURSOS[0] || '');

  const [showAddDocenteModal, setShowAddDocenteModal] = useState(false);
  const [nuevoDocente, setNuevoDocente] = useState<{
    nombre: string;
    email: string;
    departamento: string;
    horasContrato: number;
    perfil: 'PROFESORADO' | 'SUBDIRECCION' | 'COORDINACION_TP';
  }>({ nombre: '', email: '', departamento: 'General', horasContrato: 44, perfil: 'PROFESORADO' });
  const [docenteSearch, setDocenteSearch] = useState('');

  useEffect(() => {
    const unsub = subscribeToDocentes((d) => setDocentes(d));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToAsignacionesCarga((data) => {
      const asignacionesConvertidas = data.map((asig) => {
        let funcionesLectivas = asig.funcionesLectivas || [];
        if (!funcionesLectivas.length && asig.funcionesNoLectivas && asig.funcionesNoLectivas.length) {
          funcionesLectivas = asig.funcionesNoLectivas;
        } else if (!funcionesLectivas.length && asig.otraFuncion) {
          funcionesLectivas = [
            { id: `func_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, nombre: asig.otraFuncion, horas: parseInt(asig.otraFuncion) || 0 },
          ];
        }
        const { funcionesNoLectivas, otraFuncion, ...rest } = asig as any;
        return { ...rest, funcionesLectivas } as AsignacionCargaHoraria;
      });
      setAsignaciones(asignacionesConvertidas);
    });
    return unsub;
  }, []);

  // Cargar horarios actuales guardados en Firestore
  useEffect(() => {
    const unsub = subscribeToHorarios((data) => {
      setHorariosActuales(data && Object.keys(data).length > 0 ? data : null);
    });
    return unsub;
  }, []);

  const totalesByDocente = useMemo(() => {
    const totales: Record<string, TotalesDocenteCarga> = {};
    docentes.forEach((doc) => {
      const asignacionesDocente = asignaciones.filter((a) => a.docenteId === doc.id);
      totales[doc.id] = calcularTotalesDocente(doc, asignacionesDocente);
    });
    return totales;
  }, [docentes, asignaciones]);

  useEffect(() => {
    const nuevas: ValidationResultCarga[] = [];
    docentes.forEach((doc) => nuevas.push(...validarDocente(doc, asignaciones)));
    setValidaciones(nuevas);
  }, [docentes, asignaciones]);

  const docentesFiltrados = useMemo(() => {
    if (!docenteSearch) return docentes;
    return docentes.filter((d) => d.nombre.toLowerCase().includes(docenteSearch.toLowerCase()) || d.email?.toLowerCase().includes(docenteSearch.toLowerCase()));
  }, [docentes, docenteSearch]);

  const asignacionesFiltradas = useMemo(() => {
    const filtradas = asignaciones.filter((a) => {
      const d = docentes.find((dd) => dd.id === a.docenteId);
      if (!d) return false;
      if (filtros.busqueda && !d.nombre.toLowerCase().includes(filtros.busqueda.toLowerCase())) return false;
      if (filtros.asignatura && a.asignaturaOModulo !== filtros.asignatura) return false;
      if (filtros.departamento && d.departamento !== filtros.departamento) return false;
      if (filtros.curso) {
        const tieneCurso = Object.keys(a.horasPorCurso).includes(filtros.curso);
        if (!tieneCurso) return false;
      }
      return true;
    });
    return filtradas.sort((a, b) => (a.docenteId !== b.docenteId ? a.docenteId.localeCompare(b.docenteId) : (a.asignaturaOModulo || '').localeCompare(b.asignaturaOModulo || '')));
  }, [asignaciones, docentes, filtros]);

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
      setNuevoDocente({ nombre: '', email: '', departamento: 'General', horasContrato: 44, perfil: 'PROFESORADO' });
      alert('Docente creado exitosamente');
    } catch (e) {
      console.error(e);
      alert('Error al crear docente');
    } finally {
      setLoading(false);
    }
  };

  const agregarAsignacion = useCallback(() => {
    if (docentes.length === 0) return;
    const n: AsignacionCargaHoraria = {
      id: `asig_${Date.now()}`,
      docenteId: docentes[0].id,
      docenteNombre: docentes[0].nombre,
      asignaturaOModulo: ASIGNATURAS[0],
      funcionesLectivas: [],
      horasPorCurso: {},
      horasXAsig: 0,
    };
    setAsignaciones((p) => [...p, n]);
  }, [docentes]);

  const agregarAsignaturaMismoDocente = useCallback(
    (docenteId: string, docenteNombre: string) => {
      const actuales = asignaciones.filter((a) => a.docenteId === docenteId).map((a) => a.asignaturaOModulo);
      let nueva = ASIGNATURAS[0];
      for (const a of ASIGNATURAS) {
        if (!actuales.includes(a)) {
          nueva = a;
          break;
        }
      }
      const n: AsignacionCargaHoraria = { id: `asig_${Date.now()}`, docenteId, docenteNombre, asignaturaOModulo: nueva, funcionesLectivas: [], horasPorCurso: {}, horasXAsig: 0 };
      setAsignaciones((p) => [...p, n]);
    },
    [asignaciones]
  );

  const eliminarAsignacion = useCallback((id: string) => setAsignaciones((p) => p.filter((a) => a.id !== id)), []);

  const agregarFuncionLectiva = useCallback((asignacionId: string) => {
    setAsignaciones((prev) =>
      prev.map((asig) => {
        if (asig.id !== asignacionId) return asig;
        const nueva: FuncionLectiva = { id: `func_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, nombre: '', horas: 0 };
        return { ...asig, funcionesLectivas: [...(asig.funcionesLectivas || []), nueva] };
      })
    );
  }, []);

  const actualizarFuncionLectiva = useCallback((asignacionId: string, funcionId: string, campo: string, valor: any) => {
    setAsignaciones((prev) =>
      prev.map((asig) => {
        if (asig.id !== asignacionId) return asig;
        const funciones = (asig.funcionesLectivas || []).map((f) => (f.id === funcionId ? { ...f, [campo]: valor } : f));
        return { ...asig, funcionesLectivas: funciones };
      })
    );
  }, []);

  const eliminarFuncionLectiva = useCallback((asignacionId: string, funcionId: string) => {
    setAsignaciones((prev) =>
      prev.map((asig) => {
        if (asig.id !== asignacionId) return asig;
        const funciones = (asig.funcionesLectivas || []).filter((f) => f.id !== funcionId);
        return { ...asig, funcionesLectivas: funciones };
      })
    );
  }, []);

  const actualizarAsignacion = useCallback(
    (id: string, campo: string, valor: any) => {
      setAsignaciones((prev) =>
        prev.map((asig) => {
          if (asig.id !== id) return asig;
          const nueva = { ...asig, [campo]: valor } as AsignacionCargaHoraria;
          if (campo === 'docenteId') {
            const doc = docentes.find((d) => d.id === valor);
            if (doc) nueva.docenteNombre = doc.nombre;
          }
          if (campo === 'horasPorCurso') {
            nueva.horasXAsig = sumarHorasCursos(valor);
          }
          return nueva;
        })
      );
    },
    [docentes]
  );

  const actualizarHorasCurso = useCallback((asignacionId: string, curso: CursoId, horas: number) => {
    setAsignaciones((prev) =>
      prev.map((asig) => {
        if (asig.id !== asignacionId) return asig;
        const nuevas = { ...asig.horasPorCurso };
        if (horas === 0) delete nuevas[curso];
        else nuevas[curso] = horas;
        return { ...asig, horasPorCurso: nuevas, horasXAsig: sumarHorasCursos(nuevas) };
      })
    );
  }, []);

  const importarExcel = useCallback(
    (file: File) => {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets['Docentes 2025'] || workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          let headerRowIndex = -1;
          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (
              row &&
              row.some((cell: any) => typeof cell === 'string' && (cell.includes('Docente') || cell.includes('ASIGNATURA') || CURSOS.some((curso) => cell.includes(curso.replace('º', '')))))
            ) {
              headerRowIndex = i;
              break;
            }
          }
          if (headerRowIndex === -1) {
            alert('No se encontró la fila de encabezado en el archivo');
            return;
          }

          const headers = jsonData[headerRowIndex];
          const nuevas: AsignacionCargaHoraria[] = [];
          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            const docenteNombre = row[headers.indexOf('Docente')] || '';
            if (!docenteNombre) continue;
            const docente = docentes.find((d) => d.nombre.toLowerCase().includes(docenteNombre.toLowerCase()));
            if (!docente) continue;

            const horasPorCurso: Partial<Record<CursoId, number>> = {};
            headers.forEach((header: string, index: number) => {
              if (typeof header === 'string') {
                const cursoNormalizado = normalizarHeaderCurso(header.trim());
                if ((CURSOS as string[]).includes(cursoNormalizado as string)) {
                  const horas = parseInt(row[index]) || 0;
                  if (horas > 0) horasPorCurso[cursoNormalizado as CursoId] = horas;
                }
              }
            });

            let funcionesLectivas: FuncionLectiva[] = [];
            const funcionesTexto = row[headers.indexOf('FUNCIONES LECTIVAS')] || row[headers.indexOf('FUNCIONES NO LECTIVAS')] || row[headers.indexOf('OTRA FUNCIÓN')] || '';
            if (typeof funcionesTexto === 'string' && funcionesTexto.includes(':')) {
              funcionesLectivas = funcionesTexto.split(',').map((f: string) => {
                const [nombre, horasStr] = f.split(':').map((p: string) => p.trim());
                return { id: `func_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, nombre, horas: parseInt(horasStr) || 0 };
              });
            } else if (funcionesTexto) {
              funcionesLectivas = [{ id: `func_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, nombre: funcionesTexto, horas: 0 }];
            }

            const asig: AsignacionCargaHoraria = {
              id: `import_${Date.now()}_${i}`,
              docenteId: docente.id,
              docenteNombre: docente.nombre,
              asignaturaOModulo: row[headers.indexOf('ASIGNATURA O MÓDULO')] || '',
              funcionesLectivas,
              horasPorCurso,
              horasXAsig: sumarHorasCursos(horasPorCurso),
            };
            nuevas.push(asig);
          }

          setAsignaciones(nuevas);
          alert(`Se importaron ${nuevas.length} asignaciones exitosamente`);
        } catch (error) {
          console.error('Error al importar:', error);
          alert('Error al procesar el archivo. Verifique el formato.');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [docentes]
  );

  const exportarExcel = useCallback(() => {
    const datos = asignaciones.map((asig) => {
      const docente = docentes.find((d) => d.id === asig.docenteId);
  const totales = totalesByDocente[asig.docenteId];
      let funcionesTexto = '';
      if (asig.funcionesLectivas && asig.funcionesLectivas.length > 0) {
        funcionesTexto = asig.funcionesLectivas.map((f) => `${f.nombre}: ${f.horas}h`).join(', ');
  } else if ((asig as any).funcionesNoLectivas && (asig as any).funcionesNoLectivas.length > 0) {
        funcionesTexto = (asig as any).funcionesNoLectivas.map((f: any) => `${f.nombre}: ${f.horas}h`).join(', ');
      } else if ((asig as any).otraFuncion) {
        funcionesTexto = (asig as any).otraFuncion;
      }
      const fila: any = {
        Docente: asig.docenteNombre,
        'ASIGNATURA O MÓDULO': asig.asignaturaOModulo || '',
        'FUNCIONES LECTIVAS': funcionesTexto,
        'HORAS X ASIG.': asig.horasXAsig || 0,
      };
      CURSOS.forEach((curso) => (fila[curso] = asig.horasPorCurso[curso as CursoId] || 0));
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

  // Generar horario con IA (con fallback automático)
  const generarHorarioIA = useCallback(async () => {
    try {
      setLoading(true);
      const cursos = CURSOS as string[];
      const resultado: ResultadoGeneracionHorario = await generarHorarioSemanalConIA(asignaciones, docentes, cursos);
      setHorariosGenerados(resultado.horarios);
      setConflictosHorario(resultado.conflictos || []);
      setFuenteHorario(resultado.fuente);
      if (!cursoVista && cursos.length) setCursoVista(cursos[0]);
    } catch (err) {
      console.error('Error al generar horario:', err);
      alert('No se pudo generar el horario.');
    } finally {
      setLoading(false);
    }
  }, [asignaciones, docentes, cursoVista]);

  const guardarHorarioGenerado = useCallback(async () => {
    if (!horariosGenerados) {
      alert('No hay un horario generado para guardar.');
      return;
    }
    try {
      setLoading(true);
      await saveHorarios(horariosGenerados);
      alert('Horario guardado exitosamente');
      setHorariosActuales(horariosGenerados);
    } catch (e) {
      console.error('Error al guardar horario:', e);
      alert('Error al guardar el horario');
    } finally {
      setLoading(false);
    }
  }, [horariosGenerados]);

  const descartarHorarioGenerado = useCallback(() => {
    setHorariosGenerados(null);
    setConflictosHorario([]);
    setFuenteHorario(null);
  }, []);

  const guardar = useCallback(async () => {
    const errores = validaciones.filter((v) => v.tipo === 'error');
    if (errores.length > 0) {
      alert('No se puede guardar. Hay errores que deben corregirse primero.');
      return;
    }
    try {
      setLoading(true);
      const conId: AsignacionCargaHoraria[] = [];
      const nuevas: Omit<AsignacionCargaHoraria, 'id'>[] = [];
      asignaciones.forEach((asignacion) => {
        let funcionesLectivasActualizadas = asignacion.funcionesLectivas || [];
        if ((asignacion as any).funcionesNoLectivas && (asignacion as any).funcionesNoLectivas.length > 0 && funcionesLectivasActualizadas.length === 0) {
          funcionesLectivasActualizadas = (asignacion as any).funcionesNoLectivas.map((f: any) => ({ id: `func_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, nombre: f.nombre, horas: f.horas }));
        } else if ((asignacion as any).otraFuncion && funcionesLectivasActualizadas.length === 0) {
          funcionesLectivasActualizadas = [
            { id: `func_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, nombre: (asignacion as any).otraFuncion, horas: parseInt((asignacion as any).otraFuncion) || 0 },
          ];
        }
        const { funcionesNoLectivas, otraFuncion, ...rest } = asignacion as any;
        const asignacionActualizada: any = { ...rest, funcionesLectivas: funcionesLectivasActualizadas };
        if (asignacion.id.startsWith('asig_') || asignacion.id.startsWith('import_')) {
          const { id, ...sinId } = asignacionActualizada;
          nuevas.push(sinId);
        } else {
          conId.push(asignacionActualizada);
        }
      });
      const paraGuardar = [...conId.map(({ id, ...rest }) => rest), ...nuevas];
      await saveAsignacionesBatch(paraGuardar, true);
      alert('Horarios guardados exitosamente');
    } catch (error) {
      console.error('Error al guardar horarios:', error);
      alert('Error al guardar los horarios');
    } finally {
      setLoading(false);
    }
  }, [validaciones, asignaciones]);

  const getSemaforoColor = (docenteId: string) => {
    const totales = totalesByDocente[docenteId];
    if (!totales) return 'gray';
    if (totales.errors.length > 0) return 'red';
    if (totales.warnings.length > 0) return 'yellow';
    return 'green';
  };

  const AddDocenteModal = () => {
    if (!showAddDocenteModal) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-96 max-w-full overflow-hidden animate-scaleIn">
          {/* Encabezado del modal */}
          <div className="p-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Añadir Nuevo Docente
              </h2>
              <button 
                onClick={() => setShowAddDocenteModal(false)} 
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-all duration-200"
                disabled={loading}
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Cuerpo del modal */}
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Nombre Completo
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={nuevoDocente.nombre} 
                    onChange={(e) => setNuevoDocente({ ...nuevoDocente, nombre: e.target.value })} 
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200" 
                    placeholder="Nombre Apellido" 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Email
                </label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={nuevoDocente.email} 
                    onChange={(e) => setNuevoDocente({ ...nuevoDocente, email: e.target.value })} 
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200" 
                    placeholder="correo@ejemplo.com" 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Departamento
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={nuevoDocente.departamento} 
                    onChange={(e) => setNuevoDocente({ ...nuevoDocente, departamento: e.target.value })} 
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200" 
                    placeholder="Ej: Matemáticas, Lenguaje, etc." 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Horas Contrato
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={nuevoDocente.horasContrato} 
                    onChange={(e) => setNuevoDocente({ ...nuevoDocente, horasContrato: parseInt(e.target.value) || 0 })} 
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200" 
                    min={1} 
                    max={44} 
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">
                    horas
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Perfil
                </label>
                <div className="relative">
                  <select 
                    value={nuevoDocente.perfil} 
                    onChange={(e) => setNuevoDocente({ ...nuevoDocente, perfil: e.target.value as any })} 
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 appearance-none"
                  >
                    <option value="PROFESORADO">Profesorado</option>
                    <option value="SUBDIRECCION">Subdirección</option>
                    <option value="COORDINACION_TP">Coordinación TP</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={() => setShowAddDocenteModal(false)} 
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200" 
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                onClick={handleCrearDocente} 
                className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50 transition-all duration-200 flex items-center gap-2" 
                disabled={loading || !nuevoDocente.nombre || !nuevoDocente.email}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Guardar</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-750 px-6 py-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Los campos marcados con <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span> son obligatorios</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header con diseño moderno */}
      <div className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-800 dark:to-indigo-900 rounded-xl p-6 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-white dark:bg-gray-900 opacity-5">
          <div className="w-96 h-96 rounded-full bg-white dark:bg-blue-600 absolute -top-20 -right-20 opacity-20"></div>
          <div className="w-64 h-64 rounded-full bg-white dark:bg-indigo-600 absolute -bottom-10 -left-10 opacity-20"></div>
        </div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
                <Calendar className="mr-3 h-8 w-8" />
                Crear Horarios
              </h1>
              <p className="text-blue-100 dark:text-blue-200 max-w-2xl">
                Sistema de gestión de carga horaria docente con validación 65%/35% y visualización en tiempo real
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-3">
              <button 
                onClick={() => setMostrarResumen(true)} 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white text-sm rounded-lg transition-all duration-200 border border-white border-opacity-30"
              >
                <PieChart className="w-4 h-4" />
                <span>Ver estadísticas</span>
              </button>
              <button 
                onClick={guardar} 
                disabled={validaciones.some((v) => v.tipo === 'error') || loading} 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Guardando...' : 'Guardar cambios'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de controles con filtros y acciones */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
        {/* Título del panel de control */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700 flex items-center">
          <FilterIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 mr-2" />
          <h3 className="font-medium text-gray-700 dark:text-gray-300">Filtros y acciones</h3>
        </div>
        
        {/* Contenido del panel con filtros y botones */}
        <div className="p-5">
          {/* Fila de filtros */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex-1 md:max-w-xs">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="text-gray-400 w-4 h-4" />
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar docente..." 
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200" 
                  value={docenteSearch} 
                  onChange={(e) => setDocenteSearch(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="flex gap-3 flex-wrap">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <School className="text-gray-400 w-4 h-4" />
                </div>
                <select 
                  className="pl-10 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 min-w-[150px]"
                  value={filtros.curso} 
                  onChange={(e) => setFiltros((p) => ({ ...p, curso: e.target.value }))}
                >
                  <option value="">Todos los cursos</option>
                  {CURSOS.map((curso) => (
                    <option key={curso} value={curso}>{curso}</option>
                  ))}
                </select>
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <BookOpen className="text-gray-400 w-4 h-4" />
                </div>
                <select 
                  className="pl-10 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 min-w-[180px]"
                  value={filtros.asignatura} 
                  onChange={(e) => setFiltros((p) => ({ ...p, asignatura: e.target.value }))}
                >
                  <option value="">Todas las asignaturas</option>
                  {ASIGNATURAS.map((asig) => (
                    <option key={asig} value={asig}>{asig}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* Fila de botones de acción */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button 
              onClick={() => setShowAddDocenteModal(true)} 
              className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg transition-all duration-200 shadow-sm group"
            >
              <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-xs font-medium mt-1">Nuevo Docente</span>
            </button>
            
            <button 
              onClick={agregarAsignacion} 
              className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 shadow-sm group"
            >
              <Plus className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-xs font-medium mt-1">Agregar Asignatura</span>
            </button>
            
            <label 
              className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-gradient-to-br from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer group"
            >
              <Upload className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-xs font-medium mt-1">Importar Excel</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && importarExcel(e.target.files[0])} />
            </label>
            
            <button 
              onClick={exportarExcel} 
              className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white rounded-lg transition-all duration-200 shadow-sm group"
            >
              <FileSpreadsheet className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-xs font-medium mt-1">Exportar Excel</span>
            </button>
            
            <button 
              onClick={generarHorarioIA} 
              disabled={loading || asignaciones.length === 0} 
              className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-gradient-to-br from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 text-white rounded-lg transition-all duration-200 shadow-sm group disabled:opacity-50"
              title="Generar horario semanal automáticamente (IA)"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              )}
              <span className="text-xs font-medium mt-1">Generar horario (IA)</span>
            </button>
            
            <button 
              onClick={() => setMostrarResumen(true)} 
              className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-gradient-to-br from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm group"
            >
              <BarChart3 className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-xs font-medium mt-1">Abrir Resumen</span>
            </button>
            
            <button 
              onClick={guardar} 
              disabled={validaciones.some((v) => v.tipo === 'error') || loading} 
              className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-amber-500 disabled:hover:to-orange-600 group"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              )}
              <span className="text-xs font-medium mt-1">{loading ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </div>
        </div>
      </div>

      {validaciones.length > 0 && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" /> 
              <h3 className="font-medium text-red-700 dark:text-red-300">Validaciones y Alertas ({validaciones.length})</h3>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 text-xs rounded-md flex items-center gap-1">
                <XCircle className="w-3 h-3" /> {validaciones.filter(v => v.tipo === 'error').length} Errores
              </span>
              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-800/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-md flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {validaciones.filter(v => v.tipo === 'warning').length} Advertencias
              </span>
            </div>
          </div>
          <div className="p-5">
            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {validaciones.map((v, i) => (
                <div key={i} className={`flex items-center gap-2 p-3 rounded-lg shadow-sm ${
                  v.tipo === 'error' 
                    ? 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300 border-l-4 border-red-500 dark:border-red-600' 
                    : 'bg-yellow-50 dark:bg-yellow-900/10 text-yellow-700 dark:text-yellow-300 border-l-4 border-yellow-500 dark:border-yellow-600'
                }`}>
                  {v.tipo === 'error' ? <XCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                  <span className="text-sm">{v.mensaje}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contenedor principal de la tabla con mejor manejo responsivo */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center">
            <Briefcase className="w-5 h-5 text-gray-500 dark:text-gray-400 mr-2" />
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Asignaciones de Carga Horaria</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Correcto</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Advertencia</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Error</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          {/* Agregar clase min-w-[1000px] para forzar el scroll horizontal en dispositivos pequeños */}
          <table className="w-full min-w-[1000px]">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 z-20 bg-gray-50 dark:bg-gray-700 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                    <span>Estado</span>
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-14 z-20 bg-gray-50 dark:bg-gray-700 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Docente</span>
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Asignatura</span>
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <UserCog className="w-3.5 h-3.5" />
                    <span>Func. Lectivas</span>
                  </div>
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Hrs</span>
                  </div>
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" colSpan={CURSOS.length}>
                  <div className="flex justify-center items-center gap-1.5">
                    <School className="w-3.5 h-3.5" />
                    <span>Cursos</span>
                    <span className="ml-1 text-xs text-gray-400 font-normal">(horas por curso)</span>
                  </div>
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5" />
                    <span>HA/HB</span>
                  </div>
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky right-0 z-20 bg-gray-50 dark:bg-gray-700 shadow-sm">
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Acciones</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {asignacionesFiltradas.map((asignacion, index) => {
                const totales = totalesByDocente[asignacion.docenteId];
                const semaforoColor = getSemaforoColor(asignacion.docenteId);
                const esPrimeraAsignacionDocente = index === 0 || asignacionesFiltradas[index - 1].docenteId !== asignacion.docenteId;
                const esUltimaAsignacionDocente = index === asignacionesFiltradas.length - 1 || asignacionesFiltradas[index + 1].docenteId !== asignacion.docenteId;
                const asignacionesDocente = asignacionesFiltradas.filter((a) => a.docenteId === asignacion.docenteId);
                const tieneMultiplesAsignaturas = asignacionesDocente.length > 1;
                let estiloFila = 'hover:bg-gray-50 dark:hover:bg-gray-750 ';
                if (tieneMultiplesAsignaturas) {
                  if (esPrimeraAsignacionDocente) {
                    estiloFila += 'border-t-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 ';
                  } else {
                    estiloFila += 'bg-blue-50 dark:bg-blue-900/10 ';
                  }
                  if (esUltimaAsignacionDocente) {
                    estiloFila += 'border-b-2 border-blue-200 dark:border-blue-800 mb-1 ';
                  }
                }
                return (
                  <tr key={asignacion.id} className={estiloFila}>
                    {/* Estado - Columna sticky */}
                    <td className="px-1 py-2 sticky left-0 z-10 bg-inherit">
                      <div className="flex flex-col items-center">
                        <div 
                          className={`w-3 h-3 rounded-full ${
                            semaforoColor === 'green' ? 'bg-green-500' : 
                            semaforoColor === 'yellow' ? 'bg-yellow-500' : 
                            semaforoColor === 'red' ? 'bg-red-500' : 'bg-gray-500'
                          }`} 
                        />
                        {tieneMultiplesAsignaturas && esPrimeraAsignacionDocente && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">{asignacionesDocente.length}</span>
                        )}
                      </div>
                    </td>
                    
                    {/* Docente - Columna sticky */}
                    <td className="px-1 py-2 sticky left-10 z-10 bg-inherit">
                      {!tieneMultiplesAsignaturas || esPrimeraAsignacionDocente ? (
                        <div>
                          <select 
                            value={asignacion.docenteId} 
                            onChange={(e) => actualizarAsignacion(asignacion.id, 'docenteId', e.target.value)}
                            className={`w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs ${tieneMultiplesAsignaturas ? 'font-medium' : ''}`}
                          >
                            {(docentesFiltrados.length > 0 ? docentesFiltrados : docentes).map((d) => (
                              <option key={d.id} value={d.id}>{d.nombre}</option>
                            ))}
                          </select>
                          {tieneMultiplesAsignaturas && 
                            <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                              {asignacionesDocente.length} asig.
                            </div>
                          }
                        </div>
                      ) : (
                        <div className="pl-1 italic text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">↳ Mismo</div>
                      )}
                    </td>
                    
                    {/* Asignatura */}
                    <td className="px-1 py-2">
                      <select 
                        value={asignacion.asignaturaOModulo || ''} 
                        onChange={(e) => actualizarAsignacion(asignacion.id, 'asignaturaOModulo', e.target.value)}
                        className={`w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs ${tieneMultiplesAsignaturas ? 'border-blue-300 dark:border-blue-700' : ''}`}
                      >
                        <option value="">Seleccionar...</option>
                        {ASIGNATURAS.map((asig) => (
                          <option key={asig} value={asig}>{asig}</option>
                        ))}
                      </select>
                      {tieneMultiplesAsignaturas && !esPrimeraAsignacionDocente && 
                        <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">Adicional</div>
                      }
                    </td>
                    
                    {/* Funciones lectivas - Diseño más compacto */}
                    <td className="px-1 py-2">
                      <div className="space-y-1 w-full min-w-[200px]">
                        {(asignacion.funcionesLectivas || []).map((funcion) => (
                          <div key={funcion.id} className="flex gap-1 items-center">
                            <input 
                              type="text" 
                              value={funcion.nombre} 
                              onChange={(e) => actualizarFuncionLectiva(asignacion.id, funcion.id, 'nombre', e.target.value)}
                              placeholder="Nombre" 
                              className="flex-grow px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-l bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                            />
                            <input 
                              type="number" 
                              value={funcion.horas} 
                              onChange={(e) => actualizarFuncionLectiva(asignacion.id, funcion.id, 'horas', parseInt(e.target.value) || 0)}
                              min={0} max={44} 
                              className="w-10 px-1 py-1 border-y border-r border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs text-center"
                            />
                            <button 
                              onClick={() => eliminarFuncionLectiva(asignacion.id, funcion.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-r" 
                              title="Eliminar función"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {!asignacion.funcionesLectivas && (
                          <div className="flex gap-1 items-center">
                            <input 
                              type="text" 
                              value={(asignacion as any).otraFuncion || ''} 
                              onChange={(e) => actualizarAsignacion(asignacion.id, 'otraFuncion', e.target.value)}
                              placeholder="Ej: Coordinador" 
                              className="flex-grow px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                            />
                          </div>
                        )}
                        <button 
                          onClick={() => agregarFuncionLectiva(asignacion.id)}
                          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 px-2 py-0.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        >
                          <Plus className="w-3 h-3" /> <span className="text-xs">Agregar</span>
                        </button>
                      </div>
                    </td>
                    
                    {/* Horas por asignatura */}
                    <td className="px-1 py-2 text-center">
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{asignacion.horasXAsig || 0}</span>
                    </td>
                    
                    {/* Cursos - Grid adaptable */}
                    <td className="px-1 py-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                        {CURSOS.map((curso) => (
                          <div key={curso} className="flex flex-col items-center bg-gray-50 dark:bg-gray-750 p-1 rounded">
                            <label className="text-xs text-gray-500 dark:text-gray-400">{curso}</label>
                            <input 
                              type="number" 
                              min={0} 
                              value={asignacion.horasPorCurso[curso as CursoId] || ''} 
                              onChange={(e) => actualizarHorasCurso(asignacion.id, curso as CursoId, parseInt(e.target.value) || 0)}
                              className="w-10 h-7 px-1 py-0 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs text-center" 
                            />
                          </div>
                        ))}
                      </div>
                    </td>
                    
                    {/* HA/HB */}
                    <td className="px-1 py-2 text-center whitespace-nowrap">
                      {totales && (
                        <div className="space-y-0">
                          <div className="text-blue-600 dark:text-blue-400 text-xs">
                            HA: {totales.HA} ({totales.restantesHA >= 0 ? '+' : ''}{totales.restantesHA})
                          </div>
                          <div className="text-green-600 dark:text-green-400 text-xs">
                            HB: {totales.HB} ({totales.restantesHB >= 0 ? '+' : ''}{totales.restantesHB})
                          </div>
                        </div>
                      )}
                    </td>
                    
                    {/* Acciones - Columna sticky */}
                    <td className="px-1 py-2 text-center sticky right-0 z-10 bg-inherit">
                      <div className="flex flex-col items-center gap-1">
                        <button 
                          onClick={() => agregarAsignaturaMismoDocente(asignacion.docenteId, asignacion.docenteNombre)}
                          className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" 
                          title="Agregar otra asignatura a este docente"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => eliminarAsignacion(asignacion.id)}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" 
                          title="Eliminar esta asignación"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {mostrarResumen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold">Panel de Resumen</h2>
              <button onClick={() => setMostrarResumen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <CloseIcon />
              </button>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex -mb-px px-6">
                <button onClick={() => setVistaResumen('docentes')} className={`px-6 py-3 font-medium text-sm ${vistaResumen === 'docentes' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>
                  Por Docente
                </button>
                <button onClick={() => setVistaResumen('cursos')} className={`px-6 py-3 font-medium text-sm ${vistaResumen === 'cursos' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>
                  Por Curso
                </button>
                <button onClick={() => setVistaResumen('funciones')} className={`px-6 py-3 font-medium text-sm ${vistaResumen === 'funciones' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>
                  Por Función
                </button>
                <button onClick={() => setVistaResumen('totales')} className={`px-6 py-3 font-medium text-sm ${vistaResumen === 'totales' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>
                  Totales Generales
                </button>
              </nav>
            </div>

            <div className="p-6 overflow-y-auto flex-grow">
              {vistaResumen === 'docentes' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Resumen por Docente</h3>
                  <div className="grid gap-4">
                    {docentes.map((docente) => {
                      const totales = totalesByDocente[docente.id];
                      const asignacionesDocente = asignaciones.filter((a) => a.docenteId === docente.id);
                      return (
                        <div key={docente.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">{docente.nombre}</h4>
                            <div className={`w-3 h-3 rounded-full ${getSemaforoColor(docente.id) === 'green' ? 'bg-green-500' : getSemaforoColor(docente.id) === 'yellow' ? 'bg-yellow-500' : getSemaforoColor(docente.id) === 'red' ? 'bg-red-500' : 'bg-gray-500'}`} />
                          </div>
                          {totales && (
                            <div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-2">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Contrato:</span>
                                  <span className="ml-1 font-medium">{docente.horasContrato}h</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">HA:</span>
                                  <span className="ml-1 font-medium text-blue-600 dark:text-blue-400">{totales.sumCursos}/{totales.HA}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">HB:</span>
                                  <span className="ml-1 font-medium text-green-600 dark:text-green-400">{totales.sumFunciones}/{totales.HB}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Asignaciones:</span>
                                  <span className="ml-1 font-medium">{asignacionesDocente.length}</span>
                                </div>
                              </div>
                              {asignacionesDocente.length > 0 && (
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
                                    <h5 className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Asignaturas asignadas:</h5>
                                    <ul className="text-xs text-gray-800 dark:text-gray-200 space-y-1 ml-2">
                                      {asignacionesDocente.map((asig) => (
                                        <li key={asig.id} className="flex justify-between">
                                          <span>{asig.asignaturaOModulo || 'Sin asignatura'}</span>
                                          <span className="text-blue-600 dark:text-blue-400 font-medium">{asig.horasXAsig || 0}h</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
                                    <h5 className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Distribución por curso:</h5>
                                    <ul className="text-xs text-gray-800 dark:text-gray-200 space-y-1 ml-2">
                                      {CURSOS.filter((curso) => asignacionesDocente.some((asig) => asig.horasPorCurso[curso as CursoId])).map((curso) => {
                                        const horasTotalesCurso = asignacionesDocente.reduce((total, asig) => total + (asig.horasPorCurso[curso as CursoId] || 0), 0);
                                        return (
                                          <li key={curso} className="flex justify-between">
                                            <span>{curso}</span>
                                            <span className="text-blue-600 dark:text-blue-400 font-medium">{horasTotalesCurso}h</span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                </div>
                              )}
                              {asignacionesDocente.some((asig) => (asig.funcionesLectivas || []).length > 0) && (
                                <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                                  <h5 className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Funciones lectivas:</h5>
                                  <ul className="text-xs text-gray-800 dark:text-gray-200 space-y-1 ml-2">
                                    {asignacionesDocente
                                      .flatMap((asig) => (asig.funcionesLectivas || []).map((funcion) => ({ id: `${asig.id}_${funcion.id}`, nombre: funcion.nombre, horas: funcion.horas })))
                                      .map((funcion) => (
                                        <li key={funcion.id} className="flex justify-between">
                                          <span>{funcion.nombre || 'Sin nombre'}</span>
                                          <span className="text-green-600 dark:text-green-400 font-medium">{funcion.horas}h</span>
                                        </li>
                                      ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {vistaResumen === 'cursos' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Resumen por Curso</h3>
                  <div className="grid gap-4">
                    {CURSOS.filter((curso) => asignaciones.some((asig) => asig.horasPorCurso[curso as CursoId])).map((curso) => {
                      const asignacionesCurso = asignaciones.filter((asig) => asig.horasPorCurso[curso as CursoId]);
                      const docentesEnCurso: { id: string; nombre: string; asignaciones: AsignacionCargaHoraria[] }[] = [];
                      asignacionesCurso.forEach((asig) => {
                        const index = docentesEnCurso.findIndex((d) => d.id === asig.docenteId);
                        if (index === -1) docentesEnCurso.push({ id: asig.docenteId, nombre: asig.docenteNombre, asignaciones: [asig] });
                        else docentesEnCurso[index].asignaciones.push(asig);
                      });
                      const totalHorasCurso = asignacionesCurso.reduce((total, asig) => total + (asig.horasPorCurso[curso as CursoId] || 0), 0);
                      return (
                        <div key={curso} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">{curso}</h4>
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-md">Total: {totalHorasCurso}h</span>
                          </div>
                          <div className="mt-2">
                            <h5 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Docentes asignados:</h5>
                            <div className="grid gap-2">
                              {docentesEnCurso.map((doc) => (
                                <div key={doc.id} className="px-3 py-2 bg-gray-50 dark:bg-gray-750 rounded">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{doc.nombre}</span>
                                    <span className="text-sm text-blue-600 dark:text-blue-400">
                                      {doc.asignaciones.reduce((sum, asig) => sum + (asig.horasPorCurso[curso as CursoId] || 0), 0)}h
                                    </span>
                                  </div>
                                  <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                                    {doc.asignaciones.filter((asig) => asig.horasPorCurso[curso as CursoId]).map((asig) => (
                                      <li key={asig.id} className="flex justify-between">
                                        <span>{asig.asignaturaOModulo || 'Sin asignatura'}</span>
                                        <span>{asig.horasPorCurso[curso as CursoId]}h</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {vistaResumen === 'funciones' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Resumen por Funciones Lectivas</h3>
                  {(() => {
                    const todas: { nombre: string; docentes: { id: string; nombre: string; horas: number }[]; totalHoras: number }[] = [];
                    asignaciones.forEach((asig) => {
                      (asig.funcionesLectivas || []).forEach((funcion) => {
                        if (!funcion.nombre) return;
                        const existente = todas.find((f) => f.nombre === funcion.nombre);
                        if (!existente) {
                          todas.push({ nombre: funcion.nombre, docentes: [{ id: asig.docenteId, nombre: asig.docenteNombre, horas: funcion.horas }], totalHoras: funcion.horas });
                        } else {
                          const doc = existente.docentes.find((d) => d.id === asig.docenteId);
                          if (!doc) existente.docentes.push({ id: asig.docenteId, nombre: asig.docenteNombre, horas: funcion.horas });
                          else doc.horas += funcion.horas;
                          existente.totalHoras += funcion.horas;
                        }
                      });
                    });
                    todas.sort((a, b) => b.totalHoras - a.totalHoras);
                    if (todas.length === 0) {
                      return (
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-750">
                          <p className="text-gray-500 dark:text-gray-400 text-center">No hay funciones lectivas asignadas.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="grid gap-4">
                        {todas.map((funcion, i) => (
                          <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-white">{funcion.nombre}</h4>
                              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-md">Total: {funcion.totalHoras}h</span>
                            </div>
                            <h5 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Docentes asignados:</h5>
                            <ul className="text-xs text-gray-800 dark:text-gray-200 space-y-1 ml-2">
                              {funcion.docentes.sort((a, b) => b.horas - a.horas).map((doc) => (
                                <li key={doc.id} className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                  <span>{doc.nombre}</span>
                                  <span className="text-green-600 dark:text-green-400 font-medium">{doc.horas}h</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {vistaResumen === 'totales' && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">Resumen de Totales Generales</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-md">
                      <h4 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">Total de Horas Lectivas</h4>
                      <div className="flex items-end justify-between">
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                          {(() => {
                            let totalLectivas = 0;
                            asignaciones.forEach((asig) => {
                              if (asig.horasPorCurso) Object.values(asig.horasPorCurso).forEach((h) => typeof h === 'number' && (totalLectivas += h));
                              (asig.funcionesLectivas || []).forEach((f) => typeof f.horas === 'number' && (totalLectivas += f.horas));
                            });
                            return totalLectivas;
                          })()}
                        </div>
                        <span className="text-sm text-blue-500 dark:text-blue-300">horas</span>
                      </div>
                      <p className="mt-3 text-sm text-blue-600 dark:text-blue-400">Total de horas lectivas asignadas (HA)</p>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 rounded-xl border border-green-200 dark:border-green-800 shadow-md">
                      <h4 className="text-lg font-bold text-green-800 dark:text-green-300 mb-2">Total de Horas No Lectivas</h4>
                      <div className="flex items-end justify-between">
                        <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                          {(() => {
                            let totalNoLectivas = 0;
                            docentes.forEach((doc) => {
                              const horasContrato = typeof doc.horasContrato === 'number' ? doc.horasContrato : 0;
                              totalNoLectivas += calcularHB(horasContrato);
                            });
                            return totalNoLectivas;
                          })()}
                        </div>
                        <span className="text-sm text-green-500 dark:text-green-300">horas</span>
                      </div>
                      <p className="mt-3 text-sm text-green-600 dark:text-green-400">Total de horas no lectivas (HB)</p>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 shadow-md">
                      <h4 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">Total de Horas Contrato</h4>
                      <div className="flex items-end justify-between">
                        <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                          {(() => {
                            // Calcular el total real de horas contrato sumando las horas de cada docente
                            const totalContrato = docentes.reduce((total, doc) => {
                              const horasContrato = typeof doc.horasContrato === 'number' ? doc.horasContrato : 0;
                              return total + horasContrato;
                            }, 0);
                            return totalContrato;
                          })()}
                        </div>
                        <span className="text-sm text-amber-500 dark:text-amber-300">horas</span>
                      </div>
                      <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">Total de horas contratadas (Lectivas + No lectivas)</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Distribución de Horas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">Distribución Porcentual</h5>
                        {(() => {
                          let totalLectivas = 0;
                          let totalNoLectivas = 0;
                          asignaciones.forEach((asig) => {
                            if (asig.horasPorCurso) Object.values(asig.horasPorCurso).forEach((h) => typeof h === 'number' && (totalLectivas += h));
                            (asig.funcionesLectivas || []).forEach((f) => typeof f.horas === 'number' && (totalLectivas += f.horas));
                          });
                          docentes.forEach((doc) => {
                            const horasContrato = typeof doc.horasContrato === 'number' ? doc.horasContrato : 0;
                            totalNoLectivas += calcularHB(horasContrato);
                          });
                          const totalContratoReal = totalLectivas + totalNoLectivas;
                          const pctL = totalContratoReal > 0 ? Math.round((totalLectivas / totalContratoReal) * 100) : 0;
                          const pctNL = totalContratoReal > 0 ? Math.round((totalNoLectivas / totalContratoReal) * 100) : 0;
                          return (
                            <div>
                              <div className="mb-4">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-medium text-blue-700 dark:text-blue-300">Horas Lectivas (HA)</span>
                                  <span className="font-bold">{pctL}%</span>
                                </div>
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 dark:bg-blue-600 rounded-full" style={{ width: `${pctL}%` }}></div>
                                </div>
                              </div>
                              <div className="mb-4">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-medium text-green-700 dark:text-green-300">Horas No Lectivas (HB)</span>
                                  <span className="font-bold">{pctNL}%</span>
                                </div>
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-500 dark:bg-green-600 rounded-full" style={{ width: `${pctNL}%` }}></div>
                                </div>
                              </div>
                              <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-750 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                                <p>
                                  <strong>Distribución Objetivo:</strong>
                                </p>
                                <p>• Horas Lectivas (HA): 65% del contrato</p>
                                <p>• Horas No Lectivas (HB): 35% del contrato</p>
                                <p>• Horas Contrato Total = Horas Lectivas + Horas No Lectivas</p>
                                <div className="mt-2">{Math.abs(pctL - 65) <= 5 ? <p className="text-green-600 dark:text-green-400 font-medium">✓ La distribución está dentro de los parámetros recomendados</p> : <p className="text-orange-600 dark:text-orange-400 font-medium">⚠️ La distribución difiere de los parámetros recomendados</p>}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h5 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">Estadísticas Generales</h5>
                          <ul className="space-y-3 text-sm">
                            <li className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                              <span className="text-gray-600 dark:text-gray-400">Total de docentes:</span>
                              <span className="font-semibold">{docentes.length}</span>
                            </li>
                            <li className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                              <span className="text-gray-600 dark:text-gray-400">Total de asignaciones:</span>
                              <span className="font-semibold">{asignaciones.length}</span>
                            </li>
                            <li className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                              <span className="text-gray-600 dark:text-gray-400">Promedio horas contrato:</span>
                              <span className="font-semibold">{docentes.length > 0 ? (docentes.reduce((t, d) => t + (typeof d.horasContrato === 'number' ? d.horasContrato : 0), 0) / docentes.length).toFixed(1) : '0'} horas</span>
                            </li>
                          </ul>
                        </div>
                        {validaciones.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-md font-medium text-red-700 dark:text-red-300 mb-2">Advertencias ({validaciones.length})</h5>
                            <div className="max-h-32 overflow-y-auto p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <ul className="text-xs space-y-1 text-red-600 dark:text-red-400">
                                {validaciones.slice(0, 5).map((v, i) => (
                                  <li key={i} className="flex items-center gap-1">{v.tipo === 'error' ? '❌' : '⚠️'}<span>{v.mensaje}</span></li>
                                ))}
                                {validaciones.length > 5 && <li className="italic">Y {validaciones.length - 5} más...</li>}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panel de generación y vista de Horario */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Generación de Horario Semanal</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm"
                value={cursoVista}
                onChange={(e) => setCursoVista(e.target.value)}
              >
                {CURSOS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {horariosGenerados && (
              <>
                <button
                  onClick={guardarHorarioGenerado}
                  disabled={loading}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-all duration-200 shadow-sm"
                >
                  Guardar horario
                </button>
                <button
                  onClick={descartarHorarioGenerado}
                  disabled={loading}
                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 text-sm rounded-lg transition-all duration-200"
                >
                  Descartar
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {fuenteHorario && (
            <div className={`px-4 py-3 rounded-lg text-sm ${fuenteHorario === 'IA' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
              Fuente: {fuenteHorario === 'IA' ? 'Generado por IA' : 'Generado por algoritmo (fallback)'}
            </div>
          )}

          {conflictosHorario.length > 0 && (
            <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              <div className="font-medium mb-1">Conflictos detectados ({conflictosHorario.length}):</div>
              <ul className="list-disc ml-5 space-y-1">
                {conflictosHorario.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Vista previa del horario (por curso) */}
          {(horariosGenerados || horariosActuales) ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[800px] border-collapse">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Bloque</th>
                    {DIAS_SEMANA.map((dia) => (
                      <th key={dia} className="px-3 py-2 text-center text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">{dia}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HORARIO_BLOQUES.map((b) => (
                    <tr key={b.bloque} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {b.bloque}. {b.inicio} - {b.fin}
                      </td>
                      {DIAS_SEMANA.map((dia) => {
                        const data = (horariosGenerados || horariosActuales)?.[dia]?.[String(b.bloque)]?.[cursoVista];
                        return (
                          <td key={`${dia}_${b.bloque}`} className="px-3 py-2 align-top">
                            {data && (data.asignatura || data.profesor) ? (
                              <div className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.asignatura}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">{data.profesor}</div>
                              </div>
                            ) : (
                              <div className="h-10 rounded bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700"></div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-750 text-gray-600 dark:text-gray-300 text-sm">
              Aún no hay un horario guardado ni generado. Usa "Generar horario (IA)" para crear una propuesta.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 p-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl overflow-hidden border border-blue-200 dark:border-blue-800 shadow-sm">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            <h4 className="font-medium">Información sobre Distribución de Horas</h4>
          </div>
        </div>
        
        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 shrink-0">
                <School className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-medium text-blue-900 dark:text-blue-100">Horas Lectivas (HA)</h5>
                <p className="text-sm text-blue-700 dark:text-blue-300">Según tabla oficial (ej: 44h → {calcularHA(44)}h, 30h → {calcularHA(30)}h)</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300 shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-medium text-green-900 dark:text-green-100">Funciones Lectivas</h5>
                <p className="text-sm text-green-700 dark:text-green-300">Las horas de las funciones se suman a las horas lectivas (HA)</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                <UserCog className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-medium text-amber-900 dark:text-amber-100">Horas No Lectivas (HB)</h5>
                <p className="text-sm text-amber-700 dark:text-amber-300">El resto del contrato (ej: 44h → {calcularHB(44)}h, 30h → {calcularHB(30)}h)</p>
              </div>
            </div>
          </div>
          
          <div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
              <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Fórmulas de cálculo</h5>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-mono">HA</div>
                  <span className="text-gray-600 dark:text-gray-400">Horas Lectivas = 65% del Contrato</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-mono">HB</div>
                  <span className="text-gray-600 dark:text-gray-400">Horas No Lectivas = 35% del Contrato</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-mono">HC</div>
                  <span className="text-gray-600 dark:text-gray-400">Horas Contrato = HA + HB</span>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Guía de semáforos</h5>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-750 rounded">
                  <div className="w-5 h-5 rounded-full bg-green-500 mb-1"></div>
                  <span className="text-xs text-gray-700 dark:text-gray-300">Completo</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-750 rounded">
                  <div className="w-5 h-5 rounded-full bg-yellow-500 mb-1"></div>
                  <span className="text-xs text-gray-700 dark:text-gray-300">Faltan horas</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-750 rounded">
                  <div className="w-5 h-5 rounded-full bg-red-500 mb-1"></div>
                  <span className="text-xs text-gray-700 dark:text-gray-300">Excede límites</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddDocenteModal />

      {loading && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl flex flex-col items-center animate-pulse">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-solid rounded-full"></div>
              <div className="w-16 h-16 border-4 border-blue-600 dark:border-blue-400 border-t-transparent animate-spin rounded-full absolute top-0 left-0"></div>
            </div>
            <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">Procesando solicitud...</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Por favor, espere un momento</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrearHorarios;
