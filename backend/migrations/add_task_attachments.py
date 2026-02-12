"""
Migration: Create task_attachments table for file uploads on tasks
"""
from core.database import engine
import sqlalchemy as sa


def run():
    with engine.connect() as conn:
        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS task_attachments (
                id VARCHAR PRIMARY KEY,
                task_id VARCHAR NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
                filename VARCHAR(500) NOT NULL,
                file_path VARCHAR(1000) NOT NULL,
                file_size INTEGER DEFAULT 0,
                mime_type VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id)"))
        conn.commit()
    print("[migration] task_attachments table created")


if __name__ == "__main__":
    run()
