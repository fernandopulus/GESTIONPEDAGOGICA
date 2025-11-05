import React, { useEffect, useMemo, useState } from 'react';
import { User, Profile, IntranetEntry, IntranetNote } from '../../types';
import { listenIntranetEntries, createIntranetEntry, updateIntranetEntry, deleteIntranetEntry } from '../../src/firebaseHelpers/intranetHelper';
import { Plus, Tag, ExternalLink, Image as ImageIcon, Video as VideoIcon, Pin, Trash2, Edit3, Save, X, Eye, EyeOff, UploadCloud, Loader2, FileText, Calendar, Megaphone, BookOpen, Users, Settings, Star, MessageSquare, Bell, ClipboardList, CheckCircle, AlertTriangle, MapPin, GraduationCap, Folder, Link as LinkIcon, Wand2, Briefcase, Building2, FileSpreadsheet, BarChart3, PieChart, Heart, Lightbulb, Rocket, Globe, Map, Clock3, Mail, Phone, Camera, PlayCircle } from 'lucide-react';
import UltraSafeRenderer from '../common/UltraSafeRenderer';
import { uploadIntranetFile, deleteIntranetFile } from '../../src/firebaseHelpers/uploads';
import { listenIntranetNotes, createIntranetNote, updateIntranetNote, deleteIntranetNote } from '../../src/firebaseHelpers/intranetNotes';
import { Pin as PinIcon } from 'lucide-react';

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

const shorten = (text: string, max = 28) => {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
};

interface EditorProps {
  draft: typeof emptyEntry;
  setDraft: React.Dispatch<React.SetStateAction<typeof emptyEntry>>;
  newLink: { titulo?: string; url: string };
  setNewLink: React.Dispatch<React.SetStateAction<{ titulo?: string; url: string }>>;
  showPreview: boolean;
  setShowPreview: React.Dispatch<React.SetStateAction<boolean>>;
  editing: boolean;
  saveDraft: () => Promise<void> | void;
  cancelEdit: () => void;
  imgUploadPct: number | null;
  setImgUploadPct: React.Dispatch<React.SetStateAction<number | null>>;
  vidUploadPct: number | null;
  setVidUploadPct: React.Dispatch<React.SetStateAction<number | null>>;
}

