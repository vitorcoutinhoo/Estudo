import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // API_PORT deve bater com server.port do config.yaml do backend.
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8080}` },
  },
})
