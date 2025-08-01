import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { User, Profile } from '../../types';
import { CURSOS, ASIGNATURAS } from '../../constants';
import { read, utils } from 'xlsx';
import MonitorDeUso from './MonitorDeUso';
import {
    getAllUsers,
    getUserByEmail,
    createUser,
    updateUser,
    deleteUser,
} from '../../src/firebaseHelpers/users'; // AJUSTA la ruta según dónde guardaste los helpers

const ALL_PROFILES = Object.values(Profile);

const KeyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.629 5.629l-2.371 2.37-1.414-1.414 2.371-2.371A6 6 0 0115 7zm-3.707 5.293L6 17.586V20h2.414l5.293-5.293a1 1 0 00-1.414-1.414z" /></svg>;

/**
 * Normaliza el nombre de un curso a un formato estándar (ej: "1ºA").
 * Elimina espacios, estandariza ordinales y capitaliza la letra final.
 */
const normalizeCurso = (curso: string): string => {
    if (!curso) return '';
    let normalized = curso.trim().toLowerCase();
    
    // Estandarizar el símbolo de grado (°) al ordinal masculino (º)
    normalized = normalized.replace(/°/g, 'º');

    // Reemplazar " medio", etc.
    normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
    // Reemplazar 1ro, 2do, 3ro, 4to con 1º, 2º, 3º, 4º
    normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
    // Asegura que haya un símbolo de grado si no lo hay
    normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
    // Elimina todos los espacios y pone en mayúscula la parte de la letra
    normalized = normalized.replace(/\s+/g, '').toUpperCase();
    return normalized;
};

