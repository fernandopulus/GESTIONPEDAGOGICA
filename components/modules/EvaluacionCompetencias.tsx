
// src/components/modules/EvaluacionCompetencias.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Target, Ruler, Upload, BarChart3, CheckCircle2, Settings, Layers } from 'lucide-react';
import { 
  EspecialidadTP, ModuloTP, ResultadoAprendizaje, CriterioEvaluacion, NivelLogroCompetencias, Rubrica, Evidencia, EvaluacionRegistro
} from '../../types';
import {
  subscribeEspecialidades, getModulosByEspecialidad, getRAByModulo, getCEByRA,
  getRubricaByRA, saveRubrica, saveEvaluacion, uploadEvidencia, saveEvidencia,
  subscribeEvidenciasByRA, setConfigEvaluacion,
  createEspecialidad, createModulo, createRA, createCE
} from '../../src/firebaseHelpers/competenciasHelper';
import { NIVEL_LOGRO_VALUES, CONTEXTOS } from '../../constants/competenciasConstants';
import RubricaEditor from './RubricaEditor';
import EvidenciasUploader from './EvidenciasUploader';
import CompetenciasDashboard from './CompetenciasDashboard';

type View = 'planificacion' | 'evaluar' | 'evidencias' | 'dashboard' | 'config';

interface Props {
  currentUser: { id: string; displayName: string; role?: string; curso?: string };
}

const Pill: React.FC<{active?: boolean; onClick: ()=>void; icon: React.ReactNode; label: string;}> = ({active, onClick, icon, label}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 rounded-full transition 
    ${active ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-700 hover:bg-slate-100 border'}`
    }
  >
    {icon}<span className="font-medium">{label}</span>
  </button>
);

const Card: React.FC<{children: React.ReactNode; className?: string;}> = ({children, className}) => (
  <div className={`bg-white rounded-2xl shadow-sm border p-4 ${className||''}`}>{children}</div>
)

