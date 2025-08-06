// src/firebaseHelpers/empresasHelper.ts
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config'; // Asegúrate que la ruta a tu config de Firebase es correcta
import { Empresa, User, Profile } from '../../types';

const EMPRESAS_COLLECTION = 'empresas_practicas';
const USERS_COLLECTION = 'usuarios';

const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return { id: docSnapshot.id, ...data } as T;
};

// --- FUNCIÓN DE GEOCODIFICACIÓN ---

/**
 * Convierte una dirección de texto en coordenadas geográficas usando la API de Google Maps.
 * @param address La dirección a geocodificar.
 * @returns Un objeto con latitud y longitud, o null si no se encuentra.
 */
async function geocodeAddress(address: string): Promise<{lat: number, lng: number} | null> {
    // IMPORTANTE: Reemplaza 'TU_CLAVE_DE_API_DE_GOOGLE_MAPS' con tu propia clave de API.
    // Habilita la "Geocoding API" en tu consola de Google Cloud.
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'TU_CLAVE_DE_API_DE_GOOGLE_MAPS';
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=CL`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'OK' && data.results[0]) {
            return data.results[0].geometry.location; // Devuelve { lat, lng }
        }
        console.warn('Geocodificación no exitosa:', data.status);
        return null;
    } catch (error) {
        console.error("Error en la llamada a la API de Geocodificación:", error);
        return null;
    }
}


// --- GESTIÓN DE EMPRESAS ---

export const subscribeToEmpresas = (callback: (data: Empresa[]) => void) => {
  const q = query(collection(db, EMPRESAS_COLLECTION), orderBy('nombre', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const empresas = snapshot.docs.map(doc => convertFirestoreDoc<Empresa>(doc));
    callback(empresas);
  }, (error) => console.error("Error al suscribirse a empresas:", error));
};

export const saveEmpresa = async (empresaData: Omit<Empresa, 'id' | 'createdAt'> | Empresa) => {
  // Calcula el puntaje total
  const puntajeTotal = empresaData.calificaciones.reduce((acc, item) => acc + (item.score || 0), 0);
  
  // Prepara los datos para guardar
  const dataToSave: any = { ...empresaData, puntajeTotal };

  // Geocodifica la dirección si es necesario
  if (empresaData.direccion) {
      const coords = await geocodeAddress(empresaData.direccion);
      if (coords) {
          dataToSave.coordenadas = coords;
      }
  }

  if ('id' in empresaData && empresaData.id) {
    // Actualizar empresa existente
    const { id, ...data } = dataToSave as Empresa;
    const docRef = doc(db, EMPRESAS_COLLECTION, id);
    await setDoc(docRef, data, { merge: true });
    return id;
  } else {
    // Crear nueva empresa
    const docRef = await addDoc(collection(db, EMPRESAS_COLLECTION), {
      ...dataToSave,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }
};

export const deleteEmpresa = async (empresaId: string): Promise<void> => {
  const docRef = doc(db, EMPRESAS_COLLECTION, empresaId);
  await deleteDoc(docRef);
};

// --- GESTIÓN DE ESTUDIANTES (para la asignación) ---

export const subscribeToEstudiantes = (callback: (data: User[]) => void) => {
  const q = query(collection(db, USERS_COLLECTION), where('profile', '==', Profile.ESTUDIANTE), orderBy('nombreCompleto', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const estudiantes = snapshot.docs.map(doc => convertFirestoreDoc<User>(doc));
    callback(estudiantes);
  }, (error) => console.error("Error al suscribirse a estudiantes:", error));
};

// --- GESTIÓN DE PROFESORES (para la asignación) ---

export const subscribeToProfesores = (callback: (data: User[]) => void) => {
  // Asumiendo que el campo para el rol es 'profile' y el valor es 'PROFESORADO'
  const q = query(collection(db, USERS_COLLECTION), where('profile', '==', 'PROFESORADO'), orderBy('nombreCompleto', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const profesores = snapshot.docs.map(doc => convertFirestoreDoc<User>(doc));
    callback(profesores);
  }, (error) => console.error("Error al suscribirse a profesores:", error));
};
