// Este archivo contiene una versión básica de la fuente Google Sans Code para jsPDF
// Para una implementación completa, necesitarías archivos .ttf o .otf convertidos a formato compatible con jsPDF

export const GoogleSansCode = {
  // Esta es una versión simplificada - en una implementación real se incluirían todos los datos de la fuente
  normal: {
    id: 'GoogleSansCode',
    // Aquí irían los datos de la fuente, que son muy extensos
    // En una implementación real, estos datos provienen de convertir el archivo .ttf/.otf
    // usando herramientas como 'ttf2woff' y luego codificando en base64
    data: '...' // Datos reales de la fuente (muy extensos)
  },
  bold: {
    id: 'GoogleSansCodeBold',
    data: '...' // Datos de la versión bold
  },
  italic: {
    id: 'GoogleSansCodeItalic',
    data: '...' // Datos de la versión italic
  },
  bolditalic: {
    id: 'GoogleSansCodeBoldItalic',
    data: '...' // Datos de la versión bold italic
  }
};

// Función para añadir la fuente a un documento jsPDF
export const addGoogleSansCodeFont = (doc: any) => {
  // En una implementación real, aquí se añadiría la fuente al documento
  // usando doc.addFileToVFS, doc.addFont, etc.
  console.log('Google Sans Code font would be added here');
  return doc;
};
