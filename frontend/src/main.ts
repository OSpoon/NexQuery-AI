import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { MarkdownCodeBlockNode, setCustomComponents } from 'markstream-vue'

import '@/style.css'
import 'vue-sonner/style.css'
import '@/lib/monaco'
import 'stream-markdown'
import 'shiki'

import App from './App.vue'
import router from './router'

import i18n from './i18n'

setCustomComponents({
  code_block: MarkdownCodeBlockNode,
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

app.mount('#app')
