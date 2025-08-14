import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Profile, Module, User } from './types';
import { MODULES_BY_PROFILE, LirLogoIcon, LogoutIcon, MenuIcon } from '../constants';
  const profesorNames = useMemo(() => 
    profesores.map(p => p.nombreCompleto).sort(), 
    [profesores]
  );

  return { profesores, profesorNames, loading };
};



// Component imports
// LÍNEA CORRECTA
import TopBar from './TopBar';
import RegistroReemplazos from './components/modules/RegistroReemplazos';
import DashboardSubdireccion from './components/modules/DashboardSubdireccion';
import CrearHorarios from './components/modules/CrearHorarios';
import SeguimientoAcciones from './components/modules/SeguimientoAcciones';
import PlanificacionDocente from './components/modules/PlanificacionDocente';
import CalendarioAcademico from './components/modules/CalendarioAcademico';
import MuroAnuncios from './components/modules/MuroAnuncios';
import GeneradorActas from './components/modules/GeneradorActas';
import EvaluacionAprendizajes from './components/modules/EvaluacionAprendizajes';
import Administracion from './components/modules/Administracion';
import SeguimientoDual from './components/modules/SeguimientoDual';
import ActividadesRemotas from './components/modules/ActividadesRemotas';
import Autoaprendizaje from './components/modules/Autoaprendizaje';
import Inclusion from './components/modules/Inclusion';
import AsistenciaEmpresa from './components/modules/AsistenciaEmpresa';
import AsistenciaDual from './components/modules/AsistenciaDual';
import EvaluacionesFormativas from './components/modules/EvaluacionesFormativas';
import AcompanamientoDocente from './components/modules/AcompanamientoDocente';
import MensajeriaInterna from './components/modules/MensajeriaInterna';
import Interdisciplinario from './components/modules/Interdisciplinario';
import Panol from './components/modules/Panol';
import RecursosAprendizaje from './components/modules/RecursosAprendizaje';
import EvaluacionFormativaEstudiante from './components/modules/EvaluacionFormativaEstudiante';
import TareasInterdisciplinariasEstudiante from './components/modules/TareasInterdisciplinariasEstudiante';
import AcompanamientoDocenteProfesor from './components/modules/AcompanamientoDocenteProfesor';
import SeguimientoCurricular from './components/modules/SeguimientoCurricular';
import AnalisisTaxonomico from './components/modules/AnalisisTaxonomico';
import DesarrolloProfesionalDocente from './components/modules/DesarrolloProfesionalDocente';

interface DashboardProps {
    currentUser: User;
    onLogout: () => void;
    onUserUpdate: (updatedUser: User) => void;
    onChangeProfile: () => void;
    unreadMessagesCount: number;
    refreshUnreadCount: () => void;
}

/**
 * Normaliza el nombre de un curso a un formato estándar (ej: "1ºA").
 * Elimina espacios, estandariza ordinales y capitaliza la letra final.
 */
const normalizeCurso = (curso: string): string => {
    if (!curso) return '';
    let normalized = curso.trim().toLowerCase();
    
    // Estandarizar el símbolo de grado (°) al ordinal masculino (º)
    normalized = normalized.replace(/°/g, 'º');

    // Reemplazar " medio", etc.
    normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
    // Reemplazar 1ro, 2do, 3ro, 4to con 1º, 2º, 3º, 4º
    normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
    // Asegura que haya un símbolo de grado si no lo hay
    normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
    // Elimina todos los espacios y pone en mayúscula la parte de la letra
    normalized = normalized.replace(/\s+/g, '').toUpperCase();
    return normalized;
};


