// components/modules/AcompanamientoDocente.tsx
import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import {
  FileText,
  Users,
  Video,
  ClipboardList,
  MessageSquare,
  CalendarCheck,
  BarChart3,
  Wrench,
  Pencil,
  PlusSquare,
  Trash2,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { PDFHelper } from '../../src/utils/pdfHelper';
import {
  AcompanamientoDocente as AcompanamientoDocenteType,
  CicloOPR,
  DetalleObservacionRow,
} from '../../types';
import { ASIGNATURAS, CURSOS, RUBRICA_ACOMPANAMIENTO_DOCENTE as defaultRubric } from '../../constants';
import CiclosOPRList from './CiclosOPRList';
import { generatePDF, PDFGeneratorData } from '../../src/utils/pdfHelperApi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logApiCall } from '../utils/apiLogger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AcompanamientoDocenteDashboard from './AcompanamientoDocenteDashboard';

// Firebase helpers (usa la versión con callback de progreso)
import {
  getAllAcompanamientos,
  createAcompanamiento,
  updateAcompanamiento,
  deleteAcompanamiento,
  createCicloOPR,
  updateCicloOPR,
  deleteCicloOPR,
  uploadFileImproved as uploadFile,
  getCiclosOPRByAcompanamiento,
  getStandaloneCiclosOPR,
} from '../../src/firebaseHelpers/acompanamientos';
import { getAllUsers as getAllUsersFromFirebase } from '../../src/firebaseHelpers/users';

const getAllUsers = async (): Promise<any[]> => {
  return await getAllUsersFromFirebase();
};

/* =========================
   FileUpload Mejorado
   ========================= */
interface FileUploadProps {
  label: string;
  onFileChange: (file: File) => void;
  onLinkChange?: (url: string) => void;
  uploadedUrl?: string;
  onRemove: () => void;
  isUploading: boolean;
  accept?: string;
  error?: string | null;
  progress?: number;
  allowLink?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  onFileChange,
  onLinkChange,
  uploadedUrl,
  onRemove,
  isUploading,
  accept = 'video/mp4,video/quicktime,video/avi,video/mov',
  error,
  progress = 0,
  allowLink = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const inputId = `file-upload-${label.replace(/\s+/g, '-')}`;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0] && !isUploading) {
      const file = e.dataTransfer.files[0];
      validateAndUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && !isUploading) {
      const file = e.target.files[0];
      validateAndUpload(file);
    }
  };

  const validateAndUpload = (file: File) => {
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      alert(`El archivo es demasiado grande. Tamaño máximo: ${maxSize / 1024 / 1024}MB`);
      return;
    }

    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/avi', 'video/mov'];
    if (!allowedTypes.includes(file.type)) {
      alert('Solo se aceptan archivos de video (MP4, MOV, AVI, QuickTime)');
      return;
    }

    onFileChange(file);
  };

  const getProgressColor = () => {
    if (error) return 'bg-red-500';
    if (progress === 100) return 'bg-green-500';
    return 'bg-blue-500';
  };

  const handleLinkSubmit = () => {
    if (!linkValue || !onLinkChange) return;
    if (!linkValue.startsWith('http://') && !linkValue.startsWith('https://')) {
      alert('Por favor ingresa una URL válida que comience con http:// o https://');
      return;
    }
    onLinkChange(linkValue);
    setShowLinkInput(false);
    setLinkValue('');
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
          {label}
        </label>
        {allowLink && !uploadedUrl && !isUploading && (
          <button
            type="button"
            onClick={() => setShowLinkInput(!showLinkInput)}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {showLinkInput ? 'Cancelar' : 'Insertar enlace'}
          </button>
        )}
      </div>

      {showLinkInput && (
        <div className="flex gap-2 mb-4">
          <input
            type="url"
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            placeholder="https://..."
            className="flex-1 border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
          />
          <button
            type="button"
            onClick={handleLinkSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Guardar
          </button>
        </div>
      )}

      {uploadedUrl ? (
        <div className="flex items-center gap-3 p-3 border rounded-md bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <a
              href={uploadedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-green-700 dark:text-green-300 hover:underline font-medium"
            >
              {uploadedUrl.startsWith('http') ? 'Ver video enlazado' : 'Ver video cargado'}
            </a>
            <p className="text-xs text-green-600 dark:text-green-400">
              {uploadedUrl.startsWith('http') ? 'Enlace guardado exitosamente' : 'Video subido exitosamente'}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
            title="Eliminar video"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className={`relative border-2 border-dashed rounded-lg transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : isUploading
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                : error
                ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
            } ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !isUploading && document.getElementById(inputId)?.click()}
          >
            <div className="flex flex-col items-center justify-center p-6">
              {isUploading ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-2"></div>
                  <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Subiendo video...</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {progress.toFixed(1)}% completado
                  </p>
                </div>
              ) : error ? (
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">Error al subir</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Haz clic para intentar nuevamente
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                    Arrastra un video aquí
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">o haz clic para seleccionar</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">MP4, MOV, AVI (máx. 500MB)</p>
                </div>
              )}
            </div>

            <input
              id={inputId}
              type="file"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
              accept={accept}
              style={{ display: 'none' }}
            />
          </div>

          {isUploading && (
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className={`${getProgressColor()} h-2 rounded-full transition-all duration-300`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* =========================
   Ciclo OPR Form
   ========================= */
interface CicloOPRFormProps {
  acompanamiento: AcompanamientoDocenteType;
  cicloToEdit: CicloOPR | null;
  onSave: (data: Omit<CicloOPR, 'id'> | CicloOPR) => Promise<void>;
  onCancel: () => void;
  profesores: string[];
}

const CicloOPRForm: React.FC<CicloOPRFormProps> = ({
  acompanamiento,
  cicloToEdit,
  onSave,
  onCancel,
  profesores,
}) => {
  const [iaImproving, setIaImproving] = useState<boolean>(false);

  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string | null>>({});

  const [basicData, setBasicData] = useState({
    docente: acompanamiento.docente || '',
    curso: acompanamiento.curso || '',
    asignatura: acompanamiento.asignatura || '',
  });

  const initialCicloState: Omit<CicloOPR, 'id'> = useMemo(
    () => ({
      registroN: 1,
      nombreCiclo: '',
      fecha: new Date().toISOString().split('T')[0],
      horaInicio: '',
      horaTermino: '',
      videoObservacionUrl: '',
      detallesObservacion: [
        {
          id: `row_${Date.now()}`,
          minuto: '0-5',
          accionesDocente: '',
          accionesEstudiantes: '',
          actividades: '',
        },
      ],
      retroalimentacion: {
        exito: '',
        foco: '',
        elementosIdentificar: '',
      },
      planificacion: { preparacion: '', objetivo: '', actividad: '', tiempo: '' },
      seguimiento: {
        fecha: '',
        curso: basicData.curso || '',
        profesor: basicData.docente || '',
        firma: '',
      },
      acompanamientoId:
        acompanamiento.id && !acompanamiento.id.startsWith('temp-') ? acompanamiento.id : '',
    }),
    [acompanamiento, basicData]
  );

  const [formData, setFormData] = useState<Omit<CicloOPR, 'id'> | CicloOPR>(
    cicloToEdit || initialCicloState
  );

  // Update form data when cicloToEdit changes
  useEffect(() => {
    if (cicloToEdit) {
      setFormData(cicloToEdit);
      // Update basic data from the cycle if it's a standalone cycle
      if (cicloToEdit.acompanamientoId === '' || !cicloToEdit.acompanamientoId) {
        setBasicData({
          docente: (cicloToEdit as any).docenteInfo || '',
          curso: (cicloToEdit as any).cursoInfo || '',
          asignatura: (cicloToEdit as any).asignaturaInfo || '',
        });
      }
    } else {
      setFormData(initialCicloState);
    }
  }, [cicloToEdit, initialCicloState]);

  const handleFieldChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const keys = name.split('.');

    if (keys.length > 1) {
      setFormData((prev) => {
        const newState = JSON.parse(JSON.stringify(prev));
        let current: any = newState;
        for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
        current[keys[keys.length - 1]] = value;
        return newState;
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleDetalleChange = (id: string, field: keyof DetalleObservacionRow, value: string) => {
    setFormData((prev) => ({
      ...prev,
      detallesObservacion: prev.detallesObservacion.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      ),
    }));
  };

  const addDetalleRow = () => {
    const lastRow = formData.detallesObservacion[formData.detallesObservacion.length - 1];
    const lastMin = lastRow ? parseInt(lastRow.minuto.split('-')[1], 10) || 0 : 0;
    const newMinuto = `${lastMin + 1}-${lastMin + 5}`;
    setFormData((prev) => ({
      ...prev,
      detallesObservacion: [
        ...prev.detallesObservacion,
        {
          id: `row_${Date.now()}`,
          minuto: newMinuto,
          accionesDocente: '',
          accionesEstudiantes: '',
          actividades: '',
        },
      ],
    }));
  };

  const removeDetalleRow = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      detallesObservacion: prev.detallesObservacion.filter((row) => row.id !== id),
    }));
  };

  // Subida con progreso y manejo de errores
  const handleFileUploadImproved = async (fieldName: string, file: File) => {
    setUploadErrors((prev) => ({ ...prev, [fieldName]: null }));
    setUploading((prev) => ({ ...prev, [fieldName]: true }));
    setUploadProgress((prev) => ({ ...prev, [fieldName]: 0 }));

    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      const acompId =
        acompanamiento.id && !acompanamiento.id.startsWith('temp-')
          ? acompanamiento.id.replace(/[^a-zA-Z0-9-]/g, '_')
          : 'general';

      const cicloId = (formData as CicloOPR).id
        ? (formData as CicloOPR).id.replace(/[^a-zA-Z0-9-]/g, '_')
        : 'temp';

      const cleanPath = `videos_opr/${acompId}/${cicloId}/${timestamp}_${sanitizedFileName}`;

      const url = await uploadFile(file, cleanPath, (progress: number) => {
        setUploadProgress((prev) => ({ ...prev, [fieldName]: progress }));
      });

      handleUrlUpdate(fieldName, url);
      setUploadProgress((prev) => ({ ...prev, [fieldName]: 100 }));
    } catch (error: any) {
      const msg = error?.message || 'Error desconocido al subir el archivo';
      setUploadErrors((prev) => ({ ...prev, [fieldName]: msg }));
      alert(`Error al subir el video: ${msg}`);
    } finally {
      setUploading((prev) => ({ ...prev, [fieldName]: false }));
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, [fieldName]: 0 }));
      }, 2000);
    }
  };

  const handleUrlUpdate = (fieldName: string, url: string) => {
    const keys = fieldName.split('.');
    if (keys.length > 1) {
      setFormData((prev) => {
        const newState = JSON.parse(JSON.stringify(prev));
        let current: any = newState;
        for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
        current[keys[keys.length - 1]] = url;
        return newState;
      });
    } else {
      setFormData((prev) => ({ ...prev, [fieldName]: url }));
    }
  };

  const handleFileRemove = (fieldName: string) => {
    const keys = fieldName.split('.');
    if (keys.length > 1) {
      setFormData((prev) => {
        const newState = JSON.parse(JSON.stringify(prev));
        let current: any = newState;
        for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
        current[keys[keys.length - 1]] = '';
        return newState;
      });
    } else {
      setFormData((prev) => ({ ...prev, [fieldName]: '' }));
    }
    setUploadErrors((prev) => ({ ...prev, [fieldName]: null }));
    setUploadProgress((prev) => ({ ...prev, [fieldName]: 0 }));
  };

  const improveText = async (model: any, label: string, text: string): Promise<string> => {
    if (!text || !text.trim()) return text;
    const prompt = `Mejora la redacción del siguiente texto con un tono técnico-pedagógico propio de informes educativos. Mantén el sentido original y NO agregues información nueva ni ejemplos inventados. Devuélvelo como un texto breve, claro y directo. Texto (${label}):\n\n"""${text}"""`;
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error(`Error improving text for ${label}:`, error);
      return text;
    }
  };

  const handleImproveOPRText = async () => {
    setIaImproving(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        alert('La API Key de Gemini no está configurada.');
        return;
      }
      // No necesitamos registrar este log por ahora
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

      const retro = formData.retroalimentacion;
      const plan = formData.planificacion;

      const results = await Promise.all([
        improveText(model, 'Éxito', retro.exito),
        improveText(model, 'Modelo', retro.modelo),
        improveText(model, 'Foco', retro.foco),
        improveText(model, 'Elementos a identificar', retro.elementosIdentificar),
        improveText(model, 'Brecha - Preguntas', retro.brecha?.preguntas || ''),
        improveText(model, 'Brecha - Indicadores', retro.brecha?.indicadores || ''),
        improveText(model, 'Planificación - Preparación', plan.preparacion),
        improveText(model, 'Planificación - Objetivo', plan.objetivo),
        improveText(model, 'Planificación - Actividad', plan.actividad),
        improveText(model, 'Planificación - Tiempo', plan.tiempo),
      ]);

      setFormData((prev) => ({
        ...prev,
        retroalimentacion: {
          ...prev.retroalimentacion,
          exito: results[0],
          modelo: results[1],
          foco: results[2],
          elementosIdentificar: results[3],
          brecha: { ...prev.retroalimentacion.brecha, preguntas: results[4], indicadores: results[5] },
        },
        planificacion: {
          ...prev.planificacion,
          preparacion: results[6],
          objetivo: results[7],
          actividad: results[8],
          tiempo: results[9],
        },
      }));
      alert('Textos mejorados exitosamente con IA');
    } catch (e) {
      console.error(e);
      alert('No se pudo mejorar la redacción. Intenta nuevamente.');
    } finally {
      setIaImproving(false);
    }
  };

  const generateOPRPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let yPosition = 20;

    const addSectionTitle = (title: string) => {
      if (yPosition > 260) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, yPosition);
      yPosition += 10;
    };

    const addText = (text: string, label = '') => {
      if (!text) return;
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, yPosition);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(text, contentWidth - (label ? 15 : 0));
      doc.text(lines, margin + (label ? 15 : 0), yPosition);
      yPosition += lines.length * 5 + 4;
    };

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Informe de Ciclo OPR', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    addSectionTitle('1. Datos Generales');
    const infoData = [
      ['Docente:', basicData.docente],
      ['Curso:', basicData.curso],
      ['Asignatura:', basicData.asignatura],
      ['Fecha:', new Date(formData.fecha).toLocaleDateString('es-CL')],
      ['Hora:', `${formData.horaInicio} - ${formData.horaTermino}`],
      ['Ciclo:', formData.nombreCiclo],
    ];
    autoTable(doc, {
      body: infoData,
      startY: yPosition,
      theme: 'plain',
      styles: { fontSize: 10 },
      columnStyles: { 0: { fontStyle: 'bold' } },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;

    addSectionTitle('2. Registro Detallado de Observación');
    const tableData = formData.detallesObservacion.map((d) => [
      d.minuto,
      d.accionesDocente,
      d.accionesEstudiantes,
      d.actividades,
    ]);
    autoTable(doc, {
      head: [['Minuto', 'Acciones del Docente', 'Acciones de Estudiantes', 'Actividades']],
      body: tableData,
      startY: yPosition,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      didDrawPage: (data) => {
        yPosition = data.cursor?.y || 20;
      },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;

    addSectionTitle('3. Retroalimentación Docente');
    addText(formData.retroalimentacion.exito, 'Éxito:');
    addText(formData.retroalimentacion.modelo, 'Modelo:');
    addText(formData.retroalimentacion.foco, 'Foco:');
    addText(formData.retroalimentacion.elementosIdentificar, 'Elementos a Identificar:');

    yPosition += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Análisis de Brecha', margin, yPosition);
    yPosition += 7;
    addText(
      `${formData.retroalimentacion.brecha.minutoInicial} a ${formData.retroalimentacion.brecha.minutoFinal}`,
      'Minutos:'
    );
    addText(formData.retroalimentacion.brecha.preguntas, 'Preguntas:');
    addText(formData.retroalimentacion.brecha.indicadores, 'Indicadores:');

    addSectionTitle('4. Planificación de Práctica');
    addText(formData.planificacion.preparacion, 'Preparación:');
    addText(formData.planificacion.objetivo, 'Objetivo:');
    addText(formData.planificacion.actividad, 'Actividad:');
    addText(formData.planificacion.tiempo, 'Tiempo:');

    addSectionTitle('5. Seguimiento');
    addText(new Date(formData.seguimiento.fecha).toLocaleDateString('es-CL'), 'Fecha:');
    addText(formData.seguimiento.firma, 'Firma (Registrado por):');

    doc.save(`Informe_OPR_${basicData.docente}_${formData.fecha}.pdf`);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!basicData.docente || !basicData.curso || !basicData.asignatura) {
      alert('Por favor, complete Docente, Curso y Asignatura');
      return;
    }
    if (!formData.nombreCiclo || !formData.fecha) {
      alert('Por favor, complete el nombre del ciclo y la fecha');
      return;
    }

    const finalFormData = {
      ...formData,
      docenteInfo: basicData.docente,
      cursoInfo: basicData.curso,
      asignaturaInfo: basicData.asignatura,
      seguimiento: {
        ...formData.seguimiento,
        profesor: basicData.docente,
        curso: basicData.curso,
      },
    };

    try {
      await onSave(finalFormData);
    } catch (error) {
      console.error('Error al guardar ciclo OPR:', error);
      alert('Error al guardar el ciclo OPR. Intenta nuevamente.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg animate-fade-in">
      {(!acompanamiento.id || acompanamiento.id.startsWith('temp-')) && (
        <div className="mb-6 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/30">
          <h4 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-300">
            Datos Básicos del Ciclo OPR
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Docente
              </label>
              <select
                value={basicData.docente}
                onChange={(e) => setBasicData((prev) => ({ ...prev, docente: e.target.value }))}
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                required
              >
                <option value="">Seleccione un curso</option>
                {CURSOS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Asignatura
              </label>
              <select
                value={basicData.asignatura}
                onChange={(e) => setBasicData((prev) => ({ ...prev, asignatura: e.target.value }))}
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                required
              >
                <option value="">Seleccione una asignatura</option>
                {ASIGNATURAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/30">
        <h4 className="text-lg font-semibold mb-2 text-blue-700 dark:text-blue-300">
          Asistente IA del Ciclo OPR
        </h4>
        <div className="flex flex-wrap gap-4 items-center">
          <button
            type="button"
            onClick={handleImproveOPRText}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
            disabled={iaImproving}
          >
            <Pencil className="w-4 h-4" />
            {iaImproving ? 'Mejorando redacción...' : 'Mejorar Redacción del Ciclo'}
          </button>
          <button
            type="button"
            onClick={generateOPRPDF}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar Informe PDF
          </button>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
          Usa la IA para mejorar la redacción de los textos ya escritos. Luego, descarga el informe
          completo en PDF.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
          {cicloToEdit ? 'Editando' : 'Nuevo'} Ciclo OPR
        </h3>

        <fieldset className="shadow-md rounded-lg p-4 border dark:border-slate-700 space-y-4">
          <legend className="flex items-center gap-2 text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">
            <Video className="w-5 h-5 text-amber-500" /> Datos Generales
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              name="nombreCiclo"
              value={formData.nombreCiclo}
              onChange={handleFieldChange}
              placeholder="Nombre o N° del Ciclo"
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
              required
            />
            <input
              type="date"
              name="fecha"
              value={formData.fecha}
              onChange={handleFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
              required
            />
            <input
              type="number"
              name="registroN"
              value={formData.registroN}
              onChange={handleFieldChange}
              placeholder="Registro de Observación N°"
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
              min={1}
            />
            <input
              type="time"
              name="horaInicio"
              value={formData.horaInicio}
              onChange={handleFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            />
            <input
              type="time"
              name="horaTermino"
              value={formData.horaTermino}
              onChange={handleFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            />
          </div>

          {/* Video Observación */}
          <FileUpload
            label="Video de observación de clase"
            onFileChange={(file) => handleFileUploadImproved('videoObservacionUrl', file)}
            onLinkChange={(url) => handleUrlUpdate('videoObservacionUrl', url)}
            uploadedUrl={formData.videoObservacionUrl}
            onRemove={() => handleFileRemove('videoObservacionUrl')}
            isUploading={!!uploading['videoObservacionUrl']}
            error={uploadErrors['videoObservacionUrl']}
            progress={uploadProgress['videoObservacionUrl'] || 0}
            allowLink={true}
          />
        </fieldset>

        <fieldset className="shadow-md rounded-lg p-4 border dark:border-slate-700 space-y-4">
          <legend className="flex items-center gap-2 text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">
            <ClipboardList className="w-5 h-5 text-blue-500" /> Registro Detallado de Observación
          </legend>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b dark:border-slate-600">
                  <th className="text-left p-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    Minuto
                  </th>
                  <th className="text-left p-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    Acciones del Docente
                  </th>
                  <th className="text-left p-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    Acciones de Estudiantes
                  </th>
                  <th className="text-left p-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    Actividades
                  </th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {formData.detallesObservacion.map((row) => (
                  <tr key={row.id} className="border-b dark:border-slate-700">
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.minuto}
                        onChange={(e) => handleDetalleChange(row.id, 'minuto', e.target.value)}
                        className="w-24 border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 text-sm"
                        placeholder="0-5"
                      />
                    </td>
                    <td className="p-2">
                      <textarea
                        value={row.accionesDocente}
                        onChange={(e) =>
                          handleDetalleChange(row.id, 'accionesDocente', e.target.value)
                        }
                        rows={2}
                        className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 text-sm"
                        placeholder="Describir acciones del docente..."
                      />
                    </td>
                    <td className="p-2">
                      <textarea
                        value={row.accionesEstudiantes}
                        onChange={(e) =>
                          handleDetalleChange(row.id, 'accionesEstudiantes', e.target.value)
                        }
                        rows={2}
                        className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 text-sm"
                        placeholder="Describir acciones de estudiantes..."
                      />
                    </td>
                    <td className="p-2">
                      <textarea
                        value={row.actividades}
                        onChange={(e) => handleDetalleChange(row.id, 'actividades', e.target.value)}
                        rows={2}
                        className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 text-sm"
                        placeholder="Describir actividades realizadas..."
                      />
                    </td>
                    <td className="p-2">
                      {formData.detallesObservacion.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDetalleRow(row.id)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={addDetalleRow}
            className="text-sm bg-slate-200 dark:bg-slate-600 px-3 py-2 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500 flex items-center gap-1 transition-colors"
          >
            <PlusSquare className="w-4 h-4" /> Agregar Fila
          </button>
        </fieldset>

        <fieldset className="shadow-md rounded-lg p-4 border dark:border-slate-700 space-y-4">
          <legend className="flex items-center gap-2 text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">
            <MessageSquare className="w-5 h-5 text-green-600" /> Retroalimentación Docente
          </legend>

          {/* Campos de texto */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Éxito
              </label>
              <textarea
                name="retroalimentacion.exito"
                value={formData.retroalimentacion.exito}
                onChange={handleFieldChange}
                placeholder="Describir los aspectos exitosos observados en la clase..."
                rows={3}
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Modelo
              </label>
              <textarea
                name="retroalimentacion.modelo"
                value={formData.retroalimentacion.modelo}
                onChange={handleFieldChange}
                placeholder="Modelo pedagógico o metodología observada..."
                rows={3}
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>



            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Foco
              </label>
              <textarea
                name="retroalimentacion.foco"
                value={formData.retroalimentacion.foco}
                onChange={handleFieldChange}
                placeholder="Foco principal de la observación y retroalimentación..."
                rows={3}
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Elementos a Identificar
              </label>
              <textarea
                name="retroalimentacion.elementosIdentificar"
                value={formData.retroalimentacion.elementosIdentificar}
                onChange={handleFieldChange}
                placeholder="Elementos específicos que el docente debe identificar..."
                rows={3}
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
          </div>


        </fieldset>

        <fieldset className="shadow-md rounded-lg p-4 border dark:border-slate-700 space-y-4">
          <legend className="flex items-center gap-2 text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">
            <CalendarCheck className="w-5 h-5 text-purple-600" /> Planificación de Práctica y
            Seguimiento
          </legend>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Preparación
              </label>
              <textarea
                name="planificacion.preparacion"
                value={formData.planificacion.preparacion}
                onChange={handleFieldChange}
                placeholder="Aspectos de preparación para la próxima práctica..."
                rows={3}
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Objetivo
              </label>
              <textarea
                name="planificacion.objetivo"
                value={formData.planificacion.objetivo}
                onChange={handleFieldChange}
                placeholder="Objetivo específico para la siguiente observación..."
                rows={3}
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Actividad
              </label>
              <textarea
                name="planificacion.actividad"
                value={formData.planificacion.actividad}
                onChange={handleFieldChange}
                placeholder="Actividades específicas a implementar..."
                rows={3}
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tiempo
              </label>
              <input
                type="text"
                name="planificacion.tiempo"
                value={formData.planificacion.tiempo}
                onChange={handleFieldChange}
                placeholder="Tiempo estimado o cronograma..."
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
          </div>

          <div className="p-4 border rounded-md dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <h4 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              Seguimiento
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Fecha de seguimiento
                </label>
                <input
                  type="date"
                  name="seguimiento.fecha"
                  value={formData.seguimiento.fecha}
                  onChange={handleFieldChange}
                  className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Registrado por
                </label>
                <input
                  type="text"
                  name="seguimiento.firma"
                  value={formData.seguimiento.firma}
                  onChange={handleFieldChange}
                  placeholder="Nombre de quien registra el seguimiento..."
                  className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
                />
              </div>
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end gap-4 mt-8 pt-6 border-t dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-amber-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-600 disabled:bg-amber-400 transition-colors flex items-center gap-2"
            disabled={Object.values(uploading).some(Boolean)}
          >
            {Object.values(uploading).some(Boolean) && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            Guardar Ciclo OPR
          </button>
        </div>
      </form>
    </div>
  );
};

/* =========================
   Componente Principal
   ========================= */
const AcompanamientoDocente: React.FC = () => {
  const [acompanamientos, setAcompanamientos] = useState<AcompanamientoDocenteType[]>([]);
  const [profesores, setProfesores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfesores, setLoadingProfesores] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCicloOPR, setEditingCicloOPR] = useState<CicloOPR | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'opr'>('general');
  const [iaLoadingGeneral, setIaLoadingGeneral] = useState<boolean>(false);

  // Estados para los ciclos OPR
  const [ciclosOPR, setCiclosOPR] = useState<{ [acompanamientoId: string]: CicloOPR[] }>({});
  const [standaloneCiclos, setStandaloneCiclos] = useState<CicloOPR[]>([]);

  const rubrica = defaultRubric;

  const initialFormState: Omit<AcompanamientoDocenteType, 'id'> = useMemo(
    () => ({
      fecha: new Date().toISOString().split('T')[0],
      docente: '',
      curso: '',
      asignatura: '',
      bloques: '',
      rubricaResultados: {},
      observacionesGenerales: '',
      retroalimentacionConsolidada: '',
    }),
    []
  );

  const [formData, setFormData] = useState<AcompanamientoDocenteType | Omit<AcompanamientoDocenteType, 'id'>>(
    initialFormState
  );

  const fetchAcompanamientos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const acompanamientosFS = await getAllAcompanamientos();
      setAcompanamientos(acompanamientosFS);
    } catch (e: any) {
      setError('No se pudieron cargar los registros de acompañamiento.');
      console.error('❌ Error al cargar acompañamientos:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProfesores = useCallback(async () => {
    setLoadingProfesores(true);
    try {
      const allUsers = await getAllUsers();
      const teacherNames = allUsers
        .filter((user: any) => user.profile === 'PROFESORADO')
        .map((user: any) => user.nombreCompleto)
        .sort();
      setProfesores(teacherNames);
    } catch (e: any) {
      setError('No se pudo cargar la lista de profesores.');
      console.error('❌ Error al cargar profesores:', e);
    } finally {
      setLoadingProfesores(false);
    }
  }, []);

  // Función para cargar todos los ciclos OPR
  const fetchAllCiclosOPR = useCallback(async () => {
    try {
      const ciclosMap: { [acompanamientoId: string]: CicloOPR[] } = {};
      
      // Get cycles for each accompaniment
      for (const acomp of acompanamientos) {
        if (acomp.id) {
          try {
            const ciclos = await getCiclosOPRByAcompanamiento(acomp.id);
            if (ciclos.length > 0) {
              ciclosMap[acomp.id] = ciclos;
            }
          } catch (error) {
            console.error(`Error loading OPR cycles for ${acomp.id}:`, error);
          }
        }
      }
      
      // Get standalone OPR cycles
      try {
        const standalone = await getStandaloneCiclosOPR();
        setStandaloneCiclos(standalone);
      } catch (error) {
        console.error('Error loading standalone OPR cycles:', error);
        setStandaloneCiclos([]);
      }
      
      setCiclosOPR(ciclosMap);
    } catch (error) {
      console.error('Error fetching OPR cycles:', error);
    }
  }, [acompanamientos]);

  useEffect(() => {
    fetchAcompanamientos();
    fetchProfesores();
  }, [fetchAcompanamientos, fetchProfesores]);

  useEffect(() => {
    if (acompanamientos.length > 0) {
      fetchAllCiclosOPR();
    }
  }, [acompanamientos, fetchAllCiclosOPR]);

  // Función para editar ciclos OPR
  const handleEditCicloOPR = (ciclo: CicloOPR, acompanamiento?: AcompanamientoDocenteType) => {
    setEditingCicloOPR(ciclo);
    
    // If there's an associated accompaniment, set it as the current form data
    if (acompanamiento) {
      setFormData(acompanamiento);
      setEditingId(acompanamiento.id);
    } else {
      // For standalone cycles, create a temporary accompaniment with the cycle's data
      const tempAcompanamiento: AcompanamientoDocenteType = {
        id: 'temp-' + Date.now(),
        fecha: ciclo.fecha,
        docente: (ciclo as any).docenteInfo || '',
        curso: (ciclo as any).cursoInfo || '',
        asignatura: (ciclo as any).asignaturaInfo || '',
        rubricaResultados: {},
        planificacionFutura: '',
        createdAt: new Date().toISOString(),
        observacionesGenerales: '',
        retroalimentacionConsolidada: '',
      };
      setFormData(tempAcompanamiento);
      setEditingId(null);
    }
    
    setView('form');
    setActiveTab('opr');
    setError(null);
  };

  const handleGenerateFeedback = async () => {
    if (!('docente' in formData) || !formData.docente) {
      alert('Por favor, complete al menos el campo "Docente" antes de generar la retroalimentación.');
      return;
    }
    setIaLoadingGeneral(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API Key de Gemini no configurada.');

      // No necesitamos registrar este log por ahora
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const rubricaTexto = Object.entries(formData.rubricaResultados || {})
        .map(([criterio, nivel]) => `- ${criterio}: Nivel ${nivel}`)
        .join('\n');
      const prompt = `
Eres un asesor pedagógico experto. Redacta una retroalimentación consolidada y constructiva para un docente.
Contexto de la observación:
- Docente: ${formData.docente}
- Asignatura: ${formData.asignatura}
- Curso: ${formData.curso}
- Resultados de la pauta de observación (rúbrica):
${rubricaTexto || 'No se completó la pauta.'}
- Observaciones adicionales del evaluador:
${formData.observacionesGenerales || 'Sin observaciones adicionales.'}

Basado en esta información, tu texto debe:
1. Iniciar con un reconocimiento positivo.
2. Mencionar 1 o 2 fortalezas clave observadas.
3. Identificar 1 o 2 áreas de mejora concretas, con un tono de sugerencia.
4. Concluir con una frase motivadora.
La respuesta debe ser solo el texto de la retroalimentación.
      `;
      const result = await model.generateContent(prompt);
      const feedbackText = result.response.text();

      setFormData((prev: any) => ({ ...prev, retroalimentacionConsolidada: feedbackText }));
      alert('Retroalimentación generada exitosamente con IA.');
    } catch (error: any) {
      console.error('❌ Error al generar retroalimentación:', error);
      const errorMessage = error.message || 'No se pudo generar la retroalimentación automática.';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
    } finally {
      setIaLoadingGeneral(false);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!('docente' in formData) || !formData.docente || !formData.curso || !formData.asignatura) {
      alert('Docente, curso y asignatura son campos obligatorios.');
      return;
    }

    setError(null);

    try {
      if (editingId) {
        await updateAcompanamiento(editingId, formData);
        alert('¡Acompañamiento actualizado correctamente!');
      } else {
        const newRecord = await createAcompanamiento(formData);
        setEditingId(newRecord.id);
        setFormData(newRecord);
        alert('¡Acompañamiento guardado correctamente! Ahora puedes agregar Ciclos OPR.');
      }
      await fetchAcompanamientos();
    } catch (err: any) {
      const errorMessage = err?.message ?? 'Error al guardar el registro de acompañamiento.';
      setError(errorMessage);
      console.error('❌ Error al guardar:', err);
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleCreateNew = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setEditingCicloOPR(null);
    setView('form');
    setActiveTab('general');
    setError(null);
  };

  const handleEdit = (record: AcompanamientoDocenteType) => {
    setFormData(record);
    setEditingId(record.id);
    setEditingCicloOPR(null);
    setView('form');
    setActiveTab('general');
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este registro? Esta acción no se puede deshacer.')) {
      try {
        await deleteAcompanamiento(id);
        await fetchAcompanamientos();
        alert('Registro eliminado exitosamente.');
      } catch (err: any) {
        const errorMessage = 'No se pudo eliminar el registro.';
        setError(errorMessage);
        console.error('❌ Error al eliminar:', err);
        alert(`Error: ${errorMessage}`);
      }
    }
  };

  const handleRubricSelect = (criterionName: string, level: number) => {
    setFormData((prev: any) => ({
      ...prev,
      rubricaResultados: { ...(prev.rubricaResultados || {}), [criterionName]: level },
    }));
  };

  const handleGeneratePDF = () => {
    if (!('docente' in formData) || !formData.docente) {
      alert('Por favor, complete al menos el campo "Docente" antes de generar el PDF.');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20; // Margen de 20mm
      const contentWidth = pageWidth - (margin * 2);

      // Función helper para verificar si hay espacio suficiente
      const needsNewPage = (heightNeeded: number, currentY: number) => {
        return (currentY + heightNeeded) > (pageHeight - margin);
      };

      // Función helper para agregar número de página
      const addPageNumber = () => {
        const pages = doc.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
          doc.setPage(i);
          doc.setFontSize(9);
          doc.setTextColor(128);
          doc.text(
            `pág. ${i} de ${pages}`,
            pageWidth - margin,
            pageHeight - 10,
            { align: 'right' }
          );
        }
      };

      // PÁGINA 1: Datos y Tabla
      let currentY = margin;

      // Título del documento
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORME DE ACOMPAÑAMIENTO DOCENTE', pageWidth/2, currentY, { align: 'center' });
      currentY += 15;

      // Encabezado con datos del docente
      const infoTableHeight = 40;
      autoTable(doc, {
        startY: currentY,
        head: [],
        body: [
          ['Docente:', (formData as any).docente],
          ['Curso:', (formData as any).curso],
          ['Asignatura:', (formData as any).asignatura],
          ['Fecha:', new Date((formData as any).fecha).toLocaleDateString('es-CL')],
          ['Bloques:', (formData as any).bloques || 'No especificado'],
        ],
        theme: 'plain',
        styles: {
          fontSize: 11,
          cellPadding: 4,
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 30 },
          1: { cellWidth: 120 }
        },
        margin: { left: margin, right: margin },
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;

      // Tabla de indicadores
      if (Object.keys((formData as any).rubricaResultados || {}).length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Evaluación por Indicadores', margin, currentY);
        currentY += 10;

        const rubricData = Object.entries((formData as any).rubricaResultados).map(([criterio, nivel]) => {
          let nivelTexto;
          switch(nivel) {
            case 1: nivelTexto = 'Débil'; break;
            case 2: nivelTexto = 'Incipiente'; break;
            case 3: nivelTexto = 'Satisfactorio'; break;
            case 4: nivelTexto = 'Avanzado'; break;
            default: nivelTexto = 'No evaluado';
          }
          return [criterio, nivelTexto, nivel];
        });

        autoTable(doc, {
          startY: currentY,
          head: [['Indicador', 'Nivel de Logro', 'Puntuación']],
          body: rubricData,
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 6,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            valign: 'middle'
          },
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontSize: 11,
            fontStyle: 'bold',
            halign: 'left'
          },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 40 },
            2: { cellWidth: 30, halign: 'center' }
          },
          alternateRowStyles: {
            fillColor: [245, 247, 250]
          },
          margin: { left: margin, right: margin }
        });
      }

      // PÁGINA 2: Observaciones y Sugerencias
      doc.addPage();
      currentY = margin;

      // Título de la sección
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Observaciones Generales y Sugerencias de Mejora', margin, currentY);
      currentY += 15;

      // Fortalezas
      if ((formData as any).observacionesGenerales) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Fortalezas:', margin, currentY);
        currentY += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const obsLines = doc.splitTextToSize(
          (formData as any).observacionesGenerales,
          contentWidth
        );
        obsLines.forEach((line: string) => {
          if (needsNewPage(7, currentY)) {
            doc.addPage();
            currentY = margin;
          }
          doc.text(line, margin, currentY, { align: 'justify' });
          currentY += 7; // Espaciado 1.3 para 11pt
        });
        currentY += 10;
      }

      // Sugerencias de mejora
      if ((formData as any).retroalimentacionConsolidada) {
        if (needsNewPage(50, currentY)) {
          doc.addPage();
          currentY = margin;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Sugerencias de mejora:', margin, currentY);
        currentY += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const retroLines = doc.splitTextToSize(
          (formData as any).retroalimentacionConsolidada,
          contentWidth
        );
        retroLines.forEach((line: string) => {
          if (needsNewPage(7, currentY)) {
            doc.addPage();
            currentY = margin;
          }
          doc.text(line, margin, currentY, { align: 'justify' });
          currentY += 7; // Espaciado 1.3 para 11pt
        });
      }

      // Agregar números de página
      addPageNumber();

      // Guardar el PDF
      const fileName = `Informe_Acompanamiento_${(formData as any).docente?.replace(/\s+/g, '_')}_${
        (formData as any).curso
      }_${new Date().toISOString().split('T')[0]}.pdf`;
      
      doc.save(fileName);

    } catch (error) {
      console.error('❌ Error al generar PDF:', error);
      alert('Error al generar el PDF. Intenta nuevamente.');
    }
  };

  const handleFieldChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const renderListView = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
          Módulo de Acompañamiento Docente
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              handleCreateNew();
              setActiveTab('general');
            }}
            className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 flex items-center gap-2 transition-colors"
          >
            <PlusSquare className="w-5 h-5" /> Acompañamiento General
          </button>
          <button
            onClick={() => {
              setFormData(initialFormState);
              setEditingId(null);
              setEditingCicloOPR(null);
              setView('form');
              setActiveTab('opr');
              setError(null);
            }}
            className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 flex items-center gap-2 transition-colors"
          >
            <PlusSquare className="w-5 h-5" /> Ciclo OPR Independiente
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* General Accompaniments Section */}
      <div className="mb-8">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4">
          <BarChart3 className="w-6 h-6 text-amber-500" /> Acompañamientos Generales
        </h3>
        <div className="space-y-3">
          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              <span className="ml-3 text-slate-600 dark:text-slate-400">Cargando registros...</span>
            </div>
          )}
          {!loading && acompanamientos.filter((a) => a.id).length > 0 ? (
            <div className="grid gap-3">
              {acompanamientos
                .filter((a) => a.id)
                .map((record) => (
                  <div
                    key={record.id}
                    className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-amber-500" />
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {record.docente}
                          </p>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                          <p>
                            <span className="font-medium">Curso:</span> {record.curso} •{' '}
                            <span className="font-medium">Asignatura:</span> {record.asignatura}
                          </p>
                          <p>
                            <span className="font-medium">Fecha:</span>{' '}
                            {new Date(record.fecha).toLocaleDateString('es-CL')}
                          </p>
                          {record.bloques && (
                            <p>
                              <span className="font-medium">Bloques:</span> {record.bloques}
                            </p>
                          )}
                          {record.retroalimentacionConsolidada && (
                            <p className="text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Con retroalimentación IA
                            </p>
                          )}
                          {/* Show OPR cycles count */}
                          {ciclosOPR[record.id!] && ciclosOPR[record.id!].length > 0 && (
                            <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <Video className="w-3 h-3" />
                              {ciclosOPR[record.id!].length} Ciclo{ciclosOPR[record.id!].length > 1 ? 's' : ''} OPR
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => {
                            handleEdit(record);
                            setActiveTab('general');
                          }}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-semibold text-sm px-3 py-1 rounded border border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        >
                          Ver/Editar
                        </button>
                        <button
                          onClick={() => {
                            handleEdit(record);
                            setActiveTab('opr');
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-sm px-3 py-1 rounded border border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          + Ciclo OPR
                        </button>
                        <button
                          onClick={() => handleDelete(record.id!)}
                          title="Eliminar registro"
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Show OPR cycles for this accompaniment */}
                    {ciclosOPR[record.id!] && ciclosOPR[record.id!].length > 0 && (
                      <div className="mt-4 pt-4 border-t dark:border-slate-600">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                          <Video className="w-4 h-4 text-blue-500" />
                          Ciclos OPR Asociados
                        </h4>
                        <div className="space-y-2">
                          {ciclosOPR[record.id!].map((ciclo) => (
                            <div
                              key={ciclo.id}
                              className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                                  {ciclo.nombreCiclo || `Registro N° ${ciclo.registroN}`}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  {new Date(ciclo.fecha).toLocaleDateString('es-CL')} 
                                  {ciclo.horaInicio && ciclo.horaTermino && (
                                    <span> • {ciclo.horaInicio} - {ciclo.horaTermino}</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    const acompanamiento = acompanamientos.find(a => a.id === record.id);
                                    handleEditCicloOPR(ciclo, acompanamiento);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded border border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={async () => {
                                    if (window.confirm('¿Seguro que desea eliminar este Ciclo OPR?')) {
                                      try {
                                        await deleteCicloOPR(ciclo.id!);
                                        await fetchAllCiclosOPR(); // Refresh the list
                                        alert('Ciclo OPR eliminado exitosamente');
                                      } catch (error) {
                                        console.error('Error deleting OPR cycle:', error);
                                        alert('Error al eliminar el ciclo OPR');
                                      }
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-800 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                  title="Eliminar ciclo OPR"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            !loading && (
              <div className="text-center p-12 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
                  No hay acompañamientos generales registrados
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">
                  Crea tu primer acompañamiento usando el botón superior
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Standalone OPR Cycles Section */}
      {standaloneCiclos.length > 0 && (
        <div className="mb-8">
          <h3 className="flex items-center gap-2 text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4">
            <Video className="w-6 h-6 text-blue-500" /> Ciclos OPR Independientes
          </h3>
          <div className="space-y-3">
            {standaloneCiclos.map((ciclo) => (
              <div
                key={ciclo.id}
                className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="w-4 h-4 text-blue-500" />
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {ciclo.nombreCiclo || `Registro N° ${ciclo.registroN}`}
                      </p>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                      <p>
                        <span className="font-medium">Docente:</span> {(ciclo as any).docenteInfo || 'No especificado'} •{' '}
                        <span className="font-medium">Curso:</span> {(ciclo as any).cursoInfo || 'No especificado'}
                      </p>
                      <p>
                        <span className="font-medium">Fecha:</span>{' '}
                        {new Date(ciclo.fecha).toLocaleDateString('es-CL')}
                        {ciclo.horaInicio && ciclo.horaTermino && (
                          <span> • {ciclo.horaInicio} - {ciclo.horaTermino}</span>
                        )}
                      </p>
                      {ciclo.videoObservacionUrl && (
                        <p className="text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Con video de observación
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => {
                        handleEditCicloOPR(ciclo); // No accompaniment for standalone cycles
                      }}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-sm px-3 py-1 rounded border border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      Ver/Editar
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm('¿Seguro que desea eliminar este Ciclo OPR?')) {
                          try {
                            await deleteCicloOPR(ciclo.id!);
                            await fetchAllCiclosOPR(); // Refresh the list
                            alert('Ciclo OPR eliminado exitosamente');
                          } catch (error) {
                            console.error('Error deleting standalone OPR cycle:', error);
                            alert('Error al eliminar el ciclo OPR');
                          }
                        }
                      }}
                      title="Eliminar ciclo OPR"
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderFormView = () => {
    const currentAcompanamiento = editingId
      ? acompanamientos.find((a) => a.id === editingId)
      : null;
    const temporaryAcompanamiento: AcompanamientoDocenteType = {
      id: 'temp-' + Date.now(),
      fecha: new Date().toISOString(),
      docente: 'docente' in formData ? (formData as any).docente || '' : '',
      curso: 'curso' in formData ? (formData as any).curso || '' : '',
      asignatura: 'asignatura' in formData ? (formData as any).asignatura || '' : '',
      planificacionFutura: '',
      createdAt: new Date().toISOString(),

      rubricaResultados: {},
      observacionesGenerales: '',
      retroalimentacionConsolidada: '',
    };

    return (
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            {activeTab === 'general'
              ? editingId
                ? 'Editando Acompañamiento General'
                : 'Nuevo Acompañamiento General'
              : editingCicloOPR
              ? 'Editando Ciclo OPR'
              : 'Nuevo Ciclo OPR'}
          </h2>
          <button
            type="button"
            onClick={() => {
              setView('list');
              setEditingCicloOPR(null);
            }}
            className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            ← Volver al listado
          </button>
        </div>

        <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('general')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'general'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Acompañamiento General
              </span>
            </button>
            <button
              onClick={() => setActiveTab('opr')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'opr'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                Ciclos OPR
              </span>
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </span>
            </button>
          </nav>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            <AcompanamientoDocenteDashboard 
              acompanamientos={acompanamientos}
              ciclosOPR={ciclosOPR}
              standaloneCiclos={standaloneCiclos}
            />
          </div>
        )}

        {activeTab === 'general' && (
          <form onSubmit={handleSave} className="space-y-8">
            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800">
              <h4 className="text-lg font-semibold mb-3 text-green-700 dark:text-green-300 flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Asistente IA - Informe General
              </h4>
              <div className="flex flex-wrap gap-4 items-center">
                <button
                  type="button"
                  onClick={handleGenerateFeedback}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
                  disabled={iaLoadingGeneral}
                >
                  <Pencil className="w-4 h-4" />
                  {iaLoadingGeneral ? 'Generando...' : 'Generar Retroalimentación con IA'}
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePDF}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Crear Informe PDF
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Completa la observación y rúbrica, luego genera automáticamente la retroalimentación.
                Finalmente, crea el informe en PDF.
              </p>

              {'retroalimentacionConsolidada' in formData && (formData as any).retroalimentacionConsolidada && (
                <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-md shadow-sm border">
                  <h5 className="font-semibold text-sm mb-2 text-green-700 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Retroalimentación Consolidada Generada:
                  </h5>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded p-3">
                    <textarea
                      readOnly
                      rows={8}
                      value={(formData as any).retroalimentacionConsolidada}
                      className="w-full text-sm text-slate-700 dark:text-slate-300 bg-transparent border-none p-0 resize-none focus:ring-0"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
              <div>
                <label
                  htmlFor="docente"
                  className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Docente *
                </label>
                <select
                  name="docente"
                  value={'docente' in formData ? (formData as any).docente : ''}
                  onChange={handleFieldChange}
                  required
                  className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                  disabled={loadingProfesores}
                >
                  <option value="">
                    {loadingProfesores ? 'Cargando profesores...' : 'Seleccione un docente'}
                  </option>
                  {profesores.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="curso"
                  className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Curso *
                </label>
                <select
                  name="curso"
                  value={'curso' in formData ? (formData as any).curso : ''}
                  onChange={handleFieldChange}
                  required
                  className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                >
                  <option value="">Seleccione un curso</option>
                  {CURSOS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="asignatura"
                  className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Asignatura *
                </label>
                <select
                  name="asignatura"
                  value={'asignatura' in formData ? (formData as any).asignatura : ''}
                  onChange={handleFieldChange}
                  required
                  className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                >
                  <option value="">Seleccione una asignatura</option>
                  {ASIGNATURAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="bloques"
                  className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Bloques Horarios
                </label>
                <input
                  type="text"
                  name="bloques"
                  value={'bloques' in formData ? (formData as any).bloques : ''}
                  onChange={handleFieldChange}
                  placeholder="Ej: 3-4, 1-2"
                  className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="observacionesGenerales"
                className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2"
              >
                Observaciones Generales
              </label>
              <textarea
                name="observacionesGenerales"
                value={'observacionesGenerales' in formData ? (formData as any).observacionesGenerales : ''}
                onChange={handleFieldChange}
                rows={4}
                placeholder="Ingrese sus observaciones sobre la clase, metodología utilizada, participación de estudiantes, recursos empleados, etc..."
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
              />
            </div>

            {/* Rúbrica */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-500" />
                Pauta de Observación - Rúbrica de Evaluación
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Haga clic en el nivel correspondiente para cada criterio observado durante la clase.
              </p>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-100 dark:bg-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-1/12">
                        Dominio
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-3/12">
                        Criterio
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">
                        Débil (1)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">
                        Incipiente (2)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">
                        Satisfactorio (3)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">
                        Avanzado (4)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {rubrica.map((domain) => (
                      <React.Fragment key={domain.domain}>
                        {domain.criteria.map((criterion, critIndex) => (
                          <tr key={criterion.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            {critIndex === 0 && (
                              <td
                                rowSpan={domain.criteria.length}
                                className="px-4 py-4 align-top text-sm font-semibold text-slate-800 dark:text-slate-200 border-r dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                              >
                                {domain.domain}
                              </td>
                            )}
                            <td className="px-4 py-4 align-top text-sm font-medium text-slate-700 dark:text-slate-300 border-r dark:border-slate-600">
                              {criterion.name}
                            </td>
                            {criterion.levels.map((levelText, levelIndex) => {
                              const level = levelIndex + 1;
                              const isSelected =
                                'rubricaResultados' in formData &&
                                (formData as any).rubricaResultados[criterion.name] === level;
                              const bgColor = isSelected
                                ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
                                : 'hover:bg-amber-50 dark:hover:bg-slate-700';

                              return (
                                <td
                                  key={level}
                                  onClick={() => handleRubricSelect(criterion.name, level)}
                                  className={`px-4 py-4 align-top text-sm text-slate-600 dark:text-slate-300 border-r dark:border-slate-600 cursor-pointer transition-colors ${bgColor} ${
                                    isSelected ? 'ring-1 ring-amber-400' : ''
                                  }`}
                                  title={`Seleccionar nivel ${level} para ${criterion.name}`}
                                >
                                  <div className="text-xs leading-relaxed">
                                    {isSelected && (
                                      <div className="flex items-center gap-1 mb-1">
                                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                                          Seleccionado
                                        </span>
                                      </div>
                                    )}
                                    {levelText}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {Object.keys(((formData as any).rubricaResultados || {})).length > 0 && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h5 className="font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Resumen de Evaluación (
                    {Object.keys((formData as any).rubricaResultados).length} criterios evaluados)
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {Object.entries((formData as any).rubricaResultados).map(
                      ([criterio, nivel]: any) => (
                        <div key={criterio} className="flex justify-between items-center py-1">
                          <span className="text-slate-700 dark:text-slate-300 truncate pr-2">
                            {criterio}:
                          </span>
                          <span
                            className={`font-semibold px-2 py-1 rounded text-xs ${
                              nivel === 1
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                : nivel === 2
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                : nivel === 3
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}
                          >
                            Nivel {nivel}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t dark:border-slate-700">
              <button
                type="button"
                onClick={() => setView('list')}
                className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                disabled={iaLoadingGeneral}
              >
                {iaLoadingGeneral && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {editingId ? 'Actualizar' : 'Guardar'} Acompañamiento
              </button>
            </div>
          </form>
        )}

        {activeTab === 'opr' && (
          <CicloOPRForm
            acompanamiento={currentAcompanamiento || temporaryAcompanamiento}
            cicloToEdit={editingCicloOPR}
            profesores={profesores}
            onSave={async (data) => {
              try {
                const acompId =
                  currentAcompanamiento?.id ||
                  (typeof (data as any).acompanamientoId === 'string' && (data as any).acompanamientoId) ||
                  undefined;

                // If editing an existing cycle
                if (editingCicloOPR && editingCicloOPR.id) {
                  await updateCicloOPR(editingCicloOPR.id, data as Partial<CicloOPR>);
                  alert('Ciclo OPR actualizado exitosamente');
                } else {
                  // Creating a new cycle
                  if (!acompId || String(acompId).startsWith('temp-')) {
                    // For standalone cycles, we can create them without an accompaniment ID
                    const dataToSave = {
                      ...data,
                      acompanamientoId: '', // Empty for standalone cycles
                    };
                    await createCicloOPR(dataToSave as any);
                  } else {
                    const dataToSave = {
                      ...data,
                      acompanamientoId: String(acompId),
                    };
                    await createCicloOPR(dataToSave as any);
                  }
                  alert('Ciclo OPR guardado exitosamente');
                }
                
                // Reset editing state
                setEditingCicloOPR(null);
                
                // Refresh the data
                await fetchAcompanamientos();
                await fetchAllCiclosOPR();
                
                setView('list');
              } catch (error: any) {
                console.error('❌ Error al guardar ciclo OPR:', error);
                const errorMessage = error.message || 'Error desconocido al guardar el ciclo OPR';
                setError(errorMessage);
                alert(`Error al guardar el ciclo OPR: ${errorMessage}`);
              }
            }}
            onCancel={() => {
              setEditingCicloOPR(null);
              setView('list');
            }}
          />
        )}
      </div>
    );
  };

  if (loading || loadingProfesores) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              Cargando módulo de acompañamiento...
            </p>
            <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">
              {loading && 'Cargando registros...'}
              {loadingProfesores && ' Cargando profesores...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {view === 'list' ? renderListView() : renderFormView()}
      </div>
    </div>
  );
};

export default AcompanamientoDocente;
     