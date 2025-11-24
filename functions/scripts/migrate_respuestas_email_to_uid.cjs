#!/usr/bin/env node
/*
  Migración: respuestas_actividades estudianteId (email) -> UID

  Requisitos:
  - Variables de entorno con credenciales Admin: GOOGLE_APPLICATION_CREDENTIALS apuntando a un JSON de servicio,
    o ejecutar dentro de un entorno con Application Default Credentials.
  - Dependencias ya presentes en functions/: firebase-admin

  Uso:
    node functions/scripts/migrate_respuestas_email_to_uid.cjs [--dry-run]

  Comportamiento:
  - Recorre toda la colección 'respuestas_actividades'.
  - Para cada documento cuyo estudianteId sea un email, busca el UID en Auth.
  - Si lo encuentra, actualiza:
      estudianteId <- uid
      estudianteIdOriginal <- email
      migratedAt <- timestamp
    En modo --dry-run solo reporta.
*/

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const RESPUESTAS_COLLECTION = 'respuestas_actividades';

function ensureInitialized() {
  try {
    if (admin.apps.length === 0) {
      // Preferir ADC si está configurado; de lo contrario, intentar credenciales locales
      const saDefaultPath = path.resolve(__dirname, '..', 'credentials', 'serviceAccount.json');
      const hasEnvCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!hasEnvCreds && fs.existsSync(saDefaultPath)) {
        const serviceAccount = require(saDefaultPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else {
        admin.initializeApp();
      }
    }
  } catch (e) {
    console.error('Error inicializando firebase-admin:', e);
    process.exit(1);
  }
}

async function migrate() {
  ensureInitialized();
  const db = admin.firestore();
  const auth = admin.auth();

  console.log(`Iniciando migración de '${RESPUESTAS_COLLECTION}' ${DRY_RUN ? '(DRY RUN)' : ''}`);
  const start = Date.now();

  const snap = await db.collection(RESPUESTAS_COLLECTION).get();
  console.log(`Documentos totales: ${snap.size}`);

  let toProcess = 0;
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  // Cache para evitar múltiples llamadas a getUserByEmail
  const emailToUid = new Map();

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const estudianteId = data.estudianteId;
    if (typeof estudianteId !== 'string') { skipped++; continue; }
    const isEmail = estudianteId.includes('@');
    if (!isEmail) { skipped++; continue; }
    toProcess++;

    let uid = emailToUid.get(estudianteId);
    if (uid === undefined) {
      try {
        const u = await auth.getUserByEmail(estudianteId);
        uid = u.uid;
        emailToUid.set(estudianteId, uid);
      } catch (e) {
        console.warn(`No se encontró UID para email ${estudianteId} (doc ${doc.id})`);
        emailToUid.set(estudianteId, null);
        notFound++;
        continue;
      }
    }
    if (!uid) { continue; }

    if (DRY_RUN) {
      console.log(`[DRY] ${doc.id}: ${estudianteId} -> ${uid}`);
      updated++; // contar como potencial
      continue;
    }

    try {
      await doc.ref.update({
        estudianteId: uid,
        estudianteIdOriginal: estudianteId,
        migratedAt: admin.firestore.Timestamp.now(),
      });
      updated++;
    } catch (e) {
      console.error(`Error actualizando ${doc.id}:`, e.message || e);
      skipped++;
    }
  }

  const secs = Math.round((Date.now() - start) / 1000);
  console.log('--- Resumen migración ---');
  console.log('Candidatos (email):', toProcess);
  console.log('Actualizados:', updated);
  console.log('No encontrados en Auth:', notFound);
  console.log('Omitidos/otros:', skipped);
  console.log(`Tiempo: ${secs}s`);
}

migrate().then(() => process.exit(0)).catch((e) => {
  console.error('Fallo migración:', e);
  process.exit(1);
});
