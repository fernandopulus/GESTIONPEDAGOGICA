import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";
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

// App Check (reCAPTCHA v3 en prod; Debug token en dev)
try {
  // En desarrollo, habilitar proveedor de depuración (token fijo u automático)
  if (import.meta.env.MODE !== 'production') {
    // Si se define VITE_APPCHECK_DEBUG_TOKEN, úsalo; si no, usa 'true' para generar uno en consola
    // Nota: al usar 'true', el SDK imprimirá el token en la consola del navegador en el primer uso
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = (import.meta as any)?.env?.VITE_APPCHECK_DEBUG_TOKEN || true;
  }

  const siteKey = (import.meta as any)?.env?.VITE_APPCHECK_SITE_KEY || (import.meta as any)?.env?.VITE_RECAPTCHA_V3_SITE_KEY;
  if (siteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey as string),
      isTokenAutoRefreshEnabled: true,
    });
  } else if (import.meta.env.MODE === 'production') {
    // Aviso defensivo: en producción debería estar configurada la site key
    console.warn('[AppCheck] Falta VITE_APPCHECK_SITE_KEY o VITE_RECAPTCHA_V3_SITE_KEY. Las funciones con App Check pueden fallar.');
  }
} catch (e) {
  // Evitar romper el arranque si App Check no está disponible en algún entorno
}

// Descomenta esta línea para conectar con las funciones locales (solo en desarrollo)
// if (import.meta.env.MODE === "development") {
//   connectFunctionsEmulator(functions, "localhost", 5001);
// }

// Debug Firestore (solo en desarrollo): muestra rutas y consultas que fallan, útil para detectar permission-denied
try {
  if (import.meta?.env?.MODE !== 'production') {
    setLogLevel('debug');
  }
} catch (e) {
  // no-op si el entorno no soporta setLogLevel
}
