"""
Migration: Create user_favorites table for pinned/favourite projects
"""
from core.database import engine
import sqlalchemy as sa


def run():
    with engine.connect() as conn:
        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS user_favorites (
                id VARCHAR PRIMARY KEY,
                user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_user_favorites_project ON user_favorites(project_id)"))
        # Unique constraint: one favorite per user+project
        conn.execute(sa.text("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_unique
            ON user_favorites(user_id, project_id)
        """))
        conn.commit()
    print("[migration] user_favorites table created")


if __name__ == "__main__":
    run()
