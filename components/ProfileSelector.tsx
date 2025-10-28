import React from 'react';
import { Profile } from '../types';
import { PROFILES, MainLogo } from '../constants';

interface ProfileSelectorProps {
  onSelectProfile: (profile: Profile) => void;
  isAdminView?: boolean;
  /** Lista opcional de perfiles permitidos para mostrar en la selección */
  allowedProfiles?: Profile[];
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({ onSelectProfile, isAdminView = false, allowedProfiles }) => {
  // Construimos un mapa id -> item para evitar problemas de comparación y mantener orden deseado
  const mapById = React.useMemo(() => new Map(PROFILES.map(p => [p.id, p])), []);
  const items = React.useMemo(() => {
    if (allowedProfiles && allowedProfiles.length > 0) {
      return allowedProfiles.map(id => mapById.get(id)).filter(Boolean) as typeof PROFILES;
    }
    return PROFILES;
  }, [allowedProfiles, mapById]);
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden
                    bg-gradient-to-br from-blue-50 via-blue-100 to-yellow-50
                    dark:from-slate-900 dark:via-slate-950 dark:to-black">

      {/* blobs de color difuminado detrás */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full blur-3xl opacity-40
                        bg-gradient-to-tr from-yellow-300 to-yellow-200
                        dark:from-yellow-400/20 dark:to-yellow-500/20" />
        <div className="absolute top-40 -right-10 h-80 w-80 rounded-full blur-3xl opacity-40
                        bg-gradient-to-tr from-blue-300 to-sky-300
                        dark:from-blue-500/20 dark:to-sky-500/20" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full blur-3xl opacity-30
                        bg-gradient-to-tr from-sky-200 to-blue-200
                        dark:from-sky-500/20 dark:to-blue-500/20" />
      </div>

      {/* encabezado */}
      <div className="text-center mb-10">
        <div className="mb-4 flex justify-center items-center">
          <MainLogo />
        </div>
        <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mt-2 drop-shadow-sm">
          Gestión Pedagógica LIR
        </h1>
        <p className="text-slate-700/80 dark:text-slate-300/80 mt-2 text-lg">
          {isAdminView
            ? "Como administrador, seleccione el perfil que desea visualizar:"
            : "Seleccione su perfil para continuar"}
        </p>
      </div>

      {/* grid de perfiles con glassmorphism */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl">
        {items.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectProfile(p.id)}
            className="group relative overflow-hidden p-8 rounded-2xl
                       bg-white/10 dark:bg-white/5
                       backdrop-blur-xl border border-white/30 dark:border-white/10
                       shadow-lg hover:shadow-2xl hover:-translate-y-1.5
                       transition-all duration-300 ease-out
                       focus:outline-none focus:ring-4 focus:ring-yellow-400/40"
          >
            {/* brillo sutil al pasar el mouse */}
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100
                            transition-opacity duration-300
                            bg-gradient-to-br from-white/40 to-transparent" />
            <div className="text-slate-800 dark:text-slate-200 group-hover:text-yellow-500 transition-colors duration-300">
              {p.icon}
            </div>
            <h2 className="text-xl font-semibold mt-4 text-slate-900 dark:text-slate-100 drop-shadow-[0_1px_0_rgba(0,0,0,0.1)]">
              {p.label}
            </h2>
          </button>
        ))}
      </div>

      <footer className="absolute bottom-4 text-slate-600 dark:text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} Liceo Industrial de Recoleta. Todos los derechos reservados.
      </footer>
    </div>
  );
};

export default ProfileSelector;
