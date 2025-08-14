// Ícono de edificio para módulos relacionados
export const BuildingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m5-4h1m-1 4h1" />
  </svg>
);
import React from 'react';
import { Profile, Module, NivelPlanificacion, EstadoAccion, EventType, EvaluacionSubtype, TipoReunion, TipoInstrumento, EscalaCalificacion, PruebaItemTipo, NivelLogro, EstadoSeguimientoDual, TipoActividadRemota, DificultadAprendizaje, Insignia } from './types';

// --- Estilos base ---
export const iconClass = "w-6 h-6";
export const profileIconClass = "w-24 h-24";

// --- ÍCONOS ---
export const MainLogo = () => (
    <img 
        src="https://res.cloudinary.com/dwncmu1wu/image/upload/v1754875084/ChatGPT_Image_10_ago_2025_09_17_50_p.m._t9cbut.png"
        alt="Logo Gestión Pedagógica LIR"
        className="w-32 h-32 object-contain"
    />
);

export const LirLogoIcon = () => (
    <svg className="w-10 h-10 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 2 7h10c0-2 2-4 2-7a7 7 0 0 0-7-7z" />
    </svg>
);

export const LogoutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

export const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

export const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const HomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
export const BellIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
export const MessageSquareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
export const PDFIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
export const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
export const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;

// --- Profile Icons ---
const SubdireccionIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className={profileIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z" />
    </svg>
);
const ProfesoradoIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className={profileIconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
);
const CoordinacionTPIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className={profileIconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.759 6.759 0 010 1.255c-.008.378.137.75.43.99l1.004.828c.421.346.564.95.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.68 6.68 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.68 6.68 0 01-.22-.127c-.325-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.369-.491l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.759 6.759 0 010-1.255c.008-.378-.137-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);
const EstudianteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className={profileIconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0l-2.072-1.036A48.257 48.257 0 0112 10.045a48.258 48.258 0 0110.332-1.036l-2.072 1.036m-16.425 0a48.27 48.27 0 00-2.223 2.218c.958.056 1.91.118 2.857.185m16.425 0c.947-.067 1.9-.129 2.857-.185a48.27 48.27 0 00-2.223-2.218m-12.182 0A11.947 11.947 0 0112 8.636a11.947 11.947 0 014.09 1.511" />
    </svg>
);

// --- Module Icons ---
const ChartBarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const ClipboardListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const ClockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const TrendingUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const DocumentTextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const BookOpenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>;
const PuzzleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>;
const BeakerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
const UserGroupIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const CogIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const AcademicCapIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14v6" /></svg>;
const CheckCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const GlobeAltIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" /></svg>;
const WrenchScrewdriverIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.528-1.036.94-2.197 1.088-3.386l-.7M11.42 15.17l-1.06-1.06a4.5 4.5 0 01-5.656-5.656l-1.06 1.06c-1.37.66-2.58 1.6-3.58 2.75a4.5 4.5 0 00-1.06 5.656l1.06 1.06c1.15.998 2.52 1.93 3.99 2.58l1.06-1.06a4.5 4.5 0 015.656-5.656l3.032 2.496m-3.582-2.58a4.5 4.5 0 00-5.656 5.656l1.06-1.06a4.5 4.5 0 015.656-5.656l1.06 1.06m-3.032-2.496a4.5 4.5 0 00-5.656 5.656l1.06-1.06a4.5 4.5 0 015.656-5.656l1.06 1.06" /></svg>;
const ClipboardCheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
const ClipboardDocumentCheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-1.125 0-2.25 1.125-2.25 2.25v15c0 1.125 1.125 2.25 2.25 2.25h11.25c1.125 0 2.25-1.125 2.25-2.25v-9.75M10.125 2.25c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125h-1.5c-.621 0-1.125-.504-1.125-1.125v-3.375c0-.621.504-1.125 1.125-1.125h1.5zM17.25 10.5h.375c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125h-.375m0-3.75V6.375c0-.621-.504-1.125-1.125-1.125h-1.5c-.621 0-1.125.504-1.125 1.125v3.375c0 .621.504 1.125 1.125 1.125h1.5c.621 0 1.125-.504 1.125-1.125v-1.5m-6.375 5.25v-1.5c0-.621.504-1.125 1.125-1.125h.375c.621 0 1.125.504 1.125 1.125v1.5m0 3.75V16.5c0-.621-.504-1.125-1.125-1.125h-.375a1.125 1.125 0 00-1.125 1.125v1.5m6.375 0V16.5c0-.621-.504-1.125-1.125-1.125h-.375a1.125 1.125 0 00-1.125 1.125v1.5" /></svg>;


// --- Profile Info ---
export const PROFILES = [
    { id: Profile.SUBDIRECCION, label: 'Subdirección Pedagógica', icon: <SubdireccionIcon /> },
    { id: Profile.PROFESORADO, label: 'Profesorado', icon: <ProfesoradoIcon /> },
    { id: Profile.COORDINACION_TP, label: 'Coordinación TP', icon: <CoordinacionTPIcon /> },
    { id: Profile.ESTUDIANTE, label: 'Estudiantes', icon: <EstudianteIcon /> }
];

// --- Modules by Profile ---
export const MODULES_BY_PROFILE: Record<Profile, Module[]> = {
    [Profile.SUBDIRECCION]: [
        { name: 'Dashboard', icon: <ChartBarIcon /> },
        { name: 'Administración', icon: <CogIcon /> },
        { name: 'Seguimiento Curricular', icon: <ClipboardCheckIcon /> },
        { name: 'Acompañamiento docente', icon: <UserGroupIcon /> },
        { name: 'Análisis Taxonómico', icon: <ClipboardDocumentCheckIcon /> },
        { name: 'Interdisciplinario', icon: <GlobeAltIcon /> },
        { name: 'Registro de inasistencias y reemplazos docentes', icon: <ClipboardListIcon /> },
        { name: 'Crear horarios', icon: <ClockIcon /> },
        { name: 'Seguimiento de acciones pedagógicas', icon: <TrendingUpIcon /> },
        { name: 'Inclusión', icon: <AcademicCapIcon /> },
        { name: 'Calendario Académico', icon: <CalendarIcon /> },
        { name: 'Muro de Anuncios', icon: <BellIcon /> },
        { name: 'Mensajería Interna', icon: <MessageSquareIcon /> },
        { name: 'Generador de Actas', icon: <DocumentTextIcon /> },
    ],
    [Profile.PROFESORADO]: [
        { name: 'Planificación', icon: <BookOpenIcon /> },
        { name: 'Mis Acompañamientos', icon: <CheckCircleIcon /> },
        { name: 'Recursos de Aprendizaje', icon: <PuzzleIcon /> },
        { name: 'Análisis Taxonómico', icon: <ClipboardDocumentCheckIcon /> },
        { name: 'Interdisciplinario', icon: <GlobeAltIcon /> },
        { name: 'Inclusión', icon: <AcademicCapIcon /> },
        { name: 'Actividades Remotas', icon: <BeakerIcon /> },
        { name: 'Evaluación de Aprendizajes', icon: <DocumentTextIcon /> },
        { name: 'Evaluaciones Formativas', icon: <TrendingUpIcon /> },
        { name: 'Desarrollo Profesional', icon: <AcademicCapIcon /> },
        { name: 'Calendario Académico', icon: <CalendarIcon /> },
        { name: 'Muro de Anuncios', icon: <BellIcon /> },
        { name: 'Mensajería Interna', icon: <MessageSquareIcon /> },
        { name: 'Generador de Actas', icon: <ClipboardListIcon /> },
    ],
    [Profile.COORDINACION_TP]: [
        { name: 'Seguimiento Dual', icon: <TrendingUpIcon /> },
        { name: 'Asistencia Dual', icon: <ClockIcon /> },
        { name: 'Pañol', icon: <WrenchScrewdriverIcon /> },
        // ✅ AÑADE TU NUEVO MÓDULO AQUÍ
        { name: 'Gestión de Empresas', icon: <BuildingIcon /> },
        { name: 'Calendario Académico', icon: <CalendarIcon /> },
        { name: 'Muro de Anuncios', icon: <BellIcon /> },
        { name: 'Mensajería Interna', icon: <MessageSquareIcon /> },
        { name: 'Alternancia TP', icon: '🔄' }, // Ícono de ciclo o sincronización
        { name: 'Desarrollo Profesional', icon: <AcademicCapIcon /> },
        { name: 'Generador de Actas', icon: <DocumentTextIcon /> },
    ],
    [Profile.ESTUDIANTE]: [
        { name: 'Auto-aprendizaje', icon: <BookOpenIcon /> },
        { name: 'Evaluación Formativa', icon: <TrendingUpIcon /> },
        { name: 'Tareas Interdisciplinarias', icon: <GlobeAltIcon /> },
        { name: 'Asistencia a Empresa', icon: <ClockIcon /> },
        { name: 'Calendario Académico', icon: <CalendarIcon /> },
        { name: 'Muro de Anuncios', icon: <BellIcon /> },
        { name: 'Mensajería Interna', icon: <MessageSquareIcon /> },
    ]
};

