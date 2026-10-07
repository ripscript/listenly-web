<script setup lang="ts">
import type { RoomResponse } from '@/types/api'
import { Button } from '@/components/ui/button'

defineProps<{
  room: RoomResponse
  showJoin?: boolean
  joining?: boolean
}>()

const emit = defineEmits<{ (e: 'join', room: RoomResponse): void }>()
</script>

<template>
  <div class="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h3 class="truncate font-medium">{{ room.name }}</h3>
        <span
          class="rounded-full border px-2 py-0.5 text-xs"
          :class="
            room.visibility === 'public'
              ? 'border-green-500/40 text-green-300'
              : 'border-amber-500/40 text-amber-300'
          "
        >
          {{ room.visibility === 'public' ? 'Publik' : 'Privat' }}
        </span>
      </div>
      <p class="mt-1 text-xs text-muted-foreground">
        {{ room.member_count }} anggota · {{ room.online_count }} online
      </p>
    </div>

    <div class="flex shrink-0 gap-2">
      <RouterLink :to="{ name: 'room', params: { uuid: room.uuid } }">
        <Button variant="outline" size="sm">Buka</Button>
      </RouterLink>
      <Button
        v-if="showJoin"
        size="sm"
        :disabled="joining"
        @click="emit('join', room)"
      >
        {{ joining ? 'Bergabung…' : 'Gabung' }}
      </Button>
    </div>
  </div>
</template>
