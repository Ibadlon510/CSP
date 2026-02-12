"""Add is_primary and notes to contact_addresses. Add billing to address type if using enum.
Run from backend dir: python3 -m migrations.add_address_is_primary_notes
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def run():
    with engine.connect() as conn:
        if engine.url.get_backend_name() == "sqlite":
            r = conn.execute(text("PRAGMA table_info(contact_addresses)"))
            existing = {row[1] for row in r}
        else:
            r = conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'contact_addresses'"
            ))
            existing = {row[0] for row in r}
        if "is_primary" not in existing:
            try:
                conn.execute(text("ALTER TABLE contact_addresses ADD COLUMN is_primary INTEGER"))
                conn.commit()
                print("Added is_primary")
            except Exception as e:
                print(f"Error adding is_primary: {e}")
        else:
            print("Skip is_primary (exists)")
        if "notes" not in existing:
            try:
                conn.execute(text("ALTER TABLE contact_addresses ADD COLUMN notes TEXT"))
                conn.commit()
                print("Added notes")
            except Exception as e:
                print(f"Error adding notes: {e}")
        else:
            print("Skip notes (exists)")
    print("Done.")


if __name__ == "__main__":
    run()
