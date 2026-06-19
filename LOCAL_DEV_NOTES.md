# Local Development Setup & Production Migration Guide

All local dev changes listed here must be reviewed before production deployment.

---

## 1. Backend — `Backend/.env`

**Local:**
```
DEV_BYPASS_AUTH=0
FLASK_ENV=development
FLASK_DEBUG=1
JWT_SECRET_KEY=dev-secret-key-change-in-production
FRONTEND_URL=http://localhost:3027
```

**Production — add/change these:**
```
DEV_BYPASS_AUTH=0
FLASK_ENV=production
FLASK_DEBUG=0
JWT_SECRET_KEY=<strong-random-256-bit-secret>
FRONTEND_URL=https://app.testsurge.com
APP_URL=https://app.testsurge.com
REDIS_URL=redis://<elasticache-endpoint>:6379/0
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=<ses-smtp-username>
SMTP_PASSWORD=<ses-smtp-password>
SMTP_FROM=no-reply@testsurge.com
STRIPE_SECRET_KEY=<live-stripe-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
ADMIN_EMAIL=<admin-email>
ADMIN_PASSWORD=<strong-admin-password>
LANCE_DB_PATH=s3://your-bucket/lance_db
```

---

## 2. Backend — `Backend/run.py`

**Local change:** `use_reloader=False` to prevent Flask debug reloader from spawning child processes (causes stale code after file edits).

```python
app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
```

**Production:** `run.py` is not used. Gunicorn is used instead:
```bash
gunicorn --config gunicorn.conf.py "app:create_app()"
```

---

## 3. Backend — `Backend/app/__init__.py`

These settings are already environment-aware — no code changes needed, just set `FLASK_ENV=production`:

| Setting | Dev (auto) | Prod (auto) |
|---------|-----------|-------------|
| `JWT_COOKIE_CSRF_PROTECT` | `False` | `True` |
| `JWT_COOKIE_SECURE` | `False` (HTTP) | `True` (HTTPS only) |
| `JWT_COOKIE_SAMESITE` | `"Lax"` | `"Lax"` |
| CORS origins | all localhost ports | `FRONTEND_URL` + `VERCEL_URL` |
| Security headers (HSTS, CSP) | off | on |

**One manual production change needed** in `__init__.py`:
```python
app.config["JWT_COOKIE_DOMAIN"] = ".testsurge.com"  # subdomain sharing
```

---

## 4. Backend — Redis (`jwt_blocklist.py` + `limiter.py`)

