// components/modules/AlternanciaTP.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { User } from "../../types";
import {
  getAlternancias,
  createAlternancia,
  updateAlternancia,
  deleteAlternancia,
  uploadEvidencia,
} from "../../src/firebaseHelpers/alternanciaHelper";
import { Plus, Trash2, Save, Upload } from "lucide-react";

import {
  ESPECIALIDADES_TP,
  INSTITUCIONES_TP,
  CURSOS_BY_ESPECIALIDAD_TP,
  MODULOS_MAP_TP,      // especialidad -> string[]
  TIPOS_ALTERNANCIA_TP,
  OAS_MAP_TP,          // especialidad -> { [módulo]: string[] }
} from "../../constants";

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

const AlternanciaTP: React.FC<AlternanciaTPProps> = ({ currentUser }) => {
  const [alternancias, setAlternancias] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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
  if (!hasAccess) return <div className="p-4 text-red-600">Acceso no autorizado</div>;

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

  // Multiselect de curso → array de strings
  const handleCursoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.currentTarget.selectedOptions).map((o) => o.value);
    setValue("curso", values, { shouldDirty: true });
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Formación por Alternancia</h1>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-gray-600">Cargando…</p>
      ) : (
        <div className="mb-6">
          {alternancias.length === 0 ? (
            <p className="text-gray-500">No hay alternancias registradas</p>
          ) : (
            <ul className="space-y-2">
              {alternancias.map((alt) => (
                <li
                  key={alt.id}
                  className="border p-2 rounded flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <span className="text-sm">
                    <strong>{alt.especialidad}</strong> —{" "}
                    {Array.isArray(alt.curso) ? alt.curso.join(", ") : alt.curso} — {alt.institucion} —{" "}
                    {Array.isArray(alt.tipoAlternancia) ? alt.tipoAlternancia.join(", ") : ""}
                  </span>
                  <div className="flex gap-2">
                    <label className="cursor-pointer bg-yellow-500 text-white px-2 py-1 rounded flex items-center gap-1">
                      <Upload size={16} />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files && onUploadEvidencia(alt.id, e.target.files[0])}
                      />
                      Evidencia
                    </label>
                    <button
                      type="button"
                      onClick={() => onEdit(alt)}
                      className="px-2 py-1 bg-blue-600 text-white rounded"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteClick(alt.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border p-4 rounded bg-white/60">
        {/* Especialidad */}
        <div>
          <label className="block font-semibold mb-1">Especialidad</label>
          <select {...register("especialidad")} className="border rounded p-2 w-full">
            <option value="">Selecciona…</option>
            {ESPECIALIDADES_TP.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        {/* Curso (multiselección) / Institución */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1">Curso (puedes elegir varios)</label>
            <select
              multiple
              size={4}
              {...register("curso")}
              onChange={handleCursoChange}
              className="border rounded p-2 w-full min-h-[140px]"
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
            <p className="text-xs text-gray-500 mt-1">Ctrl/Cmd + clic para seleccionar múltiples cursos.</p>
          </div>

          <div>
            <label className="block font-semibold mb-1">Institución</label>
            <select {...register("institucion")} className="border rounded p-2 w-full">
              <option value="">Selecciona…</option>
              {INSTITUCIONES_TP.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Módulos */}
        <div>
          <label className="block font-semibold mb-2">Módulos</label>
          {!especialidad ? (
            <p className="text-sm text-gray-500">Elige especialidad para ver los módulos.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {modulosDisponibles.map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input type="checkbox" value={m} {...register("modulos")} />
                  <span className="text-sm">{m}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Tipo de Alternancia */}
        <div>
          <label className="block font-semibold">Tipo de Alternancia</label>
          <div className="flex gap-4 flex-wrap">
            {TIPOS_ALTERNANCIA_TP.map((tipo) => (
              <label key={tipo} className="flex items-center gap-2">
                <input type="checkbox" value={tipo} {...register("tipoAlternancia")} />
                {tipo}
              </label>
            ))}
          </div>
        </div>

        {/* Fundamentación */}
        <div>
          <label className="block font-semibold">Fundamentación técnico-pedagógica</label>
          <textarea {...register("fundamentacion")} className="border rounded p-2 w-full" />
        </div>

        {/* Actividades (con Módulo + OA) */}
        <div>
          <label className="block font-semibold mb-2">Plan de actividades</label>
          {actividadesFA.fields.map((field, index) => {
            const currentModule = watch(`actividades.${index}.modulo` as const) || "";
            const oaOptions = getOAsForModule(especialidad, currentModule);

            return (
              <div key={field.id} className="flex flex-col gap-2 mb-3 border rounded p-2">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <input
                    placeholder="Fecha"
                    {...register(`actividades.${index}.fecha` as const)}
                    className="border p-1 rounded"
                  />
                  <input
                    placeholder="Tipo"
                    {...register(`actividades.${index}.tipo` as const)}
                    className="border p-1 rounded"
                  />
                  <input
                    placeholder="Actividad"
                    {...register(`actividades.${index}.actividad` as const)}
                    className="border p-1 rounded"
                  />
                  <input
                    placeholder="Lugar"
                    {...register(`actividades.${index}.lugar` as const)}
                    className="border p-1 rounded"
                  />
                  <input
                    placeholder="Evidencias"
                    {...register(`actividades.${index}.evidencias` as const)}
                    className="border p-1 rounded"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Módulo</label>
                    <select
                      {...register(`actividades.${index}.modulo` as const)}
                      className="border p-2 rounded w-full"
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
                    <label className="block text-sm font-medium mb-1">Objetivo de Aprendizaje (OA)</label>
                    <select
                      {...register(`actividades.${index}.oa` as const)}
                      className="border p-2 rounded w-full"
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

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => actividadesFA.remove(index)}
                    className="text-red-600 inline-flex items-center gap-1"
                    title="Eliminar fila"
                  >
                    <Trash2 size={18} />
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
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
            className="px-2 py-1 bg-green-600 text-white rounded flex items-center gap-1"
          >
            <Plus size={16} /> Agregar actividad
          </button>
        </div>

        {/* Análisis Curricular */}
        <div>
          <label className="block font-semibold">Análisis Curricular</label>
          <textarea {...register("analisisCurricular")} className="border rounded p-2 w-full" />
        </div>

        {/* Guardar */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded inline-flex items-center gap-2"
        >
          <Save size={18} />
          Guardar
        </button>
      </form>
    </div>
  );
};

export default AlternanciaTP;
