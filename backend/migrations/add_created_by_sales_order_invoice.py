"""Migration: add created_by to sales_orders and invoices.

Run from backend dir: python -m migrations.add_created_by_sales_order_invoice
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from core.database import engine


def run():
    insp = inspect(engine)
    so_cols = {c["name"] for c in insp.get_columns("sales_orders")}
    inv_cols = {c["name"] for c in insp.get_columns("invoices")}
    with engine.begin() as conn:
        if "created_by" not in so_cols:
            conn.execute(text("ALTER TABLE sales_orders ADD COLUMN created_by VARCHAR"))
            print("  Added sales_orders.created_by")
        if "created_by" not in inv_cols:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN created_by VARCHAR"))
            print("  Added invoices.created_by")
    print("Migration complete: created_by columns added.")


if __name__ == "__main__":
    run()
