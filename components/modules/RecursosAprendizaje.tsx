import React, { useState } from 'react';
import MapasMentales from './recursos/MapasMentales';
import SopaDeLetras from './recursos/SopaDeLetras';
import LineasDeTiempo from './recursos/LineasDeTiempo';
import Crucigramas from './recursos/Crucigramas';

interface Recurso {
    id: 'sopaDeLetras' | 'mapasMentales' | 'crucigramas' | 'lineasDeTiempo';
    icon: string;
    nombre: string;
    descripcion: string;
}

const recursos: Recurso[] = [
    {
        id: 'sopaDeLetras',
        icon: '🅰️',
        nombre: 'Sopa de Letras',
        descripcion: 'Crea y resuelve sopas de letras personalizadas para aprender palabras clave de cualquier asignatura.',
    },
    {
        id: 'mapasMentales',
        icon: '🧠',
        nombre: 'Mapas Mentales',
        descripcion: 'Organiza ideas y conceptos de forma visual para facilitar el estudio y la memoria.',
    },
    {
        id: 'crucigramas',
        icon: '✏️',
        nombre: 'Crucigramas',
        descripcion: 'Crea y resuelve crucigramas para reforzar vocabulario y conceptos clave.',
    },
    {
        id: 'lineasDeTiempo',
        icon: '🕒',
        nombre: 'Líneas de Tiempo',
        descripcion: 'Construye líneas de tiempo para comprender procesos, hechos históricos o secuencias.',
    },
];

type ActiveResource = 'menu' | Recurso['id'];

const RecursoCard: React.FC<{ recurso: Recurso; onClick: () => void }> = ({ recurso, onClick }) => (
    <button 
        onClick={onClick}
        className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out cursor-pointer flex flex-col items-center text-center h-full"
    >
        <div className="text-6xl mb-4">{recurso.icon}</div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">{recurso.nombre}</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm flex-grow">{recurso.descripcion}</p>
    </button>
);

const RecursosAprendizaje: React.FC = () => {
    const [activeResource, setActiveResource] = useState<ActiveResource>('menu');

    const renderContent = () => {
        if (activeResource === 'mapasMentales') {
            return <MapasMentales onBack={() => setActiveResource('menu')} />;
        }

        if (activeResource === 'sopaDeLetras') {
            return <SopaDeLetras onBack={() => setActiveResource('menu')} />;
        }
        
        if (activeResource === 'lineasDeTiempo') {
            return <LineasDeTiempo onBack={() => setActiveResource('menu')} />;
        }
        
        if (activeResource === 'crucigramas') {
            return <Crucigramas onBack={() => setActiveResource('menu')} />;
        }

        // Default view: Menu
        return (
            <>
                <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                     <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Recursos de Aprendizaje</h1>
                     <p className="text-slate-500 dark:text-slate-400 mt-2">Seleccione una herramienta para crear una nueva actividad educativa para sus estudiantes.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {recursos.map((recurso) => (
                        <RecursoCard 
                            key={recurso.id} 
                            recurso={recurso} 
                            onClick={() => setActiveResource(recurso.id)} 
                        />
                    ))}
                </div>
            </>
        );
    };

    return (
        <div className="animate-fade-in space-y-6">
           {renderContent()}
        </div>
    );
};

export default RecursosAprendizaje;