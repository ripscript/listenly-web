<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { Button } from '@/components/ui/button'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const initials = computed(() => {
  const name = auth.user?.full_name || auth.user?.email || '?'
  return name.trim().charAt(0).toUpperCase()
})

async function logout() {
  await auth.logout()
  toast.success('Berhasil keluar.')
  router.push({ name: 'login' })
}

async function logoutAll() {
  await auth.logoutAll()
  toast.success('Keluar dari semua perangkat.')
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
      <RouterLink :to="{ name: 'rooms' }" class="flex items-center gap-2 font-semibold">
        <span
          class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          ♪
        </span>
        <span>Listenly</span>
      </RouterLink>

      <nav class="flex items-center gap-2">
        <template v-if="auth.isAuthenticated">
          <RouterLink :to="{ name: 'rooms' }">
            <Button variant="ghost" size="sm">Room</Button>
          </RouterLink>
          <RouterLink :to="{ name: 'create-room' }">
            <Button variant="outline" size="sm">Buat Room</Button>
          </RouterLink>
          <span
            class="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium"
            :title="auth.user?.email"
          >
            {{ initials }}
          </span>
          <Button variant="ghost" size="sm" @click="logout">Keluar</Button>
          <Button variant="ghost" size="sm" title="Keluar dari semua perangkat" @click="logoutAll">
            Keluar semua
          </Button>
        </template>
      </nav>
    </div>
  </header>
</template>
