import React, { useState, useEffect, useMemo } from 'react';
import { MensajeInterno, User, ReadStatus } from '../../types';
import {
    subscribeToMessages,
    subscribeToAllUsers,
    subscribeToReadStatus,
    sendMessage,
    deleteMessage,
    markMessageAsRead,
} from '../../src/firebaseHelpers/mensajeriaHelper'; // AJUSTA la ruta a tu nuevo helper

interface MensajeriaInternaProps {
    currentUser: User;
    refreshUnreadCount: () => void; // Esta función se mantiene para actualizar el contador en la UI principal
}

const MensajeriaInterna: React.FC<MensajeriaInternaProps> = ({ currentUser, refreshUnreadCount }) => {
    const [view, setView] = useState<'inbox' | 'sent' | 'compose'>('inbox');
    const [messages, setMessages] = useState<MensajeInterno[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedMessage, setSelectedMessage] = useState<MensajeInterno | null>(null);
    const [readStatus, setReadStatus] = useState<ReadStatus>({ announcements: [], messages: [] });
    const [loading, setLoading] = useState(true);
    
    const initialFormState = { para: '', asunto: '', cuerpo: '' };
    const [formState, setFormState] = useState(initialFormState);

    useEffect(() => {
        if (!currentUser.id || !currentUser.email) {
            setLoading(false);
            return;
        };

        setLoading(true);

        const unsubMessages = subscribeToMessages(currentUser.email, (data) => {
            setMessages(data);
            setLoading(false); // <-- CAMBIO CLAVE: Se mueve aquí para esperar la carga inicial
        });
        const unsubUsers = subscribeToAllUsers(setUsers);
        const unsubReadStatus = subscribeToReadStatus(currentUser.id, (status) => {
            setReadStatus(status);
            refreshUnreadCount(); // Llama a la actualización del contador cada vez que cambia el estado de lectura
        });

        // Limpiar todas las suscripciones al desmontar el componente
        return () => {
            unsubMessages();
            unsubUsers();
            unsubReadStatus();
        };
    }, [currentUser.id, currentUser.email, refreshUnreadCount]);

    const handleSelectMessage = (message: MensajeInterno) => {
        setSelectedMessage(message);
        // Si el mensaje está en la bandeja de entrada y no ha sido leído, márcalo como leído
        if (view === 'inbox' && !readStatus.messages.includes(message.id)) {
            markMessageAsRead(currentUser.id, message.id).catch(err => {
                console.error("Failed to mark message as read:", err);
            });
        }
    };
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!formState.para || !formState.asunto.trim() || !formState.cuerpo.trim()){
            alert("Destinatario, asunto y cuerpo son obligatorios.");
            return;
        }

        const newMessage: Omit<MensajeInterno, 'id' | 'fecha'> = {
            de: currentUser.email,
            para: formState.para,
            asunto: formState.asunto,
            cuerpo: formState.cuerpo,
        };

        try {
            await sendMessage(newMessage);
            setFormState(initialFormState);
            setView('sent'); // Cambia a la vista de enviados después de enviar
        } catch (error) {
            console.error("Error sending message:", error);
            alert("No se pudo enviar el mensaje. Inténtelo de nuevo.");
        }
    };
    
    const handleDeleteMessage = async (messageId: string) => {
        if (window.confirm("¿Está seguro de que desea eliminar este mensaje? Esta acción es irreversible.")) {
            try {
                await deleteMessage(messageId);
                setSelectedMessage(null); // Deselecciona el mensaje después de borrarlo
            } catch (error) {
                console.error("Error deleting message:", error);
                alert("No se pudo eliminar el mensaje.");
            }
        }
    };
    
    const handleReply = (originalMessage: MensajeInterno) => {
        setFormState({
            para: originalMessage.de,
            asunto: `Re: ${originalMessage.asunto}`,
            cuerpo: `\n\n--- Mensaje Original ---\nDe: ${originalMessage.de}\nFecha: ${new Date(originalMessage.fecha).toLocaleString('es-CL')}\n\n${originalMessage.cuerpo}`
        });
        setView('compose');
    };

    const inboxMessages = useMemo(() => messages.filter(m => m.para === currentUser.email), [messages, currentUser.email]);
    const sentMessages = useMemo(() => messages.filter(m => m.de === currentUser.email), [messages, currentUser.email]);

    if (loading) {
        return <div className="flex items-center justify-center h-full">Cargando mensajería...</div>
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md flex overflow-hidden min-h-[75vh]">
            {/* Sidebar */}
            <aside className="w-1/4 md:w-1/5 border-r bg-slate-50 dark:bg-slate-800 flex flex-col">
                <div className="p-4 border-b dark:border-slate-700">
                    <button onClick={() => { setView('compose'); setSelectedMessage(null); setFormState(initialFormState); }} className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">Redactar</button>
                </div>
                <nav className="p-2 space-y-1">
                    <button onClick={() => { setView('inbox'); setSelectedMessage(null); }} className={`w-full text-left px-4 py-2 rounded-md font-semibold ${view === 'inbox' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Recibidos</button>
                    <button onClick={() => { setView('sent'); setSelectedMessage(null); }} className={`w-full text-left px-4 py-2 rounded-md font-semibold ${view === 'sent' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Enviados</button>
                </nav>
            </aside>

            {/* Message List */}
            {view !== 'compose' && (
                <div className="w-1/3 md:w-2/5 border-r dark:border-slate-700 overflow-y-auto">
                    {(view === 'inbox' ? inboxMessages : sentMessages).map(msg => {
                        const isUnread = view === 'inbox' && !readStatus.messages.includes(msg.id);
                        return (
                             <div key={msg.id} onClick={() => handleSelectMessage(msg)} className={`p-4 border-b dark:border-slate-700 cursor-pointer ${selectedMessage?.id === msg.id ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                <div className="flex justify-between items-start">
                                    <p className={`font-bold truncate ${isUnread ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>{view === 'inbox' ? msg.de : `Para: ${msg.para}`}</p>
                                    {isUnread && <span className="h-2.5 w-2.5 bg-blue-500 rounded-full flex-shrink-0 ml-2 mt-1"></span>}
                                </div>
                                <p className={`truncate text-sm ${isUnread ? 'text-slate-700 dark:text-slate-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>{msg.asunto}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{new Date(msg.fecha).toLocaleString('es-CL')}</p>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Message Content / Compose Form */}
            <main className="flex-1 p-6 overflow-y-auto">
                {view === 'compose' ? (
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">Nuevo Mensaje</h2>
                        <form onSubmit={handleSendMessage} className="space-y-4">
                            <div>
                                <label htmlFor="para" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Para:</label>
                                <select id="para" value={formState.para} onChange={e => setFormState({...formState, para: e.target.value})} required className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                                    <option value="">Seleccione un destinatario...</option>
                                    {users.filter(u => u.email !== currentUser.email).map(u => <option key={u.id} value={u.email}>{u.nombreCompleto} ({u.email})</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="asunto" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asunto:</label>
                                <input type="text" id="asunto" value={formState.asunto} onChange={e => setFormState({...formState, asunto: e.target.value})} required className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                            </div>
                            <div>
                                <label htmlFor="cuerpo" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Cuerpo del Mensaje:</label>
                                <textarea id="cuerpo" value={formState.cuerpo} onChange={e => setFormState({...formState, cuerpo: e.target.value})} required rows={12} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"></textarea>
                            </div>
                            <div className="text-right">
                                <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-5 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">Enviar Mensaje</button>
                            </div>
                        </form>
                    </div>
                ) : selectedMessage ? (
                     <div>
                        <div className="border-b dark:border-slate-700 pb-4 mb-4">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{selectedMessage.asunto}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                <strong>De:</strong> {selectedMessage.de} <br/>
                                <strong>Para:</strong> {selectedMessage.para} <br/>
                                <strong>Fecha:</strong> {new Date(selectedMessage.fecha).toLocaleString('es-CL')}
                            </p>
                        </div>
                        <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                            {selectedMessage.cuerpo}
                        </div>
                         <div className="mt-8 pt-4 border-t dark:border-slate-700 flex gap-2">
                            {view === 'inbox' && <button onClick={() => handleReply(selectedMessage)} className="bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">Responder</button>}
                            <button onClick={() => handleDeleteMessage(selectedMessage.id)} className="bg-red-100 text-red-700 font-semibold py-2 px-4 rounded-lg hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60">Eliminar</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">
                        <p>Seleccione un mensaje para leerlo.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default MensajeriaInterna;
