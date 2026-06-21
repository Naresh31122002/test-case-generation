// lib/apiClient.ts
//
// TestSurge — typed HTTP client
//
// All requests are sent with credentials:'include' because the backend uses
// HttpOnly cookie-based JWTs. Removing credentials would silently break auth
// on every call — the cookies simply would not be sent.

// All API calls go through the Next.js proxy route at /api/* which forwards
// requests to Flask and correctly passes Set-Cookie headers back to the browser.
// This keeps auth cookies on the same origin (localhost:3027).
export const BASE_URL: string = ''

// ─── ApiError ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  override name = 'ApiError'

  constructor(
    public readonly status: number,
    public readonly body: Record<string, unknown>,
  ) {
    super((body.error as string) ?? `HTTP ${status}`)
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * RequestOptions extends the standard RequestInit but:
 * - omits `credentials` (always forced to "include" — see rawFetch)
 * - adds `isMultipart`: when true, Content-Type is NOT set so the browser can
 *   append the correct multipart boundary for FormData uploads.
 */
export type RequestOptions = Omit<RequestInit, 'credentials'> & {
  isMultipart?: boolean
}

// ─── Internal state ──────────────────────────────────────────────────────────

/**
 * Guards against concurrent 401 → refresh storms.
 * If two requests both get a 401 at the same time, only the first triggers
 * the refresh call; the second skips it and falls through to the redirect path.
 */
let isRefreshing = false

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Attempts a single token-refresh call.
 * Returns true when the server accepted the refresh (res.ok).
 * Always clears `isRefreshing` in finally so a stuck flag can never block the
 * application permanently.
 */
async function attemptRefresh(): Promise<boolean> {
  if (isRefreshing) return false
  isRefreshing = true
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    return res.ok
  } catch {
    return false
  } finally {
    isRefreshing = false
  }
}

/**
 * Thin wrapper around the native fetch API.
 * - Builds the full URL from BASE_URL + path.
 * - Always adds credentials:'include'.
 * - Adds Content-Type: application/json unless isMultipart is true (FormData
 *   uploads need the browser to set its own multipart boundary).
 */
function rawFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const { isMultipart, headers: callerHeaders, ...rest } = options

  const baseHeaders: Record<string, string> = isMultipart
    ? {}
    : { 'Content-Type': 'application/json' }

  // Inject active workspace so the backend @workspace_required decorator
  // can scope every query to the correct tenant without a round-trip.
  if (typeof window !== 'undefined') {
    const wsId = window.localStorage.getItem('activeWorkspaceId')
    if (wsId) baseHeaders['X-Workspace-Id'] = wsId
  }

  const mergedHeaders: HeadersInit = {
    ...baseHeaders,
    ...(callerHeaders as Record<string, string> | undefined),
  }

  return fetch(`${BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: mergedHeaders,
  })
}

// ─── Main exported function ──────────────────────────────────────────────────

/**
 * Performs an authenticated HTTP request to the TestSurge backend and returns
 * the parsed JSON body typed as T.
 *
 * ## 401 flow
 * 1. rawFetch sends the request with credentials:'include' so the browser
 *    attaches the HttpOnly access-token cookie automatically.
 * 2. If the server responds 401, attemptRefresh calls POST /api/auth/refresh
 *    — also with credentials:'include' — so the browser sends the refresh cookie.
 * 3. If the refresh succeeds (res.ok), the original request is retried ONCE.
 * 4. If the retry still returns 401, the user is redirected to
 *    /login?next=<encoded path> and an ApiError(401) is thrown.
 *
 * ## Why credentials:'include' must never be removed
 * The backend issues HttpOnly cookies that JavaScript cannot read. Removing
 * credentials:'include' causes browsers to omit those cookies on cross-origin
 * requests, making every call appear unauthenticated without any visible JS error.
 *
 * @param path    Backend path relative to BASE_URL, e.g. "/api/stories/"
 * @param options Standard RequestInit minus `credentials`, plus `isMultipart`
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawFetch(path, options)

  if (res.status === 401) {
    const refreshed = await attemptRefresh()

    if (refreshed) {
      res = await rawFetch(path, options)
    }

    // Still 401 after one refresh attempt — clear cookies and force login
    if (res.status === 401) {
      // Don't redirect if already on login page or on admin routes (admin has its own auth)
      if (typeof window !== 'undefined'
          && !window.location.pathname.includes('/login')
          && !window.location.pathname.includes('/admin')) {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        const loginPath = appUrl ? `${appUrl}/login` : '/login'
        window.location.href = loginPath
      }
      throw new ApiError(401, { error: 'Session expired' })
    }
  }

  if (!res.ok) {
    const body: Record<string, unknown> = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body)
  }

  return res.json() as Promise<T>
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

/** Sends a GET request and returns the JSON body typed as T. */
export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

/**
 * Sends a POST request with a JSON-serialised body and returns the JSON
 * response typed as T.
 */
export function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Uploads a FormData payload (multipart/form-data) via POST.
 * Content-Type is intentionally omitted so the browser appends the correct
 * multipart boundary to the header.
 */
export function upload<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: formData,
    isMultipart: true,
  })
}

/** Sends a DELETE request and returns the JSON body typed as T. */
export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}
