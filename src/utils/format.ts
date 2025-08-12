// src/utils/format.ts

/** Tipo mínimo para Timestamps de Firestore serializados */
type FireTimestamp = { seconds: number; nanoseconds: number };

/** ¿Tiene forma de Timestamp (objeto con seconds/nanoseconds)? */
const isFsTimestamp = (v: unknown): v is FireTimestamp =>
  !!v &&
  typeof v === 'object' &&
  'seconds' in (v as any) &&
  'nanoseconds' in (v as any);

/** Intenta convertir distintos formatos (ISO string | Date | Firestore Timestamp-like) a Date */
export const toDate = (v?: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (isFsTimestamp(v)) {
    const ms = v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  // Firestore Timestamp runtime (tiene toDate)
  if (typeof (v as any)?.toDate === 'function') {
    const d = (v as any).toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  return null;
};

/** Devuelve un ISO seguro (YYYY-MM-DDTHH:mm:ss.sssZ) o undefined */
export const toISO = (v?: unknown): string | undefined => {
  const d = toDate(v);
  return d ? d.toISOString() : undefined;
};

/** Formatea solo fecha local (es-CL) de manera segura */
export const formatDateOnly = (v?: unknown): string => {
  const d = toDate(v);
  return d ? d.toLocaleDateString('es-CL') : '';
};

/** Formatea fecha+hora local (es-CL) de manera segura */
export const formatDateTime = (v?: unknown): string => {
  const d = toDate(v);
  return d ? d.toLocaleString('es-CL') : '';
};
