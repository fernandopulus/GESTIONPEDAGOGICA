import React, { useEffect, useMemo, useState } from 'react';
import { User, Profile, IntranetEntry } from '../../types';
import { listenIntranetEntries, createIntranetEntry, updateIntranetEntry, deleteIntranetEntry } from '../../src/firebaseHelpers/intranetHelper';
import { Plus, Tag, ExternalLink, Image as ImageIcon, Video as VideoIcon, Pin, Trash2, Edit3, Save, X } from 'lucide-react';
import UltraSafeRenderer from '../common/UltraSafeRenderer';
import { uploadIntranetFile, deleteIntranetFile } from '../../src/firebaseHelpers/uploads';

interface Props {
  currentUser: User;
}

const emptyEntry: Omit<IntranetEntry, 'id' | 'createdAt' | 'creadoPor'> = {
  titulo: '',
  resumen: '',
  contenidoHtml: '',
  etiquetas: [],
  enlaces: [],
  imagenes: [],
  videos: [],
  destacado: false,
  autorNombre: '',
};

const Chip: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-200/60 dark:ring-amber-800/40">
    <Tag className="w-3.5 h-3.5 mr-1.5" /> {label}
  </span>
);

const getDomain = (raw?: string) => {
  try { if (!raw) return ''; return new URL(raw).hostname.replace(/^www\./,''); } catch { return raw || ''; }
};
const getFavicon = (raw?: string) => {
  const host = getDomain(raw);
  return host ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}` : undefined;
};

const Intranet: React.FC<Props> = ({ currentUser }) => {
  const isSub = currentUser.profile === Profile.SUBDIRECCION;
  const canView = [Profile.SUBDIRECCION, Profile.PROFESORADO, Profile.COORDINACION_TP].includes(currentUser.profile);

  const [entries, setEntries] = useState<IntranetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<IntranetEntry | null>(null);
  const [draft, setDraft] = useState<typeof emptyEntry>(emptyEntry);
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [newLink, setNewLink] = useState<{ titulo?: string; url: string }>({ url: '' });
  const [imgUploadPct, setImgUploadPct] = useState<number | null>(null);
  const [vidUploadPct, setVidUploadPct] = useState<number | null>(null);

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    const unsub = listenIntranetEntries((rows) => {
      setEntries(rows);
      setLoading(false);
    }, (e) => {
      console.error('Error al suscribirse a intranet:', e);
      setError('No se pudo cargar la intranet.');
      setLoading(false);
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, [canView]);

  const startNew = () => {
    setEditing(null);
    setDraft({ ...emptyEntry, autorNombre: currentUser.nombreCompleto });
    setShowEditor(true);
  };

  const startEdit = (entry: IntranetEntry) => {
    setEditing(entry);
    const { id, createdAt, creadoPor, ...rest } = entry;
    setDraft({ ...rest });
    setShowEditor(true);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft(emptyEntry);
    setShowEditor(false);
  };

  const saveDraft = async () => {
    try {
      const payload = { ...draft } as any;
      if (!payload.titulo || !payload.contenidoHtml) {
        alert('Título y contenido son obligatorios');
        return;
      }
      if (editing) {
        await updateIntranetEntry(editing.id, payload);
      } else {
        await createIntranetEntry(payload);
      }
      cancelEdit();
      setShowEditor(false);
    } catch (e: any) {
      alert(e?.message || 'No se pudo guardar la entrada');
    }
  };

  const removeEntry = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada?')) return;
    try {
      const entry = entries.find(e => e.id === id);
      // Borrado best-effort de archivos en Storage antes de eliminar el documento
      const paths: string[] = [];
      entry?.imagenes?.forEach(i => { if (i.storagePath) paths.push(i.storagePath); });
      entry?.videos?.forEach(v => { if (v.storagePath) paths.push(v.storagePath); });
      if (paths.length) {
        await Promise.all(paths.map(p => deleteIntranetFile(p).catch(() => {})));
      }
      await deleteIntranetEntry(id);
    } catch (e: any) {
      alert(e?.message || 'No se pudo eliminar');
    }
  };

  const Editor = () => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          {editing ? 'Editar entrada' : 'Nueva entrada'}
          {draft.destacado && <span className="text-amber-600 text-xs font-bold">• Destacada</span>}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(s => !s)} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600">
            {showPreview ? 'Ocultar previsualización' : 'Previsualizar'}
          </button>
          <button disabled={imgUploadPct!==null || vidUploadPct!==null} onClick={saveDraft} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"><Save className="w-4 h-4" />Guardar</button>
          <button onClick={cancelEdit} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-500"><X className="w-4 h-4" />Cancelar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-300">Título</label>
          <input value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} className="w-full mt-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-300">Resumen</label>
          <input value={draft.resumen || ''} onChange={(e) => setDraft({ ...draft, resumen: e.target.value })} className="w-full mt-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-300">Contenido (HTML básico o texto)</label>
          <textarea rows={10} value={draft.contenidoHtml} onChange={(e) => setDraft({ ...draft, contenidoHtml: e.target.value })} className="w-full mt-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700" placeholder="Puedes pegar HTML limpio (sin scripts) o escribir texto plano." />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-300">Previsualización</label>
          <div className="mt-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 p-3 min-h-[10rem]">
            {showPreview ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <UltraSafeRenderer content={draft.contenidoHtml} context="intranet-editor-preview" />
              </div>
            ) : (
              <div className="text-slate-500 dark:text-slate-400 text-sm">Activa la previsualización para ver el contenido renderizado.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm">Etiquetas (separadas por coma)</label>
          <input value={(draft.etiquetas || []).join(', ')} onChange={(e) => setDraft({ ...draft, etiquetas: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="w-full mt-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
        </div>
        <div className="flex items-center gap-3 mt-6">
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.destacado} onChange={(e) => setDraft({ ...draft, destacado: e.target.checked })} /> <Pin className="w-4 h-4" /> Destacado</label>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm">Enlaces</label>
          <div className="flex items-center gap-2 mt-1">
            <input placeholder="Título (opcional)" value={newLink.titulo || ''} onChange={(e)=>setNewLink({...newLink, titulo: e.target.value })} className="flex-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
            <input placeholder="https://sitio.com/recurso" value={newLink.url} onChange={(e)=>setNewLink({...newLink, url: e.target.value })} className="flex-[2] rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
            <button type="button" onClick={() => {
              if (!newLink.url) return;
              const enlaces = [...(draft.enlaces || [])];
              enlaces.push({ url: newLink.url.trim(), ...(newLink.titulo ? { titulo: newLink.titulo.trim() } : {}) });
              setDraft({ ...draft, enlaces });
              setNewLink({ url: '' });
            }} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500 text-white hover:bg-amber-600">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
          {!!draft.enlaces?.length && (
            <div className="mt-3 space-y-1">
              {draft.enlaces.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-700/40 border dark:border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    {getFavicon(l.url) && <img src={getFavicon(l.url)} alt={l.titulo || l.url} className="w-4 h-4 rounded" />}
                    <span className="font-medium">{l.titulo || getDomain(l.url)}</span>
                    <span className="text-slate-400">·</span>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> Abrir
                    </a>
                  </div>
                  <button onClick={() => setDraft({ ...draft, enlaces: (draft.enlaces || []).filter((_, idx) => idx !== i) })} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-sm">Imágenes (pega URL o sube archivos)</label>
          <textarea rows={4} value={(draft.imagenes || []).map(i => i.url).join('\n')} onChange={(e) => setDraft({ ...draft, imagenes: e.target.value.split('\n').map(s => s.trim()).filter(Boolean).map(url => ({ url })) })} className="w-full mt-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
          <div className="mt-2 flex items-center gap-2">
            <input type="file" accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setImgUploadPct(0);
                const { url, path } = await uploadIntranetFile(f, 'image', (p)=>setImgUploadPct(p));
                setDraft(prev => ({ ...prev, imagenes: [...(prev.imagenes||[]), { url, storagePath: path }] }));
              } catch (err:any) {
                alert(err?.message || 'Error al subir imagen');
              } finally {
                setImgUploadPct(null);
                e.currentTarget.value = '';
              }
            }} />
            {imgUploadPct!==null && <span className="text-xs text-slate-500">Subiendo imagen… {Math.round(imgUploadPct)}%</span>}
          </div>
          {!!draft.imagenes?.length && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {draft.imagenes.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img.url} alt={img.titulo || `img-${i}`} className="w-full h-20 object-cover rounded-md" />
                  <button type="button" onClick={async () => {
                    const img = draft.imagenes?.[i];
                    if (img?.storagePath) { try { await deleteIntranetFile(img.storagePath); } catch {}
                    }
                    setDraft({ ...draft, imagenes: (draft.imagenes || []).filter((_, idx) => idx !== i) })
                  }} className="absolute top-1 right-1 p-1 rounded bg-white/80 dark:bg-slate-900/80 hover:bg-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="text-sm">Videos (pega URL o sube archivo)</label>
  <textarea rows={3} value={(draft.videos || []).map(v => v.url).join('\n')} onChange={(e) => setDraft({ ...draft, videos: e.target.value.split('\n').map(s => s.trim()).filter(Boolean).map(url => ({ url })) })} className="w-full mt-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
        <div className="mt-2 flex items-center gap-2">
          <input type="file" accept="video/*" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setVidUploadPct(0);
              const { url, path } = await uploadIntranetFile(f, 'video', (p)=>setVidUploadPct(p));
              setDraft(prev => ({ ...prev, videos: [...(prev.videos||[]), { url, storagePath: path }] }));
            } catch (err:any) {
              alert(err?.message || 'Error al subir video');
            } finally {
              setVidUploadPct(null);
              e.currentTarget.value = '';
            }
          }} />
          {vidUploadPct!==null && <span className="text-xs text-slate-500">Subiendo video… {Math.round(vidUploadPct)}%</span>}
        </div>
        {!!draft.videos?.length && (
          <div className="mt-2 flex flex-wrap gap-2">
            {draft.videos.map((v, i) => (
              <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-50 dark:bg-slate-700/40 border dark:border-slate-700 text-sm">
                <VideoIcon className="w-4 h-4" /> {v.titulo || getDomain(v.url)}
                <button type="button" onClick={async () => {
                  const vv = draft.videos?.[i];
                  if (vv?.storagePath) { try { await deleteIntranetFile(vv.storagePath); } catch {} }
                  setDraft({ ...draft, videos: (draft.videos || []).filter((_, idx) => idx !== i) })
                }} className="ml-2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const FeedCard: React.FC<{ e: IntranetEntry }> = ({ e }) => (
    <div className="p-4 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white">{e.titulo}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(e.createdAt).toLocaleString('es-CL')} • {e.autorNombre || e.creadoPor}</p>
        </div>
        {isSub && (
          <div className="flex items-center gap-2">
            <button onClick={() => startEdit(e)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Editar"><Edit3 className="w-4 h-4" /></button>
            <button onClick={() => removeEntry(e.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      </div>
      {!!e.resumen && <p className="mt-1 text-slate-700 dark:text-slate-300">{e.resumen}</p>}
      <div className="mt-3 prose prose-slate max-w-none dark:prose-invert text-sm">
        <UltraSafeRenderer content={e.contenidoHtml} context="intranet-entry" />
      </div>
      {!!e.etiquetas?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {e.etiquetas.map(t => <Chip key={t} label={t} />)}
        </div>
      )}
      {!!e.enlaces?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {e.enlaces.map((l, i) => {
            const domain = getDomain(l.url);
            const icon = getFavicon(l.url);
            return (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800 text-sm transition">
                {icon && <img src={icon} alt={domain} className="w-4 h-4 rounded" />}
                <span className="font-medium">{l.titulo || domain || 'Abrir'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            );
          })}
        </div>
      )}
      {!!e.imagenes?.length && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
          {e.imagenes.map((img, i) => (
            <img key={i} src={img.url} alt={img.titulo || `img-${i}`} className="w-full h-32 object-cover rounded-md" />
          ))}
        </div>
      )}
      {!!e.videos?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {e.videos.map((v, i) => (
            <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800 text-sm transition">
              <VideoIcon className="w-4 h-4" /> {v.titulo || getDomain(v.url) || 'Video'}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ))}
        </div>
      )}
    </div>
  );

  if (!canView) {
    return <div className="p-6 rounded-xl bg-white dark:bg-slate-800 border dark:border-slate-700">No autorizado.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Intranet</h2>
          <p className="text-slate-600 dark:text-slate-400">Información institucional, enlaces y recursos para el profesorado y coordinación.</p>
        </div>
        {isSub && (
          <button onClick={startNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600">
            <Plus className="w-4 h-4" /> Nueva entrada
          </button>
        )}
      </div>

      {/* Editor para Subdirección */}
      {isSub && showEditor && (
        <Editor />
      )}

      {/* Feed */}
      {loading ? (
        <div className="text-slate-600 dark:text-slate-300">Cargando intranet...</div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700">Aún no hay entradas publicadas.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {entries
            .sort((a, b) => (Number(!!b.destacado) - Number(!!a.destacado)))
            .map((e) => <FeedCard key={e.id} e={e} />)}
        </div>
      )}
    </div>
  );
};

export default Intranet;
