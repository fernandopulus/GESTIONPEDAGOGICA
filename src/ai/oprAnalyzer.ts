import { GoogleGenerativeAI } from '@google/generative-ai';
import { CicloOPR, DetalleObservacionRow } from '../../types';

interface OPRAnalysis {
  stats: {
    docenteId: string;
    curso: string;
    asignatura: string;
    conteo_observaciones: number;
    uso_preguntas_abiertas_pct: number;
    uso_interrogacion_sucesiva_pct: number;
    uso_ejemplos_contextualizados_pct: number;
    feedback_inmediato_pct: number;
    min_interaccion: number;
    min_explicacion: number;
    participacion_promedio: number;
  };
  charts: {
    participacion_por_minuto: Array<{ minuto: number; participacion: number }>;
    estrategias_frecuencia: Array<{ estrategia: string; porcentaje: number; conteo: number }>;
    indicadores_cumplimiento: Array<{ indicador: string; porcentaje: number }>;
    nube_palabras: Array<{ t: string; w: number }>;
  };
  summary: {
    fortalezas: string[];
    mejoras: string[];
    recomendaciones: string[];
  };
  alerts: string[];
  traza: {
    modelo: string;
    version_prompt: string;
  };
}

// Función para calcular la participación por minuto desde los detalles de observación
function calcularParticipacionPorMinuto(detalles: DetalleObservacionRow[]): Array<{ minuto: number; participacion: number }> {
  return detalles.map(detalle => {
    const [inicio, fin] = detalle.minuto.split('-').map(Number);
    const participacion = detalle.accionesEstudiantes.length > 0 ? 
      (detalle.accionesEstudiantes.split(' ').length / (fin - inicio)) : 0;
    
    return {
      minuto: inicio,
      participacion: Math.min(100, participacion * 10) // Normalizar a porcentaje
    };
  });
}

// Función para extraer estrategias del texto
function extraerEstrategias(texto: string): Map<string, number> {
  const estrategias = new Map<string, number>();
  const patrones = {
    preguntas_abiertas: /(?:pregunt[aó]|cu[áa]l|qu[ée]|c[óo]mo|por qu[ée]|explica)/gi,
    interrogacion_sucesiva: /(?:entonces|y luego|qu[ée] m[áa]s|profundiza|explica mejor)/gi,
    ejemplos_contextualizados: /(?:ejemplo|caso|situaci[óo]n|contexto real|en la vida)/gi,
    feedback_inmediato: /(?:bien|correcto|exacto|muy bien|as[íi] es|mejorar[íi]a)/gi
  };

  for (const [estrategia, patron] of Object.entries(patrones)) {
    const matches = texto.match(patron);
    estrategias.set(estrategia, matches ? matches.length : 0);
  }

  return estrategias;
}

