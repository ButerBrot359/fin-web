import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    svgr({ include: '**/*.svg', svgrOptions: { exportType: 'default' } }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['dev.qazyna.ai', 'demo.qazyna.ai', 'qazyna.ai'],
  },
})
