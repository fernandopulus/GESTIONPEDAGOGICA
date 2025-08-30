# Generación de Preguntas SIMCE con Gemini AI

Este módulo implementa la generación de preguntas tipo SIMCE utilizando la API de Gemini AI de Google, ahora con una arquitectura robusta basada en Firebase Cloud Functions.

## Características

- Generación de preguntas tipo SIMCE para Lectura y Matemática
- Formato JSON estructurado y validado mediante esquemas
- Manejo robusto de errores y formato
- Soporte para texto base proporcionado por el usuario
- Configuración de habilidades, ejes y dificultad
- Fallback automático a implementación local en caso de error

## Implementación

La generación de preguntas ahora utiliza Firebase Cloud Functions para mayor robustez y seguridad:

1. El front-end envía las opciones de generación a la Cloud Function
2. La función utiliza Gemini AI con esquemas JSON predefinidos
3. La respuesta es validada y normalizada antes de devolverla
4. El front-end recibe preguntas ya formateadas y validadas

## Configuración

Para que la función de Cloud Functions funcione correctamente, es necesario configurar la API key de Gemini:

### En desarrollo local

Crear un archivo `.env.local` en la carpeta `/functions` con:

```
GEMINI_API_KEY="TU_API_KEY_AQUI"
```

### En producción (Firebase)

Configurar el secreto en Firebase:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

## Uso

```typescript
// En el front-end
import { generarPreguntasSimceCloud } from '../../src/firebaseHelpers/simceCloudFunctions';

// Opciones de generación
const opciones = {
  asignatura: 'Lectura', // 'Lectura' | 'Matemática'
  cantidad: 4,
  nivel: '1M',
  habilidadesLectura: ['Localizar información', 'Interpretar'],
  dificultad: 'media',
  textoProporcionado: '...' // Opcional
};

// Generar preguntas
const preguntas = await generarPreguntasSimceCloud(opciones);
```

## Modo de respaldo

Si la Cloud Function falla, el sistema automáticamente utiliza la implementación local como respaldo:

```typescript
try {
  preguntas = await generarPreguntasSimceCloud(opciones);
} catch (error) {
  console.error('Error en Cloud Function, usando respaldo local:', error);
  preguntas = await generarPreguntasSimceLocal(opciones);
}
```
