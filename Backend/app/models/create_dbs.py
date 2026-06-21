import os
import sys

# Add the Backend directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
sys.path.insert(0, backend_dir)

import pyarrow as pa
import lancedb
import psycopg2
from app.config import Config

db = lancedb.connect(Config.LANCE_DB_PATH)
TABLE_NAME = Config.TABLE_NAME_LANCE
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
    ("source", pa.string())
])

def create_LanceDB():
    table = db.create_table(TABLE_NAME, schema=schema, exist_ok=True)
    print(f"✅ Table '{TABLE_NAME}' is ready.")
    return table

def create_postgres_db():
    try:
        # First try to connect to default postgres database to create our database if it doesn't exist
        conn = psycopg2.connect(
            dbname="postgres",
            user=Config.POSTGRES_USER,
            password=Config.POSTGRES_PASSWORD,
            host=Config.POSTGRES_HOST,
            port=Config.POSTGRES_PORT
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Check if our database exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (Config.POSTGRES_DB,))
        exists = cursor.fetchone()
        
        if not exists:
            cursor.execute(f"CREATE DATABASE {Config.POSTGRES_DB}")
            print(f"✅ Database '{Config.POSTGRES_DB}' created successfully.")
        
        cursor.close()
        conn.close()

        # Now connect to our database and create tables
        conn = Config.get_postgres_connection()
        cursor = conn.cursor()
        
        # Enable uuid-ossp extension
        cursor.execute("""
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        """)
        print("✅ Extension 'uuid-ossp' is ready.")

        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_on TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITHOUT TIME ZONE
            );
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        """)
        print("✅ Table 'users' is ready.")

        # Migrate users: add email_verified flag (signup journey). Idempotent.
        cursor.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'email_verified'
                ) THEN
                    ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
                END IF;
            END $$;
        """)
        print("✅ Migrated 'users' email_verified column.")

        # Migrate users: Google OAuth support. password_hash becomes optional
        # (Google-only accounts have none) and we track provider + Google's
        # stable subject id ('sub') for account lookup/linking.
        cursor.execute("""
            ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password'
                CHECK (auth_provider IN ('password', 'google'));
        """)
        print("✅ Migrated 'users' Google OAuth columns.")

        # Migrate users: first-login onboarding survey (org name, job title,
        # referral source — shown once as a skippable modal, never again).
        cursor.execute("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITHOUT TIME ZONE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS org_name TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_source TEXT;
        """)
        print("✅ Migrated 'users' onboarding survey columns.")

        # Auth tokens: email verification + password reset (single-use, expiring).
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS auth_tokens (
                token_hash  TEXT PRIMARY KEY,
                user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                purpose     TEXT NOT NULL CHECK (purpose IN ('email_verify', 'password_reset')),
                expires_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                used_at     TIMESTAMP WITHOUT TIME ZONE,
                created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose);
        """)
        print("✅ Table 'auth_tokens' is ready.")

        # ── Multi-tenancy: workspaces, members, integrations ───────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workspaces (
                id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name        TEXT NOT NULL,
                slug        TEXT NOT NULL UNIQUE,
                owner_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'team', 'enterprise')),
                stripe_customer_id              TEXT,
                stripe_subscription_id          TEXT,
                stripe_price_id                 TEXT,
                subscription_status             TEXT,
                subscription_current_period_end TIMESTAMP WITHOUT TIME ZONE,
                created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
            CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_sub ON workspaces(stripe_subscription_id);
        """)
        print("✅ Table 'workspaces' is ready.")

        # Migrate existing plans in workspaces: 'enterprise' -> 'team' and update constraint
        cursor.execute("""
            DO $$
            BEGIN
                -- Update existing data
                UPDATE workspaces SET plan = 'team' WHERE plan = 'enterprise';
                
                -- Attempt to drop old constraint
                DECLARE
                    constraint_name text;
                BEGIN
                    SELECT conname INTO constraint_name
                    FROM pg_constraint
                    WHERE conrelid = 'workspaces'::regclass AND contype = 'c' AND conname LIKE '%plan%';
                    
                    IF constraint_name IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE workspaces DROP CONSTRAINT ' || constraint_name;
                    END IF;
                END;
                
                -- Add new constraint
                BEGIN
                    ALTER TABLE workspaces ADD CONSTRAINT workspaces_plan_check 
                    CHECK (plan IN ('free', 'starter', 'pro', 'team', 'enterprise'));
                EXCEPTION WHEN duplicate_object THEN
                    -- Constraint already exists
                END;
            END $$;
        """)
        
        # Alter table for existing dbs to add new columns
        cursor.execute("""
            ALTER TABLE workspaces 
            ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
            ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
            ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
            ADD COLUMN IF NOT EXISTS subscription_status TEXT,
            ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITHOUT TIME ZONE;
            
            CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_sub ON workspaces(stripe_subscription_id);
        """)
        
        print("✅ Migrated 'workspaces' plans, constraints, and stripe columns.")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workspace_members (
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                role         TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
                created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (workspace_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_ws_members_user ON workspace_members(user_id);
        """)
        print("✅ Table 'workspace_members' is ready.")

        # Migrate existing roles in workspace_members: 'member' -> 'editor' and update constraint
        cursor.execute("""
            DO $$
            BEGIN
                -- Update existing data
                UPDATE workspace_members SET role = 'editor' WHERE role = 'member';
                
                -- Attempt to drop the old constraint if it exists (the default name in Postgres might vary,
                -- so we try to find it dynamically or just alter the type if not possible, but since we didn't 
                -- name it, we can query it)
                DECLARE
                    constraint_name text;
                BEGIN
                    SELECT conname INTO constraint_name
                    FROM pg_constraint
                    WHERE conrelid = 'workspace_members'::regclass AND contype = 'c' AND conname LIKE '%role%';
                    
                    IF constraint_name IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE workspace_members DROP CONSTRAINT ' || constraint_name;
                    END IF;
                END;
                
                -- Add the new constraint
                BEGIN
                    ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check 
                    CHECK (role IN ('owner', 'admin', 'editor', 'viewer'));
                EXCEPTION WHEN duplicate_object THEN
                    -- Constraint already exists
                END;
                
                -- Update default value
                ALTER TABLE workspace_members ALTER COLUMN role SET DEFAULT 'editor';
            END $$;
        """)
        print("✅ Migrated 'workspace_members' roles and constraints.")

        # Workspace Invites
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workspace_invites (
                id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                email        TEXT NOT NULL,
                role         TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
                token        TEXT NOT NULL UNIQUE,
                invited_by   UUID NOT NULL REFERENCES users(user_id),
                expires_at   TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_workspace_invites_ws ON workspace_invites(workspace_id);
            CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token);
        """)
        print("✅ Table 'workspace_invites' is ready.")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workspace_integrations (
                id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                integration_type TEXT NOT NULL,
                config           JSONB NOT NULL DEFAULT '{}'::jsonb,
                secret_enc       TEXT,
                created_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (workspace_id, integration_type)
            );
            CREATE INDEX IF NOT EXISTS idx_ws_integrations_ws ON workspace_integrations(workspace_id);
        """)
        print("✅ Table 'workspace_integrations' is ready.")

        # Workspace Credits
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workspace_credits (
                workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
                monthly_limit INT NOT NULL,
                credits_used INT NOT NULL DEFAULT 0,
                reset_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        print("✅ Table 'workspace_credits' is ready.")

        # Credit Transactions (Auditing)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS credit_transactions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
                amount INT NOT NULL,
                action TEXT NOT NULL,
                story_id TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_credit_trans_ws ON credit_transactions(workspace_id);
        """)
        print("✅ Table 'credit_transactions' is ready.")

        # Token Usage Tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS token_usage (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
                action VARCHAR(100) NOT NULL,
                provider VARCHAR(50) NOT NULL,
                model VARCHAR(100) NOT NULL,
                input_tokens INT NOT NULL DEFAULT 0,
                output_tokens INT NOT NULL DEFAULT 0,
                story_id VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_token_usage_workspace ON token_usage(workspace_id);
            CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id);
            CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at);
        """)
        print("✅ Table 'token_usage' is ready.")

        # General Audit Logs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
                action VARCHAR(100) NOT NULL,
                details JSONB DEFAULT '{}',
                ip_address VARCHAR(45),
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
            
            CREATE TABLE IF NOT EXISTS admin_audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                admin_email VARCHAR(255) NOT NULL,
                action VARCHAR(100) NOT NULL,
                details JSONB DEFAULT '{}',
                ip_address VARCHAR(45),
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        print("✅ Tables 'audit_logs' and 'admin_audit_logs' are ready.")

        # Create test_cases table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_cases (
                project_id TEXT,
                run_id UUID PRIMARY KEY,
                story_id TEXT NOT NULL,
                story_description TEXT,
                created_on TIMESTAMP WITHOUT TIME ZONE,
                test_case_json JSONB,
                total_test_cases INTEGER,
                total_impacted_test_cases INTEGER DEFAULT 0,
                impacted_test_cases_count INTEGER DEFAULT 0,
                last_impact_update_time TIMESTAMP WITHOUT TIME ZONE,
                test_case_generated BOOLEAN,
                impacted_test_case_generated BOOLEAN DEFAULT FALSE,
                source TEXT DEFAULT 'backend',
                inputs JSONB,
                has_impacts BOOLEAN DEFAULT FALSE,
                latest_impact_id UUID,
                user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
                CONSTRAINT unique_story_id_per_user UNIQUE(story_id, user_id)
            );
            
            -- Add index on story_id for faster joins
            CREATE INDEX IF NOT EXISTS idx_test_cases_story_id 
            ON test_cases(story_id);

            -- Add index for impacted test cases queries
            CREATE INDEX IF NOT EXISTS idx_test_cases_impacted 
            ON test_cases(impacted_test_case_generated)
            WHERE impacted_test_case_generated = TRUE;

            -- Add index for source field
            CREATE INDEX IF NOT EXISTS idx_test_cases_source
            ON test_cases(source);
        """)
        print("✅ Table 'test_cases' is ready.")

        # Migrate existing test_cases table: add user_id column if missing and drop old unique constraint
        cursor.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'test_cases' AND column_name = 'user_id'
                ) THEN
                    ALTER TABLE test_cases ADD COLUMN user_id UUID REFERENCES users(user_id) ON DELETE CASCADE;
                END IF;
                -- Legacy: drop the old single-column-ish unique constraint if present.
                -- It may be referenced by FKs (test_case_impacts → story_id); if the
                -- drop can't proceed, skip it rather than aborting the whole setup.
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'test_cases' AND constraint_name = 'unique_story_id'
                ) THEN
                    BEGIN
                        ALTER TABLE test_cases DROP CONSTRAINT unique_story_id;
                    EXCEPTION WHEN dependent_objects_still_exist THEN
                        RAISE NOTICE 'Skipping drop of unique_story_id (FK dependency present).';
                    END;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'test_cases' AND constraint_name = 'unique_story_id_per_user'
                ) THEN
                    ALTER TABLE test_cases ADD CONSTRAINT unique_story_id_per_user UNIQUE (story_id, user_id);
                END IF;
                -- Multi-tenancy: workspace_id column. Kept nullable here; the
                -- migration script (001_multi_tenant) backfills and sets NOT NULL
                -- plus the (story_id, workspace_id) unique constraint.
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'test_cases' AND column_name = 'workspace_id'
                ) THEN
                    ALTER TABLE test_cases ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
                    CREATE INDEX IF NOT EXISTS idx_test_cases_workspace ON test_cases(workspace_id);
                END IF;
                -- Kanban: story_status column backing the Stories Kanban board.
                -- Additive only; existing rows default to 'in_review'.
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'test_cases' AND column_name = 'story_status'
                ) THEN
                    ALTER TABLE test_cases ADD COLUMN story_status TEXT DEFAULT 'in_review';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'test_cases' AND constraint_name = 'chk_test_cases_story_status'
                ) THEN
                    ALTER TABLE test_cases ADD CONSTRAINT chk_test_cases_story_status
                        CHECK (story_status IN ('in_review', 'in_progress', 'completed'));
                END IF;
            END $$;
        """)
        print("✅ Migrated 'test_cases' user_id/workspace_id/story_status columns and constraint.")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_cases_workspace_story_status
            ON test_cases(workspace_id, story_status);
        """)
        print("✅ Ensured index on 'test_cases(workspace_id, story_status)'.")

        # Create test_case_impacts table with enhanced referential integrity
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_case_impacts (
                impact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                project_id TEXT NOT NULL,
                new_story_id TEXT NOT NULL,
                original_story_id TEXT NOT NULL,
                original_test_case_id TEXT NOT NULL,
                modified_test_case_id TEXT NOT NULL,
                original_run_id UUID NOT NULL,
                impact_created_on TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                source TEXT DEFAULT 'backend',
                similarity_score FLOAT,
                impact_analysis_json JSONB NOT NULL,
                previous_impact_id UUID,
                impact_version INT DEFAULT 1,
                impact_status TEXT DEFAULT 'active' CHECK (impact_status IN ('active', 'inactive', 'accepted', 'rejected')),
                impact_type TEXT NOT NULL CHECK (impact_type IN ('modification', 'deletion', 'addition')),
                impact_severity TEXT NOT NULL CHECK (impact_severity IN ('high', 'medium', 'low')),
                impact_priority INTEGER CHECK (impact_priority BETWEEN 1 AND 5),
                impact_details JSONB,
                CONSTRAINT fk_original_story 
                    FOREIGN KEY(original_story_id) 
                    REFERENCES test_cases(story_id)
                    ON DELETE CASCADE,
                CONSTRAINT fk_original_run
                    FOREIGN KEY(original_run_id)
                    REFERENCES test_cases(run_id)
                    ON DELETE CASCADE,
                CONSTRAINT fk_previous_impact
                    FOREIGN KEY(previous_impact_id)
                    REFERENCES test_case_impacts(impact_id)
                    ON DELETE SET NULL
            );

            -- Indexes for faster lookups
            CREATE INDEX IF NOT EXISTS idx_test_case_impacts_original_story 
            ON test_case_impacts(original_story_id);
            
            CREATE INDEX IF NOT EXISTS idx_test_case_impacts_new_story
            ON test_case_impacts(new_story_id);

            CREATE INDEX IF NOT EXISTS idx_test_case_impacts_project
            ON test_case_impacts(project_id);

            CREATE INDEX IF NOT EXISTS idx_test_case_impacts_chain
            ON test_case_impacts(previous_impact_id);

            CREATE INDEX IF NOT EXISTS idx_test_case_impacts_status
            ON test_case_impacts(impact_status);

            CREATE INDEX IF NOT EXISTS idx_test_case_impacts_new_story_user
            ON test_case_impacts(new_story_id, user_id);
        """)
        print("✅ Table 'test_case_impacts' is ready.")

        # Migrate existing test_case_impacts: add user_id column if missing
        cursor.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'test_case_impacts' AND column_name = 'user_id'
                ) THEN
                    ALTER TABLE test_case_impacts ADD COLUMN user_id UUID REFERENCES users(user_id) ON DELETE CASCADE;
                    CREATE INDEX IF NOT EXISTS idx_test_case_impacts_user_id ON test_case_impacts(user_id);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'test_case_impacts' AND column_name = 'workspace_id'
                ) THEN
                    ALTER TABLE test_case_impacts ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
                    CREATE INDEX IF NOT EXISTS idx_test_case_impacts_workspace ON test_case_impacts(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_test_case_impacts_new_story_ws ON test_case_impacts(new_story_id, workspace_id);
                END IF;
            END $$;
        """)
        print("✅ Migrated 'test_case_impacts' user_id/workspace_id columns.")

        # Story Intelligence: composite index for get_impact_summary()'s
        # WHERE workspace_id = %s AND original_story_id = %s AND impact_status = 'active'
        # (previously covered only by single-column indexes, requiring a
        # bitmap-and/recheck across them instead of one composite scan).
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_case_impacts_ws_story_status
            ON test_case_impacts(workspace_id, original_story_id, impact_status);
        """)
        print("✅ Migrated 'test_case_impacts' workspace/original_story/status composite index.")

        # Create impact_history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS impact_history (
                history_id UUID PRIMARY KEY,
                impact_id UUID NOT NULL,
                change_timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                changed_by TEXT,
                previous_status TEXT,
                new_status TEXT,
                change_reason TEXT,
                CONSTRAINT fk_impact
                    FOREIGN KEY(impact_id) 
                    REFERENCES test_case_impacts(impact_id)
                    ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_impact_history_impact_id 
            ON impact_history(impact_id);

            CREATE INDEX IF NOT EXISTS idx_impact_history_timestamp 
            ON impact_history(change_timestamp);
        """)
        print("✅ Table 'impact_history' is ready.")

        # Migrate existing impact_history: add user_id column if missing
        cursor.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'impact_history' AND column_name = 'user_id'
                ) THEN
                    ALTER TABLE impact_history ADD COLUMN user_id UUID REFERENCES users(user_id) ON DELETE CASCADE;
                    CREATE INDEX IF NOT EXISTS idx_impact_history_user_id ON impact_history(user_id);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'impact_history' AND column_name = 'workspace_id'
                ) THEN
                    ALTER TABLE impact_history ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
                    CREATE INDEX IF NOT EXISTS idx_impact_history_workspace ON impact_history(workspace_id);
                END IF;
            END $$;
        """)
        print("✅ Migrated 'impact_history' user_id/workspace_id columns.")

        # Create view for impact metrics
        cursor.execute("""
            CREATE OR REPLACE VIEW impact_metrics AS
            WITH active_impacts AS (
                SELECT 
                    original_story_id,
                    COUNT(DISTINCT modified_test_case_id) as unique_impacted_test_cases,
                    COUNT(*) as total_impacts,
                    MAX(impact_created_on) as last_impact_date,
                    jsonb_agg(DISTINCT impact_type) as impact_types,
                    MAX(impact_priority) as highest_priority,
                    COUNT(CASE WHEN impact_severity = 'high' THEN 1 END) as high_severity_count,
                    COUNT(CASE WHEN impact_severity = 'medium' THEN 1 END) as medium_severity_count,
                    COUNT(CASE WHEN impact_severity = 'low' THEN 1 END) as low_severity_count
                FROM test_case_impacts
                WHERE impact_status = 'active'
                GROUP BY original_story_id
            )
            SELECT 
                tc.story_id,
                tc.project_id,
                tc.story_description,
                tc.total_test_cases,
                COALESCE(ai.unique_impacted_test_cases, 0) as impacted_test_cases,
                COALESCE(ai.total_impacts, 0) as total_impacts,
                ai.last_impact_date,
                ai.impact_types,
                ai.highest_priority,
                ai.high_severity_count,
                ai.medium_severity_count,
                ai.low_severity_count,
                CASE 
                    WHEN ai.unique_impacted_test_cases IS NULL THEN 0
                    ELSE ROUND(CAST((ai.unique_impacted_test_cases::float / tc.total_test_cases) * 100 AS numeric), 2)
                END as impact_percentage
            FROM test_cases tc
            LEFT JOIN active_impacts ai ON tc.story_id = ai.original_story_id;
        """)
        print("✅ View 'impact_metrics' is ready.")

        # Create view for test case impact summary (keeping the existing one)
        cursor.execute("""
        CREATE OR REPLACE VIEW test_case_impact_summary AS
        WITH impact_counts AS (
            SELECT 
                project_id,
                original_story_id as story_id,
                COUNT(*) as impacted_by_count
            FROM test_case_impacts
            WHERE impact_status = 'active'
            GROUP BY project_id, original_story_id
            
            UNION ALL
            
            SELECT 
                project_id,
                new_story_id as story_id,
                COUNT(*) as impacts_caused_count
            FROM test_case_impacts
            WHERE impact_status = 'active'
            GROUP BY project_id, new_story_id
        ),
        combined_counts AS (
            SELECT 
                project_id,
                story_id,
                SUM(impacted_by_count) as total_impacts
            FROM impact_counts
            GROUP BY project_id, story_id
        )
        SELECT 
            cc.project_id,
            cc.story_id,
            tc.story_description,
            tc.test_case_json,
            tc.created_on as test_case_generated_on,
            cc.total_impacts,
            EXISTS (
                SELECT 1 
                FROM test_case_impacts tci 
                WHERE tci.new_story_id = cc.story_id
                AND tci.impact_status = 'active'
            ) as has_caused_impacts,
            EXISTS (
                SELECT 1 
                FROM test_case_impacts tci 
                WHERE tci.original_story_id = cc.story_id
                AND tci.impact_status = 'active'
            ) as has_received_impacts
        FROM combined_counts cc
        JOIN test_cases tc ON tc.story_id = cc.story_id
        ORDER BY cc.total_impacts DESC;
        """)
        print("✅ View 'test_case_impact_summary' is ready.")

        # Create story_versions table for version history
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS story_versions (
                version_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                story_id       TEXT NOT NULL,
                user_id        UUID REFERENCES users(user_id) ON DELETE CASCADE,
                version_number INTEGER NOT NULL DEFAULT 1,
                content        TEXT,
                description    TEXT,
                file_name      TEXT,
                created_on     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                run_id         UUID REFERENCES test_cases(run_id) ON DELETE SET NULL,
                CONSTRAINT uq_story_version UNIQUE (story_id, user_id, version_number)
            );
            CREATE INDEX IF NOT EXISTS idx_story_versions_story_user
            ON story_versions(story_id, user_id);
        """)
        print("✅ Table 'story_versions' is ready.")

        # Migrate existing story_versions: add workspace_id column if missing
        cursor.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'story_versions' AND column_name = 'workspace_id'
                ) THEN
                    ALTER TABLE story_versions ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
                    CREATE INDEX IF NOT EXISTS idx_story_versions_workspace ON story_versions(workspace_id);
                END IF;
            END $$;
        """)
        print("✅ Migrated 'story_versions' workspace_id column.")

        # Kanban collaboration: story assignees (additive, Phase 2)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS story_assignees (
                id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                story_id     TEXT NOT NULL,
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                assigned_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
                assigned_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_story_assignee UNIQUE (workspace_id, story_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_story_assignees_story
            ON story_assignees(workspace_id, story_id);
            CREATE INDEX IF NOT EXISTS idx_story_assignees_user
            ON story_assignees(workspace_id, user_id);
        """)
        print("✅ Table 'story_assignees' is ready.")

        # Kanban collaboration: story activity timeline (additive, Phase 2)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS story_activity (
                id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                story_id      TEXT NOT NULL,
                workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                actor_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
                event_type    TEXT NOT NULL,
                details       JSONB,
                created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_story_activity_story
            ON story_activity(workspace_id, story_id, created_at DESC);
        """)
        print("✅ Table 'story_activity' is ready.")

        # Kanban collaboration: story comments (additive, Phase 3A)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS story_comments (
                id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                story_id     TEXT NOT NULL,
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                body         TEXT NOT NULL,
                created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_story_comments_story
            ON story_comments(workspace_id, story_id, created_at ASC);
        """)
        print("✅ Table 'story_comments' is ready.")

        conn.commit()
        print("\n✅ All database structures have been created/updated successfully!")
        
    except Exception as e:
        print(f"❌ Error creating/updating database structures: {e}")
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
        raise
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    print("\n🚀 Setting up database structures...")
    print("\n1️⃣ Creating LanceDB table...")
    create_LanceDB()

    print("\n2️⃣ Setting up PostgreSQL structures...")
    create_postgres_db()



 