
// src/components/modules/EvaluacionCompetencias.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Target, Ruler, Upload, BarChart3, CheckCircle2, Settings, Layers } from 'lucide-react';
import { 
  EspecialidadTP, ModuloTP, ResultadoAprendizaje, CriterioEvaluacion, NivelLogroCompetencias, Rubrica, Evidencia, EvaluacionRegistro
} from '../../types';
import {
  subscribeEspecialidades, getModulosByEspecialidad, getRAByModulo, getCEByRA,
  getRubricaByRA, saveRubrica, saveEvaluacion, uploadEvidencia, saveEvidencia,
  subscribeEvidenciasByRA, setConfigEvaluacion
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-500">Especialidad</label>
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={selected.especialidadId || ''}
                onChange={(e)=>setSelected({especialidadId: e.target.value})}
              >
                <option value="">— Selecciona —</option>
                {especialidades.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-500">Módulo</label>
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={selected.moduloId || ''}
                onChange={(e)=>setSelected(prev=>({...prev, moduloId: e.target.value}))}
              >
                <option value="">— Selecciona —</option>
                {modulos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
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
