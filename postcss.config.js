// PostCSS config para Vite + Tailwind v4
// Usa el plugin oficial @tailwindcss/postcss
import tailwind from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: [
    tailwind(),
    autoprefixer(),
  ],
};
