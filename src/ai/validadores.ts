// Validadores y ayudantes para procesamiento de respuestas de IA
// Este archivo contiene funciones utilitarias para validar y corregir respuestas de la IA

/**
 * Realiza validaciones específicas para diferentes respuestas JSON de la IA
 */
export function validarRespuestaDeIA(texto: string, tipo: string): { 
  esValido: boolean;
  mensaje: string;
  problemas: string[];
} {
  const problemas: string[] = [];
  let esValido = true;

  // Validaciones comunes para todos los tipos
  if (!texto || typeof texto !== 'string') {
    return { esValido: false, mensaje: "Respuesta vacía o inválida", problemas: ["Respuesta vacía o no es texto"] };
  }

  // Detectar si contiene JSON
  const contieneJSON = texto.includes('{') && texto.includes('}');
  if (!contieneJSON) {
    problemas.push("No contiene estructura JSON");
    esValido = false;
  }

  // Buscar errores conocidos según el tipo
  switch (tipo) {
    case 'simce':
      // Verificar formato específico de preguntas SIMCE
      if (!texto.includes('"id"') || !texto.includes('"enunciado"')) {
        problemas.push("Falta formato de pregunta con id/enunciado");
        esValido = false;
      }
      
      if (!texto.includes('"alternativas"')) {
        problemas.push("Falta sección de alternativas");
        esValido = false;
      }
      
      // Buscar errores comunes en formato JSON de SIMCE
      if (texto.includes('"como"')) {
        problemas.push("Posible problema con comillas en palabras como 'como'");
      }
      
      if (texto.includes('"así"')) {
        problemas.push("Posible problema con comillas en palabras como 'así'");
      }
      
      // Verificar balance de llaves
      const llaveAbiertas = (texto.match(/\{/g) || []).length;
      const llaveCerradas = (texto.match(/\}/g) || []).length;
      if (llaveAbiertas !== llaveCerradas) {
        problemas.push(`Desbalance de llaves: ${llaveAbiertas} abiertas vs ${llaveCerradas} cerradas`);
        esValido = false;
      }
      
      // Contar preguntas esperadas
      const idsEncontrados = texto.match(/"id"\s*:\s*"p\d+"/g) || [];
      if (idsEncontrados.length < 2) {
        problemas.push(`Solo se encontró ${idsEncontrados.length} pregunta`);
      }
      break;
      
    // Agregar otros tipos de respuestas según sea necesario
    default:
      // Validación genérica para JSON
      try {
        // Intentar extraer JSON si está en un bloque de código
        let jsonText = texto;
        const codeMatch = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeMatch && codeMatch[1]) {
          jsonText = codeMatch[1];
        }
        
        // Probar a parsear
        JSON.parse(jsonText);
      } catch (e) {
        problemas.push(`Error al parsear JSON: ${e instanceof Error ? e.message : 'Error desconocido'}`);
        esValido = false;
      }
  }

  // Generar mensaje descriptivo
  const mensaje = esValido ? 
    "La respuesta parece válida" : 
    `Problemas detectados: ${problemas.join('; ')}`;

  return { esValido, mensaje, problemas };
}

/**
 * Intenta corregir problemas comunes en respuestas JSON de la IA
 */
export function corregirRespuestaDeIA(texto: string, tipo: string): string {
  if (!texto || typeof texto !== 'string') return texto;
  
  // Extraer solo el bloque de código si está presente
  const codeMatch = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const textoACorregir = codeMatch ? codeMatch[1] : texto;
  
  let corregido = textoACorregir;
  
  // Correcciones según el tipo
  switch (tipo) {
    case 'simce':
      // Corregir comillas problemáticas en palabras comunes
      corregido = corregido.replace(/"([^"]*)"como"([^"]*)"/g, '"$1\\"como\\"$2"');
      corregido = corregido.replace(/"([^"]*)"así"([^"]*)"/g, '"$1\\"así\\"$2"');
      corregido = corregido.replace(/"([^"]*)"también"([^"]*)"/g, '"$1\\"también\\"$2"');
      corregido = corregido.replace(/"([^"]*)"según"([^"]*)"/g, '"$1\\"según\\"$2"');
      
      // Corregir errores comunes en propiedades
      corregido = corregido.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4');
      
      // Corregir comas finales
      corregido = corregido.replace(/,(\s*[\]}])/g, '$1');
      break;
      
    // Agregar correcciones para otros tipos
    default:
      // Correcciones genéricas
      corregido = corregido.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4');
      corregido = corregido.replace(/,(\s*[\]}])/g, '$1');
  }
  
  // Si había un bloque de código, reemplazar solo ese contenido
  if (codeMatch) {
    return texto.replace(codeMatch[0], '```json\n' + corregido + '\n```');
  }
  
  return corregido;
}

/**
 * Intenta extraer un subconjunto de JSON válido de una respuesta parcialmente corrupta
 */
export function extraerJSONValido(texto: string): string | null {
  if (!texto) return null;
  
  try {
    // 1. Intentar extraer el array completo si existe
    const arrayMatch = texto.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch && arrayMatch[0]) {
      try {
        JSON.parse(arrayMatch[0]);
        return arrayMatch[0];
      } catch (e) {
        // Continuar con otras estrategias
      }
    }
    
    // 2. Extraer objetos individuales y reconstruir el array
    const objetosRegex = /\{\s*"id"\s*:\s*"p\d+"[\s\S]*?(?=\{\s*"id"|$)/g;
    const objetos = [];
    let match;
    
    while ((match = objetosRegex.exec(texto)) !== null) {
      let objeto = match[0].trim();
      
      // Asegurar que el objeto termina correctamente
      if (!objeto.endsWith('}')) {
        objeto += '}';
      }
      
      // Validar si es un objeto JSON válido
      try {
        JSON.parse(objeto);
        objetos.push(objeto);
      } catch (e) {
        // Intentar limpiar y validar nuevamente
        const objetoLimpio = objeto
          .replace(/,\s*$/, '')
          .replace(/([^"}]),(\s*\})/, '$1$2');
        
        try {
          JSON.parse(objetoLimpio);
          objetos.push(objetoLimpio);
        } catch (e2) {
          // No podemos recuperar este objeto
        }
      }
    }
    
    if (objetos.length > 0) {
      const jsonReconstruido = `[${objetos.join(',')}]`;
      try {
        JSON.parse(jsonReconstruido);
        return jsonReconstruido;
      } catch (e) {
        // No pudimos reconstruir un JSON válido
      }
    }
    
  } catch (error) {
    console.error("Error al extraer JSON válido:", error);
  }
  
  return null;
}

/**
 * Verifica la integridad de los datos SIMCE generados
 */
export function verificarIntegridadSimce(preguntas: any[]): {
  esValido: boolean;
  mensaje: string;
  problemas: string[];
} {
  const problemas: string[] = [];
  let esValido = true;
  
  if (!Array.isArray(preguntas)) {
    return { 
      esValido: false, 
      mensaje: "El formato no es un array de preguntas", 
      problemas: ["Formato inválido - no es array"] 
    };
  }
  
  if (preguntas.length === 0) {
    return { 
      esValido: false, 
      mensaje: "No hay preguntas para validar", 
      problemas: ["Array vacío"] 
    };
  }
  
  // Validar cada pregunta
  preguntas.forEach((pregunta, index) => {
    if (!pregunta.id) {
      problemas.push(`Pregunta ${index+1}: Falta ID`);
      esValido = false;
    }
    
    if (!pregunta.enunciado) {
      problemas.push(`Pregunta ${index+1}: Falta enunciado`);
      esValido = false;
    }
    
    // Validar alternativas
    if (!Array.isArray(pregunta.alternativas) || pregunta.alternativas.length < 4) {
      problemas.push(`Pregunta ${index+1}: Alternativas incompletas (${pregunta.alternativas?.length || 0} de 4)`);
      esValido = false;
    } else {
      // Verificar que haya exactamente una alternativa correcta
      const correctas = pregunta.alternativas.filter((a: any) => a.esCorrecta);
      if (correctas.length !== 1) {
        problemas.push(`Pregunta ${index+1}: Tiene ${correctas.length} alternativas correctas (debe ser 1)`);
        esValido = false;
      }
    }
  });
  
  const mensaje = esValido ? 
    `Todas las ${preguntas.length} preguntas son válidas` : 
    `Se encontraron ${problemas.length} problemas en las preguntas`;
  
  return { esValido, mensaje, problemas };
}
