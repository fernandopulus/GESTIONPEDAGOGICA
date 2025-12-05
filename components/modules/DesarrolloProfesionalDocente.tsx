// components/modules/DesarrolloProfesionalDocente.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactQuill from "../common/PatchedReactQuill";
import "react-quill/dist/quill.snow.css";
import {
  Layers,
  ClipboardList,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Users,
  BarChart3,
  NotebookPen,
  MessageSquare,
  FolderClosed,
  ChevronRight,
  CheckCircle2,
  Wand2,
  BookOpen,
  Brain,
  Target,
  Calendar,
  PieChart,
  UsersRound,
  ListChecks,
  ScrollText,
  GraduationCap,
  BrainCircuit,
  Download,
} from "lucide-react";
import jsPDF from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';
import UltraSafeRenderer from "../common/UltraSafeRenderer";

// === Integraciones que ya existen en tu proyecto (NO cambiar rutas) ===
import {
  DPDActivity,
  DPDQuestion,
  DPDRespuesta,
  PerfilCreador,
  subscribeToActividades,
  subscribeToUsuariosByPerfiles,
  subscribeToRespuestasByActividad,
  createActividad,
  updateActividad,
  deleteActividad,
  createRespuesta,
  countWords,
} from "../../src/firebaseHelpers/desarrolloProfesionalHelper";

import { generateMultipleChoiceQuestionsWithAI, extractKeywordsWithAI } from "../../src/ai/geminiHelper";
import { PME_DIMENSIONES, PERFILES_CREADORES_DPD } from "../../constants";
import { User } from "../../types";

/* -------------------------------------------------------------------------- */
/*                         Tipos y utilidades del módulo                      */
/* -------------------------------------------------------------------------- */

type Tab = "responder" | "dashboard" | "crear" | "respuestas_individuales" | "documentacion";

const MAX_WORDS = 500;
const KEYWORD_STOPWORDS = new Set([
  "y", "o", "u", "de", "del", "la", "las", "el", "los", "un", "una", "que", "para", "con", "sin", "sobre", "entre",
  "por", "en", "se", "ser", "estar", "haber", "tener", "hacer", "realizar", "aplicar", "utilizar", "usar", "ver",
  "analizar", "comprender", "reflexionar", "trabajar", "desarrollar", "generar", "mejorar", "lograr", "pensar",
  "poder", "permitir", "crear", "obtener", "saber"
]);

const sanitizeKeywords = (items: { keyword: string; score: number }[]): { keyword: string; score: number }[] => {
  const normalize = (word: string) => word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const cleaned = items
    .map((item) => {
      const tokens = normalize(item.keyword)
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
      const filteredTokens = tokens.filter((token) => !KEYWORD_STOPWORDS.has(token));
      if (!filteredTokens.length) return null;
      const rebuilt = filteredTokens
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ");
      return rebuilt.trim().length >= 3 ? { keyword: rebuilt, score: item.score } : null;
    })
    .filter((item): item is { keyword: string; score: number } => Boolean(item));

  const unique = new Map<string, { keyword: string; score: number }>();
  cleaned.forEach((item) => {
    if (!unique.has(item.keyword)) {
      unique.set(item.keyword, item);
    }
  });
  return Array.from(unique.values());
};

const richTextModules = {
  toolbar: [
    [{ font: [] }],
    [{ size: [] }],
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'clean'],
  ],
};

const richTextFormats = [
  'header',
  'font',
  'size',
  'bold',
  'italic',
  'underline',
  'color',
  'background',
  'list',
  'bullet',
  'link',
];

const htmlToPlainText = (value: string): string => {
  if (!value) return "";
  return value
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>(?!\n)/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const hasRichContent = (value: string): boolean => htmlToPlainText(value).length > 0;

type ExtendedDPDQuestion =
  | {
      id: string;
      tipo: "abierta";
      enunciado: string;
      maxPalabras?: number;
    }
  | {
      id: string;
      tipo: "seleccion_multiple";
      enunciado: string;
      opciones: Array<{ id: string; text: string }>;
      multiple?: boolean;
    };

interface Props {
  currentUser: User;
}

interface FormState {
  titulo: string;
  dimension: string;
  subdimension: string;
  creadorPerfil: PerfilCreador;
  creadorId: string;
  creadorNombre: string;
  orientaciones: string;
  preguntas: ExtendedDPDQuestion[];
  aiTema: string;
  aiCantidad: number;
}

const defaultForm = (): FormState => ({
  titulo: "",
  dimension: "Liderazgo Curricular",
  subdimension: "Planificación y organización del currículo",
  creadorPerfil: "PROFESORADO",
  creadorId: "",
  creadorNombre: "",
   orientaciones: "",
  preguntas: [],
  aiTema: "",
  aiCantidad: 3,
});

const fetchImageAsDataURL = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar la imagen (${response.status})`);
  }
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/* -------------------------------------------------------------------------- */
/*                     Subcomponentes ESTABLES (fuera)                        */
/* -------------------------------------------------------------------------- */

const Section: React.FC<{
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = React.memo(({ title, icon, right, children }) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {right}
      </header>
      {children}
    </section>
  );
});

const Tabs: React.FC<{
  value: Tab;
  onChange: (t: Tab) => void;
  canCreate: boolean;
  onGoToDocumentacion: () => void;
}> = React.memo(({ value, onChange, canCreate, onGoToDocumentacion }) => {
  const btn = (t: Tab, label: string) => (
    <button
      key={t}
      onClick={() => onChange(t)}
      className={`px-3 py-1.5 rounded-lg text-sm border transition ${
        value === t
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white hover:bg-indigo-50"
      }`}
      disabled={t === "crear" && !canCreate}
      title={t === "crear" && !canCreate ? "Tu perfil no crea actividades" : ""}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {btn("responder", "Responder")}
      {btn("dashboard", "Dashboard")}
      {btn("crear", "Nueva actividad")}
      <button
        key="documentacion"
        onClick={onGoToDocumentacion}
        className={`px-3 py-1.5 rounded-lg text-sm border transition ${
          value === "documentacion"
            ? "bg-indigo-600 text-white border-indigo-600"
            : "bg-white hover:bg-indigo-50"
        }`}
      >
        Ver Documentación
      </button>
    </div>
  );
});

const VerticalList: React.FC<{
  items: DPDActivity[];
  selectedId: string;
  onSelect: (id: string) => void;
  canDelete: (a: DPDActivity) => boolean;
  onDelete: (id: string, titulo: string) => void;
}> = React.memo(({ items, selectedId, onSelect, canDelete, onDelete }) => {
  if (!items.length) {
    return (
      <div className="p-4 text-sm text-slate-500 flex items-center gap-2">
        <FolderClosed className="w-4 h-4" /> Aún no hay actividades creadas.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const active = a.id === selectedId;
        return (
          <li key={a.id}>
            <button
              onClick={() => onSelect(a.id)}
              className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                active
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white hover:bg-indigo-50"
              }`}
              title={`${a.titulo} • ${a.dimension} / ${a.subdimension}`}
            >
              <span className="inline-flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                <span className="font-medium">{a.titulo}</span>
              </span>
              <ChevronRight className="w-4 h-4 opacity-70" />
            </button>
            {canDelete(a) && (
              <button
                onClick={() => onDelete(a.id, a.titulo)}
                className="mt-1 text-xs text-red-600 hover:underline"
                title="Eliminar actividad"
              >
                Eliminar
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
});

