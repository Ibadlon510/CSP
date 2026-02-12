import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from core.database import engine
from sqlalchemy import text
conn = engine.connect()
for t in ["quotations", "sales_orders", "invoices"]:
    r = conn.execute(text(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{t}'")).fetchone()
    print(f"\n=== {t} ===")
    print(r[0] if r else "NOT FOUND")
