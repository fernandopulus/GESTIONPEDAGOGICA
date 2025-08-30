import React, { useState } from 'react';
import AdminPreguntas from './AdminPreguntas';
import { SimceGeneradorPreguntas } from '../../simce/SimceGeneradorPreguntas';
import SimceResultadosLibroClases from '../../simce/SimceResultadosLibroClases';
// import EvaluacionSimce from './EvaluacionSimce'; // Comentado temporalmente mientras se integra

interface SimceModuleProps {
  currentUser: any;
  permisos: string[];
}

const SimceModule: React.FC<SimceModuleProps> = ({ currentUser, permisos }) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'evaluacion' | 'generador' | 'resultados'>('admin');

  const isAdmin = permisos.includes('admin') || permisos.includes('simce_admin');
  const isProfesor = permisos.includes('profesor') || isAdmin;

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-8">Módulo SIMCE</h1>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'admin'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                Administración de Preguntas
              </button>
            )}
            {isProfesor && (
              <button
                onClick={() => setActiveTab('generador')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'generador'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                Crear Evaluaciones
              </button>
            )}

            {isProfesor && (
              <button
                onClick={() => setActiveTab('resultados')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'resultados'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                Libro de Clases
              </button>
            )}

            <button
              onClick={() => setActiveTab('evaluacion')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'evaluacion'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              Realizar Evaluación
            </button>
          </nav>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'admin' && isAdmin && (
          <AdminPreguntas currentUser={currentUser} />
        )}
        
        {activeTab === 'generador' && isProfesor && (
          <SimceGeneradorPreguntas currentUser={currentUser} />
        )}
        
        {activeTab === 'resultados' && isProfesor && (
          <SimceResultadosLibroClases currentUser={currentUser} />
        )}
        
        {activeTab === 'evaluacion' && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <p className="text-center text-gray-600">Módulo de evaluación SIMCE en construcción</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimceModule;
