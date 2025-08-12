import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  FormEvent,
  ChangeEvent,
} from "react";
import { Reemplazo, User } from "../../types";
import { ASIGNATURAS, CURSOS } from "../../constants";

// Firebase helpers
import {
  saveReemplazo,
  deleteReemplazo,
  subscribeToReemplazos,
  subscribeToProfesores,
  searchReemplazos,
  getReemplazosStats,
} from "../../src/firebaseHelpers/reemplazosHelper";

// Íconos Lucide
import {
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Percent,
  Calendar as CalendarIcon,
  Users,
  BookOpen,
  Search,
  Loader2,
  Save as SaveIcon,
  Trash2,
  GraduationCap,
  Clock,
  UserMinus,
  UserPlus,
} from "lucide-react";

const BLOQUES = Array.from({ length: 12 }, (_, i) => i + 1);

const initialState: Omit<Reemplazo, "id" | "resultado"> = {
  docenteAusente: "",
  asignaturaAusente: "",
  curso: "",
  diaAusencia: "",
  bloquesAfectados: [],
  docenteReemplazante: "",
  asignaturaReemplazante: "",
};

// =================== HOOKS ===================

const useReemplazos = (userId: string) => {
  const [reemplazos, setReemplazos] = useState<Reemplazo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToReemplazos(userId, (data) => {
      setReemplazos(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  const save = useCallback(
    async (reemplazo: Omit<Reemplazo, "id">) => {
      try {
        setError(null);
        return await saveReemplazo(reemplazo, userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
        throw err;
      }
    },
    [userId]
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        setError(null);
        await deleteReemplazo(id, userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar");
        throw err;
      }
    },
    [userId]
  );

  const search = useCallback(
    async (searchTerm: string) => {
      try {
        setError(null);
        if (!searchTerm.trim()) return reemplazos;
        return await searchReemplazos(userId, searchTerm);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error en la búsqueda");
        return [];
      }
    },
    [userId, reemplazos]
  );

  return { reemplazos, loading, error, save, remove, search };
};

const useProfesores = () => {
  const [profesores, setProfesores] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToProfesores((data) => {
      setProfesores(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const profesorNames = useMemo(
    () => profesores.map((p) => p.nombreCompleto).sort(),
    [profesores]
  );

  return { profesores, profesorNames, loading };
};

// =================== UI HELPERS ===================

const InputShell: React.FC<{
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, icon, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
      {label}
    </label>
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          {icon}
        </div>
      )}
      {children}
    </div>
  </div>
);

const chipBase =
  "inline-flex items-center justify-center rounded-xl border text-sm px-3 py-2 transition-all";
const chipOn =
  "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700";
const chipOff =
  "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700";

// =================== STATS ===================

const StatTile: React.FC<{
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}> = ({ title, value, icon }) => (
  <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <div className="grid place-items-center h-12 w-12 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
      {icon}
    </div>
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </div>
      <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
        {value}
      </div>
    </div>
  </div>
);

type MiniBarDatum = { label: string; value: number };

const MiniBars: React.FC<{ data: MiniBarDatum[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Distribución (graficable)
      </div>
      <div className="grid gap-3">
        {data.map((d) => (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{d.label}</span>
              <span>{d.value}</span>
            </div>
            <div className="h-2 w-full rounded bg-slate-200/60 dark:bg-slate-700">
              <div
                className="h-2 rounded bg-slate-900 dark:bg-amber-500"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatsCard: React.FC<{ userId: string; reemplazos: Reemplazo[] }> = ({
  userId,
  reemplazos,
}) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getReemplazosStats(userId);
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadStats();
  }, [userId, loadStats]);

  // Agregados graficables (únicos del mes)
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const delMes = useMemo(
    () =>
      (reemplazos || []).filter((r) => {
        const d = new Date(r.diaAusencia + "T00:00:00");
        return d.getMonth() === month && d.getFullYear() === year;
      }),
    [reemplazos, month, year]
  );

  const setAusentes = new Set(delMes.map((r) => r.docenteAusente).filter(Boolean));
  const setReemplazan = new Set(
    delMes.map((r) => r.docenteReemplazante).filter(Boolean)
  );
  const setCursos = new Set(delMes.map((r) => r.curso).filter(Boolean));
  const setAsigAusentes = new Set(
    delMes.map((r) => r.asignaturaAusente).filter(Boolean)
  );

  const grafData: MiniBarDatum[] = [
    { label: "Prof. ausentes", value: setAusentes.size },
    { label: "Prof. que reemplazan", value: setReemplazan.size },
    { label: "Cursos", value: setCursos.size },
    { label: "Asignaturas ausentes", value: setAsigAusentes.size },
  ];

  if (loading || !stats) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando estadísticas…
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          title="Total"
          value={stats.totalReemplazos}
          icon={<BellRing className="h-6 w-6" />}
        />
        <StatTile
          title="Realizadas"
          value={stats.horasRealizadas}
          icon={<CheckCircle2 className="h-6 w-6" />}
        />
        <StatTile
          title="Cubiertas"
          value={stats.horasCubiertas}
          icon={<ClipboardCheck className="h-6 w-6" />}
        />
        <StatTile
          title="Efectividad"
          value={`${stats.porcentajeRealizadas.toFixed(1)}%`}
          icon={<Percent className="h-6 w-6" />}
        />
      </div>

      {/* Nuevos KPIs graficables */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          title="Profesores ausentes"
          value={setAusentes.size}
          icon={<UserMinus className="h-6 w-6" />}
        />
        <StatTile
          title="Profesores que reemplazan"
          value={setReemplazan.size}
          icon={<UserPlus className="h-6 w-6" />}
        />
        <StatTile
          title="Cursos (únicos)"
          value={setCursos.size}
          icon={<Users className="h-6 w-6" />}
        />
        <StatTile
          title="Asignaturas ausentes"
          value={setAsigAusentes.size}
          icon={<BookOpen className="h-6 w-6" />}
        />
      </div>

      {/* Mini gráfico de barras */}
      <MiniBars data={grafData} />
    </div>
  );
};

// =================== PRINCIPAL ===================

interface RegistroReemplazosProps {
  currentUser: User;
}

const RegistroReemplazos: React.FC<RegistroReemplazosProps> = ({
  currentUser,
}) => {
  const userId = currentUser.email || currentUser.id || "";

  const {
    reemplazos,
    save: saveReemplazoData,
    remove: deleteReemplazoData,
    search,
    loading: reemplazosLoading,
    error: reemplazosError,
  } = useReemplazos(userId);
  const { profesorNames, loading: profesoresLoading } = useProfesores();

  const [formData, setFormData] = useState(initialState);
  const [filter, setFilter] = useState("");
  const [filteredReemplazos, setFilteredReemplazos] = useState<Reemplazo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!filter.trim()) return setFilteredReemplazos(reemplazos);
      setSearchLoading(true);
      try {
        const results = await search(filter);
        setFilteredReemplazos(results);
      } finally {
        setSearchLoading(false);
      }
    };
    run();
  }, [reemplazos, filter, search]);

  const handleFieldChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleChipToggle = useCallback((value: number) => {
    setFormData((prev) => {
      const has = prev.bloquesAfectados.includes(value);
      const next = has
        ? prev.bloquesAfectados.filter((b) => b !== value)
        : [...prev.bloquesAfectados, value].sort((a, b) => a - b);
      return { ...prev, bloquesAfectados: next };
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsSubmitting(true);

      const {
        docenteAusente,
        asignaturaAusente,
        curso,
        diaAusencia,
        bloquesAfectados,
        docenteReemplazante,
        asignaturaReemplazante,
      } = formData;

      if (
        !docenteAusente ||
        !asignaturaAusente ||
        !curso ||
        !diaAusencia ||
        !docenteReemplazante ||
        !asignaturaReemplazante ||
        bloquesAfectados.length === 0
      ) {
        setError(
          "Todos los campos son obligatorios y debe seleccionar al menos un bloque."
        );
        setIsSubmitting(false);
        return;
      }

      if (docenteAusente === docenteReemplazante) {
        setError(
          "El docente ausente y el reemplazante no pueden ser la misma persona."
        );
        setIsSubmitting(false);
        return;
      }

      try {
        const resultado =
          asignaturaAusente.trim().toLowerCase() ===
          asignaturaReemplazante.trim().toLowerCase()
            ? "Hora realizada"
            : "Hora cubierta, no realizada";

        const newReemplazo: Omit<Reemplazo, "id"> = { ...formData, resultado };
        await saveReemplazoData(newReemplazo);
        setFormData(initialState);

        // Toast simple
        const n = document.createElement("div");
        n.className =
          "fixed top-4 right-4 z-50 rounded-lg bg-emerald-600 px-4 py-2 text-white shadow-lg";
        n.textContent =
          resultado === "Hora realizada"
            ? "✅ Reemplazo registrado — Hora realizada"
            : "⚠️ Reemplazo registrado — Hora cubierta, no realizada";
        document.body.appendChild(n);
        setTimeout(() => {
          if (document.body.contains(n)) document.body.removeChild(n);
        }, 2500);
      } catch (err) {
        console.error(err);
        setError("Error al guardar el reemplazo. Intente nuevamente.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, saveReemplazoData]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("¿Eliminar este registro?")) return;
      try {
        await deleteReemplazoData(id);
      } catch (err) {
        console.error(err);
        alert("No se pudo eliminar. Intente nuevamente.");
      }
    },
    [deleteReemplazoData]
  );

  const inputBase =
    "w-full rounded-lg border bg-white px-10 py-2.5 text-slate-700 placeholder-slate-400 shadow-sm outline-none transition focus:ring-2 focus:ring-amber-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

  if (!currentUser || (!currentUser.email && !currentUser.id)) {
    return (
      <div className="grid place-items-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-slate-500 dark:text-slate-400">
          Error: Usuario no autenticado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ====== HEADER STATS ====== */}
      <div>
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
          Estadísticas del Mes
        </h1>
        <StatsCard userId={userId} reemplazos={reemplazos} />
      </div>

      {/* ====== FORM ====== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Registro de Inasistencias y Reemplazos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Complete el formulario para registrar una nueva suplencia.
          </p>
        </div>

        {profesoresLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando profesores…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid gap-8 md:grid-cols-2">
              {/* Docente Ausente */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-slate-400" />
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    Docente Ausente
                  </h3>
                </div>

                <InputShell
                  label="Nombre"
                  icon={<GraduationCap className="h-5 w-5" />}
                >
                  <select
                    name="docenteAusente"
                    value={formData.docenteAusente}
                    onChange={handleFieldChange}
                    className={inputBase}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Seleccione un docente</option>
                    {profesorNames.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </InputShell>

                <InputShell label="Asignatura" icon={<BookOpen className="h-5 w-5" />}>
                  <select
                    name="asignaturaAusente"
                    value={formData.asignaturaAusente}
                    onChange={handleFieldChange}
                    className={inputBase}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Seleccione una asignatura</option>
                    {ASIGNATURAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </InputShell>

                <InputShell label="Curso" icon={<Users className="h-5 w-5" />}>
                  <select
                    name="curso"
                    value={formData.curso}
                    onChange={handleFieldChange}
                    className={inputBase}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Seleccione un curso</option>
                    {CURSOS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </InputShell>

                <InputShell
                  label="Día de ausencia"
                  icon={<CalendarIcon className="h-5 w-5" />}
                >
                  <input
                    type="date"
                    name="diaAusencia"
                    value={formData.diaAusencia}
                    onChange={handleFieldChange}
                    className={inputBase}
                    required
                    disabled={isSubmitting}
                  />
                </InputShell>

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Bloques afectados
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {BLOQUES.map((b) => {
                      const on = formData.bloquesAfectados.includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => handleChipToggle(b)}
                          disabled={isSubmitting}
                          className={`${chipBase} ${on ? chipOn : chipOff}`}
                          aria-pressed={on}
                        >
                          {b}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Reemplazante */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-slate-400" />
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    Docente Reemplazante
                  </h3>
                </div>

                <InputShell
                  label="Nombre"
                  icon={<GraduationCap className="h-5 w-5" />}
                >
                  <select
                    name="docenteReemplazante"
                    value={formData.docenteReemplazante}
                    onChange={handleFieldChange}
                    className={inputBase}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Seleccione un docente</option>
                    {profesorNames.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </InputShell>

                <InputShell label="Asignatura" icon={<BookOpen className="h-5 w-5" />}>
                  <select
                    name="asignaturaReemplazante"
                    value={formData.asignaturaReemplazante}
                    onChange={handleFieldChange}
                    className={inputBase}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Seleccione una asignatura</option>
                    {ASIGNATURAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </InputShell>

                {formData.asignaturaAusente && formData.asignaturaReemplazante && (
                  <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 p-4 dark:border-slate-700">
                    <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Vista previa del resultado
                    </div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                        formData.asignaturaAusente.toLowerCase() ===
                        formData.asignaturaReemplazante.toLowerCase()
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {formData.asignaturaAusente.toLowerCase() ===
                      formData.asignaturaReemplazante.toLowerCase()
                        ? "Hora realizada"
                        : "Hora cubierta, no realizada"}
                    </span>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {formData.asignaturaAusente.toLowerCase() ===
                      formData.asignaturaReemplazante.toLowerCase()
                        ? "Las asignaturas coinciden."
                        : "Las asignaturas no coinciden."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {(error || reemplazosError) && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {error || reemplazosError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || profesoresLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white shadow hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Registrando…
                  </>
                ) : (
                  <>
                    <SaveIcon className="h-4 w-4" /> Registrar Reemplazo
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ====== HISTORIAL ====== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Historial de Reemplazos
          </h2>
          <div className="relative w-full max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              {searchLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
            </div>
            <input
              type="text"
              placeholder="Buscar por docente, curso o fecha (YYYY-MM-DD)…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={inputBase}
              disabled={searchLoading}
            />
          </div>
        </div>

        {reemplazosLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando reemplazos…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  {[
                    "Fecha",
                    "Curso",
                    "Docente Ausente",
                    "Docente Reemplazante",
                    "Bloques",
                    "Resultado",
                    "Acciones",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                {filteredReemplazos.length > 0 ? (
                  filteredReemplazos.map((r) => (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {new Date(r.diaAusencia + "T12:00:00").toLocaleDateString(
                          "es-CL"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                        {r.curso}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {r.docenteAusente}
                        <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          {r.asignaturaAusente}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {r.docenteReemplazante}
                        <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          {r.asignaturaReemplazante}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                        {r.bloquesAfectados.join(", ")}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            r.resultado === "Hora realizada"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {r.resultado}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          onClick={() => handleDelete(r.id)}
                          title="Eliminar registro"
                          className="rounded-full p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-slate-500 dark:text-slate-400"
                    >
                      {filter
                        ? "No se encontraron resultados para tu búsqueda."
                        : "Aún no hay registros."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {filteredReemplazos.length > 0 && !filter && (
              <div className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
                Mostrando los últimos {filteredReemplazos.length} registros
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistroReemplazos;
