import React from 'react';
import { Profile, User } from '../types';
import TopBar from './TopBar';

// Interfaz para la estructura de un módulo individual
interface Module {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

// Interfaz para las propiedades que recibe el componente ModuleSelector
interface ModuleSelectorProps {
  currentUser: User;
  onModuleSelect: (module: string) => void;
  onLogout: () => void;
  onChangeProfile?: () => void;
  canChangeProfile?: boolean;
}

const ModuleSelector: React.FC<ModuleSelectorProps> = ({
  currentUser,
  onModuleSelect,
  onLogout,
  onChangeProfile,
  canChangeProfile
}) => {
  
  // Función para obtener la lista de módulos según el perfil del usuario
  const getModulesForProfile = (profile: Profile): Module[] => {
    
    // Módulos comunes a la mayoría de los perfiles
    const commonModules: Module[] = [
      { id: 'muro', name: 'Muro de Anuncios', icon: '🔔' },
      { id: 'calendario', name: 'Calendario Académico', icon: '📅' }
    ];

    // Definición del módulo de Alternancia TP para poder reutilizarlo
    const alternanciaTPModule: Module = {
      id: 'alternancia_tp',
      name: 'Alternancia TP',
      icon: '🏢',
      description: 'Gestiona y monitorea programas de formación en alternancia (liceo-empresa).'
    };

    // Estructura switch para devolver los módulos específicos de cada perfil
    switch (profile) {
      case Profile.PROFESORADO:
        return [
          { id: 'selector_completo', name: 'Vista Completa (Dashboard)', icon: '📊', description: 'Acceso a todos los módulos con navegación lateral' },
          alternanciaTPModule,
          { id: 'planificacion', name: 'Planificación', icon: '📖' },
          { id: 'acompañamientos', name: 'Mis Acompañamientos', icon: '✅' },
          { id: 'recursos', name: 'Recursos de Aprendizaje', icon: '🧩' },
          { id: 'taxonomico', name: 'Análisis Taxonómico', icon: '🧮' },
          { id: 'interdisciplinario', name: 'Interdisciplinario', icon: '📊' },
          { id: 'inclusion', name: 'Inclusión', icon: '🎓' },
          { id: 'actividades_remotas', name: 'Actividades Remotas', icon: '🧪' },
          { id: 'evaluacion_aprendizajes', name: 'Evaluación de Aprendizajes', icon: '📋' },
          { id: 'evaluaciones_formativas', name: 'Evaluaciones Formativas', icon: '📈' },
          ...commonModules,
          { id: 'actas', name: 'Generador de Actas', icon: '📋' },
          { id: 'mensajeria', name: 'Mensajería Interna', icon: '💬' }
        ];
      
      case Profile.COORDINACION:
        return [
          { id: 'selector_completo', name: 'Vista Completa (Dashboard)', icon: '📊', description: 'Acceso a todos los módulos con navegación lateral' },
          alternanciaTPModule,
          { id: 'seguimiento_dual', name: 'Seguimiento Dual', icon: '📈' },
          { id: 'asistencia_dual', name: 'Asistencia Dual', icon: '🕐' },
          { id: 'pañol', name: 'Pañol', icon: '🔧' },
          { id: 'gestion_empresas', name: 'Gestión de Empresas', icon: '🏢' },
          ...commonModules,
          { id: 'mensajeria', name: 'Mensajería Interna', icon: '💬' },
          { id: 'actas', name: 'Generador de Actas', icon: '📋' }
        ];

      case Profile.SUBDIRECCION:
        return [
          { id: 'selector_completo', name: 'Vista Completa (Dashboard)', icon: '📊', description: 'Acceso a todos los módulos con navegación lateral' },
          alternanciaTPModule,
          { id: 'administracion', name: 'Administración', icon: '⚙️' },
          { id: 'seguimiento_curricular', name: 'Seguimiento Curricular', icon: '📋' },
          { id: 'acompañamiento_docente', name: 'Acompañamiento Docente', icon: '👥' },
          { id: 'taxonomico', name: 'Análisis Taxonómico', icon: '🧮' },
          { id: 'interdisciplinario', name: 'Interdisciplinario', icon: '📊' },
          { id: 'registro_inasistencias', name: 'Registro de Inasistencias y Reemplazos Docentes', icon: '📄' },
          { id: 'crear_horarios', name: 'Crear Horarios', icon: '🕐' },
          { id: 'seguimiento_acciones', name: 'Seguimiento de Acciones Pedagógicas', icon: '📈' },
          { id: 'inclusion', name: 'Inclusión', icon: '🎓' },
          ...commonModules
        ];

      case Profile.ESTUDIANTES:
        return [
          { id: 'selector_completo', name: 'Vista Completa (Dashboard)', icon: '📊', description: 'Acceso a todos los módulos con navegación lateral' },
          { id: 'auto_aprendizaje', name: 'Auto-aprendizaje', icon: '📖' },
          { id: 'evaluacion_formativa', name: 'Evaluación Formativa', icon: '📈' },
          { id: 'tareas_interdisciplinarias', name: 'Tareas Interdisciplinarias', icon: '📊' },
          ...commonModules,
          { id: 'mensajeria', name: 'Mensajería Interna', icon: '💬' }
        ];

      default:
        return commonModules;
    }
  };

  // Se obtienen los módulos para el perfil del usuario actual
  const modules = getModulesForProfile(currentUser.profile);

  // Función para obtener el nombre legible del perfil
  const getProfileDisplayName = (profile: Profile): string => {
    switch (profile) {
      case Profile.PROFESORADO:
        return 'Profesorado';
      case Profile.COORDINACION:
        return 'Coordinación';
      case Profile.SUBDIRECCION:
        return 'Subdirección';
      case Profile.ESTUDIANTES:
        return 'Estudiantes';
      default:
        return 'Usuario';
    }
  };

  // Renderización del componente JSX
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <TopBar
        currentUser={currentUser}
        onLogout={onLogout}
        onChangeProfile={onChangeProfile}
        canChangeProfile={canChangeProfile}
        title="Seleccionar Módulo"
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
            Seleccionar Módulo
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Perfil: <span className="font-semibold text-amber-600">{getProfileDisplayName(currentUser.profile)}</span>
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {modules.map((module) => (
            <div
              key={module.id}
              onClick={() => onModuleSelect(module.id)}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="p-6">
                <div className="text-4xl mb-4 text-center">
                  {module.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 text-center mb-2">
                  {module.name}
                </h3>
                {module.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                    {module.description}
                  </p>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-700 px-6 py-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  Hacer clic para acceder
                </div>
              </div>
            </div>
          ))}
        </div>

        {modules.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🚫</div>
            <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Sin módulos disponibles
            </h3>
            <p className="text-slate-500 dark:text-slate-500">
              No hay módulos configurados para tu perfil actual.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleSelector;