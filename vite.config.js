import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> dist/        presentación + página de RA (ar.html) para hosting estático
// `npm run build:single` -> dist-single/ index.html autocontenido (offline) + models/
//                           (la demo de RA por QR necesita la versión publicada con HTTPS)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    root: 'src',
    base: './', // rutas relativas: funciona en la raíz o en una subcarpeta del hosting
    publicDir: 'public',
    plugins: single ? [viteSingleFile()] : [],
    build: {
      outDir: single ? '../dist-single' : '../dist',
      emptyOutDir: true,
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 1500, // model-viewer incluye three.js
      rollupOptions: {
        input: single
          ? resolve(import.meta.dirname, 'src/index.html')
          : { main: resolve(import.meta.dirname, 'src/index.html'), ar: resolve(import.meta.dirname, 'src/ar.html') },
      },
    },
    server: { open: true, host: true }, // host: true → accesible desde el celular en la misma red
  };
});
