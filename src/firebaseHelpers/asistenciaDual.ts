import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    orderBy, 
    Timestamp,
    getDocs,
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
 * Suscribe a los registros de asistencia dual para un mes específico
 * Busca en múltiples colecciones posibles: 'asistenciaDual', 'asistenciaEmpresa', 'asistencia'
 * @param year - Año
 * @param month - Mes (0-based, enero = 0)
 * @param onData - Callback que recibe los datos
 * @param onError - Callback que recibe errores
 * @returns Función para cancelar la suscripción
 */
export const subscribeToAsistenciaByMonth = (
    year: number,
    month: number,
    onData: (registros: AsistenciaDual[]) => void,
    onError?: (error: Error) => void
): Unsubscribe => {
    try {
        // Crear fechas de inicio y fin del mes
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

        // Convertir a Timestamp de Firestore
        const startTimestamp = Timestamp.fromDate(startOfMonth);
        const endTimestamp = Timestamp.fromDate(endOfMonth);

        // Colecciones posibles donde pueden estar los registros
        const collections = ['asistenciaDual', 'asistenciaEmpresa', 'asistencia'];
        const unsubscribers: Unsubscribe[] = [];
        const allRegistros = new Map<string, AsistenciaDual>();

        const updateData = () => {
            const registrosArray = Array.from(allRegistros.values());
            console.log(`Total registros encontrados: ${registrosArray.length}`);
            onData(registrosArray);
        };

        collections.forEach((collectionName) => {
            try {
                const asistenciaRef = collection(db, collectionName);
                const q = query(
                    asistenciaRef,
                    where('fechaHora', '>=', startTimestamp),
                    where('fechaHora', '<=', endTimestamp),
                    orderBy('fechaHora', 'desc')
                );

                const unsubscribe = onSnapshot(
                    q,
                    (querySnapshot) => {
                        console.log(`Loading from collection: ${collectionName}, docs: ${querySnapshot.size}`);
                        
                        // Limpiar registros anteriores de esta colección
                        const keysToDelete = Array.from(allRegistros.keys()).filter(key => key.startsWith(`${collectionName}_`));
                        keysToDelete.forEach(key => allRegistros.delete(key));

                        querySnapshot.forEach((doc) => {
                            const data = doc.data();
                            
                            // Manejo flexible de campos de fecha
                            let fechaHora: Date;
                            if (data.fechaHora) {
                                fechaHora = data.fechaHora?.toDate?.() || new Date(data.fechaHora);
                            } else if (data.fecha) {
                                fechaHora = data.fecha?.toDate?.() || new Date(data.fecha);
                            } else if (data.timestamp) {
                                fechaHora = data.timestamp?.toDate?.() || new Date(data.timestamp);
                            } else {
                                fechaHora = new Date();
                            }

                            // Manejo flexible de campos de email/estudiante
                            const emailEstudiante = data.emailEstudiante || data.email || data.userEmail || '';
                            const nombreEstudiante = data.nombreEstudiante || data.nombre || data.displayName || data.nombreCompleto || '';
                            
                            // Manejo flexible del tipo de registro
                            let tipo = data.tipo || data.type || 'Entrada';
                            if (data.action) {
                                tipo = data.action === 'checkin' ? 'Entrada' : 'Salida';
                            } else if (data.tipoRegistro) {
                                tipo = data.tipoRegistro;
                            }

                            const registro: AsistenciaDual = {
                                id: doc.id,
                                emailEstudiante,
                                nombreEstudiante,
                                curso: data.curso || data.course || '',
                                fechaHora,
                                tipo: tipo as 'Entrada' | 'Salida',
                                ubicacion: data.ubicacion || data.location || data.coordinates || null,
                                observaciones: data.observaciones || data.notes || data.comentarios || '',
                                // Incluir todos los campos adicionales
                                ...data
                            };
                            
                            // Usar un ID único que incluya la colección
                            const uniqueKey = `${collectionName}_${doc.id}`;
                            allRegistros.set(uniqueKey, registro);
                        });

                        updateData();
                    },
                    (error) => {
                        console.warn(`Error in collection ${collectionName}:`, error);
                        // No llamar onError aquí, ya que otras colecciones pueden funcionar
                    }
                );

                unsubscribers.push(unsubscribe);
            } catch (collectionError) {
                console.warn(`Error setting up subscription for ${collectionName}:`, collectionError);
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
        
        // Retornar una función vacía como fallback
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
        
        // Colecciones posibles donde pueden estar los usuarios
        const possibleCollections = ['users', 'usuarios', 'estudiantes', 'profiles', 'accounts', 'members'];
        const unsubscribers: Unsubscribe[] = [];
        const allUsers = new Map<string, User>();

        const updateData = () => {
            const usersArray = Array.from(allUsers.values());
            console.log(`📊 Total usuarios encontrados: ${usersArray.length}`);
            onData(usersArray);
        };

        let foundActiveCollection = false;

        possibleCollections.forEach((collectionName) => {
            try {
                const usersRef = collection(db, collectionName);
                const q = query(usersRef);

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
                                    console.log(`Procesando usuario de ${collectionName}:`, doc.id, data);
                                    
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
        }, 2000);

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