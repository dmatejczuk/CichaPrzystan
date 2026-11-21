import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API_URL points to the Express server (http://server:3000 inside Docker Compose).
const apiUrl = process.env.API_URL || 'http://localhost:3000'
// File change events do not reach containers through Windows bind mounts, so Docker Compose enables polling.
const usePolling = process.env.VITE_USE_POLLING === 'true'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '/api': apiUrl,
      '/dead-zones': apiUrl,
    },
  },
})
