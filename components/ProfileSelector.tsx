import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, BarChart, Users, Settings, GraduationCap, ClipboardList, School } from 'lucide-react';
import { Profile } from '../types';
import { PROFILES, MainLogo } from '../constants';

interface ProfileSelectorProps {
  onSelectProfile: (profile: Profile) => void;
  isAdminView?: boolean;
  /** Lista opcional de perfiles permitidos para mostrar en la selección */
  allowedProfiles?: Profile[];
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({ onSelectProfile, isAdminView = false, allowedProfiles }) => {
  const prefersReducedMotion = useReducedMotion();

  // Config responsiva para densidad y amplitud de movimiento
  const [gridConfig, setGridConfig] = React.useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    if (w < 640) return { cols: 4, rows: 2, amp: 5, opMin: 0.05, opMax: 0.10 };
    if (w < 1024) return { cols: 6, rows: 2, amp: 6, opMin: 0.06, opMax: 0.12 };
    return { cols: 6, rows: 3, amp: 8, opMin: 0.06, opMax: 0.14 };
  });

  React.useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setGridConfig((prev) => {
        if (w < 640 && (prev.cols !== 4 || prev.rows !== 2 || prev.amp !== 5)) return { cols: 4, rows: 2, amp: 5, opMin: 0.05, opMax: 0.10 };
        if (w >= 640 && w < 1024 && (prev.cols !== 6 || prev.rows !== 2 || prev.amp !== 6)) return { cols: 6, rows: 2, amp: 6, opMin: 0.06, opMax: 0.12 };
        if (w >= 1024 && (prev.cols !== 6 || prev.rows !== 3 || prev.amp !== 8)) return { cols: 6, rows: 3, amp: 8, opMin: 0.06, opMax: 0.14 };
        return prev;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Íconos y posiciones (determinísticas) para el fondo
  const backgroundIcons = React.useMemo(() => {
    const icons = [BookOpen, BarChart, Users, Settings, GraduationCap, ClipboardList, School, BookOpen, Users, BarChart, Settings, School];
    // Pequeño generador pseudoaleatorio determinístico
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const { cols, rows, opMin, opMax } = gridConfig;
    const count = cols * rows;
    return Array.from({ length: count }).map((_, i) => {
      const Icon = icons[i % icons.length];
      // Distribución en una cuadrícula sutil con leve jitter
      const col = i % cols;
      const row = Math.floor(i / cols);
      const baseLeft = ((col + 0.5) / cols) * 100; // %
      const baseTop = ((row + 0.5) / rows) * 100; // %
      const jitterX = (rand() * 10 - 5); // -5%..+5%
      const jitterY = (rand() * 8 - 4); // -4%..+4%
      const size = 22 + Math.floor(rand() * 14); // 22..36px
      const opacity = opMin + rand() * (opMax - opMin);
      const delay = rand() * 4; // 0..4s
      const dirX = rand() > 0.5 ? 1 : -1; // alterna dirección x
      const dirY = rand() > 0.5 ? 1 : -1; // alterna dirección y
      return {
        Icon,
        style: {
          left: `${baseLeft + jitterX}%`,
          top: `${baseTop + jitterY}%`,
          width: `${size}px`,
          height: `${size}px`,
          opacity,
          filter: 'blur(0.5px)'
        } as React.CSSProperties,
        delay,
        dirX,
        dirY,
      };
    });
  }, [gridConfig]);
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

      {/* blobs de color difuminado detrás (más atrás que los íconos) */}
      <div className="pointer-events-none absolute inset-0 -z-20">
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

      {/* capa de íconos animados de fondo */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {backgroundIcons.map(({ Icon, style, delay, dirX, dirY }, idx) => (
          <motion.span
            key={idx}
            className="absolute text-[#1f2937]" // gris-800
            style={style}
            initial={false}
            animate={prefersReducedMotion ? undefined : { x: [0, (gridConfig.amp/2) * dirX, 0, -(gridConfig.amp/2) * dirX, 0], y: [0, -gridConfig.amp * dirY, 0, gridConfig.amp * dirY, 0] }}
            transition={prefersReducedMotion ? undefined : { duration: 12, repeat: Infinity, ease: 'easeInOut', delay }}
          >
            <Icon className="w-full h-full" />
          </motion.span>
        ))}
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
