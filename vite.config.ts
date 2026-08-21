import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { qrcode } from 'vite-plugin-qrcode'
import packageJson from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
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

