
// src/components/modules/EvidenciasUploader.tsx
import React, { useState } from 'react';
import { Upload, Image as ImageIcon, FileVideo, FileText } from 'lucide-react';
import { Evidencia } from '../../types/competencias';
import { uploadEvidencia, saveEvidencia } from '../../src/firebaseHelpers/competenciasHelper';

interface Props {
  raId?: string;
  currentUser: { id: string; displayName: string };
  evidencias: (Evidencia & {id: string})[];
}

const EvidenciasUploader: React.FC<Props> = ({ raId, currentUser, evidencias }) => {
  const [estudianteId, setEstudianteId] = useState('');
  const [ceId, setCeId] = useState<string>('');
  const [contexto, setContexto] = useState<'AULA'|'TALLER'|'EMPRESA'>('AULA');
  const [file, setFile] = useState<File | null>(null);
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);

  if (!raId) return <div>Selecciona una RA para gestionar evidencias.</div>;

  const onUpload = async () => {
    if (!file || !estudianteId) return;
    setLoading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `evidencias/${raId}/${estudianteId}/${Date.now()}.${ext}`;
      const { url, path: storagePath } = await uploadEvidencia(file, path);
      await saveEvidencia({
        estudianteId,
        raId,
        ceId: ceId || undefined,
        url,
        tipo: inferTipo(file.name),
        fecha: Date.now(),
        autorId: currentUser.id,
        contexto,
        observaciones: obs,
        storagePath
      });
      // Reset
      setFile(null); setObs(''); setEstudianteId(''); setCeId('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input className="border rounded-xl px-3 py-2" placeholder="Estudiante (ID)" value={estudianteId} onChange={e=>setEstudianteId(e.target.value)}/>
        <input className="border rounded-xl px-3 py-2" placeholder="CE (opcional)" value={ceId} onChange={e=>setCeId(e.target.value)}/>
        <select className="border rounded-xl px-3 py-2" value={contexto} onChange={(e)=>setContexto(e.target.value as any)}>
          <option value="AULA">AULA</option>
          <option value="TALLER">TALLER</option>
          <option value="EMPRESA">EMPRESA</option>
        </select>
        <input type="file" onChange={(e)=>setFile(e.target.files?.[0] || null)} className="border rounded-xl px-3 py-2"/>
      </div>
      <textarea className="w-full border rounded-xl px-3 py-2" rows={2} placeholder="Observaciones…" value={obs} onChange={e=>setObs(e.target.value)}/>
      <button onClick={onUpload} disabled={loading || !file || !estudianteId}
        className={`flex items-center gap-2 rounded-xl px-4 py-2 ${loading || !file || !estudianteId ? 'bg-slate-200 text-slate-500':'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
        <Upload className="w-4 h-4"/><span>Subir evidencia</span>
      </button>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {evidencias.map(ev => (
          <a key={ev.id} href={ev.url} target="_blank" rel="noreferrer"
            className="border rounded-xl p-3 hover:shadow">
            <div className="flex items-center gap-2">
              {iconFor(ev.tipo)}
              <div>
                <div className="text-sm font-medium">{new Date(ev.fecha).toLocaleString()}</div>
                <div className="text-xs text-slate-500">{ev.contexto} — Est.: {ev.estudianteId}</div>
              </div>
            </div>
            {ev.observaciones && <div className="text-xs text-slate-600 mt-2">{ev.observaciones}</div>}
          </a>
        ))}
      </div>
    </div>
  );
};

const inferTipo = (name: string): Evidencia['tipo'] => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['png','jpg','jpeg','webp','gif'].includes(ext||'')) return 'imagen';
  if (['mp4','mov','avi','mkv','webm'].includes(ext||'')) return 'video';
  if (['pdf','doc','docx','ppt','pptx','xls','xlsx','txt','csv'].includes(ext||'')) return 'documento';
  return 'otro';
};

const iconFor = (tipo: Evidencia['tipo']) => {
  switch (tipo) {
    case 'imagen': return <ImageIcon className="w-5 h-5 text-rose-600"/>;
    case 'video': return <FileVideo className="w-5 h-5 text-indigo-600"/>;
    case 'documento': return <FileText className="w-5 h-5 text-emerald-600"/>;
    default: return <Upload className="w-5 h-5 text-slate-500"/>;
  }
};

export default EvidenciasUploader;
