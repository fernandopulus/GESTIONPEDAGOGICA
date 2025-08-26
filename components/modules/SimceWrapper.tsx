import React from 'react';
import { User } from '../../types';
import { SimceGeneradorPreguntas } from './simce/SimceGeneradorPreguntas';
import { SimceEvaluacionEstudiante } from './simce/SimceEvaluacionEstudiante';
import { SimceResultados } from './simce/SimceResultados';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { Edit3, BarChart3, ListChecks } from 'lucide-react';

interface SimceWrapperProps {
  currentUser: User;
}

const SimceWrapper: React.FC<SimceWrapperProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = React.useState<string>('generador');
  
  const esProfesorODireccion = currentUser?.profile === 'PROFESORADO' || 
                              currentUser?.profile === 'SUBDIRECCION' || 
                              currentUser?.profile === 'COORDINACION_TP' ||
                              currentUser?.rol === 'Profesor' || 
                              currentUser?.rol === 'UTP' || 
                              currentUser?.rol === 'Dirección' || 
                              currentUser?.rol === 'Subdirección' ||
                              currentUser?.rol === 'Administrador';
                              
  const esEstudiante = currentUser?.profile === 'ESTUDIANTE' || 
                       currentUser?.rol === 'Estudiante';
  
  // Determinar la pestaña inicial según el rol del usuario
  React.useEffect(() => {
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
      
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <div className="px-4 py-2 border-b dark:border-slate-700">
            <TabsList className="flex">
              {(esProfesorODireccion) && (
                <>
                  <TabsTrigger 
                    value="generador" 
                    className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Generador de Preguntas</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="resultados" 
                    className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Resultados</span>
                  </TabsTrigger>
                </>
              )}
              {esEstudiante && (
                <TabsTrigger 
                  value="evaluacion" 
                  className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600"
                >
                  <ListChecks className="w-4 h-4" />
                  <span>Mis Evaluaciones</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          
          <div className="p-6">
            {esProfesorODireccion && (
              <>
                <TabsContent value="generador" className="mt-0">
                  <SimceGeneradorPreguntas currentUser={currentUser} />
                </TabsContent>
                
                <TabsContent value="resultados" className="mt-0">
                  <SimceResultados currentUser={currentUser} />
                </TabsContent>
              </>
            )}
            
            {esEstudiante && (
              <TabsContent value="evaluacion" className="mt-0">
                <SimceEvaluacionEstudiante currentUser={currentUser} />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default SimceWrapper;
