import { createSSRApp } from "vue"
import App from "./App.vue"
import { createRouterInstance } from "./router/router"
import * as JSKOSVue from "jskos-vue"
import "jskos-vue/dist/style.css"
import { Namespaces } from "namespace-lookup" 
import NAMESPACE_ENTRIES from "../../data/namespaces_entries.json"
import IDENTIFIER_ENTRIES from "../../data/identifiers_entries.json"




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
      const seen = new Set()
      
      // Adding data from namespaces_entries.json
      for (const { namespace, prefLabel } of NAMESPACE_ENTRIES) {
        const ns = (namespace || "").trim()
        if (!ns || seen.has(ns)) {
          continue
        }
        const label = prefLabel?.en ?? prefLabel?.de ?? prefLabel?.und ?? ""
        namespaces.add(ns, label)
        seen.add(ns)
      }

      // Adding data from identifiers_entries.json
      for (const { identifier, prefLabel } of IDENTIFIER_ENTRIES) {
        const id = (identifier || "").trim()
        if (!id || seen.has(id)) {
          continue
        }
        const label = prefLabel?.en ?? prefLabel?.de ?? prefLabel?.und ?? ""
        namespaces.add(id, label)
        seen.add(id)
      }

      window.__namespaces = namespaces // cache for HMR
    }
    app.provide("namespaces", namespaces)
    app.config.globalProperties.$namespaces = namespaces
  }

  return { app, router }
}
