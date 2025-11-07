// Script de prueba para /api/staticMapBuild
// Codifica una polilínea de ejemplo y solicita la imagen al endpoint desplegado.

const fs = require('fs');

const encodePolyline = (points) => {
  let lastLat = 0, lastLng = 0;
  const result = [];
  const encode = (num) => {
    let v = num < 0 ? ~(num << 1) : (num << 1);
    while (v >= 0x20) {
      result.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
      v >>= 5;
    }
    result.push(String.fromCharCode(v + 63));
  };
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    encode(lat - lastLat);
    encode(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return result.join('');
};

(async () => {
  try {
    const points = [{lat:-33.45, lng:-70.6667}, {lat:-33.0472, lng:-71.6127}];
    const poly = encodePolyline(points);
    console.log('Encoded polyline:', poly);
    const body = {
      pathEnc: poly,
      start: points[0],
      stops: [points[1]],
      size: 512,
      maptype: 'roadmap'
    };
    const res = await fetch('https://plania-clase.web.app/api/staticMapBuild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log('Status:', res.status);
    const ct = res.headers.get('content-type') || '';
    console.log('Content-Type:', ct);
    if (res.ok && ct.startsWith('image/')) {
      const arr = new Uint8Array(await res.arrayBuffer());
      const outPath = './tmp/staticmap.png';
      fs.mkdirSync('./tmp', { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(arr));
      console.log('Saved image to', outPath);
    } else {
      const text = await res.text();
      console.log('Body:', text.slice(0, 2000));
    }
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  }
})();
