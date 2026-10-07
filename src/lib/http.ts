/**
 * Shared HTTP client (PRD §7.1).
 *
 * Responsibilities:
 *  - Attach `Authorization: Bearer <access_token>` to every request.
 *  - On 401, attempt a single refresh via /auth/refresh (rotating tokens),
 *    then replay the original request. Concurrent 401s share one refresh.
 *  - Map gateway status codes (PRD §6) into a normalized ApiError.
 *  - On unrecoverable auth failure, clear tokens and notify listeners so the
 *    app can redirect to login.
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { HTTP_BASE_URL } from '@/config/env'
import { tokenStorage } from '@/lib/tokenStorage'
import type { AuthTokens, BaseResponse } from '@/types/api'

/** Normalized error surfaced to stores/components. */
export class ApiError extends Error {
  status: number
  /** Per-field validation errors (422) or structured error detail (PRD §6). */
  errors?: Record<string, unknown>

  constructor(message: string, status: number, errors?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }

  /** True when the user should be sent to login (token missing/invalid). */
  get isUnauthorized(): boolean {
    return this.status === 401
  }

  /** True when the action is forbidden for this role (e.g. non-host, non-member). */
  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  get isValidation(): boolean {
    return this.status === 422
  }
}

/** Default human-readable messages for the status codes in PRD §6. */
function defaultMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Permintaan tidak dapat diproses.'
    case 401:
      return 'Sesi berakhir, silakan masuk kembali.'
    case 403:
      return 'Anda tidak memiliki izin untuk tindakan ini.'
    case 404:
      return 'Data tidak ditemukan.'
    case 422:
      return 'Data yang dikirim tidak valid.'
    case 500:
      return 'Terjadi kesalahan, coba lagi.'
    default:
      return 'Terjadi kesalahan tak terduga.'
  }
}

type AuthFailureListener = () => void
const authFailureListeners = new Set<AuthFailureListener>()

/** Register a callback fired when the session cannot be recovered (force login). */
export function onAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.add(listener)
  return () => authFailureListeners.delete(listener)
}

function emitAuthFailure(): void {
  tokenStorage.clear()
  authFailureListeners.forEach((l) => {
    try {
      l()
    } catch {
      /* ignore listener errors */
    }
  })
}

export const http: AxiosInstance = axios.create({
  baseURL: HTTP_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

// --- Request interceptor: attach Bearer token ---
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccessToken()
  if (token && !config.headers?.['X-Skip-Auth']) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  config.headers.delete('X-Skip-Auth')
  return config
})

// --- Response interceptor: refresh-on-401 + error mapping ---

interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean
}

let refreshPromise: Promise<string> | null = null

/**
 * Perform a single rotating refresh. A bare axios call is used so we don't
 * recurse through this interceptor.
 */
async function performRefresh(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) throw new ApiError('Tidak ada refresh token.', 401)

  const res = await axios.post<BaseResponse<AuthTokens>>(
    `${HTTP_BASE_URL}/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  )
  const data = res.data?.data
  if (!data?.access_token || !data?.refresh_token) {
    throw new ApiError('Refresh gagal.', 401)
  }
  tokenStorage.setTokens(data.access_token, data.refresh_token)
  if (data.user) tokenStorage.setUser(data.user)
  return data.access_token
}

function toApiError(error: AxiosError<BaseResponse>): ApiError {
  if (error.response) {
    const status = error.response.status
    const body = error.response.data
    const message = body?.message || defaultMessageForStatus(status)
    const errors = (body?.errors as Record<string, unknown> | undefined) ?? undefined
    return new ApiError(message, status, errors)
  }
  if (error.code === 'ECONNABORTED') {
    return new ApiError('Permintaan melebihi batas waktu.', 0)
  }
  return new ApiError('Tidak dapat terhubung ke server.', 0)
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<BaseResponse>) => {
    const original = error.config as (RetriableConfig & InternalAxiosRequestConfig) | undefined
    const status = error.response?.status

    // Attempt refresh exactly once per failed request.
    const isRefreshCall = original?.url?.includes('/auth/refresh')
    if (status === 401 && original && !original._retry && !isRefreshCall) {
      original._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = performRefresh().finally(() => {
            refreshPromise = null
          })
        }
        const newToken = await refreshPromise
        original.headers.set('Authorization', `Bearer ${newToken}`)
        return http(original)
      } catch {
        emitAuthFailure()
        return Promise.reject(new ApiError('Sesi berakhir, silakan masuk kembali.', 401))
      }
    }

    // A 401 on the refresh endpoint itself means the refresh token is dead.
    if (status === 401 && isRefreshCall) {
      emitAuthFailure()
    }

    return Promise.reject(toApiError(error))
  },
)

/** Unwrap the BaseResponse envelope and return `data`. */
export function unwrap<T>(body: BaseResponse<T>): T {
  return body.data as T
}
