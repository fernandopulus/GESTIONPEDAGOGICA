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
    
    // Inicializar Gemini AI con configuración de headers
    const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
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
      state: state
    });
  }

  /**
   * Maneja el callback de OAuth2 y guarda los tokens
   */
  public async handleOAuthCallback(code: string, state: string): Promise<string> {
    try {
      // Intercambiar el código por tokens de acceso
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Decodificar el estado para recuperar el ID del usuario
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      const userId = decodedState.userId;
      
      // Guardar los tokens en Firestore
      await this.db.collection('oauth_tokens').doc(userId).set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Tokens OAuth guardados para usuario: ${userId}`);
      return userId;
    } catch (error) {
      console.error('Error en callback OAuth:', error);
      throw new Error('Error al procesar autorización');
    }
  }

  /**
   * Obtiene un cliente OAuth2 autorizado para un usuario
   */
  private async getAuthorizedClient(userId: string): Promise<OAuth2Client> {
    try {
      // Obtener tokens de Firestore
      const tokenDoc = await this.db.collection('oauth_tokens').doc(userId).get();
      
      if (!tokenDoc.exists) {
        throw new Error('Usuario no autorizado');
      }
      
      const tokenData = tokenDoc.data();
      if (!tokenData) {
        throw new Error('Datos de token no válidos');
      }
      
      // Configurar el cliente OAuth2 con los tokens
      this.oauth2Client.setCredentials({
        access_token: tokenData.accessToken,
        refresh_token: tokenData.refreshToken,
        expiry_date: tokenData.expiryDate
      });
      
      // Verificar si el token ha expirado y renovarlo si es necesario
      if (tokenData.expiryDate && Date.now() >= tokenData.expiryDate) {
        console.log('Token expirado, renovando...');
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        
        // Actualizar tokens en Firestore
        await this.db.collection('oauth_tokens').doc(userId).update({
          accessToken: credentials.access_token,
          expiryDate: credentials.expiry_date,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        this.oauth2Client.setCredentials(credentials);
      }
      
      return this.oauth2Client;
    } catch (error) {
      console.error('Error al obtener cliente autorizado:', error);
      throw new Error('Error de autorización');
    }
  }

  /**
   * Obtiene descripción del estilo de presentación
   */
  private getEstiloDescription(estilo: string): string {
    const estilos: Record<string, string> = {
      'academico': 'Estilo formal y académico con estructura clara, terminología técnica apropiada y enfoque en la profundidad conceptual',
      'visual': 'Estilo visual dinámico con énfasis en elementos gráficos, diagramas, infografías y representaciones visuales para facilitar la comprensión',
      'interactivo': 'Estilo participativo que incluye preguntas, actividades prácticas, discusiones y elementos que fomenten la participación activa del estudiante',
      'profesional': 'Estilo empresarial con enfoque en aplicaciones prácticas, casos de estudio reales y conexiones con el mundo laboral',
      'sobrio': 'Estilo minimalista y directo, enfocado en contenido esencial sin elementos decorativos excesivos',
      'creativo': 'Estilo innovador y atractivo, con un enfoque original que estimula la imaginación y el pensamiento lateral',
      'minimalista': 'Estilo depurado y esencial, centrado en lo más importante sin elementos distractores'
    };
    
    return estilos[estilo] || estilos['academico'];
  }
  
  /**
   * Obtiene los colores específicos para cada estilo de presentación
   */
  private getStyleColors(estilo: string): any {
    const styles: Record<string, any> = {
      'sobrio': {
        background: { red: 0.98, green: 0.98, blue: 0.98 },
        primary: { red: 0.2, green: 0.2, blue: 0.25 },
        secondary: { red: 0.5, green: 0.5, blue: 0.55 },
        accent: { red: 0.3, green: 0.3, blue: 0.4 },
        text: { red: 0.1, green: 0.1, blue: 0.1 }
      },
      'visual': {
        background: { red: 0.95, green: 0.97, blue: 1.0 },
        primary: { red: 0.0, green: 0.44, blue: 0.8 },
        secondary: { red: 0.2, green: 0.6, blue: 0.9 },
        accent: { red: 1.0, green: 0.6, blue: 0.2 },
        text: { red: 0.1, green: 0.1, blue: 0.1 }
      },
      'academico': {
        background: { red: 0.98, green: 0.96, blue: 0.9 },
        primary: { red: 0.5, green: 0.3, blue: 0.1 },
        secondary: { red: 0.7, green: 0.5, blue: 0.2 },
        accent: { red: 0.3, green: 0.5, blue: 0.7 },
        text: { red: 0.2, green: 0.2, blue: 0.2 }
      },
      'interactivo': {
        background: { red: 0.95, green: 1.0, blue: 0.95 },
        primary: { red: 0.1, green: 0.7, blue: 0.3 },
        secondary: { red: 0.3, green: 0.8, blue: 0.4 },
        accent: { red: 0.9, green: 0.3, blue: 0.5 },
        text: { red: 0.1, green: 0.1, blue: 0.1 }
      },
      'profesional': {
        background: { red: 0.95, green: 0.95, blue: 0.97 },
        primary: { red: 0.2, green: 0.2, blue: 0.5 },
        secondary: { red: 0.1, green: 0.1, blue: 0.3 },
        accent: { red: 0.7, green: 0.0, blue: 0.0 },
        text: { red: 0.1, green: 0.1, blue: 0.1 }
      },
      'creativo': {
        background: { red: 0.98, green: 0.95, blue: 1.0 },
        primary: { red: 0.6, green: 0.2, blue: 0.8 },
        secondary: { red: 0.8, green: 0.3, blue: 0.7 },
        accent: { red: 1.0, green: 0.8, blue: 0.0 },
        text: { red: 0.2, green: 0.2, blue: 0.2 }
      },
      'minimalista': {
        background: { red: 1.0, green: 1.0, blue: 1.0 },
        primary: { red: 0.0, green: 0.0, blue: 0.0 },
        secondary: { red: 0.3, green: 0.3, blue: 0.3 },
        accent: { red: 0.7, green: 0.7, blue: 0.7 },
        text: { red: 0.0, green: 0.0, blue: 0.0 }
      }
    };
    
    return styles[estilo] || styles['sobrio'];
  }

  /**
   * Genera contenido para una presentación usando IA
   */
  private async generatePresentationContent(data: PresentationData): Promise<GeneratedSlide[]> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-pro",
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });
      
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
        console.warn('No se pudo extraer JSON válido de la respuesta de IA');
        throw new Error('Respuesta de IA no válida');
      }
    } catch (error) {
      console.error('Error al generar contenido con IA:', error);
      // Generar contenido de respaldo si falla la IA
      return this.generateFallbackContent(data);
    }
  }
  
  /**
   * Genera contenido de respaldo cuando la IA falla
   */
  private generateFallbackContent(data: PresentationData): GeneratedSlide[] {
    console.log('Generando contenido de respaldo para:', data.tema);
    
    const slides: GeneratedSlide[] = [];
    
    // Diapositiva de introducción
    slides.push({
      title: data.tema,
      content: `${data.asignatura} - ${data.curso}\n\n¡Bienvenidos a esta sesión de aprendizaje!\n\nEn esta presentación exploraremos:\n• Los conceptos fundamentales de ${data.tema}\n• Aplicaciones prácticas en ${data.asignatura}\n• Actividades de aprendizaje interactivas\n\n"El conocimiento es poder, pero el conocimiento compartido es superación"`,
      layout: 'TITLE_AND_BODY',
      imagePrompt: data.incluirImagenes ? 'Imagen representativa del tema educativo' : undefined,
      designNotes: 'Usar colores institucionales y tipografía clara'
    });
    
    // Diapositiva de objetivos
    if (data.objetivosAprendizaje.length > 0) {
      slides.push({
        title: '🎯 Objetivos de Aprendizaje',
        content: `Al finalizar esta sesión, serás capaz de:\n\n${data.objetivosAprendizaje.map((obj, idx) => `${idx + 1}. ${obj}`).join('\n\n')}\n\n💡 Recuerda: Cada objetivo está diseñado para construir sobre el anterior, creando un aprendizaje progresivo y significativo.`,
        layout: 'TITLE_AND_BODY',
        designNotes: 'Usar íconos y viñetas para mejorar la legibilidad'
      });
    }
    
    // Generar diapositivas de contenido según el número solicitado
    const remainingSlides = data.numDiapositivas - slides.length;
    const contentSlides = Math.max(1, remainingSlides);
    
    for (let i = 0; i < contentSlides; i++) {
      let title = '';
      let content = '';
      
      if (i === 0) {
        title = `📚 Fundamentos de ${data.tema}`;
        content = `Los conceptos fundamentales de ${data.tema} en ${data.asignatura} nos permiten comprender las bases teóricas y prácticas de este importante campo de estudio.\n\n🔍 **Ejemplo práctico:**\nEn la vida cotidiana, podemos observar ${data.tema} cuando...\n\n💭 **Para reflexionar:**\n¿Cómo se relaciona ${data.tema} con lo que ya conoces sobre ${data.asignatura}?\n\n📝 **Actividad sugerida:**\nIdentifica 3 ejemplos de ${data.tema} en tu entorno cercano`;
      } else if (i === 1 && contentSlides > 1) {
        title = `📚 Aplicaciones Prácticas`;
        content = `Las aplicaciones de ${data.tema} en el mundo real demuestran la relevancia y utilidad de estos conceptos en diversos contextos profesionales y personales.\n\n🔍 **Ejemplo práctico:**\nUn caso real donde esto se aplica es...\n\n💭 **Para reflexionar:**\n¿Qué beneficios aporta entender ${data.tema} en tu área de interés?\n\n📝 **Actividad sugerida:**\nDiseña un mini-proyecto que incorpore estos conceptos`;
      } else if (i === contentSlides - 1) {
        title = `🎉 Síntesis y Aplicación`;
        content = `🎉 **¡Excelente trabajo!**\n\nHemos explorado ${data.tema} y ahora puedes:\n\n${data.objetivosAprendizaje.map(obj => `✓ ${obj}`).join('\n\n')}\n\n🚀 **Próximos pasos:**\n• Practica los conceptos aprendidos\n• Realiza las actividades propuestas\n• Conecta este conocimiento con experiencias previas\n\n💬 **Pregunta final:**\n¿Cómo aplicarías estos conceptos en tu vida cotidiana o futura profesión?`;
      } else {
        title = `📚 ${i === 1 ? 'Análisis y Evaluación' : `Desarrollo ${i}`}`;
        content = `${i === 1 ? 'El análisis crítico' : 'El desarrollo progresivo'} de ${data.tema} nos permite ${i === 1 ? 'evaluar diferentes perspectivas y desarrollar un pensamiento más profundo sobre estos conceptos' : 'profundizar en aspectos específicos y construir una comprensión más sólida'}.\n\n🔍 **Ejemplo práctico:**\n${i === 1 ? 'Comparemos diferentes enfoques para...' : 'Veamos cómo esto se desarrolla en...'}\n\n💭 **Para reflexionar:**\n¿${i === 1 ? 'Cuáles son las fortalezas y debilidades de cada enfoque' : 'Qué nuevas conexiones puedes establecer con este contenido'}?\n\n📝 **Actividad sugerida:**\n${i === 1 ? 'Crea un cuadro comparativo de las diferentes perspectivas' : 'Elabora un mapa conceptual que integre estos elementos'}`;
      }
      
      slides.push({
        title,
        content,
        layout: 'TITLE_AND_BODY',
        imagePrompt: data.incluirImagenes ? 'Imagen educativa relacionada con el contenido' : undefined,
        designNotes: 'Mantener consistencia visual con el tema establecido'
      });
    }
    
    return slides.slice(0, data.numDiapositivas);
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
      await this.addSlidesToPresentation(slides, presentationId, slidesContent, data.estilo);
      
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
    slidesContent: GeneratedSlide[],
    estilo: string = 'sobrio'
  ): Promise<void> {
    console.log(`Añadiendo ${slidesContent.length} diapositivas con contenido mejorado`);
    
    // Obtener los colores específicos para el estilo seleccionado
    const themeColors = this.getStyleColors(estilo);
    
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
      
      // Configurar fondo de todas las diapositivas con el color de estilo elegido
      requests.push({
        updatePageProperties: {
          objectId: slideId,
          pageProperties: {
            pageBackgroundFill: {
              solidFill: {
                color: {
                  rgbColor: themeColors.background
                }
              }
            }
          },
          fields: 'pageBackgroundFill'
        }
      });
      
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
            foregroundColor: { 
              opaqueColor: { 
                rgbColor: i === 0 ? themeColors.primary : themeColors.secondary 
              } 
            },
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
              foregroundColor: { 
                opaqueColor: { 
                  rgbColor: themeColors.text 
                } 
              },
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
                translateX: 50,
                translateY: 450,
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
                  color: {
                    rgbColor: themeColors.accent
                  }
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
                translateX: 400,
                translateY: 150,
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
   * Encuentra rangos para aplicar viñetas en el texto
   */
  private findBulletRanges(text: string): Array<{startIndex: number, endIndex: number}> {
    const lines = text.split('\n');
    const ranges: Array<{startIndex: number, endIndex: number}> = [];
    let currentIndex = 0;
    
    lines.forEach(line => {
      if (line.trim().startsWith('•') || line.trim().startsWith('✓') || line.trim().startsWith('🎯')) {
        ranges.push({
          startIndex: currentIndex,
          endIndex: currentIndex + line.length
        });
      }
      currentIndex += line.length + 1; // +1 para el salto de línea
    });
    
    return ranges;
  }

  /**
   * Verifica si un error es de autenticación
   */
  private isAuthError(error: any): boolean {
    if (typeof error === 'object' && error !== null) {
      return error.code === 401 || 
             error.code === 403 || 
             (error.message && error.message.includes('auth')) ||
             (error.message && error.message.includes('unauthorized')) ||
             (error.message && error.message.includes('forbidden'));
    }
    return false;
  }
}
