<script setup lang="ts">
import { ref } from 'vue'
import { musicService } from '@/services/musicService'
import { ApiError } from '@/lib/http'
import { formatDuration } from '@/lib/format'
import { useToast } from '@/composables/useToast'
import Spinner from '@/components/common/Spinner.vue'
import { Button } from '@/components/ui/button'
import type { YoutubeSearchResult } from '@/types/api'

const emit = defineEmits<{ (e: 'request', youtubeVideoId: string): void }>()

const toast = useToast()
const query = ref('')
const results = ref<YoutubeSearchResult[]>([])
const loading = ref(false)
const searched = ref(false)
const addingId = ref<string | null>(null)

async function search() {
  const q = query.value.trim()
  if (!q) return
  loading.value = true
  searched.value = true
  try {
    results.value = await musicService.searchYoutube(q)
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : 'Pencarian gagal.')
    results.value = []
  } finally {
    loading.value = false
  }
}

async function add(result: YoutubeSearchResult) {
  addingId.value = result.youtube_video_id
  emit('request', result.youtube_video_id)
  // Parent clears via toast; brief local feedback window.
  setTimeout(() => {
    if (addingId.value === result.youtube_video_id) addingId.value = null
  }, 1200)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <form class="flex gap-2" @submit.prevent="search">
      <input
        v-model="query"
        type="search"
        class="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Cari lagu di YouTube…"
        aria-label="Cari lagu"
      />
      <Button type="submit" :disabled="!query.trim() || loading">Cari</Button>
    </form>

    <div v-if="loading" class="py-6 text-center">
      <Spinner>Mencari…</Spinner>
    </div>

    <ul v-else-if="results.length" class="flex flex-col gap-2">
      <li
        v-for="r in results"
        :key="r.youtube_video_id"
        class="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
      >
        <img
          v-if="r.thumbnail_url"
          :src="r.thumbnail_url"
          alt=""
          class="h-10 w-16 shrink-0 rounded object-cover"
          loading="lazy"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ r.title }}</p>
          <p class="truncate text-xs text-muted-foreground">
            {{ r.artist || r.channel || 'YouTube' }}
            <span v-if="r.duration_seconds"> · {{ formatDuration(r.duration_seconds) }}</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          :disabled="addingId === r.youtube_video_id"
          @click="add(r)"
        >
          {{ addingId === r.youtube_video_id ? 'Ditambah' : 'Tambah' }}
        </Button>
      </li>
    </ul>

    <p v-else-if="searched" class="py-6 text-center text-sm text-muted-foreground">
      Tidak ada hasil untuk "{{ query }}".
    </p>
  </div>
</template>
