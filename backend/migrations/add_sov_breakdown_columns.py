"""Migration: add SOV Breakdown columns and commission_attributes table.

- sales_orders: discount_mode, order_discount_amount, order_discount_percent
- sales_order_lines: unit_cost, commission_attrib
- New table: commission_attributes

Run from backend dir: python -m migrations.add_sov_breakdown_columns
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from core.database import engine, Base
from models.commission_attribute import CommissionAttribute
from models.sales_order import SalesOrder, SalesOrderLine


def run():
    insp = inspect(engine)

    # 1. Create commission_attributes table if not exists
    Base.metadata.create_all(bind=engine, tables=[CommissionAttribute.__table__], checkfirst=True)
    print("  commission_attributes table ensured.")

    # 2. Add columns to sales_orders
    so_cols = {c["name"] for c in insp.get_columns("sales_orders")}
    with engine.begin() as conn:
        if "discount_mode" not in so_cols:
            conn.execute(text("ALTER TABLE sales_orders ADD COLUMN discount_mode VARCHAR(10) NOT NULL DEFAULT 'amount'"))
            print("  Added sales_orders.discount_mode")
        if "order_discount_amount" not in so_cols:
            conn.execute(text("ALTER TABLE sales_orders ADD COLUMN order_discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0"))
            print("  Added sales_orders.order_discount_amount")
        if "order_discount_percent" not in so_cols:
            conn.execute(text("ALTER TABLE sales_orders ADD COLUMN order_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0"))
            print("  Added sales_orders.order_discount_percent")

    # 3. Add columns to sales_order_lines
    sol_cols = {c["name"] for c in insp.get_columns("sales_order_lines")}
    with engine.begin() as conn:
        if "unit_cost" not in sol_cols:
            conn.execute(text("ALTER TABLE sales_order_lines ADD COLUMN unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0"))
            print("  Added sales_order_lines.unit_cost")
        if "commission_attrib" not in sol_cols:
            conn.execute(text("ALTER TABLE sales_order_lines ADD COLUMN commission_attrib VARCHAR(100)"))
            print("  Added sales_order_lines.commission_attrib")

    print("Migration complete: SOV Breakdown columns added.")


if __name__ == "__main__":
    run()
