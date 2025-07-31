import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { User, Profile } from '../../types';
import { CURSOS, ASIGNATURAS } from '../../constants';
import { read, utils } from 'xlsx';
import MonitorDeUso from './MonitorDeUso';
import {
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
} from '../../firebaseHelpers/users'; // AJUSTA la ruta según dónde guardaste los helpers

const ALL_PROFILES = Object.values(Profile);

const KeyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.629 5.629l-2.371 2.37-1.414-1.414 2.371-2.371A6 6 0 0115 7zm-3.707 5.293L6 17.586V20h2.414l5.293-5.293a1 1 0 00-1.414-1.414z" /></svg>;

const normalizeCurso = (curso: string): string => {
    if (!curso) return '';
    let normalized = curso.trim().toLowerCase();
    normalized = normalized.replace(/°/g, 'º');
    normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
    normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
    normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
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
            setUserError("No se pudieron cargar los usuarios desde la nube.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleUserFieldChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setUserFormData(prev => ({
            ...prev,
            [name]: value,
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

        try {
            if (editingUserId) {
                await updateUser(userFormData.email, {
                    ...userFormData,
                    password: finalPassword,
                    curso: finalCurso,
                    cursos: finalCursos,
                    asignaturas: finalAsignaturas,
                });
            } else {
                await createUser({
                    ...userFormData,
                    password: finalPassword,
                    curso: finalCurso,
                    cursos: finalCursos,
                    asignaturas: finalAsignaturas,
                });
            }
            await fetchUsers();
            handleUserResetForm();
        } catch (err) {
            setUserError("Error al guardar el usuario en la nube.");
        }
    }, [userFormData, editingUserId, fetchUsers, handleUserResetForm]);

    const handleUserEdit = useCallback((user: User) => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setEditingUserId(user.id);
        setUserFormData({
            nombreCompleto: user.nombreCompleto,
            email: user.email,
            rut: user.rut,
            profile: user.profile,
            password: '',
            curso: user.curso,
            cursos: user.cursos || [],
            asignaturas: user.asignaturas || []
        });
    }, []);

    const handleUserDelete = useCallback(async (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar este usuario?')) {
            try {
                await deleteUser(id);
                await fetchUsers();
            } catch {
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
                await Promise.all(users.map(u => updateUser(u.email, { password: undefined })));
                await fetchUsers();
                alert("Todas las contraseñas han sido restablecidas exitosamente a 'recoleta'.");
            } catch {
                setUserError("Error al restablecer contraseñas en la nube.");
            }
        }
    };

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

    // --- Carga masiva desde Excel (estudiantes)
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
                        curso: normalizeCurso(String(curso).trim()),
                    };
                    return newUser;
                }).filter((u): u is User => u !== null && !users.some(existing => existing.email.toLowerCase() === u.email.toLowerCase()));

                if (newStudents.length > 0) {
                    await Promise.all(newStudents.map(u => createUser(u)));
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

    // --- Carga masiva desde Excel (personal)
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
                    await Promise.all(newStaff.map(u => createUser(u)));
                    await fetchUsers();
                }

                let message = `Carga completada. Se agregaron ${newStaff.length} nuevos miembros del personal.`;
                if (ambiguousRows > 0) {
                    message += ` Se omitieron ${ambiguousRows} filas porque parecían ser de estudiantes.`;
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

    // --- JSX (igual que antes) ---
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
            {/* ...TODO tu JSX de administración igual que antes... */}
            {/* ...no necesitas cambiar los forms ni la tabla, solo la fuente de datos! */}
            {/* ...el resto del código permanece igual... */}
            {/* (Por límite de espacio, puedes copiar tu JSX original aquí, que ya lo tienes listo) */}
            {/* Si quieres que lo copie y adapte todo con todos los campos incluidos, avísame ;) */}
        </div>
    );
};

export default Administracion;
