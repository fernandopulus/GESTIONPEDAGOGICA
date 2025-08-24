/**
 * Configuración de OAuth para Google Slides API
 * IMPORTANTE: No incluir este archivo en control de versiones
 */

export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '1022861144167-0i63eajtaqr3e9rmhll1aebn72gkhq87.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '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',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://us-central1-planificador-145df.cloudfunctions.net/oauthCallback',
  scopes: [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive'
  ]
};
