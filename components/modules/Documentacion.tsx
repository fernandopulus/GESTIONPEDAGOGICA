import React, { useEffect, useMemo, useRef, useState } from 'react';
import { askDocumentacion, createDocMeta, deleteDocMeta, DocuMeta, indexDocument, subscribeDocs, uploadFileForDoc } from '../../src/firebaseHelpers/documentacion';
import { User, Profile } from '../../types';
import { FileText, Upload, Trash2, Settings, MessageSquare, Send, Loader2, Paperclip, RotateCw, Eye, X } from 'lucide-react';

interface Props {
  currentUser: User;
}

type ChatMsg = { role: 'user' | 'assistant'; text: string; citations?: Array<{ index: number; id: string; title: string }>; };

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
  const allTags = useMemo<string[]>(() => {
    const list = docs.flatMap((d) => Array.isArray(d.tags) ? d.tags : []);
    return Array.from(new Set(list));
  }, [docs]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isSubdir = useMemo(() => currentUser.profile === Profile.SUBDIRECCION, [currentUser.profile]);

  useEffect(() => {
    const unsub = subscribeDocs(setDocs);
    return () => unsub();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  const handleAsk = async () => {
    const q = question.trim();
    if (!q) return;
    setChat((c) => [...c, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);
    try {
  const activeTags = selectedTags.length > 0 ? selectedTags : undefined;
  const res = await askDocumentacion(q, 3, activeTags);
      const citations = Array.isArray(res.citations)
        ? res.citations.map((c) => ({ index: c.index, id: c.id, title: c.title }))
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

  const handleUpload = async () => {
    if (!isSubdir) return;
    if (!fileToUpload) return;
    try {
      setUploading(true);
      const inferredTitle = title.trim() || fileToUpload.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      const docId = await createDocMeta(inferredTitle, description.trim() || '', tags.split(',').map(s => s.trim()).filter(Boolean));
      const up = await uploadFileForDoc(docId, fileToUpload);
      await indexDocument(docId, up.storagePath, inferredTitle, description.trim() || '', tags.split(',').map(s => s.trim()).filter(Boolean), up.contentType);
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
      // Reindexa usando los metadatos existentes
      await indexDocument(
        d.id,
        d.storagePath,
        d.title,
        d.description || '',
        Array.isArray(d.tags) ? d.tags : [],
        d.contentType || undefined,
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

  const toggleTag = (t: string) => {
    setSelectedTags((prev) => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const clearTags = () => setSelectedTags([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const canManage = isSubdir;

  return (
    <div className="flex flex-col gap-4">
      {/* Controles superiores */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
          <FileText className="w-5 h-5 text-amber-500" />
          <span className="font-semibold">Documentación institucional</span>
        </div>
        {canManage && (
          <div className="flex-1 min-w-[280px] flex flex-wrap gap-2 items-center">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 cursor-pointer">
              <Paperclip className="w-4 h-4" />
              <input type="file" className="hidden" accept="application/pdf,text/plain" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} />
              <span className="text-sm">{fileToUpload ? fileToUpload.name : 'Seleccionar archivo (PDF/TXT)'}</span>
            </label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción (opcional)" className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm flex-1" />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (coma)" className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm" />
            <button disabled={uploading || !fileToUpload} onClick={handleUpload} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir e indexar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de documentos */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Repositorio</h3>
            {isSubdir && <Settings className="w-4 h-4 text-slate-500" title="Sólo Subdirección configura" />}
          </div>
          {/* Filtros por tags */}
          <div className="mb-3 flex flex-wrap gap-2">
            {allTags.map((t: string) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`text-xs px-2 py-1 rounded-full ring-1 ${selectedTags.includes(t) ? 'bg-amber-500 text-white ring-amber-500' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 ring-slate-200 dark:ring-slate-600'}`}
              >
                {t}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button onClick={clearTags} className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600">Limpiar</button>
            )}
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {docs.length === 0 && (
              <div className="text-sm text-slate-500">Aún no hay documentos cargados.</div>
            )}
            {docs
              .filter(d => selectedTags.length === 0 || (Array.isArray(d.tags) && d.tags.some(t => selectedTags.includes(t))))
              .map((d) => (
              <div key={d.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" title={d.title}>{d.title}</div>
                  {d.description && <div className="text-xs text-slate-500 truncate" title={d.description}>{d.description}</div>}
                  <div className="text-[11px] text-slate-400 mt-1">{d.pageCount ? `${d.pageCount} pág.` : ''} {d.contentText ? `· ${d.contentText.length} chars` : ''}</div>
                  {Array.isArray(d.tags) && d.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {d.tags.map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600">{t}</span>
                      ))}
                    </div>
                  )}
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
                    <button className="text-slate-400 hover:text-red-600" title="Eliminar" onClick={() => deleteDocMeta(d.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
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
              <div className="text-xs text-slate-500">Pregunta sobre reglamentos, protocolos y documentos institucionales</div>
            </div>
          </div>

          {/* Filtros rápidos por tags (chat) */}
          {allTags.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Filtrar por temas:</span>
              {allTags.map((t) => (
                <button
                  key={`chat-${t}`}
                  onClick={() => toggleTag(t)}
                  className={`text-xs px-2 py-1 rounded-full ring-1 ${selectedTags.includes(t) ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 ring-slate-200 dark:ring-slate-600'}`}
                >
                  {t}
                </button>
              ))}
              {selectedTags.length > 0 && (
                <button onClick={clearTags} className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600">
                  Limpiar
                </button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-auto space-y-3">
            {chat.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2 ${m.role === 'user' ? 'ml-auto bg-amber-100 dark:bg-amber-900/40 text-slate-900 dark:text-slate-100' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-800 dark:text-slate-100'}`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</div>
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.citations.map((c) => (
                      <span key={c.id} className="text-[11px] px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-800/70 ring-1 ring-slate-200 dark:ring-slate-600" title={c.title}>
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
            <button onClick={handleAsk} disabled={loading || !question.trim()} className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Modal visor de documento */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full h-[90vh] max-w-5xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
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
};

export default Documentacion;
