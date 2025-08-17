import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Tipos
export type PDFCursor = {
  x: number;
  y: number;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  lineHeight: number;
};

type ColorTuple = [number, number, number];

// Configuración general
const CONFIG = {
  COLORS: {
    TEXT_PRIMARY: [15, 23, 42] as ColorTuple,     // #0F172A
    TEXT_MUTED: [100, 116, 139] as ColorTuple,    // #64748B
    TABLE_ZEBRA: [248, 250, 252] as ColorTuple,   // #F8FAFC
    TABLE_BORDER: [226, 232, 240] as ColorTuple,  // #E2E8F0
    POSITIVE: [22, 163, 74] as ColorTuple,        // #16A34A
    NEGATIVE: [220, 38, 38] as ColorTuple,        // #DC2626
    TABLE_HEADER: [15, 23, 42] as ColorTuple,     // #0F172A
    CARD_BORDER: [226, 232, 240] as ColorTuple,   // #E2E8F0
  }
};

export class PDFHelper {
  doc: jsPDF;
  cursor: PDFCursor;

  constructor() {
    this.doc = new jsPDF({
      format: 'letter',
      unit: 'mm',
    });

    this.cursor = {
      x: 20,
      y: 20,
      pageWidth: this.doc.internal.pageSize.getWidth(),
      pageHeight: this.doc.internal.pageSize.getHeight(),
      margin: 20,
      contentWidth: this.doc.internal.pageSize.getWidth() - 40, // 20mm margins on each side
      lineHeight: 1.35,
    };
  }

  // Helper para crear nueva página
  newPage(): void {
    this.doc.addPage();
    this.cursor.y = this.cursor.margin;
    this.drawPageNumber();
  }

  // Verifica si necesita nueva página
  needsNewPage(height: number): boolean {
    return (this.cursor.y + height) > (this.cursor.pageHeight - this.cursor.margin);
  }

  // Dibuja encabezado con logo y metadata
  drawHeader(meta: { establecimiento?: string; periodo: string; fechaISO: string; logoUrl?: string }): void {
    const { establecimiento, periodo, fechaISO, logoUrl } = meta;
    const originalY = this.cursor.y;

    // Logo si existe
    if (logoUrl) {
      this.doc.addImage(
        logoUrl,
        'PNG',
        this.cursor.margin,
        this.cursor.margin,
        10,
        10
      );
      this.cursor.y += 15;
    }

    // Metadata izquierda
    this.doc.setFontSize(9);
    this.doc.setTextColor(...CONFIG.COLORS.TEXT_MUTED);
    if (establecimiento) {
      this.doc.text(establecimiento, this.cursor.margin, originalY + 5);
    }
    this.doc.text(periodo, this.cursor.margin, originalY + 10);

    // Fecha derecha
    const fecha = new Date(fechaISO).toLocaleDateString('es-CL');
    this.doc.text(
      fecha,
      this.cursor.pageWidth - this.cursor.margin,
      originalY + 5,
      { align: 'right' }
    );

    this.cursor.y = Math.max(this.cursor.y, originalY + 20);
  }

  // Dibuja título principal
  drawTitle(title: string): void {
    if (this.needsNewPage(30)) this.newPage();

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(24);
    this.doc.setTextColor(...CONFIG.COLORS.TEXT_PRIMARY);
    
    this.doc.text(
      title,
      this.cursor.pageWidth / 2,
      this.cursor.y,
      { align: 'center' }
    );
    
    this.cursor.y += 15;
  }

  // Dibuja subtítulo de sección
  drawSectionHeading(number: number, text: string): void {
    if (this.needsNewPage(25)) this.newPage();

    this.doc.setFont('helvetica', 'semibold');
    this.doc.setFontSize(16);
    this.doc.setTextColor(...CONFIG.COLORS.TEXT_PRIMARY);
    
    const fullText = `${number}. ${text}`;
    this.doc.text(fullText, this.cursor.margin, this.cursor.y);
    
    // Línea divisoria
    this.cursor.y += 5;
    this.doc.setDrawColor(...CONFIG.COLORS.TEXT_MUTED);
    this.doc.setLineWidth(0.1);
    this.doc.line(
      this.cursor.margin,
      this.cursor.y,
      this.cursor.pageWidth - this.cursor.margin,
      this.cursor.y
    );
    
    this.cursor.y += 10;
  }

  // Escribe párrafo justificado
  writeParagraph(text: string, options?: { width?: number; lineHeight?: number }): void {
    const width = options?.width || this.cursor.contentWidth;
    const lineHeight = (options?.lineHeight || this.cursor.lineHeight) * 5;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(11);
    this.doc.setTextColor(...CONFIG.COLORS.TEXT_PRIMARY);

    const lines = this.doc.splitTextToSize(text, width);
    
    for (let i = 0; i < lines.length; i++) {
      if (this.needsNewPage(lineHeight)) this.newPage();
      
      // Justificar todas las líneas excepto la última
      if (i < lines.length - 1) {
        this.writeJustifiedLine(lines[i], this.cursor.margin, this.cursor.y, width);
      } else {
        this.doc.text(lines[i], this.cursor.margin, this.cursor.y);
      }
      
      this.cursor.y += lineHeight;
    }
  }

