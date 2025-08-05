import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { AccionPedagogica, EstadoAccion } from '../../types';
import { AREAS_PEDAGOGICAS, ESTADOS_ACCION } from '../../constants';
import {
    getAllAcciones,
    createAccion,
    updateAccion,
    deleteAccion,
} from '../../src/firebaseHelpers/acciones';

const initialAccionState: Omit<AccionPedagogica, 'id'> = {
    fechaRegistro: new Date().toISOString().split('T')[0],
    responsable: '',
    area: '',
    descripcion: '',
    fechaCumplimiento: '',
    estado: 'Pendiente',
    enlaceDocumento: '',
};

const estadoColors: Record<EstadoAccion, string> = {
    Pendiente: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    'En Proceso': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    Cumplida: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

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
            enlaceDocumento: accion.enlaceDocumento || '' // Asegurar que no sea undefined
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

    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Seguimiento de Acciones Pedagógicas</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-6">{editingId ? 'Editando acción existente.' : 'Registre una nueva acción de seguimiento.'}</p>

                {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="fechaRegistro" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Fecha de Registro</label>
                            <input type="date" name="fechaRegistro" value={formData.fechaRegistro} onChange={handleFieldChange} className={inputStyles} />
                        </div>
                        <div>
                            <label htmlFor="responsable" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Responsable</label>
                            <input type="text" name="responsable" value={formData.responsable} onChange={handleFieldChange} placeholder="Nombre del responsable" className={inputStyles} />
                        </div>
                         <div>
                            <label htmlFor="area" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Área Vinculada</label>
                            <select name="area" value={formData.area} onChange={handleFieldChange} className={inputStyles}>
                                <option value="">Seleccione un área</option>
                                {AREAS_PEDAGOGICAS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div className="lg:col-span-3">
                            <label htmlFor="descripcion" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Descripción de la Acción</label>
                            <textarea name="descripcion" value={formData.descripcion} onChange={handleFieldChange} rows={3} placeholder="Detalle de la acción a realizar..." className={inputStyles}></textarea>
                        </div>
                        <div>
                            <label htmlFor="fechaCumplimiento" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Fecha de Cumplimiento</label>
                            <input type="date" name="fechaCumplimiento" value={formData.fechaCumplimiento} onChange={handleFieldChange} className={inputStyles} />
                        </div>
                        <div className="lg:col-span-2">
                            <label htmlFor="enlaceDocumento" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Enlace a Documento (Opcional)</label>
                            <input type="url" name="enlaceDocumento" value={formData.enlaceDocumento || ''} onChange={handleFieldChange} placeholder="https://ejemplo.com/documento" className={inputStyles} />
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end items-center gap-4">
                        {editingId && <button type="button" onClick={handleResetForm} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">Cancelar</button>}
                        <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">
                            {editingId ? 'Actualizar Acción' : 'Registrar Acción'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Tabla de Seguimiento</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input type="text" placeholder="Buscar por responsable o palabra clave..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={inputStyles + " md:col-span-1"}/>
                    <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className={inputStyles}><option value="">Filtrar por Área</option>{AREAS_PEDAGOGICAS.map(a => <option key={a} value={a}>{a}</option>)}</select>
                    <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className={inputStyles}><option value="">Filtrar por Estado</option>{ESTADOS_ACCION.map(e => <option key={e} value={e}>{e}</option>)}</select>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Responsable</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Descripción</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fechas</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={5} className="text-center py-10">Cargando...</td></tr>
                            ) : filteredAcciones.length > 0 ? filteredAcciones.map(a => (
                                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.responsable}</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">{a.area}</div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-sm whitespace-normal">{a.descripcion}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                        <div>Reg: {a.fechaRegistro}</div>
                                        <div className="font-semibold">Comp: {a.fechaCumplimiento}</div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm">
                                        <button onClick={() => handleChangeEstado(a.id)} className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${estadoColors[a.estado]}`}>
                                            {a.estado}
                                        </button>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center space-x-2">
                                        {a.enlaceDocumento && (
                                            <a href={a.enlaceDocumento} target="_blank" rel="noopener noreferrer" title="Ver Documento" className="text-indigo-600 hover:text-indigo-800 p-1 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/40 inline-block align-middle">
                                                🔗
                                            </a>
                                        )}
                                        <button onClick={() => handleEdit(a)} title="Editar" className="text-yellow-600 hover:text-yellow-800 p-1 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/40">✏️</button>
                                        <button onClick={() => handleDelete(a.id)} title="Eliminar" className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40">🗑️</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={5} className="text-center py-10 text-slate-500">No se encontraron acciones.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SeguimientoAcciones;
