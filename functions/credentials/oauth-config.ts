/**
 * Configuración de OAuth para Google Slides API
 * IMPORTANTE: No incluir este archivo en control de versiones
 */

export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://us-central1-gestionpedagogica.cloudfunctions.net/oauthCallback',
  scopes: [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive'
  ]
};
