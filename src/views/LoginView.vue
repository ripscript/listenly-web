<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { Button } from '@/components/ui/button'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const form = reactive({ email: '', password: '' })
const submitting = ref(false)

async function submit() {
  submitting.value = true
  const ok = await auth.login({ email: form.email, password: form.password })
  submitting.value = false
  if (ok) {
    toast.success('Selamat datang kembali!')
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  }
}
</script>

<template>
  <div class="mx-auto mt-10 max-w-sm">
    <h1 class="mb-1 text-2xl font-semibold">Masuk</h1>
    <p class="mb-6 text-sm text-muted-foreground">Masuk untuk mendengarkan bersama.</p>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <div class="flex flex-col gap-1.5">
        <label for="email" class="text-sm font-medium">Email</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          required
          autocomplete="email"
          class="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="nama@email.com"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="password" class="text-sm font-medium">Password</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          required
          autocomplete="current-password"
          class="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="••••••••"
        />
      </div>

      <p v-if="auth.error" class="text-sm text-red-400" role="alert">{{ auth.error }}</p>

      <Button type="submit" :disabled="submitting || auth.loading">
        {{ submitting ? 'Memproses…' : 'Masuk' }}
      </Button>
    </form>

    <p class="mt-4 text-center text-sm text-muted-foreground">
      Belum punya akun?
      <RouterLink :to="{ name: 'register' }" class="text-primary underline-offset-4 hover:underline">
        Daftar
      </RouterLink>
    </p>
  </div>
</template>
