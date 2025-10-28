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
import { Empresa, User, Profile, RutaSupervision } from '../../types';

const EMPRESAS_COLLECTION = 'empresas_practicas';
const USERS_COLLECTION = 'usuarios';
const RUTAS_COLLECTION = 'rutas_supervision';

const convertFirestoreDoc = <T>(docSnapshot: any): T => {
  const data = docSnapshot.data();
  return { id: docSnapshot.id, ...data } as T;
};

// --- FUNCIÓN DE GEOCODIFICACIÓN ---
async function geocodeAddress(address: string): Promise<{lat: number, lng: number} | null> {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'TU_CLAVE_DE_API_DE_GOOGLE_MAPS';
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=CL`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'OK' && data.results[0]) {
            return data.results[0].geometry.location;
        }
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
  const puntajeTotal = empresaData.calificaciones.reduce((acc, item) => acc + (item.score || 0), 0);
  const dataToSave: any = { ...empresaData, puntajeTotal };

  if (empresaData.direccion) {
      const coords = await geocodeAddress(empresaData.direccion);
      if (coords) {
          dataToSave.coordenadas = coords;
      }
  }

  if ('id' in empresaData && empresaData.id) {
    const { id, ...data } = dataToSave as Empresa;
    const docRef = doc(db, EMPRESAS_COLLECTION, id);
    await setDoc(docRef, data, { merge: true });
    return id;
  } else {
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

// --- GESTIÓN DE USUARIOS ---
export const subscribeToEstudiantes = (callback: (data: User[]) => void) => {
  const q = query(collection(db, USERS_COLLECTION), where('profile', '==', Profile.ESTUDIANTE), orderBy('nombreCompleto', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const estudiantes = snapshot.docs.map(doc => convertFirestoreDoc<User>(doc));
    callback(estudiantes);
  }, (error) => console.error("Error al suscribirse a estudiantes:", error));
};

export const subscribeToProfesores = (callback: (data: User[]) => void) => {
  // Incluir PROFESORADO y COORDINACION_TP como potenciales supervisores
  const qProfes = query(
    collection(db, USERS_COLLECTION),
    where('profile', '==', Profile.PROFESORADO),
    orderBy('nombreCompleto', 'asc')
  );
  const qCoord = query(
    collection(db, USERS_COLLECTION),
    where('profile', '==', Profile.COORDINACION_TP),
    orderBy('nombreCompleto', 'asc')
  );

  const map = new Map<string, User>();
  const emit = () => {
    const list = Array.from(map.values()).sort((a, b) =>
      (a.nombreCompleto || '').localeCompare(b.nombreCompleto || '', 'es')
    );
    callback(list);
  };

  const applySnapshot = (snapshot: any) => {
    snapshot.docChanges().forEach((change: any) => {
      const id = change.doc.id;
      if (change.type === 'removed') {
        map.delete(id);
      } else {
        map.set(id, convertFirestoreDoc<User>(change.doc));
      }
    });
    emit();
  };

  const unsubProfes = onSnapshot(qProfes, applySnapshot, (error) =>
    console.error('Error al suscribirse a profesores:', error)
  );
  const unsubCoord = onSnapshot(qCoord, applySnapshot, (error) =>
    console.error('Error al suscribirse a coordinación:', error)
  );

  return () => {
    unsubProfes();
    unsubCoord();
  };
};

// --- GESTIÓN DE RUTAS DE SUPERVISIÓN ---
export const saveRouteToDB = async (routeData: Omit<RutaSupervision, 'id' | 'createdAt'>) => {
    const docRef = await addDoc(collection(db, RUTAS_COLLECTION), {
        ...routeData,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const subscribeToSavedRoutes = (callback: (data: RutaSupervision[]) => void) => {
    const q = query(collection(db, RUTAS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const routes = snapshot.docs.map(doc => convertFirestoreDoc<RutaSupervision>(doc));
        callback(routes);
    }, (error) => console.error("Error al suscribirse a rutas guardadas:", error));
};

export const deleteSavedRoute = async (routeId: string): Promise<void> => {
    const docRef = doc(db, RUTAS_COLLECTION, routeId);
    await deleteDoc(docRef);
};