const EvaluacionCompetencias: React.FC<Props> = ({ currentUser }) => {
  const [view, setView] = useState<View>('planificacion');
  const [especialidades, setEspecialidades] = useState<EspecialidadTP[]>([]);
  const [modulos, setModulos] = useState<ModuloTP[]>([]);
  const [ras, setRas] = useState<ResultadoAprendizaje[]>([]);
  const [ces, setCes] = useState<CriterioEvaluacion[]>([]);
  const [selected, setSelected] = useState<{especialidadId?: string; moduloId?: string; raId?: string}>({});
  const [rubrica, setRubrica] = useState<Rubrica | null>(null);
  const [evidencias, setEvidencias] = useState<(Evidencia & {id:string})[]>([]);
  const [nivelAutomotriz, setNivelAutomotriz] = useState<'3' | '4' | ''>('');

  // Helpers de normalización y listas de módulos por especialidad/nivel
  const normalize = (s?: string) => (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  const PTN_AUTOMOTRIZ = 'automotriz';
  const PTN_INDUSTRIAL = 'industrial';

  const automotriz3 = useMemo(() => new Set([
    'modulo 01 – ajuste de motores.',
    'modulo 01 - ajuste de motores.',
    'modulo 01 ajuste de motores.',
    'modulo 02 – lectura de planos y manuales tecnicos.',
    'modulo 03 – manejo de residuos y desechos automotrices.',
    'modulo 04 – mantenimiento de sistemas de seguridad y confortabilidad.',
    'modulo 05 – mantenimiento de sistemas electricos y electronicos.'
  ].map(normalize)), []);

  const automotriz4 = useMemo(() => new Set([
    'modulo 00 – emprendimiento y empleabilidad (mecanica automotriz).',
    'modulo 06 – mantenimiento de motores.',
    'modulo 07 – mantenimiento de sistemas hidraulicos y neumaticos.',
    'modulo 08 – mantenimiento de los sistemas de transmision y frenos.',
    'modulo 09 – mantenimiento de sistemas de direccion y suspension.'
  ].map(normalize)), []);

  const industrialAll = useMemo(() => new Set([
    'modulo 01 – soldadura industrial.',
    'modulo 02 – mantenimiento de herramientas.',
    'modulo 03 – medicion y verificacion.',
    'modulo 04 – mecanica de banco.',
    'modulo 05 – lectura de manuales y planos.',
    'modulo 06 – emprendimiento y empleabilidad (mencion maquinas-herramientas).',
    'modulo 07 – torneado de piezas y conjuntos mecanicos.',
    'modulo 08 – fresado de piezas y conjuntos mecanicos.',
    'modulo 09 – taladrado y rectificado de piezas mecanicas.',
    'modulo 10 – mecanizado con maquinas de control numerico computacional (cnc).'
  ].map(normalize)), []);

  // Módulos marcados como "Currículum Nacional" (Automotriz)
  const cnAutomotriz = useMemo(() => new Set([
    // 3º medio
    'modulo 03 – manejo de residuos y desechos automotrices.',
    'modulo 03 - manejo de residuos y desechos automotrices.',
    // 4º medio
    'modulo 06 – mantenimiento de motores.',
    'modulo 06 - mantenimiento de motores.'
  ].map(normalize)), []);

  // Suscripciones
  useEffect(() => {
    const unsub = subscribeEspecialidades(setEspecialidades);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selected.especialidadId) {
      getModulosByEspecialidad(selected.especialidadId).then(setModulos);
    } else {
      setModulos([]);
    }
    setSelected(prev => ({...prev, moduloId: undefined, raId: undefined}));
    setRas([]);
    setCes([]);
    setRubrica(null);
  }, [selected.especialidadId]);

  // Al seleccionar Automotriz, auto-seleccionar 3º medio como predeterminado
  useEffect(() => {
    const found = especialidades.find(e => e.id === selected.especialidadId);
    const name = normalize(found?.nombre);
    if (name.includes(PTN_AUTOMOTRIZ)) {
      setNivelAutomotriz(prev => (prev === '' ? '3' : prev));
    } else {
      setNivelAutomotriz('');
    }
  }, [selected.especialidadId, especialidades]);

  useEffect(() => {
    if (selected.moduloId) {
      getRAByModulo(selected.moduloId).then(setRas);
    } else {
      setRas([]);
    }
    setSelected(prev => ({...prev, raId: undefined}));
    setCes([]);
    setRubrica(null);
  }, [selected.moduloId]);

  useEffect(() => {
    if (selected.raId) {
      getCEByRA(selected.raId).then(setCes);
      getRubricaByRA(selected.raId).then(setRubrica);
      const unsub = subscribeEvidenciasByRA(selected.raId, setEvidencias);
      return () => unsub();
    } else {
      setCes([]);
      setRubrica(null);
      setEvidencias([]);
    }
  }, [selected.raId]);

  const canEvaluate = selected.raId && ces.length > 0;

  // Especialidades filtradas (Automotriz/Industrial) con fallback para no dejar vacío
  const { especialidadesFiltradas, espFiltroFallback } = useMemo(() => {
    if (!especialidades?.length) return { especialidadesFiltradas: [] as EspecialidadTP[], espFiltroFallback: false };
    const list = especialidades.filter(e => {
      const n = normalize(e.nombre);
      return n.includes(PTN_AUTOMOTRIZ) || n.includes(PTN_INDUSTRIAL);
    });
    if (list.length === 0) {
      return { especialidadesFiltradas: especialidades, espFiltroFallback: true };
    }
    return { especialidadesFiltradas: list, espFiltroFallback: false };
  }, [especialidades]);

  const selectedEspecialidadNombre = useMemo(() => {
    const found = especialidades.find(e => e.id === selected.especialidadId);
    return normalize(found?.nombre);
  }, [especialidades, selected.especialidadId]);

  // Modulos filtrados según especialidad y (si aplica) nivel Automotriz
  const { modulosFiltrados, filtroFallback } = useMemo(() => {
    let fallback = false;
    if (!modulos?.length) return { modulosFiltrados: [] as ModuloTP[], filtroFallback: false };
    if (selectedEspecialidadNombre.includes(PTN_AUTOMOTRIZ)) {
      if (!nivelAutomotriz) return { modulosFiltrados: [] as ModuloTP[], filtroFallback: false };
      const targetSet = nivelAutomotriz === '3' ? automotriz3 : automotriz4;
      const filtered = modulos.filter(m => targetSet.has(normalize(m.nombre)));
      if (filtered.length === 0) {
        fallback = true;
        return { modulosFiltrados: modulos, filtroFallback: fallback };
      }
      return { modulosFiltrados: filtered, filtroFallback: fallback };
    }
    if (selectedEspecialidadNombre.includes(PTN_INDUSTRIAL)) {
      const filtered = modulos.filter(m => industrialAll.has(normalize(m.nombre)));
      if (filtered.length === 0 && modulos.length > 0) {
        fallback = true;
        return { modulosFiltrados: modulos, filtroFallback: fallback };
      }
      return { modulosFiltrados: filtered, filtroFallback: fallback };
    }
    return { modulosFiltrados: modulos, filtroFallback: fallback };
  }, [modulos, selectedEspecialidadNombre, nivelAutomotriz, automotriz3, automotriz4, industrialAll]);

  return (
    <div className="w-full min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-semibold text-slate-800">Evaluación por Competencias EMTP</h1>
          </div>
          <div className="flex items-center gap-2">
            <Pill active={view==='planificacion'} onClick={()=>setView('planificacion')} icon={<ClipboardList className="w-4 h-4" />} label="Planificar" />
            <Pill active={view==='evaluar'} onClick={()=>setView('evaluar')} icon={<Ruler className="w-4 h-4" />} label="Evaluar" />
            <Pill active={view==='evidencias'} onClick={()=>setView('evidencias')} icon={<Upload className="w-4 h-4" />} label="Evidencias" />
            <Pill active={view==='dashboard'} onClick={()=>setView('dashboard')} icon={<BarChart3 className="w-4 h-4" />} label="Dashboard" />
            <Pill active={view==='config'} onClick={()=>setView('config')} icon={<Settings className="w-4 h-4" />} label="Config" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Card>
          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-slate-500">Especialidad</label>
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={selected.especialidadId || ''}
                onChange={(e)=>setSelected({especialidadId: e.target.value})}
              >
                <option value="">— Selecciona —</option>
                {especialidadesFiltradas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              {espFiltroFallback && (
                <p className="mt-1 text-xs text-amber-600">
                  Mostrando todas las especialidades por falta de coincidencia exacta con los nombres esperados (Automotriz/Industrial).
                </p>
              )}
            </div>
            {selectedEspecialidadNombre.includes(PTN_AUTOMOTRIZ) && (
              <div>
                <label className="text-sm text-slate-500">Curso (Automotriz)</label>
                <select
                  className="mt-1 w-full border rounded-xl px-3 py-2"
                  value={nivelAutomotriz}
                  onChange={(e)=>{
                    setNivelAutomotriz(e.target.value as '3'|'4'|'');
                    // Al cambiar de nivel, limpiar módulo y RA
                    setSelected(prev => ({...prev, moduloId: undefined, raId: undefined}));
                  }}
                >
                  <option value="">— Selecciona —</option>
                  <option value="3">3º medio</option>
                  <option value="4">4º medio TP</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-500">Módulo</label>
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={selected.moduloId || ''}
                onChange={(e)=>setSelected(prev=>({...prev, moduloId: e.target.value}))}
              >
                <option value="">— Selecciona —</option>
                {modulosFiltrados.map(m => {
                  const isCN = selectedEspecialidadNombre.includes(PTN_AUTOMOTRIZ) && cnAutomotriz.has(normalize(m.nombre));
                  const label = isCN ? `${m.nombre} — Currículum Nacional` : m.nombre;
                  return <option key={m.id} value={m.id}>{label}</option>;
                })}
              </select>
              {filtroFallback && (
                <p className="mt-1 text-xs text-amber-600">
                  Mostrando todos los módulos de la especialidad por falta de coincidencia exacta con la lista. Podemos alinear los nombres en Firestore para filtrar con precisión.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-slate-500">Resultado de Aprendizaje (RA)</label>
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={selected.raId || ''}
                onChange={(e)=>setSelected(prev=>({...prev, raId: e.target.value}))}
              >
                <option value="">— Selecciona —</option>
                {ras.map(r => <option key={r.id} value={r.id}>{r.codigo} — {r.enunciado.slice(0,60)}{r.enunciado.length>60?'…':''}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {view === 'planificacion' && (
          <Card>
            <RubricaEditor
              raId={selected.raId}
              ces={ces}
              rubrica={rubrica}
              onSaved={(id)=>{ /* noop */ }}
              currentUserId={currentUser.id}
            />
          </Card>
        )}

        {view === 'evaluar' && (
          <Card>
            {!canEvaluate && (
              <div className="text-slate-600">Selecciona una RA con criterios (CE) para comenzar a evaluar.</div>
            )}
            {canEvaluate && (
              <EvaluarForm raId={selected.raId!} ces={ces} currentUser={currentUser}/>
            )}
          </Card>
        )}

        {view === 'evidencias' && (
          <Card>
            <EvidenciasUploader raId={selected.raId} currentUser={currentUser} evidencias={evidencias}/>
          </Card>
        )}

        {view === 'dashboard' && (
          <Card>
            <CompetenciasDashboard raId={selected.raId}/>
          </Card>
        )}

        {view === 'config' && (
          <Card>
            <ConfigEvaluacionForm />
            <div className="mt-6 border-t pt-4">
              <SeedDatosBase
                especialidades={especialidades}
                normalize={normalize}
                onSeeded={async ()=>{
                  // Tras sembrar, refrescar listas
                  if (selected.especialidadId) {
                    const mods = await getModulosByEspecialidad(selected.especialidadId);
                    setModulos(mods);
                  }
                }}
              />
              <div className="mt-4">
                <SeedRAAutomotriz
                  getModuloByName={(nombre) => modulos.find(m => normalize(m.nombre) === normalize(nombre))}
                />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

const EvaluarForm: React.FC<{
  raId: string;
  ces: CriterioEvaluacion[];
  currentUser: { id: string; displayName: string; curso?: string };
}> = ({ raId, ces, currentUser }) => {
  const [estudianteId, setEstudianteId] = useState('');
  const [curso, setCurso] = useState(currentUser.curso || '');
  const [contexto, setContexto] = useState<'AULA'|'TALLER'|'EMPRESA'>('AULA');
  const [retro, setRetro] = useState('');
  const [scores, setScores] = useState<Record<string, {nivel: NivelLogroCompetencias; puntaje: number}>>({});

  const onChangeNivel = (ceId: string, nivel: NivelLogroCompetencias, puntajeBase: number) => {
    setScores(prev => ({...prev, [ceId]: {nivel, puntaje: puntajeBase}}));
  };

  const canSave = estudianteId && Object.keys(scores).length === ces.length;

  const handleSave = async () => {
    const payload = {
      estudianteId,
      curso,
      raId,
      ceIdScores: scores,
      evaluadorId: currentUser.id,
      fecha: Date.now(),
      contexto,
      retroalimentacion: retro,
    } as any;
    await saveEvaluacion(payload);
    setRetro('');
    setScores({});
    setEstudianteId('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="text-sm text-slate-500">Estudiante (ID)</label>
          <input className="mt-1 w-full border rounded-xl px-3 py-2" value={estudianteId} onChange={e=>setEstudianteId(e.target.value)} placeholder="rut_o_uid" />
        </div>
        <div>
          <label className="text-sm text-slate-500">Curso</label>
          <input className="mt-1 w-full border rounded-xl px-3 py-2" value={curso} onChange={e=>setCurso(e.target.value)} placeholder="p.ej. 3ºB" />
        </div>
        <div>
          <label className="text-sm text-slate-500">Contexto</label>
          <select className="mt-1 w-full border rounded-xl px-3 py-2" value={contexto} onChange={(e)=>setContexto(e.target.value as any)}>
            {CONTEXTOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button disabled={!canSave} onClick={handleSave}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 transition ${canSave? 'bg-emerald-600 hover:bg-emerald-700 text-white':'bg-slate-200 text-slate-500 cursor-not-allowed'}`}>
            <CheckCircle2 className="w-4 h-4"/><span>Guardar evaluación</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ces.map(ce => (
          <div key={ce.id} className="border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-800">{ce.codigo} — {ce.descriptor}</h4>
              <span className="text-xs text-slate-500">Peso {ce.peso}%</span>
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {NIVEL_LOGRO_VALUES.map(nv => (
                <button key={nv}
                  onClick={()=>onChangeNivel(ce.id, nv, nv==='SOBRESALIENTE'?100:nv==='LOGRADO'?75:nv==='EN_DESARROLLO'?50:25)}
                  className={`px-3 py-2 rounded-lg border text-sm ${scores[ce.id]?.nivel===nv ? 'bg-indigo-600 text-white':'bg-white hover:bg-slate-50'}`}
                >
                  {nv.replace('_',' ')}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="text-sm text-slate-500">Retroalimentación formativa</label>
        <textarea value={retro} onChange={e=>setRetro(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" rows={3} placeholder="Sugerencias específicas para mejorar..." />
      </div>
    </div>
  );
};

const ConfigEvaluacionForm: React.FC = () => {
  const [porcAprob, setPorcAprob] = useState(60);
  const [notaAprob, setNotaAprob] = useState(4.0);

  const onSave = async () => {
    await setConfigEvaluacion({ porcentajeAprobacion: porcAprob, notaAprobacion: notaAprob });
  };

  return (
    <div className="flex items-center gap-4">
      <div>
        <label className="text-sm text-slate-500">Porcentaje de aprobación (%)</label>
        <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" value={porcAprob} onChange={(e)=>setPorcAprob(Number(e.target.value))}/>
      </div>
      <div>
        <label className="text-sm text-slate-500">Nota de aprobación</label>
        <input type="number" step="0.1" className="mt-1 w-full border rounded-xl px-3 py-2" value={notaAprob} onChange={(e)=>setNotaAprob(Number(e.target.value))}/>
      </div>
      <button onClick={onSave} className="self-end bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2">Guardar</button>
    </div>
  );
};

export default EvaluacionCompetencias;

// --- Utilidad para sembrar datos base de especialidades/módulos ---
const SeedDatosBase: React.FC<{
  especialidades: EspecialidadTP[];
  normalize: (s?: string)=>string;
  onSeeded: ()=>Promise<void>;
}> = ({ especialidades, normalize, onSeeded }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const handleSeed = async () => {
    setBusy(true);
    setMsg('Sembrando especialidades y módulos base…');
    try {
      // Buscar si existen ya
      const findBy = (name: string) => especialidades.find(e => normalize(e.nombre) === normalize(name));
      let espAuto = findBy('Mecánica Automotriz');
      let espInd  = findBy('Mecánica Industrial');

      if (!espAuto) {
        const ref = await createEspecialidad({ nombre: 'Mecánica Automotriz' });
        espAuto = { id: ref.id, nombre: 'Mecánica Automotriz' } as any;
      }
      if (!espInd) {
        const ref = await createEspecialidad({ nombre: 'Mecánica Industrial' });
        espInd = { id: ref.id, nombre: 'Mecánica Industrial' } as any;
      }

      // Sembrar módulos Automotriz (3º y 4º)
      const modAuto = [
        'Módulo 01 – Ajuste de motores.',
        'Módulo 02 – Lectura de planos y manuales técnicos.',
        'Módulo 03 – Manejo de residuos y desechos automotrices.',
        'Módulo 04 – Mantenimiento de sistemas de seguridad y confortabilidad.',
        'Módulo 05 – Mantenimiento de sistemas eléctricos y electrónicos.',
        'Módulo 00 – Emprendimiento y empleabilidad (mecánica automotriz).',
        'Módulo 06 – Mantenimiento de motores.',
        'Módulo 07 – Mantenimiento de sistemas hidráulicos y neumáticos.',
        'Módulo 08 – Mantenimiento de los sistemas de transmisión y frenos.',
        'Módulo 09 – Mantenimiento de sistemas de dirección y suspensión.'
      ];

      // Sembrar módulos Industrial
      const modInd = [
        'Módulo 01 – Soldadura industrial.',
        'Módulo 02 – Mantenimiento de herramientas.',
        'Módulo 03 – Medición y verificación.',
        'Módulo 04 – Mecánica de banco.',
        'Módulo 05 – Lectura de manuales y planos.',
        'Módulo 06 – Emprendimiento y empleabilidad (mención Máquinas-Herramientas).',
        'Módulo 07 – Torneado de piezas y conjuntos mecánicos.',
        'Módulo 08 – Fresado de piezas y conjuntos mecánicos.',
        'Módulo 09 – Taladrado y rectificado de piezas mecánicas.',
        'Módulo 10 – Mecanizado con máquinas de control numérico computacional (CNC).'
      ];

      // Insertar módulos
      for (const nombre of modAuto) {
        await createModulo({ nombre, especialidadId: espAuto!.id });
      }
      for (const nombre of modInd) {
        await createModulo({ nombre, especialidadId: espInd!.id });
      }

      setMsg('Datos base sembrados correctamente. Actualiza los selectores para verlos.');
      await onSeeded();
    } catch (e: any) {
      console.error(e);
      setMsg(`Error al sembrar: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <button
          disabled={busy}
          onClick={handleSeed}
          className={`px-4 py-2 rounded-xl text-white ${busy? 'bg-slate-400':'bg-amber-600 hover:bg-amber-700'}`}
        >
          {busy? 'Sembrando…' : 'Sembrar datos base (Automotriz/Industrial)'}
        </button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
      <p className="mt-2 text-xs text-slate-500">Crea especialidades y módulos mínimos si no existen aún.</p>
    </div>
  );

// --- Siembra rápida de RA/CE para Automotriz (Módulos 1 a 5) ---
const SeedRAAutomotriz: React.FC<{
  getModuloByName: (nombre: string) => ModuloTP | undefined;
}> = ({ getModuloByName }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const data: Array<{
    moduloNombre: string;
    oaCodigo: string; // p.ej. OA 4
    oaTexto: string;
    aprendizajes: string[];
  }> = [
    {
      moduloNombre: 'Módulo 01 – Ajuste de motores.',
      oaCodigo: 'OA 4',
      oaTexto: 'Reparar y probar el funcionamiento de motores de gasolina, diésel, gas e híbridos.',
      aprendizajes: [
        'Verifica y reemplaza componentes del conjunto móvil del motor (biela, pistón, cigüeñal), siguiendo indicaciones del manual de servicio.',
        'Diagnostica el estado del motor a gasolina y/o diésel, utilizando herramientas e instrumentos apropiados, comparando los datos con los del manual de servicio.',
        'Realiza desmontaje y montaje de motor de combustión interna de acuerdo a normas de seguridad y especificaciones técnicas.',
      ],
    },
    {
      moduloNombre: 'Módulo 02 – Lectura de planos y manuales técnicos.',
      oaCodigo: 'OA 2',
      oaTexto: 'Leer y utilizar la información contenida en manuales técnicos, planos y diagramas de vehículos motorizados.',
      aprendizajes: [
        'Lee e interpreta manuales técnicos de diferentes vehículos para conocer las especificaciones técnicas entregadas por el fabricante.',
        'Lee e interpreta la información descrita en planos y diagramas de los distintos manuales para ejecutar procesos de mantenimiento y/o reparación de un vehículo automotriz.',
        'Aplica diagnóstico y resuelve fallas sectorizando un subsistema de un plano automotriz, de acuerdo al manual de servicio y normas nacionales e internacionales.',
      ],
    },
    {
      moduloNombre: 'Módulo 03 – Manejo de residuos y desechos automotrices.',
      oaCodigo: 'OA 8',
      oaTexto: 'Manipular residuos y desechos del mantenimiento de vehículos motorizados, aplicando técnicas compatibles con el cuidado del medioambiente.',
      aprendizajes: [
        'Aplica protocolos de emergencia respecto del procedimiento relacionado con residuos y desechos en el taller.',
        'Dispone de los desechos, de acuerdo a los procedimientos establecidos en las hojas de seguridad.',
        'Clasifica los tipos de fuegos que se pueden producir derivados de un accidente con materiales peligrosos.',
      ],
    },
    {
      moduloNombre: 'Módulo 04 – Mantenimiento de sistemas de seguridad y confortabilidad.',
      oaCodigo: 'OA 7',
      oaTexto: 'Montar y desmontar sistemas de seguridad y de confortabilidad, tales como cinturones de seguridad, airbag, alarmas, aire acondicionado.',
      aprendizajes: [
        'Lee e interpreta circuitos eléctricos, esquemas o planos de sistemas de seguridad pasiva y activa.',
        'Desmonta y monta sistemas de seguridad pasiva y activa de vehículos automotrices, siguiendo las instrucciones del manual de servicio.',
        'Realiza diagnóstico y mantenimiento del sistema de confortabilidad incorporado de serie en vehículos automotrices.',
      ],
    },
    {
      moduloNombre: 'Módulo 05 – Mantenimiento de sistemas eléctricos y electrónicos.',
      oaCodigo: 'OA 6',
      oaTexto: 'Reemplazar y probar sistemas eléctricos y electrónicos de los vehículos automotrices.',
      aprendizajes: [
        'Diagnostica el estado de los sistemas eléctricos automotrices, utilizando instrumentos de medición y diagnóstico, respetando las normas de seguridad.',
        'Diagnostica el estado de componentes y conductores, interpretando la representación eléctrica de los sistemas de carga y arranque del vehículo.',
        'Realiza mantenimiento preventivo y correctivo según manual de servicio técnico y normas de seguridad.',
      ],
    },
  ];

  const normalize = (s?: string) => (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  const handleSeed = async () => {
    setBusy(true);
    setMsg('Sembrando RA/CE para Automotriz (módulos 1 a 5)…');
    try {
      for (const item of data) {
        const modulo = getModuloByName(item.moduloNombre);
        if (!modulo) {
          console.warn('[SeedRA] Módulo no encontrado, omitiendo:', item.moduloNombre);
          continue;
        }
        // Evitar duplicados: si ya hay RA en el módulo, no duplicar el mismo enunciado
        const existing = await getRAByModulo(modulo.id);
        let raId: string | null = null;
        const ya = existing.find(r => normalize(r.enunciado) === normalize(item.oaTexto));
        if (ya) {
          raId = ya.id;
        } else {
          const ref = await createRA({ moduloId: modulo.id, codigo: `RA-${item.oaCodigo.replace(/\s+/g,'')}`, enunciado: item.oaTexto });
          raId = ref.id;
        }
        if (!raId) continue;
        // Crear CE a partir de los aprendizajes esperados (pesos iguales)
        const peso = Math.round(100 / item.aprendizajes.length);
        const rem = 100 - peso * item.aprendizajes.length;
        for (let i = 0; i < item.aprendizajes.length; i++) {
          const descriptor = item.aprendizajes[i];
          const codigo = `CE${i + 1}`;
          const ceExist = await getCEByRA(raId);
          const dup = ceExist.find(c => normalize(c.descriptor) === normalize(descriptor));
          if (dup) continue;
          const pesoCE = i === 0 ? (peso + rem) : peso; // Ajuste para sumar 100
          await createCE({ raId, codigo, descriptor, peso: pesoCE });
        }
      }
      setMsg('RA/CE creados correctamente. Puedes seleccionar módulo y RA para evaluar.');
    } catch (e: any) {
      console.error(e);
      setMsg(`Error al sembrar RA/CE: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        disabled={busy}
        onClick={handleSeed}
        className={`px-4 py-2 rounded-xl text-white ${busy? 'bg-slate-400':'bg-indigo-600 hover:bg-indigo-700'}`}
      >
        {busy? 'Sembrando…' : 'Sembrar RA/CE Automotriz (Módulos 1–5)'}
      </button>
      {msg && <span className="ml-3 text-sm text-slate-600">{msg}</span>}
      <p className="mt-1 text-xs text-slate-500">Crea 1 RA (a partir del OA) y sus CE (a partir de los Aprendizajes Esperados) por módulo.</p>
    </div>
  );
};
};

// --- Siembra de Resultados de Aprendizaje (Automotriz 3º, Módulos 1-5) ---
const SeedRAAutomotriz3: React.FC<{
  especialidades: EspecialidadTP[];
  getModulosByEspecialidad: (espId: string) => Promise<ModuloTP[]>;
  getRAByModulo: (modId: string) => Promise<ResultadoAprendizaje[]>;
  createRA: (data: Omit<ResultadoAprendizaje,'id'>) => Promise<any>;
  normalize: (s?: string)=>string;
}> = ({ especialidades, getModulosByEspecialidad, getRAByModulo, createRA, normalize }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSeed = async () => {
    setBusy(true);
    setMsg('Buscando especialidad y módulos…');
    try {
      // 1) Encontrar especialidad Mecánica Automotriz
      const esp = especialidades.find(e => normalize(e.nombre).includes('automotriz'));
      if (!esp) {
        setMsg('No se encontró la especialidad Mecánica Automotriz. Primero ejecuta “Sembrar datos base…”.');
        setBusy(false);
        return;
      }

      // 2) Cargar módulos de la especialidad
      const mods = await getModulosByEspecialidad(esp.id);
      const byKey = (nombre: string) => {
        const key = normalize(nombre);
        return mods.find(m => normalize(m.nombre).includes(key));
      };

      // 3) Definir RA por módulo con OA
      const plan: Array<{
        key: string; // patrón de búsqueda
        oaCodigo: string;
        oaEnunciado: string;
        ra: string[];
      }> = [
        {
          key: 'ajuste de motores',
          oaCodigo: 'OA 4',
          oaEnunciado: 'Reparar y probar el funcionamiento de motores de gasolina, diésel, gas e híbridos.',
          ra: [
            'Verifica y reemplaza componentes del conjunto móvil del motor (biela, pistón, cigüeñal), siguiendo indicaciones del manual de servicio.',
            'Diagnostica el estado del motor a gasolina y/o diésel, utilizando herramientas e instrumentos apropiados, comparando los datos con los del manual de servicio.',
            'Realiza desmontaje y montaje de motor de combustión interna de acuerdo a normas de seguridad y especificaciones técnicas.'
          ]
        },
        {
          key: 'lectura de planos y manuales',
          oaCodigo: 'OA 2',
          oaEnunciado: 'Leer y utilizar la información contenida en manuales técnicos, planos y diagramas de vehículos motorizados.',
          ra: [
            'Lee e interpreta manuales técnicos de diferentes vehículos para conocer las especificaciones técnicas entregadas por el fabricante.',
            'Lee e interpreta la información descrita en planos y diagramas de los distintos manuales para ejecutar procesos de mantenimiento y/o reparación de un vehículo automotriz.',
            'Aplica diagnóstico y resuelve fallas sectorizando un subsistema de un plano automotriz, de acuerdo al manual de servicio y normas nacionales e internacionales.'
          ]
        },
        {
          key: 'manejo de residuos y desechos',
          oaCodigo: 'OA 8',
          oaEnunciado: 'Manipular residuos y desechos del mantenimiento de vehículos motorizados, aplicando técnicas compatibles con el cuidado del medioambiente.',
          ra: [
            'Aplica protocolos de emergencia respecto del procedimiento relacionado con residuos y desechos en el taller.',
            'Dispone de los desechos, de acuerdo a los procedimientos establecidos en las hojas de seguridad.',
            'Clasifica los tipos de fuegos que se pueden producir derivados de un accidente con materiales peligrosos.'
          ]
        },
        {
          key: 'sistemas de seguridad y confortabilidad',
          oaCodigo: 'OA 7',
          oaEnunciado: 'Montar y desmontar sistemas de seguridad y de confortabilidad, tales como cinturones de seguridad, airbag, alarmas, aire acondicionado.',
          ra: [
            'Lee e interpreta circuitos eléctricos, esquemas o planos de sistemas de seguridad pasiva y activa.',
            'Desmonta y monta sistemas de seguridad pasiva y activa de vehículos automotrices, siguiendo las instrucciones del manual de servicio.',
            'Realiza diagnóstico y mantenimiento del sistema de confortabilidad incorporado de serie en vehículos automotrices.'
          ]
        },
        {
          key: 'sistemas eléctricos y electrónicos',
          oaCodigo: 'OA 6',
          oaEnunciado: 'Reemplazar y probar sistemas eléctricos y electrónicos de los vehículos automotrices.',
          ra: [
            'Diagnostica el estado de los sistemas eléctricos automotrices, utilizando instrumentos de medición y diagnóstico, respetando las normas de seguridad.',
            'Diagnostica el estado de componentes y conductores, interpretando la representación eléctrica de los sistemas de carga y arranque del vehículo.',
            'Realiza mantenimiento preventivo y correctivo según manual de servicio técnico y normas de seguridad.'
          ]
        }
      ];

      let totalCreados = 0;
      for (const item of plan) {
        const mod = byKey(item.key);
        if (!mod) {
          console.warn('[SeedRA] No se encontró el módulo con clave:', item.key);
          continue;
        }
        setMsg(`Procesando RA para módulo: ${mod.nombre}…`);
        const existentes = await getRAByModulo(mod.id);
        const existsByText = new Set(existentes.map(r => normalize(r.enunciado)));
        let seq = existentes.length; // continuar numeración si ya existen
        for (const texto of item.ra) {
          if (existsByText.has(normalize(texto))) continue;
          seq += 1;
          await createRA({
            moduloId: mod.id,
            codigo: `RA-${String(seq).padStart(2,'0')}`,
            enunciado: texto,
            oaCodigo: item.oaCodigo as any,
            oaEnunciado: item.oaEnunciado as any
          } as any);
          totalCreados += 1;
        }
      }

      setMsg(totalCreados > 0 ? `RA creados/actualizados: ${totalCreados}.` : 'No había RA nuevos por crear.');
    } catch (e: any) {
      console.error(e);
      setMsg(`Error al sembrar RA: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          disabled={busy}
          onClick={handleSeed}
          className={`px-4 py-2 rounded-xl text-white ${busy? 'bg-slate-400':'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {busy? 'Sembrando RA…' : 'Sembrar RA Automotriz 3º (Módulos 1–5)'}
        </button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
      <p className="mt-2 text-xs text-slate-500">Crea Resultados de Aprendizaje con OA asociados para Automotriz (módulos 1–5). Evita duplicados por texto.</p>
    </div>
  );
};
