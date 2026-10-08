/**
 * Rooms store (PRD US-03, US-08). Handles room discovery, creation and joining.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { roomService } from '@/services/roomService'
import { ApiError } from '@/lib/http'
import type {
  CreateRoomPayload,
  JoinByInvitePayload,
  RoomResponse,
} from '@/types/api'

const DEFAULT_PAGE_SIZE = 20

export const useRoomsStore = defineStore('rooms', () => {
  const publicRooms = ref<RoomResponse[]>([])
  const publicTotal = ref(0)
  const publicPage = ref(1)

  const myRooms = ref<RoomResponse[]>([])
  const myTotal = ref(0)
  const myPage = ref(1)

  const loadingPublic = ref(false)
  const loadingMine = ref(false)
  const error = ref<string | null>(null)

  async function loadPublic(page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<void> {
    loadingPublic.value = true
    error.value = null
    try {
      const res = await roomService.listPublic({ page, page_size: pageSize })
      publicRooms.value = res.rooms ?? []
      publicTotal.value = res.total_items ?? 0
      publicPage.value = page
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Gagal memuat room publik.'
    } finally {
      loadingPublic.value = false
    }
  }

  async function loadMine(page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<void> {
    loadingMine.value = true
    error.value = null
    try {
      const res = await roomService.listMine({ page, page_size: pageSize })
      myRooms.value = res.rooms ?? []
      myTotal.value = res.total_items ?? 0
      myPage.value = page
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Gagal memuat room saya.'
    } finally {
      loadingMine.value = false
    }
  }

  async function create(payload: CreateRoomPayload): Promise<RoomResponse | null> {
    error.value = null
    try {
      return await roomService.create(payload)
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Gagal membuat room.'
      return null
    }
  }

  async function joinPublic(uuid: string): Promise<RoomResponse | null> {
    error.value = null
    try {
      return await roomService.joinPublic(uuid)
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Gagal bergabung ke room.'
      return null
    }
  }

  async function joinByInvite(payload: JoinByInvitePayload): Promise<RoomResponse | null> {
    error.value = null
    try {
      return await roomService.joinByInvite(payload)
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Kode/undangan tidak valid.'
      return null
    }
  }

  return {
    publicRooms,
    publicTotal,
    publicPage,
    myRooms,
    myTotal,
    myPage,
    loadingPublic,
    loadingMine,
    error,
    pageSize: DEFAULT_PAGE_SIZE,
    loadPublic,
    loadMine,
    create,
    joinPublic,
    joinByInvite,
  }
})
