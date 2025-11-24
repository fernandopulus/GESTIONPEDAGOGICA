import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DocenteCargaHoraria, AsignacionCargaHoraria, TotalesDocenteCarga, CursoId } from '../../types';
import { CURSOS, DIAS_SEMANA } from '../../constants';

interface ExportOptions {
  logo?: string;
  directora?: string;
  establecimiento?: string;
}

export class HorariosExporter {
  doc: jsPDF;
  options: ExportOptions;
  margin = 15;
  pageWidth = 210; // A4
  pageHeight = 297; // A4
  contentWidth: number;
  currentY = 0;

  constructor(options: ExportOptions = {}) {
    this.doc = new jsPDF({
      format: 'a4',
      unit: 'mm',
    });
    this.options = {
      directora: 'Patricia Silva Sánchez',
      ...options,
    };
    this.contentWidth = this.pageWidth - 2 * this.margin;
    this.currentY = this.margin;
  }

  /**
   * Verifica si necesita nueva página
   */
  private needsNewPage(height: number): boolean {
    return this.currentY + height > this.pageHeight - this.margin;
  }

  /**
   * Añade una nueva página y resetea el cursor
   */
  private addNewPage(): void {
    this.doc.addPage();
    this.currentY = this.margin;
  }

  /**
   * Dibuja el encabezado de la página con info de docente
   */
  private drawDocumentHeader(docente: DocenteCargaHoraria): void {
    if (this.needsNewPage(30)) this.addNewPage();

    // Título establecimiento
    if (this.options.establecimiento) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(14);
      this.doc.setTextColor(15, 23, 42);
      this.doc.text(this.options.establecimiento, this.pageWidth / 2, this.currentY, { align: 'center' });
      this.currentY += 8;
    }

    // Subtítulo
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('Carga Horaria Docente', this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 8;

    // Línea divisoria
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;

    // Info docente
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(12);
    this.doc.setTextColor(15, 23, 42);
    this.doc.text(`Docente: ${docente.nombre}`, this.margin, this.currentY);
    this.currentY += 6;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text(`Departamento: ${docente.departamento || 'N/A'}`, this.margin, this.currentY);
    this.currentY += 6;

    this.doc.text(`Horas Contrato: ${docente.horasContrato || 0}h`, this.margin, this.currentY);
    this.currentY += 10;
  }

