# TestSurge — Deployment Status

_Last updated: 2026-06-19_

Live URL: **https://testsurge.kynetropo.com** (app at `/app`, API at `/app/api`)
VPS: `ubuntu@3.81.221.119` · Project dir: `/home/ubuntu/test-case-generation`

This document records the state of the production deployment after migrating from
the previous (Caddy + single-frontend) stack to the current multi-service stack.

---

## 1. Architecture (current, live)

Single Docker Compose stack. **Caddy** terminates TLS on 80/443 and proxies to an
internal **nginx**, which routes to the two frontends and the backend.

```
Internet ──443/80──> caddy (Let's Encrypt TLS)
                        └─> nginx (internal :80)
                              ├─ /            -> portfolio      (Next.js :3000)
                              ├─ /app         -> app_frontend   (Next.js :3000, basePath /app)
                              └─ /app/api/*   -> backend         (Flask/gunicorn :5000)

backend ──> postgres (relational data)
backend ──> LanceDB  (embedded, file-based at /app/data/lance_db — NOT a container)
backend ──> redis    (Celery broker/result backend)

celery_worker  -> runs background jobs (emails, pipeline)         [reads redis]
celery_beat    -> schedules run_pipeline every 5 min (Jira sync)  [reads redis]
```

### Services (9) — all healthy

| Service | Image / build | Purpose |
|---|---|---|
| `caddy` | caddy:2-alpine | TLS termination (80/443), reverse proxy to nginx |
| `nginx` | nginx:alpine | Internal routing (portfolio / app / api) |
| `portfolio` | ./portfolio | Marketing site (`/`) |
| `app_frontend` | ./new frontend | App UI (`/app`, Next.js basePath `/app`) |
| `backend` | ./Backend | Flask API + embedded LanceDB |
| `postgres` | postgres:15-alpine | Relational DB (`test_case_gen`) |
| `redis` | redis:7-alpine | Celery broker + result store |
| `celery_worker` | ./Backend | Background task runner (emails, pipeline) |
| `celery_beat` | ./Backend | Periodic scheduler (replaces old standalone `scheduler`) |

> **LanceDB** is a library running inside `backend` (vector store on disk), not a
> separate service. **Celery_beat replaces** the previous standalone `scheduler`
> container from the old stack.

---

## 2. Deployment notes / infra decisions

- **TLS preserved via Caddy.** The shipped `docker-compose.yml`/nginx only expose
  port 80. To keep HTTPS working (the old stack used Caddy on 443), the live
  compose was adjusted so **nginx is internal-only and Caddy sits in front** on
  80/443. The existing Let's Encrypt cert volume (`test-case-generation_caddy_data`)
  was reused — no re-issue.
- **Old stack volumes preserved** (no `down -v`). The new Postgres uses a fresh
  volume (`pg_data`); old `app_data` (LanceDB/uploads) was reused.
- **Production env** lives at `/home/ubuntu/test-case-generation/.env.production`
  (JWT secret, Groq keys, Postgres creds, `PUBLIC_APP_URL`, `FRONTEND_ORIGIN`).
  `GOOGLE_GENERATIVE_AI_API_KEY` is currently **empty**.
- A backup of the previous folder is at
  `/home/ubuntu/old-test-case-generation-backup-*.tgz`.

### Redeploy procedure (current)

```bash
# Local: build archive (excludes node_modules/.next/.git/.env)
cd test-case-generation
tar --exclude=.git --exclude=node_modules --exclude=.next --exclude='.env*' \
    -czf /tmp/tcg-deploy.tgz .
scp -i ~/Downloads/testgen.pem /tmp/tcg-deploy.tgz ubuntu@3.81.221.119:/home/ubuntu/

# VPS
cd /home/ubuntu/test-case-generation
docker compose --env-file .env.production down        # keep volumes (NO -v)
tar -xzf /home/ubuntu/tcg-deploy.tgz -C .
docker compose --env-file .env.production up -d --build
```

> The live compose keeps `nginx` internal and adds the `caddy` front + `Caddyfile`.
> Re-apply those infra tweaks if you overwrite `docker-compose.yml` from the repo.

---

## 3. Done — fixes applied (and persisted to source)

All fixes are committed to the local working tree **and** synced to the VPS, so
rebuilds keep them. (Files are modified but **not yet `git commit`-ed.**)

