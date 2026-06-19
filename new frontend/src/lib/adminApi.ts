// Admin API client — uses Authorization header (not cookie) since admin
// has a separate JWT issued by /api/admin/login.
// All calls go through the Next.js proxy route (/api/* → Flask).

const BACKEND = ''  // empty = use proxy route at /api/*

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('admin_token')
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BACKEND}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  })
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token')
      window.location.href = '/admin/login'
    }
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as any).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const adminApi = {
  login: (email: string, password: string) =>
    adminFetch<{ access_token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  metrics: () => adminFetch<any>('/api/admin/metrics'),
  users: () => adminFetch<any>('/api/admin/users'),
  workspaces: () => adminFetch<any>('/api/admin/workspaces'),
  subscriptions: () => adminFetch<any>('/api/admin/subscriptions'),
  credits: () => adminFetch<any>('/api/admin/credits'),
  apiUsage: () => adminFetch<any>('/api/admin/api_usage'),
  errors: () => adminFetch<any>('/api/admin/errors'),
  tokenUsage: (userId?: string) =>
    adminFetch<any>(`/api/admin/token-usage${userId ? `?user_id=${userId}` : ''}`),
}
