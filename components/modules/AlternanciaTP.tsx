// components/modules/AlternanciaTP.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { User } from "../../types";

// Helpers (no modificados)
import {
  getAlternancias,
  createAlternancia,
  updateAlternancia,
  deleteAlternancia,
  uploadEvidencia,
} from "../../src/firebaseHelpers/alternanciaHelper";
import { getSubDocs } from "../../src/firebaseHelpers/alternanciaHelper";

// Íconos Lucide
import {
  Plus,
  Trash2,
  Save,
  Upload,
  Briefcase,
  Building2,
  School,
  Layers,
  ClipboardList,
  Calendar as CalendarIcon,
  MapPin,
  FileCheck,
  Users,
  ShieldCheck,
  BookOpenCheck,
  ListChecks,
  Edit3,
  X,
  Search,
  Filter,
  Loader2,
  CheckCircle2,
} from "lucide-react";

// Constantes (no modificadas)
import {
  ESPECIALIDADES_TP,
  INSTITUCIONES_TP,
  CURSOS_BY_ESPECIALIDAD_TP,
  MODULOS_MAP_TP,      // especialidad -> string[]
  TIPOS_ALTERNANCIA_TP,
  OAS_MAP_TP,          // especialidad -> { [módulo]: string[] }
} from "../../constants";

// =========================
// Tipos
// =========================
interface AlternanciaTPProps {
  currentUser: User;
}

interface Actividad {
  fecha: string;
  tipo: string;
  actividad: string;
  lugar: string;
  evidencias: string;
  modulo?: string;
  oa?: string;
}

interface Integrante {
  rol: string;
  nombre: string;
  correo: string;
}

interface FormValues {
  especialidad: string;
  curso: string[];            // multiselect 3ºA...4ºD (según especialidad)
  institucion: string;        // INACAP, UNAB, DUOC, UDLA
  modulos: string[];          // según especialidad
  tipoAlternancia: string[];  // checkboxes
  fundamentacion: string;
  actividades: Actividad[];
  equipo: Integrante[];
  contrapartes: Integrante[];
  tutores: Integrante[];
  analisisCurricular: string;
}

// =========================
// Utilidades UI (solo presentación, no cambian lógica)
// =========================
const SectionCard: React.FC<
  React.PropsWithChildren<{ title: string; icon?: React.ReactNode; accent?: "indigo" | "emerald" | "amber" | "sky" | "slate" }>
