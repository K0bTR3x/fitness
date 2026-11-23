import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { applyTheme } from './lib/theme'
import './style.css'

applyTheme()
createApp(App).use(createPinia()).use(router).mount('#app')
