import Vue from 'vue'
import VueRouter from 'vue-router'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import App from './App.vue'

Vue.use(VueRouter)
Vue.use(ElementUI)

const routes = [
  {
    path: '/',
    redirect: '/credit-stats'
  },
  {
    path: '/credit-stats',
    name: 'credit-stats',
    component: () => import('./pages/credit-history-stats/index.vue')
  }
]

const router = new VueRouter({
  mode: 'history',
  routes
})

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
