import React, { useState, useEffect, useCallback } from 'react';
import { User, Anuncio, MensajeInterno, ReadStatus } from '../types';
import { Profile } from '../types';
import { HomeIcon, BellIcon, MessageSquareIcon, MenuIcon } from '../constants';
import Dropdown from './common/Dropdown';
import ProfileModal from './modals/ProfileModal';
import SettingsModal from './modals/SettingsModal';

// 👇 Importa lucide para el ícono PIE
import { Puzzle } from 'lucide-react';

import {
  subscribeToNotificacionesParaUsuario,
  marcarNotificacionComoLeida,
  eliminarNotificacion,
  type NotificacionDocente
} from '../src/firebaseHelpers/notificacionesHelper';

const ANUNCIOS_KEY = 'anunciosMuro';
const MENSAJES_KEY = 'mensajesInternos';
const READ_STATUS_KEY = 'lir-read-status';

interface TopBarProps {
  currentUser: User;
  onLogout: () => void;
  onNavigate: (moduleName: string) => void;
  onUserUpdate: (updatedUser: User) => void;
  onChangeProfile?: () => void;
  canChangeProfile: boolean;
  toggleSidebar: () => void;
  unreadMessagesCount: number;
  refreshUnreadCount: () => void;
}

const UserAvatar: React.FC<{ user: User }> = ({ user }) => {
  if (user.fotoUrl) {
    return <img src={user.fotoUrl} alt={user.nombreCompleto || 'Avatar de usuario'} className="h-9 w-9 rounded-full object-cover" />;
  }
  const fullName = user.nombreCompleto || '';
  const initials = String(fullName).split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
      {initials.substring(0, 2)}
    </div>
  );
};

