import SearchView from "../views/SearchView.vue"

const routes = [
  {
    path: "/",
    name: "home",
    component: SearchView,
  },
  {
    path: "/search",
    redirect: "/",
  },
]

export default routes
