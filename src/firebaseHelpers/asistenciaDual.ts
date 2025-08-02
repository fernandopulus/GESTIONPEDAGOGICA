import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    orderBy, 
    Timestamp,
    getDocs,
    limit,
    Unsubscribe 
} from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta según tu estructura
import { AsistenciaDual, User, Profile } from '../../types'; // Ajusta la ruta según tu estructura

/**
 * Función de debug para verificar la estructura de la colección de usuarios
 * @returns Promise con información de debug sobre usuarios
 */
export const debugUsersCollection = async () => {
    try {
        console.log('🔍 Debugging users collection...');
        const usersRef = collection(db, 'users');
        
        // Obtener una muestra de documentos
        const q = query(usersRef, limit(10));
        const snapshot = await getDocs(q);
        
        const result = {
            exists: true,
            totalDocs: snapshot.size,
            sampleDocs: [] as any[],
            fieldAnalysis: {} as Record<string, any>
        };
        
        const allFields = new Set<string>();
        
        snapshot.forEach((doc, index) => {
            const data = doc.data();
            const docInfo = {
                id: doc.id,
                data: data,
                fields: Object.keys(data)
            };
            
            result.sampleDocs.push(docInfo);
            
            // Analizar campos
            Object.keys(data).forEach(field => allFields.add(field));
        });
        
        // Análisis de campos comunes
        result.fieldAnalysis = {
            allFields: Array.from(allFields),
            commonFields: Array.from(allFields).filter(field => {
                const count = result.sampleDocs.filter(doc => field in doc.data).length;
                return count > result.sampleDocs.length * 0.5; // Más del 50% tiene este campo
            })
        };
        
        console.log('Users collection debug result:', result);
        return result;
        
    } catch (error) {
        console.error('Error debugging users collection:', error);
        return {
            exists: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

/**
 * Función de prueba simple para verificar acceso directo a asistencia_dual
 */
export const testDirectAccess = async () => {
    try {
        console.log('🧪 PRUEBA DIRECTA DE ACCESO A asistencia_dual');
        
        const asistenciaRef = collection(db, 'asistencia_dual');
        
        // Prueba 1: Acceso básico sin filtros
        console.log('📋 Prueba 1: Acceso básico...');
        const basicQuery = query(asistenciaRef, limit(5));
        const basicSnapshot = await getDocs(basicQuery);
        
        console.log(`✅ Documentos encontrados: ${basicSnapshot.size}`);
        
        if (basicSnapshot.size > 0) {
            basicSnapshot.docs.forEach((doc, index) => {
                console.log(`   ${index + 1}. ID: ${doc.id}`);
                console.log(`       Datos:`, doc.data());
            });
            
            // Prueba 2: Verificar estructura de fecha
            const firstDoc = basicSnapshot.docs[0].data();
            console.log('🔍 Análisis del primer documento:');
            console.log(`   fechaHora tipo: ${typeof firstDoc.fechaHora}`);
            console.log(`   fechaHora valor:`, firstDoc.fechaHora);
            
            if (firstDoc.fechaHora?.toDate) {
                console.log(`   fechaHora como Date:`, firstDoc.fechaHora.toDate());
            } else if (typeof firstDoc.fechaHora === 'string') {
                console.log(`   fechaHora parseada:`, new Date(firstDoc.fechaHora));
            }
            
            // Prueba 3: Consulta simple con filtro de email
            console.log('📋 Prueba 3: Filtro por email...');
            const emailQuery = query(
                asistenciaRef, 
                where('emailEstudiante', '==', firstDoc.emailEstudiante)
            );
            const emailSnapshot = await getDocs(emailQuery);
            console.log(`✅ Registros para ${firstDoc.emailEstudiante}: ${emailSnapshot.size}`);
            
            // Prueba 4: Intentar consulta con ordenamiento (donde puede fallar)
            try {
                console.log('📋 Prueba 4: Consulta con orderBy...');
                const orderQuery = query(asistenciaRef, orderBy('fechaHora', 'desc'), limit(3));
                const orderSnapshot = await getDocs(orderQuery);
                console.log(`✅ Con orderBy: ${orderSnapshot.size} documentos`);
            } catch (orderError) {
                console.error('❌ Error con orderBy:', orderError);
                console.log('💡 Esto indica que falta un índice en Firestore');
            }
            
        } else {
            console.log('❌ No se encontraron documentos en asistencia_dual');
            
            // Verificar permisos
            console.log('🔒 Verificando permisos...');
            try {
                await addDoc(asistenciaRef, { test: true });
                console.log('✅ Permisos de escritura: OK');
            } catch (permError) {
                console.error('❌ Error de permisos:', permError);
            }
        }
        
    } catch (error) {
        console.error('❌ Error en prueba directa:', error);
        
        if (error.code === 'permission-denied') {
            console.log('🔒 PROBLEMA: Las reglas de Firestore están bloqueando el acceso');
            console.log('💡 Solución: Revisar las reglas de seguridad en Firebase Console');
        } else if (error.code === 'failed-precondition') {
            console.log('📊 PROBLEMA: Faltan índices en Firestore');
            console.log('💡 Solución: Crear índices para las consultas en Firebase Console');
        } else {
            console.log('🔧 PROBLEMA: Error de configuración o conexión');
        }
    }
};

/**
 * Función de debug para verificar qué colecciones de asistencia existen y su estructura
 * @param year - Año a verificar
 * @param month - Mes a verificar (0-based)
 * @returns Promise con información de debug
 */
export const debugAsistenciaCollections = async (year: number, month: number) => {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const startTimestamp = Timestamp.fromDate(startOfMonth);
    const endTimestamp = Timestamp.fromDate(endOfMonth);

    const collections = ['asistenciaDual', 'asistenciaEmpresa', 'asistencia', 'attendance', 'checkins'];
    const results: any = {};

    for (const collectionName of collections) {
        try {
            const collectionRef = collection(db, collectionName);
            
            // Intentar consulta con fecha
            try {
                const qWithDate = query(
                    collectionRef,
                    where('fechaHora', '>=', startTimestamp),
                    where('fechaHora', '<=', endTimestamp)
                );
                const snapshotWithDate = await getDocs(qWithDate);
                results[collectionName] = {
                    exists: true,
                    hasDateField: true,
                    count: snapshotWithDate.size,
                    sampleDoc: snapshotWithDate.docs[0]?.data() || null
                };
            } catch (dateError) {
                // Si falla con fechaHora, intentar con otros campos de fecha
                const dateFields = ['fecha', 'timestamp', 'createdAt'];
                let foundDateField = false;
                
                for (const dateField of dateFields) {
                    try {
                        const qWithAltDate = query(
                            collectionRef,
                            where(dateField, '>=', startTimestamp),
                            where(dateField, '<=', endTimestamp)
                        );
                        const snapshotAltDate = await getDocs(qWithAltDate);
                        results[collectionName] = {
                            exists: true,
                            hasDateField: dateField,
                            count: snapshotAltDate.size,
                            sampleDoc: snapshotAltDate.docs[0]?.data() || null
                        };
                        foundDateField = true;
                        break;
                    } catch (altDateError) {
                        continue;
                    }
                }
                
                if (!foundDateField) {
                    // Solo obtener algunos documentos para ver la estructura
                    const simpleQuery = query(collectionRef, orderBy('__name__'), limit(5));
                    const simpleSnapshot = await getDocs(simpleQuery);
                    results[collectionName] = {
                        exists: true,
                        hasDateField: false,
                        count: simpleSnapshot.size,
                        sampleDoc: simpleSnapshot.docs[0]?.data() || null,
                        note: 'No date field found for filtering'
                    };
                }
            }
        } catch (error) {
            results[collectionName] = {
                exists: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    console.log('Debug Asistencia Collections:', results);
    return results;
};

/**
 * Función de búsqueda exhaustiva de registros de asistencia
 * Busca en TODAS las colecciones posibles, sin filtros de fecha inicialmente
 */
export const findAllAttendanceRecords = async () => {
    console.log('🔍 BÚSQUEDA EXHAUSTIVA DE REGISTROS DE ASISTENCIA');
    
    // Lista más amplia de posibles colecciones
    const allPossibleCollections = [
        'asistencia', 'asistenciaDual', 'asistenciaEmpresa', 'attendance', 'checkins',
        'registros', 'registro_asistencia', 'dual_attendance', 'student_attendance',
        'empresa_attendance', 'practicas', 'practicas_profesionales', 'dual_checkins'
    ];
    
    const results: any = {};
    
    for (const collectionName of allPossibleCollections) {
        try {
            console.log(`\n🔍 Analizando: ${collectionName}`);
            const collectionRef = collection(db, collectionName);
            
            // Obtener algunos documentos sin filtro
            const simpleQuery = query(collectionRef, limit(20));
            const snapshot = await getDocs(simpleQuery);
            
            if (snapshot.size > 0) {
                console.log(`✅ ${collectionName}: ${snapshot.size} documentos encontrados`);
                
                const docs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    data: doc.data()
                }));
                
                // Analizar estructura
                const firstDoc = docs[0].data;
                console.log(`📄 Estructura del primer documento:`, firstDoc);
                
                // Buscar campos relacionados con estudiantes
                const possibleEmailFields = ['email', 'emailEstudiante', 'userEmail', 'student_email', 'correo'];
                const possibleDateFields = ['fechaHora', 'fecha', 'timestamp', 'createdAt', 'date', 'time'];
                const possibleTypeFields = ['tipo', 'type', 'action', 'tipoRegistro', 'event_type'];
                
                const emailField = possibleEmailFields.find(field => firstDoc.hasOwnProperty(field));
                const dateField = possibleDateFields.find(field => firstDoc.hasOwnProperty(field));
                const typeField = possibleTypeFields.find(field => firstDoc.hasOwnProperty(field));
                
                console.log(`📧 Campo de email: ${emailField} = ${firstDoc[emailField || '']}`);
                console.log(`📅 Campo de fecha: ${dateField} = ${firstDoc[dateField || '']}`);
                console.log(`📝 Campo de tipo: ${typeField} = ${firstDoc[typeField || '']}`);
                
                // Buscar patrones de estudiantes
                const studentEmails = docs
                    .map(doc => emailField ? doc.data[emailField] : null)
                    .filter(Boolean)
                    .filter(email => typeof email === 'string' && email.includes('@'));
                
                console.log(`👥 Emails de estudiantes encontrados:`, [...new Set(studentEmails)]);
                
                results[collectionName] = {
                    exists: true,
                    count: snapshot.size,
                    emailField,
                    dateField,
                    typeField,
                    sampleDoc: firstDoc,
                    studentEmails: [...new Set(studentEmails)],
                    allDocs: docs
                };
            } else {
                console.log(`⚪ ${collectionName}: vacía`);
                results[collectionName] = { exists: true, count: 0 };
            }
        } catch (error) {
            console.log(`❌ ${collectionName}: no existe o error`);
            results[collectionName] = { exists: false, error: error instanceof Error ? error.message : 'Error' };
        }
    }
    
    console.log('\n📊 RESUMEN COMPLETO:', results);
    
    // Identificar la colección más probable
    const validCollections = Object.entries(results)
        .filter(([_, info]: [string, any]) => info.exists && info.count > 0 && info.studentEmails?.length > 0)
        .sort(([_, a], [__, b]) => (b as any).count - (a as any).count);
    
    if (validCollections.length > 0) {
        const [bestCollection, bestInfo] = validCollections[0];
        console.log(`\n🎯 MEJOR CANDIDATO: ${bestCollection} con ${(bestInfo as any).count} registros`);
        console.log(`📧 Campo email: ${(bestInfo as any).emailField}`);
        console.log(`📅 Campo fecha: ${(bestInfo as any).dateField}`);
        console.log(`📝 Campo tipo: ${(bestInfo as any).typeField}`);
    }
    
    return results;
};

/**
 * Suscribe a los registros de asistencia dual para un mes específico
 * Versión mejorada que usa los resultados de la búsqueda exhaustiva
 */
export const subscribeToAsistenciaByMonth = (
    year: number,
    month: number,
    onData: (registros: AsistenciaDual[]) => void,
    onError?: (error: Error) => void
): Unsubscribe => {
    try {
        // Crear fechas con margen más amplio para capturar registros
        const startOfMonth = new Date(year, month, 1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const endOfMonth = new Date(year, month + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        console.log(`🔍 Buscando registros entre: ${startOfMonth.toISOString()} y ${endOfMonth.toISOString()}`);
        console.log(`📅 Mes actual: ${year}-${(month + 1).toString().padStart(2, '0')}`);

        // Convertir a Timestamp de Firestore
        const startTimestamp = Timestamp.fromDate(startOfMonth);
        const endTimestamp = Timestamp.fromDate(endOfMonth);

        const unsubscribers: Unsubscribe[] = [];
        const allRegistros = new Map<string, AsistenciaDual>();

        const updateData = () => {
            const registrosArray = Array.from(allRegistros.values());
            console.log(`📊 Total registros encontrados: ${registrosArray.length}`);
            
            if (registrosArray.length > 0) {
                console.log(`📅 Registros por día:`, registrosArray.reduce((acc, r) => {
                    let fecha: Date;
                    if (r.fechaHora instanceof Date) {
                        fecha = r.fechaHora;
                    } else if (typeof r.fechaHora === 'string') {
                        fecha = new Date(r.fechaHora);
                    } else {
                        // Si llegamos aquí, probablemente es un timestamp sin convertir
                        fecha = new Date();
                    }
                    
                    const day = fecha.getDate();
                    acc[day] = (acc[day] || 0) + 1;
                    return acc;
                }, {} as Record<number, number>));
            }
            
            onData(registrosArray);
        };

        // Lista de colecciones a revisar - INCLUYENDO las que usa asistenciaEmpresaHelper
        const collections = [
            'asistencia_dual',      // con guión bajo
            'asistenciaEmpresa',    // ← PROBABLEMENTE ESTA ES LA CORRECTA
            'asistencia_empresa',   // con guión bajo también
            'asistenciaDual',       // camelCase
            'asistencia'            // básica
        ];

        collections.forEach((collectionName) => {
            try {
                console.log(`🔍 Configurando suscripción para: ${collectionName}`);
                const asistenciaRef = collection(db, collectionName);
                
                // Estrategia 1: Con filtro de fecha
                const qWithFilter = query(
                    asistenciaRef,
                    where('fechaHora', '>=', startTimestamp),
                    where('fechaHora', '<=', endTimestamp),
                    orderBy('fechaHora', 'desc')
                );

                const unsubscribe = onSnapshot(
                    qWithFilter,
                    (querySnapshot) => {
                        console.log(`📋 ${collectionName}: ${querySnapshot.size} documentos encontrados con filtro`);
                        
                        if (querySnapshot.size > 0) {
                            console.log(`✅ Registros encontrados en ${collectionName}:`);
                            
                            // Limpiar registros anteriores SOLO de esta colección
                            const keysToDelete = Array.from(allRegistros.keys()).filter(key => key.startsWith(`${collectionName}_`));
                            keysToDelete.forEach(key => allRegistros.delete(key));

                            querySnapshot.docs.forEach((doc, index) => {
                                if (index < 5) {
                                    const data = doc.data();
                                    let fecha;
                                    if (data.fechaHora?.toDate) {
                                        fecha = data.fechaHora.toDate();
                                    } else if (typeof data.fechaHora === 'string') {
                                        fecha = new Date(data.fechaHora);
                                    } else {
                                        fecha = new Date();
                                    }
                                    console.log(`   ${index + 1}. ${data.emailEstudiante} - ${fecha.toLocaleString()} - ${data.tipo}`);
                                    console.log(`      📅 Fecha original: ${data.fechaHora} (tipo: ${typeof data.fechaHora})`);
                                }
                            });

                            querySnapshot.forEach((doc) => {
                                const data = doc.data();
                                
                                // Procesar fecha con manejo flexible para diferentes formatos
                                let fechaHora: Date;
                                if (data.fechaHora?.toDate) {
                                    // Firestore Timestamp
                                    fechaHora = data.fechaHora.toDate();
                                } else if (typeof data.fechaHora === 'string') {
                                    // ISO string (como viene del asistenciaEmpresaHelper)
                                    fechaHora = new Date(data.fechaHora);
                                } else if (data.fechaHora instanceof Date) {
                                    // Ya es un Date object
                                    fechaHora = data.fechaHora;
                                } else if (data.fechaHora) {
                                    // Cualquier otro formato
                                    fechaHora = new Date(data.fechaHora);
                                } else {
                                    fechaHora = new Date();
                                }

                                const registro: AsistenciaDual = {
                                    id: doc.id,
                                    emailEstudiante: data.emailEstudiante || data.email || '',
                                    nombreEstudiante: data.nombreEstudiante || data.nombre || '',
                                    curso: data.curso || '',
                                    fechaHora,
                                    tipo: data.tipo as 'Entrada' | 'Salida',
                                    ubicacion: data.ubicacion || null,
                                    observaciones: data.observaciones || '',
                                    ...data
                                };
                                
                                const uniqueKey = `${collectionName}_${doc.id}`;
                                allRegistros.set(uniqueKey, registro);
                            });

                            updateData();
                        } else {
                            // NO borrar datos si esta colección está vacía
                            console.log(`⚪ ${collectionName}: vacía, manteniendo datos existentes`);
                        }
                    },
                    (error) => {
                        console.warn(`⚠️ Error con filtro en ${collectionName}:`, error);
                        
                        // Estrategia 2: Sin filtro, obtener documentos recientes y filtrar manualmente
                        console.log(`🔄 Intentando estrategia alternativa en ${collectionName}...`);
                        
                        const qNoFilter = query(asistenciaRef, limit(200)); // Más documentos
                        
                        const unsubNoFilter = onSnapshot(qNoFilter, (snapshot) => {
                            console.log(`📋 ${collectionName} (sin filtro): ${snapshot.size} documentos`);
                            
                            if (snapshot.size > 0) {
                                // Mostrar estructura del primer documento
                                const firstDoc = snapshot.docs[0].data();
                                console.log(`📄 Estructura en ${collectionName}:`, Object.keys(firstDoc));
                                console.log(`📄 Primer documento:`, firstDoc);
                            }
                            
                            const filteredDocs = snapshot.docs.filter(doc => {
                                const data = doc.data();
                                if (!data.fechaHora) return false;
                                
                                let fecha: Date;
                                if (data.fechaHora?.toDate) {
                                    // Firestore Timestamp
                                    fecha = data.fechaHora.toDate();
                                } else if (typeof data.fechaHora === 'string') {
                                    // ISO string
                                    fecha = new Date(data.fechaHora);
                                } else if (data.fechaHora instanceof Date) {
                                    // Ya es Date
                                    fecha = data.fechaHora;
                                } else {
                                    fecha = new Date(data.fechaHora);
                                }
                                
                                return fecha >= startOfMonth && fecha <= endOfMonth;
                            });
                            
                            console.log(`📅 ${collectionName}: ${filteredDocs.length} registros después de filtro manual`);
                            
                            if (filteredDocs.length > 0) {
                                // Limpiar y agregar registros filtrados
                                const keysToDelete = Array.from(allRegistros.keys()).filter(key => key.startsWith(`${collectionName}_`));
                                keysToDelete.forEach(key => allRegistros.delete(key));
                                
                                filteredDocs.forEach(doc => {
                                    const data = doc.data();
                                    let fechaHora: Date;
                                    if (data.fechaHora?.toDate) {
                                        // Firestore Timestamp
                                        fechaHora = data.fechaHora.toDate();
                                    } else if (typeof data.fechaHora === 'string') {
                                        // ISO string
                                        fechaHora = new Date(data.fechaHora);
                                    } else if (data.fechaHora instanceof Date) {
                                        // Ya es Date
                                        fechaHora = data.fechaHora;
                                    } else {
                                        fechaHora = new Date(data.fechaHora);
                                    }
                                    
                                    const registro: AsistenciaDual = {
                                        id: doc.id,
                                        emailEstudiante: data.emailEstudiante || data.email || '',
                                        nombreEstudiante: data.nombreEstudiante || data.nombre || '',
                                        curso: data.curso || '',
                                        fechaHora,
                                        tipo: data.tipo as 'Entrada' | 'Salida',
                                        ubicacion: data.ubicacion || null,
                                        observaciones: data.observaciones || '',
                                        ...data
                                    };
                                    
                                    const uniqueKey = `${collectionName}_${doc.id}`;
                                    allRegistros.set(uniqueKey, registro);
                                });
                                
                                updateData();
                            }
                        });
                        
                        // Reemplazar el unsubscribe original
                        const originalIndex = unsubscribers.findIndex(u => u === unsubscribe);
                        if (originalIndex >= 0) {
                            unsubscribers[originalIndex] = unsubNoFilter;
                        } else {
                            unsubscribers.push(unsubNoFilter);
                        }
                    }
                );

                unsubscribers.push(unsubscribe);
            } catch (collectionError) {
                console.warn(`❌ Error configurando ${collectionName}:`, collectionError);
            }
        });

        // Retornar función que cancela todas las suscripciones
        return () => {
            unsubscribers.forEach(unsub => {
                try {
                    unsub();
                } catch (error) {
                    console.warn('Error unsubscribing:', error);
                }
            });
        };

    } catch (error) {
        console.error('Error setting up subscribeToAsistenciaByMonth:', error);
        if (onError) {
            onError(new Error(`Error al configurar suscripción: ${error instanceof Error ? error.message : 'Error desconocido'}`));
        }
        
        return () => {};
    }
};

/**
 * Busca usuarios en múltiples colecciones posibles
 * @param onData - Callback que recibe los datos de usuarios
 * @param onError - Callback que recibe errores
 * @returns Función para cancelar la suscripción
 */
export const subscribeToAllUsersMultiCollection = (
    onData: (users: User[]) => void,
    onError?: (error: Error) => void
): Unsubscribe => {
    try {
        console.log('🔍 Buscando usuarios en múltiples colecciones...');
        
        // Solo buscar en 'usuarios' ya que sabemos que está ahí
        const possibleCollections = ['usuarios', 'users'];
        const unsubscribers: Unsubscribe[] = [];
        const allUsers = new Map<string, User>();

        const updateData = () => {
            const usersArray = Array.from(allUsers.values());
            console.log(`📊 Total usuarios encontrados: ${usersArray.length}`);
            
            // Mostrar estadísticas por perfil
            const byProfile = usersArray.reduce((acc, user) => {
                acc[user.profile] = (acc[user.profile] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            console.log('👥 Usuarios por perfil:', byProfile);
            
            const estudiantes = usersArray.filter(u => u.profile === Profile.ESTUDIANTE);
            console.log(`🎓 Estudiantes encontrados: ${estudiantes.length}`);
            estudiantes.forEach(est => {
                console.log(`   - ${est.nombreCompleto} (${est.curso}) - ${est.email}`);
            });
            
            onData(usersArray);
        };

        let foundActiveCollection = false;

        possibleCollections.forEach((collectionName) => {
            try {
                const usersRef = collection(db, collectionName);
                const q = query(usersRef); // SIN LÍMITE para cargar todos los usuarios

                const unsubscribe = onSnapshot(
                    q,
                    (querySnapshot) => {
                        if (querySnapshot.size > 0) {
                            console.log(`✅ Encontrados ${querySnapshot.size} usuarios en colección: ${collectionName}`);
                            foundActiveCollection = true;
                            
                            // Limpiar usuarios anteriores de esta colección
                            const keysToDelete = Array.from(allUsers.keys()).filter(key => key.startsWith(`${collectionName}_`));
                            keysToDelete.forEach(key => allUsers.delete(key));

                            querySnapshot.forEach((doc) => {
                                try {
                                    const data = doc.data();
                                    
                                    // Manejo flexible de campos
                                    const email = data.email || data.userEmail || data.mail || data.correo || '';
                                    const nombreCompleto = data.nombreCompleto || data.displayName || data.name || data.nombre || data.fullName || '';
                                    const curso = data.curso || data.course || data.class || data.grade || '';
                                    
                                    // Manejo flexible del perfil
                                    let profile = data.profile || data.role || data.tipo || data.userType || Profile.ESTUDIANTE;
                                    
                                    // Normalizar valores de perfil
                                    if (typeof profile === 'string') {
                                        const profileLower = profile.toLowerCase();
                                        if (profileLower.includes('estudiante') || profileLower.includes('student') || profileLower.includes('alumno')) {
                                            profile = Profile.ESTUDIANTE;
                                        } else if (profileLower.includes('coordinador') || profileLower.includes('coordinator')) {
                                            profile = Profile.COORDINADOR_TP;
                                        } else if (profileLower.includes('profesor') || profileLower.includes('teacher') || profileLower.includes('docente')) {
                                            profile = Profile.PROFESOR;
                                        } else if (profileLower.includes('subdireccion') || profileLower.includes('subdir')) {
                                            profile = Profile.COORDINADOR_TP;
                                        }
                                    }

                                    const user: User = {
                                        id: doc.id,
                                        email,
                                        nombreCompleto,
                                        curso,
                                        profile,
                                        activo: data.activo !== false,
                                        fechaCreacion: data.fechaCreacion?.toDate?.() || new Date(data.fechaCreacion) || new Date(),
                                        ultimaActividad: data.ultimaActividad?.toDate?.() || new Date(data.ultimaActividad) || new Date(),
                                        ...data
                                    };
                                    
                                    // Usar un ID único que incluya la colección
                                    const uniqueKey = `${collectionName}_${doc.id}`;
                                    allUsers.set(uniqueKey, user);
                                } catch (docError) {
                                    console.warn(`Error procesando documento ${doc.id} en ${collectionName}:`, docError);
                                }
                            });

                            updateData();
                        } else {
                            console.log(`⚪ Colección ${collectionName}: vacía`);
                        }
                    },
                    (error) => {
                        console.warn(`⚠️ Error en colección ${collectionName}:`, error);
                        // No llamar onError aquí, porque otras colecciones pueden funcionar
                    }
                );

                unsubscribers.push(unsubscribe);
            } catch (collectionError) {
                console.warn(`❌ Error configurando ${collectionName}:`, collectionError);
            }
        });

        // Verificar después de un tiempo si se encontró alguna colección activa
        setTimeout(() => {
            if (!foundActiveCollection) {
                console.error('❌ No se encontraron usuarios en ninguna colección');
                if (onError) {
                    onError(new Error('No se encontraron colecciones de usuarios con datos'));
                }
            }
        }, 3000);

        // Retornar función que cancela todas las suscripciones
        return () => {
            unsubscribers.forEach(unsub => {
                try {
                    unsub();
                } catch (error) {
                    console.warn('Error unsubscribing:', error);
                }
            });
        };

    } catch (error) {
        console.error('Error setting up multi-collection users subscription:', error);
        if (onError) {
            onError(new Error(`Error al configurar suscripción multi-colección: ${error instanceof Error ? error.message : 'Error desconocido'}`));
        }
        
        return () => {};
    }
};

/**
 * Suscribe a todos los usuarios (especialmente estudiantes)
 * @param onData - Callback que recibe los datos de usuarios
 * @param onError - Callback que recibe errores
 * @returns Función para cancelar la suscripción
 */
export const subscribeToAllUsers = (
    onData: (users: User[]) => void,
    onError?: (error: Error) => void
): Unsubscribe => {
    try {
        console.log('Setting up users subscription...');
        const usersRef = collection(db, 'users');
        
        // Consulta simple primero, sin orderBy en caso de que no haya índice
        const q = query(usersRef);

        const unsubscribe = onSnapshot(
            q,
            (querySnapshot) => {
                console.log(`Raw users snapshot size: ${querySnapshot.size}`);
                const users: User[] = [];
                
                querySnapshot.forEach((doc) => {
                    try {
                        const data = doc.data();
                        console.log(`Processing user doc ${doc.id}:`, data);
                        
                        // Manejo flexible de campos
                        const email = data.email || data.userEmail || data.mail || '';
                        const nombreCompleto = data.nombreCompleto || data.displayName || data.name || data.nombre || '';
                        const curso = data.curso || data.course || data.class || '';
                        
                        // Manejo flexible del perfil
                        let profile = data.profile || data.role || data.tipo || Profile.ESTUDIANTE;
                        
                        // Normalizar valores de perfil
                        if (typeof profile === 'string') {
                            const profileLower = profile.toLowerCase();
                            if (profileLower.includes('estudiante') || profileLower.includes('student') || profileLower.includes('alumno')) {
                                profile = Profile.ESTUDIANTE;
                            } else if (profileLower.includes('coordinador') || profileLower.includes('coordinator')) {
                                profile = Profile.COORDINADOR_TP;
                            } else if (profileLower.includes('profesor') || profileLower.includes('teacher') || profileLower.includes('docente')) {
                                profile = Profile.PROFESOR;
                            } else if (profileLower.includes('subdireccion') || profileLower.includes('subdir')) {
                                profile = Profile.COORDINADOR_TP; // Tratar subdirección como coordinador para esta vista
                            }
                        }

                        const user: User = {
                            id: doc.id,
                            email,
                            nombreCompleto,
                            curso,
                            profile,
                            activo: data.activo !== false, // Por defecto true si no está definido
                            fechaCreacion: data.fechaCreacion?.toDate?.() || new Date(data.fechaCreacion) || new Date(),
                            ultimaActividad: data.ultimaActividad?.toDate?.() || new Date(data.ultimaActividad) || new Date(),
                            ...data
                        };
                        
                        users.push(user);
                    } catch (docError) {
                        console.warn(`Error processing user document ${doc.id}:`, docError);
                    }
                });

                // Ordenar manualmente en lugar de usar orderBy en la consulta
                users.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

                console.log(`Processed ${users.length} users successfully`);
                
                // Mostrar estadísticas
                const byProfile = users.reduce((acc, user) => {
                    acc[user.profile] = (acc[user.profile] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);
                console.log('Users by profile:', byProfile);
                
                const estudiantes = users.filter(u => u.profile === Profile.ESTUDIANTE);
                console.log(`Estudiantes: ${estudiantes.length}`);
                
                const estudiantesConCurso = estudiantes.filter(u => u.curso);
                console.log(`Estudiantes con curso: ${estudiantesConCurso.length}`);

                onData(users);
            },
            (error) => {
                console.error('Error in subscribeToAllUsers:', error);
                if (onError) {
                    onError(new Error(`Error al cargar usuarios: ${error.message}`));
                }
            }
        );

        return unsubscribe;
    } catch (error) {
        console.error('Error setting up subscribeToAllUsers:', error);
        if (onError) {
            onError(new Error(`Error al configurar suscripción de usuarios: ${error instanceof Error ? error.message : 'Error desconocido'}`));
        }
        
        // Retornar una función vacía como fallback
        return () => {};
    }
};

/**
 * Obtiene usuarios por perfil específico (una sola vez, no suscripción)
 * @param profile - Perfil a filtrar
 * @returns Promise con los usuarios
 */
export const getUsersByProfile = async (profile: Profile): Promise<User[]> => {
    try {
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef, 
            where('profile', '==', profile),
            orderBy('nombreCompleto', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        const users: User[] = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const user: User = {
                id: doc.id,
                email: data.email || '',
                nombreCompleto: data.nombreCompleto || '',
                curso: data.curso || '',
                profile: data.profile || Profile.ESTUDIANTE,
                activo: data.activo !== false,
                fechaCreacion: data.fechaCreacion?.toDate?.() || new Date(data.fechaCreacion) || new Date(),
                ultimaActividad: data.ultimaActividad?.toDate?.() || new Date(data.ultimaActividad) || new Date(),
                ...data
            };
            users.push(user);
        });
        
        return users;
    } catch (error) {
        console.error('Error in getUsersByProfile:', error);
        throw new Error(`Error al obtener usuarios por perfil: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
};

/**
 * Obtiene registros de asistencia para un rango de fechas específico
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de fin
 * @returns Promise con los registros de asistencia
 */
export const getAsistenciaByDateRange = async (
    startDate: Date,
    endDate: Date
): Promise<AsistenciaDual[]> => {
    try {
        const asistenciaRef = collection(db, 'asistenciaDual');
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);
        
        const q = query(
            asistenciaRef,
            where('fechaHora', '>=', startTimestamp),
            where('fechaHora', '<=', endTimestamp),
            orderBy('fechaHora', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const registros: AsistenciaDual[] = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const fechaHora = data.fechaHora?.toDate?.() || new Date(data.fechaHora);
            
            const registro: AsistenciaDual = {
                id: doc.id,
                emailEstudiante: data.emailEstudiante || '',
                nombreEstudiante: data.nombreEstudiante || '',
                curso: data.curso || '',
                fechaHora: fechaHora,
                tipo: data.tipo || 'Entrada',
                ubicacion: data.ubicacion || null,
                observaciones: data.observaciones || '',
                ...data
            };
            
            registros.push(registro);
        });
        
        return registros;
    } catch (error) {
        console.error('Error in getAsistenciaByDateRange:', error);
        throw new Error(`Error al obtener asistencia por rango de fechas: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
};

/**
 * Suscribe a estudiantes de cursos duales solamente
 * @param onData - Callback que recibe los estudiantes duales
 * @param onError - Callback que recibe errores
 * @returns Función para cancelar la suscripción
 */
export const subscribeToDualStudents = (
    onData: (students: User[]) => void,
    onError?: (error: Error) => void
): Unsubscribe => {
    try {
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('profile', '==', Profile.ESTUDIANTE),
            orderBy('nombreCompleto', 'asc')
        );

        const unsubscribe = onSnapshot(
            q,
            (querySnapshot) => {
                const students: User[] = [];
                
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    
                    // Solo incluir estudiantes con cursos duales
                    if (data.curso) {
                        const user: User = {
                            id: doc.id,
                            email: data.email || '',
                            nombreCompleto: data.nombreCompleto || '',
                            curso: data.curso || '',
                            profile: data.profile || Profile.ESTUDIANTE,
                            activo: data.activo !== false,
                            fechaCreacion: data.fechaCreacion?.toDate?.() || new Date(data.fechaCreacion) || new Date(),
                            ultimaActividad: data.ultimaActividad?.toDate?.() || new Date(data.ultimaActividad) || new Date(),
                            ...data
                        };
                        
                        students.push(user);
                    }
                });

                console.log(`Loaded ${students.length} dual students`);
                onData(students);
            },
            (error) => {
                console.error('Error in subscribeToDualStudents:', error);
                if (onError) {
                    onError(new Error(`Error al cargar estudiantes duales: ${error.message}`));
                }
            }
        );

        return unsubscribe;
    } catch (error) {
        console.error('Error setting up subscribeToDualStudents:', error);
        if (onError) {
            onError(new Error(`Error al configurar suscripción de estudiantes duales: ${error instanceof Error ? error.message : 'Error desconocido'}`));
        }
        
        return () => {};
    }
};