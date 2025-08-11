import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent, FC, useRef } from 'react';
import { FileText, Users, Video, ClipboardList, MessageSquare, CalendarCheck, BarChart3, Wrench, Pencil, PlusSquare, Trash2, Download } from 'lucide-react';
import { AcompanamientoDocente as AcompanamientoDocenteType, CicloOPR, DetalleObservacionRow, User } from '../../types';
import { ASIGNATURAS, CURSOS, RUBRICA_ACOMPANAMIENTO_DOCENTE as defaultRubric } from '../../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logApiCall } from '../utils/apiLogger';
// ✅ IA: Se importa la librería de Google AI
import { GoogleGenerativeAI } from '@google/generative-ai';
// Firebase helpers
import {
  getAllAcompanamientos,
  createAcompanamiento,
  updateAcompanamiento,
  deleteAcompanamiento,
  createCicloOPR,
  updateCicloOPR,
  uploadFile,
} from '../../src/firebaseHelpers/acompanamientos';
import { getAllUsers as getAllUsersFromFirebase } from '../../src/firebaseHelpers/users';

const getAllUsers = async (): Promise<any[]> => {
  return await getAllUsersFromFirebase();
};

// =========================
// Reusable FileUpload Component
// =========================
interface FileUploadProps {
  label: string;
  onFileChange: (file: File) => void;
  uploadedUrl?: string;
  onRemove: () => void;
  isUploading: boolean;
  accept?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, onFileChange, uploadedUrl, onRemove, isUploading, accept = 'video/mp4,video/quicktime' }) => {
  const inputId = `file-upload-${label.replace(/\s+/g, '-')}`;
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      {uploadedUrl ? (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700">
          <a href={uploadedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 dark:text-green-300 hover:underline truncate">
            Ver video cargado
          </a>
          <button type="button" onClick={onRemove} className="text-red-500 hover:text-red-700 ml-auto">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            type="file"
            onChange={(e) => e.target.files && onFileChange(e.target.files[0])}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
            disabled={isUploading}
            accept={accept}
          />
          {isUploading && <div className="text-sm text-amber-600">Cargando...</div>}
        </div>
      )}
    </div>
  );
};

// =========================
// Ciclo OPR Form Component
// =========================
interface CicloOPRFormProps {
  acompanamiento: AcompanamientoDocenteType;
  cicloToEdit: CicloOPR | null;
  onSave: (data: Omit<CicloOPR, 'id'> | CicloOPR) => Promise<void>;
  onCancel: () => void;
  profesores: string[];
}

