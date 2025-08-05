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
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

// Arreglo para el ícono por defecto de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --- HOOK PARA CARGAR EL SCRIPT DE GOOGLE MAPS DE FORMA SEGURA ---
const useGoogleMapsScript = (apiKey: string) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const scriptId = 'google-maps-script';

        if (document.getElementById(scriptId) || window.google) {
            setIsLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => setIsLoaded(true);
        script.onerror = () => setError(new Error('No se pudo cargar el script de Google Maps.'));

        document.head.appendChild(script);

    }, [apiKey]);

    return { isLoaded, error };
};


const ELEMENTOS_A_EVALUAR: Omit<CalificacionItem, 'score'>[] = [
  { elemento: "Cumplimiento legal y formalidad" },
  { elemento: "Contrato o convenio formal de práctica" },
  // ... (otros elementos)
];

const getInitialFormData = (): Omit<Empresa, 'id' | 'createdAt'> => ({
    nombre: '', rut: '', direccion: '', contacto: '', cupos: 1,
    calificaciones: ELEMENTOS_A_EVALUAR.map(item => ({ ...item, score: null })),
    estudiantesAsignados: [],
});

const MapView: React.FC<{ empresas: Empresa[] }> = ({ empresas }) => {
    const empresasConCoordenadas = empresas.filter(e => e.coordenadas?.lat && e.coordenadas?.lng);
    const santiagoCoords: [number, number] = [-33.4489, -70.6693];

    return (
        <div className="h-[600px] w-full rounded-lg overflow-hidden border dark:border-slate-700">
            <MapContainer center={santiagoCoords} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {empresasConCoordenadas.map(empresa => (
                    <Marker key={empresa.id} position={[empresa.coordenadas!.lat, empresa.coordenadas!.lng]}>
                        <Popup><strong>{empresa.nombre}</strong><br/>{empresa.direccion}</Popup>
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
    const [addressValue, setAddressValue] = useState(null);
    
    // Usamos el hook para cargar el script
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const { isLoaded: isMapScriptLoaded, error: mapScriptError } = useGoogleMapsScript(apiKey);


    useEffect(() => {
        const unsubEmpresas = subscribeToEmpresas(setEmpresas);
        const unsubEstudiantes = subscribeToEstudiantes((data) => {
            setEstudiantes(data);
            setLoading(false);
        });
        return () => { unsubEmpresas(); unsubEstudiantes(); };
    }, []);

    const handleSave = async () => {
        if (!currentEmpresa) return;
        try {
            await saveEmpresa(currentEmpresa);
            setView('list');
            setCurrentEmpresa(null);
            setAddressValue(null);
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
    
    const handleFormChange = (field: keyof Omit<Empresa, 'id' | 'createdAt'>, value: any) => {
        setCurrentEmpresa(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleEdit = (empresa: Empresa) => {
        setCurrentEmpresa(JSON.parse(JSON.stringify(empresa)));
        if (empresa.direccion) {
            setAddressValue({ label: empresa.direccion, value: { description: empresa.direccion } } as any);
        }
        setView('form');
    };

    if (loading) {
        return <div className="text-center p-8">Cargando...</div>;
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">Gestión de Empresas</h1>
                <div className="flex items-center gap-4">
                    {view !== 'list' && (
                         <button onClick={() => { setView('list'); setAddressValue(null); }} className="font-semibold">&larr; Volver</button>
                    )}
                    {view === 'list' && (
                        <>
                            <button onClick={() => setView('map')} title="Vista de Mapa" className="bg-slate-200 p-2 rounded-lg">🗺️</button>
                            <button onClick={() => { setCurrentEmpresa(getInitialFormData()); setView('form'); }} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg">Crear Empresa</button>
                        </>
                    )}
                </div>
            </div>

            {view === 'map' && <MapView empresas={empresas} />}
            
            {view === 'list' && (
                 <div className="space-y-3">
                    {empresas.map(empresa => (
                        <div key={empresa.id} className="p-4 border rounded-lg bg-slate-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{empresa.nombre}</h3>
                                    <p className="text-sm text-slate-500">{empresa.rut} | {empresa.direccion}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => handleEdit(empresa)} className="text-sm font-semibold">Editar</button>
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
                        <div className="md:col-span-2">
                             {mapScriptError ? (
                                <p className="text-red-500">Error al cargar la API de Google Maps.</p>
                             ) : isMapScriptLoaded ? (
                                <GooglePlacesAutocomplete
                                    apiKey={apiKey}
                                    selectProps={{
                                        value: addressValue,
                                        onChange: (newValue: any) => {
                                            setAddressValue(newValue);
                                            handleFormChange('direccion', newValue?.label || '');
                                        },
                                        placeholder: 'Buscar dirección...',
                                    }}
                                    autocompletionRequest={{
                                        componentRestrictions: { country: ['cl'] }
                                    }}
                                />
                             ) : (
                                <input disabled className="input-style w-full" placeholder="Cargando autocompletado..." />
                             )}
                        </div>
                        <input value={currentEmpresa.contacto} onChange={e => handleFormChange('contacto', e.target.value)} placeholder="Contacto" className="input-style" />
                    </div>
                    {/* ... resto del formulario ... */}
                    <button onClick={handleSave} className="w-full bg-amber-500 text-white font-bold py-2 rounded-lg">Guardar Empresa</button>
                </div>
            )}
        </div>
    );
};

export default GestionEmpresas;
