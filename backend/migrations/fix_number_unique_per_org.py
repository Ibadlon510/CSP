"""Migration: Change number unique constraint from global to per-org on quotations, sales_orders, invoices.
SQLite requires table recreation to remove column-level UNIQUE constraints.
Run from backend dir: python -m migrations.fix_number_unique_per_org
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def has_global_unique_on_number(conn, table: str) -> bool:
    """Check if the table has a sqlite_autoindex unique constraint on just 'number'."""
    rows = conn.execute(text(f"PRAGMA index_list({table})")).fetchall()
    for row in rows:
        idx_name = row[1]
        is_unique = row[2]
        if is_unique and idx_name.startswith("sqlite_autoindex"):
            cols = conn.execute(text(f"PRAGMA index_info(\"{idx_name}\")")).fetchall()
            col_names = [r[2] for r in cols]
            if col_names == ["number"]:
                return True
    return False


def get_create_sql(conn, table: str) -> str:
    """Get the original CREATE TABLE statement."""
    row = conn.execute(text(
        f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}'"
    )).fetchone()
    return row[0] if row else ""


def recreate_table_without_unique_number(conn, table: str):
    """Recreate table replacing 'number ... UNIQUE' with 'number ...' (no UNIQUE)."""
    original_sql = get_create_sql(conn, table)
    if not original_sql:
        print(f"  Could not find CREATE TABLE for {table}")
        return

    # Get column names
    cols_info = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    col_names = [c[1] for c in cols_info]
    cols_csv = ", ".join(f'"{c}"' for c in col_names)

    # Build new CREATE TABLE: remove the table-level UNIQUE (number) constraint
    # Pattern in SQLite: ... UNIQUE (number), ...  or  ... UNIQUE (number)\n)
    import re
    # Remove table-level constraint line like:  UNIQUE (number),  or  , \n\tUNIQUE (number)
    new_sql = re.sub(
        r',?\s*UNIQUE\s*\(number\)\s*,?',
        '',
        original_sql,
        flags=re.IGNORECASE,
    )
    # Clean up any trailing comma before closing paren
    new_sql = re.sub(r',\s*\)', '\n)', new_sql)

    if new_sql == original_sql:
        print(f"  Could not find UNIQUE (number) constraint in CREATE TABLE for {table}")
        print(f"  SQL: {original_sql[:300]}...")
        return

    # Change table name in new_sql to use a temp name for creation
    tmp_table = f"{table}__new"
    new_sql_tmp = new_sql.replace(f'"{table}"', f'"{tmp_table}"', 1)
    if tmp_table not in new_sql_tmp:
        new_sql_tmp = new_sql.replace(f'{table}', f'{tmp_table}', 1)

    print(f"  Recreating {table} without UNIQUE on number...")

    # Step 1: Create new table
    conn.execute(text(f'DROP TABLE IF EXISTS "{tmp_table}"'))
    conn.execute(text(new_sql_tmp))

    # Step 2: Copy data
    conn.execute(text(f'INSERT INTO "{tmp_table}" ({cols_csv}) SELECT {cols_csv} FROM "{table}"'))

    # Step 3: Drop old table
    conn.execute(text(f'DROP TABLE "{table}"'))

    # Step 4: Rename new table
    conn.execute(text(f'ALTER TABLE "{tmp_table}" RENAME TO "{table}"'))

    # Step 5: Create per-org unique index
    uq_name = f"uq_{table}_org_number"
    conn.execute(text(f'CREATE UNIQUE INDEX "{uq_name}" ON "{table}" (org_id, number)'))

    # Step 6: Create plain index on number for queries
    ix_name = f"ix_{table}_number"
    conn.execute(text(f'CREATE INDEX IF NOT EXISTS "{ix_name}" ON "{table}" (number)'))

    # Step 7: Recreate other indexes that were lost
    # org_id index
    try:
        conn.execute(text(f'CREATE INDEX IF NOT EXISTS "ix_{table}_org_id" ON "{table}" (org_id)'))
    except Exception:
        pass
    # contact_id index
    if "contact_id" in col_names:
        try:
            conn.execute(text(f'CREATE INDEX IF NOT EXISTS "ix_{table}_contact_id" ON "{table}" (contact_id)'))
        except Exception:
            pass

    conn.commit()
    print(f"  Done: {table} recreated with per-org unique constraint on (org_id, number)")


def run():
    is_sqlite = engine.url.get_backend_name() == "sqlite"
    if not is_sqlite:
        print("This migration is for SQLite only.")
        return

    tables = ["quotations", "sales_orders", "invoices"]

    with engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys = OFF"))

        for table in tables:
            if has_global_unique_on_number(conn, table):
                print(f"\n{table}: has global UNIQUE on number -> recreating...")
                recreate_table_without_unique_number(conn, table)
            else:
                print(f"\n{table}: no global UNIQUE on number (already fixed or never had it)")
                # Still ensure per-org index exists
                uq_name = f"uq_{table}_org_number"
                try:
                    conn.execute(text(f'CREATE UNIQUE INDEX IF NOT EXISTS "{uq_name}" ON "{table}" (org_id, number)'))
                    conn.commit()
                except Exception:
                    pass

        conn.execute(text("PRAGMA foreign_keys = ON"))

    print("\nMigration complete.")


if __name__ == "__main__":
    run()
