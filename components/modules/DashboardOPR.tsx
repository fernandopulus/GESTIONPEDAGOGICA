import React from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  Video,
  Users,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { CicloOPR } from '../../types';

interface DashboardOPRProps {
  ciclos: CicloOPR[];
}

const DashboardOPR: React.FC<DashboardOPRProps> = ({ ciclos }) => {
  // Estadísticas generales
  const totalCiclos = ciclos.length;
  const ciclosCompletados = ciclos.filter((c) => c.videoObservacionUrl && c.retroalimentacion.exito).length;
  const profesoresUnicos = new Set(ciclos.map((c) => c.docenteInfo)).size;
  const tiempoPromedioMin = ciclos.reduce((acc, c) => {
    if (!c.horaInicio || !c.horaTermino) return acc;
    const inicio = new Date(`2000/01/01 ${c.horaInicio}`);
    const fin = new Date(`2000/01/01 ${c.horaTermino}`);
    const diff = (fin.getTime() - inicio.getTime()) / (1000 * 60);
    return acc + diff;
  }, 0) / ciclos.length;

  // Ciclos por mes
  const ciclosPorMes = ciclos.reduce((acc, c) => {
    const mes = new Date(c.fecha).toLocaleDateString('es-ES', { month: 'long' });
    acc[mes] = (acc[mes] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Asignaturas más observadas
  const asignaturasPorFrecuencia = ciclos.reduce((acc, c) => {
    if (!c.asignaturaInfo) return acc;
    acc[c.asignaturaInfo] = (acc[c.asignaturaInfo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const asignaturasMasObservadas = Object.entries(asignaturasPorFrecuencia)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Ciclos</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalCiclos}</p>
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
                Ciclos Completados
              </h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{ciclosCompletados}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
              <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Docentes Observados
              </h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{profesoresUnicos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Tiempo Promedio
              </h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {Math.round(tiempoPromedioMin)} min
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
                      style={{ width: `${((cantidad as number) / totalCiclos) * 100}%` }}
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
            <Video className="w-5 h-5 text-amber-600" />
            Asignaturas Más Observadas
          </h3>
          <div className="space-y-2">
            {asignaturasMasObservadas.map(([asignatura, cantidad]) => (
              <div key={asignatura} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {asignatura}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">{cantidad}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-amber-600 dark:bg-amber-500 rounded-full"
                      style={{
                        width: `${((cantidad as number) / Math.max(...(Object.values(asignaturasPorFrecuencia) as number[]))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Estado de Ciclos */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          Estado de los Ciclos
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
              {ciclos.map((ciclo) => (
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
                    {ciclo.videoObservacionUrl && ciclo.retroalimentacion.exito ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                        <CheckCircle2 className="w-3 h-3" /> Completado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                        <AlertCircle className="w-3 h-3" /> Pendiente
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

export default DashboardOPR;
