import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // add proxy for API and websocket requests (useful for local dev)
        proxy: {
          '/api': {
            // when running frontend locally, backend runs on localhost:8080
            target: 'http://localhost:8080',
            changeOrigin: true,
          },
          '/ws': {
            // proxy websocket upgrade requests to backend
            target: 'ws://localhost:8080',
            ws: true,
            changeOrigin: true,
            secure: false,
          },
      },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
      ,
      // Prevent eval-based sourcemaps in production builds which can trigger CSP 'unsafe-eval' needs
      build: {
        sourcemap: false
      }
    };
    
});
