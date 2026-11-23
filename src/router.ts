import { createRouter, createWebHashHistory } from 'vue-router'
import { useApp } from './stores/app'

// Hash rejimi: ana ekrandakı iPhone tətbiqində və önizləmədə eyni işləyir.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/giris', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/', component: () => import('./views/TodayView.vue'), meta: { nav: 'today' } },
    { path: '/qeyd', component: () => import('./views/QuickLogView.vue') },
    { path: '/seher', component: () => import('./views/MorningView.vue') },
    { path: '/teqvim/:date?', component: () => import('./views/CalendarView.vue'), meta: { nav: 'food' } },
    { path: '/zal', component: () => import('./views/GymView.vue') },
    { path: '/gunu-bagla/:date?', component: () => import('./views/CloseDayView.vue') },
    { path: '/reseptler/:id?', component: () => import('./views/RecipesView.vue'), meta: { nav: 'food' } },
    { path: '/alis-veris', component: () => import('./views/ShoppingView.vue'), meta: { nav: 'food' } },
    { path: '/deyis/:slot?', component: () => import('./views/SwapView.vue') },
    { path: '/inkisaf', component: () => import('./views/ProgressView.vue'), meta: { nav: 'progress', title: 'İnkişaf' } },
    { path: '/mukafatlar', component: () => import('./views/RewardsView.vue'), meta: { nav: 'rewards', title: 'Mükafatlar' } },
    { path: '/:p(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const app = useApp()
  if (to.meta.public) return true
  if (!app.email && !(await app.checkSession())) return '/giris'
  return true
})
