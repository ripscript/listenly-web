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
 *   failure it is re-requested ONCE per track to avoid request storms.
 * - Browser autoplay is gated behind a user gesture: when a programmatic
 *   play() is blocked we flag `needsGesture` and show an inline button
 *   instead of spamming toasts.
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
/** True when the browser blocked autoplay and we need a user gesture. */
const needsGesture = ref(false)

/** Guards against reacting to programmatic seeks as if they were user input. */
let suppressTimeUpdate = false
/** The track uuid whose stream URL is currently loaded into the element. */
let loadedTrackUuid: string | null = null
/**
 * The exact stream URL string we assigned to `el.src`. We compare against this
 * instead of `el.src`, because the browser normalizes `el.src` to an absolute,
 * re-encoded URL that never byte-matches the raw backend URL — which would make
 * the "already loaded" check always fail and re-fetch a new single-use stream
 * URL on every sync, causing a request storm + endless re-buffering.
 */
let loadedStreamUrl: string | null = null
/** How many times we've retried the stream for the current track (cap at 1). */
let streamRetries = 0
/** Prevent overlapping loadAndSync() runs. */
let loading = false

/**
 * Ensure the <audio> element has a fresh stream URL for the current track.
 * Only (re)fetches when the track changed or we have no URL yet.
 */
async function ensureLoaded(force = false): Promise<boolean> {
  const el = audioEl.value
  const track = currentTrack.value
  if (!el || !track) return false
  if (loading) return !!currentStreamUrl.value

  const alreadyLoaded =
    !force &&
    loadedTrackUuid === track.uuid &&
    !!loadedStreamUrl &&
    loadedStreamUrl === currentStreamUrl.value
  if (alreadyLoaded) return true

  loading = true
  loadingStream.value = true
  try {
    const url = await store.ensureStreamUrl()
    if (!url) return false
    if (loadedStreamUrl !== url) {
      el.src = url
      el.load()
      loadedStreamUrl = url
    }
    loadedTrackUuid = track.uuid
    return true
  } finally {
    loading = false
    loadingStream.value = false
  }
}

/** Seek the element to the authoritative position if drift exceeds threshold. */
function correctDrift() {
  const el = audioEl.value
  if (!el) return
  const target = playback.value.position_seconds
  if (
    Number.isFinite(el.duration) &&
    Math.abs(el.currentTime - target) > DRIFT_THRESHOLD_SECONDS
  ) {
    suppressTimeUpdate = true
    el.currentTime = target
  }
}

/**
 * Try to make the element match the authoritative play/pause state.
 * `userInitiated` is true only when called from a real click handler, which is
 * the only time the browser reliably allows audio to start.
 */
async function syncPlayback(userInitiated = false) {
  const el = audioEl.value
  if (!el || !currentTrack.value) return

  if (playback.value.is_playing) {
    const ok = await ensureLoaded()
    if (!ok) return
    correctDrift()
    try {
      await el.play()
      needsGesture.value = false
    } catch {
      // Autoplay blocked. If this came from a user gesture, something else is
      // wrong; otherwise flag that a tap is required (no toast spam).
      if (!userInitiated) needsGesture.value = true
    }
  } else {
    el.pause()
    correctDrift()
  }
}

// Re-fetch stream + resync whenever the track changes.
watch(
  () => currentTrack.value?.uuid,
  (uuid) => {
    streamRetries = 0
    loadedTrackUuid = null
    loadedStreamUrl = null
    const el = audioEl.value
    if (!uuid) {
      if (el) {
        el.pause()
        el.removeAttribute('src')
      }
      return
    }
    void syncPlayback(false)
  },
)

// React to play/pause changes in the authoritative state.
watch(
  () => playback.value.is_playing,
  () => void syncPlayback(false),
)

// Drift correction trigger: incremented on remote playback updates / resync.
watch(seekSignal, () => {
  correctDrift()
  void syncPlayback(false)
})

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

/** Map a MediaError code to a readable name for diagnostics. */
function mediaErrorName(code: number | undefined): string {
  switch (code) {
    case 1:
      return 'MEDIA_ERR_ABORTED'
    case 2:
      return 'MEDIA_ERR_NETWORK'
    case 3:
      return 'MEDIA_ERR_DECODE'
    case 4:
      return 'MEDIA_ERR_SRC_NOT_SUPPORTED'
    default:
      return `UNKNOWN(${code})`
  }
}

