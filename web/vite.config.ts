/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Bind IPv4 explicitly: Node's default "localhost" may bind ::1 only, which Chrome failed to load.
  server: { port: 5173, strictPort: true, host: '127.0.0.1' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    env: { VITE_API_BASE_URL: 'http://gateway.test' },
  },
});
