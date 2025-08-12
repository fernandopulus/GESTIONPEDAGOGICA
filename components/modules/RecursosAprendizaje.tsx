import React, { useState } from 'react';
import MapasMentales from './recursos/MapasMentales';
import SopaDeLetras from './recursos/SopaDeLetras';
import LineasDeTiempo from './recursos/LineasDeTiempo';
import Crucigramas from './recursos/Crucigramas';
import { useAuth } from '@/hooks/useAuth'; // ✅ Añade 'src/' después del alias // ✅ Usa el alias '@/' para apuntar a 'src/' // ✅ 1. IMPORTA EL HOOK

interface Recurso {
    id: 'sopaDeLetras' | 'mapasMentales' | 'crucigramas' | 'lineasDeTiempo';
    icon: string;
    nombre: string;
    descripcion: string;
}

const recursos: Recurso[] = [
    // ... la lista de recursos no cambia
    { id: 'sopaDeLetras', icon: '🅰️', nombre: 'Sopa de Letras', descripcion: 'Crea y resuelve sopas de letras personalizadas para aprender palabras clave de cualquier asignatura.' },
    { id: 'mapasMentales', icon: '🧠', nombre: 'Mapas Mentales', descripcion: 'Organiza ideas y conceptos de forma visual para facilitar el estudio y la memoria.' },
    { id: 'crucigramas', icon: '✏️', nombre: 'Crucigramas', descripcion: 'Crea y resuelve crucigramas para reforzar vocabulario y conceptos clave.' },
    { id: 'lineasDeTiempo', icon: '🕒', nombre: 'Líneas de Tiempo', descripcion: 'Construye líneas de tiempo para comprender procesos, hechos históricos o secuencias.' },
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
    const { currentUser } = useAuth(); // ✅ 2. OBTÉN EL USUARIO ACTUAL

    const renderContent = () => {
        // ✅ 3. VERIFICA QUE EL USUARIO EXISTA ANTES DE RENDERIZAR UN SUBMÓDULO
        if (activeResource !== 'menu' && !currentUser) {
            // Muestra un mensaje o spinner mientras se carga el usuario
            return <div className="text-center p-8">Cargando información de usuario...</div>;
        }

        // ✅ 4. PASA 'currentUser' A CADA COMPONENTE HIJO
        if (activeResource === 'mapasMentales') {
            return <MapasMentales onBack={() => setActiveResource('menu')} currentUser={currentUser!} />;
        }

        if (activeResource === 'sopaDeLetras') {
            return <SopaDeLetras onBack={() => setActiveResource('menu')} currentUser={currentUser!} />;
        }
        
        if (activeResource === 'lineasDeTiempo') {
            return <LineasDeTiempo onBack={() => setActiveResource('menu')} currentUser={currentUser!} />;
        }
        
        if (activeResource === 'crucigramas') {
            return <Crucigramas onBack={() => setActiveResource('menu')} currentUser={currentUser!} />;
        }

        // Vista del menú por defecto
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