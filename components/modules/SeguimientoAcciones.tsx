// components/modules/SeguimientoAcciones.tsx
import React, { useMemo, useState, useEffect, useCallback, ChangeEvent, FormEvent } from "react";
import { PME_DIMENSIONES, ESTADOS_ACCION_PME, EstadoAccionPME } from "../../constants";
import {
  AccionPME,
  getAllAcciones,
  createAccion,
  updateAccion,
  deleteAccion,
} from "../../src/firebaseHelpers/acciones";

// UI & Icons
import {
  BarChart3, ClipboardList, Plus, Save, Search, Filter, Calendar,
  User, FileText, Link2, Target, Gauge, CheckCircle2, Hourglass, AlertCircle,
  Trash2, Pencil, Download, LayoutGrid, ListChecks, LineChart, RefreshCcw, Sparkles, Palette
} from "lucide-react";

// Charts
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ["#0ea5e9","#22c55e","#f59e0b","#ef4444","#8b5cf6","#14b8a6","#a3e635","#f472b6"];

type TabKey = "registro" | "seguimiento" | "dashboard";

const initial: Omit<AccionPME, "id"|"creadoTs"> = {
  fechaRegistro: new Date().toISOString().split("T")[0],
  responsable: "",
  dimension: "",
  subdimension: "",
  descripcion: "",
  objetivos: "",
  indicadores: [],
  cobertura: "",
  fechaInicio: "",
  fechaCumplimiento: "",
  estado: "Pendiente",
  avance: 0,
  enlaces: []
};

// ===== Styles (more color) =====
const card = "rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 shadow-sm backdrop-blur";
const inputBase = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/70 focus:border-fuchsia-500/70 transition";
const labelBase = "block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2";

const tabBase = "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition";
const tabActive = "bg-gradient-to-r from-fuchsia-600 to-rose-500 text-white shadow-sm";
const tabInactive = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700";

const kpiCard = "rounded-2xl p-5 text-white shadow-md bg-gradient-to-br";
const kpi1 = "from-sky-500 to-indigo-500";
const kpi2 = "from-emerald-500 to-lime-500";
const kpi3 = "from-amber-500 to-rose-500";
const kpi4 = "from-fuchsia-500 to-purple-600";

const statusMap: Record<EstadoAccionPME, { badge: string; icon: any; dot: string }> = {
  "Pendiente": {
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-800",
    icon: AlertCircle,
    dot: "bg-rose-500"
  },
  "En Proceso": {
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800",
    icon: Hourglass,
    dot: "bg-amber-500"
  },
  "Cumplida": {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800",
    icon: CheckCircle2,
    dot: "bg-emerald-500"
  },
};

