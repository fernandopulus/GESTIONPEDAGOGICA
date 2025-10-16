// Tailwind v4 puede funcionar sin config, pero añadimos uno mínimo
// para asegurar content y tema en el entorno de build de Vite/Hosting.
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './{App,Dashboard}.tsx',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [forms],
};
