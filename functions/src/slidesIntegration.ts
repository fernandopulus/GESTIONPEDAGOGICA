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
  incluirActividades?: boolean;
  incluirEvaluacion?: boolean;
  formatoPedagogico?: boolean;
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
  layout?: string; // Tipo de layout de la diapositiva
  imagePrompt?: string; // Para generar una imagen relacionada si es necesario
  designNotes?: string; // Notas sobre el diseño visual
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
    const redirectUri = envRedirectUri || 'https://us-central1-planificador-145df.cloudfunctions.net/oauthCallback';
    
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
    // Obtener tokens desde Firestore - primero intentar con userId
    let tokenDoc = await this.db.collection('userTokens').doc(userId).get();
    let tokens = tokenDoc.exists ? tokenDoc.data() : null;
    
    // Si no existe con userId, buscar por userInfo en todos los documentos
    if (!tokens) {
      const tokenQuery = await this.db.collection('userTokens').get();
      tokenQuery.forEach(doc => {
        const data = doc.data();
        // Si encontramos tokens asociados con un email que coincida con userId
        if (!tokens && (doc.id === userId || doc.id.includes('@'))) {
          tokens = data;
          // Migrar los tokens al documento correcto con userId
          this.db.collection('userTokens').doc(userId).set(data).catch(console.error);
        }
      });
    }
    
    if (!tokens) {
      throw new Error('El usuario no ha autorizado el acceso a Google Slides');
    }
    
    if (!tokens.access_token) {
      throw new Error('Tokens de autorización no encontrados o inválidos');
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
   * Obtiene la descripción detallada de un estilo de presentación
   */
  private getEstiloDescription(estilo: string): string {
    const estilos = {
      'sobrio': 'Académico y sobrio - Enfoque formal y riguroso, ideal para contenido teórico',
      'visual': 'Visual y dinámico - Rico en elementos gráficos, diagramas y contenido visual atractivo',
      'interactivo': 'Interactivo con actividades - Incluye ejercicios prácticos, discusiones y participación activa',
      'profesional': 'Profesional y corporativo - Formato business con datos, casos reales y aplicación práctica'
    };
    return estilos[estilo as keyof typeof estilos] || estilos['sobrio'];
  }

  /**
   * Genera contenido para una presentación usando IA
   */
  private async generatePresentationContent(data: PresentationData): Promise<GeneratedSlide[]> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Construir el prompt mejorado para la IA
    const prompt = `
    Eres un experto diseñador instruccional y profesor de ${data.asignatura}. Genera el contenido pedagógico COMPLETO y DETALLADO para una presentación de ${data.numDiapositivas} diapositivas sobre "${data.tema}" para estudiantes de ${data.curso}.

    OBJETIVOS DE APRENDIZAJE:
    ${data.objetivosAprendizaje.map(oa => `- ${oa}`).join('\n')}

    ${data.contenidoFuente ? `CONTENIDO DE REFERENCIA:\n${data.contenidoFuente}\n` : ''}
    ${data.enlaces && data.enlaces.length > 0 ? `FUENTES ADICIONALES:\n${data.enlaces.join(', ')}\n` : ''}

    CONFIGURACIÓN PEDAGÓGICA:
    - Estilo: ${this.getEstiloDescription(data.estilo)}
    - Incluir imágenes: ${data.incluirImagenes ? 'SÍ - Proporciona descripciones detalladas para imágenes educativas' : 'NO'}
    - Incluir actividades: ${data.incluirActividades ? 'SÍ - Incorpora ejercicios prácticos y actividades de aprendizaje' : 'NO'}
    - Incluir evaluación: ${data.incluirEvaluacion ? 'SÍ - Añade elementos de evaluación formativa y reflexión' : 'NO'}
    - Formato pedagógico avanzado: ${data.formatoPedagogico ? 'SÍ - Aplica principios de diseño instruccional avanzados' : 'NO'}

    INSTRUCCIONES ESPECÍFICAS:
    1. CADA diapositiva debe tener contenido SUSTANCIAL y educativo (mínimo 200 palabras por diapositiva)
    2. Incluye ejemplos concretos, casos prácticos y analogías comprensibles
    3. Usa un lenguaje apropiado para el nivel ${data.curso}
    4. Estructura pedagógica clara: motivación → conceptos → ejemplos → práctica → evaluación
    5. Incorpora elementos de aprendizaje activo y participativo
    6. Incluye preguntas reflexivas y elementos de metacognición
    
    ${data.incluirActividades ? `
    ACTIVIDADES A INCLUIR:
    - Ejercicios de aplicación práctica
    - Preguntas de discusión grupal  
    - Casos de estudio relevantes
    - Actividades de pensamiento crítico
    ` : ''}

    ${data.incluirEvaluacion ? `
    ELEMENTOS DE EVALUACIÓN:
    - Preguntas de autoevaluación
    - Rúbricas simples de comprensión
    - Reflexiones metacognitivas
    - Aplicación práctica de conceptos
    ` : ''}

    ESTRUCTURA REQUERIDA:
    - Diapositiva 1: Introducción motivadora con gancho inicial y relevancia del tema
    - Diapositivas 2-3: Presentación de conceptos fundamentales con ejemplos
    - Diapositivas 4-${Math.max(4, data.numDiapositivas-3)}: Desarrollo progresivo con aplicaciones prácticas
    ${data.incluirActividades ? `- Incluir al menos 2 diapositivas con actividades prácticas\n` : ''}
    ${data.incluirEvaluacion ? `- Incluir 1 diapositiva de evaluación formativa\n` : ''}
    - Diapositiva ${data.numDiapositivas}: Síntesis, aplicación real y próximos pasos

    FORMATO DE RESPUESTA (JSON válido):
    [
      {
        "title": "Título específico y atractivo (máximo 8 palabras)",
        "content": "Contenido detallado con:\\n• Conceptos clave explicados claramente\\n• Ejemplos específicos del contexto de ${data.curso}\\n• Preguntas reflexivas para el estudiante\\n• Conexiones con conocimientos previos${data.incluirActividades ? '\\n• Actividad práctica específica' : ''}",
        "layout": "TITLE_AND_BODY" | "TITLE_ONLY" | "BLANK",
        ${data.incluirImagenes ? '"imagePrompt": "Descripción específica para imagen educativa que apoye el aprendizaje (ej: diagrama, infografía, fotografía relevante)",' : ''}
        "designNotes": "Sugerencias específicas de formato visual: colores, tipografía, elementos gráficos"
      }
    ]

    IMPORTANTE: 
    - Responde ÚNICAMENTE con el array JSON válido, sin texto adicional
    - Asegúrate de que cada diapositiva construya sobre la anterior
    - El contenido debe ser específico para ${data.asignatura} y ${data.curso}
    - Incluye conexiones entre diapositivas para mantener la coherencia narrativa
    `;
    
    try {
      console.log('Generando contenido con IA mejorada para:', data.tema);
      console.log('Configuración:', { 
        estilo: data.estilo, 
        actividades: data.incluirActividades, 
        evaluacion: data.incluirEvaluacion,
        pedagogico: data.formatoPedagogico 
      });
      
      // Llamar a Gemini AI
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      // Limpiar la respuesta para extraer solo el JSON
      let cleanedResponse = responseText;
      
      // Remover markdown code blocks si existen
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      }
      if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
      }
      
      // Extraer el JSON del texto de respuesta
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const slides = JSON.parse(jsonMatch[0]) as GeneratedSlide[];
        console.log(`Contenido generado exitosamente: ${slides.length} diapositivas`);
        return slides;
      } else {
        console.log('No se pudo extraer JSON, usando contenido por defecto');
        return this.createEnhancedDefaultSlides(data);
      }
    } catch (error) {
      console.error('Error al generar contenido con IA:', error);
      return this.createEnhancedDefaultSlides(data);
    }
  }
  
  /**
   * Crea slides predeterminados mejorados en caso de fallo de la IA
   */
  private createEnhancedDefaultSlides(data: PresentationData): GeneratedSlide[] {
    const slides: GeneratedSlide[] = [];
    
    // Diapositiva de portada
    slides.push({
      title: `${data.tema}`,
      content: `${data.asignatura} - ${data.curso}\n\n¡Bienvenidos a esta sesión de aprendizaje!\n\nEn esta presentación exploraremos:\n• Los conceptos fundamentales de ${data.tema}\n• Aplicaciones prácticas en ${data.asignatura}\n• Actividades de aprendizaje interactivas\n\n"El conocimiento es poder, pero el conocimiento compartido es superación"`,
      layout: 'TITLE_AND_BODY',
      imagePrompt: data.incluirImagenes ? `Imagen educativa sobre ${data.tema} para estudiantes de ${data.curso}` : undefined,
      designNotes: 'Usar colores institucionales, tipografía clara y legible'
    });
    
    // Diapositiva de objetivos
    slides.push({
      title: '🎯 Objetivos de Aprendizaje',
      content: `Al finalizar esta sesión, serás capaz de:\n\n${data.objetivosAprendizaje.map((oa, index) => `${index + 1}. ${oa}`).join('\n\n')}\n\n💡 Recuerda: Cada objetivo está diseñado para construir sobre el anterior, creando un aprendizaje progresivo y significativo.`,
      layout: 'TITLE_AND_BODY',
      designNotes: 'Usar iconos para cada objetivo, colores diferenciados'
    });
    
    // Diapositivas de desarrollo del contenido
    const numContenido = data.numDiapositivas - 3; // Portada, objetivos y conclusión
    for (let i = 0; i < numContenido; i++) {
      const topics = this.getTopicsForSubject(data.asignatura, data.tema);
      const currentTopic = topics[i % topics.length];
      
      slides.push({
        title: `📚 ${currentTopic.title}`,
        content: `${currentTopic.content}\n\n🔍 **Ejemplo práctico:**\n${currentTopic.example}\n\n💭 **Para reflexionar:**\n${currentTopic.reflection}\n\n📝 **Actividad sugerida:**\n${currentTopic.activity}`,
        layout: 'TITLE_AND_BODY',
        imagePrompt: data.incluirImagenes ? `${currentTopic.imagePrompt}` : undefined,
        designNotes: currentTopic.designNotes
      });
    }
    
    // Diapositiva de conclusión
    slides.push({
      title: '✅ Síntesis y Evaluación',
      content: `🎉 **¡Excelente trabajo!**\n\nHemos explorado ${data.tema} y ahora puedes:\n\n${data.objetivosAprendizaje.map((oa, index) => `✓ ${oa}`).join('\n')}\n\n🚀 **Próximos pasos:**\n• Practica los conceptos aprendidos\n• Realiza las actividades propuestas\n• Conecta este conocimiento con experiencias previas\n\n💬 **Pregunta final:**\n¿Cómo aplicarías estos conceptos en tu vida cotidiana o futura profesión?`,
      layout: 'TITLE_AND_BODY',
      imagePrompt: data.incluirImagenes ? `Imagen motivacional de estudiantes aplicando conocimientos de ${data.asignatura}` : undefined,
      designNotes: 'Usar colores alegres y motivacionales, iconos de logro'
    });
    
    return slides;
  }
  
  /**
   * Obtiene temas específicos según la asignatura
   */
  private getTopicsForSubject(asignatura: string, tema: string): any[] {
    const baseTopics = [
      {
        title: `Fundamentos de ${tema}`,
        content: `Los conceptos fundamentales de ${tema} en ${asignatura} nos permiten comprender las bases teóricas y prácticas de este importante campo de estudio.`,
        example: `En la vida cotidiana, podemos observar ${tema} cuando...`,
        reflection: `¿Cómo se relaciona ${tema} con lo que ya conoces sobre ${asignatura}?`,
        activity: `Identifica 3 ejemplos de ${tema} en tu entorno cercano`,
        imagePrompt: `Diagrama educativo mostrando los fundamentos de ${tema}`,
        designNotes: 'Usar esquemas y diagramas claros'
      },
      {
        title: `Aplicaciones Prácticas`,
        content: `Las aplicaciones de ${tema} en el mundo real demuestran la relevancia y utilidad de estos conceptos en diversos contextos profesionales y personales.`,
        example: `Un caso real donde esto se aplica es...`,
        reflection: `¿Qué beneficios aporta entender ${tema} en tu área de interés?`,
        activity: `Diseña un mini-proyecto que incorpore estos conceptos`,
        imagePrompt: `Profesionales aplicando conceptos de ${tema} en ${asignatura}`,
        designNotes: 'Mostrar conexiones del mundo real, usar fotografías'
      },
      {
        title: `Análisis y Evaluación`,
        content: `El análisis crítico de ${tema} nos permite evaluar diferentes perspectivas y desarrollar un pensamiento más profundo sobre estos conceptos.`,
        example: `Comparemos diferentes enfoques para...`,
        reflection: `¿Cuáles son las fortalezas y debilidades de cada enfoque?`,
        activity: `Crea un cuadro comparativo de las diferentes perspectivas`,
        imagePrompt: `Estudiantes analizando y debatiendo sobre ${tema}`,
        designNotes: 'Usar tablas comparativas y elementos de análisis'
      }
    ];
    
    return baseTopics;
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
   * Añade diapositivas a una presentación existente con formato mejorado
   */
  private async addSlidesToPresentation(
    slidesClient: any, 
    presentationId: string, 
    slidesContent: GeneratedSlide[]
  ): Promise<void> {
    console.log(`Añadiendo ${slidesContent.length} diapositivas con contenido mejorado`);
    
    // Definir colores del tema
    const themeColors = {
      primary: { red: 0.2, green: 0.4, blue: 0.8 },      // Azul institucional
      secondary: { red: 0.1, green: 0.3, blue: 0.6 },    // Azul oscuro
      accent: { red: 0.9, green: 0.5, blue: 0.1 },       // Naranja
      background: { red: 0.98, green: 0.98, blue: 1.0 },  // Azul muy claro
      text: { red: 0.2, green: 0.2, blue: 0.2 }           // Gris oscuro
    };
    
    const requests = [];
    
    // Para cada diapositiva en el contenido generado
    for (let i = 0; i < slidesContent.length; i++) {
      const slide = slidesContent[i];
      const slideId = `slide_${i}`;
      const titleId = `title_${i}`;
      const contentId = `content_${i}`;
      
      // Determinar el layout
      const layout = slide.layout || 'TITLE_AND_BODY';
      
      // Crear diapositiva
      requests.push({
        createSlide: {
          objectId: slideId,
          slideLayoutReference: {
            predefinedLayout: layout
          },
          placeholderIdMappings: [
            {
              layoutPlaceholder: { type: 'TITLE' },
              objectId: titleId
            },
            ...(layout !== 'TITLE_ONLY' ? [{
              layoutPlaceholder: { type: 'BODY' },
              objectId: contentId
            }] : [])
          ]
        }
      });
      
      // Configurar fondo de la diapositiva
      if (i === 0) { // Portada con fondo especial
        requests.push({
          updatePageProperties: {
            objectId: slideId,
            pageProperties: {
              pageBackgroundFill: {
                solidFill: {
                  color: themeColors.background
                }
              }
            },
            fields: 'pageBackgroundFill'
          }
        });
      }
      
      // Insertar y formatear título
      requests.push({
        insertText: {
          objectId: titleId,
          text: slide.title
        }
      });
      
      // Formatear título
      requests.push({
        updateTextStyle: {
          objectId: titleId,
          style: {
            fontSize: { magnitude: i === 0 ? 36 : 28, unit: 'PT' },
            foregroundColor: { opaqueColor: { rgbColor: i === 0 ? themeColors.primary : themeColors.secondary } },
            bold: true,
            fontFamily: 'Arial'
          },
          fields: 'fontSize,foregroundColor,bold,fontFamily'
        }
      });
      
      // Insertar contenido si no es TITLE_ONLY
      if (layout !== 'TITLE_ONLY' && slide.content) {
        requests.push({
          insertText: {
            objectId: contentId,
            text: slide.content
          }
        });
        
        // Formatear contenido
        requests.push({
          updateTextStyle: {
            objectId: contentId,
            style: {
              fontSize: { magnitude: 14, unit: 'PT' },
              foregroundColor: { opaqueColor: { rgbColor: themeColors.text } },
              fontFamily: 'Arial'
            },
            fields: 'fontSize,foregroundColor,fontFamily'
          }
        });
        
        // Agregar formato especial para elementos con bullets
        if (slide.content.includes('•') || slide.content.includes('✓') || slide.content.includes('🎯')) {
          const bulletRanges = this.findBulletRanges(slide.content);
          bulletRanges.forEach(range => {
            requests.push({
              createParagraphBullets: {
                objectId: contentId,
                textRange: range,
                bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
              }
            });
          });
        }
      }
      
      // Agregar formas decorativas para mejorar el diseño visual
      if (i === 0) { // Portada - agregar elementos decorativos
        const decorativeShapeId = `decoration_${i}`;
        requests.push({
          createShape: {
            objectId: decorativeShapeId,
            shapeType: 'RECTANGLE',
            elementProperties: {
              pageObjectId: slideId,
              size: {
                height: { magnitude: 20, unit: 'PT' },
                width: { magnitude: 500, unit: 'PT' }
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: { magnitude: 50, unit: 'PT' },
                translateY: { magnitude: 450, unit: 'PT' },
                unit: 'PT'
              }
            }
          }
        });
        
        // Colorear la forma decorativa
        requests.push({
          updateShapeProperties: {
            objectId: decorativeShapeId,
            shapeProperties: {
              shapeBackgroundFill: {
                solidFill: {
                  color: themeColors.accent
                }
              }
            },
            fields: 'shapeBackgroundFill'
          }
        });
      }
      
      // Si hay prompt para imagen, agregar placeholder para imagen
      if (slide.imagePrompt) {
        const imageId = `image_${i}`;
        requests.push({
          createImage: {
            objectId: imageId,
            elementProperties: {
              pageObjectId: slideId,
              size: {
                height: { magnitude: 200, unit: 'PT' },
                width: { magnitude: 300, unit: 'PT' }
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: { magnitude: 400, unit: 'PT' },
                translateY: { magnitude: 150, unit: 'PT' },
                unit: 'PT'
              }
            },
            url: 'https://via.placeholder.com/300x200/4472C4/FFFFFF?text=Imagen+Educativa' // Placeholder hasta implementar generación real
          }
        });
      }
    }
    
    // Ejecutar todas las solicitudes en lotes para evitar límites de API
    const batchSize = 50;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      try {
        await slidesClient.presentations.batchUpdate({
          presentationId,
          requestBody: { requests: batch }
        });
        console.log(`Lote ${Math.floor(i/batchSize) + 1} de ${Math.ceil(requests.length/batchSize)} procesado`);
      } catch (error) {
        console.error(`Error en lote ${Math.floor(i/batchSize) + 1}:`, error);
      }
    }
    
    console.log('Presentación creada con formato mejorado');
  }
  
  /**
   * Encuentra rangos de texto que deben ser formateados como bullets
   */
  private findBulletRanges(text: string): Array<{startIndex: number, endIndex: number}> {
    const lines = text.split('\n');
    const ranges: Array<{startIndex: number, endIndex: number}> = [];
    let currentIndex = 0;
    
    lines.forEach(line => {
      if (line.trim().startsWith('•') || line.trim().startsWith('✓') || line.trim().startsWith('-')) {
        ranges.push({
          startIndex: currentIndex,
          endIndex: currentIndex + line.length
        });
      }
      currentIndex += line.length + 1; // +1 for the newline
    });
    
    return ranges;
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
