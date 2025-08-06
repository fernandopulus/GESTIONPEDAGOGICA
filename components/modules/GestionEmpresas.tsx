import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Empresa, CalificacionItem, User } from '../../types';
import { 
    subscribeToEmpresas, 
    saveEmpresa, 
    deleteEmpresa,
    subscribeToEstudiantes,
    subscribeToProfesores
} from '../../src/firebaseHelpers/empresasHelper';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


// Hook para cargar Google Maps, ahora incluyendo la librería de 'directions'
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
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,directions&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => setIsLoaded(true);
        script.onerror = () => setError(new Error('No se pudo cargar Google Maps.'));

        document.head.appendChild(script);
    }, [apiKey]);

    return { isLoaded, error };
};

const ELEMENTOS_A_EVALUAR: Omit<CalificacionItem, 'score'>[] = [
  { elemento: "Cumplimiento legal y formalidad" },
  { elemento: "Contrato o convenio formal de práctica" },
  { elemento: "Ambiente laboral y clima organizacional" },
  { elemento: "Supervisión y mentoría" },
  { elemento: "Oportunidades de aprendizaje" },
  { elemento: "Recursos y herramientas disponibles" },
  { elemento: "Seguridad y salud ocupacional" },
  { elemento: "Comunicación interna" },
];

const AREAS_EMPRESA = ["Mecánica Industrial", "Mecánica Automotriz"];

const getInitialFormData = (): Omit<Empresa, 'id' | 'createdAt'> => ({
    nombre: '', 
    rut: '', 
    direccion: '', 
    contacto: '', 
    email: '',
    area: '',
    cupos: 1,
    coordenadas: null,
    calificaciones: ELEMENTOS_A_EVALUAR.map(item => ({ ...item, score: null })),
    estudiantesAsignados: [],
    docenteSupervisor: undefined,
});

// Componente Google Maps, ahora con capacidad para renderizar rutas
const GoogleMapView: React.FC<{ 
    empresas: Empresa[]; 
    isLoaded: boolean;
    route?: google.maps.DirectionsResult | null;
}> = ({ empresas, isLoaded, route }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

    const empresasConCoordenadas = empresas.filter(e => e.coordenadas?.lat && e.coordenadas?.lng);

    useEffect(() => {
        if (!isLoaded || !mapRef.current || !window.google) return;

        if (!mapInstanceRef.current) {
            mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                center: { lat: -33.4489, lng: -70.6693 },
                zoom: 11,
                mapTypeControl: true,
                streetViewControl: true,
                fullscreenControl: true,
            });
        }
        
        if (!directionsRendererRef.current) {
            directionsRendererRef.current = new window.google.maps.DirectionsRenderer();
            directionsRendererRef.current.setMap(mapInstanceRef.current);
        }

        // Limpiar marcadores y rutas anteriores
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];
        
        if (route) {
            directionsRendererRef.current.setDirections(route);
        } else {
            directionsRendererRef.current.setDirections(null); // Limpia la ruta si no hay una
            // Volver a mostrar marcadores individuales si no hay ruta
            empresasConCoordenadas.forEach(empresa => {
                const marker = new window.google.maps.Marker({
                    position: { lat: empresa.coordenadas!.lat, lng: empresa.coordenadas!.lng },
                    map: mapInstanceRef.current,
                    title: empresa.nombre,
                });
                markersRef.current.push(marker);
            });
        }

    }, [empresasConCoordenadas, isLoaded, route]);

    if (!isLoaded) {
        return (
            <div className="h-[600px] w-full rounded-lg border bg-gray-100 flex items-center justify-center">
                <p className="text-gray-600">Cargando Google Maps...</p>
            </div>
        );
    }

    return (
        <div className="relative">
            <div 
                ref={mapRef}
                className="h-[600px] w-full rounded-lg border"
                style={{ minHeight: '600px' }}
            />
            {!route && empresasConCoordenadas.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg">
                    <div className="text-center p-6">
                        <p className="text-gray-600 text-lg">📍 No hay empresas geo-localizadas</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// Componente para mostrar los detalles de la ruta
const RouteDetails: React.FC<{ route: google.maps.DirectionsResult }> = ({ route }) => {
    const leg = route.routes[0].legs[0];
    return (
        <div className="mt-6 p-4 border rounded-lg bg-slate-50">
            <h3 className="text-xl font-bold mb-3">Detalles de la Ruta</h3>
            <div className="space-y-4">
                {route.routes[0].legs.map((leg, index) => (
                    <div key={index} className="p-3 border-b">
                        <p><strong>Tramo {index + 1}:</strong> De <strong>{leg.start_address.split(',')[0]}</strong> a <strong>{leg.end_address.split(',')[0]}</strong></p>
                        <p className="text-sm text-slate-600">Duración: {leg.duration?.text}, Distancia: {leg.distance?.text}</p>
                    </div>
                ))}
            </div>
            <div className="mt-4 pt-4 border-t font-bold text-right">
                <p>Total: {route.routes[0].legs.reduce((acc, leg) => acc + (leg.duration?.value || 0), 0) / 60 | 0} min / {route.routes[0].legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0) / 1000} km</p>
            </div>
        </div>
    );
};


// Iconos SVG simplificados
const EvaluationIcon: React.FC<{ elemento: string; className?: string }> = ({ elemento, className = "w-5 h-5" }) => {
    const getIcon = (elemento: string) => {
        const elementoLower = elemento.toLowerCase();
        
        if (elementoLower.includes('legal')) return '🛡️';
        if (elementoLower.includes('contrato')) return '📄';
        if (elementoLower.includes('ambiente')) return '😊';
        if (elementoLower.includes('supervisión')) return '👥';
        if (elementoLower.includes('aprendizaje')) return '🎓';
        if (elementoLower.includes('recursos')) return '🔧';
        if (elementoLower.includes('seguridad')) return '🔒';
        if (elementoLower.includes('comunicación')) return '💬';
        
        return '📋';
    };
    
    return (
        <div className="flex-shrink-0 text-2xl">
            {getIcon(elemento)}
        </div>
    );
};

// Función para obtener coordenadas
const getPlaceDetails = async (placeId: string): Promise<{lat: number, lng: number} | null> => {
    if (!window.google) return null;
    
    return new Promise((resolve) => {
        const service = new window.google.maps.places.PlacesService(document.createElement('div'));
        
        service.getDetails({
            placeId: placeId,
            fields: ['geometry']
        }, (place, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                resolve({
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                });
            } else {
                resolve(null);
            }
        });
    });
};

const GestionEmpresas: React.FC = () => {
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [estudiantes, setEstudiantes] = useState<User[]>([]);
    const [profesores, setProfesores] = useState<User[]>([]);
    const [view, setView] = useState<'list' | 'form' | 'map' | 'route'>('list');
    const [currentEmpresa, setCurrentEmpresa] = useState<Omit<Empresa, 'id' | 'createdAt'> | Empresa | null>(null);
    const [loading, setLoading] = useState(true);
    const [addressValue, setAddressValue] = useState(null);
    
    // Estado para la ruta
    const [startPoint, setStartPoint] = useState<{label: string, value: any} | null>(null);
    const [startPointCoords, setStartPointCoords] = useState<{lat: number, lng: number} | null>(null);
    const [selectedRouteCompanies, setSelectedRouteCompanies] = useState<Empresa[]>([]);
    const [calculatedRoute, setCalculatedRoute] = useState<google.maps.DirectionsResult | null>(null);
     const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const { isLoaded: isMapScriptLoaded, error: mapScriptError } = useGoogleMapsScript(apiKey);

    // Estados para los filtros del gráfico
    const [filtroNivel, setFiltroNivel] = useState('todos');
    const [filtroIndicador, setFiltroIndicador] = useState('todos');
    const [filtroCupos, setFiltroCupos] = useState('');

    useEffect(() => {
        const unsubEmpresas = subscribeToEmpresas(setEmpresas);
        const unsubEstudiantes = subscribeToEstudiantes(setEstudiantes);
        const unsubProfesores = subscribeToProfesores(data => {
            setProfesores(data);
            setLoading(false);
        });

        return () => { 
            unsubEmpresas(); 
            unsubEstudiantes(); 
            unsubProfesores();
        };
    }, []);

    const handleSave = async () => {
        if (!currentEmpresa) return;
        try {
            await saveEmpresa(currentEmpresa);
            setView('list');
            setCurrentEmpresa(null);
            setAddressValue(null);
        } catch (error) {
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

    const handleAddressSelect = async (newValue: any) => {
        setAddressValue(newValue);
        if (newValue?.value?.place_id && isMapScriptLoaded) {
            const coords = await getPlaceDetails(newValue.value.place_id);
            handleFormChange('direccion', newValue.label || '');
            handleFormChange('coordenadas', coords);
        } else {
            handleFormChange('direccion', newValue?.label || '');
        }
    };

    const handleEdit = (empresa: Empresa) => {
        setCurrentEmpresa(JSON.parse(JSON.stringify(empresa)));
        if (empresa.direccion) {
            setAddressValue({ label: empresa.direccion, value: { description: empresa.direccion } } as any);
        }
        setView('form');
    };

    const handleStartPointSelect = async (newValue: any) => {
        setStartPoint(newValue);
        if (newValue?.value?.place_id && isMapScriptLoaded) {
            const coords = await getPlaceDetails(newValue.value.place_id);
            setStartPointCoords(coords);
        }
    };

    const handleRouteCompanyToggle = (empresa: Empresa) => {
        setSelectedRouteCompanies(prev => 
            prev.some(e => e.id === empresa.id)
                ? prev.filter(e => e.id !== empresa.id)
                : [...prev, empresa]
        );
    };

    const handleGenerateRoute = () => {
        if (!startPointCoords || selectedRouteCompanies.length === 0 || !isMapScriptLoaded) return;

        setIsCalculatingRoute(true);
        const directionsService = new window.google.maps.DirectionsService();

        const waypoints = selectedRouteCompanies
            .filter(e => e.coordenadas)
            .map(e => ({ location: e.coordenadas!, stopover: true }));

        directionsService.route({
            origin: startPointCoords,
            destination: startPointCoords, // El destino es el mismo que el origen para una ruta circular
            waypoints: waypoints,
            optimizeWaypoints: true,
            travelMode: window.google.maps.TravelMode.DRIVING
        }, (result, status) => {
            setIsCalculatingRoute(false);
            if (status === window.google.maps.DirectionsStatus.OK && result) {
                setCalculatedRoute(result);
            } else {
                alert("No se pudo calcular la ruta: " + status);
            }
        });
    };
    
    const clearRoute = () => {
        setCalculatedRoute(null);
        setStartPoint(null);
        setStartPointCoords(null);
        setSelectedRouteCompanies([]);
    };

    // Lógica para el gráfico
    const getPromedioEmpresa = (empresa: Empresa): number | null => {
        const scores = empresa.calificaciones.map(c => c.score).filter(s => s !== null) as number[];
        if (scores.length === 0) return null;
        return scores.reduce((a, b) => a + b, 0) / scores.length;
    };

    const empresasFiltradasParaGrafico = useMemo(() => {
        const cuposNum = parseInt(filtroCupos);
        return empresas
            .filter(e => {
                if (!filtroCupos || isNaN(cuposNum)) return true;
                return e.cupos >= cuposNum;
            })
            .filter(e => {
                if (filtroNivel === 'todos') return true;
                const promedio = getPromedioEmpresa(e);
                if (promedio === null) return false;
                if (filtroNivel === 'excelente') return promedio >= 4.5;
                if (filtroNivel === 'bueno') return promedio >= 3.5 && promedio < 4.5;
                if (filtroNivel === 'regular') return promedio >= 2.5 && promedio < 3.5;
                if (filtroNivel === 'deficiente') return promedio < 2.5;
                return false;
            });
    }, [empresas, filtroNivel, filtroCupos]);

    const chartData = useMemo(() => {
        if (filtroIndicador !== 'todos') {
            return empresasFiltradasParaGrafico
                .map(e => ({
                    name: e.nombre,
                    Puntaje: e.calificaciones.find(c => c.elemento === filtroIndicador)?.score || 0
                }))
                .filter(item => item.Puntaje > 0);
        } else {
            return ELEMENTOS_A_EVALUAR.map(indicador => {
                const scores = empresasFiltradasParaGrafico
                    .map(e => e.calificaciones.find(c => c.elemento === indicador.elemento)?.score)
                    .filter(score => score != null) as number[];
                
                const promedio = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                
                return {
                    name: indicador.elemento.split(' ')[0],
                    Promedio: parseFloat(promedio.toFixed(1)),
                    fullName: indicador.elemento,
                };
            });
        }
    }, [empresasFiltradasParaGrafico, filtroIndicador]);

    if (loading) {
        return <div className="text-center p-8">Cargando...</div>;
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">Gestión de Empresas</h1>
                <div className="flex items-center gap-4">
                    {view !== 'list' && (
                         <button 
                            onClick={() => { 
                                setView('list'); 
                                setAddressValue(null); 
                                setCurrentEmpresa(null);
                                clearRoute();
                            }} 
                            className="font-semibold hover:text-blue-600"
                        >
                            ← Volver al listado
                        </button>
                    )}
                    {view === 'list' && (
                        <>
                            <button 
                                onClick={() => setView('route')} 
                                title="Ruta de Supervisión" 
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Ruta de Supervisión
                            </button>
                             <button 
                                onClick={() => setView('map')} 
                                title="Vista de Mapa" 
                                className="bg-slate-200 hover:bg-slate-300 p-2 rounded-lg transition-colors"
                            >
                                🗺️
                            </button>
                            <button 
                                onClick={() => { 
                                    setCurrentEmpresa(getInitialFormData()); 
                                    setView('form'); 
                                }} 
                                className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Crear Empresa
                            </button>
                        </>
                    )}
                </div>
            </div>

            {view === 'route' && (
                <div>
                    <h2 className="text-2xl font-bold mb-4">Planificador de Ruta de Supervisión</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">1. Ingresa el punto de partida</label>
                                <GooglePlacesAutocomplete
                                    apiKey={apiKey}
                                    selectProps={{
                                        value: startPoint,
                                        onChange: handleStartPointSelect,
                                        placeholder: 'Buscar dirección de partida...',
                                    }}
                                    autocompletionRequest={{ componentRestrictions: { country: ['cl'] } }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">2. Selecciona las empresas a visitar</label>
                                <div className="max-h-80 overflow-y-auto border rounded-lg p-2 space-y-2">
                                    {empresas.filter(e => e.coordenadas).map(empresa => (
                                        <div key={empresa.id} className="flex items-center">
                                            <input 
                                                type="checkbox"
                                                id={`route-${empresa.id}`}
                                                checked={selectedRouteCompanies.some(e => e.id === empresa.id)}
                                                onChange={() => handleRouteCompanyToggle(empresa)}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <label htmlFor={`route-${empresa.id}`} className="ml-3 text-sm text-gray-700">{empresa.nombre}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button 
                                    onClick={handleGenerateRoute}
                                    disabled={!startPointCoords || selectedRouteCompanies.length === 0 || isCalculatingRoute}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isCalculatingRoute ? 'Calculando...' : 'Generar Ruta'}
                                </button>
                                {calculatedRoute && (
                                    <button onClick={clearRoute} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors">
                                        Limpiar Ruta
                                    </button>
                                )}
                            </div>
                        </div>
                        <div>
                           <GoogleMapView empresas={selectedRouteCompanies} isLoaded={isMapScriptLoaded} route={calculatedRoute} />
                        </div>
                    </div>
                    {calculatedRoute && <RouteDetails route={calculatedRoute} />}
                </div>
            )}

            {view === 'map' && (
                <GoogleMapView empresas={empresas} isLoaded={isMapScriptLoaded} />
            )}
            
            {view === 'list' && (
                 <>
                    <div className="space-y-3">
                        {empresas.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No hay empresas registradas
                            </div>
                        ) : (
                            empresas.map(empresa => (
                                <div key={empresa.id} className="p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-lg">{empresa.nombre}</h3>
                                            <p className="text-sm text-slate-500">
                                                {empresa.rut} | {empresa.direccion}
                                            </p>
                                            <p className="text-sm text-slate-600">
                                                Área: {empresa.area || 'No especificada'} | Cupos: {empresa.cupos} | Supervisor: {empresa.docenteSupervisor?.nombreCompleto || 'Ninguno'}
                                            </p>
                                            <p className="text-sm text-slate-600">
                                                {empresa.coordenadas ? ' 📍 Geo-localizada' : ' ⚠️ Sin coordenadas'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => handleEdit(empresa)} 
                                                className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                                            >
                                                Editar
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(empresa.id)} 
                                                className="text-sm text-red-500 hover:text-red-700"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    {/* Resumen Gráfico */}
                    <div className="mt-12 pt-6 border-t">
                        <h2 className="text-2xl font-bold mb-4">Resumen Gráfico de Calificaciones</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg border">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de Desempeño</label>
                                <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)} className="input-style w-full">
                                    <option value="todos">Todos</option>
                                    <option value="excelente">Excelente (4.5+)</option>
                                    <option value="bueno">Bueno (3.5 - 4.4)</option>
                                    <option value="regular">Regular (2.5 - 3.4)</option>
                                    <option value="deficiente">Deficiente (&lt;2.5)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Indicador de Evaluación</label>
                                <select value={filtroIndicador} onChange={e => setFiltroIndicador(e.target.value)} className="input-style w-full">
                                    <option value="todos">Todos los indicadores (Promedio)</option>
                                    {ELEMENTOS_A_EVALUAR.map(item => (
                                        <option key={item.elemento} value={item.elemento}>{item.elemento}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cupos Mínimos</label>
                                <input type="number" value={filtroCupos} onChange={e => setFiltroCupos(e.target.value)} placeholder="Ej: 5" className="input-style w-full" />
                            </div>
                        </div>

                        <div className="h-[450px] w-full bg-white rounded-lg p-4 border">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 100 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" angle={-60} textAnchor="end" interval={0} />
                                        <YAxis domain={[0, 5]} />
                                        <Tooltip 
                                            formatter={(value, name, props) => [`${value}`, props.payload.fullName || name]}
                                        />
                                        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                                        <Bar dataKey={filtroIndicador !== 'todos' ? 'Puntaje' : 'Promedio'} fill="#8884d8" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-gray-500">No hay datos para mostrar con los filtros seleccionados.</p>
                                </div>
                            )}
                        </div>
                    </div>
                 </>
            )}

            {view === 'form' && currentEmpresa && (
                 <div className="space-y-6">
                    <h2 className="text-2xl font-bold">
                        {'id' in currentEmpresa ? 'Editando Empresa' : 'Nueva Empresa'}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <input 
                            value={currentEmpresa.nombre} 
                            onChange={e => handleFormChange('nombre', e.target.value)} 
                            placeholder="Nombre Empresa" 
                            className="input-style" 
                            required
                        />
                        <input 
                            value={currentEmpresa.rut} 
                            onChange={e => handleFormChange('rut', e.target.value)} 
                            placeholder="RUT Empresa" 
                            className="input-style" 
                            required
                        />
                        <div className="md:col-span-2">
                             {mapScriptError ? (
                                <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                                    <p className="text-red-700">Error al cargar Google Places.</p>
                                    <input 
                                        value={currentEmpresa.direccion}
                                        onChange={e => handleFormChange('direccion', e.target.value)}
                                        placeholder="Ingrese dirección manualmente..." 
                                        className="input-style w-full mt-2" 
                                    />
                                </div>
                             ) : isMapScriptLoaded ? (
                                <div>
                                    <GooglePlacesAutocomplete
                                        apiKey={apiKey}
                                        selectProps={{
                                            value: addressValue,
                                            onChange: handleAddressSelect,
                                            placeholder: 'Buscar dirección en Chile...',
                                            className: 'w-full',
                                        }}
                                        autocompletionRequest={{
                                            componentRestrictions: { country: ['cl'] }
                                        }}
                                    />
                                    {currentEmpresa.coordenadas && (
                                        <p className="text-sm text-green-600 mt-1">
                                            ✓ Coordenadas: {currentEmpresa.coordenadas.lat.toFixed(4)}, {currentEmpresa.coordenadas.lng.toFixed(4)}
                                        </p>
                                    )}
                                </div>
                             ) : (
                                <input 
                                    disabled 
                                    className="input-style w-full opacity-50" 
                                    placeholder="Cargando Google Places..." 
                                />
                             )}
                        </div>
                        <input 
                            value={currentEmpresa.contacto} 
                            onChange={e => handleFormChange('contacto', e.target.value)} 
                            placeholder="Contacto" 
                            className="input-style" 
                        />
                        <input 
                            type="email"
                            value={currentEmpresa.email || ''} 
                            onChange={e => handleFormChange('email', e.target.value)} 
                            placeholder="Correo electrónico (opcional)" 
                            className="input-style" 
                        />
                        <input 
                            type="number"
                            value={currentEmpresa.cupos} 
                            onChange={e => handleFormChange('cupos', parseInt(e.target.value) || 1)} 
                            placeholder="Número de cupos" 
                            className="input-style"
                            min="1"
                        />
                        <select
                            value={currentEmpresa.area || ''}
                            onChange={e => handleFormChange('area', e.target.value)}
                            className="input-style w-full"
                        >
                            <option value="" disabled>Seleccione un área</option>
                            {AREAS_EMPRESA.map(area => (
                                <option key={area} value={area}>{area}</option>
                            ))}
                        </select>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Docente Supervisor</label>
                            <select
                                value={currentEmpresa.docenteSupervisor ? JSON.stringify(currentEmpresa.docenteSupervisor) : ''}
                                onChange={e => {
                                    const value = e.target.value;
                                    handleFormChange('docenteSupervisor', value ? JSON.parse(value) : undefined);
                                }}
                                className="input-style w-full"
                            >
                                <option value="">Sin supervisor asignado</option>
                                {profesores.map(profesor => (
                                    <option key={profesor.id} value={JSON.stringify({ id: profesor.id, nombre: profesor.nombreCompleto })}>
                                        {profesor.nombreCompleto}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {/* Sección de calificaciones */}
                    {currentEmpresa.calificaciones && currentEmpresa.calificaciones.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Evaluación de la Empresa</h3>
                            <div className="grid gap-3">
                                {currentEmpresa.calificaciones.map((cal, index) => (
                                    <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                                        <EvaluationIcon elemento={cal.elemento} />
                                        <span className="flex-1 text-sm font-medium text-gray-700">
                                            {cal.elemento}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <select 
                                                value={cal.score || ''} 
                                                onChange={e => {
                                                    const newCals = [...currentEmpresa.calificaciones!];
                                                    newCals[index].score = e.target.value ? parseInt(e.target.value) : null;
                                                    handleFormChange('calificaciones', newCals);
                                                }}
                                                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                <option value="">Sin calificar</option>
                                                <option value="1">1 - Muy deficiente</option>
                                                <option value="2">2 - Deficiente</option>
                                                <option value="3">3 - Regular</option>
                                                <option value="4">4 - Bueno</option>
                                                <option value="5">5 - Excelente</option>
                                            </select>
                                            {cal.score && (
                                                <div className="flex items-center">
                                                    {[1, 2, 3, 4, 5].map(star => (
                                                        <span 
                                                            key={star}
                                                            className={`text-lg ${
                                                                star <= cal.score! ? 'text-yellow-400' : 'text-gray-300'
                                                            }`}
                                                        >
                                                            ★
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Resumen de calificaciones */}
                            {currentEmpresa.calificaciones.some(cal => cal.score) && (
                                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <h4 className="font-semibold text-blue-800 mb-2">Resumen de Evaluación</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-blue-600">Aspectos evaluados:</span>
                                            <span className="ml-2 font-semibold">
                                                {currentEmpresa.calificaciones.filter(cal => cal.score).length} / {currentEmpresa.calificaciones.length}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-blue-600">Promedio:</span>
                                            <span className="ml-2 font-semibold">
                                                {(currentEmpresa.calificaciones
                                                    .filter(cal => cal.score)
                                                    .reduce((sum, cal) => sum + cal.score!, 0) / 
                                                  currentEmpresa.calificaciones.filter(cal => cal.score).length
                                                ).toFixed(1)} / 5.0
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <button 
                        onClick={handleSave} 
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-lg transition-colors"
                        disabled={!currentEmpresa.nombre || !currentEmpresa.rut}
                    >
                        Guardar Empresa
                    </button>
                </div>
            )}
        </div>
    );
};

export default GestionEmpresas;
