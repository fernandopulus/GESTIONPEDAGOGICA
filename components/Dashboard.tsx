
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Profile, Module, User } from '../types';
import { MODULES_BY_PROFILE, LirLogoIcon } from '../constants';

// Component imports (sin cambios funcionales)
import TopBar from './TopBar';
import RegistroReemplazos from './modules/RegistroReemplazos';
import DashboardSubdireccion from './modules/DashboardSubdireccion';
import CrearHorarios from './modules/CrearHorarios';
import SeguimientoAcciones from './modules/SeguimientoAcciones';
import PlanificacionDocente from './modules/PlanificacionDocente';
import CalendarioAcademico from './modules/CalendarioAcademico';
 
import Administracion from './modules/Administracion';
import SeguimientoDual from './modules/SeguimientoDual';
import ActividadesRemotas from './modules/ActividadesRemotas';
import Autoaprendizaje from './modules/Autoaprendizaje';
import Inclusion from './modules/Inclusion';
import AsistenciaEmpresa from './modules/AsistenciaEmpresa';
import AsistenciaDual from './modules/AsistenciaDual';
import EvaluacionesFormativas from './modules/EvaluacionesFormativas';
import AcompanamientoDocente from './modules/AcompanamientoDocente';
import Interdisciplinario from './modules/Interdisciplinario';
import Panol from './modules/Panol';
import RecursosAprendizaje from './modules/RecursosAprendizaje';
import EvaluacionFormativaEstudiante from './modules/EvaluacionFormativaEstudiante';
import TareasInterdisciplinariasEstudiante from './modules/TareasInterdisciplinariasEstudiante';
import AcompanamientoDocenteProfesor from './modules/AcompanamientoDocenteProfesor';
import SeguimientoCurricular from './modules/SeguimientoCurricular';
import AnalisisTaxonomico from '../components/modules/AnalisisTaxonomico';
import GestionEmpresas from '../components/modules/GestionEmpresas';
import DesarrolloProfesionalDocente from '../components/modules/DesarrolloProfesionalDocente';
import AlternanciaTP from './modules/AlternanciaTP';
import SimceFixed from './modules/SimceFixed';
import Multicopias from './modules/Multicopias';
import EvaluacionEnsayo from './modules/EvaluacionEnsayo';
import Intranet from './modules/Intranet';
import Documentacion from './modules/Documentacion';

// UI
import { Menu, ChevronLeft, ChevronRight, GraduationCap, ChevronDown } from 'lucide-react';

interface DashboardProps {
  currentUser: User;
  onLogout: () => void;
  onUserUpdate: (updatedUser: User) => void;
  onChangeProfile?: () => void;
  canChangeProfile: boolean;
  unreadMessagesCount: number;
  refreshUnreadCount: () => void;
}

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

