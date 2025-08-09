
import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { EstudianteInclusion, DificultadAprendizaje, Intervencion, MetaProgreso, AlertaInclusion, ArchivoGuardado, User, Profile, ReunionApoderados } from '../../types';
import { CURSOS, DIFICULTADES_APRENDIZAJE } from '../../constants';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
    subscribeToEstudiantesInclusion, 
    subscribeToAllUsers,
    addEstudianteToInclusion,
    updateEstudianteInclusion,
    deleteEstudianteInclusion
} from '../../src/firebaseHelpers/inclusionHelper';
import { createNotificacionDocente } from '../../src/firebaseHelpers/notificacionesHelper';

/* =============================
   Dashboard (resumen gráfico)
   ============================= */
const DashboardInclusion: React.FC<{ estudiantes: EstudianteInclusion[] }> = ({ estudiantes }) => {
  const distribucionCurso = useMemo(() => {
    const cursos = estudiantes.reduce((acc, est) => {
      acc[est.curso] = (acc[est.curso] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(cursos).map(([curso, cantidad]) => ({ curso, cantidad })).sort((a, b) => a.curso.localeCompare(b.curso));
  }, [estudiantes]);

  const distribucionNivel = useMemo(() => {
    const niveles = estudiantes.reduce((acc, est) => {
      const nivel = est.curso.match(/\d+/)?.[0] || 'Sin nivel';
      acc[nivel] = (acc[nivel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(niveles)
      .map(([nivel, cantidad]) => ({ nivel, cantidad }))
      .sort((a, b) => {
        if (a.nivel === 'Sin nivel') return 1;
        if (b.nivel === 'Sin nivel') return -1;
        return parseInt(a.nivel) - parseInt(b.nivel);
      });
  }, [estudiantes]);

  const distribucionDiagnostico = useMemo(() => {
    const diagnosticos = estudiantes.reduce((acc, est) => {
      acc[est.dificultad] = (acc[est.dificultad] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(diagnosticos).map(([diagnostico, cantidad]) => ({ diagnostico, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
  }, [estudiantes]);

  const estadisticasIntervenciones = useMemo(() => {
    const totalIntervenciones = estudiantes.reduce((acc, est) => acc + (est.intervenciones?.length || 0), 0);
    const promedioIntervenciones = estudiantes.length > 0 ? (totalIntervenciones / estudiantes.length).toFixed(1) : '0';
    return { total: totalIntervenciones, promedio: promedioIntervenciones };
  }, [estudiantes]);

  const alertasPendientes = useMemo(() => {
    return estudiantes.reduce((acc, est) => acc + (est.alertas || []).filter(a => !a.resuelta).length, 0);
  }, [estudiantes]);

  const maxValue = Math.max(
    ...[0, ...distribucionCurso.map(d => d.cantidad), ...distribucionNivel.map(d => d.cantidad), ...distribucionDiagnostico.map(d => d.cantidad)]
  );

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Dashboard PIE</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{estudiantes.length}</div>
          <div className="text-sm text-blue-800 dark:text-blue-300">Total Estudiantes</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{estadisticasIntervenciones.total}</div>
          <div className="text-sm text-green-800 dark:text-green-300">Intervenciones</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{alertasPendientes}</div>
          <div className="text-sm text-yellow-800 dark:text-yellow-300">Alertas Pendientes</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{estadisticasIntervenciones.promedio}</div>
          <div className="text-sm text-purple-800 dark:text-purple-300">Promedio Intervenciones</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Por Curso</h3>
          <div className="space-y-2">
            {distribucionCurso.map(({ curso, cantidad }) => (
              <div key={curso} className="flex items-center gap-2">
                <div className="text-sm text-slate-600 dark:text-slate-300 w-12">{curso}</div>
                <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${maxValue ? (cantidad / maxValue) * 100 : 0}%` }} />
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 w-6">{cantidad}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Por Nivel</h3>
          <div className="space-y-2">
            {distribucionNivel.map(({ nivel, cantidad }) => (
              <div key={nivel} className="flex items-center gap-2">
                <div className="text-sm text-slate-600 dark:text-slate-300 w-12">{nivel}°</div>
                <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                  <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${maxValue ? (cantidad / maxValue) * 100 : 0}%` }} />
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 w-6">{cantidad}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Por Diagnóstico</h3>
          <div className="space-y-2">
            {distribucionDiagnostico.map(({ diagnostico, cantidad }) => (
              <div key={diagnostico} className="flex items-center gap-2">
                <div className="text-sm text-slate-600 dark:text-slate-300 w-16 text-right truncate" title={diagnostico}>
                  {diagnostico}
                </div>
                <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                  <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${maxValue ? (cantidad / maxValue) * 100 : 0}%` }} />
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 w-6">{cantidad}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* =============================
   Buscador de Estudiantes
   ============================= */
const BuscadorEstudiantes: React.FC<{
  estudiantesDisponibles: User[];
  onSelect: (student: User) => void;
}> = ({ estudiantesDisponibles, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredStudents = useMemo(() => {
    return estudiantesDisponibles
      .filter(student => {
        const matchesName = student.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCourse = selectedCourse === '' || student.curso === selectedCourse;
        return matchesName && matchesCourse;
      })
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }, [estudiantesDisponibles, searchTerm, selectedCourse]);

  const availableCourses = useMemo(() => {
    const courses = [...new Set(estudiantesDisponibles.map(s => s.curso).filter(Boolean) as string[])];
    return courses.sort();
  }, [estudiantesDisponibles]);

  const handleSelectStudent = (student: User) => {
    onSelect(student);
    setSearchTerm('');
    setSelectedCourse('');
    setIsOpen(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Agregar Estudiante al PIE</h2>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Buscar por nombre</label>
            <input
              type="text"
              placeholder="Escriba el nombre del estudiante..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setIsOpen(e.target.value.length > 0 || selectedCourse !== '');
              }}
              onFocus={() => setIsOpen(searchTerm.length > 0 || selectedCourse !== '')}
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Filtrar por curso</label>
            <select
              value={selectedCourse}
              onChange={e => {
                setSelectedCourse(e.target.value);
                setIsOpen(searchTerm.length > 0 || e.target.value !== '');
              }}
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            >
              <option value="">Todos los cursos</option>
              {availableCourses.map(course => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
          <span>Estudiantes disponibles: {estudiantesDisponibles.length}</span>
          <span>Resultados filtrados: {filteredStudents.length}</span>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          {isOpen ? 'Ocultar resultados' : `Ver ${filteredStudents.length} estudiantes disponibles`}
        </button>

        {isOpen && (
          <div className="border dark:border-slate-600 rounded-lg max-h-80 overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                {searchTerm || selectedCourse ? 'No se encontraron estudiantes con los criterios de búsqueda.' : 'No hay estudiantes disponibles.'}
              </div>
            ) : (
              <div className="divide-y dark:divide-slate-600">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    onClick={() => handleSelectStudent(student)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{student.nombreCompleto}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{student.curso}</p>
                      </div>
                      <button className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-xl">➕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {searchTerm && filteredStudents.length === 1 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">💡 ¡Solo hay un resultado! Haga clic para agregarlo directamente:</p>
            <button
              onClick={() => handleSelectStudent(filteredStudents[0])}
              className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 transition-colors"
            >
              Agregar a {filteredStudents[0].nombreCompleto}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* =============================
   Modal: Agregar Estudiante
   ============================= */
const AddStudentInclusionModal: React.FC<{
  student: User;
  onClose: () => void;
  onConfirm: (student: User, dificultad: DificultadAprendizaje) => void;
}> = ({ student, onClose, onConfirm }) => {
  const [selectedDificultad, setSelectedDificultad] = useState<DificultadAprendizaje>(DIFICULTADES_APRENDIZAJE[0]);
  const handleConfirm = () => onConfirm(student, selectedDificultad);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Agregar a {student.nombreCompleto} al PIE</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">Por favor, seleccione la dificultad de aprendizaje principal para este estudiante.</p>
        <div className="space-y-2">
          <label htmlFor="dificultad" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Dificultad de Aprendizaje
          </label>
          <select
            id="dificultad"
            value={selectedDificultad}
            onChange={e => setSelectedDificultad(e.target.value as DificultadAprendizaje)}
            className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
          >
            {DIFICULTADES_APRENDIZAJE.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors"
          >
            Confirmar e Ingresar
          </button>
        </div>
      </div>
    </div>
  );
};

/* =============================
   Modal: Ficha Estudiante
   ============================= */
const FichaEstudianteModal: React.FC<{
  student: EstudianteInclusion;
  onClose: () => void;
  onSave: (updatedStudent: EstudianteInclusion) => void;
  profesores: string[];
    getDocenteEmail?: (nombreCompleto: string) => string | undefined;
}> = ({ student, onClose, onSave, profesores, getDocenteEmail }) => {
  const [activeTab, setActiveTab] = useState<'intervenciones' | 'seguimiento' | 'alertas' | 'reuniones'>('intervenciones');
  const [localStudentData, setLocalStudentData] = useState<EstudianteInclusion>(student);

  useEffect(() => setLocalStudentData(student), [student]);

  const [editingIntervencion, setEditingIntervencion] = useState<Intervencion | null>(null);
  const initialIntervencionState: Omit<Intervencion, 'id' | 'fecha'> = { responsable: '', accion: '', observaciones: '' };
  const [newIntervencion, setNewIntervencion] = useState(initialIntervencionState);
  const [newMeta, setNewMeta] = useState<{ trimestre: 'T1' | 'T2' | 'T3'; meta: string }>({ trimestre: 'T1', meta: '' });
  const [newAlerta, setNewAlerta] = useState<{ titulo: string; fecha: string }>({ titulo: '', fecha: new Date().toISOString().split('T')[0] });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const initialReunionState: Omit<ReunionApoderados, 'id' | 'fecha'> = { motivo: '', acuerdos: '', asistentes: '' };
  const [newReunion, setNewReunion] = useState(initialReunionState);

  const handleSaveAndClose = () => {
    onSave(localStudentData);
    onClose();
  };

  const handleAddOrUpdateIntervencion = async () => {
    if (!newIntervencion.responsable || !newIntervencion.accion) {
      alert('Responsable y Acción son campos obligatorios.');
      return;
    }

    let updatedInterventions: Intervencion[];
    let isNew = false;

    if (editingIntervencion) {
      updatedInterventions = (localStudentData.intervenciones || []).map(i => (i.id === editingIntervencion.id ? { ...i, ...newIntervencion } : i));
    } else {
      isNew = true;
      const newRecord: Intervencion = { id: crypto.randomUUID(), fecha: new Date().toISOString(), ...newIntervencion };
      updatedInterventions = [newRecord, ...(localStudentData.intervenciones || [])];
    }

    const sorted = updatedInterventions.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    setLocalStudentData(prev => ({ ...prev, intervenciones: sorted }));

    if (isNew) {
      try {
        await createNotificacionDocente({
          docenteNombre: newIntervencion.responsable,
                    docenteEmail: getDocenteEmail ? getDocenteEmail(newIntervencion.responsable) : undefined,
                    docenteEmailLower: (getDocenteEmail ? getDocenteEmail(newIntervencion.responsable) : undefined)?.toLowerCase(),
          tipo: 'nueva_intervencion',
          titulo: '📋 Nueva Intervención Asignada',
          mensaje: `Se te ha asignado una nueva intervención para el estudiante ${localStudentData.nombre}. Acción: ${newIntervencion.accion}`,
          estudianteNombre: localStudentData.nombre,
          estudianteId: localStudentData.id,
          accionRequerida: newIntervencion.accion
        });
        alert(`✅ Intervención registrada y notificación enviada a ${newIntervencion.responsable}`);
      } catch (error) {
        console.error('Error al crear notificación:', error);
        alert('⚠️ Intervención guardada, pero no se pudo enviar la notificación al docente.');
      }
    }

    setNewIntervencion(initialIntervencionState);
    setEditingIntervencion(null);
  };

  const handleEditIntervencion = (intervencion: Intervencion) => {
    setEditingIntervencion(intervencion);
    setNewIntervencion({ responsable: intervencion.responsable, accion: intervencion.accion, observaciones: intervencion.observaciones });
  };
  const handleDeleteIntervencion = (id: string) => {
    if (window.confirm('¿Eliminar esta intervención?')) {
      setLocalStudentData(prev => ({ ...prev, intervenciones: (prev.intervenciones || []).filter(i => i.id !== id) }));
    }
  };

  const handleSupportChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setLocalStudentData(prev => ({ ...prev, [name]: value, fechaActualizacionApoyos: new Date().toISOString() } as any));
  };

  const handleAddMeta = () => {
    if (!newMeta.meta.trim()) return;
    const metaToAdd: MetaProgreso = { ...newMeta, id: crypto.randomUUID(), cumplida: false };
    setLocalStudentData(prev => ({ ...prev, metasProgreso: [...(prev.metasProgreso || []), metaToAdd] }));
    setNewMeta({ trimestre: 'T1', meta: '' });
  };
  const handleToggleMeta = (metaId: string) => {
    setLocalStudentData(prev => ({ ...prev, metasProgreso: (prev.metasProgreso || []).map(m => (m.id === metaId ? { ...m, cumplida: !m.cumplida } : m)) }));
  };
  const handleDeleteMeta = (metaId: string) => {
    setLocalStudentData(prev => ({ ...prev, metasProgreso: (prev.metasProgreso || []).filter(m => m.id !== metaId) }));
  };

  const progresoMetas = useMemo(() => {
    const metas = localStudentData.metasProgreso || [];
    if (metas.length === 0) return { percent: 0, color: 'bg-slate-300' };
    const cumplidas = metas.filter(m => m.cumplida).length;
    const percent = Math.round((cumplidas / metas.length) * 100);
    const color = percent < 40 ? 'bg-red-500' : percent < 75 ? 'bg-yellow-500' : 'bg-green-500';
    return { percent, color };
  }, [localStudentData.metasProgreso]);

  const needsUpdate = useMemo(() => {
    if (!localStudentData.fechaActualizacionApoyos) return true;
    const lastUpdate = new Date(localStudentData.fechaActualizacionApoyos);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return lastUpdate < threeMonthsAgo;
  }, [localStudentData.fechaActualizacionApoyos]);

  const handleAddAlerta = () => {
    if (!newAlerta.titulo.trim() || !newAlerta.fecha) return;
    const alertaToAdd: AlertaInclusion = { ...newAlerta, id: crypto.randomUUID(), resuelta: false };
    setLocalStudentData(prev => ({
      ...prev,
      alertas: [...(prev.alertas || []), alertaToAdd].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    }));
    setNewAlerta({ titulo: '', fecha: new Date().toISOString() });
  };
  const handleToggleAlerta = (alertaId: string) => {
    setLocalStudentData(prev => ({ ...prev, alertas: (prev.alertas || []).map(a => (a.id === alertaId ? { ...a, resuelta: !a.resuelta } : a)) }));
  };
  const handleDeleteAlerta = (alertaId: string) => {
    setLocalStudentData(prev => ({ ...prev, alertas: (prev.alertas || []).filter(a => a.id !== alertaId) }));
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
  };
  const handleUploadFile = () => {
    if (!selectedFile) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onloadend = () => {
      const newFile: ArchivoGuardado = { id: crypto.randomUUID(), nombre: selectedFile.name, url: reader.result as string, fechaSubida: new Date().toISOString() };
      setLocalStudentData(prev => ({ ...prev, archivos: [newFile, ...(prev.archivos || [])] }));
      setSelectedFile(null);
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert('Error al leer el archivo.');
      setIsUploading(false);
    };
  };
  const handleDeleteFile = (fileId: string) => {
    if (window.confirm('¿Eliminar este archivo?')) {
      setLocalStudentData(prev => ({ ...prev, archivos: (prev.archivos || []).filter(f => f.id !== fileId) }));
    }
  };

  const handleAddReunion = () => {
    if (!newReunion.motivo.trim() || !newReunion.asistentes.trim()) {
      alert('Motivo y asistentes son obligatorios.');
      return;
    }
    const reunionToAdd: ReunionApoderados = { ...newReunion, id: crypto.randomUUID(), fecha: new Date().toISOString() };
    setLocalStudentData(prev => ({
      ...prev,
      reuniones: [reunionToAdd, ...(prev.reuniones || [])].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    }));
    setNewReunion(initialReunionState);
  };
  const handleDeleteReunion = (reunionId: string) => {
    if (window.confirm('¿Eliminar este registro de reunión?')) {
      setLocalStudentData(prev => ({ ...prev, reuniones: (prev.reuniones || []).filter(r => r.id !== reunionId) }));
    }
  };

  const handleExportFichaPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = margin;

    const addHeader = (docInstance: jsPDF) => {
      docInstance.setFontSize(10);
      docInstance.setTextColor(100);
      docInstance.text('Ficha de Seguimiento - Módulo Inclusión', margin, 15);
    };
    addHeader(doc);

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40);
    doc.text(localStudentData.nombre, margin, y + 10);
    y += 15;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`Curso: ${localStudentData.curso}`, margin, y);
    doc.text(`Dificultad: ${localStudentData.dificultad}`, margin, y + 6);
    y += 15;

    const checkPageBreak = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        addHeader(doc);
        y = margin;
      }
    };

    const addSectionTitle = (title: string) => {
      checkPageBreak(15);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, y);
      y += 10;
    };

    if (localStudentData.intervenciones?.length) {
      addSectionTitle('Historial de Intervenciones');
      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Responsable', 'Acción', 'Observaciones']],
        body: localStudentData.intervenciones.map(i => [
          new Date(i.fecha).toLocaleDateString('es-CL'),
          i.responsable,
          i.accion,
          i.observaciones || ''
        ]),
        theme: 'grid',
        didDrawPage: () => addHeader(doc)
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (localStudentData.adaptacionesCurriculares || localStudentData.apoyosRecibidos) {
      checkPageBreak(30);
      addSectionTitle('Seguimiento y Apoyos');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const text = `Adaptaciones: ${localStudentData.adaptacionesCurriculares || 'No registradas.'}\nApoyos: ${localStudentData.apoyosRecibidos || 'No registrados.'}`;
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
      doc.text(lines as string[], margin, y);
      y += (lines as string[]).length * 5 + 10;
    }

    if (localStudentData.metasProgreso?.length) {
      checkPageBreak(30);
      addSectionTitle('Metas de Progreso');
      autoTable(doc, {
        startY: y,
        head: [['Trimestre', 'Meta', 'Estado']],
        body: localStudentData.metasProgreso.map(m => [m.trimestre, m.meta, m.cumplida ? 'Cumplida' : 'Pendiente']),
        theme: 'grid',
        didDrawPage: () => addHeader(doc)
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (localStudentData.reuniones?.length) {
      addSectionTitle('Reuniones con Apoderados');
      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Motivo', 'Acuerdos', 'Asistentes']],
        body: localStudentData.reuniones.map(r => [
          new Date(r.fecha).toLocaleDateString('es-CL'),
          r.motivo,
          r.acuerdos || '',
          r.asistentes
        ]),
        theme: 'grid',
        didDrawPage: () => addHeader(doc)
      });
    }

    doc.save(`Ficha_Inclusion_${localStudentData.nombre.replace(/\s/g, '_')}.pdf`);
  };

  /* ---- Render helpers de pestañas ---- */
  const renderIntervenciones = () => (
    <div className="space-y-4">
      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 space-y-3">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{editingIntervencion ? 'Editando Intervención' : 'Registrar Nueva Intervención'}</h4>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Responsable {!editingIntervencion && '(Se enviará notificación automática)'}
          </label>
          <select
            value={newIntervencion.responsable}
            onChange={e => setNewIntervencion(prev => ({ ...prev, responsable: e.target.value }))}
            className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
          >
            <option value="">Seleccione Responsable...</option>
            {profesores.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {newIntervencion.responsable && !editingIntervencion && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-sm text-blue-800 dark:text-blue-200">
              🔔 Se enviará una notificación a {newIntervencion.responsable} cuando se guarde la intervención
            </div>
          )}
        </div>

        <textarea
          value={newIntervencion.accion}
          onChange={e => setNewIntervencion(prev => ({ ...prev, accion: e.target.value }))}
          placeholder="Acción realizada..."
          rows={2}
          className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
        />
        <textarea
          value={newIntervencion.observaciones}
          onChange={e => setNewIntervencion(prev => ({ ...prev, observaciones: e.target.value }))}
          placeholder="Observaciones adicionales..."
          rows={2}
          className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
        />

        <div className="flex justify-end gap-2">
          {editingIntervencion && (
            <button
              onClick={() => {
                setEditingIntervencion(null);
                setNewIntervencion(initialIntervencionState);
              }}
              className="text-sm bg-slate-200 dark:bg-slate-600 px-3 py-1 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
            >
              Cancelar Edición
            </button>
          )}
          <button
            onClick={handleAddOrUpdateIntervencion}
            className="text-sm bg-amber-500 text-white font-semibold px-3 py-1 rounded-md hover:bg-amber-600 transition-colors"
            disabled={!newIntervencion.responsable || !newIntervencion.accion}
          >
            {editingIntervencion ? 'Actualizar' : 'Guardar y Notificar'}
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {(localStudentData.intervenciones || []).map(i => (
          <div key={i.id} className="p-3 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-600">
            <div className="flex justify-between items-start">
              <div className="flex-grow">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{i.accion}</p>
                {i.observaciones && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{i.observaciones}</p>}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(i.fecha).toLocaleString('es-CL')} - {i.responsable}</p>
                  <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 px-2 py-1 rounded-full">✓ Notificado</span>
                </div>
              </div>
              <div className="flex-shrink-0 ml-4 flex gap-2">
                <button onClick={() => handleEditIntervencion(i)} className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors" title="Editar intervención">✏️</button>
                <button onClick={() => handleDeleteIntervencion(i.id)} className="text-red-500 hover:text-red-700 p-1 rounded transition-colors" title="Eliminar intervención">🗑️</button>
              </div>
            </div>
          </div>
        ))}

        {(!localStudentData.intervenciones || localStudentData.intervenciones.length === 0) && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <div className="text-4xl mb-2">📋</div>
            <p>No hay intervenciones registradas</p>
            <p className="text-sm">Registra la primera intervención arriba</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSeguimiento = () => (
    <div className="space-y-6">
      <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-600 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200">Adaptaciones y Apoyos</h4>
          {needsUpdate && <span title="Información no actualizada en los últimos 3 meses" className="text-yellow-500 text-xl cursor-help">⚠️</span>}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Adaptaciones Curriculares Implementadas</label>
          <textarea
            name="adaptacionesCurriculares"
            value={(localStudentData as any).adaptacionesCurriculares || ''}
            onChange={handleSupportChange}
            rows={3}
            className="w-full mt-1 border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            placeholder="Describe las adaptaciones curriculares implementadas..."
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Apoyos Recibidos (PIE, dupla, etc.)</label>
          <textarea
            name="apoyosRecibidos"
            value={(localStudentData as any).apoyosRecibidos || ''}
            onChange={handleSupportChange}
            rows={3}
            className="w-full mt-1 border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            placeholder="Describe los apoyos que recibe el estudiante..."
          />
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-600 space-y-3">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">Indicadores de Progreso</h4>
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Progreso Anual de Metas: {progresoMetas.percent}%</p>
          <div className="w-full bg-slate-200 rounded-full h-4 dark:bg-slate-700">
            <div className={`${progresoMetas.color} h-4 rounded-full transition-all duration-500`} style={{ width: `${progresoMetas.percent}%` }} />
          </div>
        </div>
        <div className="flex gap-2 items-end pt-2">
          <select
            value={newMeta.trimestre}
            onChange={e => setNewMeta(p => ({ ...p, trimestre: e.target.value as any }))}
            className="border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
          >
            <option value="T1">T1</option>
            <option value="T2">T2</option>
            <option value="T3">T3</option>
          </select>
          <input
            value={newMeta.meta}
            onChange={e => setNewMeta(p => ({ ...p, meta: e.target.value }))}
            placeholder="Definir nueva meta trimestral..."
            className="flex-grow border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
          />
          <button onClick={handleAddMeta} className="bg-slate-200 dark:bg-slate-600 px-3 py-2 rounded-md font-semibold text-sm hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors" disabled={!newMeta.meta.trim()}>
            Agregar
          </button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {(localStudentData.metasProgreso || []).map(meta => (
            <div key={meta.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
              <input type="checkbox" checked={meta.cumplida} onChange={() => handleToggleMeta(meta.id)} className="h-5 w-5 rounded text-amber-500" />
              <span className={`flex-grow text-sm ${meta.cumplida ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                <strong>{meta.trimestre}:</strong> {meta.meta}
              </span>
              <button onClick={() => handleDeleteMeta(meta.id)} className="text-red-500 text-sm hover:text-red-700 p-1 rounded transition-colors" title="Eliminar meta">
                🗑️
              </button>
            </div>
          ))}

          {(!localStudentData.metasProgreso || localStudentData.metasProgreso.length === 0) && (
            <div className="text-center py-6 text-slate-500 dark:text-slate-400">
              <div className="text-3xl mb-2">🎯</div>
              <p>No hay metas definidas</p>
              <p className="text-sm">Agrega la primera meta trimestral</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderAlertasYArchivos = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">Alertas y Recordatorios</h4>
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 space-y-3">
          <h5 className="font-medium">Agendar Nueva Alerta</h5>
          <input
            type="text"
            value={newAlerta.titulo}
            onChange={e => setNewAlerta(p => ({ ...p, titulo: e.target.value }))}
            placeholder="Título de la alerta"
            className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700"
          />
          <input type="date" value={(new Date(newAlerta.fecha)).toISOString().slice(0,10)}
            onChange={e => setNewAlerta(p => ({ ...p, fecha: e.target.value }))}
            className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700"
          />
          <button onClick={handleAddAlerta} className="w-full text-sm bg-amber-500 text-white font-semibold px-3 py-1.5 rounded-md hover:bg-amber-600 transition-colors" disabled={!newAlerta.titulo.trim() || !newAlerta.fecha}>
            Agendar
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {(localStudentData.alertas || []).map(alerta => (
            <div key={alerta.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-600">
              <input type="checkbox" checked={alerta.resuelta} onChange={() => handleToggleAlerta(alerta.id)} className="h-5 w-5 rounded text-amber-500" />
              <span className={`flex-grow text-sm ${alerta.resuelta ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                {alerta.titulo} ({new Date(alerta.fecha + 'T12:00:00').toLocaleDateString('es-CL')})
              </span>
              <button onClick={() => handleDeleteAlerta(alerta.id)} className="text-red-500 text-sm hover:text-red-700 p-1 rounded transition-colors" title="Eliminar alerta">
                🗑️
              </button>
            </div>
          ))}

          {(!localStudentData.alertas || localStudentData.alertas.length === 0) && (
            <div className="text-center py-6 text-slate-500 dark:text-slate-400">
              <div className="text-3xl mb-2">🔔</div>
              <p>No hay alertas programadas</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">Archivos Adjuntos</h4>
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 space-y-3">
          <h5 className="font-medium">Subir Nuevo Archivo</h5>
          <input type="file" onChange={handleFileSelect} className="w-full text-sm" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" />
          <button onClick={handleUploadFile} disabled={!selectedFile || isUploading} className="w-full text-sm bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-md disabled:bg-slate-400 hover:bg-blue-600 transition-colors">
            {isUploading ? 'Subiendo...' : 'Subir'}
          </button>
          {selectedFile && <p className="text-xs text-slate-600 dark:text-slate-400">Archivo seleccionado: {selectedFile.name}</p>}
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {(localStudentData.archivos || []).map(file => (
            <div key={file.id} className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-600">
              <a href={file.url} download={file.nombre} className="text-sm text-blue-600 hover:underline truncate flex-grow" title={file.nombre}>
                📎 {file.nombre}
              </a>
              <button onClick={() => handleDeleteFile(file.id)} className="text-red-500 text-sm ml-2 hover:text-red-700 p-1 rounded transition-colors" title="Eliminar archivo">
                🗑️
              </button>
            </div>
          ))}

          {(!localStudentData.archivos || localStudentData.archivos.length === 0) && (
            <div className="text-center py-6 text-slate-500 dark:text-slate-400">
              <div className="text-3xl mb-2">📁</div>
              <p>No hay archivos adjuntos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderReuniones = () => (
    <div className="space-y-4">
      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 space-y-3">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">Registrar Nueva Reunión</h4>
        <input
          value={newReunion.motivo}
          onChange={e => setNewReunion(p => ({ ...p, motivo: e.target.value }))}
          placeholder="Motivo de la reunión..."
          className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
        />
        <textarea
          value={newReunion.acuerdos}
          onChange={e => setNewReunion(p => ({ ...p, acuerdos: e.target.value }))}
          placeholder="Acuerdos tomados en la reunión..."
          rows={3}
          className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
        />
        <input
          value={newReunion.asistentes}
          onChange={e => setNewReunion(p => ({ ...p, asistentes: e.target.value }))}
          placeholder="Asistentes (separados por coma)..."
          className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
        />
        <div className="text-right">
          <button
            onClick={handleAddReunion}
            className="text-sm bg-amber-500 text-white font-semibold px-3 py-1 rounded-md hover:bg-amber-600 transition-colors"
            disabled={!newReunion.motivo.trim() || !newReunion.asistentes.trim()}
          >
            Guardar Reunión
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {(localStudentData.reuniones || []).map(r => (
          <div key={r.id} className="p-3 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-600">
            <div className="flex justify-between items-start">
              <div className="flex-grow">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{r.motivo}</p>
                {r.acuerdos && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    <strong>Acuerdos:</strong> {r.acuerdos}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {new Date(r.fecha).toLocaleString('es-CL')} - Asistentes: {r.asistentes}
                </p>
              </div>
              <button onClick={() => handleDeleteReunion(r.id)} className="text-red-500 flex-shrink-0 ml-4 hover:text-red-700 p-1 rounded transition-colors" title="Eliminar reunión">
                🗑️
              </button>
            </div>
          </div>
        ))}

        {(!localStudentData.reuniones || localStudentData.reuniones.length === 0) && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <div className="text-4xl mb-2">👥</div>
            <p>No hay reuniones registradas</p>
            <p className="text-sm">Registra la primera reunión con apoderados</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Ficha de Seguimiento: {student.nombre}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{student.curso} - {student.dificultad}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportFichaPDF} className="text-sm bg-red-100 text-red-700 font-semibold px-3 py-1.5 rounded-md hover:bg-red-200 transition-colors">📄 Exportar PDF</button>
            <button onClick={onClose} className="text-2xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">&times;</button>
          </div>
        </div>

        <div className="border-b dark:border-slate-700 px-4">
          <nav className="-mb-px flex space-x-6">
            {(['intervenciones', 'seguimiento', 'reuniones', 'alertas'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${activeTab === tab ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm capitalize transition-colors`}
              >
                {tab === 'alertas' ? 'Alertas y Archivos' : tab === 'seguimiento' ? 'Seguimiento y Metas' : tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 overflow-y-auto flex-grow bg-slate-50 dark:bg-slate-900/50">
          {activeTab === 'intervenciones' && renderIntervenciones()}
          {activeTab === 'seguimiento' && renderSeguimiento()}
          {activeTab === 'reuniones' && renderReuniones()}
          {activeTab === 'alertas' && renderAlertasYArchivos()}
        </div>

        <div className="bg-slate-100 dark:bg-slate-700/50 px-6 py-4 rounded-b-xl flex justify-end gap-3 mt-auto">
          <button onClick={onClose} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 transition-colors">
            Cerrar
          </button>
          <button onClick={handleSaveAndClose} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors">
            Guardar Cambios y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

/* =============================
   Componente Principal
   ============================= */
interface InclusionProps {
  currentUser: User;
}

const Inclusion: React.FC<InclusionProps> = ({ currentUser }) => {
  const [estudiantes, setEstudiantes] = useState<EstudianteInclusion[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<EstudianteInclusion | null>(null);
  const [studentToAdd, setStudentToAdd] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCurso, setFilterCurso] = useState('');
  const [filterDificultad, setFilterDificultad] = useState('');
  const [activeView, setActiveView] = useState<'dashboard' | 'lista'>('dashboard');

  useEffect(() => {
    setLoading(true);
    const unsubscribeEstudiantes = subscribeToEstudiantesInclusion(data => {
      setEstudiantes(data);
      setLoading(false);
    });

    const unsubscribeUsers = subscribeToAllUsers(data => setAllUsers(data));

    return () => {
      unsubscribeEstudiantes();
      unsubscribeUsers();
    };
  }, []);

  const handleAddStudentFromNomina = async (user: User, dificultad: DificultadAprendizaje) => {
    if (estudiantes.some(e => e.nombre === user.nombreCompleto)) {
      alert('Este estudiante ya está en el programa de inclusión.');
      return;
    }

    const newStudent: Omit<EstudianteInclusion, 'id'> = {
      nombre: user.nombreCompleto,
      curso: user.curso || '',
      dificultad,
      intervenciones: [],
      metasProgreso: [],
      alertas: [],
      archivos: [],
      reuniones: [],
      adaptacionesCurriculares: '',
      apoyosRecibidos: '',
      fechaActualizacionApoyos: new Date().toISOString()
    };

    try {
      await addEstudianteToInclusion(newStudent);
      alert(`✅ ${user.nombreCompleto} ha sido agregado exitosamente al programa PIE`);
    } catch (error) {
      console.error('Error al agregar estudiante:', error);
      alert('Hubo un error al agregar al estudiante al programa.');
    }
  };

  const handleUpdateStudent = async (updatedStudent: EstudianteInclusion) => {
    try {
      await updateEstudianteInclusion(updatedStudent.id, updatedStudent);
    } catch (error) {
      console.error('Error al actualizar la ficha:', error);
      alert('Hubo un error al guardar los cambios en la ficha.');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar a este estudiante del programa de inclusión? Esta acción es irreversible.')) {
      try {
        await deleteEstudianteInclusion(id);
        if (selectedStudent?.id === id) setSelectedStudent(null);
        alert('✅ Estudiante eliminado del programa PIE');
      } catch (error) {
        console.error('Error al eliminar estudiante:', error);
        alert('Hubo un error al eliminar al estudiante.');
      }
    }
  };

  const handleExport = (format: 'xlsx' | 'pdf') => {
    const filtered = filteredEstudiantes;
    if (filtered.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }
    const dataToExport = filtered.map(s => ({
      Nombre: s.nombre,
      Curso: s.curso,
      Dificultad: s.dificultad,
      'N° Intervenciones': s.intervenciones?.length || 0,
      'Alertas Pendientes': (s.alertas || []).filter(a => !a.resuelta).length,
      'Metas Cumplidas': (s.metasProgreso || []).filter(m => m.cumplida).length,
      'Total Metas': (s.metasProgreso || []).length,
      'Última Actualización': s.fechaActualizacionApoyos ? new Date(s.fechaActualizacionApoyos).toLocaleDateString('es-CL') : 'No registrada'
    }));

    if (format === 'xlsx') {
      const ws = utils.json_to_sheet(dataToExport);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Estudiantes_Inclusion');
      writeFile(wb, 'Estudiantes_Inclusion.xlsx');
      alert('✅ Archivo Excel exportado exitosamente');
    } else {
      const doc = new jsPDF();
      doc.text('Listado de Estudiantes - Programa de Inclusión', 14, 15);
      autoTable(doc, { startY: 20, head: [Object.keys(dataToExport[0])], body: dataToExport.map(Object.values) });
      doc.save('Estudiantes_Inclusion.pdf');
      alert('✅ Archivo PDF exportado exitosamente');
    }
  };

  const estudiantesEnNomina = useMemo(() => {
    return allUsers
      .filter(u => u.profile === Profile.ESTUDIANTE && (currentUser.cursos?.includes(u.curso || '') || currentUser.profile === Profile.SUBDIRECCION))
      .filter(u => !estudiantes.some(e => e.nombre === u.nombreCompleto));
  }, [allUsers, estudiantes, currentUser]);

  const filteredEstudiantes = useMemo(() => {
    return estudiantes
      .filter(
        s =>
          s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) &&
          (filterCurso === '' || s.curso === filterCurso) &&
          (filterDificultad === '' || s.dificultad === filterDificultad)
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [estudiantes, searchTerm, filterCurso, filterDificultad]);

  const profesores = useMemo(() => allUsers.filter(u => u.profile === Profile.PROFESORADO).map(u => u.nombreCompleto).sort(), [allUsers]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Programa de Inclusión Escolar (PIE)</h1>

        <div className="flex gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'dashboard' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveView('lista')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'lista' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            📋 Lista de Estudiantes
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Cargando datos del programa...</p>
        </div>
      ) : (
        <>
          {activeView === 'dashboard' && (
            <div className="space-y-8">
              <DashboardInclusion estudiantes={estudiantes} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Estudiantes Recientes ({Math.min(5, estudiantes.length)})</h2>
                    <button onClick={() => setActiveView('lista')} className="text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                      Ver todos →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {estudiantes.slice(0, 5).map(s => (
                      <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md border dark:border-slate-700 flex justify-between items-center hover:shadow-sm transition-shadow">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{s.nombre}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {s.curso} - {s.dificultad}
                          </p>
                        </div>
                        <button onClick={() => setSelectedStudent(s)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm transition-colors">
                          Ver Ficha
                        </button>
                      </div>
                    ))}
                    {estudiantes.length === 0 && (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <div className="text-6xl mb-4">📚</div>
                        <p className="text-lg font-medium mb-2">No hay estudiantes en el programa PIE</p>
                        <p className="text-sm">Comienza agregando estudiantes desde la nómina</p>
                      </div>
                    )}
                  </div>
                </div>

                <BuscadorEstudiantes estudiantesDisponibles={estudiantesEnNomina} onSelect={student => setStudentToAdd(student)} />
              </div>
            </div>
          )}

          {activeView === 'lista' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Estudiantes en PIE ({filteredEstudiantes.length})</h2>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('xlsx')} className="text-sm bg-green-100 text-green-700 font-semibold py-1 px-3 rounded-lg hover:bg-green-200 transition-colors">
                      📊 Excel
                    </button>
                    <button onClick={() => handleExport('pdf')} className="text-sm bg-red-100 text-red-700 font-semibold py-1 px-3 rounded-lg hover:bg-red-200 transition-colors">
                      📄 PDF
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Buscar estudiante</label>
                    <input
                      type="text"
                      placeholder="Nombre del estudiante..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Filtrar por curso</label>
                    <select value={filterCurso} onChange={e => setFilterCurso(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                      <option value="">Todos los Cursos</option>
                      {CURSOS.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Filtrar por diagnóstico</label>
                    <select value={filterDificultad} onChange={e => setFilterDificultad(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                      <option value="">Todas las Dificultades</option>
                      {DIFICULTADES_APRENDIZAJE.map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-center">
                    <div className="font-bold text-blue-600">{filteredEstudiantes.length}</div>
                    <div className="text-blue-800 dark:text-blue-300">Mostrando</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-center">
                    <div className="font-bold text-green-600">{estudiantes.length}</div>
                    <div className="text-green-800 dark:text-green-300">Total</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-center">
                    <div className="font-bold text-yellow-600">
                      {estudiantes.reduce((acc, s) => acc + (s.alertas || []).filter(a => !a.resuelta).length, 0)}
                    </div>
                    <div className="text-yellow-800 dark:text-yellow-300">Alertas</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded text-center">
                    <div className="font-bold text-purple-600">{new Set(estudiantes.map(s => s.curso)).size}</div>
                    <div className="text-purple-800 dark:text-purple-300">Cursos</div>
                  </div>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {filteredEstudiantes.map(s => (
                    <div key={s.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-md border dark:border-slate-700 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-grow">
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{s.nombre}</p>
                            {(s.alertas || []).filter(a => !a.resuelta).length > 0 && (
                              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                                {(s.alertas || []).filter(a => !a.resuelta).length} alertas
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                            {s.curso} - {s.dificultad}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                            <span>{s.intervenciones?.length || 0} intervenciones</span>
                            <span>{(s.metasProgreso || []).filter(m => m.cumplida).length} metas cumplidas</span>
                            {s.fechaActualizacionApoyos && <span>Últ. actualización: {new Date(s.fechaActualizacionApoyos).toLocaleDateString('es-CL')}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => setSelectedStudent(s)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm px-3 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                            Ver Ficha
                          </button>
                          <button onClick={() => handleDeleteStudent(s.id)} title="Eliminar del programa" className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors">
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredEstudiantes.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">🔍</div>
                      <p className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
                        {searchTerm || filterCurso || filterDificultad ? 'No se encontraron estudiantes con esos criterios' : 'No hay estudiantes en el programa PIE'}
                      </p>
                      {(searchTerm || filterCurso || filterDificultad) && (
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setFilterCurso('');
                            setFilterDificultad('');
                          }}
                          className="text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <BuscadorEstudiantes estudiantesDisponibles={estudiantesEnNomina} onSelect={student => setStudentToAdd(student)} />
            </div>
          )}
        </>
      )}

      {studentToAdd && (
        <AddStudentInclusionModal
          student={studentToAdd}
          onClose={() => setStudentToAdd(null)}
          onConfirm={(student, dificultad) => {
            handleAddStudentFromNomina(student, dificultad);
            setStudentToAdd(null);
          }}
        />
      )}

      {selectedStudent && (
        <FichaEstudianteModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onSave={handleUpdateStudent}
          profesores={profesores}
        />
      )}
    </div>
  );
};

export default Inclusion;
