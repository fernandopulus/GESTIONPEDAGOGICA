import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { PresentacionDidactica } from '../../types';

// Colección para materiales didácticos
const PRESENTACIONES_COLLECTION = 'presentacionesDidacticas';

// Guardar una nueva presentación
export const savePresentacion = async (presentacion: Omit<PresentacionDidactica, 'id'>, userId: string) => {
  const docRef = doc(collection(db, PRESENTACIONES_COLLECTION));
  const newPresentacion: PresentacionDidactica = {
    ...presentacion,
    id: docRef.id,
    userId,
    fechaCreacion: new Date().toISOString(),
    estado: 'generando'
  };
  
  await setDoc(docRef, newPresentacion);
  return docRef.id;
};

// Actualizar una presentación existente
export const updatePresentacion = async (id: string, updates: Partial<PresentacionDidactica>) => {
  const docRef = doc(db, PRESENTACIONES_COLLECTION, id);
  await updateDoc(docRef, updates);
};

// Eliminar una presentación
export const deletePresentacion = async (id: string) => {
  await deleteDoc(doc(db, PRESENTACIONES_COLLECTION, id));
};

// Obtener una presentación específica
export const getPresentacion = async (id: string): Promise<PresentacionDidactica | null> => {
  const docRef = doc(db, PRESENTACIONES_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as PresentacionDidactica;
  } else {
    return null;
  }
};

// Suscribirse a las presentaciones de un usuario
export const subscribeToPresentaciones = (userId: string, callback: (presentaciones: PresentacionDidactica[]) => void) => {
  const q = query(
    collection(db, PRESENTACIONES_COLLECTION),
    where("userId", "==", userId),
    orderBy("fechaCreacion", "desc")
  );
  
  return onSnapshot(q, (snapshot) => {
    const presentaciones = snapshot.docs.map(doc => doc.data() as PresentacionDidactica);
    callback(presentaciones);
  });
};

// Suscribirse a las presentaciones asociadas a una planificación específica
export const subscribeToPresentacionesByPlanificacion = (userId: string, planificacionId: string, callback: (presentaciones: PresentacionDidactica[]) => void) => {
  const q = query(
    collection(db, PRESENTACIONES_COLLECTION),
    where("userId", "==", userId),
    where("planificacionId", "==", planificacionId),
    orderBy("fechaCreacion", "desc")
  );
  
  return onSnapshot(q, (snapshot) => {
    const presentaciones = snapshot.docs.map(doc => doc.data() as PresentacionDidactica);
    callback(presentaciones);
  });
};

// Llamar a la Cloud Function para generar una presentación
export const generateSlides = async (presentacionData: Omit<PresentacionDidactica, 'id' | 'fechaCreacion' | 'estado' | 'urlPresentacion'>) => {
  try {
    // Esta función debería existir en Firebase Functions
    const generateSlidesFunction = httpsCallable(functions, 'generateSlides');
    const result = await generateSlidesFunction(presentacionData);
    return result.data as { url: string };
  } catch (error) {
    console.error("Error al generar presentación:", error);
    throw error;
  }
};
