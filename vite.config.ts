import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'node:path';

// Vite + React 19 + TanStack Router (file-based, generated route tree).
// The router plugin watches src/routes/**/*.tsx and regenerates routeTree.gen.ts.
// Employee dash runs on :5174 to avoid colliding with panwar_client_dash on :5173.
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 5174,
    strictPort: true,
  },
});
