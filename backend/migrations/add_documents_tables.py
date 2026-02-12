"""Migration: add documents and document_categories tables.
Run from backend dir: python -m migrations.add_documents_tables
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import engine, Base
from models.document import Document, DocumentCategory


def run():
    Base.metadata.create_all(bind=engine, tables=[Document.__table__, DocumentCategory.__table__])
    print("Documents and DocumentCategories tables ensured.")


if __name__ == "__main__":
    run()
