import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { qrcode } from 'vite-plugin-qrcode'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    qrcode()
  ],
  server: {
    host: true,
  },
  test: {
    environment: 'jsdom',
  },
})

