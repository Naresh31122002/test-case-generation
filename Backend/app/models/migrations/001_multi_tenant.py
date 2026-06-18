"""
001_multi_tenant.py

Single-tenant → multi-tenant (workspaces) migration.

What it does, idempotently and safely re-runnable:
  1. Creates workspaces / workspace_members / workspace_integrations.
  2. Adds nullable workspace_id to test_cases, test_case_impacts, impact_history,
     story_versions (+ indexes).
  3. Backfill: one personal workspace per existing user (owner membership), then
     sets workspace_id on every existing row from that row's user_id.
  4. Enforces NOT NULL on workspace_id and swaps the test_cases unique constraint
     from (story_id, user_id) → (story_id, workspace_id).
  5. Rebuilds the LanceDB table to add a workspace_id column, backfilling each row
     from its user_id → that user's default workspace.

Run:  python -m app.models.migrations.001_multi_tenant
Requires the same env/.env as the app (POSTGRES_*, LANCE_DB_PATH, TABLE_NAME_LANCE).

This script reuses the idempotent DDL in create_dbs.py for table creation, then
performs the data backfill and constraint tightening that create_dbs.py leaves
deliberately loose (nullable) for fresh installs.
"""

import os
import sys
import re
import uuid

# Allow running as a module from the backend root.
_here = os.path.dirname(os.path.abspath(__file__))
_backend = os.path.abspath(os.path.join(_here, "..", "..", ".."))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from app.config import Config

TENANT_TABLES = ["test_cases", "test_case_impacts", "impact_history", "story_versions"]


def _slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "workspace"


# ── Step 1+2: schema (delegate to create_dbs idempotent DDL) ───────────────────
def ensure_schema():
    print("→ Ensuring base + workspace schema (create_dbs.create_postgres_db)…")
    from app.models.create_dbs import create_postgres_db
    create_postgres_db()
    print("  ✅ schema ensured")


# ── Step 3: backfill personal workspaces + row workspace_id ────────────────────
def backfill_workspaces():
    conn = Config.get_postgres_connection()
    try:
        cur = conn.cursor()

        cur.execute("SELECT user_id, email FROM users")
        users = cur.fetchall()
        print(f"→ Backfilling workspaces for {len(users)} user(s)…")

        for user_id, email in users:
            user_id = str(user_id)
            # Does this user already own a workspace?
            cur.execute("SELECT id FROM workspaces WHERE owner_id = %s ORDER BY created_at ASC LIMIT 1", (user_id,))
            row = cur.fetchone()
            if row:
                workspace_id = str(row[0])
            else:
                base = _slugify((email or "").split("@")[0] or "workspace")
                slug = base
                cur.execute("SELECT 1 FROM workspaces WHERE slug = %s", (slug,))
                if cur.fetchone():
                    slug = f"{base}-{uuid.uuid4().hex[:6]}"
                name = f"{(email or 'My').split('@')[0]}'s workspace"
                cur.execute(
                    """
                    INSERT INTO workspaces (name, slug, owner_id, plan)
                    VALUES (%s, %s, %s, 'free') RETURNING id
                    """,
                    (name, slug, user_id),
                )
                workspace_id = str(cur.fetchone()[0])

            cur.execute(
                """
                INSERT INTO workspace_members (workspace_id, user_id, role)
                VALUES (%s, %s, 'owner')
                ON CONFLICT (workspace_id, user_id) DO NOTHING
                """,
                (workspace_id, user_id),
            )

            # Point all of this user's rows at their workspace (only where unset).
            for t in TENANT_TABLES:
                cur.execute(
                    f"UPDATE {t} SET workspace_id = %s WHERE user_id = %s AND workspace_id IS NULL",
                    (workspace_id, user_id),
                )

        conn.commit()
        print("  ✅ workspace backfill complete")

        # Report any orphans (rows with a NULL user_id can't be auto-assigned).
        for t in TENANT_TABLES:
            cur.execute(f"SELECT COUNT(*) FROM {t} WHERE workspace_id IS NULL")
            n = cur.fetchone()[0]
            if n:
                print(f"  ⚠️  {t}: {n} row(s) still have NULL workspace_id (NULL user_id). Review manually.")
    finally:
        cur.close()
        conn.close()