const InfoRow: React.FC<{ label: string; value: string; pill?: boolean }> = React.memo(
  ({ label, value, pill }) => (
    <div className="flex items-center gap-2">
      <span className="text-slate-500">{label}:</span>
      {pill ? (
        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs">
          {value}
        </span>
      ) : (
        <span className="font-medium">{value}</span>
      )}
    </div>
  )
);

const StatBar: React.FC<{ label: string; value: number; total?: number }> = React.memo(
  ({ label, value, total = 0 }) => {
    const percentage = total > 0 ? (value / total) * 100 : (value > 0 ? 100 : 0);
    const gradientColor = percentage >= 75 ? 'from-emerald-500' :
                         percentage >= 50 ? 'from-blue-500' :
                         percentage >= 25 ? 'from-amber-500' : 'from-rose-500';
    return (
      <div className="relative mt-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <span className="text-sm font-medium text-slate-700">{value}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full bg-gradient-to-r ${gradientColor} to-transparent transition-all duration-500`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          >
          </div>
        </div>
      </div>
    );
    const pct = Math.min(100, value * 10);
    return (
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span>{label}</span>
          <span>{value}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-2 bg-indigo-600" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
);

const OptionRow: React.FC<{
  option: { id: string; text: string };
  options: Array<{ id: string; text: string }>;
  onChangeText: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}> = React.memo(({ option, options, onChangeText, onDelete }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChangeText(option.id, e.target.value),
    [option.id, onChangeText]
  );
  const handleDelete = useCallback(() => onDelete(option.id), [option.id, onDelete]);

  return (
    <div className="flex items-center gap-2">
      <input
        value={option.text}
        onChange={handleChange}
        className="flex-1 border rounded-lg px-3 py-1.5"
        placeholder={`Opción ${options.findIndex((o) => o.id === option.id) + 1}`}
      />
      <button onClick={handleDelete} className="text-red-600 hover:text-red-700" title="Eliminar opción">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
});

const QuestionEditorCard: React.FC<{
  q: ExtendedDPDQuestion;
  index: number;
  onRemove: (id: string) => void;
  onPatch: (id: string, patch: Partial<ExtendedDPDQuestion>) => void;
}> = React.memo(({ q, index, onRemove, onPatch }) => {
  const onChangeEnunciado = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onPatch(q.id, { enunciado: e.target.value }),
    [q.id, onPatch]
  );
  const onChangeMax = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onPatch(q.id, { maxPalabras: parseInt(e.target.value || "500") }),
    [q.id, onPatch]
  );
  const onToggleMultiple = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onPatch(q.id, { multiple: e.target.checked }),
    [q.id, onPatch]
  );
  const addOption = useCallback(
    () => onPatch(q.id, { opciones: [...q.opciones, { id: crypto.randomUUID(), text: "" }] }),
    [q.id, q.opciones, onPatch]
  );

  const changeOptionText = useCallback(
    (optId: string, text: string) => {
      onPatch(q.id, { opciones: q.opciones.map((o) => (o.id === optId ? { ...o, text } : o)) });
    },
    [q.id, q.opciones, onPatch]
  );
  const deleteOption = useCallback(
    (optId: string) => onPatch(q.id, { opciones: q.opciones.filter((o) => o.id !== optId) }),
    [q.id, q.opciones, onPatch]
  );
  const handleRemove = useCallback(() => onRemove(q.id), [q.id, onRemove]);

  return (
    <div className="border rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-600">
          #{index + 1} • {q.tipo === "abierta" ? "Abierta" : "Selección múltiple"}
        </span>
        <button onClick={handleRemove} className="text-red-600 hover:text-red-700" title="Eliminar">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <input
        value={q.enunciado}
        onChange={onChangeEnunciado}
        className="w-full border rounded-lg px-3 py-2 mb-2"
        placeholder="Escribe el enunciado de la pregunta"
      />

      {q.tipo === "abierta" ? (
        <div className="flex items-center gap-3">
          <label className="text-sm">Máx. palabras</label>
          <input
            type="number"
            min={50}
            max={1000}
            value={q.maxPalabras || MAX_WORDS}
            onChange={onChangeMax}
            className="w-24 border rounded-lg px-2 py-1"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={q.multiple ?? true} onChange={onToggleMultiple} /> Permitir selección múltiple
          </label>

          {q.opciones.map((opt) => (
            <OptionRow
              key={opt.id}
              option={opt}
              options={q.opciones}
              onChangeText={changeOptionText}
              onDelete={deleteOption}
            />
          ))}

          <button onClick={addOption} className="text-sm text-sky-700 hover:underline">
            + Añadir opción
          </button>
        </div>
      )}
    </div>
  );
});

