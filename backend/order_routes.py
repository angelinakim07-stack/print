"""Order lifecycle: create, edit, submit, approval, production, QC, dispatch, billing."""
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import clean, db, next_sequence, now_utc, oid
from deps import get_current_user, has_perm
from services import log_activity, notify

router = APIRouter()

STATUSES = [
    "DRAFT", "NEW", "UNDER_CHECKING", "CORRECTION_REQUIRED", "APPROVED",
    "PRODUCTION_PLANNING", "IN_PRODUCTION", "QC", "READY_FOR_DISPATCH",
    "DISPATCHED", "BILLED", "CLOSED",
]

SEND_BACK_REASONS = [
    "Size Missing", "Paper Specification Missing", "Ply Missing", "Artwork Missing",
    "PO Missing", "Printing Details Missing", "Process Missing", "Delivery Date Missing", "Other",
]


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class OrderCreate(BaseModel):
    priority: str = "Normal"
    source: str = "Employee"
    assigned_to: str | None = None
    customer_id: str | None = None
    sales: dict = {}
    box: dict = {}
    printing: dict = {}
    conversion: dict = {}
    quality: dict = {}
    commercial: dict = {}
    declaration: dict = {}
    documents: list = []


class OrderUpdate(BaseModel):
    priority: str | None = None
    assigned_to: str | None = None
    customer_id: str | None = None
    sales: dict | None = None
    box: dict | None = None
    printing: dict | None = None
    conversion: dict | None = None
    quality: dict | None = None
    commercial: dict | None = None
    declaration: dict | None = None
    documents: list | None = None


class AssignBody(BaseModel):
    employee_id: str
    reason: str | None = None


class ApproveBody(BaseModel):
    note: str | None = None


class SendBackBody(BaseModel):
    reason: str
    note: str


class PlanBody(BaseModel):
    planned_start: str | None = None
    planned_completion: str | None = None
    machine: str | None = None
    responsible: str | None = None


class ProductionUpdateBody(BaseModel):
    current_process: str | None = None
    produced_qty: float | None = None
    rejected_qty: float | None = None
    note: str | None = None
    expected_completion: str | None = None
    move_to: str | None = None  # IN_PRODUCTION | QC


class QCBody(BaseModel):
    inspected_qty: float
    passed_qty: float
    rejected_qty: float = 0
    dimension_ok: bool = True
    printing_ok: bool = True
    finishing_ok: bool = True
    result: str  # Pass | Fail
    notes: str | None = None
    documents: list = []


class DispatchBody(BaseModel):
    quantity: float
    transporter: str | None = None
    vehicle: str | None = None
    delivery_location: str | None = None
    challan_no: str | None = None
    responsible: str | None = None
    notes: str | None = None
    documents: list = []


