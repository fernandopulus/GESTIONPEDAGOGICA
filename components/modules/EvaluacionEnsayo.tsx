import React, { useEffect, useMemo, useState } from 'react';
import { User } from '../../types';
import { ASIGNATURAS, CURSOS } from '../../constants';
import { getAllUsers } from '../../src/firebaseHelpers/users';
import { guardarEvaluacionEnsayo } from '../../src/firebaseHelpers/evaluacionEnsayoHelper';
import { CheckCircle, Circle, User as UserIcon, Save, Loader2 } from 'lucide-react';

type Indicador = 1|2|3|4|5|6|7|8|9|10;

interface EstudianteItem {
  id: string;
  nombre: string;
}

interface Props {
  currentUser: User;
}

// Normaliza curso como en otros módulos
const normalizeCurso = (curso: string): string => {
  if (!curso) return '';
  let normalized = curso.trim().toLowerCase();
  normalized = normalized.replace(/°/g, 'º');
  normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
  normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
  normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
  normalized = normalized.replace(/\s+/g, '').toUpperCase();
  return normalized;
};

const INDICADORES: Indicador[] = [1,2,3,4,5,6,7,8,9,10];
const INDICADORES_DESCRIPCION: Record<Indicador, string> = {
  1: 'Llega puntualmente a la evaluación.',
  2: 'Sigue las instrucciones dadas por el/la docente respecto a su ubicación en la sala de clases.',
  3: 'Sigue las instrucciones dadas por el/la docente respecto al inicio de la evaluación.',
  4: 'Se mantiene en silencio mientras desarrolla la evaluación.',
  5: 'Mantiene su celular o cualquier equipo tecnológico en silencio y guardado.',
  6: 'Levanta la mano si requiere consultar alguna duda.',
  7: 'Espera en silencio mientras es atendido por el/la docente para resolver sus dudas.',
  8: 'Se observa que el/la estudiante realiza el esfuerzo por llevar a término satisfactorio su evaluación.',
  9: 'Respeta los tiempos considerados para realizar la evaluación y se mantiene en silencio una vez finalizada.',
  10: 'Entrega el instrumento de evaluación cuando se le solicita.',
};

