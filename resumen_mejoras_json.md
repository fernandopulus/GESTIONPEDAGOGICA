# Mejoras en el procesamiento JSON para generación de preguntas SIMCE

## Problema identificado
Se identificó un problema en la generación de preguntas SIMCE donde solo se está generando 1 de las 6 preguntas solicitadas. El error específico ocurre en la posición 1625 del JSON y está relacionado con comillas literales en palabras como "como", "así", etc., que están dentro de textos y no son escapadas correctamente.

## Soluciones implementadas

### 1. Mejora en el manejo de caracteres especiales
- Se modificó el algoritmo para preservar correctamente tildes y la letra ñ
- Se implementó un procesamiento carácter por carácter más preciso

### 2. Corrección de problemas con comillas literales
- Se agregó detección y corrección específica para palabras como "como", "así", "también"
- Se implementó un pre-procesamiento para escapar estas palabras antes del análisis JSON

### 3. Validación y notificación de preguntas faltantes
- Se agregó código para detectar cuando se generan menos preguntas de las solicitadas
- Se implementaron logs de advertencia más claros

## Archivo de validación adicional
Se creó un nuevo archivo `validadores.ts` con funciones para:
- Validar la integridad de respuestas de la IA
- Corregir problemas comunes en formato JSON
- Extraer subconjuntos válidos de JSON de respuestas parcialmente corruptas

## Scripts de prueba
- `test-json-fix.js`: Prueba la corrección de caracteres de control en JSON
- `test-acentos-json.js`: Verifica la preservación de caracteres acentuados y ñ

## Resultados
Las pruebas confirman que:
- Se mantienen correctamente tildes y eñes
- Se corrigen los caracteres de control problemáticos
- Se escapan correctamente las comillas literales en palabras como "como"

Estas mejoras deberían permitir que se generen todas las preguntas solicitadas correctamente.