// ... Resto de las constantes ...
export const AREAS_PEDAGOGICAS = ['Currículum y Evaluación', 'Convivencia Escolar', 'Orientación', 'Gestión Pedagógica General'];
export const ESTADOS_ACCION: EstadoAccion[] = ['Pendiente', 'En Proceso', 'Cumplida'];
export const NIVELES: NivelPlanificacion[] = ['1º Medio', '2º Medio', '3º Medio', '4º Medio'];
export const ASIGNATURAS = ['Lengua y Literatura', 'Matemática', 'Inglés', 'Filosofía', 'Historia y Geografía', 'Educación Ciudadana', 'Ciencias', 'Ciencias para la Ciudadanía', 'Artes', 'Música', 'Educación Física', 'Orientación', 'Mecánica Industrial', 'Mecánica Automotriz', 'Emprendimiento', 'Tecnología', 'Pensamiento Lógico', 'Competencia Lectora'];
export const CURSOS = [ '1ºA', '1ºB', '1ºC', '1ºD', '1ºE', '2ºA', '2ºB', '2ºC', '2ºD', '3ºA', '3ºB', '3ºC', '3ºD', '4ºA', '4ºB', '4ºC', '4ºD' ];
export const PROFESORES = [ 'Nelson Laubreaux', 'Julian Seguel', 'Martin Moya', 'Leonel Moya', 'Miguel Becerra' ];
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
export const HORARIO_BLOQUES = [
    { bloque: 1, inicio: '08:00', fin: '08:40' }, { bloque: 2, inicio: '08:40', fin: '09:20' },
    { bloque: 3, inicio: '09:35', fin: '10:15' }, { bloque: 4, inicio: '10:15', fin: '10:55' },
    { bloque: 5, inicio: '11:10', fin: '11:50' }, { bloque: 6, inicio: '11:50', fin: '12:30' },
    { bloque: 7, inicio: '12:30', fin: '13:10' }, { bloque: 8, inicio: '13:10', fin: '13:50' },
    { bloque: 9, inicio: '14:30', fin: '15:10' }, { bloque: 10, inicio: '15:10', fin: '15:50' },
    { bloque: 11, inicio: '16:00', fin: '16:40' }, { bloque: 12, inicio: '16:40', fin: '17:20' },
];

