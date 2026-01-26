import type { UserConfig } from 'vite'
import process from 'node:process'

import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'

import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'
import Inspect from 'vite-plugin-inspect'
import vueDevTools from 'vite-plugin-vue-devtools'

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
      AutoImport({
        imports: [
          'vue',
          'vue-router',
          'pinia',
          '@vueuse/core',
        ],
        dts: 'src/auto-imports.d.ts',
        dirs: ['./src/composables', './src/stores'],
        vueTemplate: true,
      }),
      Components({
        dts: 'src/components.d.ts',
        dirs: ['src/components'],
        extensions: ['vue'],
      }),
      Inspect(),
    ],
    optimizeDeps: {
      include: ['stream-markdown', 'shiki'],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        'vue': 'vue/dist/vue.esm-bundler.js',
      },
    },
    server: {
      allowedHosts: true, // Allow any host (for ngrok)
      port: 3000,
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3008',
          changeOrigin: true,
        },
      },
    },
  } as UserConfig
})
