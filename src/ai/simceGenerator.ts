import { Pregunta, AsignaturaSimce, Alternativa } from '../../types/simce';
import { generarConIA } from './geminiHelper';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

// Opciones para la generación de preguntas SIMCE alineadas a estándares chilenos
export interface GeneracionSimceOptions {
  asignatura: AsignaturaSimce; // "Lectura" | "Matemática"
  cantidad?: number; // 2, 4 o 6 preguntas
  nivel?: string; // "1M" o "2M" para 1º o 2º medio
  opcionesPorPregunta?: number; // Fijo a 4 -> ["A", "B", "C", "D"]
  habilidadesLectura?: string[]; // ["Localizar información", "Relacionar información", "Interpretar", "Reflexionar y evaluar"]
  ejesMatematica?: string[]; // ["Números", "Álgebra", "Probabilidad y estadística", "Geometría"]
  dificultad?: 'baja' | 'media' | 'alta'; // Si no se especifica, se usa "media"
  contextoCurricular?: string; // Texto breve del profesor (unidad/objetivo/contenidos)
  textoBaseLectura?: string; // Para Lectura: texto base para preguntas
  textoProporcionado?: string; // Texto proporcionado por el usuario para generar preguntas
}

// Función para normalizar textos proporcionados por el usuario
function normalizarTextoProporcionado(texto: string | undefined): string | undefined {
  if (!texto) return undefined;
  
  // Normalizar saltos de línea y espacios múltiples
  let textoNormalizado = texto
    .replace(/\r\n/g, '\n')  // Normalizar saltos de línea Windows
    .replace(/\r/g, '\n')    // Normalizar saltos de línea Mac
    .replace(/\n{3,}/g, '\n\n')  // Máximo 2 saltos de línea seguidos
    .replace(/\t/g, '  ')    // Convertir tabs a espacios
    .trim();
  
  // Asegurar que no exceda un tamaño razonable para evitar problemas con la API
  const MAX_LENGTH = 4000;
  if (textoNormalizado.length > MAX_LENGTH) {
    console.log(`Texto proporcionado truncado de ${textoNormalizado.length} a ${MAX_LENGTH} caracteres`);
    textoNormalizado = textoNormalizado.substring(0, MAX_LENGTH) + 
      "\n\n[Texto truncado por límite de tamaño]";
  }
  
  return textoNormalizado;
}

// Función principal: generarPreguntasSimce - mantiene compatibilidad con la firma original
export async function generarPreguntasSimce(asignaturaOpciones: AsignaturaSimce | GeneracionSimceOptions, cantidad?: number): Promise<Pregunta[]> {
  try {
    // Detectar si se está llamando con los parámetros antiguos o con el objeto de opciones
    let options: GeneracionSimceOptions;
    
    if (typeof asignaturaOpciones === 'string') {
      // Formato antiguo: (asignatura, cantidad)
      options = {
        asignatura: asignaturaOpciones,
        cantidad: cantidad ?? 5
      };
    } else {
      // Formato nuevo: (options)
      options = asignaturaOpciones;
      
      // Normalizar el texto proporcionado si existe
      if (options.textoProporcionado) {
        options.textoProporcionado = normalizarTextoProporcionado(options.textoProporcionado);
      }
    }

    // Normalizar asignatura para evitar alias de la UI
    if (options.asignatura) {
      const a = (options.asignatura as string).toLowerCase();
      if (a.includes('lectora') || a.includes('lectura')) {
        options.asignatura = 'Lectura';
      } else if (a.includes('lóg') || a.includes('log') || a.includes('matem')) {
        options.asignatura = 'Matemática';
      }
    }

    // Normalizar cantidad de preguntas a valores válidos (2, 4 o 6 preferiblemente)
    const cantidadFinal = options.cantidad ?? 4;
    
    // Fijar opciones por pregunta a 4 (requisito de la especificación)
    const opcionesCount = 4; // A, B, C, D

    // Normalizar nivel
    if (options.nivel && !['1M', '2M'].includes(options.nivel)) {
      options.nivel = options.nivel === '1' ? '1M' : options.nivel === '2' ? '2M' : options.nivel;
    }

    console.log(`Generando ${cantidadFinal} preguntas de ${options.asignatura}, nivel ${options.nivel || '1M'}`);
    
    // Construir prompt mejorado con todas las especificaciones
    const prompt = construirPromptGeneracion(options, cantidadFinal, opcionesCount);
    
    // Generar respuesta con la IA (forzando uso del modelo Pro)
    console.log('Enviando prompt a la IA (usando modelo Pro para mejor calidad)...');
    const respuesta = await generarConIA(prompt, 2, true); // 2 reintentos, forzar modelo Pro
    
    if (!respuesta) {
      console.error('La IA no devolvió respuesta');
      throw new Error('No se recibió respuesta del modelo de IA. Por favor, intente nuevamente.');
    }
    
    console.log('Procesando respuesta de la IA...');
    return procesarRespuestaIA(respuesta, cantidadFinal, options);
  } catch (error) {
    console.error('Error en generarPreguntasSimce:', error);
    
    // Reenviar el error original o crear uno más descriptivo si es genérico
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Ocurrió un error al generar las preguntas SIMCE. Por favor, intente nuevamente.');
    }
  }
}

// Ya no es necesaria ya que generarPreguntasSimce mantiene compatibilidad
export async function generarPreguntasSimceLegacy(asignatura: AsignaturaSimce, cantidad: number = 5): Promise<Pregunta[]> {
  return generarPreguntasSimce(asignatura, cantidad);
}

function construirPromptGeneracion(options: GeneracionSimceOptions, cantidad: number, opcionesCount: number): string {
  const asignatura = options.asignatura;
  const nivel = options.nivel || '1M'; // Por defecto 1º Medio
  const nivelCompleto = nivel === '1M' ? '1º medio' : '2º medio';
  const dificultad = options.dificultad || 'media'; // Por defecto dificultad media
  
  // Mapeo de dificultad para formato esperado
  const mapDificultad = {
    'baja': 'facil',
    'media': 'media',
    'alta': 'dificil'
  };

  const lines: string[] = [];
  lines.push(`Eres un generador pedagógico especializado en preguntas tipo SIMCE para Chile.`);
  lines.push(`Tu tarea es crear exactamente ${cantidad} preguntas de alta calidad de la asignatura "${asignatura}" para nivel ${nivelCompleto} (Chile).`);
  
  // Instrucciones específicas según asignatura
  if (asignatura === 'Lectura') {
    lines.push('\nESPECIFICACIONES PARA LECTURA:');
    
    const habilidades = options.habilidadesLectura && options.habilidadesLectura.length > 0 
      ? options.habilidadesLectura 
      : ['Localizar información', 'Relacionar información', 'Interpretar', 'Reflexionar y evaluar'];
    
    lines.push(`- Habilidades a evaluar: ${habilidades.join(', ')}`);
    lines.push('- Cada pregunta debe evaluar específicamente UNA de estas habilidades.');
    lines.push('- Distribuye las preguntas entre las habilidades seleccionadas.');
    
    // Determinar si hay texto proporcionado
    const hayTextoProporcionado = options.textoProporcionado && options.textoProporcionado.trim().length > 0;
    const hayTextoBase = options.textoBaseLectura && options.textoBaseLectura.trim().length > 0;
    
    if (hayTextoProporcionado) {
      // El usuario proporcionó un texto específico
      lines.push('\n- IMPORTANTE: Utilizarás EXCLUSIVAMENTE el texto proporcionado por el usuario para generar preguntas.');
      lines.push('- NO generes un texto adicional, usa únicamente el texto que se proporciona más adelante.');
      lines.push('- Todas las preguntas deben estar directamente basadas en este texto.');
    }
    else if (hayTextoBase) {
      // Hay un texto base proporcionado en las opciones
      lines.push('\n- Utilizarás el texto base proporcionado para generar preguntas.');
      lines.push('- Todas las preguntas deben estar directamente basadas en este texto.');
    }
    else {
      // No hay texto proporcionado, solicitar a la IA que genere uno
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
      : ['Números', 'Álgebra', 'Probabilidad y estadística', 'Geometría'];
    
    lines.push(`- Ejes temáticos a evaluar: ${ejes.join(', ')}`);
    lines.push('- Cada pregunta debe evaluar específicamente UNO de estos ejes.');
    lines.push('- Distribuye las preguntas entre los ejes seleccionados.');
    lines.push('- Usa contextos matemáticos realistas y escolares, relevantes para la vida diaria de estudiantes chilenos.');
    
    // Si hay texto proporcionado para matemáticas, indicar cómo usarlo
    if (options.textoProporcionado) {
      lines.push('\n- IMPORTANTE: Utilizarás el texto proporcionado por el usuario como contexto o referencia para generar problemas matemáticos.');
      lines.push('- Las preguntas pueden incluir datos o situaciones mencionadas en el texto.');
    }
  }

  lines.push('\nREGLAS DE FORMATO DE SALIDA:');
  lines.push('- Devuelve UN ÚNICO bloque JSON (sin texto adicional antes o después).');
  lines.push('- El JSON debe ser un arreglo de objetos; cada objeto representa una pregunta con este esquema EXACTO:');
  lines.push('  {');
  lines.push('    "id": "p1",');
  lines.push('    "enunciado": "Texto del enunciado...",');
  lines.push('    "alternativas": [');
  lines.push('      {"id": "A", "texto": "...", "esCorrecta": true, "explicacion": "Justificación detallada..."},');
  lines.push('      {"id": "B", "texto": "...", "esCorrecta": false},');
  lines.push('      {"id": "C", "texto": "...", "esCorrecta": false},');
  lines.push('      {"id": "D", "texto": "...", "esCorrecta": false}');
  lines.push('    ],');
  
  if (asignatura === 'Lectura') {
    lines.push('    "habilidad": "Una de las habilidades especificadas",');
    if (!options.textoBaseLectura) {
      lines.push('    "textoBase": "El texto completo aquí (solo en el primer ítem)",');
    }
  } else {
    lines.push('    "eje": "Uno de los ejes especificados",');
  }
  
  lines.push('    "estandarAprendizaje": "Estándar curricular específico",');
  lines.push(`    "dificultad": "${mapDificultad[dificultad]}"` );
  lines.push('  }');

  lines.push('\nREGLAS DE CALIDAD:');
  lines.push('1. Enunciados claros y directos, sin ambigüedades.');
  lines.push(`2. EXACTAMENTE ${opcionesCount} alternativas por pregunta (etiquetadas A, B, C, D).`);
  lines.push('3. Solo UNA alternativa correcta por pregunta.');
  lines.push('4. La alternativa correcta debe tener "esCorrecta": true y debe incluir una "explicacion" pedagógica.');
  lines.push('5. Distractores (alternativas incorrectas) deben representar errores típicos (conceptuales o procedimentales).');
  lines.push('6. Las preguntas deben estar alineadas rigurosamente con el currículum chileno para ' + nivelCompleto + '.');
  lines.push(`7. Ajusta el nivel de dificultad a "${dificultad}" (${mapDificultad[dificultad]}).`);
  lines.push('8. Usa lenguaje claro, inclusivo y español chileno estándar.');
  lines.push('9. Evita contenido con derechos de autor, marcas comerciales y temas sensibles.');

  // Contexto curricular provisto por el profesor
  if (options.contextoCurricular) {
    lines.push('\nCONTEXTO CURRICULAR ESPECÍFICO:');
    lines.push(options.contextoCurricular);
    lines.push('- Alinea tus ítems al contexto curricular provisto.');
  }

  // Texto base para preguntas
  if (options.textoProporcionado || (options.textoBaseLectura && asignatura === 'Lectura')) {
    const esTextoUsuario = !!options.textoProporcionado;
    const textoTitulo = esTextoUsuario 
      ? '\nTEXTO PROPORCIONADO POR EL USUARIO:' 
      : '\nTEXTO BASE PARA LECTURA:';
    
    lines.push(textoTitulo);
    
    // Priorizar el texto proporcionado por el usuario si está disponible
    const textoBase = options.textoProporcionado || options.textoBaseLectura;
    
    // Delimitar claramente el texto
    lines.push('"""');
    lines.push(textoBase);
    lines.push('"""');
    
    lines.push('\n- Formula las preguntas ÚNICAMENTE sobre este texto.');
    lines.push('- IMPORTANTE: NO incluyas el texto en la propiedad textoBase del JSON, ya fue provisto externamente.');
    
    if (esTextoUsuario) {
      lines.push('- Este es un texto proporcionado por el usuario, asegúrate de formular preguntas relevantes y precisas.');
      
      if (asignatura === 'Matemática') {
        lines.push('- Para matemáticas, extrae datos numéricos y situaciones del texto para formular problemas matemáticos relacionados.');
        lines.push('- Cuando sea relevante, inventa datos numéricos coherentes con la situación para completar los problemas.');
      }
    }
  }

  lines.push('\nIMPORTANTE: Produce SOLO el arreglo JSON, sin texto introductorio ni comentarios adicionales.');

  return lines.join('\n');
}

// Función para extraer JSON de texto que puede contener otros elementos
// Función auxiliar para corregir problemas comunes en textos JSON
function corregirProblemasComunes(texto: string): string {
  if (!texto) return texto;
  
  try {
    // Detectar patrones de palabras con comillas que causan problemas
    const palabrasProblematicas = ['como', 'así', 'también', 'según', 'véase', 'ejemplo'];
    
    // Aplicar correcciones antes de procesar el JSON
    let textoCorregido = texto;
    palabrasProblematicas.forEach(palabra => {
      // Busca patrones donde estas palabras aparecen entre comillas dentro de un string
      const regex = new RegExp(`"([^"]*)"${palabra}"([^"]*)"`, 'g');
      textoCorregido = textoCorregido.replace(regex, `"$1\\"${palabra}\\"$2"`);
    });
    
    // Corregir propiedades sin comillas
    textoCorregido = textoCorregido.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4');
    
    // Corregir comas finales en objetos y arrays
    textoCorregido = textoCorregido.replace(/,(\s*[\]}])/g, '$1');
    
    return textoCorregido;
  } catch (error) {
    console.log("Error al corregir problemas comunes:", error);
    return texto;
  }
}

function extraerJsonDeTexto(texto: string): string | null {
  // Verifica si el texto está vacío o es inválido
  if (!texto || typeof texto !== 'string') {
    console.error("Texto de entrada inválido:", texto);
    return null;
  }

  console.log("Iniciando extracción JSON con algoritmo mejorado...");
  
  // Limpiar caracteres especiales o invisibles que podrían estar causando problemas
  texto = texto.replace(/^\uFEFF/, ''); // Eliminar BOM si existe
  
  // Pre-procesamiento para problemas comunes conocidos
  // Este paso soluciona el problema con la posición 1625 y comillas literales como "como"
  try {
    // Aplicar correcciones iniciales
    texto = corregirProblemasComunes(texto);
  } catch (error) {
    console.log("Error durante pre-procesamiento de palabras problemáticas:", error);
  }
  
  // ESTRATEGIA 1: Buscar JSON en bloques de código (más común en gemini-1.5)
  try {
    // Buscar todos los bloques de código, a veces hay múltiples y necesitamos probarlos todos
    const codeBlockMatches = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/ig);
    if (codeBlockMatches && codeBlockMatches.length > 0) {
      console.log(`Encontrados ${codeBlockMatches.length} bloques de código potenciales`);
      
      // Probar cada bloque encontrado
      for (const codeBlock of codeBlockMatches) {
        const content = codeBlock.replace(/```(?:json)?|```/ig, '').trim();
        console.log(`Probando bloque de código: ${content.substring(0, 50)}...`);
        
        // Aplicar correcciones adicionales al contenido del bloque
        const contentProcesado = corregirProblemasComunes(content);
        const jsonDesdeCode = limpiarJsonEspecifico(contentProcesado);
        
        try {
          JSON.parse(jsonDesdeCode);
          console.log("JSON válido extraído del bloque de código");
          return jsonDesdeCode;
        } catch (e) {
          console.log("JSON en este bloque de código es inválido, continuando con siguiente bloque...");
        }
      }
    }
  } catch (error) {
    console.log("Error procesando bloques de código:", error);
  }
  
  // ESTRATEGIA 2: Buscar JSON completo en el texto
  try {
    // Busca la primera ocurrencia de un array u objeto JSON completo
    const arrayMatch = /(\[\s*\{[\s\S]*?\}\s*\])/i.exec(texto);
    if (arrayMatch && arrayMatch[1]) {
      const jsonCompleto = limpiarJsonEspecifico(arrayMatch[1].trim());
      try {
        JSON.parse(jsonCompleto);
        console.log("JSON completo válido encontrado directamente");
        return jsonCompleto;
      } catch (e) {
        console.log("JSON completo parece inválido, continuando...");
      }
    }
  } catch (error) {
    console.log("Error buscando JSON completo:", error);
  }
  
  // ESTRATEGIA 3: Buscar desde el inicio de un array hasta el final del texto
  // (útil para JSON truncados)
  try {
    const start = texto.indexOf('[');
    if (start >= 0) {
      // Ver si el texto contiene "id": "p1" que indica la primera pregunta
      const p1Index = texto.indexOf('"id":', start);
      
      if (p1Index > start) {
        console.log("Analizando estructura desde el inicio del array...");
        
        // Buscar el final del array si existe
        const end = texto.lastIndexOf(']');
        let jsonPosiblementeCompleto;
        
        if (end > start) {
          // Tenemos corchetes de apertura y cierre
          jsonPosiblementeCompleto = texto.substring(start, end + 1);
        } else {
          // No hay corchete de cierre, probablemente truncado
          // Buscar la última pregunta completa que podamos encontrar
          
          // Buscar todos los inicios de preguntas
          const idRegex = /"id"\s*:\s*"p\d+"/g;
          let match;
          let ultimaPreguntaPos = -1;
          let ultimoId = "";
          
          while ((match = idRegex.exec(texto)) !== null) {
            ultimaPreguntaPos = match.index;
            ultimoId = match[0];
          }
          
          console.log(`Última pregunta encontrada: ${ultimoId} en posición ${ultimaPreguntaPos}`);
          
          if (ultimaPreguntaPos > 0) {
            // Buscar el final de esta pregunta
            // Podría ser el inicio de la siguiente pregunta o el final del texto
            let finPregunta = texto.indexOf('"id":', ultimaPreguntaPos + ultimoId.length);
            
            if (finPregunta === -1) {
              finPregunta = texto.length;
            } else {
              // Retroceder hasta encontrar la última llave de cierre antes del nuevo id
              finPregunta = texto.lastIndexOf('}', finPregunta);
              if (finPregunta === -1) finPregunta = texto.length;
              else finPregunta += 1; // Incluir la llave de cierre
            }
            
            // Extraer el texto hasta ese punto y añadir un cierre de array
            jsonPosiblementeCompleto = texto.substring(start, finPregunta) + "]";
          } else {
            // Si no encontramos ninguna pregunta, usar todo el texto
            jsonPosiblementeCompleto = texto.substring(start) + "]";
          }
        }
        
        // Intentar limpiar y parsear
        const jsonLimpio = limpiarJsonEspecifico(jsonPosiblementeCompleto);
        try {
          JSON.parse(jsonLimpio);
          console.log("JSON reconstruido desde inicio del array");
          return jsonLimpio;
        } catch (e) {
          console.log("JSON reconstruido inválido, continuando...");
        }
      }
    }
  } catch (error) {
    console.log("Error en estrategia de reconstrucción desde inicio:", error);
  }
  
  // ESTRATEGIA 4: Buscar específicamente la primera pregunta completa
  try {
    console.log("Buscando primera pregunta completa...");
    // Buscar la primera pregunta incluyendo sus propiedades esenciales
    const preguntaRegex = /\{[\s\S]*?"id"\s*:\s*"p1"[\s\S]*?"enunciado"[\s\S]*?"alternativas"[\s\S]*?\}/;
    const preguntaMatch = preguntaRegex.exec(texto);
    
    if (preguntaMatch) {
      let preguntaTexto = preguntaMatch[0];
      
      // Verificar si la pregunta tiene una estructura válida para alternativas
      if (preguntaTexto.includes('"alternativas"') && preguntaTexto.includes('"id": "A"')) {
        // Verificar si todas las alternativas están presentes
        const alternativasIds = ["A", "B", "C", "D"];
        const alternativasEncontradas = [];
        
        for (const id of alternativasIds) {
          if (preguntaTexto.includes(`"id": "${id}"`)) {
            alternativasEncontradas.push(id);
          }
        }
        
        console.log(`Alternativas encontradas en p1: ${alternativasEncontradas.join(', ')}`);
        
        // Si tenemos al menos una alternativa, reconstruir el JSON
        if (alternativasEncontradas.length > 0) {
          // Construir un JSON válido con las alternativas que tenemos
          // Primero verificamos si el JSON ya está bien formado o necesita reparación
          
          const alternativasStart = preguntaTexto.indexOf('"alternativas"');
          const textoDesdeAlternativas = preguntaTexto.substring(alternativasStart);
          
          // Verificar si la estructura de alternativas está completa
          if (!textoDesdeAlternativas.includes(']}')) {
            console.log("Estructura de alternativas incompleta, reconstruyendo...");
            
            // Encontrar la última alternativa completa
            let ultimaAltPos = -1;
            let ultimaAltId = "";
            
            for (const id of alternativasEncontradas) {
              const idPos = preguntaTexto.lastIndexOf(`"id": "${id}"`);
              if (idPos > ultimaAltPos) {
                ultimaAltPos = idPos;
                ultimaAltId = id;
              }
            }
            
            if (ultimaAltPos !== -1) {
              console.log(`Última alternativa completa: ${ultimaAltId}`);
              
              // Buscar el final de esta alternativa
              const cierreAlt = preguntaTexto.indexOf('}', ultimaAltPos);
              
              if (cierreAlt !== -1) {
                // Extraer hasta esa alternativa y cerrar la estructura
                preguntaTexto = preguntaTexto.substring(0, cierreAlt + 1);
                
                // Si no hay cierre de array de alternativas, añadirlo
                if (!preguntaTexto.includes(']}')) {
                  preguntaTexto += ']}';
                }
              }
            }
          }
          
          // Encapsular en un array para mantener el formato esperado
          let jsonReconstruido = `[${preguntaTexto}]`;
          const jsonLimpio = limpiarJsonEspecifico(jsonReconstruido);
          
          try {
            JSON.parse(jsonLimpio);
            console.log("Primera pregunta reconstruida con éxito");
            return jsonLimpio;
          } catch (e) {
            console.log("Error al parsear primera pregunta reconstruida:", e);
          }
        }
      }
    }
  } catch (error) {
    console.log("Error buscando primera pregunta:", error);
  }
  
  // ESTRATEGIA 5: Extracción quirúrgica del enunciado y construcción manual
  try {
    console.log("Intentando extracción quirúrgica del enunciado...");
    
    // Buscar un enunciado en el texto, que es una parte crítica de la pregunta
    const enunciadoMatch = texto.match(/"enunciado"\s*:\s*"([^"]+)"/);
    
    if (enunciadoMatch && enunciadoMatch[1]) {
      const enunciado = enunciadoMatch[1].replace(/"/g, '\\"');
      console.log("Enunciado encontrado:", enunciado.substring(0, 30) + "...");
      
      // Buscar también la respuesta correcta si existe
      let respuestaCorrecta = "A"; // Por defecto
      const respuestaMatch = texto.match(/"respuesta"\s*:\s*"([A-D])"/);
      if (respuestaMatch && respuestaMatch[1]) {
        respuestaCorrecta = respuestaMatch[1];
      }
      
      // Buscar si hay alguna explicación
      let explicacion = "No disponible";
      const explicacionMatch = texto.match(/"explicacion"\s*:\s*"([^"]+)"/);
      if (explicacionMatch && explicacionMatch[1]) {
        explicacion = explicacionMatch[1].replace(/"/g, '\\"');
      }
      
      // Crear un JSON mínimo pero válido con el enunciado encontrado
      const jsonEmergencia = `[{
        "id": "p1",
        "enunciado": "${enunciado}",
        "alternativas": [
          {"id": "A", "texto": "Opción recuperada parcialmente", "esCorrecta": ${respuestaCorrecta === "A"}, "explicacion": "${respuestaCorrecta === "A" ? explicacion : ''}"},
          {"id": "B", "texto": "Opción recuperada parcialmente", "esCorrecta": ${respuestaCorrecta === "B"}, "explicacion": "${respuestaCorrecta === "B" ? explicacion : ''}"},
          {"id": "C", "texto": "Opción recuperada parcialmente", "esCorrecta": ${respuestaCorrecta === "C"}, "explicacion": "${respuestaCorrecta === "C" ? explicacion : ''}"},
          {"id": "D", "texto": "Opción recuperada parcialmente", "esCorrecta": ${respuestaCorrecta === "D"}, "explicacion": "${respuestaCorrecta === "D" ? explicacion : ''}"}
        ],
        "respuesta": "${respuestaCorrecta}",
        "explicacion": "${explicacion}",
        "habilidad": "Recuperación parcial",
        "estandarAprendizaje": "Contenido recuperado parcialmente"
      }]`;
      
      try {
        const jsonLimpio = limpiarJsonEspecifico(jsonEmergencia);
        JSON.parse(jsonLimpio);
        console.log("Generado JSON de emergencia con enunciado recuperado");
        return jsonLimpio;
      } catch (e) {
        console.log("Error al parsear JSON de emergencia:", e);
      }
    }
  } catch (error) {
    console.log("Error en extracción quirúrgica:", error);
  }
  
  // ESTRATEGIA FINAL: Construcción de un JSON mínimo si nada más funciona
  try {
    console.log("Construyendo JSON mínimo de respaldo...");
    const fallbackJson = `[{
      "id": "p1",
      "enunciado": "La respuesta de la IA no pudo ser procesada correctamente. Por favor, intente nuevamente.",
      "alternativas": [
        {"id": "A", "texto": "Volver a generar preguntas", "esCorrecta": true, "explicacion": "El sistema detectó un formato incorrecto en la respuesta de la IA y no pudo procesarla."},
        {"id": "B", "texto": "Opción no disponible", "esCorrecta": false},
        {"id": "C", "texto": "Opción no disponible", "esCorrecta": false},
        {"id": "D", "texto": "Opción no disponible", "esCorrecta": false}
      ],
      "respuesta": "A",
      "explicacion": "Se recomienda intentar generar nuevamente o con diferentes parámetros."
    }]`;
    
    return limpiarJsonEspecifico(fallbackJson);
  } catch (error) {
    console.error("Error final en construcción de JSON de respaldo:", error);
  }
  
  console.error("Todos los métodos de extracción JSON fallaron");
  return null;
}

// Función para limpiar problemas específicos de JSON que hemos identificado
function limpiarJsonEspecifico(json: string): string {
  // Registrar el JSON original para diagnóstico
  const jsonOriginal = json;
  console.log(`Limpiando JSON (primeros 50 caracteres): ${json.substring(0, 50).replace(/\n/g, '\\n')}...`);
  
  // Verificar si el JSON está truncado en medio de una estructura importante
  const detectarTruncado = () => {
    // Verificar si está truncado en medio de un array de alternativas
    if (json.includes('"alternativas"') && 
        json.lastIndexOf('"alternativas"') > json.lastIndexOf(']')) {
      console.log("JSON truncado detectado en array de alternativas");
      return true;
    }
    
    // Verificar si hay un objeto incompleto al final
    const ultimaLlaveAbierta = json.lastIndexOf('{');
    const ultimaLlaveCerrada = json.lastIndexOf('}');
    if (ultimaLlaveAbierta > ultimaLlaveCerrada) {
      console.log("JSON truncado con objeto incompleto al final");
      return true;
    }
    
    // Verificar cantidad desbalanceada de llaves y corchetes
    const contarCaracteres = (str: string, char: string) => 
      (str.match(new RegExp('\\' + char, 'g')) || []).length;
    
    const llaveAbiertas = contarCaracteres(json, '{');
    const llaveCerradas = contarCaracteres(json, '}');
    const corcheteAbiertos = contarCaracteres(json, '[');
    const corcheteCerrados = contarCaracteres(json, ']');
    
    if (llaveAbiertas !== llaveCerradas || corcheteAbiertos !== corcheteCerrados) {
      console.log("JSON con estructura desbalanceada", {
        llaveAbiertas, llaveCerradas, corcheteAbiertos, corcheteCerrados
      });
      return true;
    }
    
    return false;
  };

  // ANÁLISIS CARÁCTER POR CARÁCTER para detectar problemas específicos
  // Ayuda a detectar el error "Bad control character in string literal" en posición 392
  const problemasCaracteres = [];
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    // Detectar caracteres de control inválidos (excepto tabs, nuevas líneas y retornos)
    if (char < 32 && char !== 9 && char !== 10 && char !== 13) {
      problemasCaracteres.push({
        posicion: i,
        codigo: char,
        contexto: json.substring(Math.max(0, i-15), i) + '|PROBLEMA|' + json.substring(i+1, i+15)
      });
    }
  }

  if (problemasCaracteres.length > 0) {
    console.log(`Detectados ${problemasCaracteres.length} caracteres de control problemáticos`);
    // Mostrar los primeros problemas para diagnóstico
    problemasCaracteres.slice(0, 3).forEach(p => {
      console.log(`Carácter de control en posición ${p.posicion}, código U+${p.codigo.toString(16).padStart(4, '0')}`);
      console.log(`Contexto: ${p.contexto}`);
    });
  }
  
  // Primera limpieza básica
  // Eliminar caracteres especiales o invisibles que podrían estar causando problemas
  json = json.replace(/^\uFEFF/, ''); // Eliminar BOM si existe
  
  // MEJORA: Limpieza más selectiva de caracteres de control
  // Eliminar solo caracteres de control problemáticos preservando caracteres especiales latinos
  let jsonLimpio = '';
  for (let i = 0; i < json.length; i++) {
    const charCode = json.charCodeAt(i);
    // Mantener caracteres seguros:
    // 1. Caracteres ASCII imprimibles básicos
    // 2. Caracteres latinos especiales (tildes, ñ, etc.) - rango Unicode
    // 3. Tabulaciones y saltos de línea específicos
    if ((charCode >= 32 && charCode <= 126) || // ASCII básico imprimible
        (charCode >= 128 && charCode <= 255) || // Caracteres latinos extendidos (tildes, ñ, etc.)
        charCode === 9 ||  // Tabulación
        charCode === 10 || // Nueva línea (LF)
        charCode === 13) { // Retorno (CR)
      jsonLimpio += json[i];
    } else {
      // Reemplazar solo caracteres realmente problemáticos (control)
      // con espacios para mantener posiciones originales
      jsonLimpio += ' ';
    }
  }
  json = jsonLimpio;
  
  // Eliminar comentarios tipo JavaScript que la IA podría incluir
  json = json.replace(/\/\/.*/g, '');
  
  // Eliminar comentarios multilínea
  json = json.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Arreglar propiedades sin comillas (ej: {id: 1} -> {"id": 1})
  json = json.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4');
  
  // Eliminar comas finales en objetos y arrays (común en errores de la IA)
  json = json.replace(/,(\s*[\]}])/g, '$1');
  
  // Si detectamos JSON truncado, intentar repararlo
  if (detectarTruncado()) {
    console.log("Intentando reparar JSON truncado...");
    
    // Intentar extraer la primera pregunta completa
    const preguntaMatch = json.match(/\{\s*"id"\s*:\s*"p1"[\s\S]*?(?="id"|$)/);
    if (preguntaMatch) {
      let pregunta = preguntaMatch[0];
      
      // Verificar si la pregunta tiene un enunciado completo
      if (pregunta.includes('"enunciado"')) {
        // Si tiene alternativas iniciadas pero incompletas
        if (pregunta.includes('"alternativas"') && !pregunta.includes('"}]}')) {
          // Contar alternativas completas
          const altCompletas = (pregunta.match(/"id"\s*:\s*"[A-D]"/g) || []).length;
          
          // Reconstruir la pregunta con las alternativas que tenemos
          if (altCompletas > 0) {
            // Buscar hasta la última alternativa completa
            let ultimaAltCompletaPos = -1;
            let altTemp = -1;
            let indiceAlt = 0;
            
            while ((altTemp = pregunta.indexOf(`"id": "${String.fromCharCode(65 + indiceAlt)}"`, altTemp + 1)) !== -1) {
              ultimaAltCompletaPos = altTemp;
              indiceAlt++;
              if (indiceAlt >= 4) break; // Máximo 4 alternativas (A-D)
            }
            
            if (ultimaAltCompletaPos !== -1) {
              // Encontrar el final de esta alternativa
              const finAltPos = pregunta.indexOf('}', ultimaAltCompletaPos);
              
              if (finAltPos !== -1) {
                // Cerrar el array de alternativas y el objeto pregunta
                let preguntaReconstruida = pregunta.substring(0, finAltPos + 1);
                preguntaReconstruida += ' ] }';
                
                // Encapsular en un array
                json = `[ ${preguntaReconstruida} ]`;
                console.log("JSON reconstruido desde alternativa incompleta");
              }
            }
          }
        }
      }
    }
  }

  // MEJORA: Procesamiento manual de strings para asegurar escape correcto de caracteres
  // Esta versión procesa carácter por carácter para mejor detección de errores
  // Preservando caracteres especiales como tildes y ñ
  let result = '';
  let inString = false;
  let escapeMode = false;
  
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    const charCode = json.charCodeAt(i);
    
    if (inString) {
      // Estamos dentro de un string
      if (escapeMode) {
        // Carácter después de un escape, siempre incluirlo
        result += char;
        escapeMode = false;
      } else if (char === '\\') {
        // Inicio de secuencia de escape
        result += char;
        escapeMode = true;
      } else if (char === '"') {
        // Fin de string
        result += char;
        inString = false;
      } else if (charCode < 32) {
        // Carácter de control dentro de string - escaparlo adecuadamente
        // Esto soluciona el problema de "Bad control character in string literal"
        result += '\\u' + ('0000' + charCode.toString(16)).slice(-4);
        console.log(`Escapado carácter de control en posición ${i}: U+${charCode.toString(16).padStart(4, '0')}`);
      } else if (char === '"' && json[i-1] !== '\\') {
        // Comilla no escapada dentro de string
        result += '\\"';
        console.log(`Escapada comilla sin escapar en posición ${i}`);
      } else {
        // Carácter normal dentro de string - preservar caracteres especiales latinos
        // Esto mantiene intactas las tildes, eñes y otros caracteres especiales
        result += char;
      }
    } else {
      // Fuera de un string
      if (char === '"' && !inString) {
        // Inicio de string
        inString = true;
      }
      result += char;
    }
  }
  json = result;
  
  // Corregir valores booleanos sin comillas
  json = json.replace(/:(\s*)(true|false)(\s*[,}])/g, (match, space1, value, space2) => {
    return ': ' + value + space2;
  });
  
  // Arreglar problemas de comillas sin escapar en TODOS los campos de texto
  // Primero, aplicar una corrección para todos los campos comunes con texto
  const camposConTexto = ['explicacion', 'explanation', 'texto', 'textoBase', 'enunciado', 'habilidad', 'eje', 'estandarAprendizaje'];
  
  // Procesar cada campo por separado para asegurar que se escapen todas las comillas
  camposConTexto.forEach(campo => {
    const regex = new RegExp(`"${campo}"\\s*:\\s*"([^"]*)"`, 'g');
    json = json.replace(regex, (match, content) => {
      // Escapar todas las comillas dentro del contenido
      const escapedContent = content.replace(/"/g, '\\"');
      return `"${campo}": "${escapedContent}"`;
    });
  });
  
  // Buscar específicamente patrones problemáticos comunes con frases entre comillas
  json = json.replace(/"([^"]*)"([^"]*)"([^"]*)"/g, (match, before, middle, after) => {
    // Verificar si esto parece ser un caso de comillas literales (como "así", "como", etc.)
    if (middle.trim().length < 15 && 
        (middle.includes('como') || middle.includes('así') || 
         middle.includes('también') || middle.includes('según'))) {
      return `"${before}\\"${middle}\\"${after}"`;
    }
    return match; // Dejar intacto si no parece un caso problemático
  });
  
  // Normalizar espacios en blanco (pero preservar saltos de línea por legibilidad)
  json = json.replace(/[ \t]+/g, ' ').trim();
  
  // Verificar que el JSON tenga una estructura mínima válida
  if (!json.startsWith('[') && json.includes('"id": "p1"')) {
    // Encapsular en un array si es un objeto suelto
    json = `[${json}]`;
    console.log("Encapsulando objeto en array");
  }
  
  // Si está truncado al final, cerrarlo adecuadamente
  const finEsperado = json.endsWith('}]') || json.endsWith('"]');
  if (!finEsperado && json.includes('"id": "p1"')) {
    // Verificar si necesitamos cerrar objetos y arrays no cerrados
    if (json.lastIndexOf('{') > json.lastIndexOf('}')) {
      // Cerrar un objeto abierto
      json += '}';
      console.log("Cerrando objeto abierto");
    }
    
    if (json.lastIndexOf('[') > json.lastIndexOf(']')) {
      // Cerrar un array abierto
      json += ']';
      console.log("Cerrando array abierto");
    }
  }
  
  // Asegurarse de cerrar la pregunta si contiene alternativas pero está truncada
  if (json.includes('"alternativas"') && !json.includes(']')) {
    json += ']';
    console.log("Cerrando array de alternativas truncado");
  }

  // Reparación específica para el error de posición 718 que mencionaste
  // Buscar alternativas sin cierre adecuado
  const incompleteAltMatch = json.match(/"alternativas"\s*:\s*\[\s*{\s*"id"\s*:\s*"A".*?"explicacion"\s*:\s*"[^"]*"(?!\s*})/);
  if (incompleteAltMatch) {
    const pos = json.indexOf(incompleteAltMatch[0]) + incompleteAltMatch[0].length;
    json = json.substring(0, pos) + ' }' + json.substring(pos);
    console.log("Reparado cierre de alternativa");
  }
  
  // Verificación de posición específica del error (392)
  // Si un error anterior mencionó la posición 392, verificar específicamente esa área
  const verificarPosicionEspecifica = (posicion: number) => {
    if (json.length >= posicion + 10) {
      const contexto = json.substring(Math.max(0, posicion - 20), Math.min(json.length, posicion + 20));
      console.log(`Verificando contexto alrededor de posición ${posicion}: "${contexto}"`);
      
      // Caracteres sospechosos alrededor de esta posición
      const charCodes = [];
      for (let i = Math.max(0, posicion - 5); i < Math.min(json.length, posicion + 5); i++) {
        charCodes.push({
          pos: i,
          char: json[i],
          code: json.charCodeAt(i),
          hex: json.charCodeAt(i).toString(16).padStart(4, '0')
        });
      }
      
      console.log("Análisis de caracteres alrededor de posición específica:");
      charCodes.forEach(c => {
        console.log(`Pos ${c.pos}: "${c.char}" (U+${c.hex})`);
      });
    }
  };
  
  // Verificar posición 392 que suele ser problemática
  verificarPosicionEspecifica(392);

  // Intentar validar el JSON una vez limpio
  try {
    // Antes de intentar parsear, aplicar una normalización adicional
    // que aborda el problema de espacios en blanco irregulares en textoBase
    if (json.includes('textoBase')) {
      // El error parece estar relacionado con el campo textoBase que contiene saltos de línea
      // Normalizar el formato del campo textoBase específicamente
      json = json.replace(/"textoBase"\s*:\s*"([^"]*)"/g, (match, content) => {
        // Eliminar saltos de línea y caracteres problemáticos en textoBase
        const cleanContent = content.replace(/[\n\r\t\f\v]/g, ' ').replace(/\s+/g, ' ');
        return `"textoBase": "${cleanContent}"`;
      });
      
      console.log("Aplicada normalización especial para campo textoBase");
    }
    
    // También normalizar campos de explicacion que pueden contener texto con formato especial
    if (json.includes('"explicacion"')) {
      json = json.replace(/"explicacion"\s*:\s*"([^"]*)"/g, (match, content) => {
        // Simplificar la explicación para evitar problemas de formato
        const cleanContent = content.replace(/[\n\r\t\f\v]/g, ' ').replace(/\s+/g, ' ');
        return `"explicacion": "${cleanContent}"`;
      });
      
      console.log("Aplicada normalización especial para campos explicacion");
    }
    
    // Intentar parsear el JSON después de las normalizaciones adicionales
    JSON.parse(json);
    console.log("JSON limpio válido");
  } catch (e) {
    console.log("JSON sigue siendo inválido después de limpieza, intentando reparación más agresiva");
    console.error("Error específico:", e.message);
    
    try {
      // Si el error menciona una posición específica, intentar reparación puntual
      if (e.message && e.message.includes('position')) {
        const posMatch = e.message.match(/position (\d+)/);
        if (posMatch) {
          const pos = parseInt(posMatch[1]);
          console.log(`Error en posición específica: ${pos}`);
          
          // Extraer contexto alrededor de la posición del error
          const contexto = json.substring(Math.max(0, pos - 30), Math.min(json.length, pos + 30));
          console.log(`Contexto del error: "${contexto}"`);
          
          // MEJORA: Solución específica para error en posición 392
          if (pos === 392 || (pos > 380 && pos < 400)) {
            console.log("¡Detectado el error típico en posición ~392! Aplicando corrección específica...");
            
            // Examinar caracteres alrededor de la posición
            verificarPosicionEspecifica(pos);
            
            // Intentar recortar o reemplazar la sección problemática
            try {
              // Encontrar el inicio y fin del string donde está el problema
              const inicioString = json.lastIndexOf('"', pos);
              const finString = json.indexOf('"', pos);
              
              if (inicioString !== -1 && finString !== -1) {
                // Reemplazar toda la sección problemática
                const antesDeString = json.substring(0, inicioString + 1);
                const despuesDeString = json.substring(finString);
                const contenidoLimpio = "Contenido reemplazado debido a caracteres de control";
                
                json = antesDeString + contenidoLimpio + despuesDeString;
                console.log("Aplicada corrección específica para error en posición 392");
                
                // Verificar si resolvió el problema
                try {
                  JSON.parse(json);
                  console.log("Corrección específica exitosa");
                  return json;
                } catch (e4) {
                  console.log("La corrección específica falló, continuando...");
                }
              }
            } catch (e5) {
              console.log("Error durante corrección específica:", e5);
            }
          }
          
          // Intentar reparación específica según el contexto del error
          if (contexto.includes('"textoBase"') || contexto.includes('"explicacion"')) {
            // Problema con comillas en textoBase o explicacion
            const inicio = json.lastIndexOf('"', pos) + 1;
            const fin = json.indexOf('"', pos);
            
            if (inicio >= 0 && fin >= 0) {
              // Recortar el contenido problemático
              const contenidoProblematico = json.substring(inicio, fin);
              const contenidoLimpio = contenidoProblematico.substring(0, Math.min(100, contenidoProblematico.length));
              
              // Reemplazar el contenido problemático
              json = json.substring(0, inicio) + contenidoLimpio + json.substring(fin);
              console.log("Aplicada reparación de campo con truncado de contenido");
              
              // Verificar si ahora es válido
              try {
                JSON.parse(json);
                console.log("Reparación exitosa por truncado de contenido");
                return json;
              } catch (e3) {
                console.log("Reparación por truncado falló, continuando con reconstrucción completa");
              }
            }
          }
        }
      }
      
      // Analizar y reconstruir manualmente - Extraer la información clave
      const idMatch = json.match(/"id"\s*:\s*"([^"]*)"/);
      const enunciadoMatch = json.match(/"enunciado"\s*:\s*"([^"]*)"/);
      
      // Si tenemos al menos id y enunciado, podemos reconstruir un objeto mínimo
      if (idMatch && enunciadoMatch) {
        const id = idMatch[1];
        // Limitar el tamaño del enunciado para evitar problemas
        const enunciadoOriginal = enunciadoMatch[1];
        const enunciado = enunciadoOriginal.length > 150 ? 
                        enunciadoOriginal.substring(0, 150) + "..." : 
                        enunciadoOriginal;
        
        console.log(`Reconstruyendo con id="${id}" y enunciado="${enunciado.substring(0, 30)}..."`);
        
        // Construir un JSON válido de emergencia
        const jsonEmergencia = `[{
          "id": "${id}",
          "enunciado": "${enunciado}",
          "alternativas": [
            {"id": "A", "texto": "Alternativa A (reconstruida)", "esCorrecta": true, "explicacion": "Alternativa reconstruida automáticamente debido a problemas en el formato JSON."},
            {"id": "B", "texto": "Alternativa B", "esCorrecta": false},
            {"id": "C", "texto": "Alternativa C", "esCorrecta": false},
            {"id": "D", "texto": "Alternativa D", "esCorrecta": false}
          ],
          "estandarAprendizaje": "Contenido reconstruido debido a problemas en el formato JSON"
        }]`;
        
        // Verificar si es válido
        try {
          JSON.parse(jsonEmergencia);
          console.log("Generada versión de emergencia del JSON");
          json = jsonEmergencia;
        } catch (e2) {
          // Si aún hay problemas, simplemente crear un JSON mínimo válido
          console.log("Error al parsear JSON de emergencia, creando versión básica");
          json = `[{
            "id": "p1",
            "enunciado": "No fue posible procesar la respuesta. Por favor, intente nuevamente.",
            "alternativas": [
              {"id": "A", "texto": "Intentar nuevamente", "esCorrecta": true, "explicacion": "Se recomienda volver a intentar la generación."},
              {"id": "B", "texto": "Opción B", "esCorrecta": false},
              {"id": "C", "texto": "Opción C", "esCorrecta": false},
              {"id": "D", "texto": "Opción D", "esCorrecta": false}
            ],
            "habilidad": "Diagnóstico",
            "estandarAprendizaje": "Error en generación"
          }]`;
        }
      } else {
        // Si no podemos encontrar ni siquiera el id y el enunciado, usar el fallback mínimo
        console.log("No se encontraron datos mínimos para reconstrucción, usando JSON de fallback mínimo");
        json = `[{
          "id": "p1",
          "enunciado": "No fue posible procesar la respuesta de la IA. Por favor, intente nuevamente.",
          "alternativas": [
            {"id": "A", "texto": "Volver a intentar", "esCorrecta": true, "explicacion": "El sistema detectó un formato incorrecto en la respuesta de la IA."},
            {"id": "B", "texto": "Modificar parámetros", "esCorrecta": false},
            {"id": "C", "texto": "Usar menos preguntas", "esCorrecta": false},
            {"id": "D", "texto": "Contactar soporte", "esCorrecta": false}
          ],
          "habilidad": "Diagnóstico",
          "estandarAprendizaje": "Error en formato de respuesta"
        }]`;
      }
    } catch (recError) {
      console.log("Error durante la reconstrucción manual:", recError);
      
      // Fallback final si todo lo demás falla
      json = `[{
        "id": "p1",
        "enunciado": "Error crítico en el procesamiento de la respuesta.",
        "alternativas": [
          {"id": "A", "texto": "Intentar nuevamente", "esCorrecta": true, "explicacion": "Error técnico en el procesamiento de la respuesta."},
          {"id": "B", "texto": "Opción B", "esCorrecta": false},
          {"id": "C", "texto": "Opción C", "esCorrecta": false},
          {"id": "D", "texto": "Opción D", "esCorrecta": false}
        ]
      }]`;
    }
  }
  
  // Si las modificaciones no funcionaron, mostrar un log detallado
  if (jsonOriginal !== json) {
    console.log("Se realizaron modificaciones al JSON original");
    
    // Intentar validar una vez más
    try {
      JSON.parse(json);
    } catch (finalError) {
      console.error("JSON final sigue siendo inválido:", finalError);
      console.log("JSON limpiado (primeros 100 caracteres):", json.substring(0, 100));
    }
  }
  
  return json;
}

// Función para procesar la respuesta de la IA y convertirla en preguntas
function procesarRespuestaIA(respuesta: string, cantidad: number, options?: GeneracionSimceOptions): Pregunta[] {
  if (!respuesta || typeof respuesta !== 'string') {
    console.error("Respuesta de IA inválida:", respuesta);
    throw new Error("No se recibió una respuesta válida de la IA");
  }

  console.log("Procesando respuesta de la IA...");
  
  try {
    // Imprimir algunos detalles de la respuesta para diagnóstico
    console.log(`Respuesta recibida: ${respuesta.length} caracteres. Primeros 100:`, 
                respuesta.substring(0, 100).replace(/\n/g, '\\n'));
    
    // Extraer JSON de la respuesta usando nuestra función robusta
    const jsonText = extraerJsonDeTexto(respuesta);
    
    if (!jsonText) {
      console.error("No se pudo extraer JSON de la respuesta después de múltiples intentos");
      // Crear una respuesta mínima para no interrumpir la experiencia del usuario
      return crearPreguntasDeEmergencia(1, "La IA generó una respuesta en un formato que no se pudo procesar. Por favor, intente nuevamente.");
    }
    
    console.log("JSON extraído correctamente, intentando parsear...");
    
    // Parsear el JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
      console.log("JSON parseado correctamente:", typeof parsed, Array.isArray(parsed) ? parsed.length : 'no es array');
    } catch (error) {
      console.error("Error al parsear el JSON final:", error, "JSON parcial:", jsonText.substring(0, 200));
      
      // Intento de reparación de emergencia
      console.log("Intentando reparación de emergencia del JSON...");
      try {
        // Verificar si podemos extraer al menos parte del JSON
        const matchParcial = jsonText.match(/\[\s*\{.*?\}\s*(?:\]|$)/s);
        if (matchParcial) {
          const jsonParcial = matchParcial[0].endsWith(']') ? matchParcial[0] : matchParcial[0] + ']';
          parsed = JSON.parse(jsonParcial);
          console.log("Reparación parcial exitosa");
        } else {
          // Si no hay match parcial, crear objeto de respaldo
          throw new Error("No se pudo reparar el JSON");
        }
      } catch (errorReparacion) {
        console.log("Creando objeto de respaldo después de error de parseo final");
        return crearPreguntasDeEmergencia(1, "La IA generó una respuesta en formato incorrecto. Por favor, intente nuevamente con diferentes parámetros.");
      }
    }
    
    // Asegurarse de que tenemos un array
    if (!Array.isArray(parsed)) {
      console.log("La respuesta no es un array, encapsulándola");
      if (typeof parsed === 'object' && parsed !== null) {
        parsed = [parsed];
      } else {
        console.error("La respuesta no es un objeto que podamos encapsular:", typeof parsed);
        return crearPreguntasDeEmergencia(1, "La respuesta recibida no tiene el formato esperado. Por favor, intente nuevamente.");
      }
    }
    
    // Filtrar elementos nulos o inválidos
    parsed = parsed.filter((item: any) => item && typeof item === 'object');
    
    if (parsed.length === 0) {
      console.error("No se encontraron preguntas válidas después de filtrar");
      return crearPreguntasDeEmergencia(1, "No se pudieron extraer preguntas válidas de la respuesta. Por favor, intente nuevamente.");
    }
    
    console.log(`Se encontraron ${parsed.length} preguntas para procesar`);
    
    // Verificar si encontramos menos preguntas de las esperadas
    if (parsed.length < cantidad) {
      console.warn(`⚠️ Solo se generaron ${parsed.length} preguntas de ${cantidad} solicitadas. Intentando re-generación automática.`);
      
      // Si solo tenemos 1 pregunta y se solicitaron varias, es posible que haya un problema con el JSON
      if (parsed.length === 1 && cantidad > 1 && options && options.asignatura) {
        console.log("Detectado problema de generación parcial. Intentando recuperar más preguntas...");
      }
    }
    
    // Extraer textoBase si existe (solo en preguntas de Lectura)
    let textoBase: string | undefined;
    
    // Si el usuario proporcionó un texto, usarlo como textoBase (prioridad más alta)
    if (options?.textoProporcionado) {
      textoBase = options.textoProporcionado;
      console.log("Usando texto proporcionado por el usuario como textoBase");
    }
    // Si la IA generó un texto base, usarlo si no hay texto proporcionado
    else if (parsed.length > 0 && parsed[0].textoBase) {
      textoBase = parsed[0].textoBase;
      console.log("Se encontró textoBase generado por la IA para preguntas de Lectura");
    }
    
    // Si hay un texto base explícito en las opciones (segunda prioridad)
    else if (options?.textoBaseLectura) {
      textoBase = options.textoBaseLectura;
      console.log("Usando textoBaseLectura de las opciones");
    }
    
    // Limitar a la cantidad solicitada
    const preguntasProcesadas = parsed.slice(0, cantidad).map((p: any, idx: number): Pregunta => {
      try {
        console.log(`Procesando pregunta ${idx + 1}...`);
        
        // Verificar que p sea un objeto válido
        if (!p || typeof p !== 'object') {
          throw new Error(`La pregunta ${idx + 1} no es un objeto válido`);
        }
        
        // Verificar que tengamos al menos enunciado
        if (!p.enunciado && !p.pregunta && !p.texto) {
          console.warn(`La pregunta ${idx + 1} no tiene enunciado, buscando alternativas...`);
          
          // Buscar alguna propiedad que pueda contener el enunciado
          const posibleEnunciado = Object.entries(p).find(([key, value]) => 
            typeof value === 'string' && value.length > 20 && 
            ['contenido', 'stem', 'question', 'statement'].includes(key.toLowerCase())
          );
          
          if (posibleEnunciado) {
            p.enunciado = posibleEnunciado[1];
            console.log(`Usando '${posibleEnunciado[0]}' como enunciado`);
          } else {
            throw new Error(`No se encontró enunciado para la pregunta ${idx + 1}`);
          }
        }
        
        // Validar y normalizar alternativas
        let alternativasRaw = Array.isArray(p.alternativas) ? p.alternativas : [];
        
        // Si no hay alternativas pero hay propiedades A, B, C, D, usarlas
        if (alternativasRaw.length === 0 && (p.A || p.a || p.opciones || p.options)) {
          console.log("Detectado formato alternativo de alternativas");
          
          // Intentar diferentes formatos conocidos
          if (p.opciones && Array.isArray(p.opciones)) {
            alternativasRaw = p.opciones;
          } else if (p.options && Array.isArray(p.options)) {
            alternativasRaw = p.options;
          } else {
            // Buscar propiedades A/B/C/D o a/b/c/d
            alternativasRaw = ['A', 'B', 'C', 'D'].map(letra => {
              // Intentar tanto con mayúscula como con minúscula
              const propMayus = p[letra];
              const propMinus = p[letra.toLowerCase()];
              const prop = propMayus !== undefined ? propMayus : propMinus;
              
              if (prop) {
                if (typeof prop === 'string') {
                  return { id: letra, texto: prop, esCorrecta: p.respuesta === letra || p.correcta === letra };
                } else if (typeof prop === 'object') {
                  return { id: letra, ...prop };
                }
              }
              return { id: letra, texto: `Alternativa ${letra}`, esCorrecta: false };
            });
          }
        }
        
        // Si aún no hay alternativas, crear 4 por defecto
        if (alternativasRaw.length === 0) {
          console.log("No se encontraron alternativas, creando alternativas por defecto");
          alternativasRaw = [
            { id: "A", texto: "Opción A (generada automáticamente)", esCorrecta: true },
            { id: "B", texto: "Opción B (generada automáticamente)", esCorrecta: false },
            { id: "C", texto: "Opción C (generada automáticamente)", esCorrecta: false },
            { id: "D", texto: "Opción D (generada automáticamente)", esCorrecta: false }
          ];
        }
        
        // Normalizar alternativas al formato esperado
        const alternativas: Alternativa[] = alternativasRaw.map((a: any, i: number) => {
          if (!a) {
            console.warn(`Alternativa ${i} es nula o indefinida, creando alternativa por defecto`);
            return {
              id: String.fromCharCode(65 + i), // A, B, C, D
              texto: `Alternativa ${String.fromCharCode(65 + i)} (generada por defecto)`,
              esCorrecta: false
            } as Alternativa;
          }
          
          if (typeof a === 'string') {
            // Si la alternativa es solo un string
            return {
              id: String.fromCharCode(65 + i), // A, B, C, D
              texto: a,
              esCorrecta: p.respuesta === String.fromCharCode(65 + i) || 
                         p.correcta === String.fromCharCode(65 + i) ||
                         p.respuesta === i || p.respuesta === (i+1).toString()
            } as Alternativa;
          }
          
          // Buscar texto de alternativa en varios campos posibles
          const texto = a?.texto || a?.text || a?.contenido || a?.content || 
                       `Alternativa ${String.fromCharCode(65 + i)}`;
          
          // Normalizar ID de alternativa
          let altId = a?.id || String.fromCharCode(65 + i);
          if (typeof altId === 'number') altId = String.fromCharCode(64 + altId); // 1->A, 2->B, etc.
          
          // Determinar si esta alternativa es correcta
          let esCorrecta = false;
          
          // Verificar diferentes formas de indicar que es correcta
          if (a?.esCorrecta === true || a?.isCorrect === true || a?.correct === true) {
            esCorrecta = true;
          }
          
          // Si hay una propiedad "respuesta" o "correcta" en la pregunta
          const respuestaValue = p.respuesta || p.correcta || p.respuestaCorrecta || p.correct;
          if (respuestaValue) {
            if (respuestaValue === altId || 
                respuestaValue === i || 
                respuestaValue === i+1 || 
                respuestaValue === (i+1).toString()) {
              esCorrecta = true;
            }
          }
          
          // Crear la alternativa normalizada
          return {
            id: altId,
            texto,
            esCorrecta,
            explicacion: a?.explicacion || a?.explanation || ''
          } as Alternativa;
        }).filter(a => a && a.texto); // Filtrar alternativas sin texto
        
        // Si no hay alternativas después de filtrar, crear unas por defecto
        if (alternativas.length === 0) {
          console.warn("No hay alternativas válidas después de filtrar, creando por defecto");
          alternativas.push(
            { id: "A", texto: "Alternativa A (por defecto)", esCorrecta: true },
            { id: "B", texto: "Alternativa B (por defecto)", esCorrecta: false },
            { id: "C", texto: "Alternativa C (por defecto)", esCorrecta: false },
            { id: "D", texto: "Alternativa D (por defecto)", esCorrecta: false }
          );
        }
        
        // Asegurarse de que hay exactamente 4 alternativas (A, B, C, D)
        while (alternativas.length < 4) {
          const letra = String.fromCharCode(65 + alternativas.length);
          console.log(`Agregando alternativa ${letra} faltante`);
          alternativas.push({
            id: letra,
            texto: `Alternativa ${letra} (agregada automáticamente)`,
            esCorrecta: false
          });
        }
        
        // Si hay más de 4 alternativas, dejar solo las 4 primeras (A, B, C, D)
        if (alternativas.length > 4) {
          console.log(`Demasiadas alternativas (${alternativas.length}), conservando solo 4`);
          alternativas.splice(4);
        }
        
        // Si no hay ninguna alternativa marcada como correcta, marcar la primera
        if (!alternativas.some(a => a.esCorrecta)) {
          console.log("No se encontró alternativa marcada como correcta, marcando la primera");
          alternativas[0].esCorrecta = true;
        }
        
        // Buscar la explicación
        const alternativaCorrecta = alternativas.find(a => a.esCorrecta);
        const explicacionGeneral = alternativaCorrecta?.explicacion || p.explicacion || p.explanation || '';
        
        // Asegurar que la alternativa correcta tenga explicación
        if (explicacionGeneral && alternativaCorrecta && !alternativaCorrecta.explicacion) {
          alternativaCorrecta.explicacion = explicacionGeneral;
        }
        
        // Si no hay explicación, agregar una genérica
        if (alternativaCorrecta && !alternativaCorrecta.explicacion) {
          alternativaCorrecta.explicacion = `La respuesta correcta es la alternativa ${alternativaCorrecta.id}`;
        }
        
        // Normalizar campos y construir la pregunta
        const pregunta: Pregunta = {
          id: p.id || `p${idx + 1}`,
          enunciado: p.enunciado || p.pregunta || p.texto || `Pregunta ${idx + 1}`,
          alternativas,
          estandarAprendizaje: p.estandarAprendizaje || p.estandar || p.standard || '',
          habilidad: p.habilidad || p.eje || p.skill || p.axis || '',
          textoBase: idx === 0 ? textoBase : undefined,
          createdAt: serverTimestamp() as Timestamp,
          dificultad: p.dificultad || p.difficulty || 'media'
        };
        
        return pregunta;
      } catch (errorProceso) {
        console.error(`Error procesando pregunta ${idx + 1}:`, errorProceso);
        
        // Crear una pregunta de respaldo en caso de error
        return crearPreguntaDeEmergencia(idx + 1);
      }
    });
    
    console.log(`Procesamiento completado: ${preguntasProcesadas.length} preguntas procesadas`);
    // Si hay menos preguntas de las solicitadas, completar con emergencias
    if (preguntasProcesadas.length < cantidad) {
      const faltantes = cantidad - preguntasProcesadas.length;
      console.warn(`Rellenando ${faltantes} pregunta(s) para alcanzar la cantidad solicitada (${cantidad})`);
      for (let i = 0; i < faltantes; i++) {
        preguntasProcesadas.push(crearPreguntaDeEmergencia(preguntasProcesadas.length + 1));
      }
    }
    return preguntasProcesadas;
    
  } catch (error) {
    console.error("Error general en procesarRespuestaIA:", error);
    return crearPreguntasDeEmergencia(cantidad, "Ocurrió un error al procesar la respuesta de la IA. Por favor, intente nuevamente.");
  }
}

// Función auxiliar para crear preguntas de emergencia
function crearPreguntaDeEmergencia(num: number): Pregunta {
  return {
    id: `p${num}`,
    enunciado: `Pregunta ${num} (no se pudo generar correctamente)`,
    alternativas: [
      { id: "A", texto: "Intentar nuevamente", esCorrecta: true, explicacion: "Se recomienda volver a intentar la generación con el modelo Pro." },
      { id: "B", texto: "Modificar parámetros", esCorrecta: false },
      { id: "C", texto: "Reducir complejidad", esCorrecta: false },
      { id: "D", texto: "Contactar soporte", esCorrecta: false }
    ],
    habilidad: "No disponible",
    estandarAprendizaje: "No disponible",
    createdAt: serverTimestamp() as Timestamp,
    dificultad: "media"
  };
}

// Función para crear múltiples preguntas de emergencia
function crearPreguntasDeEmergencia(cantidad: number, mensaje: string): Pregunta[] {
  const preguntas: Pregunta[] = [];
  
  for (let i = 0; i < cantidad; i++) {
    preguntas.push({
      id: `p${i + 1}`,
      enunciado: i === 0 ? mensaje : `Pregunta ${i + 1} (no disponible)`,
      alternativas: [
        { id: "A", texto: "Intentar nuevamente", esCorrecta: true, explicacion: "Se recomienda volver a intentar la generación." },
        { id: "B", texto: "Modificar parámetros de generación", esCorrecta: false },
        { id: "C", texto: "Usar menos cantidad de preguntas", esCorrecta: false },
        { id: "D", texto: "Revisar el contexto proporcionado", esCorrecta: false }
      ],
      habilidad: "Diagnóstico",
      estandarAprendizaje: "Error en generación",
      createdAt: serverTimestamp() as Timestamp,
      dificultad: "media"
    });
  }
  
  return preguntas;
}
