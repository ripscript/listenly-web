<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '@/stores/rooms'
import { useToast } from '@/composables/useToast'
import Spinner from '@/components/common/Spinner.vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{ token: string }>()
const rooms = useRoomsStore()
const router = useRouter()
const toast = useToast()

const state = ref<'joining' | 'error'>('joining')

async function attempt() {
  state.value = 'joining'
  const joined = await rooms.joinByInvite({ invite_token: props.token })
  if (joined) {
    toast.success(`Bergabung ke "${joined.name}".`)
    router.replace({ name: 'room', params: { uuid: joined.uuid } })
  } else {
    state.value = 'error'
  }
}

onMounted(attempt)
</script>

<template>
  <section class="mx-auto mt-16 max-w-md text-center">
    <div v-if="state === 'joining'" class="flex flex-col items-center gap-3">
      <Spinner :size="28">Bergabung ke room…</Spinner>
    </div>
    <div v-else class="flex flex-col items-center gap-4">
      <h1 class="text-xl font-semibold">Undangan tidak valid</h1>
      <p class="text-sm text-muted-foreground">
        {{ rooms.error || 'Link undangan ini kedaluwarsa atau tidak berlaku.' }}
      </p>
      <div class="flex gap-2">
        <Button @click="attempt">Coba lagi</Button>
        <RouterLink :to="{ name: 'rooms' }">
          <Button variant="outline">Ke daftar room</Button>
        </RouterLink>
      </div>
    </div>
  </section>
</template>
