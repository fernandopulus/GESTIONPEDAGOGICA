import React, { useState, useEffect, useCallback } from 'react';
import { User, Anuncio, MensajeInterno, ReadStatus } from '../../types';
import { HomeIcon, BellIcon, MessageSquareIcon, MenuIcon } from '../constants';
import Dropdown from './common/Dropdown';
import ProfileModal from './modals/ProfileModal';
import SettingsModal from './modals/SettingsModal';

const ANUNCIOS_KEY = 'anunciosMuro';
const MENSAJES_KEY = 'mensajesInternos';
const READ_STATUS_KEY = 'lir-read-status';

interface TopBarProps {
    currentUser: User;
    onLogout: () => void;
    onNavigate: (moduleName: string) => void;
    onUserUpdate: (updatedUser: User) => void;
    onChangeProfile: () => void;
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

const TopBar: React.FC<TopBarProps> = ({ currentUser, onLogout, onNavigate, onUserUpdate, onChangeProfile, toggleSidebar, unreadMessagesCount, refreshUnreadCount }) => {
    const [unreadAnnouncements, setUnreadAnnouncements] = useState<Anuncio[]>([]);
    const [recentMessages, setRecentMessages] = useState<MensajeInterno[]>([]);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

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
                .sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                .slice(0, 5)
        );
    }, [currentUser.id, getReadStatus, unreadMessagesCount]);

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

    return (
        <>
            <header className="bg-white shadow-md sticky top-0 z-40 h-16">
                <div className="container mx-auto px-4 h-full flex justify-between items-center">
                    {/* Left Side */}
                    <div className="flex items-center gap-2">
                        <button className="text-slate-600 dark:text-slate-300 md:hidden mr-2" onClick={toggleSidebar}>
                            <MenuIcon />
                        </button>
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('Dashboard')}>
                             <svg className="w-8 h-8 text-slate-700 dark:text-slate-200" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V6.5A2.5 2.5 0 0 0 17.5 4h-11A2.5 2.5 0 0 0 4 6.5v13Z" stroke="currentColor" strokeWidth="1.5"/><path d="M16 4.5V17" stroke="currentColor" strokeWidth="1.5"/></svg>
                             <span className="text-xl font-bold text-slate-800 dark:text-slate-200 hidden sm:block">Gestión LIR</span>
                        </div>
                    </div>
                    
                    {/* Center Navigation (placeholder for now) */}
                    <div className="flex-1 flex justify-center">
                         <button onClick={() => onNavigate('Calendario Académico')} className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Calendario Académico">
                            <HomeIcon />
                        </button>
                    </div>

                    {/* Right Side */}
                    <div className="flex items-center gap-2">
                        <Dropdown
                            onOpen={handleOpenAnnouncements}
                            trigger={
                                <button className="relative p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 transition-colors" title="Notificaciones">
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
                                    {currentUser.email === 'subdi@lir.cl' && (
                                        <li><button onClick={onChangeProfile} className="w-full text-left p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600">Cambiar Perfil</button></li>
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