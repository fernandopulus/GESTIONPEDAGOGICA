import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from 'react';
import { FileText, Send, Link as LinkIcon, Paperclip, Filter, CheckCircle2, XCircle, Eye, ClipboardCheck, Users2, Layers, Trash2 } from 'lucide-react';
import { Profile, User } from '../../types';
import type { SolicitudMulticopia, EstadoMulticopia, NivelPlanificacion } from '../../types';
import { ASIGNATURAS, CURSOS, NIVELES } from '../../constants';
import {
  createSolicitudMulticopia,
  subscribeMulticopiasPorSolicitante,
  subscribeMulticopiasAllConFiltros,
  cambiarEstadoMulticopia,
  notificarAceptacionMulticopia,
  eliminarSolicitudMulticopia,
} from '../../src/firebaseHelpers/multicopiasHelper';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

type Props = { currentUser: User };

const estados: EstadoMulticopia[] = ['Enviada','Visada','Aceptada','Rechazada','Completada'];

const Multicopias: React.FC<Props> = ({ currentUser }) => {
  const isSD = currentUser.profile === Profile.SUBDIRECCION;
  const isCoord = currentUser.profile === Profile.COORDINACION_TP;

  // Formulario de solicitud
  const [tituloMaterial, setTituloMaterial] = useState('');
  const [asignatura, setAsignatura] = useState(ASIGNATURAS[0]);
  const [nivel, setNivel] = useState<NivelPlanificacion>(NIVELES[0]);
  const [curso, setCurso] = useState<string>('');
  const [cantidad, setCantidad] = useState<number>(30);
  const [fechaEntregaDeseada, setFechaEntregaDeseada] = useState<string>(new Date().toISOString().split('T')[0]);
  const [enlaceUrl, setEnlaceUrl] = useState('');
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [comentarios, setComentarios] = useState('');
  const [error, setError] = useState<string|null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Listados
  const [mias, setMias] = useState<SolicitudMulticopia[]>([]);
  const [todas, setTodas] = useState<SolicitudMulticopia[]>([]);

  // Filtros SD
  const [fCurso, setFCurso] = useState<string>('Todos');
  const [fAsignatura, setFAsignatura] = useState<string>('Todas');
  const [fDocente, setFDocente] = useState<string>('Todos');
  const [fEstado, setFEstado] = useState<EstadoMulticopia | 'Todos'>('Todos');
  const [fNivel, setFNivel] = useState<NivelPlanificacion | 'Todos'>('Todos');

  // Rechazo: modal y motivo
  const [rejectTarget, setRejectTarget] = useState<SolicitudMulticopia | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectSaving, setIsRejectSaving] = useState(false);
  // Eliminación: modal y estado
  const [deleteTarget, setDeleteTarget] = useState<SolicitudMulticopia | null>(null);
  const [isDeleteSaving, setIsDeleteSaving] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);

  // Opciones dinámicas a partir de datos
  const opcionesDocente = useMemo(() => {
    const set = new Set<string>();
    todas.forEach(s => s.solicitanteNombre && set.add(s.solicitanteNombre));
    return ['Todos', ...Array.from(set).sort()];
  }, [todas]);

  const opcionesAsignaturas = useMemo(() => {
    const set = new Set<string>();
    todas.forEach(s => s.asignatura && set.add(s.asignatura));
    return ['Todas', ...Array.from(set).sort()];
  }, [todas]);

  const opcionesCursos = useMemo(() => {
    const set = new Set<string>();
    todas.forEach(s => s.curso && set.add(s.curso!));
    return ['Todos', ...Array.from(set).sort()];
  }, [todas]);

  // --- Agregados para Dashboard (sobre 'todas' ya filtradas) ---
  type CountDatum = { name: string; value: number };

  const totalSolicitudes = useMemo(() => todas.length, [todas]);
  const totalCopias = useMemo(() => todas.reduce((acc, s) => acc + (Number(s.cantidadCopias) || 0), 0), [todas]);

  const countBy = (getter: (s: SolicitudMulticopia) => string): CountDatum[] => {
    const map = new Map<string, number>();
    for (const s of todas) {
      const k = (getter(s) || '—').trim() || '—';
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a,b)=> b.value - a.value);
  };

  const dataPorEstado = useMemo(() => countBy(s => s.estado || 'Enviada'), [todas]);
  const dataPorNivel = useMemo(() => countBy(s => s.nivel || '—'), [todas]);
  const dataPorAsignatura = useMemo(() => countBy(s => s.asignatura || '—').slice(0, 10), [todas]);
  const dataPorDocente = useMemo(() => countBy(s => s.solicitanteNombre || '—').slice(0, 10), [todas]);
  const dataPorCurso = useMemo(() => countBy(s => s.curso || '—').slice(0, 10), [todas]);

  const estadoColors: Record<string, string> = {
    'Enviada': '#f59e0b',
    'Visada': '#3b82f6',
    'Aceptada': '#10b981',
    'Rechazada': '#ef4444',
    'Completada': '#059669',
  };
  const palette = ['#0ea5e9','#22c55e','#f97316','#6366f1','#14b8a6','#eab308','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f43f5e'];

  useEffect(() => {
    // Mis solicitudes
    const unsubMine = subscribeMulticopiasPorSolicitante({ emailLower: currentUser.email?.toLowerCase() }, setMias);
    // Panel SD
    if (isSD || isCoord) {
      const unsubAll = subscribeMulticopiasAllConFiltros({ nivel: fNivel, curso: fCurso, asignatura: fAsignatura, docenteNombre: fDocente, estado: fEstado }, setTodas);
      return () => { unsubMine(); unsubAll(); };
    }
    return () => { unsubMine(); };
  }, [currentUser.email, isSD, isCoord, fNivel, fCurso, fAsignatura, fDocente, fEstado]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!tituloMaterial.trim()) { setError('Debe indicar un título o descripción del material.'); return; }
    try {
      setIsSaving(true);
      setError(null);
      let adjuntoUrl: string | undefined = undefined;
      if (adjunto) {
        try {
          // Subir archivo a Storage
          const { uploadAdjuntoMulticopia } = await import('../../src/firebaseHelpers/multicopiasHelper');
          adjuntoUrl = await uploadAdjuntoMulticopia(adjunto, 'multicopias');
        } catch (e) {
          console.warn('No se pudo subir el adjunto:', e);
        }
      }
      const payload = {
        solicitanteId: currentUser.id,
        solicitanteNombre: currentUser.nombreCompleto,
        solicitanteEmail: currentUser.email,
        tituloMaterial,
        asignatura,
        nivel,
        curso: curso || undefined,
        cantidadCopias: Math.max(1, Number(cantidad) || 1),
        fechaEntregaDeseada,
        enlaceUrl: enlaceUrl || undefined,
        adjuntoUrl,
        comentarios: comentarios || undefined,
        estado: 'Enviada' as EstadoMulticopia,
  } as Omit<SolicitudMulticopia, 'id' | 'createdAt' | 'updatedAt' | 'solicitanteEmailLower'>;
      await createSolicitudMulticopia(payload);
      // limpiar
      setTituloMaterial('');
      setNivel(NIVELES[0]);
      setCurso('');
      setCantidad(30);
      setEnlaceUrl('');
      setAdjunto(null);
      setComentarios('');
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear la solicitud.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderForm = () => (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Título o descripción del material</label>
        <div className="relative">
          <input value={tituloMaterial} onChange={(e)=>setTituloMaterial(e.target.value)} className="w-full border rounded-md px-3 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="Ej: Prueba de ecuaciones lineales Unidad 2" />
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Asignatura</label>
          <select value={asignatura} onChange={(e)=>setAsignatura(e.target.value)} className="w-full border rounded-md px-3 py-2">
            {ASIGNATURAS.map(a=> <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nivel</label>
          <select required value={nivel} onChange={(e)=>setNivel(e.target.value as NivelPlanificacion)} className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500">
            {NIVELES.map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Curso (opcional)</label>
          <select value={curso} onChange={(e)=>setCurso(e.target.value)} className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">—</option>
            {CURSOS.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Cantidad de copias</label>
          <input type="number" min={1} value={cantidad} onChange={(e)=>setCantidad(parseInt(e.target.value)||1)} className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Fecha de entrega deseada</label>
          <input type="date" value={fechaEntregaDeseada} onChange={(e)=>setFechaEntregaDeseada(e.target.value)} className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Enlace al material (Drive, etc.)</label>
          <div className="relative">
            <input value={enlaceUrl} onChange={(e)=>setEnlaceUrl(e.target.value)} className="w-full border rounded-md px-3 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="https://..." />
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">O subir archivo (opcional)</label>
        <div className="relative">
          <input type="file" onChange={(e)=> setAdjunto(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" />
          <Paperclip className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
        <p className="text-xs text-slate-500 mt-1">Se guardará en Storage y se adjuntará a la solicitud.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Comentarios</label>
        <textarea value={comentarios} onChange={(e)=>setComentarios(e.target.value)} rows={3} className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="Indicaciones adicionales" />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      <div className="text-right">
        <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-400 shadow-sm">
          <Send className="h-4 w-4" /> {isSaving ? 'Enviando…' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  );

  const renderMisSolicitudes = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Fecha</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Título</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Asignatura</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Nivel</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Curso</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Cantidad</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Fecha deseada</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Material</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Estado</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {mias.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-sm">{s.createdAt ? new Date(s.createdAt).toLocaleString('es-CL') : '—'}</td>
              <td className="px-4 py-2 text-sm font-medium text-slate-800">{s.tituloMaterial}</td>
              <td className="px-4 py-2 text-sm">{s.asignatura}</td>
              <td className="px-4 py-2 text-sm">{s.nivel}</td>
              <td className="px-4 py-2 text-sm">{s.curso || '—'}</td>
              <td className="px-4 py-2 text-sm">{s.cantidadCopias}</td>
              <td className="px-4 py-2 text-sm">{s.fechaEntregaDeseada}</td>
              <td className="px-4 py-2 text-sm">
                <div className="flex gap-2 items-center">
                  {s.enlaceUrl && (
                    <a href={s.enlaceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Enlace</a>
                  )}
                  {s.adjuntoUrl && (
                    <a href={s.adjuntoUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">Archivo</a>
                  )}
                  {!s.enlaceUrl && !s.adjuntoUrl && <span className="text-slate-400">—</span>}
                </div>
                {s.estado === 'Rechazada' && s.motivoRechazo && (
                  <div className="text-xs text-red-600 mt-1">Motivo: {s.motivoRechazo}</div>
                )}
              </td>
              <td className="px-4 py-2 text-sm">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                  s.estado === 'Aceptada' ? 'bg-green-100 text-green-800' :
                  s.estado === 'Rechazada' ? 'bg-red-100 text-red-700' :
                  s.estado === 'Visada' ? 'bg-blue-100 text-blue-800' :
                  s.estado === 'Completada' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {s.estado === 'Aceptada' && <CheckCircle2 className="h-3 w-3" />}
                  {s.estado === 'Rechazada' && <XCircle className="h-3 w-3" />}
                  {s.estado === 'Visada' && <Eye className="h-3 w-3" />}
                  {s.estado === 'Completada' && <ClipboardCheck className="h-3 w-3" />}
                  {s.estado === 'Enviada' && <Paperclip className="h-3 w-3" />}
                  {s.estado}
                </span>
              </td>
              <td className="px-4 py-2 text-sm text-right">
                {(s.estado === 'Enviada' || s.estado === 'Rechazada') && (
                  <button
                    title="Eliminar"
                    onClick={()=> setDeleteTarget(s)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-200 text-slate-800 hover:bg-slate-300">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderPanelSD = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2 text-slate-600 w-full md:w-auto"><Filter className="h-4 w-4" /> <span className="text-sm">Filtros</span></div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Nivel</label>
          <select value={fNivel} onChange={(e)=>setFNivel(e.target.value as NivelPlanificacion | 'Todos')} className="border rounded-md px-3 py-1.5">
            {(['Todos', ...NIVELES] as const).map(o=> <option key={o as string} value={o as string}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Docente</label>
          <select value={fDocente} onChange={(e)=>setFDocente(e.target.value)} className="border rounded-md px-3 py-1.5">
            {opcionesDocente.map(o=> <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Asignatura</label>
          <select value={fAsignatura} onChange={(e)=>setFAsignatura(e.target.value)} className="border rounded-md px-3 py-1.5">
            {opcionesAsignaturas.map(o=> <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Curso</label>
          <select value={fCurso} onChange={(e)=>setFCurso(e.target.value)} className="border rounded-md px-3 py-1.5">
            {opcionesCursos.map(o=> <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Estado</label>
          <select value={fEstado} onChange={(e)=>setFEstado(e.target.value as any)} className="border rounded-md px-3 py-1.5">
            {(['Todos', ...estados] as const).map(o=> <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Dashboard gráfico */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-700">Resumen gráfico</h4>
          <button
            onClick={()=> setShowDashboard(v => !v)}
            className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-slate-50"
          >{showDashboard ? 'Ocultar' : 'Ver'} gráficos</button>
        </div>
        {showDashboard && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* KPIs */}
            <div className="col-span-1 lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border p-4 bg-white">
                <div className="text-xs text-slate-500">Total solicitudes</div>
                <div className="text-2xl font-bold">{totalSolicitudes}</div>
              </div>
              <div className="rounded-xl border p-4 bg-white">
                <div className="text-xs text-slate-500">Total copias pedidas</div>
                <div className="text-2xl font-bold">{totalCopias}</div>
              </div>
              <div className="rounded-xl border p-4 bg-white">
                <div className="text-xs text-slate-500">Docentes únicos</div>
                <div className="text-2xl font-bold">{new Set(todas.map(s=> s.solicitanteNombre || '—')).size}</div>
              </div>
              <div className="rounded-xl border p-4 bg-white">
                <div className="text-xs text-slate-500">Asignaturas únicas</div>
                <div className="text-2xl font-bold">{new Set(todas.map(s=> s.asignatura || '—')).size}</div>
              </div>
            </div>

            {/* Pie por estado */}
            <div className="rounded-xl border p-3 bg-white">
              <div className="text-xs text-slate-500 mb-1">Por estado</div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dataPorEstado} dataKey="value" nameKey="name" outerRadius={80}>
                      {dataPorEstado.map((entry, idx) => (
                        <Cell key={`estado-${idx}`} fill={estadoColors[entry.name] || palette[idx % palette.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar por nivel */}
            <div className="rounded-xl border p-3 bg-white">
              <div className="text-xs text-slate-500 mb-1">Por nivel</div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataPorNivel} margin={{ left: 8, right: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} height={50} textAnchor="end" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar por asignatura (Top 10) */}
            <div className="rounded-xl border p-3 bg-white">
              <div className="text-xs text-slate-500 mb-1">Por asignatura (Top 10)</div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataPorAsignatura} margin={{ left: 8, right: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} height={70} textAnchor="end" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar por docente (Top 10) */}
            <div className="rounded-xl border p-3 bg-white">
              <div className="text-xs text-slate-500 mb-1">Por docente (Top 10)</div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataPorDocente} margin={{ left: 8, right: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} height={70} textAnchor="end" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar por curso (Top 10) */}
            <div className="rounded-xl border p-3 bg-white">
              <div className="text-xs text-slate-500 mb-1">Por curso (Top 10)</div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataPorCurso} margin={{ left: 8, right: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} height={70} textAnchor="end" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Fecha</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Docente</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Título</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Asignatura</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Nivel</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Curso</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Cantidad</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Fecha deseada</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Material</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Estado</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Motivo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {todas.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-sm">{s.createdAt ? new Date(s.createdAt).toLocaleString('es-CL') : '—'}</td>
                <td className="px-3 py-2 text-sm">{s.solicitanteNombre}</td>
                <td className="px-3 py-2 text-sm font-medium text-slate-800">{s.tituloMaterial}</td>
                <td className="px-3 py-2 text-sm">{s.asignatura}</td>
                <td className="px-3 py-2 text-sm">{s.nivel}</td>
                <td className="px-3 py-2 text-sm">{s.curso || '—'}</td>
                <td className="px-3 py-2 text-sm">{s.cantidadCopias}</td>
                <td className="px-3 py-2 text-sm">{s.fechaEntregaDeseada}</td>
                <td className="px-3 py-2 text-sm">
                  <div className="flex gap-2 items-center">
                    {s.enlaceUrl && (
                      <a href={s.enlaceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline"><LinkIcon className="h-4 w-4" /> Enlace</a>
                    )}
                    {s.adjuntoUrl && (
                      <a href={s.adjuntoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:underline"><Paperclip className="h-4 w-4" /> Archivo</a>
                    )}
                    {!s.enlaceUrl && !s.adjuntoUrl && <span className="text-slate-400">—</span>}
                  </div>
                </td>
                <td className="px-3 py-2 text-sm">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                    s.estado === 'Aceptada' ? 'bg-green-100 text-green-800' :
                    s.estado === 'Rechazada' ? 'bg-red-100 text-red-700' :
                    s.estado === 'Visada' ? 'bg-blue-100 text-blue-800' :
                    s.estado === 'Completada' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {s.estado === 'Aceptada' && <CheckCircle2 className="h-3 w-3" />}
                    {s.estado === 'Rechazada' && <XCircle className="h-3 w-3" />}
                    {s.estado === 'Visada' && <Eye className="h-3 w-3" />}
                    {s.estado === 'Completada' && <ClipboardCheck className="h-3 w-3" />}
                    {s.estado === 'Enviada' && <Paperclip className="h-3 w-3" />}
                    {s.estado}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm max-w-[240px] truncate" title={s.motivoRechazo || ''}>{s.motivoRechazo || '—'}</td>
                <td className="px-3 py-2 text-sm text-right space-x-2">
                  {s.estado === 'Enviada' && (
                    <button onClick={async ()=> await cambiarEstadoMulticopia(s.id, 'Visada', currentUser.nombreCompleto)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"><Eye className="h-4 w-4" /> Visar</button>
                  )}
                  {(s.estado === 'Enviada' || s.estado === 'Visada') && (
                    <button onClick={async ()=> { await cambiarEstadoMulticopia(s.id, 'Aceptada', currentUser.nombreCompleto); await notificarAceptacionMulticopia(s); }} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"><CheckCircle2 className="h-4 w-4" /> Aceptar</button>
                  )}
                  {s.estado !== 'Rechazada' && s.estado !== 'Completada' && (
                    <button onClick={()=> { setRejectTarget(s); setRejectReason(''); }} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"><XCircle className="h-4 w-4" /> Rechazar</button>
                  )}
                  {s.estado === 'Aceptada' && (
                    <button onClick={async ()=> await cambiarEstadoMulticopia(s.id, 'Completada', currentUser.nombreCompleto)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"><ClipboardCheck className="h-4 w-4" /> Completada</button>
                  )}
                  {(currentUser.id === s.solicitanteId) && (s.estado === 'Enviada' || s.estado === 'Rechazada') && (
                    <button
                      title="Eliminar"
                      onClick={()=> setDeleteTarget(s)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-200 text-slate-800 hover:bg-slate-300">
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Modal motivo de rechazo */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-3">Motivo de rechazo</h3>
            <p className="text-sm text-slate-600 mb-3">Indica brevemente el motivo del rechazo para que el docente pueda corregir o reenviar.</p>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e)=>setRejectReason(e.target.value)}
              className="w-full border-slate-300 rounded-md"
              placeholder="Ej: El material no es legible o falta la portada."
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={()=> { setRejectTarget(null); setRejectReason(''); }}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300"
              ><XCircle className="h-4 w-4" /> Cancelar</button>
              <button
                disabled={isRejectSaving}
                onClick={async ()=>{
                  if (!rejectTarget) return;
                  try {
                    setIsRejectSaving(true);
                    await cambiarEstadoMulticopia(rejectTarget.id, 'Rechazada', currentUser.nombreCompleto, { motivoRechazo: rejectReason || undefined });
                    setRejectTarget(null);
                    setRejectReason('');
                  } finally {
                    setIsRejectSaving(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400"
              >{isRejectSaving ? 'Guardando…' : (<><XCircle className="h-4 w-4" /> Confirmar rechazo</>)}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-red-700"><Trash2 className="h-5 w-5" /> Eliminar solicitud</h3>
            <p className="text-sm text-slate-600 mb-3">Esta acción eliminará la solicitud “{deleteTarget.tituloMaterial}”. Si tiene un archivo adjunto, también se intentará borrar del almacenamiento.</p>
            <p className="text-sm text-slate-600 mb-4">¿Deseas continuar?</p>
            <div className="mt-1 flex justify-end gap-2">
              <button
                onClick={()=> setDeleteTarget(null)}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300"
              >Cancelar</button>
              <button
                disabled={isDeleteSaving}
                onClick={async ()=>{
                  try {
                    setIsDeleteSaving(true);
                    await eliminarSolicitudMulticopia(deleteTarget.id, { adjuntoUrl: deleteTarget.adjuntoUrl });
                    setDeleteTarget(null);
                  } catch (e) {
                    alert('No se pudo eliminar.');
                  } finally {
                    setIsDeleteSaving(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400"
              >{isDeleteSaving ? 'Eliminando…' : (<><Trash2 className="h-4 w-4" /> Eliminar</>)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-2xl shadow">
      <div className="flex items-center gap-3 mb-2">
        <Layers className="h-6 w-6 text-amber-600" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Multicopias</h2>
      </div>
      <p className="text-slate-600 dark:text-slate-400 mb-6">Gestiona solicitudes de copias de material evaluativo y pedagógico.</p>

      {(currentUser.profile === Profile.PROFESORADO || isCoord) && (
        <div className="mb-8">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3"><FileText className="h-5 w-5 text-amber-600" /> Nueva solicitud</h3>
          {renderForm()}
        </div>
      )}

      {(currentUser.profile === Profile.PROFESORADO || isCoord) && (
        <div className="mb-10">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3"><Users2 className="h-5 w-5 text-amber-600" /> Mis solicitudes</h3>
          {renderMisSolicitudes()}
        </div>
      )}

      {(isSD) && (
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3"><ClipboardCheck className="h-5 w-5 text-amber-600" /> Panel de Subdirección</h3>
          {renderPanelSD()}
        </div>
      )}
    </div>
  );
};

export default Multicopias;
