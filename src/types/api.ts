/**
 * API DTO types derived from the Listenly backend contract (PRD §5, §9).
 * The frontend only talks to the API Gateway over HTTP/JSON and WebSocket.
 */

/** Uniform response envelope returned by every gateway endpoint (pkg/response). */
export interface BaseResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  errors?: Record<string, string> | Record<string, unknown>
}

// ----- Auth -----

export interface AuthUser {
  uuid: string
  email: string
  full_name: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  user: AuthUser
}

export interface MeResponse {
  user_uuid: string
  email: string
}

export interface RegisterPayload {
  full_name: string
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

// ----- Room -----

export type RoomVisibility = 'public' | 'private'

export interface RoomResponse {
  uuid: string
  name: string
  visibility: RoomVisibility
  host_uuid: string
  /** Only present for the host of a private room. */
  invite_code?: string
  /** Only present for the host of a private room. */
  invite_link?: string
  member_count: number
  online_count: number
}

export interface RoomListResponse {
  rooms: RoomResponse[]
  total_items: number
}

export interface CreateRoomPayload {
  name: string
  visibility: RoomVisibility
}

export interface JoinByInvitePayload {
  invite_code?: string
  invite_token?: string
}

export interface PaginationParams {
  page?: number
  page_size?: number
}

// ----- Playback -----

export interface PlaybackState {
  current_track_id: string | null
  position_seconds: number
  is_playing: boolean
  updated_at?: string
}

export interface UpdatePlaybackPayload {
  current_track_id: string | null
  position_seconds: number
  is_playing: boolean
}

// ----- Music / Queue -----

export interface Track {
  uuid: string
  youtube_video_id: string
  title: string
  artist: string
  duration_seconds: number
  thumbnail_url: string
}

export type QueueItemStatus = 'pending' | 'ready' | 'failed' | 'played'

export interface QueueItem {
  uuid: string
  track: Track
  requested_by_uuid: string
  status: QueueItemStatus
  position: number
  created_at: string
}

export interface StreamResponse {
  stream_url: string
  expires_at: string
}

export interface YoutubeSearchResult {
  youtube_video_id: string
  title: string
  artist?: string
  channel?: string
  duration_seconds?: number
  thumbnail_url?: string
}

/** Actual gateway shape: { data: { results: [...] } }. */
export interface YoutubeSearchResponse {
  results: YoutubeSearchResult[]
}

export interface AdvanceQueueResponse {
  has_next: boolean
  next_item?: QueueItem
}

export interface SearchResponse {
  tracks: Track[]
  total_items?: number
}

// ----- WebSocket events (PRD §5.4) -----

export type WsEventType =
  | 'connected'
  | 'playback_updated'
  | 'queue_updated'

export interface WsConnectedMessage {
  type: 'connected'
  room_uuid: string
}

export interface WsPlaybackPayload {
  current_track_id: string | null
  position_seconds: number
  is_playing: boolean
  updated_at?: string
}

export type QueueAction = 'track_requested' | 'track_removed' | 'queue_advanced'

export interface WsQueuePayload {
  action: QueueAction
}

export interface WsEnvelope<P = unknown> {
  type: WsEventType
  room_uuid: string
  payload: P
  timestamp: string
}
