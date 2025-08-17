import React, { useMemo, useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { Profile, User } from '../types';
import TopBar from './TopBar';
import {
  Bell,
  CalendarDays,
  Building2,
  LayoutDashboard,
  BookOpen,
  CheckCircle2,
  Puzzle,
  Sigma,
  Layers3,
  GraduationCap,
  FlaskConical,
  ClipboardList,
  LineChart,
  Wrench,
  BriefcaseBusiness,
  Users,
  Settings,
  ClipboardCheck,
  UserCheck,
  FileText,
  Clock4,
  MessageSquare,
  Grid3X3,
  Search,
  ArrowRight,
  Shield,
  Target,
} from 'lucide-react';

/**
 * Interfaz para la estructura de un módulo individual.
 * NOTA: Conservamos compatibilidad con strings (emojis) y añadimos JSX.Element para íconos Lucide.
 */
interface Module {
  id: string;
  name: string;
  icon: string | JSX.Element;
  description?: string;
  accent?: string; // tailwind color accent para degradados
}

/** Props del selector de módulos */
interface ModuleSelectorProps {
  currentUser: User;
  onModuleSelect: (module: string) => void;
  onLogout: () => void;
  onChangeProfile?: () => void;
  canChangeProfile?: boolean;
}

/** Mapa de íconos por id para mantener el código ordenado */
const ICONS: Record<string, JSX.Element> = {
  muro: <Bell className="w-6 h-6" aria-hidden />,
  calendario: <CalendarDays className="w-6 h-6" aria-hidden />,
  selector_completo: <LayoutDashboard className="w-6 h-6" aria-hidden />,
  alternancia_tp: <Building2 className="w-6 h-6" aria-hidden />,
  planificacion: <BookOpen className="w-6 h-6" aria-hidden />,
  acompañamientos: <CheckCircle2 className="w-6 h-6" aria-hidden />,
  recursos: <Puzzle className="w-6 h-6" aria-hidden />,
  taxonomico: <Sigma className="w-6 h-6" aria-hidden />,
  interdisciplinario: <Layers3 className="w-6 h-6" aria-hidden />,
  inclusion: <GraduationCap className="w-6 h-6" aria-hidden />,
  actividades_remotas: <FlaskConical className="w-6 h-6" aria-hidden />,
  evaluacion_aprendizajes: <ClipboardList className="w-6 h-6" aria-hidden />,
  evaluaciones_formativas: <LineChart className="w-6 h-6" aria-hidden />,
  evaluacion_competencias: <Target className="w-6 h-6" aria-hidden />,
  actas: <FileText className="w-6 h-6" aria-hidden />,
  mensajeria: <MessageSquare className="w-6 h-6" aria-hidden />,
  seguimiento_dual: <UserCheck className="w-6 h-6" aria-hidden />,
  asistencia_dual: <Clock4 className="w-6 h-6" aria-hidden />,
  pañol: <Wrench className="w-6 h-6" aria-hidden />,
  gestion_empresas: <BriefcaseBusiness className="w-6 h-6" aria-hidden />,
  administracion: <Settings className="w-6 h-6" aria-hidden />,
  seguimiento_curricular: <ClipboardCheck className="w-6 h-6" aria-hidden />,
  registro_inasistencias: <Grid3X3 className="w-6 h-6" aria-hidden />,
  auto_aprendizaje: <BookOpen className="w-6 h-6" aria-hidden />,
  evaluacion_formativa: <LineChart className="w-6 h-6" aria-hidden />,
  tareas_interdisciplinarias: <Layers3 className="w-6 h-6" aria-hidden />,
  desarrollo_profesional: <Shield className="w-6 h-6" aria-hidden />,
};

/** Gradientes por módulo (ligeros, accesibles) */
const ACCENTS: Record<string, string> = {
  selector_completo: 'from-indigo-500/15 to-blue-500/10',
  alternancia_tp: 'from-emerald-500/20 to-teal-500/10',
  planificacion: 'from-violet-500/20 to-fuchsia-500/10',
  acompañamientos: 'from-sky-500/20 to-cyan-500/10',
  recursos: 'from-amber-500/20 to-yellow-500/10',
  taxonomico: 'from-rose-500/20 to-pink-500/10',
  interdisciplinario: 'from-blue-500/20 to-indigo-500/10',
  inclusion: 'from-green-500/20 to-emerald-500/10',
  actividades_remotas: 'from-orange-500/20 to-amber-500/10',
  evaluacion_aprendizajes: 'from-purple-500/20 to-indigo-500/10',
  evaluaciones_formativas: 'from-cyan-500/20 to-sky-500/10',
  actas: 'from-slate-500/20 to-slate-400/10',
  mensajeria: 'from-teal-500/20 to-emerald-500/10',
  seguimiento_dual: 'from-lime-500/20 to-green-500/10',
  asistencia_dual: 'from-red-500/20 to-rose-500/10',
  pañol: 'from-yellow-500/20 to-amber-500/10',
  gestion_empresas: 'from-indigo-500/20 to-indigo-400/10',
  administracion: 'from-violet-500/20 to-purple-500/10',
  desarrollo_profesional: 'from-blue-500/20 to-indigo-500/10',
  seguimiento_curricular: 'from-indigo-500/20 to-blue-500/10',
  registro_inasistencias: 'from-fuchsia-500/20 to-pink-500/10',
  auto_aprendizaje: 'from-emerald-500/20 to-teal-500/10',
  evaluacion_formativa: 'from-cyan-500/20 to-sky-500/10',
  tareas_interdisciplinarias: 'from-blue-500/20 to-indigo-500/10',
  muro: 'from-amber-500/20 to-yellow-500/10',
  calendario: 'from-indigo-500/20 to-blue-500/10',
};

/** Etiqueta legible del perfil */
const getProfileDisplayName = (profile: Profile): string => {
  switch (profile) {
    case Profile.PROFESORADO:
      return 'Profesorado';
    case Profile.COORDINACION_TP:
      return 'Coordinación';
    case Profile.SUBDIRECCION:
      return 'Subdirección';
    case Profile.ESTUDIANTE:
      return 'Estudiantes';
    default:
      return 'Usuario';
  }
};

/** Crea el array de módulos por perfil (manteniendo tu lógica original) */
const getModulesForProfile = (profile: Profile): Module[] => {
  const commonModules: Module[] = [
    { id: 'muro', name: 'Muro de Anuncios', icon: ICONS.muro, accent: ACCENTS.muro },
    { id: 'calendario', name: 'Calendario Académico', icon: ICONS.calendario, accent: ACCENTS.calendario },
  ];

  const alternanciaTPModule: Module = {
    id: 'alternancia_tp',
    name: 'Alternancia TP',
    icon: ICONS.alternancia_tp,
    accent: ACCENTS.alternancia_tp,
    description: 'Gestiona y monitorea programas de formación en alternancia (liceo-empresa).',
  };

  switch (profile) {
    case Profile.PROFESORADO:
      return [
        { id: 'selector_completo', name: 'Vista Completa (Dashboard)', icon: ICONS.selector_completo, accent: ACCENTS.selector_completo, description: 'Acceso a todos los módulos con navegación lateral' },
        alternanciaTPModule,
        { id: 'planificacion', name: 'Planificación', icon: ICONS.planificacion, accent: ACCENTS.planificacion },
        { id: 'acompañamientos', name: 'Mis Acompañamientos', icon: ICONS.acompañamientos, accent: ACCENTS.acompañamientos },
        { id: 'recursos', name: 'Recursos de Aprendizaje', icon: ICONS.recursos, accent: ACCENTS.recursos },
        { id: 'taxonomico', name: 'Análisis Taxonómico', icon: ICONS.taxonomico, accent: ACCENTS.taxonomico },
        { id: 'interdisciplinario', name: 'Interdisciplinario', icon: ICONS.interdisciplinario, accent: ACCENTS.interdisciplinario },
        { id: 'inclusion', name: 'Inclusión', icon: ICONS.inclusion, accent: ACCENTS.inclusion },
        { id: 'actividades_remotas', name: 'Actividades Remotas', icon: ICONS.actividades_remotas, accent: ACCENTS.actividades_remotas },
        { id: 'evaluacion_aprendizajes', name: 'Evaluación de Aprendizajes', icon: ICONS.evaluacion_aprendizajes, accent: ACCENTS.evaluacion_aprendizajes },
        { id: 'evaluaciones_formativas', name: 'Evaluaciones Formativas', icon: ICONS.evaluaciones_formativas, accent: ACCENTS.evaluaciones_formativas },
        { id: 'evaluacion_competencias', name: 'Evaluación por Competencias', icon: ICONS.evaluacion_competencias, accent: ACCENTS.evaluacion_aprendizajes },
        { id: 'desarrollo_profesional', name: 'Desarrollo Profesional', icon: ICONS.desarrollo_profesional, accent: ACCENTS.desarrollo_profesional },
        ...commonModules,
        { id: 'actas', name: 'Generador de Actas', icon: ICONS.actas, accent: ACCENTS.actas },
        { id: 'mensajeria', name: 'Mensajería Interna', icon: ICONS.mensajeria, accent: ACCENTS.mensajeria },
      ];

    case Profile.COORDINACION_TP:
      return [
        { id: 'selector_completo', name: 'Vista Completa (Dashboard)', icon: ICONS.selector_completo, accent: ACCENTS.selector_completo, description: 'Acceso a todos los módulos con navegación lateral' },
        alternanciaTPModule,
        { id: 'seguimiento_dual', name: 'Seguimiento Dual', icon: ICONS.seguimiento_dual, accent: ACCENTS.seguimiento_dual },
        { id: 'asistencia_dual', name: 'Asistencia Dual', icon: ICONS.asistencia_dual, accent: ACCENTS.asistencia_dual },
        { id: 'pañol', name: 'Pañol', icon: ICONS.pañol, accent: ACCENTS.pañol },
        { id: 'gestion_empresas', name: 'Gestión de Empresas', icon: ICONS.gestion_empresas, accent: ACCENTS.gestion_empresas },
        { id: 'desarrollo_profesional', name: 'Desarrollo Profesional', icon: ICONS.desarrollo_profesional, accent: ACCENTS.desarrollo_profesional },
        { id: 'evaluacion_competencias', name: 'Evaluación por Competencias', icon: ICONS.evaluacion_competencias, accent: ACCENTS.evaluacion_aprendizajes },
        ...commonModules,
        { id: 'mensajeria', name: 'Mensajería Interna', icon: ICONS.mensajeria, accent: ACCENTS.mensajeria },
        { id: 'actas', name: 'Generador de Actas', icon: ICONS.actas, accent: ACCENTS.actas },
      ];

    case Profile.SUBDIRECCION:
      return [
        { id: 'selector_completo', name: 'Vista Completa (Dashboard)', icon: ICONS.selector_completo, accent: ACCENTS.selector_completo, description: 'Acceso a todos los módulos con navegación lateral' },
        alternanciaTPModule,
        { id: 'administracion', name: 'Administración', icon: ICONS.administracion, accent: ACCENTS.administracion },
        { id: 'seguimiento_curricular', name: 'Seguimiento Curricular', icon: ICONS.seguimiento_curricular, accent: ACCENTS.seguimiento_curricular },
        { id: 'acompañamiento_docente', name: 'Acompañamiento Docente', icon: <Users className="w-6 h-6" />, accent: ACCENTS.seguimiento_dual },
        { id: 'taxonomico', name: 'Análisis Taxonómico', icon: ICONS.taxonomico, accent: ACCENTS.taxonomico },
        { id: 'interdisciplinario', name: 'Interdisciplinario', icon: ICONS.interdisciplinario, accent: ACCENTS.interdisciplinario },
        { id: 'registro_inasistencias', name: 'Inasistencias y Reemplazos', icon: ICONS.registro_inasistencias, accent: ACCENTS.registro_inasistencias },
        { id: 'crear_horarios', name: 'Crear Horarios', icon: <Clock4 className="w-6 h-6" />, accent: ACCENTS.asistencia_dual },
        { id: 'seguimiento_acciones', name: 'Seguimiento de Acciones', icon: ICONS.evaluaciones_formativas, accent: ACCENTS.evaluaciones_formativas },
        { id: 'inclusion', name: 'Inclusión', icon: ICONS.inclusion, accent: ACCENTS.inclusion },
        { id: 'evaluacion_competencias', name: 'Evaluación por Competencias', icon: ICONS.evaluacion_competencias, accent: ACCENTS.evaluacion_aprendizajes },
        ...commonModules,
      ];

    case Profile.ESTUDIANTE:
      return [
        { id: 'selector_completo', name: 'Vista Completa (Dashboard)', icon: ICONS.selector_completo, accent: ACCENTS.selector_completo, description: 'Acceso a todos los módulos con navegación lateral' },
        { id: 'auto_aprendizaje', name: 'Auto-aprendizaje', icon: ICONS.auto_aprendizaje, accent: ACCENTS.auto_aprendizaje },
        { id: 'evaluacion_formativa', name: 'Evaluación Formativa', icon: ICONS.evaluacion_formativa, accent: ACCENTS.evaluacion_formativa },
        { id: 'tareas_interdisciplinarias', name: 'Tareas Interdisciplinarias', icon: ICONS.tareas_interdisciplinarias, accent: ACCENTS.tareas_interdisciplinarias },
        ...commonModules,
        { id: 'mensajeria', name: 'Mensajería Interna', icon: ICONS.mensajeria, accent: ACCENTS.mensajeria },
      ];

    default:
      return commonModules;
  }
};

/** Badge del perfil */
const ProfileBadge: React.FC<{ profile: Profile }> = ({ profile }) => {
  const label = getProfileDisplayName(profile);
  const palette: Record<Profile, string> = {
    [Profile.PROFESORADO]: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900/50',
    [Profile.COORDINACION_TP]: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50',
    [Profile.SUBDIRECCION]: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50',
    [Profile.ESTUDIANTE]: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/50',
  } as any;

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ring-1 ${palette[profile]}`}
      title={`Perfil: ${label}`}
    >
      <Shield className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};

/** Tarjeta de módulo */
const ModuleCard: React.FC<{
  module: Module;
  onClick: () => void;
  index: number;
}> = ({ module, onClick, index }) => {
  const accent = module.accent ?? 'from-slate-500/10 to-slate-400/10';

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir módulo ${module.name}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="group relative rounded-2xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden bg-white/70 dark:bg-slate-800/60 backdrop-blur transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative p-5 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/50 ring-1 ring-slate-200 dark:ring-slate-700 w-12 h-12">
            {typeof module.icon === 'string' ? (
              <span className="text-2xl">{module.icon}</span>
            ) : (
              module.icon
            )}
          </div>
          <ArrowRight className="w-5 h-5 opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </div>

        <div className="mt-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-tight">
            {module.name}
          </h3>
          {module.description && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {module.description}
            </p>
          )}
        </div>

        <div className="mt-5">
          <span className="inline-flex text-xs text-slate-600 dark:text-slate-400">
            Click para acceder
          </span>
        </div>
      </div>
    </div>
  );
};

/** Componente principal */
const ModuleSelector: React.FC<ModuleSelectorProps> = ({
  currentUser,
  onModuleSelect,
  onLogout,
  onChangeProfile,
  canChangeProfile,
}) => {
  const [query, setQuery] = useState('');

  const allModules = useMemo(() => getModulesForProfile(currentUser.profile), [currentUser.profile]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allModules;
    return allModules.filter((m) => {
      const hay = (m.name + ' ' + (m.description ?? '') + ' ' + m.id).toLowerCase();
      return hay.includes(q);
    });
  }, [query, allModules]);

  const onKeyShortcuts = useCallback((e: KeyboardEvent) => {
    // Ctrl/Cmd+K para buscar
    if ((e.ctrlKey || (e as any).metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const el = document.getElementById('module-search') as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
  }, []);

  useEffect(() => {
    const handler = (e: any) => onKeyShortcuts(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onKeyShortcuts]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <TopBar
        currentUser={currentUser}
        onLogout={onLogout}
        onChangeProfile={onChangeProfile}
        canChangeProfile={canChangeProfile}
        title="Seleccionar Módulo"
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Seleccionar Módulo
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <ProfileBadge profile={currentUser.profile} />
              {canChangeProfile && onChangeProfile && (
                <button
                  type="button"
                  onClick={onChangeProfile}
                  className="text-xs px-2 py-1 rounded-md ring-1 ring-slate-300 dark:ring-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 transition"
                  title="Cambiar perfil"
                >
                  Cambiar perfil
                </button>
              )}
            </div>
          </div>

          <div className="w-full md:w-96">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="module-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar módulo (Ctrl/Cmd + K)…"
                className="w-full pl-10 pr-3 py-2 rounded-xl bg-white/80 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🚫</div>
            <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Sin módulos disponibles
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Ajusta tu búsqueda o cambia de perfil para ver más opciones.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((m, idx) => (
              <ModuleCard key={m.id} module={m} index={idx} onClick={() => onModuleSelect(m.id)} />
            ))}
          </div>
        )}

        <div className="mt-10 text-xs text-slate-500 dark:text-slate-400">
          <p>
            Sugerencia: usa <kbd className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70">Ctrl/Cmd + K</kbd> para enfocar la búsqueda.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModuleSelector;
