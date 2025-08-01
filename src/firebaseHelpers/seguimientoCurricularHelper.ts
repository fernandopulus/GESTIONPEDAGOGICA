import { collection, query, onSnapshot, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { PlanificacionDocente } from '../../types';

/**
 * Suscribirse a todas las planificaciones (para SUBDIRECCION)
 */
export const subscribeToAllPlanificaciones = (
  callback: (planificaciones: PlanificacionDocente[]) => void
): (() => void) => {
  console.log('🔄 Iniciando suscripción a todas las planificaciones...');
  
  try {
    const planificacionesRef = collection(db, 'planificaciones');
    const q = query(planificacionesRef, orderBy('fechaCreacion', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const planificacionesData: PlanificacionDocente[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        planificacionesData.push({
          id: doc.id,
          ...data
        } as PlanificacionDocente);
      });

      console.log('✅ Todas las planificaciones cargadas:', planificacionesData.length);
      callback(planificacionesData);
    }, (error) => {
      console.error('❌ Error al cargar todas las planificaciones:', error);
      throw error;
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error al configurar suscripción a todas las planificaciones:', error);
    throw error;
  }
};

/**
 * Suscribirse solo a las planificaciones del usuario actual
 */
export const subscribeToUserPlanificaciones = (
  userId: string,
  callback: (planificaciones: PlanificacionDocente[]) => void
): (() => void) => {
  console.log('🔄 Iniciando suscripción a planificaciones del usuario:', userId);
  
  if (!userId) {
    console.error('❌ userId no proporcionado');
    throw new Error('userId es requerido');
  }

  try {
    const planificacionesRef = collection(db, 'planificaciones');
    const q = query(
      planificacionesRef, 
      where('userId', '==', userId),
      orderBy('fechaCreacion', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const planificacionesData: PlanificacionDocente[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        planificacionesData.push({
          id: doc.id,
          ...data
        } as PlanificacionDocente);
      });

      console.log('✅ Planificaciones del usuario cargadas:', planificacionesData.length);
      callback(planificacionesData);
    }, (error) => {
      console.error('❌ Error al cargar planificaciones del usuario:', error);
      throw error;
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error al configurar suscripción a planificaciones del usuario:', error);
    throw error;
  }
};

/**
 * Obtener planificaciones por nivel (consulta única)
 */
export const getPlanificacionesByNivel = async (
  nivel: string,
  userId?: string
): Promise<PlanificacionDocente[]> => {
  console.log('🔄 Obteniendo planificaciones por nivel:', nivel);
  
  try {
    const planificacionesRef = collection(db, 'planificaciones');
    
    let q;
    if (userId) {
      // Filtrar por usuario específico
      q = query(
        planificacionesRef,
        where('nivel', '==', nivel),
        where('userId', '==', userId),
        orderBy('fechaCreacion', 'desc')
      );
    } else {
      // Obtener todas las planificaciones del nivel
      q = query(
        planificacionesRef,
        where('nivel', '==', nivel),
        orderBy('fechaCreacion', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    const planificacionesData: PlanificacionDocente[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      planificacionesData.push({
        id: doc.id,
        ...data
      } as PlanificacionDocente);
    });

    console.log('✅ Planificaciones por nivel obtenidas:', planificacionesData.length);
    return planificacionesData;
  } catch (error) {
    console.error('❌ Error al obtener planificaciones por nivel:', error);
    throw error;
  }
};

/**
 * Obtener planificaciones por asignatura y nivel
 */
export const getPlanificacionesByAsignaturaAndNivel = async (
  asignatura: string,
  nivel: string,
  userId?: string
): Promise<PlanificacionDocente[]> => {
  console.log('🔄 Obteniendo planificaciones por asignatura y nivel:', { asignatura, nivel });
  
  try {
    const planificacionesRef = collection(db, 'planificaciones');
    
    let q;
    if (userId) {
      q = query(
        planificacionesRef,
        where('asignatura', '==', asignatura),
        where('nivel', '==', nivel),
        where('userId', '==', userId),
        orderBy('fechaCreacion', 'desc')
      );
    } else {
      q = query(
        planificacionesRef,
        where('asignatura', '==', asignatura),
        where('nivel', '==', nivel),
        orderBy('fechaCreacion', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    const planificacionesData: PlanificacionDocente[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      planificacionesData.push({
        id: doc.id,
        ...data
      } as PlanificacionDocente);
    });

    console.log('✅ Planificaciones por asignatura y nivel obtenidas:', planificacionesData.length);
    return planificacionesData;
  } catch (error) {
    console.error('❌ Error al obtener planificaciones por asignatura y nivel:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas de planificaciones
 */
export const getPlanificacionesStats = async (userId?: string) => {
  console.log('🔄 Obteniendo estadísticas de planificaciones...');
  
  try {
    const planificacionesRef = collection(db, 'planificaciones');
    
    let q;
    if (userId) {
      q = query(planificacionesRef, where('userId', '==', userId));
    } else {
      q = query(planificacionesRef);
    }

    const snapshot = await getDocs(q);
    const planificaciones: PlanificacionDocente[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      planificaciones.push({
        id: doc.id,
        ...data
      } as PlanificacionDocente);
    });

    // Calcular estadísticas
    const stats = {
      total: planificaciones.length,
      unidades: planificaciones.filter(p => p.tipo === 'Unidad').length,
      clases: planificaciones.filter(p => p.tipo === 'Clase').length,
      porNivel: {
        '1º Medio': planificaciones.filter(p => p.nivel === '1º Medio').length,
        '2º Medio': planificaciones.filter(p => p.nivel === '2º Medio').length,
        '3º Medio': planificaciones.filter(p => p.nivel === '3º Medio').length,
        '4º Medio': planificaciones.filter(p => p.nivel === '4º Medio').length,
      },
      porAsignatura: {} as Record<string, number>
    };

    // Contar por asignatura
    planificaciones.forEach(p => {
      if (p.asignatura) {
        stats.porAsignatura[p.asignatura] = (stats.porAsignatura[p.asignatura] || 0) + 1;
      }
    });

    console.log('✅ Estadísticas calculadas:', stats);
    return stats;
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    throw error;
  }
};