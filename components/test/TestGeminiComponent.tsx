import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../src/firebase';

const TestGeminiComponent: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testGemini = async () => {
    setIsLoading(true);
    try {
      const testGeminiFunction = httpsCallable(functions, 'testGemini');
      const response = await testGeminiFunction();
      setResult(response.data);
    } catch (error) {
      console.error('Error calling testGemini:', error);
      setResult({ 
        success: false, 
        error: error.message || 'Error desconocido',
        type: 'client_error'
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <h3 className="text-lg font-semibold mb-4">🧪 Prueba de Gemini AI</h3>
      
      <button
        onClick={testGemini}
        disabled={isLoading}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 mb-4"
      >
        {isLoading ? 'Probando...' : 'Probar Gemini 1.5 Pro'}
      </button>
      
      {result && (
        <div className="bg-gray-100 p-4 rounded">
          <h4 className="font-semibold mb-2">Resultado:</h4>
          <pre className="text-sm overflow-auto max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
          
          {result.success ? (
            <div className="mt-2 text-green-600">
              ✅ Gemini AI está funcionando correctamente
            </div>
          ) : (
            <div className="mt-2 text-red-600">
              ❌ Problema detectado: {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestGeminiComponent;
