/**
 * Función backend para generar preguntas SIMCE utilizando Gemini AI
 * con formato JSON estructurado y validación robusta
 */
import { defineString } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";

// API Key para Gemini como parámetro secreto de Firebase
const geminiApiKey = defineString("GEMINI_API_KEY");

// Interfaz para las opciones de generación
interface GeneracionSimceOptions {
  asignatura: string; // "Lectura" | "Matemática"
  cantidad: number; // 2, 4 o 6 preguntas
  nivel?: string; // "1M" o "2M" para 1º o 2º medio
  habilidadesLectura?: string[]; 
  ejesMatematica?: string[];
  dificultad?: 'baja' | 'media' | 'alta';
  contextoCurricular?: string; 
  textoBaseLectura?: string;
  textoProporcionado?: string;
}

// Interfaz completa para una pregunta SIMCE
export interface PreguntaSimceCompleta {
  id: string;
  enunciado: string;
  alternativas: Array<{id: string; texto: string; esCorrecta: boolean; explicacion?: string}>;
  estandarAprendizaje: string;
  dificultad: string;
  habilidad?: string;
  eje?: string;
  textoBase?: string;
}

/**
 * Normaliza texto proporcionado por el usuario para uso en el prompt
 */
function normalizarTextoProporcionado(texto: string | undefined): string | undefined {
  if (!texto) return undefined;
  
  let textoNormalizado = texto
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\t/g, '  ')
    .trim();
  
  const MAX_LENGTH = 4000;
  if (textoNormalizado.length > MAX_LENGTH) {
    console.log(`Texto proporcionado truncado de ${textoNormalizado.length} a ${MAX_LENGTH} caracteres`);
    textoNormalizado = textoNormalizado.substring(0, MAX_LENGTH) + 
      "\n\n[Texto truncado por límite de tamaño]";
  }
  
  return textoNormalizado;
}

/**
 * Construye el prompt para la generación de preguntas SIMCE
 */
function construirPromptGeneracion(options: GeneracionSimceOptions): string {
  const asignatura = options.asignatura;
  const nivel = options.nivel || '1M';
  const nivelCompleto = nivel === '1M' ? '1º medio' : '2º medio';
  const dificultad = options.dificultad || 'media';
  const cantidad = options.cantidad || 4;
  
  const mapDificultad = {
    'baja': 'facil',
    'media': 'media',
    'alta': 'dificil'
  };

  const lines: string[] = [];
  lines.push(`Eres un generador pedagógico especializado en preguntas tipo SIMCE para Chile.`);
  lines.push(`Tu tarea es crear exactamente ${cantidad} preguntas de alta calidad de la asignatura "${asignatura}" para nivel ${nivelCompleto} (Chile).`);
  
  if (asignatura === 'Lectura') {
    lines.push('\nESPECIFICACIONES PARA LECTURA:');
    
    const habilidades = options.habilidadesLectura && options.habilidadesLectura.length > 0 
      ? options.habilidadesLectura 
      : ['Localizar información', 'Relacionar información', 'Interpretar', 'Reflexionar y evaluar'];
    
    lines.push(`- Habilidades a evaluar: ${habilidades.join(', ')}`);
    lines.push('- Cada pregunta debe evaluar específicamente UNA de estas habilidades.');
    lines.push('- Distribuye las preguntas entre las habilidades seleccionadas.');
    
    const hayTextoProporcionado = options.textoProporcionado && options.textoProporcionado.trim().length > 0;
    const hayTextoBase = options.textoBaseLectura && options.textoBaseLectura.trim().length > 0;
    
    if (hayTextoProporcionado) {
      lines.push('\n- IMPORTANTE: Utilizarás EXCLUSIVAMENTE el texto proporcionado por el usuario para generar preguntas.');
      lines.push('- NO generes un texto adicional, usa únicamente el texto que se proporciona más adelante.');
      lines.push('- Todas las preguntas deben estar directamente basadas en este texto.');
    }
    else if (hayTextoBase) {
      lines.push('\n- Utilizarás el texto base proporcionado para generar preguntas.');
      lines.push('- Todas las preguntas deben estar directamente basadas en este texto.');
    }
    else {
      lines.push('\n- Como no se ha proporcionado un texto base, DEBES CREAR un texto original:');
      lines.push('  * Extensión: 200-350 palabras');
      lines.push('  * Apropiado para estudiantes de ' + nivelCompleto);
      lines.push('  * Culturalmente relevante para Chile, pero neutro (sin controversias)');
      lines.push('  * Sin marcas comerciales ni contenido con derechos de autor');
      lines.push('  * El texto debe incluirse en la propiedad "textoBase" del primer ítem solamente');
    }
  } 
  else if (asignatura === 'Matemática') {
    lines.push('\nESPECIFICACIONES PARA MATEMÁTICA:');
    
    const ejes = options.ejesMatematica && options.ejesMatematica.length > 0 
      ? options.ejesMatematica 
      : ['Números', 'Álgebra y Funciones', 'Geometría', 'Probabilidad y Estadística'];
    
    lines.push(`- Ejes temáticos a evaluar: ${ejes.join(', ')}`);
    lines.push('- Cada pregunta debe evaluar específicamente UNO de estos ejes.');
    lines.push('- Distribuye las preguntas entre los ejes seleccionados.');
    lines.push('- Usa contextos matemáticos realistas y escolares, relevantes para la vida diaria de estudiantes chilenos.');
    
    if (options.textoProporcionado) {
      lines.push('\n- IMPORTANTE: Utilizarás el texto proporcionado por el usuario como contexto o referencia para generar problemas matemáticos.');
      lines.push('- Las preguntas pueden incluir datos o situaciones mencionadas en el texto.');
    }
  }

  lines.push('\nFORMATO DE LA RESPUESTA:');
  lines.push('- Devuelve un objeto JSON con la siguiente estructura EXACTA:');
  lines.push('```');
  lines.push('{');
  lines.push('  "preguntas": [');
  lines.push('    {');
  lines.push('      "id": "p1",');
  lines.push('      "enunciado": "Texto del enunciado...",');
  lines.push('      "alternativas": [');
  lines.push('        {"id": "A", "texto": "...", "esCorrecta": true, "explicacion": "Justificación detallada..."},');
  lines.push('        {"id": "B", "texto": "...", "esCorrecta": false},');
  lines.push('        {"id": "C", "texto": "...", "esCorrecta": false},');
  lines.push('        {"id": "D", "texto": "...", "esCorrecta": false}');
  lines.push('      ],');
  
  if (asignatura === 'Lectura') {
    lines.push('      "habilidad": "Una de las habilidades especificadas",');
    if (!options.textoBaseLectura && !options.textoProporcionado) {
      lines.push('      "textoBase": "El texto completo aquí (solo en el primer ítem)",');
    }
  } else {
    lines.push('      "eje": "Uno de los ejes especificados",');
  }
  
  lines.push('      "estandarAprendizaje": "Estándar curricular específico",');
  lines.push(`      "dificultad": "${mapDificultad[dificultad] || 'media'}"` );
  lines.push('    }');
  lines.push('  ]');
  lines.push('}');
  lines.push('```');

  lines.push('\nREGLAS DE CALIDAD:');
  lines.push(`1. Debes generar EXACTAMENTE ${cantidad} preguntas, ni más ni menos.`);
  lines.push('2. Enunciados claros y directos, sin ambigüedades.');
  lines.push('3. EXACTAMENTE 4 alternativas por pregunta (etiquetadas A, B, C, D).');
  lines.push('4. Solo UNA alternativa correcta por pregunta.');
  lines.push('5. La alternativa correcta debe tener "esCorrecta": true y debe incluir una "explicacion" pedagógica.');
  lines.push('6. Distractores (alternativas incorrectas) deben representar errores típicos (conceptuales o procedimentales).');
  lines.push('7. Las preguntas deben estar alineadas rigurosamente con el currículum chileno para ' + nivelCompleto + '.');
  lines.push(`8. Ajusta el nivel de dificultad a "${dificultad}" (${mapDificultad[dificultad] || 'media'}).`);
  lines.push('9. Usa lenguaje claro, inclusivo y español chileno estándar.');
  lines.push('10. Evita contenido con derechos de autor, marcas comerciales y temas sensibles.');

  if (options.contextoCurricular) {
    lines.push('\nCONTEXTO CURRICULAR ESPECÍFICO:');
    lines.push(options.contextoCurricular);
    lines.push('- Alinea tus ítems al contexto curricular provisto.');
  }

  if (options.textoProporcionado || (options.textoBaseLectura && asignatura === 'Lectura')) {
    const esTextoUsuario = !!options.textoProporcionado;
    const textoTitulo = esTextoUsuario 
      ? '\nTEXTO PROPORCIONADO POR EL USUARIO:' 
      : '\nTEXTO BASE PARA LECTURA:';
    
    lines.push(textoTitulo);
    
    const textoBase = options.textoProporcionado || options.textoBaseLectura || '';
    
    lines.push('"""');
    lines.push(textoBase);
    lines.push('"""');
    
    lines.push('\n- Formula las preguntas ÚNICAMENTE sobre este texto.');
    lines.push('- IMPORTANTE: NO incluyas el texto en la propiedad textoBase del JSON, ya fue provisto externamente.');
  }

  lines.push('\nDEBES asegurarte de generar EXACTAMENTE ' + cantidad + ' preguntas, ni más ni menos.');
  
  return lines.join('\n');
}

/**
 * Valida y normaliza el resultado de las preguntas generadas
 */
function validarYNormalizarPreguntas(data: any, cantidadSolicitada: number): any {
  // Si no hay datos o no son del tipo esperado
  if (!data || typeof data !== 'object') {
    throw new Error('Respuesta inválida: formato incorrecto');
  }

  // Extraer el array de preguntas
  let preguntas = data.preguntas;
  
  // Si no está en data.preguntas, intentar usarlo directamente si es un array
  if (!Array.isArray(preguntas) && Array.isArray(data)) {
    preguntas = data;
  }
  
  // Si aún no tenemos un array, error
  if (!Array.isArray(preguntas)) {
    throw new Error('Respuesta inválida: no contiene array de preguntas');
  }
  
  // Verificar cantidad
  if (preguntas.length !== cantidadSolicitada) {
    console.warn(`Cantidad incorrecta: se solicitaron ${cantidadSolicitada} preguntas pero se recibieron ${preguntas.length}`);
  }
  
  // Normalizar cada pregunta
  const preguntasNormalizadas = preguntas.map((pregunta, index) => {
    const id = pregunta.id || `p${index + 1}`;
    const enunciado = pregunta.enunciado || pregunta.pregunta || `Pregunta ${index + 1}`;
    
    // Normalizar alternativas
    let alternativas = Array.isArray(pregunta.alternativas) ? 
      pregunta.alternativas : [];
      
    // Si faltan alternativas, crear las que falten
    while (alternativas.length < 4) {
      alternativas.push({
        id: String.fromCharCode(65 + alternativas.length), // A, B, C, D
        texto: `Opción ${String.fromCharCode(65 + alternativas.length)} (generada por sistema)`,
        esCorrecta: false
      });
    }
    
    // Si hay más de 4, recortar
    if (alternativas.length > 4) {
      alternativas = alternativas.slice(0, 4);
    }
    
    // Normalizar cada alternativa
    alternativas = alternativas.map((alt: any, i: number) => {
      // Asegurar ID correcto (A, B, C, D)
      const altId = alt.id || String.fromCharCode(65 + i);
      
      // Normalizar esCorrecta
      let esCorrecta = !!alt.esCorrecta;
      
      // Si hay una respuesta correcta especificada a nivel de pregunta, usarla
      if (pregunta.respuestaCorrecta || pregunta.respuesta) {
        const respuestaCorrecta = pregunta.respuestaCorrecta || pregunta.respuesta;
        if (respuestaCorrecta === altId || 
            respuestaCorrecta === i || 
            respuestaCorrecta === i + 1 || 
            respuestaCorrecta === String(i + 1)) {
          esCorrecta = true;
        }
      }
      
      return {
        id: altId,
        texto: alt.texto || `Opción ${altId}`,
        esCorrecta: esCorrecta,
        explicacion: alt.explicacion || ""
      };
    });
    
    // Asegurar que haya exactamente UNA alternativa correcta
    const correctCount = alternativas.filter((a: any) => a.esCorrecta).length;
    if (correctCount === 0) {
      // Si no hay ninguna marcada, marcar la primera
      alternativas[0].esCorrecta = true;
    } else if (correctCount > 1) {
      // Si hay más de una, dejar solo la primera marcada
      let foundCorrect = false;
      alternativas = alternativas.map((a: any) => {
        if (a.esCorrecta) {
          if (foundCorrect) {
            return { ...a, esCorrecta: false };
          }
          foundCorrect = true;
        }
        return a;
      });
    }
    
    // Normalizar campo de habilidad o eje según asignatura
    const habilidad = pregunta.habilidad || undefined;
    const eje = pregunta.eje || undefined;
    
    return {
      id,
      enunciado,
      alternativas,
      ...(habilidad ? { habilidad } : {}),
      ...(eje ? { eje } : {}),
      ...(pregunta.textoBase ? { textoBase: pregunta.textoBase } : {}),
      estandarAprendizaje: pregunta.estandarAprendizaje || "",
      dificultad: pregunta.dificultad || "media"
    };
  });
  
  return preguntasNormalizadas;
}

