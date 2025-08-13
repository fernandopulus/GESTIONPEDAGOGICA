// components/modules/Panol.tsx
import React, { useEffect, useMemo, useState, useCallback, FormEvent } from 'react';
import { RegistroPañol, Maquina } from '../../types';
import { CURSOS, PROFESORES } from '../../constants';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Wrench, Factory, Plus, Save, FileSpreadsheet, FileText,
  Search, Filter, Edit3, Trash2, X, Calendar, Users, Gauge, BookOpen, BarChart3
} from 'lucide-react';

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

import {
  subscribeToMaquinas,
  subscribeToRegistros,
  addMaquina,
  updateMaquina,
  deleteMaquina,
  addRegistro,
  updateRegistro,
  deleteRegistro,
  seedDefaultMaquinasIfEmpty,
} from '../../src/firebaseHelpers/panolHelper';

const Panol: React.FC = () => {
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [registros, setRegistros] = useState<RegistroPañol[]>([]);

  const initialRegistroState: Omit<RegistroPañol, 'id'> = {
    fecha: new Date().toISOString().split('T')[0],
    curso: '',
    profesorResponsable: '',
    maquinaId: '',
    totalHoras: 0,
    observaciones: '',
  };
  const [formRegistro, setFormRegistro] = useState(initialRegistroState);
  const [editingRegistro, setEditingRegistro] = useState<RegistroPañol | null>(null);

  const initialMaquinaState: Omit<Maquina, 'id'> = { nombre: '', especialidad: 'Industrial' as any };
  const [formMaquina, setFormMaquina] = useState(initialMaquinaState);
  const [editingMaquina, setEditingMaquina] = useState<Maquina | null>(null);

  const [filters, setFilters] = useState({ maquinaId: '', curso: '', profesor: '', fecha: '' });

  useEffect(() => {
    seedDefaultMaquinasIfEmpty().catch(console.error);
    const unsubM = subscribeToMaquinas(setMaquinas);
    const unsubR = subscribeToRegistros(setRegistros);
    return () => {
      unsubM && unsubM();
      unsubR && unsubR();
    };
  }, []);

  const handleSaveMaquina = async (e: FormEvent) => {
    e.preventDefault();
    if (!formMaquina.nombre.trim()) return;
    try {
      if (editingMaquina) {
        await updateMaquina(editingMaquina.id, { ...formMaquina });
      } else {
        await addMaquina({ ...formMaquina });
      }
      setFormMaquina(initialMaquinaState);
      setEditingMaquina(null);
    } catch (err: any) {
      alert(err.message || 'Error al guardar máquina');
    }
  };

  const handleDeleteMaquina = useCallback(async (id: string) => {
    try {
      await deleteMaquina(id);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar máquina');
    }
  }, []);

  const handleSaveRegistro = async (e: FormEvent) => {
    e.preventDefault();
    const dataToSave = editingRegistro || formRegistro;
    if (!dataToSave.curso || !dataToSave.profesorResponsable.trim() || !dataToSave.maquinaId || Number(dataToSave.totalHoras) <= 0) {
      alert('Curso, Profesor, Máquina y un Total de Horas mayor a cero son obligatorios.');
      return;
    }
    try {
      if (editingRegistro) {
        const { id, ...rest } = editingRegistro;
        await updateRegistro(id, rest);
      } else {
        await addRegistro({ ...formRegistro });
      }
      setFormRegistro(initialRegistroState);
      setEditingRegistro(null);
    } catch (err: any) {
      alert(err.message || 'Error al guardar registro');
    }
  };

  const handleDeleteRegistro = useCallback(async (id: string) => {
    try {
      await deleteRegistro(id);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar registro');
    }
  }, []);

  const filteredRegistros = useMemo(() => {
    return registros
      .filter(
        (r) =>
          (filters.maquinaId === '' || r.maquinaId === filters.maquinaId) &&
          (filters.curso === '' || r.curso === filters.curso) &&
          (filters.profesor === '' || r.profesorResponsable.toLowerCase().includes(filters.profesor.toLowerCase())) &&
          (filters.fecha === '' || r.fecha === filters.fecha)
      )
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [registros, filters]);

  const maquinasMap = useMemo(() => new Map(maquinas.map((m) => [m.id, m])), [maquinas]);
  const totalHoras = useMemo(() => filteredRegistros.reduce((acc, r) => acc + (Number(r.totalHoras) || 0), 0), [filteredRegistros]);

  const usageByMachine = useMemo(() => {
    const map = new Map<string, number>();
    filteredRegistros.forEach(r => {
      const nombre = maquinasMap.get(r.maquinaId)?.nombre || 'N/A';
      map.set(nombre, (map.get(nombre) || 0) + (Number(r.totalHoras) || 0));
    });
    const arr = Array.from(map.entries()).map(([maquina, horas]) => ({ maquina, horas: Number(horas.toFixed(2)) }));
    arr.sort((a, b) => b.horas - a.horas);
    return arr;
  }, [filteredRegistros, maquinasMap]);

  const handleExportExcel = () => {
    const dataToExport = filteredRegistros.map((r) => ({
      Fecha: r.fecha,
      Curso: r.curso,
      Profesor: r.profesorResponsable,
      'Máquina': maquinasMap.get(r.maquinaId)?.nombre || 'N/A',
      Especialidad: maquinasMap.get(r.maquinaId)?.especialidad || 'N/A',
      'Total Horas': r.totalHoras,
      Observaciones: r.observaciones,
    }));
    const ws = utils.json_to_sheet(dataToExport);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'RegistrosPañol');
    writeFile(wb, 'Registros_Pañol.xlsx');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Fecha', 'Curso', 'Profesor', 'Máquina', 'Especialidad', 'Total Horas', 'Observaciones']],
      body: filteredRegistros.map((r) => [
        r.fecha,
        r.curso,
        r.profesorResponsable,
        maquinasMap.get(r.maquinaId)?.nombre || 'N/A',
        maquinasMap.get(r.maquinaId)?.especialidad || 'N/A',
        r.totalHoras,
        r.observaciones,
      ]),
      margin: { top: 24, right: 10, bottom: 20, left: 10 },
      didDrawPage: (data: any) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('LICEO INDUSTRIAL DE RECOLETA', data.settings.margin.left, 14);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Informe de Registros de Pañol', data.settings.margin.left, 20);
      },
    });
    doc.save('Registros_Pañol.pdf');
  };

  const inputStyles =
    'w-full border border-slate-300 rounded-xl px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-400';

  const chip = (text: string, color: string) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>{text}</span>
  );

  const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent?: string }> = ({ icon, label, value, accent = 'from-indigo-500 to-sky-500' }) => (
    <div className="relative rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-tr ${accent} opacity-10`} />
      <div className="relative flex items-center gap-3 bg-white/70 dark:bg-slate-800/60 rounded-xl p-3">
        <div className="p-2 rounded-xl bg-white dark:bg-slate-700 shadow">
          {icon}
        </div>
        <div>
          <div className="text-xs text-slate-600 dark:text-slate-400">{label}</div>
          <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
        </div>
      </div>
    </div>
  );

  const SectionCard: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode; accent?: string }> = ({
    title,
    icon,
    children,
    right,
    accent = 'from-indigo-600/10 via-sky-500/10 to-emerald-500/10',
  }) => (
    <section className="rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
            {icon} <span>{title}</span>
          </h2>
          {right}
        </div>
        {children}
      </div>
    </section>
  );

  const RegistroForm = () => {
    const data = editingRegistro || formRegistro;
    const setData = editingRegistro ? setEditingRegistro : setFormRegistro;

    return (
      <form onSubmit={handleSaveRegistro} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="lg:col-span-1">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar size={16} /> Fecha
            </label>
            <input
              name="fecha"
              type="date"
              value={data.fecha}
              onChange={(e) => setData({ ...(data as any), fecha: e.target.value })}
              className={inputStyles}
              required
            />
          </div>
          <div className="lg:col-span-1">
            <label className="text-sm font-medium flex items-center gap-2">
              <Users size={16} /> Curso
            </label>
            <select
              name="curso"
              value={data.curso}
              onChange={(e) => setData({ ...(data as any), curso: e.target.value })}
              className={inputStyles}
              required
            >
              <option value="">Curso</option>
              {CURSOS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-1">
            <label className="text-sm font-medium flex items-center gap-2">
              <BookOpen size={16} /> Profesor
            </label>
            <select
              name="profesorResponsable"
              value={data.profesorResponsable}
              onChange={(e) => setData({ ...(data as any), profesorResponsable: e.target.value })}
              className={inputStyles}
              required
            >
              <option value="">Profesor Responsable</option>
              {PROFESORES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-1">
            <label className="text-sm font-medium flex items-center gap-2">
              <Wrench size={16} /> Máquina
            </label>
            <select
              name="maquinaId"
              value={data.maquinaId}
              onChange={(e) => setData({ ...(data as any), maquinaId: e.target.value })}
              className={inputStyles}
              required
            >
              <option value="">Máquina</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-1">
            <label className="text-sm font-medium flex items-center gap-2">
              <Gauge size={16} /> Total de Horas
            </label>
            <input
              name="totalHoras"
              type="number"
              value={data.totalHoras}
              onChange={(e) => setData({ ...(data as any), totalHoras: Number(e.target.value) })}
              className={inputStyles}
              required
              min={0.5}
              step={0.5}
            />
          </div>
          <div className="lg:col-span-6">
            <label className="text-sm font-medium">Observaciones</label>
            <textarea
              name="observaciones"
              value={data.observaciones}
              onChange={(e) => setData({ ...(data as any), observaciones: e.target.value })}
              placeholder="Observaciones..."
              className={inputStyles + ' min-h-[40px]'}
              rows={2}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {editingRegistro && (
            <button
              type="button"
              onClick={() => setEditingRegistro(null)}
              className="inline-flex items-center gap-2 bg-white text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-medium py-2 px-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <X size={16} /> Cancelar
            </button>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-xl hover:bg-indigo-500 transition"
          >
            {editingRegistro ? <Save size={16} /> : <Plus size={16} />}
            {editingRegistro ? 'Actualizar' : 'Registrar'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500">
            Pañol: Registro de Uso de Máquinas
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Administra máquinas, registra usos y exporta informes (Firestore).</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Exportar a Excel"
          >
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-500 transition"
            title="Exportar a PDF"
          >
            <FileText size={18} /> PDF
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Wrench className="w-5 h-5 text-indigo-600" />} label="Máquinas registradas" value={maquinas.length} accent="from-indigo-500 to-sky-500" />
        <StatCard icon={<FileText className="w-5 h-5 text-sky-600" />} label="Registros" value={filteredRegistros.length} accent="from-sky-500 to-cyan-500" />
        <StatCard icon={<Gauge className="w-5 h-5 text-emerald-600" />} label="Horas totales (filtradas)" value={totalHoras.toFixed(1)} accent="from-emerald-500 to-lime-500" />
        <StatCard
          icon={<Calendar className="w-5 h-5 text-amber-600" />}
          label="Última actualización"
          value={registros[0]?.fecha ? new Date(registros[0].fecha).toLocaleDateString() : '—'}
          accent="from-amber-500 to-rose-400"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-3">
          <SectionCard title={editingRegistro ? `Editando registro #${editingRegistro.id.slice(0, 4)}` : 'Nuevo registro de uso'} icon={<Factory size={18} />}>
            <RegistroForm />
          </SectionCard>
        </div>

        <div className="xl:col-span-2 order-1 xl:order-none">
          <SectionCard
            title="Uso por máquina (horas)"
            icon={<BarChart3 size={18} />}
            accent="from-indigo-600/10 via-sky-500/10 to-amber-500/10"
            right={<div className="flex gap-2 items-center">{chip(`${usageByMachine.length} máquinas`, 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200')}</div>}
          >
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageByMachine} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="maquina" tick={{ fontSize: 12 }} interval={0} angle={0} height={50} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="horas" name="Horas" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-1 order-2 xl:order-none">
          <SectionCard title="Administrar máquinas" icon={<Wrench size={18} />} accent="from-emerald-600/10 via-sky-500/10 to-indigo-600/10">
            <form onSubmit={handleSaveMaquina} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
              <input
                value={formMaquina.nombre}
                onChange={(e) => setFormMaquina({ ...formMaquina, nombre: e.target.value })}
                placeholder="Nombre máquina"
                className={inputStyles + ' md:col-span-2'}
              />
              <select
                value={formMaquina.especialidad}
                onChange={(e) => setFormMaquina({ ...formMaquina, especialidad: e.target.value as any })}
                className={inputStyles + ' md:col-span-2'}
              >
                <option value="Industrial">Industrial</option>
                <option value="Automotriz">Automotriz</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-2 px-3 rounded-xl hover:bg-indigo-500 transition md:col-span-1"
              >
                {editingMaquina ? <Save size={16} /> : <Plus size={16} />}
                {editingMaquina ? 'Guardar' : 'Agregar'}
              </button>
            </form>

            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {maquinas.map((m) => (
                <li
                  key={m.id}
                  className="flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/60 dark:to-slate-800/30 border border-slate-200 dark:border-slate-700 p-3 rounded-xl"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{m.nombre}</div>
                    <div className="text-xs">
                      {m.especialidad === 'Industrial'
                        ? chip('Industrial', 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200')
                        : chip('Automotriz', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingMaquina(m);
                        setFormMaquina(m);
                      }}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                      title="Editar"
                    >
                      <Edit3 size={16} className="text-blue-600" />
                    </button>
                    <button onClick={() => handleDeleteMaquina(m.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition" title="Eliminar">
                      <Trash2 size={16} className="text-red-600" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="xl:col-span-2 order-3">
          <SectionCard
            title="Historial de uso"
            icon={<FileText size={18} />}
            accent="from-rose-500/10 via-amber-400/10 to-indigo-500/10"
            right={
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-600" />
              </div>
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <input
                type="date"
                value={filters.fecha}
                onChange={(e) => setFilters({ ...filters, fecha: e.target.value })}
                className={inputStyles}
                placeholder="Fecha"
              />
              <select value={filters.curso} onChange={(e) => setFilters({ ...filters, curso: e.target.value })} className={inputStyles}>
                <option value="">Todos los Cursos</option>
                {CURSOS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select value={filters.maquinaId} onChange={(e) => setFilters({ ...filters, maquinaId: e.target.value })} className={inputStyles}>
                <option value="">Todas las Máquinas</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  value={filters.profesor}
                  onChange={(e) => setFilters({ ...filters, profesor: e.target.value })}
                  placeholder="Buscar profesor..."
                  className={inputStyles + ' pl-9'}
                />
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase">Fecha</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase">Máquina</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase">Profesor / Curso</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase">Total Horas</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRegistros.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition">
                      <td className="px-3 py-2 whitespace-nowrap text-sm">{r.fecha}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">{maquinasMap.get(r.maquinaId)?.nombre || 'N/A'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        {r.profesorResponsable} <span className="text-slate-400">({r.curso})</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">{r.totalHoras}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => setEditingRegistro(r)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Editar">
                          <Edit3 size={16} className="text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteRegistro(r.id)}
                          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Eliminar"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredRegistros.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={5}>
                        No hay registros que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default Panol;
