import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocenteCargaHoraria, AsignacionCargaHoraria, TotalesDocenteCarga, CursoId } from '../../types';
import { CURSOS } from '../../constants';

/**
 * Genera un PDF con una página por docente mostrando sus asignaciones, distribución de horas
 * y espacio para firmas. Devuelve un Blob listo para descarga.
 */
interface OpcionesExportHorario {
  titulo?: string;            // Título principal del documento
  establecimiento?: string;   // Nombre del establecimiento para mostrar en encabezado
  directora?: string;         // Nombre de la directora para la firma
  fechaOverride?: string;     // Usar una fecha específica (YYYY-MM-DD) en vez de la actual
  incluirFecha?: boolean;     // Mostrar/ocultar la línea de fecha
  headerImageUrl?: string;    // URL de una imagen para cabecera (se escala al ancho disponible)
  headerImageHeightCm?: number; // Altura deseada en centímetros (default 1.5cm)
}

export async function exportCargasHorariasDocentes(
  docentes: DocenteCargaHoraria[],
  asignaciones: AsignacionCargaHoraria[],
  totalesByDocente: Record<string, TotalesDocenteCarga>,
  opciones: OpcionesExportHorario = {}
): Promise<Blob> {
  // 1) Determinar orientación óptima según cantidad máxima de columnas de cursos a renderizar
  let maxCursosCols = 0;
  docentes.forEach((d) => {
    const asignacionesDoc = asignaciones.filter(a => a.docenteId === d.id);
    const cursosUsados = CURSOS.filter(c => asignacionesDoc.some(a => a.horasPorCurso[c as CursoId]));
    if (cursosUsados.length > maxCursosCols) maxCursosCols = cursosUsados.length;
  });
  const isLandscape = maxCursosCols > 8; // umbral: si hay muchos cursos, usar paisaje

  const doc = new jsPDF({ format: 'letter', unit: 'mm', orientation: isLandscape ? 'landscape' : 'portrait' });
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const fecha = opciones.fechaOverride || new Date().toLocaleDateString('es-CL');
  const titulo = opciones.titulo || 'Cargas Horarias Docentes';
  const establecimiento = opciones.establecimiento || '';
  const nombreDirectora = opciones.directora || 'Directora';
  const incluirFecha = opciones.incluirFecha !== false; // por defecto true

  // Totales globales para resumen final
  const totalHorasContrato = docentes.reduce((acc, d) => acc + (typeof d.horasContrato === 'number' ? d.horasContrato : 0), 0);
  const totalHorasClases = asignaciones.reduce((acc, a) => acc + Object.values(a.horasPorCurso || {}).reduce((s, h) => s + (typeof h === 'number' ? h : 0), 0), 0);
  const totalFuncionesLectivas = asignaciones.reduce((acc, a) => acc + (a.funcionesLectivas || []).reduce((s, f) => s + (typeof f.horas === 'number' ? f.horas : 0), 0), 0);
  const totalHorasAsignadas = totalHorasClases + totalFuncionesLectivas;

  // Pre-cargar imagen si se especifica
  let headerImageData: string | null = null;
  const headerImageHeightCm = opciones.headerImageHeightCm || 1.5; // 1.5cm por defecto
  const headerImageHeightMm = headerImageHeightCm * 10; // conversión cm->mm
  if (opciones.headerImageUrl) {
    try {
      const resp = await fetch(opciones.headerImageUrl, { cache: 'no-store' });
      const blob = await resp.blob();
      headerImageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      // Silenciar error y continuar sin imagen
      headerImageData = null;
      console.warn('No se pudo cargar la imagen de cabecera:', e);
    }
  }

  docentes.forEach((d, idx) => {
    if (idx > 0) doc.addPage();

    // 2) Encabezado modernizado con posible imagen
    let headerY = margin;
    if (headerImageData) {
      const usableWidth = pageWidth - margin * 2;
      // Insertar imagen ocupando el ancho disponible, altura fija declarada
      doc.addImage(headerImageData, 'PNG', margin, headerY, usableWidth, headerImageHeightMm, undefined, 'FAST');
      headerY += headerImageHeightMm + 4; // espacio debajo de la imagen
    }
    // Título centrado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(titulo, pageWidth / 2, headerY, { align: 'center' });
    // Línea divisoria bajo el título
    doc.setDrawColor(200);
    doc.setLineWidth(0.4);
    doc.line(margin, headerY + 3, pageWidth - margin, headerY + 3);
    // Meta izquierda/derecha en segunda línea
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (establecimiento) {
      doc.text(`${establecimiento}`, margin, headerY + 8, { align: 'left' });
    }
    if (incluirFecha) {
      doc.text(`Fecha: ${fecha}`, pageWidth - margin, headerY + 8, { align: 'right' });
    }
    // Datos del docente en bloque siguiente (simplificado)
    let infoY = headerY + 16;
    doc.text(`Docente: ${d.nombre}`, margin, infoY);
    infoY += 6;
    doc.text(`Email: ${d.email || '—'}`, margin, infoY);
    infoY += 6;
    const horasContratoNum = typeof d.horasContrato === 'number' ? d.horasContrato : undefined;
    doc.text(`Horas contrato: ${typeof horasContratoNum === 'number' ? horasContratoNum : '—'}h`, margin, infoY);
    const totales = totalesByDocente[d.id];
    if (totales) {
      const horasClases = totales.sumCursos || 0; // suma cursos/asignaturas
      const horasFunciones = totales.sumFunciones || 0; // suma funciones lectivas
      const horasLectivasTotales = horasClases + horasFunciones; // total horas asignadas
      infoY += 6;
      doc.text(`Horas clases (cursos): ${horasClases}h`, margin, infoY);
      infoY += 6;
      doc.text(`Funciones lectivas: ${horasFunciones}h`, margin, infoY);
      infoY += 6;
      doc.text(`Total horas asignadas (clases + funciones lectivas): ${horasLectivasTotales}h`, margin, infoY);
    }

    let currentY = infoY + 10;

    // Asignaciones del docente
    const asignacionesDoc = asignaciones.filter(a => a.docenteId === d.id);

    if (asignacionesDoc.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.text('Este docente no tiene asignaciones registradas.', margin, currentY);
    } else {
      // Determinar cursos utilizados para columnas dinámicas
      const cursosUsados = CURSOS.filter(c => asignacionesDoc.some(a => a.horasPorCurso[c as CursoId]));
      // Construir cabecera
      const head = [
        [
          'Asignatura',
          ...cursosUsados,
          'Total Asig.',
          'Funciones Lectivas'
        ]
      ];

      const body = asignacionesDoc.map(a => {
        const funcionesTxt = (a.funcionesLectivas || [])
          .map(f => `${f.nombre || 'Función'} (${f.horas}h)`).join('\n');
        const totalAsig = a.horasXAsig || 0;
        const row = [
          a.asignaturaOModulo || '—',
          ...cursosUsados.map(c => String(a.horasPorCurso[c as CursoId] || '')),
          String(totalAsig),
          funcionesTxt || '—'
        ];
        return row;
      });

      // Calcular estilos de columnas adaptativos
      const asignaturaColWidth = isLandscape ? 65 : 50;
      const funcionesColWidth = isLandscape ? 80 : 60;

      autoTable(doc, {
        head,
        body,
        startY: currentY,
        margin: { left: margin, right: margin },
        tableWidth: 'wrap',
        styles: { fontSize: 9, cellPadding: 3, lineWidth: 0.1, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: asignaturaColWidth },
          // columnas de cursos (1..n) centradas automáticamente
          // la penúltima (Total Asig.):
          [1 + cursosUsados.length]: { halign: 'center', cellWidth: isLandscape ? 20 : 16 },
          // última (Funciones Lectivas):
          [2 + cursosUsados.length]: { cellWidth: funcionesColWidth, halign: 'left' }
        } as any,
        didDrawPage: data => {
          // Footer con número de página y línea superior
          doc.setDrawColor(230);
          doc.setLineWidth(0.2);
          doc.line(margin, margin - 6, pageWidth - margin, margin - 6);
          doc.setFontSize(9);
          doc.setTextColor(100);
          doc.text(`pág. ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
        }
      });
      // Actualizar Y después de la tabla
      // @ts-ignore
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Cuadro resumen simplificado
    if (totales) {
  const horasClases = totales.sumCursos || 0;
  const horasFunciones = totales.sumFunciones || 0; // funciones lectivas
  const horasLectivasTotales = horasClases + horasFunciones; // total horas asignadas
      const horasContratoDisplay = typeof d.horasContrato === 'number' ? d.horasContrato : (typeof (totales as any).HA === 'number' && typeof (totales as any).HB === 'number' ? (totales as any).HA + (totales as any).HB : undefined);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen de Horas', margin, currentY);
      doc.setFont('helvetica', 'normal');
      currentY += 6;
      const resumenLines = [
        `Contrato: ${typeof horasContratoDisplay === 'number' ? horasContratoDisplay : '—'}h`,
        `Clases (cursos): ${horasClases}h`,
        `Funciones lectivas: ${horasFunciones}h`,
        `Total horas asignadas (clases + funciones lectivas): ${horasLectivasTotales}h`
      ];
      resumenLines.forEach(line => {
        if (currentY > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          currentY = margin;
        }
        doc.text(line, margin, currentY);
        currentY += 5;
      });
    }

    // Espacio para firmas al final de la página (forzar al final si falta espacio)
    if (currentY < pageHeight - 40) {
      currentY = pageHeight - 40;
    } else {
      doc.addPage();
      currentY = margin + 10;
    }
    doc.setFont('helvetica', 'normal');
    doc.text('Firma Docente:', margin, currentY);
    doc.line(margin, currentY + 2, margin + 70, currentY + 2);
    doc.text(`Firma Directora: ${nombreDirectora}`, margin + (isLandscape ? 110 : 90), currentY);
    doc.line(margin + (isLandscape ? 110 : 90), currentY + 2, margin + (isLandscape ? 190 : 170), currentY + 2);
  });

  // Página final: Resumen Global acumulado
  doc.addPage();
  let headerYGlobal = margin;
  if (headerImageData) {
    const usableWidth = pageWidth - margin * 2;
    doc.addImage(headerImageData, 'PNG', margin, headerYGlobal, usableWidth, headerImageHeightMm, undefined, 'FAST');
    headerYGlobal += headerImageHeightMm + 4;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Resumen Global', pageWidth / 2, headerYGlobal, { align: 'center' });
  doc.setDrawColor(200);
  doc.setLineWidth(0.4);
  doc.line(margin, headerYGlobal + 3, pageWidth - margin, headerYGlobal + 3);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (establecimiento) doc.text(`${establecimiento}`, margin, headerYGlobal + 8, { align: 'left' });
  if (incluirFecha) doc.text(`Fecha: ${fecha}`, pageWidth - margin, headerYGlobal + 8, { align: 'right' });

  let y = headerYGlobal + 18;
  const lines = [
    `Docentes: ${docentes.length}`,
    `Asignaciones: ${asignaciones.length}`,
    `Horas contrato (suma): ${totalHorasContrato}h`,
    `Clases (cursos): ${totalHorasClases}h`,
    `Funciones lectivas: ${totalFuncionesLectivas}h`,
    `Total horas asignadas (clases + funciones lectivas): ${totalHorasAsignadas}h`,
  ];
  doc.setFontSize(12);
  lines.forEach((l) => {
    if (y > pageHeight - 20) { doc.addPage(); y = margin; }
    doc.text(l, margin, y);
    y += 8;
  });

    return doc.output('blob');
}
