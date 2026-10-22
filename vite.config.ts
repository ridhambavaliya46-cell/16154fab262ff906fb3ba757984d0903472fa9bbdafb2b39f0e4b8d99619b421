import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const rootDir = typeof import.meta.dirname !== 'undefined' ? import.meta.dirname : process.cwd();

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is enabled so local development gets fast feedback. It was disabled
      // for an AI Studio iframe deployment, which made the dev server watch
      // nothing and forced a manual restart after every edit.
      port: Number(process.env.VITE_PORT) || 5173,
      strictPort: false,
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react') || id.includes('@hugeicons')) return 'vendor-icons';
              if (id.includes('motion')) return 'vendor-motion';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
