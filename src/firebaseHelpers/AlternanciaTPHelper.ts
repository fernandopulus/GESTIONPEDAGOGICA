import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Building2,
  Users2,
  Clock,
  Link2,
  Download,
  Plus,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Search,
  Filter,
  FileText,
  MapPin,
  BadgeCheck,
  School,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ------------------------------------------------------------
// AlternanciaTP.tsx
// Interfaz moderna y minimalista para gestionar programas de Alternancia TP
// - Tailwind + shadcn/ui + lucide-react + framer-motion
// - Accesible y preparada para dark mode
// ------------------------------------------------------------

// Tipos
export type Empresa = {
  id: string;
  nombre: string;
  rubro: string;
  comuna: string;
  contacto: string;
  cupos: number;
  estado: "activa" | "en evaluación" | "pausada";
  url?: string;
};

export type Cohorte = {
  id: string;
  nombre: string;
  especialidad: string;
  estudiantes: number;
  inicio: string; // ISO
  fin: string; // ISO
  avance: number; // 0-100
  empresaId?: string;
};

export type SemanaPlan = {
  semana: number;
  tipo: "Liceo" | "Empresa";
  foco: string;
};

// Mock data (ejemplo)
const EMPRESAS: Empresa[] = [
  {
    id: "e1",
    nombre: "MetalMaq SpA",
    rubro: "Metalmecánica",
    comuna: "Maipú",
    contacto: "mmartinez@metalmaq.cl",
    cupos: 8,
    estado: "activa",
    url: "https://example.com",
  },
  {
    id: "e2",
    nombre: "AutoTech Service",
    rubro: "Mecánica Automotriz",
    comuna: "Puente Alto",
    contacto: "rrhh@autotech.cl",
    cupos: 5,
    estado: "en evaluación",
  },
  {
    id: "e3",
    nombre: "Energía Andes",
    rubro: "Energía Solar",
    comuna: "Tiltil",
    contacto: "talento@energiaandes.cl",
    cupos: 10,
    estado: "activa",
  },
];

const COHORTES: Cohorte[] = [
  {
    id: "c1",
    nombre: "3°A - Mecánica Automotriz",
    especialidad: "Mecánica Automotriz",
    estudiantes: 32,
    inicio: "2025-03-10",
    fin: "2025-12-05",
    avance: 64,
    empresaId: "e2",
  },
  {
    id: "c2",
    nombre: "4°B - Mecánica Industrial (Maq-Herr)",
    especialidad: "Mecánica Industrial",
    estudiantes: 28,
    inicio: "2025-03-10",
    fin: "2025-12-05",
    avance: 48,
    empresaId: "e1",
  },
  {
    id: "c3",
    nombre: "4°C - Energías Renovables",
    especialidad: "Energía",
    estudiantes: 26,
    inicio: "2025-03-10",
    fin: "2025-12-05",
    avance: 22,
    empresaId: "e3",
  },
];

const PLAN_SEMANAL: SemanaPlan[] = [
  { semana: 1, tipo: "Liceo", foco: "Inducción, SST, cultura" },
  { semana: 2, tipo: "Empresa", foco: "Observación guiada" },
  { semana: 3, tipo: "Liceo", foco: "Competencias base + Bitácora" },
  { semana: 4, tipo: "Empresa", foco: "Tarea acotada + Mentoría" },
  { semana: 5, tipo: "Liceo", foco: "Evaluación formativa" },
  { semana: 6, tipo: "Empresa", foco: "Rotación de puesto" },
];

// Utilidades
const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="group relative overflow-hidden border-muted/40 bg-background/60 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="rounded-2xl border p-2 text-muted-foreground shadow-sm transition group-hover:scale-105">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmpresaPill({ empresa }: { empresa: Empresa }) {
  const color =
    empresa.estado === "activa"
      ? "success"
      : empresa.estado === "pausada"
      ? "secondary"
      : "warning";
  return (
    <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm">
      <Building2 className="h-4 w-4" />
      <span className="font-medium">{empresa.nombre}</span>
      <Badge variant={color as any} className="ml-auto">
        {empresa.estado}
      </Badge>
    </div>
  );
}

