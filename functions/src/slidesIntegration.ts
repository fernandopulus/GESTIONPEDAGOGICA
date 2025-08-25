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
  incluirActividades?: boolean;
  incluirEvaluacion?: boolean;
  formatoPedagogico?: boolean;
  userId?: string;
  planificacionId?: string;
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
  activity?: string; // Actividad de aprendizaje para el slide
  bloomLevel?: string; // Nivel de taxonomía de Bloom
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
   * Obtiene la descripción pedagógica del estilo seleccionado
   */
  private getStyleDescription(estilo: string): string {
    const estilos: Record<string, string> = {
      'academico': 'Formal y riguroso, con énfasis en conceptos teóricos y fundamentación científica',
      'visual': 'Dinámico y colorido, con énfasis en elementos gráficos, infografías y representaciones visuales',
      'interactivo': 'Participativo y colaborativo, con múltiples actividades, preguntas y dinámicas grupales',
      'profesional': 'Corporativo y práctico, enfocado en aplicaciones del mundo real y casos de estudio',
      'sobrio': 'Elegante y minimalista, balanceando profesionalismo con claridad pedagógica'
    };
    
    return estilos[estilo] || estilos['academico'];
  }
  
  /**
   * Genera contenido para una presentación usando IA
   */
  private async generatePresentationContent(data: PresentationData): Promise<GeneratedSlide[]> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Construir el prompt para la IA con estructura pedagógica avanzada
    const prompt = `
    Eres un experto pedagogo y diseñador instruccional. Crea una presentación educativa de alta calidad con ${data.numDiapositivas} diapositivas sobre "${data.tema}" 
    para la asignatura "${data.asignatura}" de nivel "${data.curso}".
    
    OBJETIVOS DE APRENDIZAJE:
    ${data.objetivosAprendizaje.map(oa => `- ${oa}`).join('\n')}
    
    ${data.contenidoFuente ? `CONTENIDO DE REFERENCIA: ${data.contenidoFuente}` : ''}
    ${data.enlaces && data.enlaces.length > 0 ? `ENLACES DE REFERENCIA: ${data.enlaces.join(', ')}` : ''}
    
    ESTILO PEDAGÓGICO: ${this.getStyleDescription(data.estilo)}
    
    REQUISITOS PEDAGÓGICOS:
    1. Aplica la taxonomía de Bloom progresivamente (recordar → comprender → aplicar → analizar → evaluar → crear)
    2. Incluye actividades de aprendizaje activo en cada diapositiva
    3. Proporciona ejemplos concretos y casos prácticos del mundo real
    4. Incorpora preguntas reflexivas y de pensamiento crítico
    5. Asegura conexiones interdisciplinarias cuando sea relevante
    6. Incluye elementos de evaluación formativa
    
    ESTRUCTURA REQUERIDA:
    - Diapositiva 1: Título e introducción motivadora con pregunta detonante
    - Diapositivas 2-3: Conceptos fundamentales con ejemplos visuales
    - Diapositivas centrales: Desarrollo del contenido con actividades prácticas
    - Penúltima diapositiva: Síntesis y conexiones con conocimientos previos
    - Última diapositiva: Conclusiones, reflexión final y proyección futura
    
    Devuelve ÚNICAMENTE un array JSON válido donde cada elemento tenga:
    {
      "title": "Título claro y atractivo de la diapositiva",
      "content": "Contenido educativo detallado con bullet points, ejemplos concretos, y actividades de aprendizaje. Mínimo 3-4 puntos sustanciales por diapositiva.",
      "activity": "Actividad específica para que los estudiantes realicen (pregunta, ejercicio, discusión, etc.)",
      "bloomLevel": "Nivel de Bloom que aborda esta diapositiva"${data.incluirImagenes ? ',\n      "imagePrompt": "Descripción específica para generar una imagen educativa relevante"' : ''}
    }
    
    IMPORTANTE: 
    - Cada diapositiva debe tener contenido sustancial, no solo títulos
    - Incluye datos, estadísticas, citas o ejemplos específicos cuando sea apropiado
    - El contenido debe ser apropiado para el nivel educativo especificado
    - Mantén coherencia narrativa entre las diapositivas
    `;
    
    try {
      console.log('Generando contenido con IA mejorada para:', data.tema);
      console.log('Configuración:', {
        estilo: data.estilo,
        actividades: data.incluirActividades || false,
        evaluacion: data.incluirEvaluacion || false,
        pedagogico: data.formatoPedagogico || false
      });
      
      // Verificar que tenemos API key
      const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('❌ API Key de Gemini no configurada');
        return this.createEnhancedDefaultSlides(data);
      }
      console.log('✅ API Key de Gemini configurada');
      
      // Llamar a Gemini AI
      console.log('🚀 Enviando prompt a Gemini 1.5 Pro...');
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      console.log('📥 Respuesta de IA recibida, longitud:', responseText.length);
      console.log('📝 Primeros 300 caracteres:', responseText.substring(0, 300));
      
      // Limpiar la respuesta para extraer solo el JSON
      let cleanText = responseText.trim();
      
      // Remover markdown si existe
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```\n?/, '').replace(/\n?```$/, '');
      }
      
      // Buscar el array JSON
      const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsedSlides = JSON.parse(jsonMatch[0]) as GeneratedSlide[];
          
          // Validar que tenemos el número correcto de diapositivas
          if (parsedSlides.length !== data.numDiapositivas) {
            console.warn(`IA generó ${parsedSlides.length} diapositivas, se esperaban ${data.numDiapositivas}`);
          }
          
          // Validar estructura de las diapositivas
          const validSlides = parsedSlides.filter(slide => 
            slide.title && slide.content && slide.title.trim() !== '' && slide.content.trim() !== ''
          );
          
          if (validSlides.length === 0) {
            console.warn('No se generaron diapositivas válidas, usando contenido de respaldo');
            return this.createEnhancedDefaultSlides(data);
          }
          
          console.log(`✅ Se generaron ${validSlides.length} diapositivas válidas`);
          return validSlides;
        } catch (parseError) {
          console.error('Error al parsear JSON de IA:', parseError);
          console.log('Respuesta que causó error:', jsonMatch[0].substring(0, 500));
          return this.createEnhancedDefaultSlides(data);
        }
      } else {
        console.warn('No se encontró JSON válido en la respuesta de IA');
        console.log('Respuesta completa:', responseText.substring(0, 500));
        return this.createEnhancedDefaultSlides(data);
      }
    } catch (error) {
      console.error('❌ Error detallado al generar contenido con IA:');
      
      // Verificar que el error sea un objeto con las propiedades esperadas
      if (error instanceof Error) {
        console.error('Tipo de error:', error.constructor.name);
        console.error('Mensaje:', error.message);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
        
        // Verificar si es un error específico de la API de Gemini
        if (error.message && error.message.includes('API_KEY')) {
          console.error('🔑 Error relacionado con API Key de Gemini');
        } else if (error.message && error.message.includes('quota')) {
          console.error('📊 Error de cuota de API de Gemini');
        } else if (error.message && error.message.includes('blocked')) {
          console.error('🚫 Error de bloqueo/referrer de API de Gemini');
        }
      } else {
        console.error('Error desconocido:', error);
      }
      
      console.log('🔄 Usando contenido de respaldo de alta calidad...');
      return this.createEnhancedDefaultSlides(data);
    }
  }
  
  /**
   * Crea slides predeterminados enriquecidos en caso de fallo de la IA
   */
  private createEnhancedDefaultSlides(data: PresentationData): GeneratedSlide[] {
    console.log('Generando contenido de respaldo para:', data.tema);
    
    const slides: GeneratedSlide[] = [];
    
    // 1. Diapositiva de título
    slides.push({
      title: data.tema,
      content: `📚 Asignatura: ${data.asignatura}\n🎓 Nivel: ${data.curso}\n\n🎯 Objetivo principal:\nDesarrollar conocimientos y habilidades fundamentales sobre ${data.tema} mediante metodologías activas de aprendizaje.\n\n🔍 Enfoque pedagógico: ${this.getStyleDescription(data.estilo)}`,
      activity: "Reflexiona: ¿Qué conocimientos previos tienes sobre este tema?",
      bloomLevel: "Recordar"
    });
    
    // 2. Diapositiva de objetivos
    slides.push({
      title: 'Objetivos de Aprendizaje',
      content: `Al finalizar esta clase, serás capaz de:\n\n${data.objetivosAprendizaje.map((obj, i) => `${i + 1}. ${obj}`).join('\n\n')}\n\n💡 Estos objetivos se alinean con las competencias del perfil de egreso y contribuyen al desarrollo integral de tu formación.`,
      activity: "Identifica cuál objetivo te resulta más desafiante y por qué",
      bloomLevel: "Comprender"
    });
    
    // 3-4. Diapositivas de contenido conceptual
    if (data.numDiapositivas >= 4) {
      slides.push({
        title: 'Conceptos Fundamentales',
        content: `🔑 Ideas clave sobre ${data.tema}:\n\n• Definición y características principales\n• Importancia en el contexto de ${data.asignatura}\n• Relación con conocimientos previos\n• Aplicaciones en la vida cotidiana\n\n📖 Marco teórico:\nEste tema se fundamenta en principios establecidos que han evolucionado a través de la investigación y la práctica profesional.`,
        activity: "Construye un mapa conceptual con los términos principales",
        bloomLevel: "Aplicar"
      });
      
      slides.push({
        title: 'Análisis y Ejemplos Prácticos',
        content: `🧩 Desglosando ${data.tema}:\n\n• Componentes y elementos estructurales\n• Procesos y metodologías involucrados\n• Casos de estudio relevantes\n• Ejemplos del mundo real\n\n🔬 Enfoque analítico:\nExaminaremos este tema desde múltiples perspectivas para desarrollar una comprensión profunda y crítica.`,
        activity: "Analiza un caso práctico y presenta tus conclusiones",
        bloomLevel: "Analizar"
      });
    }
    
    // Diapositivas adicionales según el número solicitado
    const remainingSlides = data.numDiapositivas - slides.length - 2; // Reservar espacio para síntesis y conclusión
    
    for (let i = 0; i < remainingSlides; i++) {
      const slideNumber = slides.length + 1;
      slides.push({
        title: `Profundización ${slideNumber - 2}: Aspecto Específico`,
        content: `🎯 Desarrollando competencias específicas:\n\n• Habilidades técnicas requeridas\n• Destrezas de pensamiento crítico\n• Competencias transversales\n• Metodologías de trabajo\n\n📊 Indicadores de logro:\nPodrás demostrar tu comprensión mediante la aplicación práctica de estos conceptos en situaciones reales.`,
        activity: `Desarrolla una propuesta práctica aplicando los conceptos aprendidos`,
        bloomLevel: i % 2 === 0 ? "Evaluar" : "Crear"
      });
    }
    
    // Penúltima diapositiva: Síntesis
    if (data.numDiapositivas >= 3) {
      slides.push({
        title: 'Síntesis e Integración',
        content: `🔗 Conectando conocimientos:\n\n• Relación con aprendizajes anteriores\n• Vínculos interdisciplinarios\n• Aplicaciones futuras\n• Transferencia de conocimientos\n\n🧠 Metacognición:\nReflexiona sobre tu proceso de aprendizaje y las estrategias que mejor te funcionaron durante esta clase.`,
        activity: "Elabora una síntesis personal del tema en 3 ideas principales",
        bloomLevel: "Evaluar"
      });
    }
    
    // Última diapositiva: Conclusión y proyección
    slides.push({
      title: 'Conclusiones y Próximos Pasos',
      content: `✨ Logros alcanzados:\n\n• Conceptos fundamentales consolidados\n• Habilidades desarrolladas\n• Conexiones establecidas\n• Competencias fortalecidas\n\n🚀 Proyección futura:\nEstos aprendizajes constituyen la base para abordar temas más complejos y desarrollar proyectos innovadores en ${data.asignatura}.\n\n💭 Reflexión final:\n"El aprendizaje es un viaje continuo donde cada nuevo conocimiento se convierte en el punto de partida para nuevos descubrimientos."`,
        activity: "Define un objetivo personal de aprendizaje para continuar profundizando en este tema",
        bloomLevel: "Crear"
    });
    
    // Asegurar que tenemos exactamente el número solicitado de diapositivas
    const finalSlides = slides.slice(0, data.numDiapositivas);
    
    console.log(`Presentación generada para ${data.tema} (${data.asignatura}) por usuario ${data.userId || 'anónimo'}`);
    console.log(`Detalles adicionales: curso=${data.curso}`);
    console.log(`diapositivas=${finalSlides.length}, estilo=${data.estilo}`);
    console.log(`Parámetros opcionales: imágenes=${data.incluirImagenes},`);
    console.log(`fuente=${data.contenidoFuente ? 'sí' : 'no'}, enlaces=${data.enlaces?.length || 0}, planID=${data.planificacionId || 'N/A'}`);
    
    return finalSlides;
  }

  /**
   * Crea una nueva presentación en Google Slides
   */
  
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
      
      // Insertar contenido enriquecido
      let fullContent = slide.content;
      
      // Agregar actividad si existe
      if (slide.activity) {
        fullContent += `\n\n🎯 ACTIVIDAD:\n${slide.activity}`;
      }
      
      // Agregar nivel de Bloom si existe
      if (slide.bloomLevel) {
        fullContent += `\n\n📊 Nivel de Bloom: ${slide.bloomLevel}`;
      }
      
      requests.push({
        insertText: {
          objectId: contentId,
          text: fullContent
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
