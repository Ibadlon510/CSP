"""One-off migration: add VAT and CT columns to contacts table.
Run from backend dir: python -m migrations.add_contact_tax_columns
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


# (name, sqlite_type, pg_type)
VAT_CT_COLUMNS = [
    ("vat_registered", "INTEGER", "BOOLEAN"),
    ("vat_period_type", "VARCHAR(50)", "VARCHAR(50)"),
    ("vat_period_end_day", "INTEGER", "INTEGER"),
    ("vat_first_period_end_date", "DATE", "DATE"),
    ("vat_return_due_days", "INTEGER", "INTEGER"),
    ("vat_notes", "TEXT", "TEXT"),
    ("ct_registered", "INTEGER", "BOOLEAN"),
    ("ct_registration_no", "VARCHAR(100)", "VARCHAR(100)"),
    ("ct_period_type", "VARCHAR(50)", "VARCHAR(50)"),
    ("ct_financial_year_start_month", "INTEGER", "INTEGER"),
    ("ct_financial_year_start_day", "INTEGER", "INTEGER"),
    ("ct_filing_due_months", "INTEGER", "INTEGER"),
    ("ct_notes", "TEXT", "TEXT"),
]


def run():
    with engine.connect() as conn:
        if engine.url.get_backend_name() == "sqlite":
            r = conn.execute(text("PRAGMA table_info(contacts)"))
            existing = {row[1] for row in r}
        else:
            r = conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'"
            ))
            existing = {row[0] for row in r}
        is_sqlite = engine.url.get_backend_name() == "sqlite"
        for col_name, sqlite_type, pg_type in VAT_CT_COLUMNS:
            if col_name in existing:
                print(f"Skip {col_name} (exists)")
                continue
            col_type = sqlite_type if is_sqlite else pg_type
            try:
                conn.execute(text(f"ALTER TABLE contacts ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                print(f"Added {col_name}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
    print("Done.")


if __name__ == "__main__":
    run()