const CicloOPRForm: React.FC<CicloOPRFormProps> = ({ acompanamiento, cicloToEdit, onSave, onCancel, profesores }) => {
  const [iaImproving, setIaImproving] = useState<boolean>(false);
  
  const [basicData, setBasicData] = useState({
    docente: acompanamiento.docente || '',
    curso: acompanamiento.curso || '',
    asignatura: acompanamiento.asignatura || ''
  });

  const initialCicloState: Omit<CicloOPR, 'id'> = useMemo(() => ({
    registroN: 1,
    nombreCiclo: '',
    fecha: new Date().toISOString().split('T')[0],
    horaInicio: '',
    horaTermino: '',
    videoObservacionUrl: '',
    detallesObservacion: [{ id: `row_${Date.now()}`, minuto: '0-5', accionesDocente: '', accionesEstudiantes: '', actividades: '' }],
    retroalimentacion: { exito: '', modelo: '', videoModeloUrl: '', foco: '', elementosIdentificar: '', brecha: { videoUrl: '', minutoInicial: '', minutoFinal: '', preguntas: '', indicadores: '' } },
    planificacion: { preparacion: '', objetivo: '', actividad: '', tiempo: '' },
    seguimiento: { fecha: '', curso: basicData.curso || '', profesor: basicData.docente || '', firma: '' },
    acompanamientoId: (acompanamiento.id && !acompanamiento.id.startsWith('temp-')) ? acompanamiento.id : '',
  }), [acompanamiento, basicData]);

  const [formData, setFormData] = useState<Omit<CicloOPR, 'id'> | CicloOPR>(cicloToEdit || initialCicloState);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
      detallesObservacion: prev.detallesObservacion.map((row) => row.id === id ? { ...row, [field]: value } : row),
    }));
  };

  const addDetalleRow = () => {
    const lastRow = formData.detallesObservacion[formData.detallesObservacion.length - 1];
    const lastMin = lastRow ? parseInt(lastRow.minuto.split('-')[1], 10) || 0 : 0;
    const newMinuto = `${lastMin + 1}-${lastMin + 5}`;
    setFormData((prev) => ({
      ...prev,
      detallesObservacion: [...prev.detallesObservacion, { id: `row_${Date.now()}`, minuto: newMinuto, accionesDocente: '', accionesEstudiantes: '', actividades: '' }],
    }));
  };

  const removeDetalleRow = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      detallesObservacion: prev.detallesObservacion.filter((row) => row.id !== id),
    }));
  };

  const handleFileUpload = async (fieldName: string, file: File) => {
    setUploading((prev) => ({ ...prev, [fieldName]: true }));
    try {
      const uniqueFileName = `${Date.now()}-${file.name}`;
      const acompId = acompanamiento.id || 'independent';
      const cicloId = (formData as CicloOPR).id || 'temp';
      const path = `videos_opr/${acompId}/${cicloId}/${uniqueFileName}`;
      const url = await uploadFile(file, path);
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
    } catch (error) {
      console.error('Error al subir archivo:', error);
      alert('No se pudo subir el archivo. Revise los permisos de Storage.');
    } finally {
      setUploading((prev) => ({ ...prev, [fieldName]: false }));
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
        alert("La API Key de Gemini no está configurada.");
        return;
      }
      await logApiCall('Acompañamiento - Mejorar Ciclo OPR');
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

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
        retroalimentacion: { ...prev.retroalimentacion, exito: results[0], modelo: results[1], foco: results[2], elementosIdentificar: results[3], brecha: { ...prev.retroalimentacion.brecha, preguntas: results[4], indicadores: results[5] } },
        planificacion: { ...prev.planificacion, preparacion: results[6], objetivo: results[7], actividad: results[8], tiempo: results[9] },
      }));
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
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = 20;

    const addSectionTitle = (title: string) => {
      if (yPosition > 260) { doc.addPage(); yPosition = 20; }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, yPosition);
      yPosition += 10;
    };

    const addText = (text: string, label = '') => {
      if (!text) return;
      if (yPosition > 270) { doc.addPage(); yPosition = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, yPosition);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(text, contentWidth - (label ? 15 : 0));
      doc.text(lines, margin + (label ? 15 : 0), yPosition);
      yPosition += (lines.length * 5) + 4;
    };
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Informe de Ciclo OPR', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    addSectionTitle("1. Datos Generales");
    const infoData = [
        ['Docente:', basicData.docente], ['Curso:', basicData.curso], ['Asignatura:', basicData.asignatura],
        ['Fecha:', new Date(formData.fecha).toLocaleDateString('es-CL')],
        ['Hora:', `${formData.horaInicio} - ${formData.horaTermino}`], ['Ciclo:', formData.nombreCiclo],
    ];
    autoTable(doc, {
        body: infoData, startY: yPosition, theme: 'plain', styles: { fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold' } }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;

    addSectionTitle("2. Registro Detallado de Observación");
    const tableData = formData.detallesObservacion.map(d => [d.minuto, d.accionesDocente, d.accionesEstudiantes, d.actividades]);
    autoTable(doc, {
        head: [['Minuto', 'Acciones del Docente', 'Acciones de Estudiantes', 'Actividades']],
        body: tableData, startY: yPosition, theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 2 },
        didDrawPage: (data) => { yPosition = data.cursor?.y || 20; }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;
    
    addSectionTitle("3. Retroalimentación Docente");
    addText(formData.retroalimentacion.exito, 'Éxito:');
    addText(formData.retroalimentacion.modelo, 'Modelo:');
    addText(formData.retroalimentacion.foco, 'Foco:');
    addText(formData.retroalimentacion.elementosIdentificar, 'Elementos a Identificar:');
    
    yPosition += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Análisis de Brecha', margin, yPosition);
    yPosition += 7;
    addText(`${formData.retroalimentacion.brecha.minutoInicial} a ${formData.retroalimentacion.brecha.minutoFinal}`, 'Minutos:');
    addText(formData.retroalimentacion.brecha.preguntas, 'Preguntas:');
    addText(formData.retroalimentacion.brecha.indicadores, 'Indicadores:');

    addSectionTitle("4. Planificación de Práctica");
    addText(formData.planificacion.preparacion, 'Preparación:');
    addText(formData.planificacion.objetivo, 'Objetivo:');
    addText(formData.planificacion.actividad, 'Actividad:');
    addText(formData.planificacion.tiempo, 'Tiempo:');

    addSectionTitle("5. Seguimiento");
    addText(new Date(formData.seguimiento.fecha).toLocaleDateString('es-CL'), 'Fecha:');
    addText(formData.seguimiento.firma, 'Firma (Registrado por):');

    doc.save(`Informe_OPR_${basicData.docente}_${formData.fecha}.pdf`);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const finalFormData = {
        ...formData,
        docenteInfo: basicData.docente,
        cursoInfo: basicData.curso,
        asignaturaInfo: basicData.asignatura,
        seguimiento: {
            ...formData.seguimiento,
            profesor: basicData.docente,
            curso: basicData.curso,
        }
    };
    await onSave(finalFormData);
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg animate-fade-in">
      {(!acompanamiento.id || acompanamiento.id.startsWith('temp-')) && (
        <div className="mb-6 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/30">
          <h4 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-300">Datos Básicos del Ciclo OPR</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Docente</label>
              <select value={basicData.docente} onChange={(e) => setBasicData(prev => ({ ...prev, docente: e.target.value }))} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                <option value="">Seleccione un docente</option>
                {profesores.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Curso</label>
              <select value={basicData.curso} onChange={(e) => setBasicData(prev => ({ ...prev, curso: e.target.value }))} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                <option value="">Seleccione un curso</option>
                {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
              <select value={basicData.asignatura} onChange={(e) => setBasicData(prev => ({ ...prev, asignatura: e.target.value }))} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                <option value="">Seleccione una asignatura</option>
                {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/30">
        <h4 className="text-lg font-semibold mb-2 text-blue-700 dark:text-blue-300">Asistente IA del Ciclo OPR</h4>
        <div className="flex flex-wrap gap-4 items-center">
            <button type="button" onClick={handleImproveOPRText} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2" disabled={iaImproving}>
              <Pencil className="w-4 h-4" />
              {iaImproving ? 'Mejorando redacción...' : 'Mejorar Redacción del Ciclo'}
            </button>
            <button type="button" onClick={generateOPRPDF} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2">
              <Download className="w-4 h-4" />
              Descargar Informe PDF
            </button>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
          Usa la IA para mejorar la redacción de los textos ya escritos. Luego, descarga el informe completo en PDF.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{cicloToEdit ? 'Editando' : 'Nuevo'} Ciclo OPR</h3>
        
        <fieldset className="shadow-md rounded-lg p-4 border dark:border-slate-700 space-y-4">
          <legend className="flex items-center gap-2 text-lg font-semibold px-2 text-slate-700 dark:text-slate-300"><Video className="w-5 h-5 text-amber-500" /> Datos Generales</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <input type="text" name="nombreCiclo" value={formData.nombreCiclo} onChange={handleFieldChange} placeholder="Nombre o N° del Ciclo" className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
             <input type="date" name="fecha" value={formData.fecha} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
             <input type="number" name="registroN" value={formData.registroN} onChange={handleFieldChange} placeholder="Registro de Observación N°" className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
             <input type="time" name="horaInicio" value={formData.horaInicio} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
             <input type="time" name="horaTermino" value={formData.horaTermino} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
          </div>
          <FileUpload label="Subir video de observación de clase" onFileChange={(file) => handleFileUpload('videoObservacionUrl', file)} uploadedUrl={formData.videoObservacionUrl} onRemove={() => handleFileRemove('videoObservacionUrl')} isUploading={!!uploading.videoObservacionUrl} />
        </fieldset>

        <fieldset className="shadow-md rounded-lg p-4 border dark:border-slate-700 space-y-4">
            <legend className="flex items-center gap-2 text-lg font-semibold px-2 text-slate-700 dark:text-slate-300"><ClipboardList className="w-5 h-5 text-blue-500" /> Registro Detallado de Observación</legend>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="border-b dark:border-slate-600">
                            <th className="text-left p-2 text-sm font-medium text-slate-600 dark:text-slate-300">Minuto</th>
                            <th className="text-left p-2 text-sm font-medium text-slate-600 dark:text-slate-300">Acciones del Docente</th>
                            <th className="text-left p-2 text-sm font-medium text-slate-600 dark:text-slate-300">Acciones de Estudiantes</th>
                            <th className="text-left p-2 text-sm font-medium text-slate-600 dark:text-slate-300">Actividades</th>
                            <th className="p-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {formData.detallesObservacion.map((row) => (
                            <tr key={row.id} className="border-b dark:border-slate-700">
                                <td><input type="text" value={row.minuto} onChange={(e) => handleDetalleChange(row.id, 'minuto', e.target.value)} className="w-24 border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" /></td>
                                <td><textarea value={row.accionesDocente} onChange={(e) => handleDetalleChange(row.id, 'accionesDocente', e.target.value)} rows={2} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" /></td>
                                <td><textarea value={row.accionesEstudiantes} onChange={(e) => handleDetalleChange(row.id, 'accionesEstudiantes', e.target.value)} rows={2} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" /></td>
                                <td><textarea value={row.actividades} onChange={(e) => handleDetalleChange(row.id, 'actividades', e.target.value)} rows={2} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" /></td>
                                <td>{formData.detallesObservacion.length > 1 && <button type="button" onClick={() => removeDetalleRow(row.id)} className="text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button type="button" onClick={addDetalleRow} className="text-sm bg-slate-200 dark:bg-slate-600 px-3 py-1 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500 flex items-center gap-1"><PlusSquare className="w-4 h-4" /> Agregar Fila</button>
        </fieldset>

        <fieldset className="shadow-md rounded-lg p-4 border dark:border-slate-700 space-y-4">
            <legend className="flex items-center gap-2 text-lg font-semibold px-2 text-slate-700 dark:text-slate-300"><MessageSquare className="w-5 h-5 text-green-600" /> Retroalimentación Docente</legend>
            <textarea name="retroalimentacion.exito" value={formData.retroalimentacion.exito} onChange={handleFieldChange} placeholder="Éxito" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
            <textarea name="retroalimentacion.modelo" value={formData.retroalimentacion.modelo} onChange={handleFieldChange} placeholder="Modelo" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
            <textarea name="retroalimentacion.foco" value={formData.retroalimentacion.foco} onChange={handleFieldChange} placeholder="Foco" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
            <textarea name="retroalimentacion.elementosIdentificar" value={formData.retroalimentacion.elementosIdentificar} onChange={handleFieldChange} placeholder="Elementos a Identificar" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
            <div className="p-3 border rounded-md dark:border-slate-600 space-y-3">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Brecha</p>
                <div className="flex gap-4">
                    <input type="text" name="retroalimentacion.brecha.minutoInicial" value={formData.retroalimentacion.brecha.minutoInicial} onChange={handleFieldChange} placeholder="Minuto inicial" className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
                    <input type="text" name="retroalimentacion.brecha.minutoFinal" value={formData.retroalimentacion.brecha.minutoFinal} onChange={handleFieldChange} placeholder="Minuto final" className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
                </div>
                <textarea name="retroalimentacion.brecha.preguntas" value={formData.retroalimentacion.brecha.preguntas} onChange={handleFieldChange} placeholder="Preguntas" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
                <textarea name="retroalimentacion.brecha.indicadores" value={formData.retroalimentacion.brecha.indicadores} onChange={handleFieldChange} placeholder="Indicadores" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
            </div>
        </fieldset>

        <fieldset className="shadow-md rounded-lg p-4 border dark:border-slate-700 space-y-4">
            <legend className="flex items-center gap-2 text-lg font-semibold px-2 text-slate-700 dark:text-slate-300"><CalendarCheck className="w-5 h-5 text-purple-600" /> Planificación de Práctica y Seguimiento</legend>
            <textarea name="planificacion.preparacion" value={formData.planificacion.preparacion} onChange={handleFieldChange} placeholder="Preparación" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
            <textarea name="planificacion.objetivo" value={formData.planificacion.objetivo} onChange={handleFieldChange} placeholder="Objetivo" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
            <textarea name="planificacion.actividad" value={formData.planificacion.actividad} onChange={handleFieldChange} placeholder="Actividad" rows={3} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
            <input type="text" name="planificacion.tiempo" value={formData.planificacion.tiempo} onChange={handleFieldChange} placeholder="Tiempo" className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
            <div className="p-3 border rounded-md dark:border-slate-600 space-y-3">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Seguimiento</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="date" name="seguimiento.fecha" value={formData.seguimiento.fecha} onChange={handleFieldChange} className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
                    <input type="text" name="seguimiento.firma" value={formData.seguimiento.firma} onChange={handleFieldChange} placeholder="Firma (Nombre de quien registra)" className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600" />
                </div>
            </div>
        </fieldset>

        <div className="flex justify-end gap-4 mt-8">
          <button type="button" onClick={onCancel} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">
            Cancelar
          </button>
          <button type="submit" className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">
            Guardar Ciclo OPR
          </button>
        </div>
      </form>
    </div>
  );
};

// =========================
// Main Component
// =========================
const AcompanamientoDocente: React.FC = () => {
  const [acompanamientos, setAcompanamientos] = useState<AcompanamientoDocenteType[]>([]);
  const [profesores, setProfesores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfesores, setLoadingProfesores] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'opr'>('general');
  const [iaLoadingGeneral, setIaLoadingGeneral] = useState<boolean>(false);
  
  const rubrica = defaultRubric;

  const initialFormState: Omit<AcompanamientoDocenteType, 'id'> = useMemo(() => ({
    fecha: new Date().toISOString().split('T')[0],
    docente: '',
    curso: '',
    asignatura: '',
    bloques: '',
    rubricaResultados: {},
    observacionesGenerales: '',
    retroalimentacionConsolidada: '',
  }), []);

  const [formData, setFormData] = useState<AcompanamientoDocenteType | Omit<AcompanamientoDocenteType, 'id'>>(initialFormState);

  const fetchAcompanamientos = useCallback(async () => {
    setLoading(true);
    try {
      const acompanamientosFS = await getAllAcompanamientos();
      setAcompanamientos(acompanamientosFS);
    } catch (e) {
      setError('No se pudieron cargar los registros.');
      console.error(e);
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
    } catch (e) {
      setError('No se pudo cargar la lista de profesores.');
      console.error(e);
    } finally {
      setLoadingProfesores(false);
    }
  }, []);

  useEffect(() => {
    fetchAcompanamientos();
    fetchProfesores();
  }, [fetchAcompanamientos, fetchProfesores]);

  const handleGenerateFeedback = async () => {
    if (!('docente' in formData) || !formData.docente) {
        alert('Por favor, complete al menos el campo "Docente" antes de generar la retroalimentación.');
        return;
    }
    setIaLoadingGeneral(true);
    setError(null);

    try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key de Gemini no configurada.");
        
        await logApiCall('Acompañamiento - Feedback General');
        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const rubricaTexto = Object.entries(formData.rubricaResultados || {}).map(([criterio, nivel]) => `- ${criterio}: Nivel ${nivel}`).join('\n');
        const prompt = `
            Eres un asesor pedagógico experto. Redacta una retroalimentación consolidada y constructiva para un docente.
            Contexto de la observación:
            - Docente: ${formData.docente}
            - Asignatura: ${formData.asignatura}
            - Curso: ${formData.curso}
            - Resultados de la pauta de observación (rúbrica):
            ${rubricaTexto || "No se completó la pauta."}
            - Observaciones adicionales del evaluador:
            ${formData.observacionesGenerales || "Sin observaciones adicionales."}

            Basado en esta información, tu texto debe:
            1. Iniciar con un reconocimiento positivo.
            2. Mencionar 1 o 2 fortalezas clave observadas.
            3. Identificar 1 o 2 áreas de mejora concretas, con un tono de sugerencia.
            4. Concluir con una frase motivadora.
            La respuesta debe ser solo el texto de la retroalimentación.
        `;
        
        const result = await model.generateContent(prompt);
        const feedbackText = result.response.text();

        setFormData(prev => ({ ...prev, retroalimentacionConsolidada: feedbackText }));
        alert("Retroalimentación generada con éxito.");

    } catch (error) {
        console.error('Error al generar retroalimentación:', error);
        setError('No se pudo generar la retroalimentación. Revisa la consola para más detalles.');
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
    try {
      if (editingId) {
        await updateAcompanamiento(editingId, formData);
        alert('¡Actualizado correctamente!');
      } else {
        const newRecord = await createAcompanamiento(formData);
        setEditingId(newRecord.id);
        setFormData(newRecord);
        alert('¡Guardado correctamente! Ahora puedes agregar Ciclos OPR.');
      }
      await fetchAcompanamientos();
    } catch (err) {
      setError('Error al guardar el registro.');
      console.error(err);
    }
  };

  const handleCreateNew = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setView('form');
    setActiveTab('general');
    setError(null);
  };

  const handleEdit = (record: AcompanamientoDocenteType) => {
    setFormData(record);
    setEditingId(record.id);
    setView('form');
    setActiveTab('general');
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este registro?')) {
      try {
        await deleteAcompanamiento(id);
        await fetchAcompanamientos();
      } catch (err) {
        setError('No se pudo eliminar el registro.');
        console.error(err);
      }
    }
  };

  const handleRubricSelect = (criterionName: string, level: number) => {
    setFormData((prev) => ({ ...prev, rubricaResultados: { ...prev.rubricaResultados, [criterionName]: level } }));
  };

  const handleGeneratePDF = () => {
    if (!('docente' in formData) || !formData.docente) {
        alert('Por favor, complete al menos el campo "Docente" antes de generar el PDF.');
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME DE ACOMPAÑAMIENTO DOCENTE', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    const infoBasica = [
        ['Docente:', formData.docente], 
        ['Curso:', formData.curso], 
        ['Asignatura:', formData.asignatura], 
        ['Fecha:', new Date(formData.fecha).toLocaleDateString('es-CL')], 
        ['Bloques horarios:', formData.bloques || 'No especificado']
    ];
    autoTable(doc, { body: infoBasica, startY: yPosition, theme: 'plain', styles: { fontSize: 10 }, columnStyles: { 0: { fontStyle: 'bold' } } });
    yPosition = (doc as any).lastAutoTable.finalY + 10;

    if (Object.keys(formData.rubricaResultados || {}).length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('RESULTADOS DE EVALUACIÓN', margin, yPosition);
      yPosition += 8;
      const rubricaData = Object.entries(formData.rubricaResultados).map(([criterio, nivel]) => [criterio, `Nivel ${nivel}`, nivel === 1 ? 'Débil' : nivel === 2 ? 'Incipiente' : nivel === 3 ? 'Satisfactorio' : 'Avanzado']);
      autoTable(doc, { startY: yPosition, head: [['Criterio', 'Nivel', 'Descripción']], body: rubricaData, theme: 'grid', headStyles: { fillColor: [245, 158, 11], textColor: 255 }, margin: { left: margin, right: margin }, styles: { fontSize: 9 } });
      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    const addTitledText = (title: string, text: string | undefined) => {
        if (!text || text.trim() === '') return;
        if (yPosition > 250) { doc.addPage(); yPosition = 20; }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin, yPosition);
        yPosition += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(text, contentWidth);
        doc.text(lines, margin, yPosition);
        yPosition += lines.length * 5 + 10;
    };

    addTitledText('OBSERVACIONES GENERALES', formData.observacionesGenerales);
    addTitledText('RETROALIMENTACIÓN PEDAGÓGICA', formData.retroalimentacionConsolidada);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')} - Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }
    doc.save(`Informe_Acompañamiento_${formData.docente}_${formData.curso}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const renderListView = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Módulo de Acompañamiento Docente</h2>
        <div className="flex gap-2">
          <button onClick={() => { handleCreateNew(); setActiveTab('general'); }} className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 flex items-center gap-2"><PlusSquare className="w-5 h-5" /> Acompañamiento</button>
          <button onClick={() => { setFormData(initialFormState); setEditingId(null); setView('form'); setActiveTab('opr'); setError(null); }} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 flex items-center gap-2"><PlusSquare className="w-5 h-5" /> Ciclo OPR</button>
        </div>
      </div>
      
      <div className="mb-8">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-slate-700 dark:text-slate-300 mb-3"><BarChart3 className="w-6 h-6 text-amber-500" /> Acompañamientos Generales</h3>
        <div className="space-y-3">
          {loading && <p>Cargando...</p>}
          {!loading && acompanamientos.filter(a => a.id).length > 0 ? (
            acompanamientos.filter(a => a.id).map((record) => (
              <div key={record.id} className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{record.docente}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{record.curso} - {record.asignatura}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fecha: {new Date(record.fecha).toLocaleDateString('es-CL')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { handleEdit(record); setActiveTab('general'); }} className="text-green-600 hover:text-green-800 font-semibold text-sm">Ver/Editar</button>
                  <button onClick={() => { handleEdit(record); setActiveTab('opr'); }} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">Agregar OPR</button>
                  <button onClick={() => handleDelete(record.id)} title="Eliminar" className="text-red-600 hover:text-red-800 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))
          ) : (
            !loading && <p className="text-slate-500 italic p-4 bg-slate-100 dark:bg-slate-800 rounded-md">No hay acompañamientos registrados.</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderFormView = () => {
    const currentAcompanamiento = editingId ? acompanamientos.find((a) => a.id === editingId) : null;
    const temporaryAcompanamiento: AcompanamientoDocenteType = {
      id: 'temp-' + Date.now(),
      fecha: new Date().toISOString(),
      docente: 'docente' in formData ? formData.docente || '' : '',
      curso: 'curso' in formData ? formData.curso || '' : '',
      asignatura: 'asignatura' in formData ? formData.asignatura || '' : '',
      bloques: 'bloques' in formData ? formData.bloques || '' : '',
      rubricaResultados: {},
      observacionesGenerales: '',
      retroalimentacionConsolidada: ''
    };

    return (
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{activeTab === 'general' ? (editingId ? 'Editando Acompañamiento' : 'Nuevo Acompañamiento') : 'Gestión de Ciclo OPR'}</h2>
          <button type="button" onClick={() => setView('list')} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold">&larr; Volver al listado</button>
        </div>

        <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <button onClick={() => setActiveTab('general')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'general' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Acompañamiento General</button>
            <button onClick={() => setActiveTab('opr')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'opr' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Ciclo OPR</button>
          </nav>
        </div>

        {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</div>}

        {activeTab === 'general' && (
          <form onSubmit={handleSave} className="space-y-8">
            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/30">
              <h4 className="text-lg font-semibold mb-2 text-green-700 dark:text-green-300">Asistente IA - Informe General</h4>
              <div className="flex flex-wrap gap-4 items-center">
                <button type="button" onClick={handleGenerateFeedback} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2" disabled={iaLoadingGeneral}><Pencil className="w-4 h-4" />{iaLoadingGeneral ? 'Generando...' : 'Generar Retroalimentación con IA'}</button>
                <button type="button" onClick={() => handleGeneratePDF()} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md flex items-center gap-2"><Download className="w-4 h-4" />Crear Informe PDF</button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Genera automáticamente la retroalimentación. Luego, crea el informe en PDF.</p>
              {'retroalimentacionConsolidada' in formData && formData.retroalimentacionConsolidada && (
                <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-md shadow">
                  <h5 className="font-semibold text-sm mb-2">Retroalimentación Consolidada (guardada):</h5>
                  <textarea readOnly rows={8} value={formData.retroalimentacionConsolidada} className="w-full text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-transparent border-none p-0 focus:ring-0" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
              <div>
                <label htmlFor="docente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Docente</label>
                <select name="docente" value={'docente' in formData ? formData.docente : ''} onChange={handleFieldChange} required className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" disabled={loadingProfesores}>
                  <option value="">{loadingProfesores ? 'Cargando...' : 'Seleccione'}</option>
                  {profesores.map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="curso" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Curso</label>
                <select name="curso" value={'curso' in formData ? formData.curso : ''} onChange={handleFieldChange} required className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                  <option value="">Seleccione</option>
                  {CURSOS.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="asignatura" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
                <select name="asignatura" value={'asignatura' in formData ? formData.asignatura : ''} onChange={handleFieldChange} required className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                  <option value="">Seleccione</option>
                  {ASIGNATURAS.map((a) => (<option key={a} value={a}>{a}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="bloques" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Bloques Horarios</label>
                <input type="text" name="bloques" value={'bloques' in formData ? formData.bloques : ''} onChange={handleFieldChange} placeholder="Ej: 3-4" className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
              </div>
            </div>

            <div>
              <label htmlFor="observacionesGenerales" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Observaciones Generales</label>
              <textarea name="observacionesGenerales" value={'observacionesGenerales' in formData ? formData.observacionesGenerales : ''} onChange={handleFieldChange} rows={4} placeholder="Ingrese sus observaciones sobre la clase..." className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-100 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-1/12">Dominio</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-3/12">Criterio</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">Débil (1)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">Incipiente (2)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">Satisfactorio (3)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">Avanzado (4)</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {rubrica.map((domain) => (
                    <React.Fragment key={domain.domain}>
                      {domain.criteria.map((criterion, critIndex) => (
                        <tr key={criterion.name}>
                          {critIndex === 0 && (<td rowSpan={domain.criteria.length} className="px-3 py-4 align-top text-sm font-semibold text-slate-800 dark:text-slate-200 border-r dark:border-slate-600">{domain.domain}</td>)}
                          <td className="px-3 py-4 align-top text-sm font-medium text-slate-700 dark:text-slate-300 border-r dark:border-slate-600">{criterion.name}</td>
                          {criterion.levels.map((levelText, levelIndex) => {
                            const level = levelIndex + 1;
                            const isSelected = 'rubricaResultados' in formData && formData.rubricaResultados[criterion.name] === level;
                            return (<td key={level} onClick={() => handleRubricSelect(criterion.name, level)} className={`px-3 py-4 align-top text-sm text-slate-600 dark:text-slate-300 border-r dark:border-slate-600 cursor-pointer transition-colors ${isSelected ? 'bg-amber-100 dark:bg-amber-900/30' : 'hover:bg-amber-50 dark:hover:bg-slate-700'}`}>{levelText}</td>);
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-4">
              <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md">{editingId ? 'Actualizar' : 'Guardar'} Acompañamiento</button>
            </div>
          </form>
        )}

        {activeTab === 'opr' && (
          <CicloOPRForm
            acompanamiento={currentAcompanamiento || temporaryAcompanamiento}
            cicloToEdit={null}
            profesores={profesores}
            onSave={async (data) => {
              try {
                const dataToSave = { ...data, acompanamientoId: currentAcompanamiento?.id || null };
                await createCicloOPR(dataToSave);
                alert('Ciclo OPR guardado exitosamente');
                setView('list');
              } catch (error) {
                console.error('Error al guardar ciclo OPR:', error);
                alert('Error al guardar el ciclo OPR');
              }
            }}
            onCancel={() => setView('list')}
          />
        )}
      </div>
    );
  };

  if (loading || loadingProfesores) return <div className="text-center p-8">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {view === 'list' ? renderListView() : renderFormView()}
      </div>
    </div>
  );
};

export default AcompanamientoDocente;