  /**
   * Dibuja tabla de asignaciones por curso
   */
  private drawAsignacionesTable(
    asignacionesDocente: AsignacionCargaHoraria[],
    totales: TotalesDocenteCarga | undefined
  ): void {
    if (this.needsNewPage(60)) this.addNewPage();

    // Título sección
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.setTextColor(15, 23, 42);
    this.doc.text('Asignaciones de Carga Horaria', this.margin, this.currentY);
    this.currentY += 6;

    // Preparar datos para tabla
    const tableData: any[] = [];
    asignacionesDocente.forEach((asig) => {
      const row: any[] = [
        asig.asignaturaOModulo || 'Sin asignatura',
        asig.horasXAsig || 0,
      ];

      // Agregar horas por curso
      CURSOS.forEach((curso) => {
        row.push(asig.horasPorCurso[curso as CursoId] || 0);
      });

      // Agregar funciones lectivas
      if (asig.funcionesLectivas && asig.funcionesLectivas.length > 0) {
        const funcionesStr = asig.funcionesLectivas
          .map((f) => `${f.nombre} (${f.horas}h)`)
          .join(', ');
        row.push(funcionesStr);
      } else {
        row.push('-');
      }

      tableData.push(row);
    });

    // Headers de tabla
    const headers = ['Asignatura/Módulo', 'Total Horas', ...CURSOS, 'Funciones Lectivas'];

    autoTable(this.doc, {
      head: [headers],
      body: tableData,
      startY: this.currentY,
      margin: { left: this.margin, right: this.margin },
      headStyles: {
        fillColor: [59, 130, 246], // blue-500
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        textColor: [15, 23, 42],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // slate-100
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
      },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  /**
   * Dibuja resumen de totales HA/HB
   */
  private drawTotales(totales: TotalesDocenteCarga | undefined): void {
    if (!totales) return;
    if (this.needsNewPage(30)) this.addNewPage();

    // Título
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.setTextColor(15, 23, 42);
    this.doc.text('Resumen de Horas', this.margin, this.currentY);
    this.currentY += 8;

    // Tabla resumen
    const summaryData = [
      ['Horas Lectivas (HA)', totales.HA, totales.restantesHA >= 0 ? '+' + totales.restantesHA : totales.restantesHA],
      ['Horas No Lectivas (HB)', totales.HB, totales.restantesHB >= 0 ? '+' + totales.restantesHB : totales.restantesHB],
      ['Total Asignado', totales.sumCursos + totales.sumFunciones, ''],
    ];

    autoTable(this.doc, {
      head: [['Concepto', 'Horas', 'Restante']],
      body: summaryData,
      startY: this.currentY,
      margin: { left: this.margin, right: this.margin },
      headStyles: {
        fillColor: [34, 197, 94], // green-500
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 3,
        textColor: [15, 23, 42],
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
      },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
  }

  /**
   * Dibuja espacios de firma
   */
  private drawSignatures(): void {
    if (this.needsNewPage(50)) this.addNewPage();

    const signatureY = this.currentY;
    const signatureSpacing = (this.contentWidth - 30) / 2; // 30mm gap en el medio

    // Firma docente (izquierda)
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(100, 116, 139);

    const docSignX = this.margin;
    const dirSignX = this.margin + signatureSpacing + 30;

    // Línea firma docente
    this.doc.setDrawColor(100, 116, 139);
    this.doc.setLineWidth(0.5);
    this.doc.line(docSignX, signatureY + 50, docSignX + signatureSpacing - 15, signatureY + 50);

    // Etiqueta docente
    this.doc.text('Firma del Docente', docSignX, signatureY + 55);
    this.doc.text('(Nombre y rut)', docSignX, signatureY + 59);

    // Línea firma directora
    this.doc.line(dirSignX, signatureY + 50, dirSignX + signatureSpacing - 15, signatureY + 50);

    // Etiqueta directora
    this.doc.text('Firma de la Directora', dirSignX, signatureY + 55);
    if (this.options.directora) {
      this.doc.text(this.options.directora, dirSignX, signatureY + 59);
    }

    this.currentY = signatureY + 70;
  }

  /**
   * Exporta todos los docentes a un PDF multi-página
   */
  export(
    docentes: DocenteCargaHoraria[],
    asignaciones: AsignacionCargaHoraria[],
    totalesByDocente: Record<string, TotalesDocenteCarga>
  ): Blob {
    docentes.forEach((docente, index) => {
      // Nueva página para cada docente (excepto el primero)
      if (index > 0) {
        this.addNewPage();
      }

      // Dibujar contenido del docente
      this.drawDocumentHeader(docente);

      const asignacionesDocente = asignaciones.filter((a) => a.docenteId === docente.id);
      if (asignacionesDocente.length > 0) {
        this.drawAsignacionesTable(asignacionesDocente, totalesByDocente[docente.id]);
        this.drawTotales(totalesByDocente[docente.id]);
      } else {
        // Si no hay asignaciones, mostrar mensaje
        this.doc.setFont('helvetica', 'italic');
        this.doc.setFontSize(10);
        this.doc.setTextColor(100, 116, 139);
        this.doc.text('No hay asignaciones registradas para este docente', this.margin, this.currentY);
        this.currentY += 10;
      }

      // Dibujar espacios de firma
      this.drawSignatures();
    });

    return this.doc.output('blob');
  }
}

/**
 * Función conveniente para exportar horarios
 */
export async function exportarHorariosPDF(
  docentes: DocenteCargaHoraria[],
  asignaciones: AsignacionCargaHoraria[],
  totalesByDocente: Record<string, TotalesDocenteCarga>,
  options?: ExportOptions
): Promise<void> {
  try {
    const exporter = new HorariosExporter(options);
    const blob = exporter.export(docentes, asignaciones, totalesByDocente);

    // Crear descarga
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cargas_Horarias_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error al exportar horarios:', error);
    throw new Error('No se pudo generar el PDF de horarios');
  }
}
