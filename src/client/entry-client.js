//import "./styles/main.css"
import { createApp } from "./main"

const pathname = typeof window !== "undefined" ? window.location.pathname : "/"

const { app, router } = createApp(pathname, true)

router.isReady().then(() => {
  app.mount("#app")
})
