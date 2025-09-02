import { createSSRApp } from "vue"
import App from "./App.vue"
import { createRouterInstance } from "./router/router"
import * as JSKOSVue from "jskos-vue"
import "jskos-vue/dist/style.css"
import { Namespaces } from "namespace-lookup" 

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
    // Reuse across HMR
    const namespaces = (window.__namespaces ??= new Namespaces())
    const baseUrl = import.meta.env.BASE_URL || "/"


    // Populate once per page load
    if (!window.__namespacesPopulated) {
      (async () => {
        try {
          const res = await fetch(`${baseUrl}data/lookup_entries.json`, {
            // rely on browser cache/ETag; change to "no-cache" if you want a revalidate
            cache: "force-cache",
          })
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`)
          }
          const entries = await res.json()

          for (const entry of entries) {
            const label =
              entry?.prefLabel?.en ??
              entry?.prefLabel?.de ??
              entry?.prefLabel?.und ??
              ""

            // main uri
            if (entry?.uri) {
              namespaces.add(entry.uri, label)
            }

            // identifiers (filter null/empty)
            if (Array.isArray(entry?.identifier)) {
              for (const id of entry.identifier) {
                if (id && typeof id === "string" && id.trim()) {
                  namespaces.add(id, label)
                }
              }
            }

            // namespace
            if (entry?.namespace && typeof entry.namespace === "string") {
              const ns = entry.namespace.trim()
              if (ns) {
                namespaces.add(ns, label)
              }
            }
          }

          window.__namespacesPopulated = true
        } catch (e) {
          console.warn("Failed to load /data/lookup_entries.json:", e)
        }
      })()
    }

    app.provide("namespaces", namespaces)
    app.config.globalProperties.$namespaces = namespaces
  }

  return { app, router }
}
