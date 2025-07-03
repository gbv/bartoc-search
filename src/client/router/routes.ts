import HomeView from '../views/HomeView.vue'
import SearchView from '../views/SearchView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/search',
    name: 'search',
    component: SearchView,
  },
  {
    path: '/about',
    name: 'about',
    // Lazy-loaded when the route is visited.
    component: () => import('../views/AboutView.vue'),
  },
]

export default routes
