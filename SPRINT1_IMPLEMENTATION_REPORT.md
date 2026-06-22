# TestSurge — Product Hardening Sprint 1 — Implementation Report

**Date:** 2026-06-21
**Branch:** `dev-ui-merge`
**Scope:** 7 additive phases. **No** changes to auth core, JWT, billing/Stripe/credits, workspace security, multi-tenant isolation logic, or story/test generation. All DB changes are additive and guarded (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`). No existing data is modified.

**Verification status:**
- Frontend `tsc --noEmit`: ✅ clean
- Frontend `next build`: ✅ succeeds (new `/kanban` route builds)
- Backend `py_compile` + AST parse of all touched files: ✅ clean
- Live DB migration / Celery enqueue: to be run in the target environment (see Deployment Plan).

---

## 1. Files Changed

### Backend (new)
- `Backend/app/models/test_case_collaboration_model.py` — `TestCaseAssigneesModel`, `TestCaseActivityModel`, `TestCaseCommentsModel` (mirror of `story_collaboration_model.py`, keyed by `(workspace_id, test_case_id)`).
- `Backend/app/services/notification_service.py` — workspace-scoped, best-effort dispatch layer over Celery email tasks (assign / comment / @mention).
- `Backend/app/templates/emails/story_assigned.html`
- `Backend/app/templates/emails/test_case_assigned.html`
- `Backend/app/templates/emails/comment_added.html`
- `Backend/app/templates/emails/mention.html`

### Backend (modified)
- `Backend/app/models/create_dbs.py` — added guarded DDL: `users.full_name` column; `test_case_assignees`, `test_case_activity`, `test_case_comments` tables + indexes.
- `Backend/app/routes/stories.py` — test-case collaboration routes, test-case Kanban `tc-status` route, server-side filters on `GET /` and `GET /<id>/testcases`, email dispatch wired into story assignee/comment routes.
- `Backend/app/routes/auth.py` — `PATCH /api/auth/me`; onboarding now accepts `full_name` + `workspace_name`; `GET /me` surfaces `full_name`.
- `Backend/app/models/user_model.py` — `full_name` in getters; new `update_profile`.
- `Backend/app/models/workspace_model.py` — new `rename` (owner-only).
- `Backend/app/tasks/email_tasks.py` — 4 new Celery tasks.

### Frontend (new)
- `new frontend/src/components/TestCaseDrawer.tsx` — test-case detail drawer (Title, Priority, Status, Steps, Expected Result, Comments, Assignee, Activity).
- `new frontend/src/app/kanban/page.tsx` — `/kanban` route reusing `StoryKanban` + `TestCaseKanban`.

### Frontend (modified)
- `new frontend/src/lib/api.ts` — test-case collaboration + `tc-status` methods; filter params on `getStories`/`getTestCases`; `tcStatus`/`status`/`automationReady` in `normalizeTestCase`.
- `new frontend/src/types/domain.ts` — added fields to `RawTestCase` / `TestCase`.
- `new frontend/src/lib/auth.ts` — `fullName` + `currentWorkspaceName` on `AuthUser`; `updateProfile`; onboarding accepts name/workspace.
- `new frontend/src/lib/storiesStore.ts` — optional server-side `StoryFilters`.
- `new frontend/src/components/TestCaseKanban.tsx` — card click → drawer; load + persist `tc_status`; server-side filter bar.
- `new frontend/src/components/Sidebar.tsx` — Kanban nav item; dedup'd workspace/name/email footer.
- `new frontend/src/components/WorkspaceSwitcher.tsx` — "Create Workspace" affordance when none exists.
- `new frontend/src/components/onboarding/OnboardingSurveyModal.tsx` — new required first step (Full Name + optional Workspace Name).
- `new frontend/src/app/settings/layout.tsx` — Team nav item hidden until a workspace exists.
- `new frontend/src/app/stories/page.tsx` — server-side Status/Priority/Impact filter dropdowns.
- `new frontend/src/app/stories/[id]/tabs/OverviewTab.tsx` — AI Insights collapsed by default behind a "Generate AI Insights" button.

---

## 2. APIs Added / Changed

**New (test-case collaboration — Phase 1):**
- `GET/POST  /api/stories/<story_id>/testcases/<tc_id>/assignees`
- `DELETE    /api/stories/<story_id>/testcases/<tc_id>/assignees/<user_id>`
- `GET       /api/stories/<story_id>/testcases/<tc_id>/activity`
- `GET/POST  /api/stories/<story_id>/testcases/<tc_id>/comments`
- `PATCH/DELETE /api/stories/<story_id>/testcases/<tc_id>/comments/<comment_id>`

**New (Phase 2):**
- `PATCH /api/stories/<story_id>/testcases/<tc_id>/tc-status` — body `{ tc_status: 'todo'|'in_progress'|'done' }`.

**New (Phase 6):**
- `PATCH /api/auth/me` — body `{ full_name }`.

**Changed (backward compatible — all new params optional):**
- `GET /api/stories/` — `?status=&priority=&impact=detected|none&assignee=<id>|me|unassigned` (Phase 3).
- `GET /api/stories/<id>/testcases` — `?priority=&status=&automation_ready=true|false&impacted=true|false` (Phase 3).
- `POST /api/auth/onboarding` — now also accepts `full_name`, `workspace_name` (Phase 6).
- `GET /api/auth/me` — response `user` now includes `full_name`.
- `POST /api/stories/<id>/assignees` and `.../comments` (story + new test-case) now enqueue notification emails (Phase 5); no contract change.

---

## 3. Database Migrations

All applied by re-running the idempotent `Backend/app/models/create_dbs.py` (same mechanism that created `story_assignees` etc.). No Alembic; every statement is guarded.

| Object | Type | Notes |
|---|---|---|
| `users.full_name` | `ADD COLUMN IF NOT EXISTS TEXT` | Nullable; no backfill. |
| `test_case_assignees` | `CREATE TABLE IF NOT EXISTS` | FK → workspaces/users `ON DELETE CASCADE`; unique `(workspace_id, test_case_id, user_id)`. |
| `test_case_activity` | `CREATE TABLE IF NOT EXISTS` | Append-only timeline; indexed `(workspace_id, test_case_id, created_at DESC)`. |
| `test_case_comments` | `CREATE TABLE IF NOT EXISTS` | Author-only edit/delete enforced in model. |

**Note:** Test-case Kanban status (`tc_status`) is stored **inside** `test_cases.test_case_json` (the per-test-case JSON object), not as a column — individual test cases are JSON array elements, not table rows. No schema change required for Phase 2.

---

## 4. Email Templates Added

`story_assigned.html`, `test_case_assigned.html`, `comment_added.html`, `mention.html` — under `Backend/app/templates/emails/`, matching the existing template style. Rendered by the existing `_render` helper and sent via the existing SES `send_email` util through new Celery tasks (`task_send_story_assigned`, `task_send_test_case_assigned`, `task_send_comment_added`, `task_send_mention`), dispatched with `.delay(...)`.

---

## 5. Security Review

- **No touched surfaces:** auth/JWT, Stripe/billing/credits, password handling, session cookies, and tenant-resolution middleware are unchanged.
- **AuthZ:** every new route uses the existing `@dev_jwt_required` (`workspace_required`) decorator and resolves `user_id`/`workspace_id` from the session — never from the request body. `PATCH /api/auth/me` uses `@jwt_required()` and acts only on `get_jwt_identity()`.
- **Author-only mutations:** test-case comment edit/delete enforce `user_id` ownership in SQL (`AND user_id = %s`), matching the story-comment model.
- **Workspace rename:** owner-only (`WHERE owner_id = %s`); non-owners get a no-op `None`.
- **Email content:** notification bodies include the comment text the user already submitted; recipients are restricted to verified workspace members (see Multi-tenant review). No secrets or tokens are emailed. Email dispatch is wrapped in try/except so a failure can't break the action or leak a stack trace to the client.
- **@mention parsing:** regex-bounded token extraction; resolved strictly against the workspace member index, so an `@mention` cannot target a user outside the tenant.
- **Input validation:** `tc_status`, story `status`, priorities, and impact/automation flags are validated against allow-lists before use; filter values feed parameterized queries only (no string interpolation into SQL).
- **SQL injection:** all new queries are parameterized (`%s`), including the `jsonb_array_elements` priority filter and `= ANY(%s)` list filters.

## 6. Multi-Tenant Review

- Every new table carries `workspace_id` and every query filters on it; the collaboration models copy the proven `story_*` pattern verbatim.
- Assignment inserts first verify the target user is a `workspace_members` row (returns `None`/403 otherwise) — no cross-tenant assignment.
- Server-side filters (`get_stories`, `get_story_testcases`, impacted-IDs lookup) all retain the existing `AND workspace_id = %s` predicate; the new `EXISTS` subqueries join on `test_cases.workspace_id`.
- Notification recipient resolution (`_member_email`, `_members_index`) only returns users joined through `workspace_members` for the acting workspace; mentions and assignee-notifications cannot reach outside the tenant.
- LanceDB reads in the stories list keep the existing `workspace_id` dataframe filter.

---

## 7. Rollback Plan

Changes are additive, so rollback is low-risk and incremental:

1. **Code:** revert the commit(s) for this sprint (frontend + backend) and redeploy the previous images. No code path depends on the new tables existing, except the new routes themselves.
2. **Email:** to disable notifications without a full revert, no-op the four `notify_*` calls (or stop the Celery worker) — actions still succeed because dispatch is best-effort.
3. **Database:** the new tables/column are inert if unused and can be left in place. If full removal is required (only after confirming no rollback-forward is planned):
   - `DROP TABLE IF EXISTS test_case_assignees, test_case_activity, test_case_comments;`
   - `ALTER TABLE users DROP COLUMN IF EXISTS full_name;`
   - `tc_status` lives in JSON; it is ignored by old code and needs no migration to remove.
4. **No destructive forward migration** was run, so there is no data backfill to undo.

---

## 8. Production Deployment Plan (no auto-deploy)

**Pre-deploy**
1. Snapshot Postgres (Neon branch) and zip `Backend/data/lance_db` (standard pre-migration safety per `migrations/README.md`).
2. Confirm Celery worker + broker are running (notifications are async) and SES sender identity is verified for the new templates.

**Deploy order**
1. **DB migration first:** run `python -m app.models.create_dbs` against production. It is idempotent — verify the log prints the new "✅ Table 'test_case_*' is ready" lines and re-running is a no-op.
2. **Backend:** deploy the API image. New routes are additive; old frontend keeps working.
3. **Frontend:** deploy the `new frontend` build.
4. **Restart Celery worker** so it imports the 4 new tasks (`celery_app.py` auto-imports `email_tasks`).

**Smoke test in prod (per the plan's verification section)**
- Test Case Kanban: open card → drawer shows steps/expected/comments/assignee/activity; drag a card → refresh → column persists; add comment + assignee → persists.
- Story Kanban: drag → refresh → persists.
- Filters: apply each → confirm request carries query params and results are server-filtered.
- AI Insights: Overview shows collapsed state + button; no LLM fetch until clicked (Network tab).
- Notifications: assign/comment/mention → confirm Celery enqueue (worker log) + SES send; verify only workspace members receive mail.
- First-login: fresh user → modal requires Full Name; sidebar shows workspace + name + email with no duplicates; Team menu hidden with no workspace.
- `/kanban` sidebar item routes correctly and renders both sub-boards.

**Post-deploy monitoring**
- Watch Celery worker logs for `notify_* skipped` lines (benign best-effort skips) vs. SES `ClientError`s (sender/identity issues).
- Watch API logs for 4xx on the new filter params (indicates a client passing an out-of-allowlist value).
