import React, { useMemo, useState } from 'react';
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
import { generarConIA } from '@/ai/geminiHelper';
import UltraSafeRenderer from '../common/UltraSafeRenderer';

interface DashboardOPRProps {
  ciclos: CicloOPR[];
}

const DashboardOPR: React.FC<DashboardOPRProps> = ({ ciclos }) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRaw, setAiRaw] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<null | {
    resumenGeneral?: string;
    riesgos?: string[];
    tendencias?: string[];
    focosRecomendados?: { foco: string; justificativo?: string }[];
    proximosPasos?: string[];
    indicadores?: { nombre: string; valor: string | number }[];
  }>(null);

  // Utils locales
  const safeJSON = (text: string): any | null => {
    if (!text) return null;
    try {
      let t = text.trim();
      // Extraer bloque JSON si viene en ```json
      const fenceMatch = t.match(/```json([\s\S]*?)```/i) || t.match(/```([\s\S]*?)```/i);
      if (fenceMatch && fenceMatch[1]) t = fenceMatch[1];
      // Quitar posibles prefijos o sufijos de texto
      const start = t.indexOf('{');
      const end = t.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        t = t.slice(start, end + 1);
      }
      return JSON.parse(t);
    } catch {
      return null;
    }
  };

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

  const detallesBrechas = useMemo(() => {
    return ciclos
      .map(c => ({
        fecha: c.fecha,
        docente: c.docenteInfo,
        asignatura: c.asignaturaInfo,
        foco: c.retroalimentacion?.foco,
        exito: c.retroalimentacion?.exito,
        brecha: c.retroalimentacion?.brecha
      }))
      .filter(x => x.foco || x.brecha || x.exito);
  }, [ciclos]);

  const buildPrompt = (): string => {
    const meses = Object.entries(ciclosPorMes).map(([m, n]) => `${m}: ${n}`).join(', ');
    const asigs = asignaturasMasObservadas.map(([a, n]) => `${a} (${n})`).join(', ');
    const tasa = totalCiclos ? Math.round((ciclosCompletados / totalCiclos) * 100) : 0;
    const muestras = detallesBrechas.slice(0, 12).map(d => (
      `- ${new Date(d.fecha).toLocaleDateString()} | Docente: ${d.docente} | Asig.: ${d.asignatura}
         Exitos: ${d.exito || '-'}
         Foco: ${d.foco || '-'}
         Brecha: ${d.brecha ? `min ${d.brecha.minutoInicial || '?'}-${d.brecha.minutoFinal || '?'} | preguntas: ${d.brecha.preguntas || '-'} | indicadores: ${d.brecha.indicadores || '-'}` : '-'}`
    )).join('\n');

    return `Eres un asesor pedagógico experto en OPR. Analiza los siguientes datos agregados de ciclos de observación y retroalimentación y devuelve un JSON con insights accionables para Subdirección.

DATOS RESUMEN:
- Total de ciclos: ${totalCiclos}
- Ciclos completados: ${ciclosCompletados} (tasa: ${tasa}%)
- Docentes únicos observados: ${profesoresUnicos}
- Tiempo promedio de observación (min): ${isFinite(tiempoPromedioMin) ? Math.round(tiempoPromedioMin) : 0}
- Distribución por mes: ${meses || 'sin datos'}
- Asignaturas más observadas (top 5): ${asigs || 'sin datos'}

MUESTRAS DE FOCO/ÉXITO/BRECHAS (máx. 12):
${muestras || '(no hay muestras)'}

DEVUELVE SOLO JSON (sin comentarios) con este esquema:
{
  "resumenGeneral": "string",
  "tendencias": ["string"],
  "riesgos": ["string"],
  "focosRecomendados": [
    { "foco": "string", "justificativo": "string opcional" }
  ],
  "proximosPasos": ["string"],
  "indicadores": [ { "nombre": "string", "valor": "string|number" } ]
}
`;
  };

  const runAI = async () => {
    if (!totalCiclos) return;
    setAiLoading(true);
    setAiError(null);
    setAiInsights(null);
    setAiRaw(null);
    try {
      const prompt = buildPrompt();
      const resp = await generarConIA(prompt, 1, true);
      const json = safeJSON(resp);
      if (json) {
        setAiInsights(json);
      } else {
        setAiRaw(resp);
      }
    } catch (e: any) {
      setAiError(e?.message || 'No se pudo obtener el análisis con IA.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Asistente IA del Ciclo OPR */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Asistente IA del Ciclo OPR
          </h3>
          <button
            onClick={runAI}
            disabled={aiLoading || totalCiclos === 0}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border ${aiLoading || totalCiclos === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700'} border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200`}
            title={totalCiclos === 0 ? 'No hay ciclos para analizar' : 'Generar análisis con IA'}
          >
            {aiLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
                Generando...
              </>
            ) : (
              <>Generar análisis</>
            )}
          </button>
        </div>
        {aiError && (
          <div className="text-sm text-red-600 dark:text-red-400">{aiError}</div>
        )}
        {!aiError && (aiInsights || aiRaw) && (
          <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {aiInsights ? (
              <>
                <div className="space-y-3">
                  {aiInsights.resumenGeneral && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Resumen</h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{aiInsights.resumenGeneral}</p>
                    </div>
                  )}
                  {aiInsights.tendencias?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tendencias</h4>
                      <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
                        {aiInsights.tendencias.map((t, i) => (<li key={i}>{t}</li>))}
                      </ul>
                    </div>
                  ) : null}
                  {aiInsights.riesgos?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Riesgos</h4>
                      <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
                        {aiInsights.riesgos.map((t, i) => (<li key={i}>{t}</li>))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {aiInsights.focosRecomendados?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Focos recomendados</h4>
                      <ul className="space-y-2">
                        {aiInsights.focosRecomendados.map((f, i) => (
                          <li key={i} className="text-sm text-slate-700 dark:text-slate-300">
                            <span className="font-medium">{f.foco}</span>
                            {f.justificativo ? <span className="block text-slate-600 dark:text-slate-400">{f.justificativo}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {aiInsights.proximosPasos?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Próximos pasos</h4>
                      <ol className="list-decimal pl-5 text-sm text-slate-700 dark:text-slate-300">
                        {aiInsights.proximosPasos.map((p, i) => (<li key={i}>{p}</li>))}
                      </ol>
                    </div>
                  ) : null}
                  {aiInsights.indicadores?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Indicadores</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {aiInsights.indicadores.map((ind, i) => (
                          <div key={i} className="px-3 py-2 rounded border dark:border-slate-700 text-sm">
                            <div className="text-slate-500 dark:text-slate-400">{ind.nombre}</div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{String(ind.valor)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="col-span-2 text-sm text-slate-700 dark:text-slate-300">
                <UltraSafeRenderer content={aiRaw} context="dashboard-opr-ai" />
              </div>
            )}
          </div>
        )}
        {!aiError && !aiInsights && !aiRaw && (
          <p className="text-sm text-slate-600 dark:text-slate-400">Genera un análisis para obtener tendencias, focos y próximos pasos basados en los ciclos registrados.</p>
        )}
      </div>
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
