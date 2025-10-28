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
import { subscribeNotasEstudiante, addNotaPractica, deleteNotaPractica } from '../../src/firebaseHelpers/notasPracticaHelper';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Building, Hash, MapPin, User as UserIcon, Mail, Briefcase, Users, Star, LayoutDashboard } from 'lucide-react';
import { CURSOS_DUAL } from '../../constants';
import { useAuth } from '../../src/hooks/useAuth';


// Hook para cargar Google Maps, asegurando que se incluye la librería 'directions'
const useGoogleMapsScript = (apiKey: string) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!apiKey) {
            setError(new Error('No se ha proporcionado una API Key de Google Maps.'));
            return;
        }
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

// --- COMPONENTE DASHBOARD (CLÁSICO) ---
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

// --- COMPONENTE DASHBOARD (MODERNO) ---
const DashboardViewModern: React.FC<{ data: any }> = ({ data }) => {
    const COLORS = ['#6366F1', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444'];
    const totalEmpresas = data?.porEspecialidad?.reduce((acc: number, it: any) => acc + (it.value || 0), 0) || 0;
    const geoEmpresas = (data?.ranking || []).filter((e: any) => e.coordenadas).length || 0;
    const promedioGlobal = (() => {
        const vals = (data?.ranking || []).map((e: any) => e.promedio).filter((n: number) => !isNaN(n) && n > 0);
        if (!vals.length) return 0;
        return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
    })();
    const supervisoresActivos = new Set((data?.porSupervisor || []).map((x: any) => x.name)).size;

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-400 text-white shadow-md">
                    <div className="text-xs opacity-90">Empresas</div>
                    <div className="text-2xl font-bold">{totalEmpresas}</div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-tr from-cyan-500 to-cyan-400 text-white shadow-md">
                    <div className="text-xs opacity-90">Geo-localizadas</div>
                    <div className="text-2xl font-bold">{geoEmpresas}</div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-tr from-emerald-500 to-emerald-400 text-white shadow-md">
                    <div className="text-xs opacity-90">Promedio Calificación</div>
                    <div className="text-2xl font-bold">{promedioGlobal.toFixed(1)} ★</div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-md">
                    <div className="text-xs opacity-90">Supervisores Activos</div>
                    <div className="text-2xl font-bold">{supervisoresActivos}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Donut por Especialidad con etiqueta central */}
                <div className="p-4 border rounded-xl bg-white dark:bg-slate-900 col-span-1">
                    <h3 className="font-bold mb-4">Empresas por Especialidad</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <defs>
                                <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#6366F1" />
                                    <stop offset="100%" stopColor="#22C55E" />
                                </linearGradient>
                            </defs>
                            <Pie data={data.porEspecialidad} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} strokeWidth={3} stroke="#ffffff">
                                {data.porEspecialidad.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="-mt-24 h-0 flex items-center justify-center pointer-events-none select-none">
                        <div className="text-center">
                            <div className="text-xs text-slate-500">Total</div>
                            <div className="text-2xl font-bold">{totalEmpresas}</div>
                        </div>
                    </div>
                </div>

                {/* Barras redondeadas por Supervisor */}
                <div className="p-4 border rounded-xl bg-white dark:bg-slate-900 col-span-1 md:col-span-2">
                    <h3 className="font-bold mb-4">Empresas por Supervisor</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.porSupervisor} layout="vertical" margin={{ left: 12, right: 12 }}>
                            <defs>
                                <linearGradient id="gradGreen" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#06B6D4" />
                                    <stop offset="100%" stopColor="#22C55E" />
                                </linearGradient>
                            </defs>
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <Tooltip cursor={{ fill: 'rgba(148,163,184,0.15)' }} />
                            <Bar dataKey="value" fill="url(#gradGreen)" name="Empresas" radius={[8, 8, 8, 8]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Distribución por Comuna (barras) */}
                <div className="p-4 border rounded-xl bg-white dark:bg-slate-900 col-span-1 lg:col-span-3">
                    <h3 className="font-bold mb-4">Distribución por Comuna</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.porComuna} margin={{ left: 0, right: 0 }}>
                            <defs>
                                <linearGradient id="gradIndigo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366F1" />
                                    <stop offset="100%" stopColor="#8B5CF6" />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} interval={0} angle={-15} height={60} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <Tooltip cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                            <Bar dataKey="value" name="Empresas" fill="url(#gradIndigo)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Radar mejorado */}
                <div className="p-4 border rounded-xl bg-white dark:bg-slate-900 col-span-1">
                    <h3 className="font-bold mb-4">Calificación por Ámbito</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data.calificacionPorAmbito}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <Radar name="Promedio" dataKey="A" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.35} />
                            <Tooltip />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>

                {/* Ranking */}
                <div className="p-4 border rounded-xl bg-white dark:bg-slate-900 col-span-1 md:col-span-2">
                    <h3 className="font-bold mb-4">Ranking de Empresas</h3>
                    <div className="overflow-y-auto max-h-[300px] divide-y">
                        {(data.ranking || []).map((empresa: any, index: number) => (
                            <div key={empresa.id || index} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">{index + 1}</div>
                                    <span className="font-medium">{empresa.nombre}</span>
                                </div>
                                <span className="font-bold text-amber-500">{(empresa.promedio || 0).toFixed(1)} ★</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


const GestionEmpresas: React.FC = () => {
    const { currentUser } = useAuth();
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [profesores, setProfesores] = useState<User[]>([]);
    const [estudiantes, setEstudiantes] = useState<User[]>([]);
    const [cursoFiltro, setCursoFiltro] = useState<'todos' | '3ºA' | '3ºB' | '3ºC' | '3ºD' | '4ºA' | '4ºB' | '4ºC' | '4ºD'>('todos');
    const [view, setView] = useState<'list' | 'form' | 'map' | 'route' | 'saved-routes' | 'dashboard' | 'estudiantes'>('list');
    const [modernCharts, setModernCharts] = useState(true);
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
    const [notasPorEstudiante, setNotasPorEstudiante] = useState<Record<string, { notas: any[]; unsub?: () => void }>>({});
    const [notaNueva, setNotaNueva] = useState<Record<string, { texto: string; color: 'yellow' | 'pink' | 'green' | 'blue' }>>({});

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const { isLoaded: isMapScriptLoaded, error: mapScriptError } = useGoogleMapsScript(apiKey);

    useEffect(() => {
        setLoading(true);
        const unsubEmpresas = subscribeToEmpresas(setEmpresas);
        const unsubProfesores = subscribeToProfesores(setProfesores);
        const unsubEstudiantes = subscribeToEstudiantes(setEstudiantes);
        const unsubSavedRoutes = subscribeToSavedRoutes(setSavedRoutes);
        setLoading(false);
        return () => { 
            unsubEmpresas(); 
            unsubProfesores();
            unsubEstudiantes();
            unsubSavedRoutes();
            // Limpiar suscripciones de notas
            Object.values(notasPorEstudiante).forEach(v => v.unsub && v.unsub());
        };
    }, []);

    // Suscripción dinámica a notas para estudiantes visibles (3º/4º + filtro curso)
    useEffect(() => {
        // limpiar previas
        Object.values(notasPorEstudiante).forEach(v => v.unsub && v.unsub());
        const nuevos: Record<string, { notas: any[]; unsub?: () => void }> = {};
        const es3o4 = (curso?: string) => !!curso && (curso.startsWith('3º') || curso.startsWith('4º'));
        let visibles = estudiantes.filter(e => es3o4(e.curso));
        if (cursoFiltro !== 'todos') visibles = visibles.filter(e => (e.curso || '') === cursoFiltro);
        visibles.forEach(st => {
            const unsub = subscribeNotasEstudiante(st.id, (notas) => {
                setNotasPorEstudiante(prev => ({ ...prev, [st.id]: { ...(prev[st.id] || {}), notas } }));
            });
            nuevos[st.id] = { notas: [], unsub };
        });
        setNotasPorEstudiante(prev => ({ ...prev, ...nuevos }));
        return () => {
            Object.values(nuevos).forEach(v => v.unsub && v.unsub());
        };
    }, [estudiantes, cursoFiltro]);

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
            // 1) Validar conflictos: estudiantes ya asignados a otra empresa
            const selectedIds = new Set(currentEmpresa.estudiantesAsignados || []);
            const currentId = (currentEmpresa as any).id as string | undefined;

            type Conflict = { student: User; empresa: Empresa };
            const conflictos: Conflict[] = [];
            if (selectedIds.size > 0) {
                // Mapa rápido de estudiantes por id para nombres/curso
                const mapEst = new Map(estudiantes.map(e => [e.id, e] as const));
                for (const emp of empresas) {
                    if (currentId && emp.id === currentId) continue; // ignorar la misma empresa si es edición
                    const asignados = emp.estudiantesAsignados || [];
                    for (const sid of selectedIds) {
                        if (asignados.includes(sid)) {
                            const st = mapEst.get(sid);
                            if (st) conflictos.push({ student: st, empresa: emp });
                        }
                    }
                }
            }

            // 2) Si hay conflictos, solicitar confirmación de reasignación
            if (conflictos.length > 0) {
                // Agrupar por empresa para mostrar compacto
                const detalles = conflictos
                    .map(c => `• ${c.student.nombreCompleto}${c.student.curso ? ` (${c.student.curso})` : ''} → ${c.empresa.nombre}`)
                    .join('\n');
                const msg = `Algunos estudiantes ya están asignados a otra empresa:\n\n${detalles}\n\n¿Deseas reasignarlos a "${currentEmpresa.nombre}"? Esto los quitará de su empresa anterior.`;
                const proceed = window.confirm(msg);
                if (!proceed) return; // cancelar guardado si no desea reasignar

                // Reasignar: quitar esos alumnos de sus empresas previas
                // Agrupar estudiantes por empresa previa para minimizar escrituras
                const porEmpresa = new Map<string, { empresa: Empresa; ids: Set<string> }>();
                for (const { student, empresa } of conflictos) {
                    if (!porEmpresa.has(empresa.id)) porEmpresa.set(empresa.id, { empresa, ids: new Set() });
                    porEmpresa.get(empresa.id)!.ids.add(student.id);
                }
                for (const { empresa, ids } of porEmpresa.values()) {
                    const nuevos = (empresa.estudiantesAsignados || []).filter(id => !ids.has(id));
                    await saveEmpresa({ ...empresa, estudiantesAsignados: nuevos });
                }
            }

            // 3) Guardar la empresa actual
            await saveEmpresa(currentEmpresa);
            setView('list');
            setCurrentEmpresa(null);
            setAddressValue(null);
        } catch (error) {
            console.error(error);
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

    // Asignación de empresa desde la vista de estudiantes
    const handleAssignEmpresaToStudent = async (student: User, newEmpresaId: string) => {
        try {
            const currentEmp = empresas.find(e => (e.estudiantesAsignados || []).includes(student.id)) || null;
            if (!newEmpresaId) {
                // Quitar asignación
                if (!currentEmp) return;
                const updated = (currentEmp.estudiantesAsignados || []).filter(id => id !== student.id);
                await saveEmpresa({ ...currentEmp, estudiantesAsignados: updated });
                return;
            }
            const target = empresas.find(e => e.id === newEmpresaId);
            if (!target) {
                alert('Empresa no encontrada.');
                return;
            }
            if (currentEmp && currentEmp.id === target.id) return; // sin cambios

            if (currentEmp) {
                const confirmMsg = `"${student.nombreCompleto}" ya está asignado a "${currentEmp.nombre}".\n\n¿Deseas reasignarlo a "${target.nombre}"?`;
                const ok = window.confirm(confirmMsg);
                if (!ok) return;
            }
            // 1) remover de empresa anterior si aplica
            if (currentEmp) {
                const updatedPrev = (currentEmp.estudiantesAsignados || []).filter(id => id !== student.id);
                await saveEmpresa({ ...currentEmp, estudiantesAsignados: updatedPrev });
            }
            // 2) agregar a nueva empresa (evitar duplicado)
            const setIds = new Set(target.estudiantesAsignados || []);
            setIds.add(student.id);
            await saveEmpresa({ ...target, estudiantesAsignados: Array.from(setIds) });
        } catch (err) {
            console.error(err);
            alert('No se pudo asignar la empresa.');
        }
    };

    if (loading) {
        return <div className="text-center p-8">Cargando...</div>;
    }

    if (mapScriptError) {
        return (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-xl shadow-md" role="alert">
                <p className="font-bold text-lg">Error de Configuración de Google Maps</p>
                <p className="mt-2">{mapScriptError.message}</p>
                <p className="mt-4 text-sm">
                    Para solucionar este problema, por favor crea un archivo llamado <code>.env.local</code> en la raíz del proyecto y añade la siguiente línea:
                </p>
                <pre className="bg-gray-800 text-white p-3 rounded-md mt-2 text-sm">
                    VITE_GOOGLE_MAPS_API_KEY=TU_API_KEY_DE_GOOGLE_MAPS
                </pre>
                <p className="mt-2 text-sm">
                    Reemplaza <code>TU_API_KEY_DE_GOOGLE_MAPS</code> con tu clave real. Asegúrate de que la clave tenga habilitada la "Maps JavaScript API" y la "Places API" en tu consola de Google Cloud.
                </p>
            </div>
        );
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
                                onClick={() => setView('estudiantes')} 
                                title="Estudiantes" 
                                className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Estudiantes
                            </button>
                            {/* Toggle de estilo de gráficos */}
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm">
                                <span>Vista moderna</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={modernCharts} onChange={(e) => setModernCharts(e.target.checked)} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full dark:bg-gray-600 peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                </label>
                            </div>
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

            {view === 'dashboard' && (modernCharts ? <DashboardViewModern data={dashboardData} /> : <DashboardView data={dashboardData} />)}

            {view === 'estudiantes' && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <h2 className="text-2xl font-bold">Estudiantes (3º y 4º)</h2>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-600 dark:text-slate-300">Curso</label>
                            <select
                                value={cursoFiltro}
                                onChange={(e) => setCursoFiltro(e.target.value as any)}
                                className="border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="todos">Todos</option>
                                {CURSOS_DUAL.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {(() => {
                        // Filtrar estudiantes de 3º y 4º
                        const es3o4 = (curso?: string) => !!curso && (curso.startsWith('3º') || curso.startsWith('4º'));
                        let lista = estudiantes.filter(e => es3o4(e.curso));
                        if (cursoFiltro !== 'todos') lista = lista.filter(e => (e.curso || '') === cursoFiltro);

                        const encontrarEmpresa = (student: User): Empresa | null => {
                            // Buscar por id en estudiantesAsignados, o por email si coincidiera
                            for (const emp of empresas) {
                                const asignados = emp.estudiantesAsignados || [];
                                if (asignados.includes(student.id)) return emp;
                                if (student.email && asignados.includes(student.email)) return emp;
                            }
                            return null;
                        };

                        if (lista.length === 0) {
                            return (
                                <div className="text-center p-8 text-slate-500 bg-slate-50 dark:bg-slate-700/30 rounded-lg">No hay estudiantes para el filtro seleccionado.</div>
                            );
                        }

                        return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {lista.map(st => {
                                    const emp = encontrarEmpresa(st);
                                    return (
                                        <div key={st.id} className="p-4 rounded-xl border bg-white dark:bg-slate-900 flex flex-col gap-3 hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                                    {st.nombreCompleto?.split(' ').map(p=>p[0]).slice(0,2).join('') || 'E'}
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{st.nombreCompleto}</div>
                                                    <div className="text-xs text-slate-500">{st.curso || '—'}</div>
                                                </div>
                                            </div>
                                            <div className="h-px bg-slate-200 dark:bg-slate-700" />
                                            <div className="flex items-start gap-2">
                                                <Building className="w-4 h-4 text-slate-400 mt-1" />
                                                <div>
                                                    <div className="text-sm">
                                                        <span className="font-medium">Empresa:</span> {emp?.nombre || 'Sin empresa asignada'}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {emp?.direccion || ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <UserIcon className="w-4 h-4 text-slate-400 mt-1" />
                                                <div className="text-sm">
                                                    <span className="font-medium">Supervisor:</span> {emp?.docenteSupervisor?.nombreCompleto || '—'}
                                                </div>
                                            </div>
                                            <div className="h-px bg-slate-200 dark:bg-slate-700" />
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs text-slate-500">Asignar empresa</label>
                                                <select
                                                    value={emp?.id || ''}
                                                    onChange={(e) => handleAssignEmpresaToStudent(st, e.target.value)}
                                                    className="border rounded-md px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-600"
                                                >
                                                    <option value="">Sin empresa</option>
                                                    {empresas
                                                        .slice()
                                                        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
                                                        .map(option => (
                                                            <option key={option.id} value={option.id}>{option.nombre}</option>
                                                        ))}
                                                </select>
                                            </div>
                                            {/* Notas tipo post-it */}
                                            <div className="h-px bg-slate-200 dark:bg-slate-700" />
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-slate-500">Notas de práctica</span>
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={(notaNueva[st.id]?.color) || 'yellow'}
                                                            onChange={(e) => setNotaNueva(prev => ({ ...prev, [st.id]: { texto: prev[st.id]?.texto || '', color: e.target.value as any } }))}
                                                            className="border rounded px-1 py-0.5 text-xs dark:bg-slate-800 dark:border-slate-600"
                                                        >
                                                            <option value="yellow">Amarillo</option>
                                                            <option value="pink">Rosado</option>
                                                            <option value="green">Verde</option>
                                                            <option value="blue">Azul</option>
                                                        </select>
                                                        <button
                                                            className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded"
                                                            onClick={async () => {
                                                                const txt = (notaNueva[st.id]?.texto || '').trim();
                                                                const color = (notaNueva[st.id]?.color) || 'yellow';
                                                                if (!txt) return;
                                                                const nota: any = {
                                                                    estudianteId: st.id,
                                                                    estudianteNombre: st.nombreCompleto,
                                                                    curso: st.curso,
                                                                    autorId: currentUser?.id || 'system',
                                                                    autorNombre: currentUser?.nombreCompleto || 'Usuario',
                                                                    texto: txt,
                                                                    color,
                                                                };
                                                                if (emp?.id) nota.empresaId = emp.id;
                                                                if (emp?.nombre) nota.empresaNombre = emp.nombre;
                                                                await addNotaPractica(nota);
                                                                setNotaNueva(prev => ({ ...prev, [st.id]: { texto: '', color } }));
                                                            }}
                                                        >Agregar</button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    value={notaNueva[st.id]?.texto || ''}
                                                    onChange={(e) => setNotaNueva(prev => ({ ...prev, [st.id]: { texto: e.target.value, color: prev[st.id]?.color || 'yellow' } }))}
                                                    placeholder="Escribe una nota breve..."
                                                    className="w-full border rounded p-2 text-sm dark:bg-slate-800 dark:border-slate-600"
                                                    rows={2}
                                                />
                                                <div className="space-y-2">
                                                    {(notasPorEstudiante[st.id]?.notas || []).map(nota => (
                                                        <div key={nota.id} className={`rounded p-2 text-sm shadow border ${
                                                            nota.color === 'pink' ? 'bg-pink-50 border-pink-200' :
                                                            nota.color === 'green' ? 'bg-green-50 border-green-200' :
                                                            nota.color === 'blue' ? 'bg-blue-50 border-blue-200' :
                                                            'bg-yellow-50 border-yellow-200'
                                                        }`}>
                                                            <div className="flex justify-between items-center">
                                                                <div className="font-medium text-slate-700">{nota.autorNombre || 'Usuario'}</div>
                                                                <button onClick={() => deleteNotaPractica(nota.id)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                                                            </div>
                                                            <div className="text-slate-700 whitespace-pre-wrap">{nota.texto}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            )}

            {view === 'saved-routes' && (
                <div>
                    <h2 className="text-2xl font-bold mb-4">Rutas de Supervisión Guardadas</h2>
                    <div className="space-y-3">
                        {savedRoutes.length === 0 ? (
                            <p className="text-gray-500">No tienes rutas guardadas.</p>
                        ) : (
                            savedRoutes.map(route => (
                                <div key={route.id} className="p-4 border rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-bold">{route.nombre}</p>
                                        <p className="text-sm text-slate-500">{route.empresas.length} paradas</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => loadSavedRoute(route)} className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm">Cargar</button>
                                        <button onClick={() => handleDeleteRoute(route.id!)} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm">Eliminar</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {view === 'route' && (
                <div>
                    <h2 className="text-2xl font-bold mb-4">Planificador de Ruta de Supervisión</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">1. Ingresa un nombre para la ruta</label>
                                <input type="text" value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Ej: Supervisión Zona Norte" className="input-style w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">2. Ingresa el punto de partida</label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">3. Elige el modo de transporte</label>
                                <div className="flex gap-4 rounded-lg bg-slate-100 p-1">
                                    <button onClick={() => setTravelMode('DRIVING')} className={`w-full py-2 rounded-md transition ${travelMode === 'DRIVING' ? 'bg-blue-500 text-white' : 'hover:bg-slate-200'}`}>Automóvil</button>
                                    <button onClick={() => setTravelMode('TRANSIT')} className={`w-full py-2 rounded-md transition ${travelMode === 'TRANSIT' ? 'bg-blue-500 text-white' : 'hover:bg-slate-200'}`}>Transporte Público</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">4. Selecciona las empresas a visitar</label>
                                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-2">
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
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={handleGenerateRoute}
                                    disabled={!startPointCoords || selectedRouteCompanies.length === 0 || isCalculatingRoute}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isCalculatingRoute ? 'Calculando...' : 'Visualizar Ruta'}
                                </button>
                                <button 
                                    onClick={handleSaveRoute}
                                    disabled={!routeName || !startPointCoords || selectedRouteCompanies.length === 0}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Guardar Ruta
                                </button>
                                <button 
                                    onClick={handleExportPDF}
                                    disabled={!calculatedRoute}
                                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Exportar PDF
                                </button>
                                <button onClick={clearRoute} className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors">
                                    Limpiar
                                </button>
                            </div>
                        </div>
                        <div>
                           <GoogleMapView empresas={selectedRouteCompanies} isLoaded={isMapScriptLoaded} route={calculatedRoute} />
                        </div>
                    </div>
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
                                            Área: {empresa.area || 'No especificada'} | Cupos: {empresa.cupos} | Supervisor: {empresa.docenteSupervisor?.nombreCompleto || 'Ninguno'} | Estudiantes: {(empresa.estudiantesAsignados?.length || 0)}
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
                                {profesores.map(profesor => (<option key={profesor.id} value={JSON.stringify({ id: profesor.id, nombreCompleto: profesor.nombreCompleto })}>{profesor.nombreCompleto}</option>))}
                            </select>
                        </div>
                        {/* Asignación de estudiantes */}
                        <div className="md:col-span-2 border rounded-lg p-4 bg-white dark:bg-slate-900">
                            <h3 className="text-lg font-semibold mb-3">Estudiantes asignados</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                                <div>
                                    <label className="block text-sm text-slate-600 mb-1">Curso</label>
                                    <select
                                        className="input-style w-full"
                                        value={cursoFiltro}
                                        onChange={(e) => setCursoFiltro(e.target.value as typeof cursoFiltro)}
                                    >
                                        <option value="todos">Todos 3º y 4º</option>
                                        <option value="3ºA">3ºA</option>
                                        <option value="3ºB">3ºB</option>
                                        <option value="3ºC">3ºC</option>
                                        <option value="3ºD">3ºD</option>
                                        <option value="4ºA">4ºA</option>
                                        <option value="4ºB">4ºB</option>
                                        <option value="4ºC">4ºC</option>
                                        <option value="4ºD">4ºD</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm text-slate-600 mb-1">Selecciona estudiantes</label>
                                    <div className="max-h-48 overflow-y-auto border rounded-lg p-2">
                                        {estudiantes
                                            .filter(e => {
                                                const curso = (e.curso || '').toUpperCase();
                                                const es3o4 = /^([34])º[A-D]$/.test(curso);
                                                const pasaCurso = cursoFiltro === 'todos' ? es3o4 : curso === cursoFiltro.toUpperCase();
                                                return es3o4 && pasaCurso;
                                            })
                                            .map(est => {
                                                const checked = (currentEmpresa.estudiantesAsignados || []).includes(est.id);
                                                return (
                                                    <label key={est.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-50">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={(e) => {
                                                                const prev = new Set(currentEmpresa.estudiantesAsignados || []);
                                                                if (e.target.checked) prev.add(est.id); else prev.delete(est.id);
                                                                handleFormChange('estudiantesAsignados', Array.from(prev));
                                                            }}
                                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                                        />
                                                        <span className="text-sm">{est.nombreCompleto} <span className="text-slate-500">({est.curso || '—'})</span></span>
                                                    </label>
                                                );
                                            })}
                                        {estudiantes.filter(e => {
                                            const curso = (e.curso || '').toUpperCase();
                                            const es3o4 = /^([34])º[A-D]$/.test(curso);
                                            const pasaCurso = cursoFiltro === 'todos' ? es3o4 : curso === cursoFiltro.toUpperCase();
                                            return es3o4 && pasaCurso;
                                        }).length === 0 && (
                                            <div className="text-sm text-slate-500 p-2">No hay estudiantes para el filtro seleccionado.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
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
