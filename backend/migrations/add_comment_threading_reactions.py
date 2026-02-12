"""
Migration: Add parent_id to task_comments for threading + comment_reactions table
"""
from core.database import engine
import sqlalchemy as sa


def run():
    with engine.connect() as conn:
        # Add parent_id column to task_comments
        try:
            conn.execute(sa.text(
                "ALTER TABLE task_comments ADD COLUMN parent_id VARCHAR REFERENCES task_comments(id) ON DELETE CASCADE"
            ))
        except Exception:
            pass  # column may already exist

        try:
            conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_task_comments_parent ON task_comments(parent_id)"))
        except Exception:
            pass

        # Create comment_reactions table
        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS comment_reactions (
                id VARCHAR PRIMARY KEY,
                comment_id VARCHAR NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
                user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                emoji VARCHAR(8) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id)"))
        # One reaction per emoji per user per comment
        conn.execute(sa.text("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_reactions_unique
            ON comment_reactions(comment_id, user_id, emoji)
        """))
        conn.commit()
    print("[migration] comment threading + reactions tables created")


if __name__ == "__main__":
    run()
