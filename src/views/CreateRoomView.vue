<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '@/stores/rooms'
import { useToast } from '@/composables/useToast'
import { Button } from '@/components/ui/button'
import type { RoomVisibility } from '@/types/api'

const rooms = useRoomsStore()
const router = useRouter()
const toast = useToast()

const form = reactive<{ name: string; visibility: RoomVisibility }>({
  name: '',
  visibility: 'public',
})
const submitting = ref(false)

// Backend requires name length 3..100 (PRD §5.2).
const nameValid = computed(() => {
  const len = form.name.trim().length
  return len >= 3 && len <= 100
})

async function submit() {
  if (!nameValid.value) return
  submitting.value = true
  const created = await rooms.create({ name: form.name.trim(), visibility: form.visibility })
  submitting.value = false
  if (created) {
    toast.success(`Room "${created.name}" dibuat.`)
    router.push({ name: 'room', params: { uuid: created.uuid } })
  } else if (rooms.error) {
    toast.error(rooms.error)
  }
}
</script>

<template>
  <section class="mx-auto max-w-md">
    <h1 class="mb-1 text-2xl font-semibold">Buat Room</h1>
    <p class="mb-6 text-sm text-muted-foreground">Mulai sesi dengar bersama.</p>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <div class="flex flex-col gap-1.5">
        <label for="name" class="text-sm font-medium">Nama room</label>
        <input
          id="name"
          v-model="form.name"
          type="text"
          required
          maxlength="100"
          class="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Misal: Santai Sore"
        />
        <p v-if="form.name && !nameValid" class="text-xs text-red-400">
          Nama room harus 3–100 karakter.
        </p>
      </div>

      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1 text-sm font-medium">Visibilitas</legend>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.visibility" type="radio" value="public" />
          Publik — siapa saja bisa menemukan & bergabung
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.visibility" type="radio" value="private" />
          Privat — hanya lewat kode / link undangan
        </label>
      </fieldset>

      <p v-if="rooms.error" class="text-sm text-red-400" role="alert">{{ rooms.error }}</p>

      <div class="flex gap-2">
        <Button type="submit" :disabled="!nameValid || submitting">
          {{ submitting ? 'Membuat…' : 'Buat Room' }}
        </Button>
        <RouterLink :to="{ name: 'rooms' }">
          <Button type="button" variant="ghost">Batal</Button>
        </RouterLink>
      </div>
    </form>
  </section>
</template>