const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  onLogout,
  onUserUpdate,
  onChangeProfile,
  canChangeProfile,
  unreadMessagesCount,
  refreshUnreadCount,
}) => {
  const profile = currentUser.profile;

  // ===== Modules (misma lógica) =====
  const modules = useMemo(() => {
    const baseModules = MODULES_BY_PROFILE[profile] || [];
    if (profile !== Profile.ESTUDIANTE) return baseModules;
    return baseModules.filter((module) => {
      if (module.name === 'Asistencia a Empresa') {
        const normalized = normalizeCurso(currentUser.curso || '');
        return normalized.startsWith('3º') || normalized.startsWith('4º');
      }
      return true;
    });
  }, [profile, currentUser.curso]);

  // ===== UI state =====
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSidebarGroups, setExpandedSidebarGroups] = useState<Record<string, boolean>>({
    planificacion: true,
    evaluacion: true,
    reflexion: true,
    herramientas: true,
  sd_gestion: true,
  sd_planificacion: true,
  sd_reflexion: true,
  sd_herramientas: true,
  coord_gestion: true,
  coord_formacion: true,
  coord_utilidades: true,
  });
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (modules && modules.length > 0) {
      setActiveModule(modules[0]);
    } else {
      setActiveModule(null);
    }
  }, [profile, modules]);

  // Escuchar peticiones de navegación desde módulos hijos (por ejemplo, Desarrollo Profesional → Documentación)
  useEffect(() => {
    const handler = (e: Event) => {
      const anyEvent = e as CustomEvent<{ moduleName?: string }>;
      const moduleName = anyEvent.detail?.moduleName;
      if (!moduleName) return;
      const found = modules.find((m) => m.name === moduleName);
      if (found) {
        setActiveModule(found);
      }
    };
    window.addEventListener('gp:navigate-module', handler);
    return () => window.removeEventListener('gp:navigate-module', handler);
  }, [modules]);

  // Escuchar cambios en el hash para navegación directa (deep linking básico)
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#documentacion') {
        const found = modules.find((m) => m.name === 'Documentación');
        if (found) setActiveModule(found);
      }
    };
    // Chequear al montar y al cambiar hash
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [modules]);

  const handleModuleSelect = useCallback((mod: Module) => {
    setActiveModule(mod);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const handleNavigate = useCallback(
    (moduleName: string) => {
      const moduleToNavigate = modules.find((m) => m.name === moduleName);
      if (moduleToNavigate) handleModuleSelect(moduleToNavigate);
    },
    [modules, handleModuleSelect]
  );

  // ===== Sidebar (estilo minimal) =====
  const SidebarContent: React.FC = () => (
    <>
      {/* Header */}
      <div className="flex items-center h-16 px-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          {/* Círculo amarillo + ícono forzado a currentColor */}
          <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center">
            <span className="text-slate-900 inline-flex items-center justify-center">
              <LirLogoIcon className="w-4 h-4" />
            </span>
          </div>
          {!isSidebarCollapsed && (
            <span className="text-blue-900 font-extrabold text-xl tracking-tight">Gestión LIR</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSidebarCollapsed((s) => !s)}
          className="ml-auto w-9 h-9 inline-flex items-center justify-center rounded-md hover:bg-slate-100 transition"
          title={isSidebarCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-5 h-5 text-slate-600" /> : <ChevronLeft className="w-5 h-5 text-slate-600" />}
        </button>
      </div>

      {/* Navegación: agrupada para PROFESORADO, SUBDIRECCIÓN y COORDINACIÓN TP; plana para otros perfiles o colapsado */}
      <nav className="flex-1 overflow-y-auto p-3 bg-white">
        {profile === Profile.PROFESORADO && !isSidebarCollapsed ? (
          <div className="space-y-3">
            {[
              {
                id: 'planificacion',
                title: 'Planificación',
                items: ['Intranet', 'Planificación', 'Recursos de Aprendizaje', 'Interdisciplinario', 'Inclusión'],
              },
              {
                id: 'evaluacion',
                title: 'Evaluación',
                items: ['Evaluación de Ensayo', 'Evaluaciones Formativas', 'Actividades Remotas', 'SIMCE'],
              },
              {
                id: 'reflexion',
                title: 'Reflexión',
                items: ['Análisis Taxonómico', 'Mis Acompañamientos', 'Desarrollo Profesional'],
              },
              {
                id: 'herramientas',
                title: 'Herramientas',
                items: ['Documentación'],
              },
            ].map((grp) => {
              const isOpen = !!expandedSidebarGroups[grp.id];
              // map Module objects by name for this group
              const groupModules = grp.items
                .map((name) => modules.find((m) => m.name === name))
                .filter(Boolean) as Module[];

              if (groupModules.length === 0) return null;

              return (
                <div key={grp.id} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
                    onClick={() => setExpandedSidebarGroups((p) => ({ ...p, [grp.id]: !p[grp.id] }))}
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold text-blue-900">{grp.title}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2">
                      {groupModules.map((mod) => {
                        const isActive = activeModule?.name === mod.name;
                        return (
                          <button
                            key={mod.name}
                            onClick={() => handleModuleSelect(mod)}
                            className={`w-full group flex items-center justify-start px-3 gap-3 py-2 rounded-lg transition-all mt-1
                              ${isActive ? 'bg-amber-400/90 text-slate-900 font-semibold' : 'text-blue-900 hover:bg-slate-50'}`}
                            title={mod.name}
                          >
                            <span className={`shrink-0 ${isActive ? 'text-slate-900' : 'text-blue-900'}`}>{mod.icon}</span>
                            <span className="text-[0.98rem] leading-tight text-left">{mod.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Otros módulos que no estén en los grupos definidos */}
            {modules.filter((m) => ![
              'Intranet','Planificación','Recursos de Aprendizaje','Interdisciplinario','Inclusión',
              'Evaluaciones Formativas','Actividades Remotas','SIMCE',
              'Análisis Taxonómico','Mis Acompañamientos','Desarrollo Profesional',
              
            ].includes(m.name)).length > 0 && (
              <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 text-sm font-semibold text-blue-900">Otros</div>
                <div className="px-2 pb-2">
                  {modules
                    .filter((m) => ![
                      'Intranet','Planificación','Recursos de Aprendizaje','Interdisciplinario','Inclusión',
                      'Evaluaciones Formativas','Actividades Remotas','SIMCE',
                      'Análisis Taxonómico','Mis Acompañamientos','Desarrollo Profesional',
                      
                    ].includes(m.name))
                    .map((mod) => {
                      const isActive = activeModule?.name === mod.name;
                      return (
                        <button
                          key={mod.name}
                          onClick={() => handleModuleSelect(mod)}
                          className={`w-full group flex items-center justify-start px-3 gap-3 py-2 rounded-lg transition-all mt-1
                              ${isActive ? 'bg-amber-400/90 text-slate-900 font-semibold' : 'text-blue-900 hover:bg-slate-50'}`}
                          title={mod.name}
                        >
                          <span className={`shrink-0 ${isActive ? 'text-slate-900' : 'text-blue-900'}`}>{mod.icon}</span>
                          <span className="text-[0.98rem] leading-tight text-left">{mod.name}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        ) : profile === Profile.SUBDIRECCION && !isSidebarCollapsed ? (
          <div className="space-y-3">
            {[
              {
                id: 'sd_gestion',
                title: 'Gestión',
                items: [
                  'Intranet',
                  'Administración',
                  'Registro de inasistencias y reemplazos docentes',
                  'Cargas horarias',
                  'Seguimiento de acciones pedagógicas',
                ],
              },
              {
                id: 'sd_planificacion',
                title: 'Planificación',
                items: ['Planificación', 'Seguimiento Curricular', 'Interdisciplinario', 'Inclusión'],
              },
              {
                id: 'sd_reflexion',
                title: 'Reflexión',
                items: ['Acompañamiento docente', 'Análisis Taxonómico', 'Dashboard'],
              },
              {
                id: 'sd_herramientas',
                title: 'Herramientas',
                items: ['Documentación', 'Calendario Académico'],
              },
            ].map((grp) => {
              const isOpen = !!expandedSidebarGroups[grp.id];
              const groupModules = grp.items
                .map((name) => modules.find((m) => m.name === name))
                .filter(Boolean) as Module[];
              if (groupModules.length === 0) return null;
              return (
                <div key={grp.id} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
                    onClick={() => setExpandedSidebarGroups((p) => ({ ...p, [grp.id]: !p[grp.id] }))}
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold text-blue-900">{grp.title}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2">
                      {groupModules.map((mod) => {
                        const isActive = activeModule?.name === mod.name;
                        return (
                          <button
                            key={mod.name}
                            onClick={() => handleModuleSelect(mod)}
                            className={`w-full group flex items-center justify-start px-3 gap-3 py-2 rounded-lg transition-all mt-1
                              ${isActive ? 'bg-amber-400/90 text-slate-900 font-semibold' : 'text-blue-900 hover:bg-slate-50'}`}
                            title={mod.name}
                          >
                            <span className={`shrink-0 ${isActive ? 'text-slate-900' : 'text-blue-900'}`}>{mod.icon}</span>
                            <span className="text-[0.98rem] leading-tight text-left">{mod.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Otros no agrupados (p. ej., SIMCE) */}
            {modules.filter((m) => ![
              'Intranet',
              'Administración',
              'Registro de inasistencias y reemplazos docentes',
              'Cargas horarias',
              'Seguimiento de acciones pedagógicas',
              'Seguimiento Curricular',
              'Interdisciplinario',
              'Inclusión',
              'Acompañamiento docente',
              'Análisis Taxonómico',
              'Dashboard',
              'Calendario Académico',
              
            ].includes(m.name)).length > 0 && (
              <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 text-sm font-semibold text-blue-900">Otros</div>
                <div className="px-2 pb-2">
                  {modules
                    .filter((m) => ![
                      'Intranet',
                      'Administración',
                      'Registro de inasistencias y reemplazos docentes',
                      'Cargas horarias',
                      'Seguimiento de acciones pedagógicas',
                      'Seguimiento Curricular',
                      'Interdisciplinario',
                      'Inclusión',
                      'Acompañamiento docente',
                      'Análisis Taxonómico',
                      'Dashboard',
                      'Calendario Académico',
                      
                    ].includes(m.name))
                    .map((mod) => {
                      const isActive = activeModule?.name === mod.name;
                      return (
                        <button
                          key={mod.name}
                          onClick={() => handleModuleSelect(mod)}
                          className={`w-full group flex items-center justify-start px-3 gap-3 py-2 rounded-lg transition-all mt-1
                              ${isActive ? 'bg-amber-400/90 text-slate-900 font-semibold' : 'text-blue-900 hover:bg-slate-50'}`}
                          title={mod.name}
                        >
                          <span className={`shrink-0 ${isActive ? 'text-slate-900' : 'text-blue-900'}`}>{mod.icon}</span>
                          <span className="text-[0.98rem] leading-tight text-left">{mod.name}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        ) : profile === Profile.COORDINACION_TP && !isSidebarCollapsed ? (
          <div className="space-y-3">
            {[
              {
                id: 'coord_gestion',
                title: 'Gestión',
                items: [
                  'Seguimiento Dual',
                  'Asistencia Dual',
                  'Gestión de Empresas',
                  'Pañol',
                ],
              },
              {
                id: 'coord_formacion',
                title: 'Formación',
                items: [
                  'Alternancia TP',
                  'Desarrollo Profesional',
                  'Evaluación de Ensayo',
                  'SIMCE',
                ],
              },
              {
                id: 'coord_utilidades',
                title: 'Utilidades',
                items: [
                  'Documentación',
                  'Calendario Académico',
                  
                  'Multicopias',
                ],
              },
            ].map((grp) => {
              const isOpen = !!expandedSidebarGroups[grp.id];
              const groupModules = grp.items
                .map((name) => modules.find((m) => m.name === name))
                .filter(Boolean) as Module[];

              if (groupModules.length === 0) return null;

              return (
                <div key={grp.id} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
                    onClick={() => setExpandedSidebarGroups((p) => ({ ...p, [grp.id]: !p[grp.id] }))}
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold text-blue-900">{grp.title}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2">
                      {groupModules.map((mod) => {
                        const isActive = activeModule?.name === mod.name;
                        return (
                          <button
                            key={mod.name}
                            onClick={() => handleModuleSelect(mod)}
                            className={`w-full group flex items-center justify-start px-3 gap-3 py-2 rounded-lg transition-all mt-1
                              ${isActive ? 'bg-amber-400/90 text-slate-900 font-semibold' : 'text-blue-900 hover:bg-slate-50'}`}
                            title={mod.name}
                          >
                            <span className={`shrink-0 ${isActive ? 'text-slate-900' : 'text-blue-900'}`}>{mod.icon}</span>
                            <span className="text-[0.98rem] leading-tight text-left">{mod.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Lista plana (colapsado o no PROFESORADO)
          <div
            className="space-y-1"
            onKeyDown={(e) => {
              const idx = itemRefs.current.findIndex((el) => el === document.activeElement);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = Math.min((idx === -1 ? 0 : idx + 1), itemRefs.current.length - 1);
                itemRefs.current[next]?.focus();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = Math.max((idx === -1 ? 0 : idx - 1), 0);
                itemRefs.current[prev]?.focus();
              } else if (e.key === 'Enter' && idx >= 0) {
                itemRefs.current[idx]?.click();
              }
            }}
          >
            {modules.map((mod, i) => {
              const isActive = activeModule?.name === mod.name;
              return (
                <button
                  key={mod.name}
                  ref={(el) => (itemRefs.current[i] = el)}
                  onClick={() => handleModuleSelect(mod)}
                  className={`w-full group flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start px-4'} gap-3 py-3 rounded-xl transition-all
                    ${isActive ? 'bg-amber-400/90 text-slate-900 font-semibold' : 'text-blue-900 hover:bg-slate-50'}`}
                  title={isSidebarCollapsed ? mod.name : undefined}
                >
                  <span className={`shrink-0 ${isActive ? 'text-slate-900' : 'text-blue-900'}`}>{mod.icon}</span>
                  {!isSidebarCollapsed && (
                    <span className="text-[1.05rem] leading-tight whitespace-normal break-words text-left">{mod.name}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );

  const renderContent = () => {
    if (!activeModule) {
      return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 h-full w-full flex items-center justify-center">
          <p className="text-slate-500 dark:text-slate-400 text-lg">Seleccione un módulo del menú para comenzar.</p>
        </div>
      );
    }

    // ===== Módulos comunes =====
  if (activeModule.name === 'Intranet') return <Intranet currentUser={currentUser} />;
    // Bloquear acceso a Documentación para estudiantes aunque intenten acceder por deep-link o estado previo
    if (activeModule.name === 'Documentación' && profile !== Profile.ESTUDIANTE) return <Documentacion currentUser={currentUser} />;
    if (activeModule.name === 'Calendario Académico') return <CalendarioAcademico profile={profile} />;
    
    
    
    if (activeModule.name === 'Desarrollo Profesional') return <DesarrolloProfesionalDocente currentUser={currentUser} />;

    // ===== Por perfil =====
    if (profile === Profile.SUBDIRECCION) {
      if (activeModule.name === 'Dashboard') return <DashboardSubdireccion currentUser={currentUser} />;
      if (activeModule.name === 'Administración') return <Administracion />;
      if (activeModule.name === 'Planificación') return <PlanificacionDocente currentUser={currentUser} />;
      if (activeModule.name === 'Multicopias') return <Multicopias currentUser={currentUser} />;
      if (activeModule.name === 'Evaluación de Ensayo') return <EvaluacionEnsayo currentUser={currentUser} />;
      if (activeModule.name === 'Seguimiento Curricular') return <SeguimientoCurricular currentUser={currentUser} />;
      if (activeModule.name === 'Acompañamiento docente') return <AcompanamientoDocente currentUser={currentUser} />;
      if (activeModule.name === 'Análisis Taxonómico') return <AnalisisTaxonomico currentUser={currentUser} />;
  if (activeModule.name === 'SIMCE') return <SimceFixed currentUser={currentUser} />;
      if (activeModule.name === 'Interdisciplinario') return <Interdisciplinario />;
      if (activeModule.name === 'Registro de inasistencias y reemplazos docentes') return <RegistroReemplazos currentUser={currentUser} />;
      if (activeModule.name === 'Cargas horarias') return <CrearHorarios />;
      if (activeModule.name === 'Seguimiento de acciones pedagógicas') return <SeguimientoAcciones />;
      if (activeModule.name === 'Inclusión') return <Inclusion currentUser={currentUser} />;
    }

    if (profile === Profile.PROFESORADO) {
      if (activeModule.name === 'Planificación') return <PlanificacionDocente currentUser={currentUser} />;
      if (activeModule.name === 'Mis Acompañamientos') return <AcompanamientoDocenteProfesor currentUser={currentUser} />;
      if (activeModule.name === 'Recursos de Aprendizaje') return <RecursosAprendizaje />;
      if (activeModule.name === 'Multicopias') return <Multicopias currentUser={currentUser} />;
  if (activeModule.name === 'Análisis Taxonómico') return <AnalisisTaxonomico currentUser={currentUser} />;
  if (activeModule.name === 'SIMCE') return <SimceFixed currentUser={currentUser} />;
      if (activeModule.name === 'Interdisciplinario') return <Interdisciplinario />;
      if (activeModule.name === 'Inclusión') return <Inclusion currentUser={currentUser} />;
      if (activeModule.name === 'Actividades Remotas') return <ActividadesRemotas />;
  if (activeModule.name === 'Evaluación de Ensayo') return <EvaluacionEnsayo currentUser={currentUser} />;
      if (activeModule.name === 'Evaluaciones Formativas') return <EvaluacionesFormativas currentUser={currentUser} />;
    }

    if (profile === Profile.COORDINACION_TP) {
      if (activeModule.name === 'Seguimiento Dual') return <SeguimientoDual />;
      if (activeModule.name === 'Asistencia Dual') return <AsistenciaDual />;
      if (activeModule.name === 'Pañol') return <Panol />;
      if (activeModule.name === 'Multicopias') return <Multicopias currentUser={currentUser} />;
  if (activeModule.name === 'Evaluación de Ensayo') return <EvaluacionEnsayo currentUser={currentUser} />;
  if (activeModule.name === 'SIMCE') return <SimceFixed currentUser={currentUser} />;
      if (activeModule.name === 'Gestión de Empresas') return <GestionEmpresas />;
      if (activeModule.name === 'Alternancia TP') return <AlternanciaTP />;
    }

    if (profile === Profile.ESTUDIANTE) {
      if (activeModule.name === 'Auto-aprendizaje') return <Autoaprendizaje currentUser={currentUser} />;
      if (activeModule.name === 'Evaluación Formativa') return <EvaluacionFormativaEstudiante currentUser={currentUser} />;
      if (activeModule.name === 'Tareas Interdisciplinarias') return <TareasInterdisciplinariasEstudiante currentUser={currentUser} />;
  if (activeModule.name === 'SIMCE') return <SimceFixed currentUser={currentUser} />;
      if (activeModule.name === 'Asistencia a Empresa') return <AsistenciaEmpresa currentUser={currentUser} />;
    }

    // Fallback
    return (
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 h-full w-full animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-6">{activeModule.name}</h1>
        <div className="border-l-4 border-amber-400 pl-4">
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Aquí irá la funcionalidad de <span className="font-semibold">{activeModule.name}</span>.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <TopBar
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={handleNavigate}
        onUserUpdate={onUserUpdate}
        onChangeProfile={onChangeProfile}
        canChangeProfile={canChangeProfile}
        toggleSidebar={() => setSidebarOpen((s) => !s)}
        unreadMessagesCount={unreadMessagesCount}
        refreshUnreadCount={refreshUnreadCount}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Capa para mobile */}
        {isSidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-20 md:hidden"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed md:relative z-30 inset-y-0 left-0 ${isSidebarCollapsed ? 'w-16' : 'w-72'} 
          bg-white text-blue-900 flex flex-col transform md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          transition-all duration-300 ease-in-out border-r border-slate-200`}
        >
          <SidebarContent />
        </aside>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto">
          <div className="relative p-5 md:p-8 space-y-6">
            {/* Header del módulo activo */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
                  onClick={() => setSidebarOpen(true)}
                  title="Abrir menú"
                >
                  <Menu className="w-5 h-5" />
                </button>
                {activeModule?.icon && (
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {activeModule.icon}
                  </span>
                )}
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {activeModule?.name ?? 'Dashboard'}
                </h2>
              </div>
            </div>

            {/* Contenido del módulo */}
            <div className="min-h-[60vh]">{renderContent()}</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
