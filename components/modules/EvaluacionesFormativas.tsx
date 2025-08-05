import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { EvaluacionFormativa, CalificacionesFormativas, User, Profile, TrabajoGrupal, GrupoIntegrante } from '../../types';
import { ASIGNATURAS, CURSOS, ROLES_TRABAJO_GRUPAL } from '../../constants';
import {
    subscribeToEvaluaciones,
    createEvaluacion,
    updateEvaluacion,
    deleteEvaluacion,
    subscribeToCalificaciones,
    updateCalificaciones,
    subscribeToTrabajosGrupales,
    createTrabajoGrupal,
    updateTrabajoGrupal,
    subscribeToAllUsers
} from '../../src/firebaseHelpers/evaluacionesFormativasHelper'; // AJUSTA la ruta a tu nuevo helper

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

const asignaturaEmojis: Record<string, string> = {
    'Lengua y Literatura': '📚', 'Matemática': '➗', 'Inglés': '🇬🇧', 'Filosofía': '🤔',
    'Historia y Geografía': '🌍', 'Educación Ciudadana': '🏛️', 'Ciencias': '🔬', 'Ciencias para la Ciudadanía': '💡',
    'Artes': '🎨', 'Música': '🎵', 'Educación Física': '🏃‍♂️', 'Orientación': '🧭', 'Mecánica Industrial': '⚙️',
    'Mecánica Automotriz': '🚗', 'Emprendimiento': '💼', 'Tecnología': '💻', 'Pensamiento Lógico': '🧠', 'Competencia Lectora': '📖',
    'Default': '✏️'
};

const getCourseColors = (curso: string): { bg: string; text: string; border: string; spine: string } => {
    if (curso.startsWith('1º')) return { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-700', spine: 'bg-blue-800' };
    if (curso.startsWith('2º')) return { bg: 'bg-green-500', text: 'text-white', border: 'border-green-700', spine: 'bg-green-800' };
    if (curso.startsWith('3º')) return { bg: 'bg-yellow-400', text: 'text-yellow-900', border: 'border-yellow-600', spine: 'bg-yellow-700' };
    if (curso.startsWith('4º')) return { bg: 'bg-red-500', text: 'text-white', border: 'border-red-700', spine: 'bg-red-800' };
    return { bg: 'bg-slate-500', text: 'text-white', border: 'border-slate-700', spine: 'bg-slate-800' };
};

interface EvaluacionesFormativasProps {
    currentUser: User;
}

// --- Subcomponentes para el nuevo flujo ---

const ClassSelector: React.FC<{ cursos: string[]; onSelect: (curso: string) => void }> = ({ cursos, onSelect }) => (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Seleccione un Libro de Clases</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Cada libro representa un curso y contiene sus evaluaciones formativas.</p>
        {cursos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {cursos.map(curso => {
                    const colors = getCourseColors(curso);
                    return (
                        <div key={curso} className="space-y-2 text-center">
                            <button onClick={() => onSelect(curso)} className={`relative w-full h-48 rounded-md shadow-lg ${colors.bg} ${colors.border} border-b-4 transform hover:-translate-y-2 transition-transform duration-300 group`}>
                                <div className={`absolute top-0 left-0 w-6 h-full ${colors.spine} rounded-l-md`}></div>
                                <div className={`flex flex-col items-center justify-center h-full p-2 ${colors.text}`}>
                                    <span className="font-bold text-2xl drop-shadow-sm">{curso.slice(0, 2)}</span>
                                    <span className="font-black text-5xl drop-shadow-md">{curso.slice(2)}</span>
                                </div>
                            </button>
                            <p className="font-semibold text-slate-700 dark:text-slate-300">{curso}</p>
                        </div>
                    );
                })}
            </div>
        ) : (
             <div className="text-center py-10 bg-slate-100 rounded-lg">
                <p className="text-slate-500">No tiene cursos asignados.</p>
                <p className="text-sm text-slate-400 mt-2">Contacte a un administrador para que le asigne cursos a su perfil.</p>
            </div>
        )}
    </div>
);

