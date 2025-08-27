import React, { useState, useEffect } from 'react';
import { Edit, Trash2, FileText, RefreshCw, PlusCircle } from 'lucide-react';
import { SetPreguntas } from '../../../types/simce';
import { obtenerSetsPreguntasPorProfesor, eliminarSetPreguntas } from '@/firebaseHelpers/simceHelper';
import CreadorPreguntas from './CreadorPreguntas';

interface AdminPreguntasProps {
  currentUser: any;
}

const AdminPreguntas: React.FC<AdminPreguntasProps> = ({ currentUser }) => {
  const [sets, setSets] = useState<SetPreguntas[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [setSeleccionado, setSetSeleccionado] = useState<SetPreguntas | null>(null);
  const [creandoNuevo, setCreandoNuevo] = useState<boolean>(false);

  const cargarSets = async () => {
    setLoading(true);
    try {
      const setsData = await obtenerSetsPreguntasPorProfesor(currentUser.uid);
      setSets(setsData);
    } catch (err) {
      console.error('Error cargando sets de preguntas:', err);
      setError('No se pudieron cargar los sets de preguntas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSets();
  }, []);

  const handleEliminarSet = async (id: string) => {
    if (!confirm('¿Estás seguro que deseas eliminar este set de preguntas?')) {
      return;
    }

    try {
      await eliminarSetPreguntas(id);
      setSets(sets.filter(set => set.id !== id));
    } catch (err) {
      console.error('Error eliminando set:', err);
      setError('No se pudo eliminar el set de preguntas');
    }
  };

  const handleEditarSet = (set: SetPreguntas) => {
    setSetSeleccionado(set);
    setCreandoNuevo(true);
  };

  const getNombreAsignatura = (codigo: string): string => {
    const asignaturas: Record<string, string> = {
      matematica: 'Matemática',
      lectura: 'Lectura',
      ciencias: 'Ciencias Naturales',
      historia: 'Historia y Geografía'
    };
    return asignaturas[codigo] || codigo;
  };

  const handleSaveComplete = () => {
    setCreandoNuevo(false);
    setSetSeleccionado(null);
    cargarSets();
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      {!creandoNuevo ? (
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Sets de Preguntas SIMCE</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => cargarSets()}
                className="flex items-center px-3 py-1 text-gray-700 hover:text-gray-900"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Actualizar
              </button>
              <button
                onClick={() => {
                  setSetSeleccionado(null);
                  setCreandoNuevo(true);
                }}
                className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <PlusCircle className="h-4 w-4 mr-1" />
                Nuevo Set
              </button>
            </div>
          </div>

          {loading && <p className="text-center py-4">Cargando sets de preguntas...</p>}
          
          {error && <p className="text-red-600 p-4 border border-red-200 bg-red-50 rounded mb-4">{error}</p>}
          
          {!loading && sets.length === 0 && (
            <div className="text-center py-8 border rounded-lg">
              <p className="text-gray-500">No hay sets de preguntas disponibles</p>
              <button 
                onClick={() => {
                  setSetSeleccionado(null);
                  setCreandoNuevo(true);
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear Primer Set
              </button>
            </div>
          )}
          
          {sets.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asignatura</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nivel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eje</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preguntas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sets.map((set) => (
                    <tr key={set.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{set.titulo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getNombreAsignatura(set.asignatura)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{set.nivel}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{set.eje}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{set.preguntas.length}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditarSet(set)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Editar"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleEliminarSet(set.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="p-4 border-b">
            <button
              onClick={() => {
                setCreandoNuevo(false);
                setSetSeleccionado(null);
              }}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Volver a la lista
            </button>
          </div>
          <div className="p-6">
            <CreadorPreguntas 
              currentUser={currentUser} 
              setExistente={setSeleccionado || undefined}
              onSaveComplete={handleSaveComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPreguntas;
