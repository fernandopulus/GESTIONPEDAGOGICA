import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  ChevronDown,
  Info
} from 'lucide-react';

// Datos de ejemplo para la demostración
const datosEjemplo = [
  {
    id: '1',
    docente: 'Juan Pérez',
    asignatura: 'Matemáticas',
    funcionesLectivas: ['Coordinador departamento', 'Profesor jefe'],
    horasAsignadas: 30,
    cursos: {
      '1°A': 6,
      '1°B': 6,
      '2°A': 4,
      '3°C': 8,
      '4°A': 6
    },
    ha: 38,
    deltaHA: 0,
    hb: 6,
    deltaHB: 6,
    estado: 'correcto'
  },
  {
    id: '2',
    docente: 'María González',
    asignatura: 'Lenguaje',
    funcionesLectivas: ['Encargada biblioteca'],
    horasAsignadas: 24,
    cursos: {
      '1°C': 8,
      '2°B': 8,
      '3°A': 8
    },
    ha: 30,
    deltaHA: -6,
    hb: 14,
    deltaHB: 0,
    estado: 'advertencia'
  },
  {
    id: '3',
    docente: 'Pedro Sánchez',
    asignatura: 'Historia',
    funcionesLectivas: [],
    horasAsignadas: 42,
    cursos: {
      '2°C': 10,
      '3°B': 10,
      '3°C': 10,
      '4°B': 12
    },
    ha: 35,
    deltaHA: 7,
    hb: 0,
    deltaHB: -9,
    estado: 'error'
  }
];

// Lista de cursos disponibles
const cursos = [
  '1°A', '1°B', '1°C', '1°D', '1°E',
  '2°A', '2°B', '2°C', '2°D', '2°E',
  '3°A', '3°B', '3°C', '3°D', '3°E',
  '4°A', '4°B', '4°C', '4°D', '4°E'
];

// Lista de asignaturas
const asignaturas = [
  'Matemáticas',
  'Lenguaje',
  'Historia',
  'Ciencias',
  'Inglés',
  'Educación Física',
  'Artes Visuales',
  'Música',
  'Tecnología',
  'Filosofía'
];

// Lista de docentes
const docentes = [
  'Juan Pérez',
  'María González',
  'Pedro Sánchez',
  'Ana Martínez',
  'Luis Rodríguez',
  'Carmen Flores',
  'Miguel Torres',
  'Isabel Castro'
];

