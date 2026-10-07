<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppNav from '@/components/layout/AppNav.vue'
import ToastHost from '@/components/common/ToastHost.vue'
import { onAuthFailure } from '@/lib/http'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// When the HTTP layer can't recover the session, clear and redirect to login.
onAuthFailure(() => {
  auth.clearSession()
  if (route.name !== 'login') {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
  }
})

onMounted(() => {
  // Validate persisted session on boot (silent; interceptor handles refresh).
  if (auth.isAuthenticated) {
    void auth.fetchMe()
  }
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <AppNav />
    <main class="mx-auto max-w-5xl px-4 py-6">
      <RouterView />
    </main>
    <ToastHost />
  </div>
</template>