  // Helper para justificar una línea
  private writeJustifiedLine(text: string, x: number, y: number, width: number): void {
    const words = text.split(' ');
    const textWidth = this.doc.getTextWidth(text);
    const spaceWidth = (width - textWidth) / (words.length - 1);
    
    let currentX = x;
    words.forEach((word, i) => {
      this.doc.text(word, currentX, y);
      if (i < words.length - 1) {
        currentX += this.doc.getTextWidth(word) + spaceWidth;
      }
    });
  }

  // Dibuja tabla de resultados
  drawResultadosTable(resultados: Array<{ 
    asignatura: string; 
    promedioS1: number; 
    promedioS2: number; 
    variacion: number; 
  }>): void {
    if (this.needsNewPage(50)) this.newPage();

    const data = resultados.map(r => [
      r.asignatura,
      r.promedioS1.toFixed(1),
      r.promedioS2.toFixed(1),
      {
        content: (r.variacion > 0 ? '+' : '') + r.variacion.toFixed(1),
        styles: {
          textColor: r.variacion > 0 
            ? CONFIG.COLORS.POSITIVE 
            : r.variacion < 0 
              ? CONFIG.COLORS.NEGATIVE 
              : CONFIG.COLORS.TEXT_MUTED,
          halign: 'center'
        }
      }
    ]);

    autoTable(this.doc, {
      head: [['Asignatura', 'Promedio S1', 'Promedio S2', 'Variación']],
      body: data,
      startY: this.cursor.y,
      margin: { left: this.cursor.margin, right: this.cursor.margin },
      headStyles: {
        fillColor: CONFIG.COLORS.TABLE_HEADER,
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 11,
        cellPadding: 3,
        lineWidth: 0.1,
        lineColor: CONFIG.COLORS.TABLE_BORDER
      },
      alternateRowStyles: {
        fillColor: CONFIG.COLORS.TABLE_ZEBRA
      },
      didDrawPage: (data) => {
        this.drawPageNumber();
      }
    });

    this.cursor.y = (this.doc as any).lastAutoTable.finalY + 10;
  }

  // Dibuja grid de proyectos
  drawProyectosGrid(proyectos: Array<{ titulo: string; descripcion: string }>): void {
    const cardWidth = (this.cursor.contentWidth - 10) / 2; // 10mm gap entre cards
    const cardPadding = 5;
    let currentX = this.cursor.margin;

    for (let i = 0; i < proyectos.length; i++) {
      const proyecto = proyectos[i];
      
      // Estimar altura del card
      this.doc.setFontSize(11);
      const descLines = this.doc.splitTextToSize(proyecto.descripcion, cardWidth - (cardPadding * 2));
      const cardHeight = 10 + (descLines.length * 5) + (cardPadding * 2);

      // Verificar si necesitamos nueva página o nueva fila
      if (this.needsNewPage(cardHeight) || (i % 2 === 0 && this.cursor.y + cardHeight > this.cursor.pageHeight - this.cursor.margin)) {
        this.newPage();
        currentX = this.cursor.margin;
      } else if (i % 2 === 0) {
        currentX = this.cursor.margin;
      } else {
        currentX = this.cursor.margin + cardWidth + 10;
      }

      // Dibujar card
      this.doc.setDrawColor(...CONFIG.COLORS.CARD_BORDER);
      this.doc.setFillColor(255, 255, 255);
      this.doc.roundedRect(currentX, this.cursor.y, cardWidth, cardHeight, 3, 3, 'FD');

      // Título
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(13);
      this.doc.text(proyecto.titulo, currentX + cardPadding, this.cursor.y + cardPadding + 5);

      // Descripción
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(11);
      this.writeJustifiedText(
        proyecto.descripcion,
        currentX + cardPadding,
        this.cursor.y + cardPadding + 15,
        cardWidth - (cardPadding * 2)
      );

      // Actualizar cursor Y solo después de la segunda card o si es la última
      if (i % 2 === 1 || i === proyectos.length - 1) {
        this.cursor.y += cardHeight + 10;
      }
    }
  }

  // Helper para escribir texto justificado dentro de un ancho específico
  private writeJustifiedText(text: string, x: number, y: number, width: number): void {
    const lines = this.doc.splitTextToSize(text, width);
    lines.forEach((line: string, i: number) => {
      if (i < lines.length - 1) {
        this.writeJustifiedLine(line, x, y + (i * 5), width);
      } else {
        this.doc.text(line, x, y + (i * 5));
      }
    });
  }

  // Dibuja número de página
  drawPageNumber(): void {
    const pageNumber = this.doc.getCurrentPageInfo().pageNumber;
    const totalPages = this.doc.getNumberOfPages();
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...CONFIG.COLORS.TEXT_MUTED);
    
    this.doc.text(
      `pág. ${pageNumber} de ${totalPages}`,
      this.cursor.pageWidth - this.cursor.margin,
      this.cursor.pageHeight - 10,
      { align: 'right' }
    );
  }

  // Genera el PDF final
  generate(): Blob {
    // Agregar números de página a todas las páginas
    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.drawPageNumber();
    }

    return this.doc.output('blob');
  }
}
