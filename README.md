# Ejecutar y desplegar la app

Esta app usa Vite (React) y Firebase Hosting. Algunas funciones (IA) requieren una API key de Gemini.

## Variables de entorno (importante)

Vite solo expone variables que comienzan con el prefijo `VITE_` al código del navegador. Para Gemini debes definir:

- `VITE_GEMINI_API_KEY`: tu API key de Gemini

Archivos recomendados:

- `.env.local` (para desarrollo)
- `.env.production` (para builds de producción antes del deploy)

Ejemplo de contenido:

```
VITE_GEMINI_API_KEY=tu_api_key_aqui
```

Si no defines la key, las funciones que dependen de IA usarán un fallback determinístico (sin IA) y verás mensajes en consola indicando que no se encontró un modelo disponible.

## Ejecutar en local

Requisitos: Node.js

1. Instalar dependencias:
   `npm install`
2. Crear `.env.local` con `VITE_GEMINI_API_KEY` (ver sección anterior)
3. Correr la app:
   `npm run dev`

## Build de producción y deploy a Firebase Hosting

1. Crear `.env.production` con `VITE_GEMINI_API_KEY`
2. Generar build:
   `npm run build`
3. Desplegar a Hosting (requiere Firebase CLI autenticada):
   `firebase deploy --only hosting --project <tu-proyecto>`

En producción, la key queda embebida en el bundle al momento del build. Si cambias la key, necesitas reconstruir (`npm run build`) y volver a desplegar.