const estadoBadge = (estado: EstadoAccionPME) => {
  const Icon = statusMap[estado].icon;
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${statusMap[estado].badge}`}>
      <span className={`h-2 w-2 rounded-full ${statusMap[estado].dot}`} />
      <Icon className="h-4 w-4" /> {estado}
    </span>
  );
};

const SeguimientoAcciones: React.FC = () => {
  const [tab, setTab] = useState<TabKey>("registro");
  const [acciones, setAcciones] = useState<AccionPME[]>([]);
  const [form, setForm] = useState<Omit<AccionPME, "id"|"creadoTs">>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [fDim, setFDim] = useState("");
  const [fSub, setFSub] = useState("");
  const [fEst, setFEst] = useState("");

  const subOptions = useMemo(() => PME_DIMENSIONES[form.dimension] ?? [], [form.dimension]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getAllAcciones();
      setAcciones(rows);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar las acciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onField = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const onIndicadores = (value: string) => {
    const arr = value.split(",").map(s => s.trim()).filter(Boolean);
    setForm(prev => ({ ...prev, indicadores: arr }));
  };

  const onEnlaces = (value: string) => {
    const arr = value.split(",").map(s => s.trim()).filter(Boolean);
    setForm(prev => ({ ...prev, enlaces: arr }));
  };

  const resetForm = () => {
    setForm(initial);
    setEditingId(null);
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.responsable || !form.dimension || !form.subdimension || !form.descripcion || !form.fechaCumplimiento) {
      setError("Responsable, dimensión, subdimensión, descripción y fecha de cumplimiento son obligatorios.");
      return;
    }
    try {
      if (editingId) {
        await updateAccion(editingId, form);
      } else {
        await createAccion(form);
      }
      await fetchData();
      resetForm();
      setTab("seguimiento");
    } catch (e) {
      console.error(e);
      setError("Error al guardar la acción.");
    }
  };

  const onEdit = (row: AccionPME) => {
    setEditingId(row.id);
    setForm({ ...row, enlaces: row.enlaces ?? [], indicadores: row.indicadores ?? [] });
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTab("registro");
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta acción?")) return;
    await deleteAccion(id);
    await fetchData();
  };

  // filters
  const filtered = useMemo(() => {
    return acciones.filter(a => {
      const mQ = !q || a.responsable.toLowerCase().includes(q.toLowerCase()) ||
        a.descripcion.toLowerCase().includes(q.toLowerCase()) ||
        a.subdimension.toLowerCase().includes(q.toLowerCase());
      const mD = !fDim || a.dimension === fDim;
      const mS = !fSub || a.subdimension === fSub;
      const mE = !fEst || a.estado === fEst as EstadoAccionPME;
      return mQ && mD && mS && mE;
    });
  }, [acciones, q, fDim, fSub, fEst]);

  // dashboard data
  const byDimension = useMemo(() => {
    const map = new Map<string, number>();
    acciones.forEach(a => map.set(a.dimension, (map.get(a.dimension) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [acciones]);

  const byEstado = useMemo(() => {
    const map = new Map<string, number>();
    acciones.forEach(a => map.set(a.estado, (map.get(a.estado) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [acciones]);

  const avancePromedio = useMemo(() => {
    const arr = acciones.map(a => a.avance ?? 0);
    if (!arr.length) return 0;
    return Math.round(arr.reduce((s, n) => s + n, 0) / arr.length);
  }, [acciones]);

  const topSubdim = useMemo(() => {
    const map = new Map<string, number>();
    acciones.forEach(a => map.set(a.subdimension, (map.get(a.subdimension) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0,6);
  }, [acciones]);

  const exportCSV = () => {
    const headers = [
      "id","fechaRegistro","responsable","dimension","subdimension","descripcion","objetivos","indicadores","cobertura","fechaInicio","fechaCumplimiento","estado","avance","enlaces"
    ];
    const rows = acciones.map(a => [
      a.id, a.fechaRegistro, a.responsable, a.dimension, a.subdimension, a.descripcion.replace(/\n/g," "),
      a.objetivos ?? "", (a.indicadores??[]).join("|"), a.cobertura ?? "", a.fechaInicio ?? "", a.fechaCumplimiento, a.estado, a.avance ?? 0, (a.enlaces??[]).join("|")
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pme_acciones_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header colorful */}
      <div className="relative overflow-hidden rounded-3xl border border-fuchsia-200/60 dark:border-fuchsia-700/30">
        <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/20 via-rose-500/20 to-amber-400/20 blur-3xl" />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/60 dark:bg-slate-900/40 backdrop-blur">
          <div>
            <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-fuchsia-600 via-rose-600 to-amber-600 bg-clip-text text-transparent flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-fuchsia-600" /> Seguimiento de Acciones (PME)
            </h1>
            <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Palette className="h-4 w-4" /> Registro, seguimiento y dashboard por Dimensión/Subdimensión.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-white">
              <RefreshCcw className="h-4 w-4" /> Refrescar
            </button>
            <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-gradient-to-r from-fuchsia-600 to-rose-500 hover:opacity-90">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={()=>setTab("registro")} className={`${tabBase} ${tab==="registro" ? tabActive : tabInactive}`}>
          <ClipboardList className="h-4 w-4" /> Registro
        </button>
        <button onClick={()=>setTab("seguimiento")} className={`${tabBase} ${tab==="seguimiento" ? tabActive : tabInactive}`}>
          <ListChecks className="h-4 w-4" /> Seguimiento
        </button>
        <button onClick={()=>setTab("dashboard")} className={`${tabBase} ${tab==="dashboard" ? tabActive : tabInactive}`}>
          <LineChart className="h-4 w-4" /> Dashboard
        </button>
      </div>

      {/* Registro */}
      {tab === "registro" && (
        <div className={card}>
          <form onSubmit={onSubmit} className="p-6 md:p-8 space-y-6">
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelBase}>Fecha de Registro</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fuchsia-500" />
                  <input type="date" name="fechaRegistro" value={form.fechaRegistro} onChange={onField} className={inputBase + " pl-10"} />
                </div>
              </div>

              <div>
                <label className={labelBase}>Responsable</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-500" />
                  <input type="text" name="responsable" placeholder="Nombre" value={form.responsable} onChange={onField} className={inputBase + " pl-10"} />
                </div>
              </div>

              <div>
                <label className={labelBase}>Cobertura (niveles/cursos)</label>
                <div className="relative">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                  <input type="text" name="cobertura" placeholder="2°A, 2°B, 3°Mecánica..." value={form.cobertura ?? ""} onChange={onField} className={inputBase + " pl-10"} />
                </div>
              </div>

              <div>
                <label className={labelBase}>Dimensión PME</label>
                <div className="relative">
                  <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500" />
                  <select name="dimension" value={form.dimension} onChange={onField} className={inputBase + " pl-10"}>
                    <option value="">Selecciona una dimensión</option>
                    {Object.keys(PME_DIMENSIONES).map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className={labelBase}>Subdimensión</label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-500" />
                  <select name="subdimension" value={form.subdimension} onChange={onField} className={inputBase + " pl-10"} disabled={!form.dimension}>
                    <option value="">{form.dimension ? "Selecciona una subdimensión" : "Primero elige una dimensión"}</option>
                    {subOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className={labelBase}>Descripción de la Acción</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-fuchsia-500" />
                  <textarea name="descripcion" value={form.descripcion} onChange={onField} rows={3} placeholder="¿Qué se hará? ¿Dónde y con quién?" className={inputBase + " pl-10"} />
                </div>
              </div>

              <div className="md:col-span-3">
                <label className={labelBase}>Objetivos (opcional)</label>
                <textarea name="objetivos" value={form.objetivos ?? ""} onChange={onField} rows={2} placeholder="Propósitos pedagógicos" className={inputBase} />
              </div>

              <div>
                <label className={labelBase}>Indicadores (separados por coma)</label>
                <input type="text" value={(form.indicadores ?? []).join(", ")} onChange={(e)=>onIndicadores(e.target.value)} placeholder="Cobertura OA, asistencia, resultados..." className={inputBase} />
              </div>

              <div>
                <label className={labelBase}>Fecha de Inicio</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500" />
                  <input type="date" name="fechaInicio" value={form.fechaInicio ?? ""} onChange={onField} className={inputBase + " pl-10"} />
                </div>
              </div>

              <div>
                <label className={labelBase}>Fecha de Cumplimiento</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                  <input type="date" name="fechaCumplimiento" value={form.fechaCumplimiento} onChange={onField} className={inputBase + " pl-10"} />
                </div>
              </div>

              <div>
                <label className={labelBase}>Estado</label>
                <select name="estado" value={form.estado} onChange={onField} className={inputBase}>
                  {ESTADOS_ACCION_PME.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label className={labelBase}>Avance (%)</label>
                <div className="relative">
                  <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                  <input type="number" min={0} max={100} name="avance" value={form.avance ?? 0} onChange={onField} className={inputBase + " pl-10"} />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className={labelBase}>Enlaces de evidencia (separados por coma)</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500" />
                  <input type="text" value={(form.enlaces ?? []).join(", ")} onChange={(e)=>onEnlaces(e.target.value)} placeholder="https://..., https://..." className={inputBase + " pl-10"} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {editingId && (
                <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                  Cancelar
                </button>
              )}
              <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-500 hover:opacity-90">
                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Guardar cambios" : "Registrar acción"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Seguimiento */}
      {tab === "seguimiento" && (
        <div className={card}>
          <div className="p-4 md:p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fuchsia-600" />
                <input className={inputBase + " pl-10"} placeholder="Buscar por responsable, descripción o subdimensión..." value={q} onChange={e=>setQ(e.target.value)} />
              </div>
              <select value={fDim} onChange={e=>{setFDim(e.target.value); setFSub("");}} className={inputBase}>
                <option value="">Todas las dimensiones</option>
                {Object.keys(PME_DIMENSIONES).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <select value={fSub} onChange={e=>setFSub(e.target.value)} className={inputBase}>
                <option value="">Todas las subdimensiones</option>
                {(PME_DIMENSIONES[fDim] ?? Object.values(PME_DIMENSIONES).flat()).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={fEst} onChange={e=>setFEst(e.target.value)} className={inputBase}>
                <option value="">Todos los estados</option>
                {ESTADOS_ACCION_PME.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-gradient-to-r from-fuchsia-50 to-rose-50 dark:from-slate-800 dark:to-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-fuchsia-700 dark:text-fuchsia-300">Responsable</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Dimensión / Subdimensión</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Descripción</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Fechas</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">Avance</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/40">
                  {filtered.map(row => (
                    <tr key={row.id} className="hover:bg-fuchsia-50/50 dark:hover:bg-slate-800/60 transition">
                      <td className="px-4 py-4 align-top text-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 text-white flex items-center justify-center font-bold shadow-sm">
                            {row.responsable?.slice(0,1)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{row.responsable}</div>
                            <div className="text-xs text-slate-500">{row.cobertura}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm">
                        <div className="font-semibold text-indigo-700 dark:text-indigo-300">{row.dimension}</div>
                        <div className="text-xs text-slate-500">{row.subdimension}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm max-w-md">
                        <div className="text-slate-700 dark:text-slate-200">{row.descripcion}</div>
                        {row.enlaces && row.enlaces.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {row.enlaces.map((u,i)=>(
                              <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-fuchsia-700 hover:text-fuchsia-900 dark:text-fuchsia-300">
                                <Link2 className="h-3.5 w-3.5" /> Evidencia {i+1}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-sm whitespace-nowrap">
                        <div className="text-xs text-slate-500">Reg: {row.fechaRegistro || "-"}</div>
                        <div className="text-xs text-slate-500">Ini: {row.fechaInicio || "-"}</div>
                        <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Fin: {row.fechaCumplimiento}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-center">{estadoBadge(row.estado)}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="w-28 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-500" style={{ width: `${Math.min(Math.max(row.avance ?? 0, 0), 100)}%` }} />
                        </div>
                        <div className="text-xs text-center mt-1">{row.avance ?? 0}%</div>
                      </td>
                      <td className="px-4 py-4 align-top text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={()=>onEdit(row)} className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-800" title="Editar">
                            <Pencil className="h-5 w-5 text-amber-600" />
                          </button>
                          <button onClick={()=>onDelete(row.id)} className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800" title="Eliminar">
                            <Trash2 className="h-5 w-5 text-rose-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Sin registros</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* KPIs */}
          <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`${kpiCard} ${kpi1}`}>
              <div className="flex items-center gap-4">
                <BarChart3 className="h-10 w-10 opacity-90" />
                <div>
                  <div className="text-xs uppercase/relaxed">Acciones totales</div>
                  <div className="text-2xl font-black">{acciones.length}</div>
                </div>
              </div>
            </div>
            <div className={`${kpiCard} ${kpi2}`}>
              <div className="flex items-center gap-4">
                <CheckCircle2 className="h-10 w-10 opacity-90" />
                <div>
                  <div className="text-xs uppercase/relaxed">Cumplidas</div>
                  <div className="text-2xl font-black">{byEstado.find(x=>x.name==="Cumplida")?.value ?? 0}</div>
                </div>
              </div>
            </div>
            <div className={`${kpiCard} ${kpi3}`}>
              <div className="flex items-center gap-4">
                <Hourglass className="h-10 w-10 opacity-90" />
                <div>
                  <div className="text-xs uppercase/relaxed">En proceso</div>
                  <div className="text-2xl font-black">{byEstado.find(x=>x.name==="En Proceso")?.value ?? 0}</div>
                </div>
              </div>
            </div>
            <div className={`${kpiCard} ${kpi4}`}>
              <div className="flex items-center gap-4">
                <Gauge className="h-10 w-10 opacity-90" />
                <div>
                  <div className="text-xs uppercase/relaxed">Avance promedio</div>
                  <div className="text-2xl font-black">{avancePromedio}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Barras por dimensión */}
          <div className={card + " p-5"}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Acciones por dimensión</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDimension}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" hide />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value">
                    {byDimension.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1">
              {byDimension.map((d, i)=>(
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{background: COLORS[i % COLORS.length]}} />
                  <span className="flex-1">{d.name}</span>
                  <span className="font-semibold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pie por estado */}
          <div className={card + " p-5"}>
            <h3 className="font-semibold mb-4 text-slate-800 dark:text-slate-100">Distribución por estado</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byEstado} dataKey="value" nameKey="name" outerRadius={90} label>
                    {byEstado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top subdimensiones */}
          <div className={card + " p-5"}>
            <h3 className="font-semibold mb-4 text-slate-800 dark:text-slate-100">Subdimensiones más trabajadas</h3>
            <ul className="space-y-2">
              {topSubdim.map((t,i)=>(
                <li key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{background: COLORS[i % COLORS.length]}} />
                    {t.name}
                  </div>
                  <span className="font-semibold">{t.value}</span>
                </li>
              ))}
              {topSubdim.length === 0 && <li className="text-slate-500">Sin datos</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeguimientoAcciones;
