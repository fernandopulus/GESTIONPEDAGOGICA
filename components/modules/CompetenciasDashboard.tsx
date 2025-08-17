
// src/components/modules/CompetenciasDashboard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, PieChart as PieIcon } from 'lucide-react';
import { EvaluacionRegistro } from '../../types/competencias';
import { subscribeEvaluacionesByRA } from '../../src/firebaseHelpers/competenciasHelper';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { utils, writeFile } from 'xlsx';

interface Props {
  raId?: string;
}

const COLORS = ['#6366F1','#22C55E','#F59E0B','#EF4444','#14B8A6','#8B5CF6','#F43F5E'];

const CompetenciasDashboard: React.FC<Props> = ({ raId }) => {
  const [items, setItems] = useState<(EvaluacionRegistro & {id:string})[]>([]);
  useEffect(() => {
    if (!raId) { setItems([]); return; }
    const unsub = subscribeEvaluacionesByRA(raId, setItems);
    return () => unsub();
  }, [raId]);

  if (!raId) return <div>Selecciona una RA para visualizar el dashboard.</div>;

  const porCurso = useMemo(() => {
    const map: Record<string, {curso: string; promedio: number; n: number}> = {};
    items.forEach(i => {
      const c = i.curso || '—';
      if (!map[c]) map[c] = {curso: c, promedio: 0, n: 0};
      map[c].promedio += i.nota;
      map[c].n += 1;
    });
    return Object.values(map).map(v => ({curso: v.curso, promedio: Number((v.promedio / (v.n||1)).toFixed(2)), n: v.n}));
  }, [items]);

  const distribucionNotas = useMemo(() => {
    const buckets = {'1.0-3.9':0, '4.0-4.9':0, '5.0-5.9':0, '6.0-7.0':0} as Record<string, number>;
    items.forEach(i => {
      if (i.nota < 4) buckets['1.0-3.9']++;
      else if (i.nota < 5) buckets['4.0-4.9']++;
      else if (i.nota < 6) buckets['5.0-5.9']++;
      else buckets['6.0-7.0']++;
    });
    return Object.entries(buckets).map(([rango, value]) => ({rango, value}));
  }, [items]);

  const exportCSV = () => {
    const rows = items.map(i => ({
      id: i.id,
      estudianteId: i.estudianteId,
      curso: i.curso,
      raId: i.raId,
      porcentaje: i.porcentaje,
      nota: i.nota,
      fecha: new Date(i.fecha).toISOString(),
      contexto: i.contexto
    }));
    const wb = utils.book_new();
    const ws = utils.json_to_sheet(rows);
    utils.book_append_sheet(wb, ws, 'Evaluaciones_RA');
    writeFile(wb, `evaluaciones_${raId}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-600"/>Resumen de logro por curso</h3>
        <button onClick={exportCSV} className="flex items-center gap-2 border rounded-xl px-3 py-2 hover:bg-slate-50">
          <Download className="w-4 h-4"/><span>Descargar CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-72 border rounded-xl p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porCurso}>
              <XAxis dataKey="curso"/>
              <YAxis domain={[1,7]}/>
              <Tooltip/>
              <Bar dataKey="promedio" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-72 border rounded-xl p-3">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={distribucionNotas} dataKey="value" nameKey="rango" outerRadius={90} label>
                {distribucionNotas.map((entry, index) => (
                  <Cell key={`c-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="text-xs text-slate-500">Nota: los promedios consideran la conversión lineal configurable (Decreto 67).</div>
    </div>
  );
};

export default CompetenciasDashboard;
