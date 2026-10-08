/**
 * Local token storage for web (PRD §7.1 "simpan access + refresh token").
 * Kept in a single module so the HTTP client and auth store share one source
 * of truth and the interceptor can refresh/clear without circular imports.
 */
import type { AuthUser } from '@/types/api'

const ACCESS_KEY = 'listenly.access_token'
const REFRESH_KEY = 'listenly.refresh_token'
const USER_KEY = 'listenly.user'

export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY)
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  },
  getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      return null
    }
  },
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken)
    localStorage.setItem(REFRESH_KEY, refreshToken)
  },
  setUser(user: AuthUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  },
}
