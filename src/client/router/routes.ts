import HomeView from '../views/HomeView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/about',
    name: 'about',
    // Lazy-loaded when the route is visited.
    component: () => import('../views/AboutView.vue'),
  },
]

export default routes
