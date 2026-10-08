<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { Button } from '@/components/ui/button'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const form = reactive({ full_name: '', email: '', password: '' })
const submitting = ref(false)

// Client-side mirror of backend validation (PRD §5.1).
const nameValid = computed(() => form.full_name.trim().length >= 2)
const passwordValid = computed(() => form.password.length >= 8)
const canSubmit = computed(() => nameValid.value && passwordValid.value && !!form.email)

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  const ok = await auth.register({
    full_name: form.full_name.trim(),
    email: form.email,
    password: form.password,
  })
  submitting.value = false
  if (ok) {
    toast.success('Akun berhasil dibuat!')
    router.push('/')
  }
}
</script>

<template>
  <div class="mx-auto mt-10 max-w-sm">
    <h1 class="mb-1 text-2xl font-semibold">Daftar</h1>
    <p class="mb-6 text-sm text-muted-foreground">Buat akun untuk mulai mendengarkan bersama.</p>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <div class="flex flex-col gap-1.5">
        <label for="full_name" class="text-sm font-medium">Nama lengkap</label>
        <input
          id="full_name"
          v-model="form.full_name"
          type="text"
          required
          autocomplete="name"
          class="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Nama kamu"
        />
        <p v-if="form.full_name && !nameValid" class="text-xs text-red-400">
          Nama minimal 2 karakter.
        </p>
      </div>

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
          autocomplete="new-password"
          class="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Minimal 8 karakter"
        />
        <p v-if="form.password && !passwordValid" class="text-xs text-red-400">
          Password minimal 8 karakter.
        </p>
      </div>

      <p v-if="auth.error" class="text-sm text-red-400" role="alert">{{ auth.error }}</p>

      <Button type="submit" :disabled="!canSubmit || submitting || auth.loading">
        {{ submitting ? 'Memproses…' : 'Daftar' }}
      </Button>
    </form>

    <p class="mt-4 text-center text-sm text-muted-foreground">
      Sudah punya akun?
      <RouterLink :to="{ name: 'login' }" class="text-primary underline-offset-4 hover:underline">
        Masuk
      </RouterLink>
    </p>
  </div>
</template>
