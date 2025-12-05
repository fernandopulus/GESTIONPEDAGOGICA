import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { Profile, CalendarEvent, EventType, EvaluacionSubtype, EvaluacionEvent } from '../../types';
import { EVENT_TYPE_CONFIG, EVALUACION_SUBTYPES, ASIGNATURAS, CURSOS } from '../../constants';
import {
  getAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../../src/firebaseHelpers/calendar';

// 👉 Íconos Lucide
import {
  Info,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Save,
  Clock,
  MapPin,
  BookOpen,
  Megaphone,
  Target,
  Route,
} from 'lucide-react';

const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Mapeo local de íconos por tipo (no modifica tu EVENT_TYPE_CONFIG)
const TYPE_ICONS: Record<EventType, JSX.Element> = {
  [EventType.EVALUACION]: <BookOpen className="h-4 w-4" />,
  [EventType.ACTO]: <Megaphone className="h-4 w-4" />,
  [EventType.ACTIVIDAD_FOCALIZADA]: <Target className="h-4 w-4" />,
  [EventType.SALIDA_PEDAGOGICA]: <Route className="h-4 w-4" />,
} as const;

const PRUEBA_GLOBAL_NIVELES = ['Iº Medio', 'IIº Medio', 'IIIº Medio'];

const getEventTitle = (event: CalendarEvent): string => {
  switch (event.type) {
    case EventType.EVALUACION:
      if (event.subtype === EvaluacionSubtype.PRUEBA_GLOBAL) {
        const nivelLabel = 'nivel' in event && event.nivel ? ` • ${event.nivel}` : '';
        return `${event.subtype} - ${event.asignatura}${nivelLabel}`;
      }
      return `${event.subtype} - ${event.asignatura}${event.curso ? ` • ${event.curso}` : ''}`;
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

type CalendarFormState = Partial<CalendarEvent> & { nivel?: string };

const EventModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Omit<CalendarEvent, 'id'>) => void;
  onDelete?: () => void;
  event?: CalendarEvent | null;
  date: string;
  isLoading?: boolean;
}> = ({ isOpen, onClose, onSave, onDelete, event, date, isLoading }) => {
  const [formState, setFormState] = useState<CalendarFormState>({});

  useEffect(() => {
    if (event) {
      if (event.type === EventType.EVALUACION && event.subtype === EvaluacionSubtype.PRUEBA_GLOBAL) {
        setFormState({ ...event, nivel: event.nivel || PRUEBA_GLOBAL_NIVELES[0] });
      } else {
        setFormState(event);
      }
    } else {
      // Default new event state
      setFormState({
        type: EventType.EVALUACION,
        subtype: EvaluacionSubtype.PRUEBA_PARCIAL,
        asignatura: ASIGNATURAS[0],
        curso: CURSOS[0],
        nivel: PRUEBA_GLOBAL_NIVELES[0],
        contenidos: '',
        enlace: '',
        responsables: '',
        ubicacion: '',
        horario: '',
        responsable: '',
        cursos: [],
      });
    }
  }, [event, isOpen]);

  // Input base: glass con foco azul/amarillo
  const inputStyles =
    "w-full rounded-md border border-white/30 bg-white/10 dark:bg-white/5 text-slate-800 dark:text-slate-100 placeholder-slate-400 " +
    "backdrop-blur-md shadow-sm focus:outline-none focus:ring-4 focus:ring-yellow-400/30 focus:border-blue-300 " +
    "dark:border-white/10 dark:focus:border-blue-400";

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => {
      if (name === 'subtype') {
        const nextSubtype = value as EvaluacionSubtype;
        const nextState: CalendarFormState = { ...prev, subtype: nextSubtype };

        if (nextSubtype === EvaluacionSubtype.PRUEBA_GLOBAL) {
          nextState.nivel = prev.nivel || PRUEBA_GLOBAL_NIVELES[0];
          nextState.curso = undefined;
        } else {
          nextState.nivel = undefined;
          nextState.curso = prev.curso || CURSOS[0];
        }

        return nextState;
      }
      return { ...prev, [name]: value };
    });
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

    let eventData: Omit<CalendarEvent, 'id'>;

    switch (formState.type) {
      case EventType.EVALUACION: {
        const isPruebaGlobal = formState.subtype === EvaluacionSubtype.PRUEBA_GLOBAL;
        if (isPruebaGlobal && !formState.nivel) {
          alert('Debes seleccionar un nivel para la Prueba Global.');
          return;
        }
        if (!isPruebaGlobal && !formState.curso) {
          alert('Debes seleccionar un curso para esta evaluación.');
          return;
        }
        const evaluacionData: Omit<EvaluacionEvent, 'id'> = {
          date,
          type: EventType.EVALUACION,
          subtype: formState.subtype!,
          asignatura: formState.asignatura!,
          contenidos: formState.contenidos!,
        };

        if (isPruebaGlobal) {
          evaluacionData.nivel = formState.nivel!;
        } else {
          evaluacionData.curso = formState.curso!;
        }

        if (
          (formState.subtype === EvaluacionSubtype.RUBRICA ||
            formState.subtype === EvaluacionSubtype.PAUTA_COTEJO) &&
          formState.enlace?.trim()
        ) {
          evaluacionData.enlace = formState.enlace.trim();
        }

        eventData = evaluacionData;
        break;
      }
      case EventType.ACTO:
        eventData = {
          date,
          type: EventType.ACTO,
          responsables: formState.responsables!,
          ubicacion: formState.ubicacion!,
          horario: formState.horario!,
        };
        break;

      case EventType.ACTIVIDAD_FOCALIZADA:
        eventData = {
          date,
          type: EventType.ACTIVIDAD_FOCALIZADA,
          responsables: formState.responsables!,
          ubicacion: formState.ubicacion!,
          horario: formState.horario!,
        };
        break;

      case EventType.SALIDA_PEDAGOGICA:
        eventData = {
          date,
          type: EventType.SALIDA_PEDAGOGICA,
          responsable: formState.responsable!,
          ubicacion: formState.ubicacion!,
          cursos: formState.cursos!,
        };
        break;

      default:
        console.error('Tipo de evento no reconocido');
        return;
    }

    onSave(eventData);
  };

  if (!isOpen) return null;

  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const renderDynamicFields = () => {
    switch (formState.type) {
      case EventType.EVALUACION: {
        const isPruebaGlobal = formState.subtype === EvaluacionSubtype.PRUEBA_GLOBAL;
        return (
          <>
            <div>
              <label htmlFor="subtype" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Subtipo
              </label>
              <select id="subtype" name="subtype" value={formState.subtype} onChange={handleChange} required className={inputStyles}>
                {EVALUACION_SUBTYPES.map(st => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            {isPruebaGlobal && (
              <div>
                <label htmlFor="nivel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nivel (Prueba Global)
                </label>
                <select
                  id="nivel"
                  name="nivel"
                  value={formState.nivel || PRUEBA_GLOBAL_NIVELES[0]}
                  onChange={handleChange}
                  required
                  className={inputStyles}
                >
                  {PRUEBA_GLOBAL_NIVELES.map(nivel => (
                    <option key={nivel} value={nivel}>
                      {nivel}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="asignatura" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Asignatura
              </label>
              <select id="asignatura" name="asignatura" value={formState.asignatura} onChange={handleChange} required className={inputStyles}>
                {ASIGNATURAS.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="curso" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Curso
              </label>
              <select
                id="curso"
                name="curso"
                value={formState.curso || ''}
                onChange={handleChange}
                required={!isPruebaGlobal}
                disabled={isPruebaGlobal}
                className={`${inputStyles} ${isPruebaGlobal ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {!isPruebaGlobal && !formState.curso && <option value="">Seleccione…</option>}
                {CURSOS.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {isPruebaGlobal && <p className="text-xs text-slate-500 mt-1">Para Prueba Global selecciona solo el nivel.</p>}
            </div>
            <div>
              <label htmlFor="contenidos" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Contenidos
              </label>
              <textarea id="contenidos" name="contenidos" value={formState.contenidos || ''} onChange={handleChange} required rows={3} className={inputStyles} />
            </div>
            {(formState.subtype === EvaluacionSubtype.RUBRICA ||
              formState.subtype === EvaluacionSubtype.PAUTA_COTEJO) && (
              <div>
                <label htmlFor="enlace" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Enlace al Documento (URL)
                </label>
                <input id="enlace" name="enlace" type="url" value={formState.enlace || ''} onChange={handleChange} placeholder="https://..." className={inputStyles} />
              </div>
            )}
          </>
        );
      }
      case EventType.ACTO:
      case EventType.ACTIVIDAD_FOCALIZADA:
        return (
          <>
            <div>
              <label htmlFor="responsables" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Responsables
              </label>
              <input id="responsables" name="responsables" type="text" value={formState.responsables || ''} onChange={handleChange} required className={inputStyles} />
            </div>
            <div>
              <label htmlFor="ubicacion" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ubicación
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input id="ubicacion" name="ubicacion" type="text" value={formState.ubicacion || ''} onChange={handleChange} required className={`${inputStyles} pl-9`} />
              </div>
            </div>
            <div>
              <label htmlFor="horario" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Horario
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input id="horario" name="horario" type="text" value={formState.horario || ''} onChange={handleChange} required className={`${inputStyles} pl-9`} />
              </div>
            </div>
          </>
        );
      case EventType.SALIDA_PEDAGOGICA:
        return (
          <>
            <div>
              <label htmlFor="responsable" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Responsable
              </label>
              <input id="responsable" name="responsable" type="text" value={formState.responsable || ''} onChange={handleChange} required className={inputStyles} />
            </div>
            <div>
              <label htmlFor="ubicacion" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ubicación/Destino
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input id="ubicacion" name="ubicacion" type="text" value={formState.ubicacion || ''} onChange={handleChange} required className={`${inputStyles} pl-9`} />
              </div>
            </div>
            <fieldset>
              <legend className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cursos Involucrados</legend>
              <div className="max-h-32 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2 border border-white/30 dark:border-white/10 p-2 rounded-md text-slate-700 dark:text-slate-300 bg-white/5 backdrop-blur-md">
                {CURSOS.map(c => (
                  <label key={c} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(formState.cursos || []).includes(c)}
                      onChange={() => handleCursoMultiSelect(c)}
                      className="h-4 w-4 rounded text-yellow-500 focus:ring-yellow-400"
                    />
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
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: 'rgba(2, 6, 23, 0.55)' }} // slate-900/55
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-blue-50/70 via-white/50 to-yellow-50/70 dark:from-slate-900/70 dark:via-slate-900/60 dark:to-slate-900/70 backdrop-blur-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{event ? 'Editar Evento' : 'Agregar Evento'}</h2>
                <p className="text-slate-600 dark:text-slate-300/90 font-semibold">{formattedDate}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 hover:bg-white/20 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-yellow-400/30"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Evento
                </label>
                <select id="type" name="type" value={formState.type} onChange={handleChange} className={inputStyles}>
                  {Object.values(EventType).map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {renderDynamicFields()}
            </div>
          </div>

          <div className="px-6 py-4 bg-gradient-to-r from-blue-100/60 to-yellow-100/60 dark:from-slate-800/60 dark:to-slate-800/60 border-t border-white/20 flex justify-between items-center">
            <div>
              {event && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {isLoading ? 'Eliminando...' : 'Eliminar'}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 font-semibold text-slate-800 hover:bg-white/30 backdrop-blur-md dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-400/30"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-yellow-500 px-4 py-2 font-bold text-white hover:opacity-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-300/40"
              >
                <Save className="h-4 w-4" />
                {isLoading ? 'Guardando...' : 'Guardar'}
              </button>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [filteredTypes, setFilteredTypes] = useState<EventType[]>(Object.values(EventType));
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const eventsFS = await getAllEvents();
      setEvents(eventsFS);
      setError(null);
    } catch (e) {
      console.error('Error al cargar eventos desde Firestore', e);
      setError('No se pudieron cargar los eventos desde la nube.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid: (Date | null)[][] = [];
    let day = 1;
    for (let i = 0; i < 6; i++) {
      const week: (Date | null)[] = [];
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
    setFilteredTypes(prev => (prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]));
  };

  const handleSelectAllFilters = () => {
    if (filteredTypes.length === Object.values(EventType).length) {
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

  const handleSaveEvent = async (eventData: Omit<CalendarEvent, 'id'>) => {
    setModalLoading(true);
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, eventData);
      } else {
        await createEvent(eventData);
      }
      await fetchEvents();
      setModalOpen(false);
    } catch (err) {
      console.error('Error al guardar evento:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al guardar el evento: ${errorMessage}`);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;

    setModalLoading(true);
    try {
      await deleteEvent(editingEvent.id);
      await fetchEvents();
      setModalOpen(false);
    } catch (err) {
      console.error('Error al eliminar evento:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`No se pudo eliminar el evento: ${errorMessage}`);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl p-6 md:p-8 shadow-md space-y-6 animate-fade-in
                    bg-gradient-to-br from-blue-50 via-white to-yellow-50 dark:from-slate-900 dark:via-slate-950 dark:to-black">
      {/* blobs decorativos */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 -left-16 h-64 w-64 rounded-full blur-3xl opacity-40 bg-gradient-to-tr from-yellow-300 to-yellow-200 dark:from-yellow-500/15 dark:to-yellow-400/10" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full blur-3xl opacity-40 bg-gradient-to-tr from-sky-300 to-blue-300 dark:from-sky-500/15 dark:to-blue-500/15" />
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 drop-shadow-sm">Calendario Académico</h1>
        <div className="text-slate-600 dark:text-slate-300 text-sm">
          {loading && <span className="px-2 py-1 rounded bg-white/30 dark:bg-white/10 backdrop-blur-md">Cargando…</span>}
        </div>
      </div>

      {error && <div className="text-red-700 dark:text-red-400 bg-red-100/70 dark:bg-red-900/30 border border-red-300/50 dark:border-red-800/40 p-3 rounded-lg">{error}</div>}

      {!loading && events.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-400/40 bg-yellow-50/70 p-4 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300 backdrop-blur-md">
          <Info className="h-5 w-5 mt-0.5" />
          <p>No hay eventos registrados en la nube.</p>
        </div>
      )}

      <div className="mb-2 rounded-xl border border-white/30 bg-white/30 dark:bg-white/10 backdrop-blur-xl p-4">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 mb-2">
          <Filter className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Filtrar por tipo de evento:</h2>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={handleSelectAllFilters}
            className="text-sm font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-yellow-500 text-white hover:opacity-95 transition-colors"
          >
            {filteredTypes.length === Object.values(EventType).length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
          </button>
          {Object.values(EventType).map(type => (
            <label
              key={type}
              className={`cursor-pointer text-sm font-medium px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-2
                ${
                  filteredTypes.includes(type)
                    ? `shadow-sm ${EVENT_TYPE_CONFIG[type].color}`
                    : 'bg-white/40 text-slate-700 hover:bg-white/60 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20'
                }`}
            >
              <input type="checkbox" checked={filteredTypes.includes(type)} onChange={() => handleFilterToggle(type)} className="hidden" />
              <span className="shrink-0">{TYPE_ICONS[type]}</span>
              <span>{EVENT_TYPE_CONFIG[type].label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-white/30 dark:border-white/10 backdrop-blur-xl bg-white/30 dark:bg-white/5">
        <header className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-100/60 to-yellow-100/60 dark:from-slate-800/60 dark:to-slate-800/60 border-b border-white/20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
              className="p-2 rounded-full hover:bg-white/40 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
              className="p-2 rounded-full hover:bg-white/40 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 capitalize">
            {currentDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
          </h2>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-4 bg-gradient-to-r from-blue-600 to-yellow-500 text-white text-sm font-bold py-1.5 px-3 rounded-lg hover:opacity-95"
          >
            Hoy
          </button>
        </header>

        {/* Cabecera de días con líneas tipo tabla */}
        <div className="grid grid-cols-7 border-t border-l border-slate-200/80 dark:border-slate-700/70">
          {DAYS_OF_WEEK.map(day => (
            <div
              key={day}
              className="text-center font-semibold text-slate-600 dark:text-slate-300 text-sm py-3
                         bg-white/40 dark:bg-white/10
                         border-b border-r border-slate-200/80 dark:border-slate-700/70"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Celdas del mes con líneas tipo tabla */}
        <div className="grid grid-cols-7 grid-rows-6 border-t border-l border-slate-200/80 dark:border-slate-700/70">
          {calendarGrid.flat().map((date, i) => {
            const isToday = date && date.toDateString() === new Date().toDateString();
            const dateStr = date?.toISOString().split('T')[0];
            const dayEvents = dateStr ? events.filter(e => e.date === dateStr && filteredTypes.includes(e.type)) : [];

            return (
              <div
                key={i}
                onClick={() => date && handleDayClick(date)}
                className={`border-b border-r border-slate-200/80 dark:border-slate-700/70
                            p-2 h-36 flex flex-col overflow-hidden relative group 
                            ${date ? (profile !== Profile.ESTUDIANTE ? 'cursor-pointer hover:bg-white/40 dark:hover:bg-white/10' : '') : 'bg-white/30 dark:bg-white/5'}`}
              >
                {date && (
                  <>
                    <span
                      className={`self-end text-sm font-semibold ${
                        isToday
                          ? 'bg-gradient-to-r from-blue-600 to-yellow-500 text-white rounded-full h-6 w-6 flex items-center justify-center'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-1">
                      {dayEvents.map(event => (
                        <div
                          key={event.id}
                          onClick={e => handleEventClick(event, e)}
                          className={`text-xs font-medium p-1 rounded-md flex items-center gap-1.5 truncate ${EVENT_TYPE_CONFIG[event.type].color}`}
                        >
                          <span className="shrink-0">{TYPE_ICONS[event.type]}</span>
                          <span className="truncate">{getEventTitle(event)}</span>
                        </div>
                      ))}
                    </div>
                    {profile !== Profile.ESTUDIANTE && (
                      <button
                        className="absolute bottom-1 right-1 rounded-full h-7 w-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity 
                                   bg-gradient-to-r from-blue-600 to-yellow-500 text-white shadow"
                        aria-label="Agregar evento"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && (
        <EventModal
          isOpen={isModalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          event={editingEvent}
          date={selectedDate!}
          isLoading={modalLoading}
        />
      )}
    </div>
  );
};

export default CalendarioAcademico;
