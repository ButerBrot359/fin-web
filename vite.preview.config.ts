import { defineConfig } from 'vite'

export default defineConfig({
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['dev.qazyna.ai', 'demo.qazyna.ai', 'qazyna.ai'],
  },
})
