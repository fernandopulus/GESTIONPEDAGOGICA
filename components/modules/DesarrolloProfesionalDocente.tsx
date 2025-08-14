
// components/modules/DesarrolloProfesionalDocente.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Users,
  BarChart3,
  NotebookPen,
  FolderOpenDot,
  MessageSquare,
  Layers,
} from "lucide-react";

import { 
  DPDActivity, 
  DPDQuestion, 
  DPDRespuesta, 
  PerfilCreador, 
  subscribeToActividades, 
  createActividad, 
  updateActividad, 
  deleteActividad, 
  archiveActividad, 
  subscribeToRespuestasByActividad,
  createRespuesta,
  subscribeToUsuariosByPerfiles,
  countWords
} from "../../src/firebaseHelpers/desarrolloProfesionalHelper";

import { generateMultipleChoiceQuestionsWithAI, extractKeywordsWithAI } from "../../src/ai/geminiHelper";
import { PME_DIMENSIONES, PERFILES_CREADORES_DPD } from "../../constants"; // Asegúrate de pegar el snippet provisto

// Tipos básicos de tu app existentes
import { User } from "../../types";

interface Props {
  currentUser: User;
}

type Tab = "crear" | "responder" | "dashboard";

const MAX_WORDS = 500;

const DesarrolloProfesionalDocente: React.FC<Props> = ({ currentUser }) => {
  // ===================== Estado general =====================
  const [actividades, setActividades] = useState<DPDActivity[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("responder");

  // ===================== Creación / edición =====================
  const [titulo, setTitulo] = useState("");
  const [dimension, setDimension] = useState<string>("Liderazgo Curricular");
  const [subdimension, setSubdimension] = useState<string>("Planificación y organización del currículo");

  const [creadorPerfil, setCreadorPerfil] = useState<PerfilCreador>("PROFESORADO");
  const [creadorId, setCreadorId] = useState<string>("");
  const [creadorNombre, setCreadorNombre] = useState<string>("");

  const [preguntas, setPreguntas] = useState<DPDQuestion[]>([]);
  const [usuariosCandidatos, setUsuariosCandidatos] = useState<{ id: string; nombre: string; profile?: string }[]>([]);

  // AI generation controls
  const [aiTema, setAiTema] = useState("");
  const [aiCantidad, setAiCantidad] = useState<number>(3);
  const [aiBusy, setAiBusy] = useState(false);

  // ===================== Respuestas =====================
  const [respuestas, setRespuestas] = useState<Record<string, any>>({}); // por questionId
  const [respuestasActividad, setRespuestasActividad] = useState<DPDRespuesta[]>([]);

  // ===================== Suscripciones =====================
  useEffect(() => {
    const unsub = subscribeToActividades((items) => {
      setActividades(items);
      if (!selectedId && items.length) setSelectedId(items[0].id);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubUsers = subscribeToUsuariosByPerfiles(["PROFESORADO", "SUBDIRECCION"], setUsuariosCandidatos);
    return () => unsubUsers();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const unsub = subscribeToRespuestasByActividad(selectedId, setRespuestasActividad);
    return () => unsub();
  }, [selectedId]);

  // ===================== Derivados =====================
  const selectedActivity = useMemo(
    () => actividades.find((a) => a.id === selectedId),
    [actividades, selectedId]
  );

  const subdims = useMemo(() => PME_DIMENSIONES[dimension] || [], [dimension]);

  // ===================== Handlers: preguntas =====================
  const addOpenQuestion = () => {
    const q: DPDQuestion = {
      id: crypto.randomUUID(),
      tipo: "abierta",
      enunciado: "Escribe aquí tu pregunta abierta",
      maxPalabras: MAX_WORDS,
    };
    setPreguntas((p) => [...p, q]);
  };

  const addChoiceQuestion = () => {
    const q: DPDQuestion = {
      id: crypto.randomUUID(),
      tipo: "seleccion_multiple",
      enunciado: "Selecciona la(s) opción(es) que corresponda(n)",
      opciones: ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
      multiple: true,
    };
    setPreguntas((p) => [...p, q]);
  };

  const removeQuestion = (id: string) => {
    setPreguntas((p) => p.filter((x) => x.id !== id));
  };

  const updateQuestion = (id: string, patch: Partial<DPDQuestion>) => {
    setPreguntas((p) =>
      p.map((q) => (q.id === id ? ({ ...q, ...patch } as DPDQuestion) : q))
    );
  };

  // ===================== Handlers: AI =====================
  const handleAIGenerate = async () => {
    if (!aiTema || aiCantidad < 1) return;
    setAiBusy(true);
    try {
      const items = await generateMultipleChoiceQuestionsWithAI(aiTema, aiCantidad);
      const mapped: DPDQuestion[] = items.map((it) => ({
        id: crypto.randomUUID(),
        tipo: "seleccion_multiple",
        enunciado: it.enunciado,
        opciones: it.opciones.slice(0, 5),
        multiple: true,
      }));
      setPreguntas((prev) => [...prev, ...mapped]);
    } finally {
      setAiBusy(false);
    }
  };

  // ===================== Handlers: actividad =====================
  const canCreate = PERFILES_CREADORES_DPD.includes((currentUser as any)?.profile) || (currentUser as any)?.isAdmin;
  useEffect(() => {
    if (usuariosCandidatos.length && !creadorId) {
      const found = usuariosCandidatos.find(u => u.id === currentUser?.uid);
      if (found) {
        setCreadorId(found.id);
        setCreadorNombre(found.nombre);
        setCreadorPerfil((found.profile as PerfilCreador) || "PROFESORADO");
      }
    }
  }, [usuariosCandidatos]);

  const resetForm = () => {
    setTitulo("");
    setDimension("Liderazgo Curricular");
    setSubdimension("Planificación y organización del currículo");
    setCreadorPerfil("PROFESORADO");
    setCreadorId("");
    setCreadorNombre("");
    setPreguntas([]);
  };

  const handleSave = async () => {
    if (!titulo.trim()) return alert("Debes ingresar un título");
    if (!creadorId) return alert("Debes seleccionar un creador");
    const input = {
      titulo,
      dimension,
      subdimension,
      creadorId,
      creadorNombre,
      creadorPerfil,
      preguntas,
    };
    const id = await createActividad(input as any);
    resetForm();
    setSelectedId(id);
    setTab("responder");
  };

  const handleArchive = async (id: string, archive = true) => {
    await archiveActividad(id, archive);
  };

  // ===================== Handlers: responder =====================
  const handleChangeRespuesta = (q: DPDQuestion, value: any) => {
    setRespuestas((prev) => ({
      ...prev,
      [q.id]: q.tipo === "abierta"
        ? { tipo: "abierta", valorTexto: value }
        : { tipo: "seleccion_multiple", seleccionados: value },
    }));
  };

  const handleSubmitRespuestas = async () => {
    if (!selectedActivity) return;
    // Validaciones simples
    for (const q of selectedActivity.preguntas) {
      const r = respuestas[q.id];
      if (!r) continue;
      if (q.tipo === "abierta" && q.maxPalabras) {
        const words = countWords(r.valorTexto || "");
        if (words > q.maxPalabras) {
          return alert(`La respuesta a "${q.enunciado}" supera el máximo de ${q.maxPalabras} palabras (${words}).`);
        }
      }
    }

    const payload = {
      activityId: selectedActivity.id,
      userId: currentUser?.uid || "anon",
      userNombre: (currentUser as any)?.displayName || (currentUser as any)?.name || "Anónimo",
      respuestas,
    };
    await createRespuesta(payload as any);
    setRespuestas({});
    alert("¡Respuestas enviadas!");
  };

  // ===================== Dashboard =====================
  // Conteos para preguntas de selección múltiple
  const choiceStats = useMemo(() => {
    if (!selectedActivity) return {};
    const stats: Record<string, Record<string, number>> = {}; // questionId -> option -> count
    for (const q of selectedActivity.preguntas) {
      if (q.tipo !== "seleccion_multiple") continue;
      stats[q.id] = {};
      q.opciones.forEach((opt) => (stats[q.id][opt] = 0));
    }
    for (const r of respuestasActividad) {
      for (const [qid, val] of Object.entries(r.respuestas || {})) {
        const v = val as any;
        if (v?.tipo === "seleccion_multiple") {
          for (const opt of v.seleccionados || []) {
            if (!stats[qid]) stats[qid] = {};
            stats[qid][opt] = (stats[qid][opt] || 0) + 1;
          }
        }
      }
    }
    return stats;
  }, [selectedActivity, respuestasActividad]);

  // Recolección de respuestas abiertas y extracción de keywords
  const [keywords, setKeywords] = useState<{ keyword: string; score: number }[]>([]);
  useEffect(() => {
    const run = async () => {
      if (!selectedActivity) return;
      const allOpen: string[] = [];
      for (const r of respuestasActividad) {
        for (const [qid, val] of Object.entries(r.respuestas || {})) {
          const q = selectedActivity.preguntas.find((x) => x.id === qid);
          const v = val as any;
          if (q?.tipo === "abierta" && typeof v?.valorTexto === "string") {
            allOpen.push(v.valorTexto);
          }
        }
      }
      if (allOpen.length) {
        const kws = await extractKeywordsWithAI(allOpen, 30);
        setKeywords(kws);
      } else {
        setKeywords([]);
      }
    };
    run();
  }, [selectedActivity, respuestasActividad]);

  // ===================== UI helpers =====================
  const Pills = () => (
    <div className="flex flex-wrap gap-2">
      {actividades.map((a) => (
        <button
          key={a.id}
          onClick={() => { setSelectedId(a.id); setTab("responder"); }}
          className={`px-3 py-1 rounded-full border text-sm transition ${a.id === selectedId ? "bg-indigo-600 text-white border-indigo-600" : "bg-white hover:bg-indigo-50 border-gray-300 text-gray-700"}`}
          title={`${a.titulo} — ${a.dimension} / ${a.subdimension}`}
        >
          <span className="inline-flex items-center gap-2"><FolderOpenDot className="w-4 h-4"/>{a.titulo}</span>
        </button>
      ))}
    </div>
  );

  const Section = (props: { title: string; icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">{props.icon}{props.title}</h3>
        {props.right}
      </div>
      {props.children}
    </div>
  );

  // ===================== Render =====================
  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Layers className="w-7 h-7 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold">Desarrollo Profesional Docente</h2>
            <p className="text-sm text-gray-600">Cree actividades/sesiones, responda y visualice insights.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg text-sm border ${tab==="responder" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white hover:bg-indigo-50"}`}
            onClick={() => setTab("responder")}
          >
            Responder
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm border ${tab==="dashboard" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white hover:bg-indigo-50"}`}
            onClick={() => setTab("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm border ${tab==="crear" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white hover:bg-indigo-50"}`}
            onClick={() => setTab("crear")}
            disabled={!canCreate}
            title={canCreate ? "" : "Tu perfil no crea actividades"}
          >
            Nueva actividad
          </button>
        </div>
      </header>

      <Section title="Actividades" icon={<ClipboardList className="w-5 h-5 text-indigo-600" />}>
        {actividades.length ? <Pills /> : <p className="text-gray-500">Aún no hay actividades creadas.</p>}
      </Section>

      {tab === "crear" && canCreate && (
        <Section
          title="Configurar nueva actividad / sesión"
          icon={<NotebookPen className="w-5 h-5 text-indigo-600" />}
          right={<button onClick={handleSave} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:opacity-90"><Save className="w-4 h-4"/>Guardar</button>}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Ej: Comunidades de aprendizaje 1" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Área de trabajo (Dimensión PME)</label>
              <select value={dimension} onChange={e=>{ setDimension(e.target.value); const first = (PME_DIMENSIONES[e.target.value]||[])[0]; setSubdimension(first || ""); }} className="w-full border rounded-lg px-3 py-2 bg-white">
                {Object.keys(PME_DIMENSIONES).map((d)=>(<option key={d} value={d}>{d}</option>))}
              </select>
              <select value={subdimension} onChange={e=>setSubdimension(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white">
                {subdims.map((s)=>(<option key={s} value={s}>{s}</option>))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Creador • Perfil</label>
              <select value={creadorPerfil} onChange={e=>setCreadorPerfil(e.target.value as PerfilCreador)} className="w-full border rounded-lg px-3 py-2 bg-white">
                {PERFILES_CREADORES_DPD.map(p=>(<option key={p} value={p}>{p}</option>))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Creador • Usuario</label>
              <select value={creadorId} onChange={e=>{ 
                  setCreadorId(e.target.value); 
                  const u = usuariosCandidatos.find(x=>x.id===e.target.value);
                  setCreadorNombre(u?.nombre || "");
                }} className="w-full border rounded-lg px-3 py-2 bg-white">
                <option value="">Seleccione…</option>
                {usuariosCandidatos
                  .filter(u => u.profile === creadorPerfil)
                  .map(u => (<option key={u.id} value={u.id}>{u.nombre}</option>))
                }
              </select>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-semibold mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Preguntas</h4>
            <div className="flex flex-wrap gap-2 mb-3">
              <button onClick={addOpenQuestion} className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90"><Plus className="w-4 h-4"/> Abierta</button>
              <button onClick={addChoiceQuestion} className="inline-flex items-center gap-2 bg-sky-600 text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90"><Plus className="w-4 h-4"/> Selección múltiple</button>

              <div className="ms-auto flex items-center gap-2">
                <input value={aiTema} onChange={e=>setAiTema(e.target.value)} placeholder="Tema para IA (p. ej., evaluación formativa)" className="border rounded-lg px-3 py-1.5"/>
                <input type="number" min={1} max={10} value={aiCantidad} onChange={e=>setAiCantidad(parseInt(e.target.value||"1"))} className="w-20 border rounded-lg px-3 py-1.5"/>
                <button onClick={handleAIGenerate} disabled={aiBusy || !aiTema} className="inline-flex items-center gap-2 bg-fuchsia-600 text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90 disabled:opacity-50">
                  <Sparkles className="w-4 h-4"/>{aiBusy ? "Generando…" : "Generar con IA"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {preguntas.map((q, idx) => (
                <div key={q.id} className="border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">#{idx+1} • {q.tipo === "abierta" ? "Abierta" : "Selección múltiple"}</span>
                    <button className="text-red-600 hover:text-red-700" onClick={()=>removeQuestion(q.id)} title="Eliminar"><Trash2 className="w-4 h-4"/></button>
                  </div>

                  <input value={q.enunciado} onChange={e=>updateQuestion(q.id, { enunciado: e.target.value } as any)} className="w-full border rounded-lg px-3 py-2 mb-2" />

                  {q.tipo === "abierta" ? (
                    <div className="flex items-center gap-3">
                      <label className="text-sm">Máx. palabras</label>
                      <input type="number" min={50} max={1000} value={q.maxPalabras || 500} onChange={e=>updateQuestion(q.id, { maxPalabras: parseInt(e.target.value || "500") } as any)} className="w-24 border rounded-lg px-2 py-1"/>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <label className="text-sm">Permitir selección múltiple</label>
                        <input type="checkbox" checked={q.multiple ?? true} onChange={e=>updateQuestion(q.id, { multiple: e.target.checked } as any)} />
                      </div>
                      {q.opciones.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input value={opt} onChange={e=>{
                            const opts = [...q.opciones]; opts[i] = e.target.value;
                            updateQuestion(q.id, { opciones: opts } as any);
                          }} className="flex-1 border rounded-lg px-3 py-1.5"/>
                          <button onClick={()=>{
                            const opts = q.opciones.filter((_,ii)=>ii!==i);
                            updateQuestion(q.id, { opciones: opts } as any);
                          }} className="text-red-600"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      ))}
                      <button onClick={()=>{
                        updateQuestion(q.id, { opciones: [...(q as any).opciones, `Opción ${q.opciones.length+1}`] } as any);
                      }} className="text-sm text-sky-700 hover:underline">+ Añadir opción</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {tab === "responder" && selectedActivity && (
        <Section title={`Responder: ${selectedActivity.titulo}`} icon={<Users className="w-5 h-5 text-indigo-600" />} right={
          <button onClick={handleSubmitRespuestas} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:opacity-90"><Save className="w-4 h-4"/>Enviar respuestas</button>
        }>
          <div className="grid gap-4">
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <Info pill label="Dimensión" value={selectedActivity.dimension}/>
              <Info pill label="Subdimensión" value={selectedActivity.subdimension}/>
              <Info pill label="Creador" value={`${selectedActivity.creadorNombre} • ${selectedActivity.creadorPerfil}`}/>
            </div>

            {selectedActivity.preguntas.map((q, idx) => (
              <div key={q.id} className="border rounded-xl p-3">
                <p className="font-medium mb-2">{idx+1}. {q.enunciado}</p>
                {q.tipo === "abierta" ? (
                  <div>
                    <textarea
                      rows={5}
                      value={respuestas[q.id]?.valorTexto || ""}
                      onChange={(e) => handleChangeRespuesta(q, e.target.value)}
                      placeholder={`Máximo ${q.maxPalabras || MAX_WORDS} palabras…`}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {countWords(respuestas[q.id]?.valorTexto || "")} / {q.maxPalabras || MAX_WORDS} palabras
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(q as any).opciones.map((opt: string) => {
                      const selected: string[] = respuestas[q.id]?.seleccionados || [];
                      const checked = selected.includes(opt);
                      const toggle = () => {
                        let next = new Set(selected);
                        if (checked) next.delete(opt); else {
                          if (q.multiple) next.add(opt);
                          else next = new Set([opt]);
                        }
                        handleChangeRespuesta(q, Array.from(next));
                      };
                      return (
                        <label key={opt} className="inline-flex items-center gap-2 cursor-pointer">
                          <input type={q.multiple ? "checkbox" : "radio"} checked={checked} onChange={toggle} />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === "dashboard" && selectedActivity && (
        <Section title={`Dashboard: ${selectedActivity.titulo}`} icon={<BarChart3 className="w-5 h-5 text-indigo-600" />}>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Gráficos de selección múltiple */}
            <div className="space-y-4">
              <h4 className="font-semibold">Resultados de selección múltiple</h4>
              {selectedActivity.preguntas.filter(q=>q.tipo==="seleccion_multiple").map((q) => (
                <div key={q.id} className="p-3 border rounded-xl">
                  <p className="font-medium mb-2">{q.enunciado}</p>
                  {Object.entries(choiceStats[q.id] || {}).map(([opt, count]) => (
                    <Bar key={opt} label={opt} value={count as number} />
                  ))}
                  <div className="text-xs text-gray-500 mt-1">Total respuestas: {respuestasActividad.length}</div>
                </div>
              ))}
              {selectedActivity.preguntas.filter(q=>q.tipo==="seleccion_multiple").length === 0 && (
                <p className="text-gray-500 text-sm">No hay preguntas de selección múltiple en esta actividad.</p>
              )}
            </div>

            {/* Nube de palabras de abiertas */}
            <div className="space-y-4">
              <h4 className="font-semibold">Conceptos clave (respuestas abiertas)</h4>
              {keywords.length ? (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((k) => (
                    <span key={k.keyword} className="rounded-full px-3 py-1 text-sm bg-indigo-50 text-indigo-700"
                      style={{ fontSize: `${12 + Math.round(k.score * 18)}px` }}>
                      {k.keyword}
                    </span>
                  ))}
                </div>
              ) : <p className="text-gray-500 text-sm">Aún no hay suficientes respuestas abiertas para mostrar conceptos.</p>}
            </div>
          </div>
        </Section>
      )}
    </div>
  );
};

// Subcomponentes simples
const Info: React.FC<{label: string; value: string; pill?: boolean}> = ({label, value, pill}) => (
  <div className="flex items-center gap-2">
    <span className="text-gray-500">{label}:</span>
    {pill ? <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs">{value}</span>
          : <span className="font-medium">{value}</span>}
  </div>
);

const Bar: React.FC<{label: string; value: number}> = ({label, value}) => {
  const pct = Math.min(100, value * 10); // escala simple
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span><span>{value}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-2 bg-indigo-600" style={{width: `${pct}%`}}></div>
      </div>
    </div>
  );
};

export default DesarrolloProfesionalDocente;
