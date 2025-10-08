import React from 'react';
import { CicloOPR } from '../../types';
import { X, CalendarCheck, Clock, Film, MessageSquare, UserRound, BookOpen } from 'lucide-react';

interface Props {
  ciclo: CicloOPR;
  onClose: () => void;
}

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <div className="text-slate-500 dark:text-slate-400 min-w-28">{label}</div>
      <div className="text-slate-800 dark:text-slate-200 flex-1">{value}</div>
    </div>
  );
};

const CicloOPRViewerModal: React.FC<Props> = ({ ciclo, onClose }) => {
  const {
    nombreCiclo,
    fecha,
    horaInicio,
    horaTermino,
    videoObservacionUrl,
    detallesObservacion = [],
    retroalimentacion,
    planificacion,
    seguimiento,
  } = ciclo;

  const docente = (ciclo as any).docenteInfo || (ciclo as any).docente || '';
  const curso = (ciclo as any).cursoInfo || '';
  const asignatura = (ciclo as any).asignaturaInfo || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-700">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{nombreCiclo || 'Ciclo OPR'}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6 max-h-[80vh] overflow-auto">
          {/* Datos generales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Row label="Fecha" value={new Date(fecha).toLocaleDateString('es-CL')} />
            <Row label="Hora" value={(horaInicio || horaTermino) ? `${horaInicio || ''}${horaInicio && horaTermino ? ' – ' : ''}${horaTermino || ''}` : undefined} />
            <Row label="Docente" value={<span className="inline-flex items-center gap-2"><UserRound className="w-4 h-4 text-sky-600" />{docente}</span>} />
            <Row label="Curso / Asignatura" value={<span className="inline-flex items-center gap-2"><BookOpen className="w-4 h-4 text-amber-600" />{[curso, asignatura].filter(Boolean).join(' • ')}</span>} />
            {videoObservacionUrl && (
              <Row
                label="Video"
                value={
                  <a className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline" href={videoObservacionUrl} target="_blank" rel="noopener noreferrer">
                    <Film className="w-4 h-4" /> Ver video de observación
                  </a>
                }
              />
            )}
          </div>

          {/* Registro detallado */}
          {detallesObservacion?.length ? (
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> Registro detallado de observación
              </h4>
              <div className="overflow-x-auto border rounded-md dark:border-slate-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="text-left p-2">Minuto</th>
                      <th className="text-left p-2">Acciones Docente</th>
                      <th className="text-left p-2">Acciones Estudiantes</th>
                      <th className="text-left p-2">Actividades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallesObservacion.map((d) => (
                      <tr key={d.id} className="border-t dark:border-slate-700 align-top">
                        <td className="p-2 whitespace-nowrap">{d.minuto}</td>
                        <td className="p-2">{d.accionesDocente || '—'}</td>
                        <td className="p-2">{d.accionesEstudiantes || '—'}</td>
                        <td className="p-2">{d.actividades || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Retroalimentación */}
          {retroalimentacion && (
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-green-600" /> Retroalimentación
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Row label="Éxito" value={retroalimentacion.exito} />
                <Row label="Foco" value={retroalimentacion.foco} />
                <Row label="Modelo" value={retroalimentacion.modelo} />
                <Row label="Elementos a identificar" value={retroalimentacion.elementosIdentificar} />
              </div>
              {retroalimentacion.brecha && (
                <div className="mt-3 p-3 rounded border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Análisis de brecha</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <Row label="Minuto inicial" value={retroalimentacion.brecha.minutoInicial} />
                    <Row label="Minuto final" value={retroalimentacion.brecha.minutoFinal} />
                    <Row label="Indicadores" value={retroalimentacion.brecha.indicadores} />
                  </div>
                  <div className="mt-2 text-sm">
                    <Row label="Preguntas" value={retroalimentacion.brecha.preguntas} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Planificación */}
          {planificacion && (
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Planificación de práctica</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Row label="Preparación" value={planificacion.preparacion} />
                <Row label="Objetivo" value={planificacion.objetivo} />
                <Row label="Actividad" value={planificacion.actividad} />
                <Row label="Tiempo" value={planificacion.tiempo} />
              </div>
            </div>
          )}

          {/* Seguimiento */}
          {seguimiento && (seguimiento.fecha || seguimiento.curso || seguimiento.profesor || seguimiento.firma) && (
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Seguimiento</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <Row label="Fecha" value={seguimiento.fecha} />
                <Row label="Curso" value={seguimiento.curso} />
                <Row label="Profesor" value={seguimiento.profesor} />
                <Row label="Firma" value={seguimiento.firma} />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/50 border-t dark:border-slate-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-500">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default CicloOPRViewerModal;
