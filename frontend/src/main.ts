import { MarkdownCodeBlockNode, setCustomComponents } from 'markstream-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import i18n from './i18n'
import router from './router'
import '@/style.css'
import 'vue-sonner/style.css'

import '@/lib/monaco'
import 'stream-markdown'

import 'shiki'

setCustomComponents({
  code_block: MarkdownCodeBlockNode,
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

app.mount('#app')