class BillingBody(BaseModel):
    invoice_number: str
    invoice_date: str | None = None
    taxable_value: float
    gst_rate: float = 0
    payment_terms: str | None = None
    due_date: str | None = None
    invoice_document: dict | None = None
    payment_status: str = "Unpaid"
    notes: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _money(v) -> float:
    try:
        return float(Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    except Exception:
        return 0.0


def _num(v, default=0):
    try:
        return float(v)
    except Exception:
        return default


def _compute_commercial(order):
    comm = dict(order.get("commercial") or {})
    rate = _num(comm.get("rate_per_piece"), 0)
    qty = _num((order.get("box") or {}).get("quantity"), 0)
    gst = _num(comm.get("gst_percent"), 0)
    subtotal = _money(rate * qty)
    gst_amount = _money(subtotal * gst / 100)
    comm["subtotal"] = subtotal
    comm["gst_amount"] = gst_amount
    comm["grand_total"] = _money(subtotal + gst_amount)
    return comm


def _validate_submit(order) -> list[str]:
    missing = []
    sales, box = order.get("sales") or {}, order.get("box") or {}
    printing = order.get("printing") or {}
    conversion = order.get("conversion") or {}
    commercial = order.get("commercial") or {}
    decl = order.get("declaration") or {}

    if not order.get("assigned_to") and not sales.get("assigned_to"):
        missing.append("Responsible salesperson")
    for f, label in [("customer_name", "Customer name"), ("po_number", "PO number"),
                     ("po_date", "PO date"), ("delivery_date", "Required delivery date"),
                     ("delivery_location", "Delivery location")]:
        if not sales.get(f):
            missing.append(label)
    for f, label in [("product_name", "Product/box name"), ("box_type", "Box type"),
                     ("length", "Length"), ("width", "Width"), ("height", "Height"),
                     ("quantity", "Quantity"), ("ply", "Ply"), ("board_spec", "Board specification"),
                     ("paper_gsm_bf", "Paper GSM/BF")]:
        if box.get(f) in (None, "", 0):
            missing.append(label)
    if printing.get("required") == "Yes":
        if not printing.get("process"):
            missing.append("Printing process")
        arts = [d for d in (order.get("documents") or []) if d.get("category") == "Printing Artwork"]
        if not arts:
            missing.append("Printing artwork upload")
    processes = conversion.get("processes") or []
    if not processes:
        missing.append("At least one conversion/finishing process")
    if conversion.get("die_requirement") == "Existing Die" and not conversion.get("die_number"):
        missing.append("Die number (Existing Die selected)")
    if commercial.get("rate_per_piece") in (None, "", 0):
        missing.append("Rate per piece")
    po_docs = [d for d in (order.get("documents") or []) if d.get("category") == "PO Copy"]
    if not po_docs:
        missing.append("PO copy document")
    required_decls = [
        "po_checked", "size_ok", "quantity_ok", "spec_ok", "printing_ok",
        "processes_ok", "artwork_attached", "delivery_confirmed", "instructions_ok",
    ]
    if not all(decl.get(k) for k in required_decls):
        missing.append("All sales declaration confirmations")
    return missing


def _scope_query(user):
    role, uid = user["role"], str(user["_id"])
    if role in ("Admin", "Manager"):
        return {}
    if role == "Employee":
        return {"$or": [{"creator_id": uid}, {"assigned_to": uid}]}
    if role == "Customer":
        return {"customer_id": uid}
    if role == "Vendor":
        return {"source": "Vendor Portal", "creator_id": uid}
    return {"_id": None}


def _sanitize_external(order):
    o = clean(order)
    o.pop("commercial", None)
    o.pop("billing", None)
    o["production_updates"] = []
    return o


async def _load(oid_str, user, require_visible=True):
    order = await db.orders.find_one({"_id": oid(oid_str)})
    if not order:
        raise HTTPException(404, "Order not found")
    if require_visible:
        role, uid = user["role"], str(user["_id"])
        if role in ("Customer", "Vendor"):
            if order.get("customer_id") != uid and order.get("creator_id") != uid:
                raise HTTPException(403, "Not permitted")
    return order


# ---------------------------------------------------------------------------
# CRUD + list
# ---------------------------------------------------------------------------
@router.get("")
async def list_orders(
    status: str | None = None,
    assigned_to: str | None = None,
    priority: str | None = None,
    q: str | None = None,
    skip: int = 0,
    limit: int = Query(50, le=200),
    user=Depends(get_current_user),
):
    query = _scope_query(user)
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to"] = assigned_to
    if priority:
        query["priority"] = priority
    if q:
        query["$or"] = [
            {"job_number": {"$regex": q, "$options": "i"}},
            {"sales.customer_name": {"$regex": q, "$options": "i"}},
            {"box.product_name": {"$regex": q, "$options": "i"}},
        ]
    total = await db.orders.count_documents(query)
    docs = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    external = user["role"] in ("Customer", "Vendor")
    items = [_sanitize_external(d) if external else clean(d) for d in docs]
    return {"total": total, "items": items}


@router.post("")
async def create_order(body: OrderCreate, user=Depends(get_current_user)):
    if user["role"] not in ("Admin", "Manager", "Employee"):
        raise HTTPException(403, "Only internal staff create orders")
    if user["role"] == "Manager" and not has_perm(user, "create_edit_orders"):
        raise HTTPException(403, "Missing permission: create_edit_orders")
    order = {
        "job_number": None,
        "status": "DRAFT",
        "revision": 1,
        "priority": body.priority,
        "source": body.source,
        "creator_id": str(user["_id"]),
        "creator_name": user.get("name"),
        "assigned_to": body.assigned_to,
        "customer_id": body.customer_id,
        "request_id": None,
        "sales": body.sales,
        "box": body.box,
        "printing": body.printing,
        "conversion": body.conversion,
        "quality": body.quality,
        "commercial": body.commercial,
        "declaration": body.declaration,
        "documents": body.documents,
        "production": {},
        "production_updates": [],
        "qc_inspections": [],
        "dispatches": [],
        "billing": [],
        "approved_snapshot": None,
        "qty_ordered": _num(body.box.get("quantity"), 0),
        "qc_released_qty": 0,
        "dispatched_qty": 0,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    order["commercial"] = _compute_commercial(order)
    res = await db.orders.insert_one(order)
    order["_id"] = res.inserted_id
    await log_activity(res.inserted_id, user, "Order created")
    return clean(order)


@router.get("/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user)):
    order = await _load(order_id, user)
    if user["role"] in ("Customer", "Vendor"):
        return _sanitize_external(order)
    return clean(order)


@router.patch("/{order_id}")
async def update_order(order_id: str, body: OrderUpdate, user=Depends(get_current_user)):
    order = await _load(order_id, user, require_visible=False)
    uid = str(user["_id"])
    is_owner = order.get("creator_id") == uid or order.get("assigned_to") == uid
    can_edit = user["role"] == "Admin" or (user["role"] in ("Manager", "Employee") and (has_perm(user, "create_edit_orders") or is_owner))
    if not can_edit:
        raise HTTPException(403, "Not permitted to edit this order")
    if order["status"] not in ("DRAFT", "CORRECTION_REQUIRED"):
        raise HTTPException(409, "Only draft or correction-required orders can be edited. Create a revision instead.")
    updates = {"updated_at": now_utc()}
    for field in ("priority", "assigned_to", "customer_id", "sales", "box", "printing",
                  "conversion", "quality", "commercial", "declaration", "documents"):
        val = getattr(body, field)
        if val is not None:
            updates[field] = val
    merged = {**order, **updates}
    updates["commercial"] = _compute_commercial(merged)
    updates["qty_ordered"] = _num((merged.get("box") or {}).get("quantity"), 0)
    await db.orders.update_one({"_id": order["_id"]}, {"$set": updates})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


@router.post("/{order_id}/submit")
async def submit_order(order_id: str, user=Depends(get_current_user)):
    order = await _load(order_id, user, require_visible=False)
    uid = str(user["_id"])
    is_owner = order.get("creator_id") == uid or order.get("assigned_to") == uid
    if not (user["role"] == "Admin" or has_perm(user, "create_edit_orders") or is_owner):
        raise HTTPException(403, "Not permitted")
    if order["status"] not in ("DRAFT", "CORRECTION_REQUIRED"):
        raise HTTPException(409, "Order already submitted")
    missing = _validate_submit(order)
    if missing:
        raise HTTPException(422, detail={"message": "Please complete required fields", "missing": missing})
    job_number = order.get("job_number") or await next_sequence("PPC")
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"job_number": job_number, "status": "UNDER_CHECKING", "correction_reason": None,
                  "correction_note": None, "updated_at": now_utc()}},
    )
    await log_activity(order["_id"], user, "Submitted for checking",
                       changes={"status": {"from": order["status"], "to": "UNDER_CHECKING"}})
    checkers = await db.users.find({"role": {"$in": ["Admin", "Manager"]}, "active": True}).to_list(200)
    await notify([str(c["_id"]) for c in checkers], "order_submitted",
                 "Order awaiting checking", f"{job_number} needs review", {"order_id": order_id})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


