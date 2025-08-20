/**
 * Funciones de normalización de texto para asegurar la consistencia al comparar cadenas
 */

/**
 * Normaliza un texto eliminando espacios extra, acentos y convirtiendo a minúsculas
 * @param text Texto a normalizar
 * @returns Texto normalizado
 */
export const normalizeString = (text: string): string => {
  if (!text) return '';
  
  // Eliminar espacios extra y convertir a minúsculas
  let normalized = text.trim().toLowerCase();
  
  // Reemplazar acentos
  normalized = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
    
  return normalized;
};
