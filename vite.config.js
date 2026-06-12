import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this app from https://<user>.github.io/kgusystem/
export default defineConfig({
  plugins: [react()],
  base: '/kgusystem/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