@router.post("/{order_id}/assign")
async def assign_order(order_id: str, body: AssignBody, user=Depends(get_current_user)):
    if user["role"] != "Admin" and not has_perm(user, "assign_responsibility"):
        raise HTTPException(403, "Missing permission: assign_responsibility")
    order = await _load(order_id, user, require_visible=False)
    prev = order.get("assigned_to")
    if prev and prev != body.employee_id and not body.reason:
        raise HTTPException(400, "A reason is required to reassign responsibility")
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {"assigned_to": body.employee_id, "updated_at": now_utc()}})
    await log_activity(order["_id"], user, "Responsibility assigned",
                       changes={"assigned_to": {"from": prev, "to": body.employee_id}}, reason=body.reason)
    await notify([body.employee_id], "order_assigned", "Order assigned to you",
                 order.get("job_number") or "New order", {"order_id": order_id})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


# ---------------------------------------------------------------------------
# Approval workflow
# ---------------------------------------------------------------------------
@router.post("/{order_id}/approve")
async def approve_order(order_id: str, body: ApproveBody, user=Depends(get_current_user)):
    if user["role"] != "Admin" and not has_perm(user, "check_approve_return"):
        raise HTTPException(403, "Missing permission: check_approve_return")
    order = await _load(order_id, user, require_visible=False)
    if order["status"] != "UNDER_CHECKING":
        raise HTTPException(409, "Only orders under checking can be approved")
    if order.get("creator_id") == str(user["_id"]):
        raise HTTPException(403, "You cannot approve an order you created")
    missing = _validate_submit(order)
    if missing:
        raise HTTPException(422, detail={"message": "Mandatory items missing", "missing": missing})
    if (order.get("printing") or {}).get("required") == "Yes" and (order.get("printing") or {}).get("artwork_approval") != "Yes":
        raise HTTPException(422, detail={"message": "Artwork approval must be recorded before approving a printed job"})
    snapshot = {
        "sales": order.get("sales"), "box": order.get("box"), "printing": order.get("printing"),
        "conversion": order.get("conversion"), "quality": order.get("quality"),
        "documents": order.get("documents"), "revision": order.get("revision", 1),
        "approved_by": str(user["_id"]), "approved_by_name": user.get("name"), "approved_at": now_utc(),
    }
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"status": "APPROVED", "approved_snapshot": snapshot, "checker_id": str(user["_id"]),
                  "checked_at": now_utc(), "updated_at": now_utc()}},
    )
    await log_activity(order["_id"], user, "Order approved", note=body.note,
                       changes={"status": {"from": "UNDER_CHECKING", "to": "APPROVED"}})
    await notify([order.get("assigned_to"), order.get("creator_id")], "order_approved",
                 "Order approved", f"{order.get('job_number')} approved", {"order_id": order_id})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


