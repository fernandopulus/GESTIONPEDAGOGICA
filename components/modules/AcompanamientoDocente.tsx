import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AcompanamientoDocente as AcompanamientoDocenteType, CicloOPR, DetalleObservacionRow } from '../../types';
import { ASIGNATURAS, CURSOS, RUBRICA_ACOMPANAMIENTO_DOCENTE as defaultRubric } from '../../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logApiCall } from '../utils/apiLogger';

// Firebase helpers
import {
  getAllAcompanamientos,
  createAcompanamiento,
  updateAcompanamiento,
  deleteAcompanamiento,
  getAllCiclosOPR,
  createCicloOPR,
  updateCicloOPR,
  uploadFile,
} from '../../src/firebaseHelpers/acompanamientos';
import { getAllUsers as getAllUsersFromFirebase } from '../../src/firebaseHelpers/users';

const getAllUsers = async (): Promise<any[]> => {
  return await getAllUsersFromFirebase();
};

// =========================
// Reusable FileUpload
// =========================
interface FileUploadProps {
  label: string;
  onFileChange: (file: File) => void;
  uploadedUrl?: string;
  onRemove: () => void;
  isUploading: boolean;
  accept?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  onFileChange,
  uploadedUrl,
  onRemove,
  isUploading,
  accept = 'video/mp4,video/quicktime',
}) => {
  const inputId = `file-upload-${label.replace(/\s+/g, '-')}`;

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      {uploadedUrl ? (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700">
          <a
            href={uploadedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-green-700 dark:text-green-300 hover:underline truncate"
          >
            Ver video cargado
          </a>
          <button type="button" onClick={onRemove} className="text-red-500 hover:text-red-700 ml-auto">
            ✖
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
// Ciclo OPR Form
// =========================
interface CicloOPRFormProps {
  acompanamiento: AcompanamientoDocenteType;
  cicloToEdit: CicloOPR | null;
  onSave: (data: Omit<CicloOPR, 'id'> | CicloOPR) => Promise<void>;
  onCancel: () => void;
}

const CicloOPRForm: React.FC<CicloOPRFormProps> = ({ acompanamiento, cicloToEdit, onSave, onCancel }) => {
  // IA para mejorar redacción (no generar contenido nuevo)
  const [iaImproving, setIaImproving] = useState<boolean>(false);
  
  // Estado para datos básicos cuando es independiente
  const [basicData, setBasicData] = useState({
    docente: acompanamiento.docente || '',
    curso: acompanamiento.curso || '',
    asignatura: acompanamiento.asignatura || ''
  });

  const improveText = async (label: string, text: string): Promise<string> => {
    if (!text || !text.trim()) return text;
    const functions = getFunctions();
    const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
    const prompt = `Mejora la redacción del siguiente texto con un tono técnico-pedagógico propio de informes educativos. Mantén el sentido original y NO agregues información nueva ni ejemplos inventados. Devuélvelo como un texto breve, claro y directo. Texto (${label}):\n\n"""${text}"""`;
    const result: any = await callGeminiAI({ prompt, module: 'CicloOPR' });
    return result?.data?.response || text;
  };

  const initialCicloState: Omit<CicloOPR, 'id'> = useMemo(
    () => ({
      registroN: 1,
      nombreCiclo: '',
      fecha: new Date().toISOString().split('T')[0],
      horaInicio: '',
      horaTermino: '',
      videoObservacionUrl: '',
      detallesObservacion: [
        { id: `row_${Date.now()}`, minuto: '0-5', accionesDocente: '', accionesEstudiantes: '', actividades: '' },
      ],
      retroalimentacion: {
        exito: '',
        modelo: '',
        videoModeloUrl: '',
        foco: '',
        elementosIdentificar: '',
        brecha: { videoUrl: '', minutoInicial: '', minutoFinal: '', preguntas: '', indicadores: '' },
      },
      planificacion: { preparacion: '', objetivo: '', actividad: '', tiempo: '' },
      seguimiento: { fecha: '', curso: basicData.curso || '', profesor: basicData.docente || '', firma: '' },
      acompanamientoId: acompanamiento.id && !acompanamiento.id.startsWith('temp-') ? acompanamiento.id : null,
    }),
    [acompanamiento]
  );

  const [formData, setFormData] = useState<Omit<CicloOPR, 'id'> | CicloOPR>(cicloToEdit || initialCicloState);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

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
    const lastRow = (formData as any).detallesObservacion[(formData as any).detallesObservacion.length - 1];
    const lastMin = lastRow ? parseInt(lastRow.minuto.split('-')[1]) : 0;
    const newMinuto = `${lastMin + 1}-${lastMin + 5}`;

    setFormData((prev: any) => ({
      ...prev,
      detallesObservacion: [
        ...prev.detallesObservacion,
        { id: `row_${Date.now()}`, minuto: newMinuto, accionesDocente: '', accionesEstudiantes: '', actividades: '' },
      ],
    }));
  };

  const removeDetalleRow = (id: string) => {
    setFormData((prev: any) => ({
      ...prev,
      detallesObservacion: prev.detallesObservacion.filter((row: any) => row.id !== id),
    }));
  };

  const handleFileUpload = async (fieldName: string, file: File) => {
    // Permitir subida de archivos incluso sin acompañamiento guardado
    setUploading((prev) => ({ ...prev, [fieldName]: true }));
    try {
      const uniqueFileName = `${Date.now()}-${file.name}`;
      // Usar un ID temporal si no hay acompañamiento asociado
      const acompId = acompanamiento.id || 'independent';
      const path = `videos_opr/${acompId}/${(formData as CicloOPR).id || 'temp'}/${uniqueFileName}`;
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
      alert('No se pudo subir el archivo. Inténtelo de nuevo.');
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

  const handleImproveOPRText = async () => {
    setIaImproving(true);
    try {
      const retro = (formData as any).retroalimentacion;
      const plan = (formData as any).planificacion;

      const [exito, modelo, foco, elementosIdentificar, preguntas, indicadores, preparacion, objetivo, actividad, tiempo] = await Promise.all([
        improveText('Éxito', retro.exito),
        improveText('Modelo', retro.modelo),
        improveText('Foco', retro.foco),
        improveText('Elementos a identificar', retro.elementosIdentificar),
        improveText('Brecha - Preguntas', retro.brecha?.preguntas || ''),
        improveText('Brecha - Indicadores', retro.brecha?.indicadores || ''),
        improveText('Planificación - Preparación', plan.preparacion),
        improveText('Planificación - Objetivo', plan.objetivo),
        improveText('Planificación - Actividad', plan.actividad),
        improveText('Planificación - Tiempo', plan.tiempo),
      ]);

      setFormData((prev: any) => ({
        ...prev,
        retroalimentacion: {
          ...prev.retroalimentacion,
          exito,
          modelo,
          foco,
          elementosIdentificar,
          brecha: { ...prev.retroalimentacion.brecha, preguntas, indicadores },
        },
        planificacion: { ...prev.planificacion, preparacion, objetivo, actividad, tiempo },
      }));
    } catch (e) {
      console.error(e);
      alert('No se pudo mejorar la redacción. Intenta nuevamente.');
    }
    setIaImproving(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg animate-fade-in">
      {/* Si es un ciclo independiente, mostrar campos básicos */}
      {(!acompanamiento.id || acompanamiento.id.startsWith('temp-')) && (
        <div className="mb-6 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/30">
          <h4 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-300">Datos Básicos del Ciclo OPR</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Docente</label>
              <input
                type="text"
                value={basicData.docente}
                onChange={(e) => {
                  setBasicData(prev => ({ ...prev, docente: e.target.value }));
                  setFormData((prev: any) => ({
                    ...prev,
                    seguimiento: { ...prev.seguimiento, profesor: e.target.value }
                  }));
                }}
                placeholder="Nombre del docente"
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Curso</label>
              <input
                type="text"
                value={basicData.curso}
                onChange={(e) => {
                  setBasicData(prev => ({ ...prev, curso: e.target.value }));
                  setFormData((prev: any) => ({
                    ...prev,
                    seguimiento: { ...prev.seguimiento, curso: e.target.value }
                  }));
                }}
                placeholder="Ej: 5° Básico"
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
              <input
                type="text"
                value={basicData.asignatura}
                onChange={(e) => setBasicData(prev => ({ ...prev, asignatura: e.target.value }))}
                placeholder="Ej: Matemáticas"
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mejora de redacción OPR (no genera contenido) */}
      <div className="mb-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/30">{/* Rest of the component remains the same */}
        <h4 className="text-lg font-semibold mb-2 text-blue-700 dark:text-blue-300">🔧 Ciclo OPR - Mejorar Redacción</h4>
        <button
          type="button"
          onClick={handleImproveOPRText}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md mb-2"
          disabled={iaImproving}
        >
          {iaImproving ? 'Mejorando redacción...' : 'Mejorar redacción del ciclo'}
        </button>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          <strong>Objetivo:</strong> Mejora la redacción de los textos ya escritos, manteniendo el sentido original con tono técnico-pedagógico.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{cicloToEdit ? 'Editando' : 'Nuevo'} Ciclo OPR</h3>

        {/* Datos Generales */}
        <fieldset className="p-4 border rounded-lg dark:border-slate-700 space-y-4">
          <legend className="text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">Datos Generales</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              name="nombreCiclo"
              value={(formData as any).nombreCiclo}
              onChange={handleFieldChange}
              placeholder="Nombre o N° del Ciclo"
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            />
            <input
              type="date"
              name="fecha"
              value={(formData as any).fecha}
              onChange={handleFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            />
            <input
              type="number"
              name="registroN"
              value={(formData as any).registroN}
              onChange={handleFieldChange}
              placeholder="Registro de Observación N°"
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            />
            <input
              type="time"
              name="horaInicio"
              value={(formData as any).horaInicio}
              onChange={handleFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            />
            <input
              type="time"
              name="horaTermino"
              value={(formData as any).horaTermino}
              onChange={handleFieldChange}
              className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
            />
          </div>
          <FileUpload
            label="Subir video de observación de clase"
            onFileChange={(file) => handleFileUpload('videoObservacionUrl', file)}
            uploadedUrl={(formData as any).videoObservacionUrl}
            onRemove={() => handleFileRemove('videoObservacionUrl')}
            isUploading={!!(uploading as any).videoObservacionUrl}
          />
        </fieldset>

        {/* Registro Detallado de Observación */}
        <fieldset className="p-4 border rounded-lg dark:border-slate-700 space-y-4">
          <legend className="text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">Registro Detallado de Observación</legend>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left p-2">Minuto</th>
                  <th className="text-left p-2">Acciones del Docente</th>
                  <th className="text-left p-2">Acciones de Estudiantes</th>
                  <th className="text-left p-2">Actividades</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {(formData as any).detallesObservacion.map((row: DetalleObservacionRow) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        value={row.minuto}
                        onChange={(e) => handleDetalleChange(row.id, 'minuto', e.target.value)}
                        className="w-24 border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
                      />
                    </td>
                    <td>
                      <textarea
                        value={row.accionesDocente}
                        onChange={(e) => handleDetalleChange(row.id, 'accionesDocente', e.target.value)}
                        rows={2}
                        className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
                      />
                    </td>
                    <td>
                      <textarea
                        value={row.accionesEstudiantes}
                        onChange={(e) => handleDetalleChange(row.id, 'accionesEstudiantes', e.target.value)}
                        rows={2}
                        className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
                      />
                    </td>
                    <td>
                      <textarea
                        value={row.actividades}
                        onChange={(e) => handleDetalleChange(row.id, 'actividades', e.target.value)}
                        rows={2}
                        className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
                      />
                    </td>
                    <td>
                      {(formData as any).detallesObservacion.length > 1 && (
                        <button type="button" onClick={() => removeDetalleRow(row.id)} className="text-red-500 p-1">
                          ✖
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
            className="text-sm bg-slate-200 dark:bg-slate-600 px-3 py-1 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500"
          >
            + Agregar Fila
          </button>
        </fieldset>

        {/* Retroalimentación */}
        <fieldset className="p-4 border rounded-lg dark:border-slate-700 space-y-4">
          <legend className="text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">Retroalimentación Docente</legend>
          <textarea
            name="retroalimentacion.exito"
            value={(formData as any).retroalimentacion.exito}
            onChange={handleFieldChange}
            placeholder="Éxito"
            rows={3}
            className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
          />
          <textarea
            name="retroalimentacion.modelo"
            value={(formData as any).retroalimentacion.modelo}
            onChange={handleFieldChange}
            placeholder="Modelo"
            rows={3}
            className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
          />
          <FileUpload
            label="Subir video para 'Modelo'"
            onFileChange={(file) => handleFileUpload('retroalimentacion.videoModeloUrl', file)}
            uploadedUrl={(formData as any).retroalimentacion.videoModeloUrl}
            onRemove={() => handleFileRemove('retroalimentacion.videoModeloUrl')}
            isUploading={!!(uploading as any)['retroalimentacion.videoModeloUrl']}
          />
          <textarea
            name="retroalimentacion.foco"
            value={(formData as any).retroalimentacion.foco}
            onChange={handleFieldChange}
            placeholder="Foco"
            rows={3}
            className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
          />
          <textarea
            name="retroalimentacion.elementosIdentificar"
            value={(formData as any).retroalimentacion.elementosIdentificar}
            onChange={handleFieldChange}
            placeholder="Elementos a Identificar"
            rows={3}
            className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
          />

          <div className="p-3 border rounded-md dark:border-slate-600 space-y-3">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Brecha</p>
            <FileUpload
              label="Subir video para 'Brecha'"
              onFileChange={(file) => handleFileUpload('retroalimentacion.brecha.videoUrl', file)}
              uploadedUrl={(formData as any).retroalimentacion.brecha.videoUrl}
              onRemove={() => handleFileRemove('retroalimentacion.brecha.videoUrl')}
              isUploading={!!(uploading as any)['retroalimentacion.brecha.videoUrl']}
            />
            <div className="flex gap-4">
              <input
                type="text"
                name="retroalimentacion.brecha.minutoInicial"
                value={(formData as any).retroalimentacion.brecha.minutoInicial}
                onChange={handleFieldChange}
                placeholder="Minuto inicial"
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
              <input
                type="text"
                name="retroalimentacion.brecha.minutoFinal"
                value={(formData as any).retroalimentacion.brecha.minutoFinal}
                onChange={handleFieldChange}
                placeholder="Minuto final"
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
            <textarea
              name="retroalimentacion.brecha.preguntas"
              value={(formData as any).retroalimentacion.brecha.preguntas}
              onChange={handleFieldChange}
              placeholder="Preguntas"
              rows={3}
              className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
            />
            <textarea
              name="retroalimentacion.brecha.indicadores"
              value={(formData as any).retroalimentacion.brecha.indicadores}
              onChange={handleFieldChange}
              placeholder="Indicadores"
              rows={3}
              className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
            />
          </div>
        </fieldset>

        {/* Planificación y seguimiento */}
        <fieldset className="p-4 border rounded-lg dark:border-slate-700 space-y-4">
          <legend className="text-lg font-semibold px-2 text-slate-700 dark:text-slate-300">Planificación de Práctica y Seguimiento</legend>
          <textarea
            name="planificacion.preparacion"
            value={(formData as any).planificacion.preparacion}
            onChange={handleFieldChange}
            placeholder="Preparación"
            rows={3}
            className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
          />
          <textarea
            name="planificacion.objetivo"
            value={(formData as any).planificacion.objetivo}
            onChange={handleFieldChange}
            placeholder="Objetivo"
            rows={3}
            className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
          />
          <textarea
            name="planificacion.actividad"
            value={(formData as any).planificacion.actividad}
            onChange={handleFieldChange}
            placeholder="Actividad"
            rows={3}
            className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
          />
          <input
            type="text"
            name="planificacion.tiempo"
            value={(formData as any).planificacion.tiempo}
            onChange={handleFieldChange}
            placeholder="Tiempo"
            className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
          />

          <div className="p-3 border rounded-md dark:border-slate-600 space-y-3">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Seguimiento</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="date"
                name="seguimiento.fecha"
                value={(formData as any).seguimiento.fecha}
                onChange={handleFieldChange}
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
              <input
                type="text"
                name="seguimiento.firma"
                value={(formData as any).seguimiento.firma}
                onChange={handleFieldChange}
                placeholder="Firma (Nombre de quien registra)"
                className="w-full border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500"
          >
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
// Main component
// =========================
const AcompanamientoDocente: React.FC = () => {
  // Estado general
  const [acompanamientos, setAcompanamientos] = useState<AcompanamientoDocenteType[]>([]);
  const [profesores, setProfesores] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProfesores, setLoadingProfesores] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'opr'>('general');

  // IA Acompañamiento General
  const [iaLoadingGeneral, setIaLoadingGeneral] = useState<boolean>(false);
  const [iaFeedbackGeneral, setIaFeedbackGeneral] = useState<string>('');

  const rubrica = defaultRubric;

  const initialFormState: Omit<AcompanamientoDocenteType, 'id'> = useMemo(
    () => ({
      fecha: new Date().toISOString(),
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

  const [formData, setFormData] = useState<Omit<AcompanamientoDocenteType, 'id' | 'ciclosOPR'>>(initialFormState);

  const fetchAcompanamientos = useCallback(async () => {
    setLoading(true);
    try {
      const acompanamientosFS = await getAllAcompanamientos();
      setAcompanamientos(acompanamientosFS);
    } catch (e) {
      setError('No se pudieron cargar los registros.');
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
    } finally {
      setLoadingProfesores(false);
    }
  }, []);

  useEffect(() => {
    fetchAcompanamientos();
    fetchProfesores();
  }, [fetchAcompanamientos, fetchProfesores]);

  // === IA: Generar retroalimentación + PDF para Acompañamiento General ===
  const generateGeneralFeedbackAndPDF = async () => {
    if (!formData.docente || !formData.curso || !formData.asignatura) {
      alert('Por favor complete los datos básicos antes de generar el informe.');
      return;
    }

    setIaLoadingGeneral(true);
    try {
      const functions = getFunctions();
      const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
      
      // Preparar contexto para la IA
      const rubricaTexto = Object.entries(formData.rubricaResultados || {})
        .map(([criterio, nivel]) => `${criterio}: Nivel ${nivel}`)
        .join('\n');
      
      const contexto = {
        docente: formData.docente,
        curso: formData.curso,
        asignatura: formData.asignatura,
        fecha: new Date(formData.fecha).toLocaleDateString('es-CL'),
        bloques: formData.bloques || 'No especificado',
        rubricaResultados: rubricaTexto || 'Sin evaluación de rúbrica',
        observacionesGenerales: formData.observacionesGenerales || 'Sin observaciones adicionales'
      };

      const prompt = `Genera una retroalimentación pedagógica detallada y un resumen de observaciones basado en estos datos del acompañamiento docente:

      DATOS DEL ACOMPAÑAMIENTO:
      - Docente: ${contexto.docente}
      - Curso: ${contexto.curso}
      - Asignatura: ${contexto.asignatura}
      - Fecha: ${contexto.fecha}
      - Bloques horarios: ${contexto.bloques}
      
      RESULTADOS DE RÚBRICA:
      ${contexto.rubricaResultados}
      
      OBSERVACIONES GENERALES:
      ${contexto.observacionesGenerales}
      
      Por favor genera una retroalimentación con tono técnico pedagógico, clara y constructiva, con la siguiente estructura:
      1. INTRODUCCIÓN: Contextualización del acompañamiento
      2. FORTALEZAS OBSERVADAS: Aspectos destacados del desempeño docente
      3. OPORTUNIDADES DE MEJORA: Áreas a desarrollar
      4. RECOMENDACIONES ESPECÍFICAS: Estrategias concretas para implementar
      5. CONCLUSIÓN: Síntesis y próximos pasos
      
      La retroalimentación debe ser profesional, constructiva y orientada al desarrollo profesional docente.`;

      const result: any = await callGeminiAI({ 
        prompt, 
        module: 'AcompanamientoGeneral' 
      });
      
      const feedbackText = result?.data?.response || 'No se pudo generar la retroalimentación.';
      setIaFeedbackGeneral(feedbackText);
      
      // Actualizar el formData con la retroalimentación generada
      setFormData(prev => ({
        ...prev,
        retroalimentacionConsolidada: feedbackText
      }));
      
      // Generar PDF automáticamente
      generatePDF(feedbackText);
      
    } catch (error) {
      console.error('Error al generar retroalimentación:', error);
      alert('No se pudo generar la retroalimentación. Intente nuevamente.');
    } finally {
      setIaLoadingGeneral(false);
    }
  };

  const generatePDF = (feedbackText: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // Título del documento
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME DE ACOMPAÑAMIENTO DOCENTE', pageWidth / 2, 20, { align: 'center' });
    
    // Línea separadora
    doc.setLineWidth(0.5);
    doc.line(margin, 25, pageWidth - margin, 25);
    
    // Información básica
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let yPosition = 35;
    
    const infoBasica = [
      ['Docente:', formData.docente],
      ['Curso:', formData.curso],
      ['Asignatura:', formData.asignatura],
      ['Fecha:', new Date(formData.fecha).toLocaleDateString('es-CL')],
      ['Bloques horarios:', formData.bloques || 'No especificado']
    ];
    
    infoBasica.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 35, yPosition);
      yPosition += 7;
    });
    
    // Resultados de Rúbrica
    yPosition += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESULTADOS DE EVALUACIÓN', margin, yPosition);
    yPosition += 10;
    
    // Tabla de rúbrica
    if (Object.keys(formData.rubricaResultados || {}).length > 0) {
      const rubricaData = Object.entries(formData.rubricaResultados).map(([criterio, nivel]) => [
        criterio,
        `Nivel ${nivel}`,
        nivel === 1 ? 'Débil' : nivel === 2 ? 'Incipiente' : nivel === 3 ? 'Satisfactorio' : 'Avanzado'
      ]);
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Criterio', 'Nivel', 'Descripción']],
        body: rubricaData,
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], textColor: 255 },
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Observaciones generales
    if (formData.observacionesGenerales) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVACIONES GENERALES', margin, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const observacionesLines = doc.splitTextToSize(formData.observacionesGenerales, contentWidth);
      doc.text(observacionesLines, margin, yPosition);
      yPosition += observacionesLines.length * 5 + 10;
    }
    
    // Retroalimentación generada por IA
    if (feedbackText) {
      // Verificar si necesitamos nueva página
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('RETROALIMENTACIÓN PEDAGÓGICA', margin, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Dividir el texto de retroalimentación en secciones
      const secciones = feedbackText.split(/\d\.\s+[A-ZÁÉÍÓÚÑ\s]+:/g);
      const titulos = feedbackText.match(/\d\.\s+[A-ZÁÉÍÓÚÑ\s]+:/g) || [];
      
      secciones.forEach((seccion, index) => {
        if (seccion.trim()) {
          // Verificar si necesitamos nueva página
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = 20;
          }
          
          // Agregar título de sección si existe
          if (titulos[index - 1]) {
            doc.setFont('helvetica', 'bold');
            doc.text(titulos[index - 1], margin, yPosition);
            yPosition += 7;
            doc.setFont('helvetica', 'normal');
          }
          
          // Agregar contenido de la sección
          const lines = doc.splitTextToSize(seccion.trim(), contentWidth);
          doc.text(lines, margin, yPosition);
          yPosition += lines.length * 5 + 5;
        }
      });
    }
    
    // Pie de página en todas las páginas
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(
        `Generado el ${new Date().toLocaleDateString('es-CL')} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
    
    // Guardar el PDF
    const fileName = `Informe_Acompañamiento_${formData.docente}_${formData.curso}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const handleFieldChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRubricSelect = (criterionName: string, level: number) => {
    setFormData((prev) => ({
      ...prev,
      rubricaResultados: { ...prev.rubricaResultados, [criterionName]: level },
    }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.docente || !formData.curso || !formData.asignatura) {
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
        setFormData((prev) => ({ ...prev, id: newRecord.id } as any));
        alert('¡Guardado correctamente! Ahora puedes agregar Ciclos OPR.');
      }
      await fetchAcompanamientos();
    } catch (err) {
      setError('Error al guardar el registro.');
    }
  };

  const handleCreateNew = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setView('form');
    setActiveTab('general');
    setError(null);
    setIaFeedbackGeneral('');
  };

  const handleEdit = (record: AcompanamientoDocenteType) => {
    setFormData(record);
    setEditingId(record.id);
    setView('form');
    setActiveTab('general');
    setError(null);
    setIaFeedbackGeneral('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este registro? Esto no eliminará los ciclos OPR asociados.')) {
      try {
        await deleteAcompanamiento(id);
        await fetchAcompanamientos();
      } catch (err) {
        setError('No se pudo eliminar el registro.');
      }
    }
  };

  const renderListView = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Módulo de Acompañamiento Docente</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              handleCreateNew();
              setActiveTab('general');
            }} 
            className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600"
          >
            + Acompañamiento General
          </button>
          <button 
            onClick={() => {
              setFormData(initialFormState);
              setEditingId(null);
              setView('form');
              setActiveTab('opr');
              setError(null);
              setIaFeedbackGeneral('');
            }} 
            className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600"
          >
            + Ciclo OPR
          </button>
        </div>
      </div>
      
      {/* Sección de Acompañamientos Generales */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3">📊 Acompañamientos Generales</h3>
        <div className="space-y-3">
          {loading && <p>Cargando...</p>}
          {!loading && acompanamientos.filter(a => a.id).length > 0 ? (
            acompanamientos.filter(a => a.id).map((record) => (
              <div
                key={record.id}
                className="p-4 border dark:border-slate-700 rounded-lg bg-green-50 dark:bg-green-900/20 flex justify-between items-center"
              >
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{record.docente}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {record.curso} - {record.asignatura}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Fecha: {new Date(record.fecha).toLocaleDateString('es-CL')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleEdit(record);
                      setActiveTab('general');
                    }}
                    className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-semibold text-sm"
                  >
                    Ver/Editar
                  </button>
                  <button
                    onClick={() => {
                      handleEdit(record);
                      setActiveTab('opr');
                    }}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-sm"
                  >
                    + Agregar OPR
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    title="Eliminar"
                    className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          ) : (
            !loading && <p className="text-slate-500 italic">No hay acompañamientos generales registrados</p>
          )}
        </div>
      </div>

      {/* Sección de Ciclos OPR Independientes */}
      <div>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3">🔧 Ciclos OPR</h3>
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            Los ciclos OPR se pueden crear de forma independiente o asociados a un acompañamiento general.
          </p>
        </div>
      </div>
    </div>
  );

  const renderFormView = () => {
    const currentAcompanamiento = editingId ? acompanamientos.find((a) => a.id === editingId) : null;
    
    // Para Ciclo OPR independiente, crear un acompañamiento temporal si no existe
    const temporaryAcompanamiento: AcompanamientoDocenteType = {
      id: 'temp-' + Date.now(),
      fecha: new Date().toISOString(),
      docente: formData.docente || '',
      curso: formData.curso || '',
      asignatura: formData.asignatura || '',
      bloques: formData.bloques || '',
      rubricaResultados: {},
      observacionesGenerales: '',
      retroalimentacionConsolidada: ''
    };

    return (
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            {activeTab === 'general' 
              ? (editingId ? 'Editando Acompañamiento General' : 'Nuevo Acompañamiento General')
              : 'Ciclo OPR'}
          </h2>
          <button
            type="button"
            onClick={() => setView('list')}
            className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold"
          >
            &larr; Volver al listado
          </button>
        </div>

        <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('general')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'general'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Acompañamiento General
            </button>
            <button
              onClick={() => setActiveTab('opr')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'opr'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Ciclo OPR
            </button>
          </nav>
        </div>

        {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</div>}

        {activeTab === 'general' && (
          <form onSubmit={handleSave} className="space-y-8">
            {/* Sección de IA para Acompañamiento General */}
            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/30">
              <h4 className="text-lg font-semibold mb-2 text-green-700 dark:text-green-300">📊 Acompañamiento General - Generar Informe con IA</h4>
              <button
                type="button"
                onClick={generateGeneralFeedbackAndPDF}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md mb-2"
                disabled={iaLoadingGeneral}
              >
                {iaLoadingGeneral ? 'Generando retroalimentación e informe...' : 'Generar retroalimentación e informe PDF'}
              </button>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                <strong>Objetivo:</strong> Genera automáticamente retroalimentación pedagógica e informe PDF basándose en los datos ingresados (docente, curso, asignatura, observaciones y rúbrica).
              </p>
              
              {iaFeedbackGeneral && (
                <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-md">
                  <h5 className="font-semibold text-sm mb-2">Retroalimentación generada:</h5>
                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {iaFeedbackGeneral}
                  </div>
                </div>
              )}
            </div>

            {/* Datos básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 dark:border-slate-700">
              <div>
                <label htmlFor="docente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Docente
                </label>
                <select
                  name="docente"
                  value={formData.docente}
                  onChange={handleFieldChange}
                  required
                  className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                  disabled={loadingProfesores}
                >
                  <option value="">{loadingProfesores ? 'Cargando...' : 'Seleccione'}</option>
                  {profesores.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="curso" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Curso
                </label>
                <select
                  name="curso"
                  value={formData.curso}
                  onChange={handleFieldChange}
                  required
                  className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                >
                  <option value="">Seleccione</option>
                  {CURSOS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="asignatura" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Asignatura
                </label>
                <select
                  name="asignatura"
                  value={formData.asignatura}
                  onChange={handleFieldChange}
                  required
                  className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                >
                  <option value="">Seleccione</option>
                  {ASIGNATURAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bloques" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Bloques Horarios
                </label>
                <input
                  type="text"
                  name="bloques"
                  value={formData.bloques}
                  onChange={handleFieldChange}
                  placeholder="Ej: 3-4"
                  className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                />
              </div>
            </div>

            {/* Observaciones generales */}
            <div>
              <label htmlFor="observacionesGenerales" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Observaciones Generales
              </label>
              <textarea
                name="observacionesGenerales"
                value={formData.observacionesGenerales}
                onChange={handleFieldChange}
                rows={4}
                placeholder="Ingrese sus observaciones sobre la clase..."
                className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
              />
            </div>

            {/* Tabla de rúbrica */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-100 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-1/12">
                      Dominio
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-3/12">
                      Criterio
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">
                      Débil (1)
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">
                      Incipiente (2)
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">
                      Satisfactorio (3)
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider w-2/12">
                      Avanzado (4)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {rubrica.map((domain) => (
                    <React.Fragment key={domain.domain}>
                      {domain.criteria.map((criterion, critIndex) => (
                        <tr key={criterion.name}>
                          {critIndex === 0 && (
                            <td
                              rowSpan={domain.criteria.length}
                              className="px-3 py-4 align-top text-sm font-semibold text-slate-800 dark:text-slate-200 border-r dark:border-slate-600"
                            >
                              {domain.domain}
                            </td>
                          )}
                          <td className="px-3 py-4 align-top text-sm font-medium text-slate-700 dark:text-slate-300 border-r dark:border-slate-600">
                            {criterion.name}
                          </td>
                          {criterion.levels.map((levelText, levelIndex) => {
                            const level = levelIndex + 1;
                            const isSelected = (formData as any).rubricaResultados[criterion.name] === level;
                            return (
                              <td
                                key={level}
                                onClick={() => handleRubricSelect(criterion.name, level)}
                                className={`px-3 py-4 align-top text-sm text-slate-600 dark:text-slate-300 border-r dark:border-slate-600 cursor-pointer transition-colors ${
                                  isSelected ? 'bg-amber-100 dark:bg-amber-900/30' : 'hover:bg-amber-50 dark:hover:bg-slate-700'
                                }`}
                              >
                                {levelText}
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

            {/* Retroalimentación consolidada (campo para guardar lo generado por IA) */}
            {formData.retroalimentacionConsolidada && (
              <div>
                <label htmlFor="retroalimentacionConsolidada" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Retroalimentación Consolidada (Generada por IA)
                </label>
                <textarea
                  name="retroalimentacionConsolidada"
                  value={formData.retroalimentacionConsolidada}
                  onChange={handleFieldChange}
                  rows={6}
                  className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"
                />
              </div>
            )}

            {/* Acciones */}
            <div className="flex justify-end gap-4">
              <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md">
                {editingId ? 'Actualizar' : 'Guardar'} Acompañamiento
              </button>
            </div>
          </form>
        )}

        {activeTab === 'opr' && (
          <CicloOPRForm
            acompanamiento={currentAcompanamiento || temporaryAcompanamiento}
            cicloToEdit={null}
            onSave={async (data) => {
              try {
                // Si es un ciclo independiente (sin acompañamiento asociado)
                if (!currentAcompanamiento) {
                  // Guardar el ciclo OPR con datos mínimos del acompañamiento temporal
                  const cicloIndependiente = {
                    ...data,
                    acompanamientoId: null, // Indicar que es independiente
                    docenteInfo: formData.docente || 'No especificado',
                    cursoInfo: formData.curso || 'No especificado'
                  };
                  await createCicloOPR(cicloIndependiente);
                  alert('Ciclo OPR independiente guardado exitosamente');
                } else {
                  // Si hay un acompañamiento asociado, guardar normalmente
                  await createCicloOPR(data);
                  alert('Ciclo OPR guardado exitosamente');
                }
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {view === 'list' ? renderListView() : renderFormView()}
      </div>
    </div>
  );
};

export default AcompanamientoDocente;