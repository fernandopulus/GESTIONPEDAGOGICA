import React, { useState, useEffect, useMemo } from 'react';
import { Empresa, CalificacionItem, User } from '../../types';
import { 
    subscribeToEmpresas, 
    saveEmpresa, 
    deleteEmpresa,
    subscribeToEstudiantes 
} from '../../src/firebaseHelpers/empresasHelper';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Arreglo para el ícono por defecto de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


const ELEMENTOS_A_EVALUAR: Omit<CalificacionItem, 'score'>[] = [
  { elemento: "Cumplimiento legal y formalidad" },
  { elemento: "Contrato o convenio formal de práctica" },
  // ... (otros elementos)
];

const getInitialFormData = (): Omit<Empresa, 'id' | 'createdAt'> => ({
    nombre: '',
    rut: '',
    direccion: '',
    contacto: '',
    cupos: 1,
    calificaciones: ELEMENTOS_A_EVALUAR.map(item => ({ ...item, score: null })),
    estudiantesAsignados: [],
});

// --- SUB-COMPONENTE DE MAPA ---
const MapView: React.FC<{ empresas: Empresa[] }> = ({ empresas }) => {
    const empresasConCoordenadas = empresas.filter(e => e.coordenadas?.lat && e.coordenadas?.lng);
    const santiagoCoords: [number, number] = [-33.4489, -70.6693]; // Centro de Santiago

    return (
        <div className="h-[600px] w-full rounded-lg overflow-hidden border dark:border-slate-700">
            <MapContainer center={santiagoCoords} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {empresasConCoordenadas.map(empresa => (
                    <Marker key={empresa.id} position={[empresa.coordenadas!.lat, empresa.coordenadas!.lng]}>
                        <Popup>
                            <div className="font-sans">
                                <strong className="font-bold block">{empresa.nombre}</strong>
                                {empresa.direccion}
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};


const GestionEmpresas: React.FC = () => {
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [estudiantes, setEstudiantes] = useState<User[]>([]);
    const [view, setView] = useState<'list' | 'form' | 'map'>('list');
    const [currentEmpresa, setCurrentEmpresa] = useState<Omit<Empresa, 'id' | 'createdAt'> | Empresa | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubEmpresas = subscribeToEmpresas(setEmpresas);
        const unsubEstudiantes = subscribeToEstudiantes((data) => {
            setEstudiantes(data);
            setLoading(false);
        });
        return () => {
            unsubEmpresas();
            unsubEstudiantes();
        };
    }, []);

    const handleSave = async () => {
        if (!currentEmpresa) return;
        try {
            // La geocodificación se manejará en el helper (ver paso 3)
            await saveEmpresa(currentEmpresa);
            setView('list');
            setCurrentEmpresa(null);
        } catch (error) {
            console.error("Error al guardar la empresa:", error);
            alert("No se pudo guardar la empresa.");
        }
    };
    
    const handleDelete = async (empresaId: string) => {
        if (window.confirm("¿Está seguro de eliminar esta empresa?")) {
            await deleteEmpresa(empresaId);
        }
    };
    
    // ... (otras funciones handler sin cambios)
    const handleFormChange = (field: keyof Empresa, value: any) => {
        setCurrentEmpresa(prev => prev ? { ...prev, [field]: value } : null);
    };

    if (loading) {
        return <div className="text-center p-8">Cargando gestión de empresas...</div>;
    }

    // --- RENDERIZADO ---
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">Gestión de Empresas para Prácticas TP</h1>
                <div className="flex items-center gap-4">
                    {view !== 'list' && (
                         <button onClick={() => setView('list')} className="font-semibold">&larr; Volver a la lista</button>
                    )}
                    {view === 'list' && (
                        <>
                            <button onClick={() => setView('map')} title="Vista de Mapa" className="bg-slate-200 dark:bg-slate-700 p-2 rounded-lg">🗺️</button>
                            <button onClick={() => { setCurrentEmpresa(getInitialFormData()); setView('form'); }} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg">Crear Nueva Empresa</button>
                        </>
                    )}
                </div>
            </div>

            {view === 'map' && <MapView empresas={empresas} />}
            
            {view === 'list' && (
                 <div className="space-y-3">
                    {empresas.map(empresa => (
                        <div key={empresa.id} className="p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{empresa.nombre}</h3>
                                    <p className="text-sm text-slate-500">{empresa.rut} | {empresa.direccion}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => { setCurrentEmpresa(JSON.parse(JSON.stringify(empresa))); setView('form'); }} className="text-sm font-semibold">Editar</button>
                                    <button onClick={() => handleDelete(empresa.id)} className="text-sm text-red-500">Eliminar</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {view === 'form' && currentEmpresa && (
                 <div className="space-y-6">
                    <h2 className="text-2xl font-bold">{ 'id' in currentEmpresa ? 'Editando Empresa' : 'Nueva Empresa'}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={currentEmpresa.nombre} onChange={e => handleFormChange('nombre', e.target.value)} placeholder="Nombre Empresa" className="input-style" />
                        <input value={currentEmpresa.rut} onChange={e => handleFormChange('rut', e.target.value)} placeholder="RUT Empresa" className="input-style" />
                        <input value={currentEmpresa.direccion} onChange={e => handleFormChange('direccion', e.target.value)} placeholder="Dirección" className="input-style" />
                        <input value={currentEmpresa.contacto} onChange={e => handleFormChange('contacto', e.target.value)} placeholder="Contacto" className="input-style" />
                    </div>
                    <p className="text-sm text-slate-500">Para una correcta visualización en el mapa, ingrese una dirección precisa (Calle, Número, Comuna, Ciudad).</p>
                    {/* ... resto del formulario (calificaciones, cupos, etc.) ... */}
                    <button onClick={handleSave} className="w-full bg-amber-500 text-white font-bold py-2 rounded-lg">Guardar Empresa</button>
                </div>
            )}
        </div>
    );
};

export default GestionEmpresas;
