"""
Migration: Add sort_order and start_date columns to tasks table.
"""
from sqlalchemy import text
from core.database import engine


def run():
    with engine.connect() as conn:
        # sort_order for Kanban drag-and-drop ordering
        try:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0"))
            print("[+] Added tasks.sort_order")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("[=] tasks.sort_order already exists")
            else:
                print(f"[!] sort_order: {e}")

        # start_date for Gantt timeline view
        try:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN start_date TIMESTAMP"))
            print("[+] Added tasks.start_date")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("[=] tasks.start_date already exists")
            else:
                print(f"[!] start_date: {e}")

        conn.commit()
    print("[✓] Migration complete: add_task_sort_order_start_date")


if __name__ == "__main__":
    run()
