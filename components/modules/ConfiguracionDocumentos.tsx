import React from 'react';
import { User } from '../../types';
import { Wrench, Shield, Tag, Database, UploadCloud } from 'lucide-react';

// Marcador ZXCONF-1 para verificar despliegue en producción

interface Props {
  currentUser: User;
}

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children?: React.ReactNode;
}> = ({ icon, title, badge, children }) => (
  <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{title}</h3>
      </div>
      {badge && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white">
          {badge}
        </span>
      )}
    </div>
    {children && (
      <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        {children}
      </div>
    )}
  </div>
);

const ConfiguracionDocumentos: React.FC<Props> = ({ currentUser }) => {
  return (
    <div className="flex flex-col gap-6">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm w-fit">
        <Wrench className="w-4 h-4" />
        <span>Configuración de Documentación (ZXCONF-1)</span>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
        Panel para administrar parámetros avanzados del módulo de Documentación. Esta es una
        versión inicial para validar visibilidad en producción.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <Section icon={<UploadCloud className="w-4 h-4 text-amber-500" />} title="Ingesta" badge="BETA">
          Tipos MIME permitidos, límites de tamaño y procesamiento previo (OCR, normalización).
        </Section>
        <Section icon={<Tag className="w-4 h-4 text-emerald-600" />} title="Taxonomías y Tags">
          Sugerencias, sinónimos y conjuntos de etiquetas institucionales.
        </Section>
        <Section icon={<Database className="w-4 h-4 text-indigo-600" />} title="Reindexación">
          Reindexación programada o reconstrucción completa del índice.
        </Section>
        <Section icon={<Shield className="w-4 h-4 text-rose-600" />} title="Permisos">
          Visibilidad por perfil y confidencialidad de conjuntos documentales.
        </Section>
        <Section icon={<Wrench className="w-4 h-4 text-slate-600" />} title="Mantenimiento">
          Detección de duplicados, archivos corruptos y metadatos incompletos.
        </Section>
      </div>

      <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2">
        Usuario: {currentUser.email} · ID: {currentUser.id}
      </div>
    </div>
  );
};

export default ConfiguracionDocumentos;