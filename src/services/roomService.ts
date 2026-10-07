/**
 * Room service (PRD §5.2). All endpoints are protected.
 */
import { http, unwrap } from '@/lib/http'
import type {
  BaseResponse,
  CreateRoomPayload,
  JoinByInvitePayload,
  PaginationParams,
  PlaybackState,
  RoomListResponse,
  RoomResponse,
  UpdatePlaybackPayload,
} from '@/types/api'

export const roomService = {
  /** POST /rooms -> 201 */
  async create(payload: CreateRoomPayload): Promise<RoomResponse> {
    const { data } = await http.post<BaseResponse<RoomResponse>>('/rooms', payload)
    return unwrap(data)
  },

  /** GET /rooms?page=&page_size= — public rooms, paginated. */
  async listPublic(params: PaginationParams = {}): Promise<RoomListResponse> {
    const { data } = await http.get<BaseResponse<RoomListResponse>>('/rooms', { params })
    return unwrap(data)
  },

  /** GET /rooms/me — rooms the current user has joined, paginated. */
  async listMine(params: PaginationParams = {}): Promise<RoomListResponse> {
    const { data } = await http.get<BaseResponse<RoomListResponse>>('/rooms/me', { params })
    return unwrap(data)
  },

  /** GET /rooms/:uuid -> RoomResponse | 404 */
  async get(uuid: string): Promise<RoomResponse> {
    const { data } = await http.get<BaseResponse<RoomResponse>>(`/rooms/${uuid}`)
    return unwrap(data)
  },

  /** POST /rooms/:uuid/join — join a PUBLIC room. */
  async joinPublic(uuid: string): Promise<RoomResponse> {
    const { data } = await http.post<BaseResponse<RoomResponse>>(`/rooms/${uuid}/join`, {})
    return unwrap(data)
  },

  /** POST /rooms/join — join via { invite_code } OR { invite_token }. */
  async joinByInvite(payload: JoinByInvitePayload): Promise<RoomResponse> {
    const { data } = await http.post<BaseResponse<RoomResponse>>('/rooms/join', payload)
    return unwrap(data)
  },

  /** DELETE /rooms/:uuid/leave — host is not allowed to leave (400). */
  async leave(uuid: string): Promise<void> {
    await http.delete<BaseResponse>(`/rooms/${uuid}/leave`)
  },

  /** PUT /rooms/:uuid/playback — HOST ONLY (403 otherwise). */
  async updatePlayback(uuid: string, payload: UpdatePlaybackPayload): Promise<PlaybackState> {
    const { data } = await http.put<BaseResponse<PlaybackState>>(
      `/rooms/${uuid}/playback`,
      payload,
    )
    return unwrap(data)
  },

  /** GET /rooms/:uuid/playback */
  async getPlayback(uuid: string): Promise<PlaybackState> {
    const { data } = await http.get<BaseResponse<PlaybackState>>(`/rooms/${uuid}/playback`)
    return unwrap(data)
  },
}
