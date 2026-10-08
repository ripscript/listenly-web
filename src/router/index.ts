/**
 * App routing (PRD §7.2). Protected routes require a session; auth routes
 * redirect away when already logged in. The /join/:token route handles
 * invite links (PRD Sprint 5).
 */
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router'
import { tokenStorage } from '@/lib/tokenStorage'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/',
    name: 'rooms',
    component: () => import('@/views/RoomsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/rooms/new',
    name: 'create-room',
    component: () => import('@/views/CreateRoomView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/rooms/:uuid',
    name: 'room',
    component: () => import('@/views/RoomView.vue'),
    meta: { requiresAuth: true },
    props: true,
  },
  {
    path: '/join/:token',
    name: 'join',
    component: () => import('@/views/JoinView.vue'),
    meta: { requiresAuth: true },
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const authed = !!tokenStorage.getAccessToken()
  if (to.meta.requiresAuth && !authed) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && authed) {
    return { name: 'rooms' }
  }
  return true
})