export const BLOCK_ALLOCATION_RULES = {
    '1º y 2º medio': { 'Lengua y Literatura': 6, 'Matemática': 6, 'Inglés': 3, 'Historia y Geografía': 4, 'Educación Física': 2, 'Ciencias': 4, 'Artes/Música': 2, 'Tecnología': 2, 'Orientación': 1 },
    '3º y 4º medio (Humanista-Científico)': { 'Lengua y Literatura': 4, 'Matemática': 4, 'Inglés': 2, 'Historia y Geografía': 3, 'Educación Ciudadana': 2, 'Filosofía': 3, 'Ciencias para la Ciudadanía': 2, 'Educación Física': 2 },
    '3º y 4º medio (Técnico-Profesional)': { 'Lengua y Literatura': 2, 'Matemática': 2, 'Inglés': 2, 'Historia y Geografía': 2, 'Filosofía': 2, 'Educación Física': 2, 'Módulo TP': 18 }
};
export const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: string; color: string }> = {
    [EventType.EVALUACION]: { label: 'Evaluación', icon: '📝', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
    [EventType.ACTO]: { label: 'Acto', icon: '🏛️', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    [EventType.ACTIVIDAD_FOCALIZADA]: { label: 'Act. Focalizada', icon: '🎯', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
    [EventType.SALIDA_PEDAGOGICA]: { label: 'Salida Pedagógica', icon: '🚌', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
};
export const EVALUACION_SUBTYPES: EvaluacionSubtype[] = Object.values(EvaluacionSubtype);
export const TIPOS_REUNION: TipoReunion[] = ['Humanidades', 'TP', 'Ciencias', 'Interdisciplinario', 'Gestión Pedagógica', 'Equipo Directivo', 'Equipo de Gestión', 'Consejo Escolar'];
export const TIPOS_INSTRUMENTO: TipoInstrumento[] = ['Prueba', 'Guía', 'Rúbrica', 'Lista de cotejo', 'Pauta de observación', 'Otro'];
export const ESCALAS_CALIFICACION: EscalaCalificacion[] = ['1-7', '1-100', 'Texto Personalizado'];
export const NIVELES_LOGRO: NivelLogro[] = ['Inicial', 'Suficiente', 'Competente', 'Avanzado'];
export const ESTADOS_SEGUIMIENTO_DUAL: EstadoSeguimientoDual[] = ['Vinculado', 'Desvinculado', 'En proceso', 'Empresa'];
export const CURSOS_DUAL = ['3ºA', '3ºB', '3ºC', '3ºD', '4ºA', '4ºB', '4ºC', '4ºD'];
export const TIPOS_ACTIVIDAD_REMOTA: TipoActividadRemota[] = ['Quiz', 'Comprensión de Lectura', 'Términos Pareados', 'Desarrollo'];
export const DIFICULTADES_APRENDIZAJE: DificultadAprendizaje[] = [
  'Discapacidad Intelectual Leve', 'Funcionamiento Intelectual Limítrofe', 'Trastorno Déficit Atencional (TDA)',
  'Trastorno Déficit Atencional con Hiperactividad (TDAH)', 'Trastorno del Lenguaje', 'Dificultad Específica del Aprendizaje',
  'Dificultad Específica de Aprendizaje en Matemáticas', 'Dificultades de Aprendizaje', 'Problemas de Idioma y de Escolarización'
];
export const RUBRICA_ACOMPANAMIENTO_DOCENTE = [
    {
        domain: "Dominio A: Preparación de la Enseñanza",
        criteria: [
            {
                name: "Conocimiento de la disciplina",
                levels: [
                    "Demuestra conocimiento parcial por la disciplina que enseña, evidenciando manejo poco preciso y confuso de los conceptos centrales en los que se articula la clase.",
                    "Conoce los principios centrales de la disciplina que enseña, no obstante evidencia falencias en el tratamiento conceptual a la luz de actualizaciones epistemológicas o metodológicas en su área.",
                    "Conoce y comprende los principios y conceptos centrales de las disciplinas que enseña, atendiendo a la permanente actualización curricular en su área.",
                    "Conoce, comprende y cuestiona los principios centrales de la disciplina que enseña a la luz de nuevos paradigmas epistemológicos o teóricos, permitiendo que el trabajo o la exposición conceptual invite al desarrollo del pensamiento crítico o la investigación continua."
                ]
            },
            {
                name: "Conocimiento de los estudiantes",
                levels: [
                    "No conoce las fortalezas y debilidades de sus estudiantes, evidenciando una planificación o gestión de la clase estándar, sin atender a particularidades.",
                    "Conoce las fortalezas y debilidades de sus estudiantes de manera parcial en relación al contexto y características del medio.",
                    "Conoce las fortalezas y debilidades de sus estudiantes respecto de los contenidos que enseña en consonancia con el contexto y características propias del medio.",
                    "Conoce las fortalezas y debilidades de sus estudiantes respecto de los contenidos que enseña en consonancia con el contexto y características propias del medio, siendo capaz de desarrollar diversas explicaciones y/o actividades para un mismo objetivo."
                ]
            },
            {
                name: "Selección de recursos de aprendizaje",
                levels: [
                    "Los recursos de aprendizaje seleccionados demuestran desconocimiento respecto a las características de sus estudiantes y a la relación con el contenido y objetivo de la clase.",
                    "Conoce parcialmente distintos recursos didácticos de aprendizaje, siendo congruentes al contenido pero no a las características de sus estudiantes, o bien, siendo pertinentes a sus particularidades pero alejándose de los objetivos y contenidos de la clase.",
                    "Conoce y selecciona distintos recursos didácticos de aprendizaje congruentes con la complejidad de los contenidos y las características de sus alumnos.",
                    "Conoce y selecciona distintos recursos didácticos de aprendizaje que promueven el desarrollo de habilidades transversales y permiten asegurar la adquisición de aprendizajes profundos, todo en consonancia con las particularidades de sus estudiantes."
                ]
            },
            {
                name: "Estrategias de evaluación",
                levels: [
                    "Establece estrategias de evaluación incongruentes con los contenidos o el desarrollo cognitivo de sus estudiantes, omitiendo además, las metodologías empleadas previamente en clases.",
                    "Establece estrategias de evaluación coherentes con los contenidos pero no con la complejidad, o bien, con una complejidad adecuada al desarrollo cognitivo de los estudiantes, pero no necesariamente a los contenidos y objetivos desarrollados previamente en clases.",
                    "Establece estrategias de evaluación coherentes con la complejidad de los contenidos involucrados y con las actividades previamente desarrolladas en clases.",
                    "Establece estrategias de evaluación coherentes con la complejidad de los contenidos involucrados y con las actividades previamente desarrolladas en clases. Dichas estrategias promueven la reflexión, y, la retroalimentación descriptiva."
                ]
            },
            {
                name: "Estrategias de enseñanza-aprendizaje",
                levels: [
                    "*Los docentes establecen estrategias generales de apoyo sin considerar los distintos niveles de dominio de las competencias ni tampoco, las necesidades de los estudiantes",
                    "*Los docentes diseñan e implementan estrategias de enseñanza- aprendizaje efectivas, pero sin considerar las competencias involucradas en el perfil de egreso, o los recursos disponibles, o los espacios dentro fuera y del aula.",
                    "*Los docentes diseñan e implementan estrategias efectivas de enseñanza-aprendizaje para el desarrollo de competencias definidas en el perfil de egreso de cada especialidad considerando el contexto educativo, los recursos de aprendizaje disponibles y los espacios de aprendizaje dentro y fuera del aula.",
                    "*Los docentes diseñan e implementan estrategias avanzadas de enseñanza-aprendizaje tales como (ABP, ABD, Gamificación, Aprendizaje basado en juegos) para el desarrollo de competencias definidas en el perfil de egreso de cada especialidad considerando el contexto educativo, los recursos de aprendizaje disponibles y los espacios de aprendizaje dentro y fuera del aula."
                ]
            }
        ]
    },
    {
        domain: "Dominio B: Creación de ambiente propicio para el aprendizaje",
        criteria: [
            {
                name: "Clima de respeto y empatía",
                levels: [
                    "Establece un clima centrado exclusivamente en las normas, pero no da cuenta de vínculos fundados en el respeto y/o en la empatía.",
                    "Establece un clima de relaciones interpersonales respetuosas y empáticas con la mayoría de sus alumnos.",
                    "Establece un clima de relaciones interpersonales respetuosas y empáticas con todos sus alumnos.",
                    "Establece un clima de relaciones interpersonales respetuosas y empáticas con todos sus alumnos, generando situaciones concretas de cooperación y ayuda mutua entre él/ella y los/las estudiantes, o entre los/las propios estudiantes."
                ]
            },
            {
                name: "Interés por las especialidades",
                levels: [
                    "No transmite interés por las especialidades, centrándose exclusivamente en su área de desempeño.",
                    "Transmite interés general por las especialidades, no obstante no es capaz de acercarse a las características concretas de los módulos.",
                    "Transmite interés por los contenidos y actividades de las asignaturas, módulos y especialidades.",
                    "Transmite interés por los contenidos y actividades de las asignaturas, módulos y especialidades, ejemplificando o relacionando de manera concreta, con situaciones reales en dicha área de desempeño."
                ]
            },
            {
                name: "Actitudes de compromiso y solidaridad",
                levels: [
                    "Promueve actitudes de buen comportamento en el aula, no obstante, no incorpora ni la solidaridad ni el compromiso con el otro ni con ellos mismos, en sus clases.",
                    "Promueve implícitamente actitudes de compromiso y solidaridad entre los alumnos.",
                    "Promueve explícitamente actitudes de compromiso y solidaridad entre los alumnos, a través de estrategias, instrucciones o análisis que tiendan a ello.",
                    "Promueve explícitamente actitudes de compromiso y solidaridad entre los alumnos, a través de estrategias, instrucciones o análisis que tiendan a ello, generando experiencias concretas para desarrollar estas habilidades y valores."
                ]
            },
            {
                name: "Situaciones de aprendizaje",
                levels: [
                    "Presenta situaciones de aprendizaje estándar que implican un desarrollo mecánico y que no tienden hacia la consolidación de aprendizajes esperados o no movilizan a los estudiantes.",
                    "Presenta situaciones de aprendizaje desafiantes y apropiadas para sus alumnos, no obstante no atiende a sus características personales y/o motivacionales.",
                    "Presenta situaciones de aprendizaje desafiantes y apropiadas para sus alumnos, atendiendo a sus características personales y motivacionales.",
                    "Presenta situaciones de aprendizaje desafiantes y apropiadas para sus alumnos, atendiendo a sus características personales y motivacionales, integrando a sus clases actividades que complementan o profundizan aprendizajes en los casos que sean necesarios."
                ]
            },
            {
                name: "Motivación por el aprendizaje",
                levels: [
                    "No transmite motivación por el aprendizaje, la búsqueda o la indagación.",
                    "Transmite una motivación positiva por el aprendizaje, no obstante no insta a los estudiantes a indagar o buscar de manera autónoma",
                    "Transmite una motivación positiva por el aprendizaje, la indagación y la búsqueda.",
                    "Transmite una motivación positiva por el aprendizaje, la indagación y la búsqueda, ejemplificando o comunicando experiencias reales que permitan valorar estas actitudes."
                ]
            },
            {
                name: "Normas de comportamiento",
                levels: [
                    "No establece normas de comportamento para sus estudiantes.",
                    "Establece normas de comportamento que son conocidas y comprensibles para sus alumnos, no obstante, no es sistemático en su cumplimiento.",
                    "Establece normas de comportamento que son conocidas y comprensibles para sus alumnos, creando y manteniendo un ambiente de aprendizaje organizado.",
                    "Establece normas de comportamento que son conocidas y comprensibles para sus alumnos, creando y manteniendo un ambiente de aprendizaje organizado, permitiendo altos niveles de participación."
                ]
            },
            {
                name: "Respuestas frente al quiebre de normas",
                levels: [
                    "No genera respuestas frente al quiebre de las normas de convivencia.",
                    "Genera respuestas efectivas frente al quiebre de las normas de convivencia, pero debe mejorar la asertividad.",
                    "Genera respuestas asertivas y efectivas frente al quiebre de las normas de convivencia.",
                    "Genera respuestas asertivas y efectivas frente al quiebre de las normas de convivencia, que entregan sentido de la importancia de los acuerdos y las normas previamente comunicadas."
                ]
            }
        ]
    },
    {
        domain: "Dominio C: Enseñanza para el aprendizaje de todos los estudiantes",
        criteria: [
            {
                name: "Presentación de objetivos",
                levels: [
                    "Al iniciar las clases no presenta el objetivo o sólo lo enuncia sin profundizar en él.",
                    "Al iniciar las clases presenta el objetivo de aprendizaje y el propósito, pero no logra dar cuenta de la relación con el futuro laboral de los estudiantes o con otras áreas del conocimiento.",
                    "Al iniciar las clases presentan el objetivo de aprendizaje, relacionándolo con el propósito que posee desde la disciplina, otras áreas del conocimiento o para su desempeño laboral futuro.",
                    "Al iniciar las clases presentan el objetivo de aprendizaje involucrando a los estudiantes a través de la relación con el propósito que posee desde la disciplina, otras áreas del conocimiento o para su desempeño laboral futuro."
                ]
            },
            {
                name: "Clase en función de objetivos",
                levels: [
                    "No realiza su clase en función de los objetivos de aprendizaje estipulados en las bases curriculares, o bien, los incorpora pero sin mantener coherencia con las habilidades, contenidos o competencias del currículum nacional",
                    "Realiza sus clases en función de los Objetivos de Aprendizaje estipulados en las Bases Curriculares, considerando sólo uno de los siguientes elementos: desarrollo de competencias, habilidades, conocimientos o actitudes establecidos en el currículum nacional.",
                    "Realiza sus clases en función de los Objetivos de Aprendizaje estipulados en las Bases Curriculares, considerando el desarrollo de competencias, habilidades, conocimientos y actitudes establecidos en el currículum nacional.",
                    "Realiza sus clases en función de los Objetivos de Aprendizaje estipulados en las Bases Curriculares, considerando el desarrollo de competencias, habilidades, conocimientos y actitudes establecidos en el currículum nacional y en el PEI."
                ]
            },
            {
                name: "Introducción de nueva información",
                levels: [
                    "Promueve actitudes de buen comportamento en el aula, no obstante, no incorpora ni la solidaridad ni el compromiso con el otro ni con ellos mismos, en sus clases.",
                    "Los docentes introducen a los estudiantes a nueva información, sin considerar el desarrollo de habilidades y actitudes.",
                    "Los docentes introducen a sus estudiantes a nueva información y al desarrollo de nuevas habilidades y actitudes, mediante estrategias efectivas y variadas, que consideran sus conocimientos previos.",
                    "Los docentes introducen a sus estudiantes a nueva información y al desarrollo de nuevas habilidades y actitudes, mediante estrategias efectivas y variadas, que consideran sus conocimientos previos y su realidad inmediata."
                ]
            },
            {
                name: "Desarrollo de contenidos",
                levels: [
                    "Desarrolla los contenidos de la clase sin precisión conceptual ni claridad.",
                    "Desarrolla los contenidos de la clase con rigurosidad conceptual, pero sin una extrapolación que permita entregar claridad a los estudiantes.",
                    "Desarrolla los contenidos de la clase con rigurosidad conceptual y claridad.",
                    "Desarrolla los contenidos de la clase con rigurosidad conceptual y claridad, recurriendo al ejemplo y a la vida cotidiana para anclar el conocimiento."
                ]
            },
            {
                name: "Retroalimentación",
                levels: [
                    "No retroalimenta a los estudiantes",
                    "Retroalimentan constantemente a sus estudiantes sólo de modo general.",
                    "Retroalimentan constantemente a sus estudiantes sobre su desempeño, de manera individual o grupal.",
                    "Retroalimentan constantemente a sus estudiantes sobre su desempeño, de manera individual o grupal, a través de preguntas o instancias que permiten modelar su aprendizaje."
                ]
            },
            {
                name: "Monitoreo del aprendizaje",
                levels: [
                    "No monitorea el grado de comprensión y desempeño de sus estudiantes.",
                    "Monitorea parcialmente el grado de comprensión y desempeño de sus estudiantes, no siempre a través de evidencia.",
                    "Monitorea constantemente el grado de comprensión y el desempeño de sus estudiantes durante el desarrollo de las clases para obtener evidencias acerca de lo que están aprendiendo.",
                    "Monitorea constantemente y en diferentes instancias el grado de comprensión y el desempeño de sus estudiantes durante el desarrollo de las clases para obtener evidencias acerca de lo que están aprendiendo."
                ]
            },
            {
                name: "Orientación a objetivos transversales",
                levels: [
                    "No enuncia o enuncia de modo incorrecto elementos ligados hacia los objetivos transversales.",
                    "Orienta a sus estudiantes hacia temáticas ligadas a los objetivos transversales, no obstante, la orientación es superficial y no predispone la construcción de valores.",
                    "Orienta a sus estudiantes hacia temáticas ligadas a los objetivos transversales del currículum, con el fin de favorecer su proceso de construcción de valores.",
                    "Orienta a sus estudiantes hacia temáticas ligadas a los objetivos transversales del currículum, con el fin de favorecer su proceso de construcción de valores en consonancia a elementos propios del PEI."
                ]
            },
            {
                name: "Conclusión de la clase",
                levels: [
                    "El docente concluye la clase sin actividad o reactivo hacia los estudiantes.*",
                    "El docente concluye la clase con una explicación que resume los contenidos fundamentales, no obstante, no moviliza acciones en los estudiantes, que permitan activar contenidos.",
                    "El docente concluye las clases con una actividad breve que permite a sus estudiantes realizar algunas de las siguientes acciones: demostrar, identificar, sintetizar, jerarquizar, formular dudas, conectar o valorar lo aprendido.",
                    "El docente concluye las clases con una actividad breve que permite a sus estudiantes realizar algunas de las siguientes acciones: demostrar, identificar, sintetizar, jerarquizar, formular dudas, conectar o valorar lo aprendido. Incorpora además preguntas de metacognición y/o autoevaluación."
                ]
            },
            {
                name: "Abordaje de errores",
                levels: [
                    "No aborda los errores, únicamente los señala.",
                    "Aborda los errores no como fracasos, sino que corrige oportunamente, no obstante no entrega nuevas herramientas para construir de mejor forma nuevos aprendizajes.",
                    "Aborda los errores no como fracasos, sino como ocasiones para enriquecer el proceso de aprendizaje.",
                    "Aborda los errores no como fracasos, sino como ocasiones para enriquecer el proceso de aprendizaje a través de estrategias o precisiones claves en virtud de las habilidades o contenidos tratados."
                ]
            },
            {
                name: "Apoyo a todos los estudiantes",
                levels: [
                    "El docente se centra en un grupo objetivo y homogéneo, descuidando la diversidad y las características particulares de todos sus estudiantes.",
                    "El docente apoya parcialmente a todos los estudiantes en sus procesos educativos, no obstante no consideran diversas estrategias según nivel de dominio por parte de los estudiantes.",
                    "El docente apoya a todos los estudiantes en sus procesos educativos, considerando estrategias de apoyo por grupos según el nivel de dominio de las competencias definidas en el perfil de egreso.",
                    "El docente apoya a todos los estudiantes en sus procesos educativos, considerando estrategias de apoyo por grupos según el nivel de dominio de las competencias definidas en el perfil de egreso y en consonancia con el PEI."
                ]
            }
        ]
    }
];
export const ROLES_TRABAJO_GRUPAL = ['Líder de Proyecto', 'Secretario/a', 'Encargado/a de Materiales', 'Expositor/a', 'Investigador/a', 'Editor/a'];
export const INSIGNIAS_GAMIFICACION: Insignia[] = [
    { nombre: 'Aprendiz Emergente', emoji: '🌱', promedioMin: 1.0, promedioMax: 3.9, mensaje: "¡Estás comenzando tu viaje de aprendizaje! Sigue esforzándote." },
    { nombre: 'Explorador del Conocimiento', emoji: '🧭', promedioMin: 4.0, promedioMax: 4.9, mensaje: "¡Buen trabajo! Estás construyendo una base sólida." },
    { nombre: 'Arquitecto de Ideas', emoji: '🏛️', promedioMin: 5.0, promedioMax: 5.9, mensaje: "¡Excelente! Demuestras un gran dominio de los temas." },
    { nombre: 'Maestro del Saber', emoji: '🎓', promedioMin: 6.0, promedioMax: 6.5, mensaje: "¡Impresionante! Tu dedicación te lleva a la excelencia." },
    { nombre: 'Sabio Luminar', emoji: '🌟', promedioMin: 6.6, promedioMax: 7.0, mensaje: "¡Extraordinario! Eres una inspiración para tus compañeros." },
];
// —— Alternancia TP (nombres únicos) ——
export const ESPECIALIDADES_TP = [
  "Mecánica Industrial",
  "Mecánica Automotriz",
] as const;

export const INSTITUCIONES_TP = [
  "INACAP",
  "UNAB",
  "DUOC",
  "Universidad de Las Américas",
] as const;

export const NIVELES_TP = ["Tercero Medio", "Cuarto Medio"] as const;

export const CURSOS_BY_ESPECIALIDAD_TP: Record<string, string[]> = {
  "Mecánica Automotriz": ["3ºA", "3ºB", "4ºA", "4ºB"],
  "Mecánica Industrial": ["3ºC", "3ºD", "4ºC", "4ºD"],
};

export const TIPOS_ALTERNANCIA_TP = [
  "Pasantía",
  "Visita",
  "Certificación",
  "Formación en empresa",
] as const;

// Módulos por especialidad (SIN horas)
export const MODULOS_MAP_TP: Record<string, string[]> = {
  "Mecánica Industrial": [
    // 3º
    "Soldadura industrial",
    "Mantenimiento de herramientas",
    "Medición y verificación",
    "Mecánica de banco",
    "Torneado de piezas y conjuntos mecánicos",
    // 4º
    "Fresado de piezas mecánicas",
    "Taladrado de piezas mecánicas",
    "Rectificado de piezas mecánicas",
    "Fabricación asistida por computador (CNC)",
  ],
  "Mecánica Automotriz": [
    // 3º
    "Ajuste de motores",
    "Lectura de planos y manuales técnicos",
    "Manejo de residuos y desechos automotrices",
    "Mantenimiento de sistemas de seguridad y confortabilidad",
    "Mantenimiento de sistemas eléctricos y electrónicos",
    // 4º
    "Mantenimiento de motores",
    "Mantenimiento de sistemas hidráulicos y neumáticos",
    "Mantenimiento de los sistemas de transmisión y frenos",
    "Mantenimiento de sistemas de dirección y suspensión",
    "Emprendimiento y empleabilidad",
  ],
}; // 👈 importante el punto y coma

// OA por módulo (claves EXACTAS según MODULOS_MAP_TP, SIN horas)
export const OAS_MAP_TP: Record<string, Record<string, string[]>> = {
  "Mecánica Automotriz": {
    "Ajuste de motores": [
      "Reparar y probar el funcionamiento de motores (gasolina, diésel, gas e híbridos), incluyendo sistemas de control de emisiones, lubricación y refrigeración, usando herramientas e instrumentos apropiados y siguiendo especificaciones del fabricante.",
    ],
    "Lectura de planos y manuales técnicos": [
      "Leer e interpretar información técnica (manuales, planos, diagramas y normas de emisiones) para resolver diagnósticos y fallas.",
    ],
    "Manejo de residuos y desechos automotrices": [
      "Aplicar procedimientos y normativas de seguridad, higiene y cuidado ambiental en la manipulación y disposición de residuos y desechos automotrices.",
    ],
    "Mantenimiento de sistemas de seguridad y confortabilidad": [
      "Diagnosticar, reparar y mantener sistemas de seguridad (frenos ABS, airbags) y confortabilidad (climatización, cierre centralizado, asientos eléctricos) según especificaciones técnicas.",
    ],
    "Mantenimiento de sistemas eléctricos y electrónicos": [
      "Reemplazar, ajustar y probar sistemas eléctricos y electrónicos automotrices, siguiendo procedimientos y normas internacionales.",
    ],
    "Mantenimiento de motores": [
      "Realizar mantenimiento preventivo y correctivo de motores y sus sistemas asociados, verificando tolerancias y parámetros operativos según especificaciones.",
    ],
    "Mantenimiento de sistemas hidráulicos y neumáticos": [
      "Inspeccionar, diagnosticar y reparar sistemas hidráulicos y neumáticos de vehículos automotrices.",
    ],
    "Mantenimiento de los sistemas de transmisión y frenos": [
      "Verificar, ajustar o reemplazar componentes de transmisión y frenos, según manual del fabricante.",
    ],
    "Mantenimiento de sistemas de dirección y suspensión": [
      "Diagnosticar, alinear y corregir sistemas de dirección y suspensión, cumpliendo normas de seguridad.",
    ],
    "Emprendimiento y empleabilidad": [
      "Desarrollar un proyecto o plan de negocio relacionado con el sector automotriz, aplicando conceptos de gestión, marketing y normativa vigente.",
    ],
  },
  "Mecánica Industrial": {
    "Soldadura industrial": [
      "Ejecutar procesos de corte y soldadura (oxiacetileno, arco manual, TIG, MIG) en distintas posiciones y materiales, aplicando normas de seguridad, higiene y cuidado ambiental.",
    ],
    "Mantenimiento de herramientas": [
      "Mantener y reparar herramientas manuales y de máquinas, asegurando su operatividad y prolongando su vida útil.",
    ],
    "Medición y verificación": [
      "Utilizar instrumentos de medición y verificación para controlar dimensiones y tolerancias según planos y especificaciones técnicas.",
    ],
    "Mecánica de banco": [
      "Realizar operaciones manuales de mecanizado, ajuste, limado, roscado y ensamblaje, siguiendo planos y tolerancias indicadas.",
    ],
    "Torneado de piezas y conjuntos mecánicos": [
      "Operar tornos convencionales para fabricar piezas y conjuntos mecánicos, cumpliendo con las especificaciones técnicas y de seguridad.",
    ],
    "Fresado de piezas mecánicas": [
      "Operar fresadoras para fabricar piezas mecánicas, seleccionando herramientas de corte y parámetros de mecanizado adecuados.",
    ],
    "Taladrado de piezas mecánicas": [
      "Ejecutar operaciones de taladrado, escariado y roscado en taladros de banco o columna, cumpliendo especificaciones técnicas y de seguridad.",
    ],
    "Rectificado de piezas mecánicas": [
      "Utilizar rectificadoras para mejorar el acabado y precisión dimensional de piezas mecánicas, cumpliendo tolerancias indicadas.",
    ],
    "Fabricación asistida por computador (CNC)": [
      "Programar y operar máquinas CNC para fabricar piezas mecánicas con precisión, optimizando procesos y aplicando normas de seguridad.",
    ],
  },
};
export const PME_DIMENSIONES: Record<string, string[]> = {
  "Liderazgo Curricular": [
    "Planificación y organización del currículo",
    "Asegurar la cobertura y secuenciación de los contenidos",
    "Monitoreo del cumplimiento de los planes de estudio"
  ],
  "Prácticas Pedagógicas en el Aula": [
    "Estrategias de enseñanza y metodologías activas",
    "Evaluación de los aprendizajes para retroalimentar el proceso",
    "Uso de recursos y tecnologías para apoyar la enseñanza"
  ],
  "Acompañamiento y Desarrollo Profesional Docente": [
    "Observación de clases y retroalimentación",
    "Planes de formación continua y actualización pedagógica",
    "Fomento de comunidades de aprendizaje docente"
  ],
  "Monitoreo y Evaluación de los Aprendizajes": [
    "Uso de datos e indicadores para tomar decisiones pedagógicas",
    "Evaluaciones internas y externas",
    "Ajuste de estrategias según resultados y metas de aprendizaje"
  ]
};

export const ESTADOS_ACCION_PME = ["Pendiente", "En Proceso", "Cumplida"] as const;
export type EstadoAccionPME = typeof ESTADOS_ACCION_PME[number];
// Perfiles permitidos como creadores de actividades del módulo
export const PERFILES_CREADORES_DPD = [ "PROFESORADO", "SUBDIRECCION", "COORDINACION_TP" ] as const;
export type PerfilCreadorDPD = typeof PERFILES_CREADORES_DPD[number];
