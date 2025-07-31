import React, { useState, useEffect, useMemo } from 'react';
import { MensajeInterno, User, ReadStatus } from '../../types';

const MENSAJES_KEY = 'mensajesInternos';
const USERS_KEY = 'usuariosLiceo';
const READ_STATUS_KEY = 'lir-read-status';

interface MensajeriaInternaProps {
    currentUser: User;
    refreshUnreadCount: () => void;
}

const MensajeriaInterna: React.FC<MensajeriaInternaProps> = ({ currentUser, refreshUnreadCount }) => {
    const [view, setView] = useState<'inbox' | 'sent' | 'compose'>('inbox');
    const [messages, setMessages] = useState<MensajeInterno[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedMessage, setSelectedMessage] = useState<MensajeInterno | null>(null);
    const [readStatus, setReadStatus] = useState<ReadStatus>({ announcements: [], messages: [] });
    
    const initialFormState = { para: '', asunto: '', cuerpo: '' };
    const [formState, setFormState] = useState(initialFormState);

    useEffect(() => {
        try {
            const storedMessages = localStorage.getItem(MENSAJES_KEY);
            if (storedMessages) setMessages(JSON.parse(storedMessages));

            const storedUsers = localStorage.getItem(USERS_KEY);
            if (storedUsers) setUsers(JSON.parse(storedUsers));
            
            const storedReadStatus = localStorage.getItem(`${READ_STATUS_KEY}-${currentUser.id}`);
            if(storedReadStatus) setReadStatus(JSON.parse(storedReadStatus));

        } catch (e) { console.error("Error loading messaging data", e); }
    }, [currentUser.id]);

    const persistMessages = (updatedMessages: MensajeInterno[]) => {
        setMessages(updatedMessages);
        localStorage.setItem(MENSAJES_KEY, JSON.stringify(updatedMessages));
    };

    const persistReadStatus = (updatedStatus: ReadStatus) => {
        setReadStatus(updatedStatus);
        localStorage.setItem(`${READ_STATUS_KEY}-${currentUser.id}`, JSON.stringify(updatedStatus));
        refreshUnreadCount();
    };

    const handleSelectMessage = (message: MensajeInterno) => {
        setSelectedMessage(message);
        if (view === 'inbox' && !readStatus.messages.includes(message.id)) {
            const updatedStatus = { ...readStatus, messages: [...readStatus.messages, message.id] };
            persistReadStatus(updatedStatus);
        }
    };
    
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if(!formState.para || !formState.asunto.trim() || !formState.cuerpo.trim()){
            alert("Destinatario, asunto y cuerpo son obligatorios.");
            return;
        }

        const newMessage: MensajeInterno = {
            id: crypto.randomUUID(),
            de: currentUser.email,
            para: formState.para,
            asunto: formState.asunto,
            cuerpo: formState.cuerpo,
            fecha: new Date().toISOString(),
        };

        // FIX: Read the latest messages from storage before updating to prevent race conditions/stale state.
        const allMessagesData = localStorage.getItem(MENSAJES_KEY);
        const currentMessages: MensajeInterno[] = allMessagesData ? JSON.parse(allMessagesData) : [];
        const updatedMessages = [newMessage, ...currentMessages];

        persistMessages(updatedMessages);
        setFormState(initialFormState);
        setView('sent');
    };
    
    const handleDeleteMessage = (messageId: string) => {
        if (window.confirm("¿Está seguro de que desea eliminar este mensaje?")) {
            persistMessages(messages.filter(m => m.id !== messageId));
            setSelectedMessage(null);
        }
    };
    
    const handleReply = (originalMessage: MensajeInterno) => {
        setFormState({
            para: originalMessage.de,
            asunto: `Re: ${originalMessage.asunto}`,
            cuerpo: `\n\n--- Mensaje Original ---\n${originalMessage.cuerpo}`
        });
        setView('compose');
    };

    const inboxMessages = useMemo(() => messages.filter(m => m.para === currentUser.email).sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()), [messages, currentUser.email]);
    const sentMessages = useMemo(() => messages.filter(m => m.de === currentUser.email).sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()), [messages, currentUser.email]);

    return (
        <div className="bg-white rounded-xl shadow-md flex overflow-hidden min-h-[75vh]">
            {/* Sidebar */}
            <aside className="w-1/4 md:w-1/5 border-r bg-slate-50 flex flex-col">
                <div className="p-4 border-b">
                    <button onClick={() => { setView('compose'); setSelectedMessage(null); }} className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700">Redactar</button>
                </div>
                <nav className="p-2 space-y-1">
                    <button onClick={() => { setView('inbox'); setSelectedMessage(null); }} className={`w-full text-left px-4 py-2 rounded-md font-semibold ${view === 'inbox' ? 'bg-amber-100 text-amber-800' : 'hover:bg-slate-200'}`}>Recibidos</button>
                    <button onClick={() => { setView('sent'); setSelectedMessage(null); }} className={`w-full text-left px-4 py-2 rounded-md font-semibold ${view === 'sent' ? 'bg-amber-100 text-amber-800' : 'hover:bg-slate-200'}`}>Enviados</button>
                </nav>
            </aside>

            {/* Message List */}
            {view !== 'compose' && (
                <div className="w-1/3 md:w-2/5 border-r overflow-y-auto">
                    {(view === 'inbox' ? inboxMessages : sentMessages).map(msg => {
                        const isUnread = view === 'inbox' && !readStatus.messages.includes(msg.id);
                        return (
                             <div key={msg.id} onClick={() => handleSelectMessage(msg)} className={`p-4 border-b cursor-pointer ${selectedMessage?.id === msg.id ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                                <div className="flex justify-between items-start">
                                    <p className={`font-bold truncate ${isUnread ? 'text-slate-800' : 'text-slate-600'}`}>{view === 'inbox' ? msg.de : `Para: ${msg.para}`}</p>
                                    {isUnread && <span className="h-2.5 w-2.5 bg-blue-500 rounded-full flex-shrink-0 ml-2 mt-1"></span>}
                                </div>
                                <p className={`truncate text-sm ${isUnread ? 'text-slate-700 font-semibold' : 'text-slate-500'}`}>{msg.asunto}</p>
                                <p className="text-xs text-slate-400 mt-1">{new Date(msg.fecha).toLocaleString('es-CL')}</p>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Message Content / Compose Form */}
            <main className="flex-1 p-6 overflow-y-auto">
                {view === 'compose' ? (
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-6">Nuevo Mensaje</h2>
                        <form onSubmit={handleSendMessage} className="space-y-4">
                            <div>
                                <label htmlFor="para" className="block text-sm font-medium text-slate-600 mb-1">Para:</label>
                                <select id="para" value={formState.para} onChange={e => setFormState({...formState, para: e.target.value})} required className="w-full border-slate-300 rounded-md shadow-sm">
                                    <option value="">Seleccione un destinatario...</option>
                                    {users.filter(u => u.email !== currentUser.email).map(u => <option key={u.id} value={u.email}>{u.nombreCompleto} ({u.email})</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="asunto" className="block text-sm font-medium text-slate-600 mb-1">Asunto:</label>
                                <input type="text" id="asunto" value={formState.asunto} onChange={e => setFormState({...formState, asunto: e.target.value})} required className="w-full border-slate-300 rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label htmlFor="cuerpo" className="block text-sm font-medium text-slate-600 mb-1">Cuerpo del Mensaje:</label>
                                <textarea id="cuerpo" value={formState.cuerpo} onChange={e => setFormState({...formState, cuerpo: e.target.value})} required rows={12} className="w-full border-slate-300 rounded-md shadow-sm"></textarea>
                            </div>
                            <div className="text-right">
                                <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-5 rounded-lg hover:bg-slate-700">Enviar Mensaje</button>
                            </div>
                        </form>
                    </div>
                ) : selectedMessage ? (
                     <div>
                        <div className="border-b pb-4 mb-4">
                            <h2 className="text-2xl font-bold text-slate-800">{selectedMessage.asunto}</h2>
                            <p className="text-sm text-slate-500 mt-2">
                                <strong>De:</strong> {selectedMessage.de} <br/>
                                <strong>Para:</strong> {selectedMessage.para} <br/>
                                <strong>Fecha:</strong> {new Date(selectedMessage.fecha).toLocaleString('es-CL')}
                            </p>
                        </div>
                        <div className="whitespace-pre-wrap text-slate-700">
                            {selectedMessage.cuerpo}
                        </div>
                         <div className="mt-8 pt-4 border-t flex gap-2">
                            {view === 'inbox' && <button onClick={() => handleReply(selectedMessage)} className="bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300">Responder</button>}
                            <button onClick={() => handleDeleteMessage(selectedMessage.id)} className="bg-red-100 text-red-700 font-semibold py-2 px-4 rounded-lg hover:bg-red-200">Eliminar</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-center text-slate-500">
                        <p>Seleccione un mensaje para leerlo.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default MensajeriaInterna;