import { createRouter, createWebHistory, createMemoryHistory } from "vue-router"
import SearchView from "../views/SearchView.vue"

export function createRouterInstance(url, isClient) {
  return createRouter({
    history: isClient ? createWebHistory(import.meta.env.BASE_URL) : createMemoryHistory(url),
    routes: [
      {
        path: "/",
        component: SearchView,
      },
      {
        path: "/search",
        redirect: "/",
      },
    ],
  })
}
