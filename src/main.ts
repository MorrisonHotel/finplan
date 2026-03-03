import { createApp } from 'vue'
import { createPinia } from 'pinia'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import './assets/github-theme.css'

import App from './App.vue'
import { useAppStore } from './stores/app.store'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Инициализация демо-данных при первом запуске
const store = useAppStore()
store.initDemoData()

app.mount('#app')
