"""Migration: remove entities; use contact_id everywhere.
- Adds contact_id to invoices, sales_orders, quotations, crm_contacts, opportunities (if missing).
- Drops entity_id from those tables and from client_wallets.
- Drops entity_documents and entities tables.

Run from backend dir: python -m migrations.entities_to_contacts

Requires SQLite 3.35+ for DROP COLUMN. Back up DB before running.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def run():
    backend = engine.url.get_backend_name()
    is_sqlite = backend == "sqlite"

    with engine.connect() as conn:
        # 1) Add contact_id where missing
        tables_add = [
            ("invoices", "contact_id", "VARCHAR", "VARCHAR"),
            ("sales_orders", "contact_id", "VARCHAR", "VARCHAR"),
            ("quotations", "contact_id", "VARCHAR", "VARCHAR"),
            ("crm_contacts", "contact_id", "VARCHAR", "VARCHAR"),
            ("opportunities", "contact_id", "VARCHAR", "VARCHAR"),
        ]
        for table, col, sqlite_t, pg_t in tables_add:
            if is_sqlite:
                r = conn.execute(text(f"PRAGMA table_info({table})"))
                existing = {row[1] for row in r}
            else:
                r = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name = :t"
                ), {"t": table})
                existing = {row[0] for row in r}
            if col in existing:
                print(f"Skip add {table}.{col} (exists)")
                continue
            typ = sqlite_t if is_sqlite else pg_t
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typ}"))
            conn.commit()
            print(f"Added {table}.{col}")

        # 2) Drop entity_id from tables that have it
        tables_drop = ["client_wallets", "invoices", "sales_orders", "quotations", "crm_contacts", "opportunities"]
        for table in tables_drop:
            if is_sqlite:
                r = conn.execute(text(f"PRAGMA table_info({table})"))
                cols = {row[1] for row in r}
            else:
                r = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name = :t"
                ), {"t": table})
                cols = {row[0] for row in r}
            if "entity_id" not in cols:
                print(f"Skip drop entity_id from {table} (no column)")
                continue
            # SQLite 3.35+ supports DROP COLUMN
            try:
                conn.execute(text(f"ALTER TABLE {table} DROP COLUMN entity_id"))
                conn.commit()
                print(f"Dropped entity_id from {table}")
            except Exception as e:
                print(f"Failed to drop entity_id from {table}: {e}")
                if is_sqlite:
                    print("SQLite 3.35+ required for DROP COLUMN. Upgrade or run manual migration.")

        # 3) Drop entity_documents then entities
        for table in ["entity_documents", "entities"]:
            try:
                conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
                conn.commit()
                print(f"Dropped table {table}")
            except Exception as e:
                print(f"Drop {table}: {e}")

    print("Done.")


if __name__ == "__main__":
    run()
