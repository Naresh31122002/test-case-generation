"""
Proxy module for migration 002 (RBAC + notifications).

Python cannot import a module whose filename starts with a digit, so this
shim loads 002_rbac_notifications.py via importlib and re-exports
run_migration so that run_migrations.py (and any other caller) can do a
normal import.
"""
import importlib.util
import os

_here = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "_migration_002_rbac_notifications",
    os.path.join(_here, "002_rbac_notifications.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

run_migration = _mod.run_migration