const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  onLogout,
  onNavigate,
  onUserUpdate,
  onChangeProfile,
  canChangeProfile,
  toggleSidebar,
  unreadMessagesCount,
  refreshUnreadCount
}) => {
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<Anuncio[]>([]);
  const [recentMessages, setRecentMessages] = useState<MensajeInterno[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Notificaciones PIE en memoria (ya filtradas)
  const [pieNotifications, setPieNotifications] = useState<NotificacionDocente[]>([]);

  const getReadStatus = useCallback((): ReadStatus => {
    try {
      const status = localStorage.getItem(`${READ_STATUS_KEY}-${currentUser.id}`);
      return status ? JSON.parse(status) : { announcements: [], messages: [] };
    } catch {
      return { announcements: [], messages: [] };
    }
  }, [currentUser.id]);

  const setReadStatus = useCallback((status: ReadStatus) => {
    try {
      localStorage.setItem(`${READ_STATUS_KEY}-${currentUser.id}`, JSON.stringify(status));
    } catch (error) {
      console.error("Failed to set read status:", error);
    }
  }, [currentUser.id]);

  useEffect(() => {
    const allAnnouncements: Anuncio[] = JSON.parse(localStorage.getItem(ANUNCIOS_KEY) || '[]');
    const readStatus = getReadStatus();
    setUnreadAnnouncements(allAnnouncements.filter(a => !readStatus.announcements.includes(a.id)));

    const allMessages: MensajeInterno[] = JSON.parse(localStorage.getItem(MENSAJES_KEY) || '[]');
    setRecentMessages(
      allMessages
        .filter(m => m.para === currentUser.email)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 5)
    );
  }, [currentUser.id, getReadStatus, unreadMessagesCount]);

  // Suscripción realtime a notificaciones -> filtramos sólo las del módulo PIE
  useEffect(() => {
    // Solo perfiles autorizados según reglas típicas (Subdirección/Profesorado y Coordinación TP) para minimizar permission-denied
    const allowedProfile = currentUser?.profile === Profile.SUBDIRECCION || currentUser?.profile === Profile.PROFESORADO || currentUser?.profile === Profile.COORDINACION_TP;
    if (!allowedProfile || !currentUser?.email) return;
    const unsub = subscribeToNotificacionesParaUsuario(
      { email: currentUser.email, nombreCompleto: currentUser.nombreCompleto },
      (items) => {
        const onlyPIE = items.filter(n =>
          (n.tipo && (n.tipo.toLowerCase() === 'pie' || n.tipo === 'nueva_intervencion'))
        );
        setPieNotifications(onlyPIE);
      }
    );
    return () => unsub();
  }, [currentUser?.email, currentUser?.nombreCompleto, currentUser?.profile]);

  const handleOpenAnnouncements = () => {
    const readStatus = getReadStatus();
    const allAnnouncementIds = (JSON.parse(localStorage.getItem(ANUNCIOS_KEY) || '[]') as Anuncio[]).map(a => a.id);
    readStatus.announcements = allAnnouncementIds;
    setReadStatus(readStatus);
    setUnreadAnnouncements([]);
  };

  const handleOpenMessages = () => {
    const readStatus = getReadStatus();
    const allMessages: MensajeInterno[] = JSON.parse(localStorage.getItem(MENSAJES_KEY) || '[]');
    const myMessageIds = allMessages.filter(m => m.para === currentUser.email).map(m => m.id);
    readStatus.messages = [...new Set([...readStatus.messages, ...myMessageIds])];
    setReadStatus(readStatus);
    refreshUnreadCount();
  };

  const unreadPIE = pieNotifications.filter(n => !n.leida).length;

  // Util para mostrar fecha de forma segura
  const formatFecha = (n: NotificacionDocente) => {
    try {
      // @ts-ignore (Timestamp de Firestore)
      const d = n.createdAt?.toDate ? n.createdAt.toDate() : new Date(n.createdAt);
      return d ? d.toLocaleString('es-CL') : '';
    } catch {
      return '';
    }
  };

  return (
    <>
      <header className="bg-white shadow-md sticky top-0 z-40 h-16">
        <div className="container mx-auto px-4 h-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button className="text-slate-600 dark:text-slate-300 md:hidden mr-2" onClick={toggleSidebar}>
              <MenuIcon />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('Dashboard')}>
              <img 
                src="https://res.cloudinary.com/dwncmu1wu/image/upload/v1754153206/ChatGPT_Image_2_ago_2025_12_46_35_p.m._qsqj5e.png" 
                alt="Logo LIR" 
                className="w-8 h-8 object-contain" 
              />
              <span className="text-xl font-bold text-slate-800 dark:text-slate-200 hidden sm:block">Gestión LIR</span>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <button onClick={() => onNavigate('Calendario Académico')} className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Calendario Académico">
              <HomeIcon />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Espacio para notificaciones */}

            {/* Anuncios */}
            <Dropdown
              onOpen={handleOpenAnnouncements}
              trigger={
                <button className="relative p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 transition-colors" title="Anuncios">
                  <BellIcon />
                  {unreadAnnouncements.length > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadAnnouncements.length}</span>
                  )}
                </button>
              }
            >
              <div className="p-2">
                <h3 className="font-semibold px-2 pb-1 border-b dark:border-slate-600 text-slate-800 dark:text-slate-200">Anuncios Recientes</h3>
                <ul className="mt-1">
                  {unreadAnnouncements.slice(0, 3).map(anuncio => (
                    <li key={anuncio.id} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 text-sm">
                      <p className="font-bold dark:text-slate-200">{anuncio.titulo}</p>
                      <p className="text-slate-600 dark:text-slate-400 truncate">{anuncio.mensaje}</p>
                    </li>
                  ))}
                  {unreadAnnouncements.length === 0 && <li className="p-2 text-sm text-slate-500 dark:text-slate-400">No hay anuncios nuevos.</li>}
                </ul>
                <button onClick={() => onNavigate('Muro de Anuncios')} className="w-full mt-2 text-center text-sm font-semibold text-amber-600 hover:underline p-2">Ver todo</button>
              </div>
            </Dropdown>

            {/* PIE: notificaciones del módulo Inclusión (solo perfiles autorizados) */}
            {(currentUser.profile === Profile.SUBDIRECCION || currentUser.profile === Profile.PROFESORADO || currentUser.profile === Profile.COORDINACION_TP) && (
            <Dropdown
              trigger={
                <button
                  className="relative p-2 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-700 dark:bg-sky-900/30 dark:hover:bg-sky-900/40 dark:text-sky-300 transition-colors"
                  title="Notificaciones PIE"
                >
                  <Puzzle className="w-5 h-5" />
                  {unreadPIE > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadPIE}
                    </span>
                  )}
                </button>
              }
            >
              <div className="p-2 w-80">
                <h3 className="font-semibold px-2 pb-1 border-b dark:border-slate-600 text-slate-800 dark:text-slate-200">
                  Notificaciones PIE
                </h3>
                <ul className="mt-1 max-h-80 overflow-y-auto divide-y dark:divide-slate-700">
                  {pieNotifications.length === 0 && (
                    <li className="p-3 text-sm text-slate-500 dark:text-slate-400">No hay notificaciones.</li>
                  )}
                  {pieNotifications.map(n => (
                    <li key={n.id} className="p-2 text-sm">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{n.titulo}</div>
                          <div className="text-slate-600 dark:text-slate-400 whitespace-pre-line">{n.mensaje}</div>
                          {n.estudianteNombre && (
                            <div className="text-xs text-slate-500 mt-1">
                              Estudiante: <b>{n.estudianteNombre}</b>
                            </div>
                          )}
                          <div className="text-[11px] text-slate-400 mt-1">
                            {formatFecha(n)}
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
                    </li>
                  ))}
                </ul>
              </div>
            </Dropdown>
            )}

            {/* Mensajes */}
            <Dropdown
              onOpen={handleOpenMessages}
              trigger={
                <button className="relative p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 transition-colors" title="Mensajes">
                  <MessageSquareIcon />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadMessagesCount}</span>
                  )}
                </button>
              }
            >
              <div className="p-2">
                <h3 className="font-semibold px-2 pb-1 border-b dark:border-slate-600 text-slate-800 dark:text-slate-200">Mensajes</h3>
                <ul className="mt-1">
                  {recentMessages.slice(0, 3).map(msg => (
                    <li key={msg.id} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 text-sm">
                      <p className="font-bold dark:text-slate-200">De: {msg.de}</p>
                      <p className="text-slate-600 dark:text-slate-400 truncate">{msg.asunto}</p>
                    </li>
                  ))}
                  {recentMessages.length === 0 && <li className="p-2 text-sm text-slate-500 dark:text-slate-400">No hay mensajes recientes.</li>}
                </ul>
                <button onClick={() => onNavigate('Mensajería Interna')} className="w-full mt-2 text-center text-sm font-semibold text-amber-600 hover:underline p-2">Ir a la bandeja</button>
              </div>
            </Dropdown>

            <Dropdown
              trigger={
                <button className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                  <UserAvatar user={currentUser} />
                </button>
              }
            >
              <div className="p-2">
                <div className="px-2 py-2 border-b dark:border-slate-600">
                  <p className="font-bold text-slate-800 dark:text-slate-200">{currentUser.nombreCompleto}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{currentUser.profile}</p>
                </div>
                <ul className="mt-2 text-slate-700 dark:text-slate-300">
                  <li><button onClick={() => setIsProfileModalOpen(true)} className="w-full text-left p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600">Editar Perfil</button></li>
                  <li><button onClick={() => setIsSettingsModalOpen(true)} className="w-full text-left p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600">Configuración</button></li>
                  {canChangeProfile && (
                    <li><button onClick={onChangeProfile} className="w-full text-left p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600">👑 Cambiar Vista</button></li>
                  )}
                  <li><button onClick={onLogout} className="w-full text-left p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600">Cerrar Sesión</button></li>
                </ul>
              </div>
            </Dropdown>
          </div>
        </div>
      </header>

      {isProfileModalOpen && (
        <ProfileModal
          user={currentUser}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={onUserUpdate}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          user={currentUser}
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={onUserUpdate}
        />
      )}
    </>
  );
};

export default TopBar;
