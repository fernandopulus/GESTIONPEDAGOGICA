// Script de prueba (CommonJS) para invocar generarPruebaConGemini localmente
const functionsIndex = require('../functions/lib/index.js');

async function runTest() {
  if (!functionsIndex.generarPruebaConGemini) {
    console.error('No se encontró la función generarPruebaConGemini en functions/lib/index.js');
    process.exit(1);
  }

  const fakeRequest = {
    data: {
      objetivo: 'La fotosíntesis en plantas',
      cantidadesPorTipo: {
        'Selección múltiple': 2,
        'Verdadero o Falso': 1,
        'Términos pareados': 1,
        'Desarrollo': 1,
        'Comprensión de lectura': 1
      },
      contextoAdicional: 'Nivel: Educación Media. Enfoque en procesos biológicos y etapas.'
    },
    app: { checkToken: 'fake' },
    auth: { uid: 'test-user' }
  };

  try {
    const result = await functionsIndex.generarPruebaConGemini(fakeRequest);
    console.log('Resultado:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error al invocar la función:', err);
    process.exitCode = 1;
  }
}

runTest();