# ── Step 4: enforce NOT NULL + swap unique constraint ──────────────────────────
def tighten_constraints():
    conn = Config.get_postgres_connection()
    try:
        cur = conn.cursor()
        print("→ Tightening constraints…")

        # Only set NOT NULL when there are no remaining NULLs (avoid failing on orphans).
        for t in TENANT_TABLES:
            cur.execute(f"SELECT COUNT(*) FROM {t} WHERE workspace_id IS NULL")
            if cur.fetchone()[0] == 0:
                cur.execute(
                    f"""
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns
                            WHERE table_name = '{t}' AND column_name = 'workspace_id' AND is_nullable = 'YES'
                        ) THEN
                            ALTER TABLE {t} ALTER COLUMN workspace_id SET NOT NULL;
                        END IF;
                    END $$;
                    """
                )
                print(f"  ✅ {t}.workspace_id is NOT NULL")
            else:
                print(f"  ⚠️  Skipping NOT NULL on {t} (orphan rows remain)")

        # Swap test_cases unique constraint (story_id, user_id) → (story_id, workspace_id)
        cur.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'test_cases' AND constraint_name = 'unique_story_id_per_user'
                ) THEN
                    ALTER TABLE test_cases DROP CONSTRAINT unique_story_id_per_user;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'test_cases' AND constraint_name = 'unique_story_id_per_workspace'
                ) THEN
                    ALTER TABLE test_cases ADD CONSTRAINT unique_story_id_per_workspace UNIQUE (story_id, workspace_id);
                END IF;
            END $$;
            """
        )
        conn.commit()
        print("  ✅ test_cases unique constraint now (story_id, workspace_id)")
    finally:
        cur.close()
        conn.close()


# ── Step 5: LanceDB rebuild with workspace_id ──────────────────────────────────
def migrate_lancedb_add_workspace():
    print("→ Migrating LanceDB table (adding workspace_id)…")
    import lancedb
    import pyarrow as pa

    db = lancedb.connect(Config.LANCE_DB_PATH)
    table_name = Config.TABLE_NAME_LANCE
    try:
        table = db.open_table(table_name)
    except Exception:
        print("  (LanceDB table does not exist yet — nothing to migrate)")
        return

    df = table.to_pandas()
    if "workspace_id" in df.columns and df["workspace_id"].notna().all() and len(df) > 0:
        print("  ✅ LanceDB already has a populated workspace_id column")
        return

    # Build user_id → default workspace_id map from Postgres.
    user_to_ws = {}
    conn = Config.get_postgres_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT m.user_id, w.id
            FROM workspace_members m
            JOIN workspaces w ON w.id = m.workspace_id
            ORDER BY (w.owner_id = m.user_id) DESC, w.created_at ASC
            """
        )
        for uid, wid in cur.fetchall():
            user_to_ws.setdefault(str(uid), str(wid))  # first (owned/earliest) wins
    finally:
        cur.close()
        conn.close()

    if "user_id" in df.columns:
        df["workspace_id"] = df["user_id"].map(lambda u: user_to_ws.get(str(u)) if u is not None else None)
    else:
        df["workspace_id"] = None

    # Recreate the table with the new schema (workspace_id first), preserving data.
    schema = pa.schema([
        ("workspace_id", pa.string()),
        ("user_id", pa.string()),
        ("project_id", pa.string()),
        ("vector", pa.list_(pa.float32(), 768)),
        ("storyID", pa.string()),
        ("storyDescription", pa.string()),
        ("test_case_content", pa.string()),
        ("filename", pa.string()),
        ("original_path", pa.string()),
        ("doc_content_text", pa.string()),
        ("embedding_timestamp", pa.timestamp("us")),
        ("source", pa.string()),
    ])
    # Keep only known columns, in schema order.
    cols = [f.name for f in schema]
    for c in cols:
        if c not in df.columns:
            df[c] = None
    df = df[cols]

    db.create_table(table_name, data=df, schema=schema, mode="overwrite")
    null_ws = int(df["workspace_id"].isna().sum())
    print(f"  ✅ LanceDB rebuilt ({len(df)} rows). Rows with NULL workspace_id: {null_ws}")


def run():
    print("\n🚀 Running multi-tenant migration (001_multi_tenant)…\n")
    ensure_schema()
    backfill_workspaces()
    tighten_constraints()
    migrate_lancedb_add_workspace()
    print("\n✅ Multi-tenant migration complete.\n")


if __name__ == "__main__":
    run()
