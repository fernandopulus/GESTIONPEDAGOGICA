import { collection, query, onSnapshot, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Reemplazo, AcompanamientoDocente, CalendarEvent } from '../../types';

/**
 * Suscribirse a todos los registros de reemplazos (inasistencias)
 */
export const subscribeToAllReemplazos = (
  callback: (reemplazos: Reemplazo[]) => void
): (() => void) => {
  console.log('🔄 Iniciando suscripción a todos los reemplazos...');
  
  try {
    const reemplazosRef = collection(db, 'reemplazos');
    const q = query(reemplazosRef, orderBy('fecha', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reemplazosData: Reemplazo[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        reemplazosData.push({
          id: doc.id,
          ...data
        } as Reemplazo);
      });

      console.log('✅ Reemplazos cargados para dashboard:', reemplazosData.length);
      callback(reemplazosData);
    }, (error) => {
      console.error('❌ Error al cargar reemplazos:', error);
      throw error;
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error al configurar suscripción a reemplazos:', error);
    throw error;
  }
};

/**
 * Suscribirse a todos los acompañamientos docentes
 */
export const subscribeToAllAcompanamientos = (
  callback: (acompanamientos: AcompanamientoDocente[]) => void
): (() => void) => {
  console.log('🔄 Iniciando suscripción a todos los acompañamientos...');
  
  try {
    const acompanamientosRef = collection(db, 'acompanamientos');
    const q = query(acompanamientosRef, orderBy('fecha', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const acompanamientosData: AcompanamientoDocente[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        acompanamientosData.push({
          id: doc.id,
          ...data
        } as AcompanamientoDocente);
      });

      console.log('✅ Acompañamientos cargados para dashboard:', acompanamientosData.length);
      callback(acompanamientosData);
    }, (error) => {
      console.error('❌ Error al cargar acompañamientos:', error);
      throw error;
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error al configurar suscripción a acompañamientos:', error);
    throw error;
  }
};

/**
 * Suscribirse a todos los eventos del calendario
 */
export const subscribeToAllCalendarEvents = (
  callback: (events: CalendarEvent[]) => void
): (() => void) => {
  console.log('🔄 Iniciando suscripción a todos los eventos del calendario...');
  
  try {
    const calendarRef = collection(db, 'calendar_events');
    const q = query(calendarRef, orderBy('date', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData: CalendarEvent[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        eventsData.push({
          id: doc.id,
          ...data
        } as CalendarEvent);
      });

      console.log('✅ Eventos del calendario cargados para dashboard:', eventsData.length);
      callback(eventsData);
    }, (error) => {
      console.error('❌ Error al cargar eventos del calendario:', error);
      throw error;
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error al configurar suscripción a eventos del calendario:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas de reemplazos por período
 */
export const getReemplazosStatsByPeriod = async (
  startDate: Date,
  endDate: Date
): Promise<Reemplazo[]> => {
  console.log('🔄 Obteniendo estadísticas de reemplazos por período...');
  
  try {
    const reemplazosRef = collection(db, 'reemplazos');
    const q = query(
      reemplazosRef,
      where('fecha', '>=', startDate.toISOString().split('T')[0]),
      where('fecha', '<=', endDate.toISOString().split('T')[0]),
      orderBy('fecha', 'desc')
    );

    const snapshot = await getDocs(q);
    const reemplazosData: Reemplazo[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      reemplazosData.push({
        id: doc.id,
        ...data
      } as Reemplazo);
    });

    console.log('✅ Estadísticas de reemplazos obtenidas:', reemplazosData.length);
    return reemplazosData;
  } catch (error) {
    console.error('❌ Error al obtener estadísticas de reemplazos:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas de acompañamientos por período
 */
export const getAcompanamientosStatsByPeriod = async (
  startDate: Date,
  endDate: Date
): Promise<AcompanamientoDocente[]> => {
  console.log('🔄 Obteniendo estadísticas de acompañamientos por período...');
  
  try {
    const acompanamientosRef = collection(db, 'acompanamientos');
    const q = query(
      acompanamientosRef,
      where('fecha', '>=', startDate.toISOString().split('T')[0]),
      where('fecha', '<=', endDate.toISOString().split('T')[0]),
      orderBy('fecha', 'desc')
    );

    const snapshot = await getDocs(q);
    const acompanamientosData: AcompanamientoDocente[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      acompanamientosData.push({
        id: doc.id,
        ...data
      } as AcompanamientoDocente);
    });

    console.log('✅ Estadísticas de acompañamientos obtenidas:', acompanamientosData.length);
    return acompanamientosData;
  } catch (error) {
    console.error('❌ Error al obtener estadísticas de acompañamientos:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas generales del dashboard
 */
export const getDashboardGeneralStats = async () => {
  console.log('🔄 Obteniendo estadísticas generales del dashboard...');
  
  try {
    // Obtener conteos de todas las colecciones principales
    const [reemplazosSnapshot, acompanamientosSnapshot, calendarSnapshot] = await Promise.all([
      getDocs(collection(db, 'reemplazos')),
      getDocs(collection(db, 'acompanamientos')),
      getDocs(collection(db, 'calendar_events'))
    ]);

    const stats = {
      totalReemplazos: reemplazosSnapshot.size,
      totalAcompanamientos: acompanamientosSnapshot.size,
      totalEventosCalendario: calendarSnapshot.size,
      lastUpdate: new Date().toISOString()
    };

    console.log('✅ Estadísticas generales obtenidas:', stats);
    return stats;
  } catch (error) {
    console.error('❌ Error al obtener estadísticas generales:', error);
    throw error;
  }
};

/**
 * Obtener datos consolidados para el dashboard
 */
export const getDashboardConsolidatedData = async () => {
  console.log('🔄 Obteniendo datos consolidados del dashboard...');
  
  try {
    const [reemplazos, acompanamientos, calendarEvents] = await Promise.all([
      getDocs(query(collection(db, 'reemplazos'), orderBy('fecha', 'desc'))),
      getDocs(query(collection(db, 'acompanamientos'), orderBy('fecha', 'desc'))),
      getDocs(query(collection(db, 'calendar_events'), orderBy('date', 'asc')))
    ]);

    const consolidatedData = {
      reemplazos: reemplazos.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reemplazo)),
      acompanamientos: acompanamientos.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcompanamientoDocente)),
      calendarEvents: calendarEvents.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent))
    };

    console.log('✅ Datos consolidados obtenidos:', {
      reemplazos: consolidatedData.reemplazos.length,
      acompanamientos: consolidatedData.acompanamientos.length,
      eventos: consolidatedData.calendarEvents.length
    });

    return consolidatedData;
  } catch (error) {
    console.error('❌ Error al obtener datos consolidados:', error);
    throw error;
  }
};