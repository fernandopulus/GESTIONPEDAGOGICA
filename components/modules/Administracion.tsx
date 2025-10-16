import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { User, Profile } from '../../types';
import { CURSOS, ASIGNATURAS } from '../../constants';
import { read, utils } from 'xlsx';
import MonitorDeUso from './MonitorDeUso';
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAllUsers } from '../../src/firebaseHelpers/users';

const ALL_PROFILES = Object.values(Profile);

const normalizeCurso = (curso: string): string => {
    if (!curso) return '';
    let normalized = curso.trim().toLowerCase()
        .replace(/°/g, 'º')
        .replace(/\s+(medio|básico|basico)/g, '')
        .replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º')
        .replace(/^(\d)(?![º])/, '$1º')
        .replace(/\s+/g, '')
        .toUpperCase();
    return normalized;
};

const Administracion: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'Usuarios' | 'Monitor de Uso'>('Usuarios');
    // Estado para cambio masivo de contraseña
    const [bulkPassword, setBulkPassword] = useState<string>("");
    const [bulkProfile, setBulkProfile] = useState<string>("");
    const [bulkCurso, setBulkCurso] = useState<string>("");
    const [bulkStatus, setBulkStatus] = useState<null | { message: string; isError?: boolean }>(null);
    const [bulkLoading, setBulkLoading] = useState<boolean>(false);
    const [bulkResult, setBulkResult] = useState<null | { matched?: number; processed?: number; updated?: number; failed?: number; errors?: Array<{ email: string; error: string }> }>(null);
    const [userFormData, setUserFormData] = useState<Omit<User, 'id'>>({
        nombreCompleto: '',
        email: '',
        rut: '',
        profile: Profile.PROFESORADO,
        password: '',
        curso: '',
        cursos: [],
        asignaturas: []
    });
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

    const handleUserFieldChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setUserFormData(prev => ({
            ...prev,
            [name]: value,
            curso: name === 'profile' && value !== Profile.ESTUDIANTE ? '' : prev.curso,
            cursos: name === 'profile' && value !== Profile.PROFESORADO ? [] : prev.cursos,
            asignaturas: name === 'profile' && value !== Profile.PROFESORADO ? [] : prev.asignaturas
        }));
    }, []);

    const handleAssignmentChange = useCallback((type: 'cursos' | 'asignaturas', value: string) => {
        setUserFormData(prev => {
            const currentValues = prev[type] || [];
            const newValues = currentValues.includes(value) 
                ? currentValues.filter(item => item !== value) 
                : [...currentValues, value];
            return { ...prev, [type]: newValues };
        });
    }, []);

    const handleUserResetForm = useCallback(() => {
        setUserFormData({
            nombreCompleto: '',
            email: '',
            rut: '',
            profile: Profile.PROFESORADO,
            password: '',
            curso: '',
            cursos: [],
            asignaturas: []
        });
        setEditingUserId(null);
        setUserError(null);
    }, []);

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
                const updateUserFunc = httpsCallable(functions, 'updateUser');
                const userDataToUpdate = {
                    ...userFormData,
                    password: password?.trim() || undefined,
                    curso: profile === Profile.ESTUDIANTE ? normalizeCurso(curso || '') : undefined
                };
                await updateUserFunc(userDataToUpdate);
            } else {
                const createUserFunc = httpsCallable(functions, 'createUser');
                const userDataToCreate = {
                    ...userFormData,
                    curso: profile === Profile.ESTUDIANTE ? normalizeCurso(curso || '') : undefined
                };
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
        setEditingUserId(user.email);
        setUserFormData({
            nombreCompleto: user.nombreCompleto,
            email: user.email,
            rut: user.rut || '',
            profile: user.profile,
            password: '',
            curso: user.curso || '',
            cursos: user.cursos || [],
            asignaturas: user.asignaturas || []
        });
        
        // Scroll mejorado: esperar a que el formulario se actualice
        setTimeout(() => {
            const formulario = document.querySelector('form');
            if (formulario) {
                formulario.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
            }
        }, 100);
    }, []);

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

                if (json.length === 0) {
                    setStudentUploadStatus({ message: 'El archivo está vacío o no tiene el formato correcto.', isError: true });
                    return;
                }

                const creationPromises = json.map(row => {
                    const nombre = row['Nombre'] || row['nombre'];
                    const correo = row['Correo'] || row['correo'] || row['Email'] || row['email'];
                    const curso = row['Curso'] || row['curso'];
                    const rut = row['RUT'] || row['rut'];
                    
                    if (!nombre || !correo || !curso) {
                        return Promise.resolve({ email: correo || 'Sin email', error: 'Datos incompletos' });
                    }

                    return createUserFunc({
                        nombreCompleto: String(nombre).trim(),
                        email: String(correo).trim(),
                        profile: Profile.ESTUDIANTE,
                        curso: normalizeCurso(String(curso).trim()),
                        rut: rut ? String(rut).trim() : '',
                        password: "recoleta"
                    }).catch(err => ({ email: correo, error: err.message }));
                });

                const results = await Promise.all(creationPromises);
                const successfulUploads = results.filter(r => !r.error).length;
                const failedUploads = results.filter(r => r.error);

                let message = `Carga completada. ${successfulUploads} estudiantes agregados.`;
                if (failedUploads.length > 0) {
                    message += ` ${failedUploads.length} fallaron.`;
                    console.error("Errores en carga masiva:", failedUploads);
                }
                setStudentUploadStatus({ message, isError: failedUploads.length > 0 });
                await fetchUsers();
            } catch (err: any) {
                setStudentUploadStatus({ message: `Error: ${err.message}`, isError: true });
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    const handleStaffBulkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        setStaffUploadStatus({ message: 'Procesando archivo...', isError: false });
        const functions = getFunctions();
        const createUserFunc = httpsCallable(functions, 'createUser');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const json: any[] = utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    setStaffUploadStatus({ message: 'El archivo está vacío o no tiene el formato correcto.', isError: true });
                    return;
                }

                const creationPromises = json.map(row => {
                    const nombre = row['Nombre'] || row['nombre'];
                    const correo = row['Correo'] || row['correo'] || row['Email'] || row['email'];
                    const perfil = row['Perfil'] || row['perfil'] || row['Profile'] || row['profile'];
                    const rut = row['RUT'] || row['rut'];
                    
                    if (!nombre || !correo || !perfil) {
                        return Promise.resolve({ email: correo || 'Sin email', error: 'Datos incompletos' });
                    }

                    return createUserFunc({
                        nombreCompleto: String(nombre).trim(),
                        email: String(correo).trim(),
                        profile: perfil,
                        rut: rut ? String(rut).trim() : '',
                        password: "recoleta"
                    }).catch(err => ({ email: correo, error: err.message }));
                });

                const results = await Promise.all(creationPromises);
                const successfulUploads = results.filter(r => !r.error).length;
                const failedUploads = results.filter(r => r.error);

                let message = `Carga completada. ${successfulUploads} usuarios agregados.`;
                if (failedUploads.length > 0) {
                    message += ` ${failedUploads.length} fallaron.`;
                    console.error("Errores en carga masiva:", failedUploads);
                }
                setStaffUploadStatus({ message, isError: failedUploads.length > 0 });
                await fetchUsers();
            } catch (err: any) {
                setStaffUploadStatus({ message: `Error: ${err.message}`, isError: true });
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";
    const availableCourses = useMemo(() => 
        Array.from(new Set(users.filter(u => u.profile === Profile.ESTUDIANTE && u.curso).map(u => u.curso!))).sort(), 
        [users]
    );
    
    const filteredUsers = useMemo(() => 
        users.filter(user => 
            (userSearchTerm === '' || 
             user.nombreCompleto.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
             user.email.toLowerCase().includes(userSearchTerm.toLowerCase())) &&
            (userFilterProfile === '' || user.profile === userFilterProfile) &&
            (userFilterCurso === '' || user.curso === userFilterCurso)
        ), 
        [users, userSearchTerm, userFilterProfile, userFilterCurso]
    );

    return (
        <div className="space-y-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Administración</h1>
            
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button 
                        onClick={() => setActiveTab('Usuarios')} 
                        className={`${activeTab === 'Usuarios' 
                            ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`}
                    >
                        Gestión de Usuarios
                    </button>
                    <button 
                        onClick={() => setActiveTab('Monitor de Uso')} 
                        className={`${activeTab === 'Monitor de Uso' 
                            ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`}
                    >
                        Monitor de Uso
                    </button>
                </nav>
            </div>

            {activeTab === 'Usuarios' && (
                <div className="space-y-8">
                    {/* Cambio masivo de contraseñas */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Cambio masivo de contraseñas</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nueva contraseña</label>
                                <input
                                    type="password"
                                    value={bulkPassword}
                                    onChange={(e) => setBulkPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    className={inputStyles}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Perfil</label>
                                <select
                                    value={bulkProfile}
                                    onChange={(e) => { setBulkProfile(e.target.value); if (e.target.value !== Profile.ESTUDIANTE) setBulkCurso(""); }}
                                    className={inputStyles}
                                >
                                    <option value="">Selecciona un perfil</option>
                                    {ALL_PROFILES.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Curso (solo estudiantes)</label>
                                <select
                                    value={bulkCurso}
                                    onChange={(e) => setBulkCurso(e.target.value)}
                                    className={inputStyles}
                                    disabled={bulkProfile !== Profile.ESTUDIANTE}
                                >
                                    <option value="">Todos los cursos</option>
                                    {availableCourses.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={async () => {
                                    setBulkStatus(null);
                                    setBulkResult(null);
                                    if (!bulkPassword || bulkPassword.length < 6) {
                                        setBulkStatus({ message: 'La contraseña debe tener al menos 6 caracteres.', isError: true });
                                        return;
                                    }
                                    if (!bulkProfile) {
                                        setBulkStatus({ message: 'Debes seleccionar un perfil.', isError: true });
                                        return;
                                    }
                                    const confirmMsg = bulkProfile === Profile.ESTUDIANTE && !bulkCurso
                                      ? 'Se cambiarán contraseñas de TODOS los estudiantes. ¿Deseas continuar?'
                                      : `Se cambiarán contraseñas para ${bulkProfile}${bulkProfile === Profile.ESTUDIANTE && bulkCurso ? ' del curso ' + bulkCurso : ''}. ¿Confirmas?`;
                                    if (!window.confirm(confirmMsg)) return;

                                    try {
                                        setBulkLoading(true);
                                        const functions = getFunctions();
                                        const bulkFn = httpsCallable(functions, 'bulkUpdatePasswords');
                                        const payload: any = { newPassword: bulkPassword, profile: bulkProfile };
                                        if (bulkProfile === Profile.ESTUDIANTE && bulkCurso) payload.curso = bulkCurso;
                                        const res: any = await bulkFn(payload);
                                        const data = (res?.data || res) as { matched?: number; processed?: number; updated?: number; failed?: number; errors?: Array<{ email: string; error: string }> };
                                        const msg = `Coincidieron: ${data.matched ?? 0} | Procesados: ${data.processed ?? 0} | Actualizados: ${data.updated ?? 0} | Fallidos: ${data.failed ?? 0}`;
                                        setBulkStatus({ message: msg, isError: (data.failed ?? 0) > 0 });
                                        setBulkResult(data);
                                        await fetchUsers();
                                    } catch (err: any) {
                                        console.error('Error en cambio masivo:', err);
                                        setBulkStatus({ message: err?.message || 'Error al ejecutar cambio masivo', isError: true });
                                    } finally {
                                        setBulkLoading(false);
                                    }
                                }}
                                disabled={bulkLoading || !bulkProfile || !bulkPassword || bulkPassword.length < 6}
                                className={`bg-amber-600 text-white font-bold py-2 px-6 rounded-lg ${bulkLoading || !bulkProfile || !bulkPassword || bulkPassword.length < 6 ? 'opacity-60 cursor-not-allowed' : 'hover:bg-amber-700'}`}
                            >
                                {bulkLoading ? 'Procesando…' : 'Cambiar contraseñas'}
                            </button>
                        </div>
                        {bulkStatus && (
                            <div className="mt-3">
                                <p className={`text-sm ${bulkStatus.isError ? 'text-red-600' : 'text-green-600'}`}>{bulkStatus.message}</p>
                                {bulkResult?.failed && bulkResult.failed > 0 && (
                                    <details className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                                        <summary className="cursor-pointer text-red-700 dark:text-red-300 text-sm font-medium">
                                            Ver errores ({bulkResult.failed})
                                        </summary>
                                        <div className="mt-2 max-h-56 overflow-auto">
                                            <table className="min-w-full text-xs">
                                                <thead>
                                                    <tr className="text-left text-slate-600 dark:text-slate-300">
                                                        <th className="pr-4 py-1">Email</th>
                                                        <th className="py-1">Error</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(bulkResult.errors || []).map((e, idx) => (
                                                        <tr key={idx} className="border-t border-slate-200 dark:border-slate-700">
                                                            <td className="pr-4 py-1 text-slate-800 dark:text-slate-200 whitespace-nowrap">{e.email}</td>
                                                            <td className="py-1 text-slate-700 dark:text-slate-300">{e.error}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Carga masiva */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Carga Masiva</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                                    Cargar Estudiantes (Excel)
                                </label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleStudentBulkUpload}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 dark:file:bg-amber-900 dark:file:text-amber-300"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Columnas requeridas: Nombre, Correo, Curso
                                </p>
                                {studentUploadStatus && (
                                    <p className={`text-sm mt-2 ${studentUploadStatus.isError ? 'text-red-600' : 'text-green-600'}`}>
                                        {studentUploadStatus.message}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                                    Cargar Personal (Excel)
                                </label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleStaffBulkUpload}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 dark:file:bg-amber-900 dark:file:text-amber-300"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Columnas requeridas: Nombre, Correo, Perfil
                                </p>
                                {staffUploadStatus && (
                                    <p className={`text-sm mt-2 ${staffUploadStatus.isError ? 'text-red-600' : 'text-green-600'}`}>
                                        {staffUploadStatus.message}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Formulario de usuario */}
                    <div id="formulario-usuario" className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
                            {editingUserId ? 'Editando usuario' : 'Agregar nuevo usuario'}
                        </h2>
                        <form onSubmit={handleUserSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                        Nombre Completo
                                    </label>
                                    <input
                                        type="text"
                                        name="nombreCompleto"
                                        value={userFormData.nombreCompleto}
                                        onChange={handleUserFieldChange}
                                        className={inputStyles}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={userFormData.email}
                                        onChange={handleUserFieldChange}
                                        className={inputStyles}
                                        required
                                        readOnly={!!editingUserId}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                        Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={userFormData.password || ''}
                                        onChange={handleUserFieldChange}
                                        placeholder={editingUserId ? "Dejar en blanco para no cambiar" : "Contraseña temporal"}
                                        className={inputStyles}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                        RUT (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        name="rut"
                                        value={userFormData.rut || ''}
                                        onChange={handleUserFieldChange}
                                        placeholder="12.345.678-9"
                                        className={inputStyles}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                        Perfil de Usuario
                                    </label>
                                    <select
                                        name="profile"
                                        value={userFormData.profile}
                                        onChange={handleUserFieldChange}
                                        className={inputStyles}
                                        required
                                    >
                                        {ALL_PROFILES.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                                {userFormData.profile === Profile.ESTUDIANTE && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                            Curso
                                        </label>
                                        <select
                                            name="curso"
                                            value={userFormData.curso}
                                            onChange={handleUserFieldChange}
                                            className={inputStyles}
                                            required
                                        >
                                            <option value="">Seleccione un curso</option>
                                            {CURSOS.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Sección de asignación de cursos para profesores */}
                            {userFormData.profile === Profile.PROFESORADO && (
                                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-400">
                                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                                        <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm mr-2">📚</span>
                                        Asignación de Cursos
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {CURSOS.map(curso => (
                                            <label key={curso} className="flex items-center space-x-2 cursor-pointer bg-white dark:bg-slate-700 p-2 rounded border hover:bg-blue-50 dark:hover:bg-blue-800/20">
                                                <input
                                                    type="checkbox"
                                                    checked={userFormData.cursos?.includes(curso) || false}
                                                    onChange={() => handleAssignmentChange('cursos', curso)}
                                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{curso}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sección de asignación de asignaturas para profesores */}
                            {userFormData.profile === Profile.PROFESORADO && (
                                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-400">
                                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                                        <span className="bg-green-500 text-white px-2 py-1 rounded text-sm mr-2">📖</span>
                                        Asignación de Asignaturas
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {ASIGNATURAS.map(asignatura => (
                                            <label key={asignatura} className="flex items-center space-x-2 cursor-pointer bg-white dark:bg-slate-700 p-2 rounded border hover:bg-green-50 dark:hover:bg-green-800/20">
                                                <input
                                                    type="checkbox"
                                                    checked={userFormData.asignaturas?.includes(asignatura) || false}
                                                    onChange={() => handleAssignmentChange('asignaturas', asignatura)}
                                                    className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                                                />
                                                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{asignatura}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {userError && (
                                <p className="text-red-600 bg-red-100 p-3 rounded-md mt-4">{userError}</p>
                            )}

                            {/* BOTONES TEMPORALES Y PRINCIPALES */}
                            <div className="pt-4 flex justify-end items-center gap-4 flex-wrap">
                                {editingUserId && (
                                    <button
                                        type="button"
                                        onClick={handleUserResetForm}
                                        className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
                                    >
                                        Cancelar
                                    </button>
                                )}
                                
                                {/* BOTÓN ROJO - Agregar Custom Claim */}
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            console.log('🔧 Agregando custom claim...');
                                            const functions = getFunctions();
                                            const addCustomClaim = httpsCallable(functions, 'addCustomClaim');
                                            
                                            const result = await addCustomClaim({
                                                email: 'fernando.sagredo@industrialderecoleta.cl',
                                                profile: 'SUBDIRECCION'
                                            });
                                            
                                            console.log('✅ Custom claim agregado:', result);
                                            setUserError('✅ Custom claim agregado exitosamente');
                                        } catch (error: any) {
                                            console.error('❌ Error al agregar custom claim:', error);
                                            setUserError(`Error: ${error.message}`);
                                        }
                                    }}
                                    className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 text-sm"
                                >
                                    🔧 Claim
                                </button>
                                
                                {/* BOTÓN AZUL - Verificar Token */}
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            // Importar auth desde tu archivo firebase
                                            const { auth } = await import('../../src/firebase');
                                            
                                            console.log('🔍 Usuario actual:', auth.currentUser?.email);
                                            
                                            // Forzar refresh del token
                                            const token = await auth.currentUser?.getIdToken(true);
                                            console.log('🔑 Token refreshed:', !!token);
                                            
                                            // Verificar claims
                                            const result = await auth.currentUser?.getIdTokenResult();
                                            console.log('📋 Claims completos:', result?.claims);
                                            console.log('👤 Profile claim:', result?.claims?.profile);
                                            
                                            if (result?.claims?.profile === 'SUBDIRECCION') {
                                                setUserError('✅ Custom claim FUNCIONANDO - Ya puedes crear/editar usuarios');
                                            } else {
                                                setUserError(`❌ Custom claim faltante. Claims: ${JSON.stringify(result?.claims)}`);
                                            }
                                        } catch (error: any) {
                                            console.error('❌ Error verificando token:', error);
                                            setUserError(`Error verificando token: ${error.message}`);
                                        }
                                    }}
                                    className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 text-sm"
                                >
                                    🔍 Token
                                </button>
                                
                                <button
                                    type="submit"
                                    className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600"
                                >
                                    {editingUserId ? 'Actualizar Usuario' : 'Agregar Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Listado de usuarios */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Listado de Usuarios</h2>
                        
                        {/* Filtros */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o email..."
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                    className={inputStyles}
                                />
                            </div>
                            <div>
                                <select
                                    value={userFilterProfile}
                                    onChange={(e) => setUserFilterProfile(e.target.value)}
                                    className={inputStyles}
                                >
                                    <option value="">Todos los perfiles</option>
                                    {ALL_PROFILES.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <select
                                    value={userFilterCurso}
                                    onChange={(e) => setUserFilterCurso(e.target.value)}
                                    className={inputStyles}
                                >
                                    <option value="">Todos los cursos</option>
                                    {availableCourses.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-8">
                                <p className="text-slate-500">Cargando usuarios...</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                    <thead className="bg-slate-50 dark:bg-slate-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                                                Nombre
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                                                Perfil
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                                                Curso/Asignaciones
                                            </th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                        {filteredUsers.map(user => (
                                            <tr key={user.email} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    {user.nombreCompleto}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                                                    {user.email}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                        user.profile === Profile.ESTUDIANTE 
                                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                                            : user.profile === Profile.PROFESORADO
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                                                    }`}>
                                                        {user.profile}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-300">
                                                    {user.profile === Profile.ESTUDIANTE && (
                                                        <span className="inline-flex px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded dark:bg-slate-600 dark:text-slate-300">
                                                            {user.curso || 'Sin curso'}
                                                        </span>
                                                    )}
                                                    {user.profile === Profile.PROFESORADO && (
                                                        <div className="space-y-1">
                                                            {user.cursos && user.cursos.length > 0 && (
                                                                <div>
                                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Cursos:</span>
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {user.cursos.slice(0, 3).map(curso => (
                                                                            <span key={curso} className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded dark:bg-blue-900 dark:text-blue-300">
                                                                                {curso}
                                                                            </span>
                                                                        ))}
                                                                        {user.cursos.length > 3 && (
                                                                            <span className="inline-flex px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded dark:bg-slate-600 dark:text-slate-400">
                                                                                +{user.cursos.length - 3}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {user.asignaturas && user.asignaturas.length > 0 && (
                                                                <div>
                                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Asignaturas:</span>
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {user.asignaturas.slice(0, 2).map(asignatura => (
                                                                            <span key={asignatura} className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-700 rounded dark:bg-green-900 dark:text-green-300">
                                                                                {asignatura}
                                                                            </span>
                                                                        ))}
                                                                        {user.asignaturas.length > 2 && (
                                                                            <span className="inline-flex px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded dark:bg-slate-600 dark:text-slate-400">
                                                                                +{user.asignaturas.length - 2}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {(!user.cursos || user.cursos.length === 0) && (!user.asignaturas || user.asignaturas.length === 0) && (
                                                                <span className="text-xs text-slate-400 italic">Sin asignaciones</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {user.profile !== Profile.ESTUDIANTE && user.profile !== Profile.PROFESORADO && (
                                                        <span className="text-xs text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-center space-x-2">
                                                    <button
                                                        onClick={() => handleUserEdit(user)}
                                                        title="Editar"
                                                        className="text-yellow-600 hover:text-yellow-800 p-1 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleUserDelete(user.email)}
                                                        title="Eliminar"
                                                        className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                
                                {filteredUsers.length === 0 && (
                                    <div className="text-center py-8">
                                        <p className="text-slate-500 dark:text-slate-400">
                                            {users.length === 0 ? 'No hay usuarios registrados.' : 'No se encontraron usuarios con los filtros aplicados.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
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