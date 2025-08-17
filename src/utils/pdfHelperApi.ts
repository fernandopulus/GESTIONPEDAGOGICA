import { PDFHelper } from './pdfHelper';

interface PDFMeta {
  titulo: string;
  establecimiento?: string;
  periodo: string;
  fechaISO: string;
  logoUrl?: string;
}

export interface PDFResultado {
  asignatura: string;
  promedioS1: number;
  promedioS2: number;
  variacion: number;
}

export interface PDFProyecto {
  titulo: string;
  descripcion: string;
}

export interface PDFGeneratorData {
  meta: PDFMeta;
  secciones: Array<{
    titulo: string;
    contenido: string;
  }>;
  resultados?: PDFResultado[];
  proyectos?: PDFProyecto[];
}

export const generatePDF = (data: PDFGeneratorData): Blob => {
  const pdf = new PDFHelper();
  
  // Header y título
  pdf.drawHeader(data.meta);
  pdf.drawTitle(data.meta.titulo);
  
  // Secciones numeradas con contenido
  data.secciones.forEach((seccion, i) => {
    pdf.drawSectionHeading(i + 1, seccion.titulo);
    pdf.writeParagraph(seccion.contenido);
  });

  // Tabla de resultados si hay
  if (data.resultados && data.resultados.length > 0) {
    pdf.drawSectionHeading(data.secciones.length + 1, 'Resultados');
    pdf.drawResultadosTable(data.resultados);
  }

  // Grid de proyectos si hay
  if (data.proyectos && data.proyectos.length > 0) {
    pdf.drawSectionHeading(
      data.secciones.length + (data.resultados ? 2 : 1),
      'Proyectos'
    );
    pdf.drawProyectosGrid(data.proyectos);
  }

  return pdf.generate();
};