/**
 * Diagnostic probe: fetch the stream URL directly so we can see the HTTP
 * status, content-type, CORS behaviour, and whether range requests are honored.
 * This is logging only — it doesn't change playback behaviour.
 */
async function debugProbeStream(url: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.group('[AudioPlayer] stream probe')
  // eslint-disable-next-line no-console
  console.log('url:', url)
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-1' } })
    // eslint-disable-next-line no-console
    console.log('status:', res.status, res.statusText)
    // eslint-disable-next-line no-console
    console.log('type (response):', res.type) // "cors" | "opaque" | "basic"...
    // eslint-disable-next-line no-console
    console.log('content-type:', res.headers.get('content-type'))
    // eslint-disable-next-line no-console
    console.log('content-length:', res.headers.get('content-length'))
    // eslint-disable-next-line no-console
    console.log('accept-ranges:', res.headers.get('accept-ranges'))
    // eslint-disable-next-line no-console
    console.log('content-range:', res.headers.get('content-range'))
    // eslint-disable-next-line no-console
    console.log('access-control-allow-origin:', res.headers.get('access-control-allow-origin'))
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('audio/') && !ct.includes('mpegurl') && !ct.includes('octet-stream')) {
      // Likely an HTML/JSON error page returned with 200 — show a snippet.
      const text = await res.clone().text()
      // eslint-disable-next-line no-console
      console.warn('non-audio body (first 300 chars):', text.slice(0, 300))
    }
  } catch (e) {
    // A thrown TypeError here almost always means CORS blocked the request.
    // eslint-disable-next-line no-console
    console.error('probe fetch failed (likely CORS or network):', e)
  }
  // eslint-disable-next-line no-console
  console.groupEnd()
}

async function onError() {
  // Ignore errors when there is no real source loaded yet.
  const el = audioEl.value
  if (!el || !currentTrack.value || !el.src) return

  // --- Diagnostics (temporary): surface WHY the <audio> failed. ---
  const merr = el.error
  // eslint-disable-next-line no-console
  console.error(
    '[AudioPlayer] load error:',
    mediaErrorName(merr?.code),
    '| message:',
    merr?.message || '(none)',
    '| networkState:',
    el.networkState,
    '| readyState:',
    el.readyState,
    '| src:',
    el.currentSrc || el.src,
  )
  const probeUrl = currentStreamUrl.value || el.currentSrc || el.src
  if (probeUrl) void debugProbeStream(probeUrl)
  // --- end diagnostics ---

  // Stream URLs expire; re-request ONCE per track to avoid an infinite loop
  // of /stream calls (PRD §7.1, §11).
  if (streamRetries >= 1) {
    toast.error('Gagal memuat audio untuk lagu ini.')
    return
  }
  streamRetries++
  currentStreamUrl.value = null
  loadedTrackUuid = null
  loadedStreamUrl = null
  const ok = await ensureLoaded(true)
  if (ok) void syncPlayback(false)
}

function onWaiting() {
  buffering.value = true
}
function onPlaying() {
  buffering.value = false
  needsGesture.value = false
}

// --- controls ---

/** Host: toggle play/pause (pushes authoritative state through the store). */
async function togglePlay() {
  const el = audioEl.value
  const pos = el ? el.currentTime : playback.value.position_seconds
  if (playback.value.is_playing) {
    await store.pause(pos)
  } else {
    await ensureLoaded()
    await store.play(pos)
    // We are inside a user gesture now; start audio directly.
    await syncPlayback(true)
  }
}

/** Shown to anyone when autoplay was blocked — resumes within a user gesture. */
async function resumeAudio() {
  await ensureLoaded()
  await syncPlayback(true)
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

    <!-- Autoplay-blocked hint (shown once, not as repeated toasts) -->
    <div
      v-if="needsGesture && currentTrack && playback.is_playing"
      class="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <span>Browser memblokir autoplay. Ketuk untuk memulai audio.</span>
      <Button size="xs" @click="resumeAudio">Putar audio</Button>
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
