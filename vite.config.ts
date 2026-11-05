import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Duas páginas: o app (catálogo, /adm, logística, rastreio) e o gerador de cartazes
      input: {
        main: resolve(__dirname, 'index.html'),
        cartaz: resolve(__dirname, 'cartaz.html'),
      },
    },
  },
});
