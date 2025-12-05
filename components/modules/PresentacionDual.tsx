import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Award,
  Filter,
  PlusCircle,
  ShieldCheck,
  UserCheck,
  Loader2,
  X,
} from 'lucide-react';
import {
  Profile,
  User,
  PresentacionDualEvaluation,
  PresentacionDualRubricSelection,
  NivelLogroPresentacionDual,
} from '../../types';
import {
  PRESENTACION_DUAL_INDICADORES,
  PRESENTACION_DUAL_MAX_SCORE,
  PRESENTACION_DUAL_EXIGENCIA,
  NIVEL_LABELS,
} from '../../constants/presentacionDualRubric';
import {
  subscribeToPresentacionDualEvaluations,
  createPresentacionDualEvaluation,
  updatePresentacionDualEvaluation,
  getPresentacionDualEvaluationForStudent,
} from '../../src/firebaseHelpers/presentacionDualHelper';
import { getAllUsers } from '../../src/firebaseHelpers/users';
import {
  buildEmptyRubricSelections,
  calcularNotaPresentacionDual,
  isRubricComplete,
  sumRubricScore,
} from '../../src/utils/presentacionDual';

const allowedEditorProfiles = [Profile.SUBDIRECCION, Profile.COORDINACION_TP, Profile.PROFESORADO];
const especialidades: Array<PresentacionDualEvaluation['especialidad']> = ['Mecánica Industrial', 'Mecánica Automotriz'];

interface EvaluationFormState {
  id?: string;
  estudianteId: string;
  estudianteNombre: string;
  estudianteEmail?: string;
  curso: string;
  especialidad: PresentacionDualEvaluation['especialidad'];
  nivel: PresentacionDualEvaluation['nivel'];
  fechaPresentacion: string;
  retroalimentacion: string;
  rubric: PresentacionDualRubricSelection[];
}

const today = () => new Date().toISOString().split('T')[0];

const inferNivel = (curso?: string): PresentacionDualEvaluation['nivel'] =>
  curso?.trim().startsWith('4') ? 'IVº Medio' : 'IIIº Medio';

const createEmptyForm = (): EvaluationFormState => ({
  estudianteId: '',
  estudianteNombre: '',
  estudianteEmail: '',
  curso: '',
  especialidad: 'Mecánica Industrial',
  nivel: 'IIIº Medio',
  fechaPresentacion: today(),
  retroalimentacion: '',
  rubric: buildEmptyRubricSelections(),
});