const SubjectSelector: React.FC<{ curso: string; asignaturas: string[]; onSelect: (asignatura: string) => void; onBack: () => void; }> = ({ curso, asignaturas, onSelect, onBack }) => {
    const colors = getCourseColors(curso);
    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">&larr; Volver a Cursos</button>
                <div className={`p-2 rounded-md ${colors.bg} ${colors.text} font-bold`}>
                    Libro de Clases: {curso}
                </div>
            </div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Seleccione una Asignatura</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Elija la asignatura para ver o agregar calificaciones.</p>
            {asignaturas.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {asignaturas.map(asignatura => (
                        <button key={asignatura} onClick={() => onSelect(asignatura)} className="flex items-center gap-3 p-4 rounded-lg bg-slate-100 hover:bg-amber-100 dark:bg-slate-700 dark:hover:bg-amber-900/50 transition-colors">
                            <span className="text-2xl">{asignaturaEmojis[asignatura] || asignaturaEmojis['Default']}</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-left">{asignatura}</span>
                        </button>
                    ))}
                </div>
            ) : (
                 <div className="text-center py-10 bg-slate-100 rounded-lg">
                    <p className="text-slate-500">No tiene asignaturas asignadas.</p>
                    <p className="text-sm text-slate-400 mt-2">Contacte a un administrador.</p>
                </div>
            )}
        </div>
    );
};

