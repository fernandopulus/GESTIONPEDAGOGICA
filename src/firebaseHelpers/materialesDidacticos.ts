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
import { db, functions, auth } from '../firebase';
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
  // Guardar el ID de la presentación para actualizarla en caso de error
  let presentacionId: string | null = null;
  
  try {
    
    // Verificar que el usuario esté autenticado antes de llamar a la función
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Usuario no autenticado. Debe iniciar sesión para generar presentaciones.");
    }
    
    console.log("Estado de autenticación:", {
      isLoggedIn: !!currentUser,
      uid: currentUser.uid,
      email: currentUser.email,
    });
    
    // Actualizar el token de autenticación antes de llamar a la función
    const token = await currentUser.getIdToken(true);
    console.log("Token actualizado correctamente, longitud:", token.length);
    
    // Esta función debería existir en Firebase Functions
    const generateSlidesFunction = httpsCallable(functions, 'generateSlides');
    
    // Asegúrate de que los datos se envían correctamente formateados como espera la función
    const datos = {
      tema: presentacionData.tema,
      asignatura: presentacionData.asignatura,
      objetivosAprendizaje: presentacionData.objetivosAprendizaje,
      curso: presentacionData.curso,
      numDiapositivas: presentacionData.numDiapositivas,
      estilo: presentacionData.estilo,
      incluirImagenes: presentacionData.incluirImagenes,
      contenidoFuente: presentacionData.contenidoFuente || "",
      enlaces: presentacionData.enlaces || [],
      planificacionId: presentacionData.planificacionId
    };
    
    // Guardar la presentación antes de llamar a la función
    presentacionId = await savePresentacion({
      ...presentacionData,
      userId: currentUser.uid,
      fechaCreacion: new Date().toISOString(),
      estado: 'generando',
      urlPresentacion: ''
    }, currentUser.uid);
    
    console.log("Presentación guardada con ID:", presentacionId);
    console.log("Enviando solicitud a generateSlides con usuario:", currentUser.uid);
    console.log("Datos enviados:", datos);
    
    const result = await generateSlidesFunction(datos);
    console.log("Respuesta de función:", result);
    
    const responseData = result.data as { 
      url: string, 
      presentacionId: string, 
      message?: string,
      demoMode?: boolean 
    };
    
    // Actualizar la presentación con los datos recibidos de la función
    if (responseData.presentacionId && responseData.url) {
      try {
        const updates: Partial<PresentacionDidactica> = {
          estado: 'completada',
          urlPresentacion: responseData.url
        };
        
        // Si es una demo, añadir indicador visual
        if (responseData.demoMode) {
          updates.mensajeError = "NOTA: Esta es una versión de demostración. La presentación no existe realmente.";
        }
        
        // Actualizar el estado y URL de la presentación
        await updatePresentacion(presentacionId, updates);
      } catch (updateError) {
        console.warn("Error al actualizar la presentación en Firestore:", updateError);
        // Continuamos a pesar del error ya que la presentación fue creada exitosamente
      }
    }
    
    return responseData;
  } catch (error: any) {
    console.error("Error al generar presentación:", error);
    console.error("Código:", error?.code, "Mensaje:", error?.message, "Detalles:", error?.details);
    
    // Si tenemos un ID de presentación, actualizar su estado a 'error'
    if (presentacionId) {
      try {
        await updatePresentacion(presentacionId, {
          estado: 'error',
          mensajeError: error?.message || 'Error desconocido al generar la presentación'
        });
        console.warn(`Presentación ${presentacionId} marcada como fallida`);
      } catch (updateError) {
        console.error("Error al actualizar el estado de la presentación:", updateError);
      }
    }
    
    throw error;
  }
};