const IntranetEditor: React.FC<EditorProps> = ({
  draft,
  setDraft,
  newLink,
  setNewLink,
  showPreview,
  setShowPreview,
  editing,
  saveDraft,
  cancelEdit,
  imgUploadPct,
  setImgUploadPct,
  vidUploadPct,
  setVidUploadPct,
}) => {
  const isValidUrl = (str: string) => {
    try { new URL(str); return true; } catch { return false; }
  };

  const [isDraggingImg, setIsDraggingImg] = useState(false);
  const [isDraggingVid, setIsDraggingVid] = useState(false);

  const handleImageFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const f of arr) {
      const isImage = /^image\/(png|jpe?g|gif)$/i.test(f.type);
      if (!isImage) { alert('Formato de imagen no soportado. Usa PNG, JPG o GIF.'); continue; }
      if (f.size > 10 * 1024 * 1024) { alert('Imagen supera 10 MB.'); continue; }
      try {
        setImgUploadPct(0);
        const { url } = await uploadIntranetFile(f, 'image', (p)=>setImgUploadPct(p));
        setDraft(prev => ({ ...prev, imagenes: [...(prev.imagenes||[]), { url }] }));
      } catch (err: any) {
        alert(err?.message || 'Error al subir imagen');
      } finally {
        setImgUploadPct(null);
      }
    }
  };

  const handleVideoFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const f of arr) {
      const isVideo = /^(video\/mp4|video\/quicktime)$/i.test(f.type);
      if (!isVideo) { alert('Formato de video no soportado. Usa MP4 o MOV.'); continue; }
      if (f.size > 500 * 1024 * 1024) { alert('Video supera 500 MB.'); continue; }
      try {
        setVidUploadPct(0);
        const { url } = await uploadIntranetFile(f, 'video', (p)=>setVidUploadPct(p));
        setDraft(prev => ({ ...prev, videos: [...(prev.videos||[]), { url }] }));
      } catch (err: any) {
        alert(err?.message || 'Error al subir video');
      } finally {
        setVidUploadPct(null);
      }
    }
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-xl shadow border border-slate-200">
      {/* Top actions */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="text-xl md:text-2xl font-semibold text-slate-900">
            {editing ? 'Editar entrada' : 'Nueva entrada'}
          </h3>
          {draft.destacado && (
            <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Destacado</span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={cancelEdit} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200">
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button disabled={imgUploadPct!==null || vidUploadPct!==null} onClick={saveDraft} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
            <Save className="w-4 h-4" /> Guardar
          </button>
        </div>
      </div>

      {/* Two columns layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Título</label>
            <input
              value={draft.titulo}
              onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
              className="w-full mt-1 rounded-md border border-slate-300 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Título de la entrada"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Contenido principal (HTML básico o texto)</label>
            <textarea
              rows={14}
              value={draft.contenidoHtml}
              onChange={(e) => setDraft({ ...draft, contenidoHtml: e.target.value })}
              className="w-full mt-1 rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Puedes pegar HTML limpio (sin scripts) o escribir texto plano."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Etiquetas (separadas por comas)</label>
            <input
              value={(draft.etiquetas || []).join(', ')}
              onChange={(e) => setDraft({ ...draft, etiquetas: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="w-full mt-1 rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ej: admisión, protocolos, reuniones"
            />
            <div className="mt-2">
              {!!draft.etiquetas?.length && (
                <div className="flex flex-wrap gap-2">
                  {draft.etiquetas.map(t => <Chip key={t} label={t} />)}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Enlaces externos</label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1">
              <input placeholder="Título (opcional)" value={newLink.titulo || ''} onChange={(e)=>setNewLink({...newLink, titulo: e.target.value })} className="sm:flex-1 rounded-md border border-slate-300 px-3 py-2" />
              <input placeholder="https://sitio.com/recurso" value={newLink.url} onChange={(e)=>setNewLink({...newLink, url: e.target.value })} className="sm:flex-[2] rounded-md border border-slate-300 px-3 py-2" />
              <button
                type="button"
                onClick={() => {
                  if (!newLink.url || !isValidUrl(newLink.url)) { alert('Ingresa una URL válida.'); return; }
                  const enlaces = [...(draft.enlaces || [])];
                  enlaces.push({ url: newLink.url.trim(), ...(newLink.titulo ? { titulo: newLink.titulo.trim() } : {}) });
                  setDraft({ ...draft, enlaces });
                  setNewLink({ url: '' });
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Agregar enlace
              </button>
            </div>
            {!!draft.enlaces?.length && (
              <div className="mt-3 space-y-2">
                {draft.enlaces.map((l, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2 text-sm text-slate-700 min-w-0">
                      {getFavicon(l.url) && <img src={getFavicon(l.url)} alt={l.titulo || l.url} className="w-4 h-4 rounded" />}
                      <span className="font-medium truncate max-w-[220px] sm:max-w-[260px]" title={l.titulo || l.url}>{l.titulo || getDomain(l.url)}</span>
                      <span className="text-slate-400">·</span>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline whitespace-nowrap">
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir
                      </a>
                    </div>
                    <button onClick={() => setDraft({ ...draft, enlaces: (draft.enlaces || []).filter((_, idx) => idx !== i) })} className="p-1 rounded hover:bg-red-50 text-red-600" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={!!draft.destacado} onChange={(e) => setDraft({ ...draft, destacado: e.target.checked })} />
              <Pin className="w-4 h-4" /> Destacado
            </label>
          </div>
        </div>

        {/* Right: sidebar cards */}
        <div className="space-y-5">
          {/* Resumen */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Resumen</h4>
              <span className="text-xs text-slate-500">Opcional</span>
            </div>
            <textarea
              rows={5}
              value={draft.resumen || ''}
              onChange={(e) => setDraft({ ...draft, resumen: e.target.value })}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Breve síntesis para el feed"
            />
          </div>

          {/* Previsualización */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between p-3 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800">Previsualización</h4>
              <button onClick={() => setShowPreview(s => !s)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
                {showPreview ? (<><EyeOff className="w-4 h-4" /> Ocultar</>) : (<><Eye className="w-4 h-4" /> Mostrar</>)}
              </button>
            </div>
            <div className="p-3 min-h-[8rem]">
              {showPreview ? (
                <div className="prose prose-sm max-w-none">
                  <UltraSafeRenderer content={draft.contenidoHtml} context="intranet-editor-preview" />
                </div>
              ) : (
                <div className="text-slate-500 text-sm">Activa la previsualización para ver el contenido renderizado.</div>
              )}
            </div>
          </div>

          {/* Imágenes */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="p-3 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Imágenes</h4>
              <p className="text-xs text-slate-500 mt-1">Formatos: PNG, JPG, GIF. Máx. 10 MB.</p>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDraggingImg(true); }}
              onDragLeave={() => setIsDraggingImg(false)}
              onDrop={(e) => { e.preventDefault(); setIsDraggingImg(false); if (e.dataTransfer.files?.length) handleImageFiles(e.dataTransfer.files); }}
              className={`m-3 rounded-md border-2 ${isDraggingImg ? 'border-blue-500 bg-blue-50' : 'border-dashed border-slate-300'} p-4 text-center cursor-pointer`}
            >
              <label className="block">
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e)=>{ if (e.target.files) handleImageFiles(e.target.files); e.currentTarget.value = ''; }} />
                <div className="flex flex-col items-center gap-2 text-slate-600">
                  {imgUploadPct!==null ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                  <span className="text-sm">Arrastra y suelta o haz click para subir</span>
                  {imgUploadPct!==null && (
                    <div className="w-full max-w-xs mt-1">
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-2 bg-blue-600" style={{ width: `${Math.round(imgUploadPct)}%` }} />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Subiendo imagen… {Math.round(imgUploadPct)}%</div>
                    </div>
                  )}
                </div>
              </label>
            </div>
            {!!draft.imagenes?.length && (
              <div className="px-3 pb-3 grid grid-cols-3 gap-2">
                {draft.imagenes.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img.url} alt={img.titulo || `img-${i}`} className="w-full h-20 object-cover rounded-md" />
                    <button type="button" onClick={() => setDraft({ ...draft, imagenes: (draft.imagenes || []).filter((_, idx) => idx !== i) })} className="absolute top-1 right-1 p-1 rounded bg-white/90 hover:bg-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Videos */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="p-3 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><VideoIcon className="w-4 h-4" /> Videos</h4>
              <p className="text-xs text-slate-500 mt-1">Formatos: MP4, MOV. Máx. 500 MB. También puedes pegar URLs.</p>
            </div>
            <div className="m-3">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingVid(true); }}
                onDragLeave={() => setIsDraggingVid(false)}
                onDrop={(e) => { e.preventDefault(); setIsDraggingVid(false); if (e.dataTransfer.files?.length) handleVideoFiles(e.dataTransfer.files); }}
                className={`rounded-md border-2 ${isDraggingVid ? 'border-blue-500 bg-blue-50' : 'border-dashed border-slate-300'} p-4 text-center cursor-pointer`}
              >
                <label className="block">
                  <input type="file" accept="video/*" multiple className="hidden" onChange={(e)=>{ if (e.target.files) handleVideoFiles(e.target.files); e.currentTarget.value = ''; }} />
                  <div className="flex flex-col items-center gap-2 text-slate-600">
                    {vidUploadPct!==null ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                    <span className="text-sm">Arrastra y suelta o haz click para subir</span>
                  </div>
                </label>
                {vidUploadPct!==null && (
                  <div className="w-full max-w-xs mt-3 mx-auto">
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-2 bg-blue-600" style={{ width: `${Math.round(vidUploadPct)}%` }} />
                    </div>
                    <div className="text-xs text-slate-500 mt-1 text-center">Subiendo video… {Math.round(vidUploadPct)}%</div>
                  </div>
                )}
              </div>

              {/* Pegar URL rápida */}
              <div className="mt-3 flex gap-2">
                <input
                  placeholder="https://video-ejemplo.com/archivo.mp4"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2"
                  onKeyDown={(e: any) => {
                    const val = e.currentTarget.value.trim();
                    if (e.key === 'Enter') {
                      if (!isValidUrl(val)) { alert('URL de video no válida.'); return; }
                      setDraft(prev => ({ ...prev, videos: [...(prev.videos||[]), { url: val }] }));
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={(e: any) => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement);
                    const val = input?.value?.trim();
                    if (!val) return;
                    if (!isValidUrl(val)) { alert('URL de video no válida.'); return; }
                    setDraft(prev => ({ ...prev, videos: [...(prev.videos||[]), { url: val }] }));
                    input.value = '';
                  }}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Agregar URL
                </button>
              </div>

              {!!draft.videos?.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {draft.videos.map((v, i) => (
                    <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-sm">
                      <VideoIcon className="w-4 h-4" /> {v.titulo || getDomain(v.url)}
                      <button type="button" onClick={() => setDraft({ ...draft, videos: (draft.videos || []).filter((_, idx) => idx !== i) })} className="ml-2 p-1 rounded hover:bg-slate-200">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MemoIntranetEditor = React.memo(IntranetEditor);

const Intranet: React.FC<Props> = ({ currentUser }) => {
  const isSub = currentUser.profile === Profile.SUBDIRECCION;
  const canView = [Profile.SUBDIRECCION, Profile.PROFESORADO, Profile.COORDINACION_TP].includes(currentUser.profile);
  const canPersonalize = [Profile.PROFESORADO, Profile.COORDINACION_TP].includes(currentUser.profile);
  const canCreateNote = [Profile.SUBDIRECCION, Profile.PROFESORADO, Profile.COORDINACION_TP].includes(currentUser.profile);

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
  // Notas rápidas (post-it)
  const [notes, setNotes] = useState<IntranetNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(true);
  const [noteForm, setNoteForm] = useState<{ titulo: string; mensaje: string; color: IntranetNote['color'] }>({ titulo: '', mensaje: '', color: 'yellow' });
  // Preferencias por usuario (solo en este navegador)
  type UserPrefs = { order: string[]; colors: Record<string, string>; version: number };
  const [prefs, setPrefs] = useState<UserPrefs>({ order: [], colors: {}, version: 1 });
  const [personalizeMode, setPersonalizeMode] = useState<boolean>(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Modal global de apariencia (solo icono; tarjetas en blanco)
  const [styleEntry, setStyleEntry] = useState<IntranetEntry | null>(null);
  const iconOptions = useMemo(() => ([
    { id: 'auto', label: 'Auto', Comp: Wand2 },
    { id: 'file', label: 'Documento', Comp: FileText },
    { id: 'folder', label: 'Carpeta', Comp: Folder },
    { id: 'link', label: 'Enlace', Comp: LinkIcon },
    { id: 'image', label: 'Imagen', Comp: ImageIcon },
    { id: 'video', label: 'Video', Comp: VideoIcon },
    { id: 'calendar', label: 'Calendario', Comp: Calendar },
    { id: 'megaphone', label: 'Anuncio', Comp: Megaphone },
    { id: 'book', label: 'Libro/Guía', Comp: BookOpen },
    { id: 'users', label: 'Personas', Comp: Users },
    { id: 'settings', label: 'Ajustes', Comp: Settings },
    { id: 'star', label: 'Destacado', Comp: Star },
    { id: 'message', label: 'Mensaje', Comp: MessageSquare },
    { id: 'bell', label: 'Notificación', Comp: Bell },
    { id: 'clipboard', label: 'Lista', Comp: ClipboardList },
    { id: 'check', label: 'Aprobado', Comp: CheckCircle },
    { id: 'alert', label: 'Alerta', Comp: AlertTriangle },
    { id: 'pin', label: 'Pin', Comp: Pin },
    { id: 'mappin', label: 'Ubicación', Comp: MapPin },
    { id: 'graduation', label: 'Educación', Comp: GraduationCap },
    { id: 'briefcase', label: 'Portafolio', Comp: Briefcase },
    { id: 'building', label: 'Edificio', Comp: Building2 },
    { id: 'sheet', label: 'Hoja de cálculo', Comp: FileSpreadsheet },
    { id: 'barchart', label: 'Gráfico barras', Comp: BarChart3 },
    { id: 'piechart', label: 'Gráfico torta', Comp: PieChart },
    { id: 'heart', label: 'Corazón', Comp: Heart },
    { id: 'lightbulb', label: 'Idea', Comp: Lightbulb },
    { id: 'rocket', label: 'Cohete', Comp: Rocket },
    { id: 'globe', label: 'Globo', Comp: Globe },
    { id: 'map', label: 'Mapa', Comp: Map },
    { id: 'clock', label: 'Reloj', Comp: Clock3 },
    { id: 'mail', label: 'Correo', Comp: Mail },
    { id: 'phone', label: 'Teléfono', Comp: Phone },
    { id: 'camera', label: 'Cámara', Comp: Camera },
    { id: 'play', label: 'Reproducir', Comp: PlayCircle },
  ]), []);
  const [styleIconId, setStyleIconId] = useState<string>('auto');
  const [iconSearch, setIconSearch] = useState<string>('');

  const openStyleModal = (entry: IntranetEntry) => {
    setStyleEntry(entry);
    setStyleIconId(entry.iconId || 'auto');
  };
  const closeStyleModal = () => { setStyleEntry(null); };

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    const unsub = listenIntranetEntries((rows) => {
      setEntries(rows);
      // Limpiar ids que ya no existen en prefs
      setPrefs(prev => {
        const ids = new Set(rows.map(r=>r.id));
        const newOrder = prev.order.filter(id => ids.has(id));
        const newColors: Record<string,string> = {};
  Object.entries(prev.colors).forEach(([id, col]) => { if (ids.has(id)) newColors[id] = String(col); });
        const next = { ...prev, order: newOrder, colors: newColors };
        savePrefs(next);
        return next;
      });
      setLoading(false);
    }, (e) => {
      console.error('Error al suscribirse a intranet:', e);
      setError('No se pudo cargar la intranet.');
      setLoading(false);
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, [canView]);

  // Suscripción a notas rápidas
  useEffect(() => {
    if (!canView) return;
    setLoadingNotes(true);
    const unsub = listenIntranetNotes((rows) => {
      setNotes(rows);
      setLoadingNotes(false);
    }, (e) => {
      console.error('Error al suscribirse a intranet_notes:', e);
      setLoadingNotes(false);
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, [canView]);

  // Cargar preferencias desde localStorage
  useEffect(() => {
    if (!canPersonalize) return;
    try {
      const raw = localStorage.getItem(`intranet_prefs_${currentUser.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setPrefs({ order: parsed.order || [], colors: parsed.colors || {}, version: 1 });
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPersonalize, currentUser.id]);

  const savePrefs = (p: UserPrefs) => {
    try { localStorage.setItem(`intranet_prefs_${currentUser.id}`, JSON.stringify(p)); } catch {}
  };

  const setPrefColor = (id: string, color?: string) => {
    setPrefs(prev => {
      const next: UserPrefs = { ...prev, colors: { ...prev.colors } };
      if (!color) delete next.colors[id]; else next.colors[id] = color;
      savePrefs(next);
      return next;
    });
  };

  const moveInOrder = (id: string, dir: 'up'|'down') => {
    setPrefs(prev => {
      const idsAll = entries.map(e=>e.id);
      // construir orden efectivo actual
      const effective = prev.order.filter(x => idsAll.includes(x)).concat(idsAll.filter(x => !prev.order.includes(x)));
      const idx = effective.indexOf(id);
      if (idx < 0) return prev;
      const j = dir==='up' ? idx-1 : idx+1;
      if (j < 0 || j >= effective.length) return prev;
      const swapped = effective.slice();
      [swapped[idx], swapped[j]] = [swapped[j], swapped[idx]];
      const next: UserPrefs = { ...prev, order: swapped, colors: prev.colors, version: prev.version };
      savePrefs(next);
      return next;
    });
  };

  const startNew = () => {
    setEditing(null);
    setDraft({ ...emptyEntry, autorNombre: currentUser.nombreCompleto });
    setShowEditor(true);
  };

  const FeedCard: React.FC<{ e: IntranetEntry; index: number }> = ({ e, index }) => {
    // Tarjetas sin gradiente: fondo blanco siempre
    const actionBtnClass = 'p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700';
    const userColor = prefs.colors[e.id];

    // Icono representativo del contenido
    const resolveAutoIcon = () => (
      e.videos?.length ? VideoIcon :
      e.imagenes?.length ? ImageIcon :
      e.enlaces?.length ? ExternalLink :
      FileText
    );
    const manualIconMap: Record<string, React.ComponentType<any>> = useMemo(() => {
      const m: Record<string, React.ComponentType<any>> = {};
      iconOptions.forEach(({ id, Comp }) => { if (id !== 'auto') m[id] = Comp as any; });
      return m;
    }, [iconOptions]);
    const IconComp = e.iconId && e.iconId !== 'auto' ? (manualIconMap[e.iconId] || resolveAutoIcon()) : resolveAutoIcon();

    const draggable = canPersonalize && personalizeMode;
    return (
      <div
        className={`relative rounded-xl shadow-sm hover:shadow-md transition overflow-hidden border bg-white ${draggable ? 'cursor-move': ''} ${draggingId===e.id? 'opacity-80 ring-2 ring-blue-400' : ''}`}
        style={{ borderColor: 'var(--tw-colors-slate-200)', borderLeft: userColor ? `6px solid ${userColor}` : undefined }}
        draggable={draggable}
        onDragStart={(ev) => { if (!draggable) return; setDraggingId(e.id); ev.dataTransfer.setData('text/plain', e.id); ev.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => setDraggingId(null)}
        onDragOver={(ev) => { if (!draggable) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; }}
        onDrop={(ev) => {
          if (!draggable) return;
          ev.preventDefault();
          const fromId = ev.dataTransfer.getData('text/plain');
          const toId = e.id;
          if (!fromId || fromId === toId) return;
          // calcular orden efectivo y mover
          setPrefs(prev => {
            const idsAll = entries.map(x=>x.id);
            const effective = prev.order.filter(x => idsAll.includes(x)).concat(idsAll.filter(x => !prev.order.includes(x)));
            const fromIdx = effective.indexOf(fromId);
            const toIdx = effective.indexOf(toId);
            if (fromIdx < 0 || toIdx < 0) return prev;
            const newOrder = effective.slice();
            const [moved] = newOrder.splice(fromIdx, 1);
            newOrder.splice(toIdx, 0, moved);
            const next = { ...prev, order: newOrder };
            savePrefs(next);
            return next;
          });
          setDraggingId(null);
        }}
      >
        {/* acciones */}
        {isSub && (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
            <button onClick={() => startEdit(e)} className={actionBtnClass} title="Editar contenido">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={() => openStyleModal(e)} className={actionBtnClass} title="Editar icono">
              <Pin className="w-4 h-4" />
            </button>
            <button onClick={() => removeEntry(e.id)} className={'p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-red-600'} title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        {canPersonalize && personalizeMode && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button type="button" className="px-1.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs" onClick={()=>moveInOrder(e.id,'up')} title="Subir">↑</button>
              <button type="button" className="px-1.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs" onClick={()=>moveInOrder(e.id,'down')} title="Bajar">↓</button>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <input type="color" value={userColor || '#ffffff'} onChange={(ev)=>setPrefColor(e.id, ev.target.value)} title="Color" />
              <button type="button" className="px-1.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50" onClick={()=>setPrefColor(e.id, undefined)} title="Quitar color">✕</button>
            </div>
          </div>
        )}

        {/* contenido */}
  <div className="p-4 relative z-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white truncate" title={e.titulo}>{e.titulo}</h4>
              <p className="text-sm text-slate-700/80 dark:text-slate-300/90">{new Date(e.createdAt).toLocaleString('es-CL')} • {e.autorNombre || e.creadoPor}</p>
            </div>
          </div>
          {!!e.resumen && <p className="mt-1 text-slate-800 dark:text-slate-200">{e.resumen}</p>}
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
                const label = l.titulo || domain || 'Abrir';
                return (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800 text-sm transition max-w-full">
                    {icon && <img src={icon} alt={domain} className="w-4 h-4 rounded shrink-0" />}
                    <span className="font-medium truncate max-w-[180px] sm:max-w-[220px]" title={label}>{shorten(label, 30)}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
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
                  <VideoIcon className="w-4 h-4" /> {shorten(v.titulo || getDomain(v.url) || 'Video', 30)}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          )}
          {/* Icono centrado debajo del texto */}
          <div className="mt-6 grid place-items-center pointer-events-none select-none">
            <IconComp className={`text-slate-300 w-16 h-16 md:w-20 md:h-20`} />
          </div>
        </div>

        {/* Sin editor inline; se usa modal global */}
      </div>
    );
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

  // eliminado: Editor duplicado/corrupto

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
        <div className="flex items-center gap-2">
          {canPersonalize && (
            <>
              <button onClick={()=>setPersonalizeMode(s=>!s)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${personalizeMode? 'bg-blue-600 text-white border-blue-600':'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>{personalizeMode? 'Salir de personalización':'Personalizar'}</button>
              {personalizeMode && (
                <button onClick={()=>{ const cleared: UserPrefs = { order: [], colors: {}, version: 1 }; setPrefs(cleared); savePrefs(cleared); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-slate-700 border-slate-300 hover:bg-slate-50">Restablecer</button>
              )}
            </>
          )}
          {isSub && (
            <button onClick={startNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600">
              <Plus className="w-4 h-4" /> Nueva entrada
            </button>
          )}
        </div>
      </div>

      {/* Notas rápidas (Post-it) */}
      <div className="bg-white dark:bg-slate-800 p-5 md:p-6 rounded-xl shadow border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Notas rápidas</h3>
          {canCreateNote && (
            <div className="flex gap-2">
              <select
                value={noteForm.color}
                onChange={(e)=>setNoteForm(prev=>({ ...prev, color: e.target.value as any }))}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                title="Color del post-it"
              >
                <option value="yellow">Amarillo</option>
                <option value="lime">Verde</option>
                <option value="sky">Celeste</option>
                <option value="red">Rojo</option>
                <option value="violet">Violeta</option>
              </select>
              <button
                onClick={async ()=>{
                  if (!noteForm.titulo || !noteForm.mensaje) { alert('Título y mensaje son obligatorios'); return; }
                  try {
                    await createIntranetNote({ titulo: noteForm.titulo, mensaje: noteForm.mensaje, color: noteForm.color });
                    setNoteForm({ titulo: '', mensaje: '', color: noteForm.color });
                  } catch (e: any) {
                    alert(e?.message || 'No se pudo crear la nota');
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600"
              >
                <Plus className="w-4 h-4" /> Agregar Nota
              </button>
            </div>
          )}
        </div>
        {canCreateNote && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input
              value={noteForm.titulo}
              onChange={(e)=>setNoteForm(prev=>({ ...prev, titulo: e.target.value }))}
              placeholder="Título de la nota"
              className="rounded-md border border-slate-300 px-3 py-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            />
            <input
              value={noteForm.mensaje}
              onChange={(e)=>setNoteForm(prev=>({ ...prev, mensaje: e.target.value }))}
              placeholder="Mensaje (breve)"
              className="rounded-md border border-slate-300 px-3 py-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            />
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <PinIcon className="w-4 h-4" /> Usa estas notas para comunicar situaciones importantes.
            </div>
          </div>
        )}

        {loadingNotes ? (
          <div className="text-slate-600 dark:text-slate-300">Cargando notas…</div>
        ) : notes.length === 0 ? (
          <div className="text-slate-500 dark:text-slate-400">No hay notas aún.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {notes.map((note, idx) => {
              const colorMap: Record<NonNullable<IntranetNote['color']>, string> = {
                yellow: 'bg-yellow-200 dark:bg-yellow-800/50',
                lime: 'bg-lime-200 dark:bg-lime-800/50',
                sky: 'bg-sky-200 dark:bg-sky-800/50',
                red: 'bg-red-200 dark:bg-red-800/50',
                violet: 'bg-violet-200 dark:bg-violet-800/50',
              };
              const rotate = ['-rotate-2','rotate-1','rotate-2','-rotate-1','rotate-1'][idx % 5];
              const canDeleteNote = currentUser.profile === Profile.SUBDIRECCION || note.autor === currentUser.nombreCompleto;
              const canPinNote = [Profile.SUBDIRECCION, Profile.PROFESORADO].includes(currentUser.profile);
              return (
                <div key={note.id} className={`font-handwritten text-slate-800 dark:text-slate-200 shadow-xl p-4 flex flex-col relative transition-transform duration-300 ease-in-out hover:scale-105 hover:rotate-0 hover:z-10 ${colorMap[note.color || 'yellow']} transform ${rotate}`}>
                  {note.destacado && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"><span className="text-5xl" role="img" aria-label="Nota fijada">📌</span></div>
                  )}
                  <h4 className="text-3xl font-bold border-b-2 border-slate-500/30 dark:border-slate-400/30 pb-2 mb-3 break-words">{note.titulo}</h4>
                  <p className="flex-grow text-2xl whitespace-pre-wrap mb-4 break-words min-h-[80px]">{note.mensaje}</p>
                  <div className="font-sans text-xs mt-auto pt-2 border-t border-slate-500/30 dark:border-slate-400/30 flex justify-between items-end">
                    <div>
                      <p className="font-bold">{note.autor}</p>
                      <p className="text-slate-600 dark:text-slate-400">{new Date(note.fechaPublicacion).toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {canPinNote && (
                        <button
                          onClick={async ()=>{ try { await updateIntranetNote(note.id, { destacado: !note.destacado }); } catch(e) { alert('No se pudo fijar'); } }}
                          title={note.destacado? 'Desfijar':'Fijar'}
                          className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                        >
                          <span className={`text-xl transition-opacity ${note.destacado ? 'opacity-100' : 'opacity-30'}`}>📌</span>
                        </button>
                      )}
                      {canDeleteNote && (
                        <button onClick={async ()=>{ if (!confirm('¿Eliminar nota?')) return; try { await deleteIntranetNote(note.id); } catch(e) { alert('No se pudo eliminar'); } }} title="Eliminar" className="text-red-600 hover:text-red-800 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor para Subdirección */}
      {isSub && showEditor && (
        <MemoIntranetEditor
          draft={draft}
          setDraft={setDraft}
          newLink={newLink}
          setNewLink={setNewLink}
          showPreview={showPreview}
          setShowPreview={setShowPreview}
          editing={!!editing}
          saveDraft={saveDraft}
          cancelEdit={cancelEdit}
          imgUploadPct={imgUploadPct}
          setImgUploadPct={setImgUploadPct}
          vidUploadPct={vidUploadPct}
          setVidUploadPct={setVidUploadPct}
        />
      )}

      {/* Feed */}
      {loading ? (
        <div className="text-slate-600 dark:text-slate-300">Cargando intranet...</div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700">Aún no hay entradas publicadas.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(() => {
            const base = entries.slice().sort((a,b)=> Number(!!b.destacado) - Number(!!a.destacado));
            if (canPersonalize) {
              // Orden efectivo por usuario
              const idsOrder = prefs.order.filter(id => base.find(x=>x.id===id));
              const rest = base.filter(x => !idsOrder.includes(x.id));
              const ordered: IntranetEntry[] = [...idsOrder.map(id => base.find(x=>x.id===id)!).filter(Boolean), ...rest];
              return ordered.map((e, idx) => <FeedCard key={e.id} e={e} index={idx} />);
            }
            return base.map((e, idx) => <FeedCard key={e.id} e={e} index={idx} />);
          })()}
        </div>
      )}

      {/* Modal global de estilo de tarjeta */}
      {isSub && styleEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeStyleModal} />
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-slate-800 font-semibold">Apariencia de tarjeta (icono)</h5>
              <button onClick={closeStyleModal} className="p-1 rounded hover:bg-slate-100" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Selector de icono visual */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-700">Icono</label>
                <input
                  type="text"
                  value={iconSearch}
                  onChange={(e)=>setIconSearch(e.target.value)}
                  placeholder="Buscar icono..."
                  className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {iconOptions
                  .filter(opt => opt.label.toLowerCase().includes(iconSearch.toLowerCase()) || opt.id.includes(iconSearch.toLowerCase()))
                  .map(opt => {
                    const C = opt.Comp as any;
                    const active = styleIconId === opt.id || (opt.id==='auto' && styleIconId==='auto');
                    return (
                      <button key={opt.id}
                        type="button"
                        onClick={()=>setStyleIconId(opt.id)}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-md border text-xs ${active? 'border-blue-600 bg-blue-50 text-blue-700':'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                        title={opt.label}
                      >
                        <C className="w-5 h-5" />
                        <span className="truncate w-full text-center">{opt.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button onClick={closeStyleModal} className="px-3 py-2 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200">Cancelar</button>
              <button
                onClick={async () => {
                  if (!styleEntry) return;
                  try {
                    await updateIntranetEntry(styleEntry.id, { gradiente: null as any, iconId: styleIconId === 'auto' ? (null as any) : styleIconId });
                    closeStyleModal();
                  } catch (err: any) {
                    alert(err?.message || 'No se pudo guardar');
                  }
                }}
                className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Intranet;
