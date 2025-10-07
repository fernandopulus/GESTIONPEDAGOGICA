import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Config desde variables de entorno (alineada con src/firebaseHelpers/config.ts)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Asegurarse de que la autenticación esté configurada correctamente
// Para uso en producción, no conectamos al emulador
// if (import.meta.env.MODE === "development") {
//   connectAuthEmulator(auth, "http://localhost:9099");
// }

export const db = getFirestore(app);
export const storage = getStorage(app);

// Configuramos explícitamente la región para las funciones
export const functions = getFunctions(app, 'us-central1'); // Especificar la región us-central1

// Descomenta esta línea para conectar con las funciones locales (solo en desarrollo)
// if (import.meta.env.MODE === "development") {
//   connectFunctionsEmulator(functions, "localhost", 5001);
// }
