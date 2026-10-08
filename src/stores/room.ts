/**
 * Active-room store (PRD US-04..US-09, §4, §5, §7, §8).
 *
 * Ties together: room info, members/presence, the queue, playback state,
 * the realtime WebSocket, drift correction, and host authorization. One room
 * is "active" at a time; a single RealtimeClient is attached while it is.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { roomService } from '@/services/roomService'
import { musicService } from '@/services/musicService'
import { ApiError } from '@/lib/http'
import { RealtimeClient, type RealtimeStatus } from '@/lib/realtime'
import { tokenStorage } from '@/lib/tokenStorage'
import { useAuthStore } from '@/stores/auth'
import type {
  PlaybackState,
  QueueItem,
  RoomResponse,
  Track,
  UpdatePlaybackPayload,
} from '@/types/api'

/** Drift threshold for correction (PRD §8: resync when > 1.5s off). */
export const DRIFT_THRESHOLD_SECONDS = 1.5

export const useRoomStore = defineStore('room', () => {
  const auth = useAuthStore()

  const room = ref<RoomResponse | null>(null)
  const queue = ref<QueueItem[]>([])
  const playback = ref<PlaybackState>({
    current_track_id: null,
    position_seconds: 0,
    is_playing: false,
  })
  const wsStatus = ref<RealtimeStatus>('closed')

  const loading = ref(false)
  const error = ref<string | null>(null)

  /** stream_url for the current track; fetched just before play, never cached. */
  const currentStreamUrl = ref<string | null>(null)
  /** Signals the audio layer to seek to playback.position_seconds. */
  const seekSignal = ref(0)

  let realtime: RealtimeClient | null = null

  const isHost = computed(
    () => !!room.value && !!auth.user && room.value.host_uuid === auth.user.uuid,
  )

  const currentQueueItem = computed<QueueItem | null>(() => {
    const id = playback.value.current_track_id
    if (!id) return null
    return queue.value.find((q) => q.track.uuid === id || q.uuid === id) ?? null
  })

  const currentTrack = computed<Track | null>(() => currentQueueItem.value?.track ?? null)

  const sortedQueue = computed(() =>
    [...queue.value].sort((a, b) => a.position - b.position),
  )

  function setError(e: unknown, fallback: string): void {
    error.value = e instanceof ApiError ? e.message : fallback
  }

  // ----- Loading -----

  async function loadRoom(uuid: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      room.value = await roomService.get(uuid)
      await Promise.all([refreshQueue(), refreshPlayback()])
      return true
    } catch (e) {
      setError(e, 'Room tidak ditemukan.')
      return false
    } finally {
      loading.value = false
    }
  }

  async function refreshQueue(): Promise<void> {
    if (!room.value) return
    try {
      queue.value = await musicService.getQueue(room.value.uuid)
    } catch (e) {
      setError(e, 'Gagal memuat antrian.')
    }
  }

  async function refreshRoomInfo(): Promise<void> {
    if (!room.value) return
    try {
      room.value = await roomService.get(room.value.uuid)
    } catch {
      /* non-fatal: keep existing room info */
    }
  }

  async function refreshPlayback(): Promise<void> {
    if (!room.value) return
    try {
      const state = await roomService.getPlayback(room.value.uuid)
      applyPlaybackState(state, { fromRemote: true })
    } catch (e) {
      setError(e, 'Gagal memuat status pemutaran.')
    }
  }

  /**
   * Apply a playback state. When it arrives from a remote source (WS/GET),
   * trigger drift correction if the local position is too far off.
   */
  function applyPlaybackState(
    state: PlaybackState,
    opts: { fromRemote?: boolean } = {},
  ): void {
    const trackChanged = state.current_track_id !== playback.value.current_track_id
    playback.value = { ...state }

    if (trackChanged) {
      // New track: drop the stale (single-use) stream URL.
      currentStreamUrl.value = null
    }
    if (opts.fromRemote) {
      // Ask the audio layer to realign to the authoritative position.
      seekSignal.value++
    }
  }

  // ----- Realtime -----

  function connectRealtime(): void {
    if (!room.value) return
    disconnectRealtime()
    realtime = new RealtimeClient(
      room.value.uuid,
      () => tokenStorage.getAccessToken(),
      {
        onPlaybackUpdated: (payload) => {
          applyPlaybackState(
            {
              current_track_id: payload.current_track_id,
              position_seconds: payload.position_seconds,
              is_playing: payload.is_playing,
              updated_at: payload.updated_at,
            },
            { fromRemote: true },
          )
        },
        onQueueUpdated: () => {
          // Refetch the queue (and room info for member/online counts).
          void refreshQueue()
          void refreshRoomInfo()
        },
        onReconnect: () => {
          // Resync authoritative state after a reconnect (PRD §8).
          void refreshPlayback()
          void refreshQueue()
        },
        onStatusChange: (status) => {
          wsStatus.value = status
        },
      },
    )
    realtime.connect()
  }

  function disconnectRealtime(): void {
    if (realtime) {
      realtime.close()
      realtime = null
    }
    wsStatus.value = 'closed'
  }

  // ----- Queue actions -----

  async function requestTrack(youtubeVideoId: string): Promise<boolean> {
    if (!room.value) return false
    error.value = null
    try {
      await musicService.requestTrack(room.value.uuid, youtubeVideoId)
      await refreshQueue()
      return true
    } catch (e) {
      setError(e, 'Gagal menambahkan lagu ke antrian.')
      return false
    }
  }

  async function removeQueueItem(queueItemUuid: string): Promise<boolean> {
    error.value = null
    try {
      await musicService.removeQueueItem(queueItemUuid)
      await refreshQueue()
      return true
    } catch (e) {
      setError(e, 'Gagal menghapus item antrian.')
      return false
    }
  }

  /** Whether the current user may remove a given queue item (PRD §6). */
  function canRemoveItem(item: QueueItem): boolean {
    return isHost.value || item.requested_by_uuid === auth.user?.uuid
  }

  // ----- Playback control (HOST ONLY) -----

  async function updatePlayback(payload: UpdatePlaybackPayload): Promise<boolean> {
    if (!room.value || !isHost.value) return false
    error.value = null
    try {
      const state = await roomService.updatePlayback(room.value.uuid, payload)
      // Apply locally without forcing a seek on ourselves (we are the source).
      applyPlaybackState(state, { fromRemote: false })
      return true
    } catch (e) {
      setError(e, 'Gagal memperbarui pemutaran.')
      return false
    }
  }

  async function play(positionSeconds?: number): Promise<void> {
    await updatePlayback({
      current_track_id: playback.value.current_track_id,
      position_seconds: positionSeconds ?? playback.value.position_seconds,
      is_playing: true,
    })
  }

  async function pause(positionSeconds?: number): Promise<void> {
    await updatePlayback({
      current_track_id: playback.value.current_track_id,
      position_seconds: positionSeconds ?? playback.value.position_seconds,
      is_playing: false,
    })
  }

  async function seek(positionSeconds: number): Promise<void> {
    await updatePlayback({
      current_track_id: playback.value.current_track_id,
      position_seconds: positionSeconds,
      is_playing: playback.value.is_playing,
    })
  }

  /** Host plays a specific queue item from the start. */
  async function playItem(item: QueueItem): Promise<void> {
    await updatePlayback({
      current_track_id: item.track.uuid,
      position_seconds: 0,
      is_playing: true,
    })
  }

  /**
   * Auto-advance when a track finishes (host only, PRD §5.3 / Sprint 4).
   * Marks the finished item played and advances to the next.
   */
  async function advance(): Promise<void> {
    if (!room.value || !isHost.value) return
    const current = currentQueueItem.value
    try {
      if (current) {
        await musicService.markPlayed(current.uuid).catch(() => undefined)
      }
      const res = await musicService.advanceQueue(room.value.uuid, current?.uuid)
      await refreshQueue()
      if (res.has_next && res.next_item) {
        await updatePlayback({
          current_track_id: res.next_item.track.uuid,
          position_seconds: 0,
          is_playing: true,
        })
      } else {
        await updatePlayback({
          current_track_id: null,
          position_seconds: 0,
          is_playing: false,
        })
      }
    } catch (e) {
      setError(e, 'Gagal berpindah ke lagu berikutnya.')
    }
  }

  // ----- Stream URL -----

  /** Fetch a fresh single-use stream URL for the current track (never cached). */
  async function ensureStreamUrl(): Promise<string | null> {
    const track = currentTrack.value
    if (!track) return null
    try {
      const res = await musicService.getStream(track.uuid)
      currentStreamUrl.value = res.stream_url
      return res.stream_url
    } catch (e) {
      setError(e, 'Gagal mengambil audio, mencoba lagi.')
      currentStreamUrl.value = null
      return null
    }
  }

  // ----- Leave / teardown -----

  async function leave(): Promise<boolean> {
    if (!room.value) return false
    error.value = null
    try {
      await roomService.leave(room.value.uuid)
      teardown()
      return true
    } catch (e) {
      setError(e, 'Gagal keluar dari room.')
      return false
    }
  }

  function teardown(): void {
    disconnectRealtime()
    room.value = null
    queue.value = []
    playback.value = { current_track_id: null, position_seconds: 0, is_playing: false }
    currentStreamUrl.value = null
    error.value = null
  }

  return {
    // state
    room,
    queue,
    playback,
    wsStatus,
    loading,
    error,
    currentStreamUrl,
    seekSignal,
    // getters
    isHost,
    currentQueueItem,
    currentTrack,
    sortedQueue,
    // actions
    loadRoom,
    refreshQueue,
    refreshPlayback,
    refreshRoomInfo,
    connectRealtime,
    disconnectRealtime,
    requestTrack,
    removeQueueItem,
    canRemoveItem,
    updatePlayback,
    play,
    pause,
    seek,
    playItem,
    advance,
    ensureStreamUrl,
    leave,
    teardown,
    DRIFT_THRESHOLD_SECONDS,
  }
})