1. **DB schema not initialized on fresh Postgres.** New stack dropped the old
   `backend-init` service, so no tables existed → every auth call 500'd.
   Ran `Backend/app/models/create_dbs.py` to create schema + LanceDB table.

2. **`create_dbs.py` could not init a fresh DB — two bugs fixed:**
   - Removed invalid FK `test_case_impacts.fk_original_story` → `test_cases(story_id)`
     (`story_id` is not unique in the multi-tenant schema; `fk_original_run` on the
     `run_id` PK already covers integrity).
   - Moved index `idx_test_case_impacts_new_story_user` to **after** the `user_id`
     column is added (was referenced before it existed).
   - File: `Backend/app/models/create_dbs.py`.

3. **`/api/stories/` 500 — missing `story_status` column.** The stories query
   selects `story_status` from `test_cases`, but the schema never created it.
   Added `story_status TEXT DEFAULT 'in_review' CHECK (in_review|in_progress|completed)`
   (live DB + persisted in `create_dbs.py`).

4. **`celery_worker` / `celery_beat` crash-loop (circular import).**
   `make_celery()` imported the task modules before the module-level `celery` was
   bound, while those modules do `from celery_app import celery`. Moved the task
   imports to **after** `celery = make_celery()`. File: `Backend/celery_app.py`.

5. **Sidebar logo 400 (`/_next/image?url=/icon.png`).** `next/image` optimizer
   can't resolve a basePath-prefixed public asset in a self-hosted standalone
   build. Added `unoptimized` to the single `<Image>` so it serves
   `/app/icon.png` directly. File: `new frontend/src/components/Sidebar.tsx`.

### Verified working
- `https://testsurge.kynetropo.com/` → 200 (portfolio), valid Let's Encrypt cert
- `/app/login`, `/app/signup` → 200
- `POST /app/api/auth/register` → 201 (account + workspace created)
- `GET /app/api/stories/` → 200
- `GET /app/icon.png` → 200
- `celery_worker` ready with all tasks registered; `celery_beat` scheduling

---

## 4. To do next

### High priority
- [ ] **Commit the fixes.** Working-tree changes to `create_dbs.py`,
      `celery_app.py`, `Sidebar.tsx` are not committed yet.
- [ ] **SMTP credentials.** Background email tasks run but won't *deliver* until
      SMTP env vars (`app/utils/mailer.py`) are set in `.env.production`. Affects
      verification / welcome / invite / password-reset emails.
- [ ] **Add `backend-init` (DB migration) to the stack** so a fresh deploy
      auto-creates the schema instead of needing a manual `create_dbs.py` run.
      (Old stack had this; new compose dropped it.)

### Medium priority
- [ ] **Google sign-in is not functional.** "Continue with Google" exists only on
      the portfolio `/login` page, which nginx redirects to `/app/login` (the app
      frontend, which has no Google button). There is also **no backend Google
      OAuth route**. To make it work: add the button to the app login/signup UI
      **and** implement backend OAuth (Google client id/secret + callback).
- [ ] **`GOOGLE_GENERATIVE_AI_API_KEY` is empty** in `.env.production`. Set it if
      Gemini embeddings / features are needed.
- [ ] **Verify the Jira pipeline.** `celery_beat` runs `run_pipeline` every 5 min,
      but it no-ops unless `JIRA_SYNC_ENABLED=true` (+ `JIRA_PROJECT_KEYS`) is set.

### Low priority / cleanup
- [ ] **Old LanceDB schema reuse.** The new stack reused the old `app_data` volume.
      If old vector data is incompatible with the new multi-tenant schema, reset
      the LanceDB table (`drop_table` + recreate) for a clean state.
- [ ] **Remove leftover `testforge-adminer`** container (old DB UI on
      `127.0.0.1:8080`) if no longer needed.
- [ ] **HTTP→HTTPS redirect scheme.** nginx `return 302` emits an `http://`
      Location for `/login` etc.; Caddy upgrades it, but consider using
      `$scheme`/forwarded-proto to avoid the extra hop.

---

## 5. Other stacks on this VPS (untouched)

- **saas-erp** — separate ERP app: `saas-erp-web` (→ `:8090`), `saas-erp-api`,
  `saas-erp-db`. Reachable directly at `http://3.81.221.119:8090`. No domain
  points at this VPS for it (`ecosudar.kynetropo.com` does not resolve;
  `kynetropo.com` apex → a different Hostinger IP).
- **testforge-adminer** — old DB admin UI, localhost-only (`127.0.0.1:8080`).
