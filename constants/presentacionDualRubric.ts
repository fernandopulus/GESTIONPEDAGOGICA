import { NivelLogroPresentacionDual, PresentacionDualIndicador } from '../types';

export const PRESENTACION_DUAL_INDICADORES: PresentacionDualIndicador[] = [
  {
    id: 1,
    indicador: 'Presentación personal',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion:
          'Realiza una breve presentación de sus datos personales (nombre, dónde vive, con quién vive). Su vestimenta es adecuada a la evaluación (uniforme del Liceo o blusa/camisa, pantalón de tela gris y zapatos).',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion:
          'Presenta sus datos personales e incorpora el desarrollo de sus aprendizajes con hitos de los dos últimos años. Mantiene vestimenta adecuada y no porta piercing en el rostro.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Además de su presentación personal, describe aprendizajes con hitos, reconoce habilidades y competencias y expone metas y proyecciones. Vestimenta adecuada sin piercing visible.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Integra reflexión sobre aspectos a fortalecer para seguir aprendiendo con ejemplos vinculados a su experiencia dual. Mantiene vestimenta adecuada y sin piercing en el rostro.',
      },
    },
  },
  {
    id: 2,
    indicador: 'Descripción de la vinculación DUAL',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Describe superficialmente el proceso de vinculación a su centro de aprendizaje.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion:
          'Detalla los pasos realizados para lograr la vinculación identificando a los involucrados y sus roles.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Detalla el proceso completo de vinculación e incorpora una reflexión retroactiva sobre las emociones experimentadas.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Además de detallar el proceso y emociones, identifica estrategias utilizadas para gestionar o superar dichas emociones.',
      },
    },
  },
  {
    id: 3,
    indicador: 'Descripción del centro de aprendizaje',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Describe el centro de aprendizaje identificando sus características generales.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion:
          'Describe el centro, presenta organigrama y profesionales con los que se relaciona en la experiencia dual.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Describe el centro, organigrama y explica procesos principales de producción o servicio con detalle.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Suma al análisis anterior al menos diez características que descompone en una matriz FODA.',
      },
    },
  },
  {
    id: 4,
    indicador: 'Experiencia de trabajo en equipo',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Describe una experiencia donde observó trabajo en equipo o colaboración.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion:
          'Relata una experiencia asignada por la empresa donde trabajó colaborativamente, señalando funciones y objetivo común.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Describe la experiencia colaborativa, detalla funciones y dificultades principales durante el proceso.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Además de lo anterior, explica cómo resolvió las dificultades del trabajo colaborativo.',
      },
    },
  },
  {
    id: 5,
    indicador: 'Experiencia de resolución de conflictos',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Identifica una crisis o conflicto observado en el centro de aprendizaje.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion:
          'Identifica una crisis, reconoce sus componentes y describe alternativas de resolución.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Describe un conflicto vivido, sus componentes, emociones asociadas y la forma en que lo resolvió.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Además de resolverlo, propone otras alternativas de resolución argumentadas.',
      },
    },
  },
  {
    id: 6,
    indicador: 'Experiencia técnica',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Explica tareas generales realizadas sin seleccionar una experiencia específica.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion:
          'Selecciona una experiencia técnica usando parcialmente vocabulario específico. Explica indicaciones, tareas y resultados.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Relata la experiencia técnica con vocabulario adecuado, vincula habilidades y reconoce errores en la ejecución.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Además de lo anterior, propone mejoras o eficiencias para futuras ejecuciones similares.',
      },
    },
  },
  {
    id: 7,
    indicador: 'Propuesta de mejora',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Propone una acción de mejora sin un diagnóstico claro del centro de aprendizaje.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion:
          'Identifica oportunidades de mejora, selecciona una y propone acción concreta sobre una tarea o protocolo.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Además compara su propuesta e incorpora flujograma o ejemplos para respaldarla.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Desarrolla una propuesta de implementación real dentro del centro de aprendizaje.',
      },
    },
  },
  {
    id: 8,
    indicador: 'Evaluación de su desarrollo y aprendizaje',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion:
          'Resume su experiencia precisando tareas y obligaciones generales en un día de práctica.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion:
          'Resume experiencia, detalla aprendizajes principales e identifica experiencias significativas.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Explica cómo los aprendizajes impactarán su futuro profesional.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Reconoce elementos que aún debe aprender y presenta un plan para lograrlo.',
      },
    },
  },
  {
    id: 9,
    indicador: 'Expresión oral',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Expresa ideas pero con falta de claridad en los argumentos.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion: 'Manifiesta ideas de manera clara, elocuente y fluida.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Comunica claramente adecuando el mensaje al contexto y las características de emisor y receptor.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Además aplica estrategias para captar la atención mediante lenguaje, postura y disposición para responder preguntas.',
      },
    },
  },
  {
    id: 10,
    indicador: 'Presentación',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Presenta usando al menos un recurso innovador o creativo.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion: 'Realiza una presentación atractiva y dinámica utilizando recursos físicos y digitales.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Mantiene formalidad durante la exposición junto con el uso de recursos físicos y digitales.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Integra recursos como PPT, Canva, videos o códigos QR, mantiene formalidad y responde preguntas del público.',
      },
    },
  },
  {
    id: 11,
    indicador: 'Uso eficiente del tiempo',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Relata su experiencia en menos de seis minutos.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion:
          'Relata entre seis y ocho minutos incorporando parcialmente los elementos solicitados.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion: 'Relata entre ocho y diez minutos incorporando los elementos sin profundizar.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Relata entre diez y doce minutos, profundizando en todos los elementos solicitados.',
      },
    },
  },
  {
    id: 12,
    indicador: 'Empatía',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Mantiene ocasionalmente una actitud de respeto frente a sus pares o docentes.',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion:
          'Mantiene una actitud de respeto, aunque requiere recordatorios sobre el contexto.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion:
          'Mantiene respeto y atención permanente durante las presentaciones de sus pares.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion:
          'Además demuestra interés realizando valoraciones o preguntas en los momentos adecuados.',
      },
    },
  },
  {
    id: 13,
    indicador: 'Normas de seguridad',
    niveles: {
      DEBIL: {
        label: 'Débil',
        puntaje: 1,
        descripcion: 'Nombra algunos elementos de EPP o algunas normas de seguridad (solo uno de los dos).',
      },
      INCIPIENTE: {
        label: 'Incipiente',
        puntaje: 2,
        descripcion: 'Nombra algunos elementos de EPP y algunas normas de seguridad.',
      },
      SATISFACTORIO: {
        label: 'Satisfactorio',
        puntaje: 3,
        descripcion: 'Nombra todos los EPP utilizados y las normas de seguridad correspondientes.',
      },
      AVANZADO: {
        label: 'Avanzado',
        puntaje: 4,
        descripcion: 'Detalla la importancia de cada EPP y reconoce las normas de seguridad del centro de práctica.',
      },
    },
  },
];

export const PRESENTACION_DUAL_MAX_SCORE = PRESENTACION_DUAL_INDICADORES.length * 4;
export const PRESENTACION_DUAL_EXIGENCIA = 0.6;

export const NIVEL_LABELS: Record<NivelLogroPresentacionDual, string> = {
  DEBIL: 'Débil',
  INCIPIENTE: 'Incipiente',
  SATISFACTORIO: 'Satisfactorio',
  AVANZADO: 'Avanzado',
};
