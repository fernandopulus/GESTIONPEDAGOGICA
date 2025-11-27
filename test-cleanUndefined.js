
const cleanUndefined = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(v => cleanUndefined(v));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = cleanUndefined(value);
      }
      return acc;
    }, {});
  }
  return obj;
};

const test = () => {
  const data = {
    id: '123',
    docenteId: 'abc',
    horasPorCurso: { '1ºA': 4 }, // Caso normal
    otroCampo: undefined
  };
  
  console.log('Caso 1 (normal):', JSON.stringify(cleanUndefined(data), null, 2));

  const data2 = {
    id: '123',
    horasPorCurso: {}, // Caso vacío
  };
  console.log('Caso 2 (vacío):', JSON.stringify(cleanUndefined(data2), null, 2));

  const data3 = {
    id: '123',
    horasPorCurso: { '1ºA': undefined }, // Caso undefined dentro
  };
  console.log('Caso 3 (undefined dentro):', JSON.stringify(cleanUndefined(data3), null, 2));
};

test();