**Local:** No Redis running → both gracefully degrade:
- JWT blocklist is disabled (logouts clear cookie but don't revoke token server-side)
- Rate limiter uses in-memory storage (resets on restart)

**Production:** Set `REDIS_URL` → both activate automatically. No code changes needed.

---

## 5. Frontend — Proxy Route (`new frontend/src/app/api/[...path]/route.ts`)

**Why it exists:** In local dev the frontend (`localhost:3027`) and backend (`localhost:5000`) are on different ports. Browsers won't correctly store/send `HttpOnly` cookies across ports without help. The Next.js API route at `/api/[...path]/route.ts` proxies all API calls server-side, explicitly forwarding `Set-Cookie` headers so cookies land on `localhost:3027`.

**Local:** `BACKEND_URL=http://localhost:5000` in `.env.local`

**Production options:**

**Option A — Keep proxy (Vercel or separate frontend/backend domains):**
- Set `BACKEND_URL=https://api.testsurge.com` in production env vars
- The proxy route stays in place — transparent to the app
- No code changes needed

**Option B — Remove proxy (nginx same-domain):**
- If nginx routes `app.testsurge.com/api/*` → Flask and `app.testsurge.com/*` → Next.js:
  - Delete `src/app/api/[...path]/route.ts`
  - Set `BASE_URL = ""` permanently in `apiClient.ts` and `auth.ts`
  - Cookies are naturally same-origin, no proxy needed

---

## 6. Frontend — `new frontend/src/lib/apiClient.ts` + `auth.ts`

**Local change:** `BASE_URL = ""` — relies on the proxy route.

**Production (Option A — keep proxy):** Keep `BASE_URL = ""`. Works fine.

**Production (Option B — nginx same-domain):** Keep `BASE_URL = ""`. Works fine.

**Production (Option C — fully separate domains with CORS):** Set `BASE_URL = "https://api.testsurge.com"` and configure `SameSite=None; Secure=True` cookies on the backend.

---

## 7. Frontend — `new frontend/.env.local` (gitignored)

**Local:**
```
BACKEND_URL=http://localhost:5000
```

**Production:** Set in hosting provider env vars:
```
BACKEND_URL=https://api.testsurge.com
```

---

## 8. LanceDB

**Local:** `LANCE_DB_PATH=./data/lance_db` — local disk. Lost on redeploy.

**Production:** Change to S3:
```
LANCE_DB_PATH=s3://your-s3-bucket/lance_db
```
Requires IAM role with `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on the bucket.

---

## 9. Frontend — Middleware matcher (`new frontend/src/middleware.ts`)

**Local change:** Added `api/` to the matcher exclusion list so the middleware doesn't intercept API proxy calls and redirect them to `/login`.

```
matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:png|jpg|...)$).*)"]
```

**Production:** Keep this change — API routes should never be gated by the auth middleware regardless of environment.

---

## 10. Frontend — Post-login full page reload (`login/page.tsx` + `signup/page.tsx`)

**Local change:** After successful login/signup, `window.location.href = destination` is used instead of `router.push()`.

**Why:** Next.js `router.push()` does client-side navigation — the middleware doesn't re-run, so it doesn't see the new cookie and bounces back to `/login`. A full page reload forces the browser to send the cookie to the server, the middleware sees it, and lets the user through.

**Production:** Keep this change — same behavior is needed in production. The full reload is a one-time cost only on login/signup.

---

## 11. Frontend — All fetch calls use proxy (`/api/*` not `http://localhost:5000/api/*`)

**Local change:** `ProjectContext.tsx`, `apiClient.ts`, `auth.ts`, and `lib/ai/requirements.ts` all use relative paths (`/api/...`) with no hostname, routing through the Next.js proxy.

**Production:** Keep relative paths — works with both the proxy route (Option A) and nginx same-domain (Option B).

---

## 12. Frontend — Proxy route fixes (`src/app/api/[...path]/route.ts`)

**Changes made:**

1. **`export const dynamic = 'force-dynamic'`** — prevents Next.js from caching or pre-rendering the proxy route, which caused 500 errors on POST requests.

2. **Raw `arrayBuffer()` for all body types** — originally tried to parse multipart as `FormData` and re-serialize it, which crashed (502). Fix: pass all request bodies as raw `arrayBuffer()`. The `content-type: multipart/form-data; boundary=...` header is forwarded as-is so Flask can parse the boundary correctly. This applies to JSON, form-data, and file uploads.

3. **try/catch wrapper** — unhandled proxy errors now return 502 with a detail message instead of crashing with an opaque 500.

**Production:** Keep all three changes — they're correct behavior in all environments.

---

## 13. Frontend — Session expiry auto-logout (`src/lib/apiClient.ts`)

**Local change:** When both the access token and refresh token are expired (all 401s), `apiClient` now:
1. Calls `POST /api/auth/logout` to clear HttpOnly cookies server-side
2. Does `window.location.href = '/login?next=...'` (full page reload)

**Why:** Without this, expired cookies stay in the browser, the middleware sees them and blocks `/login`, creating a redirect loop the user can't escape without manually clearing cookies.

**Production:** Keep this change — same behavior needed in production.

---

## 14. Backend — Dev token expiry (`Backend/app/__init__.py`)

**Local change:** Access token expiry is 8 hours in dev, 15 minutes in production:
```python
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15) if is_production else timedelta(hours=8)
```

**Production:** Already correct — `is_production=True` → 15 min expiry. No change needed.

---

## 13. Auth Pages + Middleware (production-ready, no changes needed)

- `src/middleware.ts` — route protection, redirects unauthenticated users to `/login`
- `src/app/login/page.tsx` — real login via `POST /api/auth/login`
- `src/app/signup/page.tsx` — real registration via `POST /api/auth/register`
- `src/app/onboarding/workspace/page.tsx` — workspace setup
- `src/contexts/AuthContext.tsx` — session persistence via `/api/auth/me`

---

## Production Pre-Launch Checklist

- [ ] `FLASK_ENV=production` set
- [ ] `JWT_SECRET_KEY` replaced with strong random secret (min 32 chars)
- [ ] `DEV_BYPASS_AUTH=0` confirmed
- [ ] `REDIS_URL` pointing to ElastiCache
- [ ] `LANCE_DB_PATH` pointing to S3 bucket
- [ ] SMTP / AWS SES configured
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` set to live keys
- [ ] `ADMIN_EMAIL` + `ADMIN_PASSWORD` set to secure values
- [ ] Run DB migration: `python -m app.models.migrations.001_multi_tenant` on Neon staging branch first
- [ ] Stripe webhook endpoint registered at `https://api.testsurge.com/api/stripe/webhook`
- [ ] `FRONTEND_URL` set to production domain in backend `.env`
- [ ] `JWT_COOKIE_DOMAIN` set to `.testsurge.com` in `__init__.py`
- [ ] SSL/HTTPS confirmed on both frontend and backend domains
- [ ] `BACKEND_URL` set to `https://api.testsurge.com` in frontend env vars
- [ ] Remove or keep proxy route depending on deployment architecture (see §5)
- [ ] Test full signup → onboarding → stories → upload → generate flow on staging
