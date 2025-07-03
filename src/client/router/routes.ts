import HomeView from '../views/HomeView.vue'
import SearchView from '../views/SearchView.vue'
import AboutView from '../views/AboutView.vue'

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
    component: AboutView,
  },
]

export default routes