> = ({ title, icon, children, accent = "indigo" }) => {
  const accents: Record<string, string> = {
    indigo: "border-indigo-200 bg-indigo-50/60",
    emerald: "border-emerald-200 bg-emerald-50/60",
    amber: "border-amber-200 bg-amber-50/60",
    sky: "border-sky-200 bg-sky-50/60",
    slate: "border-slate-200 bg-white/70",
  };
  return (
    <div className={`rounded-2xl border ${accents[accent]} p-4 md:p-5 shadow-sm`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white shadow-sm border border-slate-200">
          {icon}
        </div>
        <h2 className="text-lg md:text-xl font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  );
};

const FieldLabel: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div className="mb-1 flex items-center gap-2">
    <span className="text-sm font-medium text-slate-700">{children}</span>
    {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
  </div>
);

// Píldoras para selección múltiple
const Pill: React.FC<{ children: React.ReactNode; tone?: "indigo" | "emerald" | "amber" | "sky" }>= ({ children, tone = "indigo" }) => {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    sky: "bg-sky-100 text-sky-700 border-sky-200",
  };
  return <span className={`text-xs px-2 py-1 rounded-full border ${tones[tone]}`}>{children}</span>;
};

const IconButton: React.FC<{
  title: string;
  onClick?: () => void;
  tone?: "primary" | "danger" | "neutral" | "warning" | "success";
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
}> = ({ title, onClick, tone = "neutral", children, type = "button", disabled }) => {
  const tones: Record<string, string> = {
    primary:
      "bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 shadow-sm",
    danger:
      "bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 shadow-sm",
    warning:
      "bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 shadow-sm",
    success:
      "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-sm",
    neutral:
      "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${tones[tone]} disabled:opacity-60`}
    >
      {children}
    </button>
  );
};

const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// =========================
// Componente principal
// =========================
const AlternanciaTP: React.FC<AlternanciaTPProps> = ({ currentUser }) => {
  const [alternancias, setAlternancias] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [viewerAlt, setViewerAlt] = useState<any | null>(null);
  const [viewerEvidencias, setViewerEvidencias] = useState<any[]>([]);
  const [viewerLoading, setViewerLoading] = useState<boolean>(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      especialidad: "",
      curso: [],
      institucion: "",
      modulos: [],
      tipoAlternancia: [],
      fundamentacion: "",
      actividades: [],
      equipo: [],
      contrapartes: [],
      tutores: [],
      analisisCurricular: "",
    },
  });

  const actividadesFA = useFieldArray({ control, name: "actividades" });

  // --- Acceso flexible (coordinación/subdirección) ---
  const allowedRoles = ["COORDINACION_TP", "SUBDIRECCION"];
  const userRoleNormalized = (currentUser?.role || "").toString().trim().toUpperCase();
  const hasAccess =
    !userRoleNormalized || allowedRoles.some((r) => userRoleNormalized.includes(r));
  if (!hasAccess)
    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-rose-700 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Acceso no autorizado
        </div>
      </div>
    );

  // --- Helpers ---
  // Normaliza módulos que pudieran venir con "– 228 horas" desde BD antigua
  const normalizeModule = (s: string) =>
    (s || "").replace(/\s*[-–]\s*\d+\s*horas?$/i, "").trim();

  const getOAsForModule = (esp: string, modulo?: string): string[] => {
    if (!esp || !modulo) return [];
    return OAS_MAP_TP[esp]?.[modulo] ?? [];
  };

  // --- Dependencias de UI ---
  const especialidad = watch("especialidad");
  const selectedModules: string[] = watch("modulos") || [];

  const cursosDisponibles = useMemo<string[]>(
    () => (especialidad ? CURSOS_BY_ESPECIALIDAD_TP[especialidad] ?? [] : []),
    [especialidad]
  );

  const modulosDisponibles = useMemo<string[]>(
    () => (especialidad ? MODULOS_MAP_TP[especialidad] ?? [] : []),
    [especialidad]
  );

  // Reseteos dependientes
  useEffect(() => {
    setValue("curso", []);
    setValue("modulos", []);
    // limpiar módulo/OA en actividades si cambia especialidad
    const acts = [...(watch("actividades") || [])].map((a) => ({ ...a, modulo: "", oa: "" }));
    setValue("actividades", acts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [especialidad]);

  useEffect(() => {
    // Si cambian los módulos seleccionados, limpiar OA en actividades cuyo módulo ya no está seleccionado
    const acts = [...(watch("actividades") || [])].map((a) =>
      a.modulo && !selectedModules.includes(a.modulo) ? { ...a, modulo: "", oa: "" } : a
    );
    setValue("actividades", acts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModules]);

  // --- Cargar lista ---
  const loadAlternancias = async () => {
    setLoading(true);
    const { items } = await getAlternancias({});
    setAlternancias(items);
    setLoading(false);
  };

  useEffect(() => {
    loadAlternancias();
  }, []);

  // --- Guardar ---
  const onSubmit = async (data: FormValues) => {
    if (selectedId) {
      await updateAlternancia(selectedId, { ...data });
    } else {
      await createAlternancia({ ...data, createdBy: currentUser?.email || "desconocido" });
    }
    reset();
    setSelectedId(null);
    await loadAlternancias();
  };

  // --- Editar / Eliminar ---
  const onEdit = (alt: any) => {
    // Normaliza curso (si viniera como string) y módulos/actividades “con horas”
    const cursoNormalized = Array.isArray(alt.curso) ? alt.curso : alt.curso ? [alt.curso] : [];
    const modulosNormalized = Array.isArray(alt.modulos)
      ? alt.modulos.map((m: string) => normalizeModule(m))
      : [];
    const actsNormalized = Array.isArray(alt.actividades)
      ? alt.actividades.map((a: any) => ({
          ...a,
          modulo: a?.modulo ? normalizeModule(a.modulo) : "",
          oa: a?.oa || "",
        }))
      : [];

    reset({ ...alt, curso: cursoNormalized, modulos: modulosNormalized, actividades: actsNormalized });
    setSelectedId(alt.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDeleteClick = async (id: string) => {
    if (confirm("¿Eliminar esta alternancia?")) {
      await deleteAlternancia(id);
      await loadAlternancias();
    }
  };

  // --- Evidencias ---
  const onUploadEvidencia = async (id: string, file: File) => {
    await uploadEvidencia(id, file);
    alert("Evidencia subida correctamente");
  };

  // --- Visor detallado ---
  const openViewer = async (alt: any) => {
    setViewerLoading(true);
    // Normaliza campos para visualización coherente
    const cursoNormalized = Array.isArray(alt.curso) ? alt.curso : alt.curso ? [alt.curso] : [];
    const modulosNormalized = Array.isArray(alt.modulos) ? alt.modulos : [];
    const actsNormalized = Array.isArray(alt.actividades)
      ? alt.actividades.map((a: any) => ({
          fecha: a?.fecha || "",
          tipo: a?.tipo || "",
          actividad: a?.actividad || "",
          lugar: a?.lugar || "",
          evidencias: a?.evidencias || "",
          modulo: a?.modulo || "",
          oa: a?.oa || "",
        }))
      : [];
    const data = { ...alt, curso: cursoNormalized, modulos: modulosNormalized, actividades: actsNormalized };
    setViewerAlt(data);
    try {
      const evs = await getSubDocs(alt.id, "evidencias");
      setViewerEvidencias(evs);
    } catch (e) {
      setViewerEvidencias([]);
    }
    setViewerOpen(true);
    setViewerLoading(false);
  };

  // Multiselect de curso → array de strings
  const handleCursoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.currentTarget.selectedOptions).map((o) => o.value);
    setValue("curso", values, { shouldDirty: true });
  };

  // =========================
  // Render
  // =========================
  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 text-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">Formación por Alternancia</h1>
              <p className="text-white/90 text-sm">
                Registra planes, actividades y evidencias. Interfaz moderna, responsiva y con íconos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              title="Nuevo plan"
              onClick={() => {
                reset();
                setSelectedId(null);
              }}
              tone="neutral"
            >
              <X className="w-4 h-4" />
              Limpiar
            </IconButton>
            <IconButton title="Guardar" type="submit" tone="success" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </IconButton>
          </div>
        </div>
      </div>

      {/* Listado */}
      <SectionCard title="Planes guardados" icon={<ClipboardList className="w-5 h-5 text-slate-700" />} accent="slate">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
          </div>
        ) : alternancias.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay alternancias registradas</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {alternancias.map((alt) => (
              <div
                key={alt.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold">
                      <School className="w-4 h-4 text-indigo-600" />
                      {alt.especialidad}
                    </div>
                    <div className="text-sm text-slate-600 flex flex-wrap gap-2">
                      <Pill tone="indigo">{Array.isArray(alt.curso) ? alt.curso.join(", ") : alt.curso}</Pill>
                      <Pill tone="sky">{alt.institucion}</Pill>
                      {(Array.isArray(alt.tipoAlternancia) ? alt.tipoAlternancia : [])
                        .slice(0, 2)
                        .map((t: string) => (
                          <Pill key={t} tone="emerald">{t}</Pill>
                        ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <IconButton title="Ver" onClick={() => openViewer(alt)}>
                      <EyeIcon className="w-4 h-4" /> Ver
                    </IconButton>
                    <label className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-2 transition">
                      <Upload className="w-4 h-4" />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files && onUploadEvidencia(alt.id, e.target.files[0])}
                      />
                      Evidencia
                    </label>
                    <IconButton title="Editar" onClick={() => onEdit(alt)}>
                      <Edit3 className="w-4 h-4" /> Editar
                    </IconButton>
                    <IconButton title="Eliminar" onClick={() => onDeleteClick(alt.id)} tone="danger">
                      <Trash2 className="w-4 h-4" /> Eliminar
                    </IconButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Modal Visor Detallado */}
      {viewerOpen && viewerAlt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewerOpen(false)} />
          <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl border border-slate-200">
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b bg-white/90 backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Plan de Alternancia</h3>
                  <p className="text-xs text-slate-500">Visualización detallada</p>
                </div>
              </div>
              <IconButton title="Cerrar" onClick={() => setViewerOpen(false)}>
                <X className="w-4 h-4" /> Cerrar
              </IconButton>
            </div>
            <div className="p-5 space-y-5">
              {/* Encabezado contextual */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <FieldLabel>Especialidad</FieldLabel>
                  <div className="flex items-center gap-2 text-slate-800"><School className="w-4 h-4 text-indigo-600" /> {viewerAlt.especialidad || "-"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <FieldLabel>Institución</FieldLabel>
                  <div className="flex items-center gap-2 text-slate-800"><Building2 className="w-4 h-4 text-sky-600" /> {viewerAlt.institucion || "-"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <FieldLabel>Cursos</FieldLabel>
                  <div className="flex flex-wrap gap-2">{(viewerAlt.curso || []).map((c: string) => (<Pill key={c} tone="sky">{c}</Pill>))}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <FieldLabel>Tipos de Alternancia</FieldLabel>
                  <div className="flex flex-wrap gap-2">{(viewerAlt.tipoAlternancia || []).map((t: string) => (<Pill key={t} tone="emerald">{t}</Pill>))}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <FieldLabel>Módulos</FieldLabel>
                  <div className="flex flex-wrap gap-2">{(viewerAlt.modulos || []).map((m: string) => (<Pill key={m} tone="indigo">{m}</Pill>))}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <FieldLabel>Creado por</FieldLabel>
                  <div className="text-slate-700 text-sm">{viewerAlt.createdBy || "-"}</div>
                </div>
              </div>

              {/* Fundamentación */}
              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-800 mb-2">Fundamentación técnico‑pedagógica</h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewerAlt.fundamentacion || "—"}</p>
              </div>

              {/* Plan de actividades */}
              <div className="rounded-2xl border border-slate-200">
                <div className="px-4 py-3 border-b bg-slate-50/50">
                  <h4 className="font-semibold text-slate-800">Plan de actividades</h4>
                </div>
                {viewerAlt.actividades && viewerAlt.actividades.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-2 text-left">Fecha</th>
                          <th className="p-2 text-left">Tipo</th>
                          <th className="p-2 text-left">Actividad</th>
                          <th className="p-2 text-left">Lugar</th>
                          <th className="p-2 text-left">Módulo</th>
                          <th className="p-2 text-left">OA</th>
                          <th className="p-2 text-left">Evidencias</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {viewerAlt.actividades.map((a: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2 text-slate-700">{a.fecha || "—"}</td>
                            <td className="p-2 text-slate-700">{a.tipo || "—"}</td>
                            <td className="p-2 text-slate-700">{a.actividad || "—"}</td>
                            <td className="p-2 text-slate-700">{a.lugar || "—"}</td>
                            <td className="p-2 text-slate-700">{a.modulo || "—"}</td>
                            <td className="p-2 text-slate-700">{a.oa || "—"}</td>
                            <td className="p-2 text-slate-700">{a.evidencias || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-slate-500">Sin actividades registradas</div>
                )}
              </div>

              {/* Participantes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="font-semibold text-slate-800 mb-2">Equipo</h4>
                  {(viewerAlt.equipo || []).length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {viewerAlt.equipo.map((p: any, i: number) => (
                        <li key={i} className="flex items-center justify-between">
                          <span className="text-slate-700">{p.nombre || "—"}</span>
                          <span className="text-slate-500">{p.rol || ""}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">Sin equipo registrado</p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="font-semibold text-slate-800 mb-2">Contrapartes</h4>
                  {(viewerAlt.contrapartes || []).length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {viewerAlt.contrapartes.map((p: any, i: number) => (
                        <li key={i} className="flex items-center justify-between">
                          <span className="text-slate-700">{p.nombre || "—"}</span>
                          <span className="text-slate-500">{p.rol || ""}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">Sin contrapartes</p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="font-semibold text-slate-800 mb-2">Tutores</h4>
                  {(viewerAlt.tutores || []).length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {viewerAlt.tutores.map((p: any, i: number) => (
                        <li key={i} className="flex items-center justify-between">
                          <span className="text-slate-700">{p.nombre || "—"}</span>
                          <span className="text-slate-500">{p.rol || ""}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">Sin tutores</p>
                  )}
                </div>
              </div>

              {/* Análisis Curricular */}
              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-800 mb-2">Análisis Curricular</h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewerAlt.analisisCurricular || "—"}</p>
              </div>

              {/* Evidencias Subidas */}
              <div className="rounded-2xl border border-slate-200">
                <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center justify-between">
                  <h4 className="font-semibold text-slate-800">Evidencias subidas</h4>
                  {viewerLoading && <span className="text-sm text-slate-500">Cargando…</span>}
                </div>
                {(viewerEvidencias || []).length > 0 ? (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {viewerEvidencias.map((evi) => (
                      <a
                        key={evi.id}
                        href={evi.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group rounded-xl border border-slate-200 p-3 hover:shadow-sm transition bg-white flex items-center gap-3"
                      >
                        <FileCheck className="w-5 h-5 text-emerald-600" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-800 truncate group-hover:underline">{evi.nombre || "archivo"}</div>
                          <div className="text-xs text-slate-500 truncate">{evi.path || ""}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-slate-500">No hay evidencias adjuntas</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
        {/* Especialidad / Institución / Cursos */}
        <SectionCard title="Contexto de la Alternancia" icon={<Building2 className="w-5 h-5 text-indigo-700" />} accent="indigo">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <FieldLabel>Especialidad</FieldLabel>
              <div className="relative">
                <School className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <select
                  {...register("especialidad")}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-9 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="">Selecciona…</option>
                  {ESPECIALIDADES_TP.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <FieldLabel>Institución</FieldLabel>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <select
                  {...register("institucion")}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-9 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-sky-100"
                >
                  <option value="">Selecciona…</option>
                  {INSTITUCIONES_TP.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <FieldLabel hint="Ctrl/Cmd + clic para seleccionar múltiples cursos.">Cursos</FieldLabel>
              <div className="relative">
                <Users className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <select
                  multiple
                  size={4}
                  {...register("curso")}
                  onChange={handleCursoChange}
                  className="w-full min-h-[120px] rounded-xl border border-slate-300 bg-white px-9 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-50"
                  disabled={!especialidad}
                >
                  {!especialidad ? (
                    <option value="">Elige especialidad primero</option>
                  ) : (
                    cursosDisponibles.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {/* Chips visuales */}
              <div className="mt-2 flex flex-wrap gap-2">
                {(watch("curso") || []).map((c) => (
                  <Pill key={c} tone="sky">{c}</Pill>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Módulos */}
        <SectionCard title="Módulos implicados" icon={<Layers className="w-5 h-5 text-emerald-700" />} accent="emerald">
          {!especialidad ? (
            <p className="text-sm text-slate-500">Elige una especialidad para ver los módulos.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {modulosDisponibles.map((m) => (
                <label key={m} className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm hover:shadow transition">
                  <input
                    type="checkbox"
                    value={m}
                    className="mt-1 accent-emerald-600"
                    {...register("modulos")}
                  />
                  <span className="text-sm text-slate-700">{m}</span>
                </label>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Tipo de Alternancia */}
        <SectionCard title="Tipo de Alternancia" icon={<ListChecks className="w-5 h-5 text-amber-700" />} accent="amber">
          <div className="flex gap-3 flex-wrap">
            {TIPOS_ALTERNANCIA_TP.map((tipo) => (
              <label key={tipo} className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-2 text-sm shadow-sm hover:shadow transition">
                <input type="checkbox" value={tipo} className="accent-amber-600" {...register("tipoAlternancia")} />
                <span className="text-slate-700">{tipo}</span>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* Fundamentación */}
        <SectionCard title="Fundamentación técnico‑pedagógica" icon={<BookOpenCheck className="w-5 h-5 text-slate-700" />} accent="slate">
          <textarea
            {...register("fundamentacion")}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-100"
            rows={4}
            placeholder="Describe brevemente la finalidad pedagógica, vínculos curriculares y el aporte para los estudiantes."
          />
        </SectionCard>

        {/* Actividades (con Módulo + OA) */}
        <SectionCard title="Plan de actividades" icon={<ClipboardList className="w-5 h-5 text-indigo-700" />} accent="indigo">
          <div className="space-y-3">
            {actividadesFA.fields.map((field, index) => {
              const currentModule = watch(`actividades.${index}.modulo` as const) || "";
              const oaOptions = getOAsForModule(especialidad, currentModule);

              return (
                <div key={field.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    <div className="relative">
                      <FieldLabel>Fecha</FieldLabel>
                      <CalendarIcon className="w-4 h-4 absolute left-3 top-9 text-slate-400" />
                      <input
                        type="date"
                        placeholder="Fecha"
                        {...register(`actividades.${index}.fecha` as const)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-9 py-2 text-sm shadow-sm"
                      />
                    </div>
                    <div>
                      <FieldLabel>Tipo</FieldLabel>
                      <input
                        placeholder="Pasantía, visita, taller..."
                        {...register(`actividades.${index}.tipo` as const)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                      />
                    </div>
                    <div>
                      <FieldLabel>Actividad</FieldLabel>
                      <input
                        placeholder="Descripción breve"
                        {...register(`actividades.${index}.actividad` as const)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                      />
                    </div>
                    <div className="relative">
                      <FieldLabel>Lugar</FieldLabel>
                      <MapPin className="w-4 h-4 absolute left-3 top-9 text-slate-400" />
                      <input
                        placeholder="Empresa/IP/CFT/Lab"
                        {...register(`actividades.${index}.lugar` as const)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-9 py-2 text-sm shadow-sm"
                      />
                    </div>
                    <div className="relative">
                      <FieldLabel>Evidencias</FieldLabel>
                      <FileCheck className="w-4 h-4 absolute left-3 top-9 text-slate-400" />
                      <input
                        placeholder="Informe, fotos, lista asistencia..."
                        {...register(`actividades.${index}.evidencias` as const)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-9 py-2 text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <FieldLabel>Módulo</FieldLabel>
                      <select
                        {...register(`actividades.${index}.modulo` as const)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:opacity-50"
                        disabled={!especialidad || selectedModules.length === 0}
                      >
                        <option value="">
                          {(!especialidad && "Elige especialidad arriba") ||
                            (selectedModules.length === 0 && "Selecciona módulos arriba") ||
                            "Selecciona…"}
                        </option>
                        {selectedModules.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <FieldLabel>Objetivo de Aprendizaje (OA)</FieldLabel>
                      <select
                        {...register(`actividades.${index}.oa` as const)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:opacity-50"
                        disabled={!currentModule || oaOptions.length === 0}
                      >
                        <option value="">
                          {!currentModule
                            ? "Selecciona módulo primero"
                            : oaOptions.length === 0
                            ? "Sin OA definidos para este módulo"
                            : "Selecciona…"}
                        </option>
                        {oaOptions.map((oa) => (
                          <option key={oa} value={oa}>
                            {oa}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <IconButton
                      title="Eliminar fila"
                      onClick={() => actividadesFA.remove(index)}
                      tone="danger"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar actividad
                    </IconButton>
                  </div>
                </div>
              );
            })}

            <IconButton
              title="Agregar actividad"
              onClick={() =>
                actividadesFA.append({
                  fecha: "",
                  tipo: "",
                  actividad: "",
                  lugar: "",
                  evidencias: "",
                  modulo: "",
                  oa: "",
                })
              }
              tone="primary"
            >
              <Plus className="w-4 h-4" /> Agregar actividad
            </IconButton>
          </div>
        </SectionCard>

        {/* Análisis Curricular */}
        <SectionCard title="Análisis Curricular" icon={<School className="w-5 h-5 text-slate-700" />} accent="slate">
          <textarea
            {...register("analisisCurricular")}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-100"
            rows={4}
            placeholder="Módulos implicados + OA/AE asociados + distribución de horas (liceo/otro lugar)."
          />
        </SectionCard>

        {/* Guardar */}
        <div className="flex items-center justify-end gap-2">
          <IconButton
            title="Guardar"
            type="submit"
            tone="success"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Guardar
          </IconButton>
        </div>
      </form>
    </div>
  );
};

export default AlternanciaTP;
