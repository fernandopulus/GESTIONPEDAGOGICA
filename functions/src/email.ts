import { defineSecret, defineString } from 'firebase-functions/params';
import nodemailer from 'nodemailer';

// SMTP config via params + secret
const SMTP_HOST = defineString('SMTP_HOST');
const SMTP_PORT = defineString('SMTP_PORT'); // string para evitar parse en deploy
const SMTP_SECURE = defineString('SMTP_SECURE'); // 'true' | 'false'
const SMTP_USER = defineString('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const FROM_EMAIL = defineString('FROM_EMAIL');
const FROM_NAME = defineString('FROM_NAME');

let transporter: nodemailer.Transporter | null = null;
function ensureTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST || SMTP_HOST.value();
  const portStr = process.env.SMTP_PORT || SMTP_PORT.value() || '587';
  const secureStr = process.env.SMTP_SECURE || SMTP_SECURE.value() || 'false';
  const user = process.env.SMTP_USER || SMTP_USER.value();
  const pass = process.env.SMTP_PASS; // estará disponible por secret binding

  if (!host || !user || !pass) {
    throw new Error('Faltan variables SMTP requeridas (SMTP_HOST, SMTP_USER, SMTP_PASS)');
  }

  const port = Number(portStr);
  const secure = String(secureStr).toLowerCase() === 'true';
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
}

export type EmailRecipient = string | string[];

export async function sendEmail(
  to: EmailRecipient,
  subject: string,
  html: string,
  text?: string
) {
  const t = ensureTransporter();
  const fromEmail = process.env.FROM_EMAIL || FROM_EMAIL.value() || 'no-reply@example.com';
  const fromName = process.env.FROM_NAME || FROM_NAME.value() || 'Gestion Pedagogica';

  await t.sendMail({
    from: { address: fromEmail, name: fromName },
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' ').slice(0, 2000),
  });
}

// Exportar secretos/params para vincularlos a las funciones
export const emailSecrets = [SMTP_PASS];
export const emailParams = [SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, FROM_EMAIL, FROM_NAME];
