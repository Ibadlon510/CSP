"""Migration: add activity_assignees table for multi-assignee support.
Run from backend dir: python3 -m migrations.add_activity_assignees
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine, Base
from models.activity import ActivityAssignee  # ensure model is registered


def run():
    with engine.connect() as conn:
        # Check if table already exists
        try:
            conn.execute(text("SELECT 1 FROM activity_assignees LIMIT 1"))
            print("activity_assignees table already exists — skipping")
            return
        except Exception:
            conn.rollback()

    # Create table
    ActivityAssignee.__table__.create(engine, checkfirst=True)
    print("Created activity_assignees table")

    # Migrate existing assigned_to values into M2M table
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, assigned_to FROM activities WHERE assigned_to IS NOT NULL"
        )).fetchall()
        for row in rows:
            try:
                conn.execute(text(
                    "INSERT INTO activity_assignees (activity_id, user_id) VALUES (:aid, :uid)"
                ), {"aid": row[0], "uid": row[1]})
            except Exception:
                pass  # skip duplicates
        conn.commit()
        print(f"Migrated {len(rows)} existing assigned_to values to activity_assignees")


if __name__ == "__main__":
    run()
