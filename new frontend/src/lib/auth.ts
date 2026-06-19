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
    throw new Error((data as any)?.message ?? (data as any)?.error ?? `Request failed (${res.status})`)
  }
  return data as T
}

function normalizeUser(raw: any): AuthUser {
  return {
    user_id: String(raw?.user_id ?? raw?.id ?? ''),
    email: String(raw?.email ?? ''),
    emailVerified: !!(raw?.email_verified ?? raw?.emailVerified ?? false),
    currentWorkspace: raw?.current_workspace ?? raw?.currentWorkspace ?? null,
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

export async function register(
  email: string,
  password: string,
): Promise<{ user: AuthUser; hasWorkspace: boolean }> {
  const data = await authRequest<any>('/api/auth/register', { email, password })
  return {
    user: normalizeUser(data?.user ?? data),
    hasWorkspace: !!(data?.current_workspace ?? data?.user?.current_workspace),
  }
}

export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {})
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

export async function verifyEmail(token: string): Promise<void> {
  await authRequest('/api/auth/verify-email', { token })
}

export async function resendVerification(): Promise<void> {
  await authRequest('/api/auth/resend-verification', {})
}

export async function forgotPassword(email: string): Promise<void> {
  await authRequest('/api/auth/forgot-password', { email })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await authRequest('/api/auth/reset-password', { token, password })
}
