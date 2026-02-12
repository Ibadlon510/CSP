"""
End-to-end simulation: Confirm Sales Order → creates Invoice + Project + Tasks.

Steps:
1. Register a new test user (with org)
2. Login → get token
3. Create a Product with creates_project=True and task templates
4. Create a Contact
5. Create a Sales Order with a line referencing the product
6. Confirm the Sales Order
7. Verify: invoice created, project created, tasks created
8. GET the order again and verify project_id and invoice_id are populated
"""
import requests, json, sys, time

BASE = "http://localhost:8000"
TS = str(int(time.time()))
EMAIL = f"testflow{TS}@example.com"
PASSWORD = "Test1234!"

def pp(label, data):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    if isinstance(data, dict):
        print(json.dumps(data, indent=2, default=str))
    else:
        print(data)

def fail(msg):
    print(f"\n*** FAIL: {msg} ***")
    sys.exit(1)

# ── 1. Register ──
print("Step 1: Register user...")
r = requests.post(f"{BASE}/register", json={
    "email": EMAIL,
    "password": PASSWORD,
    "full_name": "Test Workflow User",
    "org_name": f"TestOrg-{TS}",
})
if r.status_code not in (200, 201):
    pp("Register failed", r.json())
    fail(f"Register returned {r.status_code}")
token = r.json()["access_token"]
pp("Registered OK", {"email": EMAIL, "token": token[:30] + "..."})

HEADERS = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ── 2. Verify auth ──
print("\nStep 2: Verify auth (GET /me)...")
r = requests.get(f"{BASE}/me", headers=HEADERS)
if r.status_code != 200:
    fail(f"/me returned {r.status_code}")
user = r.json()
pp("Current user", {"id": user["id"], "org_id": user["org_id"], "email": user["email"]})

# ── 3. Create Product with creates_project + task templates ──
print("\nStep 3: Create product with creates_project=True...")
r = requests.post(f"{BASE}/api/products/", headers=HEADERS, json={
    "name": "Company Formation",
    "description": "Full company formation service",
    "default_unit_price": 5000,
    "is_active": True,
    "creates_project": True,
    "task_templates": [
        {"task_name": "Document Collection", "sort_order": 1, "subtask_names": ["Passport Copy", "Emirates ID", "Proof of Address"]},
        {"task_name": "Name Reservation", "sort_order": 2, "subtask_names": ["Check availability", "Submit reservation"]},
        {"task_name": "License Issuance", "sort_order": 3, "subtask_names": ["Prepare application", "Submit to authority", "Collect license"]},
    ]
})
if r.status_code not in (200, 201):
    pp("Create product failed", r.json())
    fail(f"Create product returned {r.status_code}")
product = r.json()
PRODUCT_ID = product["id"]
pp("Product created", {"id": PRODUCT_ID, "name": product["name"], "creates_project": product["creates_project"], "templates": len(product.get("task_templates", []))})

# ── 4. Create Contact ──
print("\nStep 4: Create contact...")
r = requests.post(f"{BASE}/api/contacts/", headers=HEADERS, json={
    "name": f"Test Client {TS}",
    "email": f"client{TS}@example.com",
    "type": "individual",
})
if r.status_code not in (200, 201):
    pp("Create contact failed", r.json())
    fail(f"Create contact returned {r.status_code}")
contact = r.json()
CONTACT_ID = contact["id"]
pp("Contact created", {"id": CONTACT_ID, "name": contact["name"]})

# ── 5. Create Sales Order with product line ──
print("\nStep 5: Create sales order with product line...")
r = requests.post(f"{BASE}/api/orders/", headers=HEADERS, json={
    "contact_id": CONTACT_ID,
    "lines": [
        {
            "product_id": PRODUCT_ID,
            "description": "Company Formation - Full Package",
            "quantity": 1,
            "unit_price": 5000,
            "vat_rate": 5,
        }
    ]
})
if r.status_code not in (200, 201):
    pp("Create order failed", r.json())
    fail(f"Create order returned {r.status_code}")
order = r.json()
ORDER_ID = order["id"]
pp("Order created", {
    "id": ORDER_ID,
    "number": order["number"],
    "status": order["status"],
    "lines": len(order["lines"]),
    "project_id": order.get("project_id"),
    "invoice_id": order.get("invoice_id"),
})

# Verify line has product_id
line = order["lines"][0] if order["lines"] else {}
print(f"  Line product_id: {line.get('product_id')}")
if not line.get("product_id"):
    fail("Order line missing product_id!")

# ── 6. Confirm the Sales Order ──
print("\nStep 6: CONFIRM sales order...")
r = requests.post(f"{BASE}/api/orders/{ORDER_ID}/confirm", headers=HEADERS, json={})
if r.status_code not in (200, 201):
    pp("Confirm failed", r.json())
    fail(f"Confirm returned {r.status_code}")
