"""Migration: add compliance tables and UBO columns on contacts.
Run from backend dir: python -m migrations.add_compliance_tables
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def run():
    with engine.connect() as conn:
        if engine.url.get_backend_name() == "sqlite":
            r = conn.execute(text("PRAGMA table_info(contacts)"))
            existing_cols = {row[1] for row in r}
        else:
            r = conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'"
            ))
            existing_cols = {row[0] for row in r}

        is_sqlite = engine.url.get_backend_name() == "sqlite"
        contact_adds = [
            ("senior_manager_contact_id", "TEXT", "VARCHAR(255)"),
            ("ubo_declaration_date", "TEXT", "DATE"),  # SQLite DATE stored as TEXT
            ("ubo_last_updated_at", "TEXT", "DATE"),
        ]
        for col_name, sqlite_type, pg_type in contact_adds:
            if col_name in existing_cols:
                print(f"Skip contact column {col_name} (exists)")
                continue
            col_type = sqlite_type if is_sqlite else pg_type
            try:
                conn.execute(text(f"ALTER TABLE contacts ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                print(f"Added contacts.{col_name}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")

        # Create new tables if not exist (SQLAlchemy create_all)
        from core.database import Base
        from models.compliance import OwnershipLink, ComplianceSnapshot, ComplianceRisk
        Base.metadata.create_all(bind=engine, tables=[
            OwnershipLink.__table__,
            ComplianceSnapshot.__table__,
            ComplianceRisk.__table__,
        ])
        print("Compliance tables ensured.")
    print("Done.")


if __name__ == "__main__":
    run()
