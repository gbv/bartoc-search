import { createSSRApp } from "vue"
import App from "./App.vue"
import { createRouterInstance } from "./router/router"
import * as JSKOSVue from "jskos-vue"
import "jskos-vue/dist/style.css"

// SSR requires a fresh app instance per request, therefore we export a function
// that creates a fresh app instance. If using Vuex, we'd also be creating a
// fresh store here.
export function createApp(url = "/", isClient = false) {
  const app = createSSRApp(App)
  const router = createRouterInstance(url, isClient) // true = isClient
  app.use(router)
  
  // jskos-vue
  app.use(JSKOSVue)

  return { app, router }
}
