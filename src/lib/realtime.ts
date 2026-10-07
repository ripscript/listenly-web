/**
 * Realtime room client (PRD §5.4, §7.1, §8).
 *
 * - One WebSocket per active room.
 * - Token passed via `?token=` query param (browsers can't set WS headers).
 * - Server->client only; the client just reads events.
 * - Auto-reconnect with exponential backoff + jitter; callers resync state
 *   (GET playback / refetch queue) on reconnect.
 */
import { WS_API_BASE } from '@/config/env'
import type {
  WsConnectedMessage,
  WsEnvelope,
  WsPlaybackPayload,
  WsQueuePayload,
} from '@/types/api'

export interface RealtimeHandlers {
  onConnected?: (msg: WsConnectedMessage) => void
  onPlaybackUpdated?: (payload: WsPlaybackPayload, envelope: WsEnvelope<WsPlaybackPayload>) => void
  onQueueUpdated?: (payload: WsQueuePayload, envelope: WsEnvelope<WsQueuePayload>) => void
  /** Fired after a successful (re)open so callers can resync state. */
  onReconnect?: () => void
  onStatusChange?: (status: RealtimeStatus) => void
}

export type RealtimeStatus = 'connecting' | 'open' | 'closed' | 'reconnecting'

const MAX_BACKOFF_MS = 15000
const BASE_BACKOFF_MS = 500

export class RealtimeClient {
  private ws: WebSocket | null = null
  private roomUuid: string
  private getToken: () => string | null
  private handlers: RealtimeHandlers
  private attempts = 0
  private closedByUser = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private hasConnectedOnce = false

  constructor(roomUuid: string, getToken: () => string | null, handlers: RealtimeHandlers) {
    this.roomUuid = roomUuid
    this.getToken = getToken
    this.handlers = handlers
  }

  get status(): RealtimeStatus {
    if (!this.ws) return 'closed'
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return this.hasConnectedOnce ? 'reconnecting' : 'connecting'
      case WebSocket.OPEN:
        return 'open'
      default:
        return 'closed'
    }
  }

  connect(): void {
    this.closedByUser = false
    this.open()
  }

  private open(): void {
    const token = this.getToken()
    if (!token) {
      // Without a token we cannot authenticate the WS; retry shortly.
      this.scheduleReconnect()
      return
    }
    this.handlers.onStatusChange?.(this.hasConnectedOnce ? 'reconnecting' : 'connecting')

    const url = `${WS_API_BASE}/rooms/${this.roomUuid}/ws?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      this.attempts = 0
      this.handlers.onStatusChange?.('open')
      if (this.hasConnectedOnce) {
        // This is a reconnect: ask caller to resync state.
        this.handlers.onReconnect?.()
      }
      this.hasConnectedOnce = true
    }

    ws.onmessage = (event) => this.handleMessage(event)

    ws.onclose = () => {
      this.ws = null
      if (this.closedByUser) {
        this.handlers.onStatusChange?.('closed')
        return
      }
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose will follow and drive reconnection.
      try {
        ws.close()
      } catch {
        /* noop */
      }
    }
  }

  private handleMessage(event: MessageEvent): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(event.data as string)
    } catch {
      return
    }
    const msg = parsed as WsEnvelope | WsConnectedMessage
    switch (msg.type) {
      case 'connected':
        this.handlers.onConnected?.(msg as WsConnectedMessage)
        break
      case 'playback_updated':
        this.handlers.onPlaybackUpdated?.(
          (msg as WsEnvelope<WsPlaybackPayload>).payload,
          msg as WsEnvelope<WsPlaybackPayload>,
        )
        break
      case 'queue_updated':
        this.handlers.onQueueUpdated?.(
          (msg as WsEnvelope<WsQueuePayload>).payload,
          msg as WsEnvelope<WsQueuePayload>,
        )
        break
    }
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return
    this.handlers.onStatusChange?.('reconnecting')
    const expo = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** this.attempts)
    const jitter = Math.random() * BASE_BACKOFF_MS
    const delay = expo + jitter
    this.attempts += 1
    this.reconnectTimer = setTimeout(() => this.open(), delay)
  }

  close(): void {
    this.closedByUser = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* noop */
      }
      this.ws = null
    }
    this.handlers.onStatusChange?.('closed')
  }
}
