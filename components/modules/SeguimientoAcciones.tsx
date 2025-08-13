// components/modules/SeguimientoAcciones.tsx
import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { AccionPedagogica, EstadoAccion } from '../../types';
import { AREAS_PEDAGOGICAS, ESTADOS_ACCION } from '../../constants';
import {
    getAllAcciones,
    createAccion,
    updateAccion,
    deleteAccion,
} from '../../src/firebaseHelpers/acciones';

// lucide-react icons
import {
  Calendar,
  User,
  FileText,
  Link2,
  Loader2,
  Pencil,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  Hourglass,
  AlertCircle,
  CirclePlus,
  RotateCcw
} from 'lucide-react';

const initialAccionState: Omit<AccionPedagogica, 'id'> = {
  fechaRegistro: new Date().toISOString().split('T')[0],
  responsable: '',
  area: '',
  descripcion: '',
  fechaCumplimiento: '',
  estado: 'Pendiente',
  enlaceDocumento: '',
};

const estadoStyles: Record<EstadoAccion, {badge: string; dot: string; icon: JSX.Element}> = {
  Pendiente: {
    badge: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800',
    dot: 'bg-red-500',
    icon: <AlertCircle className="h-4 w-4" aria-hidden />
  },
  'En Proceso': {
    badge: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:ring-yellow-800',
    dot: 'bg-yellow-500',
    icon: <Hourglass className="h-4 w-4" aria-hidden />
  },
  Cumplida: {
    badge: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200 dark:bg-green-900/30 dark:text-green-200 dark:ring-green-800',
    dot: 'bg-green-500',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />
  },
};

const inputBase =
  "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition";

const labelBase = "block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2";

const chip =
  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold";

const card =
  "rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur shadow-sm";

const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-900 px-4 py-2 font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500/70 transition";

const buttonSoft =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition";

const iconButton =
  "inline-flex items-center justify-center rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition";

const tableHeadCell = "px-4 py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

const tableCell = "px-4 py-4 align-top text-sm text-slate-700 dark:text-slate-200";

const emptyState =
  "flex flex-col items-center justify-center gap-3 py-12 text-slate-500 dark:text-slate-400";

const SegimientoSkeleton: React.FC = () => (
  <tr>
    <td className={tableCell} colSpan={5}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
          <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
        </div>
      </div>
    </td>
  </tr>
);

