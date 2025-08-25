const admin = require('firebase-admin');

// Inicializar Firebase Admin con credenciales por defecto
admin.initializeApp({
  projectId: 'planificador-145df'
});

const db = admin.firestore();

async function checkOAuthTokens() {
  try {
    console.log('Verificando tokens OAuth...');
    
    // Verificar si existe la colección oauth_tokens
    const snapshot = await db.collection('oauth_tokens').limit(5).get();
    
    if (snapshot.empty) {
      console.log('❌ No hay tokens OAuth guardados para ningún usuario');
      console.log('   Los usuarios necesitan autorizar el acceso a Google Slides');
      return;
    }
    
    console.log(`✅ Encontrados ${snapshot.size} usuarios con tokens OAuth:`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   Usuario: ${doc.id}`);
      console.log(`   Access Token: ${data.accessToken ? 'Presente' : 'Ausente'}`);
      console.log(`   Refresh Token: ${data.refreshToken ? 'Presente' : 'Ausente'}`);
      console.log(`   Expira: ${data.expiryDate ? new Date(data.expiryDate).toLocaleString() : 'N/A'}`);
      console.log(`   Creado: ${data.createdAt ? data.createdAt.toDate().toLocaleString() : 'N/A'}`);
      console.log('   ---');
    });
    
  } catch (error) {
    console.error('Error verificando tokens OAuth:', error);
  }
}

checkOAuthTokens().then(() => {
  console.log('Verificación completada');
  process.exit(0);
});
