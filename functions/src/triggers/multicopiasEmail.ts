import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { sendEmail, emailSecrets } from '../email';
import { defineString } from 'firebase-functions/params';

const db = admin.firestore();

// Lista de correos de respaldo para Subdirección (separados por coma) si no hay usuarios SUBDIRECCION en colección 'usuarios'
const SUBDIRECCION_NOTIFY_EMAILS = defineString('SUBDIRECCION_NOTIFY_EMAILS');

function htmlRow(label: string, value?: string | number) {
  const v = (value ?? '—').toString();
  return `<tr><td style="padding:4px 8px;color:#64748b">${label}</td><td style="padding:4px 8px;color:#0f172a"><strong>${v}</strong></td></tr>`;
}

function buildSolicitudHtml(d: any) {
  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;max-width:640px">
    <h2 style="margin:0 0 8px;color:#111827">Nueva solicitud de Multicopias</h2>
    <p style="margin:0 0 12px;color:#374151">Se ha registrado una nueva solicitud en el sistema.</p>
    <table style="border-collapse:collapse;background:#f8fafc;border-radius:8px;width:100%">
      ${htmlRow('Docente', d.solicitanteNombre)}
      ${htmlRow('Correo', d.solicitanteEmail)}
      ${htmlRow('Título', d.tituloMaterial)}
      ${htmlRow('Asignatura', d.asignatura)}
      ${htmlRow('Nivel', d.nivel)}
      ${htmlRow('Curso', d.curso)}
      ${htmlRow('Cantidad de copias', d.cantidadCopias)}
      ${htmlRow('Fecha entrega deseada', d.fechaEntregaDeseada)}
      ${htmlRow('Estado', d.estado)}
      ${htmlRow('Enlace', d.enlaceUrl)}
      ${htmlRow('Adjunto', d.adjuntoUrl)}
      ${htmlRow('Comentarios', d.comentarios)}
    </table>
    <p style="margin-top:12px;color:#475569">Ingresa al panel de Subdirección para revisar y gestionar.</p>
  </div>`;
}

function buildEstadoHtml(d: any, previo?: string) {
  const titulo = d.estado === 'Aceptada' ? 'Solicitud aceptada' : d.estado === 'Rechazada' ? 'Solicitud rechazada' : d.estado === 'Completada' ? 'Solicitud completada' : `Estado actualizado: ${d.estado}`;
  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;max-width:640px">
    <h2 style="margin:0 0 8px;color:#111827">${titulo}</h2>
    <p style="margin:0 0 12px;color:#374151">Tu solicitud de Multicopias ha cambiado de estado.</p>
    <table style="border-collapse:collapse;background:#f8fafc;border-radius:8px;width:100%">
      ${previo ? htmlRow('Estado anterior', previo) : ''}
      ${htmlRow('Estado actual', d.estado)}
      ${htmlRow('Título', d.tituloMaterial)}
      ${htmlRow('Asignatura', d.asignatura)}
      ${htmlRow('Nivel', d.nivel)}
      ${htmlRow('Curso', d.curso)}
      ${htmlRow('Cantidad de copias', d.cantidadCopias)}
      ${d.motivoRechazo ? htmlRow('Motivo de rechazo', d.motivoRechazo) : ''}
    </table>
    <p style="margin-top:12px;color:#475569">Puedes ver el detalle en el módulo Multicopias.</p>
  </div>`;
}

async function getCorreosSubdireccion(): Promise<string[]> {
  const emails: string[] = [];
  try {
    const snap = await db.collection('usuarios').where('profile', '==', 'SUBDIRECCION').get();
    snap.forEach(doc => {
      const e = doc.data()?.email;
      if (e) emails.push(e);
    });
  } catch (e) {
    console.warn('No se pudieron obtener correos de SUBDIRECCION desde usuarios:', e);
  }
  if (emails.length === 0) {
    const fallback = SUBDIRECCION_NOTIFY_EMAILS.value();
    if (fallback) {
      fallback.split(',').map(s => s.trim()).filter(Boolean).forEach(e => emails.push(e));
    }
  }
  return emails;
}

export const multicopiasOnCreate = onDocumentCreated({
  document: 'multicopias/{id}',
  region: 'us-central1',
  secrets: [...emailSecrets],
  timeoutSeconds: 60,
}, async (event) => {
  try {
    const d = event.data?.data();
    if (!d) return;
    const destinatarios = await getCorreosSubdireccion();
    if (destinatarios.length === 0) return;
    const subject = `Nueva solicitud de Multicopias: ${d.tituloMaterial || ''}`.trim();
    const html = buildSolicitudHtml(d);
    await sendEmail(destinatarios, subject, html);
  } catch (e) {
    console.error('multicopiasOnCreate email error:', e);
  }
});

export const multicopiasOnUpdate = onDocumentUpdated({
  document: 'multicopias/{id}',
  region: 'us-central1',
  secrets: [...emailSecrets],
  timeoutSeconds: 60,
}, async (event) => {
  try {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    const prevEstado = before.estado;
    const nuevoEstado = after.estado;
    if (!nuevoEstado || prevEstado === nuevoEstado) return; // sólo si cambia el estado

    const destinatario = after.solicitanteEmail || after.solicitanteEmailLower;
    if (!destinatario) return;

    const subject = `Multicopias: ${nuevoEstado} — ${after.tituloMaterial || ''}`.trim();
    const html = buildEstadoHtml(after, prevEstado);
    await sendEmail(destinatario, subject, html);
  } catch (e) {
    console.error('multicopiasOnUpdate email error:', e);
  }
});
