import React, { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import { AsignacionHorario, HorariosGenerados, HorarioCelda, User, Profile } from '../../types';
import { MatrizAsignaciones } from './MatrizAsignaciones';
import { CURSOS, ASIGNATURAS, DIAS_SEMANA, HORARIO_BLOQUES, BLOCK_ALLOCATION_RULES } from '../../constants';
// ✅ IA: Importar la librería de Google Generative AI
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    subscribeToAsignaciones,
    addAsignacion,
    deleteAsignacion,
    saveHorarios,
    subscribeToHorarios,
    subscribeToProfesores,
} from '../../src/firebaseHelpers/horariosHelper';

const HorarioGlobal: React.FC<{ horarios: HorariosGenerados }> = ({ horarios }) => {
    if (Object.keys(horarios).length === 0) {
        return (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-slate-500 dark:text-slate-400">Aún no se ha generado ningún horario. Utilice la pestaña de "Configuración" para generar uno.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded-lg">
            <table className="min-w-full border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0 z-10">
                    <tr>
                        <th className="border-b border-r border-slate-300 dark:border-slate-600 p-1 font-semibold text-slate-600 dark:text-slate-300 text-xs w-16">BLOQUE</th>
                        <th className="border-b border-r border-slate-300 dark:border-slate-600 p-1 font-semibold text-slate-600 dark:text-slate-300 text-xs w-24">HORARIO</th>
                        {CURSOS.map(curso => (
                            <th key={curso} className="border-b border-r border-slate-300 dark:border-slate-600 p-1 font-semibold text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap min-w-[120px]">
                                {curso}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {DIAS_SEMANA.map(dia => (
                        <React.Fragment key={dia}>
                            <tr className="bg-slate-200 dark:bg-slate-800">
                                <th colSpan={2 + CURSOS.length} className="text-center font-bold text-slate-700 dark:text-slate-200 p-2 border-b border-slate-300 dark:border-slate-600">
                                    {dia.toUpperCase()}
                                </th>
                            </tr>
                            {HORARIO_BLOQUES.map(({ bloque, inicio, fin }) => (
                                <tr key={`${dia}-${bloque}`} className="even:bg-white odd:bg-slate-50 dark:even:bg-slate-800/50 dark:odd:bg-slate-900/50">
                                    <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center font-bold text-slate-700 dark:text-slate-300 text-sm">{bloque}</td>
                                    <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center text-xs text-slate-500 dark:text-slate-400">{`${inicio} - ${fin}`}</td>
                                    {CURSOS.map(curso => {
                                        const celda = horarios[curso]?.[dia]?.[bloque];
                                        return (
                                            <td key={`${curso}-${dia}-${bloque}`} className="border-r border-slate-300 dark:border-slate-700 p-1 text-center h-16">
                                                {celda?.asignatura ? (
                                                    <div className="flex flex-col justify-center h-full">
                                                        <p className="font-semibold text-[11px] leading-tight text-slate-800 dark:text-slate-200 whitespace-normal">{celda.asignatura}</p>
                                                        <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400 whitespace-normal mt-0.5">({celda.profesor})</p>
                                                    </div>
                                                ) : <span className="text-slate-300 dark:text-slate-600 text-xs">Libre</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const CrearHorarios: React.FC = () => {
    const [asignaciones, setAsignaciones] = useState<AsignacionHorario[]>([]);
    const [newAsignacion, setNewAsignacion] = useState({ curso: '', asignatura: '', profesor: '' });
    const [profesores, setProfesores] = useState<string[]>([]);
    
    const [horarios, setHorarios] = useState<HorariosGenerados>({});
    const [selectedCurso, setSelectedCurso] = useState<string>(CURSOS[0]);

    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [editingCell, setEditingCell] = useState<{ dia: string; bloque: number } | null>(null);
    const [editValue, setEditValue] = useState({ asignatura: '', profesor: '' });

    const [activeTab, setActiveTab] = useState<'edicion' | 'global'>('edicion');
    const [aiInstructions, setAiInstructions] = useState<string>('');

    useEffect(() => {
        setDataLoading(true);
        const unsubAsignaciones = subscribeToAsignaciones(setAsignaciones);
        const unsubHorarios = subscribeToHorarios(setHorarios);
        
        const unsubProfesores = subscribeToProfesores((users) => {
            const teacherNames = users.map(user => user.nombreCompleto).sort();
            setProfesores(teacherNames);
            setDataLoading(false);
        });

        return () => {
            unsubAsignaciones();
            unsubHorarios();
            unsubProfesores();
        };
    }, []);

    const handleAddAsignacion = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!newAsignacion.curso || !newAsignacion.asignatura || !newAsignacion.profesor) {
            setError("Todos los campos de la asignación son obligatorios.");
            return;
        }
        try {
            await addAsignacion({ 
                curso: newAsignacion.curso, 
                asignatura: newAsignacion.asignatura, 
                profesor: newAsignacion.profesor 
            });
            setNewAsignacion({ curso: '', asignatura: '', profesor: '' });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al guardar la asignación.");
        }
    };

    const handleDeleteAsignacion = async (id: string) => {
        try {
            await deleteAsignacion(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al eliminar la asignación.");
        }
    };

    // ✅ IA: Función de generación de horarios completamente corregida y funcional
    const handleGenerateHorario = async () => {
        if (asignaciones.length === 0) {
            setError("Debe agregar al menos una asignación de profesor antes de generar el horario.");
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                setError("La API Key de Gemini no está configurada en el entorno.");
                setLoading(false);
                return;
            }
            
            const ai = new GoogleGenerativeAI(apiKey);
            
            const prompt = `
                Eres un asistente experto en planificación de horarios escolares para un liceo técnico en Chile. 
                Tu tarea es generar un horario semanal completo (Lunes a Viernes) para todos los cursos proporcionados, siguiendo un conjunto estricto de reglas.

                **Contexto:**
                - Días de la semana: ${DIAS_SEMANA.join(', ')}
                - Bloques horarios por día: 10 bloques con los siguientes horarios: ${JSON.stringify(HORARIO_BLOQUES, null, 2)}
                - Cursos del liceo: ${CURSOS.join(', ')}

                **Contexto Adicional de Especialidades (3º y 4º Medio):**
                - Los cursos que terminan en 'A' y 'B' pertenecen a la especialidad 'Mecánica Automotriz'.
                - Los cursos que terminan en 'C' y 'D' pertenecen a la especialidad 'Mecánica Industrial'.
                Utiliza este contexto para aplicar las reglas de "3°/4° Medio Automotriz" y "3°/4° Medio Industrial" correctamente.

                **Reglas de Asignación de Bloques por Asignatura:**
                Debes asignar la siguiente cantidad de bloques semanales para cada asignatura según el nivel del curso:
                ${JSON.stringify(BLOCK_ALLOCATION_RULES, null, 2)}
                Notas sobre las reglas:
                - '1º y 2º medio' aplica a cursos que empiezan con '1º' o '2º'.
                - '3º y 4º medio' aplica a cursos que empiezan con '3º' o '4º'.
                - Algunas reglas aplican a cursos específicos (ej. Mecánica).

                **Asignaciones de Profesores (Input):**
                Aquí está la lista de profesores asignados a cada curso y asignatura. Debes usar esta lista para poblar el horario.
                ${JSON.stringify(asignaciones, null, 2)}

                **REGLA CRÍTICA INVIOLABLE:**
                La restricción más importante que NUNCA debe romperse es que un mismo profesor no puede ser asignado a dos cursos diferentes en el mismo día y mismo bloque horario. Es físicamente imposible para un profesor estar en dos lugares a la vez. Prioriza esta regla sobre todas las demás. No deben existir topes de horario para ningún profesor.

                **Instrucciones Adicionales del Usuario:**
                Considera las siguientes preferencias al organizar el horario: "${aiInstructions || 'No se proporcionaron instrucciones adicionales.'}"

                **Objetivo Adicional:**
                Distribuye las asignaturas de la forma más balanceada posible durante la semana para cada curso. Evita agrupar todas las horas de una misma materia en un solo día si es posible, a menos que las instrucciones del usuario indiquen lo contrario.

                **Formato de Salida (Output):**
                Tu respuesta DEBE ser un único objeto JSON válido, sin texto adicional, explicaciones, ni el bloque \`\`\`json. La estructura del JSON debe ser la siguiente:
                {
                  "1ºA": {
                    "Lunes": { "1": { "asignatura": "Matemática", "profesor": "Nombre Profesor" }, "2": { "asignatura": "Matemática", "profesor": "Nombre Profesor" } },
                    "Martes": { ... },
                    ...
                  },
                  "1ºB": { ... }
                }
                Cada clave de primer nivel es un curso. Cada curso tiene claves para cada día de la semana. Cada día tiene claves para cada bloque del 1 al 10. Si un bloque está vacío, usa \`{ "asignatura": null, "profesor": null }\`.
            `;
            
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
            const generatedData = JSON.parse(cleanedText);
            
            await saveHorarios(generatedData);
            setSuccess("¡Horario generado y guardado con éxito!");

        } catch (e) {
            console.error("Error al generar horario con IA:", e);
            setError("Ocurrió un error al contactar con la IA o al procesar la respuesta. Revisa la consola para más detalles.");
        } finally {
            setLoading(false);
        }
    };

    const handleCellClick = (dia: string, bloque: number, celda: HorarioCelda | undefined) => {
        setEditingCell({ dia, bloque });
        setEditValue({ 
            asignatura: celda?.asignatura || '', 
            profesor: celda?.profesor || '' 
        });
    };
    
    const handleSaveEdit = async () => {
        if (!editingCell) return;
        const { dia, bloque } = editingCell;
        
        const updatedHorarios = JSON.parse(JSON.stringify(horarios));
        if (!updatedHorarios[selectedCurso]) updatedHorarios[selectedCurso] = {};
        if (!updatedHorarios[selectedCurso][dia]) updatedHorarios[selectedCurso][dia] = {};
        
        updatedHorarios[selectedCurso][dia][bloque] = {
            asignatura: editValue.asignatura || null,
            profesor: editValue.profesor || null,
        };

        try {
            await saveHorarios(updatedHorarios);
            setEditingCell(null);
        } catch(err) {
            setError(err instanceof Error ? err.message : "Error al guardar la edición.");
        }
    };
    
    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";


    const renderEditorTable = () => {
        const horarioCurso = horarios[selectedCurso] || {};
        return (
             <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-slate-300 dark:border-slate-700">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-700">
                            <th className="border border-slate-300 dark:border-slate-600 p-2 font-semibold text-slate-600 dark:text-slate-300">Bloque</th>
                            {DIAS_SEMANA.map(dia => <th key={dia} className="border border-slate-300 dark:border-slate-600 p-2 font-semibold text-slate-600 dark:text-slate-300">{dia}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {HORARIO_BLOQUES.map(({ bloque, inicio, fin }) => (
                            <tr key={bloque} className="text-center dark:bg-slate-800">
                                <td className="border border-slate-300 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-700/50">
                                    <p className="font-bold text-slate-700 dark:text-slate-300">{bloque}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{`${inicio} - ${fin}`}</p>
                                </td>
                                {DIAS_SEMANA.map(dia => {
                                    const isEditing = editingCell?.dia === dia && editingCell?.bloque === bloque;
                                    const celda = horarioCurso[dia]?.[bloque];
                                    return (
                                        <td key={`${dia}-${bloque}`} className="border border-slate-300 dark:border-slate-700 p-1 h-24 relative hover:bg-amber-50 dark:hover:bg-slate-700 cursor-pointer" onClick={() => !isEditing && handleCellClick(dia, bloque, celda)}>
                                            {isEditing ? (
                                                <div className="flex flex-col p-1 bg-white dark:bg-slate-800 h-full justify-center">
                                                    <input type="text" placeholder="Asignatura" value={editValue.asignatura} onChange={e => setEditValue(p => ({...p, asignatura: e.target.value}))} className={inputStyles + " text-xs mb-1"}/>
                                                    <input type="text" placeholder="Profesor" value={editValue.profesor} onChange={e => setEditValue(p => ({...p, profesor: e.target.value}))} className={inputStyles + " text-xs"}/>
                                                    <div className="flex justify-end mt-1 space-x-1">
                                                        <button onClick={() => setEditingCell(null)} className="text-xs bg-slate-200 dark:bg-slate-600 px-1 rounded">Cancelar</button>
                                                        <button onClick={handleSaveEdit} className="text-xs bg-amber-500 text-white px-1 rounded">Guardar</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                celda?.asignatura ? (
                                                    <div>
                                                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{celda.asignatura}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">({celda.profesor})</p>
                                                    </div>
                                                ) : <span className="text-slate-400 dark:text-slate-500">Libre</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };
    
    const renderEditionView = () => (
         <div className="space-y-8">
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Crear Horarios</h1>
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 border-b dark:border-slate-600 pb-2 mb-4">🔧 1. Configuración de Asignaciones</h2>
                <form onSubmit={handleAddAsignacion} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6">
                    <div>
                        <label htmlFor="curso" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Curso</label>
                        <select name="curso" value={newAsignacion.curso} onChange={e => setNewAsignacion(p => ({...p, curso: e.target.value}))} className={inputStyles}>
                            <option value="">Seleccione</option>
                            {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="asignatura" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
                        <select name="asignatura" value={newAsignacion.asignatura} onChange={e => setNewAsignacion(p => ({...p, asignatura: e.target.value}))} className={inputStyles}>
                            <option value="">Seleccione</option>
                            {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="profesor" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Profesor</label>
                        <select name="profesor" value={newAsignacion.profesor} onChange={e => setNewAsignacion(p => ({...p, profesor: e.target.value}))} className={inputStyles}>
                            <option value="">Seleccione</option>
                            {profesores.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600 h-10">Agregar</button>
                </form>
                <MatrizAsignaciones 
                    asignaciones={asignaciones}
                    onDeleteAsignacion={handleDeleteAsignacion}
                    profesores={profesores}
                    onAddAsignacion={async (asignacion) => {
                        try {
                            await addAsignacion(asignacion);
                        } catch (err) {
                            setError(err instanceof Error ? err.message : "Error al guardar la asignación.");
                        }
                    }}
                />
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 border-b dark:border-slate-600 pb-2 mb-4">🧠 2. Generación Automática con IA</h2>
                <div className="mb-4">
                    <label htmlFor="aiInstructions" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Instrucciones para la IA (Opcional)</label>
                    <textarea
                        id="aiInstructions"
                        name="aiInstructions"
                        value={aiInstructions}
                        onChange={e => setAiInstructions(e.target.value)}
                        rows={3}
                        placeholder="Ej: Dejar los módulos teóricos en la mañana y los prácticos en la tarde. Evitar poner 2 bloques de matemática seguidos."
                        className={inputStyles}
                    />
                </div>
                <div className="flex items-center space-x-4">
                     <button onClick={handleGenerateHorario} disabled={loading} className="bg-amber-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-600 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center">
                        {loading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {loading ? 'Generando...' : 'Generar Horario Completo'}
                    </button>
                    {error && <p className="text-red-600">{error}</p>}
                    {success && <p className="text-green-600">{success}</p>}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 border-b dark:border-slate-600 pb-2 mb-4">📅 3. Visualización y Edición por Curso</h2>
                <div className="mb-4">
                    <label htmlFor="selectCurso" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Seleccione un curso para visualizar y editar:</label>
                    <select id="selectCurso" value={selectedCurso} onChange={e => setSelectedCurso(e.target.value)} className={inputStyles + " md:w-1/3"}>
                        {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                {Object.keys(horarios).length > 0 ? renderEditorTable() : (
                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <p className="text-slate-500 dark:text-slate-400">Aún no se ha generado ningún horario. Utilice el botón de generación con IA.</p>
                    </div>
                )}
            </div>
        </div>
    );

    if (dataLoading) {
        return <div className="text-center py-10">Cargando datos...</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in">
             <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('edicion')}
                        className={`${
                            activeTab === 'edicion'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
                    >
                        Configuración y Edición por Curso
                    </button>
                    <button
                        onClick={() => setActiveTab('global')}
                         className={`${
                            activeTab === 'global'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
                    >
                        Horario Global
                    </button>
                </nav>
            </div>
            
            {activeTab === 'edicion' ? (
                renderEditionView()
            ) : (
                <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                   <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Horario Global de Cursos</h1>
                   <p className="text-slate-500 dark:text-slate-400 mb-6">Vista consolidada de todos los horarios generados. La tabla es desplazable horizontalmente.</p>
                   <HorarioGlobal horarios={horarios} />
                </div>
            )}
        </div>
    );
};

export default CrearHorarios;