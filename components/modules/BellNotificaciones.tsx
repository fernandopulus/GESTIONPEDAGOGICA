import React, { useEffect, useState } from 'react';
import { 
  subscribeToNotificacionesDocente, 
  marcarNotificacionComoLeida, 
  eliminarNotificacion, 
  type NotificacionDocente 
} from '../../src/firebaseHelpers/notificacionesHelper';

interface Props {
  docenteNombre: string; // ej: currentUser.nombreCompleto
}

const BellNotificaciones: React.FC<Props> = ({ docenteNombre }) => {
  const [items, setItems] = useState<NotificacionDocente[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!docenteNombre) return;
    const unsubscribe = subscribeToNotificacionesDocente(docenteNombre, setItems);
    return () => unsubscribe();
  }, [docenteNombre]);

  const unread = items.filter(n => !n.leida).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
        aria-label="Notificaciones"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 shadow-lg rounded-lg border dark:border-slate-700 p-2 z-50">
          <div className="px-2 py-1 border-b dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
            Notificaciones
          </div>
          <div className="max-h-80 overflow-y-auto divide-y dark:divide-slate-700">
            {items.length === 0 && (
              <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                No hay notificaciones
              </div>
            )}
            {items.map(n => (
              <div key={n.id} className="p-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {n.titulo}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line">
                      {n.mensaje}
                    </div>
                    {n.estudianteNombre && (
                      <div className="text-xs text-slate-500 mt-1">
                        Estudiante: <b>{n.estudianteNombre}</b>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 mt-1">
                      {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('es-CL') : ''}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-1">
                    {!n.leida && (
                      <button
                        onClick={() => n.id && marcarNotificacionComoLeida(n.id)}
                        className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200"
                      >
                        Marcar leída
                      </button>
                    )}
                    <button
                      onClick={() => n.id && eliminarNotificacion(n.id)}
                      className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded hover:bg-red-200"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-2 py-1 text-right">
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BellNotificaciones;
