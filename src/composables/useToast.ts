/**
 * Minimal global toast store (PRD §7: consistent error states).
 */
import { reactive } from 'vue'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const state = reactive<{ toasts: Toast[] }>({ toasts: [] })
let nextId = 1

export function useToast() {
  function push(message: string, kind: ToastKind = 'info', timeout = 4000): void {
    const id = nextId++
    state.toasts.push({ id, kind, message })
    if (timeout > 0) {
      setTimeout(() => dismiss(id), timeout)
    }
  }

  function dismiss(id: number): void {
    const idx = state.toasts.findIndex((t) => t.id === id)
    if (idx !== -1) state.toasts.splice(idx, 1)
  }

  return {
    toasts: state.toasts,
    push,
    success: (m: string) => push(m, 'success'),
    error: (m: string) => push(m, 'error'),
    info: (m: string) => push(m, 'info'),
    dismiss,
  }
}
