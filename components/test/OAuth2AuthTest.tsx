import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../src/firebase';

const OAuth2AuthTest: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [authStatus, setAuthStatus] = useState<string>('');
  const [authUrl, setAuthUrl] = useState<string>('');

  const checkAuth = async () => {
    setIsChecking(true);
    try {
      const checkGoogleSlidesAuth = httpsCallable(functions, 'checkGoogleSlidesAuth');
      const result = await checkGoogleSlidesAuth();
      
      const data = result.data as { authenticated: boolean; authUrl?: string };
      
      if (data.authenticated) {
        setAuthStatus('✅ Usuario autenticado con Google Slides');
      } else {
        setAuthStatus('❌ Usuario NO autenticado. Necesita autorización.');
        if (data.authUrl) {
          setAuthUrl(data.authUrl);
        }
      }
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      setAuthStatus('❌ Error verificando estado de autenticación');
    }
    setIsChecking(false);
  };

  const startAuth = async () => {
    try {
      const slidesAuthorize = httpsCallable(functions, 'slidesAuthorize');
      const result = await slidesAuthorize();
      
      const data = result.data as { authUrl: string };
      
      if (data.authUrl) {
        // Abrir en nueva ventana para autorización
        window.open(data.authUrl, '_blank', 'width=500,height=600');
      }
    } catch (error) {
      console.error('Error iniciando autorización:', error);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto">
      <h3 className="text-lg font-semibold mb-4">Diagnóstico OAuth Google Slides</h3>
      
      <div className="space-y-4">
        <button
          onClick={checkAuth}
          disabled={isChecking}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isChecking ? 'Verificando...' : 'Verificar Estado de Autenticación'}
        </button>
        
        {authStatus && (
          <div className="p-3 bg-gray-100 rounded text-sm">
            {authStatus}
          </div>
        )}
        
        {authUrl && (
          <button
            onClick={startAuth}
            className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            Autorizar Acceso a Google Slides
          </button>
        )}
        
        <div className="text-xs text-gray-600">
          <p><strong>Problema detectado:</strong></p>
          <p>El usuario necesita autorizar el acceso a Google Slides antes de poder crear presentaciones reales.</p>
          <p>Sin autorización, solo se generan presentaciones demo.</p>
        </div>
      </div>
    </div>
  );
};

export default OAuth2AuthTest;
