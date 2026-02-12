"""
Migration: Create saved_searches table for user-saved filter/group presets.
"""
from core.database import engine
import sqlalchemy as sa


def run():
    with engine.connect() as conn:
        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS saved_searches (
                id VARCHAR PRIMARY KEY,
                user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                page VARCHAR(50) NOT NULL,
                criteria JSON NOT NULL,
                is_default BOOLEAN DEFAULT 0 NOT NULL,
                is_shared BOOLEAN DEFAULT 0 NOT NULL,
                sort_order INTEGER DEFAULT 0 NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_saved_searches_org ON saved_searches(org_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_saved_searches_page ON saved_searches(user_id, page)"))
        conn.execute(sa.text("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_searches_unique_name
            ON saved_searches(user_id, page, name)
        """))
        conn.commit()
    print("[migration] saved_searches table created")


if __name__ == "__main__":
    run()
