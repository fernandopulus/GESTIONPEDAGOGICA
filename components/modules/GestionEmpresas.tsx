// components/modules/GestionEmpresas.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Empresa, CalificacionItem, User, Profile } from '../../types';
import { 
    subscribeToEmpresas, 
    saveEmpresa, 
    deleteEmpresa,
    subscribeToEstudiantes 
} from '../../src/firebaseHelpers/empresasHelper';

// ✅ Elementos de evaluación extraídos de tu documento
const ELEMENTOS_A_EVALUAR: Omit<CalificacionItem, 'score'>[] = [
  { elemento: "Cumplimiento legal y formalidad" },
  { elemento: "Contrato o convenio formal de práctica" },
  { elemento: "Condiciones de higiene y seguridad laboral" },
  { elemento: "Seguro escolar vigente" },
  { elemento: "Coherencia entre tareas asignadas y especialidad TP" },
  { elemento: "Tutor laboral designado" },
  { elemento: "Evaluación formativa en contexto laboral" },
  { elemento: "Igualdad de oportunidades para mujeres y grupos prioritarios" },
  { elemento: "Apoyo a estudiantes con necesidades educativas especiales" },
  { elemento: "Condiciones adecuadas para el aprendizaje" },
  { elemento: "Acceso a tecnologías y herramientas relevantes" },
  { elemento: "Participación en redes de colaboración TP" },
  { elemento: "Existencia de mecanismos de feedback y mejora" },
  { elemento: "Clima laboral respetuoso y ético" },
  { elemento: "Bienestar físico y psicológico del estudiante" },
];

const getInitialFormData = (): Omit<Empresa, 'id' | 'createdAt'> => ({
    nombre: '',
    rut: '',
    direccion: '',
    contacto: '',
    cupos: 1,
    calificaciones: ELEMENTOS_A_EVALUAR.map(item => ({ ...item, score: null })),
    estudiantesAsignados: [],
});

