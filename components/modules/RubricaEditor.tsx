
// src/components/modules/RubricaEditor.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { CriterioEvaluacion, Rubrica, NivelLogro } from '../../types/competencias';
import { saveRubrica } from '../../src/firebaseHelpers/competenciasHelper';
import { NIVEL_LOGRO_VALUES } from '../../constants/competenciasConstants';

interface Props {
  raId?: string;
  ces: CriterioEvaluacion[];
  rubrica: Rubrica | null;
  currentUserId: string;
  onSaved?: (id: string)=>void;
}

const RubricaEditor: React.FC<Props> = ({ raId, ces, rubrica, onSaved, currentUserId }) => {
  const [local, setLocal] = useState<Rubrica | null>(null);

  useEffect(() => {
    if (raId) {
      setLocal(rubrica ?? {
        id: '',
        raId,
        niveles: NIVEL_LOGRO_VALUES,
        descriptores: [],
        ponderacionCE: Object.fromEntries(ces.map(c => [c.id, c.peso])),
        updatedAt: Date.now(),
        createdBy: currentUserId
      });
    } else {
      setLocal(null);
    }
  }, [raId, rubrica, ces, currentUserId]);

  if (!raId) return <div>Selecciona un RA para editar su rúbrica.</div>;
  if (!local) return null;

  const changePeso = (ceId: string, peso: number) => {
    setLocal(prev => prev ? ({...prev, ponderacionCE: {...prev.ponderacionCE, [ceId]: peso}}) : prev);
  };

  const changeDesc = (ceId: string, nivel: NivelLogro, text: string) => {
    setLocal(prev => {
      if (!prev) return prev;
      const others = prev.descriptores.filter(d => !(d.ceId===ceId && d.nivel===nivel));
      return {...prev, descriptores: [...others, { ceId, nivel, descriptor: text, puntaje: nivel==='SOBRESALIENTE'?100:nivel==='LOGRADO'?75:nivel==='EN_DESARROLLO'?50:25 }]};
    });
  };

  const totalPeso = useMemo(()=> Object.values(local.ponderacionCE).reduce((a: number, b) => a + (Number(b) || 0), 0), [local.ponderacionCE]);

  const save = async () => {
    const id = await saveRubrica(local!);
    onSaved?.(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Rúbrica por CE (debe sumar 100%)</h3>
        <div className={`px-2 py-1 rounded-full text-xs ${totalPeso===100?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>Total: {totalPeso}%</div>
      </div>

      <div className="space-y-4">
        {ces.map(ce => (
          <div key={ce.id} className="border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800">{ce.codigo} — {ce.descriptor}</div>
                <div className="text-xs text-slate-500">Evidencia esperada: {ce.evidenciaEsperada || '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Peso</label>
                <input type="number" className="w-20 border rounded-lg px-2 py-1" value={local.ponderacionCE[ce.id] ?? 0} onChange={(e)=>changePeso(ce.id, Number(e.target.value))} />
                <span className="text-xs text-slate-500">%</span>
              </div>
            </div>

            {/* Descriptores por nivel */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {NIVEL_LOGRO_VALUES.map(nv => {
                const current = local.descriptores.find(d => d.ceId===ce.id && d.nivel===nv);
                return (
                  <div key={nv} className="bg-slate-50 border rounded-lg p-3">
                    <div className="text-xs font-medium text-slate-600 mb-1">{nv.replace('_',' ')}</div>
                    <textarea
                      className="w-full border rounded-lg px-2 py-1 text-sm"
                      rows={2}
                      value={current?.descriptor || ''}
                      onChange={(e)=>changeDesc(ce.id, nv, e.target.value)}
                      placeholder="Descriptor observable y medible…"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={save} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2">
          <Save className="w-4 h-4"/><span>Guardar rúbrica</span>
        </button>
      </div>
    </div>
  );
};

export default RubricaEditor;
