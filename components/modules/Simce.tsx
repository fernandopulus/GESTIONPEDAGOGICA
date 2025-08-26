import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  BarChart2, 
  Users, 
  FileText, 
  PlusCircle, 
  CheckCircle, 
  Settings, 
  ChevronRight,
  FileQuestion,
  Book,
  BarChart,
  UserCheck
} from 'lucide-react';
import { User } from '../../types';
import { obtenerSetsPreguntasPorProfesor, obtenerResultadosPorSet } from '../../src/firebaseHelpers/simceHelper';
import { SetPreguntas, ResultadoIntento } from '../../types/simce';
import CreadorPreguntas from './simce/CreadorPreguntas';
import EstadisticasSimce from './simce/EstadisticasSimce';
import AsignacionCursos from './simce/AsignacionCursos';
import ResultadosPreguntas from './simce/ResultadosPreguntas';
import EstudiantesVista from './simce/EstudiantesVista';

interface SimceProps {
  currentUser: User;
}

const Simce: React.FC<SimceProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [sets, setSets] = useState<SetPreguntas[]>([]);
  const [selectedSet, setSelectedSet] = useState<SetPreguntas | null>(null);
  const [resultados, setResultados] = useState<ResultadoIntento[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  
  const esProfesor = currentUser.rol === 'Profesor' || currentUser.rol === 'Directivo';
  const esEstudiante = currentUser.rol === 'Estudiante';

  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      try {
        if (esProfesor) {
          const dataSets = await obtenerSetsPreguntasPorProfesor(currentUser.id);
          setSets(dataSets);
          
          // Si hay sets, cargar resultados del primero por defecto
          if (dataSets.length > 0) {
            setSelectedSet(dataSets[0]);
            const dataResultados = await obtenerResultadosPorSet(dataSets[0].id);
            setResultados(dataResultados);
          }
        }
      } catch (err) {
        console.error("Error al cargar datos SIMCE:", err);
        setError("No se pudieron cargar los datos. Por favor, intente nuevamente.");
      } finally {
        setLoading(false);
      }
    };
    
    cargarDatos();
  }, [currentUser.id, esProfesor]);
  
  const handleSelectSet = async (set: SetPreguntas) => {
    setSelectedSet(set);
    try {
      const dataResultados = await obtenerResultadosPorSet(set.id);
      setResultados(dataResultados);
    } catch (err) {
      console.error("Error al cargar resultados:", err);
      setError("No se pudieron cargar los resultados para este set.");
    }
  };
  
  // Actualizar la lista de sets después de crear uno nuevo
  const handleSetCreated = (newSet: SetPreguntas) => {
    setSets([newSet, ...sets]);
    setSelectedSet(newSet);
  };
  
  // Vista para estudiantes (simplificada)
  if (esEstudiante) {
    return <EstudiantesVista currentUser={currentUser} />;
  }
  
  return (
    <div className="min-h-screen animate-fadeIn">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <FileQuestion className="h-8 w-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">SIMCE</h1>
      </div>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm">
          <p>{error}</p>
          <button 
            className="text-red-700 font-bold underline mt-2" 
            onClick={() => setError(null)}
          >
            Cerrar
          </button>
        </div>
      )}
      
      {/* Tabs de navegación */}
      <div className="flex overflow-x-auto bg-white dark:bg-gray-800 p-1 rounded-xl shadow mb-6">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center px-4 py-3 rounded-lg transition-all ${
            activeTab === 'dashboard'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50'
          }`}
        >
          <BarChart className="h-5 w-5 mr-2" />
          <span>Dashboard</span>
        </button>
        
        <button
          onClick={() => setActiveTab('creador')}
          className={`flex items-center px-4 py-3 rounded-lg transition-all ${
            activeTab === 'creador'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50'
          }`}
        >
          <Book className="h-5 w-5 mr-2" />
          <span>Crear Preguntas</span>
        </button>
        
        <button
          onClick={() => setActiveTab('asignar')}
          className={`flex items-center px-4 py-3 rounded-lg transition-all ${
            activeTab === 'asignar'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50'
          }`}
        >
          <UserCheck className="h-5 w-5 mr-2" />
          <span>Asignar a Cursos</span>
        </button>
        
        <button
          onClick={() => setActiveTab('resultados')}
          className={`flex items-center px-4 py-3 rounded-lg transition-all ${
            activeTab === 'resultados'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50'
          }`}
        >
          <BarChart2 className="h-5 w-5 mr-2" />
          <span>Resultados</span>
        </button>
      </div>
      
      {/* Contenido según tab activa */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <EstadisticasSimce 
                sets={sets} 
                resultados={resultados} 
                selectedSet={selectedSet}
                onSelectSet={handleSelectSet}
              />
            )}
            
            {activeTab === 'creador' && (
              <CreadorPreguntas 
                currentUser={currentUser} 
                onSetCreated={handleSetCreated} 
              />
            )}
            
            {activeTab === 'asignar' && (
              <AsignacionCursos 
                sets={sets} 
                currentUser={currentUser} 
                onSetUpdated={(updatedSet) => {
                  setSets(sets.map(s => s.id === updatedSet.id ? updatedSet : s));
                  if (selectedSet?.id === updatedSet.id) {
                    setSelectedSet(updatedSet);
                  }
                }}
              />
            )}
            
            {activeTab === 'resultados' && (
              <ResultadosPreguntas 
                sets={sets} 
                resultados={resultados}
                selectedSet={selectedSet}
                onSelectSet={handleSelectSet}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Simce;
