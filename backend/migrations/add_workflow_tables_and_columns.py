"""Migration: workflow chain (lead_id, opportunity_id), products, product_id on lines, project invoice_id/sales_order_id, task parent_id.
Run from backend dir: python -m migrations.add_workflow_tables_and_columns
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine, Base
from models.product import Product, ProductTaskTemplate


def table_info(conn, table: str) -> set:
    name = engine.url.get_backend_name()
    if name == "sqlite":
        r = conn.execute(text(f"PRAGMA table_info({table})"))
        return {row[1] for row in r}
    r = conn.execute(
        text("SELECT column_name FROM information_schema.columns WHERE table_name = :t"),
        {"t": table},
    )
    return {row[0] for row in r}


def add_column_if_missing(conn, table: str, col: str, col_type: str, existing: set):
    if col in existing:
        print(f"  Skip {table}.{col} (exists)")
        return
    try:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
        conn.commit()
        print(f"  Added {table}.{col}")
    except Exception as e:
        print(f"  Error adding {table}.{col}: {e}")


def run():
    # 1. Create new tables (products, product_task_templates)
    print("Creating products and product_task_templates tables if missing...")
    Base.metadata.create_all(bind=engine, tables=[Product.__table__, ProductTaskTemplate.__table__], checkfirst=True)

    # 2. Add columns to existing tables
    is_sqlite = engine.url.get_backend_name() == "sqlite"
    with engine.connect() as conn:
        # quotations
        existing = table_info(conn, "quotations")
        add_column_if_missing(conn, "quotations", "opportunity_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)
        # sales_orders
        existing = table_info(conn, "sales_orders")
        add_column_if_missing(conn, "sales_orders", "lead_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)
        add_column_if_missing(conn, "sales_orders", "opportunity_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)
        # invoices
        existing = table_info(conn, "invoices")
        add_column_if_missing(conn, "invoices", "lead_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)
        add_column_if_missing(conn, "invoices", "opportunity_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)
        # quotation_lines
        existing = table_info(conn, "quotation_lines")
        add_column_if_missing(conn, "quotation_lines", "product_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)
        # sales_order_lines
        existing = table_info(conn, "sales_order_lines")
        add_column_if_missing(conn, "sales_order_lines", "product_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)
        # invoice_lines
        existing = table_info(conn, "invoice_lines")
        add_column_if_missing(conn, "invoice_lines", "product_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)
        # projects
        existing = table_info(conn, "projects")
        add_column_if_missing(conn, "projects", "invoice_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)
        add_column_if_missing(conn, "projects", "sales_order_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)
        # tasks
        existing = table_info(conn, "tasks")
        add_column_if_missing(conn, "tasks", "parent_id", "VARCHAR" if is_sqlite else "VARCHAR(36)", existing)

    print("Migration complete.")


if __name__ == "__main__":
    run()
