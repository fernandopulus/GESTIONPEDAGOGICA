const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp({
  projectId: 'plania-clase'
});

const db = admin.firestore();

async function diagnose() {
  console.log('🔍 Iniciando diagnóstico de respuestas vs usuarios...');

  try {
    // 1. Obtener todos los usuarios
    console.log('📥 Obteniendo usuarios...');
    const usersSnap = await db.collection('usuarios').get();
    const users = [];
    usersSnap.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    console.log(`✅ ${users.length} usuarios encontrados.`);

    // 2. Obtener todas las respuestas
    console.log('📥 Obteniendo respuestas...');
    const respSnap = await db.collection('respuestas_actividades').get();
    const respuestas = [];
    respSnap.forEach(doc => {
      respuestas.push({ id: doc.id, ...doc.data() });
    });
    console.log(`✅ ${respuestas.length} respuestas encontradas.`);

    // 3. Analizar coincidencias
    let matchedCount = 0;
    let orphanCount = 0;
    let orphans = [];

    // Helper de normalización (copiado de ActividadesRemotas.tsx)
    const normalize = (v) => (v || '').trim();
    const stripDiacritics = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normForCompare = (s) => stripDiacritics(s.toLowerCase().replace(/\s+/g, ' ').trim());
    const equalsFlex = (a, b) => {
      const aa = normalize(a);
      const bb = normalize(b);
      if (!aa || !bb) return false;
      if (aa === bb) return true;
      return normForCompare(aa) === normForCompare(bb);
    };

    const getStudentCandidateIds = (u) => {
      const out = [];
      if (u.id) out.push(u.id);
      if (u.email) out.push(u.email);
      if (u.nombreCompleto) out.push(u.nombreCompleto);
      if (u.rut) out.push(u.rut);
      if (u.usuarioId) out.push(u.usuarioId);
      if (u.idUsuario) out.push(u.idUsuario);
      return out.filter(Boolean);
    };

    const respuestaMatchesStudent = (r, u) => {
      const candidates = getStudentCandidateIds(u);
      const rIds = [
        r.estudianteId,
        r.estudianteUID,
        r.estudianteUid,
        r.uid,
        r.usuarioId,
        r.idUsuario,
        r.userId,
        r.email,
        r.estudianteEmail,
        r.estudianteNombre,
        r.autorId,
        r.autorUID,
        r.autorEmail
      ];
      return candidates.some((cid) => rIds.some((rid) => equalsFlex(rid, cid)));
    };

    respuestas.forEach(r => {
      const match = users.find(u => respuestaMatchesStudent(r, u));
      if (match) {
        matchedCount++;
      } else {
        orphanCount++;
        orphans.push(r);
      }
    });

    console.log('📊 Resultados del análisis:');
    console.log(`   Coincidencias: ${matchedCount}`);
    console.log(`   Huérfanas: ${orphanCount}`);

    if (orphanCount > 0) {
      console.log('\n⚠️ Detalle de respuestas huérfanas (primeras 10):');
      orphans.slice(0, 10).forEach((r, i) => {
        console.log(`   [${i+1}] ID Respuesta: ${r.id}`);
        console.log(`       estudianteId: ${r.estudianteId}`);
        console.log(`       estudianteEmail: ${r.estudianteEmail}`);
        console.log(`       estudianteNombre: ${r.estudianteNombre}`);
        console.log(`       Fecha: ${r.fechaCompletado}`);
        
        // Intentar encontrar candidato cercano por email
        if (r.estudianteEmail) {
            const emailMatch = users.find(u => equalsFlex(u.email, r.estudianteEmail));
            if (emailMatch) {
                console.log(`       💡 SUGERENCIA: Existe usuario con email ${emailMatch.email} (ID: ${emailMatch.id})`);
                console.log(`          ¿Por qué no hizo match?`);
                console.log(`          User Candidates: ${JSON.stringify(getStudentCandidateIds(emailMatch))}`);
            } else {
                console.log(`       ❌ No existe usuario con ese email.`);
            }
        }
        console.log('---');
      });
    }

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

diagnose().then(() => process.exit(0));
