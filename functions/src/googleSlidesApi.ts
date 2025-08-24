import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import * as functions from 'firebase-functions/v2';

// Interfaz para los datos de presentación
interface PresentacionData {
  tema: string;
  asignatura: string;
  objetivosAprendizaje: string;
  curso: string;
  numDiapositivas: number;
  estilo: string;
  incluirImagenes: boolean;
  contenidoFuente?: string;
  enlaces?: string[];
}

// Interfaz para la respuesta de creación de presentación
interface PresentacionResponse {
  url: string;
  presentacionId: string;
  message?: string;
}

// Crear cliente JWT para autenticar con Google API
const createAuthClient = () => {
  // Obtener credenciales del entorno o configuración
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}');
  
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Credenciales de Google no configuradas correctamente');
  }
  
  // Crear cliente JWT
  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/presentations', 'https://www.googleapis.com/auth/drive'],
  });
}

// Crear una nueva presentación
export const createPresentation = async (data: PresentacionData): Promise<PresentacionResponse> => {
  try {
    // Crear cliente autenticado
    const auth = createAuthClient();
    
    // Inicializar Slides API
    const slides = google.slides({version: 'v1', auth});
    const drive = google.drive({version: 'v3', auth});
    
    // Crear presentación vacía
    const title = `${data.tema} - ${data.asignatura} (${data.curso})`;
    const presentationResponse = await slides.presentations.create({
      requestBody: {
        title,
      }
    });
    
    const presentationId = presentationResponse.data.presentationId!;
    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
    
    functions.logger.info(`Presentación creada con ID: ${presentationId}`);
    
    // Generar contenido para las diapositivas basado en los datos proporcionados
    await generateSlides(slides, presentationId, data);
    
    // Establecer permisos de acceso (público con enlace)
    await drive.permissions.create({
      fileId: presentationId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      }
    });
    
    return {
      presentacionId: presentationId,
      url: presentationUrl,
      message: 'Presentación creada exitosamente',
    };
  } catch (error) {
    functions.logger.error('Error al crear presentación:', error);
    throw error;
  }
};

// Generar diapositivas con contenido
async function generateSlides(slides: any, presentationId: string, data: PresentacionData) {
  // Crear peticiones para la API
  const requests = [];
  
  // Añadir diapositiva de título
  requests.push({
    createSlide: {
      objectId: 'titleSlide',
      slideLayoutReference: {
        predefinedLayout: 'TITLE',
      },
      placeholderIdMappings: [
        {
          layoutPlaceholder: {
            type: 'TITLE',
          },
          objectId: 'titleText',
        },
        {
          layoutPlaceholder: {
            type: 'SUBTITLE',
          },
          objectId: 'subtitleText',
        },
      ],
    },
  });
  
  // Insertar texto en la diapositiva de título
  requests.push({
    insertText: {
      objectId: 'titleText',
      text: data.tema,
    },
  });
  
  requests.push({
    insertText: {
      objectId: 'subtitleText',
      text: `${data.asignatura} - ${data.curso}`,
    },
  });
  
  // Añadir diapositiva de objetivos
  requests.push({
    createSlide: {
      objectId: 'objectivesSlide',
      slideLayoutReference: {
        predefinedLayout: 'TITLE_AND_BODY',
      },
      placeholderIdMappings: [
        {
          layoutPlaceholder: {
            type: 'TITLE',
          },
          objectId: 'objectivesTitle',
        },
        {
          layoutPlaceholder: {
            type: 'BODY',
          },
          objectId: 'objectivesBody',
        },
      ],
    },
  });
  
  // Insertar texto en la diapositiva de objetivos
  requests.push({
    insertText: {
      objectId: 'objectivesTitle',
      text: 'Objetivos de Aprendizaje',
    },
  });
  
  requests.push({
    insertText: {
      objectId: 'objectivesBody',
      text: data.objetivosAprendizaje,
    },
  });
  
  // Añadir diapositivas de contenido (según el número especificado)
  const contentObjectives = parseContentObjectives(data.objetivosAprendizaje);
  const slidesToCreate = Math.min(contentObjectives.length, data.numDiapositivas - 2);
  
  for (let i = 0; i < slidesToCreate; i++) {
    const slideId = `contentSlide${i}`;
    const titleId = `contentTitle${i}`;
    const bodyId = `contentBody${i}`;
    
    requests.push({
      createSlide: {
        objectId: slideId,
        slideLayoutReference: {
          predefinedLayout: 'TITLE_AND_BODY',
        },
        placeholderIdMappings: [
          {
            layoutPlaceholder: {
              type: 'TITLE',
            },
            objectId: titleId,
          },
          {
            layoutPlaceholder: {
              type: 'BODY',
            },
            objectId: bodyId,
          },
        ],
      },
    });
    
    requests.push({
      insertText: {
        objectId: titleId,
        text: `Contenido ${i + 1}`,
      },
    });
    
    requests.push({
      insertText: {
        objectId: bodyId,
        text: contentObjectives[i] || `Contenido para el objetivo ${i + 1}`,
      },
    });
  }
  
  // Ejecutar todas las peticiones
  await slides.presentations.batchUpdate({
    presentationId,
    requestBody: {
      requests,
    },
  });
}

// Función para parsear los objetivos de aprendizaje en fragmentos para las diapositivas
function parseContentObjectives(objetivosText: string): string[] {
  // Intentar dividir por líneas o por puntos
  const lines = objetivosText.split(/\\n|\\r\\n|•|-/).filter(line => line.trim().length > 0);
  
  if (lines.length > 0) {
    return lines;
  }
  
  // Si no hay divisiones claras, dividir por oraciones
  return objetivosText.split(/\\.\\s+/).filter(sentence => sentence.trim().length > 0);
}