export async function analizarOPR(ciclo: CicloOPR, historial?: CicloOPR[]): Promise<OPRAnalysis> {
  // Inicializar análisis con valores por defecto
  const analysis: OPRAnalysis = {
    stats: {
      docenteId: ciclo.docenteInfo || '',
      curso: ciclo.cursoInfo || '',
      asignatura: ciclo.asignaturaInfo || '',
      conteo_observaciones: 1,
      uso_preguntas_abiertas_pct: 0,
      uso_interrogacion_sucesiva_pct: 0,
      uso_ejemplos_contextualizados_pct: 0,
      feedback_inmediato_pct: 0,
      min_interaccion: 0,
      min_explicacion: 0,
      participacion_promedio: 0
    },
    charts: {
      participacion_por_minuto: [],
      estrategias_frecuencia: [],
      indicadores_cumplimiento: [],
      nube_palabras: []
    },
    summary: {
      fortalezas: [],
      mejoras: [],
      recomendaciones: []
    },
    alerts: [],
    traza: {
      modelo: "gemini-2.5-flash-lite",
      version_prompt: "v1"
    }
  };

  // Calcular participación por minuto
  if (ciclo.detallesObservacion) {
    analysis.charts.participacion_por_minuto = calcularParticipacionPorMinuto(ciclo.detallesObservacion);
    
    // Calcular minutos de interacción vs explicación
    let minInteraccion = 0;
    let minExplicacion = 0;
    
    ciclo.detallesObservacion.forEach(detalle => {
      const [inicio, fin] = detalle.minuto.split('-').map(Number);
      const duracion = fin - inicio;
      
      if (detalle.accionesEstudiantes.length > detalle.accionesDocente.length) {
        minInteraccion += duracion;
      } else {
        minExplicacion += duracion;
      }
    });
    
    analysis.stats.min_interaccion = minInteraccion;
    analysis.stats.min_explicacion = minExplicacion;
  }

  // Analizar estrategias en todas las acciones docentes
  const estrategiasTotal = new Map<string, number>();
  let totalTextoAnalizado = 0;

  ciclo.detallesObservacion?.forEach(detalle => {
    const estrategias = extraerEstrategias(detalle.accionesDocente);
    estrategias.forEach((count, estrategia) => {
      estrategiasTotal.set(estrategia, (estrategiasTotal.get(estrategia) || 0) + count);
    });
    totalTextoAnalizado += detalle.accionesDocente.length;
  });

  // Convertir conteos de estrategias a porcentajes
  estrategiasTotal.forEach((count, estrategia) => {
    const porcentaje = totalTextoAnalizado > 0 ? (count / totalTextoAnalizado) * 100 : 0;
    analysis.charts.estrategias_frecuencia.push({
      estrategia,
      porcentaje: Math.round(porcentaje * 100) / 100,
      conteo: count
    });

    // Actualizar estadísticas generales
    switch (estrategia) {
      case 'preguntas_abiertas':
        analysis.stats.uso_preguntas_abiertas_pct = porcentaje;
        break;
      case 'interrogacion_sucesiva':
        analysis.stats.uso_interrogacion_sucesiva_pct = porcentaje;
        break;
      case 'ejemplos_contextualizados':
        analysis.stats.uso_ejemplos_contextualizados_pct = porcentaje;
        break;
      case 'feedback_inmediato':
        analysis.stats.feedback_inmediato_pct = porcentaje;
        break;
    }
  });

  // Calcular participación promedio
  if (analysis.charts.participacion_por_minuto.length > 0) {
    analysis.stats.participacion_promedio = 
      analysis.charts.participacion_por_minuto.reduce((sum, item) => sum + item.participacion, 0) / 
      analysis.charts.participacion_por_minuto.length;
  }

  // Generar fortalezas y áreas de mejora basadas en los datos
  const estrategiasOrdenadas = [...estrategiasTotal.entries()]
    .sort(([, a], [, b]) => b - a);

  // Identificar fortalezas (top 3 estrategias más usadas)
  analysis.summary.fortalezas = estrategiasOrdenadas
    .slice(0, 3)
    .map(([estrategia]) => {
      switch (estrategia) {
        case 'preguntas_abiertas':
          return 'Uso efectivo de preguntas abiertas para promover el pensamiento crítico';
        case 'interrogacion_sucesiva':
          return 'Buena secuencia de preguntas para profundizar la comprensión';
        case 'ejemplos_contextualizados':
          return 'Excelente uso de ejemplos contextualizados';
        case 'feedback_inmediato':
          return 'Retroalimentación inmediata y efectiva';
        default:
          return `Buen uso de ${estrategia.replace(/_/g, ' ')}`;
      }
    });

  // Identificar áreas de mejora (estrategias menos usadas)
  analysis.summary.mejoras = estrategiasOrdenadas
    .slice(-3)
    .map(([estrategia]) => {
      switch (estrategia) {
        case 'preguntas_abiertas':
          return 'Aumentar el uso de preguntas abiertas';
        case 'interrogacion_sucesiva':
          return 'Desarrollar más secuencias de preguntas';
        case 'ejemplos_contextualizados':
          return 'Incorporar más ejemplos contextualizados';
        case 'feedback_inmediato':
          return 'Proporcionar más retroalimentación inmediata';
        default:
          return `Incrementar el uso de ${estrategia.replace(/_/g, ' ')}`;
      }
    });

  // Generar recomendaciones específicas
  analysis.summary.recomendaciones = analysis.summary.mejoras.map(mejora => {
    if (mejora.includes('preguntas abiertas')) {
      return 'Preparar 2-3 preguntas desafiantes por segmento de clase';
    } else if (mejora.includes('secuencias de preguntas')) {
      return 'Implementar la técnica de "¿Por qué?" en cascada';
    } else if (mejora.includes('ejemplos contextualizados')) {
      return 'Vincular cada concepto con situaciones de la vida real';
    } else {
      return 'Establecer puntos de verificación cada 10-15 minutos';
    }
  });

  // Generar alertas si es necesario
  if (analysis.stats.participacion_promedio < 30) {
    analysis.alerts.push('Baja participación estudiantil detectada');
  }
  if (analysis.stats.min_explicacion > analysis.stats.min_interaccion * 2) {
    analysis.alerts.push('Alto tiempo de explicación vs. interacción');
  }

  return analysis;
}