const GestionEmpresas: React.FC = () => {
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [estudiantes, setEstudiantes] = useState<User[]>([]);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [currentEmpresa, setCurrentEmpresa] = useState<Omit<Empresa, 'id' | 'createdAt'> | Empresa | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubEmpresas = subscribeToEmpresas(setEmpresas);
        const unsubEstudiantes = subscribeToEstudiantes((data) => {
            setEstudiantes(data);
            setLoading(false);
        });
        return () => {
            unsubEmpresas();
            unsubEstudiantes();
        };
    }, []);

    const handleSave = async () => {
        if (!currentEmpresa) return;
        try {
            await saveEmpresa(currentEmpresa);
            setView('list');
            setCurrentEmpresa(null);
        } catch (error) {
            console.error("Error al guardar la empresa:", error);
            alert("No se pudo guardar la empresa.");
        }
    };
    
    const handleDelete = async (empresaId: string) => {
        if (window.confirm("¿Está seguro de eliminar esta empresa? Se desasignarán los estudiantes.")) {
            await deleteEmpresa(empresaId);
        }
    };
    
    const handleFormChange = (field: keyof Empresa, value: any) => {
        setCurrentEmpresa(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleCalificacionChange = (elemento: string, score: 1 | 2 | 3) => {
        if (!currentEmpresa) return;
        const newCalificaciones = currentEmpresa.calificaciones.map(item => 
            item.elemento === elemento ? { ...item, score } : item
        );
        handleFormChange('calificaciones', newCalificaciones);
    };

    const handleAssignStudent = (studentId: string) => {
        if (!currentEmpresa || currentEmpresa.estudiantesAsignados.length >= currentEmpresa.cupos) return;
        const newAssigned = [...currentEmpresa.estudiantesAsignados, studentId];
        handleFormChange('estudiantesAsignados', newAssigned);
    };

    const handleUnassignStudent = (studentId: string) => {
        if (!currentEmpresa) return;
        const newAssigned = currentEmpresa.estudiantesAsignados.filter(id => id !== studentId);
        handleFormChange('estudiantesAsignados', newAssigned);
    };

    const availableStudents = useMemo(() => {
        if (!currentEmpresa) return [];
        return estudiantes.filter(e => !currentEmpresa.estudiantesAsignados.includes(e.id));
    }, [estudiantes, currentEmpresa]);

    if (loading) {
        return <div className="text-center p-8">Cargando gestión de empresas...</div>;
    }

    if (view === 'form' && currentEmpresa) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">{ 'id' in currentEmpresa ? 'Editando Empresa' : 'Nueva Empresa'}</h2>
                    <button onClick={() => setView('list')} className="font-semibold">&larr; Volver</button>
                </div>
                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input value={currentEmpresa.nombre} onChange={e => handleFormChange('nombre', e.target.value)} placeholder="Nombre Empresa" className="input-style" />
                    <input value={currentEmpresa.rut} onChange={e => handleFormChange('rut', e.target.value)} placeholder="RUT Empresa" className="input-style" />
                    <input value={currentEmpresa.direccion} onChange={e => handleFormChange('direccion', e.target.value)} placeholder="Dirección" className="input-style" />
                    <input value={currentEmpresa.contacto} onChange={e => handleFormChange('contacto', e.target.value)} placeholder="Contacto (Nombre, Email, Teléfono)" className="input-style" />
                </div>
                {/* Calificaciones */}
                <div>
                    <h3 className="font-bold text-lg mb-2">Calificación de la Empresa</h3>
                    <div className="space-y-2">
                        {currentEmpresa.calificaciones.map(({ elemento, score }) => (
                            <div key={elemento} className="grid grid-cols-4 items-center gap-2 text-sm p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                                <span className="col-span-2 md:col-span-1">{elemento}</span>
                                <div className="col-span-2 md:col-span-3 flex justify-around">
                                    {[1, 2, 3].map(val => (
                                        <button key={val} onClick={() => handleCalificacionChange(elemento, val as 1 | 2 | 3)} 
                                            className={`px-3 py-1 rounded-full text-xs font-semibold ${score === val ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-600'}`}>
                                            {val === 1 ? 'Insatisfactorio' : val === 2 ? 'Regular' : 'Óptimo'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Cupos y Asignación */}
                <div>
                    <h3 className="font-bold text-lg mb-2">Cupos y Asignación de Estudiantes</h3>
                    <label>Cantidad de cupos (1-20):</label>
                    <input type="number" min="1" max="20" value={currentEmpresa.cupos} onChange={e => handleFormChange('cupos', parseInt(e.target.value, 10))} className="input-style w-24 ml-2" />
                    <div className="mt-4">
                        <h4 className="font-semibold">Estudiantes Asignados ({currentEmpresa.estudiantesAsignados.length}/{currentEmpresa.cupos})</h4>
                        <ul className="list-disc pl-5 my-2">
                            {currentEmpresa.estudiantesAsignados.map(id => {
                                const student = estudiantes.find(e => e.id === id);
                                return <li key={id}>{student?.nombreCompleto} <button onClick={() => handleUnassignStudent(id)} className="text-red-500 ml-2">Quitar</button></li>
                            })}
                        </ul>
                        {currentEmpresa.estudiantesAsignados.length < currentEmpresa.cupos && (
                            <select onChange={e => handleAssignStudent(e.target.value)} value="" className="input-style">
                                <option value="" disabled>Asignar estudiante...</option>
                                {availableStudents.map(s => <option key={s.id} value={s.id}>{s.nombreCompleto}</option>)}
                            </select>
                        )}
                    </div>
                </div>
                <button onClick={handleSave} className="w-full bg-amber-500 text-white font-bold py-2 rounded-lg">Guardar Empresa</button>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">Gestión de Empresas para Prácticas TP</h1>
                <button onClick={() => { setCurrentEmpresa(getInitialFormData()); setView('form'); }} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg">Crear Nueva Empresa</button>
            </div>
            <div className="space-y-3">
                {empresas.map(empresa => (
                    <div key={empresa.id} className="p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg">{empresa.nombre}</h3>
                                <p className="text-sm text-slate-500">{empresa.rut} | {empresa.direccion}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <p className="font-bold text-xl">{empresa.puntajeTotal || 0} / {ELEMENTOS_A_EVALUAR.length * 3}</p>
                                    <p className="text-xs text-slate-500">Puntaje</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-xl">{empresa.estudiantesAsignados.length} / {empresa.cupos}</p>
                                    <p className="text-xs text-slate-500">Cupos</p>
                                </div>
                                <button onClick={() => { setCurrentEmpresa(JSON.parse(JSON.stringify(empresa))); setView('form'); }} className="text-sm font-semibold">Editar</button>
                                <button onClick={() => handleDelete(empresa.id)} className="text-sm text-red-500">Eliminar</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GestionEmpresas;
