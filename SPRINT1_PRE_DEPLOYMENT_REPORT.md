# Sprint 1 — Pre-Deployment Report

**Date:** 2026-06-22
**Branch:** `dev-ui-merge`
**Target:** VPS `3.81.221.119`, `/home/ubuntu/test-case-generation` (per [VPS_DB_TARGET_VERIFICATION_REPORT.md](VPS_DB_TARGET_VERIFICATION_REPORT.md))
**Status:** **NOT DEPLOYED.** Nothing in this report has been executed against the VPS. Sprint 1 code is not yet present in the running `test-case-generation-backend-1` container, and none of the new DB objects exist yet (confirmed by live audit). This is a plan for review only.

Source of truth for "files changed": `git status --porcelain` + `git diff --stat` against the working tree on `dev-ui-merge`, verified directly — not restated from memory.

---

## 1. Files Changed (all, 28 total)

**17 modified, 11 new** (4 backend code, 4 email templates, 1 frontend page, 1 frontend component, 4 prior report docs — docs are not deployed artifacts).

## 2. Frontend Files Changed (11)

**Modified (9):**
| File | Lines | Purpose |
|---|---|---|
| `new frontend/src/app/settings/layout.tsx` | +62/−~38 | Team nav hidden until workspace exists |
| `new frontend/src/app/stories/[id]/tabs/OverviewTab.tsx` | +46/−~16 | AI Insights collapsed-by-default |
| `new frontend/src/app/stories/page.tsx` | +45/−~13 | Status/Priority/Impact filter dropdowns |
| `new frontend/src/components/Sidebar.tsx` | +23/−~9 | Kanban nav item; dedup'd name/email footer |
| `new frontend/src/components/TestCaseKanban.tsx` | +105/−~16 | Drawer wiring, `tc_status` persistence, filter bar |
| `new frontend/src/components/WorkspaceSwitcher.tsx` | +20/−~7 | "Create Workspace" affordance |
| `new frontend/src/components/onboarding/OnboardingSurveyModal.tsx` | +101/−~24 | Required Full Name + optional Workspace Name step |
| `new frontend/src/lib/api.ts` | +83/−~9 | Test-case collaboration + filter params |
| `new frontend/src/lib/auth.ts` | +29/−~6 | `fullName`/`currentWorkspaceName`, `updateProfile` |
| `new frontend/src/lib/storiesStore.ts` | +22/−~5 | Optional server-side `StoryFilters` |
| `new frontend/src/types/domain.ts` | +12/−0 | `status`/`tcStatus`/`automationReady` fields |

**New (2):**
| File | Purpose |
|---|---|
| `new frontend/src/app/kanban/page.tsx` | `/kanban` route — reuses `StoryKanban`/`TestCaseKanban`, no duplicated logic |
| `new frontend/src/components/TestCaseDrawer.tsx` | Test Case detail drawer (Title/Priority/Status/Steps/Expected/Comments/Assignee/Activity) |

## 3. Backend Files Changed (10)

**Modified (6):**
| File | Lines | Purpose |
|---|---|---|
| `Backend/app/models/create_dbs.py` | +62/−0 | Guarded DDL — see Section 4 |
| `Backend/app/models/user_model.py` | +25/−~4 | `full_name` in getters; `update_profile` |
| `Backend/app/models/workspace_model.py` | +30/−0 | `rename` (owner-only) |
| `Backend/app/routes/auth.py` | +30/−~6 | `PATCH /me`; onboarding accepts name/workspace |
| `Backend/app/routes/stories.py` | +343/−~10 | Test-case collaboration routes, `tc-status`, server-side filters, notification dispatch |
| `Backend/app/tasks/email_tasks.py` | +58/−0 | 4 new Celery tasks |

**New (4):**
| File | Purpose |
|---|---|
| `Backend/app/models/test_case_collaboration_model.py` | `TestCaseAssigneesModel`/`TestCaseActivityModel`/`TestCaseCommentsModel` |
| `Backend/app/services/notification_service.py` | Workspace-scoped, best-effort notification dispatch |
| `Backend/app/templates/emails/*.html` (×4) | See Section 10 |

**Net diff: 17 files changed, 992 insertions(+), 104 deletions(-)** (code files only, excludes the 4 prior `.md` reports which are not deployed).

---

## 4. Database Changes

