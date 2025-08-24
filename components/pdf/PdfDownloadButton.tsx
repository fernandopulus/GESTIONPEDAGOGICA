import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { FileDown, Loader2 } from 'lucide-react';
import { PlanificacionUnidad, PlanificacionClase } from '../../types';
import UnidadPDF from './UnidadPDF';
import ClasePDF from './ClasePDF';

interface PdfDownloadButtonProps {
  plan: PlanificacionUnidad | PlanificacionClase;
  className?: string;
}

const PdfDownloadButton: React.FC<PdfDownloadButtonProps> = ({ plan, className }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      
      // Determinar qué tipo de documento es
      // Verificamos si tiene nombreUnidad (PlanificacionUnidad) o nombreClase (PlanificacionClase)
      const isPlanUnidad = 'nombreUnidad' in plan || plan.tipo === 'Unidad';
      
      // Generar el PDF según el tipo
      const PDFDocument = isPlanUnidad 
        ? <UnidadPDF plan={plan as PlanificacionUnidad} /> 
        : <ClasePDF plan={plan as PlanificacionClase} />;
      
      // Crear un blob con el PDF
      const blob = await pdf(PDFDocument).toBlob();
      
      // Crear un objeto URL para el blob
      const url = URL.createObjectURL(blob);
      
      // Crear un enlace de descarga
      const link = document.createElement('a');
      link.href = url;
      
      // Generar nombre del archivo
      const nombreArchivo = isPlanUnidad
        ? `Planificacion_${(plan as PlanificacionUnidad).nombreUnidad?.replace(/[^a-zA-Z0-9]/g, '_') || 'unidad'}.pdf`
        : `PlanClase_${(plan as PlanificacionClase).nombreClase?.replace(/[^a-zA-Z0-9]/g, '_') || 'clase'}.pdf`;
      
      link.download = nombreArchivo;
      
      // Simular clic para descargar
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al generar el PDF:', error);
      alert('Error al generar el PDF. Por favor, intente nuevamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button 
      onClick={handleDownload} 
      disabled={isGenerating} 
      className={`bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md flex items-center justify-center gap-2 disabled:opacity-50 ${className || ''}`}
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4" />
      )}
      Descargar PDF
    </button>
  );
};

export default PdfDownloadButton;
