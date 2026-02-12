"""
Migration: Create task_dependencies table for Gantt predecessor/successor links
"""
from core.database import engine
import sqlalchemy as sa


def run():
    with engine.connect() as conn:
        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS task_dependencies (
                id VARCHAR PRIMARY KEY,
                predecessor_id VARCHAR NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                successor_id VARCHAR NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                dependency_type VARCHAR(20) NOT NULL DEFAULT 'finish_to_start',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_task_deps_pred ON task_dependencies(predecessor_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_task_deps_succ ON task_dependencies(successor_id)"))
        conn.execute(sa.text("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_task_deps_unique
            ON task_dependencies(predecessor_id, successor_id)
        """))
        conn.commit()
    print("[migration] task_dependencies table created")


if __name__ == "__main__":
    run()