@router.post("/{order_id}/send-back")
async def send_back(order_id: str, body: SendBackBody, user=Depends(get_current_user)):
    if user["role"] != "Admin" and not has_perm(user, "check_approve_return"):
        raise HTTPException(403, "Missing permission: check_approve_return")
    if body.reason not in SEND_BACK_REASONS:
        raise HTTPException(400, "Invalid reason")
    if not body.note:
        raise HTTPException(400, "An explanatory note is required")
    order = await _load(order_id, user, require_visible=False)
    if order["status"] != "UNDER_CHECKING":
        raise HTTPException(409, "Only orders under checking can be returned")
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"status": "CORRECTION_REQUIRED", "correction_reason": body.reason,
                  "correction_note": body.note, "updated_at": now_utc()}},
    )
    await log_activity(order["_id"], user, "Order returned for correction", reason=body.reason, note=body.note,
                       changes={"status": {"from": "UNDER_CHECKING", "to": "CORRECTION_REQUIRED"}})
    await notify([order.get("assigned_to"), order.get("creator_id")], "order_returned",
                 "Order returned for correction", f"{order.get('job_number')}: {body.reason}", {"order_id": order_id})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


@router.post("/{order_id}/revision")
async def create_revision(order_id: str, user=Depends(get_current_user)):
    if user["role"] != "Admin" and not has_perm(user, "create_edit_orders"):
        raise HTTPException(403, "Not permitted")
    order = await _load(order_id, user, require_visible=False)
    if order["status"] in ("DRAFT", "UNDER_CHECKING", "CORRECTION_REQUIRED"):
        raise HTTPException(409, "Order is not in an approved state")
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"status": "CORRECTION_REQUIRED", "revision": order.get("revision", 1) + 1,
                  "correction_reason": "Revision", "correction_note": "New revision opened for edits",
                  "updated_at": now_utc()}},
    )
    await log_activity(order["_id"], user, "Revision opened",
                       changes={"revision": {"from": order.get("revision", 1), "to": order.get("revision", 1) + 1}})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