const AnswerCard: React.FC<{
  q: DPDQuestion;
  respuestas: Record<string, any>;
  onChange: (q: DPDQuestion, value: any) => void;
}> = React.memo(({ q, respuestas, onChange }) => {
  const onRichTextChange = useCallback((content: string) => onChange(q, content), [q, onChange]);

  if (q.tipo === "abierta") {
    const val = respuestas[q.id]?.valorTexto || "";
    const plainText = htmlToPlainText(val);
    const totalWords = countWords(plainText);
    return (
      <div className="border rounded-xl p-3">
        <p className="font-medium mb-2">{q.enunciado}</p>
        <ReactQuill
          theme="snow"
          value={val}
          onChange={onRichTextChange}
          modules={richTextModules}
          formats={richTextFormats}
          placeholder={`Máximo ${q.maxPalabras || MAX_WORDS} palabras…`}
        />
        <div className="text-xs text-slate-500 mt-1">
          {totalWords} / {q.maxPalabras || MAX_WORDS} palabras
        </div>
      </div>
    );
  }

  const selected: string[] = respuestas[q.id]?.seleccionados || [];
  const toggle = (opt: string) => {
    let next = new Set(selected);
    if (selected.includes(opt)) next.delete(opt);
    else {
      if (q.multiple) next.add(opt);
      else next = new Set([opt]);
    }
    onChange(q, Array.from(next));
  };

  return (
    <div className="border rounded-xl p-3">
      <p className="font-medium mb-2">{q.enunciado}</p>
      <div className="flex flex-col gap-2">
        {(q.opciones || []).map((opt, idx) => {
          const isChecked = selected.includes(opt as string);
          return (
            <label key={`${q.id}-${idx}`} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type={q.multiple ? "checkbox" : "radio"}
                name={q.multiple ? `answer-${q.id}[]` : `answer-${q.id}`}
                checked={isChecked}
                onChange={() => toggle(opt as string)}
              />
              <span>{opt as string}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/*                            Componente principal                            */
/* -------------------------------------------------------------------------- */

const DesarrolloProfesionalDocente: React.FC<Props> = ({ currentUser }) => {
  // Estado base
  const [tab, setTab] = useState<Tab>("responder");
  const [actividades, setActividades] = useState<DPDActivity[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Form (estado local, no se toca al cambiar de pestaña)
  const [form, setForm] = useState<FormState>(defaultForm());
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const patchForm = useCallback((p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p })), []);

  // Usuarios para creador
  const [usuariosCandidatos, setUsuariosCandidatos] = useState<{ id: string; nombre: string; profile?: string }[]>([]);

  // Respuestas
  const [respuestas, setRespuestas] = useState<Record<string, any>>({});
  const [respuestasActividad, setRespuestasActividad] = useState<DPDRespuesta[]>([]);

  // Permisos
  const canCreate = PERFILES_CREADORES_DPD.includes((currentUser as any)?.profile) || (currentUser as any)?.isAdmin;

  /* ---------------------------- Suscripciones ---------------------------- */
  useEffect(() => {
    const unsub = subscribeToActividades((items) => {
      setActividades(items);
      setSelectedId((prev) => prev || (items[0]?.id ?? ""));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubUsers = subscribeToUsuariosByPerfiles(["PROFESORADO", "SUBDIRECCION"], (us) => {
      setUsuariosCandidatos(us);
      setForm((prev) => {
        if (prev.creadorId) return prev;
        const me = us.find((u) => u.id === (currentUser as any)?.uid);
        return me ? { ...prev, creadorId: me.id, creadorNombre: me.nombre, creadorPerfil: (me.profile as PerfilCreador) || prev.creadorPerfil } : prev;
      });
    });
    return () => unsubUsers();
  }, [currentUser]);

  useEffect(() => {
    if (!selectedId) return;
    const unsub = subscribeToRespuestasByActividad(selectedId, setRespuestasActividad);
    return () => unsub();
  }, [selectedId]);

  /* ----------------------------- Derivados ------------------------------ */
  const selectedActivity = useMemo(() => actividades.find((a) => a.id === selectedId), [actividades, selectedId]);
  const selectedOrientaciones = selectedActivity?.orientaciones || "";
  const hasOrientaciones = hasRichContent(selectedOrientaciones);
  const subdims = useMemo(() => PME_DIMENSIONES[form.dimension] || [], [form.dimension]);

  // Corrige subdimension cuando cambia dimension
  useEffect(() => {
    setForm((prev) => {
      const list = PME_DIMENSIONES[prev.dimension] || [];
      const fixed = list.includes(prev.subdimension) ? prev.subdimension : (list[0] || "");
      return fixed === prev.subdimension ? prev : { ...prev, subdimension: fixed };
    });
  }, [form.dimension]);

  /* ------------------------- Builder de preguntas ------------------------ */
  const addOpen = useCallback(() => {
    const q: ExtendedDPDQuestion = {
      id: crypto.randomUUID(),
      tipo: "abierta",
      enunciado: "Escribe aquí tu pregunta abierta",
      maxPalabras: MAX_WORDS
    };
    setForm((prev) => ({ ...prev, preguntas: [...prev.preguntas, q] }));
  }, []);

  const addChoice = useCallback(() => {
    const q: ExtendedDPDQuestion = {
      id: crypto.randomUUID(),
      tipo: "seleccion_multiple",
      enunciado: "Selecciona la(s) opción(es) que corresponda(n)",
      opciones: [
        { id: crypto.randomUUID(), text: "Opción 1" },
        { id: crypto.randomUUID(), text: "Opción 2" },
        { id: crypto.randomUUID(), text: "Opción 3" },
        { id: crypto.randomUUID(), text: "Opción 4" },
      ],
      multiple: true,
    };
    setForm((prev) => ({ ...prev, preguntas: [...prev.preguntas, q] }));
  }, []);

  const patchQuestion = useCallback((id: string, patch: Partial<ExtendedDPDQuestion>) => {
    setForm((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((q) => (q.id === id ? ({ ...q, ...patch } as ExtendedDPDQuestion) : q)),
    }));
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setForm((prev) => ({ ...prev, preguntas: prev.preguntas.filter((q) => q.id !== id) }));
  }, []);

  /* ---------------------------- IA y análisis --------------------------- */
  const [aiBusy, setAiBusy] = useState(false);
  const handleAIGenerate = useCallback(async () => {
    if (!form.aiTema || form.aiCantidad < 1) return;
    setAiBusy(true);
    try {
      const items = await generateMultipleChoiceQuestionsWithAI(form.aiTema, form.aiCantidad);
      const mapped: ExtendedDPDQuestion[] = items.map((it) => ({
        id: crypto.randomUUID(),
        tipo: "seleccion_multiple",
        enunciado: it.enunciado,
        opciones: it.opciones.slice(0, 5).map((t) => ({ id: crypto.randomUUID(), text: t })),
        multiple: true,
      }));
      setForm((prev) => ({ ...prev, preguntas: [...prev.preguntas, ...mapped] }));
    } finally {
      setAiBusy(false);
    }
  }, [form.aiTema, form.aiCantidad]);

  const [keywords, setKeywords] = useState<{ keyword: string; score: number }[]>([]);
  useEffect(() => {
    const run = async () => {
      if (!selectedActivity) return;
      const allOpen: string[] = [];
      
      for (const r of respuestasActividad) {
        if (!r.respuestas) continue;
        
        for (const [qid, val] of Object.entries(r.respuestas)) {
          const q = selectedActivity.preguntas.find((x) => x.id === qid);
          if (!q || q.tipo !== "abierta") continue;
          
          const respuesta = val as { tipo: "abierta"; valorTexto: string };
          if (respuesta.tipo === "abierta") {
            const plain = htmlToPlainText(respuesta.valorTexto || "");
            if (plain) {
              allOpen.push(plain);
            }
          }
        }
      }

      console.log('Respuestas abiertas encontradas:', allOpen.length);
      
      if (allOpen.length > 0) {
        try {
          const kws = await extractKeywordsWithAI(allOpen, 30);
          console.log('Keywords generadas:', kws);
          setKeywords(sanitizeKeywords(kws));
        } catch (error) {
          console.error('Error al extraer keywords:', error);
          setKeywords([]);
        }
      } else {
        setKeywords([]);
      }
    };
    run();
  }, [selectedActivity, respuestasActividad]);

  const choiceStats = useMemo(() => {
    if (!selectedActivity) return {};
    const stats: Record<string, Record<string, number>> = {};
    for (const q of selectedActivity.preguntas) {
      if (q.tipo !== "seleccion_multiple") continue;
      stats[q.id] = {};
      (q.opciones || []).forEach((opt: any) => (stats[q.id][opt] = 0));
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

  /* ------------------------------ Guardado ------------------------------ */
  const convertToSaveFormat = useCallback((questions: ExtendedDPDQuestion[]): DPDQuestion[] => {
    return questions.map((q) => {
      if (q.tipo === "abierta") {
        return q;
      } else {
        return {
          ...q,
          opciones: q.opciones.map((o) => o.text)
        };
      }
    });
  }, []);

  const resetForm = useCallback(() => {
    setForm(defaultForm());
    setEditingActivityId(null);
  }, []);

  // Cargar una actividad existente en el formulario para edición
  const loadActivityIntoForm = useCallback((activity: DPDActivity) => {
    setForm({
      titulo: activity.titulo,
      dimension: activity.dimension,
      subdimension: activity.subdimension,
      creadorPerfil: activity.creadorPerfil,
      creadorId: activity.creadorId,
      creadorNombre: activity.creadorNombre,
      orientaciones: (activity as any).orientaciones || "",
      preguntas: (activity.preguntas || []).map((q) => {
        if (q.tipo === "abierta") return q as any;
        return {
          ...q,
          opciones: (q.opciones || []).map((text) => ({ id: crypto.randomUUID(), text })),
        } as any;
      }),
      aiTema: "",
      aiCantidad: 3,
    });
    setEditingActivityId(activity.id);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.titulo.trim()) return alert("Debes ingresar un título");
    if (!form.creadorId) return alert("Debes seleccionar un creador");

    const orientacionesHtml = form.orientaciones || "";
    const payload = {
      titulo: form.titulo,
      dimension: form.dimension,
      subdimension: form.subdimension,
      creadorId: form.creadorId,
      creadorNombre: form.creadorNombre,
      creadorPerfil: form.creadorPerfil,
      orientaciones: hasRichContent(orientacionesHtml) ? orientacionesHtml : "",
      preguntas: convertToSaveFormat(form.preguntas),
    };
    const activityBeingEdited = editingActivityId
      ? actividades.find((a) => a.id === editingActivityId)
      : null;

    if (activityBeingEdited) {
      const currentUserId = (currentUser as any)?.uid || (currentUser as any)?.id;
      const isAdmin = Boolean((currentUser as any)?.isAdmin);
      const isCreator = Boolean(currentUserId && activityBeingEdited.creadorId === currentUserId);
      if (!isAdmin && !isCreator) {
        alert("Solo el creador o un administrador puede actualizar esta actividad.");
        return;
      }
      await updateActividad(activityBeingEdited.id, payload as any);
      resetForm();
      setTab("responder");
    } else {
      const id = await createActividad(payload as any);
      resetForm();
      setSelectedId(id);
      setTab("responder");
    }
  }, [form, convertToSaveFormat, resetForm, actividades, editingActivityId, currentUser]);

  const handleDeleteActivity = useCallback(
    async (activityId: string, titulo: string) => {
      const ok = window.confirm(
        `¿Eliminar "${titulo}"?\nSe eliminarán la actividad, sus preguntas y respuestas. Esta acción no se puede deshacer.`
      );
      if (!ok) return;
      await deleteActividad(activityId);
      if (selectedId === activityId) {
        const next = actividades.filter((a) => a.id !== activityId);
        setSelectedId(next[0]?.id || "");
        if (!next.length) setTab("crear");
      }
      alert("Actividad eliminada.");
    },
    [selectedId, actividades]
  );

  // Función para descargar el informe en PDF
  const downloadReport = useCallback(async () => {
    if (!selectedActivity || !respuestasActividad.length) return;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'legal' });
    const margin = 10;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yCursor = margin;

    let logoLeft: string | null = null;
    let logoRight: string | null = null;
    try {
      const [left, right] = await Promise.all([
        fetchImageAsDataURL('https://res.cloudinary.com/dwncmu1wu/image/upload/v1764096456/Captura_de_pantalla_2025-11-25_a_la_s_3.47.16_p._m._p7m2xy.png'),
        fetchImageAsDataURL('https://res.cloudinary.com/dwncmu1wu/image/upload/v1753209432/LIR_fpq2lc.png')
      ]);
      logoLeft = left;
      logoRight = right;
    } catch (error) {
      console.error('No se pudieron cargar los logos del informe DPD:', error);
    }

    const placeLogo = (data: string | null, x: number) => {
      if (!data) return;
      pdf.addImage(data, 'PNG', x, yCursor, 15, 20);
    };

    placeLogo(logoLeft, margin);
    placeLogo(logoRight, pageWidth - margin - 15);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Informe Global de Desarrollo Profesional Docente', pageWidth / 2, yCursor + 9, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(selectedActivity.titulo, pageWidth / 2, yCursor + 17, { align: 'center' });
    yCursor += 26;
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    const fechaEmision = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    pdf.text(`Emitido el ${fechaEmision}`, pageWidth / 2, yCursor, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    yCursor += 8;

    const ensureSpace = (height: number) => {
      if (yCursor + height > pageHeight - margin) {
        pdf.addPage();
        yCursor = margin;
      }
    };

    const addSectionTitle = (title: string) => {
      ensureSpace(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(title, margin, yCursor);
      yCursor += 6;
    };

    const addTable = (options: UserOptions) => {
      autoTable(pdf, {
        startY: yCursor,
        margin: { left: margin, right: margin },
        styles: { fontSize: 10, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
        ...options,
      });
      yCursor = (pdf as any).lastAutoTable.finalY + 8;
    };

    const orientaciones = htmlToPlainText((selectedActivity as any)?.orientaciones || '');
    const planningRows = [
      ['Título de la unidad', selectedActivity.titulo],
      ['Dimensión', selectedActivity.dimension],
      ['Subdimensión', selectedActivity.subdimension],
      ['Perfil que crea la actividad', `${selectedActivity.creadorNombre} (${selectedActivity.creadorPerfil})`],
      ['Total de preguntas', `${selectedActivity.preguntas.length}`],
      ['Total de respuestas', `${respuestasActividad.length}`],
      ['Orientaciones metodológicas', orientaciones || '—'],
    ];

    addSectionTitle('Planificación de la unidad');
    addTable({ head: [['Elemento', 'Detalle']], body: planningRows });

    const questionRows = selectedActivity.preguntas.map((pregunta, idx) => {
      const tipo = pregunta.tipo === 'seleccion_multiple' ? 'Selección múltiple' : 'Pregunta abierta';
      const detalles = pregunta.tipo === 'seleccion_multiple'
        ? ((pregunta as any).opciones || []).join('\n')
        : (pregunta.maxPalabras ? `Límite: ${pregunta.maxPalabras} palabras` : 'Sin límite definido');
      return [`P${idx + 1}`, tipo, pregunta.enunciado, detalles || '—'];
    });

    addSectionTitle('Preguntas planificadas');
    addTable({
      head: [['#', 'Tipo', 'Enunciado', 'Detalles']],
      body: questionRows.length ? questionRows : [['—', '—', 'No hay preguntas registradas', '—']],
      styles: { fontSize: 9 },
    });

    addSectionTitle('Resultados por pregunta');
    selectedActivity.preguntas.forEach((pregunta, idx) => {
      ensureSpace(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(`${idx + 1}. ${pregunta.enunciado}`, margin, yCursor);
      yCursor += 6;

      if (pregunta.tipo === 'seleccion_multiple') {
        const stats = choiceStats[pregunta.id] || {};
        const total = respuestasActividad.length || 1;
        const rows = Object.entries(stats).map(([opcion, count]) => {
          const porcentaje = Math.round(((count as number) / total) * 100);
          return [opcion, String(count), `${porcentaje}%`];
        });
        addTable({
          head: [['Opción', 'Respuestas', '%']],
          body: rows.length ? rows : [['Sin respuestas registradas', '0', '0%']],
        });
      } else {
        const rows: string[][] = [];
        respuestasActividad.forEach((respuesta) => {
          const registro = respuesta.respuestas[pregunta.id];
          if (registro?.tipo === 'abierta' && registro.valorTexto) {
            rows.push([respuesta.userNombre || 'Participante', htmlToPlainText(registro.valorTexto)]);
          }
        });
        addTable({
          head: [['Participante', 'Respuesta']],
          body: rows.length ? rows : [['—', 'Sin respuestas registradas']],
          styles: { fontSize: 9 },
        });
      }
    });

    if (keywords.length) {
      addSectionTitle('Conceptos clave detectados');
      const keywordRows = keywords.map((item) => [
        item.keyword,
        `${Math.round(item.score * 100)}%`,
      ]);
      addTable({
        head: [['Concepto', 'Relevancia']],
        body: keywordRows,
      });
    }

    pdf.save(`informe_${selectedActivity.titulo.replace(/\s+/g, '_')}.pdf`);
  }, [selectedActivity, respuestasActividad, choiceStats, keywords]);

  const canDelete = useCallback(
    (a: DPDActivity) => {
      const isAdmin = (currentUser as any)?.isAdmin;
      const isCreator = a.creadorId === (currentUser as any)?.uid;
      return isAdmin || isCreator;
    },
    [currentUser]
  );

  /* ------------------------------ Responder ----------------------------- */
  const changeRespuesta = useCallback((q: DPDQuestion, value: any) => {
    setRespuestas((prev) => ({
      ...prev,
      [q.id]:
        q.tipo === "abierta"
          ? { tipo: "abierta", valorTexto: value }
          : { tipo: "seleccion_multiple", seleccionados: value },
    }));
  }, []);

  const submitRespuestas = useCallback(async () => {
    if (!selectedActivity) return;

    for (const q of selectedActivity.preguntas) {
      const r = (respuestas as any)[q.id];
      if (!r) continue;
      if (q.tipo === "abierta" && q.maxPalabras) {
        const words = countWords(htmlToPlainText(r.valorTexto || ""));
        if (words > q.maxPalabras) {
          return alert(
            `La respuesta a "${q.enunciado}" supera el máximo de ${q.maxPalabras} palabras (${words}).`
          );
        }
      }
    }

    await createRespuesta({
      activityId: selectedActivity.id,
      userId: (currentUser as any)?.uid || "anon",
      userNombre:
        (currentUser as any)?.displayName ||
        (currentUser as any)?.name ||
        "Anónimo",
      respuestas,
    } as any);

    setRespuestas({});
    alert("¡Respuestas enviadas!");
  }, [selectedActivity, respuestas, currentUser]);

  // Navegación rápida al módulo Documentación (usa el estado global gestionado por Dashboard)
  const goToDocumentacion = useCallback(() => {
    try {
      // 1. Disparar evento para cambio inmediato si el componente está montado
      const ev = new CustomEvent('gp:navigate-module', { detail: { moduleName: 'Documentación' } });
      window.dispatchEvent(ev);
      
      // 2. Actualizar hash para persistencia y deep-linking
      window.location.hash = 'documentacion';
    } catch (e) {
      console.warn('No se pudo solicitar navegación a Documentación', e);
    }
  }, []);

  /* ------------------------------- Render ------------------------------- */
  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Layers className="w-7 h-7 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold">Desarrollo Profesional Docente</h2>
            <p className="text-sm text-slate-600">
              Crea sesiones, responde y explora insights en tiempo real.
            </p>
          </div>
        </div>
        <Tabs value={tab} onChange={setTab} canCreate={canCreate} onGoToDocumentacion={goToDocumentacion} />
      </header>

      {/* Layout principal: lista de actividades a la izquierda y contenido a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 xl:col-span-3">
          <Section title="Actividades" icon={<ClipboardList className="w-5 h-5 text-indigo-600" />}>
            <VerticalList
              items={actividades}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setTab("responder");
              }}
              canDelete={canDelete}
              onDelete={handleDeleteActivity}
            />
            {selectedActivity && canCreate && (
              <div className="mt-4 border-t pt-3 border-slate-200">
                <button
                  onClick={() => {
                    loadActivityIntoForm(selectedActivity);
                    setTab("crear");
                  }}
                  className="inline-flex items-center gap-2 text-xs font-medium text-indigo-700 hover:text-indigo-900"
                >
                  <NotebookPen className="w-4 h-4" />
                  Editar actividad seleccionada
                </button>
              </div>
            )}
          </Section>
        </aside>

        <main className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* CREAR */}
          {tab === "crear" && canCreate && (
            <Section
              title="Nueva actividad / sesión"
              icon={<NotebookPen className="w-5 h-5 text-indigo-600" />}
              right={
                <div className="flex flex-wrap items-center gap-2">
                  {editingActivityId && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
                      <NotebookPen className="w-3 h-3" /> Editando existente
                    </span>
                  )}
                  <button
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Nueva actividad
                  </button>
                  <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    <Save className="w-4 h-4" />
                    Guardar
                  </button>
                </div>
              }
            >
              {/* BASICOS */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Título</label>
                  <input
                    value={form.titulo}
                    onChange={(e) => patchForm({ titulo: e.target.value })}
                    placeholder="Ej: Comunidades de aprendizaje 1"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Área de trabajo (Dimensión PME)</label>
                  <select
                    value={form.dimension}
                    onChange={(e) => patchForm({ dimension: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    {Object.keys(PME_DIMENSIONES).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.subdimension}
                    onChange={(e) => patchForm({ subdimension: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    {(PME_DIMENSIONES[form.dimension] || []).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Creador • Perfil</label>
                  <select
                    value={form.creadorPerfil}
                    onChange={(e) => patchForm({ creadorPerfil: e.target.value as PerfilCreador })}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    {PERFILES_CREADORES_DPD.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Creador • Usuario</label>
                  <select
                    value={form.creadorId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const u = usuariosCandidatos.find((x) => x.id === id);
                      patchForm({ creadorId: id, creadorNombre: u?.nombre || "" });
                    }}
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">Seleccione…</option>
                    {usuariosCandidatos
                      .filter((u) => u.profile === form.creadorPerfil)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* ORIENTACIONES / INSTRUCCIONES PARA LA SESIÓN */}
              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <NotebookPen className="w-4 h-4 text-indigo-600" />
                  Orientaciones / instrucciones para la actividad
                </label>
                <p className="text-xs text-slate-500">
                  Espacio para que quien diseña la actividad deje indicaciones, objetivos específicos,
                  acuerdos previos o sugerencias de conducción de la sesión. Solo es editable por el
                  creador o perfiles con permisos.
                </p>
                <div className="border rounded-lg">
                  <ReactQuill
                    theme="snow"
                    value={form.orientaciones}
                    onChange={(value) => patchForm({ orientaciones: value })}
                    modules={richTextModules}
                    formats={richTextFormats}
                    placeholder="Ej.: Explicar el propósito de la sesión, acordar normas de participación, conectar con el PME o el plan de formación interna, etc."
                  />
                </div>
              </div>

              {/* PREGUNTAS */}
              <div className="mt-6">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Preguntas
                </h4>

                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={addOpen}
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90"
                  >
                    <Plus className="w-4 h-4" /> Abierta
                  </button>
                  <button
                    onClick={addChoice}
                    className="inline-flex items-center gap-2 bg-sky-600 text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90"
                  >
                    <Plus className="w-4 h-4" /> Selección múltiple
                  </button>

                  <div className="ms-auto flex items-center gap-2">
                    <div className="hidden md:inline-flex items-center gap-1 text-slate-500 text-xs">
                      <Wand2 className="w-4 h-4" /> IA
                    </div>
                    <input
                      value={form.aiTema}
                      onChange={(e) => patchForm({ aiTema: e.target.value })}
                      placeholder="Tema para IA (p. ej., evaluación formativa)"
                      className="border rounded-lg px-3 py-1.5"
                    />
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={form.aiCantidad}
                      onChange={(e) => patchForm({ aiCantidad: parseInt(e.target.value || "1") })}
                      className="w-20 border rounded-lg px-3 py-1.5"
                    />
                    <button
                      onClick={handleAIGenerate}
                      disabled={aiBusy || !form.aiTema}
                      className="inline-flex items-center gap-2 bg-fuchsia-600 text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      {aiBusy ? "Generando…" : "Generar con IA"}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {form.preguntas.map((q, idx) => (
                    <QuestionEditorCard key={q.id} q={q} index={idx} onRemove={removeQuestion} onPatch={patchQuestion} />
                  ))}
                  {form.preguntas.length === 0 && (
                    <div className="text-sm text-slate-500 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Añade preguntas abiertas o de selección múltiple (o usa IA).
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* RESPONDER */}
          {tab === "responder" && selectedActivity && (
            <Section
              title={`Responder: ${selectedActivity.titulo}`}
              icon={<Users className="w-5 h-5 text-indigo-600" />}
              right={
                <button
                  onClick={submitRespuestas}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:opacity-90"
                >
                  <Save className="w-4 h-4" />
                  Enviar respuestas
                </button>
              }
            >
              <div className="grid gap-4">
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <InfoRow pill label="Dimensión" value={selectedActivity.dimension} />
                  <InfoRow pill label="Subdimensión" value={selectedActivity.subdimension} />
                  <InfoRow pill label="Creador" value={`${selectedActivity.creadorNombre} • ${selectedActivity.creadorPerfil}`} />
                </div>

                {hasOrientaciones && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-slate-800">
                    <div className="flex items-center gap-2 mb-1">
                      <NotebookPen className="w-4 h-4 text-indigo-600" />
                      <span className="font-semibold">Orientaciones del creador para esta actividad</span>
                    </div>
                    <div className="text-xs md:text-sm text-slate-700 space-y-2 rich-text-content">
                      <UltraSafeRenderer content={selectedOrientaciones} context="dpd-orientaciones-responder" />
                    </div>
                  </div>
                )}

                {selectedActivity.preguntas.map((q) => (
                  <AnswerCard key={q.id} q={q} respuestas={respuestas} onChange={changeRespuesta} />
                ))}
              </div>
            </Section>
          )}

          {/* DASHBOARD */}
          {/* RESPUESTAS INDIVIDUALES */}
          {tab === "respuestas_individuales" && selectedActivity && (
            <Section
              title={`Respuestas individuales: ${selectedActivity.titulo}`}
              icon={<Users className="w-5 h-5 text-indigo-600" />}
              right={
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadReport}
                    disabled={!respuestasActividad.length}
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!respuestasActividad.length ? "No hay respuestas para generar informe" : "Descargar informe en PDF"}
                  >
                    <Download className="w-4 h-4" />
                    Descargar informe
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUserId("");
                      setTab("dashboard");
                    }}
                    className="inline-flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Volver al dashboard
                  </button>
                </div>
              }
            >
              <div className="grid md:grid-cols-12 gap-6">
                {/* Lista de usuarios que respondieron */}
                <div className="md:col-span-4 lg:col-span-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <UsersRound className="w-5 h-5 text-indigo-600" />
                      Usuarios ({respuestasActividad.length})
                    </h4>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                      {respuestasActividad.length > 0 ? (
                        respuestasActividad.map((respuesta) => (
                          <button
                            key={respuesta.userId}
                            onClick={() => setSelectedUserId(respuesta.userId)}
                            className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                              selectedUserId === respuesta.userId 
                                ? "bg-indigo-50 text-indigo-700 font-medium border border-indigo-200 shadow-sm" 
                                : "hover:bg-slate-50 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-indigo-100 rounded-lg">
                                <UsersRound className="w-4 h-4 text-indigo-600" />
                              </div>
                              <span className="font-medium">{respuesta.userNombre}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(respuesta.createdAt?.seconds * 1000).toLocaleDateString()}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          <UsersRound className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No hay respuestas todavía</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Respuestas del usuario seleccionado */}
                <div className="md:col-span-8 lg:col-span-9">
                  {selectedUserId ? (
                    <>
                      <h4 className="font-semibold mb-4 flex items-center gap-2 text-lg">
                        <NotebookPen className="w-5 h-5 text-indigo-600" />
                        Respuestas de:{" "}
                        <span className="text-indigo-600">
                          {respuestasActividad.find((r) => r.userId === selectedUserId)?.userNombre}
                        </span>
                      </h4>
                      <div className="space-y-6">
                        {selectedActivity.preguntas.map((pregunta) => {
                          const userRespuesta = respuestasActividad.find(
                            (r) => r.userId === selectedUserId
                          );
                          const respuesta = userRespuesta?.respuestas?.[pregunta.id];
                          
                          console.log('Respuesta encontrada:', {
                            preguntaId: pregunta.id,
                            tipo: pregunta.tipo,
                            respuesta: respuesta
                          });

                          return (
                            <div key={pregunta.id} className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
                              <div className="flex items-start gap-3 mb-4">
                                <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
                                  {pregunta.tipo === "abierta" ? (
                                    <ScrollText className="w-5 h-5 text-indigo-600" />
                                  ) : (
                                    <ListChecks className="w-5 h-5 text-indigo-600" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">{pregunta.enunciado}</p>
                                  <p className="text-sm text-slate-500 mt-1">
                                    {pregunta.tipo === "abierta" ? "Respuesta abierta" : "Selección múltiple"}
                                  </p>
                                </div>
                              </div>
                              
                              {pregunta.tipo === "abierta" ? (
                                respuesta?.tipo === "abierta" && respuesta.valorTexto ? (
                                  <div className="mt-3 bg-slate-50 rounded-lg p-4 text-sm text-slate-700 space-y-2 rich-text-content">
                                    <UltraSafeRenderer content={respuesta.valorTexto} context={`dpd-respuesta-individual-${pregunta.id}`} />
                                  </div>
                                ) : (
                                  <p className="text-slate-500 italic mt-3">Sin respuesta</p>
                                )
                              ) : (
                                <div className="space-y-2 mt-3">
                                  {(pregunta.opciones || []).map((opcion) => {
                                    const seleccionados = respuesta?.tipo === "seleccion_multiple" ? 
                                      respuesta.seleccionados || [] : [];
                                    const isSelected = seleccionados.includes(opcion.text);
                                    
                                    return (
                                      <div
                                        key={typeof opcion === 'string' ? opcion : opcion.id}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                                          isSelected
                                            ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                                            : "border-slate-200 text-slate-500"
                                        }`}
                                      >
                                        <div className="flex-shrink-0">
                                          {isSelected ? (
                                            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                          ) : (
                                            <div className="w-4 h-4 border-2 border-slate-300 rounded-full" />
                                          )}
                                        </div>
                                        <span className="text-sm">{typeof opcion === 'string' ? opcion : opcion.text}</span>
                                      </div>
                                    );
                                  })}
                                  {!respuesta && (
                                    <p className="text-slate-500 italic mt-1 text-sm">Sin respuesta</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-slate-500 py-12">
                      Selecciona un usuario para ver sus respuestas
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {tab === "dashboard" && selectedActivity && (
            <Section
              title={`Dashboard: ${selectedActivity.titulo}`}
              icon={<Brain className="w-5 h-5 text-indigo-600" />}
              right={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTab("respuestas_individuales")}
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <UsersRound className="w-4 h-4" />
                    Ver respuestas individuales
                  </button>
                  {canDelete(selectedActivity) && (
                    <button
                      onClick={() => handleDeleteActivity(selectedActivity.id, selectedActivity.titulo)}
                      className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar actividad
                    </button>
                  )}
                </div>
              }
            >
              {/* Botón de descarga + resumen de orientaciones */}
              <div className="mb-6 flex flex-col gap-4">
                <div>
                  <button
                    onClick={downloadReport}
                    disabled={!respuestasActividad.length}
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
                    title={!respuestasActividad.length ? "No hay respuestas para generar informe" : "Descargar informe en PDF"}
                  >
                    <Download className="w-5 h-5" />
                    Descargar Informe Global
                  </button>
                </div>

                {hasOrientaciones && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                    <div className="flex items-center gap-2 mb-1">
                      <NotebookPen className="w-4 h-4 text-indigo-600" />
                      <span className="font-semibold">Orientaciones del creador</span>
                    </div>
                    <div className="text-xs md:text-sm text-slate-700 space-y-2 rich-text-content">
                      <UltraSafeRenderer content={selectedOrientaciones} context="dpd-orientaciones-dashboard" />
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <UsersRound className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Total respuestas</p>
                      <p className="text-xl font-semibold">{respuestasActividad.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <ListChecks className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Preguntas</p>
                      <p className="text-xl font-semibold">{selectedActivity.preguntas.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <GraduationCap className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Creador</p>
                      <p className="text-sm font-medium truncate">{selectedActivity.creadorNombre}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Fecha</p>
                      <p className="text-sm font-medium">
                        {(() => {
                          const v: any = (selectedActivity as any).createdAt;
                          const d = v?.toDate ? v.toDate() : v?.seconds ? new Date(v.seconds * 1000) : v ? new Date(v) : null;
                          return d ? d.toLocaleDateString() : "No disponible";
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Resultados de selección múltiple */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <PieChart className="w-5 h-5 text-indigo-600" />
                    <h4 className="font-semibold">Resultados de selección múltiple</h4>
                  </div>
                  
                  <div className="space-y-4">
                    {selectedActivity.preguntas.filter((q) => q.tipo === "seleccion_multiple").map((q) => (
                      <div key={q.id} className="p-4 bg-slate-50 rounded-xl">
                        <p className="font-medium mb-3 text-slate-700">{q.enunciado}</p>
                        {Object.entries((choiceStats as any)[q.id] || {}).map(([opt, count]) => (
                          <StatBar key={opt} label={opt as string} value={count as number} />
                        ))}
                        <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          Total respuestas: {respuestasActividad.length}
                        </div>
                      </div>
                    ))}
                    {selectedActivity.preguntas.filter((q) => q.tipo === "seleccion_multiple").length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay preguntas de selección múltiple en esta actividad.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Conceptos clave */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BrainCircuit className="w-5 h-5 text-indigo-600" />
                    <h4 className="font-semibold">Conceptos clave (IA)</h4>
                  </div>
                  
                  {keywords.length ? (
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((k) => (
                        <span
                          key={k.keyword}
                          className="rounded-full px-3 py-1.5 text-sm bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-100 shadow-sm transition-transform hover:scale-105"
                          style={{ fontSize: `${12 + Math.round(k.score * 18)}px` }}
                        >
                          {k.keyword}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        Aún no hay suficientes respuestas abiertas para mostrar conceptos.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* El tab "documentacion" ahora redirige directo al módulo principal, por lo que no renderiza contenido propio aquí */}
        </main>
      </div>
    </div>
  );
};

export default DesarrolloProfesionalDocente;
