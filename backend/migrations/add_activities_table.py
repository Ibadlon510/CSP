"""Migration: add activities table.
Run from backend dir: python -m migrations.add_activities_table
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import engine, Base
from models.activity import Activity


def run():
    Base.metadata.create_all(bind=engine, tables=[Activity.__table__])
    print("Activities table ensured.")


if __name__ == "__main__":
    run()