# ---------------------------------------------------------------------------
# Production
# ---------------------------------------------------------------------------
@router.post("/{order_id}/production/plan")
async def production_plan(order_id: str, body: PlanBody, user=Depends(get_current_user)):
    if user["role"] != "Admin" and not has_perm(user, "update_production"):
        raise HTTPException(403, "Missing permission: update_production")
    order = await _load(order_id, user, require_visible=False)
    if order["status"] not in ("APPROVED", "PRODUCTION_PLANNING"):
        raise HTTPException(409, "Order must be approved before production planning")
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"status": "PRODUCTION_PLANNING", "production": body.dict(), "updated_at": now_utc()}},
    )
    await log_activity(order["_id"], user, "Production planned", changes={"production": body.dict()})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


@router.post("/{order_id}/production/update")
async def production_update(order_id: str, body: ProductionUpdateBody, user=Depends(get_current_user)):
    if user["role"] != "Admin" and not has_perm(user, "update_production"):
        raise HTTPException(403, "Missing permission: update_production")
    order = await _load(order_id, user, require_visible=False)
    if order["status"] not in ("PRODUCTION_PLANNING", "IN_PRODUCTION"):
        raise HTTPException(409, "Production updates require a planned/in-production job")
    entry = {**body.dict(), "by": user.get("name"), "at": now_utc()}
    new_status = order["status"]
    if body.move_to == "IN_PRODUCTION" and order["status"] == "PRODUCTION_PLANNING":
        new_status = "IN_PRODUCTION"
    elif body.move_to == "QC" and order["status"] == "IN_PRODUCTION":
        new_status = "QC"
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$push": {"production_updates": entry}, "$set": {"status": new_status, "updated_at": now_utc()}},
    )
    await log_activity(order["_id"], user, "Production update", changes={"status": new_status})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


# ---------------------------------------------------------------------------
# QC
# ---------------------------------------------------------------------------
@router.post("/{order_id}/qc")
async def qc_inspect(order_id: str, body: QCBody, user=Depends(get_current_user)):
    if user["role"] != "Admin" and not has_perm(user, "qc_updates"):
        raise HTTPException(403, "Missing permission: qc_updates")
    order = await _load(order_id, user, require_visible=False)
    if order["status"] not in ("IN_PRODUCTION", "QC", "READY_FOR_DISPATCH"):
        raise HTTPException(409, "QC applies to jobs in production or QC")
    entry = {
        **body.dict(),
        "inspector": user.get("name"), "inspector_id": str(user["_id"]), "at": now_utc(),
        "attempt": len(order.get("qc_inspections", [])) + 1,
    }
    released = order.get("qc_released_qty", 0)
    new_status = order["status"]
    if body.result == "Pass":
        released += _num(body.passed_qty)
        if new_status in ("IN_PRODUCTION", "QC"):
            new_status = "READY_FOR_DISPATCH"
    else:
        new_status = "QC"
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$push": {"qc_inspections": entry},
         "$set": {"qc_released_qty": released, "status": new_status, "updated_at": now_utc()}},
    )
    await log_activity(order["_id"], user, f"QC inspection: {body.result}",
                       changes={"passed_qty": body.passed_qty, "status": new_status})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
@router.post("/{order_id}/dispatch")
async def add_dispatch(order_id: str, body: DispatchBody, user=Depends(get_current_user)):
    if user["role"] != "Admin" and not has_perm(user, "record_dispatch"):
        raise HTTPException(403, "Missing permission: record_dispatch")
    order = await _load(order_id, user, require_visible=False)
    if order["status"] not in ("READY_FOR_DISPATCH", "DISPATCHED"):
        raise HTTPException(409, "Job must be QC-passed and ready for dispatch")
    released = order.get("qc_released_qty", 0)
    already = order.get("dispatched_qty", 0)
    available = released - already
    if _num(body.quantity) <= 0:
        raise HTTPException(400, "Dispatch quantity must be positive")
    if _num(body.quantity) > available:
        raise HTTPException(422, f"Only {available} units are QC-released and available to dispatch")
    entry = {**body.dict(), "by": user.get("name"), "at": now_utc(),
             "reference": await next_sequence("DSP")}
    new_dispatched = already + _num(body.quantity)
    new_status = "DISPATCHED" if new_dispatched >= order.get("qty_ordered", 0) and order.get("qty_ordered", 0) > 0 else "READY_FOR_DISPATCH"
    if new_dispatched >= released and new_status == "READY_FOR_DISPATCH" and new_dispatched > 0:
        new_status = "READY_FOR_DISPATCH"
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$push": {"dispatches": entry},
         "$set": {"dispatched_qty": new_dispatched, "status": new_status, "updated_at": now_utc()}},
    )
    await log_activity(order["_id"], user, "Dispatch recorded",
                       changes={"quantity": body.quantity, "dispatched_total": new_dispatched, "status": new_status})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


# ---------------------------------------------------------------------------
# Billing + close
# ---------------------------------------------------------------------------
@router.post("/{order_id}/billing")
async def add_billing(order_id: str, body: BillingBody, user=Depends(get_current_user)):
    if user["role"] != "Admin" and not has_perm(user, "record_billing"):
        raise HTTPException(403, "Missing permission: record_billing")
    order = await _load(order_id, user, require_visible=False)
    if order["status"] not in ("DISPATCHED", "BILLED"):
        raise HTTPException(409, "Billing requires a dispatched job")
    gst_amount = _money(_num(body.taxable_value) * _num(body.gst_rate) / 100)
    entry = {
        **body.dict(),
        "gst_amount": gst_amount,
        "grand_total": _money(_num(body.taxable_value) + gst_amount),
        "by": user.get("name"), "at": now_utc(),
    }
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$push": {"billing": entry}, "$set": {"status": "BILLED", "updated_at": now_utc()}},
    )
    await log_activity(order["_id"], user, "Invoice recorded", changes={"invoice_number": body.invoice_number})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


@router.post("/{order_id}/close")
async def close_order(order_id: str, user=Depends(get_current_user)):
    if user["role"] not in ("Admin", "Manager"):
        raise HTTPException(403, "Not permitted")
    order = await _load(order_id, user, require_visible=False)
    if order["status"] != "BILLED":
        raise HTTPException(409, "Only billed jobs can be closed")
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "CLOSED", "updated_at": now_utc()}})
    await log_activity(order["_id"], user, "Job closed", changes={"status": {"from": "BILLED", "to": "CLOSED"}})
    return clean(await db.orders.find_one({"_id": order["_id"]}))


@router.get("/{order_id}/activity")
async def order_activity(order_id: str, user=Depends(get_current_user)):
    await _load(order_id, user)
    q = {"order_id": order_id}
    if user["role"] in ("Customer", "Vendor"):
        q["internal"] = False
    entries = await db.activity.find(q).sort("created_at", -1).to_list(500)
    return [clean(e) for e in entries]
