// createTestUser.cjs
// Script para crear un usuario en el emulador de Auth de Firebase (CommonJS)

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Inicializa la app de Firebase Admin apuntando al emulador
initializeApp({
  projectId: "plania-clase",
});

// Configura la variable de entorno para el emulador
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

async function createUser() {
  try {
    const user = await getAuth().createUser({
      email: 'test@example.com',
      password: 'test1234',
      displayName: 'Usuario de Prueba',
    });
    console.log('Usuario creado:', user.uid);
  } catch (error) {
    console.error('Error al crear usuario:', error.message);
  }
}

createUser();
