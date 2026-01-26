import CryptoJS from 'crypto-js'
import { createSSRApp } from 'vue'
import App from './App.vue'

// --- NexQuery: WeChat Mini Program Crypto Fix ---
try {
  const lib = (CryptoJS as any).lib
  if (lib && lib.WordArray) {
    lib.WordArray.random = function (nBytes: number) {
      const words = []
      for (let i = 0; i < nBytes; i += 4) {
        words.push(Math.floor(Math.random() * 0x100000000))
      }
      return lib.WordArray.create(words, nBytes)
    }
  }
}
catch (e) {
  console.error('NexQuery: Main entry - Failed to patch CryptoJS', e)
}
// -----------------------------------------------

export function createApp() {
  const app = createSSRApp(App)
  return {
    app,
  }
}
