import HomeView from "../views/HomeView.vue"
import SearchView from "../views/SearchView.vue"

const routes = [
  {
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    path: "/search",
    name: "search",
    component: SearchView,
  },
]

export default routes
