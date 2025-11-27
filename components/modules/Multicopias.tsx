import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { FileText, Send, Link as LinkIcon, Paperclip, Filter, CheckCircle2, XCircle, Eye, ClipboardCheck, Users2, Layers, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { Profile, User } from '../../types';
import type {
  SolicitudMulticopia,
  EstadoMulticopia,
  NivelPlanificacion,
  BloomLevel,
  BloomAnalysisResult,
  BloomSummary,
  AnalisisTaxonomico,
} from '../../types';
import { ASIGNATURAS, CURSOS, NIVELES } from '../../constants';
import {
  createSolicitudMulticopia,
  subscribeMulticopiasPorSolicitante,
  subscribeMulticopiasAllConFiltros,
  cambiarEstadoMulticopia,
  notificarAceptacionMulticopia,
  eliminarSolicitudMulticopia,
  uploadAdjuntoMulticopia,
  updateSolicitudMulticopia,
} from '../../src/firebaseHelpers/multicopiasHelper';
import { generarConIA } from '../../src/ai/geminiHelper';
import { upsertAnalisisFromSolicitud } from '../../src/firebaseHelpers/analisis';

type Props = { currentUser: User };

const estados: EstadoMulticopia[] = ['Enviada','Visada','Aceptada','Rechazada','Completada'];
const BLOOM_LEVELS: BloomLevel[] = ['Recordar','Comprender','Aplicar','Analizar','Evaluar','Crear'];

const Multicopias: React.FC<Props> = ({ currentUser }) => {
  console.log('Renderizando Multicopias', currentUser);
  const isSD = currentUser.profile === Profile.SUBDIRECCION;
  const isCoord = currentUser.profile === Profile.COORDINACION_TP;
  const puedeCrear = currentUser.profile === Profile.PROFESORADO || isCoord;

  const [tituloMaterial, setTituloMaterial] = useState('');
  const [asignatura, setAsignatura] = useState(ASIGNATURAS[0]);
  const [nivel, setNivel] = useState<NivelPlanificacion>(NIVELES[0]);
  const [curso, setCurso] = useState('');
  const [cantidad, setCantidad] = useState(30);
  const [fechaEntregaDeseada, setFechaEntregaDeseada] = useState(new Date().toISOString().split('T')[0]);
  const [enlaceUrl, setEnlaceUrl] = useState('');
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [comentarios, setComentarios] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [mias, setMias] = useState<SolicitudMulticopia[]>([]);
  const [todas, setTodas] = useState<SolicitudMulticopia[]>([]);

  const [fCurso, setFCurso] = useState('Todos');
  const [fAsignatura, setFAsignatura] = useState('Todas');
  const [fDocente, setFDocente] = useState('Todos');
  const [fEstado, setFEstado] = useState<EstadoMulticopia | 'Todos'>('Todos');
  const [fNivel, setFNivel] = useState<NivelPlanificacion | 'Todos'>('Todos');

  const [rejectTarget, setRejectTarget] = useState<SolicitudMulticopia | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectSaving, setIsRejectSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SolicitudMulticopia | null>(null);
  const [isDeleteSaving, setIsDeleteSaving] = useState(false);

  const [viewAnalysisTarget, setViewAnalysisTarget] = useState<SolicitudMulticopia | null>(null);
  const [iaGeneratingId, setIaGeneratingId] = useState<string | null>(null);
  const [iaGlobalMessage, setIaGlobalMessage] = useState<string | null>(null);
  const [iaGlobalError, setIaGlobalError] = useState<string | null>(null);

  useEffect(() => {
    const emailLower = currentUser.email?.toLowerCase();
    if (!emailLower) return;
    const unsubMine = subscribeMulticopiasPorSolicitante({ emailLower }, setMias);
    return () => unsubMine();
  }, [currentUser.email]);

  useEffect(() => {
    if (!isSD && !isCoord) return;
    const unsubAll = subscribeMulticopiasAllConFiltros({ nivel: fNivel, curso: fCurso, asignatura: fAsignatura, docenteNombre: fDocente, estado: fEstado }, setTodas);
    return () => unsubAll();
  }, [isSD, isCoord, fNivel, fCurso, fAsignatura, fDocente, fEstado]);

  const opcionesDocente = useMemo(() => {
    const values = new Set<string>();
    todas.forEach((s) => s.solicitanteNombre && values.add(s.solicitanteNombre));
    return ['Todos', ...Array.from(values).sort()];
  }, [todas]);

  const opcionesAsignaturas = useMemo(() => {
    const values = new Set<string>();
    todas.forEach((s) => s.asignatura && values.add(s.asignatura));
    return ['Todas', ...Array.from(values).sort()];
  }, [todas]);

  const opcionesCursos = useMemo(() => {
    const values = new Set<string>();
    todas.forEach((s) => s.curso && values.add(s.curso));
    return ['Todos', ...Array.from(values).sort()];
  }, [todas]);

  const resumenEstados = useMemo<Record<EstadoMulticopia, number>>(() => {
    const base: Record<EstadoMulticopia, number> = {
      Enviada: 0,
      Visada: 0,
      Aceptada: 0,
      Rechazada: 0,
      Completada: 0,
    };
    todas.forEach((s) => {
      base[s.estado] = (base[s.estado] ?? 0) + 1;
    });
    return base;
  }, [todas]);

  const totalSolicitudes = todas.length;
  const totalCopias = useMemo(() => todas.reduce((acc, s) => acc + (Number(s.cantidadCopias) || 0), 0), [todas]);
  const docentesActivos = useMemo(() => {
    const set = new Set<string>();
    todas.forEach((s) => s.solicitanteNombre && set.add(s.solicitanteNombre));
    return set.size;
  }, [todas]);
  const proximasEntregas = useMemo(() => {
    return [...todas]
      .filter((s) => s.fechaEntregaDeseada)
      .sort((a, b) => a.fechaEntregaDeseada.localeCompare(b.fechaEntregaDeseada))
      .slice(0, 5);
  }, [todas]);
  const topDocentes = useMemo(() => {
    const map = new Map<string, number>();
    todas.forEach((s) => {
      const key = s.solicitanteNombre || 'Sin nombre';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [todas]);

  const resetForm = () => {
    setTituloMaterial('');
    setAsignatura(ASIGNATURAS[0]);
    setNivel(NIVELES[0]);
    setCurso('');
    setCantidad(30);
    setFechaEntregaDeseada(new Date().toISOString().split('T')[0]);
    setEnlaceUrl('');
    setAdjunto(null);
    setComentarios('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!tituloMaterial.trim()) {
      setError('Debe indicar un título o descripción del material.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      let adjuntoUrl: string | undefined;
      if (adjunto) {
        adjuntoUrl = await uploadAdjuntoMulticopia(adjunto, 'multicopias');
      }

      await createSolicitudMulticopia({
        solicitanteId: currentUser.id,
        solicitanteNombre: currentUser.nombreCompleto,
        solicitanteEmail: currentUser.email,
        tituloMaterial: tituloMaterial.trim(),
        asignatura,
        nivel,
        curso: curso || undefined,
        cantidadCopias: Math.max(1, Number(cantidad) || 1),
        fechaEntregaDeseada,
        enlaceUrl: enlaceUrl || undefined,
        adjuntoUrl,
        comentarios: comentarios || undefined,
        estado: 'Enviada',
      } as Omit<SolicitudMulticopia, 'id' | 'createdAt' | 'updatedAt' | 'solicitanteEmailLower'>);

      resetForm();
    } catch (err: any) {
      console.error('Error creando solicitud', err);
      setError(err?.message || 'No se pudo crear la solicitud.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderForm = () => (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Título o descripción del material</label>
        <div className="relative">
          <input
            value={tituloMaterial}
            onChange={(e) => setTituloMaterial(e.target.value)}
            className="w-full border rounded-md px-3 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Ej: Guía de ecuaciones lineales"
          />
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Asignatura</label>
          <select value={asignatura} onChange={(e) => setAsignatura(e.target.value)} className="w-full border rounded-md px-3 py-2">
            {ASIGNATURAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nivel</label>
          <select value={nivel} onChange={(e) => setNivel(e.target.value as NivelPlanificacion)} className="w-full border rounded-md px-3 py-2">
            {NIVELES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Curso (opcional)</label>
          <select value={curso} onChange={(e) => setCurso(e.target.value)} className="w-full border rounded-md px-3 py-2">
            <option value="">—</option>
            {CURSOS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Cantidad de copias</label>
          <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(parseInt(e.target.value, 10) || 1)} className="w-full border rounded-md px-3 py-2" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Fecha de entrega deseada</label>
          <input type="date" value={fechaEntregaDeseada} onChange={(e) => setFechaEntregaDeseada(e.target.value)} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Enlace al material (Drive, etc.)</label>
          <div className="relative">
            <input value={enlaceUrl} onChange={(e) => setEnlaceUrl(e.target.value)} className="w-full border rounded-md px-3 py-2 pl-10" placeholder="https://..." />
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">O subir archivo</label>
        <div className="relative">
          <input type="file" onChange={(e) => setAdjunto(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" />
          <Paperclip className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
        <p className="text-xs text-slate-500 mt-1">Se guardará en Storage y se adjuntará a la solicitud.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Comentarios</label>
        <textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={3} className="w-full border rounded-md px-3 py-2" placeholder="Indicaciones adicionales" />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      <div className="text-right">
        <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-400">
          <Send className="h-4 w-4" /> {isSaving ? 'Enviando…' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  );

  const renderIAControls = (solicitud: SolicitudMulticopia, allowGenerate = false) => {
    const canGenerate = allowGenerate && (solicitud.enlaceUrl || solicitud.adjuntoUrl);
    const isLoading = iaGeneratingId === solicitud.id;
    return (
      <div className="flex items-center justify-center gap-2">
        {solicitud.analisisPedagogico ? (
          <button
            onClick={() => setViewAnalysisTarget(solicitud)}
            className="p-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
            title="Ver retroalimentación pedagógica"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        ) : (
          <span className="text-slate-300">—</span>
        )}
        {canGenerate && (
          <button
            onClick={() => handleGenerarAnalisisSD(solicitud)}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400"
            title="Generar retroalimentación pedagógica"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isLoading ? 'Analizando…' : 'Analizar'}
          </button>
        )}
        {allowGenerate && !canGenerate && (
          <span className="text-[11px] text-slate-400">Sin material</span>
        )}
      </div>
    );
  };

  const renderEstadoPill = (estado: EstadoMulticopia) => (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
      estado === 'Aceptada' ? 'bg-green-100 text-green-800' :
      estado === 'Rechazada' ? 'bg-red-100 text-red-700' :
      estado === 'Visada' ? 'bg-blue-100 text-blue-800' :
      estado === 'Completada' ? 'bg-emerald-100 text-emerald-800' :
      'bg-yellow-100 text-yellow-800'
    }`}>
      {estado === 'Aceptada' && <CheckCircle2 className="h-3 w-3" />}
      {estado === 'Rechazada' && <XCircle className="h-3 w-3" />}
      {estado === 'Visada' && <Eye className="h-3 w-3" />}
      {estado === 'Completada' && <ClipboardCheck className="h-3 w-3" />}
      {estado === 'Enviada' && <Paperclip className="h-3 w-3" />}
      {estado}
    </span>
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
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Retroalimentación</th>
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
                  {s.enlaceUrl && <a href={s.enlaceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Enlace</a>}
                  {s.adjuntoUrl && <a href={s.adjuntoUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">Archivo</a>}
                  {!s.enlaceUrl && !s.adjuntoUrl && <span className="text-slate-400">—</span>}
                </div>
                {s.estado === 'Rechazada' && s.motivoRechazo && (
                  <div className="text-xs text-red-600 mt-1">Motivo: {s.motivoRechazo}</div>
                )}
              </td>
              <td className="px-4 py-2 text-sm text-center">{renderIAControls(s)}</td>
              <td className="px-4 py-2 text-sm">{renderEstadoPill(s.estado)}</td>
              <td className="px-4 py-2 text-sm text-right">
                {(s.estado === 'Enviada' || s.estado === 'Rechazada') && (
                  <button
                    title="Eliminar"
                    onClick={() => setDeleteTarget(s)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-200 text-slate-800 hover:bg-slate-300"
                  >
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
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2 text-slate-600 w-full md:w-auto"><Filter className="h-4 w-4" /> <span className="text-sm">Filtros</span></div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Nivel</label>
          <select value={fNivel} onChange={(e) => setFNivel(e.target.value as NivelPlanificacion | 'Todos')} className="border rounded-md px-3 py-1.5">
            {(['Todos', ...NIVELES] as const).map((o) => (
              <option key={o as string} value={o as string}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Docente</label>
          <select value={fDocente} onChange={(e) => setFDocente(e.target.value)} className="border rounded-md px-3 py-1.5">
            {opcionesDocente.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Asignatura</label>
          <select value={fAsignatura} onChange={(e) => setFAsignatura(e.target.value)} className="border rounded-md px-3 py-1.5">
            {opcionesAsignaturas.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Curso</label>
          <select value={fCurso} onChange={(e) => setFCurso(e.target.value)} className="border rounded-md px-3 py-1.5">
            {opcionesCursos.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Estado</label>
          <select value={fEstado} onChange={(e) => setFEstado(e.target.value as EstadoMulticopia | 'Todos')} className="border rounded-md px-3 py-1.5">
            {(['Todos', ...estados] as const).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      {(iaGlobalMessage || iaGlobalError) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${iaGlobalError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
        >
          {iaGlobalError || iaGlobalMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4 bg-white">
          <p className="text-xs text-slate-500">Total solicitudes</p>
          <p className="text-2xl font-bold">{totalSolicitudes}</p>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <p className="text-xs text-slate-500">Copias requeridas</p>
          <p className="text-2xl font-bold">{totalCopias}</p>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <p className="text-xs text-slate-500">Pendientes</p>
          <p className="text-2xl font-bold">{resumenEstados.Enviada + resumenEstados.Visada}</p>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <p className="text-xs text-slate-500">Docentes activos</p>
          <p className="text-2xl font-bold">{docentesActivos}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border p-4 bg-white">
          <p className="text-xs text-slate-500 mb-2">Por estado</p>
          <ul className="space-y-1 text-sm">
            {estados.map((estado) => (
              <li key={estado} className="flex items-center justify-between text-slate-700">
                <span>{estado}</span>
                <span className="font-semibold">{resumenEstados[estado]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <p className="text-xs text-slate-500 mb-2">Próximas entregas</p>
          {proximasEntregas.length === 0 ? (
            <p className="text-sm text-slate-500">Sin entregas registradas.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {proximasEntregas.map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span className="font-medium text-slate-700">{s.tituloMaterial}</span>
                  <span className="text-slate-500">{s.fechaEntregaDeseada}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <p className="text-xs text-slate-500 mb-2">Docentes con más solicitudes</p>
          {topDocentes.length === 0 ? (
            <p className="text-sm text-slate-500">Sin registros.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {topDocentes.map(([docente, count]) => (
                <li key={docente} className="flex justify-between">
                  <span>{docente}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Retroalimentación</th>
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
                <td className="px-3 py-2 text-sm text-center">{renderIAControls(s, true)}</td>
                <td className="px-3 py-2 text-sm">{renderEstadoPill(s.estado)}</td>
                <td className="px-3 py-2 text-sm max-w-[240px] truncate" title={s.motivoRechazo || ''}>{s.motivoRechazo || '—'}</td>
                <td className="px-3 py-2 text-sm text-right space-x-2">
                  {s.estado === 'Enviada' && (
                    <button
                      onClick={async () => await cambiarEstadoMulticopia(s.id, 'Visada', currentUser.nombreCompleto)}
                      className="inline-flex items-center justify-center p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                      title="Visar"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Visar</span>
                    </button>
                  )}
                  {(s.estado === 'Enviada' || s.estado === 'Visada') && (
                    <button
                      onClick={async () => { await cambiarEstadoMulticopia(s.id, 'Aceptada', currentUser.nombreCompleto); await notificarAceptacionMulticopia(s); }}
                      className="inline-flex items-center justify-center p-2 rounded-full bg-green-600 text-white hover:bg-green-700"
                      title="Aceptar"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="sr-only">Aceptar</span>
                    </button>
                  )}
                  {s.estado !== 'Rechazada' && s.estado !== 'Completada' && (
                    <button
                      onClick={() => { setRejectTarget(s); setRejectReason(''); }}
                      className="inline-flex items-center justify-center p-2 rounded-full bg-red-600 text-white hover:bg-red-700"
                      title="Rechazar"
                    >
                      <XCircle className="h-4 w-4" />
                      <span className="sr-only">Rechazar</span>
                    </button>
                  )}
                  {s.estado === 'Aceptada' && (
                    <button
                      onClick={async () => await cambiarEstadoMulticopia(s.id, 'Completada', currentUser.nombreCompleto)}
                      className="inline-flex items-center justify-center p-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                      title="Completada"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      <span className="sr-only">Marcar como completada</span>
                    </button>
                  )}
                  {(currentUser.id === s.solicitanteId) && (s.estado === 'Enviada' || s.estado === 'Rechazada') && (
                    <button
                      title="Eliminar"
                      onClick={() => setDeleteTarget(s)}
                      className="inline-flex items-center justify-center p-2 rounded-full bg-slate-200 text-slate-800 hover:bg-slate-300"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Eliminar</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRejectModal = () => (
    rejectTarget && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white w-full max-w-lg rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-bold mb-3">Motivo de rechazo</h3>
          <p className="text-sm text-slate-600 mb-3">Explica al docente qué debe corregir para reenviar su solicitud.</p>
          <textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-full border-slate-300 rounded-md" placeholder="Ej: Falta portada o clarificar objetivo pedagógico." />
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300">
              <XCircle className="h-4 w-4" /> Cancelar
            </button>
            <button
              disabled={isRejectSaving}
              onClick={async () => {
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
            >
              {isRejectSaving ? 'Guardando…' : (<><XCircle className="h-4 w-4" /> Confirmar rechazo</>)}
            </button>
          </div>
        </div>
      </div>
    )
  );

  const renderDeleteModal = () => (
    deleteTarget && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-red-700"><Trash2 className="h-5 w-5" /> Eliminar solicitud</h3>
          <p className="text-sm text-slate-600 mb-3">Esta acción eliminará la solicitud “{deleteTarget.tituloMaterial}”.</p>
          <p className="text-sm text-slate-600 mb-4">¿Deseas continuar?</p>
          <div className="mt-1 flex justify-end gap-2">
            <button onClick={() => setDeleteTarget(null)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300">Cancelar</button>
            <button
              disabled={isDeleteSaving}
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  setIsDeleteSaving(true);
                  await eliminarSolicitudMulticopia(deleteTarget.id, { adjuntoUrl: deleteTarget.adjuntoUrl });
                  setDeleteTarget(null);
                } catch (err) {
                  alert('No se pudo eliminar la solicitud.');
                } finally {
                  setIsDeleteSaving(false);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400"
            >
              {isDeleteSaving ? 'Eliminando…' : (<><Trash2 className="h-4 w-4" /> Eliminar</>)}
            </button>
          </div>
        </div>
      </div>
    )
  );

  const renderAnalysisModal = () => (
    viewAnalysisTarget && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-indigo-700">
              <Sparkles className="h-5 w-5" /> Retroalimentación pedagógica
            </h3>
            <button onClick={() => setViewAnalysisTarget(null)} className="text-slate-500 hover:text-slate-700">
              <XCircle className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-4">Solicitud: {viewAnalysisTarget.tituloMaterial}</p>
          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line max-h-[420px] overflow-y-auto">
            {viewAnalysisTarget.analisisPedagogico || 'Sin análisis disponible.'}
          </div>
          {viewAnalysisTarget.summary && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-slate-600 mb-2">Consolidado Bloom</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {BLOOM_LEVELS.map((level) => (
                  <div key={level} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <span className="font-medium text-slate-600">{level}</span>
                    <span className="text-slate-800">{viewAnalysisTarget.summary?.[level] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {viewAnalysisTarget.analysisResults?.length ? (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-slate-600 mb-2">Ítems clasificados</h4>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-100 text-slate-500 uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Ítem</th>
                      <th className="px-3 py-2 text-left font-medium">Nivel Bloom</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewAnalysisTarget.analysisResults.map((res, idx) => (
                      <tr key={`${res.question}-${idx}`}>
                        <td className="px-3 py-2 text-slate-700 max-w-xs">{res.question}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{res.habilidadBloom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  );

  const normalizeIAResponse = (text: string) => {
    return text
      .replace(/\*\*?/g, '')
      .replace(/`/g, '')
      .split('\n')
      .map((line) => line.replace(/^\s*[-#>*]+\s*/, '').trim())
      .join('\n')
      .trim();
  };

  const canonicalizeBloomLevel = (level?: string | null): BloomLevel | null => {
    if (!level) return null;
    const normalized = level.trim().toLowerCase();
    return BLOOM_LEVELS.find((l) => l.toLowerCase() === normalized) || null;
  };

  const safeJsonParse = (raw: string) => {
    try {
      const clean = raw.trim()
        .replace(/^```json/i, '')
        .replace(/^```/, '')
        .replace(/```$/, '');
      return JSON.parse(clean);
    } catch (err) {
      console.warn('No se pudo parsear JSON de la IA', err);
      return null;
    }
  };

  const ensureBloomSummary = (input?: Partial<BloomSummary>): BloomSummary => {
    const base: BloomSummary = {
      Recordar: 0,
      Comprender: 0,
      Aplicar: 0,
      Analizar: 0,
      Evaluar: 0,
      Crear: 0,
    };
    BLOOM_LEVELS.forEach((level) => {
      const value = Number(input?.[level] ?? 0);
      base[level] = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    });
    return base;
  };

  const sanitizeBloomResults = (items: any[]): BloomAnalysisResult[] => {
    if (!Array.isArray(items)) return [];
    return items
      .map((item, index) => {
        const pregunta = (item?.question ?? `Ítem ${index + 1}`).toString().trim();
        const nivel = canonicalizeBloomLevel(item?.habilidadBloom);
        if (!pregunta || !nivel) return null;
        return {
          question: pregunta.slice(0, 500),
          habilidadBloom: nivel,
        } as BloomAnalysisResult;
      })
      .filter((item): item is BloomAnalysisResult => Boolean(item))
      .slice(0, 80);
  };

  const generarConsolidadoBloom = async (solicitud: SolicitudMulticopia, recursoDescripcion: string) => {
    const prompt = `Analiza el instrumento asociado a la solicitud "${solicitud.tituloMaterial}" para ${solicitud.asignatura} (${solicitud.nivel}). ${recursoDescripcion}

Identifica cada pregunta o ítem real descrito en el material y clasifícalos según la Taxonomía de Bloom. Devuelve SOLO un JSON válido con esta estructura exacta:
{
  "analysisResults": [
    { "question": "texto literal del ítem", "habilidadBloom": "Recordar|Comprender|Aplicar|Analizar|Evaluar|Crear" }
  ],
  "summary": {
    "Recordar": 0,
    "Comprender": 0,
    "Aplicar": 0,
    "Analizar": 0,
    "Evaluar": 0,
    "Crear": 0
  }
}

Requisitos: usa al menos los ítems disponibles (máximo 80). La propiedad summary debe coincidir con los conteos de analysisResults. Si no puedes acceder al material, devuelve summary con ceros y analysisResults vacío.`;

    const response = await generarConIA(prompt, 1, true, 'Multicopias-SD-Bloom', true);
    const parsed = response ? safeJsonParse(response) : null;
    if (!parsed) {
      throw new Error('No se pudo interpretar el JSON de habilidades Bloom.');
    }
    const analysisResults = sanitizeBloomResults(parsed.analysisResults);
    const summary = ensureBloomSummary(parsed.summary);

    if (!analysisResults.length && Object.values(summary).every((value) => value === 0)) {
      throw new Error('No se identificaron ítems para clasificar.');
    }

    return { analysisResults, summary } as { analysisResults: BloomAnalysisResult[]; summary: BloomSummary };
  };

  const handleGenerarAnalisisSD = async (solicitud: SolicitudMulticopia) => {
    if (!isSD) return;
    if (!solicitud.enlaceUrl && !solicitud.adjuntoUrl) {
      setIaGlobalError('No hay material adjunto ni enlace para analizar.');
      setTimeout(() => setIaGlobalError(null), 5000);
      return;
    }

    const recursoDescripcion = solicitud.enlaceUrl
      ? `Revisa el contenido disponible en: ${solicitud.enlaceUrl}.`
      : `Analiza el archivo alojado en Storage (URL firmada): ${solicitud.adjuntoUrl}.`;

    const prompt = `Eres parte de la Subdirección Pedagógica del Liceo Fernando Sagredo. Debes analizar el instrumento de evaluación basándote exclusivamente en el contenido del recurso proporcionado. Si no puedes acceder al recurso, especifícalo explícitamente y no inventes información.

${recursoDescripcion}

Entrega TODO en texto plano, sin viñetas ni símbolos especiales ni formato Markdown. Usa exactamente estos encabezados en mayúsculas seguidos de dos puntos y párrafos corridos:
COHERENCIA: Describe la coherencia entre los objetivos que declara el instrumento y las preguntas o ítems observados.
TAXONOMÍA DE BLOOM: Clasifica cada ítem identificado (usa la numeración o el orden que observes) indicando nivel de Bloom y una breve justificación.
FORTALEZAS: Enumera hasta 4 fortalezas concretas.
SUGERENCIAS DE MEJORA: Enumera hasta 4 recomendaciones concretas para mejorar el instrumento.

Mantén un tono profesional y directo. Si no logras acceder al contenido, explica la limitación dentro de COHERENCIA y finaliza.`;

    try {
      setIaGeneratingId(solicitud.id);
      setIaGlobalError(null);
      setIaGlobalMessage(null);

      const response = await generarConIA(prompt, 1, true, 'Multicopias-SD', false);
      const cleaned = response?.replace(/```/g, '').trim();
      if (!cleaned) {
        setIaGlobalError('No se obtuvo retroalimentación utilizable.');
        return;
      }

      const normalized = normalizeIAResponse(cleaned);
      let bloomData: { analysisResults: BloomAnalysisResult[]; summary: BloomSummary } | null = null;
      let bloomWarning: string | null = null;

      try {
        bloomData = await generarConsolidadoBloom(solicitud, recursoDescripcion);
      } catch (bloomErr: any) {
        console.warn('No se pudo consolidar habilidades Bloom', bloomErr);
        bloomWarning = 'No se pudo consolidar las habilidades Bloom en esta iteración.';
      }

      const patch: Partial<SolicitudMulticopia> = { analisisPedagogico: normalized };
      if (bloomData) {
        patch.analysisResults = bloomData.analysisResults;
        patch.summary = bloomData.summary;
      }

      await updateSolicitudMulticopia(solicitud.id, patch);

      if (bloomData) {
        const analisisPayload: Omit<AnalisisTaxonomico, 'id'> = {
          documentName: solicitud.tituloMaterial,
          uploadDate: new Date().toISOString(),
          userId: solicitud.solicitanteId,
          analysisResults: bloomData.analysisResults,
          summary: bloomData.summary,
          nivel: solicitud.nivel,
          asignatura: solicitud.asignatura,
          sourceSolicitudId: solicitud.id,
          solicitanteId: solicitud.solicitanteId,
          solicitanteNombre: solicitud.solicitanteNombre,
        };
        try {
          await upsertAnalisisFromSolicitud(solicitud.id, analisisPayload);
        } catch (syncErr) {
          console.warn('No se pudo sincronizar el análisis con el módulo taxonómico', syncErr);
          bloomWarning = bloomWarning || 'No se pudo sincronizar con el módulo de Análisis Taxonómico.';
        }
      }

      setIaGlobalMessage(bloomWarning ? `Retroalimentación pedagógica guardada. ${bloomWarning}` : 'Retroalimentación pedagógica guardada en la solicitud.');
    } catch (err: any) {
      console.error('Error generando análisis IA', err);
      setIaGlobalError(err?.message || 'No se pudo generar el análisis.');
    } finally {
      setIaGeneratingId(null);
      setTimeout(() => {
        setIaGlobalMessage(null);
        setIaGlobalError(null);
      }, 6000);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-2xl shadow relative">
      <div className="flex items-center gap-3 mb-2">
        <Layers className="h-6 w-6 text-amber-600" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Multicopias</h2>
      </div>
      <p className="text-slate-600 dark:text-slate-400 mb-6">Gestiona solicitudes de copias de material evaluativo y agrega retroalimentación inteligente para Subdirección.</p>

      {puedeCrear && (
        <div className="mb-8">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3"><FileText className="h-5 w-5 text-amber-600" /> Nueva solicitud</h3>
          {renderForm()}
        </div>
      )}

      {puedeCrear && (
        <div className="mb-10">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3"><Users2 className="h-5 w-5 text-amber-600" /> Mis solicitudes</h3>
          {renderMisSolicitudes()}
        </div>
      )}

      {isSD && (
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3"><ClipboardCheck className="h-5 w-5 text-amber-600" /> Panel de Subdirección</h3>
          {renderPanelSD()}
        </div>
      )}

      {renderRejectModal()}
      {renderDeleteModal()}
      {renderAnalysisModal()}
    </div>
  );
};

export default Multicopias;
