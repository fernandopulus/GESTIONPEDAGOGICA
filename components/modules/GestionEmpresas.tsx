import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Empresa, CalificacionItem, User, RutaSupervision, Profile, EvaluacionEmpresaEstudiante, EvaluacionEmpresaIndicador, NivelEvaluacionEmpresa } from '../../types';
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
import { saveEvaluacionEmpresa, subscribeEvaluacionesEmpresa } from '../../src/firebaseHelpers/evaluacionEmpresaHelper';
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

const NIVEL_EVALUACION_OPTIONS: Array<{ key: NivelEvaluacionEmpresa; label: string; rango: string; descripcion: string }> = [
    { key: 'NL', label: 'NL', rango: '2.0 - 3.9', descripcion: 'Nivel Nulo o Bajo logro' },
    { key: 'PL', label: 'PL', rango: '4.0 - 4.9', descripcion: 'Nivel Por Lograr' },
    { key: 'ML', label: 'ML', rango: '5.0 - 5.9', descripcion: 'Nivel Medianamente Logrado' },
    { key: 'L',  label: 'L',  rango: '6.0 - 7.0', descripcion: 'Nivel Logrado' },
];

const NIVEL_TO_NOTA: Record<NivelEvaluacionEmpresa, number> = {
    NL: 3,
    PL: 4.5,
    ML: 5.5,
    L: 6.5,
};

const EVALUACION_DIMENSIONES = [
    {
        id: 'responsabilidad',
        label: 'Responsabilidad',
        categoria: 'Habilidades blandas o actitudinales',
        indicadores: [
            { id: 'horario', label: 'Cumple con su horario de entrada y salida' },
            { id: 'asiste', label: 'Asiste a la empresa' },
            { id: 'compromiso', label: 'Demuestra compromiso con el trabajo o actividades encomendadas' },
        ],
    },
    {
        id: 'actitud',
        label: 'Actitud',
        categoria: 'Habilidades blandas o actitudinales',
        indicadores: [
            { id: 'valora_aprendizaje', label: 'Valora el aprendizaje significativo de su especialidad' },
            { id: 'proactividad', label: 'Es proactivo y demuestra iniciativa cuando se requiere apoyo' },
            { id: 'trabajo_equipo', label: 'Tiene buena disposición para el trabajo en equipo o para diversos roles' },
            { id: 'sigue_instrucciones', label: 'Es capaz de seguir instrucciones' },
            { id: 'actitud_positiva', label: 'Mantiene una actitud positiva y respetuosa con su entorno' },
            { id: 'respeto_guias', label: 'Respeta a sus maestros guías y jefaturas' },
            { id: 'vocabulario', label: 'Utiliza un vocabulario apropiado para el contexto' },
        ],
    },
    {
        id: 'trabajo_procesos',
        label: 'Trabajo y procesos',
        categoria: 'Habilidades y conocimientos técnicos',
        indicadores: [
            { id: 'respeta_procesos', label: 'Realiza actividades solicitadas respetando procesos y dinámicas de trabajo' },
            { id: 'explica_procedimientos', label: 'Explica procedimientos y tareas a través de un lenguaje técnico' },
            { id: 'uso_herramientas', label: 'Realiza un uso adecuado de máquinas, equipos y herramientas' },
            { id: 'bitacora', label: 'Realiza y envía bitácora semanal por formulario' },
        ],
    },
    {
        id: 'normas_seguridad',
        label: 'Normas de Seguridad',
        categoria: 'Habilidades y conocimientos técnicos',
        indicadores: [
            { id: 'respeta_normas', label: 'Conoce y respeta normas de seguridad y utiliza EPP' },
            { id: 'residuos', label: 'Demuestra conocimiento sobre residuos, desechos o normas de higiene' },
            { id: 'orden', label: 'Mantiene su área de trabajo limpia y libre de obstáculos' },
        ],
    },
];

const DRAFT_EVALUACION_PREFIX = 'draft-evaluacion-';

const getTodayISODate = () => new Date().toISOString().slice(0, 10);

const formatFechaSupervision = (iso?: string) => {
    if (!iso) return 'Sin fecha';
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const calcularPromediosPorDimension = (evaluaciones: Record<string, EvaluacionEmpresaIndicador>): Record<string, number> => {
    const acumuladores: Record<string, { suma: number; count: number }> = {};
    Object.values(evaluaciones || {}).forEach((item) => {
        if (!item || typeof item.nota !== 'number') return;
        if (!acumuladores[item.dimensionId]) acumuladores[item.dimensionId] = { suma: 0, count: 0 };
        acumuladores[item.dimensionId].suma += item.nota;
        acumuladores[item.dimensionId].count += 1;
    });
    const result: Record<string, number> = {};
    Object.entries(acumuladores).forEach(([dimension, stats]) => {
        if (stats.count === 0) return;
        result[dimension] = parseFloat((stats.suma / stats.count).toFixed(1));
    });
    return result;
};

const calcularPromedioGeneral = (dimensionPromedios: Record<string, number>): number | undefined => {
    const values = Object.values(dimensionPromedios || {}).filter((v) => typeof v === 'number');
    if (!values.length) return undefined;
    const promedio = values.reduce((acc, val) => acc + val, 0) / values.length;
    return parseFloat(promedio.toFixed(1));
};

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
    heightPx?: number;
}> = ({ empresas, isLoaded, route, heightPx }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

    const empresasConCoordenadas = empresas.filter(e => e.coordenadas?.lat && e.coordenadas?.lng);

    useEffect(() => {
        if (!isLoaded || !mapRef.current || !window.google) return;

        // Inicializar mapa si no existe
        if (!mapInstanceRef.current) {
            mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                center: { lat: -33.4489, lng: -70.6693 },
                zoom: 11,
            });
        }

        // Inicializar renderer de direcciones
        if (!directionsRendererRef.current) {
            directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
                map: mapInstanceRef.current,
                suppressMarkers: false,
                preserveViewport: false,
            });
        } else if (directionsRendererRef.current.getMap() == null) {
            directionsRendererRef.current.setMap(mapInstanceRef.current);
        }

        // Limpiar marcadores previos
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        // Agregar marcadores
        for (const emp of empresasConCoordenadas) {
            const marker = new window.google.maps.Marker({
                position: emp.coordenadas as google.maps.LatLngLiteral,
                map: mapInstanceRef.current!,
                title: emp.nombre || 'Empresa',
            });
            markersRef.current.push(marker);
        }

        // Ajustar bounds
        if (empresasConCoordenadas.length) {
            const bounds = new window.google.maps.LatLngBounds();
            empresasConCoordenadas.forEach(e => bounds.extend(e.coordenadas as google.maps.LatLngLiteral));
            mapInstanceRef.current!.fitBounds(bounds);
        }

        // Mostrar ruta si existe
        if (route) {
            directionsRendererRef.current.setDirections(route);
        } else {
            directionsRendererRef.current.setDirections({ routes: [] } as any);
        }
    }, [isLoaded, empresasConCoordenadas.length, !!route]);

    return <div id="map-container-for-pdf" ref={mapRef} style={{ width: '100%', height: `${heightPx ?? 400}px`, borderRadius: 8 }} />;
};

