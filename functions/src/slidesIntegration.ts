/**
 * Integración completa con Google Slides API
 * 
 * Este servicio se encarga de:
 * 1. Manejar la autenticación OAuth2 con Google
 * 2. Crear presentaciones en Google Slides
 * 3. Generar contenido para las presentaciones basado en los objetivos de aprendizaje
 * 4. Establecer permisos de acceso a las presentaciones
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as admin from 'firebase-admin';
import { defineString } from "firebase-functions/params";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Parámetros para las credenciales
const googleClientId = defineString("GOOGLE_CLIENT_ID");
const googleClientSecret = defineString("GOOGLE_CLIENT_SECRET");
const geminiApiKey = defineString("GEMINI_API_KEY");

// Cargar variables de entorno como respaldo
const envClientId = process.env.GOOGLE_CLIENT_ID;
const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const envRedirectUri = process.env.GOOGLE_REDIRECT_URI;

// Interfaz para datos de presentación
export interface PresentationData {
  tema: string;
  asignatura: string;
  objetivosAprendizaje: string[];
  curso: string;
  numDiapositivas: number;
  estilo: string;
  incluirImagenes: boolean;
  contenidoFuente?: string;
  enlaces?: string[];
}

// Interfaz para resultado de creación de presentación
export interface PresentationResult {
  presentationId: string;
  url: string;
  isDemo: boolean;
  authUrl?: string;
}

// Estructura para un slide generado por IA
interface GeneratedSlide {
  title: string;
  content: string;
  imagePrompt?: string; // Para generar una imagen relacionada si es necesario
}

/**
 * Servicio de integración con Google Slides
 */
export class SlidesIntegration {
  private db: FirebaseFirestore.Firestore;
  private oauth2Client: OAuth2Client;
  private genAI: GoogleGenerativeAI;
  
  constructor() {
    // Inicializar Firestore
    this.db = admin.firestore();
    
    // Inicializar cliente OAuth2 (intentar primero parámetros, luego variables de entorno)
    const clientId = googleClientId.value() || envClientId || '1022861144167-0i63eajtaqr3e9rmhll1aebn72gkhq87.apps.googleusercontent.com';
    const clientSecret = googleClientSecret.value() || envClientSecret || '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';
    const redirectUri = envRedirectUri || 'https://us-central1-gestionpedagogica.cloudfunctions.net/oauthCallback';
    
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
    
    console.log(`OAuth configurado con clientId: ${clientId ? 'CONFIGURADO' : 'NO CONFIGURADO'}`);
    
    // Inicializar Gemini AI
    this.genAI = new GoogleGenerativeAI(geminiApiKey.value() || process.env.GEMINI_API_KEY || '');
  }
  