function TimeChip({ tipo }: { tipo: SemanaPlan["tipo"] }) {
  const bg = tipo === "Liceo" ? "bg-blue-500/10" : "bg-emerald-500/10";
  const dot = tipo === "Liceo" ? "bg-blue-500" : "bg-emerald-500";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full ${bg} px-3 py-1 text-xs font-medium`}> 
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {tipo}
    </span>
  );
}

export default function AlternanciaTP() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("cohortes");

  const filteredEmpresas = useMemo(() => {
    return EMPRESAS.filter((e) =>
      [e.nombre, e.rubro, e.comuna].join(" ").toLowerCase().includes(q.toLowerCase())
    );
  }, [q]);

  const filteredCohortes = useMemo(() => {
    return COHORTES.filter((c) =>
      [c.nombre, c.especialidad].join(" ").toLowerCase().includes(q.toLowerCase())
    );
  }, [q]);

  const totEstudiantes = COHORTES.reduce((a, c) => a + c.estudiantes, 0);
  const totCupos = EMPRESAS.reduce((a, e) => a + e.cupos, 0);

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Alternancia TP</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Diseña, gestiona y monitorea programas de formación en alternancia (liceo ↔ empresa). Minimalista, rápido y listo para trabajar.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline" className="gap-1"><School className="h-3 w-3"/> Liceo</Badge>
            <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3"/> Empresa</Badge>
            <Badge variant="outline" className="gap-1"><BadgeCheck className="h-3 w-3"/> MC TP-ready</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2"><Download className="h-4 w-4"/> Exportar</Button>
          <Button className="gap-2"><Plus className="h-4 w-4"/> Nuevo plan</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2"><Settings2 className="h-4 w-4"/> Ajustes</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Preferencias</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Etiquetas de color</DropdownMenuItem>
              <DropdownMenuItem>Campos personalizados</DropdownMenuItem>
              <DropdownMenuItem>Permisos</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users2} label="Estudiantes en alternancia" value={totEstudiantes} hint="Suma de cohortes activas" />
        <StatCard icon={Building2} label="Empresas vinculadas" value={EMPRESAS.length} hint={`${totCupos} cupos disponibles`} />
        <StatCard icon={Calendar} label="Semanas planificadas" value={PLAN_SEMANAL.length} hint="Ciclo vigente" />
        <StatCard icon={Clock} label="Cumplimiento promedio" value={`${Math.round(COHORTES.reduce((a,c)=>a+c.avance,0)/COHORTES.length)}%`} hint="Bitácora + evidencias" />
      </div>

      {/* Search & Tabs */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar cohortes, especialidad o empresas…"
                className="pl-9"
                aria-label="Buscar"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2"><Filter className="h-4 w-4"/> Filtros</Button>
              <Button variant="secondary" className="gap-2"><Link2 className="h-4 w-4"/> Vincular empresa</Button>
            </div>
          </div>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="cohortes">Cohortes</TabsTrigger>
              <TabsTrigger value="empresas">Empresas</TabsTrigger>
              <TabsTrigger value="plan">Plan semanal</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <Separator />

        {/* Tab content */}
        <CardContent className="pt-6">
          {tab === "cohortes" && (
            <div className="grid gap-4 md:grid-cols-3">
              {filteredCohortes.map((c) => {
                const empresa = EMPRESAS.find((e) => e.id === c.empresaId);
                return (
                  <Card key={c.id} className="border-muted/40">
                    <CardHeader className="space-y-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-base">{c.nombre}</CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5"/>
                            {c.especialidad}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="gap-1"><Users2 className="h-3 w-3"/>{c.estudiantes}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {empresa && <EmpresaPill empresa={empresa} />}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4"/>Inicio <span className="ml-auto text-foreground">{new Date(c.inicio).toLocaleDateString()}</span></div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4"/>Término <span className="ml-auto text-foreground">{new Date(c.fin).toLocaleDateString()}</span></div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Avance</span>
                          <span className="font-medium">{c.avance}%</span>
                        </div>
                        <Progress value={c.avance} className="mt-2"/>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" className="gap-1 px-2 text-xs"><MapPin className="h-3.5 w-3.5"/>Ruta</Button>
                        <Button variant="outline" size="sm" className="gap-1"><FileText className="h-3.5 w-3.5"/>Plan</Button>
                        <Button size="sm" className="gap-1">Abrir <ArrowRight className="h-3.5 w-3.5"/></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {tab === "empresas" && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredEmpresas.map((e) => (
                <Card key={e.id} className="border-muted/40">
                  <CardHeader className="space-y-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">{e.nombre}</CardTitle>
                        <CardDescription className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5"/>{e.rubro}</CardDescription>
                      </div>
                      <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3"/>{e.comuna}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground"><Users2 className="h-4 w-4"/>Cupos <span className="ml-auto text-foreground">{e.cupos}</span></div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Link2 className="h-4 w-4"/>Estado <span className="ml-auto text-foreground capitalize">{e.estado}</span></div>
                      <div className="flex items-center gap-2 text-muted-foreground"><FileText className="h-4 w-4"/>Contacto <span className="ml-auto text-foreground">{e.contacto}</span></div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" className="gap-1">Ficha</Button>
                      <Button size="sm" className="gap-1">Vincular <ArrowRight className="h-3.5 w-3.5"/></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {tab === "plan" && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                {PLAN_SEMANAL.map((p) => (
                  <Card key={p.semana} className="border-muted/40">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-base">Semana {p.semana}</CardTitle>
                      <TimeChip tipo={p.tipo} />
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{p.foco}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-muted/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600"/> Checklist mínimo (según normativa)</CardTitle>
                  <CardDescription>Elementos sugeridos para un plan de alternancia TP seguro, pertinente y evaluable.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600"/> Convenio liceo–empresa con roles, calendario y objetivos de aprendizaje.</div>
                  <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600"/> Evaluación por resultados de aprendizaje y evidencias (bitácora/tareas/tutorías).</div>
                  <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600"/> SST: inducción, EPP, protocolos de emergencia y seguros vigentes.</div>
                  <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600"/> Tutor/a en empresa + docente guía con reuniones de seguimiento.</div>
                  <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600"/> Plan de alternancia con semanas Liceo/Empresa y focos formativos.</div>
                </CardContent>
              </Card>

              <Card className="border-muted/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-600"/> Documentos modelo</CardTitle>
                  <CardDescription>Plantillas livianas para partir rápido.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2"><Download className="h-4 w-4"/> Convenio Liceo–Empresa</Button>
                  <Button variant="outline" className="gap-2"><Download className="h-4 w-4"/> Matriz de Evaluación</Button>
                  <Button variant="outline" className="gap-2"><Download className="h-4 w-4"/> Bitácora estudiante</Button>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
