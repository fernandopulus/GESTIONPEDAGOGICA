import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // ✅ Import correcto
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAfL9dpeLfpWQPg4orpFSh3X5dzXrSsBwc",
  authDomain: "planificador-145df.firebaseapp.com",
  projectId: "planificador-145df",
  storageBucket: "planificador-145df.firebasestorage.app", // ✅ corregido
  messagingSenderId: "1022861144167",
  appId: "1:1022861144167:web:7c277dd701dad5986864c2",
  measurementId: "G-LKJRFMVC9F"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Asegurarse de que la autenticación esté configurada correctamente
// Para uso en producción, no conectamos al emulador
// if (import.meta.env.MODE === "development") {
//   connectAuthEmulator(auth, "http://localhost:9099");
// }

export const db = getFirestore(app);
export const storage = getStorage(app); // ✅ Ahora no dará error

// Configuramos explícitamente la región para las funciones
export const functions = getFunctions(app, 'us-central1'); // Especificar la región us-central1

// Descomenta esta línea para conectar con las funciones locales (solo en desarrollo)
// if (import.meta.env.MODE === "development") {
//   connectFunctionsEmulator(functions, "localhost", 5001);
// }
export const GEMINI_API_KEY = 'AIzaSyDn2nxyD4XMxRJdyLgo_9MNRlPPb7f0u5w'; // API key for Gemini AI
