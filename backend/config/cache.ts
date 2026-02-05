import { defineConfig, drivers, store } from '@adonisjs/cache'
import env from '#start/env'

const cacheConfig = defineConfig({
  default: (env.get('CACHE_DRIVER') || 'memory') as 'memory',

  stores: {
    memory: store().useL1Layer(drivers.memory({})),
  },
})

export default cacheConfig
declare module '@adonisjs/cache/types' {
  interface CacheStores extends InferStores<typeof cacheConfig> {}
}
