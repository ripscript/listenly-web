/**
 * Music & Queue service (PRD §5.3). All endpoints are protected.
 */
import { http, unwrap } from '@/lib/http'
import type {
  AdvanceQueueResponse,
  BaseResponse,
  PaginationParams,
  QueueItem,
  SearchResponse,
  StreamResponse,
  Track,
  YoutubeSearchResult,
} from '@/types/api'

export const musicService = {
  /** GET /music/search?q=&page=&page_size= — local catalog (Elasticsearch). */
  async searchCatalog(q: string, params: PaginationParams = {}): Promise<SearchResponse> {
    const { data } = await http.get<BaseResponse<SearchResponse>>('/music/search', {
      params: { q, ...params },
    })
    return unwrap(data)
  },

  /** GET /music/youtube/search?q= — direct YouTube search (limit 10). */
  async searchYoutube(q: string): Promise<YoutubeSearchResult[]> {
    const { data } = await http.get<BaseResponse<YoutubeSearchResult[]>>(
      '/music/youtube/search',
      { params: { q } },
    )
    return unwrap(data) ?? []
  },

  /** GET /music/tracks/:uuid -> TrackResponse | 404 */
  async getTrack(uuid: string): Promise<Track> {
    const { data } = await http.get<BaseResponse<Track>>(`/music/tracks/${uuid}`)
    return unwrap(data)
  },

  /**
   * GET /music/tracks/:uuid/stream -> { stream_url, expires_at } (single-use).
   * Must be fetched immediately before play and never cached (PRD §7.1, §11).
   */
  async getStream(uuid: string): Promise<StreamResponse> {
    const { data } = await http.get<BaseResponse<StreamResponse>>(
      `/music/tracks/${uuid}/stream`,
    )
    return unwrap(data)
  },

  /** POST /music/rooms/:roomUuid/queue — request a track (member only). */
  async requestTrack(roomUuid: string, youtubeVideoId: string): Promise<QueueItem> {
    const { data } = await http.post<BaseResponse<QueueItem>>(
      `/music/rooms/${roomUuid}/queue`,
      { youtube_video_id: youtubeVideoId },
    )
    return unwrap(data)
  },

  /** GET /music/rooms/:roomUuid/queue -> QueueItem[] (member only). */
  async getQueue(roomUuid: string): Promise<QueueItem[]> {
    const { data } = await http.get<BaseResponse<QueueItem[]>>(
      `/music/rooms/${roomUuid}/queue`,
    )
    return unwrap(data) ?? []
  },

  /**
   * POST /music/rooms/:roomUuid/queue/advance — HOST ONLY.
   * Returns whether there is a next item and that item.
   */
  async advanceQueue(
    roomUuid: string,
    currentQueueItemUuid?: string,
  ): Promise<AdvanceQueueResponse> {
    const { data } = await http.post<BaseResponse<AdvanceQueueResponse>>(
      `/music/rooms/${roomUuid}/queue/advance`,
      currentQueueItemUuid ? { current_queue_item_uuid: currentQueueItemUuid } : {},
    )
    return unwrap(data)
  },

  /** PATCH /music/queue/:uuid/played — mark a queue item as played. */
  async markPlayed(queueItemUuid: string): Promise<void> {
    await http.patch<BaseResponse>(`/music/queue/${queueItemUuid}/played`, {})
  },

  /** DELETE /music/queue/:uuid — allowed for the requester OR the host. */
  async removeQueueItem(queueItemUuid: string): Promise<void> {
    await http.delete<BaseResponse>(`/music/queue/${queueItemUuid}`)
  },
}
