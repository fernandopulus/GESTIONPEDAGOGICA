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
  Edit,
} from 'lucide-react';
import { exportCargasHorariasDocentes } from '../../src/utils/exportCargasHorariasDocentes';

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
  actualizarHorasContrato,
  calculateRequiredContractHours,
  eliminarDocente,
  deleteAsignacionCarga,
} from '../../src/firebaseHelpers/cargaHorariaHelper';
import { saveHorarios, subscribeToHorarios } from '../../src/firebaseHelpers/horariosHelper';
import type { ResultadoGeneracionHorario, ReglasGeneracion } from '../../src/ai/horarioAI';
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
  const [exportandoPDF, setExportandoPDF] = useState(false);
    const [errorExportacion, setErrorExportacion] = useState<string | null>(null); // (eliminado duplicado de estados exportandoPDF / errorExportacion)
  // Horarios generados/guardados y vista
  const [horariosActuales, setHorariosActuales] = useState<HorariosGenerados | null>(null);
  const [horariosGenerados, setHorariosGenerados] = useState<HorariosGenerados | null>(null);
  const [conflictosHorario, setConflictosHorario] = useState<string[]>([]);
  const [fuenteHorario, setFuenteHorario] = useState<'fallback' | null>(null);
  const [cursoVista, setCursoVista] = useState<string>(CURSOS[0] || '');
  const [showReglasModal, setShowReglasModal] = useState(false);
  const [reglas, setReglas] = useState<ReglasGeneracion>({
    maxConsecutivasMecanica: 10,
    maxConsecutivasPlanGeneral: 3,
    practicasPM: false,
    terceroSoloPlanGeneral: false,
  });

  const [showAddDocenteModal, setShowAddDocenteModal] = useState(false);
  const [nuevoDocente, setNuevoDocente] = useState<{
    nombre: string;
    email: string;
    departamento: string;
    horasContrato: number;
    perfil: 'PROFESORADO' | 'SUBDIRECCION' | 'COORDINACION_TP';
  }>({ nombre: '', email: '', departamento: 'General', horasContrato: 44, perfil: 'PROFESORADO' });
  const [docenteSearch, setDocenteSearch] = useState('');
  
  const [editingDocente, setEditingDocente] = useState<DocenteCargaHoraria | null>(null);
  const [showEditDocenteModal, setShowEditDocenteModal] = useState(false);
  const [tempHorasContrato, setTempHorasContrato] = useState<number>(44);

  // Nota: estados exportandoPDF y errorExportacion ya declarados arriba; se eliminaron duplicados.

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

  // Sugerir horas de contrato si hay discrepancia
  useEffect(() => {
    docentes.forEach(doc => {
      const totales = totalesByDocente[doc.id];
      if (totales && totales.totalHorasLectivas > 0) {
        try {
          const requiredContract = calculateRequiredContractHours(totales.totalHorasLectivas);
          if (requiredContract !== doc.horasContrato) {
            // Aquí podríamos mostrar una alerta o sugerencia visual
            // Por ahora, solo lo logueamos o lo usamos en la UI para mostrar una advertencia
            console.log(`Docente ${doc.nombre} tiene ${totales.totalHorasLectivas} lectivas. Requiere ${requiredContract} contrato. Actual: ${doc.horasContrato}`);
          }
        } catch (e) {
          // Ignorar si no hay mapeo
        }
      }
    });
  }, [totalesByDocente, docentes]);

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

  // Eliminado: flujo de exportación PDF antiguo con plantilla del liceo previo

  // Generar horario automático solo con algoritmo local (sin IA)
  const generarHorarioIA = useCallback(async () => {
    try {
      setLoading(true);
      // Por ahora deshabilitamos la generación con IA.
      alert('La generación automática de horario con IA ha sido deshabilitada en esta versión.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      const confirmar = window.confirm(`Hay ${errores.length} errores de validación. ¿Desea guardar de todos modos?`);
      if (!confirmar) return;
    }
    try {
      setLoading(true);
      // Filtrar asignaciones completamente vacías (sin horas ni funciones)
      const asignacionesValidas = asignaciones.filter((asignacion) => {
        const tieneHorasCurso = asignacion.horasPorCurso && Object.values(asignacion.horasPorCurso).some((h) => (h || 0) > 0);
        const tieneFunciones = (asignacion.funcionesLectivas || []).some((f) => (f.horas || 0) > 0);
        return tieneHorasCurso || tieneFunciones;
      });

      const paraGuardar = asignacionesValidas.map((asignacion) => {
        let funcionesLectivasActualizadas = asignacion.funcionesLectivas || [];
        if ((asignacion as any).funcionesNoLectivas && (asignacion as any).funcionesNoLectivas.length > 0 && funcionesLectivasActualizadas.length === 0) {
          funcionesLectivasActualizadas = (asignacion as any).funcionesNoLectivas.map((f: any) => ({ id: `func_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, nombre: f.nombre, horas: f.horas }));
        } else if ((asignacion as any).otraFuncion && funcionesLectivasActualizadas.length === 0) {
          funcionesLectivasActualizadas = [
            { id: `func_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, nombre: (asignacion as any).otraFuncion, horas: parseInt((asignacion as any).otraFuncion) || 0 },
          ];
        }
        const { funcionesNoLectivas, otraFuncion, ...rest } = asignacion as any;

        // Recalcular horasXAsig siempre a partir de horasPorCurso para mantener coherencia
        const horasPorCurso = rest.horasPorCurso || {};
        const horasXAsig = Object.values(horasPorCurso).reduce((sum: number, h: any) => sum + (typeof h === 'number' ? h : 0), 0);

        return { ...rest, funcionesLectivas: funcionesLectivasActualizadas, horasXAsig };
      });

      console.log('[guardar] paraGuardar', JSON.stringify(paraGuardar, null, 2));

      await saveAsignacionesBatch(paraGuardar, true);

      // Sincronizar estado local inmediatamente para evitar "reseteos" visuales
      setAsignaciones(paraGuardar as AsignacionCargaHoraria[]);

      alert('Horarios guardados exitosamente');
    } catch (error: any) {
      console.error('Error al guardar horarios:', error);
      const message = error?.message || 'Error desconocido, revise la consola del navegador.';
      alert('Error al guardar los horarios: ' + message);
    } finally {
      setLoading(false);
    }
  }, [validaciones, asignaciones]);

  const handleExportPDF = useCallback(async () => {
    try {
      setExportandoPDF(true);
      setErrorExportacion(null);
      const blob = await exportCargasHorariasDocentes(docentes, asignaciones, totalesByDocente, {
        titulo: 'Resumen de Cargas Horarias',
        establecimiento: 'Liceo Industrial de Recoleta',
        directora: 'Patricia Silva Sánchez',
        incluirFecha: true,
        headerImageUrl: 'https://res.cloudinary.com/dwncmu1wu/image/upload/v1756260600/Captura_de_pantalla_2025-08-26_a_la_s_10.09.17_p._m._aakgkt.png',
        headerImageHeightCm: 1.5
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cargas_docentes_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Error exportando PDF:', e);
      setErrorExportacion(e?.message || 'Error al exportar PDF');
    } finally {
      setExportandoPDF(false);
    }
  }, [docentes, asignaciones, totalesByDocente]);

  const getSemaforoColor = (docenteId: string) => {
    const totales = totalesByDocente[docenteId];
    if (!totales) return 'gray';
    if (totales.errors.length > 0) return 'red';
    if (totales.warnings.length > 0) return 'yellow';
    return 'green';
  };

  const handleUpdateContrato = async () => {
    if (!editingDocente) return;
    try {
      setLoading(true);
      await actualizarHorasContrato(editingDocente.id, tempHorasContrato);
      setShowEditDocenteModal(false);
      setEditingDocente(null);
      // alert('Horas de contrato actualizadas'); // Feedback visual es suficiente con el cambio en UI
    } catch (e) {
      console.error(e);
      alert('Error al actualizar horas de contrato');
    } finally {
      setLoading(false);
    }
  };

  const openEditDocente = (docente: DocenteCargaHoraria) => {
    setEditingDocente(docente);
    setTempHorasContrato(docente.horasContrato);
    setShowEditDocenteModal(true);
  };

  const handleDeleteDocente = async (id: string, nombre: string) => {
    const asignacionesDocente = asignaciones.filter(a => a.docenteId === id);
    const confirmMessage = asignacionesDocente.length > 0
      ? `¿Estás seguro de que deseas eliminar al docente "${nombre}"? Se eliminarán también sus ${asignacionesDocente.length} asignaciones.`
      : `¿Estás seguro de que deseas eliminar al docente "${nombre}"?`;

    if (window.confirm(confirmMessage)) {
      try {
        setLoading(true);
        // Eliminar asignaciones primero (si las hay)
        // Nota: deleteAsignacionCarga elimina de Firestore.
        // Como estamos suscritos, el estado se actualizará automáticamente.
        const deletePromises = asignacionesDocente.map(a => deleteAsignacionCarga(a.id));
        await Promise.all(deletePromises);
        
        // Eliminar docente
        await eliminarDocente(id);
        // alert('Docente eliminado exitosamente'); // Feedback visual por desaparición es suficiente
      } catch (e) {
        console.error(e);
        alert('Error al eliminar docente');
      } finally {
        setLoading(false);
      }
    }
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
                Cargas horarias
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
                disabled={loading} 
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
              onClick={handleExportPDF}
              disabled={exportandoPDF || docentes.length === 0}
              className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white rounded-lg transition-all duration-200 shadow-sm group disabled:opacity-50"
            >
              {exportandoPDF ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              )}
              <span className="text-xs font-medium mt-1">{exportandoPDF ? 'Generando...' : 'Exportar PDF'}</span>
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
              disabled={loading} 
              className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-amber-500 disabled:hover:to-orange-600 group"
            >
              {loading ? (
                <Loader2 className="w-5 h-4 animate-spin" />
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
      {errorExportacion && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <div>
            <h3 className="font-medium text-red-700 dark:text-red-300">Error de exportación</h3>
            <p className="text-sm text-red-600 dark:text-red-400">{errorExportacion}</p>
          </div>
          <button
            onClick={() => setErrorExportacion(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
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
                    <span>Otras Funciones</span>
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
                    {/* Estado */}
                    <td className="px-1 py-2 sticky left-0 z-10 bg-inherit">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${semaforoColor === 'green' ? 'bg-green-500' : semaforoColor === 'yellow' ? 'bg-yellow-500' : semaforoColor === 'red' ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                        {esPrimeraAsignacionDocente && (
                          <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium truncate max-w-[70px]">
                            {asignacion.docenteNombre}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Docente */}
                    <td className="px-1 py-2 sticky left-14 z-10 bg-inherit">
                      {!tieneMultiplesAsignaturas || esPrimeraAsignacionDocente ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <select
                              value={asignacion.docenteId}
                              onChange={(e) => actualizarAsignacion(asignacion.id, 'docenteId', e.target.value)}
                              className={`w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs ${tieneMultiplesAsignaturas ? 'font-medium' : ''}`}
                            >
                              {(docentesFiltrados.length > 0 ? docentesFiltrados : docentes).map((d) => (
                                <option key={d.id} value={d.id}>{d.nombre}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const doc = docentes.find(d => d.id === asignacion.docenteId);
                                if (doc) openEditDocente(doc);
                              }}
                              className="p-1 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
                              title="Editar contrato docente"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          </div>
                          {tieneMultiplesAsignaturas && (
                            <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                              {asignacionesDocente.length} asig.
                            </div>
                          )}
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
                      {tieneMultiplesAsignaturas && !esPrimeraAsignacionDocente && (
                        <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">Adicional</div>
                      )}
                    </td>
                    {/* Funciones lectivas */}
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
                    {/* Cursos */}
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
                            HB (Disp): {totales.HB}
                          </div>
                        </div>
                      )}
                    </td>
                    {/* Acciones */}
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
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900 dark:text-white">{docente.nombre}</h4>
                              <button
                                onClick={() => handleDeleteDocente(docente.id, docente.nombre)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Eliminar docente"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className={`w-3 h-3 rounded-full ${getSemaforoColor(docente.id) === 'green' ? 'bg-green-500' : getSemaforoColor(docente.id) === 'yellow' ? 'bg-yellow-500' : getSemaforoColor(docente.id) === 'red' ? 'bg-red-500' : 'bg-gray-500'}`} />
                          </div>
                          {totales && (
                            <div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-2">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Contrato:</span>
                                  <button 
                                    onClick={() => openEditDocente(docente)}
                                    className={`ml-1 font-medium hover:underline flex items-center gap-1 inline-flex ${
                                      (() => {
                                        try {
                                          const req = calculateRequiredContractHours(totales.totalHorasLectivas);
                                          return req !== docente.horasContrato ? 'text-amber-600 dark:text-amber-400 font-bold' : 'hover:text-amber-600 dark:hover:text-amber-400';
                                        } catch { return 'hover:text-amber-600 dark:hover:text-amber-400'; }
                                      })()
                                    }`}
                                    title={(() => {
                                      try {
                                        const req = calculateRequiredContractHours(totales.totalHorasLectivas);
                                        return req !== docente.horasContrato ? `Sugerido: ${req}h (Click para ajustar)` : "Click para editar horas de contrato";
                                      } catch { return "Click para editar horas de contrato"; }
                                    })()}
                                  >
                                    {docente.horasContrato}h 
                                    {(() => {
                                        try {
                                          const req = calculateRequiredContractHours(totales.totalHorasLectivas);
                                          return req !== docente.horasContrato ? <AlertTriangle className="w-3 h-3" /> : <Edit className="w-3 h-3 opacity-50" />;
                                        } catch { return <Edit className="w-3 h-3 opacity-50" />; }
                                    })()}
                                  </button>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">HA:</span>
                                  <span className="ml-1 font-medium text-blue-600 dark:text-blue-400" title="Clases + Funciones / Máximo">{totales.totalHorasLectivas}/{totales.HA}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">HB:</span>
                                  <span className="ml-1 font-medium text-green-600 dark:text-green-400" title="Disponible">{totales.HB}</span>
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
                                  <h5 className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Otras funciones:</h5>
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
                  <h3 className="text-xl font-semibold mb-4">Resumen por Otras Funciones</h3>
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
                          <p className="text-gray-500 dark:text-gray-400 text-center">No hay funciones asignadas.</p>
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
                  <h3 className="text-xl font-semibold mb-6">Resumen Global Simplificado</h3>
                  {(() => {
                    let horasContratoTotal = 0;
                    let horasClasesTotales = 0; // Suma de horas por curso (clases lectivas)
                    let horasFuncionesTotales = 0; // Suma de horas de funciones lectivas
                    docentes.forEach(doc => {
                      horasContratoTotal += typeof doc.horasContrato === 'number' ? doc.horasContrato : 0;
                    });
                    asignaciones.forEach(asig => {
                      if (asig.horasPorCurso) Object.values(asig.horasPorCurso).forEach(h => typeof h === 'number' && (horasClasesTotales += h));
                      (asig.funcionesLectivas || []).forEach(f => typeof f.horas === 'number' && (horasFuncionesTotales += f.horas));
                    });
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Horas Contrato (suma)</h4>
                          <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">{horasContratoTotal}</div>
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Total de horas contratadas de todos los docentes.</p>
                        </div>
                        <div className="p-6 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 shadow-sm">
                          <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Horas de Clases (lectivas)</h4>
                          <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">{horasClasesTotales}</div>
                          <p className="mt-2 text-xs text-blue-600 dark:text-blue-300">Suma de horas asignadas a cursos en todas las asignaciones.</p>
                        </div>
                        <div className="p-6 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 shadow-sm">
                          <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Horas Otras Funciones</h4>
                          <div className="text-4xl font-bold text-green-600 dark:text-green-400">{horasFuncionesTotales}</div>
                          <p className="mt-2 text-xs text-green-600 dark:text-green-300">Suma de horas de otras funciones asignadas (coordinaciones, etc.).</p>
                        </div>
                      </div>
                    );
                  })()}
                  {validaciones.length > 0 && (
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Advertencias/Errores ({validaciones.length})</h4>
                      <ul className="text-xs space-y-1 max-h-40 overflow-y-auto pr-1">
                        {validaciones.slice(0, 10).map((v,i) => (
                          <li key={i} className={`flex items-center gap-1 ${v.tipo === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>{v.tipo === 'error' ? '❌' : '⚠️'}<span>{v.mensaje}</span></li>
                        ))}
                        {validaciones.length > 10 && <li className="italic text-gray-500 dark:text-gray-400">Y {validaciones.length - 10} más...</li>}
                      </ul>
                    </div>
                  )}
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
            <div className="px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              Fuente: Generado por algoritmo automático
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
                  {(() => {
                    // Utilidad para convertir HH:MM a minutos
                    const toMin = (t: string) => {
                      const [h, m] = t.split(":").map(Number);
                      return h * 60 + m;
                    };
                    const rows: Array<{ type: 'block' | 'break'; label: string; start?: string; end?: string; bloque?: number }> = [];
                    for (let i = 0; i < HORARIO_BLOQUES.length; i++) {
                      const b = HORARIO_BLOQUES[i];
                      rows.push({ type: 'block', label: `Bloque ${b.bloque}`, start: b.inicio, end: b.fin, bloque: b.bloque });
                      const next = HORARIO_BLOQUES[i + 1];
                      if (next) {
                        const gap = toMin(next.inicio) - toMin(b.fin);
                        if (gap > 0) {
                          const isLunch = b.fin === '13:00' && next.inicio === '13:40';
                          rows.push({ type: 'break', label: isLunch ? 'Almuerzo' : 'Recreo', start: b.fin, end: next.inicio });
                        }
                      }
                    }

                    return rows.map((row, idx) => {
                      if (row.type === 'break') {
                        return (
                          <tr key={`break_${idx}`} className="border-b border-gray-100 dark:border-gray-700">
                            <td className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${row.label === 'Almuerzo' ? 'text-amber-700' : 'text-slate-600'}`}>
                              {row.label} {row.start && row.end ? `(${row.start} – ${row.end})` : ''}
                            </td>
                            {DIAS_SEMANA.map((dia) => (
                              <td key={`${dia}_break_${idx}`} className={`px-3 py-2 align-top ${row.label === 'Almuerzo' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}></td>
                            ))}
                          </tr>
                        );
                      }
                      const b = HORARIO_BLOQUES.find(x => x.bloque === row.bloque)!;
                      return (
                        <tr key={`block_${row.bloque}`} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {row.bloque}. {row.start} - {row.end}
                          </td>
                          {DIAS_SEMANA.map((dia) => {
                            const data = (horariosGenerados || horariosActuales)?.[dia]?.[String(row.bloque!)]?.[cursoVista];
                            const fridayAfterOne = dia === 'Viernes' && b && b.fin > '13:00';
                            return (
                              <td key={`${dia}_${row.bloque}`} className={`px-3 py-2 align-top ${fridayAfterOne ? 'bg-red-50 dark:bg-red-900/20' : ''}`} title={fridayAfterOne ? 'No permitido (Viernes > 13:00)' : ''}>
                                {data && (data.asignatura || data.profesor) ? (
                                  <div className={`p-2 rounded border ${fridayAfterOne ? 'border-red-300 dark:border-red-700 bg-red-50/60 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750'}`}>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.asignatura}</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">{data.profesor}</div>
                                  </div>
                                ) : (
                                  <div className={`h-10 rounded ${fridayAfterOne ? 'bg-red-50/60 dark:bg-red-900/10 border border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700'}`}></div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })()}
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
                <h5 className="font-medium text-green-900 dark:text-green-100">Otras Funciones</h5>
                <p className="text-sm text-green-700 dark:text-green-300">Se suman a las horas lectivas (HA)</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                <UserCog className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-medium text-amber-900 dark:text-amber-100">Horas No Lectivas (HB)</h5>
                <p className="text-sm text-amber-700 dark:text-amber-300">Capacidad disponible tras asignar clases y funciones (en bloques de 45 min)</p>
              </div>
            </div>
          </div>
          
          <div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
              <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Fórmulas de cálculo</h5>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-mono">HA</div>
                  <span className="text-gray-600 dark:text-gray-400">Max (Clases + Funciones) = 65% del Contrato</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-mono">HB</div>
                  <span className="text-gray-600 dark:text-gray-400">Disponible = (Contrato - Clases - Funciones) / 45 min</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-mono">HC</div>
                  <span className="text-gray-600 dark:text-gray-400">Contrato (60 min) vs Asignado (45 min)</span>
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

      {showEditDocenteModal && editingDocente && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-96 max-w-full overflow-hidden animate-scaleIn">
            <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Edit className="w-5 h-5" />
                  Editar Contrato
                </h2>
                <button 
                  onClick={() => setShowEditDocenteModal(false)} 
                  className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-all duration-200"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <h3 className="font-medium text-gray-900 dark:text-white">{editingDocente.nombre}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{editingDocente.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Horas de Contrato
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={tempHorasContrato} 
                    onChange={(e) => setTempHorasContrato(parseInt(e.target.value) || 0)} 
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200" 
                    min={1} 
                    max={44} 
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">
                    horas
                  </div>
                </div>
                
                {editingDocente && totalesByDocente[editingDocente.id] && (
                  <div className="mt-2">
                     {(() => {
                        try {
                          const lectivas = totalesByDocente[editingDocente.id].totalHorasLectivas;
                          if (lectivas > 0) {
                            const sugerido = calculateRequiredContractHours(lectivas);
                            if (sugerido !== tempHorasContrato) {
                              return (
                                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Para {lectivas} horas lectivas, se sugiere un contrato de <strong>{sugerido} horas</strong>.</span>
                                  <button 
                                    onClick={() => setTempHorasContrato(sugerido)}
                                    className="ml-1 underline font-medium hover:text-amber-800 dark:hover:text-amber-200"
                                  >
                                    Aplicar
                                  </button>
                                </div>
                              );
                            }
                          }
                        } catch (e) {}
                        return null;
                     })()}
                  </div>
                )}

                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Ajuste las horas de contrato para recalcular HA y HB correctamente.
                </p>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button 
                  onClick={() => setShowEditDocenteModal(false)} 
                  className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200" 
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleUpdateContrato} 
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg shadow-sm disabled:opacity-50 transition-all duration-200 flex items-center gap-2" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Actualizar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReglasModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="p-5 bg-gradient-to-r from-cyan-500 to-sky-600 text-white flex items-center justify-between">
              <h2 className="text-lg font-semibold">Reglas para generar horario</h2>
              <button onClick={() => setShowReglasModal(false)} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-all duration-200">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1">Máximo de horas de mecánica juntas</label>
                <select
                  value={reglas.maxConsecutivasMecanica}
                  onChange={(e) => setReglas((r) => ({ ...r, maxConsecutivasMecanica: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Máximo de horas de plan general juntas</label>
                <select
                  value={reglas.maxConsecutivasPlanGeneral}
                  onChange={(e) => setReglas((r) => ({ ...r, maxConsecutivasPlanGeneral: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  {[1,2,3].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium">Asignaturas prácticas en horario P.M.</label>
                  <p className="text-xs text-gray-500">Ubica taller/práctica/laboratorio en bloques desde 13:40</p>
                </div>
                <input
                  type="checkbox"
                  checked={!!reglas.practicasPM}
                  onChange={(e) => setReglas((r) => ({ ...r, practicasPM: e.target.checked }))}
                  className="w-5 h-5"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium">3º medio sólo horas de plan general</label>
                  <p className="text-xs text-gray-500">Para cursos 3º*, restringe a asignaturas de plan general</p>
                </div>
                <input
                  type="checkbox"
                  checked={!!reglas.terceroSoloPlanGeneral}
                  onChange={(e) => setReglas((r) => ({ ...r, terceroSoloPlanGeneral: e.target.checked }))}
                  className="w-5 h-5"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button onClick={() => setShowReglasModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">Cancelar</button>
              <button
                onClick={async () => { setShowReglasModal(false); await generarHorarioIA(); }}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Generar con estas reglas
              </button>
            </div>
          </div>
        </div>
      )}

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
