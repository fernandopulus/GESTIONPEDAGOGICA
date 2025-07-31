import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { RegistroPañol, Maquina } from '../../types';
import { CURSOS, PROFESORES } from '../../constants';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MAQUINAS_KEY = 'pañolMaquinas';
const REGISTROS_KEY = 'pañolRegistros';

const Panol: React.FC = () => {
    const [maquinas, setMaquinas] = useState<Maquina[]>([]);
    const [registros, setRegistros] = useState<RegistroPañol[]>([]);
    
    // Form states
    const initialRegistroState: Omit<RegistroPañol, 'id'> = { fecha: new Date().toISOString().split('T')[0], curso: '', profesorResponsable: '', maquinaId: '', totalHoras: 0, observaciones: '' };
    const [formRegistro, setFormRegistro] = useState(initialRegistroState);
    const [editingRegistro, setEditingRegistro] = useState<RegistroPañol | null>(null);

    const initialMaquinaState: Omit<Maquina, 'id'> = { nombre: '', especialidad: 'Industrial' };
    const [formMaquina, setFormMaquina] = useState(initialMaquinaState);
    const [editingMaquina, setEditingMaquina] = useState<Maquina | null>(null);

    // UI states
    const [filters, setFilters] = useState({ maquinaId: '', curso: '', profesor: '', fecha: '' });
    
    // Load data from localStorage
    useEffect(() => {
        try {
            const storedMaquinas = localStorage.getItem(MAQUINAS_KEY);
            if (storedMaquinas && JSON.parse(storedMaquinas).length > 0) {
                setMaquinas(JSON.parse(storedMaquinas));
            } else {
                const defaultMaquinas: Maquina[] = [
                    // Industrial
                    { id: crypto.randomUUID(), nombre: 'Torno', especialidad: 'Industrial' },
                    { id: crypto.randomUUID(), nombre: 'Fresadora', especialidad: 'Industrial' },
                    { id: crypto.randomUUID(), nombre: 'Rectificadora', especialidad: 'Industrial' },
                    { id: crypto.randomUUID(), nombre: 'Soldadora MIG', especialidad: 'Industrial' },
                    { id: crypto.randomUUID(), nombre: 'Soldadora TIG', especialidad: 'Industrial' },
                    { id: crypto.randomUUID(), nombre: 'Torno CNC', especialidad: 'Industrial' },
                    // Automotriz
                    { id: crypto.randomUUID(), nombre: 'Elevador', especialidad: 'Automotriz' },
                    { id: crypto.randomUUID(), nombre: 'Compresor', especialidad: 'Automotriz' },
                    { id: crypto.randomUUID(), nombre: 'Rectificadora', especialidad: 'Automotriz' },
                    { id: crypto.randomUUID(), nombre: 'Maqueta de motor', especialidad: 'Automotriz' },
                    { id: crypto.randomUUID(), nombre: 'Maqueta hidráulica', especialidad: 'Automotriz' },
                ];
                setMaquinas(defaultMaquinas);
                localStorage.setItem(MAQUINAS_KEY, JSON.stringify(defaultMaquinas));
            }

            const storedRegistros = localStorage.getItem(REGISTROS_KEY);
            if (storedRegistros) setRegistros(JSON.parse(storedRegistros));
        } catch (e) {
            console.error("Error al cargar datos de Pañol desde localStorage", e);
        }
    }, []);

    // Persistence functions
    const persistMaquinas = useCallback((data: Maquina[]) => {
        setMaquinas(data);
        localStorage.setItem(MAQUINAS_KEY, JSON.stringify(data));
    }, []);

    const persistRegistros = useCallback((data: RegistroPañol[]) => {
        setRegistros(data);
        localStorage.setItem(REGISTROS_KEY, JSON.stringify(data));
    }, []);

    // Handlers for Maquinas
    const handleSaveMaquina = (e: FormEvent) => {
        e.preventDefault();
        if (!formMaquina.nombre.trim()) return;

        if (editingMaquina) {
            persistMaquinas(maquinas.map(m => m.id === editingMaquina.id ? { ...editingMaquina, ...formMaquina } : m));
        } else {
            persistMaquinas([{ ...formMaquina, id: crypto.randomUUID() }, ...maquinas]);
        }
        setFormMaquina(initialMaquinaState);
        setEditingMaquina(null);
    };

    const handleDeleteMaquina = useCallback((id: string) => {
        if (registros.some(r => r.maquinaId === id)) {
            alert('No se puede eliminar una máquina con registros de uso. Elimine los registros primero.');
            return;
        }
        if (window.confirm('¿Eliminar esta máquina?')) {
            persistMaquinas(maquinas.filter(m => m.id !== id));
        }
    }, [maquinas, registros, persistMaquinas]);
    
    // Handlers for Registros
    const handleSaveRegistro = (e: FormEvent) => {
        e.preventDefault();
        const dataToSave = editingRegistro || formRegistro;
        if (!dataToSave.curso || !dataToSave.profesorResponsable.trim() || !dataToSave.maquinaId || dataToSave.totalHoras <= 0) {
            alert('Curso, Profesor, Máquina y un Total de Horas mayor a cero son obligatorios.');
            return;
        }
        
        if (editingRegistro) {
            persistRegistros(registros.map(r => r.id === editingRegistro.id ? editingRegistro : r));
        } else {
            persistRegistros([{ ...formRegistro, id: crypto.randomUUID() }, ...registros]);
        }
        setFormRegistro(initialRegistroState);
        setEditingRegistro(null);
    };
    
    const handleDeleteRegistro = useCallback((id: string) => {
        if (window.confirm('¿Eliminar este registro de uso?')) {
            persistRegistros(registros.filter(r => r.id !== id));
        }
    }, [registros, persistRegistros]);
    
    const filteredRegistros = useMemo(() => {
        return registros.filter(r => 
            (filters.maquinaId === '' || r.maquinaId === filters.maquinaId) &&
            (filters.curso === '' || r.curso === filters.curso) &&
            (filters.profesor === '' || r.profesorResponsable.toLowerCase().includes(filters.profesor.toLowerCase())) &&
            (filters.fecha === '' || r.fecha === filters.fecha)
        ).sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }, [registros, filters]);
    
    const maquinasMap = useMemo(() => new Map(maquinas.map(m => [m.id, m])), [maquinas]);

    // Export functions
    const handleExportExcel = () => {
        const dataToExport = filteredRegistros.map(r => ({
            'Fecha': r.fecha,
            'Curso': r.curso,
            'Profesor': r.profesorResponsable,
            'Máquina': maquinasMap.get(r.maquinaId)?.nombre || 'N/A',
            'Especialidad': maquinasMap.get(r.maquinaId)?.especialidad || 'N/A',
            'Total Horas': r.totalHoras,
            'Observaciones': r.observaciones
        }));
        const ws = utils.json_to_sheet(dataToExport);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "RegistrosPañol");
        writeFile(wb, "Registros_Pañol.xlsx");
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        autoTable(doc, {
            head: [['Fecha', 'Curso', 'Profesor', 'Máquina', 'Especialidad', 'Total Horas', 'Observaciones']],
            body: filteredRegistros.map(r => [
                r.fecha,
                r.curso,
                r.profesorResponsable,
                maquinasMap.get(r.maquinaId)?.nombre || 'N/A',
                maquinasMap.get(r.maquinaId)?.especialidad || 'N/A',
                r.totalHoras,
                r.observaciones
            ]),
            margin: { top: 20, right: 10, bottom: 20, left: 10 },
            didDrawPage: (data: any) => {
                // Header
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text('LICEO INDUSTRIAL DE RECOLETA', data.settings.margin.left, 15);
            }
        });
        doc.save('Registros_Pañol.pdf');
    };

    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";

    const renderRegistroForm = () => {
        const data = editingRegistro || formRegistro;
        const setData = editingRegistro ? setEditingRegistro : setFormRegistro;

        return (
            <form onSubmit={handleSaveRegistro} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-sm font-medium">Fecha</label>
                        <input name="fecha" type="date" value={data.fecha} onChange={e => setData({...data, fecha: e.target.value})} className={inputStyles} required/>
                    </div>
                    <div>
                         <label className="text-sm font-medium">Curso</label>
                         <select name="curso" value={data.curso} onChange={e => setData({...data, curso: e.target.value})} className={inputStyles} required><option value="">Curso</option>{CURSOS.map(c=><option key={c}>{c}</option>)}</select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Profesor</label>
                        <select name="profesorResponsable" value={data.profesorResponsable} onChange={e => setData({...data, profesorResponsable: e.target.value})} className={inputStyles} required>
                            <option value="">Profesor Responsable</option>
                            {PROFESORES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="text-sm font-medium">Máquina</label>
                        <select name="maquinaId" value={data.maquinaId} onChange={e => setData({...data, maquinaId: e.target.value})} className={inputStyles} required><option value="">Máquina</option>{maquinas.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Total de Horas</label>
                        <input name="totalHoras" type="number" value={data.totalHoras} onChange={e => setData({...data, totalHoras: Number(e.target.value)})} className={inputStyles} required min="0.5" step="0.5"/>
                    </div>
                    <div className="lg:col-span-3">
                        <label className="text-sm font-medium">Observaciones</label>
                        <textarea name="observaciones" value={data.observaciones} onChange={e => setData({...data, observaciones: e.target.value})} placeholder="Observaciones..." className={`${inputStyles}`} rows={1}/>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    {editingRegistro && <button type="button" onClick={() => setEditingRegistro(null)} className="bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-lg">Cancelar</button>}
                    <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700">{editingRegistro ? 'Actualizar' : 'Registrar'}</button>
                </div>
            </form>
        )
    };
    
    return (
        <div className="space-y-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Pañol: Registro de Uso de Máquinas</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Registro de Uso */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">{editingRegistro ? `Editando Registro #${editingRegistro.id.substring(0,4)}` : 'Nuevo Registro de Uso'}</h2>
                    {renderRegistroForm()}
                </div>

                {/* Administración de Máquinas */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Administrar Máquinas</h2>
                    <form onSubmit={handleSaveMaquina} className="flex gap-2 mb-4">
                        <input value={formMaquina.nombre} onChange={e => setFormMaquina({...formMaquina, nombre: e.target.value})} placeholder="Nombre máquina" className={inputStyles}/>
                        <select value={formMaquina.especialidad} onChange={e => setFormMaquina({...formMaquina, especialidad: e.target.value as any})} className={inputStyles}>
                            <option value="Industrial">Industrial</option>
                            <option value="Automotriz">Automotriz</option>
                        </select>
                        <button type="submit" className="bg-slate-200 p-2 rounded-lg font-bold">{editingMaquina ? '✓' : '+'}</button>
                    </form>
                    <ul className="space-y-2 max-h-60 overflow-y-auto">
                        {maquinas.map(m => (
                            <li key={m.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 p-2 rounded">
                                <span>{m.nombre} <span className="text-xs text-slate-500">({m.especialidad})</span></span>
                                <div className="space-x-2">
                                    <button onClick={() => {setEditingMaquina(m); setFormMaquina(m);}} className="text-blue-500">✏️</button>
                                    <button onClick={() => handleDeleteMaquina(m.id)} className="text-red-500">🗑️</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                
                {/* Historial */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Historial de Uso</h2>
                        <div className="flex gap-2">
                            <button onClick={handleExportExcel} className="text-sm bg-green-100 text-green-700 font-semibold py-1 px-3 rounded-lg">Excel</button>
                            <button onClick={handleExportPDF} className="text-sm bg-red-100 text-red-700 font-semibold py-1 px-3 rounded-lg">PDF</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        <input type="date" value={filters.fecha} onChange={e => setFilters({...filters, fecha: e.target.value})} className={inputStyles}/>
                        <select value={filters.curso} onChange={e => setFilters({...filters, curso: e.target.value})} className={inputStyles}><option value="">Todos los Cursos</option>{CURSOS.map(c=><option key={c}>{c}</option>)}</select>
                        <select value={filters.maquinaId} onChange={e => setFilters({...filters, maquinaId: e.target.value})} className={inputStyles}><option value="">Todas las Máquinas</option>{maquinas.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
                        <input value={filters.profesor} onChange={e => setFilters({...filters, profesor: e.target.value})} placeholder="Buscar profesor..." className={inputStyles}/>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                             <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Máquina</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Profesor</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Total Horas</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredRegistros.map(r => (
                                    <tr key={r.id}>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm">{r.fecha}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">{maquinasMap.get(r.maquinaId)?.nombre || 'N/A'}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm">{r.profesorResponsable} ({r.curso})</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm">{r.totalHoras}</td>
                                        <td className="px-3 py-2 text-center">
                                            <button onClick={() => setEditingRegistro(r)} className="text-blue-500">✏️</button>
                                            <button onClick={() => handleDeleteRegistro(r.id)} className="text-red-500 ml-2">🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Panol;