All via the existing idempotent `Backend/app/models/create_dbs.py` mechanism — no Alembic, every statement guarded (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`). **Confirmed live against the VPS's actual `test_case_gen` database: none of the objects below currently exist** — this will be a clean first application, not a re-run.

## 5. New Tables (3)

| Table | Key columns | FKs | Purpose |
|---|---|---|---|
| `test_case_assignees` | `id UUID PK`, `test_case_id`, `story_id`, `workspace_id`, `user_id`, `assigned_by`, `assigned_at` | `workspace_id→workspaces` CASCADE, `user_id→users` CASCADE, `assigned_by→users` SET NULL | Per-test-case assignment, mirrors `story_assignees` |
| `test_case_activity` | `id UUID PK`, `test_case_id`, `story_id`, `workspace_id`, `user_id`, `action`, `metadata JSONB`, `created_at` | `workspace_id→workspaces` CASCADE | Append-only timeline, mirrors `story_activity` |
| `test_case_comments` | `id UUID PK`, `test_case_id`, `story_id`, `workspace_id`, `user_id`, `body`, `created_at`, `updated_at` | `workspace_id→workspaces` CASCADE, `user_id→users` CASCADE | Comments, mirrors `story_comments` |

## 6. New Columns (1)

| Table | Column | Type | Default | Notes |
|---|---|---|---|---|
| `users` | `full_name` | `TEXT` | none (nullable) | No backfill; existing users get `NULL` until set |

**No column was added to `test_cases`.** `tc_status` is stored as a field inside the existing `test_case_json` JSONB blob (per-test-case JSON array element) — `test_cases` is one row per story, not per test case, so a relational column there would be semantically wrong. See [TC_STATUS_STORAGE_ANALYSIS.md](TC_STATUS_STORAGE_ANALYSIS.md) for the tradeoffs of this choice (analysis only, unchanged by this report).

## 7. New Indexes (3)

| Index | On | Purpose |
|---|---|---|
| (unnamed, on `test_case_assignees`) | `(workspace_id, test_case_id)` | Fast assignee lookup per test case |
| (unnamed, on `test_case_activity`) | `(workspace_id, test_case_id, created_at DESC)` | Fast timeline fetch, newest first |
| (unnamed, on `test_case_comments`) | `(workspace_id, test_case_id, created_at)` | Fast comment list fetch |

Plus one **constraint** (not an index, but added alongside): `UNIQUE (workspace_id, test_case_id, user_id)` on `test_case_assignees`, preventing duplicate assignment rows.

---

## 8. New API Routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/stories/<story_id>/testcases/<tc_id>/assignees` | List test-case assignees |
| `POST` | `/api/stories/<story_id>/testcases/<tc_id>/assignees` | Assign a user (workspace-member-only; triggers email) |
| `DELETE` | `/api/stories/<story_id>/testcases/<tc_id>/assignees/<user_id>` | Remove assignee |
| `GET` | `/api/stories/<story_id>/testcases/<tc_id>/activity` | Activity timeline |
| `GET` | `/api/stories/<story_id>/testcases/<tc_id>/comments` | List comments |
| `POST` | `/api/stories/<story_id>/testcases/<tc_id>/comments` | Add comment (parses `@mentions`; triggers email) |
| `PATCH` | `/api/stories/<story_id>/testcases/<tc_id>/comments/<comment_id>` | Edit own comment |
| `DELETE` | `/api/stories/<story_id>/testcases/<tc_id>/comments/<comment_id>` | Delete own comment |
| `PATCH` | `/api/stories/<story_id>/testcases/<tc_id>/tc-status` | Persist Kanban column (`todo`/`in_progress`/`done`) |
| `PATCH` | `/api/auth/me` | Update own `full_name` (uses existing `@jwt_required()`) |

**Changed, backward-compatible (existing routes, new optional params only):**
- `GET /api/stories/` — `?status=&priority=&impact=&assignee=`
- `GET /api/stories/<id>/testcases` — `?priority=&status=&automation_ready=&impacted=`
- `POST /api/auth/onboarding` — now also accepts `full_name`, `workspace_name`
- `GET /api/auth/me` — response now includes `full_name`
- `POST /api/stories/<id>/assignees`, `.../comments` — unchanged contract, now also enqueue notification emails

No existing route had its method, path, auth decorator, or response shape changed in a breaking way.

---

## 9. Celery Tasks Added (4)

All in `Backend/app/tasks/email_tasks.py`, same `@celery.task(bind=True, max_retries=3, default_retry_delay=60)` pattern as existing tasks, auto-imported via `celery_app.py`'s existing `import app.tasks.email_tasks` — **no change to `celery_app.py` itself was required**, since it already imports the whole module.

| Task | Trigger |
|---|---|
| `task_send_story_assigned` | Story assignee added |
| `task_send_test_case_assigned` | Test case assignee added |
| `task_send_comment_added` | Comment added (notifies assignees) |
| `task_send_mention` | `@mention` resolved to a workspace member in a comment |

## 10. Email Templates Added (4)

All under `Backend/app/templates/emails/`, matching existing inline-CSS template style (e.g. `invite_user.html`):
- `story_assigned.html`
- `test_case_assigned.html`
- `comment_added.html`
- `mention.html`

---

## 11. Containers That Will Be Rebuilt

Based on the live VPS container inventory (audited 2026-06-22, see [VPS_DB_TARGET_VERIFICATION_REPORT.md](VPS_DB_TARGET_VERIFICATION_REPORT.md)):

| Container | Why rebuild |
|---|---|
| `test-case-generation-backend-1` | New Python files (`test_case_collaboration_model.py`, `notification_service.py`), modified routes/models, new Jinja templates — image must be rebuilt to bake in new source |
| `test-case-generation-app_frontend-1` | New/modified `.tsx`/`.ts` files, new `/kanban` route — Next.js build must be regenerated |
| `test-case-generation-celery_worker-1` | Same backend image as above (shares the built image with `backend`); must rebuild to pick up the 4 new tasks |
| `test-case-generation-celery_beat-1` | Same image as `celery_worker` — rebuilt as a side effect even though Sprint 1 added no scheduled (beat) tasks |

**Not rebuilt:** `test-case-generation-postgres-1`, `test-case-generation-redis-1`, `test-case-generation-nginx-1`, `test-case-generation-portfolio-1`, and the unrelated `saas-erp-*` / `edge-caddy` / `testforge-adminer` containers — none of their images change.

## 12. Containers That Will Be Restarted

| Container | Why restart | Data loss risk |
|---|---|---|
| `test-case-generation-backend-1` | Load rebuilt image | None — stateless app container |
| `test-case-generation-app_frontend-1` | Load rebuilt image | None — stateless |
| `test-case-generation-celery_worker-1` | Load rebuilt image, **must restart to import the 4 new tasks** (`celery_app.py:41` auto-import only happens at process start) | None — in-flight tasks should drain/requeue per Celery's normal restart behavior; broker (Redis) retains the queue |
| `test-case-generation-celery_beat-1` | Same image rebuild | None — no schedule changes in this sprint |
| `test-case-generation-postgres-1` | **Not restarted.** Schema changes (`CREATE TABLE`/`ALTER TABLE ADD COLUMN`) are applied via a one-off `create_dbs.py` run against the running container — Postgres does not need to restart for DDL of this kind | N/A — container stays up; named volume `test-case-generation_pg_data` is untouched either way |
| `test-case-generation-redis-1` | Not restarted | N/A |
| `test-case-generation-nginx-1` | Not restarted (routing config unchanged) | N/A |
| `test-case-generation-portfolio-1`, `saas-erp-*`, `edge-caddy`, `testforge-adminer` | Not restarted — unrelated to this deployment | N/A |

**Recommended order:** (1) run `create_dbs.py` against `test-case-generation-postgres-1` while it stays up and serving the *old* backend, (2) rebuild + restart `backend`, (3) rebuild + restart `app_frontend`, (4) restart `celery_worker` + `celery_beat` last so they pick up the new tasks once the backend image (which they share) is rebuilt.

---

## Confirmations

| Item | Status | Evidence |
|---|---|---|
| **No auth changes** | ✅ Confirmed | `git status` shows zero auth-core files touched (no session/login/password modules). The only `auth.py` changes are a new `PATCH /me` and onboarding extension, both using the pre-existing `@jwt_required()` / `get_jwt_identity()` decorators verbatim — no new auth logic, no new decorator, no change to how identity is resolved. |
| **No JWT changes** | ✅ Confirmed | No JWT secret, token issuance, expiry, or verification code touched. `grep` of the full diff for JWT-related files returns nothing beyond the existing decorator usage. |
| **No billing changes** | ✅ Confirmed | No billing module appears anywhere in `git status`/`git diff`. |
| **No Stripe changes** | ✅ Confirmed | `grep -i stripe` across the diff returns zero matches. |
| **No credits logic changes** | ✅ Confirmed | `grep -i credit` across the diff returns zero matches; `credit_transactions`/`workspace_credits` tables and their code paths are untouched. |
| **No production data deletion** | ✅ Confirmed | Every DDL statement is additive (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`). No `DROP`, `DELETE`, `TRUNCATE`, or destructive `UPDATE` appears in any changed file. Live VPS audit confirms current data is untouched (read-only `SELECT count`/`information_schema` queries only). |
| **No `.env` changes** | ✅ Confirmed | `git status` shows no `.env`, `.env.production`, or `docker.env.production.example` file modified, added, or deleted. No new required environment variable was introduced — the 4 new Celery tasks reuse the existing SES/`FRONTEND_URL` configuration already present in the deployed `.env`. |

---

## Waiting for approval

No deployment action has been taken. Per your instructions, this report stops here. Awaiting explicit go-ahead before:
1. Running `create_dbs.py` against the VPS's `test-case-generation-postgres-1`, and/or
2. Rebuilding/restarting any container on `3.81.221.119`.
