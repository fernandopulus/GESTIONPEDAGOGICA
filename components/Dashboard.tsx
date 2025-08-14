
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
import MuroAnuncios from './modules/MuroAnuncios';
import GeneradorActas from './modules/GeneradorActas';
import EvaluacionAprendizajes from './modules/EvaluacionAprendizajes';
import Administracion from './modules/Administracion';
import SeguimientoDual from './modules/SeguimientoDual';
import ActividadesRemotas from './modules/ActividadesRemotas';
import Autoaprendizaje from './modules/Autoaprendizaje';
import Inclusion from './modules/Inclusion';
import AsistenciaEmpresa from './modules/AsistenciaEmpresa';
import AsistenciaDual from './modules/AsistenciaDual';
import EvaluacionesFormativas from './modules/EvaluacionesFormativas';
import AcompanamientoDocente from './modules/AcompanamientoDocente';
import MensajeriaInterna from './modules/MensajeriaInterna';
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

// UI
import { Menu, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';

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
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (modules && modules.length > 0) {
      setActiveModule(modules[0]);
    } else {
      setActiveModule(null);
    }
  }, [profile, modules]);

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

  // ===== Sidebar con estilo emulado =====
  const SidebarContent: React.FC = () => (
    <>
      {/* Header */}
      <div className="flex items-center h-20 px-4 border-b border-white/10 bg-[#121926]">
        <div className="flex items-center gap-3">
          {/* Círculo amarillo + ícono forzado a currentColor */}
          <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center shadow-inner">
            <span className="text-slate-900 inline-flex items-center justify-center">
              {/* Si tu LirLogoIcon usa currentColor, tomará el color anterior.
                 Además le pasamos className para tamaño controlado. */}
              <LirLogoIcon className="w-5 h-5" />
            </span>
          </div>
          {!isSidebarCollapsed && (
            <span className="text-white font-extrabold text-xl tracking-tight">Gestión LIR</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSidebarCollapsed((s) => !s)}
          className="ml-auto w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-white/10 transition"
          title={isSidebarCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-5 h-5 text-slate-200" /> : <ChevronLeft className="w-5 h-5 text-slate-200" />}
        </button>
      </div>

      {/* Lista plana de módulos */}
      <nav
        className="flex-1 overflow-y-auto p-3 bg-[#1B2433]"
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
        <div className="space-y-1">
          {modules.map((mod, i) => {
            const isActive = activeModule?.name === mod.name;
            return (
              <button
                key={mod.name}
                ref={(el) => (itemRefs.current[i] = el)}
                onClick={() => handleModuleSelect(mod)}
                className={`w-full group flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start px-4'} gap-3 py-3 rounded-2xl transition-all
                  ${isActive
                    ? 'bg-amber-400 text-slate-900 font-bold shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                title={isSidebarCollapsed ? mod.name : undefined}
              >
                <span className={`shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-300 group-hover:text-white'}`}>
                  {mod.icon}
                </span>
                {!isSidebarCollapsed && (
                  <span className="text-[1.05rem] leading-tight whitespace-normal break-words text-left">
                    {mod.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );

  const renderContent = () => {
    if (!activeModule) {
      return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-md h-full w-full flex items-center justify-center">
          <p className="text-slate-500 dark:text-slate-400 text-lg">Seleccione un módulo del menú para comenzar.</p>
        </div>
      );
    }

    // ===== Módulos comunes =====
    if (activeModule.name === 'Calendario Académico') return <CalendarioAcademico profile={profile} />;
    if (activeModule.name === 'Muro de Anuncios') return <MuroAnuncios currentUser={currentUser} />;
    if (activeModule.name === 'Mensajería Interna') return <MensajeriaInterna currentUser={currentUser} refreshUnreadCount={refreshUnreadCount} />;
    if (activeModule.name === 'Generador de Actas') return <GeneradorActas />;
    if (activeModule.name === 'Desarrollo Profesional') return <DesarrolloProfesionalDocente currentUser={currentUser} />;

    // ===== Por perfil =====
    if (profile === Profile.SUBDIRECCION) {
      if (activeModule.name === 'Dashboard') return <DashboardSubdireccion currentUser={currentUser} />;
      if (activeModule.name === 'Administración') return <Administracion />;
      if (activeModule.name === 'Seguimiento Curricular') return <SeguimientoCurricular currentUser={currentUser} />;
      if (activeModule.name === 'Acompañamiento docente') return <AcompanamientoDocente currentUser={currentUser} />;
      if (activeModule.name === 'Análisis Taxonómico') return <AnalisisTaxonomico currentUser={currentUser} />;
      if (activeModule.name === 'Interdisciplinario') return <Interdisciplinario />;
      if (activeModule.name === 'Registro de inasistencias y reemplazos docentes') return <RegistroReemplazos currentUser={currentUser} />;
      if (activeModule.name === 'Crear horarios') return <CrearHorarios />;
      if (activeModule.name === 'Seguimiento de acciones pedagógicas') return <SeguimientoAcciones />;
      if (activeModule.name === 'Inclusión') return <Inclusion currentUser={currentUser} />;
    }

    if (profile === Profile.PROFESORADO) {
      if (activeModule.name === 'Planificación') return <PlanificacionDocente currentUser={currentUser} />;
      if (activeModule.name === 'Mis Acompañamientos') return <AcompanamientoDocenteProfesor currentUser={currentUser} />;
      if (activeModule.name === 'Recursos de Aprendizaje') return <RecursosAprendizaje />;
      if (activeModule.name === 'Análisis Taxonómico') return <AnalisisTaxonómico currentUser={currentUser} />;
      if (activeModule.name === 'Interdisciplinario') return <Interdisciplinario />;
      if (activeModule.name === 'Inclusión') return <Inclusion currentUser={currentUser} />;
      if (activeModule.name === 'Actividades Remotas') return <ActividadesRemotas />;
      if (activeModule.name === 'Evaluación de Aprendizajes') return <EvaluacionAprendizajes />;
      if (activeModule.name === 'Evaluaciones Formativas') return <EvaluacionesFormativas currentUser={currentUser} />;
    }

    if (profile === Profile.COORDINACION_TP) {
      if (activeModule.name === 'Seguimiento Dual') return <SeguimientoDual />;
      if (activeModule.name === 'Asistencia Dual') return <AsistenciaDual />;
      if (activeModule.name === 'Pañol') return <Panol />;
      if (activeModule.name === 'Gestión de Empresas') return <GestionEmpresas />;
      if (activeModule.name === 'Alternancia TP') return <AlternanciaTP />;
    }

    if (profile === Profile.ESTUDIANTE) {
      if (activeModule.name === 'Auto-aprendizaje') return <Autoaprendizaje currentUser={currentUser} />;
      if (activeModule.name === 'Evaluación Formativa') return <EvaluacionFormativaEstudiante currentUser={currentUser} />;
      if (activeModule.name === 'Tareas Interdisciplinarias') return <TareasInterdisciplinariasEstudiante currentUser={currentUser} />;
      if (activeModule.name === 'Asistencia a Empresa') return <AsistenciaEmpresa currentUser={currentUser} />;
    }

    // Fallback
    return (
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-md h-full w-full animate-fade-in">
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
    <div className="h-screen flex flex-col bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900">
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
          bg-[#0F1724] text-white flex flex-col transform md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          transition-all duration-300 ease-in-out border-r border-white/10`}
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
                  className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow hover:shadow-md transition"
                  onClick={() => setSidebarOpen(true)}
                  title="Abrir menú"
                >
                  <Menu className="w-5 h-5" />
                </button>
                {activeModule?.icon && (
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow">
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
