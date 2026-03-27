import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Proxy Navidrome API in dev to avoid CORS (configure when backend URL is known)
      // '/api': { target: 'http://localhost:4533', changeOrigin: true },
    },
  },
});
