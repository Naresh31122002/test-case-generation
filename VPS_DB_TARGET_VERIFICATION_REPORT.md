# VPS Database Target Verification & Migration Impact Preview

**Audit date:** 2026-06-22
**Method:** Read-only SSH audit via `testgen.pem` (used only as SSH identity file — never opened/read/copied). No `CREATE`, `ALTER`, `DROP`, or data-modifying command was executed. No `create_dbs.py` run.

---

## 1. Target Verification

| Item | Value |
|---|---|
| VPS host | `3.81.221.119` (confirmed by user) |
| SSH user | `ubuntu` |
| Deployment path | `/home/ubuntu/test-case-generation` |
| Compose file | `/home/ubuntu/test-case-generation/docker-compose.yml` |
| Backend container | `test-case-generation-backend-1` (image `d64d05cf2381`, healthy, up ~2h at audit time) |
| Database container | `test-case-generation-postgres-1` (image `postgres:15-alpine`, healthy, up ~30h) |
| **Database location** | **Local Docker container** — not an external/managed host. Internal hostname `postgres` on the compose network; not exposed on a host port in the inspected compose file. |
| Database name | `test_case_gen` |
| Port | `5432` (container-internal) |
| Username | `postgres` |
| `POSTGRES_PASSWORD` | Present as an env var on the container — **value not read or printed** |
| SSL mode | `disable` (internal Docker network traffic, not internet-exposed) |
| Environment | `FLASK_ENV=production` |
| Data volume | `test-case-generation_pg_data` → `/var/lib/postgresql/data` (named Docker volume, persists across container recreation unless the volume itself is removed) |

**Important distinction from the local repo's `Backend/.env`:** that file points to an external Neon Postgres host (`ep-nameless-band-ah5feq1j...neon.tech`, db `neondb`). **That is a different database from the one this production VPS actually runs against.** Running `create_dbs.py` locally would have migrated the wrong (Neon) database, not the one serving real traffic — confirms the user's instruction to stop was correct.

A recent Postgres dump backup exists: `/home/ubuntu/test-case-generation/backups/db-backup-20260621_150949.sql.gz` (~121KB, taken 2026-06-21 15:09), alongside a matching code backup tarball from the same timestamp.

## 2. Current Deployed Code State

Checked whether Sprint 1 backend code is already on this VPS:

```
/app/app/models/test_case_collaboration_model.py → ABSENT in test-case-generation-backend-1
```

**Sprint 1 backend code has not been deployed to this VPS yet.** The running backend container predates this sprint's work. This means:
- The migration preview below is being evaluated against the **pre-Sprint-1 schema**.
- No Sprint 1 route/model code is currently executing in production — there is no partial/inconsistent deployment state to worry about.

## 3. Current Schema (20 tables, names only)

```
admin_audit_logs        impact_metrics           test_case_impacts
audit_logs               story_activity            test_cases
auth_tokens               story_assignees           token_usage
credit_transactions       story_comments            users
impact_history             story_versions            workspace_credits
                          test_case_impact_summary  workspace_integrations
                                                      workspace_invites
                                                      workspace_members
                                                      workspaces
```

Confirmed via direct query (not inferred): **none** of the new Sprint 1 objects exist yet —
- `test_case_assignees` — does not exist
- `test_case_activity` — does not exist
- `test_case_comments` — does not exist
- `users.full_name` — does not exist

This is a clean pre-migration state. `create_dbs.py` has never been run with the Sprint 1 changes against this database.

---

## 4. Migration Impact Preview

This previews what `python -m app.models.create_dbs` (or equivalent) **would** do, based on static review of `Backend/app/models/create_dbs.py`. **Nothing below has been executed.**

### Tables added (3)

