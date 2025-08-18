import React, { useMemo, useState } from 'react';
import { AsignacionHorario } from '../../types';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { CURSOS, ASIGNATURAS } from '../../constants';

interface AsignacionesPorCurso {
    [curso: string]: {
        [asignatura: string]: string[];  // array de profesores
    };
}

interface ProfesorCarga {
    [profesor: string]: {
        cursos: string[];
        asignaturas: string[];
        total: number;
    };
}

interface MatrizAsignacionesProps {
    asignaciones: AsignacionHorario[];
    onDeleteAsignacion: (id: string) => void;
    profesores: string[];
    onAddAsignacion: (asignacion: { curso: string; asignatura: string; profesor: string }) => void;
}

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (profesor: string) => void;
    curso: string;
    asignatura: string;
    profesores: string[];
    currentProfesor?: string;
}

const EditModal: React.FC<EditModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    curso, 
    asignatura, 
    profesores,
    currentProfesor 
}) => {
    const [selectedProfesor, setSelectedProfesor] = useState(currentProfesor || '');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                    {currentProfesor ? 'Editar' : 'Asignar'} Profesor
                </h3>
                <div className="mb-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        <strong>Curso:</strong> {curso}<br/>
                        <strong>Asignatura:</strong> {asignatura}
                    </p>
                </div>
                <select
                    value={selectedProfesor}
                    onChange={(e) => setSelectedProfesor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 mb-4"
                >
                    <option value="">Seleccionar profesor</option>
                    {profesores.map(profesor => (
                        <option key={profesor} value={profesor}>{profesor}</option>
                    ))}
                </select>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            if (selectedProfesor) {
                                onSave(selectedProfesor);
                                onClose();
                            }
                        }}
                        disabled={!selectedProfesor}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

