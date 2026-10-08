<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '@/stores/rooms'
import { useToast } from '@/composables/useToast'
import RoomCard from '@/components/room/RoomCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Spinner from '@/components/common/Spinner.vue'
import { Button } from '@/components/ui/button'
import type { RoomResponse } from '@/types/api'

const rooms = useRoomsStore()
const router = useRouter()
const toast = useToast()

type Tab = 'public' | 'mine'
const tab = ref<Tab>('public')
const joiningUuid = ref<string | null>(null)

const inviteValue = ref('')
const joiningInvite = ref(false)

const publicPages = computed(() => Math.max(1, Math.ceil(rooms.publicTotal / rooms.pageSize)))
const myPages = computed(() => Math.max(1, Math.ceil(rooms.myTotal / rooms.pageSize)))

onMounted(() => {
  void rooms.loadPublic(1)
  void rooms.loadMine(1)
})

function switchTab(next: Tab) {
  tab.value = next
}

async function join(room: RoomResponse) {
  joiningUuid.value = room.uuid
  const joined = await rooms.joinPublic(room.uuid)
  joiningUuid.value = null
  if (joined) {
    toast.success(`Bergabung ke "${joined.name}".`)
    router.push({ name: 'room', params: { uuid: joined.uuid } })
  } else if (rooms.error) {
    toast.error(rooms.error)
  }
}

async function joinByInvite() {
  const value = inviteValue.value.trim()
  if (!value) return
  joiningInvite.value = true
  // A 6-digit code vs. a longer invite token (PRD §9: code=6, token=64 hex).
  const payload = /^\d{6}$/.test(value) ? { invite_code: value } : { invite_token: value }
  const joined = await rooms.joinByInvite(payload)
  joiningInvite.value = false
  if (joined) {
    toast.success(`Bergabung ke "${joined.name}".`)
    router.push({ name: 'room', params: { uuid: joined.uuid } })
  } else if (rooms.error) {
    toast.error(rooms.error)
  }
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Room</h1>
        <p class="text-sm text-muted-foreground">Gabung room publik atau lanjutkan room kamu.</p>
      </div>
      <RouterLink :to="{ name: 'create-room' }">
        <Button>Buat Room</Button>
      </RouterLink>
    </div>

    <!-- Join via invite code / token -->
    <form
      class="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end"
      @submit.prevent="joinByInvite"
    >
      <div class="flex flex-1 flex-col gap-1.5">
        <label for="invite" class="text-sm font-medium">Gabung lewat kode / undangan</label>
        <input
          id="invite"
          v-model="inviteValue"
          type="text"
          class="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Kode 6 digit atau token undangan"
        />
      </div>
      <Button type="submit" :disabled="!inviteValue.trim() || joiningInvite">
        {{ joiningInvite ? 'Bergabung…' : 'Gabung' }}
      </Button>
    </form>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-border">
      <button
        class="border-b-2 px-3 py-2 text-sm font-medium transition"
        :class="tab === 'public' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'"
        @click="switchTab('public')"
      >
        Room Publik
      </button>
      <button
        class="border-b-2 px-3 py-2 text-sm font-medium transition"
        :class="tab === 'mine' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'"
        @click="switchTab('mine')"
      >
        Room Saya
      </button>
    </div>

    <!-- Public rooms -->
    <div v-if="tab === 'public'" class="flex flex-col gap-3">
      <div v-if="rooms.loadingPublic" class="py-10 text-center">
        <Spinner>Memuat room…</Spinner>
      </div>
      <EmptyState
        v-else-if="rooms.publicRooms.length === 0"
        title="Belum ada room publik"
        description="Jadilah yang pertama membuat room untuk didengarkan bersama."
      >
        <RouterLink :to="{ name: 'create-room' }"><Button>Buat Room</Button></RouterLink>
      </EmptyState>
      <template v-else>
        <RoomCard
          v-for="room in rooms.publicRooms"
          :key="room.uuid"
          :room="room"
          show-join
          :joining="joiningUuid === room.uuid"
          @join="join"
        />
        <div v-if="publicPages > 1" class="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="rooms.publicPage <= 1"
            @click="rooms.loadPublic(rooms.publicPage - 1)"
          >
            Sebelumnya
          </Button>
          <span class="text-sm text-muted-foreground">
            Halaman {{ rooms.publicPage }} / {{ publicPages }}
          </span>
          <Button
            variant="outline"
            size="sm"
            :disabled="rooms.publicPage >= publicPages"
            @click="rooms.loadPublic(rooms.publicPage + 1)"
          >
            Berikutnya
          </Button>
        </div>
      </template>
    </div>

    <!-- My rooms -->
    <div v-else class="flex flex-col gap-3">
      <div v-if="rooms.loadingMine" class="py-10 text-center">
        <Spinner>Memuat room…</Spinner>
      </div>
      <EmptyState
        v-else-if="rooms.myRooms.length === 0"
        title="Kamu belum bergabung ke room"
        description="Gabung room publik atau buat room baru untuk mulai."
      />
      <template v-else>
        <RoomCard v-for="room in rooms.myRooms" :key="room.uuid" :room="room" />
        <div v-if="myPages > 1" class="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="rooms.myPage <= 1"
            @click="rooms.loadMine(rooms.myPage - 1)"
          >
            Sebelumnya
          </Button>
          <span class="text-sm text-muted-foreground">
            Halaman {{ rooms.myPage }} / {{ myPages }}
          </span>
          <Button
            variant="outline"
            size="sm"
            :disabled="rooms.myPage >= myPages"
            @click="rooms.loadMine(rooms.myPage + 1)"
          >
            Berikutnya
          </Button>
        </div>
      </template>
    </div>
  </section>
</template>