const AsignacionesCargaHoraria: React.FC = () => {
  const [datos, setDatos] = useState(datosEjemplo);
  const [cursoSeleccionado, setCursoSeleccionado] = useState<string | null>(null);

  // Manejadores de eventos
  const agregarFuncion = (id: string) => {
    // Aquí iría la lógica para agregar una nueva función lectiva
    console.log(`Agregar función para ${id}`);
  };

  const agregarAsignacion = () => {
    // Aquí iría la lógica para agregar una nueva asignación
    console.log('Agregar nueva asignación');
  };

  const eliminarAsignacion = (id: string) => {
    // Aquí iría la lógica para eliminar una asignación
    console.log(`Eliminar asignación ${id}`);
  };

  const asignarHorasCurso = (id: string, curso: string, horas: number) => {
    // Aquí iría la lógica para asignar horas a un curso
    console.log(`Asignar ${horas} horas al curso ${curso} para la asignación ${id}`);
  };

  // Renderizadores de componentes
  const renderEstadoIndicator = (estado: string) => {
    const colorClasses = {
      correcto: 'bg-emerald-500',
      advertencia: 'bg-amber-500',
      error: 'bg-rose-500'
    };

    return (
      <span className={`absolute left-3 top-5 h-3 w-3 rounded-full ${colorClasses[estado as keyof typeof colorClasses]}`}></span>
    );
  };

  const renderCursoChip = (curso: string, horas: number | undefined, id: string) => {
    const tieneHoras = horas && horas > 0;
    
    return (
      <button
        key={curso}
        onClick={() => asignarHorasCurso(id, curso, horas || 0)}
        className={`h-10 rounded-lg flex flex-col items-center justify-center transition-all
          ${tieneHoras 
            ? 'border border-sky-300 bg-sky-100 text-sky-700 hover:bg-sky-200' 
            : 'border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:shadow-[0_1px_0_#0000000d]'
          }
          ${cursoSeleccionado === curso ? 'ring-2 ring-sky-400' : ''}
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2
        `}
      >
        <span className="text-[10px] font-medium opacity-80">{curso}</span>
        {tieneHoras && <span className="text-[12px] font-semibold">{horas}</span>}
      </button>
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6 bg-white">
      {/* Encabezado con título y leyenda */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Asignaciones de Carga Horaria
        </h1>
        
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 mr-2 align-middle"></span>
            <span className="text-slate-700">Correcto</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-500 mr-2 align-middle"></span>
            <span className="text-slate-700">Advertencia</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block h-3 w-3 rounded-full bg-rose-500 mr-2 align-middle"></span>
            <span className="text-slate-700">Error</span>
          </div>
        </div>
      </div>
      
      {/* Encabezados de columnas */}
      <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 border-b border-slate-200">
        <div className="col-span-3 text-[11px] tracking-wider text-slate-500 font-medium uppercase">
          Docente
        </div>
        <div className="col-span-3 text-[11px] tracking-wider text-slate-500 font-medium uppercase">
          Asignatura
        </div>
        <div className="col-span-1 text-center text-[11px] tracking-wider text-slate-500 font-medium uppercase">
          Hrs
        </div>
        <div className="col-span-4 text-[11px] tracking-wider text-slate-500 font-medium uppercase">
          Cursos (Horas por curso)
        </div>
        <div className="col-span-1 text-center text-[11px] tracking-wider text-slate-500 font-medium uppercase">
          Acciones
        </div>
      </div>
      
      {/* Lista de asignaciones */}
      <div className="space-y-4">
        {datos.map((asignacion) => (
          <div key={asignacion.id} className="relative rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow p-4">
            {/* Indicador de estado */}
            {renderEstadoIndicator(asignacion.estado)}
            
            {/* Contenido responsivo */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pl-6 lg:pl-0">
              {/* Columna de Docente */}
              <div className="lg:col-span-3 space-y-2">
                <div className="block lg:hidden text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                  Docente
                </div>
                <div className="relative">
                  <select
                    defaultValue={asignacion.docente}
                    className="w-full h-10 appearance-none rounded-xl border border-slate-300 px-3 py-2 pr-8 text-[13px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  >
                    {docentes.map(doc => (
                      <option key={doc} value={doc}>{doc}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
              
              {/* Columna de Asignatura */}
              <div className="lg:col-span-3 space-y-2">
                <div className="block lg:hidden text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                  Asignatura
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <select
                      defaultValue={asignacion.asignatura}
                      className="w-full h-10 appearance-none rounded-xl border border-slate-300 px-3 py-2 pr-8 text-[13px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    >
                      {asignaturas.map(asig => (
                        <option key={asig} value={asig}>{asig}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                  
                  {/* Funciones lectivas */}
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-500">
                      Funciones lectivas
                    </div>
                    {asignacion.funcionesLectivas.map((funcion, index) => (
                      <div key={index} className="text-[12px] text-slate-700 pl-2">
                        • {funcion}
                      </div>
                    ))}
                    <button 
                      onClick={() => agregarFuncion(asignacion.id)}
                      className="text-sky-600 text-[12px] font-medium hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Columna de Horas */}
              <div className="lg:col-span-1 flex flex-col justify-center">
                <div className="block lg:hidden text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                  Hrs
                </div>
                <div className="text-lg font-semibold text-slate-900 text-center">
                  {asignacion.horasAsignadas}
                </div>
              </div>
              
              {/* Columna de Cursos */}
              <div className="lg:col-span-4 space-y-2">
                <div className="block lg:hidden text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                  Cursos (Horas por curso)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {cursos.slice(0, 8).map(curso => 
                    renderCursoChip(curso, asignacion.cursos[curso], asignacion.id)
                  )}
                </div>
              </div>
              
              {/* Columna de métricas y acciones */}
              <div className="lg:col-span-1 flex flex-col items-center justify-between gap-2">
                <div className="block lg:hidden text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                  Métricas y Acciones
                </div>
                
                {/* Métricas HA/HB */}
                <div className="text-center space-y-1 w-full">
                  <div className="text-[11px] text-slate-600">
                    HA: {asignacion.ha} 
                    <span className={`${
                      asignacion.deltaHA > 0 ? 'text-emerald-600' : 
                      asignacion.deltaHA < 0 ? 'text-rose-600' : 
                      'text-slate-500'
                    }`}>
                      {' '}({asignacion.deltaHA >= 0 ? '+' : ''}{asignacion.deltaHA})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    HB: {asignacion.hb}
                    <span className={`${
                      asignacion.deltaHB > 0 ? 'text-emerald-600' : 
                      asignacion.deltaHB < 0 ? 'text-rose-600' : 
                      'text-slate-500'
                    }`}>
                      {' '}({asignacion.deltaHB >= 0 ? '+' : ''}{asignacion.deltaHB})
                    </span>
                  </div>
                </div>
                
                {/* Acciones */}
                <div className="flex lg:flex-col items-center gap-2">
                  <button 
                    onClick={agregarAsignacion}
                    className="h-8 w-8 rounded-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-sky-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    aria-label="Agregar asignación"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => eliminarAsignacion(asignacion.id)}
                    className="h-8 w-8 rounded-full border border-rose-200 hover:bg-rose-50 flex items-center justify-center text-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    aria-label="Eliminar asignación"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Botón para agregar nueva asignación */}
      <div className="flex justify-center mt-6">
        <button 
          onClick={agregarAsignacion}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-100 text-sky-700 font-medium hover:bg-sky-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <Plus className="h-4 w-4" />
          <span>Agregar asignación</span>
        </button>
      </div>
      
      {/* Pie de página con información */}
      <div className="mt-8 p-4 border border-slate-200 rounded-xl bg-slate-50 text-[13px] text-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-slate-500" />
          <span className="font-medium">Acerca de las asignaciones</span>
        </div>
        <p className="ml-6">
          Las asignaciones de carga horaria se distribuyen según la normativa vigente, considerando un 65% para horas lectivas (HA) y un 35% para horas no lectivas (HB).
        </p>
      </div>
    </div>
  );
};

export default AsignacionesCargaHoraria;
