import uniPlugin from '@dcloudio/vite-plugin-uni'
import AutoImport from 'unplugin-auto-import/vite'

import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

// @ts-expect-error missing types
const uni = uniPlugin.default || uniPlugin

// https://vitejs.dev/config/
export default defineConfig({
  envPrefix: ['VITE_', 'API_ENCRYPTION_'],
  plugins: [
    uni(),
    AutoImport({
      imports: ['vue', 'uni-app'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      dts: 'src/components.d.ts',
    }),
  ],
})
