/**
 * Environment configuration. Base URLs are configurable per environment
 * through Vite env vars (PRD §7.1 "konfigurasi base URL per environment").
 *
 * - VITE_API_BASE_URL: HTTP gateway base, e.g. https://api.listenly.app
 * - VITE_WS_BASE_URL: optional explicit WS base; derived from API base if absent.
 */

const DEFAULT_API_BASE = 'http://localhost:8080'

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  DEFAULT_API_BASE

/** All HTTP endpoints are prefixed with /api/v1 (PRD §5). */
export const API_PREFIX = '/api/v1'

/** Full HTTP base including the versioned prefix. */
export const HTTP_BASE_URL = `${API_BASE_URL}${API_PREFIX}`

/**
 * Derive the WebSocket base from the API base when not explicitly provided:
 * http -> ws, https -> wss.
 */
function deriveWsBase(httpBase: string): string {
  if (httpBase.startsWith('https://')) return 'wss://' + httpBase.slice('https://'.length)
  if (httpBase.startsWith('http://')) return 'ws://' + httpBase.slice('http://'.length)
  return httpBase
}

export const WS_BASE_URL: string =
  (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  deriveWsBase(API_BASE_URL)

/** Full WS base including the versioned prefix. */
export const WS_API_BASE = `${WS_BASE_URL}${API_PREFIX}`
