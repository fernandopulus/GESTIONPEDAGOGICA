import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  askDocumentacion,
  createDocMeta,
  deleteDocMeta,
  DocuMeta,
  indexDocument,
  subscribeDocs,
  uploadFileForDoc
} from '../../src/firebaseHelpers/documentacion';
import { User, Profile } from '../../types';
import {
  FileText,
  Upload,
  Trash2,
  Settings,
  MessageSquare,
  Send,
  Loader2,
  Paperclip,
  RotateCw,
  Eye,
  X,
  FolderCog,
  LayoutGrid,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import ConfiguracionDocumentos from './ConfiguracionDocumentos';

interface Props {
  currentUser: User;
}

type ChatMsg = {
  role: 'user' | 'assistant';
  text: string;
  citations?: Array<{ index: number; id: string; title: string }>;
};

// Tabs
type TabType = 'consulta' | 'visualizador' | 'configuracion';

// === Secciones / Sub-secciones ===
type SectionType =
  | 'Gestión Curricular'
  | 'Apoyo a los Estudiantes'
  | 'Enseñanza y Aprendizaje en el Aula'
  | 'Desarrollo profesional Docente';

type SubsectionType = 'Protocolos' | 'Registros';

const SECTION_OPTIONS: SectionType[] = [
  'Gestión Curricular',
  'Apoyo a los Estudiantes',
  'Enseñanza y Aprendizaje en el Aula',
  'Desarrollo profesional Docente'
];
const SUBSECTION_OPTIONS: SubsectionType[] = ['Protocolos', 'Registros'];

// Helpers sección/subsección usando tags técnicos
const asSectionTag = (s: SectionType) => `section:${s}`;
const asSubsectionTag = (s: SubsectionType) => `subsection:${s}`;
const getSectionFromDoc = (d: DocuMeta): SectionType | null => {
  const t = Array.isArray(d.tags) ? d.tags.find((x) => x.startsWith('section:')) : null;
  const v = t?.slice('section:'.length);
  return (SECTION_OPTIONS as string[]).includes(v || '') ? (v as SectionType) : null;
};
const getSubsectionFromDoc = (d: DocuMeta): SubsectionType | null => {
  const t = Array.isArray(d.tags) ? d.tags.find((x) => x.startsWith('subsection:')) : null;
  const v = t?.slice('subsection:'.length);
  return (SUBSECTION_OPTIONS as string[]).includes(v || '') ? (v as SubsectionType) : null;
};

// Paleta suave por sección (sólo clases Tailwind)
const sectionTone: Record<SectionType, { bg: string; text: string; ring: string }> = {
  'Gestión Curricular': { bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', ring: 'ring-indigo-200 dark:ring-indigo-700/50' },
  'Apoyo a los Estudiantes': { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200 dark:ring-emerald-700/50' },
  'Enseñanza y Aprendizaje en el Aula': { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-200 dark:ring-amber-700/50' },
  'Desarrollo profesional Docente': { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-200 dark:ring-rose-700/50' },
};

const Documentacion: React.FC<Props> = ({ currentUser }) => {
  const [docs, setDocs] = useState<DocuMeta[]>([]);
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('consulta');

  // Selección de sección/subsección (subir y chatear)
  const [sectionSel, setSectionSel] = useState<SectionType | ''>('');
  const [subsectionSel, setSubsectionSel] = useState<SubsectionType | ''>('');

  // Visualizador: búsqueda y expand/collapse
  const [vizQuery, setVizQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // key = `${sec}::${sub}`

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isSubdir = useMemo(
    () => currentUser.profile === Profile.SUBDIRECCION,
    [currentUser.profile]
  );
  const canManage = isSubdir;

  useEffect(() => {
    const unsub = subscribeDocs(setDocs);
    return () => unsub();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Tags visibles (excluye los técnicos)
  const allTags = useMemo<string[]>(() => {
    const list = docs.flatMap((d) => (Array.isArray(d.tags) ? d.tags : []));
    const cleaned = list.filter((t) => !t.startsWith('section:') && !t.startsWith('subsection:'));
    return Array.from(new Set(cleaned));
  }, [docs]);

  // Agrupar por Sección/Subsección (con filtro por tags)
  const grouped = useMemo(() => {
    const map = new Map<SectionType, Map<SubsectionType, DocuMeta[]>>();
    SECTION_OPTIONS.forEach((sec) => {
      map.set(sec, new Map<SubsectionType, DocuMeta[]>());
      SUBSECTION_OPTIONS.forEach((sub) => map.get(sec)!.set(sub, []));
    });

    docs.forEach((d) => {
      const sec = getSectionFromDoc(d) ?? SECTION_OPTIONS[0];
      const sub = getSubsectionFromDoc(d) ?? 'Protocolos';

      const passTags =
        selectedTags.length === 0 ||
        (Array.isArray(d.tags) && d.tags.some((t) => selectedTags.includes(t)));
      if (!passTags) return;

      map.get(sec)!.get(sub)!.push(d);
    });

    return map;
  }, [docs, selectedTags]);

  // ---- Chat ----
  const handleAsk = async () => {
    const q = question.trim();
    if (!q) return;

    if (!sectionSel || !subsectionSel) {
      setChat((c) => [
        ...c,
        { role: 'assistant', text: 'Por favor selecciona **Sección** y **Sub-sección (Protocolos o Registros)** antes de consultar.' }
      ]);
      return;
    }

    setChat((c) => [...c, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);
    try {
      const activeTags =
        selectedTags.length > 0
          ? [...selectedTags, asSectionTag(sectionSel as SectionType), asSubsectionTag(subsectionSel as SubsectionType)]
          : [asSectionTag(sectionSel as SectionType), asSubsectionTag(subsectionSel as SubsectionType)];

      const shortHistory = chat.slice(-4).map((m) => ({ role: m.role, text: m.text }));
      const scopedQuestion = `[SECCIÓN: ${sectionSel}] [SUBSECCIÓN: ${subsectionSel}] ${q}`;

      const res = await askDocumentacion(scopedQuestion, 3, activeTags, shortHistory);
      const citations = Array.isArray(res.citations)
        ? res.citations.map((c: any) => ({ index: c.index, id: c.id, title: c.title }))
        : [];
      setChat((c) => [...c, { role: 'assistant', text: res.answer, citations }]);
    } catch (e: any) {
      console.error('Error consultando Documentación:', e);
      const msg = e?.message || 'Ocurrió un error al consultar la documentación.';
      setChat((c) => [...c, { role: 'assistant', text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  // ---- CRUD / acciones ----
  const handleUpload = async () => {
    if (!isSubdir) return;
    if (!fileToUpload) return;

    if (!sectionSel || !subsectionSel) {
      alert('Debes seleccionar Sección y Sub-sección para subir el documento.');
      return;
    }

    try {
      setUploading(true);
      const inferredTitle =
        title.trim() ||
        fileToUpload.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');

      const extra = [asSectionTag(sectionSel as SectionType), asSubsectionTag(subsectionSel as SubsectionType)];
      const userTags = tags.split(',').map((s) => s.trim()).filter(Boolean);
      const fullTags = Array.from(new Set([...userTags, ...extra]));

      const docId = await createDocMeta(inferredTitle, description.trim() || '', fullTags);
      const up = await uploadFileForDoc(docId, fileToUpload);
      await indexDocument(docId, up.storagePath, inferredTitle, description.trim() || '', fullTags, up.contentType);

      setFileToUpload(null);
      setTitle('');
      setDescription('');
      setTags('');
    } catch (e) {
      console.error('Upload error:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleReindex = async (d: DocuMeta) => {
    if (!isSubdir) return;
    try {
      setUploading(true);
      await indexDocument(
        d.id,
        d.storagePath,
        d.title,
        d.description || '',
        Array.isArray(d.tags) ? d.tags : [],
        d.contentType || undefined
      );
    } catch (e) {
      console.error('Reindex error:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (d: DocuMeta) => {
    try {
      if (!d.storagePath) return;
      const { ref, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../../src/firebase');
      const url = await getDownloadURL(ref(storage, d.storagePath));
      setPreviewTitle(d.title);
      setPreviewUrl(url);
    } catch (e) {
      console.error('Error abriendo documento:', e);
    }
  };

  // ---- UI helpers ----
  const toggleTag = (t: string) => {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };
  const clearTags = () => setSelectedTags([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const toggleExpanded = (sec: SectionType, sub: SubsectionType) => {
    const key = `${sec}::${sub}`;
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // === UI de Consulta (con secciones) ===
  const renderConsulta = () => (
    <div className="flex flex-col gap-4">
      {/* Controles superiores */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
          <FileText className="w-5 h-5 text-amber-500" />
          <span className="font-semibold">Documentación institucional</span>
        </div>

        {/* Selects de Sección/Sub-sección para subir */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sectionSel}
              onChange={(e) => setSectionSel(e.target.value as SectionType | '')}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm"
            >
              <option value="">Sección…</option>
              {SECTION_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={subsectionSel}
              onChange={(e) => setSubsectionSel(e.target.value as SubsectionType | '')}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm"
            >
              <option value="">Sub-sección…</option>
              {SUBSECTION_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {canManage && (
          <div className="flex-1 min-w-[280px] flex flex-wrap gap-2 items-center">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 cursor-pointer">
              <Paperclip className="w-4 h-4" />
              <input
                type="file"
                className="hidden"
                accept="application/pdf,text/plain"
                onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
              />
              <span className="text-sm">{fileToUpload ? fileToUpload.name : 'Seleccionar archivo (PDF/TXT)'}</span>
            </label>

            <input
              value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)"
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm"
            />
            <input
              value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción (opcional)"
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm flex-1"
            />
            <input
              value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (coma)"
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm"
            />

            <button
              disabled={uploading || !fileToUpload || !sectionSel || !subsectionSel}
              onClick={handleUpload}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              title={!sectionSel || !subsectionSel ? 'Selecciona Sección y Sub-sección' : 'Subir e indexar'}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Subir e indexar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Panel izquierdo: Repositorio por Secciones/Sub-secciones */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Repositorio</h3>
            {isSubdir && <Settings className="w-4 h-4 text-slate-500" title="Sólo Subdirección configura" />}
          </div>

          {/* Filtros por tags (no incluye section/subsection técnicos) */}
          <div className="mb-3 flex flex-wrap gap-2">
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`text-xs px-2 py-1 rounded-full ring-1 ${
                  selectedTags.includes(t)
                    ? 'bg-amber-500 text-white ring-amber-500'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 ring-slate-200 dark:ring-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={clearTags}
                className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Agrupación visual por Sección → Sub-sección */}
          <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
            {SECTION_OPTIONS.map((sec) => {
              const subMap = grouped.get(sec)!;
              const total = subMap.get('Protocolos')!.length + subMap.get('Registros')!.length;

              return (
                <div key={sec} className="rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/40 text-sm font-semibold rounded-t-xl">
                    {sec} <span className="text-slate-400 font-normal">({total})</span>
                  </div>

                  {SUBSECTION_OPTIONS.map((sub) => {
                    const items = subMap.get(sub)!;
                    return (
                      <div key={sub}>
                        <div className="px-3 py-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                          {sub} <span className="text-slate-400">({items.length})</span>
                        </div>

                        {items.length === 0 && (
                          <div className="px-3 pb-2 text-xs text-slate-400">Sin documentos</div>
                        )}

                        {items.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-start gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                          >
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 flex items-center justify-center">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate" title={d.title}>{d.title}</div>
                              {d.description && (
                                <div className="text-[11px] text-slate-500 truncate" title={d.description}>
                                  {d.description}
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {d.pageCount ? `${d.pageCount} pág.` : ''} {d.contentText ? `· ${d.contentText.length} chars` : ''}
                              </div>
                            </div>

                            {isSubdir && (
                              <div className="flex items-center gap-2">
                                <button
                                  className={`text-slate-400 ${d.storagePath ? 'hover:text-indigo-600' : 'opacity-40 cursor-not-allowed'}`}
                                  title={d.storagePath ? 'Ver documento' : 'No hay archivo asociado para ver'}
                                  onClick={() => d.storagePath && handleView(d)}
                                  disabled={!d.storagePath}
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  className={`text-slate-400 ${d.storagePath ? 'hover:text-emerald-600' : 'opacity-40 cursor-not-allowed'}`}
                                  title={d.storagePath ? 'Reindexar' : 'No hay archivo asociado para reindexar'}
                                  onClick={() => d.storagePath && handleReindex(d)}
                                  disabled={!d.storagePath}
                                >
                                  <RotateCw className="w-4 h-4" />
                                </button>
                                <button
                                  className="text-slate-400 hover:text-red-600"
                                  title="Eliminar"
                                  onClick={() => deleteDocMeta(d.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700 p-4 flex flex-col min-h-[60vh]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold">Asistente de Documentación</div>
              <div className="text-xs text-slate-500">Debes elegir **Sección** y **Sub-sección** para delimitar la búsqueda</div>
            </div>
          </div>

          {/* Selectores obligatorios para el chat */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={sectionSel}
              onChange={(e) => setSectionSel(e.target.value as SectionType | '')}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm"
            >
              <option value="">Sección…</option>
              {SECTION_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>

            <select
              value={subsectionSel}
              onChange={(e) => setSubsectionSel(e.target.value as SubsectionType | '')}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm"
            >
              <option value="">Sub-sección…</option>
              {SUBSECTION_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>

            {/* (Opcional) filtros por tags normales */}
            {allTags.length > 0 && (
              <>
                <span className="text-xs text-slate-500 ml-2">Tags:</span>
                {allTags.map((t) => (
                  <button
                    key={`chat-${t}`}
                    onClick={() => toggleTag(t)}
                    className={`text-xs px-2 py-1 rounded-full ring-1 ${
                      selectedTags.includes(t)
                        ? 'bg-emerald-600 text-white ring-emerald-600'
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 ring-slate-200 dark:ring-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {selectedTags.length > 0 && (
                  <button
                    onClick={clearTags}
                    className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600"
                  >
                    Limpiar
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex-1 overflow-auto space-y-3">
            {chat.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  m.role === 'user'
                    ? 'ml-auto bg-amber-100 dark:bg-amber-900/40 text-slate-900 dark:text-slate-100'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-800 dark:text-slate-100'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</div>
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.citations.map((c) => (
                      <span
                        key={c.id}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-800/70 ring-1 ring-slate-200 dark:ring-slate-600"
                        title={c.title}
                      >
                        Doc {c.index}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta…"
              className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700"
            />
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              title={!sectionSel || !subsectionSel ? 'Selecciona Sección y Sub-sección' : 'Enviar consulta'}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Modal visor de documento */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full h-[90vh] max-w-5xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700">
              <div className="font-medium truncate mr-2">{previewTitle}</div>
              <button className="text-slate-500 hover:text-slate-800" onClick={() => setPreviewUrl(null)} title="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-50 dark:bg-slate-800">
              <iframe src={`${previewUrl}#toolbar=1&navpanes=0`} className="w-full h-full" title={previewTitle} />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // === UI Visualizador ===
  const renderVisualizador = () => {
    // Búsqueda simple por título/descr
    const matchesQuery = (d: DocuMeta) => {
      const q = vizQuery.trim().toLowerCase();
      if (!q) return true;
      const hay = (s?: string) => (s || '').toLowerCase().includes(q);
      return hay(d.title) || hay(d.description || '');
    };

    // Totales por sección/subsección (post-filtro)
    const counts = SECTION_OPTIONS.map((sec) => {
      const subMap = grouped.get(sec)!;
      const subs = SUBSECTION_OPTIONS.map((sub) => {
        const arr = (subMap.get(sub) || []).filter(matchesQuery);
        return { sub, total: arr.length };
      });
      const total = subs.reduce((acc, s) => acc + s.total, 0);
      return { sec, total, subs };
    });

    return (
      <div className="flex flex-col gap-4">
        {/* Header Visualizador */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
            <LayoutGrid className="w-5 h-5 text-slate-600 dark:text-slate-200" />
            <span className="font-semibold">Visualizador</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={vizQuery}
              onChange={(e) => setVizQuery(e.target.value)}
              placeholder="Buscar por título o descripción…"
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 text-sm min-w-[260px]"
            />
            {Object.values(expanded).some(Boolean) ? (
              <button
                onClick={() => setExpanded({})}
                className="px-3 py-2 text-xs rounded-xl ring-1 ring-slate-200 dark:ring-slate-700"
                title="Contraer todo"
              >
                Contraer todo
              </button>
            ) : (
              <button
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  SECTION_OPTIONS.forEach((sec) =>
                    SUBSECTION_OPTIONS.forEach((sub) => (next[`${sec}::${sub}`] = true))
                  );
                  setExpanded(next);
                }}
                className="px-3 py-2 text-xs rounded-xl ring-1 ring-slate-200 dark:ring-slate-700"
                title="Expandir todo"
              >
                Expandir todo
              </button>
            )}
          </div>
        </div>

        {/* Tarjetas por Sección con Sub-secciones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {counts.map(({ sec, total, subs }) => {
            const tone = sectionTone[sec];
            return (
              <div
                key={sec}
                className={`rounded-2xl ring-1 ${tone.ring} overflow-hidden bg-white dark:bg-slate-800`}
              >
                <div className={`flex items-center justify-between px-4 py-3 ${tone.bg}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${tone.bg} ${tone.text} ring-1 ${tone.ring}`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`font-semibold ${tone.text}`}>{sec}</div>
                      <div className="text-xs text-slate-500">{total} documento{total === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                </div>

                {/* Sub-secciones como acordeones */}
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {subs.map(({ sub, total: tSub }) => {
                    const key = `${sec}::${sub}`;
                    const isOpen = !!expanded[key];
                    const subItems = (grouped.get(sec)?.get(sub as SubsectionType) || []).filter((d) =>
                      (vizQuery ? vizQuery.trim() : '') ? d.title.toLowerCase().includes(vizQuery.toLowerCase()) || (d.description || '').toLowerCase().includes(vizQuery.toLowerCase()) : true
                    );

                    return (
                      <div key={key}>
                        <button
                          onClick={() => toggleExpanded(sec, sub as SubsectionType)}
                          className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40"
                        >
                          <div className="inline-flex items-center gap-2">
                            {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                            <span className="text-sm font-medium">{sub}</span>
                          </div>
                          <span className="text-xs text-slate-500">{tSub}</span>
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-3">
                            {subItems.length === 0 ? (
                              <div className="text-xs text-slate-400">Sin documentos</div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {subItems.map((d) => (
                                  <div
                                    key={d.id}
                                    className="group flex items-start gap-3 p-3 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900 hover:shadow-sm"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium truncate" title={d.title}>{d.title}</div>
                                      {d.description && (
                                        <div className="text-[11px] text-slate-500 line-clamp-2">{d.description}</div>
                                      )}
                                      <div className="mt-1 text-[10px] text-slate-400">
                                        {d.pageCount ? `${d.pageCount} pág.` : ''} {d.contentText ? `· ${d.contentText.length} chars` : ''}
                                      </div>

                                      {/* Chips de tags (no técnicos) */}
                                      {Array.isArray(d.tags) && d.tags.some(t => !t.startsWith('section:') && !t.startsWith('subsection:')) && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {d.tags!.filter(t => !t.startsWith('section:') && !t.startsWith('subsection:')).slice(0, 6).map(t => (
                                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-slate-600 dark:text-slate-300">{t}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-2 items-end">
                                      <button
                                        className={`text-slate-400 ${d.storagePath ? 'hover:text-indigo-600' : 'opacity-40 cursor-not-allowed'}`}
                                        title={d.storagePath ? 'Ver documento' : 'No hay archivo asociado para ver'}
                                        onClick={() => d.storagePath && handleView(d)}
                                        disabled={!d.storagePath}
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      {isSubdir && (
                                        <>
                                          <button
                                            className={`text-slate-400 ${d.storagePath ? 'hover:text-emerald-600' : 'opacity-40 cursor-not-allowed'}`}
                                            title={d.storagePath ? 'Reindexar' : 'No hay archivo asociado para reindexar'}
                                            onClick={() => d.storagePath && handleReindex(d)}
                                            disabled={!d.storagePath}
                                          >
                                            <RotateCw className="w-4 h-4" />
                                          </button>
                                          <button
                                            className="text-slate-400 hover:text-red-600"
                                            title="Eliminar"
                                            onClick={() => deleteDocMeta(d.id)}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // === Layout principal con Tabs ===
  return (
    <div className="flex flex-col">
      {/* Header de Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveTab('consulta')}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ring-1 transition ${
            activeTab === 'consulta'
              ? 'bg-slate-900 text-white ring-slate-900'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 ring-slate-200 dark:ring-slate-700'
          }`}
          title="Realizar consultas y gestionar el repositorio"
        >
          <MessageSquare className="w-4 h-4" />
          Consulta
        </button>

        <button
          onClick={() => setActiveTab('visualizador')}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ring-1 transition ${
            activeTab === 'visualizador'
              ? 'bg-slate-900 text-white ring-slate-900'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 ring-slate-200 dark:ring-slate-700'
          }`}
          title="Visualiza el repositorio por Sección y Sub-sección"
        >
          <LayoutGrid className="w-4 h-4" />
          Visualizador
        </button>

        {isSubdir && (
          <button
            onClick={() => setActiveTab('configuracion')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ring-1 transition ${
              activeTab === 'configuracion'
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 ring-slate-200 dark:ring-slate-700'
            }`}
            title="Configuración de Documentación (Sólo Subdirección)"
          >
            <FolderCog className="w-4 h-4" />
            Configuración
          </button>
        )}
      </div>

      {activeTab === 'consulta'
        ? renderConsulta()
        : activeTab === 'visualizador'
        ? renderVisualizador()
        : <ConfiguracionDocumentos currentUser={currentUser} />}
    </div>
  );
};

export default Documentacion;
