// Script para probar la corrección de errores JSON con caracteres de control en la posición 392
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener el directorio actual en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función que simula el error común en la posición 392
function generarJSONConErrorControlChar() {
  // Crear un JSON de prueba con un carácter de control insertado deliberadamente
  // cerca de la posición 392
  const baseJSON = {
    id: "p1",
    enunciado: "¿Cuál es el principal objetivo del proyecto descrito en el texto?",
    alternativas: [
      {
        id: "A",
        texto: "Esta es una alternativa muy larga que contiene texto para llegar cerca de la posición 392. " +
               "Necesitamos agregar más contenido para acercarnos a esa posición específica. " + 
               "El error generalmente ocurre después de una cantidad significativa de texto, " +
               "especialmente en campos como explicación o textoBase que pueden contener " +
               "múltiples párrafos de texto generado por la IA aquí insertaremos un carácter de control",
        esCorrecta: true,
        explicacion: "Una explicación muy detallada del porqué esta es la respuesta correcta"
      },
      {
        id: "B",
        texto: "Alternativa B de prueba",
        esCorrecta: false
      },
      {
        id: "C",
        texto: "Alternativa C de prueba",
        esCorrecta: false
      },
      {
        id: "D",
        texto: "Alternativa D de prueba",
        esCorrecta: false
      }
    ],
    habilidad: "Localizar información",
    textoBase: "Este es un texto base de ejemplo que simula el contenido generado por la IA."
  };
  
  // Convertir a JSON string
  let jsonString = JSON.stringify([baseJSON], null, 2);
  
  // Insertar un carácter de control deliberadamente cerca de la posición 392
  // Vamos a encontrar una posición en el texto de la alternativa A
  const targetPos = jsonString.indexOf("aquí insertaremos un carácter de control");
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
        // Esto soluciona el problema de "Bad control character in string literal"
        result += '\\u' + ('0000' + charCode.toString(16)).slice(-4);
        console.log(`Escapado carácter de control en posición ${i}: U+${charCode.toString(16).padStart(4, '0')}`);
      } else {
        // Carácter normal dentro de string
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
    JSON.parse(json);
    console.log("✅ JSON reparado exitosamente");
    return { exito: true, json };
  } catch (e) {
    console.log("❌ JSON sigue siendo inválido:", e.message);
    return { exito: false, json, error: e.message };
  }
}

// Ejecutar la prueba
const jsonConError = generarJSONConErrorControlChar();
console.log("\n--- JSON con error generado ---");
console.log(jsonConError.substring(0, 100) + "...");

// Guardar el JSON con error para pruebas
fs.writeFileSync(path.join(__dirname, 'json-con-error.json'), jsonConError);

console.log("\n--- Intentando limpiar el JSON ---");
const resultado = limpiarJsonEspecifico(jsonConError);

if (resultado.exito) {
  console.log("\n--- JSON limpio ---");
  console.log(resultado.json.substring(0, 100) + "...");
  
  // Guardar el JSON limpio
  fs.writeFileSync(path.join(__dirname, 'json-reparado.json'), resultado.json);
  console.log("\nPrueba completada. Archivos generados: 'json-con-error.json' y 'json-reparado.json'");
} else {
  console.log("\nLa limpieza no pudo reparar el JSON. Revisa los logs para más detalles.");
}
