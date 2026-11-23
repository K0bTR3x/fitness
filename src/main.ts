import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { applyTheme } from './lib/theme'
import { hideHostBadge } from './lib/hideHostBadge'
import './style.css'

applyTheme()
hideHostBadge()
createApp(App).use(createPinia()).use(router).mount('#app')
