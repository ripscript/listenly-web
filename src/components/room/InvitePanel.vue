<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from '@/composables/useToast'
import { Button } from '@/components/ui/button'
import type { RoomResponse } from '@/types/api'

const props = defineProps<{ room: RoomResponse }>()
const toast = useToast()

// Only shown for private rooms where the current user is host (backend returns
// invite_code/invite_link only to the host — PRD §5.2).
const hasInvite = computed(() => !!props.room.invite_code || !!props.room.invite_link)

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} disalin.`)
  } catch {
    toast.error('Gagal menyalin.')
  }
}

async function share() {
  const url = props.room.invite_link
  if (!url) return
  if (navigator.share) {
    try {
      await navigator.share({ title: props.room.name, url })
    } catch {
      /* user cancelled */
    }
  } else {
    await copy(url, 'Link undangan')
  }
}
</script>

<template>
  <div v-if="hasInvite" class="rounded-xl border border-border bg-card p-4">
    <h3 class="mb-3 text-sm font-medium">Undang teman</h3>

    <div v-if="room.invite_code" class="mb-3">
      <p class="mb-1 text-xs text-muted-foreground">Kode undangan</p>
      <div class="flex items-center gap-2">
        <code class="rounded-md bg-secondary px-3 py-1.5 text-lg font-semibold tracking-widest">
          {{ room.invite_code }}
        </code>
        <Button size="sm" variant="outline" @click="copy(room.invite_code!, 'Kode')">
          Salin
        </Button>
      </div>
    </div>

    <div v-if="room.invite_link">
      <p class="mb-1 text-xs text-muted-foreground">Link undangan</p>
      <div class="flex items-center gap-2">
        <input
          :value="room.invite_link"
          readonly
          class="h-8 flex-1 truncate rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Link undangan"
        />
        <Button size="sm" variant="outline" @click="copy(room.invite_link!, 'Link')">
          Salin
        </Button>
        <Button size="sm" @click="share">Bagikan</Button>
      </div>
    </div>
  </div>
</template>
