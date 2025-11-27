import React, { useState, FormEvent, ChangeEvent } from 'react';
import { User } from '../../types';
import { auth, storage } from '../../src/firebase';
import { updateUserProfile } from '../../src/firebaseHelpers/authHelper';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0] || null;
        setFile(selected);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            setUploading(true);
            let fotoUrlFinal = formData.fotoUrl || '';

            if (file) {
                const current = auth.currentUser;
                if (!current) {
                    throw new Error('No hay usuario autenticado en Firebase.');
                }

                const fileExt = file.name.split('.').pop() || 'jpg';
                const storageRef = ref(storage, `users/${current.uid}/avatar.${fileExt}`);
                await uploadBytes(storageRef, file);
                fotoUrlFinal = await getDownloadURL(storageRef);
            }

            const updatedUser: User = {
                ...user,
                nombreCompleto: formData.nombreCompleto,
                email: formData.email,
                fotoUrl: fotoUrlFinal,
            };

            const docKey = user.id || user.email;
            if (!docKey) {
                throw new Error('No se encontró identificador del usuario para actualizar.');
            }

            await updateUserProfile(docKey, {
                nombreCompleto: formData.nombreCompleto,
                email: formData.email,
                fotoUrl: fotoUrlFinal,
            });

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
        } catch (error: any) {
            console.error("Failed to save user profile:", error);
            alert(`No se pudo guardar el perfil: ${error.message || error}`);
        } finally {
            setUploading(false);
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
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Foto de Perfil</label>
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                                        {formData.fotoUrl ? (
                                            <img src={formData.fotoUrl} alt="Foto actual" className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-xs text-slate-500">Sin foto</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="block w-full text-sm text-slate-600 dark:text-slate-200 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                                        />
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Se subirá la imagen a Storage y se actualizará tu foto de perfil.</p>
                                    </div>
                                </div>
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
                        <button type="submit" disabled={uploading} className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 disabled:opacity-60">
                            {uploading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileModal;