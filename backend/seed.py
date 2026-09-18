"""Idempotent seeding of accounts + optional demo data.

Also runnable as a secure first-admin command:
    python create_first_admin.py     (see that file)
"""
from datetime import timedelta

from db import db, next_sequence, now_utc
from security import hash_password

ALL_PERMS = {
    "create_edit_orders": True, "assign_responsibility": True, "check_approve_return": True,
    "update_production": True, "qc_updates": True, "record_dispatch": True,
    "record_billing": True, "export_reports": True,
}


async def _user(name, email, password, role, permissions=None, company=None):
    existing = await db.users.find_one({"email": email})
    if existing:
        return existing
    doc = {
        "name": name, "email": email, "password_hash": hash_password(password),
        "role": role, "permissions": permissions or {}, "active": True,
        "company": company, "phone": None, "created_at": now_utc(), "created_by": "seed",
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def ensure_seed():
    """Runs on startup. Only creates accounts/demo when the DB is empty (dev convenience)."""
    if await db.users.count_documents({}) > 0:
        return

    admin = await _user("System Admin", "admin@printpackinc.com", "Admin@12345", "Admin", ALL_PERMS)
    mgr = await _user("Rajesh Manager", "manager@printpackinc.com", "Manager@123", "Manager",
                      {"create_edit_orders": True, "check_approve_return": True, "assign_responsibility": True,
                       "export_reports": True})
    view_mgr = await _user("Priya (View Only)", "viewmanager@printpackinc.com", "Manager@123", "Manager", {})
    emp1 = await _user("Amit Sales", "amit@printpackinc.com", "Employee@123", "Employee",
                       {"create_edit_orders": True})
    emp2 = await _user("Sunil Sales", "sunil@printpackinc.com", "Employee@123", "Employee",
                       {"create_edit_orders": True})
    emp3 = await _user("Deepak Production", "deepak@printpackinc.com", "Employee@123", "Employee",
                       {"update_production": True, "qc_updates": True})
    emp4 = await _user("Kavita Dispatch", "kavita@printpackinc.com", "Employee@123", "Employee",
                       {"record_dispatch": True, "record_billing": True})
    customer = await _user("Ravi (ABC Foods)", "customer@example.com", "Customer@123", "Customer",
                           company="ABC Foods Pvt Ltd")
    vendor = await _user("Mahesh (Paper Mills)", "vendor@example.com", "Vendor@123", "Vendor",
                         company="Sri Paper Mills")

    # --- demo orders ---
    async def make_order(assigned, creator, customer_name, product, qty, status, priority="Normal", delivery_offset=7):
        job = await next_sequence("PPC")
        delivery = (now_utc() + timedelta(days=delivery_offset)).strftime("%Y-%m-%d")
        doc = {
            "job_number": job, "status": status, "revision": 1, "priority": priority,
            "source": "Employee", "creator_id": str(creator["_id"]), "creator_name": creator["name"],
            "assigned_to": str(assigned["_id"]), "customer_id": str(customer["_id"]), "request_id": None,
            "sales": {"customer_name": customer_name, "po_number": "PO-" + job[-6:], "po_date": now_utc().strftime("%Y-%m-%d"),
                      "delivery_date": delivery, "delivery_location": "Pune MIDC", "assigned_to": str(assigned["_id"]),
                      "contact_person": "Store Manager"},
            "box": {"product_name": product, "box_type": "Regular Corrugated Box", "length": 300, "width": 200,
                    "height": 150, "quantity": qty, "unit": "PCS", "ply": "5 Ply", "board_spec": "180 GSM Kraft",
                    "paper_gsm_bf": "180/22", "flute": "B"},
            "printing": {"required": "Yes", "process": "Flexographic", "colours": "2", "side": "Outside",
                         "artwork_approval": "Yes"},
            "conversion": {"processes": ["Slotting", "Creasing", "Stitching"], "die_requirement": "No Die"},
            "quality": {"sample_required": "Yes", "coc_required": "No"},
            "commercial": {"rate_per_piece": 12.5, "gst_percent": 18, "payment_terms": "30 days",
                           "transport": "Print Pack"},
            "declaration": {}, "documents": [{"category": "PO Copy", "original_name": "po.pdf", "id": "demo"}],
            "production": {}, "production_updates": [], "qc_inspections": [], "dispatches": [], "billing": [],
            "approved_snapshot": None, "qty_ordered": qty, "qc_released_qty": 0, "dispatched_qty": 0,
            "created_at": now_utc(), "updated_at": now_utc(),
        }
        subtotal = round(12.5 * qty, 2)
        doc["commercial"]["subtotal"] = subtotal
        doc["commercial"]["gst_amount"] = round(subtotal * 0.18, 2)
        doc["commercial"]["grand_total"] = round(subtotal * 1.18, 2)
        res = await db.orders.insert_one(doc)
        return str(res.inserted_id)

    await make_order(emp1, emp1, "ABC Foods Pvt Ltd", "Pizza Box 12 inch", 5000, "UNDER_CHECKING", "Urgent", 3)
    await make_order(emp2, emp2, "XYZ Electronics", "Shipping Carton L", 2000, "APPROVED", "Normal", 10)
    await make_order(emp1, emp1, "ABC Foods Pvt Ltd", "Burger Box", 8000, "IN_PRODUCTION", "Normal", 5)
    await make_order(emp2, emp2, "FreshFarm", "Vegetable Crate", 1200, "READY_FOR_DISPATCH", "Very Urgent", 1)
    await make_order(emp1, emp1, "ABC Foods Pvt Ltd", "Corner Pad", 15000, "DRAFT", "Normal", 14)

    # --- demo follow-ups ---
    await db.followups.insert_many([
        {"title": "Confirm delivery date with ABC Foods", "assigned_to": str(emp1["_id"]), "method": "Call",
         "due_at": now_utc(), "status": "Open", "created_by": str(emp1["_id"]), "created_at": now_utc()},
        {"title": "Send artwork proof to XYZ", "assigned_to": str(emp2["_id"]), "method": "Email",
         "due_at": now_utc() - timedelta(days=1), "status": "Open", "created_by": str(emp2["_id"]),
         "created_at": now_utc()},
        {"title": "Follow up payment FreshFarm", "assigned_to": str(emp1["_id"]), "method": "WhatsApp",
         "due_at": now_utc() + timedelta(days=2), "status": "Open", "created_by": str(emp1["_id"]),
         "created_at": now_utc()},
    ])

    # --- demo external request ---
    ref = await next_sequence("REQ")
    await db.requests.insert_one({
        "reference": ref, "status": "NEW", "source": "Customer", "submitted_by": str(customer["_id"]),
        "submitted_by_name": customer["name"], "business_name": "ABC Foods Pvt Ltd", "contact_person": "Ravi",
        "mobile": "9800000000", "email": "customer@example.com", "requirement": "Corrugated boxes for new SKU",
        "quantity": "10000", "delivery_date": (now_utc() + timedelta(days=20)).strftime("%Y-%m-%d"),
        "delivery_location": "Mumbai", "special_instructions": "Need samples first", "documents": [],
        "assigned_to": None, "linked_order_id": None, "created_at": now_utc(), "updated_at": now_utc(),
    })
