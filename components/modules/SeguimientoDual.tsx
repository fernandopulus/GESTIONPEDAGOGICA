import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { SeguimientoDualRecord, EstadoSeguimientoDual, User, Profile } from '../../types';
import { CURSOS_DUAL, ESTADOS_SEGUIMIENTO_DUAL, PROFESORES } from '../../constants';
import { read, utils, writeFile, WorkBook } from 'xlsx';
import {
    subscribeToSeguimientoDual,
    createSeguimientoRecord,
    updateSeguimientoRecord,
    deleteSeguimientoRecord,
} from '../../src/firebaseHelpers/seguimientoDualHelper'; // AJUSTA la ruta a tu nuevo helper

const normalizeCurso = (curso: string): string => {
    if (!curso) return '';
    let normalized = curso.trim().toLowerCase();
    normalized = normalized.replace(/°/g, 'º');
    normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
    normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
    normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
    normalized = normalized.replace(/\s+/g, '').toUpperCase();
    return normalized;
};

const estadoColors: Record<EstadoSeguimientoDual, string> = {
    'Vinculado': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    'Desvinculado': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    'En proceso': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    'Empresa': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

const SupervisionModal: React.FC<{
    record: SeguimientoDualRecord;
    onSave: (updatedRecord: SeguimientoDualRecord) => void;
    onClose: () => void;
}> = ({ record, onSave, onClose }) => {
    const [modalData, setModalData] = useState(record);
    
    const inputStyles = "w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white";

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setModalData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = () => {
        onSave(modalData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Seguimiento de Supervisión</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">{record.nombreEstudiante}</p>
                    
                    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4 text-slate-700 dark:text-slate-300">
                        <fieldset className="border p-4 rounded-lg dark:border-slate-600">
                            <legend className="font-semibold text-lg px-2">1er Semestre</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-2">
                                <div className="space-y-1">
                                    <label htmlFor={`f1s1-${record.id}`} className="text-sm font-medium">Fecha 1ra Supervisión</label>
                                    <input id={`f1s1-${record.id}`} type="date" name="fecha1raSupervision1erSemestre" value={modalData.fecha1raSupervision1erSemestre || ''} onChange={handleChange} className={inputStyles} />
                                </div>
                                <label className="flex items-center gap-2 pt-6">
                                    <input type="checkbox" name="realizada1raSupervision1erSemestre" checked={!!modalData.realizada1raSupervision1erSemestre} onChange={handleChange} className="h-5 w-5 rounded text-amber-500" />
                                    <span>Realizada</span>
                                </label>
                                <div className="space-y-1">
                                    <label htmlFor={`f2s1-${record.id}`} className="text-sm font-medium">Fecha 2da Supervisión</label>
                                    <input id={`f2s1-${record.id}`} type="date" name="fecha2daSupervision1erSemestre" value={modalData.fecha2daSupervision1erSemestre || ''} onChange={handleChange} className={inputStyles} />
                                </div>
                                <label className="flex items-center gap-2 pt-6">
                                    <input type="checkbox" name="realizada2daSupervision1erSemestre" checked={!!modalData.realizada2daSupervision1erSemestre} onChange={handleChange} className="h-5 w-5 rounded text-amber-500" />
                                    <span>Realizada</span>
                                </label>
                            </div>
                        </fieldset>

                        <fieldset className="border p-4 rounded-lg dark:border-slate-600">
                            <legend className="font-semibold text-lg px-2">2do Semestre</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-2">
                                <div className="space-y-1">
                                    <label htmlFor={`f1s2-${record.id}`} className="text-sm font-medium">Fecha 1ra Supervisión</label>
                                    <input id={`f1s2-${record.id}`} type="date" name="fecha1raSupervision2doSemestre" value={modalData.fecha1raSupervision2doSemestre || ''} onChange={handleChange} className={inputStyles} />
                                </div>
                                <label className="flex items-center gap-2 pt-6">
                                    <input type="checkbox" name="realizada1raSupervision2doSemestre" checked={!!modalData.realizada1raSupervision2doSemestre} onChange={handleChange} className="h-5 w-5 rounded text-amber-500" />
                                    <span>Realizada</span>
                                </label>
                                <div className="space-y-1">
                                    <label htmlFor={`f2s2-${record.id}`} className="text-sm font-medium">Fecha 2da Supervisión</label>
                                    <input id={`f2s2-${record.id}`} type="date" name="fecha2daSupervision2doSemestre" value={modalData.fecha2daSupervision2doSemestre || ''} onChange={handleChange} className={inputStyles} />
                                </div>
                                <label className="flex items-center gap-2 pt-6">
                                    <input type="checkbox" name="realizada2daSupervision2doSemestre" checked={!!modalData.realizada2daSupervision2doSemestre} onChange={handleChange} className="h-5 w-5 rounded text-amber-500" />
                                    <span>Realizada</span>
                                </label>
                            </div>
                        </fieldset>

                        <fieldset className="border p-4 rounded-lg dark:border-slate-600">
                            <legend className="font-semibold text-lg px-2">Supervisión Excepcional</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-2">
                                <div className="space-y-1">
                                    <label htmlFor={`fex-${record.id}`} className="text-sm font-medium">Fecha Supervisión</label>
                                    <input id={`fex-${record.id}`} type="date" name="fechaSupervisionExcepcional" value={modalData.fechaSupervisionExcepcional || ''} onChange={handleChange} className={inputStyles} />
                                </div>
                                <label className="flex items-center gap-2 pt-6">
                                    <input type="checkbox" name="realizadaSupervisionExcepcional" checked={!!modalData.realizadaSupervisionExcepcional} onChange={handleChange} className="h-5 w-5 rounded text-amber-500" />
                                    <span>Realizada</span>
                                </label>
                            </div>
                        </fieldset>

                        <fieldset className="border p-4 rounded-lg dark:border-slate-600">
                            <legend className="font-semibold text-lg px-2">Maestro Guía (Empresa)</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                                <div>
                                    <label htmlFor={`mg-nombre-${record.id}`} className="text-sm font-medium">Nombre Maestro Guía</label>
                                    <input id={`mg-nombre-${record.id}`} type="text" name="nombreMaestroGuia" value={modalData.nombreMaestroGuia || ''} onChange={handleChange} className={inputStyles + " mt-1"} />
                                </div>
                                <div>
                                    <label htmlFor={`mg-contacto-${record.id}`} className="text-sm font-medium">Contacto (Email/Teléfono)</label>
                                    <input id={`mg-contacto-${record.id}`} type="text" name="contactoMaestroGuia" value={modalData.contactoMaestroGuia || ''} onChange={handleChange} className={inputStyles + " mt-1"} />
                                </div>
                            </div>
                        </fieldset>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">Cerrar</button>
                    <button type="button" onClick={handleSave} className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">Guardar Cambios</button>
                </div>
            </div>
        </div>
    );
};


const SeguimientoDual: React.FC = () => {
    const [records, setRecords] = useState<SeguimientoDualRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const initialFormState: Omit<SeguimientoDualRecord, 'id'> = useMemo(() => ({
        nombreEstudiante: '', rutEstudiante: '', curso: CURSOS_DUAL[0], profesorTutorEmpresa: '',
        rutEmpresa: '', nombreEmpresa: '', direccionEmpresa: '', comuna: '', estado: ESTADOS_SEGUIMIENTO_DUAL[0],
        fechaDesvinculacion: '', motivoDesvinculacion: ''
    }), []);

    const [formData, setFormData] = useState<Omit<SeguimientoDualRecord, 'id'>>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ curso: '', empresa: '', estado: '', comuna: '', profesor: '' });
    const [error, setError] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<{ message: string, isError: boolean } | null>(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecordForModal, setSelectedRecordForModal] = useState<SeguimientoDualRecord | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribeToSeguimientoDual((data) => {
            setRecords(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleFieldChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleFilterChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleResetForm = useCallback(() => {
        setFormData(initialFormState);
        setEditingId(null);
        setError(null);
    }, [initialFormState]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        const requiredFields = ['nombreEstudiante', 'rutEstudiante', 'nombreEmpresa'];
        const missingField = requiredFields.find(field => !(formData as any)[field]?.trim());
        if (missingField) {
            setError(`El campo '${missingField}' es obligatorio.`);
            return;
        }

        try {
            if (editingId) {
                await updateSeguimientoRecord(editingId, formData);
            } else {
                await createSeguimientoRecord(formData);
            }
            handleResetForm();
        } catch (err) {
            console.error(err);
            setError("No se pudo guardar el registro.");
        }
    };
    
    const handleEdit = useCallback((record: SeguimientoDualRecord) => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setEditingId(record.id);
        setFormData(record);
    }, []);

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar este registro?')) {
            try {
                await deleteSeguimientoRecord(id);
            } catch (err) {
                console.error(err);
                setError("No se pudo eliminar el registro.");
            }
        }
    };
    
    const openSupervisionModal = (record: SeguimientoDualRecord) => {
        setSelectedRecordForModal(record);
        setIsModalOpen(true);
    };

    const closeSupervisionModal = () => {
        setSelectedRecordForModal(null);
        setIsModalOpen(false);
    };

    const handleSaveSupervisionModal = async (updatedRecord: SeguimientoDualRecord) => {
        try {
            await updateSeguimientoRecord(updatedRecord.id, updatedRecord);
            closeSupervisionModal();
        } catch (err) {
            console.error(err);
            alert("No se pudieron guardar los cambios de supervisión.");
        }
    };

    const handleDownloadTemplate = () => {
        const headers = [
            "Nombre", "RUT", "Curso 2025", "Profesor Tutor", "1° Visita 1° Semestre", "Realizada 1° Visita S1",
            "2° Visita 1° Semestre", "Realizada 2° Visita S1", "Visita Emergencia 1° Semestre", "3° Visita",
            "Realizada 3° Visita S2", "4° Visita", "Realizada 4° Visita S2", "Empresa", "RUT-Empresa",
            "Dirección", "Comuna", "Estado", "Fecha de Desvinculación", "Motivo Desvinculación", "Maestro Guía",
            "Correo maestro guía"
        ];
        const ws = utils.aoa_to_sheet([headers]);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Plantilla");
        writeFile(wb, "Plantilla_Seguimiento_Dual.xlsx");
    };

    const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
        // Esta función requiere una lógica más compleja para crear/actualizar en batch.
        // Se mantiene como placeholder.
        alert("La carga masiva desde Excel se implementará en una futura versión.");
    };

    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";

    const filteredRecords = useMemo(() => {
        return records.filter(r =>
            (searchTerm === '' ||
                r.nombreEstudiante.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.nombreEmpresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.rutEstudiante.includes(searchTerm)
            ) &&
            (filters.curso === '' || r.curso === filters.curso) &&
            (filters.empresa === '' || r.nombreEmpresa === filters.empresa) &&
            (filters.estado === '' || r.estado === filters.estado) &&
            (filters.comuna === '' || r.comuna === filters.comuna) &&
            (filters.profesor === '' || r.profesorTutorEmpresa === filters.profesor)
        ).sort((a, b) => a.nombreEstudiante.localeCompare(b.nombreEstudiante));
    }, [records, searchTerm, filters]);

    const uniqueFilterOptions = useMemo(() => {
        const empresas = new Set<string>();
        const comunas = new Set<string>();
        records.forEach(r => {
            if (r.nombreEmpresa) empresas.add(r.nombreEmpresa);
            if (r.comuna) comunas.add(r.comuna);
        });
        return {
            empresas: Array.from(empresas).sort(),
            comunas: Array.from(comunas).sort()
        };
    }, [records]);

    if (loading) {
        return <div className="text-center py-10">Cargando registros...</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Seguimiento de Práctica Dual</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-6">{editingId ? 'Editando registro existente.' : 'Registre un nuevo estudiante en práctica.'}</p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre Estudiante</label>
                            <input type="text" name="nombreEstudiante" value={formData.nombreEstudiante} onChange={handleFieldChange} className={inputStyles} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">RUT Estudiante</label>
                            <input type="text" name="rutEstudiante" value={formData.rutEstudiante} onChange={handleFieldChange} className={inputStyles} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Curso</label>
                            <select name="curso" value={formData.curso} onChange={handleFieldChange} className={inputStyles} required>
                                {CURSOS_DUAL.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Profesor Tutor</label>
                             <select name="profesorTutorEmpresa" value={formData.profesorTutorEmpresa} onChange={handleFieldChange} className={inputStyles}>
                                <option value="">Seleccione un profesor</option>
                                {PROFESORES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre Empresa</label>
                            <input type="text" name="nombreEmpresa" value={formData.nombreEmpresa} onChange={handleFieldChange} className={inputStyles} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">RUT Empresa</label>
                            <input type="text" name="rutEmpresa" value={formData.rutEmpresa} onChange={handleFieldChange} className={inputStyles} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Dirección Empresa</label>
                            <input type="text" name="direccionEmpresa" value={formData.direccionEmpresa} onChange={handleFieldChange} className={inputStyles} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Comuna</label>
                            <input type="text" name="comuna" value={formData.comuna} onChange={handleFieldChange} className={inputStyles} />
                        </div>
                        <div className="lg:col-span-4">
                             <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Estado</label>
                             <select name="estado" value={formData.estado} onChange={handleFieldChange} className={inputStyles}>
                                {ESTADOS_SEGUIMIENTO_DUAL.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                        </div>
                    </div>
                     {formData.estado === 'Desvinculado' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <div>
                                <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">Fecha de Desvinculación</label>
                                <input type="date" name="fechaDesvinculacion" value={formData.fechaDesvinculacion || ''} onChange={handleFieldChange} className={`${inputStyles} border-red-300`} />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">Motivo de Desvinculación</label>
                                <input type="text" name="motivoDesvinculacion" value={formData.motivoDesvinculacion || ''} onChange={handleFieldChange} className={`${inputStyles} border-red-300`} />
                            </div>
                        </div>
                    )}
                    {error && <p className="text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                    <div className="flex justify-end items-center gap-4">
                        {editingId && <button type="button" onClick={handleResetForm} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200">Cancelar</button>}
                        <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900">{editingId ? 'Actualizar' : 'Agregar'}</button>
                    </div>
                </form>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Carga Masiva</h2>
                 <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <button onClick={handleDownloadTemplate} className="bg-green-100 text-green-700 font-semibold py-2 px-4 rounded-lg hover:bg-green-200">Descargar Plantilla Excel</button>
                    <input type="file" onChange={handleFileUpload} accept=".xlsx, .xls" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"/>
                </div>
                {uploadStatus && <p className={`text-sm p-2 rounded-md mt-4 ${uploadStatus.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{uploadStatus.message}</p>}
            </div>
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Registros de Estudiantes</h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                    <input type="text" placeholder="Buscar por estudiante, empresa o RUT..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputStyles} md:col-span-2 lg:col-span-1`} />
                    <select name="curso" value={filters.curso} onChange={handleFilterChange} className={inputStyles}><option value="">Todos los Cursos</option>{CURSOS_DUAL.map(c => <option key={c}>{c}</option>)}</select>
                    <select name="estado" value={filters.estado} onChange={handleFilterChange} className={inputStyles}><option value="">Todos los Estados</option>{ESTADOS_SEGUIMIENTO_DUAL.map(e => <option key={e}>{e}</option>)}</select>
                    <select name="profesor" value={filters.profesor} onChange={handleFilterChange} className={inputStyles}><option value="">Todos los Profesores</option>{PROFESORES.map(p => <option key={p}>{p}</option>)}</select>
                 </div>
                 <div className="overflow-x-auto">
                     <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                         <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Estudiante</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Empresa</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Profesor Tutor</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Estado</th>
                                 <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Acciones</th>
                            </tr>
                         </thead>
                         <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredRecords.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                                    <td className="px-4 py-4 whitespace-nowrap"><div className="font-medium text-slate-800 dark:text-slate-200">{r.nombreEstudiante}</div><div className="text-sm text-slate-500 dark:text-slate-400">{r.curso}</div></td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{r.nombreEmpresa}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{r.profesorTutorEmpresa}</td>
                                    <td className="px-4 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${estadoColors[r.estado]}`}>{r.estado}</span></td>
                                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm space-x-2">
                                        <button onClick={() => openSupervisionModal(r)} className="text-blue-600 hover:underline">Supervisión</button>
                                        <button onClick={() => handleEdit(r)} className="text-yellow-600 hover:underline">Editar</button>
                                        <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline">Eliminar</button>
                                    </td>
                                </tr>
                            ))}
                         </tbody>
                     </table>
                 </div>
             </div>
             
             {isModalOpen && selectedRecordForModal && (
                <SupervisionModal
                    record={selectedRecordForModal}
                    onClose={closeSupervisionModal}
                    onSave={handleSaveSupervisionModal}
                />
            )}
        </div>
    );
};

export default SeguimientoDual;