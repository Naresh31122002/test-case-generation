# Database migrations

Lightweight, ordered, idempotent migration scripts. No Alembic — each script is a
plain `python -m` module that is safe to re-run (it guards every change).

## Running

From the `backend/` directory, with the app's environment loaded (`.env` with
`POSTGRES_*`, `LANCE_DB_PATH`, `TABLE_NAME_LANCE`):

```bash
python -m app.models.migrations.001_multi_tenant
```

## Migrations

| # | File | Purpose |
|---|------|---------|
| 001 | `001_multi_tenant.py` | Single-tenant → multi-tenant. Creates `workspaces`, `workspace_members`, `workspace_integrations`; adds `workspace_id` to `test_cases`, `test_case_impacts`, `impact_history`, `story_versions`; backfills one personal workspace per existing user; enforces NOT NULL + swaps the `test_cases` unique constraint to `(story_id, workspace_id)`; rebuilds the LanceDB table with a `workspace_id` column. |

## Before running 001 in any shared environment

1. **Back up Postgres** (Neon: take a branch/snapshot) and **zip `backend/data/lance_db`**.
2. Ensure deps are installed: `pip install -r requirements.txt` (adds `cryptography`, `pylance`).
3. Run the migration. It prints a warning for any row it could not assign (NULL `user_id`).
4. Verify: `SELECT count(*) FROM test_cases WHERE workspace_id IS NULL;` returns 0 (and same for the other three tables).
