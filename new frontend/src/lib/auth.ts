// lib/auth.ts
//
// Auth functions use direct fetch calls (not the apiClient request() wrapper)
// because auth routes initialize and clear the session itself. Running them
// through the 401-intercept logic would cause infinite refresh loops.
//
// All calls still carry credentials:'include' so the browser sends and
// receives the HttpOnly JWT cookies.

const BASE_URL = ''

export interface AuthUser {
  user_id: string
  email: string
  emailVerified: boolean
  currentWorkspace: string | null
  onboardingCompleted: boolean
}

export class AuthApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.code = code
  }
}

async function authRequest<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new AuthApiError(
      (data as any)?.message ?? (data as any)?.error ?? `Request failed (${res.status})`,
      res.status,
      (data as any)?.code,
    )
  }
  return data as T
}

function normalizeUser(raw: any): AuthUser {
  return {
    user_id: String(raw?.user_id ?? raw?.id ?? ''),
    email: String(raw?.email ?? ''),
    emailVerified: !!(raw?.email_verified ?? raw?.emailVerified ?? false),
    currentWorkspace: raw?.current_workspace ?? raw?.currentWorkspace ?? null,
    onboardingCompleted: !!(raw?.onboarding_completed ?? raw?.onboardingCompleted ?? false),
  }
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: AuthUser; hasWorkspace: boolean }> {
  const data = await authRequest<any>('/api/auth/login', { email, password })
  return {
    user: normalizeUser(data?.user ?? data),
    hasWorkspace: !!(data?.current_workspace ?? data?.user?.current_workspace),
  }
}

/**
 * Create an account. Hard email-verification gate: no session is issued —
 * the backend only sends a verification email. The user is logged in for
 * the first time when they click that link (see verifyEmail below).
 *
 * `devVerificationLink` is only present when SMTP isn't configured (local
 * dev with no mail server) — the backend echoes the link so it's usable
 * without a console search.
 */
export async function register(
  email: string,
  password: string,
): Promise<{ devVerificationLink?: string }> {
  const data = await authRequest<any>('/api/auth/register', { email, password })
  return { devVerificationLink: data?.dev_verification_link }
}

/** Sign in (or sign up) with a Google ID token from Google Identity Services. */
export async function loginWithGoogle(
  credential: string,
): Promise<{ user: AuthUser; hasWorkspace: boolean }> {
  const data = await authRequest<any>('/api/auth/google', { credential })
  return {
    user: normalizeUser(data?.user ?? data),
    hasWorkspace: !!(data?.current_workspace ?? data?.user?.current_workspace),
  }
}

/** Keys that must never survive a logout — otherwise the next user to sign in
 *  on this browser (shared machine, same-browser test accounts, etc.) inherits
 *  the previous user's workspace/project selection and can appear to see data
 *  that isn't theirs. */
export function clearWorkspaceState(): void {
  try {
    localStorage.removeItem('activeWorkspaceId')
    localStorage.removeItem('activeProject')
    localStorage.removeItem('testsurge:selected-project')
    localStorage.removeItem('testsurge:recent-projects')
  } catch {}
}

export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {})
  clearWorkspaceState()
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const data = await authRequest<any>('/api/auth/me')
    return normalizeUser(data?.user ?? data)
  } catch {
    return null
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  return res.ok
}

/** Confirm the emailed token. This is the account's first login — the
 *  backend issues session cookies directly, so the result has the same
 *  shape as login()/register() used to. */
export async function verifyEmail(
  token: string,
): Promise<{ user: AuthUser; hasWorkspace: boolean }> {
  const data = await authRequest<any>('/api/auth/verify-email', { token })
  return {
    user: normalizeUser(data?.user ?? data),
    hasWorkspace: !!(data?.current_workspace ?? data?.user?.current_workspace),
  }
}

/** Re-send the verification email. Works from email alone (no session yet).
 *  See register() for `devVerificationLink` (local-dev-only convenience). */
export async function resendVerification(email: string): Promise<{ devVerificationLink?: string }> {
  const data = await authRequest<any>('/api/auth/resend-verification', { email })
  return { devVerificationLink: data?.dev_verification_link }
}

export async function forgotPassword(email: string): Promise<void> {
  await authRequest('/api/auth/forgot-password', { email })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await authRequest('/api/auth/reset-password', { token, password })
}

/** Save the first-login onboarding survey (any field may be omitted if skipped). */
export async function completeOnboarding(answers: {
  orgName?: string
  jobTitle?: string
  referralSource?: string
}): Promise<void> {
  await authRequest('/api/auth/onboarding', {
    org_name: answers.orgName,
    job_title: answers.jobTitle,
    referral_source: answers.referralSource,
  })
}
