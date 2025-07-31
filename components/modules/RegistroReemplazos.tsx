import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { Reemplazo, User, Profile } from '../../types';
import { ASIGNATURAS, CURSOS } from '../../constants';

// Firebase helpers
import {
  saveReemplazo,
  deleteReemplazo,
  subscribeToReemplazos,
  subscribeToProfesores,
  searchReemplazos,
  getReemplazosStats
} from '../../firebase/reemplazosHelper';

const BLOQUES = Array.from({ length: 12 }, (_, i) => i + 1);

const initialState: Omit<Reemplazo, 'id' | 'resultado'> = {
  docenteAusente: '',
  asignaturaAusente: '',
  curso: '',
  diaAusencia: '',
  bloquesAfectados: [],
  docenteReemplazante: '',
  asignaturaReemplazante: '',
};

// ===== HOOKS PERSONALIZADOS =====

// Hook para manejar reemplazos con Firebase
const useReemplazos = (userId: string) => {
  const [reemplazos, setReemplazos] = useState<Reemplazo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToReemplazos(userId, (data) => {
      setReemplazos(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const save = useCallback(async (reemplazo: Omit<Reemplazo, 'id'>) => {
    try {
      setError(null);
      return await saveReemplazo(reemplazo, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
      throw err;
    }
  }, [userId]);

  const remove = useCallback(async (id: string) => {
    try {
      setError(null);
      await deleteReemplazo(id, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
      throw err;
    }
  }, [userId]);

  const search = useCallback(async (searchTerm: string) => {
    try {
      setError(null);
      if (!searchTerm.trim()) {
        return reemplazos;
      }
      return await searchReemplazos(userId, searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la búsqueda');
      return [];
    }
  }, [userId, reemplazos]);

  return { reemplazos, loading, error, save, remove, search };
};

// Hook para manejar profesores con Firebase
const useProfesores = (userId: string) => {
  const [profesores, setProfesores] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToProfesores(userId, (data) => {
      setProfesores(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const profesorNames = useMemo(() => 
    profesores.map(p => p.nombreCompleto).sort(), 
    [profesores]
  );

  return { profesores, profesorNames, loading };
};

// ===== SUB-COMPONENTES =====

interface BlockCheckboxGroupProps {
  selectedBlocks: number[];
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  legend: string;
  disabled?: boolean;
}

const BlockCheckboxGroup: React.FC<BlockCheckboxGroupProps> = ({ 
  selectedBlocks, 
  onChange, 
  legend, 
  disabled = false 
}) => (
  <fieldset>
    <legend className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{legend}</legend>
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {BLOQUES.map(bloque => (
        <label key={bloque} className={`flex items-center space-x-2 p-2 border rounded-lg transition-colors ${
          disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700'
        }`}>
          <input
            type="checkbox"
            value={bloque}
            checked={selectedBlocks.includes(bloque)}
            onChange={onChange}
            disabled={disabled}
            className="h-5 w-5 rounded text-amber-500 focus:ring-amber-400 bg-slate-200 dark:bg-slate-600 border-slate-300 dark:border-slate-500 disabled:opacity-50"
          />
          <span className="text-slate-600 dark:text-slate-300 font-medium">{bloque}</span>
        </label>
      ))}
    </div>
  </fieldset>
);

// Componente para mostrar estadísticas
interface StatsCardProps {
  userId: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ userId }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const currentDate = new Date();
      const month = (currentDate.getMonth() + 1).toString();
      const year = currentDate.getFullYear().toString();
      
      const monthlyStats = await getReemplazosStats(userId, month, year);
      setStats(monthlyStats);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadStats();
    }
  }, [userId, loadStats]);

  if (loading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
        <div className="animate-pulse flex justify-center">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
      <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-3">Estadísticas del Mes</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{stats.totalReemplazos}</div>
          <div className="text-slate-500 dark:text-slate-400">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.horasRealizadas}</div>
          <div className="text-slate-500 dark:text-slate-400">Realizadas</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.horasCubiertas}</div>
          <div className="text-slate-500 dark:text-slate-400">Cubiertas</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.porcentajeRealizadas.toFixed(1)}%
          </div>
          <div className="text-slate-500 dark:text-slate-400">Efectividad</div>
        </div>
      </div>
    </div>
  );
};

// ===== COMPONENTE PRINCIPAL =====

interface RegistroReemplazosProps {
  currentUser: { uid: string; nombreCompleto: string };
}

const RegistroReemplazos: React.FC<RegistroReemplazosProps> = ({ currentUser }) => {
  const { reemplazos, save: saveReemplazoData, remove: deleteReemplazoData, search, loading: reemplazosLoading, error: reemplazosError } = useReemplazos(currentUser.uid);
  const { profesorNames, loading: profesoresLoading } = useProfesores(currentUser.uid);
  
  const [formData, setFormData] = useState(initialState);
  const [filter, setFilter] = useState('');
  const [filteredReemplazos, setFilteredReemplazos] = useState<Reemplazo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Actualizar reemplazos filtrados cuando cambian los datos o el filtro
  useEffect(() => {
    const filterReemplazos = async () => {
      if (!filter.trim()) {
        setFilteredReemplazos(reemplazos);
        return;
      }

      setSearchLoading(true);
      try {
        const results = await search(filter);
        setFilteredReemplazos(results);
      } catch (error) {
        console.error('Error en búsqueda:', error);
        setFilteredReemplazos(reemplazos);
      } finally {
        setSearchLoading(false);
      }
    };

    filterReemplazos();
  }, [reemplazos, filter, search]);

  const handleFieldChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleCheckboxChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setFormData(prev => {
      const currentBlocks = prev.bloquesAfectados;
      const newBlocks = currentBlocks.includes(value)
        ? currentBlocks.filter(b => b !== value)
        : [...currentBlocks, value].sort((a,b) => a - b);
      return { ...prev, bloquesAfectados: newBlocks };
    });
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { 
      docenteAusente, 
      asignaturaAusente, 
      curso, 
      diaAusencia, 
      bloquesAfectados, 
      docenteReemplazante, 
      asignaturaReemplazante 
    } = formData;

    // Validaciones
    if (!docenteAusente || !asignaturaAusente || !curso || !diaAusencia || 
        !docenteReemplazante || !asignaturaReemplazante || bloquesAfectados.length === 0) {
      setError('Todos los campos son obligatorios y debe seleccionar al menos un bloque.');
      setIsSubmitting(false);
      return;
    }

    // Validar que no sea el mismo docente
    if (docenteAusente === docenteReemplazante) {
      setError('El docente ausente y el reemplazante no pueden ser la misma persona.');
      setIsSubmitting(false);
      return;
    }

    // Validar fecha
    const selectedDate = new Date(diaAusencia);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      const confirm = window.confirm('La fecha seleccionada es anterior a hoy. ¿Desea continuar?');
      if (!confirm) {
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const resultado = asignaturaAusente.trim().toLowerCase() === asignaturaReemplazante.trim().toLowerCase()
        ? 'Hora realizada'
        : 'Hora cubierta, no realizada';

      const newReemplazo: Omit<Reemplazo, 'id'> = {
        ...formData,
        resultado,
      };

      await saveReemplazoData(newReemplazo);
      setFormData(initialState);
      
      // Mostrar mensaje de éxito
      const message = resultado === 'Hora realizada' 
        ? '✅ Reemplazo registrado - Hora realizada' 
        : '⚠️ Reemplazo registrado - Hora cubierta, no realizada';
      
      // Crear notificación temporal
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = message;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);

    } catch (error) {
      console.error('Error al guardar reemplazo:', error);
      setError('Error al guardar el reemplazo. Por favor, intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, saveReemplazoData]);
  
  const handleDelete = useCallback(async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este registro?')) {
      try {
        await deleteReemplazoData(id);
      } catch (error) {
        console.error('Error al eliminar reemplazo:', error);
        alert('Error al eliminar el reemplazo. Por favor, intente nuevamente.');
      }
    }
  }, [deleteReemplazoData]);

  const inputStyles = "w-full border-slate-300 rounded-md shadow-sm focus:ring-amber-400 focus:border-amber-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed";

  // Verificar que el usuario tiene UID antes de renderizar
  if (!currentUser.uid) {
    return (
      <div className="flex justify-center items-center py-8">
        <p className="text-slate-500 dark:text-slate-400">Error: Usuario no autenticado</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Estadísticas del mes */}
      <StatsCard userId={currentUser.uid} />

      {/* Formulario de registro */}
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Registro de Inasistencias y Reemplazos</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">Complete el formulario para registrar una nueva suplencia.</p>

        {profesoresLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-slate-600 dark:text-slate-400">Cargando profesores...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Columna Docente Ausente */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 border-b dark:border-slate-600 pb-2">Docente Ausente</h2>
                <div>
                  <label htmlFor="docenteAusente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Nombre
                  </label>
                  <select 
                    name="docenteAusente" 
                    value={formData.docenteAusente} 
                    onChange={handleFieldChange} 
                    className={inputStyles}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">Seleccione un docente</option>
                    {profesorNames.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="asignaturaAusente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Asignatura
                  </label>
                  <select 
                    name="asignaturaAusente" 
                    value={formData.asignaturaAusente} 
                    onChange={handleFieldChange} 
                    className={inputStyles}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">Seleccione una asignatura</option>
                    {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
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
                    className={inputStyles}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">Seleccione un curso</option>
                    {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="diaAusencia" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Día Ausencia
                  </label>
                  <input 
                    type="date" 
                    name="diaAusencia" 
                    value={formData.diaAusencia} 
                    onChange={handleFieldChange} 
                    className={inputStyles}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <BlockCheckboxGroup 
                  legend="Bloques Afectados" 
                  selectedBlocks={formData.bloquesAfectados} 
                  onChange={handleCheckboxChange} 
                  disabled={isSubmitting}
                />
              </div>

              {/* Columna Docente Reemplazante */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 border-b dark:border-slate-600 pb-2">Docente Reemplazante</h2>
                <div>
                  <label htmlFor="docenteReemplazante" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Nombre
                  </label>
                  <select 
                    name="docenteReemplazante" 
                    value={formData.docenteReemplazante} 
                    onChange={handleFieldChange} 
                    className={inputStyles}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">Seleccione un docente</option>
                    {profesorNames.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="asignaturaReemplazante" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Asignatura
                  </label>
                  <select 
                    name="asignaturaReemplazante" 
                    value={formData.asignaturaReemplazante} 
                    onChange={handleFieldChange} 
                    className={inputStyles}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">Seleccione una asignatura</option>
                    {ASIGNATURAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {/* Preview del resultado */}
                {formData.asignaturaAusente && formData.asignaturaReemplazante && (
                  <div className="mt-6 p-4 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Vista Previa del Resultado:</h3>
                    <div className={`px-3 py-2 rounded-full text-sm font-semibold inline-flex ${
                      formData.asignaturaAusente.toLowerCase() === formData.asignaturaReemplazante.toLowerCase()
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                    }`}>
                      {formData.asignaturaAusente.toLowerCase() === formData.asignaturaReemplazante.toLowerCase()
                        ? '✅ Hora realizada'
                        : '⚠️ Hora cubierta, no realizada'
                      }
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      {formData.asignaturaAusente.toLowerCase() === formData.asignaturaReemplazante.toLowerCase()
                        ? 'Las asignaturas coinciden - se considera hora realizada'
                        : 'Las asignaturas no coinciden - se considera hora cubierta pero no realizada'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {(error || reemplazosError) && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400">
                  {error || reemplazosError}
                </p>
              </div>
            )}
            
            <div className="pt-4 text-right">
              <button 
                type="submit" 
                disabled={isSubmitting || profesoresLoading}
                className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                )}
                {isSubmitting ? 'Registrando...' : 'Registrar Reemplazo'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Historial de reemplazos */}
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Historial de Reemplazos</h2>
        
        {/* Buscador */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por docente, curso o fecha (YYYY-MM-DD)..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`${inputStyles} md:w-1/2 pl-10`}
              disabled={searchLoading}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {searchLoading ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
          </div>
          {filter && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {searchLoading ? 'Buscando...' : `${filteredReemplazos.length} resultado(s) encontrado(s)`}
            </p>
          )}
        </div>

        {reemplazosLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-slate-600 dark:text-slate-400">Cargando reemplazos...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Curso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Docente Ausente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Docente Reemplazante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Bloques
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Resultado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {filteredReemplazos.length > 0 ? filteredReemplazos.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {new Date(r.diaAusencia + 'T12:00:00').toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {r.curso}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                      {r.docenteAusente}
                      <br/>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{r.asignaturaAusente}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                      {r.docenteReemplazante}
                      <br/>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{r.asignaturaReemplazante}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {r.bloquesAfectados.join(', ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        r.resultado === 'Hora realizada' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' 
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                      }`}>
                        {r.resultado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      <button 
                        onClick={() => handleDelete(r.id)} 
                        title="Eliminar registro"
                        className="p-1 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                        disabled={isSubmitting}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                      {filter ? 'No se encontraron registros que coincidan con la búsqueda.' : 'No hay registros de reemplazos.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Información adicional */}
        {filteredReemplazos.length > 0 && !filter && (
          <div className="mt-4 text-sm text-slate-500 dark:text-slate-400 text-center">
            Mostrando los últimos {filteredReemplazos.length} registros
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistroReemplazos;