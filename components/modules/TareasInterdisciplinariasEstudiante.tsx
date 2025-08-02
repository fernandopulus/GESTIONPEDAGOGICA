import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, PlanificacionInterdisciplinaria, EntregaTareaInterdisciplinaria, TareaInterdisciplinaria } from '../../types';
import {
    subscribeToMisProyectos,
    subscribeToMisEntregas,
    updateEntrega
} from '../../src/firebaseHelpers/tareasInterdisciplinariasHelper'; // AJUSTA la ruta a tu nuevo helper

interface TareasInterdisciplinariasEstudianteProps {
    currentUser: User;
}

const TareasInterdisciplinariasEstudiante: React.FC<TareasInterdisciplinariasEstudianteProps> = ({ currentUser }) => {
    const [planificaciones, setPlanificaciones] = useState<PlanificacionInterdisciplinaria[]>([]);
    const [entregas, setEntregas] = useState<EntregaTareaInterdisciplinaria[]>([]);
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser.curso || !currentUser.id) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const unsubProyectos = subscribeToMisProyectos(currentUser.curso, setPlanificaciones);
        const unsubEntregas = subscribeToMisEntregas(currentUser.id, (data) => {
            setEntregas(data);
            setLoading(false);
        });

        return () => {
            unsubProyectos();
            unsubEntregas();
        };
    }, [currentUser.curso, currentUser.id]);

    const handleUpdateEntrega = async (updatedEntrega: EntregaTareaInterdisciplinaria) => {
        try {
            await updateEntrega(updatedEntrega);
        } catch (error) {
            console.error("Failed to update submission:", error);
            alert("Hubo un error al guardar tu entrega.");
        }
    };
    
    const TareaItem: React.FC<{ plan: PlanificacionInterdisciplinaria, tarea: TareaInterdisciplinaria }> = ({ plan, tarea }) => {
        const entrega = useMemo(() => {
            const existingEntrega = entregas.find(e => e.planificacionId === plan.id && e.tareaId === tarea.id);
            if (existingEntrega) return existingEntrega;
            
            return {
                id: `${plan.id}_${tarea.id}_${currentUser.id}`, // ID predecible
                planificacionId: plan.id,
                tareaId: tarea.id,
                estudianteId: currentUser.id,
                estudianteNombre: currentUser.nombreCompleto,
                completada: false,
            };
        }, [plan.id, tarea.id, entregas]);

        const [showEntrega, setShowEntrega] = useState(false);
        const [formData, setFormData] = useState({
            observaciones: entrega.observacionesEstudiante || '',
            enlace: entrega.enlaceUrl || '',
        });

        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                // ADVERTENCIA: La subida de archivos a Firebase Storage es más compleja
                // y requiere configuración adicional. Esto es una simulación.
                alert(`Simulación: Archivo "${file.name}" listo para subir.`);
                handleUpdateEntrega({
                    ...entrega,
                    archivoAdjunto: {
                        nombre: file.name,
                        url: `simulated/path/${file.name}`,
                    },
                    fechaCompletado: new Date().toISOString(),
                });
            }
        };

        const handleSaveTextChanges = () => {
            handleUpdateEntrega({
                ...entrega,
                observacionesEstudiante: formData.observaciones,
                enlaceUrl: formData.enlace,
                fechaCompletado: new Date().toISOString(),
            });
        };

        const handleToggleComplete = () => {
             handleUpdateEntrega({
                ...entrega,
                completada: !entrega.completada,
                fechaCompletado: new Date().toISOString(),
            });
        };
        
        return (
            <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                <div className="flex items-start gap-3">
                    <input type="checkbox" checked={entrega.completada} onChange={handleToggleComplete} className="mt-1 h-5 w-5 rounded text-amber-500 focus:ring-amber-400"/>
                    <div className="flex-1">
                        <p className={`font-semibold ${entrega.completada ? 'line-through text-slate-500' : 'text-slate-800'}`}>Tarea {tarea.numero}: {tarea.instrucciones}</p>
                        <p className="text-xs text-slate-500">Fecha de entrega: {tarea.fechaEntrega}</p>
                        {tarea.recursoUrl && <a href={tarea.recursoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Ver Recurso</a>}
                    </div>
                    <button onClick={() => setShowEntrega(!showEntrega)} className="text-sm font-semibold">{showEntrega ? 'Ocultar' : 'Entregar'}</button>
                </div>
                {showEntrega && (
                    <div className="mt-3 pt-3 pl-8 border-t dark:border-slate-600 space-y-3 animate-fade-in-up">
                        <textarea value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} onBlur={handleSaveTextChanges} placeholder="Añadir observaciones o comentarios..." rows={2} className="w-full text-sm p-1 border rounded"/>
                        <input type="url" value={formData.enlace} onChange={e => setFormData({...formData, enlace: e.target.value})} onBlur={handleSaveTextChanges} placeholder="Pegar un enlace (ej: Google Docs, video)..." className="w-full text-sm p-1 border rounded"/>
                        <input type="file" onChange={handleFileChange} className="text-sm"/>
                        {entrega.archivoAdjunto && <p className="text-xs text-green-600">✓ Archivo subido: {entrega.archivoAdjunto.nombre}</p>}
                    </div>
                )}
                {entrega.feedbackProfesor && (
                    <div className="mt-3 pt-3 pl-8 border-t border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Retroalimentación del profesor:</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{entrega.feedbackProfesor}</p>
                    </div>
                )}
            </div>
        )
    };
    
    if (loading) {
        return <div className="text-center py-10">Cargando tus proyectos...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Mis Tareas Interdisciplinarias</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Revisa y completa las tareas de tus proyectos.</p>
            </div>
            {planificaciones.length > 0 ? (
                planificaciones.map(plan => {
                    const tareas = plan.tareas || [];
                    const entregasDelProyecto = entregas.filter(e => e.planificacionId === plan.id);
                    const completadas = entregasDelProyecto.filter(e => e.completada).length;
                    const progreso = tareas.length > 0 ? (completadas / tareas.length) * 100 : 0;

                    return (
                        <div key={plan.id} className="bg-white p-6 rounded-xl shadow-md">
                            <button onClick={() => setExpandedProjectId(expandedProjectId === plan.id ? null : plan.id)} className="w-full text-left">
                                <h2 className="text-2xl font-bold text-slate-800">{plan.nombreProyecto}</h2>
                                <div className="mt-2 space-y-1">
                                    <div className="flex justify-between text-sm font-medium text-slate-500">
                                        <span>Progreso</span>
                                        <span>{Math.round(progreso)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                                        <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${progreso}%` }}></div>
                                    </div>
                                </div>
                            </button>
                            {expandedProjectId === plan.id && (
                                <div className="mt-4 pt-4 border-t space-y-3">
                                    {tareas.length > 0 ? (
                                        tareas.map(tarea => <TareaItem key={tarea.id} plan={plan} tarea={tarea} />)
                                    ) : <p className="text-slate-500 text-center">Este proyecto aún no tiene tareas asignadas.</p>}
                                </div>
                            )}
                        </div>
                    )
                })
            ) : (
                <div className="text-center py-16 bg-white rounded-xl shadow-md">
                    <span className="text-5xl">🎉</span>
                    <h2 className="mt-4 text-xl font-bold text-slate-700">¡Todo al día!</h2>
                    <p className="text-slate-500 mt-2">No tienes tareas de proyectos interdisciplinarios asignadas por el momento.</p>
                </div>
            )}
        </div>
    );
};

export default TareasInterdisciplinariasEstudiante;
