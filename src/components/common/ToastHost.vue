<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

// Contrast-safe on the light theme (dark text on a tinted background), with
// dark-mode overrides so toasts stay readable in both palettes.
const kindClass: Record<string, string> = {
  success:
    'border-green-500/40 bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-200',
  error:
    'border-red-500/50 bg-red-50 text-red-800 dark:bg-destructive/15 dark:text-red-200',
  info: 'border-border bg-card text-foreground',
}
</script>

<template>
  <div
    class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
    role="region"
    aria-label="Notifikasi"
  >
    <div
      v-for="t in toasts"
      :key="t.id"
      class="pointer-events-auto flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur"
      :class="kindClass[t.kind]"
      role="alert"
    >
      <span>{{ t.message }}</span>
      <button
        class="shrink-0 opacity-60 transition hover:opacity-100"
        aria-label="Tutup notifikasi"
        @click="dismiss(t.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>
