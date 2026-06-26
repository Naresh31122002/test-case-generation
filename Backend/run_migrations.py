#!/usr/bin/env python3
"""
Run all pending DB migrations for TestSurge.

Usage (from the Backend directory):
    python run_migrations.py

The script resolves its own directory so it works regardless of where you
invoke it from, as long as the .env file lives next to it.
"""
import os
import sys
import traceback

# Make sure "Backend/" is on sys.path so `from app.xxx` imports work.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))


def run_all():
    from app.config import Config  # imported after load_dotenv so env vars are live

    conn = Config.get_postgres_connection()
    try:
        from app.models.migrations.migration_002_rbac import run_migration as m002
        print("Running migration 002 (RBAC + notifications)...")
        m002(conn)
        print("migration_002_rbac done")
    except Exception as e:
        print(f"migration_002_rbac FAILED: {e}")
        traceback.print_exc()
    finally:
        conn.close()


if __name__ == "__main__":
    run_all()
