<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { useToast } from '@/composables/useToast'
import AudioPlayer from '@/components/room/AudioPlayer.vue'
import QueueList from '@/components/room/QueueList.vue'
import SearchPanel from '@/components/room/SearchPanel.vue'
import InvitePanel from '@/components/room/InvitePanel.vue'
import Spinner from '@/components/common/Spinner.vue'
import { Button } from '@/components/ui/button'
import type { QueueItem } from '@/types/api'

const props = defineProps<{ uuid: string }>()
const store = useRoomStore()
const router = useRouter()
const toast = useToast()

const { room, sortedQueue, playback, isHost, loading, error, wsStatus } = storeToRefs(store)

const wsLabel = computed(() => {
  switch (wsStatus.value) {
    case 'open':
      return 'Tersambung'
    case 'connecting':
      return 'Menyambung…'
    case 'reconnecting':
      return 'Menyambung ulang…'
    default:
      return 'Terputus'
  }
})

const wsClass = computed(() =>
  wsStatus.value === 'open'
    ? 'bg-green-500'
    : wsStatus.value === 'closed'
      ? 'bg-red-500'
      : 'bg-amber-500',
)

async function enter(uuid: string) {
  const ok = await store.loadRoom(uuid)
  if (!ok) {
    toast.error(store.error || 'Room tidak ditemukan.')
    router.replace({ name: 'rooms' })
    return
  }
  store.connectRealtime()
}

onMounted(() => void enter(props.uuid))

// Support navigating directly between rooms without a full remount.
watch(
  () => props.uuid,
  (next, prev) => {
    if (next && next !== prev) {
      store.teardown()
      void enter(next)
    }
  },
)

onBeforeUnmount(() => store.teardown())

async function requestTrack(youtubeVideoId: string) {
  const ok = await store.requestTrack(youtubeVideoId)
  if (ok) toast.success('Lagu ditambahkan ke antrian.')
  else if (store.error) toast.error(store.error)
}

async function removeItem(item: QueueItem) {
  const ok = await store.removeQueueItem(item.uuid)
  if (ok) toast.success('Lagu dihapus dari antrian.')
  else if (store.error) toast.error(store.error)
}

async function playItem(item: QueueItem) {
  await store.playItem(item)
}

async function leave() {
  const ok = await store.leave()
  if (ok) {
    toast.success('Kamu keluar dari room.')
    router.push({ name: 'rooms' })
  } else if (store.error) {
    toast.error(store.error)
  }
}
</script>

<template>
  <div>
    <div v-if="loading && !room" class="py-20 text-center">
      <Spinner :size="28">Memuat room…</Spinner>
    </div>

    <div v-else-if="error && !room" class="py-20 text-center">
      <p class="text-sm text-muted-foreground">{{ error }}</p>
      <RouterLink :to="{ name: 'rooms' }" class="mt-4 inline-block">
        <Button variant="outline">Kembali</Button>
      </RouterLink>
    </div>

    <div v-else-if="room" class="flex flex-col gap-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-semibold">{{ room.name }}</h1>
            <span
              class="rounded-full border px-2 py-0.5 text-xs"
              :class="
                room.visibility === 'public'
                  ? 'border-green-500/40 text-green-700 dark:text-green-300'
                  : 'border-amber-500/40 text-amber-700 dark:text-amber-300'
              "
            >
              {{ room.visibility === 'public' ? 'Publik' : 'Privat' }}
            </span>
            <span v-if="isHost" class="rounded-full border border-primary/40 px-2 py-0.5 text-xs text-primary">
              Host
            </span>
          </div>
          <p class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full" :class="wsClass" aria-hidden="true" />
              {{ wsLabel }}
            </span>
            · {{ room.member_count }} anggota · {{ room.online_count }} online
          </p>
        </div>

        <!-- Host must not leave (PRD §6c): hide the leave button for host. -->
        <Button v-if="!isHost" variant="ghost" size="sm" @click="leave">Keluar room</Button>
      </div>

      <div class="grid gap-6 lg:grid-cols-5">
        <!-- Left: player + search -->
        <div class="flex flex-col gap-6 lg:col-span-3">
          <AudioPlayer />

          <section>
            <h2 class="mb-2 text-sm font-medium text-muted-foreground">Tambah lagu</h2>
            <SearchPanel @request="requestTrack" />
          </section>
        </div>

        <!-- Right: queue + invite -->
        <div class="flex flex-col gap-6 lg:col-span-2">
          <InvitePanel v-if="isHost" :room="room" />

          <section>
            <h2 class="mb-2 text-sm font-medium text-muted-foreground">
              Antrian ({{ sortedQueue.length }})
            </h2>
            <QueueList
              :items="sortedQueue"
              :current-track-id="playback.current_track_id"
              :is-host="isHost"
              :can-remove="store.canRemoveItem"
              @play="playItem"
              @remove="removeItem"
            />
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
