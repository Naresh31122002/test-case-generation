"""
Migration 002: RBAC granular permissions + notifications table + invite email tracking.
Run once on the database.
"""
import psycopg2
import psycopg2.extras
import os

def run_migration(conn):
    with conn.cursor() as cur:

        # 1. Add granular permission columns to workspace_members
        cur.execute("""
            ALTER TABLE workspace_members
                ADD COLUMN IF NOT EXISTS can_create_stories BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS can_generate_tests BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS can_edit_tests BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS can_delete_stories BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS can_manage_members BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITHOUT TIME ZONE;
        """)

        # 2. Set defaults based on existing roles
        cur.execute("""
            UPDATE workspace_members SET
                can_create_stories = CASE WHEN role IN ('owner','admin','editor') THEN TRUE ELSE FALSE END,
                can_generate_tests = CASE WHEN role IN ('owner','admin','editor') THEN TRUE ELSE FALSE END,
                can_edit_tests = CASE WHEN role IN ('owner','admin','editor') THEN TRUE ELSE FALSE END,
                can_delete_stories = CASE WHEN role IN ('owner','admin') THEN TRUE ELSE FALSE END,
                can_manage_members = CASE WHEN role IN ('owner','admin') THEN TRUE ELSE FALSE END;
        """)

        # 3. Create notifications table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS workspace_notifications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT,
                link TEXT,
                actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
                entity_id TEXT,
                entity_type TEXT,
                read BOOLEAN DEFAULT FALSE,
                email_sent BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_ws_notif_user ON workspace_notifications(user_id, workspace_id);
            CREATE INDEX IF NOT EXISTS idx_ws_notif_unread ON workspace_notifications(user_id, read) WHERE read = FALSE;
        """)

        # 4. Create notification preferences table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notification_preferences (
                user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                email_on_story_generated BOOLEAN DEFAULT TRUE,
                email_on_test_generated BOOLEAN DEFAULT TRUE,
                email_on_assigned BOOLEAN DEFAULT TRUE,
                email_on_invite BOOLEAN DEFAULT TRUE,
                email_on_mention BOOLEAN DEFAULT TRUE,
                email_on_status_change BOOLEAN DEFAULT FALSE,
                in_app_all BOOLEAN DEFAULT TRUE,
                PRIMARY KEY (user_id, workspace_id)
            );
        """)

        # 5. Add email_sent_at to workspace_invites if not exists
        cur.execute("""
            ALTER TABLE workspace_invites
                ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITHOUT TIME ZONE,
                ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITHOUT TIME ZONE;
        """)

        # 6. Add partial unique index to prevent duplicate pending invites
        # Note: only filter on accepted_at IS NULL — CURRENT_TIMESTAMP is not IMMUTABLE
        # so it cannot be used in an index predicate in PostgreSQL.
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_ws_invite_email_active
            ON workspace_invites(workspace_id, email)
            WHERE accepted_at IS NULL;
        """)

        # 7. Add display_name to users if not exists
        cur.execute("""
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS avatar_url TEXT,
                ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE,
                ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
        """)

        conn.commit()
        print("Migration 002 applied successfully")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    conn = psycopg2.connect(
        dbname=os.getenv('POSTGRES_DB'),
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'),
        host=os.getenv('POSTGRES_HOST'),
        port=os.getenv('POSTGRES_PORT'),
        sslmode=os.getenv('POSTGRES_SSLMODE','require'),
    )
    run_migration(conn)
    conn.close()
