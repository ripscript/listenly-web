<script setup lang="ts">
import { formatDuration, queueStatusLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/common/EmptyState.vue'
import type { QueueItem } from '@/types/api'

defineProps<{
  items: QueueItem[]
  currentTrackId: string | null
  isHost: boolean
  canRemove: (item: QueueItem) => boolean
}>()

const emit = defineEmits<{
  (e: 'play', item: QueueItem): void
  (e: 'remove', item: QueueItem): void
}>()

const statusClass: Record<string, string> = {
  pending: 'text-amber-300',
  ready: 'text-green-300',
  failed: 'text-red-300',
  played: 'text-muted-foreground',
}
</script>

<template>
  <div>
    <EmptyState
      v-if="items.length === 0"
      title="Antrian kosong"
      description="Cari lagu dan tambahkan untuk mulai mendengarkan."
    />
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="item in items"
        :key="item.uuid"
        class="flex items-center gap-3 rounded-lg border p-2"
        :class="
          item.track.uuid === currentTrackId
            ? 'border-primary bg-primary/10'
            : 'border-border bg-card'
        "
      >
        <img
          v-if="item.track.thumbnail_url"
          :src="item.track.thumbnail_url"
          alt=""
          class="h-10 w-16 shrink-0 rounded object-cover"
          loading="lazy"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ item.track.title }}</p>
          <p class="truncate text-xs text-muted-foreground">
            {{ item.track.artist || 'Tidak diketahui' }}
            <span v-if="item.track.duration_seconds">
              · {{ formatDuration(item.track.duration_seconds) }}
            </span>
            · <span :class="statusClass[item.status]">{{ queueStatusLabel(item.status) }}</span>
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <Button
            v-if="isHost && item.status === 'ready'"
            size="sm"
            variant="ghost"
            title="Putar lagu ini"
            @click="emit('play', item)"
          >
            Putar
          </Button>
          <Button
            v-if="canRemove(item)"
            size="icon-sm"
            variant="ghost"
            title="Hapus dari antrian"
            aria-label="Hapus dari antrian"
            @click="emit('remove', item)"
          >
            ✕
          </Button>
        </div>
      </li>
    </ul>
  </div>
</template>
