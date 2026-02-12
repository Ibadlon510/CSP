"""Migration: add document_type column to product_document_requirements and project_document_checklist.
Run from backend dir: python -m migrations.add_document_type_column
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def run():
    with engine.connect() as conn:
        # product_document_requirements
        try:
            conn.execute(text("SELECT document_type FROM product_document_requirements LIMIT 1"))
            print("product_document_requirements.document_type already exists — skipping")
        except Exception:
            conn.rollback()
            conn.execute(text(
                "ALTER TABLE product_document_requirements ADD COLUMN document_type VARCHAR(20) NOT NULL DEFAULT 'required'"
            ))
            conn.commit()
            print("Added document_type to product_document_requirements")

        # project_document_checklist
        try:
            conn.execute(text("SELECT document_type FROM project_document_checklist LIMIT 1"))
            print("project_document_checklist.document_type already exists — skipping")
        except Exception:
            conn.rollback()
            conn.execute(text(
                "ALTER TABLE project_document_checklist ADD COLUMN document_type VARCHAR(20) NOT NULL DEFAULT 'required'"
            ))
            conn.commit()
            print("Added document_type to project_document_checklist")


if __name__ == "__main__":
    run()
