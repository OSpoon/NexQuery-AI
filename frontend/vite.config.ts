import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '')
  process.env = { ...env, ...process.env }

  return {
    envPrefix: ['VITE_', 'API_ENCRYPTION_'],
    plugins: [
      vue(),
      tailwindcss(),
      vueDevTools(),
    ],
    optimizeDeps: {
      include: ['stream-markdown', 'shiki'],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    server: {
      allowedHosts: true, // Allow any host (for ngrok)
      port: 3000,
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3333',
          changeOrigin: true,
        },
      },
    },
  }
})
