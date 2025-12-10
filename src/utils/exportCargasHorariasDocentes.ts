import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocenteCargaHoraria, AsignacionCargaHoraria, TotalesDocenteCarga, CursoId } from '../../types';
import { CURSOS } from '../../constants';

/**
 * Genera un PDF con una página por docente mostrando sus asignaciones, distribución de horas
 * y espacio para firmas. Devuelve un Blob listo para descarga.
 */
interface OpcionesExportHorario {
  titulo?: string;              // Título principal del documento
  establecimiento?: string;     // Nombre del establecimiento para mostrar en encabezado
  directora?: string;           // Nombre de la directora para la firma
  fechaOverride?: string;       // Usar una fecha específica (YYYY-MM-DD) en vez de la actual
  incluirFecha?: boolean;       // Mostrar/ocultar la línea de fecha
  logoLeftUrl?: string;         // Logo institucional alineado a la izquierda
  logoRightUrl?: string;        // Logo institucional alineado a la derecha
  logoHeightCm?: number;        // Altura deseada de los logos (default 2cm)
}

const fetchImageAsDataURL = async (url?: string): Promise<string | null> => {
  if (!url) return null;
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('No se pudo cargar la imagen remota para el PDF:', err);
    return null;
  }
};

export async function exportCargasHorariasDocentes(
  docentes: DocenteCargaHoraria[],
  asignaciones: AsignacionCargaHoraria[],
  totalesByDocente: Record<string, TotalesDocenteCarga>,
  opciones: OpcionesExportHorario = {}
): Promise<Blob> {
  // 1) Determinar si necesitamos más espacio horizontal para columnas
  let maxCursosCols = 0;
  docentes.forEach((d) => {
    const asignacionesDoc = asignaciones.filter(a => a.docenteId === d.id);
    const cursosUsados = CURSOS.filter(c => asignacionesDoc.some(a => a.horasPorCurso[c as CursoId]));
    if (cursosUsados.length > maxCursosCols) maxCursosCols = cursosUsados.length;
  });
  const isLandscape = true; // forzamos formato horizontal oficio

  const doc = new jsPDF({ format: 'legal', unit: 'mm', orientation: 'landscape' });
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
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

  const logoLeftUrl = opciones.logoLeftUrl || 'https://res.cloudinary.com/dwncmu1wu/image/upload/v1764096456/Captura_de_pantalla_2025-11-25_a_la_s_3.47.16_p._m._p7m2xy.png';
  const logoRightUrl = opciones.logoRightUrl || 'https://res.cloudinary.com/dwncmu1wu/image/upload/v1753209432/LIR_fpq2lc.png';
  const logoHeightMm = (opciones.logoHeightCm || 2) * 10;
  const [logoLeftData, logoRightData] = await Promise.all([
    fetchImageAsDataURL(logoLeftUrl),
    fetchImageAsDataURL(logoRightUrl)
  ]);

  const renderedHeaders = new Map<number, number>();
  const drawHeader = (title: string): number => {
    let headerY = margin;
    const placeLogo = (dataUrl: string | null, alignRight = false) => {
      if (!dataUrl) return;
      const props = doc.getImageProperties(dataUrl);
      const ratio = props.width / props.height;
      const width = logoHeightMm * ratio;
      const x = alignRight ? pageWidth - margin - width : margin;
      doc.addImage(dataUrl, 'PNG', x, headerY, width, logoHeightMm, undefined, 'FAST');
    };
    if (logoLeftData || logoRightData) {
      placeLogo(logoLeftData, false);
      placeLogo(logoRightData, true);
      headerY += logoHeightMm + 2;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, pageWidth / 2, headerY + 6, { align: 'center' });
    headerY += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (establecimiento) {
      doc.text(`Establecimiento: ${establecimiento}`, margin, headerY + 2);
    }
    if (incluirFecha) {
      doc.text(`Fecha: ${fecha}`, pageWidth - margin, headerY + 2, { align: 'right' });
    }
    headerY += 6;
    doc.setDrawColor(200);
    doc.setLineWidth(0.4);
    doc.line(margin, headerY, pageWidth - margin, headerY);
    return headerY;
  };
  const ensureHeader = (title: string): number => {
    const pageNumber = doc.getCurrentPageInfo().pageNumber;
    if (!renderedHeaders.has(pageNumber)) {
      const bottom = drawHeader(title);
      renderedHeaders.set(pageNumber, bottom);
    }
    return renderedHeaders.get(pageNumber)!;
  };
  const renderedFooters = new Set<number>();
  const drawFooter = () => {
    doc.setDrawColor(230);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - margin + 4, pageWidth - margin, pageHeight - margin + 4);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`pág. ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    doc.setTextColor(0);
  };
  const ensureFooter = () => {
    const pageNumber = doc.getCurrentPageInfo().pageNumber;
    if (renderedFooters.has(pageNumber)) return;
    drawFooter();
    renderedFooters.add(pageNumber);
  };

  docentes.forEach((d, idx) => {
    if (idx > 0) doc.addPage();
    const headerBottom = ensureHeader(titulo);
    let infoY = headerBottom + 10;
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
          'Sala',
          ...cursosUsados,
          'Total Asig.',
          'Funciones Lectivas',
          'Funciones Extraordinarias'
        ]
      ];

      const body = asignacionesDoc.map(a => {
        const funcionesTxt = (a.funcionesLectivas || [])
          .map(f => `${f.nombre || 'Función'} (${f.horas}h)`).join('\n');
        const funcionesExtraTxt = (a.funcionesExtraordinarias || [])
          .map(f => `${f.tipo}: ${(f.cursos && f.cursos.length) ? f.cursos.join(', ') : 'Sin cursos asignados'}`)
          .join('\n');
        const totalAsig = a.horasXAsig || 0;
        const row = [
          a.asignaturaOModulo || '—',
          a.salaDeClases || '—',
          ...cursosUsados.map(c => String(a.horasPorCurso[c as CursoId] || '')),
          String(totalAsig),
          funcionesTxt || '—',
          funcionesExtraTxt || '—'
        ];
        return row;
      });

      // Calcular estilos de columnas adaptativos
      const asignaturaColWidth = isLandscape ? 65 : 50;
      const salaColWidth = 30;
      const funcionesColWidth = isLandscape ? 80 : 60;
      const funcionesExtraColWidth = isLandscape ? 90 : 65;
      const cursosStartIndex = 2; // después de Asignatura y Sala
      const totalColIndex = cursosStartIndex + cursosUsados.length;
      const funcionesLectivasIndex = totalColIndex + 1;
      const funcionesExtraIndex = funcionesLectivasIndex + 1;

      autoTable(doc, {
        head,
        body,
        startY: currentY,
        margin: { left: margin, right: margin, top: headerBottom + 8, bottom: margin },
        tableWidth: 'wrap',
        styles: { fontSize: 9, cellPadding: 3, lineWidth: 0.1, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: asignaturaColWidth },
          1: { cellWidth: salaColWidth, halign: 'center' },
          // columnas de cursos (2..n) centradas automáticamente
          [totalColIndex]: { halign: 'center', cellWidth: isLandscape ? 20 : 16 },
          [funcionesLectivasIndex]: { cellWidth: funcionesColWidth, halign: 'left' },
          [funcionesExtraIndex]: { cellWidth: funcionesExtraColWidth, halign: 'left' }
        } as any,
        didDrawPage: () => {
          ensureHeader(titulo);
          ensureFooter();
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
        if (currentY > pageHeight - 40) {
          ensureFooter();
          doc.addPage();
          const headerAfterAdd = ensureHeader(titulo);
          currentY = headerAfterAdd + 10;
        }
        doc.text(line, margin, currentY);
        currentY += 5;
      });
    }

    // Espacio para firmas al final de la página (forzar al final si falta espacio)
    if (currentY < pageHeight - 40) {
      currentY = pageHeight - 40;
    } else {
      ensureFooter();
      doc.addPage();
      const newHeaderBottom = ensureHeader(titulo);
      currentY = newHeaderBottom + 20;
    }
    doc.setFont('helvetica', 'normal');
    doc.text('Firma Docente:', margin, currentY);
    doc.line(margin, currentY + 2, margin + 70, currentY + 2);
    doc.text(`Firma Directora: ${nombreDirectora}`, margin + 110, currentY);
    doc.line(margin + 110, currentY + 2, margin + 190, currentY + 2);
    ensureFooter();
  });

  // Página final: Resumen Global acumulado
  doc.addPage();
  const headerYGlobal = ensureHeader('Resumen Global');
  let y = headerYGlobal + 12;
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
    if (y > pageHeight - 20) { ensureFooter(); doc.addPage(); y = ensureHeader('Resumen Global') + 12; }
    doc.text(l, margin, y);
    y += 8;
  });

    ensureHeader('Resumen Global');
    ensureFooter();
    return doc.output('blob');
}
