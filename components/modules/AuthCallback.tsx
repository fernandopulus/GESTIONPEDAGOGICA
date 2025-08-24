import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * Componente que maneja el callback de OAuth
 * Esta página se muestra después de que el usuario autoriza a Google
 * y es redirigido de vuelta a la aplicación.
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'procesando' | 'exitoso' | 'error'>('procesando');
  const [mensaje, setMensaje] = useState('Procesando la autorización...');

  useEffect(() => {
    // Leer los query parameters de la URL
    const queryParams = new URLSearchParams(location.search);
    const authStatus = queryParams.get('auth');
    const userId = queryParams.get('userId');

    if (authStatus === 'success' && userId) {
      // Autenticación exitosa
      setStatus('exitoso');
      setMensaje('¡Autorización completada con éxito! Redireccionando...');
      
      // Esperar 2 segundos y redireccionar
      setTimeout(() => {
        navigate('/materialesDidacticos');
      }, 2000);
    } else {
      // Error o parámetros incompletos
      setStatus('error');
      const errorMsg = queryParams.get('error') || 'Error desconocido en la autorización';
      setMensaje(`Error: ${errorMsg}`);
    }
  }, [location, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-800 dark:text-white">
          Autorización Google Slides
        </h1>
        
        <div className="flex flex-col items-center space-y-4">
          {status === 'procesando' && (
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          )}
          
          {status === 'exitoso' && (
            <div className="text-green-500 text-lg">✅</div>
          )}
          
          {status === 'error' && (
            <div className="text-red-500 text-lg">❌</div>
          )}
          
          <p className={`text-center ${
            status === 'error' 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-gray-700 dark:text-gray-300'
          }`}>
            {mensaje}
          </p>
          
          {status === 'error' && (
            <button
              onClick={() => navigate('/materialesDidacticos')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Volver a Materiales Didácticos
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
