import React, { useState, useEffect } from 'react';
import { User, Profile } from '../../types';
import { Edit3, BarChart3, ListChecks } from 'lucide-react';
import { SimceGeneradorPreguntas } from '../simce/SimceGeneradorPreguntas';
import { SimceEvaluacionEstudiante } from './simce/SimceEvaluacionEstudiante';
import { SimceResultados } from './simce/SimceResultados';

interface SimceFixedProps {
  currentUser: User;
}

const SimceFixed: React.FC<SimceFixedProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<string>('generador');
  
  const esProfesorODireccion = currentUser?.profile === Profile.PROFESORADO || 
                              currentUser?.profile === Profile.SUBDIRECCION || 
                              currentUser?.profile === Profile.COORDINACION_TP;
                              
  const esEstudiante = currentUser?.profile === Profile.ESTUDIANTE;
  
  // Determinar la pestaña inicial según el rol del usuario
  useEffect(() => {
    if (esEstudiante) {
      setActiveTab('evaluacion');
    }
  }, [esEstudiante]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
          Evaluación SIMCE
        </h1>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex">
            {(esProfesorODireccion) && (
              <>
                <button 
                  onClick={() => setActiveTab('generador')}
                  className={`flex items-center gap-2 px-4 py-3 ${
                    activeTab === 'generador'
                      ? 'text-indigo-600 border-b-2 border-indigo-600 font-medium'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Generador de Preguntas</span>
                </button>
                <button
                  onClick={() => setActiveTab('resultados')}
                  className={`flex items-center gap-2 px-4 py-3 ${
                    activeTab === 'resultados'
                      ? 'text-indigo-600 border-b-2 border-indigo-600 font-medium'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Resultados</span>
                </button>
              </>
            )}
            {esEstudiante && (
              <button 
                onClick={() => setActiveTab('evaluacion')}
                className={`flex items-center gap-2 px-4 py-3 ${
                  activeTab === 'evaluacion'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 font-medium'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>Mis Evaluaciones</span>
              </button>
            )}
          </div>
        </div>
        
        <div className="p-6">
          {esProfesorODireccion && activeTab === 'generador' && (
            <SimceGeneradorPreguntas currentUser={currentUser} />
          )}
          
          {esProfesorODireccion && activeTab === 'resultados' && (
            <SimceResultados currentUser={currentUser} />
          )}
          
          {esEstudiante && activeTab === 'evaluacion' && (
            <SimceEvaluacionEstudiante currentUser={currentUser} />
          )}
          
          {!esProfesorODireccion && !esEstudiante && (
            <div className="text-center py-8">
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                No tienes permisos para acceder a este módulo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimceFixed;
