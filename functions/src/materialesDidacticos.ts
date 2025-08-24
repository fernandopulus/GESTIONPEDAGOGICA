import {onCall, HttpsError} from "firebase-functions/v2/https";

// Define los tipos para la función
type GenerateSlidesPayload = {
  tema?: string;
  asignatura?: string;
  objetivosAprendizaje?: string[];
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cloud Function para generar presentaciones didácticas en
 * Google Slides basadas en la planificación docente y
 * objetivos de aprendizaje.
 *
 * TODO: Implementar integración con Google Slides API.
 */
export const generateSlides = onCall<GenerateSlidesPayload>(
  {
    enforceAppCheck: true,
    timeoutSeconds: 180, // 3 minutos para generar presentaciones
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "La función debe ser llamada por un usuario autenticado."
      );
    }

    const tema = request.data?.tema?.trim() ?? "";
    const asignatura = request.data?.asignatura?.trim() ?? "";
    const oaRaw = request.data?.objetivosAprendizaje;
    const objetivosAprendizaje = Array.isArray(oaRaw) ? oaRaw : [];

    try {
      const hasData =
        tema.length > 0 &&
        asignatura.length > 0 &&
        objetivosAprendizaje.length > 0;

      if (!hasData) {
        throw new HttpsError(
          "invalid-argument",
          "Faltan datos esenciales para generar la presentación."
        );
      }

      // TODO: Crear presentaciones con Google Slides API.
      await delay(2000);

      const now = Date.now();
      const slideUrl =
        "https://docs.google.com/presentation/d/" +
        `example-${now}/edit`;

      const userUid = request.auth.uid;

      console.info(
        `Presentación generada para ${tema} (${asignatura}) ` +
          `por usuario ${userUid}`
      );

      return {
        url: slideUrl,
        message: "Presentación generada exitosamente",
        presentacionId: `demo-${now}`,
      };
    } catch (err: unknown) {
      console.error("Error generando presentación:", err);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      throw new HttpsError(
        "internal",
        `Error al generar la presentación: ${msg}`
      );
    }
  }
);
