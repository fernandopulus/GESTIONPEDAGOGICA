import React from 'react';
import { EstiloPresentacion } from '../../types';

interface EstiloPresentacionPreviewProps {
  estilo: EstiloPresentacion;
  tema?: string;
}

const EstiloPresentacionPreview: React.FC<EstiloPresentacionPreviewProps> = ({ 
  estilo,
  tema = 'Ejemplo de Presentación'
}) => {
  // Obtener configuración del estilo
  const getEstiloConfig = () => {
    switch (estilo) {
      case 'sobrio':
        return {
          colores: {
            fondo: 'bg-slate-100',
            fondoDiapo: 'bg-white',
            titulo: 'text-slate-800',
            texto: 'text-slate-600',
            acento: 'bg-slate-200'
          },
          fuentes: {
            titulo: 'font-serif',
            texto: 'font-sans'
          },
          iconos: '🎭',
          descripcion: 'Elegante y minimalista, balanceando profesionalismo con claridad pedagógica',
          ejemplo: [
            'Título principal en fuente serif',
            'Contenido organizado y claro',
            'Paleta de colores neutros'
          ]
        };
      case 'visual':
        return {
          colores: {
            fondo: 'bg-blue-50',
            fondoDiapo: 'bg-white',
            titulo: 'text-blue-800',
            texto: 'text-slate-600',
            acento: 'bg-blue-100'
          },
          fuentes: {
            titulo: 'font-sans',
            texto: 'font-sans'
          },
          iconos: '🎨',
          descripcion: 'Dinámico y colorido, con énfasis en elementos gráficos e infografías',
          ejemplo: [
            'Mayor uso de elementos visuales',
            'Diagramas y representaciones gráficas',
            'Paleta de colores vibrantes'
          ]
        };
      case 'academico':
        return {
          colores: {
            fondo: 'bg-amber-50',
            fondoDiapo: 'bg-white',
            titulo: 'text-amber-800',
            texto: 'text-slate-700',
            acento: 'bg-amber-100'
          },
          fuentes: {
            titulo: 'font-serif',
            texto: 'font-serif'
          },
          iconos: '📚',
          descripcion: 'Formal y riguroso, con énfasis en conceptos teóricos',
          ejemplo: [
            'Estructura académica formal',
            'Referencias y citas bibliográficas',
            'Énfasis en conceptos teóricos'
          ]
        };
      case 'interactivo':
        return {
          colores: {
            fondo: 'bg-green-50',
            fondoDiapo: 'bg-white',
            titulo: 'text-green-800',
            texto: 'text-slate-600',
            acento: 'bg-green-100'
          },
          fuentes: {
            titulo: 'font-sans',
            texto: 'font-sans'
          },
          iconos: '🤝',
          descripcion: 'Participativo y colaborativo, con múltiples actividades',
          ejemplo: [
            'Preguntas y actividades prácticas',
            'Espacios para participación',
            'Dinámicas grupales sugeridas'
          ]
        };
      case 'profesional':
        return {
          colores: {
            fondo: 'bg-indigo-50',
            fondoDiapo: 'bg-white',
            titulo: 'text-indigo-800',
            texto: 'text-slate-600',
            acento: 'bg-indigo-100'
          },
          fuentes: {
            titulo: 'font-sans',
            texto: 'font-sans'
          },
          iconos: '💼',
          descripcion: 'Corporativo y práctico, enfocado en aplicaciones reales',
          ejemplo: [
            'Diseño corporativo y estructurado',
            'Casos de estudio prácticos',
            'Aplicaciones en contexto laboral'
          ]
        };
      case 'creativo':
        return {
          colores: {
            fondo: 'bg-purple-50',
            fondoDiapo: 'bg-white',
            titulo: 'text-purple-800',
            texto: 'text-slate-600',
            acento: 'bg-purple-100'
          },
          fuentes: {
            titulo: 'font-sans',
            texto: 'font-sans'
          },
          iconos: '💡',
          descripcion: 'Innovador y atractivo, estimula la imaginación',
          ejemplo: [
            'Diseño creativo no convencional',
            'Elementos visuales llamativos',
            'Enfoque innovador del contenido'
          ]
        };
      case 'minimalista':
        return {
          colores: {
            fondo: 'bg-gray-50',
            fondoDiapo: 'bg-white',
            titulo: 'text-gray-800',
            texto: 'text-gray-600',
            acento: 'bg-gray-100'
          },
          fuentes: {
            titulo: 'font-sans',
            texto: 'font-sans'
          },
          iconos: '⚪',
          descripcion: 'Simple y esencial, centrado en lo más importante',
          ejemplo: [
            'Diseño muy simplificado',
            'Amplio espacio en blanco',
            'Solo información esencial'
          ]
        };
      default:
        return {
          colores: {
            fondo: 'bg-slate-100',
            fondoDiapo: 'bg-white',
            titulo: 'text-slate-800',
            texto: 'text-slate-600',
            acento: 'bg-slate-200'
          },
          fuentes: {
            titulo: 'font-serif',
            texto: 'font-sans'
          },
          iconos: '🎭',
          descripcion: 'Elegante y minimalista, balanceando profesionalismo con claridad pedagógica',
          ejemplo: [
            'Título principal en fuente serif',
            'Contenido organizado y claro',
            'Paleta de colores neutros'
          ]
        };
    }
  };

  const config = getEstiloConfig();

  return (
    <div className={`p-4 rounded-lg ${config.colores.fondo} transition-all`}>
      <h3 className="text-lg font-medium mb-2">Vista previa: Estilo {estilo}</h3>
      <p className="text-sm text-gray-500 mb-3">{config.descripcion}</p>
      
      {/* Mini-presentación de ejemplo */}
      <div className="shadow-md rounded-lg overflow-hidden">
        {/* Diapositiva 1 */}
        <div className={`p-4 ${config.colores.fondoDiapo} border-b border-gray-200`}>
          <h4 className={`${config.fuentes.titulo} ${config.colores.titulo} text-lg font-bold mb-2`}>
            {tema}
          </h4>
          <div className={`${config.fuentes.texto} ${config.colores.texto} text-sm space-y-2`}>
            <p>Diapositiva de título con subtítulo</p>
            <div className={`w-2/3 h-2 ${config.colores.acento} rounded mt-2`}></div>
          </div>
        </div>
        
        {/* Diapositiva 2 */}
        <div className={`p-4 ${config.colores.fondoDiapo}`}>
          <h4 className={`${config.fuentes.titulo} ${config.colores.titulo} text-md font-bold mb-2`}>
            Características principales
          </h4>
          <ul className={`${config.fuentes.texto} ${config.colores.texto} text-xs space-y-1 list-disc pl-4`}>
            {config.ejemplo.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <div className="flex justify-end mt-2">
            <span className="text-lg">{config.iconos}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstiloPresentacionPreview;
