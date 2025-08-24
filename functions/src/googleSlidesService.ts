import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_OAUTH_CONFIG } from './credentials/oauth-config';
import * as admin from 'firebase-admin';

// Interfaz para la solicitud de presentación
interface PresentationRequest {
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

// Interfaz para el resultado de la creación de presentación
interface PresentationResult {
  url: string;
  presentationId: string;
  title: string;
}

export class GoogleSlidesService {
  private oAuth2Client: OAuth2Client;
  private db: FirebaseFirestore.Firestore;

  constructor() {
    this.oAuth2Client = new google.auth.OAuth2(
      GOOGLE_OAUTH_CONFIG.clientId,
      GOOGLE_OAUTH_CONFIG.clientSecret,
      GOOGLE_OAUTH_CONFIG.redirectUri
    );
    
    this.db = admin.firestore();
  }
  
  // Obtener el cliente OAuth2 con token del usuario
  private async getAuthorizedClient(userId: string): Promise<OAuth2Client> {
    // Obtener los tokens de la base de datos para este usuario
    const userTokensDoc = await this.db.collection('userTokens').doc(userId).get();
    
    if (!userTokensDoc.exists) {
      throw new Error('Usuario no autorizado para acceder a Google Slides. Debe completar el proceso de autorización.');
    }
    
    const tokens = userTokensDoc.data();
    if (!tokens || !tokens.refresh_token) {
      throw new Error('Tokens de acceso no válidos. Debe volver a autorizar la aplicación.');
    }
    
    this.oAuth2Client.setCredentials(tokens);
    return this.oAuth2Client;
  }
  
  // Generar una nueva presentación
  public async createPresentation(
    userId: string, 
    request: PresentationRequest
  ): Promise<PresentationResult> {
    try {
      const authClient = await this.getAuthorizedClient(userId);
      const slides = google.slides({ version: 'v1', auth: authClient });
      const drive = google.drive({ version: 'v3', auth: authClient });
      
      // 1. Crear una presentación vacía
      const title = `${request.asignatura} - ${request.tema}`;
      const presentationResponse = await slides.presentations.create({
        requestBody: {
          title: title
        }
      });
      
      if (!presentationResponse.data.presentationId) {
        throw new Error('Error al crear la presentación');
      }
      
      const presentationId = presentationResponse.data.presentationId;
      
      // 2. Estructurar el contenido de la presentación según los requisitos
      const requests = this.generatePresentationContent(request);
      
      // 3. Actualizar la presentación con el contenido generado
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests
        }
      });
      
      // 4. Configurar los permisos para compartir
      await drive.permissions.create({
        fileId: presentationId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
      
      // 5. Devolver la URL y el ID de la presentación
      return {
        url: `https://docs.google.com/presentation/d/${presentationId}/edit`,
        presentationId,
        title
      };
    } catch (error) {
      console.error('Error al crear la presentación con Google Slides:', error);
      throw error;
    }
  }
  
  // Función helper para generar el contenido de la presentación
  private generatePresentationContent(request: PresentationRequest): any[] {
    // Aquí va la lógica para generar las diapositivas según los requisitos
    // Este es un ejemplo simplificado que crearía una estructura básica
    
    const requests = [
      // Diapositiva de título
      {
        createSlide: {
          slideLayoutReference: {
            predefinedLayout: 'TITLE_AND_SUBTITLE'
          },
          placeholderIdMappings: [
            {
              layoutPlaceholder: {
                type: 'TITLE'
              },
              objectId: 'title'
            },
            {
              layoutPlaceholder: {
                type: 'SUBTITLE'
              },
              objectId: 'subtitle'
            }
          ]
        }
      },
      // Insertar texto en el título
      {
        insertText: {
          objectId: 'title',
          text: `${request.asignatura}: ${request.tema}`
        }
      },
      // Insertar texto en el subtítulo
      {
        insertText: {
          objectId: 'subtitle',
          text: `${request.curso} - Objetivos: ${request.objetivosAprendizaje.join(', ')}`
        }
      }
    ];
    
    // Agregar diapositivas de contenido según el número solicitado
    for (let i = 0; i < Math.min(request.numDiapositivas - 1, 10); i++) {
      requests.push(
        // Diapositiva de contenido
        {
          createSlide: {
            slideLayoutReference: {
              predefinedLayout: 'TITLE_AND_BODY'
            },
            placeholderIdMappings: [
              {
                layoutPlaceholder: {
                  type: 'TITLE'
                },
                objectId: `title_${i}`
              },
              {
                layoutPlaceholder: {
                  type: 'BODY'
                },
                objectId: `body_${i}`
              }
            ]
          }
        },
        // Contenido ejemplo (en producción, esto sería generado con AI)
        {
          insertText: {
            objectId: `title_${i}`,
            text: `Tema ${i + 1}`
          }
        },
        {
          insertText: {
            objectId: `body_${i}`,
            text: `Contenido de ejemplo para la diapositiva ${i + 1}. Aquí iría el contenido generado por AI relacionado con el tema "${request.tema}" para la asignatura "${request.asignatura}".`
          }
        }
      );
    }
    
    return requests;
  }
  
  // Generar URL para autorización OAuth
  public getAuthorizationUrl(userId: string): string {
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    return this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_OAUTH_CONFIG.scopes,
      state: state,
      prompt: 'consent' // Asegurar que siempre obtengamos un refresh token
    });
  }
  
  // Procesar el callback de OAuth y guardar los tokens
  public async handleOAuthCallback(code: string, state: string): Promise<string> {
    try {
      // Decodificar el estado para obtener el ID de usuario
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const userId = stateData.userId;
      
      if (!userId) {
        throw new Error('ID de usuario no válido en la solicitud de autorización');
      }
      
      // Intercambiar el código por tokens
      const { tokens } = await this.oAuth2Client.getToken(code);
      
      // Guardar los tokens en Firestore
      await this.db.collection('userTokens').doc(userId).set(tokens);
      
      return userId;
    } catch (error) {
      console.error('Error al procesar el callback de OAuth:', error);
      throw error;
    }
  }
}