const EvaluacionEnsayo: React.FC<Props> = ({ currentUser }) => {
  const [curso, setCurso] = useState<string>('');
  const [asignatura, setAsignatura] = useState<string>('Lengua y Literatura');
  const [profesorId, setProfesorId] = useState<string>('');
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [estudiantes, setEstudiantes] = useState<EstudianteItem[]>([]);
  // estado: por estudiante -> indicador -> boolean (true=7.0, false=2.0)
  const [marcas, setMarcas] = useState<Record<string, Record<Indicador, boolean>>>({});
  // ausentes por estudiante
  const [ausentes, setAusentes] = useState<Record<string, boolean>>({});

  // cargar usuarios
  useEffect(() => {
    setCargando(true);
    getAllUsers().then((list) => setUsuarios(list)).finally(() => setCargando(false));
  }, []);

  // profesores desde usuarios con profile PROFESORADO
  const profesores = useMemo(() => usuarios.filter(u => u.profile === 'PROFESORADO' || (u as any).profile ===  'PROFESORADO'), [usuarios]);

  // estudiantes por curso seleccionado
  useEffect(() => {
    const norm = normalizeCurso(curso);
    const est = usuarios.filter(u => (u.profile as any) === 'ESTUDIANTE' && normalizeCurso(u.curso || '') === norm)
      .map(u => ({ id: u.id, nombre: u.nombreCompleto }));
    setEstudiantes(est);
    // inicializar marcas en 7.0 (true)
    const init: Record<string, Record<Indicador, boolean>> = {};
    est.forEach(e => {
      init[e.id] = {} as any;
      INDICADORES.forEach(i => { init[e.id][i] = true; });
    });
    setMarcas(init);
    // limpiar ausentes al cambiar curso
    setAusentes({});
  }, [curso, usuarios]);

  const toggle = (estId: string, indicador: Indicador) => {
    setMarcas(prev => ({
      ...prev,
      [estId]: { ...prev[estId], [indicador]: !prev[estId]?.[indicador] }
    }));
  };

  const promedio = (estId: string): number => {
    if (ausentes[estId]) return 0;
    const m = marcas[estId];
    if (!m) return 0;
    const notas = INDICADORES.map(i => m[i] ? 7.0 : 2.0);
    const avg = notas.reduce((a,b)=>a+b,0)/INDICADORES.length;
    return Math.round(avg*10)/10; // 1 decimal
  };

  // Resumen de curso por indicador: porcentaje de 7.0 (on) y promedio en escala 1-7
  const resumenIndicadores = useMemo(() => {
    if (estudiantes.length === 0) return INDICADORES.map(i => ({ indicador: i, porcentajeOn: 0, promedio: 0 }));
    const presentes = estudiantes.filter(e => !ausentes[e.id]);
    if (presentes.length === 0) return INDICADORES.map(i => ({ indicador: i, porcentajeOn: 0, promedio: 0 }));
    return INDICADORES.map((i) => {
      const onCount = presentes.reduce((acc, e) => acc + (marcas[e.id]?.[i] ? 1 : 0), 0);
      const porcentajeOn = Math.round((onCount / presentes.length) * 100);
      const prom = presentes.reduce((acc, e) => acc + (marcas[e.id]?.[i] ? 7 : 2), 0) / presentes.length;
      return { indicador: i, porcentajeOn, promedio: Math.round(prom * 10) / 10 };
    });
  }, [estudiantes, marcas, ausentes]);

  const handleGuardar = async () => {
    if (!curso || !asignatura || !profesorId || estudiantes.length === 0) return;
    setGuardando(true);
    try {
      await guardarEvaluacionEnsayo({
        curso: normalizeCurso(curso),
        asignatura,
        profesorId,
        profesorNombre: usuarios.find(u=>u.id===profesorId)?.nombreCompleto || '',
        creadorId: currentUser.id,
        creadorNombre: currentUser.nombreCompleto,
        fecha: new Date().toISOString(),
        resultados: estudiantes.map(e => {
          const isAusente = !!ausentes[e.id];
          return {
            estudianteId: e.id,
            estudianteNombre: e.nombre,
            indicadores: INDICADORES.map(i => (marcas[e.id]?.[i] ? 7.0 : 2.0)),
            promedio: isAusente ? null : promedio(e.id),
            ausente: isAusente,
          };
        })
      });
      alert('Evaluación guardada');
    } catch (e) {
      console.error('Error guardando evaluación de ensayo', e);
      alert('No se pudo guardar. Reintenta.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera descriptiva de indicadores */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Indicadores evaluados</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {INDICADORES.map(i => (
            <div key={i} className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold shrink-0">{i}</span>
              <p className="text-slate-700 dark:text-slate-300">{INDICADORES_DESCRIPCION[i]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen gráfico por indicador */}
      {estudiantes.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Desempeño del curso por indicador</h3>
          <div className="space-y-2">
            {resumenIndicadores.map(r => (
              <div key={r.indicador} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-12 md:col-span-3 lg:col-span-2 text-xs text-slate-600 dark:text-slate-300">
                  {r.indicador}. {INDICADORES_DESCRIPCION[r.indicador]}
                </div>
                <div className="col-span-12 md:col-span-6 lg:col-span-7">
                  <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className="h-3 bg-emerald-500" style={{ width: `${r.porcentajeOn}%` }} />
                  </div>
                </div>
                <div className="col-span-12 md:col-span-3 lg:col-span-3 flex justify-between text-xs text-slate-700 dark:text-slate-200">
                  <span className="font-medium">{r.porcentajeOn}% con 7.0</span>
                  <span>Prom: {r.promedio.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Curso</label>
          <select value={curso} onChange={(e)=>setCurso(e.target.value)} className="w-full border rounded-md px-3 py-2">
            <option value="">Seleccione…</option>
            {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Asignatura</label>
          <select value={asignatura} onChange={(e)=>setAsignatura(e.target.value)} className="w-full border rounded-md px-3 py-2">
            {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Profesor responsable</label>
          <select value={profesorId} onChange={(e)=>setProfesorId(e.target.value)} className="w-full border rounded-md px-3 py-2">
            <option value="">Seleccione…</option>
            {profesores.map(p => <option key={p.id} value={p.id}>{p.nombreCompleto}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleGuardar} disabled={!curso || !asignatura || !profesorId || guardando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/40">
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Estudiante</th>
              {INDICADORES.map(i => (
                <th key={i} className="px-2 py-2 text-center text-xs font-semibold text-slate-500">{i}</th>
              ))}
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">Prom.</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={12} className="px-4 py-6 text-center text-slate-500">Cargando estudiantes…</td></tr>
            )}
            {!cargando && estudiantes.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-6 text-center text-slate-500">Seleccione curso para listar estudiantes.</td></tr>
            )}
            {estudiantes.map(e => (
              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50">
                <td className="px-4 py-2 text-sm whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2"><UserIcon className="w-4 h-4 text-slate-400" /> {e.nombre}</span>
                    <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <input type="checkbox" checked={!!ausentes[e.id]} onChange={(ev)=>setAusentes(prev=>({ ...prev, [e.id]: ev.target.checked }))} />
                      Ausente
                    </label>
                  </div>
                </td>
                {INDICADORES.map(i => {
                  const on = marcas[e.id]?.[i] ?? true;
                  return (
                    <td key={i} className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={()=>!ausentes[e.id] && toggle(e.id, i)}
                        disabled={!!ausentes[e.id]}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition ${ausentes[e.id] ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200' : on ? 'bg-green-100 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-600'}`}
                        title={ausentes[e.id] ? 'Ausente' : (on ? '7.0' : '2.0')}
                      >
                        {on ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-semibold text-slate-700">{ausentes[e.id] ? '—' : promedio(e.id).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EvaluacionEnsayo;
