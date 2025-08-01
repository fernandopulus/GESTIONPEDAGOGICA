// src/firebaseHelpers/config.ts
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  // Reemplaza con tu configuración de Firebase
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "tu-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "tu-proyecto.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tu-proyecto-id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "tu-proyecto.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-XXXXXXXXXX"
};

// Inicializar Firebase solo si no está ya inicializado
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Inicializar servicios
export const db = getFirestore(app);
export const auth = getAuth(app);

// Conectar a emuladores en desarrollo (opcional)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Solo en desarrollo y en el cliente
  try {
    // Verificar si ya están conectados los emuladores
    if (!db._delegate?._databaseId?.projectId?.includes('demo-')) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
  } catch (error) {
    // Los emuladores ya están conectados o no están disponibles
    console.log('Firestore emulator connection info:', error);
  }

  try {
    connectAuthEmulator(auth, 'http://localhost:9099');
  } catch (error) {
    // El emulador ya está conectado o no está disponible
    console.log('Auth emulator connection info:', error);
  }
}

export default app;
