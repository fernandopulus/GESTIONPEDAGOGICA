import React, { useEffect, useMemo, useState } from 'react';
import { User } from '../../types';
import { ASIGNATURAS, CURSOS } from '../../constants';
import { getAllUsers } from '../../src/firebaseHelpers/users';
import { guardarEvaluacionEnsayo, listarEvaluacionesEnsayo, EvaluacionEnsayoDoc, eliminarEvaluacionEnsayo, actualizarEvaluacionEnsayo } from '../../src/firebaseHelpers/evaluacionEnsayoHelper';
import { CheckCircle, Circle, User as UserIcon, Save, Loader2, ListOrdered, ClipboardList, ChevronDown, ChevronRight, Download, Pencil, Trash2, X } from 'lucide-react';

type Indicador = 1|2|3|4|5|6|7|8|9|10;

interface EstudianteItem {
  id: string;
  nombre: string;
}

interface Props {
  currentUser: User;
}

// Normaliza curso como en otros módulos
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

const INDICADORES: Indicador[] = [1,2,3,4,5,6,7,8,9,10];
const INDICADORES_DESCRIPCION: Record<Indicador, string> = {
  1: 'Llega puntualmente a la evaluación.',
  2: 'Sigue las instrucciones dadas por el/la docente respecto a su ubicación en la sala de clases.',
  3: 'Sigue las instrucciones dadas por el/la docente respecto al inicio de la evaluación.',
  4: 'Se mantiene en silencio mientras desarrolla la evaluación.',
  5: 'Mantiene su celular o cualquier equipo tecnológico en silencio y guardado.',
  6: 'Levanta la mano si requiere consultar alguna duda.',
  7: 'Espera en silencio mientras es atendido por el/la docente para resolver sus dudas.',
  8: 'Se observa que el/la estudiante realiza el esfuerzo por llevar a término satisfactorio su evaluación.',
  9: 'Respeta los tiempos considerados para realizar la evaluación y se mantiene en silencio una vez finalizada.',
  10: 'Entrega el instrumento de evaluación cuando se le solicita.',
};

const EvaluacionEnsayo: React.FC<Props> = ({ currentUser }) => {
  const [tab, setTab] = useState<'captura'|'guardados'>('captura');
  const [curso, setCurso] = useState<string>('');
  const [asignatura, setAsignatura] = useState<string>('Lengua y Literatura');
  const [profesorId, setProfesorId] = useState<string>('');
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargandoGuardados, setCargandoGuardados] = useState(false);
  const [guardados, setGuardados] = useState<EvaluacionEnsayoDoc[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<EvaluacionEnsayoDoc|null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // filtros guardados
  const [filtroCurso, setFiltroCurso] = useState<string>('');
  const [filtroAsignatura, setFiltroAsignatura] = useState<string>('');
  const [filtroProfesorId, setFiltroProfesorId] = useState<string>('');
  const [soloMios, setSoloMios] = useState<boolean>(true);
  const [fechaDesde, setFechaDesde] = useState<string>(''); // yyyy-mm-dd
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [estudiantes, setEstudiantes] = useState<EstudianteItem[]>([]);
  // estado: por estudiante -> indicador -> boolean (true=7.0, false=2.0)
  const [marcas, setMarcas] = useState<Record<string, Record<Indicador, boolean>>>({});
  // ausentes por estudiante
  const [ausentes, setAusentes] = useState<Record<string, boolean>>({});

  // cargar usuarios
  useEffect(() => {
    setCargando(true);
    getAllUsers().then((list) => setUsuarios(list)).finally(() => setCargando(false));
  }, []);

  // profesores desde usuarios con profile PROFESORADO
  const profesores = useMemo(() => usuarios.filter(u => u.profile === 'PROFESORADO' || (u as any).profile ===  'PROFESORADO'), [usuarios]);

  // estudiantes por curso seleccionado
  useEffect(() => {
    const norm = normalizeCurso(curso);
    const est = usuarios.filter(u => (u.profile as any) === 'ESTUDIANTE' && normalizeCurso(u.curso || '') === norm)
      .map(u => ({ id: u.id, nombre: u.nombreCompleto }));
    setEstudiantes(est);
    // inicializar marcas en 7.0 (true)
    const init: Record<string, Record<Indicador, boolean>> = {};
    est.forEach(e => {
      init[e.id] = {} as any;
      INDICADORES.forEach(i => { init[e.id][i] = true; });
    });
    setMarcas(init);
    // limpiar ausentes al cambiar curso
    setAusentes({});
  }, [curso, usuarios]);

  const toggle = (estId: string, indicador: Indicador) => {
    setMarcas(prev => ({
      ...prev,
      [estId]: { ...prev[estId], [indicador]: !prev[estId]?.[indicador] }
    }));
  };

  const promedio = (estId: string): number => {
    if (ausentes[estId]) return 0;
    const m = marcas[estId];
    if (!m) return 0;
    const notas = INDICADORES.map(i => m[i] ? 7.0 : 2.0);
    const avg = notas.reduce((a,b)=>a+b,0)/INDICADORES.length;
    return Math.round(avg*10)/10; // 1 decimal
  };

  // Resumen de curso por indicador: porcentaje de 7.0 (on) y promedio en escala 1-7
  const resumenIndicadores = useMemo(() => {
    if (estudiantes.length === 0) return INDICADORES.map(i => ({ indicador: i, porcentajeOn: 0, promedio: 0 }));
    const presentes = estudiantes.filter(e => !ausentes[e.id]);
    if (presentes.length === 0) return INDICADORES.map(i => ({ indicador: i, porcentajeOn: 0, promedio: 0 }));
    return INDICADORES.map((i) => {
      const onCount = presentes.reduce((acc, e) => acc + (marcas[e.id]?.[i] ? 1 : 0), 0);
      const porcentajeOn = Math.round((onCount / presentes.length) * 100);
      const prom = presentes.reduce((acc, e) => acc + (marcas[e.id]?.[i] ? 7 : 2), 0) / presentes.length;
      return { indicador: i, porcentajeOn, promedio: Math.round(prom * 10) / 10 };
    });
  }, [estudiantes, marcas, ausentes]);

  const handleGuardar = async () => {
    if (!curso || !asignatura || !profesorId || estudiantes.length === 0) return;
    setGuardando(true);
    try {
      await guardarEvaluacionEnsayo({
        curso: normalizeCurso(curso),
        asignatura,
        profesorId,
        profesorNombre: usuarios.find(u=>u.id===profesorId)?.nombreCompleto || '',
        creadorId: currentUser.id,
        creadorNombre: currentUser.nombreCompleto,
        fecha: new Date().toISOString(),
        resultados: estudiantes.map(e => {
          const isAusente = !!ausentes[e.id];
          return {
            estudianteId: e.id,
            estudianteNombre: e.nombre,
            indicadores: INDICADORES.map(i => (marcas[e.id]?.[i] ? 7.0 : 2.0)),
            promedio: isAusente ? null : promedio(e.id),
            ausente: isAusente,
          };
        })
      });
      alert('Evaluación guardada');
    } catch (e) {
      console.error('Error guardando evaluación de ensayo', e);
      alert('No se pudo guardar. Reintenta.');
    } finally {
      setGuardando(false);
    }
  };

  // Cargar guardados al entrar a la pestaña "guardados"
  useEffect(() => {
    const load = async () => {
      if (tab !== 'guardados') return;
      setCargandoGuardados(true);
      try {
        const rows = await listarEvaluacionesEnsayo({
          max: 200,
          filtroCurso: filtroCurso ? normalizeCurso(filtroCurso) : undefined,
          filtroAsignatura: filtroAsignatura || undefined,
          filtroProfesorId: filtroProfesorId || undefined,
          filtroCreadorId: soloMios ? currentUser.id : undefined,
        });
        // filtro por fecha en cliente
        let filtered = rows;
        if (fechaDesde) {
          const d = new Date(fechaDesde + 'T00:00:00');
          filtered = filtered.filter(r => (r.createdAt?.toDate?.() || new Date(r.fecha)) >= d);
        }
        if (fechaHasta) {
          const h = new Date(fechaHasta + 'T23:59:59');
          filtered = filtered.filter(r => (r.createdAt?.toDate?.() || new Date(r.fecha)) <= h);
        }
        setGuardados(filtered);
      } finally {
        setCargandoGuardados(false);
      }
    };
    load();
  }, [tab, currentUser.id, filtroCurso, filtroAsignatura, filtroProfesorId, soloMios, fechaDesde, fechaHasta]);

  return (
    <div className="space-y-6">
      {/* Pestañas */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          className={`px-3 py-2 text-sm inline-flex items-center gap-2 border-b-2 ${tab==='captura' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={()=>setTab('captura')}
        >
          <ClipboardList className="w-4 h-4"/> Captura
        </button>
        <button
          className={`px-3 py-2 text-sm inline-flex items-center gap-2 border-b-2 ${tab==='guardados' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={()=>setTab('guardados')}
        >
          <ListOrdered className="w-4 h-4"/> Guardados
        </button>
      </div>

      {tab === 'guardados' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ensayos guardados</h3>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                  onClick={() => exportGuardadosCSV(guardados)}
                  title="Exportar CSV (aplica filtros)"
                >
                  <Download className="w-3.5 h-3.5"/> Exportar CSV
                </button>
                <button
                  className="text-xs text-slate-500 hover:text-slate-700"
                  onClick={()=>setTab('captura')}
                >Ir a captura</button>
              </div>
            </div>
            {/* Dashboard agregado */}
            <DashboardGuardados guardados={guardados} />
            {/* Filtros */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-slate-500">Curso</label>
                <select value={filtroCurso} onChange={e=>setFiltroCurso(e.target.value)} className="w-full border rounded-md px-2 py-1 text-sm">
                  <option value="">Todos</option>
                  {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500">Asignatura</label>
                <select value={filtroAsignatura} onChange={e=>setFiltroAsignatura(e.target.value)} className="w-full border rounded-md px-2 py-1 text-sm">
                  <option value="">Todas</option>
                  {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500">Profesor/a</label>
                <select value={filtroProfesorId} onChange={e=>setFiltroProfesorId(e.target.value)} className="w-full border rounded-md px-2 py-1 text-sm">
                  <option value="">Todos</option>
                  {usuarios.filter(u=>u.profile==='PROFESORADO').map(p => (
                    <option key={p.id} value={p.id}>{p.nombreCompleto}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={soloMios} onChange={e=>setSoloMios(e.target.checked)} /> Solo mis registros
                </label>
              </div>
              <div>
                <label className="block text-xs text-slate-500">Desde</label>
                <input type="date" value={fechaDesde} onChange={e=>setFechaDesde(e.target.value)} className="w-full border rounded-md px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Hasta</label>
                <input type="date" value={fechaHasta} onChange={e=>setFechaHasta(e.target.value)} className="w-full border rounded-md px-2 py-1 text-sm" />
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/40">
                    <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500">Detalle</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Fecha</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Curso</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Asignatura</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Profesor</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Creador/a</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Nº Estudiantes</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Exportar</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargandoGuardados && (
                    <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>
                  )}
                  {!cargandoGuardados && guardados.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-500">No hay ensayos guardados.</td></tr>
                  )}
                  {guardados.map(g => (
                    <React.Fragment key={g.id}>
                      <tr className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50">
                        <td className="px-2 py-2">
                          <button
                            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
                            onClick={()=>setExpanded(prev=>({ ...prev, [g.id]: !prev[g.id] }))}
                          >
                            {expanded[g.id] ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                            {expanded[g.id] ? 'Ocultar' : 'Ver'}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-sm">{(g.createdAt?.toDate?.() || new Date(g.fecha)).toLocaleString()}</td>
                        <td className="px-3 py-2 text-sm">{g.curso}</td>
                        <td className="px-3 py-2 text-sm">{g.asignatura}</td>
                        <td className="px-3 py-2 text-sm">{g.profesorNombre}</td>
                        <td className="px-3 py-2 text-sm">{g.creadorNombre}</td>
                        <td className="px-3 py-2 text-sm">{g.resultados?.length ?? 0}</td>
                        <td className="px-3 py-2 text-sm">
                          <button
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                            onClick={() => exportEvaluacionCSV(g)}
                            title="Exportar CSV de esta evaluación"
                          >
                            <Download className="w-3.5 h-3.5"/> CSV
                          </button>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                              onClick={() => setEditing(g)}
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5"/> Editar
                            </button>
                            <button
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50"
                              onClick={async () => {
                                const ok = confirm('¿Eliminar esta evaluación? Esta acción no se puede deshacer.');
                                if (!ok) return;
                                try {
                                  await eliminarEvaluacionEnsayo(g.id);
                                  // refrescar lista
                                  setGuardados(prev => prev.filter(x => x.id !== g.id));
                                } catch (e) {
                                  alert('No se pudo eliminar');
                                  console.error(e);
                                }
                              }}
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5"/> Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded[g.id] && (
                        <tr className="bg-slate-50/40 dark:bg-slate-900/30">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Estudiante</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Ausente</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Promedio</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Indicadores</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(g.resultados || []).map((r, idx) => (
                                    <tr key={r.estudianteId || idx} className="border-t border-slate-100 dark:border-slate-700/40">
                                      <td className="px-3 py-1.5 whitespace-nowrap">{r.estudianteNombre}</td>
                                      <td className="px-3 py-1.5">
                                        {r.ausente ? (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs">Sí</span>
                                        ) : (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs">No</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-1.5 font-semibold">{r.ausente ? '—' : (r.promedio ?? 0).toFixed(1)}</td>
                                      <td className="px-3 py-1.5">
                                        <div className="flex items-center gap-1">
                                          {(r.indicadores || []).map((val, iIdx) => (
                                            <span
                                              key={iIdx}
                                              className={`w-4 h-4 rounded-full border ${val >= 7 ? 'bg-emerald-500 border-emerald-600' : 'bg-red-400 border-red-500'}`}
                                              title={`${iIdx+1}: ${val.toFixed(1)}`}
                                            />
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Modal editar evaluación */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>!savingEdit && setEditing(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Editar evaluación</h3>
              <button className="p-1 text-slate-500 hover:text-slate-700" onClick={()=>!savingEdit && setEditing(null)}><X className="w-4 h-4"/></button>
            </div>
            <form onSubmit={async (e)=>{
              e.preventDefault();
              setSavingEdit(true);
              try {
                await actualizarEvaluacionEnsayo(editing.id, {
                  curso: editing.curso,
                  asignatura: editing.asignatura,
                  profesorId: editing.profesorId,
                  profesorNombre: editing.profesorNombre,
                  creadorId: editing.creadorId,
                  creadorNombre: editing.creadorNombre,
                  fecha: editing.fecha,
                });
                // Actualizar lista local
                setGuardados(prev => prev.map(it => it.id === editing.id ? { ...it, ...editing } : it));
                setEditing(null);
              } catch (err) {
                console.error(err);
                alert('No se pudo guardar cambios');
              } finally {
                setSavingEdit(false);
              }
            }} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500">Curso</label>
                  <select value={editing.curso} onChange={e=>setEditing({...editing, curso: e.target.value })} className="w-full border rounded-md px-2 py-1 text-sm">
                    {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Asignatura</label>
                  <select value={editing.asignatura} onChange={e=>setEditing({...editing, asignatura: e.target.value })} className="w-full border rounded-md px-2 py-1 text-sm">
                    {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Profesor/a</label>
                  <select value={editing.profesorId} onChange={e=>{
                    const id = e.target.value; const prof = usuarios.find(u=>u.id===id);
                    setEditing({...editing, profesorId: id, profesorNombre: prof?.nombreCompleto || editing.profesorNombre });
                  }} className="w-full border rounded-md px-2 py-1 text-sm">
                    {usuarios.filter(u=>u.profile==='PROFESORADO').map(p => <option key={p.id} value={p.id}>{p.nombreCompleto}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Fecha (ISO)</label>
                  <input type="datetime-local" value={new Date(editing.fecha).toISOString().slice(0,16)} onChange={e=>{
                    const iso = new Date(e.target.value).toISOString();
                    setEditing({...editing, fecha: iso});
                  }} className="w-full border rounded-md px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="px-3 py-1.5 text-sm rounded-md border" onClick={()=>setEditing(null)} disabled={savingEdit}>Cancelar</button>
                <button type="submit" className="px-3 py-1.5 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50" disabled={savingEdit}>{savingEdit ? 'Guardando…' : 'Guardar cambios'}</button>
              </div>
            </form>
            <div className="mt-4 text-xs text-slate-500">Nota: La edición de resultados individuales no está habilitada aún en este modal.</div>
          </div>
        </div>
      )}
      {tab === 'captura' && (
      <>
      {/* Cabecera descriptiva de indicadores */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Indicadores evaluados</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {INDICADORES.map(i => (
            <div key={i} className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold shrink-0">{i}</span>
              <p className="text-slate-700 dark:text-slate-300">{INDICADORES_DESCRIPCION[i]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen gráfico por indicador */}
      {estudiantes.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Desempeño del curso por indicador</h3>
          <div className="space-y-2">
            {resumenIndicadores.map(r => (
              <div key={r.indicador} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-12 md:col-span-3 lg:col-span-2 text-xs text-slate-600 dark:text-slate-300">
                  {r.indicador}. {INDICADORES_DESCRIPCION[r.indicador]}
                </div>
                <div className="col-span-12 md:col-span-6 lg:col-span-7">
                  <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className="h-3 bg-emerald-500" style={{ width: `${r.porcentajeOn}%` }} />
                  </div>
                </div>
                <div className="col-span-12 md:col-span-3 lg:col-span-3 flex justify-between text-xs text-slate-700 dark:text-slate-200">
                  <span className="font-medium">{r.porcentajeOn}% con 7.0</span>
                  <span>Prom: {r.promedio.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Curso</label>
          <select value={curso} onChange={(e)=>setCurso(e.target.value)} className="w-full border rounded-md px-3 py-2">
            <option value="">Seleccione…</option>
            {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Asignatura</label>
          <select value={asignatura} onChange={(e)=>setAsignatura(e.target.value)} className="w-full border rounded-md px-3 py-2">
            {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Profesor responsable</label>
          <select value={profesorId} onChange={(e)=>setProfesorId(e.target.value)} className="w-full border rounded-md px-3 py-2">
            <option value="">Seleccione…</option>
            {profesores.map(p => <option key={p.id} value={p.id}>{p.nombreCompleto}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleGuardar} disabled={!curso || !asignatura || !profesorId || guardando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/40">
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Estudiante</th>
              {INDICADORES.map(i => (
                <th key={i} className="px-2 py-2 text-center text-xs font-semibold text-slate-500">{i}</th>
              ))}
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">Prom.</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={12} className="px-4 py-6 text-center text-slate-500">Cargando estudiantes…</td></tr>
            )}
            {!cargando && estudiantes.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-6 text-center text-slate-500">Seleccione curso para listar estudiantes.</td></tr>
            )}
            {estudiantes.map(e => (
              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50">
                <td className="px-4 py-2 text-sm whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2"><UserIcon className="w-4 h-4 text-slate-400" /> {e.nombre}</span>
                    <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <input type="checkbox" checked={!!ausentes[e.id]} onChange={(ev)=>setAusentes(prev=>({ ...prev, [e.id]: ev.target.checked }))} />
                      Ausente
                    </label>
                  </div>
                </td>
                {INDICADORES.map(i => {
                  const on = marcas[e.id]?.[i] ?? true;
                  return (
                    <td key={i} className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={()=>!ausentes[e.id] && toggle(e.id, i)}
                        disabled={!!ausentes[e.id]}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition ${ausentes[e.id] ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200' : on ? 'bg-green-100 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-600'}`}
                        title={ausentes[e.id] ? 'Ausente' : (on ? '7.0' : '2.0')}
                      >
                        {on ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-semibold text-slate-700">{ausentes[e.id] ? '—' : promedio(e.id).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
};

export default EvaluacionEnsayo;

// Dashboard de guardados: métricas agregadas según filtros aplicados
const DashboardGuardados: React.FC<{ guardados: EvaluacionEnsayoDoc[] }> = ({ guardados }) => {
  const stats = React.useMemo(() => {
    let evaluaciones = guardados.length;
    let estudiantes = 0;
    let presentes = 0;
    let ausentes = 0;
    let sumaPromedios = 0;
    let cuentaPromedios = 0;
    const indicadoresOn: number[] = Array(10).fill(0);
    const indicadoresTotal: number[] = Array(10).fill(0);

    guardados.forEach(g => {
      const res = g.resultados || [];
      estudiantes += res.length;
      res.forEach(r => {
        if (r.ausente) {
          ausentes += 1;
        } else {
          presentes += 1;
          if (typeof r.promedio === 'number') {
            sumaPromedios += r.promedio;
            cuentaPromedios += 1;
          }
          (r.indicadores || []).forEach((val, idx) => {
            if (val >= 7) indicadoresOn[idx] += 1;
            indicadoresTotal[idx] += 1;
          });
        }
      });
    });

    const promedioGlobal = cuentaPromedios > 0 ? Math.round((sumaPromedios / cuentaPromedios) * 10) / 10 : 0;
    const indicadoresPct = indicadoresOn.map((on, i) => {
      const total = indicadoresTotal[i] || 0;
      return total > 0 ? Math.round((on / total) * 100) : 0;
    });
    return { evaluaciones, estudiantes, presentes, ausentes, promedioGlobal, indicadoresPct };
  }, [guardados]);

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Evaluaciones" value={stats.evaluaciones} />
        <StatCard label="Estudiantes" value={stats.estudiantes} />
        <StatCard label="Presentes" value={stats.presentes} />
        <StatCard label="Ausentes" value={stats.ausentes} />
        <StatCard label="Prom. global" value={stats.promedioGlobal.toFixed(1)} />
      </div>
      <div>
        <h4 className="text-xs font-semibold text-slate-500 mb-2">Porcentaje 7.0 por indicador</h4>
        <div className="space-y-2">
          {INDICADORES.map((i, idx) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-12 md:col-span-3 lg:col-span-2 text-xs text-slate-600 dark:text-slate-300">
                {i}. {INDICADORES_DESCRIPCION[i]}
              </div>
              <div className="col-span-12 md:col-span-6 lg:col-span-7">
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-3 bg-emerald-500" style={{ width: `${stats.indicadoresPct[idx]}%` }} />
                </div>
              </div>
              <div className="col-span-12 md:col-span-3 lg:col-span-3 flex justify-end text-xs text-slate-700 dark:text-slate-200">
                <span className="font-medium">{stats.indicadoresPct[idx]}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{value}</div>
  </div>
);

// Utilidades CSV
function csvEscape(value: any): string {
  if (value === null || value === undefined) return '';
  const s = String(value).replace(/"/g, '""');
  if (/[",\n]/.test(s)) return '"' + s + '"';
  return s;
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportEvaluacionCSV(g: EvaluacionEnsayoDoc) {
  const headers = [
    'EvaluacionID','Fecha','Curso','Asignatura','Profesor','Creador','EstudianteID','Estudiante','Ausente','Promedio',
    ...INDICADORES.map((i)=>`Indicador_${i}`)
  ];
  const fecha = (g.createdAt?.toDate?.() || new Date(g.fecha)).toISOString();
  const rows: string[][] = [headers];
  (g.resultados || []).forEach(r => {
    const base = [g.id, fecha, g.curso, g.asignatura, g.profesorNombre, g.creadorNombre, r.estudianteId, r.estudianteNombre, r.ausente ? 'SI' : 'NO', r.ausente ? '' : String(r.promedio ?? '')];
    const inds = (r.indicadores || []).map(v => (typeof v === 'number' ? v.toFixed(1) : ''));
    rows.push([...base, ...inds]);
  });
  downloadCSV(`evaluacion_${g.id}.csv`, rows);
}

function exportGuardadosCSV(guardados: EvaluacionEnsayoDoc[]) {
  const headers = [
    'EvaluacionID','Fecha','Curso','Asignatura','Profesor','Creador','EstudianteID','Estudiante','Ausente','Promedio',
    ...INDICADORES.map((i)=>`Indicador_${i}`)
  ];
  const rows: string[][] = [headers];
  guardados.forEach(g => {
    const fecha = (g.createdAt?.toDate?.() || new Date(g.fecha)).toISOString();
    (g.resultados || []).forEach(r => {
      const base = [g.id, fecha, g.curso, g.asignatura, g.profesorNombre, g.creadorNombre, r.estudianteId, r.estudianteNombre, r.ausente ? 'SI' : 'NO', r.ausente ? '' : String(r.promedio ?? '')];
      const inds = (r.indicadores || []).map(v => (typeof v === 'number' ? v.toFixed(1) : ''));
      rows.push([...base, ...inds]);
    });
  });
  const fechaName = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  downloadCSV(`evaluaciones_filtradas_${fechaName}.csv`, rows);
}
