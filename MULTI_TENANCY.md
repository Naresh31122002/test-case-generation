# Multi-Tenancy Architecture (Workspaces)

This document describes the conversion of TestSurge from single-tenant (per-user)
to multi-tenant SaaS, where a **Workspace** is the isolation boundary.

> Scope note: this applies to `backend/` and `new frontend/`. The legacy
> `frontend/` folder is not part of this change.

---

## 1. Tenancy model

```
users ──┐
        │ owns / member-of
        ▼
   workspaces ──< workspace_members >── users        (many-to-many membership)
        │
        ├──< test_cases            (workspace_id)     ← stories + their test cases
        ├──< test_case_impacts     (workspace_id)
        ├──< impact_history        (workspace_id)
        ├──< story_versions        (workspace_id)
        ├──< workspace_integrations (workspace_id)    ← Jira etc., per workspace
        └──  LanceDB rows           (workspace_id col) ← embeddings / story text
```

- A **user** belongs to one or more **workspaces** via `workspace_members` (role:
  `owner | admin | member`).
- Every business entity carries `workspace_id`. Tenancy is enforced by filtering
  **every** query on `workspace_id`; `user_id` is retained for authorship/audit.
- "Projects" remain a `project_id` TEXT grouping **within** a workspace (no separate
  table), so project filters now compose as `workspace_id = ? AND project_id = ?`.

---

## 2. Request lifecycle

```
Browser
  ├─ Cookie: access_token (HTTP-only JWT; identity=user_id, claim workspace_id)
  └─ Header: X-Workspace-Id: <active workspace>
        │
        ▼
@workspace_required  (backend/app/utils/workspace.py)
  1. user_id  = JWT identity (or dev user when DEV_BYPASS_AUTH=1)
  2. ws       = X-Workspace-Id header  OR  JWT 'workspace_id' claim  OR  user's default
  3. assert WorkspaceModel.is_member(ws, user_id)   → else 403
  4. g.user_id = user_id ;  g.workspace_id = ws
        │
        ▼
Route handler
  user_id      = get_current_user_id()        # from g
  workspace_id = get_current_workspace_id()    # from g
  ... WHERE workspace_id = %s ...              # every query
```

The **membership check is the source of truth.** The `X-Workspace-Id` header and
the JWT claim are only *candidates*; neither grants access on its own. A forged or
stale header for a workspace the user doesn't belong to returns **403**.

---

## 3. Database changes

New tables (see `backend/app/models/create_dbs.py`):

| Table | Key columns |
|-------|-------------|
| `workspaces` | `id`, `name`, `slug` (unique), `owner_id`→users, `plan`, `created_at` |
| `workspace_members` | PK `(workspace_id, user_id)`, `role` |
| `workspace_integrations` | `workspace_id`, `integration_type`, `config` jsonb, `secret_enc` |

`workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE` added to:
`test_cases`, `test_case_impacts`, `impact_history`, `story_versions`, each indexed.

`test_cases` unique constraint changes `(story_id, user_id)` → `(story_id, workspace_id)`.

**LanceDB** (`user_stories` table) gains a `workspace_id` string column; all writes
include it and all reads filter on it (pandas `df[df['workspace_id'] == ws]`).

---

## 4. Backend code map

| Concern | File |
|---------|------|
| Workspace model + membership | `backend/app/models/workspace_model.py` |
| Resolution decorator / `g` helpers | `backend/app/utils/workspace.py` (`workspace_required`, `get_current_workspace_id`) |
| Auth (claim issue, personal workspace) | `backend/app/routes/auth.py` |
| Workspaces API | `backend/app/routes/workspaces.py` (`/api/workspaces`, `/current`, `/switch`) |
| Query scoping (all routes) | `backend/app/routes/stories.py` (`@dev_jwt_required` is aliased to `workspace_required`) |
| Data service scoping | `backend/app/models/db_service.py`, `backend/app/models/postgress_writer.py` |
| Pipelines (async writes) | `backend/app/LLM/Test_case_generator.py`, `backend/app/LLM/impact_analyzer.py` |
| Per-workspace integrations | `backend/app/models/integration_model.py`, `JiraConfig.for_workspace` |

Background pipelines receive `workspace_id` **explicitly as an argument** (never via
`g`, which doesn't exist in worker threads).

---

## 5. Frontend code map (`new frontend/`)

| Concern | File |
|---------|------|
| `X-Workspace-Id` injection + localStorage | `src/lib/apiClient.ts` (`getActiveWorkspaceId`, header set in `request`) |
| Workspaces client | `src/lib/workspaces.ts` (`listWorkspaces`, `switchWorkspace`, …) |
| Store workspace on login/me | `src/lib/auth.ts` |
| Switcher UI | `src/components/WorkspaceSwitcher.tsx` (mounted in `Sidebar.tsx`) |

`apiClient.request()` is the single fetch choke point, so adding the header there
scopes **every** API call automatically. Switching a workspace calls
`/api/workspaces/switch` (re-issues the cookie claim), updates localStorage, and
`router.refresh()` reloads all data for the new tenant.

---

## 6. Migration & backfill

Script: `backend/app/models/migrations/001_multi_tenant.py`
(`python -m app.models.migrations.001_multi_tenant`).

1. Ensure schema (create workspace tables, add nullable `workspace_id`).
2. **Backfill:** create one personal workspace per existing user (owner membership),
   then `UPDATE <table> SET workspace_id = <that user's ws> WHERE user_id = <uid>`.
3. Enforce `NOT NULL` + swap the `test_cases` unique constraint.
4. Rebuild the LanceDB table with `workspace_id`, backfilled from each row's user.

Idempotent and safe to re-run. See `backend/app/models/migrations/README.md` for the
operator runbook (backup → install deps → run → verify no NULL `workspace_id`).

---

## 7. Security considerations

- **Isolation:** `g.workspace_id` is set only after `is_member()` passes. Every
  read/write filters on it → no cross-tenant reads, writes, or IDOR via `/<id>` paths.
- **Header can't escalate:** a guessed/forged `X-Workspace-Id` → 403. The JWT claim
  is a convenience default, not an authorization grant.
- **Switch safety:** `/api/workspaces/switch` validates membership before re-issuing
  the cookie, keeping claim and header aligned.
- **Background jobs:** `workspace_id` is threaded explicitly through pipeline
  functions, so async writes can't land in the wrong tenant.
- **Integration secrets:** Jira tokens move from shared env vars into
  `workspace_integrations.secret_enc`, encrypted with Fernet via `INTEGRATION_SECRET_KEY`
  (set this in production; never logged).
- **Defense in depth (optional, documented):** Postgres Row-Level Security keyed on a
  `SET app.workspace_id` GUC can be layered on later without app changes.
- **CORS:** `X-Workspace-Id` is added to the allowed request headers in
  `backend/app/__init__.py`; cookie/SameSite config is unchanged.

---

## 8. New environment variables

| Var | Purpose |
|-----|---------|
| `INTEGRATION_SECRET_KEY` | Fernet key for encrypting per-workspace integration secrets. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. |
