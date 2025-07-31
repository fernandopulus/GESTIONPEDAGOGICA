import React, { useState, FormEvent } from 'react';
import { User } from '../../types';

interface SettingsModalProps {
    user: User;
    onClose: () => void;
    onSave: (updatedUser: User) => void;
}

const USERS_KEY = 'usuariosLiceo';

const SettingsModal: React.FC<SettingsModalProps> = ({ user, onClose, onSave }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!password) {
            setError('La contraseña no puede estar en blanco.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        const updatedUser: User = {
            ...user,
            password: password,
        };

        try {
            const allUsersData = localStorage.getItem(USERS_KEY);
            let allUsers: User[] = allUsersData ? JSON.parse(allUsersData) : [];
            const userIndex = allUsers.findIndex(u => u.id === user.id);

            if (userIndex > -1) {
                allUsers[userIndex] = updatedUser;
            } else {
                allUsers.push(updatedUser);
            }
            
            localStorage.setItem(USERS_KEY, JSON.stringify(allUsers));
            onSave(updatedUser);
            onClose();

        } catch (error) {
            console.error("Failed to save new password:", error);
            setError("No se pudo guardar la nueva contraseña.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">Configuración de Cuenta</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Usuario</label>
                                <p className="p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300">{user.email}</p>
                            </div>
                            <div>
                                <label htmlFor="newPassword"className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Nueva Contraseña
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="newPassword"
                                        name="newPassword"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    />
                                </div>
                            </div>
                             <div>
                                <label htmlFor="confirmPassword"className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Confirmar Nueva Contraseña
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    />
                                </div>
                            </div>
                            {error && (
                                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 text-sm" role="alert">
                                    <p>{error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 rounded-b-xl flex justify-end items-center gap-3">
                        <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">
                            Cancelar
                        </button>
                        <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700">
                            Cambiar Contraseña
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SettingsModal;