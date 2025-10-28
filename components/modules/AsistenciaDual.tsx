import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../src/firebase'; // Ajusta la ruta según tu estructura
import { User, Profile, Empresa } from '../../types';
import { useAuth } from '../../src/hooks/useAuth';
import type { AsistenciaDual as AsistenciaDualType } from '../../types';
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
import { getAllUsers as getAllUsersFromAlt } from '../../src/firebaseHelpers/users';
import { subscribeToEmpresas } from '../../src/firebaseHelpers/empresasHelper';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ReTooltip,
    BarChart,
    Bar,
    Legend
} from 'recharts';

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
    entrada?: AsistenciaDualType;
    salida?: AsistenciaDualType;
}

const AsistenciaDual: React.FC = () => {
    const [allRegistros, setAllRegistros] = useState<AsistenciaDualType[]>([]);
    const [allStudents, setAllStudents] = useState<User[]>([]);
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCurso, setSelectedCurso] = useState<string>('todos');
    const [studentFilter, setStudentFilter] = useState('');
    const [includeAll, setIncludeAll] = useState(false);

    // Umbral de desviación configurable y persistente por usuario
    const { currentUser } = useAuth();
    const getThresholdKey = (email?: string | null) => `asistenciaDual.threshold.${email || 'default'}`;
    const [thresholdMeters, setThresholdMeters] = useState<number>(() => {
        try {
            const raw = localStorage.getItem(getThresholdKey(null));
            const n = raw ? parseInt(raw, 10) : NaN;
            return Number.isFinite(n) && n > 0 ? n : 200;
        } catch {
            return 200;
        }
    });
    useEffect(() => {
        try {
            const key = getThresholdKey(currentUser?.email);
            const raw = localStorage.getItem(key);
            if (raw) {
                const n = parseInt(raw, 10);
                if (Number.isFinite(n) && n > 0) setThresholdMeters(n);
            }
        } catch {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.email]);
    useEffect(() => {
        try {
            const key = getThresholdKey(currentUser?.email);
            localStorage.setItem(key, String(thresholdMeters));
        } catch {}
    }, [thresholdMeters, currentUser?.email]);

    // Vista: tabla o dashboard
    const [view, setView] = useState<'tabla' | 'dashboard'>('tabla');

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
            if (!usersDebugInfo.exists || ('totalDocs' in usersDebugInfo && usersDebugInfo.totalDocs === 0)) {
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
            let unsubAsistencia = subscribeToAsistenciaByMonth(
                year, 
                month, 
                (registros: AsistenciaDualType[]) => {
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
                        }, {} as Record<number, AsistenciaDualType[]>);
                        
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
                },
                { includeAll }
            );

            console.log('Configurando suscripción a usuarios...');
            let unsubUsers: (() => void) | null = null;
            let unsubUsersFallback: (() => void) | null = null;
            unsubUsers = subscribeToAllUsersMultiCollection(
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
                    unsubUsersFallback = subscribeToAllUsers(
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

            // Fallback adicional: si tras 4s no hay usuarios cargados, hacer una lectura directa desde colección "usuarios"
            setTimeout(async () => {
                if (!usersLoaded && allStudents.length === 0) {
                    try {
                        console.log('⏳ Timeout de usuarios: aplicando fallback getAllUsersFromAlt()...');
                        const altUsers = await getAllUsersFromAlt();
                        if (altUsers.length > 0) {
                            console.log(`✅ Fallback cargó ${altUsers.length} usuarios desde colección "usuarios"`);
                            setAllStudents(altUsers);
                            // Marcar como cargado aunque venga vacío o con datos
                            usersLoaded = true;
                            checkLoadingComplete();
                        } else {
                            console.warn('⚠️ Fallback no encontró usuarios en "usuarios"');
                            // Aún así debemos finalizar el loading para mostrar estado vacío
                            usersLoaded = true;
                            checkLoadingComplete();
                        }
                    } catch (e) {
                        console.error('❌ Error en fallback getAllUsersFromAlt:', e);
                        // No bloquear la UI si falla el fallback
                        usersLoaded = true;
                        checkLoadingComplete();
                    }
                }
            }, 4000);

            return () => {
                console.log('Limpiando suscripciones...');
                if (unsubAsistencia) unsubAsistencia();
                if (unsubUsers) unsubUsers();
                if (unsubUsersFallback) unsubUsersFallback();
            };
        } catch (err) {
            console.error('❌ Error setting up subscriptions:', err);
            setError('Error al inicializar conexiones: ' + (err instanceof Error ? err.message : 'Error desconocido'));
            setLoading(false);
        }
    }, [currentDate, includeAll]);

    // Suscripción a empresas (para obtener coordenadas y asignación estudiantes)
    useEffect(() => {
        const unsub = subscribeToEmpresas(setEmpresas);
        return () => unsub && unsub();
    }, []);

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
        
        // Agregar estudiantes que tienen registros pero no están en la lista
        if (allRegistros.length > 0) {
            const emailsEnRegistros = [...new Set(allRegistros.map(r => r.emailEstudiante).filter((e): e is string => Boolean(e)))];
            const emailsDeEstudiantes = filteredStudents.map(s => s.email);
            const emailsFaltantes = emailsEnRegistros.filter(email => !emailsDeEstudiantes.includes(email));
            
            if (emailsFaltantes.length > 0) {
                console.log('📝 Agregando estudiantes faltantes con registros:', emailsFaltantes);
                
                const estudiantesFaltantes = emailsFaltantes.map((email: string) => {
                    const registro = allRegistros.find(r => r.emailEstudiante === email);
                    return {
                        id: email,
                        email: email,
                        nombreCompleto: registro?.nombreEstudiante || email.split('@')[0],
                        curso: registro?.curso || '3ºC',
                        profile: Profile.ESTUDIANTE,
                        activo: true,
                        fechaCreacion: new Date(),
                        ultimaActividad: new Date()
                    };
                });
                
                // Solo agregar si pasan los filtros
                const estudiantesFiltrados = estudiantesFaltantes.filter(est => {
                    const pasaCurso = selectedCurso === 'todos' || normalizeCurso(est.curso) === selectedCurso;
                    const pasaBusqueda = !studentFilter || est.nombreCompleto.toLowerCase().includes(studentFilter.toLowerCase());
                    return pasaCurso && pasaBusqueda && CURSOS_DUAL.includes(normalizeCurso(est.curso));
                });
                
                filteredStudents = [...filteredStudents, ...estudiantesFiltrados];
            }
        }
        
        console.log(`👥 Estudiantes filtrados para mostrar: ${filteredStudents.length}`);
        filteredStudents.forEach(student => {
            console.log(`   - ${student.nombreCompleto} (${student.curso}) - ${student.email}`);
        });
        
        return filteredStudents.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    }, [allStudents, selectedCurso, studentFilter, allRegistros]);

    const attendanceData = useMemo(() => {
        console.log('🔄 Procesando datos de asistencia para la tabla...');
        console.log(`📊 Total registros a procesar: ${allRegistros.length}`);
        console.log(`👥 Estudiantes disponibles: ${studentsForCourse.length}`);
        
        const data = new Map<string, Map<number, AttendanceRecord>>();
        
        if (allRegistros.length === 0) {
            console.log('⚠️ No hay registros para procesar aún');
            return data;
        }
        
        allRegistros.forEach((registro, index) => {
            const studentKey = registro.emailEstudiante;
            if (!studentKey) return;

            // Procesar fecha con más detalle
            let fechaRegistro: Date;
            if (registro.fechaHora instanceof Date) {
                fechaRegistro = registro.fechaHora;
            } else if (registro.fechaHora && typeof registro.fechaHora === 'object' && 'toDate' in registro.fechaHora) {
                fechaRegistro = (registro.fechaHora as any).toDate();
            } else if (typeof registro.fechaHora === 'string') {
                fechaRegistro = new Date(registro.fechaHora);
            } else {
                console.warn('Fecha no válida en registro:', registro);
                return;
            }

            const day = fechaRegistro.getDate();
            const month = fechaRegistro.getMonth();
            const year = fechaRegistro.getFullYear();
            
            if (index < 3) { // Log detallado para los primeros registros
                console.log(`📅 Registro ${index + 1}:`, {
                    email: studentKey,
                    tipo: registro.tipo,
                    fechaOriginal: registro.fechaHora,
                    fechaProcesada: fechaRegistro.toLocaleString(),
                    año: year,
                    mes: month,
                    día: day
                });
            }
            
            if (!data.has(studentKey)) {
                data.set(studentKey, new Map());
            }
            
            const studentDayData = data.get(studentKey)!;
            if (!studentDayData.has(day)) {
                studentDayData.set(day, {});
            }
            
            const dayEntry = studentDayData.get(day)!;

            if (registro.tipo === 'Entrada') {
                if (!dayEntry.entrada || fechaRegistro < new Date(dayEntry.entrada.fechaHora)) {
                    dayEntry.entrada = registro;
                }
            } else if (registro.tipo === 'Salida') {
                if (!dayEntry.salida || fechaRegistro > new Date(dayEntry.salida.fechaHora)) {
                    dayEntry.salida = registro;
                }
            }
        });

        console.log('📋 Datos de asistencia procesados:', {
            estudiantesConRegistros: data.size,
            estudiantes: Array.from(data.keys()),
            registrosPorEstudiante: Array.from(data.entries()).map(([email, days]) => ({
                email,
                dias: Array.from(days.keys()),
                totalRegistros: Array.from(days.values()).reduce((acc, day) => 
                    acc + (day.entrada ? 1 : 0) + (day.salida ? 1 : 0), 0)
            }))
        });

        return data;
    }, [allRegistros]); // ← QUITAR studentsForCourse de las dependencias

    // Contador de registros del período mostrado (mes actual en la vista)
    const periodRecordsCount = useMemo(() => {
        if (!allRegistros.length) return 0;
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth();
        return allRegistros.reduce((acc, r) => {
            let d: Date | null = null;
            if (r.fechaHora instanceof Date) d = r.fechaHora;
            else if (r.fechaHora && typeof r.fechaHora === 'object' && 'toDate' in (r.fechaHora as any)) d = (r.fechaHora as any).toDate();
            else if (typeof r.fechaHora === 'string') d = new Date(r.fechaHora);
            if (!d || isNaN(d.getTime())) return acc;
            return (d.getFullYear() === y && d.getMonth() === m) ? acc + 1 : acc;
        }, 0);
    }, [allRegistros, currentDate]);

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

    // Mapa auxiliar: estudianteId -> Empresa asignada
    const empresaPorEstudianteId = useMemo(() => {
        const map = new Map<string, Empresa>();
        empresas.forEach(emp => {
            (emp.estudiantesAsignados || []).forEach(stId => {
                if (stId) map.set(stId, emp);
            });
        });
        return map;
    }, [empresas]);

    // Utilidad: calcular distancia Haversine en metros
    const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const toRad = (v: number) => (v * Math.PI) / 180;
        const R = 6371000; // m
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Resumen de desviaciones por estudiante durante el mes visible
    const getDeviationSummary = (student: User) => {
        const emailKey = student.email;
        const mapDias = attendanceData.get(emailKey);
        const empresa = empresaPorEstudianteId.get(student.id);
        const coords = empresa?.coordenadas;
        if (!mapDias || !coords || coords.lat == null || coords.lng == null) {
            return { hasData: !!mapDias, undetermined: true, anyDeviation: false, count: 0, max: 0 };
        }
        let count = 0;
        let max = 0;
        for (let d = 1; d <= monthDays; d++) {
            const rec = mapDias.get(d);
            if (!rec) continue;
            const check = (u?: { latitud: number; longitud: number } | null) => {
                if (!u || u.latitud == null || u.longitud == null) return;
                const dist = haversineMeters(u.latitud, u.longitud, coords.lat, coords.lng);
                if (dist > thresholdMeters) {
                    count += 1;
                }
                if (dist > max) max = dist;
            };
            if (rec.entrada) check(rec.entrada.ubicacion);
            if (rec.salida) check(rec.salida.ubicacion);
        }
        return { hasData: true, undetermined: false, anyDeviation: count > 0, count, max };
    };

    // Filtro: Solo con desviaciones, persistente por usuario
    const [onlyDeviations, setOnlyDeviations] = useState<boolean>(() => {
        try {
            const raw = localStorage.getItem(`asistenciaDual.onlyDeviations.default`);
            return raw === '1';
        } catch { return false; }
    });
    useEffect(() => {
        try {
            const key = `asistenciaDual.onlyDeviations.${currentUser?.email || 'default'}`;
            const raw = localStorage.getItem(key);
            if (raw != null) setOnlyDeviations(raw === '1');
        } catch {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.email]);
    useEffect(() => {
        try {
            const key = `asistenciaDual.onlyDeviations.${currentUser?.email || 'default'}`;
            localStorage.setItem(key, onlyDeviations ? '1' : '0');
        } catch {}
    }, [onlyDeviations, currentUser?.email]);

    // Lista visible de estudiantes acorde al filtro de desviaciones
    const visibleStudents = useMemo(() => {
        if (!onlyDeviations) return studentsForCourse;
        return studentsForCourse.filter(st => {
            const s = getDeviationSummary(st);
            return s.hasData && !s.undetermined && s.anyDeviation;
        });
    }, [studentsForCourse, onlyDeviations, attendanceData, empresaPorEstudianteId, monthDays]);

    // Agregados para dashboard
    const dashboardData = useMemo(() => {
        // Estudiantes en alcance (aplican filtros de curso/nombre ya en studentsForCourse)
        const estudiantes = visibleStudents;
        const emailsSet = new Set(estudiantes.map(e => e.email));

        // Totales por día (E = entradas)
        const dailyEntries: Array<{ day: number; entradas: number }> = [];
        for (let d = 1; d <= monthDays; d++) {
            let entradas = 0;
            emailsSet.forEach(email => {
                const rec = attendanceData.get(email)?.get(d);
                if (rec?.entrada) entradas += 1;
            });
            dailyEntries.push({ day: d, entradas });
        }

        // Totales por día de semana (todas las entradas)
        const byWeekday: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        dailyEntries.forEach(({ day, entradas }) => {
            const dt = new Date(year, currentDate.getMonth(), day);
            const w = dt.getDay();
            byWeekday[w] += entradas;
        });
        const weekdaySeries = [0, 1, 2, 3, 4, 5, 6].map(w => ({ nombre: weekDays[w], registros: byWeekday[w] }));

        // Promedio de días con entrada por estudiante
        let sumDiasPorEstudiante = 0;
        estudiantes.forEach(st => {
            const mapDias = attendanceData.get(st.email);
            if (!mapDias) return;
            let dias = 0;
            for (let d = 1; d <= monthDays; d++) if (mapDias.get(d)?.entrada) dias += 1;
            sumDiasPorEstudiante += dias;
        });
        const avgDiasConEntrada = estudiantes.length ? (sumDiasPorEstudiante / estudiantes.length) : 0;

        // Desviaciones totales y top 5
        const desvPorEstudiante = estudiantes.map(st => {
            const s = getDeviationSummary(st);
            return { id: st.id, nombre: st.nombreCompleto, count: s.count, any: s.anyDeviation };
        });
        const totalDesviaciones = desvPorEstudiante.reduce((a, b) => a + (b.count || 0), 0);
        const topDesviadores = desvPorEstudiante
            .filter(x => x.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Si se ve "Todos los cursos", agregamos barra por curso
        let porCurso: Array<{ curso: string; promedioDias: number; estudiantes: number }> = [];
        if (selectedCurso === 'todos') {
            const grupos = new Map<string, User[]>();
            estudiantes.forEach(st => {
                const c = st.curso || '—';
                if (!grupos.has(c)) grupos.set(c, []);
                grupos.get(c)!.push(st);
            });
            porCurso = Array.from(grupos.entries()).map(([curso, sts]) => {
                let sum = 0;
                sts.forEach(st => {
                    const mapDias = attendanceData.get(st.email);
                    if (!mapDias) return;
                    let dias = 0;
                    for (let d = 1; d <= monthDays; d++) if (mapDias.get(d)?.entrada) dias += 1;
                    sum += dias;
                });
                const promedioDias = sts.length ? sum / sts.length : 0;
                return { curso, promedioDias, estudiantes: sts.length };
            }).sort((a, b) => a.curso.localeCompare(b.curso, 'es'));
        }

        return {
            estudiantesCount: estudiantes.length,
            dailyEntries,
            weekdaySeries,
            avgDiasConEntrada,
            totalDesviaciones,
            topDesviadores,
            porCurso,
        };
    }, [visibleStudents, attendanceData, monthDays, year, currentDate, selectedCurso]);

    // --- Utilidades CSV locales ---
    const csvEscape = (value: any): string => {
        if (value === null || value === undefined) return '';
        let str = String(value);
        // Escapar comillas dobles y envolver en comillas si contiene separadores o saltos de línea
        const needsQuotes = /[",\n]/.test(str);
        str = str.replace(/"/g, '""');
        return needsQuotes ? `"${str}"` : str;
    };

    const downloadCSV = (filename: string, rows: string[][]) => {
        const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportarInformeCSV = () => {
        try {
            // Encabezados: Estudiante, Curso, 1..N, Ingresos, Salidas
            const headers: string[] = ['Estudiante', 'Curso'];
            for (let d = 1; d <= monthDays; d++) headers.push(String(d));
            headers.push('Ingresos', 'Salidas', 'Desv', 'DesvEventos', 'DesvMax(m)');

            const rows: string[][] = [headers];

            visibleStudents.forEach(student => {
                const mapDias = attendanceData.get(student.email);
                let totalIngresos = 0;
                let totalSalidas = 0;
                const dayMarks: string[] = [];

                for (let d = 1; d <= monthDays; d++) {
                    const rec = mapDias?.get(d);
                    const hasE = !!rec?.entrada;
                    const hasS = !!rec?.salida;
                    if (hasE) totalIngresos += 1;
                    if (hasS) totalSalidas += 1;
                    if (hasE && hasS) dayMarks.push('E/S');
                    else if (hasE) dayMarks.push('E');
                    else if (hasS) dayMarks.push('S');
                    else dayMarks.push('');
                }

                const dev = getDeviationSummary(student);
                const devLabel = !dev.hasData ? '' : (dev.undetermined ? 'N/D' : (dev.anyDeviation ? 'Sí' : 'No'));

                rows.push([
                    student.nombreCompleto || '',
                    student.curso || '',
                    ...dayMarks,
                    String(totalIngresos),
                    String(totalSalidas),
                    devLabel,
                    dev.hasData && !dev.undetermined ? String(dev.count) : '',
                    dev.hasData && !dev.undetermined ? String(Math.round(dev.max)) : ''
                ]);
            });

            const mes = currentDate.toLocaleString('es-CL', { month: 'long' });
            const fileSafeMes = mes.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '_');
            const fileSafeCurso = selectedCurso === 'todos' ? 'Todos' : selectedCurso.replace(/[^A-Za-z0-9º]/g, '_');
            const filename = `asistencia_dual_${fileSafeCurso}_${fileSafeMes}_${year}${onlyDeviations ? '_solo_desv' : ''}.csv`;
            downloadCSV(filename, rows);
        } catch (e) {
            console.error('Error al exportar CSV:', e);
            alert('No se pudo generar el informe. Intenta nuevamente.');
        }
    };

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
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 dark:border-slate-700">
                <div className="flex items-center justify-center md:justify-start gap-2">
                    <button 
                        onClick={() => changeMonth(-1)} 
                        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        aria-label="Mes anterior"
                    >
                        ←
                    </button>
                    <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 capitalize w-48 text-center">
                        {`${monthName} ${year}`}
                    </h2>
                    <button 
                        onClick={() => changeMonth(1)} 
                        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        aria-label="Mes siguiente"
                    >
                        →
                    </button>
                </div>
                <label className="flex items-center gap-2 justify-center md:justify-start">
                    <input type="checkbox" checked={includeAll} onChange={e => setIncludeAll(e.target.checked)} disabled={loading} />
                    <span className="text-slate-700 dark:text-slate-200 text-sm">Mostrar todo</span>
                </label>
                
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

                {/* Resumen de estado */}
                <div className="text-center md:text-right text-sm text-slate-600 dark:text-slate-300">
                    <span className="inline-block px-2 py-1 rounded bg-slate-100 dark:bg-slate-600/50 mr-2">Estudiantes: {studentsForCourse.length}</span>
                    <span className="inline-block px-2 py-1 rounded bg-slate-100 dark:bg-slate-600/50">Registros del período: {periodRecordsCount}</span>
                </div>

                {/* Acción: Descargar informe + Toggle Dashboard */}
                <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
                    <button
                        onClick={() => setView(prev => prev === 'tabla' ? 'dashboard' : 'tabla')}
                        className="px-4 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 w-full sm:w-auto min-w-[140px]"
                        title="Alternar entre Tabla y Dashboard"
                    >
                        {view === 'tabla' ? 'Ver Dashboard' : 'Ver Tabla'}
                    </button>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-600 dark:text-slate-300" title="Umbral de desviación geográfica">Umbral</label>
                        <select
                            value={thresholdMeters}
                            onChange={(e) => setThresholdMeters(parseInt(e.target.value) || 200)}
                            className="border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm px-2 py-1 w-full sm:w-[120px]"
                        >
                            <option value={100}>100 m</option>
                            <option value={200}>200 m</option>
                            <option value={300}>300 m</option>
                            <option value={500}>500 m</option>
                        </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input type="checkbox" checked={onlyDeviations} onChange={(e) => setOnlyDeviations(e.target.checked)} />
                        Solo con desviaciones
                    </label>
                    <button
                        onClick={exportarInformeCSV}
                        disabled={loading || visibleStudents.length === 0}
                        title="Descargar informe mensual (CSV)"
                        className="px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto min-w-[160px]"
                    >
                        Descargar informe
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center text-amber-600 py-10">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mb-4"></div>
                    <div>Cargando datos de asistencia...</div>
                </div>
            ) : view === 'dashboard' ? (
                <div className="space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-400 text-white shadow-md">
                            <div className="text-xs opacity-90">Estudiantes</div>
                            <div className="text-2xl font-bold">{dashboardData.estudiantesCount}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-tr from-cyan-500 to-cyan-400 text-white shadow-md">
                            <div className="text-xs opacity-90">Registros (mes)</div>
                            <div className="text-2xl font-bold">{periodRecordsCount}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-tr from-emerald-500 to-emerald-400 text-white shadow-md">
                            <div className="text-xs opacity-90">Promedio días con entrada</div>
                            <div className="text-2xl font-bold">{dashboardData.avgDiasConEntrada.toFixed(1)}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-md">
                            <div className="text-xs opacity-90">Desviaciones (mes)</div>
                            <div className="text-2xl font-bold">{dashboardData.totalDesviaciones}</div>
                        </div>
                    </div>

                    {/* Gráfico: Entradas por día */}
                    <div className="p-4 border rounded-xl bg-white dark:bg-slate-900">
                        <h3 className="font-bold mb-3">Entradas por día del mes</h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={dashboardData.dailyEntries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                                <defs>
                                    <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#22C55E" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#22C55E" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <ReTooltip />
                                <Area dataKey="entradas" name="Entradas" type="monotone" stroke="#22C55E" fill="url(#gradEntradas)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Gráfico: Registros por día de semana */}
                    <div className="p-4 border rounded-xl bg-white dark:bg-slate-900">
                        <h3 className="font-bold mb-3">Registros por día de semana</h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={dashboardData.weekdaySeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="nombre" tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <ReTooltip />
                                <Bar dataKey="registros" name="Entradas" fill="#6366F1" radius={[6, 6, 0, 0]} />
                                <Legend />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Top desviaciones */}
                    <div className="p-4 border rounded-xl bg-white dark:bg-slate-900">
                        <h3 className="font-bold mb-3">Top 5 con más desviaciones</h3>
                        {dashboardData.topDesviadores.length === 0 ? (
                            <div className="text-sm text-slate-500">Sin desviaciones registradas en el mes.</div>
                        ) : (
                            <ul className="divide-y">
                                {dashboardData.topDesviadores.map((t, idx) => (
                                    <li key={t.id} className="py-2 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">{idx + 1}</div>
                                            <span className="font-medium">{t.nombre}</span>
                                        </div>
                                        <span className="font-bold text-red-600">{t.count}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Promedio por curso (si Todos) */}
                    {selectedCurso === 'todos' && (
                        <div className="p-4 border rounded-xl bg-white dark:bg-slate-900">
                            <h3 className="font-bold mb-3">Promedio de días con entrada por curso</h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={dashboardData.porCurso} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="curso" tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <ReTooltip />
                                    <Bar dataKey="promedioDias" name="Prom. días con entrada" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="text-xs text-slate-500 mt-2">Entre 0 y {monthDays} días posibles</div>
                        </div>
                    )}
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
                                {/* Nuevas últimas columnas: Ingresos y Salidas */}
                                <th className="p-2 border-r border-b border-slate-200 dark:border-slate-600 text-xs w-20 text-center">
                                    Ingresos
                                </th>
                                <th className="p-2 border-r border-b border-slate-200 dark:border-slate-600 text-xs w-20 text-center">
                                    Salidas
                                </th>
                                <th className="p-2 border-r border-b border-slate-200 dark:border-slate-600 text-xs w-24 text-center" title={`Marcajes fuera de ${thresholdMeters} m de la empresa`}>
                                    Desv.
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleStudents.length > 0 ? (
                                visibleStudents.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="sticky left-0 bg-white dark:bg-slate-800 z-10 p-2 border-r border-b border-slate-200 dark:border-slate-600 text-sm font-medium whitespace-nowrap">
                                            {student.nombreCompleto}
                                        </td>
                                        {Array.from({ length: monthDays }, (_, i) => {
                                            const day = i + 1;
                                            const studentDayRecords = attendanceData.get(student.email)?.get(day);
                                            const dayDate = new Date(year, currentDate.getMonth(), i + 1);
                                            const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;

                                            // Log para Alexis Robles en el día 2
                                            if (student.email === 'alexis.robles@industrialderecoleta.cl' && day === 2) {
                                                console.log(`🔍 Verificando día 2 para Alexis:`, {
                                                    email: student.email,
                                                    day: day,
                                                    hasDataForStudent: attendanceData.has(student.email),
                                                    studentDayRecords: studentDayRecords,
                                                    allAttendanceKeys: Array.from(attendanceData.keys()),
                                                    daysForStudent: attendanceData.get(student.email) ? Array.from(attendanceData.get(student.email)!.keys()) : []
                                                });
                                            }

                                            return (
                                                <td 
                                                    key={day} 
                                                    className={`p-1 border-r border-b border-slate-200 dark:border-slate-600 text-center align-middle ${
                                                        isWeekend ? 'bg-slate-100 dark:bg-slate-700/50' : ''
                                                    }`}
                                                >
                                                    <div className="flex justify-center items-center gap-1.5 h-full">
                                                        {(() => {
                                                            if (!studentDayRecords?.entrada) return null;
                                                            const empresa = empresaPorEstudianteId.get(student.id);
                                                            const coords = empresa?.coordenadas;
                                                            let distE: number | null = null;
                                                            let isDevE = false;
                                                            if (coords && studentDayRecords.entrada.ubicacion?.latitud != null && studentDayRecords.entrada.ubicacion?.longitud != null) {
                                                                distE = haversineMeters(
                                                                    studentDayRecords.entrada.ubicacion.latitud,
                                                                    studentDayRecords.entrada.ubicacion.longitud,
                                                                    coords.lat,
                                                                    coords.lng
                                                                );
                                                                isDevE = distE > thresholdMeters;
                                                            }
                                                            return (
                                                                <div
                                                                    className={`group relative cursor-pointer ${isDevE ? 'ring-2 ring-red-400 rounded-full' : ''}`}
                                                                    onClick={() => handleLocationClick(studentDayRecords.entrada?.ubicacion)}
                                                                >
                                                                    <EntryIcon />
                                                                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                                        {new Date(studentDayRecords.entrada.fechaHora).toLocaleTimeString('es-CL', { 
                                                                            hour: '2-digit', 
                                                                            minute: '2-digit' 
                                                                        })}{distE != null ? ` • ${Math.round(distE)} m` : ''}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                        {(() => {
                                                            if (!studentDayRecords?.salida) return null;
                                                            const empresa = empresaPorEstudianteId.get(student.id);
                                                            const coords = empresa?.coordenadas;
                                                            let distS: number | null = null;
                                                            let isDevS = false;
                                                            if (coords && studentDayRecords.salida.ubicacion?.latitud != null && studentDayRecords.salida.ubicacion?.longitud != null) {
                                                                distS = haversineMeters(
                                                                    studentDayRecords.salida.ubicacion.latitud,
                                                                    studentDayRecords.salida.ubicacion.longitud,
                                                                    coords.lat,
                                                                    coords.lng
                                                                );
                                                                isDevS = distS > thresholdMeters;
                                                            }
                                                            return (
                                                                <div
                                                                    className={`group relative cursor-pointer ${isDevS ? 'ring-2 ring-red-400 rounded-full' : ''}`}
                                                                    onClick={() => handleLocationClick(studentDayRecords.salida?.ubicacion)}
                                                                >
                                                                    <ExitIcon />
                                                                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                                        {new Date(studentDayRecords.salida.fechaHora).toLocaleTimeString('es-CL', { 
                                                                            hour: '2-digit', 
                                                                            minute: '2-digit' 
                                                                        })}{distS != null ? ` • ${Math.round(distS)} m` : ''}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        {/* Celdas de totales separados */}
                                        <td className="p-1 border-r border-b border-slate-200 dark:border-slate-600 text-center align-middle font-semibold">
                                            {(() => {
                                                const mapDias = attendanceData.get(student.email);
                                                if (!mapDias) return 0;
                                                let totalIngresos = 0;
                                                for (let d = 1; d <= monthDays; d++) {
                                                    const rec = mapDias.get(d);
                                                    if (!rec) continue;
                                                    if (rec.entrada) totalIngresos += 1;
                                                }
                                                return totalIngresos;
                                            })()}
                                        </td>
                                        <td className="p-1 border-r border-b border-slate-200 dark:border-slate-600 text-center align-middle font-semibold">
                                            {(() => {
                                                const mapDias = attendanceData.get(student.email);
                                                if (!mapDias) return 0;
                                                let totalSalidas = 0;
                                                for (let d = 1; d <= monthDays; d++) {
                                                    const rec = mapDias.get(d);
                                                    if (!rec) continue;
                                                    if (rec.salida) totalSalidas += 1;
                                                }
                                                return totalSalidas;
                                            })()}
                                        </td>
                                        {/* Columna de desviación */}
                                        <td className="p-1 border-r border-b border-slate-200 dark:border-slate-600 text-center align-middle">
                                            {(() => {
                                                const summary = getDeviationSummary(student);
                                                if (!summary.hasData) return '—';
                                                if (summary.undetermined) return (
                                                    <span className="text-xs text-slate-500" title="Sin empresa asignada o sin coordenadas">N/D</span>
                                                );
                                                const label = summary.anyDeviation ? 'Sí' : 'No';
                                                const color = summary.anyDeviation ? 'text-red-600' : 'text-emerald-600';
                                                return (
                                                    <span
                                                        className={`text-sm font-semibold ${color}`}
                                                        title={`Eventos fuera de umbral: ${summary.count}\nDistancia máxima: ${Math.round(summary.max)} m`}
                                                    >
                                                        {label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={monthDays + 4} className="text-center p-8 text-slate-500">
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