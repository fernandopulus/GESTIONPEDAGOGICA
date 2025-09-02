import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // ✅ Import correcto
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBX_n9qoSh0N2c1OAPurBAl6FC9ltX4tK0",
  authDomain: "plania-clase.firebaseapp.com",
  projectId: "plania-clase",
  storageBucket: "plania-clase.appspot.com",
  messagingSenderId: "978612067917",
  appId: "1:978612067917:web:299137755ec80939d7c604"
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
