"""Migration: add task_assignees table for multi-assignee support.
Run from backend dir: python -m migrations.add_task_assignees
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine, Base
from models.project import TaskAssignee  # ensure model is registered


def run():
    with engine.connect() as conn:
        # Check if table already exists
        try:
            conn.execute(text("SELECT 1 FROM task_assignees LIMIT 1"))
            print("task_assignees table already exists — skipping")
            return
        except Exception:
            conn.rollback()

    # Create table
    TaskAssignee.__table__.create(engine, checkfirst=True)
    print("Created task_assignees table")


if __name__ == "__main__":
    run()
