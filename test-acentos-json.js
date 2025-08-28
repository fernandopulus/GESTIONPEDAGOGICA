// Script de prueba para verificar la corrección de JSON con acentos y caracteres especiales
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener el directorio actual en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función que genera un JSON con caracteres especiales (tildes, eñes) y un carácter de control
function generarJSONConCaracteresEspeciales() {
  // Crear un JSON de prueba con caracteres especiales y un carácter de control insertado
  const baseJSON = {
    id: "p1",
    enunciado: "¿Cuál es el análisis más apropiado para la situación económica?",
    alternativas: [
      {
        id: "A",
        texto: "La inflación está afectando a los pequeños negocios y la economía doméstica.",
        esCorrecta: true,
        explicacion: "Esta opción señala correctamente cómo la inflación impacta negativamente tanto a los pequeños negocios como a la economía doméstica, lo que está demostrado por múltiples estudios económicos."
      },
      {
        id: "B",
        texto: "Los índices macroeconómicos muestran señales de recuperación a corto plazo.",
        esCorrecta: false
      },
      {
        id: "C",
        texto: "La situación actual no muestra cambios significativos respecto al año anterior.",
        esCorrecta: false
      },
      {
        id: "D",
        texto: "El desempleo está disminuyendo de manera sostenida en todos los sectores.",
        esCorrecta: false
      }
    ],
    habilidad: "Análisis económico",
    textoBase: "La situación económica actual presenta múltiples desafíos para las economías emergentes. La inflación creciente está afectando el poder adquisitivo de las familias y limitando la capacidad de inversión de las pequeñas y medianas empresas. Según los últimos estudios del Banco Central, se espera que esta tendencia continúe al menos durante el próximo semestre, aunque algunas proyecciones más optimistas señalan una posible estabilización hacia fin de año."
  };
  
  // Convertir a JSON string
  let jsonString = JSON.stringify([baseJSON], null, 2);
  
  // Insertar un carácter de control deliberadamente
  const targetPos = jsonString.indexOf("pequeños negocios") + 5;
  if (targetPos > 0) {
    // Insertar el carácter de control ASCII 0x07 (BEL)
    const badChar = String.fromCharCode(7); // Control character BEL
    jsonString = jsonString.substring(0, targetPos) + badChar + jsonString.substring(targetPos);
    
    console.log(`Carácter de control insertado en posición ${targetPos}`);
    
    // Verificar que el JSON ahora es inválido
    try {
      JSON.parse(jsonString);
      console.log("ADVERTENCIA: El JSON aún es válido, el carácter de control no causó el error esperado");
    } catch (e) {
      console.log("JSON inválido creado exitosamente:", e.message);
    }
    
    return jsonString;
  } else {
    console.error("No se pudo encontrar la posición para insertar el carácter de control");
    return jsonString;
  }
}

// Función simplificada para limpiar JSON con problemas (basada en la implementada en simceGenerator.ts)
function limpiarJsonEspecifico(json) {
  console.log("Limpiando JSON con problemas...");
  
  // ANÁLISIS CARÁCTER POR CARÁCTER para detectar problemas específicos
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
  
  // Limpieza selectiva de caracteres de control preservando caracteres especiales
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
      jsonLimpio += ' ';
    }
  }
  json = jsonLimpio;
  
  // LIMPIEZA: Procesamiento manual de strings para asegurar escape correcto de caracteres
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
        result += '\\u' + ('0000' + charCode.toString(16)).slice(-4);
        console.log(`Escapado carácter de control en posición ${i}: U+${charCode.toString(16).padStart(4, '0')}`);
      } else {
        // Carácter normal dentro de string - preservar caracteres especiales latinos
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
  
  // Probar si el JSON es válido ahora
  try {
    const parsed = JSON.parse(json);
    console.log("✅ JSON reparado exitosamente");
    
    // Verificar que se preservaron los caracteres especiales
    const tieneEspeciales = json.match(/[áéíóúüñÁÉÍÓÚÜÑ]/);
    if (tieneEspeciales) {
      console.log("✅ Se preservaron caracteres especiales (tildes, ñ)");
    } else {
      console.log("⚠️ No se encontraron caracteres especiales en el resultado");
    }
    
    return { exito: true, json, parsed };
  } catch (e) {
    console.log("❌ JSON sigue siendo inválido:", e.message);
    return { exito: false, json, error: e.message };
  }
}

// Ejecutar la prueba
const jsonConEspeciales = generarJSONConCaracteresEspeciales();
console.log("\n--- JSON con caracteres especiales y error generado ---");
console.log(jsonConEspeciales.substring(0, 100) + "...");

// Guardar el JSON con error para pruebas
fs.writeFileSync(path.join(__dirname, 'json-con-especiales.json'), jsonConEspeciales);

console.log("\n--- Intentando limpiar el JSON ---");
const resultado = limpiarJsonEspecifico(jsonConEspeciales);

if (resultado.exito) {
  console.log("\n--- JSON limpio ---");
  console.log(resultado.json.substring(0, 100) + "...");
  
  // Contar los caracteres especiales
  const contarEspeciales = (texto) => {
    return (texto.match(/[áéíóúüñÁÉÍÓÚÜÑ]/g) || []).length;
  };
  
  const especialesOriginal = contarEspeciales(jsonConEspeciales);
  const especialesLimpio = contarEspeciales(resultado.json);
  
  console.log(`\nCaracteres especiales en JSON original: ${especialesOriginal}`);
  console.log(`Caracteres especiales en JSON limpio: ${especialesLimpio}`);
  
  // Guardar el JSON limpio
  fs.writeFileSync(path.join(__dirname, 'json-especiales-reparado.json'), resultado.json);
  console.log("\nPrueba completada. Archivos generados: 'json-con-especiales.json' y 'json-especiales-reparado.json'");
  
  // Validación adicional
  if (especialesOriginal > 0 && especialesLimpio === especialesOriginal) {
    console.log("✅ ÉXITO: Se preservaron todos los caracteres especiales");
  } else if (especialesLimpio < especialesOriginal) {
    console.log(`⚠️ ADVERTENCIA: Se perdieron ${especialesOriginal - especialesLimpio} caracteres especiales`);
  }
  
  // Verificar la integridad de datos específicos
  try {
    const parsed = JSON.parse(resultado.json);
    if (parsed[0].enunciado.includes("¿Cuál") && parsed[0].enunciado.includes("análisis")) {
      console.log("✅ Enunciado preservado correctamente con acentos");
    }
    
    if (parsed[0].alternativas[0].texto.includes("inflación")) {
      console.log("✅ Texto de alternativa preservado correctamente con acentos");
    }
  } catch (e) {
    console.log("❌ Error al verificar integridad de datos:", e.message);
  }
} else {
  console.log("\nLa limpieza no pudo reparar el JSON. Revisa los logs para más detalles.");
}
