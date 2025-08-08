import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Empresa, CalificacionItem, User, RutaSupervision } from '../../types';
import { 
    subscribeToEmpresas, 
    saveEmpresa, 
    deleteEmpresa,
    subscribeToEstudiantes,
    subscribeToProfesores,
    saveRouteToDB,
    subscribeToSavedRoutes,
    deleteSavedRoute
} from '../../src/firebaseHelpers/empresasHelper';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Building, Hash, MapPin, User as UserIcon, Mail, Briefcase, Users, Star, LayoutDashboard } from 'lucide-react';


// Hook para cargar Google Maps, asegurando que se incluye la librería 'directions'
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

// Componente Google Maps corregido para mostrar marcadores y rutas
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
            });
        }
        
        if (!directionsRendererRef.current) {
            directionsRendererRef.current = new window.google.maps.DirectionsRenderer();
        }
        
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];
        directionsRendererRef.current.setMap(null);

        if (route) {
            directionsRendererRef.current.setMap(mapInstanceRef.current);
            directionsRendererRef.current.setDirections(route);
        } else {
            empresasConCoordenadas.forEach(empresa => {
                const marker = new window.google.maps.Marker({
                    position: { lat: empresa.coordenadas!.lat, lng: empresa.coordenadas!.lng },
                    map: mapInstanceRef.current,
                    title: empresa.nombre,
                });

                const infoWindow = new window.google.maps.InfoWindow({
                    content: `<div style="font-weight: bold;">${empresa.nombre}</div><div>${empresa.direccion}</div>`
                });

                marker.addListener('click', () => {
                    infoWindow.open(mapInstanceRef.current, marker);
                });

                markersRef.current.push(marker);
            });
        }

    }, [empresasConCoordenadas, isLoaded, route]);

    return (
        <div className="relative" id="map-container-for-pdf">
            <div 
                ref={mapRef}
                className="h-[600px] w-full rounded-lg border"
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

// Componente de detalles de ruta
const RouteDetails: React.FC<{ route: google.maps.DirectionsResult; travelMode: 'DRIVING' | 'TRANSIT' }> = ({ route, travelMode }) => {
    const PRECIO_BENCINA_POR_LITRO = 1300;
    const CONSUMO_PROMEDIO_KM_POR_LITRO = 12;
    const tiempoPorParada = travelMode === 'TRANSIT' ? 45 : 30;
    
    const travelDuration = route.routes[0].legs.reduce((acc, leg) => acc + (leg.duration?.value || 0), 0);
    const numberOfStops = route.routes[0].legs.length > 1 ? route.routes[0].legs.length - 1 : 0;
    const stopDuration = numberOfStops * tiempoPorParada * 60;
    const totalDuration = travelDuration + stopDuration;
    const totalDistance = route.routes[0].legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0);
    const costoBencina = travelMode === 'DRIVING' ? ((totalDistance / 1000) / CONSUMO_PROMEDIO_KM_POR_LITRO) * PRECIO_BENCINA_POR_LITRO : 0;

    return (
        <div className="mt-6 p-4 border rounded-lg bg-slate-50" id="route-details-for-pdf">
            <h3 className="text-xl font-bold mb-3">Detalles de la Ruta</h3>
            <div className="space-y-4">
                {route.routes[0].legs.map((leg, legIndex) => (
                    <div key={legIndex} className="border rounded-lg p-4 bg-white">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-lg">Tramo {legIndex + 1}: {leg.start_address.split(',')[0]} → {leg.end_address.split(',')[0]}</h4>
                            <div className="text-sm text-gray-600">{leg.duration?.text} • {leg.distance?.text}</div>
                        </div>
                        {travelMode === 'TRANSIT' && (
                            <div className="space-y-3">
                                {leg.steps?.map((step, stepIndex) => (
                                    step.transit && (
                                        <div key={stepIndex} className="flex items-start gap-2 text-sm py-1">
                                            <span className="text-lg">🚌</span>
                                            <span dangerouslySetInnerHTML={{ __html: step.instructions }}/>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
             <div className="mt-4 pt-4 border-t font-bold text-right">
                <p>Tiempo de viaje: {Math.round(travelDuration / 60)} min</p>
                <p>Tiempo en paradas: {Math.round(stopDuration / 60)} min</p>
                <p className="text-lg">Duración Total Estimada: {Math.round(totalDuration / 60)} min</p>
                <p>Distancia Total: {(totalDistance / 1000).toFixed(1)} km</p>
                {travelMode === 'DRIVING' && (
                    <p className="text-green-600">Costo Bencina Aprox: ${costoBencina.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</p>
                )}
            </div>
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

// --- COMPONENTE DASHBOARD ---
const DashboardView: React.FC<{ data: any }> = ({ data }) => {
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-4 border rounded-lg bg-white col-span-1">
                <h3 className="font-bold mb-4">Empresas por Especialidad</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={data.porEspecialidad} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                            {data.porEspecialidad.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
             <div className="p-4 border rounded-lg bg-white col-span-1 md:col-span-2">
                <h3 className="font-bold mb-4">Empresas por Supervisor</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.porSupervisor} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={150} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#82ca9d" name="Empresas" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="p-4 border rounded-lg bg-white col-span-1 lg:col-span-3">
                <h3 className="font-bold mb-4">Distribución por Comuna</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.porComuna}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8884d8" name="Empresas" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="p-4 border rounded-lg bg-white col-span-1">
                <h3 className="font-bold mb-4">Calificación por Ámbito</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data.calificacionPorAmbito}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis angle={30} domain={[0, 5]} />
                        <Radar name="Promedio" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                        <Tooltip />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
            <div className="p-4 border rounded-lg bg-white col-span-1 md:col-span-2">
                <h3 className="font-bold mb-4">Ranking de Empresas</h3>
                <div className="overflow-y-auto max-h-[300px]">
                    <ul className="space-y-2">
                        {data.ranking.map((empresa: any, index: number) => (
                            <li key={empresa.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                                <span className="font-semibold">{index + 1}. {empresa.nombre}</span>
                                <span className="font-bold text-amber-500">{empresa.promedio.toFixed(1)} ★</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};


const GestionEmpresas: React.FC = () => {
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [profesores, setProfesores] = useState<User[]>([]);
    const [view, setView] = useState<'list' | 'form' | 'map' | 'route' | 'saved-routes' | 'dashboard'>('list');
    const [currentEmpresa, setCurrentEmpresa] = useState<Omit<Empresa, 'id' | 'createdAt'> | Empresa | null>(null);
    const [loading, setLoading] = useState(true);
    const [addressValue, setAddressValue] = useState(null);
    
    const [startPoint, setStartPoint] = useState<{label: string, value: any} | null>(null);
    const [startPointCoords, setStartPointCoords] = useState<{lat: number, lng: number} | null>(null);
    const [selectedRouteCompanies, setSelectedRouteCompanies] = useState<Empresa[]>([]);
    const [calculatedRoute, setCalculatedRoute] = useState<google.maps.DirectionsResult | null>(null);
    const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
    const [travelMode, setTravelMode] = useState<'DRIVING' | 'TRANSIT'>('DRIVING');
    const [routeName, setRouteName] = useState('');
    const [savedRoutes, setSavedRoutes] = useState<RutaSupervision[]>([]);

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const { isLoaded: isMapScriptLoaded } = useGoogleMapsScript(apiKey);

    useEffect(() => {
        setLoading(true);
        const unsubEmpresas = subscribeToEmpresas(setEmpresas);
        const unsubProfesores = subscribeToProfesores(setProfesores);
        const unsubSavedRoutes = subscribeToSavedRoutes(setSavedRoutes);
        setLoading(false);
        return () => { 
            unsubEmpresas(); 
            unsubProfesores();
            unsubSavedRoutes();
        };
    }, []);

    const dashboardData = useMemo(() => {
        const porEspecialidad = empresas.reduce((acc, emp) => {
            const area = emp.area || 'Sin especificar';
            acc[area] = (acc[area] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const porSupervisor = empresas.reduce((acc, emp) => {
            const supervisor = emp.docenteSupervisor?.nombreCompleto || 'Sin asignar';
            acc[supervisor] = (acc[supervisor] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const porComuna = empresas.reduce((acc, emp) => {
            const parts = emp.direccion.split(',').map(p => p.trim());
            // Asumimos que la comuna es la segunda parte de la dirección.
            // Ej: "Calle Falsa 123, Providencia, Santiago, Chile"
            const comuna = parts.length > 1 ? parts[1] : 'Desconocida';
            acc[comuna] = (acc[comuna] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const calificacionPorAmbito = ELEMENTOS_A_EVALUAR.map(item => {
            const scores = empresas.flatMap(e => e.calificaciones.find(c => c.elemento === item.elemento)?.score).filter(s => s != null) as number[];
            const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            return { subject: item.elemento.split(' ')[0], A: avg, fullMark: 5 };
        });

        const ranking = empresas
            .map(emp => {
                const scores = emp.calificaciones.map(c => c.score).filter(s => s != null) as number[];
                const promedio = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                return { ...emp, promedio };
            })
            .filter(emp => emp.promedio > 0)
            .sort((a, b) => b.promedio - a.promedio);

        return {
            porEspecialidad: Object.entries(porEspecialidad).map(([name, value]) => ({ name, value })),
            porSupervisor: Object.entries(porSupervisor).map(([name, value]) => ({ name, value })),
            porComuna: Object.entries(porComuna).map(([name, value]) => ({ name, value })),
            calificacionPorAmbito,
            ranking
        };
    }, [empresas]);

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
            destination: startPointCoords,
            waypoints: waypoints,
            optimizeWaypoints: true,
            travelMode: window.google.maps.TravelMode[travelMode],
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
        setRouteName('');
    };

    const handleSaveRoute = async () => {
        if (!routeName || !startPoint || !startPointCoords || selectedRouteCompanies.length === 0) {
            alert("Por favor, asigna un nombre a la ruta y asegúrate de tener un punto de partida y empresas seleccionadas.");
            return;
        }
        const routeToSave = {
            nombre: routeName,
            startPoint: { label: startPoint.label, coords: startPointCoords },
            empresas: selectedRouteCompanies.map(e => ({id: e.id, nombre: e.nombre, coordenadas: e.coordenadas})),
            travelMode,
        };
        try {
            await saveRouteToDB(routeToSave);
            alert("Ruta guardada con éxito.");
            setView('saved-routes');
        } catch (error) {
            alert("Error al guardar la ruta.");
        }
    };

    const handleExportPDF = async () => {
        const mapElement = document.getElementById('map-container-for-pdf');
        const detailsElement = document.getElementById('route-details-for-pdf');
        if (!mapElement || !detailsElement) return;

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        
        pdf.text(`Ruta de Supervisión: ${routeName || 'Sin nombre'}`, 10, 15);
        pdf.setFontSize(10);
        pdf.text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`, 10, 22);

        const mapCanvas = await html2canvas(mapElement, { useCORS: true });
        const mapImgData = mapCanvas.toDataURL('image/png');
        pdf.addImage(mapImgData, 'PNG', 10, 30, pdfWidth - 20, 100);

        const detailsCanvas = await html2canvas(detailsElement);
        const detailsImgData = detailsCanvas.toDataURL('image/png');
        const detailsImgProps = pdf.getImageProperties(detailsImgData);
        const detailsHeight = (detailsImgProps.height * (pdfWidth - 20)) / detailsImgProps.width;
        pdf.addImage(detailsImgData, 'PNG', 10, 135, pdfWidth - 20, detailsHeight);

        pdf.save(`ruta-${routeName || 'supervision'}.pdf`);
    };
    
    const loadSavedRoute = (route: RutaSupervision) => {
        setStartPoint({ label: route.startPoint.label, value: null });
        setStartPointCoords(route.startPoint.coords);
        setSelectedRouteCompanies(route.empresas);
        setTravelMode(route.travelMode);
        setRouteName(route.nombre);
        setView('route');
    };

    const handleDeleteRoute = async (routeId: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar esta ruta guardada?")) {
            await deleteSavedRoute(routeId);
            alert("Ruta eliminada.");
        }
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
                                onClick={() => setView('dashboard')} 
                                title="Dashboard" 
                                className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <LayoutDashboard size={18} /> Dashboard
                            </button>
                            <button 
                                onClick={() => setView('saved-routes')} 
                                title="Rutas Guardadas" 
                                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Rutas Guardadas
                            </button>
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

            {view === 'dashboard' && <DashboardView data={dashboardData} />}

            {view === 'saved-routes' && (
                <div>
                    <h2 className="text-2xl font-bold mb-4">Rutas de Supervisión Guardadas</h2>
                    {/* ... (código de rutas guardadas) ... */}
                </div>
            )}

            {view === 'route' && (
                <div>
                    <h2 className="text-2xl font-bold mb-4">Planificador de Ruta de Supervisión</h2>
                    {/* ... (código del planificador de rutas) ... */}
                    {calculatedRoute && <RouteDetails route={calculatedRoute} travelMode={travelMode} />}
                </div>
            )}

            {view === 'map' && (
                <GoogleMapView empresas={empresas} isLoaded={isMapScriptLoaded} />
            )}
            
            {view === 'list' && (
                 <div className="space-y-3">
                    {empresas.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No hay empresas registradas.
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
            )}

            {view === 'form' && currentEmpresa && (
                 <div className="space-y-6">
                    <h2 className="text-2xl font-bold">
                        {'id' in currentEmpresa ? 'Editando Empresa' : 'Nueva Empresa'}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative flex items-center">
                            <Building className="absolute left-3 w-5 h-5 text-slate-400" />
                            <input value={currentEmpresa.nombre} onChange={e => handleFormChange('nombre', e.target.value)} placeholder="Nombre Empresa" className="input-style pl-10" required />
                        </div>
                        <div className="relative flex items-center">
                            <Hash className="absolute left-3 w-5 h-5 text-slate-400" />
                            <input value={currentEmpresa.rut} onChange={e => handleFormChange('rut', e.target.value)} placeholder="RUT Empresa" className="input-style pl-10" required />
                        </div>
                        <div className="md:col-span-2 relative flex items-center">
                            <MapPin className="absolute left-3 top-5 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
                            <div className="w-full pl-10">
                                <GooglePlacesAutocomplete
                                    apiKey={apiKey}
                                    selectProps={{ value: addressValue, onChange: handleAddressSelect, placeholder: 'Buscar dirección...' }}
                                    autocompletionRequest={{ componentRestrictions: { country: ['cl'] } }}
                                />
                            </div>
                        </div>
                        <div className="relative flex items-center">
                            <UserIcon className="absolute left-3 w-5 h-5 text-slate-400" />
                            <input value={currentEmpresa.contacto} onChange={e => handleFormChange('contacto', e.target.value)} placeholder="Contacto" className="input-style pl-10" />
                        </div>
                        <div className="relative flex items-center">
                            <Mail className="absolute left-3 w-5 h-5 text-slate-400" />
                            <input type="email" value={currentEmpresa.email || ''} onChange={e => handleFormChange('email', e.target.value)} placeholder="Correo electrónico" className="input-style pl-10" />
                        </div>
                        <div className="relative flex items-center">
                            <Users className="absolute left-3 w-5 h-5 text-slate-400" />
                            <input type="number" value={currentEmpresa.cupos} onChange={e => handleFormChange('cupos', parseInt(e.target.value) || 1)} placeholder="N° de cupos" className="input-style pl-10" min="1" />
                        </div>
                        <div className="relative flex items-center">
                            <Briefcase className="absolute left-3 w-5 h-5 text-slate-400" />
                            <select value={currentEmpresa.area || ''} onChange={e => handleFormChange('area', e.target.value)} className="input-style pl-10 w-full">
                                <option value="" disabled>Seleccione un área</option>
                                {AREAS_EMPRESA.map(area => (<option key={area} value={area}>{area}</option>))}
                            </select>
                        </div>
                        <div className="md:col-span-2 relative flex items-center">
                             <UserIcon className="absolute left-3 w-5 h-5 text-slate-400" />
                            <select value={currentEmpresa.docenteSupervisor ? JSON.stringify(currentEmpresa.docenteSupervisor) : ''} onChange={e => { const value = e.target.value; handleFormChange('docenteSupervisor', value ? JSON.parse(value) : undefined); }} className="input-style pl-10 w-full">
                                <option value="">Sin supervisor asignado</option>
                                {profesores.map(profesor => (<option key={profesor.id} value={JSON.stringify({ id: profesor.id, nombre: profesor.nombreCompleto })}>{profesor.nombreCompleto}</option>))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="space-y-4 pt-4">
                        <h3 className="text-lg font-semibold">Evaluación de la Empresa</h3>
                        {currentEmpresa.calificaciones.map((cal, index) => (
                             <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                                <Star className="w-5 h-5 text-slate-400" />
                                <span className="flex-1 text-sm font-medium text-gray-700">{cal.elemento}</span>
                                <select 
                                    value={cal.score || ''} 
                                    onChange={e => {
                                        const newCals = [...currentEmpresa.calificaciones!];
                                        newCals[index].score = e.target.value ? parseInt(e.target.value) : null;
                                        handleFormChange('calificaciones', newCals);
                                    }}
                                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                                >
                                    <option value="">Sin calificar</option>
                                    {[1,2,3,4,5].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div className="pt-6">
                        <button 
                            onClick={handleSave} 
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-lg transition-colors"
                            disabled={!currentEmpresa.nombre || !currentEmpresa.rut}
                        >
                            Guardar Empresa
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionEmpresas;
