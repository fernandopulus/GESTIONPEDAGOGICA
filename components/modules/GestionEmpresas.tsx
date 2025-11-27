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
import autoTable, { UserOptions } from 'jspdf-autotable';
import { Building, Hash, MapPin, User as UserIcon, Mail, Briefcase, Users, Star, LayoutDashboard } from 'lucide-react';
import { CURSOS_DUAL } from '../../constants';
import { useAuth } from '../../src/hooks/useAuth';
import { generarConIA } from '../../src/ai/geminiHelper';


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

const EvaluacionesDashboard: React.FC<{
    evaluacionesMap: Record<string, EvaluacionEmpresaEstudiante[]>;
    empresas: Empresa[];
    estudiantes: User[];
    profesores: User[];
}> = ({ evaluacionesMap, empresas, estudiantes, profesores }) => {
    const [filtroCurso, setFiltroCurso] = useState('todos');
    const [filtroEspecialidad, setFiltroEspecialidad] = useState('todas');
    const [filtroSupervisor, setFiltroSupervisor] = useState('todos');
    const [studentToEvaluate, setStudentToEvaluate] = useState<User | null>(null);
    const [feedback, setFeedback] = useState<Record<string, string>>({});

    const processedData = useMemo(() => {
        // 1. Flatten to latest evaluation per student
        const latestEvaluations = Object.entries(evaluacionesMap).map(([studentId, list]) => {
            if (!list || list.length === 0) return null;
            // Assuming list is sorted by date desc (as per previous changes)
            const latest = list[0]; 
            const student = estudiantes.find(s => s.id === studentId);
            if (!student) return null;
            
            const empresa = empresas.find(e => e.id === latest.empresaId);
            const supervisor = empresa?.docenteSupervisor?.nombreCompleto || 'Sin asignar';
            const especialidad = empresa?.area || 'Sin especificar';

            return {
                student,
                empresa,
                evaluation: latest,
                curso: student.curso || 'Sin curso',
                especialidad,
                supervisor
            };
        }).filter(item => item !== null) as Array<{
            student: User;
            empresa: Empresa | undefined;
            evaluation: EvaluacionEmpresaEstudiante;
            curso: string;
            especialidad: string;
            supervisor: string;
        }>;

        // 2. Apply filters
        const filtered = latestEvaluations.filter(item => {
            if (filtroCurso !== 'todos' && item.curso !== filtroCurso) return false;
            if (filtroEspecialidad !== 'todas' && item.especialidad !== filtroEspecialidad) return false;
            if (filtroSupervisor !== 'todos' && item.supervisor !== filtroSupervisor) return false;
            return true;
        });

        // 3. Calculate KPIs
        const totalEvaluados = filtered.length;
        const promedioGeneral = totalEvaluados > 0 
            ? filtered.reduce((acc, item) => acc + (item.evaluation.promedioGeneral || 0), 0) / totalEvaluados 
            : 0;
        
        // 4. Charts Data
        // By Especialidad
        const byEspecialidad: Record<string, { sum: number, count: number }> = {};
        filtered.forEach(item => {
            if (!byEspecialidad[item.especialidad]) byEspecialidad[item.especialidad] = { sum: 0, count: 0 };
            byEspecialidad[item.especialidad].sum += (item.evaluation.promedioGeneral || 0);
            byEspecialidad[item.especialidad].count += 1;
        });
        const chartEspecialidad = Object.entries(byEspecialidad).map(([name, val]) => ({
            name,
            promedio: parseFloat((val.sum / val.count).toFixed(1))
        }));

        // By Curso
        const byCurso: Record<string, { sum: number, count: number }> = {};
        filtered.forEach(item => {
            if (!byCurso[item.curso]) byCurso[item.curso] = { sum: 0, count: 0 };
            byCurso[item.curso].sum += (item.evaluation.promedioGeneral || 0);
            byCurso[item.curso].count += 1;
        });
        const chartCurso = Object.entries(byCurso).map(([name, val]) => ({
            name,
            promedio: parseFloat((val.sum / val.count).toFixed(1))
        }));

        // Distribution of Levels (NL, PL, ML, L)
        const levelsCount: Record<string, number> = { NL: 0, PL: 0, ML: 0, L: 0 };
        filtered.forEach(item => {
            Object.values(item.evaluation.evaluaciones || {}).forEach(ind => {
                if (ind.nivel && levelsCount[ind.nivel] !== undefined) {
                    levelsCount[ind.nivel]++;
                }
            });
        });
        const chartNiveles = Object.entries(levelsCount).map(([name, value]) => ({ name, value }));

        // 5. Average per Indicator
        const indicadoresStats: Record<string, { sum: number, count: number, label: string }> = {};
        // Initialize
        EVALUACION_DIMENSIONES.forEach(dim => {
            dim.indicadores.forEach(ind => {
                indicadoresStats[ind.id] = { sum: 0, count: 0, label: ind.label };
            });
        });
        // Accumulate
        filtered.forEach(item => {
            Object.values(item.evaluation.evaluaciones || {}).forEach((indEval: any) => {
                if (indicadoresStats[indEval.indicadorId]) {
                    indicadoresStats[indEval.indicadorId].sum += (indEval.nota || 0);
                    indicadoresStats[indEval.indicadorId].count += 1;
                }
            });
        });
        const chartIndicadores = Object.values(indicadoresStats).map(stat => ({
            name: stat.label.length > 50 ? stat.label.substring(0, 50) + '...' : stat.label,
            fullLabel: stat.label,
            promedio: stat.count > 0 ? parseFloat((stat.suma / stat.count).toFixed(1)) : 0
        }));

        return { filtered, totalEvaluados, promedioGeneral, chartEspecialidad, chartCurso, chartNiveles, chartIndicadores };
    }, [evaluacionesMap, empresas, estudiantes, filtroCurso, filtroEspecialidad, filtroSupervisor]);

    const uniqueEspecialidades = Array.from(new Set(empresas.map(e => e.area || 'Sin especificar')));
    const uniqueSupervisores = Array.from(new Set(empresas.map(e => e.docenteSupervisor?.nombreCompleto || 'Sin asignar')));

    const COLORS = ['#EF4444', '#F59E0B', '#6366F1', '#22C55E']; // NL, PL, ML, L colors approx

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Curso</label>
                    <select value={filtroCurso} onChange={e => setFiltroCurso(e.target.value)} className="w-full mt-1 border-slate-300 rounded-md text-sm">
                        <option value="todos">Todos</option>
                        {CURSOS_DUAL.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Especialidad</label>
                    <select value={filtroEspecialidad} onChange={e => setFiltroEspecialidad(e.target.value)} className="w-full mt-1 border-slate-300 rounded-md text-sm">
                        <option value="todas">Todas</option>
                        {uniqueEspecialidades.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Supervisor</label>
                    <select value={filtroSupervisor} onChange={e => setFiltroSupervisor(e.target.value)} className="w-full mt-1 border-slate-300 rounded-md text-sm">
                        <option value="todos">Todos</option>
                        {uniqueSupervisores.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white border shadow-sm">
                    <div className="text-sm text-slate-500">Estudiantes Evaluados</div>
                    <div className="text-3xl font-bold text-slate-800">{processedData.totalEvaluados}</div>
                </div>
                <div className="p-4 rounded-xl bg-white border shadow-sm">
                    <div className="text-sm text-slate-500">Promedio General</div>
                    <div className="text-3xl font-bold text-indigo-600">{processedData.promedioGeneral.toFixed(1)}</div>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 bg-white rounded-xl border shadow-sm">
                    <h3 className="font-bold mb-4 text-slate-700">Promedio por Especialidad</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={processedData.chartEspecialidad} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" domain={[0, 7]} hide />
                            <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 11}} />
                            <Tooltip />
                            <Bar dataKey="promedio" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', fill: '#666', fontSize: 12 }} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="p-4 bg-white rounded-xl border shadow-sm">
                    <h3 className="font-bold mb-4 text-slate-700">Distribución de Niveles (Indicadores)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={processedData.chartNiveles} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {processedData.chartNiveles.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* New Chart: Indicators Performance */}
            <div className="p-4 bg-white rounded-xl border shadow-sm">
                <h3 className="font-bold mb-4 text-slate-700">Nivel de Logro por Indicador</h3>
                <div className="h-[500px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processedData.chartIndicadores} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                            <XAxis type="number" domain={[0, 7]} ticks={[1,2,3,4,5,6,7]} />
                            <YAxis type="category" dataKey="name" width={250} tick={{fontSize: 11}} interval={0} />
                            <Tooltip 
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white p-2 border shadow-lg rounded text-sm">
                                                <p className="font-bold">{data.fullLabel}</p>
                                                <p className="text-indigo-600">Promedio: {data.promedio}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="promedio" fill="#06B6D4" radius={[0, 4, 4, 0]} barSize={15}>
                                {processedData.chartIndicadores.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.promedio >= 6.0 ? '#22C55E' : entry.promedio >= 5.0 ? '#6366F1' : entry.promedio >= 4.0 ? '#F59E0B' : '#EF4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h3 className="font-bold text-slate-700">Detalle por Estudiante</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Estudiante</th>
                                <th className="px-6 py-3">Curso</th>
                                <th className="px-6 py-3">Empresa</th>
                                <th className="px-6 py-3">Supervisor</th>
                                <th className="px-6 py-3 text-right">Promedio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {processedData.filtered.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium">{item.student.nombreCompleto}</td>
                                    <td className="px-6 py-3">{item.curso}</td>
                                    <td className="px-6 py-3">{item.empresa?.nombre || '—'}</td>
                                    <td className="px-6 py-3">{item.supervisor}</td>
                                    <td className="px-6 py-3 text-right font-bold text-indigo-600">
                                        {item.evaluation.promedioGeneral?.toFixed(1) || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
    const [view, setView] = useState<'list' | 'form' | 'map' | 'route' | 'saved-routes' | 'dashboard' | 'estudiantes' | 'evaluaciones'>('list');
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

    const [studentToEvaluate, setStudentToEvaluate] = useState<User | null>(null);
    const [feedback, setFeedback] = useState<Record<string, string>>({});
    const [generatingFeedback, setGeneratingFeedback] = useState<Record<string, boolean>>({});

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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            // Opcional: Mostrar un toast o notificación
        }, (err) => {
            console.error('Error al copiar: ', err);
        });
    };

    const handleSaveFeedback = async (student: User, feedbackText: string) => {
        if (!feedbackText) return;
        const { evaluacion, isDraft } = resolveEvaluacionActiva(student);
        
        setSavingEvaluaciones(prev => ({ ...prev, [student.id]: true }));
        try {
            const payload: EvaluacionEmpresaEstudiante = {
                ...evaluacion,
                retroalimentacion: feedbackText,
                updatedBy: currentUser ? { id: currentUser.id, nombre: currentUser.nombreCompleto || currentUser.email || 'Usuario' } : undefined,
            };

            if (isDraft) {
                setEvaluacionDrafts(prev => ({ ...prev, [student.id]: payload }));
                // Si es draft, no guardamos en DB todavía, solo en estado local draft
                // Opcional: Podríamos guardar el draft en DB si quisiéramos persistencia parcial
                alert('Retroalimentación guardada en borrador. Recuerda guardar la evaluación completa para persistir los cambios.');
            } else {
                await saveEvaluacionEmpresa(payload);
                alert('Retroalimentación guardada exitosamente.');
            }
        } catch (error) {
            console.error('Error al guardar retroalimentación:', error);
            alert('No se pudo guardar la retroalimentación.');
        } finally {
            setSavingEvaluaciones(prev => ({ ...prev, [student.id]: false }));
        }
    };

    const handleGenerarRetroalimentacion = async (student: User) => {
        const { evaluacion } = getEvaluacionActiva(student.id);
        if (!evaluacion) {
            alert('No hay evaluación activa para generar retroalimentación.');
            return;
        }

        setGeneratingFeedback(prev => ({ ...prev, [student.id]: true }));
        try {
            const prompt = `
                Genera una retroalimentación pedagógica formal para el estudiante ${student.nombreCompleto} del curso ${student.curso || 'N/A'}.
                
                Contexto de Evaluación de Práctica Profesional:
                - Promedio General: ${evaluacion.promedioGeneral?.toFixed(1) || 'N/A'}
                
                Desempeño por Dimensiones:
                ${Object.entries(evaluacion.dimensionPromedios || {}).map(([dimId, prom]) => {
                    const dim = EVALUACION_DIMENSIONES.find(d => d.id === dimId);
                    return `- ${dim?.label || dimId}: ${prom.toFixed(1)}`;
                }).join('\n')}
                
                Detalle de Indicadores:
                ${Object.values(evaluacion.evaluaciones || {}).map(ev => {
                    let label = ev.indicadorId;
                    for(const d of EVALUACION_DIMENSIONES) {
                        const ind = d.indicadores.find(i => i.id === ev.indicadorId);
                        if(ind) { label = ind.label; break; }
                    }
                    return `- ${label}: ${ev.nivel} (${ev.nota})`;
                }).join('\n')}
                
                Instrucciones estrictas de redacción:
                1. Redacta en TERCERA PERSONA (ej: "El estudiante evidencia...", "Se observa...").
                2. Mantén un tono OBJETIVO y descriptivo, evitando juicios de valor subjetivos o adjetivos calificativos excesivos.
                3. Enfócate en hechos observables basados en los indicadores evaluados.
                4. Estructura la respuesta en un solo párrafo cohesivo o dos párrafos breves.
                5. NO uses formato Markdown, ni listas con viñetas, ni negritas, ni caracteres especiales. Solo texto plano.
                6. Asegúrate de que la respuesta esté completa y no se corte abruptamente.
                7. El objetivo es que este texto sea útil para la hoja de vida del estudiante, destacando sus competencias logradas y áreas de desarrollo profesional.
            `;

            const response = await generarConIA(prompt, 2, true, 'GestionEmpresas', false);
            setFeedback(prev => ({ ...prev, [student.id]: response || 'No se pudo generar la retroalimentación.' }));
        } catch (error) {
            console.error('Error generando retroalimentación:', error);
            alert('Ocurrió un error al generar la retroalimentación.');
        } finally {
            setGeneratingFeedback(prev => ({ ...prev, [student.id]: false }));
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

    const handleExportPDF = async () => {
        if (!calculatedRoute) {
            alert('Falta información para generar el PDF. Primero visualiza la ruta.');
            return;
        }

        const legs = calculatedRoute.routes[0]?.legs || [];
        const travelDurationSec = legs.reduce((acc, leg) => acc + (leg.duration?.value || 0), 0);
        const numberOfStops = Math.max(0, legs.length - 1);
        const tiempoPorParada = travelMode === 'TRANSIT' ? 45 : 30;
        const stopDurationSec = numberOfStops * tiempoPorParada * 60;
        const totalDurationSec = travelDurationSec + stopDurationSec;
        const totalDistanceM = legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0);
        const totalDistanceKm = totalDistanceM / 1000;
        const travelDurationMin = Math.round(travelDurationSec / 60);
        const stopDurationMin = Math.round(stopDurationSec / 60);
        const totalDurationMin = Math.round(totalDurationSec / 60);
        const fecha = new Date();
        const fechaTxt = fecha.toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
        const startLabel = startPoint?.label || '—';
        const supervisorNombre = routeSupervisor?.nombreCompleto || '—';
        const viajeLabel = travelMode === 'DRIVING' ? 'Automóvil' : 'Transporte Público';
        const empresasForStudents = selectedRouteCompanies.map(e => getEmpresaCompleta(e) as Empresa);
        const totalEstudiantes = empresasForStudents.reduce((acc, emp) => acc + ((emp?.estudiantesAsignados || []).length), 0);

        let logoLeftData: string | null = null;
        let logoRightData: string | null = null;
        try {
            const [left, right] = await Promise.all([
                fetchImageAsDataURL('https://res.cloudinary.com/dwncmu1wu/image/upload/v1764096456/Captura_de_pantalla_2025-11-25_a_la_s_3.47.16_p._m._p7m2xy.png'),
                fetchImageAsDataURL('https://res.cloudinary.com/dwncmu1wu/image/upload/v1753209432/LIR_fpq2lc.png')
            ]);
            logoLeftData = left;
            logoRightData = right;
        } catch (err) {
            console.error('No se pudieron cargar los logos del PDF de ruta:', err);
        }

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'legal' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pdfWidth - margin * 2;
        const sectionGap = 8;
        let yCursor = margin;

        const placeLogo = (dataUrl: string | null, x: number) => {
            if (!dataUrl) return;
            pdf.addImage(dataUrl, 'PNG', x, yCursor, 15, 20);
        };
        placeLogo(logoLeftData, margin);
        placeLogo(logoRightData, pdfWidth - margin - 15);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.text('Ruta de Supervisión', pdfWidth / 2, yCursor + 9, { align: 'center' });
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Planificación de visitas a empresas', pdfWidth / 2, yCursor + 17, { align: 'center' });
        yCursor += 24;
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Emitido el ${fechaTxt}`, pdfWidth / 2, yCursor, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
        yCursor += sectionGap;

        const drawSectionTitle = (title: string) => {
            if (yCursor + 6 > pdfHeight - margin) {
                pdf.addPage();
                yCursor = margin;
            }
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(12);
            pdf.text(title, margin, yCursor);
            yCursor += 6;
        };

        const drawTable = (options: UserOptions) => {
            const mergedStyles = { fontSize: 10, cellPadding: 3, overflow: 'linebreak', ...(options.styles || {}) } as UserOptions['styles'];
            const mergedHeadStyles = { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold', ...(options.headStyles || {}) } as UserOptions['headStyles'];
            autoTable(pdf, {
                ...options,
                margin: { left: margin, right: margin },
                styles: mergedStyles,
                headStyles: mergedHeadStyles,
            });
            yCursor = (pdf as any).lastAutoTable.finalY + sectionGap;
        };

        drawSectionTitle('Planificación de la unidad');
        const planningRows = [
            ['Nombre de la ruta', routeName || 'Sin nombre'],
            ['Fecha planificada', fechaTxt],
            ['Punto de partida', startLabel],
            ['Modo de transporte', viajeLabel],
            ['Supervisor responsable', supervisorNombre],
            ['Empresas consideradas', `${selectedRouteCompanies.length}`],
            ['Estudiantes implicados', totalEstudiantes ? String(totalEstudiantes) : '—'],
            ['Distancia total estimada', `${totalDistanceKm.toFixed(1)} km`],
            ['Tiempo de viaje', `${travelDurationMin} min`],
            ['Tiempo proyectado en paradas', `${stopDurationMin} min`],
            ['Duración total estimada', `${totalDurationMin} min`],
        ];
        drawTable({
            startY: yCursor,
            head: [['Elemento', 'Detalle']],
            body: planningRows,
        });

        drawSectionTitle('Itinerario detallado');
        const itineraryRows = legs.map((leg, idx) => [
            `Tramo ${idx + 1}`,
            (leg.start_address || '').split(',')[0] || '—',
            (leg.end_address || '').split(',')[0] || '—',
            leg.distance?.text || '—',
            leg.duration?.text || '—',
        ]);
        drawTable({
            startY: yCursor,
            head: [['Tramo', 'Origen', 'Destino', 'Distancia', 'Tiempo']],
            body: itineraryRows.length ? itineraryRows : [['—', 'No hay tramos registrados', '—', '—', '—']],
        });

        drawSectionTitle('Empresas y estudiantes asignados');
        const empresasRows = empresasForStudents.map(emp => {
            const alumnosIds = emp?.estudiantesAsignados || [];
            const alumnos = alumnosIds
                .map((id: string) => estudiantesMap.get(id))
                .filter(Boolean) as User[];
            const alumnosTxt = alumnos.length
                ? alumnos.map(a => `${a.nombreCompleto}${a.curso ? ` (${a.curso})` : ''}`).join('\n')
                : 'Sin estudiantes asignados';
            return [
                emp?.nombre || 'Empresa',
                emp?.direccion || '—',
                alumnosTxt,
            ];
        });
        drawTable({
            startY: yCursor,
            head: [['Empresa', 'Dirección', 'Estudiantes']],
            body: empresasRows.length ? empresasRows : [['—', '—', '—']],
            styles: { fontSize: 9 },
        });

        const ensureSpace = (needed: number) => {
            if (yCursor + needed > pdfHeight - margin) {
                pdf.addPage();
                yCursor = margin;
            }
        };

        ensureSpace(20);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('Firmas', margin, yCursor);
        yCursor += 8;
        pdf.setFont('helvetica', 'normal');

        const cols = 3;
        const gapCols = 12;
        const colWidth = (contentWidth - gapCols * (cols - 1)) / cols;
        const colXs = [margin, margin + colWidth + gapCols, margin + (colWidth + gapCols) * 2];
        const rowH = 14;
        const empresasParaFirmar = selectedRouteCompanies.map(e => e.nombre || 'Empresa');
        empresasParaFirmar.forEach((nombre, idx) => {
            const col = idx % cols;
            if (col === 0) ensureSpace(rowH + 4);
            const x = colXs[col];
            pdf.line(x, yCursor, x + colWidth, yCursor);
            pdf.setFontSize(9);
            const label = `Firma representante: ${nombre}`;
            pdf.text(label.length > 60 ? `${label.slice(0, 59)}…` : label, x + colWidth / 2, yCursor + 6, { align: 'center' });
            if (col === cols - 1 || idx === empresasParaFirmar.length - 1) {
                yCursor += rowH;
            }
        });

        ensureSpace(rowH + 4);
        const centerX = colXs[1];
        pdf.line(centerX, yCursor, centerX + colWidth, yCursor);
        pdf.setFontSize(9);
        const tutorLabel = routeSupervisor?.nombreCompleto
            ? `Firma profesor tutor: ${routeSupervisor.nombreCompleto}`
            : 'Firma profesor tutor';
        pdf.text(tutorLabel, centerX + colWidth / 2, yCursor + 6, { align: 'center' });

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

    const handleExportConsolidadoPDF = async () => {
        if (savedRoutes.length === 0) {
            alert('No hay rutas guardadas para generar el reporte.');
            return;
        }

        // Filtrar por mes actual
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const routesInMonth = savedRoutes.filter(r => {
            if (!r.createdAt) return false;
            const d = typeof r.createdAt === 'string' ? new Date(r.createdAt) : r.createdAt.toDate ? r.createdAt.toDate() : new Date();
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        if (routesInMonth.length === 0) {
            alert('No hay rutas guardadas en el mes actual.');
            return;
        }

        // Cargar imágenes para el encabezado
        let logoLeftData: string | null = null;
        let logoRightData: string | null = null;
        try {
            logoLeftData = await fetchImageAsDataURL('https://res.cloudinary.com/dwncmu1wu/image/upload/v1764096456/Captura_de_pantalla_2025-11-25_a_la_s_3.47.16_p._m._p7m2xy.png');
            logoRightData = await fetchImageAsDataURL('https://res.cloudinary.com/dwncmu1wu/image/upload/v1753209432/LIR_fpq2lc.png');
        } catch (e) {
            console.error('Error cargando logos:', e);
        }

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'legal'
        });

        const margin = 10;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yCursor = margin;

        const placeLogo = (data: string | null, x: number) => {
            if (!data) return;
            doc.addImage(data, 'PNG', x, yCursor, 15, 20);
        };

        placeLogo(logoLeftData, margin);
        placeLogo(logoRightData, pageWidth - margin - 15);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Supervisión de Práctica', pageWidth / 2, yCursor + 9, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text('Consolidado mensual de rutas', pageWidth / 2, yCursor + 17, { align: 'center' });
        yCursor += 26;
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        const periodoTxt = `Mes ${currentMonth + 1} • ${currentYear}`;
        doc.text(periodoTxt, pageWidth / 2, yCursor, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        yCursor += 8;

        // Datos de identificación
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Liceo Industrial de Recoleta', margin, yCursor);
        yCursor += 6;
        doc.text('Nombre de Coordinador Responsable: Nelson Laubreaux Rojas', margin, yCursor);
        yCursor += 6;
        doc.text('Rut: 10.122.222-5', margin, yCursor);
        yCursor += 10;

        // Preparar datos de la tabla
        const tableBody: any[] = [];

        routesInMonth.forEach(route => {
            const dateObj = typeof route.createdAt === 'string' ? new Date(route.createdAt) : route.createdAt?.toDate ? route.createdAt.toDate() : new Date();
            const dateStr = dateObj.toLocaleDateString('es-CL');

            route.empresas.forEach((empLite: any) => {
                const empFull = getEmpresaCompleta(empLite);
                const estudiantesAsignados = getEstudiantesDeEmpresa(empFull.id);

                if (estudiantesAsignados.length === 0) {
                    tableBody.push([
                        dateStr,
                        empFull.nombre,
                        'Sin estudiantes asignados',
                        '—',
                        empFull.area || '—'
                    ]);
                } else {
                    estudiantesAsignados.forEach(st => {
                        tableBody.push([
                            dateStr,
                            empFull.nombre,
                            st.nombreCompleto,
                            st.curso || '—',
                            empFull.area || '—'
                        ]);
                    });
                }
            });
        });

        autoTable(doc, {
            startY: yCursor,
            head: [['Fecha de visita', 'Empresa', 'Nombre del Estudiante', 'Curso', 'Especialidad']],
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
            margin: { left: margin, right: margin },
        });

        yCursor = (doc as any).lastAutoTable.finalY + 30;
        
        if (yCursor + 30 > pageHeight - margin) {
            doc.addPage();
            yCursor = margin + 30;
        }

        const signatureY = yCursor;
        const signatureWidth = 80;
        
        doc.line(margin + 10, signatureY, margin + 10 + signatureWidth, signatureY);
        doc.text('Firma Coordinador Responsable', margin + 10 + signatureWidth / 2, signatureY + 5, { align: 'center' });

        doc.line(pageWidth - 10 - signatureWidth, signatureY, pageWidth - 10, signatureY);
        doc.text('Firma Director/a Establecimiento', pageWidth - 10 - signatureWidth / 2, signatureY + 5, { align: 'center' });

        const footerY = pageHeight - 15;
        doc.setFontSize(8);
        doc.text('Fundación de solidaridad Romanos XII', pageWidth / 2, footerY, { align: 'center' });
        doc.text('Gran Avenida 4688, San Miguel, Santiago de Chile', pageWidth / 2, footerY + 4, { align: 'center' });
        doc.text('Tel +560227637900 fundacion.solidaridad@romanosxii.org', pageWidth / 2, footerY + 8, { align: 'center' });

        doc.save(`consolidado_supervision_${currentMonth + 1}_${currentYear}.pdf`);
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
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                <h1 className="text-3xl font-bold">Gestión de Empresas</h1>
                <div className="flex flex-wrap items-center gap-2">
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
                            <button 
                                onClick={() => setView('evaluaciones')} 
                                title="Evaluaciones" 
                                className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Evaluaciones
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

            {view === 'evaluaciones' && (
                <EvaluacionesDashboard 
                    evaluacionesMap={evaluacionesEstudiantes} 
                    empresas={empresas} 
                    estudiantes={estudiantes} 
                    profesores={profesores} 
                />
            )}

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
                                        <div key={st.id} className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-900 flex flex-col gap-3 hover:shadow-md transition-shadow">
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
                                                    className="px-3 py-1 border border-gray-300 rounded-md text-sm dark:bg-slate-800 dark:border-slate-600"
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
                                                            <span className="text-xs font-medium text-slate-500 block">Historial</span>
                                                            <span className="text-[11px] text-slate-400">
                                                                {evaluacionesAlumno.length === 0 && 'Sin registros previos.'}
                                                                {evaluacionesAlumno.length > 0 && `Última evaluación: ${formatFechaSupervision(evaluacionesAlumno[0].fechaSupervision)}`}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setStudentToEvaluate(st)}
                                                            className="text-xs font-semibold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800"
                                                        >
                                                            Evaluar práctica
                                                        </button>
                                                    </div>
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

            {/* Modal de Evaluación */}
            {studentToEvaluate && (() => {
                const st = studentToEvaluate;
                const evaluacionesAlumno = getEvaluacionesPorEstudiante(st.id);
                const { evaluacion: evaluacionActual, isDraft: evaluacionEsDraft } = getEvaluacionActiva(st.id);
                const savingEval = savingEvaluaciones[st.id];
                const fechaInputValue = evaluacionActual?.fechaSupervision || '';

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Evaluación de Práctica</h3>
                                    <p className="text-sm text-slate-500">{st.nombreCompleto} - {st.curso}</p>
                                </div>
                                <button 
                                    onClick={() => setStudentToEvaluate(null)}
                                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                <div className="space-y-4 border rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
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
                                                    className="w-full border rounded-md px-2 py-1 text-sm bg-white dark:bg-slate-700 dark:border-slate-600"
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
                                        <div className="space-y-4">
                                            {EVALUACION_DIMENSIONES.map((dimension) => {
                                                const dimensionScore = evaluacionActual?.dimensionPromedios?.[dimension.id];
                                                return (
                                                    <div key={dimension.id} className="border rounded-lg p-4 bg-white dark:bg-slate-900 space-y-3 shadow-sm">
                                                        <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
                                                            <div>
                                                                <p className="text-base font-bold text-slate-800 dark:text-slate-200">{dimension.label}</p>
                                                                <p className="text-xs text-slate-500">{dimension.categoria}</p>
                                                            </div>
                                                            <span className="text-lg font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                                                                {typeof dimensionScore === 'number' ? dimensionScore.toFixed(1) : '—'}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-4 pt-2">
                                                            {dimension.indicadores.map((indicador) => {
                                                                const selected = evaluacionActual?.evaluaciones?.[indicador.id]?.nivel;
                                                                return (
                                                                    <div key={indicador.id} className="space-y-2">
                                                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{indicador.label}</p>
                                                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                                            {NIVEL_EVALUACION_OPTIONS.map((option) => {
                                                                                const isActive = selected === option.key;
                                                                                return (
                                                                                    <button
                                                                                        key={option.key}
                                                                                        type="button"
                                                                                        disabled={savingEval}
                                                                                        onClick={() => void handleEvaluacionCambio(st, indicador.id, dimension.id, option.key)}
                                                                                        className={`text-xs rounded-lg border px-2 py-3 transition flex flex-col items-center justify-center gap-1 ${
                                                                                            isActive 
                                                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' 
                                                                                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                                                                                        }`}
                                                                                    >
                                                                                        <span className="font-bold text-sm">{option.label}</span>
                                                                                        <span className="text-[10px] opacity-90">{option.rango}</span>
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
                                            
                                            <div className="sticky bottom-0 bg-white dark:bg-slate-900 p-4 border-t border-slate-200 dark:border-slate-700 shadow-lg rounded-b-xl mt-6 z-10">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="text-base font-semibold text-slate-700 dark:text-slate-300">Promedio General</span>
                                                    <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                                                        {typeof evaluacionActual?.promedioGeneral === 'number' ? evaluacionActual.promedioGeneral.toFixed(1) : '—'}
                                                    </span>
                                                </div>

                                                {/* Sección de Retroalimentación con IA */}
                                                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Retroalimentación (IA)</h4>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleGenerarRetroalimentacion(st)}
                                                            disabled={generatingFeedback[st.id]}
                                                            className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-full font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                                        >
                                                            {generatingFeedback[st.id] ? (
                                                                <>
                                                                    <span className="animate-spin">✨</span> Generando...
                                                                </>
                                                            ) : (
                                                                <>✨ Generar Retroalimentación</>
                                                            )}
                                                        </button>
                                                    </div>
                                                    
                                                    {feedback[st.id] && (
                                                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 relative group dark:bg-indigo-900/20 dark:border-indigo-800">
                                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium mb-2">
                                                                {feedback[st.id]}
                                                            </p>
                                                            <div className="flex justify-end gap-2 mt-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveFeedback(st, feedback[st.id])}
                                                                    disabled={savingEval}
                                                                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                                                    Guardar
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => copyToClipboard(feedback[st.id])}
                                                                    className="bg-white shadow-sm border border-slate-200 p-1.5 rounded hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition-colors dark:bg-slate-800 dark:border-slate-700"
                                                                    title="Copiar al portapapeles"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {!feedback[st.id] && evaluacionActual?.retroalimentacion && (
                                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 relative group dark:bg-slate-800 dark:border-slate-700">
                                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                                                                {evaluacionActual.retroalimentacion}
                                                            </p>
                                                            <div className="absolute top-2 right-2 flex gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => copyToClipboard(evaluacionActual.retroalimentacion!)}
                                                                    className="bg-white shadow-sm border border-slate-200 p-1.5 rounded hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition-colors dark:bg-slate-800 dark:border-slate-700"
                                                                    title="Copiar"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-slate-500 bg-white rounded-lg border border-dashed border-slate-300">
                                            <p className="mb-2">No hay evaluación activa.</p>
                                            <p className="text-sm">Crea una nueva evaluación para comenzar el registro de la práctica.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-b-xl flex justify-end">
                                <button 
                                    onClick={() => setStudentToEvaluate(null)}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {view === 'saved-routes' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Rutas de Supervisión Guardadas</h2>
                        <button
                            onClick={handleExportConsolidadoPDF}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Consolidado Mensual (PDF)
                        </button>
                    </div>
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
                        <div className="relative flex items-center">
                            <UserIcon className="absolute left-3 w-5 h-5 text-slate-400" />
                            <select value={currentEmpresa.docenteSupervisor ? JSON.stringify(currentEmpresa.docenteSupervisor) : ''} onChange={e => { const value = e.target.value; handleFormChange('docenteSupervisor', value ? JSON.parse(value) : undefined); }} className="input-style pl-10 w-full">
                                <option value="">Sin supervisor asignado</option>
                                {profesores.map(profesor => (<option key={profesor.id} value={JSON.stringify({ id: profesor.id, nombreCompleto: profesor.nombreCompleto })}>{profesor.nombreCompleto}</option>))}
                            </select>
                        </div>
                        {/* Asignación de estudiantes */}
                        <div className="md:col-span-2 border rounded-lg p-4 bg-white dark:bg-slate-900">
                            <h3 className="text-lg font-semibold mb-3">Estudiantes asignados</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
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
                        <h3 className="text-lg font-semibold">Evaluación de la Empresa</ h3>
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
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-lg transition-colores"
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