  /**
   * Genera una URL de autorización para OAuth2
   */
  public getAuthorizationUrl(userId: string): string {
    // Codificar el ID del usuario en el estado para recuperarlo en el callback
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/presentations',
        'https://www.googleapis.com/auth/drive'
      ],
      state: state,
      prompt: 'consent' // Siempre pedir consentimiento para obtener refresh_token
    });
  }
  
  /**
   * Procesa el callback de OAuth2 y guarda los tokens
   */
  public async handleOAuthCallback(code: string, state: string): Promise<string> {
    try {
      // Decodificar el estado para obtener el ID del usuario
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const userId = stateData.userId;
      
      if (!userId) {
        throw new Error('ID de usuario inválido en el estado');
      }
      
      // Intercambiar el código por tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Verificar que tenemos los tokens necesarios
      if (!tokens.access_token) {
        throw new Error('No se recibió token de acceso');
      }
      
      // Guardar los tokens en Firestore
      await this.db.collection('userTokens').doc(userId).set({
        ...tokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Tokens de OAuth guardados para el usuario: ${userId}`);
      
      return userId;
    } catch (error) {
      console.error('Error en el procesamiento del callback de OAuth:', error);
      throw error;
    }
  }
  
  /**
   * Obtiene un cliente OAuth autorizado para un usuario
   */
  private async getAuthorizedClient(userId: string): Promise<OAuth2Client> {
    // Obtener tokens desde Firestore
    const tokenDoc = await this.db.collection('userTokens').doc(userId).get();
    
    if (!tokenDoc.exists) {
      throw new Error('El usuario no ha autorizado el acceso a Google Slides');
    }
    
    const tokens = tokenDoc.data();
    
    if (!tokens) {
      throw new Error('Tokens de autorización no encontrados');
    }
    
    // Configurar el cliente con los tokens
    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      token_type: tokens.token_type || 'Bearer',
      id_token: tokens.id_token,
      scope: tokens.scope
    });
    
    return this.oauth2Client;
  }
  
  /**
   * Genera contenido para una presentación usando IA
   */
  private async generatePresentationContent(data: PresentationData): Promise<GeneratedSlide[]> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Construir el prompt para la IA
    const prompt = `
    Genera el contenido para una presentación de ${data.numDiapositivas} diapositivas sobre "${data.tema}" 
    para la asignatura "${data.asignatura}" de nivel "${data.curso}".
    
    Los objetivos de aprendizaje son:
    ${data.objetivosAprendizaje.map(oa => `- ${oa}`).join('\n')}
    
    ${data.contenidoFuente ? `Contenido de referencia: ${data.contenidoFuente}` : ''}
    ${data.enlaces && data.enlaces.length > 0 ? `Enlaces de referencia: ${data.enlaces.join(', ')}` : ''}
    
    El estilo debe ser: ${data.estilo === 'visual' ? 'Visual con muchos elementos gráficos' : 'Sobrio y académico'}
    
    Devuelve el contenido formateado como un array JSON donde cada elemento tiene:
    - title: Título de la diapositiva
    - content: Contenido detallado de la diapositiva
    ${data.incluirImagenes ? '- imagePrompt: Descripción breve para generar una imagen relacionada' : ''}
    
    Asegúrate de que la primera diapositiva sea una introducción y la última una conclusión.
    `;
    
    try {
      // Llamar a Gemini AI
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extraer el JSON del texto de respuesta
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as GeneratedSlide[];
      } else {
        // Si no podemos extraer JSON, crear un formato básico
        return this.createDefaultSlides(data);
      }
    } catch (error) {
      console.error('Error al generar contenido con IA:', error);
      return this.createDefaultSlides(data);
    }
  }
  
  /**
   * Crea slides predeterminados en caso de fallo de la IA
   */
  private createDefaultSlides(data: PresentationData): GeneratedSlide[] {
    const slides: GeneratedSlide[] = [
      {
        title: `${data.tema}`,
        content: `Asignatura: ${data.asignatura}\nCurso: ${data.curso}`,
      }
    ];
    
    // Diapositiva de objetivos
    slides.push({
      title: 'Objetivos de Aprendizaje',
      content: data.objetivosAprendizaje.join('\n\n')
    });
    
    // Diapositivas intermedias
    for (let i = 0; i < data.numDiapositivas - 3; i++) {
      slides.push({
        title: `Contenido ${i + 1}`,
        content: `Esta diapositiva contiene información sobre ${data.tema}`
      });
    }
    
    // Diapositiva de conclusión
    slides.push({
      title: 'Conclusiones',
      content: `Resumen de los puntos principales sobre ${data.tema}`
    });
    
    return slides;
  }
  
  /**
   * Crea una presentación en Google Slides usando OAuth del usuario
   */
  public async createPresentation(userId: string, data: PresentationData): Promise<PresentationResult> {
    try {
      // Obtener cliente autorizado
      const authClient = await this.getAuthorizedClient(userId);
      
      // Inicializar APIs
      const slides = google.slides({ version: 'v1', auth: authClient });
      const drive = google.drive({ version: 'v3', auth: authClient });
      
      // Generar contenido para la presentación
      const slidesContent = await this.generatePresentationContent(data);
      
      // Crear presentación vacía
      const title = `${data.asignatura} - ${data.tema} (${data.curso})`;
      const res = await slides.presentations.create({
        requestBody: {
          title
        }
      });
      
      const presentationId = res.data.presentationId;
      if (!presentationId) {
        throw new Error('No se pudo obtener el ID de la presentación');
      }
      
      // Crear las diapositivas con el contenido generado
      await this.addSlidesToPresentation(slides, presentationId, slidesContent);
      
      // Configurar permisos
      await drive.permissions.create({
        fileId: presentationId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
      
      console.log(`Presentación creada con éxito. ID: ${presentationId}`);
      
      return {
        presentationId,
        url: `https://docs.google.com/presentation/d/${presentationId}/edit`,
        isDemo: false
      };
    } catch (error) {
      console.error('Error al crear presentación:', error);
      
      // Si el error es de autenticación, generar URL de autorización
      if (this.isAuthError(error)) {
        const authUrl = this.getAuthorizationUrl(userId);
        return {
          presentationId: `demo-${Date.now()}`,
          url: `https://docs.google.com/presentation/d/demo-${Date.now()}/edit`,
          isDemo: true,
          authUrl
        };
      }
      
      // Para otros errores, devolver presentación demo
      return {
        presentationId: `demo-${Date.now()}`,
        url: `https://docs.google.com/presentation/d/demo-${Date.now()}/edit`,
        isDemo: true
      };
    }
  }
  
  /**
   * Añade diapositivas a una presentación existente
   */
  private async addSlidesToPresentation(
    slidesClient: any, 
    presentationId: string, 
    slidesContent: GeneratedSlide[]
  ): Promise<void> {
    // Crear las solicitudes para la API
    const requests = [];
    
    // Para cada diapositiva en el contenido generado
    for (let i = 0; i < slidesContent.length; i++) {
      const slide = slidesContent[i];
      const slideId = `slide_${i}`;
      const titleId = `title_${i}`;
      const contentId = `content_${i}`;
      
      // Crear diapositiva
      requests.push({
        createSlide: {
          objectId: slideId,
          slideLayoutReference: {
            predefinedLayout: 'TITLE_AND_BODY'
          },
          placeholderIdMappings: [
            {
              layoutPlaceholder: {
                type: 'TITLE'
              },
              objectId: titleId
            },
            {
              layoutPlaceholder: {
                type: 'BODY'
              },
              objectId: contentId
            }
          ]
        }
      });
      
      // Insertar título
      requests.push({
        insertText: {
          objectId: titleId,
          text: slide.title
        }
      });
      
      // Insertar contenido
      requests.push({
        insertText: {
          objectId: contentId,
          text: slide.content
        }
      });
      
      // Si hay un prompt para imagen, podríamos añadir una imagen en el futuro
      // TODO: Implementar generación de imágenes
    }
    
    // Ejecutar todas las solicitudes
    if (requests.length > 0) {
      await slidesClient.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests
        }
      });
    }
  }
  
  /**
   * Verifica si un error es de autenticación
   */
  private isAuthError(error: any): boolean {
    if (!error) return false;
    
    const errorString = JSON.stringify(error).toLowerCase();
    return (
      errorString.includes('auth') || 
      errorString.includes('unauthorized') || 
      errorString.includes('unauthenticated') ||
      errorString.includes('permission') ||
      errorString.includes('token')
    );
  }
}
