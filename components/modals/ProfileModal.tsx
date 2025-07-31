import React, { useState, FormEvent } from 'react';
import { User } from '../../types';

interface ProfileModalProps {
    user: User;
    onClose: () => void;
    onSave: (updatedUser: User) => void;
}

const USERS_KEY = 'usuariosLiceo';

const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        nombreCompleto: user.nombreCompleto,
        email: user.email,
        fotoUrl: user.fotoUrl || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        
        const updatedUser: User = {
            ...user,
            ...formData,
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
            onSave(updatedUser); // Update state in App.tsx
            onClose();

        } catch (error) {
            console.error("Failed to save user profile:", error);
            alert("No se pudo guardar el perfil.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">Editar Perfil</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="fotoUrl" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">URL de la Foto de Perfil</label>
                                <input
                                    type="url"
                                    id="fotoUrl"
                                    name="fotoUrl"
                                    value={formData.fotoUrl}
                                    onChange={handleChange}
                                    className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    placeholder="https://ejemplo.com/foto.jpg"
                                />
                            </div>
                            <div>
                                <label htmlFor="nombreCompleto" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre Completo</label>
                                <input
                                    type="text"
                                    id="nombreCompleto"
                                    name="nombreCompleto"
                                    value={formData.nombreCompleto}
                                    onChange={handleChange}
                                    required
                                    className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Correo Electrónico</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Función</label>
                                <p className="p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300">{user.profile}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 rounded-b-xl flex justify-end items-center gap-3">
                        <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">
                            Cancelar
                        </button>
                        <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700">
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileModal;