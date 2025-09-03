// src/firebaseHelpers/config.ts
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';

// Configuración desde variables de entorno (.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: "plania-clase.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Evitar reinicializar Firebase si ya está inicializado
const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// Inicializar servicios
export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

// Conectar a emuladores en desarrollo (opcional)
if (import.meta.env.MODE === 'development') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (e) {
    console.warn('No se pudo conectar al emulador de Firestore:', e);
  }

  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  } catch (e) {
    console.warn('No se pudo conectar al emulador de Auth:', e);
  }

  try {
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (e) {
    console.warn('No se pudo conectar al emulador de Storage:', e);
  }
}

export default app;
