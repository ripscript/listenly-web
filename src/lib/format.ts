/** Small formatting helpers for the UI. */

/** Seconds -> m:ss (or h:mm:ss when >= 1h). */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds) || totalSeconds < 0) return '0:00'
  const s = Math.floor(totalSeconds)
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${minutes}:${pad(seconds)}`
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Menyiapkan',
  ready: 'Siap',
  failed: 'Gagal',
  played: 'Sudah diputar',
}

export function queueStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}
