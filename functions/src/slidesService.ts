/**
 * Servicio para trabajar con Google Slides API
 */
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_OAUTH_CONFIG } from './credentials/oauth-config';

// Cliente OAuth2 para autenticación
const oauth2Client = new OAuth2Client(
  GOOGLE_OAUTH_CONFIG.clientId,
  GOOGLE_OAUTH_CONFIG.clientSecret,
  GOOGLE_OAUTH_CONFIG.redirectUri
);

// Función para generar URL de autorización
export const getAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_OAUTH_CONFIG.scopes,
  });
};

// Función para obtener tokens a partir del código de autorización
export const getTokensFromCode = async (code: string) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

// Función para configurar el cliente con los tokens existentes
export const setCredentials = (tokens: any) => {
  oauth2Client.setCredentials(tokens);
};

/**
 * Crea una nueva presentación en Google Slides
 * @param title Título de la presentación
 * @param userId ID del usuario (para registro)
 * @returns URL de la presentación creada y su ID
 */
export const createPresentation = async (title: string, userId: string) => {
  try {
    // Crear cliente de Slides con el cliente OAuth
    const slides = google.slides({ version: 'v1', auth: oauth2Client });
    
    // Crear una presentación vacía
    const presentation = await slides.presentations.create({
      requestBody: {
        title,
      },
    });
    
    if (!presentation.data.presentationId) {
      throw new Error('No se pudo crear la presentación');
    }
    
    const presentationId = presentation.data.presentationId;
    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
    
    console.log(`Presentación creada con ID: ${presentationId} para usuario: ${userId}`);
    
    return { 
      presentationId, 
      presentationUrl
    };
  } catch (error: any) {
    console.error('Error al crear la presentación en Google Slides:', error);
    throw new Error(`Error al crear la presentación: ${error.message}`);
  }
};

/**
 * Añade contenido a una presentación existente
 * @param presentationId ID de la presentación
 * @param slides Array de objetos con el contenido de cada diapositiva
 */
export const addSlidesToPresentation = async (
  presentationId: string, 
  slidesContent: Array<{
    title: string;
    content: string;
    imageUrl?: string;
  }>
) => {
  try {
    // Crear cliente de Slides con el cliente OAuth
    const slides = google.slides({ version: 'v1', auth: oauth2Client });
    
    // Para cada diapositiva que queremos añadir
    for (const slide of slidesContent) {
      // Crear una nueva diapositiva con un diseño de título y contenido
      const createSlideResponse = await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [
            {
              createSlide: {
                slideLayoutReference: {
                  predefinedLayout: 'TITLE_AND_BODY',
                },
              },
            },
          ],
        },
      });
      
      // Obtener el ID de la diapositiva creada
      const createdSlideId = createSlideResponse.data.replies?.[0]?.createSlide?.objectId;
      
      if (!createdSlideId) {
        console.error('No se pudo obtener el ID de la diapositiva creada');
        continue;
      }
      
      // Actualizar el título y el contenido de la diapositiva
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [
            // Actualizar el título
            {
              insertText: {
                objectId: `${createdSlideId}_title`, // ID del elemento de título
                text: slide.title,
              },
            },
            // Actualizar el contenido
            {
              insertText: {
                objectId: `${createdSlideId}_body`, // ID del elemento de cuerpo
                text: slide.content,
              },
            },
          ],
        },
      });
      
      // Si hay una URL de imagen, añadir la imagen
      if (slide.imageUrl) {
        // Esta implementación es simplificada y puede requerir ajustes
        // dependiendo de cómo se manejen las imágenes
        await slides.presentations.batchUpdate({
          presentationId,
          requestBody: {
            requests: [
              {
                createImage: {
                  url: slide.imageUrl,
                  elementProperties: {
                    pageObjectId: createdSlideId,
                    size: {
                      height: { magnitude: 100, unit: 'PT' },
                      width: { magnitude: 200, unit: 'PT' },
                    },
                    transform: {
                      scaleX: 1,
                      scaleY: 1,
                      translateX: 350,
                      translateY: 100,
                      unit: 'PT',
                    },
                  },
                },
              },
            ],
          },
        });
      }
    }
    
    console.log(`Se añadieron ${slidesContent.length} diapositivas a la presentación ${presentationId}`);
    return true;
  } catch (error: any) {
    console.error('Error al añadir diapositivas a la presentación:', error);
    throw new Error(`Error al actualizar la presentación: ${error.message}`);
  }
};

/**
 * Genera una presentación completa con título y contenido
 */
export const generateCompletePresentation = async (
  title: string,
  userId: string,
  slidesContent: Array<{
    title: string;
    content: string;
    imageUrl?: string;
  }>
) => {
  // Crear la presentación vacía
  const { presentationId, presentationUrl } = await createPresentation(title, userId);
  
  // Añadir contenido a la presentación
  await addSlidesToPresentation(presentationId, slidesContent);
  
  return {
    presentationId,
    presentationUrl,
    isDemo: false
  };
};
