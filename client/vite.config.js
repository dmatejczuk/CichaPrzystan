import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API_URL points to the Express server (http://server:3000 inside Docker Compose).
const apiUrl = process.env.API_URL || 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': apiUrl,
      '/dead-zones': apiUrl,
    },
  },
})
