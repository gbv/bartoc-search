import { createRouter, createWebHistory, createMemoryHistory } from "vue-router"
import routes from "./routes"

export function createRouterInstance(url, isClient) {
  return createRouter({
    history: isClient ? createWebHistory(import.meta.env.BASE_URL) : createMemoryHistory(url),
    routes,
  })
}
