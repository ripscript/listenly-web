/**
 * Auth service (PRD §5.1). Wraps /api/v1/auth/* endpoints.
 */
import { http, unwrap } from '@/lib/http'
import type {
  AuthTokens,
  BaseResponse,
  LoginPayload,
  MeResponse,
  RegisterPayload,
} from '@/types/api'

export const authService = {
  /** POST /auth/register -> 201 { access_token, refresh_token, user } */
  async register(payload: RegisterPayload): Promise<AuthTokens> {
    const { data } = await http.post<BaseResponse<AuthTokens>>(
      '/auth/register',
      payload,
      { headers: { 'X-Skip-Auth': 'true' } },
    )
    return unwrap(data)
  },

  /** POST /auth/login -> 200 | 401 */
  async login(payload: LoginPayload): Promise<AuthTokens> {
    const { data } = await http.post<BaseResponse<AuthTokens>>(
      '/auth/login',
      payload,
      { headers: { 'X-Skip-Auth': 'true' } },
    )
    return unwrap(data)
  },

  /**
   * POST /auth/logout. The gateway expects the refresh token in the
   * Authorization header for logout (PRD §5.1).
   */
  async logout(refreshToken: string): Promise<void> {
    await http.post<BaseResponse>(
      '/auth/logout',
      {},
      { headers: { Authorization: refreshToken, 'X-Skip-Auth': 'true' } },
    )
  },

  /** POST /auth/logout-all (protected) — revoke every refresh token. */
  async logoutAll(): Promise<void> {
    await http.post<BaseResponse>('/auth/logout-all', {})
  },

  /** GET /auth/me -> { user_uuid, email } */
  async me(): Promise<MeResponse> {
    const { data } = await http.get<BaseResponse<MeResponse>>('/auth/me')
    return unwrap(data)
  },
}
