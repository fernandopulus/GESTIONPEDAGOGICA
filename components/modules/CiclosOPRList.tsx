
import React, { useEffect, useState } from 'react';
import DashboardOPR from './DashboardOPR';
import { CalendarCheck, Film, MessageSquare, Clock, Trash2 } from 'lucide-react';
import { CicloOPR } from '../../types';
import {
  subscribeToCiclosOPRByAcompanamiento,
  getCiclosOPRByAcompanamiento,
  deleteCicloOPR,
} from '../../src/firebaseHelpers/acompanamientos';

interface Props {
  acompanamientoId: string;
  onEdit?: (ciclo: CicloOPR) => void;
  readOnly?: boolean;
  allowDelete?: boolean;
}

const CiclosOPRList: React.FC<Props> = ({ acompanamientoId, onEdit, readOnly = false, allowDelete = true }) => {
  const [ciclos, setCiclos] = useState<CicloOPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let unsub: (() => void) | null = null;

    try {
      unsub = subscribeToCiclosOPRByAcompanamiento(
        acompanamientoId,
        (rows) => {
          setCiclos(rows);
          setLoading(false);
        },
        async (err) => {
          console.warn('Suscripción ciclos falló, usando fetch una vez.', err);
          try {
            const once = await getCiclosOPRByAcompanamiento(acompanamientoId);
            setCiclos(once);
          } catch (e: any) {
            setError(e?.message || 'No se pudieron cargar los ciclos OPR.');
          } finally {
            setLoading(false);
          }
        }
      );
    } catch (e) {
      console.warn('Fallo suscripción, hago fetch único.', e);
      (async () => {
        try {
          const once = await getCiclosOPRByAcompanamiento(acompanamientoId);
          setCiclos(once);
        } catch (e: any) {
          setError(e?.message || 'No se pudieron cargar los ciclos OPR.');
        } finally {
          setLoading(false);
        }
      })();
    }

    return () => {
      try { unsub && unsub(); } catch {}
    };
  }, [acompanamientoId]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este ciclo OPR? Esta acción no se puede deshacer.')) return;
    try {
      await deleteCicloOPR(id);
    } catch (e) {
      alert('No se pudo eliminar el ciclo.');
    }
  };

  const [showDashboard, setShowDashboard] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-600" /> Cargando ciclos OPR...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!ciclos.length) {
    return (
      <div className="p-6 text-center bg-slate-100 dark:bg-slate-800 rounded">
        <p className="text-slate-600 dark:text-slate-300">No hay ciclos OPR registrados para este acompañamiento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Ciclos OPR
        </h2>
        <button
          onClick={() => setShowDashboard(!showDashboard)}
          className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors"
        >
          {showDashboard ? 'Ver Lista' : 'Ver Dashboard'}
        </button>
      </div>

      {showDashboard ? (
        <div>
          <DashboardOPR ciclos={ciclos} />
        </div>
      ) : (
        <div className="space-y-3">
          {ciclos.map((c) => (
        <div key={c.id} className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
          <div className="flex justify-between items-start gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">{c.nombreCiclo || 'Ciclo'}</span>
                <span className="text-sm text-slate-500">• {new Date(c.fecha).toLocaleDateString('es-CL')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
                {c.videoObservacionUrl && (
                  <a
                    className="flex items-center gap-1 hover:underline text-blue-600 dark:text-blue-400"
                    href={c.videoObservacionUrl}
                    target="_blank" rel="noopener noreferrer"
                    title="Ver video de observación"
                  >
                    <Film className="w-4 h-4" /> Video observación
                  </a>
                )}
                {c.retroalimentacion?.videoModeloUrl && (
                  <a
                    className="flex items-center gap-1 hover:underline text-blue-600 dark:text-blue-400"
                    href={c.retroalimentacion.videoModeloUrl}
                    target="_blank" rel="noopener noreferrer"
                    title="Ver video modelo"
                  >
                    <MessageSquare className="w-4 h-4" /> Video modelo
                  </a>
                )}
                {c.horaInicio && c.horaTermino && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" /> {c.horaInicio}–{c.horaTermino}
                  </span>
                )}
              </div>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(c)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm px-3 py-1 rounded border border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    Editar
                  </button>
                )}
                {allowDelete && (
                  <button
                    onClick={() => handleDelete(c.id!)}
                    title="Eliminar ciclo"
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
        </div>
      )}
    </div>
  );
};

export default CiclosOPRList;