const Dashboard: React.FC<DashboardProps> = ({ currentUser, onLogout, onUserUpdate, onChangeProfile, unreadMessagesCount, refreshUnreadCount }) => {
    const profile = currentUser.profile;
    
    const modules = useMemo(() => {
        const baseModules = MODULES_BY_PROFILE[profile];

        if (profile !== Profile.ESTUDIANTE) {
            return baseModules;
        }
        
        // For students, filter the 'Asistencia a Empresa' module
        return baseModules.filter(module => {
            if (module.name === 'Asistencia a Empresa') {
                const normalized = normalizeCurso(currentUser.curso || '');
                return normalized.startsWith('3º') || normalized.startsWith('4º');
            }
            return true;
        });

    }, [profile, currentUser.curso]);

    const [activeModule, setActiveModule] = useState<Module | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        if (modules && modules.length > 0) {
            setActiveModule(modules[0]);
        } else {
            setActiveModule(null);
        }
    }, [profile, modules]);

    const handleModuleSelect = useCallback((mod: Module) => {
        setActiveModule(mod);
        if (window.innerWidth < 768) { // md breakpoint
            setSidebarOpen(false);
        }
    }, []);
    
    const handleNavigate = useCallback((moduleName: string) => {
        const moduleToNavigate = modules.find(m => m.name === moduleName);
        if(moduleToNavigate) {
            handleModuleSelect(moduleToNavigate);
        }
    }, [modules, handleModuleSelect]);

    const SidebarContent = () => (
         <>
            <div className="flex items-center justify-center h-16 border-b border-slate-700 px-4 flex-shrink-0">
                <LirLogoIcon />
                <span className="ml-3 text-white font-bold text-xl whitespace-nowrap">Gestión LIR</span>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto sidebar-scroll">
                {modules.map((mod) => (
                    <button 
                        key={mod.name} 
                        onClick={() => handleModuleSelect(mod)} 
                        className={`w-full flex items-center py-3 px-4 rounded-lg transition-colors duration-200 text-left ${activeModule?.name === mod.name ? 'bg-slate-900 text-amber-400 font-semibold' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                    >
                        {mod.icon}
                        <span className="ml-4">{mod.name}</span>
                    </button>
                ))}
            </nav>
        </>
    );

    const renderContent = () => {
        if (!activeModule) {
            return (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md h-full w-full flex items-center justify-center">
                    <p className="text-slate-500 dark:text-slate-400 text-xl">Seleccione un módulo del menú para comenzar.</p>
                </div>
            );
        }
        
        // Módulos compartidos
        if (activeModule.name === 'Calendario Académico') return <CalendarioAcademico profile={profile} />;
        if (activeModule.name === 'Muro de Anuncios') return <MuroAnuncios currentUser={currentUser} />;
        if (activeModule.name === 'Mensajería Interna') return <MensajeriaInterna currentUser={currentUser} refreshUnreadCount={refreshUnreadCount} />;
        if (activeModule.name === 'Generador de Actas') return <GeneradorActas />;

        if (profile === Profile.SUBDIRECCION) {
            if (activeModule.name === 'Dashboard') {
    console.log('=== DASHBOARD PRINCIPAL DEBUG ===');
    console.log('🔍 Dashboard principal - currentUser antes de pasar:', currentUser);
    console.log('🔍 Dashboard principal - profile del usuario:', currentUser?.profile);
    console.log('🔍 Dashboard principal - email del usuario:', currentUser?.email);
    console.log('=====================================');
    return <DashboardSubdireccion currentUser={currentUser} />;
}
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
            if (activeModule.name === 'Análisis Taxonómico') return <AnalisisTaxonomico currentUser={currentUser} />;
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
        }

        if (profile === Profile.ESTUDIANTE) {
            if (activeModule.name === 'Auto-aprendizaje') return <Autoaprendizaje currentUser={currentUser} />;
            if (activeModule.name === 'Evaluación Formativa') return <EvaluacionFormativaEstudiante currentUser={currentUser} />;
            if (activeModule.name === 'Tareas Interdisciplinarias') return <TareasInterdisciplinariasEstudiante currentUser={currentUser} />;
            if (activeModule.name === 'Asistencia a Empresa') return <AsistenciaEmpresa currentUser={currentUser} />;
        }

        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md h-full w-full animate-fade-in">
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
        <div className="h-screen flex flex-col bg-slate-100">
            <TopBar 
                currentUser={currentUser}
                onLogout={onLogout}
                onNavigate={handleNavigate}
                onUserUpdate={onUserUpdate}
                onChangeProfile={onChangeProfile}
                toggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
                unreadMessagesCount={unreadMessagesCount}
                refreshUnreadCount={refreshUnreadCount}
            />
            
            <div className="flex-1 flex overflow-hidden">
                {/* Overlay for mobile */}
                {isSidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"></div>}

                {/* Sidebar */}
                <aside className={`fixed md:relative z-30 inset-y-0 left-0 w-72 bg-slate-800 text-white flex flex-col transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
                    <SidebarContent />
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 md:p-8">
                       {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;