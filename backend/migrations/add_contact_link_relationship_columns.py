"""Migration: add role_label, relationship_kind, shareholding columns to ownership_links.
Run from backend dir: python -m migrations.add_contact_link_relationship_columns
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def run():
    with engine.connect() as conn:
        if engine.url.get_backend_name() == "sqlite":
            r = conn.execute(text("PRAGMA table_info(ownership_links)"))
            existing = {row[1] for row in r}
        else:
            r = conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'ownership_links'"
            ))
            existing = {row[0] for row in r}

        is_sqlite = engine.url.get_backend_name() == "sqlite"
        adds = [
            ("role_label", "TEXT", "VARCHAR(100)"),
            ("relationship_kind", "TEXT", "VARCHAR(50)"),
            ("number_of_shares", "REAL", "FLOAT"),
            ("share_class", "TEXT", "VARCHAR(50)"),
            ("nominal_value_per_share", "REAL", "FLOAT"),
            ("share_currency", "TEXT", "VARCHAR(10)"),
        ]
        for col_name, sqlite_type, pg_type in adds:
            if col_name in existing:
                print(f"Skip ownership_links.{col_name} (exists)")
                continue
            col_type = sqlite_type if is_sqlite else pg_type
            try:
                conn.execute(text(f"ALTER TABLE ownership_links ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                print(f"Added ownership_links.{col_name}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
    print("Done.")


if __name__ == "__main__":
    run()
