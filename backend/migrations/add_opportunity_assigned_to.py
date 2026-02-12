"""Migration: add assigned_to column to opportunities table.
Run from backend dir: python -m migrations.add_opportunity_assigned_to
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def run():
    with engine.connect() as conn:
        # Check if column already exists
        try:
            conn.execute(text("SELECT assigned_to FROM opportunities LIMIT 1"))
            print("opportunities.assigned_to column already exists — skipping")
            return
        except Exception:
            conn.rollback()

        conn.execute(text("ALTER TABLE opportunities ADD COLUMN assigned_to VARCHAR REFERENCES users(id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_opportunities_assigned_to ON opportunities(assigned_to)"))
        conn.commit()
        print("Added assigned_to column to opportunities table")


if __name__ == "__main__":
    run()
