import './style.css'
import { createApp } from './main'

const { app, router } = createApp(window.location.pathname, true) // <-- ✅ isClient = true

router.isReady().then(() => {
  app.mount('#app')
})
