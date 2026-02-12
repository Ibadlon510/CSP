"""Migration: project detail redesign — new columns, new tables.
Run from backend dir: python -m migrations.add_project_detail_columns
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine, Base

# Import all models so metadata is populated
from models.project import (
    ProjectHandover, ProjectProposedName, ProjectLicenseActivity,
    ProjectVisaApplication, ProjectDocumentChecklist, ProjectProduct,
    ProjectRelatedField, TaskComment,
)
from models.product import ProductDocumentRequirement
from models.approval import ApprovalRequest, ApprovalProcessSetting


def table_info(conn, table: str) -> set:
    name = engine.url.get_backend_name()
    if name == "sqlite":
        r = conn.execute(text(f"PRAGMA table_info({table})"))
        return {row[1] for row in r}
    r = conn.execute(
        text("SELECT column_name FROM information_schema.columns WHERE table_name = :t"),
        {"t": table},
    )
    return {row[0] for row in r}


def table_exists(conn, table: str) -> bool:
    name = engine.url.get_backend_name()
    if name == "sqlite":
        r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"), {"t": table})
        return r.fetchone() is not None
    r = conn.execute(text("SELECT 1 FROM information_schema.tables WHERE table_name = :t"), {"t": table})
    return r.fetchone() is not None


def add_column_if_missing(conn, table: str, col: str, col_type: str, existing: set):
    if col in existing:
        print(f"  Skip {table}.{col} (exists)")
        return
    try:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
        conn.commit()
        print(f"  Added {table}.{col}")
    except Exception as e:
        print(f"  Error adding {table}.{col}: {e}")


def run():
    is_sqlite = engine.url.get_backend_name() == "sqlite"
    V = "VARCHAR" if is_sqlite else "VARCHAR(255)"
    V20 = "VARCHAR" if is_sqlite else "VARCHAR(20)"
    V50 = "VARCHAR" if is_sqlite else "VARCHAR(50)"
    V100 = "VARCHAR" if is_sqlite else "VARCHAR(100)"

    # --- 1. Create new tables ---
    new_tables = [
        ProjectHandover.__table__,
        ProjectProposedName.__table__,
        ProjectLicenseActivity.__table__,
        ProjectVisaApplication.__table__,
        ProjectDocumentChecklist.__table__,
        ProjectProduct.__table__,
        ProjectRelatedField.__table__,
        TaskComment.__table__,
        ProductDocumentRequirement.__table__,
        ApprovalRequest.__table__,
        ApprovalProcessSetting.__table__,
    ]
    print("Creating new tables if missing...")
    for t in new_tables:
        try:
            Base.metadata.create_all(bind=engine, tables=[t], checkfirst=True)
            print(f"  Table '{t.name}' ready")
        except Exception as e:
            print(f"  Error creating '{t.name}': {e}")

    # --- 2. Add columns to existing tables ---
    with engine.connect() as conn:
        # projects: priority, project_number
        print("Updating projects table...")
        existing = table_info(conn, "projects")
        add_column_if_missing(conn, "projects", "priority", V20, existing)
        add_column_if_missing(conn, "projects", "project_number", V, existing)

        # tasks: category, date_assigned
        print("Updating tasks table...")
        existing = table_info(conn, "tasks")
        add_column_if_missing(conn, "tasks", "category", V100, existing)
        add_column_if_missing(conn, "tasks", "date_assigned", "DATETIME", existing)

        # products: code
        print("Updating products table...")
        existing = table_info(conn, "products")
        add_column_if_missing(conn, "products", "code", V20, existing)

        # documents: project_id, purpose
        print("Updating documents table...")
        existing = table_info(conn, "documents")
        add_column_if_missing(conn, "documents", "project_id", V, existing)
        add_column_if_missing(conn, "documents", "purpose", V50, existing)

        # contacts: middle_name, place_of_birth
        print("Updating contacts table...")
        existing = table_info(conn, "contacts")
        add_column_if_missing(conn, "contacts", "middle_name", V100, existing)
        add_column_if_missing(conn, "contacts", "place_of_birth", V100, existing)

        # users: manager_id
        print("Updating users table...")
        existing = table_info(conn, "users")
        add_column_if_missing(conn, "users", "manager_id", V, existing)

        # ownership_links: is_ubo, is_secretary, is_poa_authorized
        print("Updating ownership_links table...")
        existing = table_info(conn, "ownership_links")
        add_column_if_missing(conn, "ownership_links", "is_ubo", "BOOLEAN DEFAULT 0", existing)
        add_column_if_missing(conn, "ownership_links", "is_secretary", "BOOLEAN DEFAULT 0", existing)
        add_column_if_missing(conn, "ownership_links", "is_poa_authorized", "BOOLEAN DEFAULT 0", existing)

    print("Migration complete.")


if __name__ == "__main__":
    run()
