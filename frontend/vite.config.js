import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api goes to the FastAPI backend (run it on port 8000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8000' },
  },
});
