import React from 'react';
import {
  BarChart3,
  Users,
  Video,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  BookOpen,
  Target,
  TrendingUp,
} from 'lucide-react';
import { AcompanamientoDocente, CicloOPR } from '../../types';

interface AcompanamientoDocenteDashboardProps {
  acompanamientos: AcompanamientoDocente[];
  ciclosOPR: Record<string, CicloOPR[]>;
  standaloneCiclos: CicloOPR[];
}

const AcompanamientoDocenteDashboard: React.FC<AcompanamientoDocenteDashboardProps> = ({
  acompanamientos,
  ciclosOPR,
  standaloneCiclos,
}) => {
  // Estadísticas generales
  const totalAcompanamientos = acompanamientos.length;
  const totalCiclosOPR = Object.values(ciclosOPR).reduce((acc: number, curr: CicloOPR[]) => acc + curr.length, 0) + standaloneCiclos.length;
  
  // Obtener todos los ciclos en un solo array
  const allCiclos = [
    ...Object.values(ciclosOPR).flat(),
    ...standaloneCiclos,
  ];

  // Docentes únicos
  const docentesUnicos = new Set([
    ...acompanamientos.map((a) => a.docente),
    ...allCiclos.map((c) => c.docenteInfo),
  ]).size;

  // Ciclos por mes
  const ciclosPorMes: Record<string, number> = allCiclos.reduce((acc, ciclo) => {
    const mes = new Date(ciclo.fecha).toLocaleDateString('es-ES', { month: 'long' });
    acc[mes] = (acc[mes] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Asignaturas más observadas
  const asignaturasPorFrecuencia = allCiclos.reduce((acc, ciclo) => {
    if (!ciclo.asignaturaInfo) return acc;
    acc[ciclo.asignaturaInfo] = (acc[ciclo.asignaturaInfo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const asignaturasMasObservadas = Object.entries(asignaturasPorFrecuencia)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

  // Promedio de tiempo por observación
  const tiempoPromedioMin = allCiclos.reduce((acc, c) => {
    if (!c.horaInicio || !c.horaTermino) return acc;
    const inicio = new Date('2000/01/01 ' + c.horaInicio);
    const fin = new Date('2000/01/01 ' + c.horaTermino);
    const diff = (fin.getTime() - inicio.getTime()) / (1000 * 60);
    return acc + diff;
  }, 0) / allCiclos.length;

  // Estado de retroalimentación
  const retroalimentacionCompleta = allCiclos.filter(
    (c) => c.retroalimentacion?.exito && c.retroalimentacion?.modelo && c.retroalimentacion?.foco
  ).length;

  return (
    <div className="space-y-6">
      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Acompañamientos
              </h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalAcompanamientos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
              <Video className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Ciclos OPR</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalCiclosOPR}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Docentes Observados
              </h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{docentesUnicos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Retroalimentación Completa
              </h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {retroalimentacionCompleta}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ciclos por Mes */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Ciclos por Mes
          </h3>
          <div className="space-y-2">
            {Object.entries(ciclosPorMes).map(([mes, cantidad]) => (
              <div key={mes} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                      {mes}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">{cantidad}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-indigo-600 dark:bg-indigo-500 rounded-full"
                      style={{
                        width: `${(cantidad / totalCiclosOPR) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Asignaturas Más Observadas */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            Asignaturas Más Observadas
          </h3>
          <div className="space-y-2">
            {asignaturasMasObservadas.map(([asignatura, cantidad]) => (
              <div key={asignatura} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{asignatura}</span>
                    <span className="text-slate-600 dark:text-slate-400">{cantidad}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-amber-600 dark:bg-amber-500 rounded-full"
                      style={{
                        width: `${
                          ((cantidad as number) / Math.max(...(Object.values(asignaturasPorFrecuencia) as number[]))) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de Últimos Ciclos */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Últimos Ciclos OPR
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Docente
                </th>
                <th className="text-left py-2 px-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Fecha
                </th>
                <th className="text-left py-2 px-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Asignatura
                </th>
                <th className="text-left py-2 px-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {allCiclos
                .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                .slice(0, 5)
                .map((ciclo) => (
                  <tr key={ciclo.id} className="border-t dark:border-slate-700">
                    <td className="py-2 px-3 text-sm text-slate-900 dark:text-slate-300">
                      {ciclo.docenteInfo}
                    </td>
                    <td className="py-2 px-3 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(ciclo.fecha).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3 text-sm text-slate-600 dark:text-slate-400">
                      {ciclo.asignaturaInfo}
                    </td>
                    <td className="py-2 px-3">
                      {ciclo.retroalimentacion?.exito ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                          <CheckCircle2 className="w-3 h-3" /> Completado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                          <Target className="w-3 h-3" /> En proceso
                        </span>
                      )}
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

export default AcompanamientoDocenteDashboard;
