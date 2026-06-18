# Signup Journey

End-to-end authentication journey across the marketing site and the product app.

```
Portfolio (marketing)
   └─ "Start free" CTA  →  NEXT_PUBLIC_APP_URL/signup
                              │
Product app (new frontend)    ▼
   /signup  → register (auto-login + personal workspace + verification email sent)
        │
        ▼
   /onboarding/workspace   (name / confirm workspace)
        │
        ▼
   /onboarding             (intro)
        │
        ▼
   /stories                (dashboard)

   Email verification (soft gate, in parallel):
     emailed link → /verify-email?token=…  → marks verified → dashboard
     Unverified users see a dismissible banner with "Resend email".

   Password reset:
     /forgot-password → email link → /reset-password?token=… → /login
```

## Pieces

### Backend (`backend/`)
- `users.email_verified` column + `auth_tokens` table (`app/models/create_dbs.py`).
- `app/models/token_model.py` — single-use, expiring, **hash-only** tokens
  (email_verify 24h, password_reset 1h).
- `app/utils/mailer.py` — SMTP via env vars; logs + returns False if unconfigured
  (never blocks the request).
- `app/routes/auth.py` endpoints:
  `register` (auto-login + sends verification), `login`, `logout`, `me`, `refresh`,
  `verify-email`, `resend-verification`, `forgot-password`, `reset-password`.
  Responses include `email_verified` and `current_workspace`.

### Product app (`new frontend/`)
- `src/lib/auth.ts` — `register/login` (return `{user, hasWorkspace}`), `verifyEmail`,
  `resendVerification`, `forgotPassword`, `resetPassword`, `getCurrentUser`.
- `src/contexts/AuthContext.tsx` — `AuthProvider`/`useAuth`; session persistence via
  `/auth/me` (httpOnly cookie is the source of truth).
- `src/middleware.ts` — route protection: logged-out → `/login?next=…`; logged-in on an
  auth page → `/stories` (except `/verify-email`).
- `src/components/auth/*` — shared `AuthShell` UI + `VerifyEmailBanner`.
- Pages: `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`,
  `/onboarding/workspace`, `/onboarding`.
- `src/components/layout/AppShell.tsx` renders auth/onboarding routes without app chrome.

### Marketing site (`portfolio/`)
- `src/lib/app.ts` — `SIGNUP_URL` / `LOGIN_URL` built from `NEXT_PUBLIC_APP_URL`.
- Primary CTAs (Hero, Navbar, Pricing, CTABanner) link to the product `/signup`.
- The existing `/signup` waitlist page is left intact (separate marketing feature).

## Environment variables

**Backend `.env`** (new — SMTP is optional; without it, links are logged, flow still works):
```
APP_URL=http://localhost:3000          # product app base, used to build email links
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey-or-username
SMTP_PASSWORD=********
SMTP_FROM=no-reply@testsurge.com       # defaults to SMTP_USER
SMTP_USE_TLS=1                          # STARTTLS (default). Use SMTP_USE_SSL=1 for implicit SSL
```

**Product app `new frontend/.env.local`**: `NEXT_PUBLIC_API_URL` (already set).

**Marketing site `portfolio/.env.local`**: `NEXT_PUBLIC_APP_URL` (see `.env.example`).

## Verify locally

1. Backend: `python -m app.models.migrations.001_multi_tenant` (or `python app/models/create_dbs.py`)
   to apply the `email_verified` + `auth_tokens` schema, then `python run.py`.
2. Product app: `npm run dev`. Visit `/signup`, create an account →
   lands on `/onboarding/workspace` → `/onboarding` → `/stories`.
3. With no SMTP configured, the verification link is printed to the backend console —
   open it to hit `/verify-email` and clear the banner.
4. `/forgot-password` → reset link in console → `/reset-password` → back to `/login`.
5. Log out, visit `/stories` → redirected to `/login?next=/stories`.

## Security notes
- Tokens are random 256-bit, stored as SHA-256 hashes, single-use, expiring; a DB leak
  can't replay them.
- `forgot-password` always returns 200 (no account enumeration).
- Email verification is a **soft gate**: users can use the app but are nudged to verify;
  the cookie/JWT remains the auth source of truth.
- Middleware does a fast cookie-presence gate; real validity is enforced server-side and
  by the apiClient 401-refresh.