const PresentacionDual: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const canEdit = allowedEditorProfiles.includes(currentUser.profile);
  const isStudent = currentUser.profile === Profile.ESTUDIANTE;

  const [evaluations, setEvaluations] = useState<PresentacionDualEvaluation[]>([]);
  const [teacherLoading, setTeacherLoading] = useState<boolean>(canEdit);
  const [studentLoading, setStudentLoading] = useState<boolean>(isStudent);
  const [studentEvaluation, setStudentEvaluation] = useState<PresentacionDualEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterCurso, setFilterCurso] = useState<string>('Todos');
  const [filterEstado, setFilterEstado] = useState<string>('Todos');
  const [students, setStudents] = useState<User[]>([]);
  const [studentsLoading, setStudentsLoading] = useState<boolean>(false);
  const [formData, setFormData] = useState<EvaluationFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!canEdit) return;
    setTeacherLoading(true);
    const unsubscribe = subscribeToPresentacionDualEvaluations(
      data => {
        setEvaluations(data);
        setTeacherLoading(false);
      },
      err => {
        console.error('[PresentacionDual] snapshot error', err);
        setError('No pudimos obtener las evaluaciones. Intenta nuevamente.');
        setTeacherLoading(false);
      }
    );
    return () => unsubscribe();
  }, [canEdit]);

  useEffect(() => {
    if (!canEdit) return;
    let active = true;
    setStudentsLoading(true);
    getAllUsers()
      .then(list => {
        if (!active) return;
        const onlyStudents = list.filter(u => u.profile === Profile.ESTUDIANTE);
        setStudents(onlyStudents);
        setStudentsLoading(false);
      })
      .catch(err => {
        console.error('[PresentacionDual] users error', err);
        if (active) {
          setError('No pudimos cargar el listado de estudiantes.');
          setStudentsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [canEdit]);

  useEffect(() => {
    if (!isStudent) return;
    let active = true;
    setStudentLoading(true);
    getPresentacionDualEvaluationForStudent(currentUser.id, currentUser.email)
      .then(result => {
        if (!active) return;
        setStudentEvaluation(result);
        setStudentLoading(false);
      })
      .catch(err => {
        console.error('[PresentacionDual] student fetch error', err);
        if (active) {
          setError('No pudimos cargar tu evaluación.');
          setStudentLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [isStudent, currentUser.id, currentUser.email]);

  const eligibleStudents = useMemo(() => {
    return students
      .filter(s => s.curso?.startsWith('3') || s.curso?.startsWith('4'))
      .sort((a, b) => (a.curso || '').localeCompare(b.curso || '') || a.nombreCompleto.localeCompare(b.nombreCompleto));
  }, [students]);

  const courseOptions = useMemo(() => {
    const set = new Set<string>();
    eligibleStudents.forEach(s => s.curso && set.add(s.curso));
    evaluations.forEach(ev => ev.curso && set.add(ev.curso));
    return Array.from(set).sort();
  }, [eligibleStudents, evaluations]);

  const filteredEvaluations = useMemo(() => {
    if (!canEdit) return [];
    return evaluations.filter(e => {
      const courseOk = filterCurso === 'Todos' || e.curso === filterCurso;
      const estadoOk = filterEstado === 'Todos' || e.estado === filterEstado;
      return courseOk && estadoOk;
    });
  }, [evaluations, canEdit, filterCurso, filterEstado]);

  const totals = useMemo(() => {
    const totalIII = evaluations.filter(e => e.nivel === 'IIIº Medio').length;
    const totalIV = evaluations.filter(e => e.nivel === 'IVº Medio').length;
    const pendientes = evaluations.filter(e => e.estado === 'Pendiente').length;
    const aprobadas = evaluations.filter(e => e.estado === 'Aprobada').length;
    const promedioNota = evaluations.length
      ? (evaluations.reduce((acc, ev) => acc + (ev.notaFinal || 0), 0) / evaluations.length).toFixed(1)
      : '—';
    const avance = evaluations.length ? Math.round((aprobadas / evaluations.length) * 100) : 0;
    return { totalIII, totalIV, pendientes, promedioNota, avance };
  }, [evaluations]);

  const openCreateForm = () => {
    setFormError(null);
    setFormData(createEmptyForm());
  };

  const openEditForm = (evaluation: PresentacionDualEvaluation) => {
    setFormError(null);
    setFormData({
      id: evaluation.id,
      estudianteId: evaluation.estudianteId,
      estudianteNombre: evaluation.estudianteNombre,
      estudianteEmail: evaluation.estudianteEmail,
      curso: evaluation.curso,
      especialidad: evaluation.especialidad,
      nivel: evaluation.nivel,
      fechaPresentacion: evaluation.fechaPresentacion,
      retroalimentacion: evaluation.retroalimentacion || '',
      rubric: evaluation.rubric?.map(item => ({ ...item })) ?? buildEmptyRubricSelections(),
    });
  };

  const closeForm = () => {
    setFormData(null);
    setFormError(null);
    setSaving(false);
  };

  const handleStudentChange = (studentId: string) => {
    if (!formData) return;
    const student = eligibleStudents.find(s => s.id === studentId);
    if (!student) {
      setFormData({ ...formData, estudianteId: studentId });
      return;
    }
    setFormData({
      ...formData,
      estudianteId: student.id,
      estudianteNombre: student.nombreCompleto,
      estudianteEmail: student.email,
      curso: student.curso || '',
      nivel: inferNivel(student.curso),
    });
  };

  const handleRubricSelection = (indicadorId: number, nivel: NivelLogroPresentacionDual) => {
    if (!formData) return;
    const descriptor = PRESENTACION_DUAL_INDICADORES.find(ind => ind.id === indicadorId)?.niveles[nivel];
    if (!descriptor) return;

    setFormData(prev =>
      prev
        ? {
            ...prev,
            rubric: prev.rubric.map(item =>
              item.indicadorId === indicadorId
                ? {
                    ...item,
                    nivel,
                    puntaje: descriptor.puntaje,
                    updatedAt: new Date().toISOString(),
                    updatedBy: { id: currentUser.id, nombre: currentUser.nombreCompleto },
                  }
                : item
            ),
          }
        : prev
    );
  };

  const formPreview = useMemo(() => {
    if (!formData) return null;
    const total = sumRubricScore(formData.rubric);
    const nota = calcularNotaPresentacionDual(total);
    const porcentaje = Math.round((total / PRESENTACION_DUAL_MAX_SCORE) * 100) || 0;
    const completa = isRubricComplete(formData.rubric);
    const estado = porcentaje >= PRESENTACION_DUAL_EXIGENCIA * 100 ? 'Aprobada' : completa ? 'Retroalimentada' : 'Pendiente';
    return { total, nota, porcentaje, completa, estado };
  }, [formData]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData) return;
    if (!formData.estudianteId) {
      setFormError('Selecciona a la persona evaluada.');
      return;
    }
    if (!isRubricComplete(formData.rubric)) {
      setFormError('Completa los 13 indicadores de la rúbrica antes de guardar.');
      return;
    }

    setSaving(true);
    setFormError(null);
    const actor = { id: currentUser.id, nombre: currentUser.nombreCompleto, profile: currentUser.profile };

    try {
      if (formData.id) {
        await updatePresentacionDualEvaluation(
          formData.id,
          {
            estudianteId: formData.estudianteId,
            estudianteNombre: formData.estudianteNombre,
            estudianteEmail: formData.estudianteEmail,
            curso: formData.curso,
            especialidad: formData.especialidad,
            nivel: formData.nivel,
            fechaPresentacion: formData.fechaPresentacion,
            retroalimentacion: formData.retroalimentacion,
            rubric: formData.rubric,
          },
          actor
        );
      } else {
        await createPresentacionDualEvaluation(
          {
            estudianteId: formData.estudianteId,
            estudianteNombre: formData.estudianteNombre,
            estudianteEmail: formData.estudianteEmail,
            curso: formData.curso,
            especialidad: formData.especialidad,
            nivel: formData.nivel,
            fechaPresentacion: formData.fechaPresentacion,
            retroalimentacion: formData.retroalimentacion,
            rubric: formData.rubric,
          },
          actor
        );
      }
      closeForm();
    } catch (err) {
      console.error('[PresentacionDual] save error', err);
      setFormError('No se pudo guardar la evaluación. Revisa la conexión e inténtalo nuevamente.');
      setSaving(false);
    }
  };

  if (isStudent) {
    return (
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <header className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-6 h-6 text-emerald-500" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Presentación Dual</p>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Seguimiento personal</h1>
          </div>
        </header>
        {studentLoading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Cargando tu evaluación...
          </div>
        ) : studentEvaluation ? (
          <article className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Curso {studentEvaluation.curso} · {studentEvaluation.especialidad}</p>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{studentEvaluation.estado}</h2>
              </div>
              <div className="text-right">
                <span className="text-sm text-slate-500">Presentación {new Date(studentEvaluation.fechaPresentacion).toLocaleDateString('es-CL')}</span>
                <p className="text-xs text-slate-500">Nota {studentEvaluation.notaFinal?.toFixed(1)} / 4.0</p>
              </div>
            </div>
            <div className="grid gap-3">
              {studentEvaluation.rubric.map(row => (
                <div key={row.indicadorId} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {PRESENTACION_DUAL_INDICADORES.find(ind => ind.id === row.indicadorId)?.indicador || `Indicador ${row.indicadorId}`}
                      </p>
                      <p className="text-xs text-slate-500">{NIVEL_LABELS[row.nivel]} · {row.puntaje} pts.</p>
                    </div>
                    <span className="text-lg font-bold text-emerald-500">{row.puntaje}/4</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Retroalimentación</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{studentEvaluation.retroalimentacion || 'En elaboración'}</p>
              <p className="text-xs text-slate-500 mt-3">Exigencia {PRESENTACION_DUAL_EXIGENCIA * 100}% · Nota {studentEvaluation.notaFinal?.toFixed(1)} / 4.0</p>
            </div>
          </article>
        ) : (
          <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl py-12">
            <UserCheck className="w-10 h-10 text-slate-400 mb-3" />
            <p className="text-sm text-slate-500">Tu evaluación aún no se registra. Te avisaremos apenas esté disponible.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Módulo TP</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Presentación Dual</h1>
          <p className="text-sm text-slate-500">Controla las evaluaciones rubricadas de IIIº y IVº Medio con nota en escala 2.0–4.0.</p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold text-sm shadow hover:bg-amber-600"
        >
          <PlusCircle className="w-4 h-4" />
          Registrar evaluación
        </button>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <article className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <p className="text-xs text-slate-500">IIIº Medio</p>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totals.totalIII}</span>
            <span className="text-xs text-slate-500">estudiantes</span>
          </div>
        </article>
        <article className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <p className="text-xs text-slate-500">IVº Medio</p>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totals.totalIV}</span>
            <span className="text-xs text-slate-500">estudiantes</span>
          </div>
        </article>
        <article className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <p className="text-xs text-slate-500">Pendientes</p>
          <div className="flex items-center gap-2 mt-2">
            {teacherLoading ? <Loader2 className="w-5 h-5 text-amber-500 animate-spin" /> : <ClipboardList className="w-5 h-5 text-amber-500" />}
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">{totals.pendientes}</span>
          </div>
        </article>
        <article className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <p className="text-xs text-slate-500">Promedio nota</p>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totals.promedioNota}</span>
            <span className="text-xs text-slate-500">avance {totals.avance}%</span>
          </div>
        </article>
      </section>

      <section className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Award className="w-4 h-4" />
            Total evaluaciones: {evaluations.length}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Filter className="w-4 h-4" />
              <select value={filterCurso} onChange={e => setFilterCurso(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-transparent">
                <option value="Todos">Todos los cursos</option>
                {courseOptions.map(curso => (
                  <option key={curso} value={curso}>
                    {curso}
                  </option>
                ))}
              </select>
            </label>
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1 bg-transparent text-sm">
              <option value="Todos">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Retroalimentada">Retroalimentada</option>
              <option value="Aprobada">Aprobada</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Estudiante</th>
                <th className="py-2">Curso</th>
                <th className="py-2">Especialidad</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Nota</th>
                <th className="py-2">Estado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {teacherLoading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    <div className="flex items-center gap-2 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando evaluaciones...
                    </div>
                  </td>
                </tr>
              ) : filteredEvaluations.length ? (
                filteredEvaluations.map(ev => (
                  <tr key={ev.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{ev.estudianteNombre}</div>
                      <p className="text-xs text-slate-500">{ev.nivel}</p>
                    </td>
                    <td className="py-3 text-slate-600">{ev.curso}</td>
                    <td className="py-3 text-slate-600">{ev.especialidad}</td>
                    <td className="py-3 text-slate-600">{new Date(ev.fechaPresentacion).toLocaleDateString('es-CL')}</td>
                    <td className="py-3 text-slate-600">{ev.notaFinal?.toFixed(1) ?? '—'}</td>
                    <td className="py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          ev.estado === 'Pendiente'
                            ? 'bg-amber-100 text-amber-700'
                            : ev.estado === 'Retroalimentada'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {ev.estado}
                      </span>
                    </td>
                    <td className="py-3">
                      <button onClick={() => openEditForm(ev)} className="text-xs font-semibold text-indigo-600 hover:underline">
                        Ver / editar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No hay evaluaciones para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleSubmit} className="w-full max-h-[95vh] overflow-y-auto max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{formData.id ? 'Actualizar' : 'Nueva'} evaluación</p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Rúbrica Presentación Dual</h2>
                <p className="text-sm text-slate-500">Completa los 13 indicadores con puntajes entre 1 y 4 puntos.</p>
              </div>
              <button type="button" onClick={closeForm} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Estudiante
                <select
                  value={formData.estudianteId}
                  onChange={e => handleStudentChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2"
                  required
                  disabled={studentsLoading}
                >
                  <option value="">Selecciona estudiante</option>
                  {eligibleStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.nombreCompleto} · {student.curso || 'Sin curso'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Fecha presentación
                <input
                  type="date"
                  value={formData.fechaPresentacion}
                  onChange={e => setFormData({ ...formData, fechaPresentacion: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2"
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Curso
                <input
                  value={formData.curso}
                  onChange={e => setFormData({ ...formData, curso: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2"
                  placeholder="3ºA, 4ºB..."
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Especialidad
                <select
                  value={formData.especialidad}
                  onChange={e => setFormData({ ...formData, especialidad: e.target.value as EvaluationFormState['especialidad'] })}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2"
                >
                  {especialidades.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 grid gap-4 md:grid-cols-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Indicadores completados</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formData.rubric.filter(item => item.puntaje > 0).length}/{PRESENTACION_DUAL_INDICADORES.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Puntaje total</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formPreview?.total ?? 0} / {PRESENTACION_DUAL_MAX_SCORE}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Nota estimada</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formPreview?.nota?.toFixed(1) ?? '2.0'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Estado</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formPreview?.estado ?? 'Pendiente'}</p>
              </div>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {PRESENTACION_DUAL_INDICADORES.map(indicador => (
                <div key={indicador.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex flex-col gap-1 mb-3">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{indicador.id}. {indicador.indicador}</p>
                    <p className="text-xs text-slate-500">Selecciona el nivel logrado</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    {Object.entries(indicador.niveles).map(([nivelKey, descriptor]) => (
                      <label
                        key={nivelKey}
                        className={`border rounded-lg p-3 cursor-pointer transition ${
                          formData.rubric.find(item => item.indicadorId === indicador.id)?.nivel === nivelKey
                            ? 'border-emerald-400 bg-emerald-50/50'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`indicador-${indicador.id}`}
                          value={nivelKey}
                          className="hidden"
                          onChange={() => handleRubricSelection(indicador.id, nivelKey as NivelLogroPresentacionDual)}
                          checked={formData.rubric.find(item => item.indicadorId === indicador.id)?.nivel === nivelKey}
                        />
                        <p className="text-sm font-semibold">{descriptor.label}</p>
                        <p className="text-xs text-slate-500 mt-1 leading-snug">{descriptor.descripcion}</p>
                        <p className="text-xs text-slate-500 mt-2">{descriptor.puntaje} pts.</p>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block">
              Retroalimentación
              <textarea
                value={formData.retroalimentacion}
                onChange={e => setFormData({ ...formData, retroalimentacion: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2"
                rows={3}
                placeholder="Observaciones consolidadas de la presentación"
              />
            </label>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Guardando...' : formData.id ? 'Actualizar evaluación' : 'Guardar evaluación'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default PresentacionDual;