| Table | Columns | Constraints | Indexes |
|---|---|---|---|
| `test_case_assignees` | `id UUID PK`, `test_case_id TEXT`, `story_id TEXT`, `workspace_id UUID`, `user_id UUID`, `assigned_by UUID`, `assigned_at TIMESTAMP` | FK `workspace_id → workspaces(id) ON DELETE CASCADE`; FK `user_id → users(user_id) ON DELETE CASCADE`; FK `assigned_by → users(user_id) ON DELETE SET NULL`; UNIQUE `(workspace_id, test_case_id, user_id)` | on `(workspace_id, test_case_id)` |
| `test_case_activity` | `id UUID PK`, `test_case_id TEXT`, `story_id TEXT`, `workspace_id UUID`, `user_id UUID`, `action TEXT`, `metadata JSONB`, `created_at TIMESTAMP` | FK `workspace_id → workspaces(id) ON DELETE CASCADE` | on `(workspace_id, test_case_id, created_at DESC)` |
| `test_case_comments` | `id UUID PK`, `test_case_id TEXT`, `story_id TEXT`, `workspace_id UUID`, `user_id UUID`, `body TEXT`, `created_at`, `updated_at` | FK `workspace_id → workspaces(id) ON DELETE CASCADE`; FK `user_id → users(user_id) ON DELETE CASCADE` | on `(workspace_id, test_case_id, created_at)` |

### Columns added (1)

| Table | Column | Type | Default | Notes |
|---|---|---|---|---|
| `users` | `full_name` | `TEXT` | none (nullable) | No backfill; existing rows get `NULL` |

### Constraints added
- 3× workspace-cascade FKs, 2× user-cascade FKs, 1× UNIQUE constraint (`test_case_assignees`) — all listed above. No constraints are added to pre-existing tables; `users.full_name` is unconstrained (nullable, no CHECK).

### Indexes added
- 3 indexes, one per new table, all workspace-scoped composite indexes matching the existing `story_assignees`/`story_activity`/`story_comments` index pattern.

### Data risk

| Risk | Assessment |
|---|---|
| Existing data modified | **None.** All statements are `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` — purely additive. No `UPDATE`/`DELETE` touches existing rows. |
| Existing rows in `users` | Unaffected; `full_name` simply appears as `NULL` until users set it via onboarding or `PATCH /api/auth/me`. |
| Downtime | None expected — `ALTER TABLE ADD COLUMN` without a default on Postgres 11+ (this is PG 15) is a fast metadata-only change, no table rewrite/lock escalation. `CREATE TABLE IF NOT EXISTS` doesn't touch other tables. |
| Idempotency | Re-running the migration is a no-op (every statement is guard-clausal); safe to run multiple times. |
| Reversibility | Fully reversible — see Rollback Plan below. |
| Application impact | Pre-Sprint-1 backend code (currently deployed) does not reference these tables/column at all, so running the migration **before** deploying the new backend code is safe and inert. |

### Rollback plan (if needed after migration)

```sql
DROP TABLE IF EXISTS test_case_assignees, test_case_activity, test_case_comments;
ALTER TABLE users DROP COLUMN IF EXISTS full_name;
```
Both are safe even if the new backend code has already been deployed and used briefly, with the caveat that any assignee/activity/comment rows created in the interim would be lost (expected for a rollback). A fresh `db-backup-*.sql.gz`-style dump immediately before migrating is recommended regardless (consistent with the existing backup already present from 2026-06-21).

---

## 5. What was NOT done (per instructions)

- `testgen.pem` was never opened, catted, printed, or copied — used solely as an SSH `-i` identity file.
- No `CREATE TABLE`, `ALTER TABLE`, `DROP`, migration, or data-modifying command was executed anywhere.
- No password or secret value was printed; `POSTGRES_PASSWORD` was confirmed present only by key name (`grep -c` on the variable name).
- No changes were made to production, staging, or any database.

## 6. Recommendation / Waiting for approval

This database is in a clean, pre-migration state with a recent backup already on disk. The migration is additive, idempotent, and — based on the schema diff above — carries no realistic data risk. **No action will be taken** until you explicitly approve running the migration against this VPS's `test-case-generation-postgres-1` container, and separately approve deploying the Sprint 1 backend/frontend code (which isn't on the VPS yet either).
