<script setup lang="ts">
/**
 * Audio player + playback sync (PRD US-07, §7.1, §8).
 *
 * - Members: audio follows the authoritative playback state. On remote
 *   playback_updated / GET playback (signalled via `seekSignal`), the player
 *   corrects drift when the local position is off by > 1.5s.
 * - Host: controls (play/pause/seek) push state through the store, which
 *   PUTs /rooms/:uuid/playback; the host's own audio follows the local state.
 * - Stream URL is fetched just before play and never cached (single-use); on
 *   failure it is re-requested.
 * - On track end, the host auto-advances the queue.
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoomStore, DRIFT_THRESHOLD_SECONDS } from '@/stores/room'
import { useToast } from '@/composables/useToast'
import { formatDuration } from '@/lib/format'
import { Button } from '@/components/ui/button'

const store = useRoomStore()
const toast = useToast()
const { playback, currentTrack, isHost, seekSignal, currentStreamUrl } = storeToRefs(store)

const audioEl = ref<HTMLAudioElement | null>(null)
const localTime = ref(0)
const duration = ref(0)
const buffering = ref(false)
const loadingStream = ref(false)
/** Guards against reacting to programmatic seeks as if they were user input. */
let suppressTimeUpdate = false

/** (Re)load the stream URL for the current track and apply the target state. */
async function loadAndSync() {
  const el = audioEl.value
  const track = currentTrack.value
  if (!el || !track) return

  loadingStream.value = true
  const url = await store.ensureStreamUrl()
  loadingStream.value = false
  if (!url) {
    toast.error('Gagal memuat audio, coba lagi.')
    return
  }
  if (el.src !== url) {
    el.src = url
    el.load()
  }
  applyTargetState()
}

/** Align the <audio> element to the authoritative playback state. */
function applyTargetState() {
  const el = audioEl.value
  if (!el) return
  const target = playback.value.position_seconds
  if (Number.isFinite(el.duration) && Math.abs(el.currentTime - target) > DRIFT_THRESHOLD_SECONDS) {
    suppressTimeUpdate = true
    el.currentTime = target
  }
  if (playback.value.is_playing) {
    void el.play().catch(() => {
      // Autoplay may be blocked until a user gesture; surface a hint.
      toast.info('Ketuk Putar untuk memulai audio.')
    })
  } else {
    el.pause()
  }
}

// Re-fetch stream + resync whenever the track changes.
watch(
  () => currentTrack.value?.uuid,
  (uuid) => {
    if (uuid) void loadAndSync()
    else if (audioEl.value) {
      audioEl.value.pause()
      audioEl.value.removeAttribute('src')
    }
  },
)

// React to play/pause changes in the authoritative state.
watch(
  () => playback.value.is_playing,
  () => applyTargetState(),
)

// Drift correction trigger: incremented on remote playback updates / resync.
watch(seekSignal, () => applyTargetState())

// --- audio element events ---

function onTimeUpdate() {
  const el = audioEl.value
  if (!el) return
  localTime.value = el.currentTime
  if (suppressTimeUpdate) suppressTimeUpdate = false
}

function onLoadedMetadata() {
  const el = audioEl.value
  if (el) duration.value = el.duration
}

function onEnded() {
  // Host drives auto-advance; members just wait for the next playback_updated.
  if (isHost.value) void store.advance()
}

function onError() {
  // Stream URLs expire; re-request on failure (PRD §7.1, §11).
  if (currentTrack.value) {
    currentStreamUrl.value = null
    void loadAndSync()
  }
}

function onWaiting() {
  buffering.value = true
}
function onPlaying() {
  buffering.value = false
}

// --- host controls ---

async function togglePlay() {
  const el = audioEl.value
  const pos = el ? el.currentTime : playback.value.position_seconds
  if (playback.value.is_playing) {
    await store.pause(pos)
  } else {
    // Ensure a fresh stream URL is loaded before starting.
    if (!currentStreamUrl.value) await loadAndSync()
    await store.play(pos)
  }
}

async function onSeek(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  await store.seek(value)
}

async function skipNext() {
  await store.advance()
}

onBeforeUnmount(() => {
  const el = audioEl.value
  if (el) {
    el.pause()
    el.removeAttribute('src')
  }
})
</script>

<template>
  <div class="rounded-xl border border-border bg-card p-4">
    <audio
      ref="audioEl"
      preload="auto"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onEnded"
      @error="onError"
      @waiting="onWaiting"
      @playing="onPlaying"
    />

    <div v-if="currentTrack" class="flex items-center gap-4">
      <img
        v-if="currentTrack.thumbnail_url"
        :src="currentTrack.thumbnail_url"
        alt=""
        class="h-16 w-24 shrink-0 rounded-md object-cover"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium">{{ currentTrack.title }}</p>
        <p class="truncate text-sm text-muted-foreground">
          {{ currentTrack.artist || 'Tidak diketahui' }}
          <span v-if="buffering || loadingStream"> · menyangga…</span>
        </p>
      </div>
    </div>
    <p v-else class="text-sm text-muted-foreground">
      Belum ada lagu yang diputar. {{ isHost ? 'Pilih lagu dari antrian.' : 'Menunggu host.' }}
    </p>

    <!-- Progress -->
    <div v-if="currentTrack" class="mt-4 flex items-center gap-3">
      <span class="w-10 text-right text-xs tabular-nums text-muted-foreground">
        {{ formatDuration(localTime) }}
      </span>
      <input
        type="range"
        min="0"
        :max="duration || currentTrack.duration_seconds || 0"
        :value="localTime"
        step="1"
        class="h-1.5 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed"
        :disabled="!isHost"
        aria-label="Posisi pemutaran"
        @change="onSeek"
      />
      <span class="w-10 text-xs tabular-nums text-muted-foreground">
        {{ formatDuration(duration || currentTrack.duration_seconds) }}
      </span>
    </div>

    <!-- Host controls -->
    <div v-if="isHost && currentTrack" class="mt-4 flex items-center gap-2">
      <Button size="sm" @click="togglePlay">
        {{ playback.is_playing ? 'Jeda' : 'Putar' }}
      </Button>
      <Button size="sm" variant="outline" @click="skipNext">Lewati</Button>
    </div>
    <p v-else-if="!isHost && currentTrack" class="mt-4 text-xs text-muted-foreground">
      Pemutaran dikontrol oleh host.
    </p>
  </div>
</template>
