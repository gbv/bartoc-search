import { createSSRApp } from "vue"
import App from "./App.vue"
import { createRouterInstance } from "./router/router"
import * as JSKOSVue from "jskos-vue"
import "jskos-vue/dist/style.css"
import { Namespaces } from "namespace-lookup" 
import LOOKUP_ENTRIES from "../../data/lookup_entries.json"

// SSR requires a fresh app instance per request, therefore we export a function
// that creates a fresh app instance. If using Vuex, we'd also be creating a
// fresh store here.
export function createApp(url = "/", isClient = false) {
  const app = createSSRApp(App)
  const router = createRouterInstance(url, isClient) // true = isClient
  app.use(router)
  
  // jskos-vue
  app.use(JSKOSVue)

  // Client-only: init a singleton Namespaces registry for URI lookup,
  // cache it on window to survive HMR, and provide it app-wide.
  if (isClient && typeof window !== "undefined") {
    let namespaces = window.__namespaces
    if (!namespaces) {
      namespaces = new Namespaces()
      
      // Adding data from lookup_entries.json
      for (const entry of LOOKUP_ENTRIES) {
        const label = entry.prefLabel?.en ?? entry.prefLabel?.de ?? entry.prefLabel?.und ?? ""

        // Add main uri
        if (entry.uri) {
          namespaces.add(entry.uri, label)
        }

        // Add identifiers
        if (Array.isArray(entry.identifier)) {
          for (const id of entry.identifier) {
            namespaces.add(id, label)
          }
        }

        // Add namespace
        if (entry.namespace) {
          namespaces.add(entry.namespace.trim(), label)
        }
      }
      window.__namespaces = namespaces // cache for HMR
    }
    app.provide("namespaces", namespaces)
    app.config.globalProperties.$namespaces = namespaces
  }

  return { app, router }
}
