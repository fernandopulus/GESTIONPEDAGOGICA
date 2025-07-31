import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { Reemplazo, User, Profile } from '../../types';
import { ASIGNATURAS, CURSOS } from '../../constants';

const BLOQUES = Array.from({ length: 12 }, (_, i) => i + 1);
const USERS_KEY = 'usuariosLiceo';
const REEMPLAZOS_KEY = 'reemplazosDocentes';


const initialState: Omit<Reemplazo, 'id' | 'resultado'> = {
    docenteAusente: '',
    asignaturaAusente: '',
    curso: '',
    diaAusencia: '',
    bloquesAfectados: [],
    docenteReemplazante: '',
    asignaturaReemplazante: '',
};

const BlockCheckboxGroup: React.FC<{
    selectedBlocks: number[];
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    legend: string;
}> = ({ selectedBlocks, onChange, legend }) => (
    <fieldset>
        <legend className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{legend}</legend>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {BLOQUES.map(bloque => (
                <label key={bloque} className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700 transition-colors">
                    <input
                        type="checkbox"
                        value={bloque}
                        checked={selectedBlocks.includes(bloque)}
                        onChange={onChange}
                        className="h-5 w-5 rounded text-amber-500 focus:ring-amber-400 bg-slate-200 dark:bg-slate-600 border-slate-300 dark:border-slate-500"
                    />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{bloque}</span>
                </label>
            ))}
        </div>
    </fieldset>
);


const RegistroReemplazos: React.FC = () => {
    const [registros, setRegistros] = useState<Reemplazo[]>(() => {
        try {
            const data = localStorage.getItem(REEMPLAZOS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error al leer reemplazos de localStorage", e);
            return [];
        }
    });
    const [profesores, setProfesores] = useState<string[]>([]);
    const [formData, setFormData] = useState(initialState);
    const [filter, setFilter] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            const usersData = localStorage.getItem(USERS_KEY);
            if (usersData) {
                const allUsers: User[] = JSON.parse(usersData);
                const teacherNames = allUsers
                    .filter(user => user.profile === Profile.PROFESORADO)
                    .map(user => user.nombreCompleto)
                    .sort();
                setProfesores(teacherNames);
            }
        } catch (e) {
            console.error("Error al cargar profesores desde localStorage", e);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(REEMPLAZOS_KEY, JSON.stringify(registros));
        } catch (e) {
            console.error("Error al guardar reemplazos en localStorage", e);
        }
    }, [registros]);


    const handleFieldChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleCheckboxChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setFormData(prev => {
            const currentBlocks = prev.bloquesAfectados;
            const newBlocks = currentBlocks.includes(value)
                ? currentBlocks.filter(b => b !== value)
                : [...currentBlocks, value].sort((a,b) => a - b);
            return { ...prev, bloquesAfectados: newBlocks };
        });
    }, []);

    const handleSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        setError(null);

        const { docenteAusente, asignaturaAusente, curso, diaAusencia, bloquesAfectados, docenteReemplazante, asignaturaReemplazante } = formData;

        if (!docenteAusente || !asignaturaAusente || !curso || !diaAusencia || !docenteReemplazante || !asignaturaReemplazante || bloquesAfectados.length === 0) {
            setError('Todos los campos son obligatorios y debe seleccionar al menos un bloque.');
            return;
        }

        const resultado = asignaturaAusente.trim().toLowerCase() === asignaturaReemplazante.trim().toLowerCase()
            ? 'Hora realizada'
            : 'Hora cubierta, no realizada';

        const newRegistro: Reemplazo = {
            id: crypto.randomUUID(),
            ...formData,
            resultado,
        };

        setRegistros(prev => [newRegistro, ...prev]);
        setFormData(initialState);
    }, [formData]);
    
    const handleDelete = useCallback((id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar este registro?')) {
            setRegistros(prev => prev.filter(r => r.id !== id));
        }
    }, []);

    const filteredRegistros = useMemo(() => {
        if (!filter) return registros;
        const lowercasedFilter = filter.toLowerCase();
        return registros.filter(r =>
            r.docenteAusente.toLowerCase().includes(lowercasedFilter) ||
            r.docenteReemplazante.toLowerCase().includes(lowercasedFilter) ||
            r.diaAusencia.includes(lowercasedFilter) ||
            r.curso.toLowerCase().includes(lowercasedFilter)
        );
    }, [registros, filter]);
    
    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm focus:ring-amber-400 focus:border-amber-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Registro de Inasistencias y Reemplazos</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Complete el formulario para registrar una nueva suplencia.</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Columna Docente Ausente */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 border-b dark:border-slate-600 pb-2">Docente Ausente</h2>
                            <div>
                                <label htmlFor="docenteAusente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre</label>
                                <select name="docenteAusente" value={formData.docenteAusente} onChange={handleFieldChange} className={inputStyles}>
                                    <option value="">Seleccione un docente</option>
                                    {profesores.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="asignaturaAusente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
                                <select name="asignaturaAusente" value={formData.asignaturaAusente} onChange={handleFieldChange} className={inputStyles}>
                                    <option value="">Seleccione una asignatura</option>
                                    {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="curso" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Curso</label>
                                <select name="curso" value={formData.curso} onChange={handleFieldChange} className={inputStyles}>
                                    <option value="">Seleccione un curso</option>
                                    {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="diaAusencia" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Día Ausencia</label>
                                <input type="date" name="diaAusencia" value={formData.diaAusencia} onChange={handleFieldChange} className={inputStyles} />
                            </div>
                            <BlockCheckboxGroup legend="Bloques Afectados" selectedBlocks={formData.bloquesAfectados} onChange={handleCheckboxChange} />
                        </div>

                        {/* Columna Docente Reemplazante */}
                        <div className="space-y-4">
                             <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 border-b dark:border-slate-600 pb-2">Docente Reemplazante</h2>
                            <div>
                                <label htmlFor="docenteReemplazante" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre</label>
                                <select name="docenteReemplazante" value={formData.docenteReemplazante} onChange={handleFieldChange} className={inputStyles}>
                                    <option value="">Seleccione un docente</option>
                                    {profesores.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="asignaturaReemplazante" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
                                 <select name="asignaturaReemplazante" value={formData.asignaturaReemplazante} onChange={handleFieldChange} className={inputStyles}>
                                    <option value="">Seleccione una asignatura</option>
                                    {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    {error && <p className="text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                    
                    <div className="pt-4 text-right">
                        <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">
                            Registrar Reemplazo
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Historial de Reemplazos</h2>
                 <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Buscar por docente, curso o fecha (YYYY-MM-DD)..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className={inputStyles + " md:w-1/2"}
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Curso</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Docente Ausente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Docente Reemplazante</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bloques</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Resultado</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredRegistros.length > 0 ? filteredRegistros.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{r.diaAusencia}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{r.curso}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">{r.docenteAusente}<br/><span className="text-xs text-slate-500 dark:text-slate-400">{r.asignaturaAusente}</span></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">{r.docenteReemplazante}<br/><span className="text-xs text-slate-500 dark:text-slate-400">{r.asignaturaReemplazante}</span></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{r.bloquesAfectados.join(', ')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${r.resultado === 'Hora realizada' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'}`}>
                                            {r.resultado}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                        <button 
                                            onClick={() => handleDelete(r.id)} 
                                            title="Eliminar registro"
                                            className="p-1 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                                        No se encontraron registros.
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

export default RegistroReemplazos;