const CalificacionesView: React.FC<{
    curso: string;
    asignatura: string;
    allUsers: User[];
    onBack: () => void;
}> = ({ curso, asignatura, allUsers, onBack }) => {
    const [evaluaciones, setEvaluaciones] = useState<EvaluacionFormativa[]>([]);
    const [calificaciones, setCalificaciones] = useState<CalificacionesFormativas>({});
    const [formData, setFormData] = useState({ fecha: new Date().toISOString().split('T')[0], nombreActividad: '' });
    const [editingEval, setEditingEval] = useState<EvaluacionFormativa | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const estudiantesDelCurso = useMemo(() => {
        return allUsers
            .filter(e => e.profile === Profile.ESTUDIANTE && normalizeCurso(e.curso || '') === curso)
            .map(e => e.nombreCompleto)
            .sort((a, b) => a.localeCompare(b));
    }, [allUsers, curso]);

    useEffect(() => {
        setLoading(true);
        const unsubEvaluaciones = subscribeToEvaluaciones(curso, asignatura, (data) => {
            setEvaluaciones(data);
            const evalIds = data.map(ev => ev.id);
            const unsubCalificaciones = subscribeToCalificaciones(evalIds, (califData) => {
                setCalificaciones(prev => ({ ...prev, ...califData }));
            });
            setLoading(false);
            return () => unsubCalificaciones();
        });

        return () => unsubEvaluaciones();
    }, [curso, asignatura]);
    
    const handleFieldChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (editingEval) {
            setEditingEval(prev => prev ? { ...prev, [name]: value } : null);
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!formData.nombreActividad.trim()) {
            setError("El nombre de la actividad es obligatorio.");
            return;
        }
        
        const newEvalData: Omit<EvaluacionFormativa, 'id'> = { asignatura, curso, ...formData };
        const initialCalificaciones = estudiantesDelCurso.reduce((acc, nombre) => {
            acc[nombre] = 'trabajado';
            return acc;
        }, {} as Record<string, string>);

        try {
            await createEvaluacion(newEvalData, initialCalificaciones);
            setFormData({ fecha: new Date().toISOString().split('T')[0], nombreActividad: '' });
        } catch (err) {
            console.error(err);
            setError("No se pudo crear la evaluación.");
        }
    };

    const handleCalificacionChange = (evaluacionId: string, nombreEstudiante: string) => {
        const currentStatus = calificaciones[evaluacionId]?.[nombreEstudiante] || 'trabajado';
        const newStatus = currentStatus === 'trabajado' ? 'no trabajado' : 'trabajado';
        const updatedCalificaciones = {
            ...calificaciones,
            [evaluacionId]: { ...(calificaciones[evaluacionId] || {}), [nombreEstudiante]: newStatus },
        };
        setCalificaciones(updatedCalificaciones); // Optimistic update
        updateCalificaciones(evaluacionId, { [nombreEstudiante]: newStatus }).catch(err => {
            console.error("Error updating grade:", err);
            // Revert on error if needed
        });
    };

    const handleEditClick = (evaluacion: EvaluacionFormativa) => setEditingEval(evaluacion);
    const handleSaveEdit = async () => {
        if (!editingEval) return;
        try {
            await updateEvaluacion(editingEval.id, { nombreActividad: editingEval.nombreActividad, fecha: editingEval.fecha });
            setEditingEval(null);
        } catch (err) {
            console.error(err);
            setError("No se pudo guardar la edición.");
        }
    };
    const handleDelete = async (evaluacionId: string) => {
        if (window.confirm("¿Eliminar esta evaluación y todas sus calificaciones?")) {
            try {
                await deleteEvaluacion(evaluacionId);
            } catch (err) {
                console.error(err);
                setError("No se pudo eliminar la evaluación.");
            }
        }
    };

    const calcularPromedio = useCallback((nombreEstudiante: string) => {
        if (evaluaciones.length === 0) return '-';
        let suma = 0, count = 0;
        evaluaciones.forEach(ev => {
            const calificacion = calificaciones[ev.id]?.[nombreEstudiante];
            if (calificacion === 'trabajado') { suma += 7.0; count++; }
            else if (calificacion === 'no trabajado') { suma += 2.0; count++; }
        });
        if (count === 0) return '-';
        return (suma / count).toFixed(1);
    }, [calificaciones, evaluaciones]);
    
    if (loading) {
        return <div className="text-center py-10">Cargando calificaciones...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800">&larr; Volver a Asignaturas</button>
                <div className="bg-slate-100 p-2 rounded-md font-bold text-slate-800">
                    {curso} / {asignatura}
                </div>
            </div>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50">
                 <h3 className="text-lg font-semibold col-span-full text-slate-700 dark:text-slate-200">Crear Nueva Evaluación</h3>
                 <div className="w-full">
                     <label htmlFor="nombreActividad" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre Actividad</label>
                     <input id="nombreActividad" type="text" name="nombreActividad" value={formData.nombreActividad} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                 </div>
                 <div className="w-full">
                     <label htmlFor="fecha" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Fecha</label>
                     <input id="fecha" type="date" name="fecha" value={formData.fecha} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                 </div>
                 <div className="w-full"><button type="submit" className="w-full bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 h-10">Crear</button></div>
                 {error && <p className="text-red-500 text-sm col-span-full">{error}</p>}
            </form>
            
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                        <tr>
                            <th scope="col" className="sticky left-0 bg-slate-100 dark:bg-slate-800 px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase z-10 w-48">Estudiante</th>
                            {evaluaciones.map(ev => (
                                <th key={ev.id} scope="col" className="px-3 py-3 text-center text-xs font-medium text-slate-600 dark:text-slate-300 uppercase w-36">
                                    {editingEval?.id === ev.id ? (
                                        <div className="flex flex-col gap-1">
                                            <input type="text" name="nombreActividad" value={editingEval.nombreActividad} onChange={handleFieldChange} className="text-xs p-1 w-full dark:bg-slate-600"/>
                                            <input type="date" name="fecha" value={editingEval.fecha} onChange={handleFieldChange} className="text-xs p-1 w-full dark:bg-slate-600"/>
                                            <button onClick={handleSaveEdit} className="text-xs bg-green-200 text-green-800 rounded px-1">✓</button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center">
                                            <span className="font-semibold">{ev.nombreActividad}</span>
                                            <span className="font-normal text-slate-500">{ev.fecha}</span>
                                            <div className="flex gap-2 mt-1">
                                                <button onClick={() => handleEditClick(ev)} className="text-blue-500 hover:text-blue-700">✏️</button>
                                                <button onClick={() => handleDelete(ev.id)} className="text-red-500 hover:text-red-700">🗑️</button>
                                            </div>
                                        </div>
                                    )}
                                </th>
                            ))}
                            <th scope="col" className="sticky right-0 bg-slate-100 dark:bg-slate-800 px-4 py-3 text-center text-xs font-medium text-slate-600 dark:text-slate-300 uppercase z-10 w-24">Promedio</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                        {estudiantesDelCurso.map(nombre => (
                            <tr key={nombre}>
                                <td className="sticky left-0 bg-white dark:bg-slate-900 px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200 w-48">{nombre}</td>
                                {evaluaciones.map(ev => {
                                    const calificacion = calificaciones[ev.id]?.[nombre];
                                    const worked = calificacion === 'trabajado';
                                    return (
                                        <td key={ev.id} className="px-2 py-1 whitespace-nowrap w-36 text-center">
                                            <button onClick={() => handleCalificacionChange(ev.id, nombre)} className={`text-3xl transition-opacity duration-200 ${worked ? 'opacity-100' : 'opacity-20'}`}>
                                                {asignaturaEmojis[asignatura] || asignaturaEmojis['Default']}
                                            </button>
                                        </td>
                                    )
                                })}
                                <td className="sticky right-0 bg-white dark:bg-slate-900 px-4 py-2 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-200 w-24 text-center">{calcularPromedio(nombre)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const TrabajosGrupalesView: React.FC<{
    curso: string;
    asignatura: string;
    allUsers: User[];
    onBack: () => void;
}> = ({ curso, asignatura, allUsers, onBack }) => {
    const [trabajos, setTrabajos] = useState<TrabajoGrupal[]>([]);
    const [selectedTrabajo, setSelectedTrabajo] = useState<TrabajoGrupal | null>(null);
    const [newActivityData, setNewActivityData] = useState({ nombre: '', fecha: new Date().toISOString().split('T')[0] });
    const [groupAssignments, setGroupAssignments] = useState<Record<string, { groupNumber: string; role: string }>>({});
    const [numAutoGroups, setNumAutoGroups] = useState(2);
    
    const estudiantesDelCurso = useMemo(() => {
        return allUsers
            .filter(u => u.profile === Profile.ESTUDIANTE && normalizeCurso(u.curso || '') === curso)
            .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    }, [allUsers, curso]);

    useEffect(() => {
        const unsubscribe = subscribeToTrabajosGrupales(curso, asignatura, setTrabajos);
        return () => unsubscribe();
    }, [curso, asignatura]);
    
    useEffect(() => {
        if (selectedTrabajo) {
            const assignments: Record<string, { groupNumber: string; role: string }> = {};
            selectedTrabajo.grupos.forEach(grupo => {
                grupo.integrantes.forEach(integrante => {
                    assignments[integrante.nombre] = { groupNumber: String(grupo.numero), role: integrante.rol || '' };
                });
            });
            setGroupAssignments(assignments);
        } else {
            setGroupAssignments({});
        }
    }, [selectedTrabajo]);

    const handleCreateActivity = async (e: FormEvent) => {
        e.preventDefault();
        if (!newActivityData.nombre.trim()) return;
        const newTrabajo: Omit<TrabajoGrupal, 'id'> = {
            curso,
            asignatura,
            nombreActividad: newActivityData.nombre,
            fechaPresentacion: newActivityData.fecha,
            grupos: [],
        };
        try {
            await createTrabajoGrupal(newTrabajo);
            setNewActivityData({ nombre: '', fecha: new Date().toISOString().split('T')[0] });
        } catch (error) {
            console.error(error);
            alert("No se pudo crear la actividad grupal.");
        }
    };

    const handleSaveGroups = async () => {
        if (!selectedTrabajo) return;

        const groupsMap: Map<number, GrupoIntegrante[]> = new Map();
        
        for (const student of estudiantesDelCurso) {
            const assignment = groupAssignments[student.nombreCompleto];
            if (assignment && assignment.groupNumber) {
                const groupNum = parseInt(assignment.groupNumber, 10);
                if (!isNaN(groupNum)) {
                    if (!groupsMap.has(groupNum)) {
                        groupsMap.set(groupNum, []);
                    }
                    groupsMap.get(groupNum)!.push({ nombre: student.nombreCompleto, rol: assignment.role || '' });
                }
            }
        }
        
        const updatedGrupos = Array.from(groupsMap.entries())
            .map(([numero, integrantes]) => ({ numero, integrantes }))
            .sort((a,b) => a.numero - b.numero);

        try {
            await updateTrabajoGrupal(selectedTrabajo.id, { grupos: updatedGrupos });
            alert("Grupos guardados con éxito.");
        } catch (error) {
            console.error(error);
            alert("No se pudieron guardar los grupos.");
        }
    };

    const handleAutoAssign = () => {
        if (numAutoGroups < 2) {
            alert("Debe haber al menos 2 grupos.");
            return;
        }
        const shuffledStudents = [...estudiantesDelCurso].sort(() => Math.random() - 0.5);
        const newAssignments: Record<string, { groupNumber: string; role: string }> = {};
        shuffledStudents.forEach((student, index) => {
            newAssignments[student.nombreCompleto] = {
                groupNumber: String((index % numAutoGroups) + 1),
                role: groupAssignments[student.nombreCompleto]?.role || ''
            };
        });
        setGroupAssignments(newAssignments);
    };

    const handleAssignmentChange = (studentName: string, field: 'groupNumber' | 'role', value: string) => {
        setGroupAssignments(prev => ({
            ...prev,
            [studentName]: {
                ...(prev[studentName] || { groupNumber: '', role: '' }),
                [field]: value
            }
        }));
    };
    
    const gruposVisibles = useMemo(() => {
        const groupsMap: Map<string, {nombre: string, rol?: string}[]> = new Map();
        Object.entries(groupAssignments).forEach(([studentName, assignment]) => {
            if (assignment.groupNumber) {
                if (!groupsMap.has(assignment.groupNumber)) {
                    groupsMap.set(assignment.groupNumber, []);
                }
                groupsMap.get(assignment.groupNumber)!.push({ nombre: studentName, rol: assignment.role });
            }
        });
        return Array.from(groupsMap.entries()).sort((a,b) => parseInt(a[0]) - parseInt(b[0]));
    }, [groupAssignments]);

    if (!selectedTrabajo) {
        return (
            <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-500 hover:text-slate-800">&larr; Volver a Asignaturas</button>
                    <div className="bg-slate-100 p-2 rounded-md font-bold text-slate-800">
                        {curso} / {asignatura}
                    </div>
                </div>
                <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50">
                     <h3 className="text-lg font-semibold mb-2">Crear Actividad Grupal</h3>
                     <form onSubmit={handleCreateActivity} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                         <input value={newActivityData.nombre} onChange={e => setNewActivityData({...newActivityData, nombre: e.target.value})} placeholder="Nombre de la actividad" className="w-full border-slate-300 rounded-md" required/>
                         <input type="date" value={newActivityData.fecha} onChange={e => setNewActivityData({...newActivityData, fecha: e.target.value})} className="w-full border-slate-300 rounded-md" required/>
                         <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg">Crear</button>
                     </form>
                </div>
                 <div className="space-y-3">
                     <h3 className="text-lg font-semibold">Actividades Creadas</h3>
                     {trabajos.map(t => (
                         <button key={t.id} onClick={() => setSelectedTrabajo(t)} className="w-full text-left p-3 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-md border">
                             <p className="font-bold">{t.nombreActividad}</p>
                             <p className="text-sm text-slate-500">Fecha: {t.fechaPresentacion}</p>
                         </button>
                     ))}
                 </div>
            </div>
        );
    }
    
    return (
         <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <div>
                    <button onClick={() => setSelectedTrabajo(null)} className="text-sm font-semibold text-slate-500 hover:underline mb-2">&larr; Volver a Actividades</button>
                    <h2 className="text-2xl font-bold">{selectedTrabajo.nombreActividad}</h2>
                 </div>
                 <button onClick={handleSaveGroups} className="bg-amber-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-amber-600">Guardar Grupos</button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <div className="p-4 border rounded-lg bg-slate-50">
                        <h3 className="font-semibold mb-2">Auto-asignación</h3>
                        <div className="flex items-center gap-2">
                            <input type="number" value={numAutoGroups} onChange={e => setNumAutoGroups(parseInt(e.target.value, 10))} min="2" className="w-20 border-slate-300 rounded"/>
                            <button onClick={handleAutoAssign} className="flex-1 bg-slate-200 font-semibold py-2 px-3 rounded">Asignar</button>
                        </div>
                    </div>
                     <div className="p-4 border rounded-lg h-[60vh] overflow-y-auto">
                        <h3 className="font-semibold mb-2">Nómina del Curso</h3>
                         <table className="w-full text-sm">
                             <tbody>
                                 {estudiantesDelCurso.map(student => (
                                     <tr key={student.id}>
                                         <td className="py-1 pr-2">{student.nombreCompleto}</td>
                                         <td className="py-1">
                                             <input
                                                 type="number"
                                                 value={groupAssignments[student.nombreCompleto]?.groupNumber || ''}
                                                 onChange={e => handleAssignmentChange(student.nombreCompleto, 'groupNumber', e.target.value)}
                                                 className="w-16 p-1 border rounded text-center"
                                                 placeholder="N°"
                                             />
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                </div>
                <div className="md:col-span-2 p-4 border rounded-lg h-[70vh] overflow-y-auto">
                     <h3 className="font-semibold mb-2">Grupos Formados</h3>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {gruposVisibles.map(([groupNumber, integrantes]) => (
                            <div key={groupNumber} className="p-3 bg-slate-50 rounded-lg border">
                                <h4 className="font-bold border-b pb-1 mb-2">Grupo {groupNumber}</h4>
                                <ul className="space-y-2">
                                    {integrantes.map(integrante => (
                                        <li key={integrante.nombre} className="flex items-center gap-2 text-sm">
                                            <span className="flex-1 truncate">{integrante.nombre}</span>
                                            <select
                                                value={integrante.rol || ''}
                                                onChange={e => handleAssignmentChange(integrante.nombre, 'role', e.target.value)}
                                                className="p-1 border rounded text-xs w-32"
                                            >
                                                <option value="">-- Asignar Rol --</option>
                                                {ROLES_TRABAJO_GRUPAL.map(rol => <option key={rol} value={rol}>{rol}</option>)}
                                            </select>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                     </div>
                </div>
             </div>
         </div>
    );
};

const EvaluacionesFormativas: React.FC<EvaluacionesFormativasProps> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'calificaciones' | 'grupos'>('calificaciones');
    const [selectedCurso, setSelectedCurso] = useState<string | null>(null);
    const [selectedAsignatura, setSelectedAsignatura] = useState<string | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribeToAllUsers((users) => {
            setAllUsers(users);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const assignedCursos = useMemo(() => currentUser.cursos || [], [currentUser.cursos]);
    const assignedAsignaturas = useMemo(() => currentUser.asignaturas || [], [currentUser.asignaturas]);
    
    const TabButton: React.FC<{ tab: 'calificaciones' | 'grupos'; label: string; }> = ({ tab, label }) => (
         <button
            onClick={() => setActiveTab(tab)}
            className={`${
                activeTab === tab
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
            } whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
        >
            {label}
        </button>
    );

    const renderContent = () => {
        if (loading) {
            return <div className="text-center py-10">Cargando datos de usuario...</div>;
        }
        if (!selectedCurso) {
            return <ClassSelector cursos={assignedCursos} onSelect={setSelectedCurso} />;
        }
        if (!selectedAsignatura) {
            return <SubjectSelector curso={selectedCurso} asignaturas={assignedAsignaturas} onSelect={setSelectedAsignatura} onBack={() => setSelectedCurso(null)} />;
        }
        
        if(activeTab === 'calificaciones') {
            return <CalificacionesView curso={selectedCurso} asignatura={selectedAsignatura} allUsers={allUsers} onBack={() => setSelectedAsignatura(null)} />;
        }
        if(activeTab === 'grupos') {
            return <TrabajosGrupalesView curso={selectedCurso} asignatura={selectedAsignatura} allUsers={allUsers} onBack={() => setSelectedAsignatura(null)} />;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
             <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Evaluaciones Formativas</h1>
             <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <TabButton tab="calificaciones" label="Calificaciones" />
                    <TabButton tab="grupos" label="Trabajos Grupales" />
                </nav>
            </div>
            
            <div className="mt-6">
                {renderContent()}
            </div>
        </div>
    );
};

export default EvaluacionesFormativas;
