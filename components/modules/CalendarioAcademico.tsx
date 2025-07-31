import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { Profile, CalendarEvent, EventType, EvaluacionSubtype, EvaluacionEvent, ActoEvent, ActividadFocalizadaEvent, SalidaPedagogicaEvent } from '../../types';
import { EVENT_TYPE_CONFIG, EVALUACION_SUBTYPES, ASIGNATURAS, CURSOS } from '../../constants';

const CALENDAR_KEY = 'eventosCalendario';
const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const getEventTitle = (event: CalendarEvent): string => {
    switch (event.type) {
        case EventType.EVALUACION:
            return `${event.subtype} - ${event.asignatura}`;
        case EventType.ACTO:
            return `Acto: ${event.ubicacion}`;
        case EventType.ACTIVIDAD_FOCALIZADA:
            return `Actividad Focalizada`;
        case EventType.SALIDA_PEDAGOGICA:
            return `Salida: ${event.ubicacion}`;
        default:
            return 'Evento';
    }
};

const EventModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (eventData: Omit<CalendarEvent, 'id'>) => void;
    onDelete?: () => void;
    event?: CalendarEvent | null;
    date: string;
}> = ({ isOpen, onClose, onSave, onDelete, event, date }) => {
    const [formState, setFormState] = useState<Partial<CalendarEvent>>({});

    useEffect(() => {
        if (event) {
            setFormState(event);
        } else {
            // Default new event state
            setFormState({
                type: EventType.EVALUACION,
                subtype: EvaluacionSubtype.PRUEBA_PARCIAL,
                asignatura: ASIGNATURAS[0],
                curso: CURSOS[0],
                contenidos: '',
                enlace: '',
                responsables: '',
                ubicacion: '',
                horario: '',
                responsable: '',
                cursos: [],
            } as Partial<CalendarEvent>);
        }
    }, [event]);
    
    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";


    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({...prev, [name]: value}));
    };

    const handleCursoMultiSelect = (curso: string) => {
        setFormState(prev => {
            if (prev.type === EventType.SALIDA_PEDAGOGICA) {
                const currentCursos = prev.cursos || [];
                const newCursos = currentCursos.includes(curso)
                    ? currentCursos.filter(c => c !== curso)
                    : [...currentCursos, curso];
                return { ...prev, cursos: newCursos.sort() };
            }
            return prev;
        });
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        
        switch (formState.type) {
            case EventType.EVALUACION:
                onSave({
                    date,
                    type: EventType.EVALUACION,
                    subtype: formState.subtype!,
                    asignatura: formState.asignatura!,
                    curso: formState.curso!,
                    contenidos: formState.contenidos!,
                    enlace: (formState.subtype === EvaluacionSubtype.RUBRICA || formState.subtype === EvaluacionSubtype.PAUTA_COTEJO) ? formState.enlace : undefined,
                } as Omit<EvaluacionEvent, 'id'>);
                break;
            case EventType.ACTO:
                onSave({
                    date,
                    type: EventType.ACTO,
                    responsables: formState.responsables!,
                    ubicacion: formState.ubicacion!,
                    horario: formState.horario!,
                } as Omit<ActoEvent, 'id'>);
                break;
            case EventType.ACTIVIDAD_FOCALIZADA:
                onSave({
                    date,
                    type: EventType.ACTIVIDAD_FOCALIZADA,
                    responsables: formState.responsables!,
                    ubicacion: formState.ubicacion!,
                    horario: formState.horario!,
                } as Omit<ActividadFocalizadaEvent, 'id'>);
                break;
            case EventType.SALIDA_PEDAGOGICA:
                onSave({
                    date,
                    type: EventType.SALIDA_PEDAGOGICA,
                    responsable: formState.responsable!,
                    ubicacion: formState.ubicacion!,
                    cursos: formState.cursos!,
                } as Omit<SalidaPedagogicaEvent, 'id'>);
                break;
            default:
                // Should not happen
                break;
        }
        onClose();
    };

    if (!isOpen) return null;

    const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('es-CL', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const renderDynamicFields = () => {
        switch (formState.type) {
            case EventType.EVALUACION:
                return (
                    <>
                        <div>
                            <label htmlFor="subtype" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Subtipo</label>
                            <select id="subtype" name="subtype" value={formState.subtype} onChange={handleChange} required className={inputStyles}>
                                {EVALUACION_SUBTYPES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="asignatura" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
                            <select id="asignatura" name="asignatura" value={formState.asignatura} onChange={handleChange} required className={inputStyles}>
                                {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="curso" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Curso</label>
                            <select id="curso" name="curso" value={formState.curso} onChange={handleChange} required className={inputStyles}>
                                {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="contenidos" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Contenidos</label>
                            <textarea id="contenidos" name="contenidos" value={formState.contenidos} onChange={handleChange} required rows={3} className={inputStyles}></textarea>
                        </div>
                        {(formState.subtype === EvaluacionSubtype.RUBRICA || formState.subtype === EvaluacionSubtype.PAUTA_COTEJO) && (
                            <div>
                                <label htmlFor="enlace" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Enlace al Documento (URL)</label>
                                <input id="enlace" name="enlace" type="url" value={formState.enlace} onChange={handleChange} placeholder="https://..." className={inputStyles} />
                            </div>
                        )}
                    </>
                );
            case EventType.ACTO:
            case EventType.ACTIVIDAD_FOCALIZADA:
                 return (
                    <>
                        <div>
                            <label htmlFor="responsables" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Responsables</label>
                            <input id="responsables" name="responsables" type="text" value={formState.responsables} onChange={handleChange} required className={inputStyles} />
                        </div>
                        <div>
                            <label htmlFor="ubicacion" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Ubicación</label>
                            <input id="ubicacion" name="ubicacion" type="text" value={formState.ubicacion} onChange={handleChange} required className={inputStyles} />
                        </div>
                        <div>
                            <label htmlFor="horario" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Horario</label>
                            <input id="horario" name="horario" type="text" value={formState.horario} onChange={handleChange} required className={inputStyles} />
                        </div>
                    </>
                );
            case EventType.SALIDA_PEDAGOGICA:
                return (
                     <>
                        <div>
                            <label htmlFor="responsable" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Responsable</label>
                            <input id="responsable" name="responsable" type="text" value={formState.responsable} onChange={handleChange} required className={inputStyles} />
                        </div>
                        <div>
                            <label htmlFor="ubicacion" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Ubicación/Destino</label>
                            <input id="ubicacion" name="ubicacion" type="text" value={formState.ubicacion} onChange={handleChange} required className={inputStyles} />
                        </div>
                         <fieldset>
                            <legend className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Cursos Involucrados</legend>
                            <div className="max-h-32 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2 border p-2 rounded-md dark:border-slate-600 text-slate-700 dark:text-slate-300">
                                {CURSOS.map(c => (
                                    <label key={c} className="flex items-center space-x-2 text-sm">
                                        <input type="checkbox" checked={(formState.cursos || []).includes(c)} onChange={() => handleCursoMultiSelect(c)} className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400" />
                                        <span>{c}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 max-h-[80vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">{event ? 'Editar Evento' : 'Agregar Evento'}</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 font-semibold">{formattedDate}</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="type" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Tipo de Evento</label>
                                <select id="type" name="type" value={formState.type} onChange={handleChange} className={inputStyles}>
                                    {Object.values(EventType).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            {renderDynamicFields()}
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700 px-6 py-4 rounded-b-xl flex justify-between items-center">
                         <div>
                            {event && onDelete && (
                                <button type="button" onClick={onDelete} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold">
                                    Eliminar
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">Cancelar</button>
                            <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">Guardar</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};


interface CalendarioAcademicoProps {
    profile: Profile;
}

const CalendarioAcademico: React.FC<CalendarioAcademicoProps> = ({ profile }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [filteredTypes, setFilteredTypes] = useState<EventType[]>(Object.values(EventType));
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

    useEffect(() => {
        try {
            const storedEvents = localStorage.getItem(CALENDAR_KEY);
            if (storedEvents) {
                setEvents(JSON.parse(storedEvents));
            }
        } catch (e) {
            console.error("Error al cargar eventos de localStorage", e);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(CALENDAR_KEY, JSON.stringify(events));
        } catch (e) {
            console.error("Error al guardar eventos en localStorage", e);
        }
    }, [events]);

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const grid = [];
        let day = 1;
        for (let i = 0; i < 6; i++) {
            const week = [];
            for (let j = 0; j < 7; j++) {
                if ((i === 0 && j < firstDayOfMonth) || day > daysInMonth) {
                    week.push(null);
                } else {
                    week.push(new Date(year, month, day));
                    day++;
                }
            }
            grid.push(week);
            if (day > daysInMonth) break;
        }
        return grid;
    }, [currentDate]);

    const handleFilterToggle = (type: EventType) => {
        setFilteredTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };
    
    const handleSelectAllFilters = () => {
        if(filteredTypes.length === Object.values(EventType).length) {
            setFilteredTypes([]);
        } else {
            setFilteredTypes(Object.values(EventType));
        }
    };

    const handleDayClick = (date: Date) => {
        if (profile === Profile.ESTUDIANTE) return;
        setSelectedDate(date.toISOString().split('T')[0]);
        setEditingEvent(null);
        setModalOpen(true);
    };
    
    const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        if (profile === Profile.ESTUDIANTE) return;
        setSelectedDate(event.date);
        setEditingEvent(event);
        setModalOpen(true);
    };

    const handleSaveEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
        if (editingEvent) {
            setEvents(events.map(e => e.id === editingEvent.id ? { ...eventData, id: e.id } as CalendarEvent : e));
        } else {
            setEvents([...events, { ...eventData, id: crypto.randomUUID() } as CalendarEvent]);
        }
    };
    
    const handleDeleteEvent = () => {
        if(!editingEvent) return;
        setEvents(events.filter(e => e.id !== editingEvent.id));
        setModalOpen(false);
    }
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md space-y-6 animate-fade-in">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Calendario Académico</h1>
            
            <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 rounded-r-lg">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.008a1 1 0 011 1v3.008a1 1 0 01-1 1h-.008a1 1 0 01-1-1V5z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm">
                            Recuerda que el calendario escolar completo se encuentra disponible en la intranet. Este calendario es de exclusivo uso evaluativo y académico.
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div>
                 <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3">Filtrar por tipo de evento:</h2>
                 <div className="flex flex-wrap gap-2 items-center">
                    <button onClick={handleSelectAllFilters} className="text-sm font-semibold px-3 py-1.5 rounded-full bg-slate-700 text-white hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 transition-colors">
                        {filteredTypes.length === Object.values(EventType).length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                    </button>
                    {Object.values(EventType).map(type => (
                        <label key={type} className={`cursor-pointer text-sm font-medium px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-2 ${filteredTypes.includes(type) ? `shadow-sm ${EVENT_TYPE_CONFIG[type].color}` : 'bg-slate-100 text-slate-600 hover:bg-slate-200 opacity-70 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:opacity-60'}`}>
                            <input type="checkbox" checked={filteredTypes.includes(type)} onChange={() => handleFilterToggle(type)} className="hidden" />
                            <span>{EVENT_TYPE_CONFIG[type].icon}</span>
                            <span>{EVENT_TYPE_CONFIG[type].label}</span>
                        </label>
                    ))}
                 </div>
            </div>

            {/* Calendar */}
            <div className="border dark:border-slate-700 rounded-lg overflow-hidden">
                <header className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 border-b dark:border-slate-700">
                    <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                        &lt;
                    </button>
                    <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 capitalize">
                        {currentDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
                    </h2>
                     <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                        &gt;
                    </button>
                     <button onClick={() => setCurrentDate(new Date())} className="ml-4 bg-slate-800 text-white text-sm font-bold py-1.5 px-3 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">
                        Hoy
                    </button>
                </header>
                
                <div className="grid grid-cols-7">
                    {DAYS_OF_WEEK.map(day => (
                        <div key={day} className="text-center font-semibold text-slate-500 dark:text-slate-400 text-sm py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-r dark:border-slate-700">
                           {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 grid-rows-6">
                    {calendarGrid.flat().map((date, i) => {
                        const isToday = date && date.toDateString() === new Date().toDateString();
                        const dateStr = date?.toISOString().split('T')[0];
                        const dayEvents = dateStr ? events.filter(e => e.date === dateStr && filteredTypes.includes(e.type)) : [];

                        return (
                            <div key={i} onClick={() => date && handleDayClick(date)} className={`border-b border-r dark:border-slate-700 p-2 h-36 flex flex-col overflow-hidden relative group ${date ? (profile !== Profile.ESTUDIANTE ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : '') : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                                {date && (
                                    <>
                                        <span className={`self-end text-sm font-semibold ${isToday ? 'bg-amber-400 text-white rounded-full h-6 w-6 flex items-center justify-center' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {date.getDate()}
                                        </span>
                                        <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-1">
                                            {dayEvents.map(event => (
                                                <div key={event.id} onClick={(e) => handleEventClick(event, e)} className={`text-xs font-medium p-1 rounded-md flex items-center gap-1.5 truncate ${EVENT_TYPE_CONFIG[event.type].color}`}>
                                                    <span>{EVENT_TYPE_CONFIG[event.type].icon}</span>
                                                    <span className="truncate">{getEventTitle(event)}</span>
                                                </div>
                                            ))}
                                        </div>
                                         {profile !== Profile.ESTUDIANTE && (
                                            <button className="absolute bottom-1 right-1 bg-amber-400 text-white rounded-full h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-lg font-bold">+</button>
                                         )}
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {isModalOpen && <EventModal
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
                event={editingEvent}
                date={selectedDate!}
            />}
        </div>
    );
};

export default CalendarioAcademico;