export const MatrizAsignaciones: React.FC<MatrizAsignacionesProps> = ({ 
    asignaciones, 
    onDeleteAsignacion,
    profesores,
    onAddAsignacion 
}) => {
    const [editModal, setEditModal] = useState<{
        isOpen: boolean;
        curso: string;
        asignatura: string;
        currentProfesor?: string;
    }>({
        isOpen: false,
        curso: '',
        asignatura: '',
    });
    // Procesar asignaciones para crear matriz
    const matrizData = useMemo(() => {
        const matriz: AsignacionesPorCurso = {};
        const profesoresCarga: ProfesorCarga = {};

        // Inicializar matriz vacía
        CURSOS.forEach(curso => {
            matriz[curso] = {};
            ASIGNATURAS.forEach(asignatura => {
                matriz[curso][asignatura] = [];
            });
        });

        // Poblar matriz y calcular carga de profesores
        asignaciones.forEach(asig => {
            // Actualizar matriz
            matriz[asig.curso][asig.asignatura].push(asig.profesor);

            // Actualizar carga de profesores
            if (!profesoresCarga[asig.profesor]) {
                profesoresCarga[asig.profesor] = {
                    cursos: [],
                    asignaturas: [],
                    total: 0
                };
            }
            if (!profesoresCarga[asig.profesor].cursos.includes(asig.curso)) {
                profesoresCarga[asig.profesor].cursos.push(asig.curso);
            }
            if (!profesoresCarga[asig.profesor].asignaturas.includes(asig.asignatura)) {
                profesoresCarga[asig.profesor].asignaturas.push(asig.asignatura);
            }
            profesoresCarga[asig.profesor].total++;
        });

        return { matriz, profesoresCarga };
    }, [asignaciones]);

    const resumenAsignaturas = useMemo(() => {
        const resumen: { [asignatura: string]: number } = {};
        ASIGNATURAS.forEach(asignatura => {
            resumen[asignatura] = 0;
            CURSOS.forEach(curso => {
                resumen[asignatura] += matrizData.matriz[curso][asignatura].length;
            });
        });
        return resumen;
    }, [matrizData.matriz]);

    const handleEditModalSave = (profesor: string) => {
        if (editModal.currentProfesor) {
            // Si hay un profesor actual, primero eliminamos la asignación existente
            const asignacion = asignaciones.find(
                a => a.curso === editModal.curso && 
                     a.asignatura === editModal.asignatura && 
                     a.profesor === editModal.currentProfesor
            );
            if (asignacion) {
                onDeleteAsignacion(asignacion.id);
            }
        }
        // Agregamos la nueva asignación
        onAddAsignacion({
            curso: editModal.curso,
            asignatura: editModal.asignatura,
            profesor
        });
    };

    return (
        <div className="space-y-8">
            <EditModal
                isOpen={editModal.isOpen}
                onClose={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                onSave={handleEditModalSave}
                curso={editModal.curso}
                asignatura={editModal.asignatura}
                profesores={profesores}
                currentProfesor={editModal.currentProfesor}
            />
            {/* Matriz de Asignaciones */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg overflow-x-auto">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Matriz de Asignaciones</h3>
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-50 dark:bg-slate-700/50">
                                Asignatura
                            </th>
                            {CURSOS.map(curso => (
                                <th key={curso} className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[120px]">
                                    {curso}
                                </th>
                            ))}
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {ASIGNATURAS.map(asignatura => (
                            <tr key={asignatura} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-800">
                                    {asignatura}
                                </td>
                                {CURSOS.map(curso => {
                                    const profesores = matrizData.matriz[curso][asignatura];
                                    const tieneAsignacion = profesores.length > 0;
                                    const tieneDuplicados = profesores.length > 1;

                                    return (
                                        <td 
                                            key={`${curso}-${asignatura}`} 
                                            className={`px-4 py-3 text-sm text-slate-500 dark:text-slate-400 cursor-pointer transition-colors
                                                ${!tieneAsignacion ? 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20' : ''}
                                            `}
                                            onClick={() => {
                                                if (!tieneAsignacion) {
                                                    setEditModal({
                                                        isOpen: true,
                                                        curso,
                                                        asignatura
                                                    });
                                                }
                                            }}
                                        >
                                            <div className="flex flex-col items-center min-h-[40px] justify-center">
                                                {profesores.map((profesor, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 group">
                                                        <span 
                                                            className={`${tieneDuplicados ? 'text-amber-600 dark:text-amber-400' : ''} hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditModal({
                                                                    isOpen: true,
                                                                    curso,
                                                                    asignatura,
                                                                    currentProfesor: profesor
                                                                });
                                                            }}
                                                        >
                                                            {profesor}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const asignacion = asignaciones.find(
                                                                    a => a.curso === curso && 
                                                                         a.asignatura === asignatura && 
                                                                         a.profesor === profesor
                                                                );
                                                                if (asignacion) onDeleteAsignacion(asignacion.id);
                                                            }}
                                                            className="text-red-500 hover:text-red-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                                {!tieneAsignacion && (
                                                    <span className="text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400">
                                                        Asignar profesor
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3 text-sm text-center font-semibold text-slate-700 dark:text-slate-300">
                                    {resumenAsignaturas[asignatura]}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Resumen de Cobertura */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Resumen de Cobertura</h3>
                    <div className="space-y-4">
                        {ASIGNATURAS.map(asignatura => {
                            const total = resumenAsignaturas[asignatura];
                            const porcentaje = (total / CURSOS.length) * 100;
                            
                            return (
                                <div key={asignatura} className="flex items-center gap-4">
                                    <div className="w-32 truncate font-medium text-slate-700 dark:text-slate-300">
                                        {asignatura}
                                    </div>
                                    <div className="flex-1">
                                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                                            <div 
                                                className={`h-2 rounded-full ${
                                                    porcentaje === 100 ? 'bg-green-500' :
                                                    porcentaje > 50 ? 'bg-amber-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${porcentaje}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="w-16 text-right text-sm text-slate-600 dark:text-slate-400">
                                        {porcentaje.toFixed(0)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Carga Docente</h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {Object.entries(matrizData.profesoresCarga)
                            .sort((a, b) => (b[1] as ProfesorCarga[keyof ProfesorCarga]).total - (a[1] as ProfesorCarga[keyof ProfesorCarga]).total)
                            .map(([profesor, carga]) => (
                                <div key={profesor} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium text-slate-900 dark:text-slate-200">{profesor}</h4>
                                        <span className="text-sm font-semibold px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded">
                                            {(carga as ProfesorCarga[keyof ProfesorCarga]).total} asignaciones
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        <p><strong>Cursos:</strong> {(carga as ProfesorCarga[keyof ProfesorCarga]).cursos.join(', ')}</p>
                                        <p><strong>Asignaturas:</strong> {(carga as ProfesorCarga[keyof ProfesorCarga]).asignaturas.join(', ')}</p>
                                    </div>
                                </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Indicadores y Advertencias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(matrizData.matriz).map(([curso, asignaturas]) => {
                    const asignaturasConDuplicados = Object.entries(asignaturas)
                        .filter(([_, profesores]) => profesores.length > 1)
                        .map(([asignatura]) => asignatura);

                    const asignaturasAsignadas = Object.values(asignaturas).filter(profesores => profesores.length > 0).length;
                    const totalAsignaturas = ASIGNATURAS.length;
                    const porcentajeCobertura = (asignaturasAsignadas / totalAsignaturas) * 100;

                    return (
                        <div key={curso} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{curso}</h4>
                            
                            <div className="flex items-center gap-2 text-sm mb-2">
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full ${
                                            porcentajeCobertura === 100 ? 'bg-green-500' :
                                            porcentajeCobertura > 50 ? 'bg-amber-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${porcentajeCobertura}%` }}
                                    />
                                </div>
                                <span className="text-slate-600 dark:text-slate-400 w-16 text-right">
                                    {porcentajeCobertura.toFixed(0)}%
                                </span>
                            </div>

                            {asignaturasConDuplicados.length > 0 && (
                                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded text-sm">
                                    <AlertTriangle className="inline-block w-4 h-4 mr-1" />
                                    Duplicados en: {asignaturasConDuplicados.join(', ')}
                                </div>
                            )}

                            {asignaturasAsignadas === 0 && (
                                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded text-sm">
                                    <Info className="inline-block w-4 h-4 mr-1" />
                                    Sin asignaciones
                                </div>
                            )}

                            {asignaturasAsignadas === totalAsignaturas && (
                                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-sm">
                                    <CheckCircle className="inline-block w-4 h-4 mr-1" />
                                    Cobertura completa
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