/**
 * Función principal para generar preguntas SIMCE
 */
export const generarPreguntasSimce = onCall({
  enforceAppCheck: false, // Cambiar a true en producción
  timeoutSeconds: 120, // Timeout de 2 minutos
  memory: "1GiB", // Aumentar memoria para Gemini
  secrets: ["GEMINI_API_KEY"],
}, async (request) => {
  try {
    // Validar que sea una solicitud autenticada
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "La función debe ser llamada por un usuario autenticado."
      );
    }
    
    // Extraer y validar los parámetros
  const options: GeneracionSimceOptions = request.data.options;
    
    if (!options) {
      throw new HttpsError(
        "invalid-argument",
        "Se requiere el objeto options con la configuración para generar preguntas."
      );
    }
    
    // Normalizar/mapeo de asignatura desde el frontend (puede venir como 'competencia lectora' o 'pensamiento logico')
    if (options?.asignatura) {
      const asignaturaLower = (options.asignatura as unknown as string).toString().toLowerCase();
      if (asignaturaLower.includes('lectora') || asignaturaLower.includes('lectura')) {
        options.asignatura = 'Lectura' as any;
      } else if (asignaturaLower.includes('logico') || asignaturaLower.includes('lógico') || asignaturaLower.includes('matemat')) {
        options.asignatura = 'Matemática' as any;
      }
    }

    if (!options.asignatura || !["Lectura", "Matemática"].includes(options.asignatura)) {
      throw new HttpsError(
        "invalid-argument",
        "La asignatura debe ser 'Lectura' o 'Matemática'."
      );
    }
    
    // Normalizar opciones
    const cantidadFinal = options.cantidad || 4;
    options.nivel = options.nivel || "1M";
    options.dificultad = options.dificultad || "media";
    
    if (options.textoProporcionado) {
      options.textoProporcionado = normalizarTextoProporcionado(options.textoProporcionado);
    }
    
    console.log(`Generando ${cantidadFinal} preguntas de ${options.asignatura}, nivel ${options.nivel}`);
    
    // Obtener la API key de Gemini
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "API key de Gemini no configurada en el servidor."
      );
    }
    
    // Inicializar el modelo de Gemini con configuración para respuestas JSON
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4000,
        responseMimeType: "application/json"
        // No usamos responseSchema ya que causa problemas de tipos
      }
    });
    
    // Construir el prompt
    const prompt = construirPromptGeneracion(options);
    
    console.log("Enviando prompt a Gemini...");
    
    // Intentar generar contenido hasta 2 veces
    let preguntasGeneradas;
    let intentos = 0;
    const maxIntentos = 2;
    
    while (intentos <= maxIntentos) {
      try {
        intentos++;
        console.log(`Intento ${intentos}/${maxIntentos + 1} de generación`);
        
        const result = await model.generateContent(prompt);
        const response = result.response;
        
        try {
          // Intentar obtener el JSON directamente
          const jsonData = response.text();
          const parsed = JSON.parse(jsonData);
          
          preguntasGeneradas = validarYNormalizarPreguntas(parsed, cantidadFinal);
          
          // Verificar que tenemos exactamente la cantidad solicitada
          if (preguntasGeneradas.length === cantidadFinal) {
            console.log(`✅ Generación exitosa: ${preguntasGeneradas.length} preguntas generadas`);
            break;
          } else {
            console.warn(`⚠️ Cantidad incorrecta: ${preguntasGeneradas.length} preguntas (se solicitaron ${cantidadFinal})`);
            
            // Si es el último intento, usar lo que tenemos
            if (intentos > maxIntentos) {
              break;
            }
          }
        } catch (parseError) {
          console.error("Error al parsear respuesta JSON:", parseError);
          
          // Si es el último intento, lanzar error
          if (intentos > maxIntentos) {
            throw parseError;
          }
        }
      } catch (genError) {
        console.error(`Error en intento ${intentos}:`, genError);
        
        // Si es el último intento, lanzar error
        if (intentos > maxIntentos) {
          throw genError;
        }
      }
    }
    
    // Si no tenemos preguntas generadas después de todos los intentos
    if (!preguntasGeneradas || preguntasGeneradas.length === 0) {
      throw new Error("No se pudieron generar preguntas después de múltiples intentos");
    }
    
    // Si tenemos menos preguntas de las solicitadas, completar con preguntas de emergencia
    if (preguntasGeneradas.length < cantidadFinal) {
      console.warn(`Completando ${cantidadFinal - preguntasGeneradas.length} preguntas faltantes`);
      
      // Generar preguntas faltantes
      for (let i = preguntasGeneradas.length; i < cantidadFinal; i++) {
        // Usamos la interfaz definida globalmente
        
        // Usamos la interface para tipar correctamente
        const preguntaEmergencia: PreguntaSimceCompleta = {
          id: `p${i + 1}`,
          enunciado: `Pregunta ${i + 1} (generada por sistema)`,
          alternativas: [
            { id: "A", texto: "Primera opción", esCorrecta: true, explicacion: "Esta es la respuesta correcta por defecto" },
            { id: "B", texto: "Segunda opción", esCorrecta: false },
            { id: "C", texto: "Tercera opción", esCorrecta: false },
            { id: "D", texto: "Cuarta opción", esCorrecta: false }
          ],
          estandarAprendizaje: "Generada por sistema",
          dificultad: "media"
        };
        
        // Agregar habilidad o eje según corresponda
        if (options.asignatura === "Lectura") {
          preguntaEmergencia.habilidad = "Localizar información";
        } else {
          preguntaEmergencia.eje = "Números";
        }
        
        preguntasGeneradas.push(preguntaEmergencia);
      }
    }
    
    // Si tenemos más preguntas de las solicitadas, recortar
    if (preguntasGeneradas.length > cantidadFinal) {
      preguntasGeneradas = preguntasGeneradas.slice(0, cantidadFinal);
    }
    
    // Extraer el texto base si existe (para preguntas de Lectura)
    let textoBase: string | undefined;
    if (options.asignatura === "Lectura") {
      // Si el usuario proporcionó un texto, usarlo con prioridad
      if (options.textoProporcionado) {
        textoBase = options.textoProporcionado;
      } 
      // Si no, usar el texto base proporcionado
      else if (options.textoBaseLectura) {
        textoBase = options.textoBaseLectura;
      }
      // Si no hay texto proporcionado, ver si la IA generó uno en la primera pregunta
      else if (preguntasGeneradas.length > 0 && preguntasGeneradas[0].textoBase) {
        textoBase = preguntasGeneradas[0].textoBase;
        // Quitarlo de la pregunta para no duplicarlo
        delete preguntasGeneradas[0].textoBase;
      }
    }
    
    // Incluir metadatos y textoBase si existe
    const respuestaFinal = {
      preguntas: preguntasGeneradas,
      textoBase: textoBase, // Incluir el texto base en la respuesta
      metadata: {
        timestamp: new Date().toISOString(),
        asignatura: options.asignatura,
        nivel: options.nivel,
        cantidadSolicitada: cantidadFinal,
        cantidadGenerada: preguntasGeneradas.length,
        intentosRequeridos: intentos
      }
    };
    
    return respuestaFinal;
    
  } catch (error) {
    console.error("Error al generar preguntas SIMCE:", error);
    
    throw new HttpsError(
      "internal",
      error instanceof Error ? error.message : "Error desconocido al generar preguntas",
      error
    );
  }
});
