import React from 'react';
import { X, Calendar, Clock, MapPin } from 'lucide-react';
import { CalendarEvent, EventType } from '../../types';

interface WelcomeModalProps {
  userName: string;
  events: CalendarEvent[];
  onClose: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ userName, events, onClose }) => {
  // Imagen de fondo proporcionada
  const bgImage = "https://res.cloudinary.com/dwncmu1wu/image/upload/v1764174220/Captura_de_pantalla_2025-11-26_a_la_s_1.16.16_p._m._gp4lmp.png";

  // Formatear fecha para mostrar
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    // Parsear manualmente la fecha para evitar problemas de zona horaria (UTC vs Local)
    // Asumimos formato YYYY-MM-DD
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Meses en JS son 0-11
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
    }
    
    // Fallback para otros formatos
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  };

  const getEventTitle = (event: CalendarEvent) => {
    switch (event.type) {
      case EventType.EVALUACION:
        return `${event.asignatura} (${event.curso})`;
      case EventType.SALIDA_PEDAGOGICA:
        return `Salida: ${event.cursos?.join(', ')}`;
      case EventType.ACTIVIDAD_FOCALIZADA:
        return event.responsables;
      case EventType.ACTO:
        return 'Acto Escolar';
      default:
        return 'Evento Escolar';
    }
  };

  const getEventDescription = (event: CalendarEvent) => {
    if (event.type === EventType.EVALUACION) {
      return event.contenidos;
    }
    return null;
  };

  const getEventTime = (event: CalendarEvent) => {
    if ('horario' in event) {
      return event.horario;
    }
    return null;
  };

  const getEventLocation = (event: CalendarEvent) => {
    if ('ubicacion' in event) {
      return event.ubicacion;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-scaleIn"
        style={{ maxHeight: '85vh' }}
      >
        {/* Botón de cierre */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors backdrop-blur-md"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Sección de Imagen (Izquierda/Arriba) */}
        <div className="w-full md:w-5/12 relative min-h-[200px] md:min-h-full">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          >
            {/* Overlay degradado para mejorar legibilidad del texto sobre la imagen si fuera necesario */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/10"></div>
          </div>
          
          <div className="absolute bottom-0 left-0 p-6 text-white w-full">
            <h2 className="text-3xl md:text-4xl font-bold mb-2 drop-shadow-lg">¡Hola, {(userName || '').split(' ')[0]}!</h2>
            <p className="text-white/90 text-sm md:text-base drop-shadow-md">Bienvenido/a nuevamente al sistema de gestión.</p>
          </div>
        </div>

        {/* Sección de Contenido (Derecha/Abajo) */}
        <div className="w-full md:w-7/12 p-6 md:p-8 overflow-y-auto bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Actividades de la Semana</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Próximos eventos en el calendario escolar</p>
            </div>
          </div>

          {events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event) => (
                <div 
                  key={event.id} 
                  className="group p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                      event.type === EventType.EVALUACION ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      event.type === EventType.ACTO ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                      event.type === EventType.SALIDA_PEDAGOGICA ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {event.type}
                    </span>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">
                      {formatDate(event.date)}
                    </span>
                  </div>
                  
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
                    {getEventTitle(event)}
                  </h4>
                  
                  {getEventDescription(event) && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                      {getEventDescription(event)}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {getEventTime(event) && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{getEventTime(event)}</span>
                      </div>
                    )}
                    {getEventLocation(event) && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{getEventLocation(event)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-600 dark:text-gray-300">Sin actividades próximas</h4>
              <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mx-auto mt-1">
                No hay eventos programados para los próximos 7 días en el calendario escolar.
              </p>
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all duration-200 transform hover:scale-[1.02]"
            >
              Continuar al Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