const Administracion: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'Usuarios' | 'Monitor de Uso'>('Usuarios');
    
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

    // Cargar usuarios desde Firestore
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const usersFS = await getAllUsers();
            setUsers(usersFS);
        } catch (e) {
            console.error("Error al cargar usuarios desde Firestore", e);
            setUserError("No se pudieron cargar los usuarios desde la nube.");
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
            // Reset curso if profile is not Estudiantes
            curso: name === 'profile' && value !== Profile.ESTUDIANTE ? '' : prev.curso
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
        const { nombreCompleto, email, profile, curso, cursos, asignaturas } = userFormData;
        
        if (!nombreCompleto.trim() || !email.trim()) {
            setUserError('Nombre Completo y Email son obligatorios.');
            return;
        }
        if (profile === Profile.ESTUDIANTE && !curso) {
            setUserError('El campo "Curso" es obligatorio para el perfil de Estudiante.');
            return;
        }

        const finalCurso = profile === Profile.ESTUDIANTE ? normalizeCurso(curso || '') : undefined;
        const finalCursos = profile === Profile.PROFESORADO ? cursos : undefined;
        const finalAsignaturas = profile === Profile.PROFESORADO ? asignaturas : undefined;
        const finalPassword = userFormData.password?.trim() ? userFormData.password.trim() : undefined;
        const finalRut = userFormData.rut?.trim() ? userFormData.rut.trim() : undefined;

        try {
            if (editingUserId) {
                // Actualizar usuario existente
                await updateUser(userFormData.email, {
                    ...userFormData,
                    password: finalPassword, // Si es undefined, mantendrá la contraseña anterior
                    rut: finalRut,
                    curso: finalCurso,
                    cursos: finalCursos,
                    asignaturas: finalAsignaturas,
                });
            } else {
                // Crear nuevo usuario
                await createUser({
                    ...userFormData,
                    password: finalPassword,
                    rut: finalRut,
                    curso: finalCurso,
                    cursos: finalCursos,
                    asignaturas: finalAsignaturas,
                });
            }
            
            // Recargar usuarios después de la operación
            await fetchUsers();
            handleUserResetForm();
        } catch (err) {
            console.error("Error al guardar usuario:", err);
            setUserError("Error al guardar el usuario en la nube.");
        }
    }, [userFormData, editingUserId, fetchUsers, handleUserResetForm]);

    const handleUserEdit = useCallback((user: User) => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setEditingUserId(user.id);
        setUserFormData({ 
            nombreCompleto: user.nombreCompleto, 
            email: user.email, 
            rut: user.rut || '',
            profile: user.profile,
            password: '', // Always leave blank for security
            curso: user.curso || '',
            cursos: user.cursos || [],
            asignaturas: user.asignaturas || []
        });
    }, []);

    const handleUserDelete = useCallback(async (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar este usuario?')) {
            try {
                await deleteUser(id);
                await fetchUsers(); // Recargar usuarios después de eliminar
            } catch (err) {
                console.error("Error al eliminar usuario:", err);
                setUserError("No se pudo borrar el usuario en la nube.");
            }
        }
    }, [fetchUsers]);
    
    const handleMassPasswordReset = async () => {
        const confirmation = window.confirm(
            "ADVERTENCIA: Esta acción es irreversible.\n\n" +
            "¿Está seguro de que desea restablecer las contraseñas de TODOS los usuarios a la contraseña por defecto ('recoleta')?\n\n" +
            "Cualquier contraseña personalizada será eliminada."
        );
        if (confirmation) {
            try {
                // Actualizar todos los usuarios para remover la contraseña personalizada
                await Promise.all(users.map(user => updateUser(user.email, { password: undefined })));
                await fetchUsers(); // Recargar usuarios
                alert("Todas las contraseñas han sido restablecidas exitosamente a 'recoleta'.");
            } catch (err) {
                console.error("Error al restablecer contraseñas:", err);
                setUserError("Error al restablecer contraseñas en la nube.");
            }
        }
    };

    // Genera la lista de cursos únicos para el filtro a partir de los usuarios existentes.
    const availableCourses = useMemo(() => Array.from(new Set(
        users
            .filter(u => u.profile === Profile.ESTUDIANTE && u.curso)
            .map(u => u.curso!)
    )).sort(), [users]);
    
    const filteredUsers = useMemo(() => {
        return users.filter(user => 
            (userSearchTerm === '' || user.nombreCompleto.toLowerCase().includes(userSearchTerm.toLowerCase()) || user.email.toLowerCase().includes(userSearchTerm.toLowerCase())) &&
            (userFilterProfile === '' || user.profile === userFilterProfile) &&
            (userFilterCurso === '' || user.curso === userFilterCurso)
        );
    }, [users, userSearchTerm, userFilterProfile, userFilterCurso]);

    const handleStudentBulkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setStudentUploadStatus({ message: 'Procesando archivo de estudiantes...', isError: false });

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = utils.sheet_to_json(worksheet);

                if (json.length === 0) throw new Error("El archivo Excel está vacío.");

                const headers = Object.keys(json[0]).map(h => h.trim().toLowerCase());
                if (!headers.includes('nombre') || !headers.includes('correo') || !headers.includes('curso')) {
                    throw new Error("El archivo debe tener las columnas: 'Nombre', 'Correo', y 'Curso'.");
                }
                
                const headerMap: Record<string, string> = {};
                Object.keys(json[0]).forEach(h => { headerMap[h.trim().toLowerCase()] = h; });

                const newStudents: User[] = json.map(row => {
                    const nombre = row[headerMap['nombre']];
                    const correo = row[headerMap['correo']];
                    const curso = row[headerMap['curso']];
                    if (!nombre || !correo || !curso) return null;
                    
                    const newUser: User = {
                        id: crypto.randomUUID(),
                        nombreCompleto: String(nombre).trim(),
                        email: String(correo).trim(),
                        profile: Profile.ESTUDIANTE,
                        // Normaliza el curso al momento de la carga.
                        curso: normalizeCurso(String(curso).trim()),
                    };
                    return newUser;
                }).filter((u): u is User => u !== null && !users.some(existing => existing.email.toLowerCase() === u.email.toLowerCase()));

                if (newStudents.length > 0) {
                    // Crear usuarios en Firestore uno por uno
                    await Promise.all(newStudents.map(user => createUser(user)));
                    // Recargar usuarios después de la carga masiva
                    await fetchUsers();
                }
                setStudentUploadStatus({ message: `Carga completada. Se agregaron ${newStudents.length} nuevos estudiantes.`, isError: false });

            } catch (err: any) {
                setStudentUploadStatus({ message: `Error: ${err.message}`, isError: true });
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleStaffBulkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setStaffUploadStatus({ message: 'Procesando archivo de personal...', isError: false });

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = utils.sheet_to_json(worksheet);

                if (json.length === 0) throw new Error("El archivo Excel está vacío.");
                
                const headers = Object.keys(json[0]).map(h => h.trim().toLowerCase());
                if (!headers.includes('nombre') || !headers.includes('correo') || !headers.includes('perfil')) {
                    throw new Error("El archivo debe tener las columnas: 'Nombre', 'Correo' y 'Perfil'.");
                }
                
                const headerMap: Record<string, string> = {};
                Object.keys(json[0]).forEach(h => { headerMap[h.trim().toLowerCase()] = h; });
                const hasCursoColumn = headers.includes('curso');
                let ambiguousRows = 0;

                const newStaff: User[] = json.map(row => {
                    const nombre = row[headerMap['nombre']];
                    const correo = row[headerMap['correo']];
                    const perfil = row[headerMap['perfil']];
                    if (!nombre || !correo || !perfil) return null;

                    const perfilValue = String(perfil).trim() as Profile;
                    if (perfilValue === Profile.ESTUDIANTE || !Object.values(Profile).includes(perfilValue)) {
                        console.warn(`Perfil inválido o de estudiante omitido: ${perfilValue}`);
                        return null;
                    }

                    if (hasCursoColumn && row[headerMap['curso']]) {
                        console.warn(`Fila omitida: El perfil '${perfilValue}' es para personal, pero se encontró una columna 'Curso' con datos. Use la carga de Estudiantes para este tipo de archivo.`);
                        ambiguousRows++;
                        return null;
                    }

                    const newStaffUser: User = {
                        id: crypto.randomUUID(),
                        nombreCompleto: String(nombre).trim(),
                        email: String(correo).trim(),
                        profile: perfilValue,
                    };
                    return newStaffUser;
                }).filter((u): u is User => u !== null && !users.some(existing => existing.email.toLowerCase() === u.email.toLowerCase()));
                
                if (newStaff.length > 0) {
                    // Crear usuarios en Firestore uno por uno
                    await Promise.all(newStaff.map(user => createUser(user)));
                    // Recargar usuarios después de la carga masiva
                    await fetchUsers();
                }
                
                let message = `Carga completada. Se agregaron ${newStaff.length} nuevos miembros del personal.`;
                if (ambiguousRows > 0) {
                    message += ` Se omitieron ${ambiguousRows} filas porque parecían ser de estudiantes (contenían una columna 'Curso'). Por favor, use la opción 'Cargar Estudiantes' para ellas.`
                }
                setStaffUploadStatus({ message, isError: false });

            } catch (err: any) {
                setStaffUploadStatus({ message: `Error: ${err.message}`, isError: true });
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";

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
                    {loading && <div className="text-center text-amber-600">Cargando usuarios desde la nube...</div>}
                    {userError && <div className="text-red-600 bg-red-100 p-3 rounded-md">{userError}</div>}
                    
                    {/* Si no hay usuarios */}
                    {!loading && users.length === 0 && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-lg">
                            No hay usuarios registrados en la nube.
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">{editingUserId ? 'Editando usuario' : 'Agregar nuevo usuario'}</h2>
                        <form onSubmit={handleUserSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre Completo</label>
                                    <input type="text" name="nombreCompleto" value={userFormData.nombreCompleto} onChange={handleUserFieldChange} className={inputStyles} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Email</label>
                                    <input type="email" name="email" value={userFormData.email} onChange={handleUserFieldChange} className={inputStyles} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Contraseña</label>
                                    <input type="password" name="password" value={userFormData.password || ''} onChange={handleUserFieldChange} placeholder="Dejar en blanco para no cambiar" className={inputStyles} />
                                </div>
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

                            {userFormData.profile === Profile.PROFESORADO && (
                                <div className="lg:col-span-3 mt-6 pt-6 border-t dark:border-slate-700">
                                    <h3 className="text-lg font-semibold mb-3 text-slate-800 dark:text-slate-200">Asignaciones de Profesor</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <fieldset className="p-4 border rounded-lg dark:border-slate-600">
                                            <legend className="font-semibold px-2 text-slate-700 dark:text-slate-300">Cursos Asignados</legend>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 max-h-48 overflow-y-auto mt-2">
                                                {CURSOS.map(curso => (
                                                    <label key={curso} className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={(userFormData.cursos || []).includes(curso)}
                                                            onChange={() => handleAssignmentChange('cursos', curso)}
                                                            className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
                                                        />
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">{curso}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </fieldset>
                                        <fieldset className="p-4 border rounded-lg dark:border-slate-600">
                                            <legend className="font-semibold px-2 text-slate-700 dark:text-slate-300">Asignaturas Asignadas</legend>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-48 overflow-y-auto mt-2">
                                                {ASIGNATURAS.map(asignatura => (
                                                    <label key={asignatura} className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={(userFormData.asignaturas || []).includes(asignatura)}
                                                            onChange={() => handleAssignmentChange('asignaturas', asignatura)}
                                                            className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
                                                        />
                                                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate" title={asignatura}>{asignatura}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </fieldset>
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center col-span-full pt-2">Nota: La contraseña por defecto para todos los usuarios es "<strong>recoleta</strong>".</p>
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
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Cargas Masivas desde Excel</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Student Upload */}
                            <div className="p-4 border dark:border-slate-700 rounded-lg">
                                <h3 className="font-semibold mb-2 text-slate-700 dark:text-slate-300">Cargar Estudiantes</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    El archivo debe tener las columnas: <strong>Nombre</strong>, <strong>Correo</strong>, <strong>Curso</strong>.
                                </p>
                                <input
                                    type="file"
                                    onChange={handleStudentBulkUpload}
                                    accept=".xlsx, .xls"
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                                />
                                {studentUploadStatus && (
                                    <p className={`text-sm p-2 rounded-md mt-4 ${studentUploadStatus.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {studentUploadStatus.message}
                                    </p>
                                )}
                            </div>
                            {/* Staff Upload */}
                            <div className="p-4 border dark:border-slate-700 rounded-lg">
                                <h3 className="font-semibold mb-2 text-slate-700 dark:text-slate-300">Cargar Personal (Profesores, etc.)</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    El archivo debe tener las columnas: <strong>Nombre</strong>, <strong>Correo</strong>, <strong>Perfil</strong>.
                                </p>
                                <input
                                    type="file"
                                    onChange={handleStaffBulkUpload}
                                    accept=".xlsx, .xls"
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                                />
                                {staffUploadStatus && (
                                    <p className={`text-sm p-2 rounded-md mt-4 ${staffUploadStatus.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {staffUploadStatus.message}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabla de usuarios - solo mostrar si no está cargando y hay usuarios */}
                    {!loading && users.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Listado de Usuarios</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <input type="text" placeholder="Buscar por nombre o email..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} className={inputStyles} />
                                <select value={userFilterProfile} onChange={e => setUserFilterProfile(e.target.value)} className={inputStyles}>
                                    <option value="">Filtrar por Perfil</option>
                                    {ALL_PROFILES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select value={userFilterCurso} onChange={e => setUserFilterCurso(e.target.value)} className={inputStyles}>
                                    <option value="">Filtrar por Curso</option>
                                    {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                    <thead className="bg-slate-50 dark:bg-slate-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre Completo</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Perfil / Curso</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                        {filteredUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">{user.nombreCompleto}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{user.email}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                                                        {user.profile} {user.curso && `(${user.curso})`}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-center space-x-2">
                                                    <button onClick={() => handleUserEdit(user)} title="Editar" className="text-yellow-600 hover:text-yellow-800 p-1 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/40">✏️</button>
                                                    <button onClick={() => handleUserDelete(user.id)} title="Eliminar" className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40">🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Gestión de Contraseñas Masivas</h2>
                        <div className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.008a1 1 0 011 1v3.008a1 1 0 01-1 1h-.008a1 1 0 01-1-1V5z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700 dark:text-red-200">
                                        Esta acción restablecerá las contraseñas de TODOS los usuarios a la contraseña por defecto ('recoleta'). Úselo con precaución.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4">
                            <button onClick={handleMassPasswordReset} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 flex items-center gap-2">
                                <KeyIcon />
                                Restablecer Todas las Contraseñas
                            </button>
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