// Componente de detalles de ruta para impresión y visualización
const RouteDetails: React.FC<{ route: google.maps.DirectionsResult; travelMode: 'DRIVING' | 'TRANSIT' }> = ({ route, travelMode }) => {
    const PRECIO_BENCINA_POR_LITRO = 1300;
    const CONSUMO_PROMEDIO_KM_POR_LITRO = 12;
    const tiempoPorParada = travelMode === 'TRANSIT' ? 45 : 30;

    const legs = route.routes[0]?.legs || [];
    const travelDuration = legs.reduce((acc, leg) => acc + (leg.duration?.value || 0), 0);
    const numberOfStops = legs.length > 1 ? legs.length - 1 : 0;
    const stopDuration = numberOfStops * tiempoPorParada * 60;
    const totalDuration = travelDuration + stopDuration;
    const totalDistance = legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0);
    const costoBencina = travelMode === 'DRIVING' ? ((totalDistance / 1000) / CONSUMO_PROMEDIO_KM_POR_LITRO) * PRECIO_BENCINA_POR_LITRO : 0;

    return (
        <div className="mt-6 p-4 border rounded-lg bg-slate-50" id="route-details-for-pdf">
            <h3 className="text-xl font-bold mb-3">Detalles de la Ruta</h3>
            <div className="space-y-4">
                {legs.map((leg, legIndex) => (
                    <div key={legIndex} className="border rounded-lg p-4 bg-white">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-lg">Tramo {legIndex + 1}: {leg.start_address?.split(',')[0]} → {leg.end_address?.split(',')[0]}</h4>
                            <div className="text-sm text-gray-600">{leg.duration?.text} • {leg.distance?.text}</div>
                        </div>
                        {travelMode === 'TRANSIT' && (
                            <div className="space-y-3">
                                {leg.steps?.map((step, stepIndex) => (
                                    step.transit && (
                                        <div key={stepIndex} className="flex items-start gap-2 text-sm py-1">
                                            <span className="text-lg">🚌</span>
                                            <span dangerouslySetInnerHTML={{ __html: step.instructions || '' }} />
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

// Vista clásica mínima (fallback) delegando a la moderna para mantener compatibilidad
const DashboardView: React.FC<{ data: any }> = ({ data }) => {
    return <DashboardViewModern data={data} />;
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
    const [routeSupervisor, setRouteSupervisor] = useState<{ id: string; nombreCompleto: string } | undefined>(undefined);
    const [notasPorEstudiante, setNotasPorEstudiante] = useState<Record<string, { notas: any[]; unsub?: () => void }>>({});
    const [notaNueva, setNotaNueva] = useState<Record<string, { texto: string; color: 'yellow' | 'pink' | 'green' | 'blue' }>>({});
    const [evaluacionesEstudiantes, setEvaluacionesEstudiantes] = useState<Record<string, EvaluacionEmpresaEstudiante[]>>({});
    const [savingEvaluaciones, setSavingEvaluaciones] = useState<Record<string, boolean>>({});
    const [evaluacionPanelAbierto, setEvaluacionPanelAbierto] = useState<Record<string, boolean>>({});
    const [evaluacionActivaPorEstudiante, setEvaluacionActivaPorEstudiante] = useState<Record<string, string | null>>({});
    const [evaluacionDrafts, setEvaluacionDrafts] = useState<Record<string, EvaluacionEmpresaEstudiante | undefined>>({});

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const { isLoaded: isMapScriptLoaded, error: mapScriptError } = useGoogleMapsScript(apiKey);

    // Mapa de estudiantes por id y utilidades relacionadas a empresas/estudiantes
    const estudiantesMap = useMemo(() => {
        const map = new Map<string, User>();
        estudiantes.forEach(e => map.set(e.id, e));
        return map;
    }, [estudiantes]);

    const getEmpresaCompleta = (empLite: Pick<Empresa, 'id' | 'nombre' | 'coordenadas'> & Partial<Empresa>) => {
        const found = empresas.find(e => e.id === empLite.id);
        return found || empLite;
    };

    const getEstudiantesDeEmpresa = (empresaId: string): User[] => {
        const emp = empresas.find(e => e.id === empresaId);
        const ids = emp?.estudiantesAsignados || [];
        const list: User[] = [];
        ids.forEach(id => {
            const st = estudiantesMap.get(id);
            if (st) list.push(st);
        });
        return list;
    };

    const encontrarEmpresaPorEstudiante = (studentId: string): Empresa | null => {
        for (const emp of empresas) {
            const asignados = emp.estudiantesAsignados || [];
            if (asignados.includes(studentId)) return emp;
        }
        return null;
    };

    const getEvaluacionesPorEstudiante = (studentId: string) => evaluacionesEstudiantes[studentId] || [];

    const getEvaluacionActiva = (studentId: string): { evaluacion?: EvaluacionEmpresaEstudiante; isDraft: boolean } => {
        const activeId = evaluacionActivaPorEstudiante[studentId];
        if (activeId && activeId.startsWith(DRAFT_EVALUACION_PREFIX)) {
            return { evaluacion: evaluacionDrafts[studentId], isDraft: true };
        }
        const registros = getEvaluacionesPorEstudiante(studentId);
        const selected = activeId ? registros.find((reg) => reg.id === activeId) : registros[0];
        if (selected) {
            return { evaluacion: selected, isDraft: false };
        }
        if (evaluacionDrafts[studentId]) {
            return { evaluacion: evaluacionDrafts[studentId], isDraft: true };
        }
        return { evaluacion: undefined, isDraft: false };
    };

    const ensureEvaluacionDraft = (student: User, empresa: Empresa | null) => {
        const draft: EvaluacionEmpresaEstudiante = {
            estudianteId: student.id,
            estudianteNombre: student.nombreCompleto,
            curso: student.curso,
            empresaId: empresa?.id,
            empresaNombre: empresa?.nombre,
            fechaSupervision: getTodayISODate(),
            evaluaciones: {},
            dimensionPromedios: {},
            promedioGeneral: undefined,
        };
        setEvaluacionDrafts((prev) => ({ ...prev, [student.id]: draft }));
        setEvaluacionActivaPorEstudiante((prev) => ({ ...prev, [student.id]: `${DRAFT_EVALUACION_PREFIX}${student.id}` }));
        return draft;
    };

    const resolveEvaluacionActiva = (student: User): { evaluacion: EvaluacionEmpresaEstudiante; isDraft: boolean } => {
        const empresaAsignada = encontrarEmpresaPorEstudiante(student.id);
        const actual = getEvaluacionActiva(student.id);
        if (actual.evaluacion) {
            return { evaluacion: actual.evaluacion, isDraft: actual.isDraft };
        }
        const draft = ensureEvaluacionDraft(student, empresaAsignada);
        return { evaluacion: draft, isDraft: true };
    };

    const handleToggleEvaluacionPanel = (student: User) => {
        const isOpening = !evaluacionPanelAbierto[student.id];
        if (isOpening) {
            const registros = getEvaluacionesPorEstudiante(student.id);
            if (!registros.length && !evaluacionDrafts[student.id]) {
                ensureEvaluacionDraft(student, encontrarEmpresaPorEstudiante(student.id));
            }
        }
        setEvaluacionPanelAbierto((prev) => ({ ...prev, [student.id]: !prev[student.id] }));
    };

    const handleSeleccionEvaluacion = (studentId: string, evaluacionId: string) => {
        setEvaluacionActivaPorEstudiante((prev) => ({ ...prev, [studentId]: evaluacionId }));
        setEvaluacionDrafts((prev) => {
            if (!prev[studentId]) return prev;
            const updated = { ...prev };
            delete updated[studentId];
            return updated;
        });
    };

    const handleNuevaEvaluacion = (student: User) => {
        ensureEvaluacionDraft(student, encontrarEmpresaPorEstudiante(student.id));
    };

    const canReadEmpresas = useMemo(() => {
        const p = currentUser?.profile as any;
        return p === Profile.SUBDIRECCION || p === Profile.PROFESORADO || p === Profile.COORDINACION_TP;
    }, [currentUser?.profile]);

    useEffect(() => {
        // Solo suscribir si el perfil tiene permisos de lectura según reglas
        if (!canReadEmpresas) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const unsubEmpresas = subscribeToEmpresas(setEmpresas);
        const unsubProfesores = subscribeToProfesores(setProfesores);
        const unsubEstudiantes = subscribeToEstudiantes(setEstudiantes);
        const unsubSavedRoutes = subscribeToSavedRoutes(setSavedRoutes);
        const unsubEvaluaciones = subscribeEvaluacionesEmpresa((mapa) => setEvaluacionesEstudiantes(mapa));
        setLoading(false);
        return () => { 
            unsubEmpresas(); 
            unsubProfesores();
            unsubEstudiantes();
            unsubSavedRoutes();
            unsubEvaluaciones();
            // Limpiar suscripciones de notas
            (Object.values(notasPorEstudiante as Record<string, { notas: any[]; unsub?: () => void }>)).forEach(v => v.unsub?.());
        };
    }, [canReadEmpresas]);

    useEffect(() => {
        setEvaluacionActivaPorEstudiante((prev) => {
            let changed = false;
            const next = { ...prev };
            (Object.entries(evaluacionesEstudiantes) as [string, EvaluacionEmpresaEstudiante[]][])?.forEach(([studentId, registros]) => {
                if (!registros || !registros.length) return;
                const currentId = prev[studentId];
                const mantieneSeleccion = currentId && !currentId.startsWith(DRAFT_EVALUACION_PREFIX) && registros.some((reg) => reg.id === currentId);
                if (!mantieneSeleccion) {
                    next[studentId] = registros[0].id || null;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [evaluacionesEstudiantes]);

    useEffect(() => {
        setEvaluacionDrafts((prev) => {
            let changed = false;
            const next = { ...prev };
            Object.keys(prev).forEach((studentId) => {
                const activeId = evaluacionActivaPorEstudiante[studentId];
                if (!activeId || activeId.startsWith(DRAFT_EVALUACION_PREFIX)) return;
                const registros = getEvaluacionesPorEstudiante(studentId);
                if (registros.some((reg) => reg.id === activeId)) {
                    delete next[studentId];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [evaluacionesEstudiantes, evaluacionActivaPorEstudiante]);

    // Suscripción dinámica a notas para estudiantes visibles (3º/4º + filtro curso)
    useEffect(() => {
        // limpiar previas
    (Object.values(notasPorEstudiante as Record<string, { notas: any[]; unsub?: () => void }>)).forEach(v => v.unsub?.());
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

    const handleEvaluacionCambio = async (student: User, indicadorId: string, dimensionId: string, nivel: NivelEvaluacionEmpresa) => {
        const empresaAsignada = encontrarEmpresaPorEstudiante(student.id);
        const { evaluacion, isDraft } = resolveEvaluacionActiva(student);

        if (!evaluacion.fechaSupervision) {
            alert('Selecciona una fecha de supervisión antes de registrar la evaluación.');
            return;
        }

        const evaluacionesActualizadas: Record<string, EvaluacionEmpresaIndicador> = {
            ...(evaluacion.evaluaciones || {}),
            [indicadorId]: {
                indicadorId,
                dimensionId,
                nivel,
                nota: NIVEL_TO_NOTA[nivel],
                updatedAt: new Date().toISOString(),
            },
        };

        const dimensionPromedios = calcularPromediosPorDimension(evaluacionesActualizadas);
        const promedioGeneral = calcularPromedioGeneral(dimensionPromedios);

        const payload: EvaluacionEmpresaEstudiante = {
            ...evaluacion,
            id: isDraft ? undefined : evaluacion.id,
            estudianteId: student.id,
            estudianteNombre: student.nombreCompleto,
            curso: student.curso,
            empresaId: empresaAsignada?.id,
            empresaNombre: empresaAsignada?.nombre,
            fechaSupervision: evaluacion.fechaSupervision,
            evaluaciones: evaluacionesActualizadas,
            dimensionPromedios,
            promedioGeneral,
            updatedBy: currentUser ? { id: currentUser.id, nombre: currentUser.nombreCompleto || currentUser.email || 'Usuario' } : undefined,
        };

        if (isDraft) {
            setEvaluacionDrafts(prev => ({
                ...prev,
                [student.id]: {
                    ...payload,
                    id: undefined,
                },
            }));
        }

        setSavingEvaluaciones(prev => ({ ...prev, [student.id]: true }));
        try {
            const savedId = await saveEvaluacionEmpresa(payload);
            if (isDraft) {
                setEvaluacionActivaPorEstudiante(prev => ({ ...prev, [student.id]: savedId }));
            }
        } catch (error) {
            console.error('Error al guardar evaluación de empresa:', error);
            alert('No se pudo guardar la evaluación. Intenta nuevamente.');
        } finally {
            setSavingEvaluaciones(prev => ({ ...prev, [student.id]: false }));
        }
    };

    const handleFechaSupervisionChange = async (student: User, nuevaFecha: string) => {
        if (!nuevaFecha) return;
        const empresaAsignada = encontrarEmpresaPorEstudiante(student.id);
        const actual = getEvaluacionActiva(student.id);

        if (actual.isDraft || !actual.evaluacion) {
            const draft = actual.evaluacion || ensureEvaluacionDraft(student, empresaAsignada);
            setEvaluacionDrafts((prev) => ({ ...prev, [student.id]: { ...draft, fechaSupervision: nuevaFecha } }));
            return;
        }

        setSavingEvaluaciones(prev => ({ ...prev, [student.id]: true }));
        try {
            await saveEvaluacionEmpresa({ ...actual.evaluacion, fechaSupervision: nuevaFecha });
        } catch (error) {
            console.error('No se pudo actualizar la fecha de supervisión', error);
            alert('No se pudo guardar la fecha de supervisión. Intenta nuevamente.');
        } finally {
            setSavingEvaluaciones(prev => ({ ...prev, [student.id]: false }));
        }
    };

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
                            if (st) conflictos.push({ student: st as User, empresa: emp });
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

    // Helper: obtener coordenadas de un placeId
    const getPlaceDetails = async (placeId: string): Promise<{ lat: number; lng: number } | null> => {
        if (!window.google) return null;
        return await new Promise((resolve) => {
            const service = new window.google.maps.places.PlacesService(document.createElement('div'));
            service.getDetails({ placeId, fields: ['geometry'] }, (place, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                    resolve({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
                } else {
                    resolve(null);
                }
            });
        });
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

        // Respetar límite de waypoints (máx 25 incluyendo origen/destino => 23 paradas)
        const rawWaypoints = selectedRouteCompanies
            .filter(e => e.coordenadas)
            .map(e => ({ location: e.coordenadas!, stopover: true }));
        const waypoints = rawWaypoints.slice(0, 23);
        if (rawWaypoints.length > waypoints.length) {
            console.warn('Se limitaron las paradas a 23 por restricción de Google Directions.');
        }

        const buildRequest = (mode: google.maps.TravelMode): google.maps.DirectionsRequest => ({
            origin: startPointCoords,
            destination: startPointCoords,
            waypoints,
            optimizeWaypoints: true,
            travelMode: mode,
            region: 'CL',
            provideRouteAlternatives: false,
        });

        const routeWithRetry = async (mode: google.maps.TravelMode, retries = 3): Promise<google.maps.DirectionsResult> => {
            return await new Promise((resolve, reject) => {
                const attempt = (n: number) => {
                    directionsService.route(buildRequest(mode), (result, status) => {
                        if (status === window.google.maps.DirectionsStatus.OK && result) {
                            resolve(result);
                        } else if (status === window.google.maps.DirectionsStatus.UNKNOWN_ERROR || status === (window.google.maps as any).DirectionsStatus.OVER_QUERY_LIMIT) {
                            if (n < retries) {
                                const backoff = 400 * Math.pow(2, n);
                                setTimeout(() => attempt(n + 1), backoff);
                            } else {
                                reject(status);
                            }
                        } else if (status === window.google.maps.DirectionsStatus.ZERO_RESULTS) {
                            reject(status);
                        } else {
                            reject(status);
                        }
                    });
                };
                attempt(0);
            });
        };

        (async () => {
            try {
                const mode = window.google.maps.TravelMode[travelMode];
                let result = await routeWithRetry(mode);
                setCalculatedRoute(result);
            } catch (err) {
                // Fallback: si era TRANSIT, intentar DRIVING
                if (travelMode === 'TRANSIT') {
                    try {
                        const result = await routeWithRetry(window.google.maps.TravelMode.DRIVING);
                        setCalculatedRoute(result);
                        alert('No se encontró una ruta en transporte público. Se usó Automóvil como alternativa.');
                    } catch (err2) {
                        console.error('Fallo al calcular ruta (fallback DRIVING):', err2);
                        alert('No se pudo calcular la ruta en este momento. Intenta nuevamente más tarde.');
                    }
                } else {
                    console.error('Fallo al calcular ruta:', err);
                    alert('No se pudo calcular la ruta en este momento. Intenta nuevamente más tarde.');
                }
            } finally {
                setIsCalculatingRoute(false);
            }
        })();
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
            supervisor: routeSupervisor,
        };
        try {
            await saveRouteToDB(routeToSave);
            alert("Ruta guardada con éxito.");
            setView('saved-routes');
        } catch (error) {
            alert("Error al guardar la ruta.");
        }
    };

    // --- Utilidades para mapa estático en PDF ---
    const encodePolyline = (points: { lat: number; lng: number }[]) => {
        // Implementación mínima del algoritmo de Google Polyline Encoding
        let lastLat = 0, lastLng = 0;
        const result: string[] = [];
        const encode = (num: number) => {
            let v = num < 0 ? ~(num << 1) : (num << 1);
            while (v >= 0x20) {
                result.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
                v >>= 5;
            }
            result.push(String.fromCharCode(v + 63));
        };
        for (const p of points) {
            const lat = Math.round(p.lat * 1e5);
            const lng = Math.round(p.lng * 1e5);
            encode(lat - lastLat);
            encode(lng - lastLng);
            lastLat = lat;
            lastLng = lng;
        }
        return result.join('');
    };

    const getOverviewPoints = (route: google.maps.DirectionsResult): { lat: number; lng: number }[] | null => {
        try {
            const r: any = route?.routes?.[0];
            if (!r) return null;
            let pts: { lat: number; lng: number }[] = [];
            if (r.overview_path && Array.isArray(r.overview_path) && r.overview_path.length) {
                pts = r.overview_path.map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }));
            } else if (r.overview_polyline && typeof r.overview_polyline.getPath === 'function') {
                const arr = r.overview_polyline.getPath().getArray();
                pts = arr.map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }));
            } else {
                return null;
            }
            // Reducir puntos para evitar URLs demasiado largas y para vector map
            if (pts.length > 200) {
                const step = Math.ceil(pts.length / 200);
                const sampled: { lat: number; lng: number }[] = [];
                for (let i = 0; i < pts.length; i += step) sampled.push(pts[i]);
                if (sampled[sampled.length - 1] !== pts[pts.length - 1]) sampled.push(pts[pts.length - 1]);
                pts = sampled;
            }
            return pts;
        } catch {
            return null;
        }
    };

    const buildStaticMapUrl = (route: google.maps.DirectionsResult): string | null => {
        try {
            let pts = getOverviewPoints(route);
            if (!pts) return null;
            const enc = encodePolyline(pts);
            const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
            // Tamaño soportado (Static Maps): 640x640 con scale=2 para mayor nitidez
            url.searchParams.set('size', '640x640');
            url.searchParams.set('scale', '2');
            url.searchParams.set('maptype', 'roadmap');
            url.searchParams.set('region', 'CL');
            // Ruta
            url.searchParams.append('path', `color:0x1e3a8aff|weight:4|enc:${enc}`);
            // Marcadores: inicio y paradas (máximo 9 con etiquetas)
            if (startPointCoords) {
                url.searchParams.append('markers', `color:green|label:S|${startPointCoords.lat},${startPointCoords.lng}`);
            }
            // Reducimos la cantidad de marcadores para acortar la URL
            selectedRouteCompanies.slice(0, 5).forEach((e, idx) => {
                if (e.coordenadas?.lat && e.coordenadas?.lng) {
                    const label = String((idx + 1) % 10); // 1..9, 0 si 10
                    url.searchParams.append('markers', `color:red|label:${label}|${e.coordenadas.lat},${e.coordenadas.lng}`);
                }
            });
            url.searchParams.set('key', apiKey);
            return url.toString();
        } catch {
            return null;
        }
    };

    // Dibuja un "mapa vectorial" simple si falla Static Maps (sin tiles, pero con la ruta y marcadores)
    const drawVectorRoute = (
        pdf: jsPDF,
        x: number,
        y: number,
        side: number,
        points: { lat: number; lng: number }[],
        start?: { lat: number; lng: number } | null,
        stops?: { lat: number; lng: number }[]
    ) => {
        if (!points || points.length < 2) return false;
        const lats = points.map(p => p.lat);
        const lngs = points.map(p => p.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const pad = 3; // mm de padding interno
        const w = side - pad * 2;
        const h = side - pad * 2;
        const dLng = (maxLng - minLng) || 1e-6;
        const dLat = (maxLat - minLat) || 1e-6;
        // Mantener aspecto: usar el mayor de ambos para escalar a cuadrado
        const scale = Math.min(w / dLng, h / dLat);
        const cx = x + pad;
        const cy = y + pad;

        // Marco
        pdf.setDrawColor(200);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(x, y, side, side, 'FD');

        // Ruta
        pdf.setDrawColor(30, 58, 138); // azul oscuro
        pdf.setLineWidth(0.6);
        for (let i = 1; i < points.length; i++) {
            const p0 = points[i - 1];
            const p1 = points[i];
            const px0 = cx + (p0.lng - minLng) * scale;
            const py0 = cy + (maxLat - p0.lat) * scale; // invertir Y
            const px1 = cx + (p1.lng - minLng) * scale;
            const py1 = cy + (maxLat - p1.lat) * scale;
            pdf.line(px0, py0, px1, py1);
        }

        // Marcadores
        const drawCircle = (px: number, py: number, r: number, color: [number, number, number]) => {
            pdf.setFillColor(...color);
            pdf.circle(px, py, r, 'F');
        };
        if (start) {
            const sx = cx + (start.lng - minLng) * scale;
            const sy = cy + (maxLat - start.lat) * scale;
            drawCircle(sx, sy, 1.6, [34, 197, 94]); // verde
        }
        if (stops && stops.length) {
            stops.slice(0, 5).forEach(st => {
                const sx = cx + (st.lng - minLng) * scale;
                const sy = cy + (maxLat - st.lat) * scale;
                drawCircle(sx, sy, 1.4, [239, 68, 68]); // rojo
            });
        }

        return true;
    };

    // Descarga de imagen via backend builder (usa API Key de servidor)
    const fetchStaticMapFromServer = async (enc: string, start?: {lat:number;lng:number}|null, stops?: {lat:number;lng:number}[]): Promise<string> => {
        const res = await fetch('/api/staticMapBuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enc, size: '640x640', scale: 2, maptype: 'roadmap', region: 'CL', start, stops: (stops||[]).slice(0,8) })
        });
        if (!res.ok) throw new Error(`staticMapBuild HTTP ${res.status}`);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const fetchStaticMapBuilt = async (route: google.maps.DirectionsResult): Promise<string> => {
        const pts = getOverviewPoints(route) || [];
        const enc = encodePolyline(pts);
        const body = {
            pathEnc: enc,
            start: startPointCoords,
            stops: selectedRouteCompanies.filter(e => e.coordenadas).map(e => e.coordenadas),
            size: 640,
            maptype: 'roadmap'
        };
        const res = await fetch('/api/staticMapBuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`staticMapBuild HTTP ${res.status}`);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // Utilidad: traer imagen remota como dataURL (para encabezado gráfico)
    const fetchImageAsDataURL = async (url: string): Promise<string> => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`image HTTP ${res.status}`);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // Medir dimensiones de una imagen (dataURL) para respetar proporción
    const getImageNaturalSize = (dataUrl: string): Promise<{ w: number; h: number }> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
            img.onerror = reject;
            img.src = dataUrl;
        });
    };

    const handleExportPDF = async () => {
        if (!calculatedRoute) {
            alert('Falta información para generar el PDF. Primero visualiza la ruta.');
            return;
        }

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 10; // 1 cm
    const contentWidth = pdfWidth - margin * 2;
    const sectionGap = 10; // espacio vertical fijo entre secciones (1 cm)

        // Encabezado con imagen (banner): 1.5 cm de alto, ancho ajustado al ancho de página útil (dentro de márgenes)
        let yCursor = margin;
        const drawTitleAndSubtitle = () => {
            // Título y subtítulo bajo el banner
            if (yCursor + 6 > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(14);
            const title = `Ruta de Supervisión: ${routeName || 'Sin nombre'}`;
            pdf.text(title, margin, yCursor + 6);
            yCursor += 9;
            // Subtítulo (fecha, modo, supervisor)
            const d = new Date();
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            const fechaTxt = `Fecha: ${dd}-${mm}-${yyyy}`;
            const modoTxt = `Modo: ${travelMode === 'DRIVING' ? 'Automóvil' : 'Transporte Público'}`;
            const supervisorTxt = routeSupervisor?.nombreCompleto ? `Supervisor: ${routeSupervisor.nombreCompleto}` : '';
            const subtitle = [fechaTxt, modoTxt, supervisorTxt].filter(Boolean).join('  •  ');
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(100, 116, 139);
            const subLines = pdf.splitTextToSize(subtitle, contentWidth);
            for (const ln of subLines) {
                if (yCursor + 5 > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
                pdf.text(ln, margin, yCursor);
                yCursor += 5;
            }
            pdf.setTextColor(0, 0, 0);
            yCursor += 4;
        };

        try {
            const bannerUrl = 'https://res.cloudinary.com/dwncmu1wu/image/upload/v1756260600/Captura_de_pantalla_2025-08-26_a_la_s_10.09.17_p._m._aakgkt.png';
            const dataUrl = await fetchImageAsDataURL(bannerUrl);
            // Altura fija 15 mm y ancho al ancho de contenido (página dentro de márgenes)
            const targetH = 15;
            const targetW = contentWidth;
            pdf.addImage(dataUrl, 'PNG', margin, yCursor, targetW, targetH);
            yCursor += targetH + 4;
            drawTitleAndSubtitle();
        } catch (e) {
            // Si falla el banner, dibujar solo títulos manteniendo espaciado
            yCursor += 4;
            drawTitleAndSubtitle();
        }
        // Asegurar 1 cm de separación después del encabezado (título/subtítulo ya añade 4 mm)
        yCursor += Math.max(0, sectionGap - 4);

        // Mapa: Static Maps primero, luego fallback a captura, luego placeholder (cuadrado 4:4)
        const mapElement = document.getElementById('map-container-for-pdf');
        const mapSide = Math.min(contentWidth, 120); // lado del cuadrado en mm
        let mapAdded = false;
        // 1) Intento con builder de backend (server key)
        try {
            const dataUrl = await fetchStaticMapBuilt(calculatedRoute);
            if (yCursor + mapSide > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
            pdf.addImage(dataUrl, 'PNG', margin, yCursor, mapSide, mapSide);
            yCursor += mapSide + sectionGap;
            mapAdded = true;
        } catch {}
        // 2) Fallback a proxy de URL (si builder falla)
        if (!mapAdded) {
            try {
                const pts = getOverviewPoints(calculatedRoute);
                if (pts && pts.length >= 2) {
                    const enc = encodePolyline(pts);
                    const stops = selectedRouteCompanies.filter(e => e.coordenadas).map(e => e.coordenadas!)
                    const dataUrl = await fetchStaticMapFromServer(enc, startPointCoords || undefined, stops);
                    if (yCursor + mapSide > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
                    pdf.addImage(dataUrl, 'PNG', margin, yCursor, mapSide, mapSide);
                    yCursor += mapSide + sectionGap;
                    mapAdded = true;
                }
            } catch {}
        }
        if (!mapAdded && mapElement) {
            try {
                const mapCanvas = await html2canvas(mapElement as HTMLElement, { useCORS: true, allowTaint: true, backgroundColor: '#ffffff', scale: 2 });
                const mapImgData = mapCanvas.toDataURL('image/png');
                if (yCursor + mapSide > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
                pdf.addImage(mapImgData, 'PNG', margin, yCursor, mapSide, mapSide);
                yCursor += mapSide + sectionGap;
                mapAdded = true;
            } catch {}
        }
        if (!mapAdded) {
            // Intento final: dibujar una representación vectorial de la ruta (sin tiles)
            const pts = getOverviewPoints(calculatedRoute) || [];
            if (pts.length >= 2) {
                if (yCursor + mapSide > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
                const success = drawVectorRoute(
                    pdf,
                    margin,
                    yCursor,
                    mapSide,
                    pts,
                    startPointCoords,
                    selectedRouteCompanies.filter(e => e.coordenadas).map(e => e.coordenadas!)
                );
                if (success) {
                    yCursor += mapSide + sectionGap;
                    mapAdded = true;
                }
            }
        }
        if (!mapAdded) {
            // Como último recurso, placeholder neutro
            pdf.setDrawColor(200);
            pdf.setFillColor(245, 245, 245);
            if (yCursor + mapSide > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
            pdf.rect(margin, yCursor, mapSide, mapSide, 'FD');
            pdf.setTextColor(120);
            pdf.setFontSize(11);
            pdf.text('Mapa no disponible para captura. (Se omitió en el PDF)', margin + mapSide / 2, yCursor + mapSide / 2, { align: 'center' });
            pdf.setTextColor(0);
            yCursor += mapSide + sectionGap;
        }

        // Detalles renderizados como texto envuelto (alineación izquierda)
        const lineH = 6;
        const addSectionTitle = (title: string) => {
            if (yCursor + lineH > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text(title, margin, yCursor);
            pdf.setFont('helvetica', 'normal');
            yCursor += lineH;
        };
    addSectionTitle('Detalles de la Ruta');
        pdf.setFontSize(10);
        const legs = calculatedRoute.routes[0].legs || [];
        const travelDurationSec = legs.reduce((acc, leg) => acc + (leg.duration?.value || 0), 0);
        const numberOfStops = legs.length > 1 ? legs.length - 1 : 0;
        const tiempoPorParada = travelMode === 'TRANSIT' ? 45 : 30;
        const stopDurationSec = numberOfStops * tiempoPorParada * 60;
        const totalDurationSec = travelDurationSec + stopDurationSec;
        const totalDistanceM = legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0);
        const PRECIO_BENCINA_POR_LITRO = 1300;
        const CONSUMO_PROMEDIO_KM_POR_LITRO = 12;
        const costoBencina = travelMode === 'DRIVING' ? ((totalDistanceM / 1000) / CONSUMO_PROMEDIO_KM_POR_LITRO) * PRECIO_BENCINA_POR_LITRO : 0;

        // Cuadrícula de métricas (5 "cards")
        const metrics = [
            { label: 'Tiempo de viaje', value: `${Math.round(travelDurationSec / 60)} min` },
            { label: 'Tiempo en paradas', value: `${Math.round(stopDurationSec / 60)} min` },
            { label: 'Duración total', value: `${Math.round(totalDurationSec / 60)} min` },
            { label: 'Distancia total', value: `${(totalDistanceM / 1000).toFixed(1)} km` },
            { label: 'Costo estimado', value: travelMode === 'DRIVING' ? `$${Math.round(costoBencina).toLocaleString('es-CL')}` : '—' },
        ];
        const cardsPerRow = 5;
        const gap = 4;
        const cardW = (contentWidth - gap * (cardsPerRow - 1)) / cardsPerRow;
        const cardH = 16;
        let cardX = margin;
        let cardY = yCursor + 2;
        for (let i = 0; i < metrics.length; i++) {
            if (cardY + cardH > pdfHeight - margin) {
                pdf.addPage();
                cardY = margin;
                cardX = margin;
            }
            // Fondo y borde de la tarjeta
            pdf.setFillColor(248, 250, 252); // slate-50
            pdf.setDrawColor(226, 232, 240); // slate-200
            pdf.rect(cardX, cardY, cardW, cardH, 'FD');

            // Etiqueta
            pdf.setTextColor(100, 116, 139); // slate-500
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.text(metrics[i].label, cardX + 2, cardY + 4);

            // Valor
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text(String(metrics[i].value), cardX + 2, cardY + cardH - 5);

            // Avance de grilla
            if ((i + 1) % cardsPerRow === 0) {
                cardX = margin;
                cardY += cardH + 2;
            } else {
                cardX += cardW + gap;
            }
        }
    yCursor = cardY + (metrics.length % cardsPerRow === 0 ? 0 : cardH) + sectionGap;

        // Tramos como "cards" (2 columnas), respetando márgenes y evitando interletrado raro
        const tramoCols = 2;
        const tramoGap = 4;
        const tramoCardW = (contentWidth - tramoGap * (tramoCols - 1)) / tramoCols;
        const innerPad = 2;
        const labelH = 5;
        const valueLH = 4.0; // interlineado normal

        // Asegurar fuente antes de medir para consistencia
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);

        let colIndex = 0;
        let rowMaxH = 0;
        let rowStartY = yCursor;

        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i];
            const x = margin + colIndex * (tramoCardW + tramoGap);
            const origen = (leg.start_address || '').split(',')[0];
            const destino = (leg.end_address || '').split(',')[0];
            // Evitar caracteres fuera de WinAnsi para built-in fonts
            const detalle = `${origen} -> ${destino}\n${leg.duration?.text || ''} • ${leg.distance?.text || ''}`;
            const valueMaxWidth = tramoCardW - innerPad * 2;
            const valueLines = pdf.splitTextToSize(detalle, valueMaxWidth);
            const valueH = valueLines.length * valueLH;
            const contentH = labelH + 2 + valueH + 2;
            const minH = 18;
            const h = Math.max(minH, contentH);

            // Salto de página si esta tarjeta no cabe en la página actual
            if (rowStartY + h > pdfHeight - margin) {
                pdf.addPage();
                rowStartY = margin;
                yCursor = margin;
                colIndex = 0;
                rowMaxH = 0;
            }

            // Fondo y borde
            pdf.setFillColor(248, 250, 252); // slate-50
            pdf.setDrawColor(226, 232, 240); // slate-200
            pdf.rect(x, rowStartY, tramoCardW, h, 'FD');
            // Etiqueta
            pdf.setTextColor(100, 116, 139); // slate-500
            pdf.setFontSize(8);
            pdf.text(`Tramo ${i + 1}`, x + innerPad, rowStartY + 4);
            // Valor
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            let yy = rowStartY + 4 + 2; // debajo de la etiqueta
            for (const ln of valueLines) {
                pdf.text(ln, x + innerPad, yy + 5);
                yy += valueLH;
            }

            rowMaxH = Math.max(rowMaxH, h);
            colIndex++;
            if (colIndex === tramoCols) {
                // Pasar a la siguiente fila
                rowStartY += rowMaxH + 3;
                yCursor = rowStartY;
                rowMaxH = 0;
                colIndex = 0;
            }
        }
        if (colIndex !== 0) {
            // Avanzar si quedó fila incompleta, con separación de sección
            yCursor = rowStartY + rowMaxH + sectionGap;
        }

        // Estudiantes por empresa
        const addBodyText = (txt: string, x: number, maxWidth: number, fontSize = 10) => {
            pdf.setFontSize(fontSize);
            const lines = pdf.splitTextToSize(txt, maxWidth);
            for (const ln of lines) {
                if (yCursor + 4 > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
                pdf.text(ln, x, yCursor);
                yCursor += 4;
            }
        };

    addSectionTitle('Estudiantes por empresa');
        pdf.setFont('helvetica', 'normal');
        const maxW = contentWidth;
        const empresasForStudents = selectedRouteCompanies.map(e => getEmpresaCompleta(e) as Empresa);
        for (const emp of empresasForStudents) {
            if (yCursor + 8 > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
            // Nombre empresa
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            const empName = emp?.nombre || 'Empresa';
            pdf.text(empName, margin, yCursor);
            yCursor += 5;
            pdf.setFont('helvetica', 'normal');
            const alumnosIds = emp?.estudiantesAsignados || [];
            if (alumnosIds.length === 0) {
                addBodyText('• Sin estudiantes asignados', margin, maxW, 10);
            } else {
                const alumnos = alumnosIds
                    .map((id: string) => estudiantesMap.get(id))
                    .filter(Boolean) as User[];
                for (const a of alumnos) {
                    const line = `• ${a.nombreCompleto}${a.curso ? ` (${a.curso})` : ''}`;
                    addBodyText(line, margin, maxW, 10);
                }
            }
            yCursor += 2;
        }

        // Separación entre "Estudiantes por empresa" y "Firmas"
        yCursor += sectionGap;

        // Firmas
        const ensureSpace = (needed: number) => {
            if (yCursor + needed > pdfHeight - margin) { pdf.addPage(); yCursor = margin; }
        };
        ensureSpace(20);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Firmas', margin, yCursor);
        pdf.setFont('helvetica', 'normal');
        yCursor += 8;

        const colGap = 12;
        const colWidth = (contentWidth - colGap) / 2;
        const leftX = margin;
        const rightX = margin + colWidth + colGap;
        const signatureLineWidth = colWidth;
        const rowH = 12; // alto aproximado por fila de firmas
        const drawSignature = (x: number, y: number, label: string) => {
            pdf.line(x, y, x + signatureLineWidth, y);
            pdf.setFontSize(9);
            // Truncar etiqueta si es muy larga para que no desborde
            const maxChars = 60;
            const txt = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
            pdf.text(txt, x, y + 6);
        };

        // Firmas por empresa (3 columnas por fila)
        const empresasParaFirmar = selectedRouteCompanies.map(e => e.nombre || 'Empresa');
        const cols = 3;
        const gapCols = 12;
        const colWidth3 = (contentWidth - gapCols * (cols - 1)) / cols;
        const rowH3 = 14;
        const colXs = [margin, margin + colWidth3 + gapCols, margin + (colWidth3 + gapCols) * 2];
        for (let i = 0; i < empresasParaFirmar.length; i++) {
            const col = i % cols;
            if (col === 0) ensureSpace(rowH3 + 8);
            const x = colXs[col];
            // línea
            pdf.line(x, yCursor, x + colWidth3, yCursor);
            // etiqueta centrada
            pdf.setFontSize(9);
            const label = `Firma representante: ${empresasParaFirmar[i]}`;
            pdf.text(label.length > 60 ? label.slice(0,59) + '…' : label, x + colWidth3 / 2, yCursor + 6, { align: 'center' });
            if (col === cols - 1) {
                yCursor += rowH3;
            }
        }
        // si la última fila no se completó, avanzar
        if (empresasParaFirmar.length % cols !== 0) yCursor += rowH3;

        // Firma profesor tutor (3 columnas: ocupar la central)
        ensureSpace(rowH3 + 8);
        const centerX = colXs[1];
        pdf.line(centerX, yCursor, centerX + colWidth3, yCursor);
        pdf.setFontSize(9);
        const tutorLabel = routeSupervisor?.nombreCompleto ? `Firma profesor tutor: ${routeSupervisor.nombreCompleto}` : 'Firma profesor tutor';
        pdf.text(tutorLabel, centerX + colWidth3 / 2, yCursor + 6, { align: 'center' });

        try {
            pdf.save(`ruta-${routeName || 'supervision'}.pdf`);
        } catch (e) {
            console.error(e);
            alert('No se pudo descargar el PDF. Reintenta o prueba en otro navegador.');
        }
    };
    
    const loadSavedRoute = (route: RutaSupervision) => {
        setStartPoint({ label: route.startPoint.label, value: null });
        setStartPointCoords(route.startPoint.coords);
        setSelectedRouteCompanies(route.empresas);
        setTravelMode(route.travelMode);
        setRouteName(route.nombre);
        setRouteSupervisor(route.supervisor);
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

    if (!canReadEmpresas) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h1 className="text-2xl font-bold mb-2">Gestión de Empresas</h1>
                <div className="p-4 rounded-lg border bg-amber-50 text-amber-800">
                    No tienes permisos para acceder a este módulo. Requiere perfil de Subdirección, Profesorado o Coordinación TP.
                </div>
            </div>
        );
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

                        if (lista.length === 0) {
                            return (
                                <div className="text-center p-8 text-slate-500 bg-slate-50 dark:bg-slate-700/30 rounded-lg">No hay estudiantes para el filtro seleccionado.</div>
                            );
                        }

                        return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {lista.map(st => {
                                    const emp = encontrarEmpresaPorEstudiante(st.id);
                                    const evaluacionesAlumno = getEvaluacionesPorEstudiante(st.id);
                                    const { evaluacion: evaluacionActual, isDraft: evaluacionEsDraft } = getEvaluacionActiva(st.id);
                                    const savingEval = savingEvaluaciones[st.id];
                                    const panelAbierto = !!evaluacionPanelAbierto[st.id];
                                    const resumenEvaluacion = evaluacionesAlumno[0];
                                    const fechaInputValue = evaluacionActual?.fechaSupervision || '';
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
                                                <div className="h-px bg-slate-200 dark:bg-slate-700" />
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-500 block">Evaluación en la empresa</span>
                                                            <span className="text-[11px] text-slate-400">
                                                                {resumenEvaluacion
                                                                    ? `${formatFechaSupervision(resumenEvaluacion.fechaSupervision)} • Promedio ${typeof resumenEvaluacion.promedioGeneral === 'number' ? resumenEvaluacion.promedioGeneral.toFixed(1) : '—'}`
                                                                    : 'Sin registros previos'}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleEvaluacionPanel(st)}
                                                            className="text-xs font-semibold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800"
                                                        >
                                                            {panelAbierto ? 'Ocultar' : 'Evaluar práctica'}
                                                        </button>
                                                    </div>
                                                    {panelAbierto && (
                                                        <div className="space-y-4 border rounded-lg p-3 bg-slate-50">
                                                            <div className="space-y-2">
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="text-[11px] uppercase tracking-wide text-slate-500">Historial</span>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {evaluacionesAlumno.length === 0 && (
                                                                                <span className="text-xs text-slate-500">Sin registros previos.</span>
                                                                            )}
                                                                            {evaluacionesAlumno.map((registro) => {
                                                                                if (!registro.id) return null;
                                                                                const isActive = !evaluacionEsDraft && evaluacionActual?.id === registro.id;
                                                                                return (
                                                                                    <button
                                                                                        type="button"
                                                                                        key={registro.id}
                                                                                        onClick={() => handleSeleccionEvaluacion(st.id, registro.id!)}
                                                                                        className={`px-2 py-1 rounded-full text-xs border transition ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400'}`}
                                                                                    >
                                                                                        {formatFechaSupervision(registro.fechaSupervision)} • {typeof registro.promedioGeneral === 'number' ? registro.promedioGeneral.toFixed(1) : '—'}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleNuevaEvaluacion(st)}
                                                                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                                                        >
                                                                            + Nueva evaluación
                                                                        </button>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Fecha de supervisión</label>
                                                                        <input
                                                                            type="date"
                                                                            value={fechaInputValue}
                                                                            onChange={(e) => handleFechaSupervisionChange(st, e.target.value)}
                                                                            className="w-full border rounded-md px-2 py-1 text-sm bg-white"
                                                                        />
                                                                        {savingEval ? (
                                                                            <p className="text-[10px] text-slate-500 mt-1">Guardando cambios...</p>
                                                                        ) : evaluacionEsDraft ? (
                                                                            <p className="text-[10px] text-slate-500 mt-1">Se creará un nuevo registro al guardar.</p>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {evaluacionActual ? (
                                                                <div className="space-y-3">
                                                                    {EVALUACION_DIMENSIONES.map((dimension) => {
                                                                        const dimensionScore = evaluacionActual?.dimensionPromedios?.[dimension.id];
                                                                        return (
                                                                            <div key={dimension.id} className="border rounded-lg p-3 bg-white space-y-2">
                                                                                <div className="flex items-center justify-between">
                                                                                    <div>
                                                                                        <p className="text-sm font-semibold text-slate-800">{dimension.label}</p>
                                                                                        <p className="text-[11px] text-slate-500">{dimension.categoria}</p>
                                                                                    </div>
                                                                                    <span className="text-sm font-bold text-slate-700">{typeof dimensionScore === 'number' ? dimensionScore.toFixed(1) : '—'}</span>
                                                                                </div>
                                                                                <div className="space-y-3">
                                                                                    {dimension.indicadores.map((indicador) => {
                                                                                        const selected = evaluacionActual?.evaluaciones?.[indicador.id]?.nivel;
                                                                                        return (
                                                                                            <div key={indicador.id} className="space-y-1">
                                                                                                <p className="text-xs font-medium text-slate-600">{indicador.label}</p>
                                                                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                                                                    {NIVEL_EVALUACION_OPTIONS.map((option) => {
                                                                                                        const isActive = selected === option.key;
                                                                                                        return (
                                                                                                            <button
                                                                                                                key={option.key}
                                                                                                                type="button"
                                                                                                                disabled={savingEval}
                                                                                                                onClick={() => void handleEvaluacionCambio(st, indicador.id, dimension.id, option.key)}
                                                                                                                className={`text-xs rounded-lg border px-2 py-2 transition ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'}`}
                                                                                                            >
                                                                                                                <span className="font-semibold">{option.label}</span>
                                                                                                                <span className="block text-[10px] opacity-80">{option.rango}</span>
                                                                                                            </button>
                                                                                                        );
                                                                                                    })}
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    <div className="rounded-lg bg-slate-900 text-white px-3 py-2 flex items-center justify-between">
                                                                        <span className="text-sm font-semibold">Promedio general</span>
                                                                        <span className="text-lg font-bold">{typeof evaluacionActual?.promedioGeneral === 'number' ? evaluacionActual.promedioGeneral.toFixed(1) : '—'}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-slate-600">
                                                                    Crea una nueva evaluación para comenzar el registro de la práctica.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">3.b Selecciona profesor supervisor (Coordinación TP)</label>
                                <select
                                    value={routeSupervisor ? JSON.stringify(routeSupervisor) : ''}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setRouteSupervisor(v ? JSON.parse(v) : undefined);
                                    }}
                                    className="input-style w-full"
                                >
                                    <option value="">Sin supervisor</option>
                                    {profesores
                                        .filter(p => p.profile === Profile.COORDINACION_TP)
                                        .map(p => (
                                            <option key={p.id} value={JSON.stringify({ id: p.id, nombreCompleto: p.nombreCompleto })}>
                                                {p.nombreCompleto}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">4. Selecciona las empresas a visitar</label>
                                <div className="max-h-64 overflow-y-auto border rounded-lg p-2 space-y-2">
                                    {empresas.filter(e => e.coordenadas).map(empresa => {
                                        const asignados = getEstudiantesDeEmpresa(empresa.id);
                                        const nombres = asignados.map(a => `${a.nombreCompleto}${a.curso ? ` (${a.curso})` : ''}`);
                                        const selected = selectedRouteCompanies.some(e => e.id === empresa.id);
                                        return (
                                            <div key={empresa.id} className="py-1 px-2 rounded hover:bg-slate-50">
                                                <div className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id={`route-${empresa.id}`}
                                                        checked={selected}
                                                        onChange={() => handleRouteCompanyToggle(empresa)}
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <label htmlFor={`route-${empresa.id}`} className="ml-3 text-sm text-gray-700">
                                                        {empresa.nombre}
                                                        {asignados.length > 0 && (
                                                            <span className="ml-2 text-xs text-slate-500">({asignados.length} estudiante{asignados.length !== 1 ? 's' : ''})</span>
                                                        )}
                                                    </label>
                                                </div>
                                                {asignados.length > 0 && (
                                                    <div className="ml-7 mt-1 text-xs text-slate-500 line-clamp-2">
                                                        {nombres.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
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
                        <div>{/* El mapa principal se muestra en la tarjeta inferior cuando hay ruta */}</div>
                    </div>
                    {calculatedRoute && (() => {
                        // Cálculos para detalles
                        const legs = calculatedRoute.routes[0]?.legs || [];
                        const travelDuration = legs.reduce((acc, leg) => acc + (leg.duration?.value || 0), 0);
                        const numberOfStops = legs.length > 1 ? legs.length - 1 : 0;
                        const tiempoPorParada = travelMode === 'TRANSIT' ? 45 : 30;
                        const stopDuration = numberOfStops * tiempoPorParada * 60;
                        const totalDuration = travelDuration + stopDuration;
                        const totalDistance = legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0);
                        const costoBencina = travelMode === 'DRIVING' ? ((totalDistance / 1000) / 12) * 1300 : 0;
                        const ddmmyyyy = (() => { const d = new Date(); const dd = String(d.getDate()).padStart(2,'0'); const mm = String(d.getMonth()+1).padStart(2,'0'); const yyyy = d.getFullYear(); return `${dd}-${mm}-${yyyy}`; })();
                        return (
                            <div className="bg-white shadow-lg rounded-2xl mx-auto max-w-5xl p-6 font-sans text-gray-800 mt-6">
                                {/* Encabezado superior */}
                                <div className="bg-slate-900 text-white rounded-xl px-6 py-3 mb-4 flex justify-between items-center">
                                    <div className="font-bold">Ruta de Supervisión: {routeName || 'Sin nombre'}</div>
                                    <div className="text-sm opacity-90 flex gap-3">
                                        <span>{ddmmyyyy}</span>
                                        <span>•</span>
                                        <span>{travelMode === 'DRIVING' ? 'Automóvil' : 'Transporte Público'}</span>
                                    </div>
                                </div>

                                {/* Mapa */}
                                <div className="rounded-xl shadow-sm border overflow-hidden mb-6">
                                    <GoogleMapView empresas={selectedRouteCompanies} isLoaded={isMapScriptLoaded} route={calculatedRoute} heightPx={384} />
                                </div>

                                {/* Detalles de la Ruta */}
                                <h3 className="text-lg font-bold mt-6">Detalles de la Ruta</h3>
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                    <div className="p-3 rounded-lg bg-slate-50 border"><div className="text-xs text-slate-500">Tiempo de viaje</div><div className="font-semibold">{Math.round(travelDuration / 60)} min</div></div>
                                    <div className="p-3 rounded-lg bg-slate-50 border"><div className="text-xs text-slate-500">Tiempo en paradas</div><div className="font-semibold">{Math.round(stopDuration / 60)} min</div></div>
                                    <div className="p-3 rounded-lg bg-slate-50 border"><div className="text-xs text-slate-500">Duración total</div><div className="font-semibold">{Math.round(totalDuration / 60)} min</div></div>
                                    <div className="p-3 rounded-lg bg-slate-50 border"><div className="text-xs text-slate-500">Distancia total</div><div className="font-semibold">{(totalDistance / 1000).toFixed(1)} km</div></div>
                                    <div className="p-3 rounded-lg bg-slate-50 border"><div className="text-xs text-slate-500">Costo estimado</div><div className="font-semibold">{travelMode === 'DRIVING' ? `$${Math.round(costoBencina).toLocaleString('es-CL')}` : '—'}</div></div>
                                </div>

                                {/* Tramos */}
                                <div className="mt-4 divide-y">
                                    {legs.map((leg, i) => (
                                        <div key={i} className="py-2">
                                            <div className="text-sm">Tramo {i + 1}: {(leg.start_address || '').split(',')[0]} → {(leg.end_address || '').split(',')[0]}. {leg.duration?.text || ''} • {leg.distance?.text || ''}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Estudiantes por empresa seleccionada */}
                                <div className="mt-6">
                                    <h3 className="text-lg font-bold">Estudiantes por empresa</h3>
                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {selectedRouteCompanies.map(empLite => {
                                            const empFull = getEmpresaCompleta(empLite) as Empresa;
                                            const alumnos = (empFull.estudiantesAsignados || [])
                                                .map(id => estudiantesMap.get(id))
                                                .filter(Boolean) as User[];
                                            return (
                                                <div key={empFull.id} className="p-3 rounded-lg bg-slate-50 border">
                                                    <div className="font-semibold text-sm mb-1 break-words">{empFull.nombre}</div>
                                                    {alumnos.length > 0 ? (
                                                        <ul className="text-xs text-slate-700 list-disc list-inside space-y-0.5">
                                                            {alumnos.map(a => (
                                                                <li key={a.id}>{a.nombreCompleto}{a.curso ? ` (${a.curso})` : ''}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <div className="text-xs text-slate-500">Sin estudiantes asignados</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Firmas (3 columnas, dinámicas) */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-10">
                                    {selectedRouteCompanies.map((e, idx) => (
                                        <div key={e.id || idx} className="text-center">
                                            <div className="border-t-2 border-gray-400 h-10" />
                                            <div className="text-sm text-gray-600 mt-2 break-words">Firma representante: {e.nombre || 'Empresa'}</div>
                                        </div>
                                    ))}
                                    <div className="text-center">
                                        <div className="border-t-2 border-gray-400 h-10" />
                                        <div className="text-sm text-gray-600 mt-2 break-words">
                                            {routeSupervisor?.nombreCompleto ? `Firma profesor tutor: ${routeSupervisor.nombreCompleto}` : 'Firma profesor tutor'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
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