confirm_resp = r.json()
pp("Confirm response", {
    "status": confirm_resp.get("status"),
    "confirmed_at": confirm_resp.get("confirmed_at"),
    "confirmed_invoice_id": confirm_resp.get("confirmed_invoice_id"),
    "confirmed_project_id": confirm_resp.get("confirmed_project_id"),
    "project_id": confirm_resp.get("project_id"),
    "invoice_id": confirm_resp.get("invoice_id"),
})

INVOICE_ID = confirm_resp.get("confirmed_invoice_id") or confirm_resp.get("invoice_id")
PROJECT_ID = confirm_resp.get("confirmed_project_id") or confirm_resp.get("project_id")

if not INVOICE_ID:
    fail("No invoice created on confirm!")
print(f"  ✓ Invoice created: {INVOICE_ID}")

if not PROJECT_ID:
    fail("No project created on confirm! (Product has creates_project=True)")
print(f"  ✓ Project created: {PROJECT_ID}")

# ── 7. GET order again and verify project_id + invoice_id ──
print("\nStep 7: GET order and verify links...")
r = requests.get(f"{BASE}/api/orders/{ORDER_ID}", headers=HEADERS)
if r.status_code != 200:
    fail(f"GET order returned {r.status_code}")
order_after = r.json()
pp("Order after confirm", {
    "status": order_after["status"],
    "project_id": order_after.get("project_id"),
    "invoice_id": order_after.get("invoice_id"),
})

if not order_after.get("project_id"):
    fail("GET order: project_id is missing!")
if not order_after.get("invoice_id"):
    fail("GET order: invoice_id is missing!")
print("  ✓ project_id populated on order")
print("  ✓ invoice_id populated on order")

# ── 8. GET project and verify tasks ──
print("\nStep 8: GET project and verify tasks...")
r = requests.get(f"{BASE}/api/projects/{PROJECT_ID}", headers=HEADERS)
if r.status_code != 200:
    pp("GET project failed", r.text)
    fail(f"GET project returned {r.status_code}")
project_resp = r.json()
pp("Project", {
    "id": project_resp.get("id"),
    "title": project_resp.get("title"),
    "status": project_resp.get("status"),
    "sales_order_id": project_resp.get("sales_order_id"),
    "invoice_id": project_resp.get("invoice_id"),
})

# GET tasks for the project
r = requests.get(f"{BASE}/api/projects/{PROJECT_ID}/tasks", headers=HEADERS)
if r.status_code != 200:
    pp("GET tasks failed", r.text)
    fail(f"GET tasks returned {r.status_code}")
tasks = r.json()
parent_tasks = [t for t in tasks if not t.get("parent_id")]
sub_tasks = [t for t in tasks if t.get("parent_id")]
pp("Tasks", {
    "total": len(tasks),
    "parent_tasks": len(parent_tasks),
    "subtasks": len(sub_tasks),
    "parent_names": [t["title"] for t in parent_tasks],
})
if len(parent_tasks) == 0:
    fail("No tasks created from product templates!")
print(f"  ✓ {len(parent_tasks)} parent tasks created")
print(f"  ✓ {len(sub_tasks)} subtasks created")

# ── 9. GET orders list and verify project_id is populated ──
print("\nStep 9: GET orders list and verify project_id populated...")
r = requests.get(f"{BASE}/api/orders/", headers=HEADERS)
if r.status_code != 200:
    fail(f"GET orders list returned {r.status_code}")
orders_list = r.json()
our_order = next((o for o in orders_list if o["id"] == ORDER_ID), None)
if not our_order:
    fail("Order not found in list!")
pp("Order in list", {
    "id": our_order["id"],
    "project_id": our_order.get("project_id"),
    "invoice_id": our_order.get("invoice_id"),
})
if not our_order.get("project_id"):
    fail("List view: project_id missing!")
if not our_order.get("invoice_id"):
    fail("List view: invoice_id missing!")
print("  ✓ project_id populated in list view")
print("  ✓ invoice_id populated in list view")

# ── DONE ──
print("\n" + "=" * 60)
print("  ALL CHECKS PASSED ✓")
print("=" * 60)
print(f"""
Summary:
  - Product '{product['name']}' (creates_project=True, 3 task templates)
  - Contact '{contact['name']}'
  - Sales Order '{order['number']}' → Confirmed
  - Invoice created: {INVOICE_ID}
  - Project created: {PROJECT_ID}
  - Tasks: {len(parent_tasks)} parent + {len(sub_tasks)} subtasks
  - Order detail shows project_id + invoice_id ✓
  - Order list shows project_id + invoice_id ✓
""")
