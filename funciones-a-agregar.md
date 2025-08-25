## Solución para el problema de estilos de presentación

### 1. Actualización del tipo EstiloPresentacion en types.ts

```typescript
export type EstiloPresentacion = 'sobrio' | 'visual' | 'academico' | 'interactivo' | 'profesional' | 'creativo' | 'minimalista';
```

### 2. Funciones a agregar en slidesIntegration.ts

```typescript
/**
 * Método para mantener compatibilidad - mismo que getEstiloDescription pero con nombre en inglés
 */
private getStyleDescription(estilo: string): string {
  return this.getEstiloDescription(estilo);
}

/**
 * Obtiene los colores específicos para cada estilo de presentación
 */
private getStyleColors(estilo: string): any {
  const styles: Record<string, any> = {
    'sobrio': {
      background: { red: 0.98, green: 0.98, blue: 0.98 },
      primary: { red: 0.2, green: 0.2, blue: 0.25 },
      secondary: { red: 0.5, green: 0.5, blue: 0.55 },
      accent: { red: 0.3, green: 0.3, blue: 0.4 },
      text: { red: 0.1, green: 0.1, blue: 0.1 }
    },
    'visual': {
      background: { red: 0.95, green: 0.97, blue: 1.0 },
      primary: { red: 0.0, green: 0.44, blue: 0.8 },
      secondary: { red: 0.2, green: 0.6, blue: 0.9 },
      accent: { red: 1.0, green: 0.6, blue: 0.2 },
      text: { red: 0.1, green: 0.1, blue: 0.1 }
    },
    'academico': {
      background: { red: 0.98, green: 0.96, blue: 0.9 },
      primary: { red: 0.5, green: 0.3, blue: 0.1 },
      secondary: { red: 0.7, green: 0.5, blue: 0.2 },
      accent: { red: 0.3, green: 0.5, blue: 0.7 },
      text: { red: 0.2, green: 0.2, blue: 0.2 }
    },
    'interactivo': {
      background: { red: 0.95, green: 1.0, blue: 0.95 },
      primary: { red: 0.1, green: 0.7, blue: 0.3 },
      secondary: { red: 0.3, green: 0.8, blue: 0.4 },
      accent: { red: 0.9, green: 0.3, blue: 0.5 },
      text: { red: 0.1, green: 0.1, blue: 0.1 }
    },
    'profesional': {
      background: { red: 0.95, green: 0.95, blue: 0.97 },
      primary: { red: 0.2, green: 0.2, blue: 0.5 },
      secondary: { red: 0.1, green: 0.1, blue: 0.3 },
      accent: { red: 0.7, green: 0.0, blue: 0.0 },
      text: { red: 0.1, green: 0.1, blue: 0.1 }
    },
    'creativo': {
      background: { red: 0.98, green: 0.95, blue: 1.0 },
      primary: { red: 0.6, green: 0.2, blue: 0.8 },
      secondary: { red: 0.8, green: 0.3, blue: 0.7 },
      accent: { red: 1.0, green: 0.8, blue: 0.0 },
      text: { red: 0.2, green: 0.2, blue: 0.2 }
    },
    'minimalista': {
      background: { red: 1.0, green: 1.0, blue: 1.0 },
      primary: { red: 0.0, green: 0.0, blue: 0.0 },
      secondary: { red: 0.3, green: 0.3, blue: 0.3 },
      accent: { red: 0.7, green: 0.7, blue: 0.7 },
      text: { red: 0.0, green: 0.0, blue: 0.0 }
    }
  };
  
  return styles[estilo] || styles['sobrio'];
}
```

### 3. Modificar addSlidesToPresentation para aceptar el estilo

```typescript
private async addSlidesToPresentation(
  slidesClient: any, 
  presentationId: string, 
  slidesContent: GeneratedSlide[],
  estilo: string = 'sobrio'
): Promise<void> {
  console.log(`Añadiendo ${slidesContent.length} diapositivas con contenido mejorado`);
  
  // Obtener los colores específicos para el estilo seleccionado
  const themeColors = this.getStyleColors(estilo);
  
  // El resto del código...
}
```

### 4. Modificar la llamada a addSlidesToPresentation para incluir el estilo

```typescript
await this.addSlidesToPresentation(slides, presentationId, slidesContent, data.estilo);
```

### 5. Modificar la creación de diapositivas para usar los colores del estilo

```typescript
// Configurar fondo de todas las diapositivas con el color de estilo elegido
requests.push({
  updatePageProperties: {
    objectId: slideId,
    pageProperties: {
      pageBackgroundFill: {
        solidFill: {
          color: {
            rgbColor: themeColors.background
          }
        }
      }
    },
    fields: 'pageBackgroundFill'
  }
});
```

### 6. Asegurarse de que getEstiloDescription tenga todos los estilos

```typescript
private getEstiloDescription(estilo: string): string {
  const estilos: Record<string, string> = {
    'academico': 'Formal y riguroso, con énfasis en conceptos teóricos y fundamentación científica',
    'visual': 'Dinámico y colorido, con énfasis en elementos gráficos, infografías y representaciones visuales',
    'interactivo': 'Participativo y colaborativo, con múltiples actividades, preguntas y dinámicas grupales',
    'profesional': 'Corporativo y práctico, enfocado en aplicaciones del mundo real y casos de estudio',
    'sobrio': 'Elegante y minimalista, balanceando profesionalismo con claridad pedagógica',
    'creativo': 'Innovador y atractivo, con un enfoque original que estimula la imaginación y el pensamiento lateral',
    'minimalista': 'Depurado y esencial, centrado en lo más importante sin elementos distractores'
  };
  
  return estilos[estilo] || estilos['academico'];
}
```
