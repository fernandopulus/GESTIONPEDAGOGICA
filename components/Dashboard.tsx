import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Profile, Module, User } from '../types';
import { MODULES_BY_PROFILE, LirLogoIcon } from '../constants';

// Component imports
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
import AnalisisTaxonomico from './modules/AnalisisTaxonomico';
import GestionEmpresas from './modules/GestionEmpresas';
import AlternanciaTP from './modules/AlternanciaTP'; // --- CAMBIO AQUÍ --- (1. Se importa el nuevo módulo)

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
    refreshUnreadCount 
}) => {
    const profile = currentUser.profile;
    
    const modules = useMemo(() => {
        const baseModules = MODULES_BY_PROFILE[profile] || []; // Añadido fallback por si el perfil no existe

        if (profile !== Profile.ESTUDIANTE) {
            return baseModules;
        }
        
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
        if (window.innerWidth < 768) {
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
        
        // Módulos Comunes
        if (activeModule.name === 'Calendario Académico') return <CalendarioAcademico profile={profile} />;
        if (activeModule.name === 'Muro de Anuncios') return <MuroAnuncios currentUser={currentUser} />;
        if (activeModule.name === 'Mensajería Interna') return <MensajeriaInterna currentUser={currentUser} refreshUnreadCount={refreshUnreadCount} />;
        if (activeModule.name === 'Generador de Actas') return <GeneradorActas />;

        // Módulos por Perfil
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
            if (activeModule.name === 'Gestión de Empresas') return <GestionEmpresas />;
            if (activeModule.name === 'Alternancia TP') return <AlternanciaTP />; // --- CAMBIO AQUÍ --- (2. Se renderiza el nuevo módulo)
        }

        if (profile === Profile.ESTUDIANTE) {
            if (activeModule.name === 'Auto-aprendizaje') return <Autoaprendizaje currentUser={currentUser} />;
            if (activeModule.name === 'Evaluación Formativa') return <EvaluacionFormativaEstudiante currentUser={currentUser} />;
            if (activeModule.name === 'Tareas Interdisciplinarias') return <TareasInterdisciplinariasEstudiante currentUser={currentUser} />;
            if (activeModule.name === 'Asistencia a Empresa') return <AsistenciaEmpresa currentUser={currentUser} />;
        }

        // Fallback por si un módulo no tiene componente asignado aún
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
        <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-900">
            <TopBar 
                currentUser={currentUser}
                onLogout={onLogout}
                onNavigate={handleNavigate}
                onUserUpdate={onUserUpdate}
                onChangeProfile={onChangeProfile}
                canChangeProfile={canChangeProfile}
                toggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
                unreadMessagesCount={unreadMessagesCount}
                refreshUnreadCount={refreshUnreadCount}
            />
            
            <div className="flex-1 flex overflow-hidden">
                {isSidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"></div>}

                <aside className={`fixed md:relative z-30 inset-y-0 left-0 w-72 bg-slate-800 text-white flex flex-col transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
                    <SidebarContent />
                </aside>

                <main className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900">
                    <div className="p-6 md:p-8">
                       {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;