import React from 'react';
import { Profile } from '../types';
import { PROFILES, MainLogo } from '../constants';

interface ProfileSelectorProps {
    onSelectProfile: (profile: Profile) => void;
    isAdminView?: boolean;
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({ onSelectProfile, isAdminView = false }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-100 dark:bg-slate-900">
            <div className="text-center mb-10">
                <div className="mb-4 flex justify-center items-center">
                    <MainLogo />
                </div>
                <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-200 mt-2">Gestión Pedagógica LIR</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg">
                    {isAdminView ? "Como administrador, seleccione el perfil que desea visualizar:" : "Seleccione su perfil para continuar"}
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl">
                {PROFILES.map((p) => (
                    <button 
                        key={p.id} 
                        onClick={() => onSelectProfile(p.id)}
                        className="group bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md hover:shadow-xl hover:-translate-y-2 focus:outline-none focus:ring-4 focus:ring-amber-400 focus:ring-opacity-50 transition-all duration-300 ease-in-out flex flex-col items-center justify-center text-center"
                    >
                        <div className="text-slate-700 dark:text-slate-300 group-hover:text-amber-400 transition-colors duration-300">
                            {p.icon}
                        </div>
                        <h2 className="text-xl font-semibold mt-4 text-slate-800 dark:text-slate-200">{p.label}</h2>
                    </button>
                ))}
            </div>
             <footer className="absolute bottom-4 text-slate-500 dark:text-slate-400 text-sm">
                &copy; {new Date().getFullYear()} Liceo Industrial de Recoleta. Todos los derechos reservados.
            </footer>
        </div>
    );
};

export default ProfileSelector;