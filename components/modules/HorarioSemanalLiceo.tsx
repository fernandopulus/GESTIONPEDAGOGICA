import React, { useEffect, useMemo, useState } from 'react';
import { DIAS_SEMANA, HORARIO_BLOQUES, CURSOS, NIVELES } from '../../constants';
import type { HorariosGenerados, HorarioCelda } from '../../types';
import { subscribeToHorarios } from '../../src/firebaseHelpers/horariosHelper';

// Mapea nivel (1º Medio, 2º Medio, ...) a prefijo de curso (1º, 2º, ...)
const NIVEL_PREFIX: Record<string, string> = {
  '1º Medio': '1º',
  '2º Medio': '2º',
  '3º Medio': '3º',
  '4º Medio': '4º',
};

function getCursosPorNivel(nivel: string): string[] {
  const pref = NIVEL_PREFIX[nivel] || '';
  return CURSOS.filter(c => c.startsWith(pref));
}

export default function HorarioSemanalLiceo() {
  const [horarios, setHorarios] = useState<HorariosGenerados>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToHorarios((data) => {
      setHorarios(data || {});
      setLoading(false);
    });
    return () => unsub && unsub();
  }, []);

  const nivelesConCursos = useMemo(() => {
    return NIVELES.map(n => ({ nivel: n, cursos: getCursosPorNivel(n) }))
      .filter(x => x.cursos.length > 0);
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold">Horario semanal del liceo</h1>
        {loading && <span className="text-sm text-gray-500">Cargando…</span>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {DIAS_SEMANA.map(dia => (
          <section key={dia} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-slate-800/40">
              <h2 className="text-lg font-semibold">{dia}</h2>
            </header>

            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {nivelesConCursos.map(({ nivel, cursos }) => (
                <div key={nivel} className="p-3 md:p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-5 w-1.5 rounded bg-amber-500" />
                    <h3 className="text-base md:text-lg font-medium">{nivel}</h3>
                    <span className="ml-auto text-xs text-gray-500">{cursos.length} curso(s)</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600 dark:text-gray-300">
                          <th className="px-2 py-2 font-semibold sticky left-0 bg-white dark:bg-slate-900 z-10">BLOQUE</th>
                          <th className="px-2 py-2 font-semibold">INICIO</th>
                          <th className="px-2 py-2 font-semibold">FINAL</th>
                          {cursos.map(curso => (
                            <th key={curso} className="px-2 py-2 font-semibold whitespace-nowrap">
                              {curso}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {HORARIO_BLOQUES.map(b => {
                          const bloqueKey = String(b.bloque);
                          return (
                            <tr key={b.bloque} className="border-t border-gray-100 dark:border-gray-800 align-top">
                              <td className="px-2 py-2 font-medium sticky left-0 bg-white dark:bg-slate-900 z-10">{b.bloque}</td>
                              <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{b.inicio}</td>
                              <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{b.fin}</td>
                              {cursos.map(curso => {
                                const data: HorarioCelda | undefined = horarios?.[dia]?.[bloqueKey]?.[curso];
                                const asignatura = data?.asignatura || '';
                                const profesor = data?.profesor || '';
                                const hasContent = !!(asignatura || profesor);
                                return (
                                  <td key={curso} className={`px-2 py-2 ${hasContent ? 'bg-white dark:bg-slate-900' : 'bg-gray-50 dark:bg-slate-800/30'}`}>
                                    <div className="min-w-[9rem] md:min-w-[12rem] lg:min-w-[14rem] xl:min-w-[16rem]">
                                      <div className="font-medium leading-5 truncate" title={asignatura}>{asignatura || '—'}</div>
                                      <div className="text-xs text-gray-500 truncate" title={profesor}>{profesor}</div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