const SeguimientoAcciones: React.FC = () => {
  const [acciones, setAcciones] = useState<AccionPedagogica[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<AccionPedagogica, 'id'>>(initialAccionState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  const fetchAcciones = useCallback(async () => {
    setLoading(true);
    try {
      const accionesFS = await getAllAcciones();
      setAcciones(accionesFS);
      setError(null);
    } catch (e) {
      console.error("Error al cargar acciones:", e);
      setError("No se pudieron cargar las acciones pedagógicas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAcciones();
  }, [fetchAcciones]);

  const handleFieldChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleResetForm = useCallback(() => {
    setFormData(initialAccionState);
    setEditingId(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.responsable || !formData.area || !formData.descripcion || !formData.fechaCumplimiento) {
      setError('Los campos responsables, área, descripción y fecha de cumplimiento son obligatorios.');
      return;
    }

    try {
      if (editingId) {
        await updateAccion(editingId, formData);
      } else {
        await createAccion(formData);
      }
      await fetchAcciones();
      handleResetForm();
    } catch (err) {
      console.error("Error al guardar acción:", err);
      setError("Error al guardar la acción.");
    }
  }, [formData, editingId, fetchAcciones, handleResetForm]);

  const handleEdit = useCallback((accion: AccionPedagogica) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setEditingId(accion.id);
    setFormData({
      ...accion,
      enlaceDocumento: accion.enlaceDocumento || ''
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta acción?')) {
      try {
        await deleteAccion(id);
        await fetchAcciones();
      } catch (err) {
        console.error("Error al eliminar acción:", err);
        setError("No se pudo eliminar la acción.");
      }
    }
  }, [fetchAcciones]);

  const handleChangeEstado = useCallback(async (id: string) => {
    try {
      const accion = acciones.find(a => a.id === id);
      if (accion) {
        const currentIndex = ESTADOS_ACCION.indexOf(accion.estado);
        const nextIndex = (currentIndex + 1) % ESTADOS_ACCION.length;
        const newEstado = ESTADOS_ACCION[nextIndex];
        await updateAccion(id, { estado: newEstado });
        await fetchAcciones();
      }
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      setError("No se pudo cambiar el estado de la acción.");
    }
  }, [acciones, fetchAcciones]);

  const filteredAcciones = useMemo(() => {
    return acciones.filter(accion => {
      const searchMatch = searchTerm === '' ||
        accion.responsable.toLowerCase().includes(searchTerm.toLowerCase()) ||
        accion.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
      const areaMatch = filterArea === '' || accion.area === filterArea;
      const estadoMatch = filterEstado === '' || accion.estado === filterEstado;
      return searchMatch && areaMatch && estadoMatch;
    });
  }, [acciones, searchTerm, filterArea, filterEstado]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Seguimiento de Acciones Pedagógicas
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {editingId ? 'Editando acción existente.' : 'Registre una nueva acción de seguimiento.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchAcciones()}
            className={buttonSoft}
            title="Recargar"
          >
            <RotateCcw className="h-4 w-4" />
            Refrescar
          </button>
          <button
            type="button"
            onClick={handleResetForm}
            className={buttonPrimary}
            title="Nueva acción"
          >
            <CirclePlus className="h-4 w-4" />
            Nueva
          </button>
        </div>
      </div>

      {/* Form */}
      <div className={card}>
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="fechaRegistro" className={labelBase}>Fecha de Registro</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="fechaRegistro"
                  type="date"
                  name="fechaRegistro"
                  value={formData.fechaRegistro}
                  onChange={handleFieldChange}
                  className={inputBase + " pl-10"}
                />
              </div>
            </div>

            <div>
              <label htmlFor="responsable" className={labelBase}>Responsable</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="responsable"
                  type="text"
                  name="responsable"
                  value={formData.responsable}
                  onChange={handleFieldChange}
                  placeholder="Nombre del responsable"
                  className={inputBase + " pl-10"}
                />
              </div>
            </div>

            <div>
              <label htmlFor="area" className={labelBase}>Área Vinculada</label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  id="area"
                  name="area"
                  value={formData.area}
                  onChange={handleFieldChange}
                  className={inputBase + " pl-10"}
                >
                  <option value="">Seleccione un área</option>
                  {AREAS_PEDAGOGICAS.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-3">
              <label htmlFor="descripcion" className={labelBase}>Descripción de la Acción</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <textarea
                  id="descripcion"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleFieldChange}
                  rows={3}
                  placeholder="Detalle de la acción a realizar..."
                  className={inputBase + " pl-10"}
                />
              </div>
            </div>

            <div>
              <label htmlFor="fechaCumplimiento" className={labelBase}>Fecha de Cumplimiento</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="fechaCumplimiento"
                  type="date"
                  name="fechaCumplimiento"
                  value={formData.fechaCumplimiento}
                  onChange={handleFieldChange}
                  className={inputBase + " pl-10"}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="enlaceDocumento" className={labelBase}>Enlace a Documento (Opcional)</label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="enlaceDocumento"
                  type="url"
                  name="enlaceDocumento"
                  value={formData.enlaceDocumento || ''}
                  onChange={handleFieldChange}
                  placeholder="https://ejemplo.com/documento"
                  className={inputBase + " pl-10"}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={handleResetForm}
                className={buttonSoft}
              >
                Cancelar
              </button>
            )}
            <button type="submit" className={buttonPrimary}>
              {editingId ? <Pencil className="h-4 w-4" /> : <CirclePlus className="h-4 w-4" />}
              {editingId ? 'Actualizar Acción' : 'Registrar Acción'}
            </button>
          </div>
        </form>
      </div>

      {/* Toolbar */}
      <div className={card}>
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por responsable o palabra clave..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={inputBase + " pl-10"}
              />
            </div>
            <select
              value={filterArea}
              onChange={e => setFilterArea(e.target.value)}
              className={inputBase}
            >
              <option value="">Filtrar por Área</option>
              {AREAS_PEDAGOGICAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value)}
              className={inputBase}
            >
              <option value="">Filtrar por Estado</option>
              {ESTADOS_ACCION.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={card}>
        <div className="overflow-x-auto rounded-2xl">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur">
              <tr>
                <th className={tableHeadCell}>Responsable</th>
                <th className={tableHeadCell}>Descripción</th>
                <th className={tableHeadCell}>Fechas</th>
                <th className={`${tableHeadCell} text-center`}>Estado</th>
                <th className={`${tableHeadCell} text-center`}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <SegimientoSkeleton />
              ) : filteredAcciones.length > 0 ? (
                filteredAcciones.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition">
                    <td className={tableCell + " whitespace-nowrap"}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 text-white flex items-center justify-center font-bold shadow-sm">
                          {a.responsable?.slice(0,1)?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <div className="font-semibold">{a.responsable}</div>
                          <div className="text-xs text-slate-500">{a.area}</div>
                        </div>
                      </div>
                    </td>

                    <td className={tableCell + " max-w-lg"}>
                      <p className="text-sm leading-relaxed">{a.descripcion}</p>
                      {a.enlaceDocumento && (
                        <a
                          href={a.enlaceDocumento}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver Documento"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Documento
                        </a>
                      )}
                    </td>

                    <td className={tableCell + " whitespace-nowrap"}>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Reg: {a.fechaRegistro}
                      </div>
                      <div className="text-sm font-semibold flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4" />
                        Comp: {a.fechaCumplimiento}
                      </div>
                    </td>

                    <td className={tableCell + " whitespace-nowrap text-center"}>
                      <button
                        onClick={() => handleChangeEstado(a.id)}
                        className={`${chip} ${estadoStyles[a.estado].badge}`}
                        title="Cambiar estado"
                      >
                        <span className={`h-2 w-2 rounded-full ${estadoStyles[a.estado].dot}`} />
                        {estadoStyles[a.estado].icon}
                        {a.estado}
                      </button>
                    </td>

                    <td className={tableCell + " whitespace-nowrap text-center"}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEdit(a)}
                          title="Editar"
                          className={iconButton + " text-yellow-600 dark:text-yellow-300"}
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          title="Eliminar"
                          className={iconButton + " text-red-600 dark:text-red-300"}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className={emptyState}>
                      <Search className="h-10 w-10" />
                      <p>No se encontraron acciones.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SeguimientoAcciones;
