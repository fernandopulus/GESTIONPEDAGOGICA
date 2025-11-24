#!/usr/bin/env node
/*
  Normalización: actividadId en 'respuestas_actividades'

  Objetivo:
  - Asegurar que todos los documentos tengan el campo 'actividadId' con el ID canónico
    del documento en 'actividades_remotas'.
  - Soporta variantes legacy: idActividad, actividad.id, actividadPath, actividadRef.
  - Preserva el valor anterior en 'actividadIdOriginal' cuando haya cambio.

  Requisitos:
  - GOOGLE_APPLICATION_CREDENTIALS apuntando a credencial de servicio, o ADC en el entorno.
  - Dependencias: firebase-admin (ya incluida en functions/).

  Uso:
    node functions/scripts/normalize_respuestas_actividad_id.cjs [--dry-run]

  Efectos:
  - En modo --dry-run solo reporta cambios potenciales.
  - En modo real actualiza actividadId y añade actividadIdOriginal y migratedAt si corresponde.
*/

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const RESPUESTAS_COLLECTION = 'respuestas_actividades';
const ACTIVIDADES_COLLECTION = 'actividades_remotas';

function ensureInitialized() {
  try {
    if (admin.apps.length === 0) {
      const saDefaultPath = path.resolve(__dirname, '..', 'credentials', 'serviceAccount.json');
      const hasEnvCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!hasEnvCreds && fs.existsSync(saDefaultPath)) {
        const serviceAccount = require(saDefaultPath);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else {
        admin.initializeApp();
      }
    }
  } catch (e) {
    console.error('Error inicializando firebase-admin:', e);
    process.exit(1);
  }
}

function lastSegment(s) {
  if (!s || typeof s !== 'string') return '';
  const parts = s.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : s;
}

function resolveActividadId(data) {
  // 1) actividadId directo (si viene con ruta, extraer segmento final)
  if (typeof data.actividadId === 'string' && data.actividadId.trim()) {
    return lastSegment(data.actividadId.trim());
  }
  // 2) idActividad (legacy)
  if (typeof data.idActividad === 'string' && data.idActividad.trim()) {
    return lastSegment(data.idActividad.trim());
  }
  // 3) actividad?.id (map antiguo)
  if (data.actividad && typeof data.actividad.id === 'string' && data.actividad.id.trim()) {
    return lastSegment(data.actividad.id.trim());
  }
  // 4) actividadPath (ruta completa)
  if (typeof data.actividadPath === 'string' && data.actividadPath.trim()) {
    return lastSegment(data.actividadPath.trim());
  }
  // 5) actividadRef (DocumentReference)
  if (data.actividadRef && typeof data.actividadRef.id === 'string' && data.actividadRef.id.trim()) {
    return data.actividadRef.id.trim();
  }
  return '';
}

async function normalize() {
  ensureInitialized();
  const db = admin.firestore();

  console.log(`Iniciando normalización de 'actividadId' en '${RESPUESTAS_COLLECTION}' ${DRY_RUN ? '(DRY RUN)' : ''}`);
  const start = Date.now();

  const snap = await db.collection(RESPUESTAS_COLLECTION).get();
  console.log(`Documentos totales: ${snap.size}`);

  let candidates = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const current = typeof data.actividadId === 'string' ? data.actividadId.trim() : '';
    const resolved = resolveActividadId(data);

    if (!resolved) { invalid++; continue; }

    // Ya está normalizado si coincide exactamente con el ID final (sin rutas)
    const normalized = lastSegment(current);
    const needsUpdate = normalized !== resolved || current !== resolved;

    if (!needsUpdate) { skipped++; continue; }
    candidates++;

    if (DRY_RUN) {
      console.log(`[DRY] ${doc.id}: actividadId '${current || '(vacío)'}' => '${resolved}'`);
      updated++;
      continue;
    }

    try {
      await doc.ref.update({
        actividadId: resolved,
        actividadIdOriginal: current || null,
        migratedAt: admin.firestore.Timestamp.now(),
      });
      updated++;
    } catch (e) {
      console.error(`Error actualizando ${doc.id}:`, e.message || e);
      skipped++;
    }
  }

  const secs = Math.round((Date.now() - start) / 1000);
  console.log('--- Resumen normalización ---');
  console.log('Candidatos a actualizar:', candidates);
  console.log('Actualizados:', updated);
  console.log('Sin cambios:', skipped);
  console.log('Sin actividad detectable:', invalid);
  console.log(`Tiempo: ${secs}s`);
}

normalize().then(() => process.exit(0)).catch((e) => {
  console.error('Fallo normalización:', e);
  process.exit(1);
});
