import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { User, Profile } from '../../types';
import { CURSOS, ASIGNATURAS } from '../../constants';
import { read, utils } from 'xlsx';
import MonitorDeUso from './MonitorDeUso';
// CAMBIO: Importar los módulos para llamar a las Firebase Functions
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAllUsers } from '../../src/firebaseHelpers/users';

const ALL_PROFILES = Object.values(Profile);
const KeyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.629 5.629l-2.371 2.37-1.414-1.414 2.371-2.371A6 6 0 0115 7zm-3.707 5.293L6 17.586V20h2.414l5.293-5.293a1 1 0 00-1.414-1.414z" /></svg>;

const normalizeCurso = (curso: string): string => {
    if (!curso) return '';
    let normalized = curso.trim().toLowerCase().replace(/°/g, 'º').replace(/\s+(medio|básico|basico)/g, '').replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º').replace(/^(\d)(?![º])/, '$1º').replace(/\s+/g, '').toUpperCase();
    return normalized;
};

const Administracion: React.FC = () => {
    // ... (El resto de tus estados se mantienen igual)
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'Usuarios' | 'Monitor de Uso'>('Usuarios');
    const [userFormData, setUserFormData] = useState<Omit<User, 'id'>>({ nombreCompleto: '', email: '', rut: '', profile: Profile.PROFESORADO, password: '', curso: '', cursos: [], asignaturas: [] });
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [userFilterProfile, setUserFilterProfile] = useState('');
    const [userFilterCurso, setUserFilterCurso] = useState('');
    const [userError, setUserError] = useState<string | null>(null);
    const [studentUploadStatus, setStudentUploadStatus] = useState<{ message: string; isError: boolean } | null>(null);
    const [staffUploadStatus, setStaffUploadStatus] = useState<{ message: string; isError: boolean } | null>(null);


    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const usersFS = await getAllUsers();
            setUsers(usersFS);
        } catch (e) {
            console.error("Error al cargar usuarios", e);
            setUserError("No se pudieron cargar los usuarios.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // ... (handleUserFieldChange, handleAssignmentChange, handleUserResetForm se mantienen igual)
    const handleUserFieldChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setUserFormData(prev => ({ ...prev, [name]: value, curso: name === 'profile' && value !== Profile.ESTUDIANTE ? '' : prev.curso }));
    }, []);
    const handleAssignmentChange = useCallback((type: 'cursos' | 'asignaturas', value: string) => {
        setUserFormData(prev => {
            const currentValues = prev[type] || [];
            const newValues = currentValues.includes(value) ? currentValues.filter(item => item !== value) : [...currentValues, value];
            return { ...prev, [type]: newValues };
        });
    }, []);
    const handleUserResetForm = useCallback(() => {
        setUserFormData({ nombreCompleto: '', email: '', rut: '', profile: Profile.PROFESORADO, password: '', curso: '', cursos: [], asignaturas: [] });
        setEditingUserId(null);
        setUserError(null);
    }, []);


    // CAMBIO: Lógica de envío adaptada para usar Firebase Functions
    const handleUserSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        setUserError(null);
        const { nombreCompleto, email, profile, curso, password } = userFormData;
        
        if (!nombreCompleto.trim() || !email.trim()) {
            setUserError('Nombre Completo y Email son obligatorios.');
            return;
        }
        if (profile === Profile.ESTUDIANTE && !curso) {
            setUserError('El campo "Curso" es obligatorio para Estudiantes.');
            return;
        }
        if (!editingUserId && !password?.trim()) {
            setUserError('La contraseña es obligatoria al crear un nuevo usuario.');
            return;
        }

        const functions = getFunctions();
        
        try {
            if (editingUserId) {
                // Actualizar usuario existente
                const updateUserFunc = httpsCallable(functions, 'updateUser');
                const userDataToUpdate = { ...userFormData, password: password?.trim() || undefined, curso: profile === Profile.ESTUDIANTE ? normalizeCurso(curso || '') : undefined };
                await updateUserFunc(userDataToUpdate);
            } else {
                // Crear nuevo usuario
                const createUserFunc = httpsCallable(functions, 'createUser');
                const userDataToCreate = { ...userFormData, curso: profile === Profile.ESTUDIANTE ? normalizeCurso(curso || '') : undefined };
                await createUserFunc(userDataToCreate);
            }
            await fetchUsers();
            handleUserResetForm();
        } catch (err: any) {
            console.error("Error al guardar usuario:", err);
            setUserError(err.message || "Error al guardar el usuario.");
        }
    }, [userFormData, editingUserId, fetchUsers, handleUserResetForm]);

    const handleUserEdit = useCallback((user: User) => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setEditingUserId(user.email); // Usar email como ID único para la edición
        setUserFormData({ nombreCompleto: user.nombreCompleto, email: user.email, rut: user.rut || '', profile: user.profile, password: '', curso: user.curso || '', cursos: user.cursos || [], asignaturas: user.asignaturas || [] });
    }, []);

    // CAMBIO: Lógica de eliminación adaptada para usar Firebase Functions
    const handleUserDelete = useCallback(async (email: string) => {
        if (window.confirm(`¿Está seguro de que desea eliminar al usuario ${email}? Esta acción es irreversible.`)) {
            try {
                const functions = getFunctions();
                const deleteUserFunc = httpsCallable(functions, 'deleteUser');
                await deleteUserFunc({ email });
                await fetchUsers();
            } catch (err: any) {
                console.error("Error al eliminar usuario:", err);
                setUserError(err.message || "No se pudo borrar el usuario.");
            }
        }
    }, [fetchUsers]);
    
    // ... (El resto del componente, como las cargas masivas y la renderización, se mantiene similar pero ahora llamará a las funciones correctas)
     const handleStudentBulkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setStudentUploadStatus({ message: 'Procesando archivo...', isError: false });
        const functions = getFunctions();
        const createUserFunc = httpsCallable(functions, 'createUser');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const json: any[] = utils.sheet_to_json(worksheet);

                // ... (misma lógica de validación de excel que ya tenías)

                const creationPromises = json.map(row => {
                    const nombre = row['Nombre'] || row['nombre'];
                    const correo = row['Correo'] || row['correo'];
                    const curso = row['Curso'] || row['curso'];
                    if (!nombre || !correo || !curso) return null;

                    return createUserFunc({
                        nombreCompleto: String(nombre).trim(),
                        email: String(correo).trim(),
                        profile: Profile.ESTUDIANTE,
                        curso: normalizeCurso(String(curso).trim()),
                        password: "recoleta" // Contraseña por defecto para carga masiva
                    }).catch(err => ({ email: correo, error: err.message }));
                }).filter(p => p !== null);

                const results = await Promise.all(creationPromises);
                const successfulUploads = results.filter(r => !r.error).length;
                const failedUploads = results.filter(r => r.error);

                let message = `Carga completada. ${successfulUploads} estudiantes agregados.`;
                if (failedUploads.length > 0) {
                    message += ` ${failedUploads.length} fallaron. Revise la consola para más detalles.`;
                    console.error("Errores en carga masiva:", failedUploads);
                }
                setStudentUploadStatus({ message, isError: failedUploads.length > 0 });
                await fetchUsers();
            } catch (err: any) {
                setStudentUploadStatus({ message: `Error: ${err.message}`, isError: true });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // La renderización del JSX se mantiene igual...
    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";
    const availableCourses = useMemo(() => Array.from(new Set(users.filter(u => u.profile === Profile.ESTUDIANTE && u.curso).map(u => u.curso!))).sort(), [users]);
    const filteredUsers = useMemo(() => users.filter(user => (userSearchTerm === '' || user.nombreCompleto.toLowerCase().includes(userSearchTerm.toLowerCase()) || user.email.toLowerCase().includes(userSearchTerm.toLowerCase())) && (userFilterProfile === '' || user.profile === userFilterProfile) && (userFilterCurso === '' || user.curso === userFilterCurso)), [users, userSearchTerm, userFilterProfile, userFilterCurso]);

    return (
        <div className="space-y-8 animate-fade-in">
             <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Administración</h1>
            
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('Usuarios')} className={`${activeTab === 'Usuarios' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`}>
                        Gestión de Usuarios
                    </button>
                    <button onClick={() => setActiveTab('Monitor de Uso')} className={`${activeTab === 'Monitor de Uso' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`}>
                        Monitor de Uso
                    </button>
                </nav>
            </div>
            {activeTab === 'Usuarios' && (
                <div className="space-y-8">
                    {/* ... (Tu JSX para el formulario, tabla, etc. No necesita grandes cambios) ... */}
                     <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">{editingUserId ? 'Editando usuario' : 'Agregar nuevo usuario'}</h2>
                        <form onSubmit={handleUserSubmit} className="space-y-6">
                            {/* ... (El formulario se mantiene igual) ... */}
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre Completo</label>
                                    <input type="text" name="nombreCompleto" value={userFormData.nombreCompleto} onChange={handleUserFieldChange} className={inputStyles} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Email</label>
                                    <input type="email" name="email" value={userFormData.email} onChange={handleUserFieldChange} className={inputStyles} required readOnly={!!editingUserId} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Contraseña</label>
                                    <input type="password" name="password" value={userFormData.password || ''} onChange={handleUserFieldChange} placeholder={editingUserId ? "Dejar en blanco para no cambiar" : "Contraseña temporal"} className={inputStyles} />
                                </div>
                                {/* ... (resto de los inputs) ... */}
                                  <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">RUT (Opcional)</label>
                                    <input type="text" name="rut" value={userFormData.rut || ''} onChange={handleUserFieldChange} placeholder="12.345.678-9" className={inputStyles} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Perfil de Usuario</label>
                                    <select name="profile" value={userFormData.profile} onChange={handleUserFieldChange} className={inputStyles} required>
                                        {ALL_PROFILES.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                {userFormData.profile === Profile.ESTUDIANTE && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Curso</label>
                                        <select name="curso" value={userFormData.curso} onChange={handleUserFieldChange} className={inputStyles} required>
                                            <option value="">Seleccione un curso</option>
                                            {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                             {userError && <p className="text-red-600 bg-red-100 p-3 rounded-md mt-4">{userError}</p>}
                            <div className="pt-4 flex justify-end items-center gap-4">
                                {editingUserId && <button type="button" onClick={handleUserResetForm} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">Cancelar</button>}
                                <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">
                                    {editingUserId ? 'Actualizar Usuario' : 'Agregar Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                     <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Listado de Usuarios</h2>
                        {/* ... (La tabla y filtros se mantienen igual, pero el botón de borrar ahora usa el email) ... */}
                        <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                    {/* ... (thead se mantiene igual) ... */}
                                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                        {filteredUsers.map(user => (
                                            <tr key={user.email} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                                                {/* ... (td se mantiene igual) ... */}
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-center space-x-2">
                                                    <button onClick={() => handleUserEdit(user)} title="Editar" className="text-yellow-600 hover:text-yellow-800 p-1 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/40">✏️</button>
                                                    <button onClick={() => handleUserDelete(user.email)} title="Eliminar" className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40">🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                     </div>
                </div>
            )}
             {activeTab === 'Monitor de Uso' && (
                <MonitorDeUso />
            )}
        </div>
    );
};

export default Administracion;