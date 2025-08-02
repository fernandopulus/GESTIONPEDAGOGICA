import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../src/firebase'; // Ajusta la ruta según tu estructura
import { AsistenciaDual, User, Profile } from '../../types';
import { CURSOS_DUAL } from '../../constants';
import {
    subscribeToAsistenciaByMonth,
    subscribeToAllUsers,
    subscribeToAllUsersMultiCollection,
    debugAsistenciaCollections,
    debugUsersCollection,
    findAllAttendanceRecords,
    testDirectAccess,
} from '../../src/firebaseHelpers/asistenciaDual';

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

// Icons
const EntryIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
);

const ExitIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H9.5l3.5 3.5L11.59 18 6 12.41 11.59 7 13 8.41 9.5 11H17v2z"/>
    </svg>
);

interface AttendanceRecord {
    entrada?: AsistenciaDual;
    salida?: AsistenciaDual;
}

const AsistenciaDual: React.FC = () => {
    const [allRegistros, setAllRegistros] = useState<AsistenciaDual[]>([]);
    const [allStudents, setAllStudents] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCurso, setSelectedCurso] = useState<string>('todos');
    const [studentFilter, setStudentFilter] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        console.log('=== INICIANDO CARGA DE DATOS ===');
        console.log('Año:', year, 'Mes:', month);

        let asistenciaLoaded = false;
        let usersLoaded = false;

        const checkLoadingComplete = () => {
            if (asistenciaLoaded && usersLoaded) {
                console.log('=== CARGA COMPLETA ===');
                setLoading(false);
            }
        };

        // PRUEBA DIRECTA SIMPLE
        const runDirectTest = async () => {
            console.log('🧪 INICIANDO PRUEBA DIRECTA SIMPLE...');
            
            try {
                const testRef = collection(db, 'asistencia_dual');
                const testQuery = query(testRef, limit(5));
                const testSnapshot = await getDocs(testQuery);
                
                console.log(`✅ asistencia_dual - Documentos encontrados: ${testSnapshot.size}`);
                
                if (testSnapshot.size > 0) {
                    testSnapshot.docs.forEach((doc, index) => {
                        const data = doc.data();
                        console.log(`   ${index + 1}. ${doc.id.slice(0, 8)} - ${data.emailEstudiante} - ${data.tipo}`);
                        console.log(`      Fecha original:`, data.fechaHora);
                        console.log(`      Todos los campos:`, Object.keys(data));
                    });
                } else {
                    console.log('❌ No se encontraron documentos en asistencia_dual');
                    
                    // Intentar con otras colecciones conocidas
                    const otherCollections = ['asistenciaEmpresa', 'asistencia_empresa'];
                    for (const collName of otherCollections) {
                        try {
                            const otherRef = collection(db, collName);
                            const otherQuery = query(otherRef, limit(3));
                            const otherSnapshot = await getDocs(otherQuery);
                            console.log(`📋 ${collName}: ${otherSnapshot.size} documentos`);
                            
                            if (otherSnapshot.size > 0) {
                                const sampleData = otherSnapshot.docs[0].data();
                                console.log(`   Estructura:`, Object.keys(sampleData));
                                console.log(`   Email:`, sampleData.emailEstudiante || sampleData.email);
                                console.log(`   Fecha:`, sampleData.fechaHora || sampleData.fecha);
                            }
                        } catch (err) {
                            console.log(`❌ ${collName}: ${err instanceof Error ? err.message : 'Error'}`);
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Error en prueba directa:', error);
                
                if ((error as any).code === 'permission-denied') {
                    console.log('🔒 PROBLEMA: Permisos de Firestore denegados');
                    console.log('💡 Ve a Firebase Console → Firestore → Rules y verifica los permisos');
                } else if ((error as any).code === 'failed-precondition') {
                    console.log('📊 PROBLEMA: Faltan índices en Firestore');
                    console.log('💡 Ve a Firebase Console → Firestore → Indexes');
                }
            }
        };
        
        runDirectTest();

        // Debug: verificar qué colecciones existen
        debugAsistenciaCollections(year, month).then(debugInfo => {
            console.log('🔍 Debug info for collections:', debugInfo);
            
            // Mostrar información detallada de cada colección
            Object.entries(debugInfo).forEach(([collectionName, info]: [string, any]) => {
                if (info.exists && info.totalDocs > 0) {
                    console.log(`\n📋 COLECCIÓN ${collectionName.toUpperCase()}:`);
                    console.log(`   📊 Total documentos: ${info.totalDocs}`);
                    console.log(`   📅 Documentos del período: ${info.count}`);
                    console.log(`   🔑 Campo de fecha: ${info.hasDateField}`);
                    
                    if (info.sampleDoc) {
                        console.log(`   📄 Documento ejemplo:`, info.sampleDoc);
                        
                        // Analizar campos importantes
                        const doc = info.sampleDoc;
                        const emailField = doc.emailEstudiante || doc.email || doc.userEmail || doc.correo || 'NO ENCONTRADO';
                        const tipoField = doc.tipo || doc.type || doc.action || doc.tipoRegistro || 'NO ENCONTRADO';
                        const fechaField = doc.fechaHora || doc.fecha || doc.timestamp || doc.createdAt || 'NO ENCONTRADO';
                        
                        console.log(`   📧 Email estudiante: ${emailField}`);
                        console.log(`   📝 Tipo registro: ${tipoField}`);
                        console.log(`   📅 Fecha: ${fechaField}`);
                        console.log(`   🗂️ Todos los campos:`, Object.keys(doc));
                    }
                    
                    if (info.filteredDocs && info.filteredDocs.length > 0) {
                        console.log(`   📋 Registros del período encontrados:`, info.filteredDocs.length);
                        info.filteredDocs.forEach((docInfo: any, index: number) => {
                            if (index < 3) { // Mostrar solo los primeros 3
                                console.log(`      ${index + 1}. ID: ${docInfo.id}`, docInfo.data);
                            }
                        });
                    }
                } else if (info.exists) {
                    console.log(`⚪ Colección ${collectionName}: vacía`);
                } else {
                    console.log(`❌ Colección ${collectionName}: no existe`);
                }
            });
        }).catch(err => {
            console.error('Debug error:', err);
        });

        // Debug: verificar estructura de usuarios
        debugUsersCollection().then(usersDebugInfo => {
            console.log('🔍 Debug info for users:', usersDebugInfo);
            
            // Si no hay usuarios, intentar otras colecciones comunes
            if (!usersDebugInfo.exists || usersDebugInfo.totalDocs === 0) {
                console.log('⚠️ Colección "users" vacía o no existe. Buscando alternativas...');
                
                // Intentar otras posibles colecciones de usuarios
                const alternativeCollections = ['usuarios', 'estudiantes', 'profiles', 'accounts', 'members'];
                
                alternativeCollections.forEach(async (collectionName) => {
                    try {
                        const testRef = collection(db, collectionName);
                        const testQuery = query(testRef, limit(5));
                        const testSnapshot = await getDocs(testQuery);
                        
                        if (testSnapshot.size > 0) {
                            console.log(`✅ Encontrada colección alternativa: ${collectionName} con ${testSnapshot.size} documentos`);
                            console.log(`Documento muestra:`, testSnapshot.docs[0]?.data());
                        } else {
                            console.log(`❌ Colección ${collectionName}: vacía`);
                        }
                    } catch (error) {
                        console.log(`❌ Colección ${collectionName}: no existe`);
                    }
                });
            }
        }).catch(err => {
            console.error('Users debug error:', err);
        });

        try {
            console.log('Configurando suscripción a asistencia...');
            const unsubAsistencia = subscribeToAsistenciaByMonth(
                year, 
                month, 
                (registros: AsistenciaDual[]) => {
                    console.log('✅ Received registros:', registros.length);
                    
                    if (registros.length > 0) {
                        console.log('📋 ANÁLISIS DE REGISTROS RECIBIDOS:');
                        console.log('Sample registro:', registros[0]);
                        
                        // Analizar todos los emails únicos
                        const emailsEncontrados = [...new Set(registros.map(r => r.emailEstudiante).filter(Boolean))];
                        console.log('📧 Emails de estudiantes en registros:', emailsEncontrados);
                        
                        // Analizar todos los tipos de registro
                        const tiposEncontrados = [...new Set(registros.map(r => r.tipo).filter(Boolean))];
                        console.log('📝 Tipos de registro encontrados:', tiposEncontrados);
                        
                        // Analizar registros por día
                        const registrosPorDia = registros.reduce((acc, registro) => {
                            const dia = new Date(registro.fechaHora).getDate();
                            if (!acc[dia]) acc[dia] = [];
                            acc[dia].push(registro);
                            return acc;
                        }, {} as Record<number, AsistenciaDual[]>);
                        
                        console.log('📅 Registros por día del mes:', Object.keys(registrosPorDia).map(dia => ({
                            dia: parseInt(dia),
                            cantidad: registrosPorDia[parseInt(dia)].length
                        })));
                        
                        // Comparar emails de registros con emails de estudiantes
                        const emailsEstudiantes = allStudents.map(s => s.email).filter(Boolean);
                        console.log('👥 Emails de estudiantes cargados:', emailsEstudiantes);
                        
                        const emailsCoincidentes = emailsEncontrados.filter(email => emailsEstudiantes.includes(email));
                        const emailsNoCoincidentes = emailsEncontrados.filter(email => !emailsEstudiantes.includes(email));
                        
                        console.log('✅ Emails que coinciden:', emailsCoincidentes);
                        console.log('❌ Emails que NO coinciden:', emailsNoCoincidentes);
                    } else {
                        console.log('⚠️ No se encontraron registros de asistencia para el período');
                    }
                    
                    setAllRegistros(registros);
                    asistenciaLoaded = true;
                    checkLoadingComplete();
                },
                (error: Error) => {
                    console.error('❌ Error fetching asistencia:', error);
                    setError('Error al cargar datos de asistencia: ' + error.message);
                    asistenciaLoaded = true;
                    checkLoadingComplete();
                }
            );

            console.log('Configurando suscripción a usuarios...');
            const unsubUsers = subscribeToAllUsersMultiCollection(
                (users: User[]) => {
                    console.log('✅ Received users (multi-collection):', users.length);
                    if (users.length > 0) {
                        console.log('Sample user:', users[0]);
                        const dualStudents = users.filter(u => u.profile === Profile.ESTUDIANTE && u.curso);
                        console.log('Dual students found:', dualStudents.length);
                        dualStudents.forEach(student => {
                            console.log(`- ${student.nombreCompleto} (${student.curso}) - ${student.email}`);
                        });
                    }
                    setAllStudents(users);
                    usersLoaded = true;
                    checkLoadingComplete();
                },
                (error: Error) => {
                    console.error('❌ Error fetching users (multi-collection):', error);
                    
                    // Fallback: intentar con la función original
                    console.log('🔄 Intentando con función original de usuarios...');
                    const fallbackUnsub = subscribeToAllUsers(
                        (users: User[]) => {
                            console.log('✅ Received users (fallback):', users.length);
                            setAllStudents(users);
                            usersLoaded = true;
                            checkLoadingComplete();
                        },
                        (fallbackError: Error) => {
                            console.error('❌ Error en fallback también:', fallbackError);
                            setError('Error al cargar estudiantes: ' + error.message);
                            usersLoaded = true;
                            checkLoadingComplete();
                        }
                    );
                }
            );

            return () => {
                console.log('Limpiando suscripciones...');
                if (unsubAsistencia) unsubAsistencia();
                if (unsubUsers) unsubUsers();
            };
        } catch (err) {
            console.error('❌ Error setting up subscriptions:', err);
            setError('Error al inicializar conexiones: ' + (err instanceof Error ? err.message : 'Error desconocido'));
            setLoading(false);
        }
    }, [currentDate]);

    const { monthDays, monthName, year } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        return {
            monthDays: new Date(year, month + 1, 0).getDate(),
            monthName: currentDate.toLocaleString('es-CL', { month: 'long' }),
            year: year,
        };
    }, [currentDate]);

    const studentsForCourse = useMemo(() => {
        let filteredStudents = allStudents
            .filter(u => u.profile === Profile.ESTUDIANTE && u.curso && CURSOS_DUAL.includes(normalizeCurso(u.curso)));

        if (selectedCurso !== 'todos') {
            filteredStudents = filteredStudents.filter(u => normalizeCurso(u.curso || '') === selectedCurso);
        }

        if (studentFilter) {
            filteredStudents = filteredStudents.filter(u => 
                u.nombreCompleto.toLowerCase().includes(studentFilter.toLowerCase())
            );
        }
        
        console.log(`👥 Estudiantes filtrados para mostrar: ${filteredStudents.length}`);
        filteredStudents.forEach(student => {
            console.log(`   - ${student.nombreCompleto} (${student.curso}) - ${student.email}`);
        });
        
        return filteredStudents.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    }, [allStudents, selectedCurso, studentFilter]);

    const attendanceData = useMemo(() => {
        const data = new Map<string, Map<number, AttendanceRecord>>();
        
        allRegistros.forEach(registro => {
            const studentKey = registro.emailEstudiante;
            if (!studentKey) return;

            const day = new Date(registro.fechaHora).getDate();
            
            if (!data.has(studentKey)) {
                data.set(studentKey, new Map());
            }
            
            const studentDayData = data.get(studentKey)!;
            if (!studentDayData.has(day)) {
                studentDayData.set(day, {});
            }
            
            const dayEntry = studentDayData.get(day)!;

            if (registro.tipo === 'Entrada') {
                if (!dayEntry.entrada || new Date(registro.fechaHora) < new Date(dayEntry.entrada.fechaHora)) {
                    dayEntry.entrada = registro;
                }
            } else if (registro.tipo === 'Salida') {
                if (!dayEntry.salida || new Date(registro.fechaHora) > new Date(dayEntry.salida.fechaHora)) {
                    dayEntry.salida = registro;
                }
            }
        });

        return data;
    }, [allRegistros]);

    const changeMonth = (delta: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + delta);
            return newDate;
        });
    };

    const handleLocationClick = (ubicacion: any) => {
        if (ubicacion?.latitud && ubicacion?.longitud) {
            window.open(`https://www.google.com/maps?q=${ubicacion.latitud},${ubicacion.longitud}`, '_blank');
        }
    };

    const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

    if (error) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <div className="text-red-600 bg-red-100 dark:bg-red-900/30 p-4 rounded-md">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md space-y-6 animate-fade-in">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                Asistencia Dual Mensual
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 dark:border-slate-700">
                <div className="flex items-center justify-center md:justify-start gap-2">
                    <button 
                        onClick={() => changeMonth(-1)} 
                        disabled={loading}
                        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Mes anterior"
                    >
                        ←
                    </button>
                    <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 capitalize w-48 text-center">
                        {`${monthName} ${year}`}
                    </h2>
                    <button 
                        onClick={() => changeMonth(1)} 
                        disabled={loading}
                        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Mes siguiente"
                    >
                        →
                    </button>
                </div>
                
                <select 
                    value={selectedCurso} 
                    onChange={e => setSelectedCurso(e.target.value)} 
                    disabled={loading}
                    className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="todos">Todos los Cursos</option>
                    {CURSOS_DUAL.map(curso => (
                        <option key={curso} value={curso}>{curso}</option>
                    ))}
                </select>
                
                <input 
                    type="text" 
                    placeholder="Buscar estudiante..." 
                    value={studentFilter} 
                    onChange={e => setStudentFilter(e.target.value)} 
                    disabled={loading}
                    className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            {loading ? (
                <div className="text-center text-amber-600 py-10">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mb-4"></div>
                    <div>Cargando datos de asistencia...</div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse border border-slate-200 dark:border-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 p-2 border-r border-b border-slate-200 dark:border-slate-600 text-sm font-semibold w-48">
                                    Estudiante
                                </th>
                                {Array.from({ length: monthDays }, (_, i) => {
                                    const dayDate = new Date(year, currentDate.getMonth(), i + 1);
                                    const dayOfWeek = dayDate.getDay();
                                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                    return (
                                        <th 
                                            key={i} 
                                            className={`p-1 border-r border-b border-slate-200 dark:border-slate-600 text-xs w-16 ${
                                                isWeekend ? 'bg-slate-100 dark:bg-slate-700/50' : ''
                                            }`}
                                        >
                                            <div className="font-semibold">{weekDays[dayOfWeek]}</div>
                                            <div>{i + 1}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {studentsForCourse.length > 0 ? (
                                studentsForCourse.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="sticky left-0 bg-white dark:bg-slate-800 z-10 p-2 border-r border-b border-slate-200 dark:border-slate-600 text-sm font-medium whitespace-nowrap">
                                            {student.nombreCompleto}
                                        </td>
                                        {Array.from({ length: monthDays }, (_, i) => {
                                            const day = i + 1;
                                            const studentDayRecords = attendanceData.get(student.email)?.get(day);
                                            const dayDate = new Date(year, currentDate.getMonth(), i + 1);
                                            const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;

                                            return (
                                                <td 
                                                    key={day} 
                                                    className={`p-1 border-r border-b border-slate-200 dark:border-slate-600 text-center align-middle ${
                                                        isWeekend ? 'bg-slate-100 dark:bg-slate-700/50' : ''
                                                    }`}
                                                >
                                                    <div className="flex justify-center items-center gap-1.5 h-full">
                                                        {studentDayRecords?.entrada && (
                                                            <div
                                                                className="group relative cursor-pointer"
                                                                onClick={() => handleLocationClick(studentDayRecords.entrada?.ubicacion)}
                                                            >
                                                                <EntryIcon />
                                                                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                                    {new Date(studentDayRecords.entrada.fechaHora).toLocaleTimeString('es-CL', { 
                                                                        hour: '2-digit', 
                                                                        minute: '2-digit' 
                                                                    })}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {studentDayRecords?.salida && (
                                                            <div
                                                                className="group relative cursor-pointer"
                                                                onClick={() => handleLocationClick(studentDayRecords.salida?.ubicacion)}
                                                            >
                                                                <ExitIcon />
                                                                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                                    {new Date(studentDayRecords.salida.fechaHora).toLocaleTimeString('es-CL', { 
                                                                        hour: '2-digit', 
                                                                        minute: '2-digit' 
                                                                    })}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={monthDays + 1} className="text-center p-8 text-slate-500">
                                        No hay estudiantes en el curso seleccionado o que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AsistenciaDual;