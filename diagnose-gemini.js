// Script de diagnóstico para problemas de procesamiento de JSON en la generación de preguntas SIMCE
const fs = require('fs');
const path = require('path');

// Simular una respuesta típica de Gemini basada en los logs del usuario
const mockGeminiResponse = `\`\`\`json
[
  {
    "id": "p1",
    "enunciado": "¿Cuál es el principal objetivo del proyecto descrito en el texto?",
    "alternativas": [
      {
        "id": "A",
        "texto": "Preservar la biodiversidad marina mediante la creación de áreas protegidas",
        "esCorrecta": true,
        "explicacion": "El texto menciona explícitamente que el principal objetivo del proyecto es 'preservar la biodiversidad marina mediante la designación de áreas marinas protegidas', lo que coincide exactamente con esta alternativa."
      },
      {
        "id": "B",
        "texto": "Prohibir completamente la pesca en todas las costas chilenas",
        "esCorrecta": false
      },
      {
        "id": "C",
        "texto": "Estudiar las especies marinas para su explotación comercial",
        "esCorrecta": false
      },
      {
        "id": "D",
        "texto": "Promover el turismo en las zonas costeras de Chile",
        "esCorrecta": false
      }
    ],
    "habilidad": "Localizar información",
    "textoBase": "Conservación Marina en Chile\n\nUn innovador proyecto de conservación marina se está implementando en las costas de Chile. La iniciativa, denominada \"Mares Vivos\", tiene como objetivo preservar la biodiversidad marina mediante la designación de áreas marinas protegidas donde se regulará la actividad pesquera y otras actividades humanas.\n\nLas costas chilenas albergan una extraordinaria diversidad de especies, muchas de las cuales se encuentran amenazadas por la sobrepesca, la contaminación y el cambio climático. El proyecto busca establecer un equilibrio entre la conservación y el uso sostenible de los recursos marinos, permitiendo que comunidades costeras puedan mantener sus tradiciones pesqueras de forma responsable.\n\nLos científicos que participan en esta iniciativa han identificado zonas críticas para la reproducción de especies emblemáticas como la ballena azul, el pingüino de Humboldt y diversas especies de peces que son fundamentales para el ecosistema. En estas áreas, se implementarán restricciones temporales de pesca durante las épocas de reproducción.\n\n\"No se trata de prohibir la pesca, sino de hacerla compatible con la conservación\", explicó la Dra. María Campos, bióloga marina y coordinadora del proyecto. \"Queremos que nuestros océanos sigan siendo fuente de vida y sustento para las futuras generaciones\".\n\nLas comunidades pesqueras locales están siendo consultadas e integradas en el diseño de las medidas de protección, reconociendo su conocimiento tradicional sobre los ciclos marinos. Además, se están desarrollando programas de educación ambiental para escuelas costeras y capacitación en prácticas de pesca sostenible.\n\nEl proyecto, que cuenta con financiamiento internacional y apoyo gubernamental, espera crear una red de al menos diez áreas marinas protegidas en los próximos cinco años, cubriendo aproximadamente un 20% del mar territorial chileno.",
    "estandarAprendizaje": "Localizar y extraer información explícita de textos informativos",
    "dificultad": "facil"
  }
]
\`\`\``;

// Función para simular la función extraerJsonDeTexto de simceGenerator.ts
function extraerJsonDeTexto(texto) {
  console.log("DIAGNÓSTICO: Extrayendo JSON del texto");
  
  // Extraer el bloque de código
  const codeBlockMatch = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const jsonExtraido = codeBlockMatch[1].trim();
    console.log("DIAGNÓSTICO: Bloque de código encontrado");
    console.log("DIAGNÓSTICO: Primeros 100 caracteres:", jsonExtraido.substring(0, 100).replace(/\n/g, '\\n'));
    
    try {
      // Intentar parsear el JSON tal como está
      const parsed = JSON.parse(jsonExtraido);
      console.log("DIAGNÓSTICO: ¡El JSON original es válido!");
      return { valido: true, json: jsonExtraido, parsed };
    } catch (e) {
      console.log("DIAGNÓSTICO: Error al parsear JSON original:", e.message);
      
      // Analizar caracteres especiales o problemas
      analizarProblemas(jsonExtraido);
      
      return { valido: false, json: jsonExtraido, error: e.message };
    }
  } else {
    console.log("DIAGNÓSTICO: No se encontró bloque de código");
    return { valido: false, json: null };
  }
}

// Función para analizar problemas comunes en el JSON
function analizarProblemas(json) {
  console.log("DIAGNÓSTICO: Analizando problemas en el JSON");
  
  // Verificar balance de llaves y corchetes
  const llaveAbiertas = (json.match(/\{/g) || []).length;
  const llaveCerradas = (json.match(/\}/g) || []).length;
  const corcheteAbiertos = (json.match(/\[/g) || []).length;
  const corcheteCerrados = (json.match(/\]/g) || []).length;
  
  console.log("DIAGNÓSTICO: Análisis de estructura");
  console.log(`  - Llaves abiertas: ${llaveAbiertas}, Llaves cerradas: ${llaveCerradas}`);
  console.log(`  - Corchetes abiertos: ${corcheteAbiertos}, Corchetes cerrados: ${corcheteCerrados}`);
  
  if (llaveAbiertas !== llaveCerradas) {
    console.log("DIAGNÓSTICO: ⚠️ Desbalance de llaves");
  }
  
  if (corcheteAbiertos !== corcheteCerrados) {
    console.log("DIAGNÓSTICO: ⚠️ Desbalance de corchetes");
  }
  
  // Analizar carácter por carácter buscando caracteres de control y posición específica
  console.log("DIAGNÓSTICO: Análisis carácter por carácter");
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    const code = char.charCodeAt(0);
    
    // Detectar caracteres de control (incluyendo el problema específico en posición 392)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) { // Permitir tab, LF, CR
      console.log(`DIAGNÓSTICO: ⚠️ Carácter de control detectado en posición ${i}: U+${code.toString(16).padStart(4, '0')}`);
      console.log(`  Contexto: ${json.substring(Math.max(0, i-20), i)}|${char}|${json.substring(i+1, i+20)}`);
    }
    
    // Detectar posibles problemas de comillas dentro de strings
    if (char === '"' && i > 0 && i < json.length - 1) {
      // Verificar si esta comilla está dentro de un string y no está escapada
      const prevChar = json[i-1];
      if (prevChar !== '\\') {
        // Buscar hacia atrás para encontrar el inicio del string
        let isInString = false;
        let escapeCount = 0;
        
        for (let j = i-1; j >= 0; j--) {
          if (json[j] === '"' && (j === 0 || json[j-1] !== '\\' || escapeCount % 2 === 0)) {
            isInString = true;
            break;
          }
          if (json[j] === '\\') escapeCount++;
          else escapeCount = 0;
        }
        
        if (isInString) {
          console.log(`DIAGNÓSTICO: ⚠️ Posible comilla no escapada dentro de un string en posición ${i}`);
          console.log(`  Contexto: ${json.substring(Math.max(0, i-30), i)}|${char}|${json.substring(i+1, i+30)}`);
        }
      }
    }
  }
  
  // Buscar caracteres problemáticos
  const caracteresEspeciales = json.match(/[\u0000-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F]/g);
  if (caracteresEspeciales && caracteresEspeciales.length > 0) {
    console.log("DIAGNÓSTICO: ⚠️ Caracteres de control o invisibles detectados:");
    caracteresEspeciales.forEach((char, i) => {
      console.log(`  - Posición aproximada ${json.indexOf(char)}: Código Unicode U+${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
      if (i >= 10) {
        console.log(`  - (y ${caracteresEspeciales.length - 10} más...)`);
        return;
      }
    });
  }
  
  // Buscar comillas no escapadas dentro de strings
  const potencialesProblemas = json.match(/"[^"\\]*"[^"\\]*"[^"\\]*"/g);
  if (potencialesProblemas && potencialesProblemas.length > 0) {
    console.log("DIAGNÓSTICO: ⚠️ Posibles comillas no escapadas en strings:");
    potencialesProblemas.forEach((seg, i) => {
      console.log(`  - "${seg.substring(0, 40)}..."`);
      if (i >= 5) {
        console.log(`  - (y ${potencialesProblemas.length - 5} más...)`);
        return;
      }
    });
  }
  
  // Intentar con algunas limpiezas específicas
  try {
    // Normalizar espacios en blanco
    const jsonLimpio1 = json.replace(/\s+/g, ' ');
    JSON.parse(jsonLimpio1);
    console.log("DIAGNÓSTICO: ✅ La normalización de espacios soluciona el problema");
  } catch (e) {
    console.log("DIAGNÓSTICO: La normalización de espacios no soluciona el problema");
  }
  
  try {
    // Escapar comillas dentro de strings
    const jsonLimpio2 = json.replace(/"([^"\\]*)(?<!\\)"([^"]*)"([^"\\]*)"/, '"$1\\"$2\\"$3"');
    JSON.parse(jsonLimpio2);
    console.log("DIAGNÓSTICO: ✅ El escape de comillas internas soluciona el problema");
  } catch (e) {
    console.log("DIAGNÓSTICO: El escape de comillas internas no soluciona el problema");
  }
}

// Simulación simplificada de la función limpiarJsonEspecifico de simceGenerator.ts
function limpiarJsonEspecifico(json) {
  console.log("DIAGNÓSTICO: Simulando limpiarJsonEspecifico");
  console.log(`DIAGNÓSTICO: Limpiando JSON (primeros 50 caracteres): ${json.substring(0, 50).replace(/\n/g, '\\n')}...`);
  
  // Almacenar el JSON original para comparación
  const jsonOriginal = json;
  
  // Paso 1: Limpieza básica más estricta
  json = json.replace(/^\uFEFF/, ''); // Eliminar BOM si existe
  
  // Eliminar TODOS los caracteres de control (incluyendo los que causan el error en pos 392)
  for (let i = 0; i < json.length; i++) {
    const charCode = json.charCodeAt(i);
    if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
      console.log(`DIAGNÓSTICO: Eliminando carácter de control en posición ${i}: U+${charCode.toString(16).padStart(4, '0')}`);
      // Reemplazar con espacio para mantener posiciones
      json = json.substring(0, i) + ' ' + json.substring(i + 1);
    }
  }
  
  // Paso 2: Eliminar comentarios
  json = json.replace(/\/\/.*/g, '');
  json = json.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Paso 3: Arreglar propiedades sin comillas
  json = json.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4');
  
  // Paso 4: Eliminar comas finales
  json = json.replace(/,(\s*[\]}])/g, '$1');
  
  // Paso 5: Procesar manualmente strings para escapar caracteres problemáticos
  let result = '';
  let inString = false;
  let escape = false;
  
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    
    if (inString) {
      if (escape) {
        // Carácter escapado, siempre añadirlo
        result += char;
        escape = false;
      } else if (char === '\\') {
        // Inicio de secuencia de escape
        result += char;
        escape = true;
      } else if (char === '"') {
        // Fin de string
        result += char;
        inString = false;
      } else if (char.charCodeAt(0) < 32) {
        // Carácter de control dentro de string - escapar adecuadamente
        result += '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
        console.log(`DIAGNÓSTICO: Escapando carácter de control en string: pos ${i}`);
      } else {
        // Carácter normal en string
        result += char;
      }
    } else {
      // Fuera de string
      if (char === '"') {
        // Inicio de string
        inString = true;
      }
      result += char;
    }
  }
  json = result;
  
  // Paso 6: Corregir valores booleanos sin comillas
  json = json.replace(/:(\s*)(true|false)(\s*[,}])/g, (match, space1, value, space2) => {
    return ': ' + value + space2;
  });
  
  // Paso 7: Arreglar problemas de explicaciones que contienen comillas sin escapar
  // Aplicar un algoritmo más robusto para este caso específico
  json = json.replace(/"explicacion"\s*:\s*"([^"]*)"/g, (match, content) => {
    // Escapar todas las comillas dentro del contenido
    const escapedContent = content.replace(/"/g, '\\"');
    return `"explicacion": "${escapedContent}"`;
  });
  
  // Validar si el JSON es válido después de la limpieza
  try {
    JSON.parse(json);
    console.log("DIAGNÓSTICO: ✅ JSON limpio válido");
    return { valido: true, json };
  } catch (e) {
    console.log(`DIAGNÓSTICO: ❌ JSON sigue siendo inválido después de limpieza: ${e.message}`);
    
    // Buscar la posición específica del error si está disponible
    if (e.message.includes('position')) {
      const posMatch = e.message.match(/position (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1]);
        console.log(`DIAGNÓSTICO: Contexto del error en posición ${pos}:`);
        console.log(`  - ${json.substring(Math.max(0, pos - 30), pos)}|${json.substring(pos, Math.min(json.length, pos + 30))}`);
      }
    }
    
    return { valido: false, json, error: e.message };
  }
}

// Simulación completa del proceso de extracción y validación
function simularProcesoCompleto(textoEntrada) {
  console.log("===== INICIANDO SIMULACIÓN DEL PROCESO DE GENERACIÓN =====");
  
  // Paso 1: Extraer el JSON del texto
  const resultado = extraerJsonDeTexto(textoEntrada);
  
  // Si no es válido, intentar limpiarlo
  if (!resultado.valido && resultado.json) {
    console.log("\n----- Intentando limpiar y reparar el JSON -----");
    const resultadoLimpieza = limpiarJsonEspecifico(resultado.json);
    
    if (resultadoLimpieza.valido) {
      console.log("DIAGNÓSTICO: ✅ Limpieza exitosa, JSON ahora es válido");
    } else {
      console.log("DIAGNÓSTICO: ❌ La limpieza falló, el JSON sigue siendo inválido");
      
      // Agregar corrección de emergencia
      console.log("\n----- Intentando corrección de emergencia -----");
      try {
        // Extractar id y enunciado si es posible
        const idMatch = resultado.json.match(/"id"\s*:\s*"([^"]*)"/);
        const enunciadoMatch = resultado.json.match(/"enunciado"\s*:\s*"([^"]*)"/);
        
        if (idMatch && enunciadoMatch) {
          const id = idMatch[1];
          const enunciado = enunciadoMatch[1];
          
          console.log(`DIAGNÓSTICO: Encontrado id="${id}" y enunciado="${enunciado.substring(0, 30)}..."`);
          console.log("DIAGNÓSTICO: Se podría generar un JSON de emergencia con estos datos");
        } else {
          console.log("DIAGNÓSTICO: No se encontraron datos mínimos para reconstrucción");
        }
      } catch (e) {
        console.log(`DIAGNÓSTICO: Error en corrección de emergencia: ${e.message}`);
      }
    }
  } else if (resultado.valido) {
    console.log("DIAGNÓSTICO: No se requiere limpieza adicional, el JSON ya es válido");
  }
  
  console.log("\n===== DIAGNÓSTICO COMPLETADO =====");
}

// Función para simular la extracción de una respuesta real
function extraerDeArchivoSiExiste() {
  try {
    const respuestaReal = fs.readFileSync(path.join(process.cwd(), 'respuesta-gemini.txt'), 'utf8');
    console.log("DIAGNÓSTICO: Encontrado archivo respuesta-gemini.txt, utilizando contenido real");
    return respuestaReal;
  } catch (e) {
    console.log("DIAGNÓSTICO: No se encontró archivo respuesta-gemini.txt, utilizando respuesta simulada");
    return mockGeminiResponse;
  }
}

// Ejecutar diagnóstico con la respuesta simulada o real
const respuesta = extraerDeArchivoSiExiste();
simularProcesoCompleto(respuesta);

console.log(`
Para usar este diagnóstico con una respuesta real:
1. Crea un archivo 'respuesta-gemini.txt' en el directorio raíz
2. Pega la respuesta completa de Gemini (incluyendo bloques de código) en ese archivo
3. Ejecuta este script nuevamente: node diagnose-gemini.js

Este script te ayudará a identificar por qué falla el procesamiento del JSON
y a encontrar soluciones específicas para los problemas encontrados.
`);
