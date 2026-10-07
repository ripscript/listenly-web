/**
 * Auth store (PRD US-01, US-02, US-10). Holds session + user and bridges to
 * the token storage used by the HTTP interceptor.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authService } from '@/services/authService'
import { ApiError } from '@/lib/http'
import { tokenStorage } from '@/lib/tokenStorage'
import type { AuthUser, LoginPayload, RegisterPayload } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(tokenStorage.getUser())
  const accessToken = ref<string | null>(tokenStorage.getAccessToken())
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!accessToken.value)

  function applySession(tokens: {
    access_token: string
    refresh_token: string
    user: AuthUser
  }): void {
    tokenStorage.setTokens(tokens.access_token, tokens.refresh_token)
    tokenStorage.setUser(tokens.user)
    accessToken.value = tokens.access_token
    user.value = tokens.user
  }

  async function register(payload: RegisterPayload): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const tokens = await authService.register(payload)
      applySession(tokens)
      return true
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Pendaftaran gagal.'
      return false
    } finally {
      loading.value = false
    }
  }

  async function login(payload: LoginPayload): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const tokens = await authService.login(payload)
      applySession(tokens)
      return true
    } catch (e) {
      error.value =
        e instanceof ApiError && e.status === 401
          ? 'Email atau password salah.'
          : e instanceof ApiError
            ? e.message
            : 'Masuk gagal.'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    const refreshToken = tokenStorage.getRefreshToken()
    try {
      if (refreshToken) await authService.logout(refreshToken)
    } catch {
      /* best-effort; clear locally regardless */
    } finally {
      clearSession()
    }
  }

  async function logoutAll(): Promise<void> {
    try {
      await authService.logoutAll()
    } catch {
      /* best-effort */
    } finally {
      clearSession()
    }
  }

  function clearSession(): void {
    tokenStorage.clear()
    accessToken.value = null
    user.value = null
  }

  /** Verify the session is still valid using GET /auth/me. */
  async function fetchMe(): Promise<boolean> {
    try {
      const me = await authService.me()
      // Keep full_name if we already have it; backfill from /me otherwise.
      user.value = {
        uuid: me.user_uuid,
        email: me.email,
        full_name: user.value?.full_name ?? '',
      }
      tokenStorage.setUser(user.value)
      return true
    } catch {
      return false
    }
  }

  return {
    user,
    accessToken,
    loading,
    error,
    isAuthenticated,
    register,
    login,
    logout,
    logoutAll,
    clearSession,
    fetchMe,
  }
})
