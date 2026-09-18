"""External request intake (Customer / Vendor portal) and internal triage."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import clean, db, next_sequence, now_utc, oid
from deps import get_current_user, has_perm, require_roles
from services import notify

router = APIRouter()


class RequestBody(BaseModel):
    business_name: str
    contact_person: str | None = None
    mobile: str | None = None
    email: str | None = None
    requirement: str
    quantity: str | None = None
    delivery_date: str | None = None
    delivery_location: str | None = None
    po_number: str | None = None
    special_instructions: str | None = None
    documents: list[dict] = []


class TriageBody(BaseModel):
    employee_id: str | None = None
    note: str | None = None
    reason: str | None = None


async def _admins_and_managers():
    users = await db.users.find({"role": {"$in": ["Admin", "Manager"]}, "active": True}).to_list(200)
    return [str(u["_id"]) for u in users]


@router.get("")
async def list_requests(status: str | None = None, user=Depends(get_current_user)):
    q = {}
    if status:
        q["status"] = status
    if user["role"] in ("Customer", "Vendor"):
        q["submitted_by"] = str(user["_id"])
    elif user["role"] not in ("Admin", "Manager", "Employee"):
        raise HTTPException(403, "Not permitted")
    reqs = await db.requests.find(q).sort("created_at", -1).to_list(500)
    return [clean(r) for r in reqs]


@router.post("")
async def create_request(body: RequestBody, user=Depends(get_current_user)):
    if user["role"] not in ("Customer", "Vendor", "Admin", "Manager"):
        raise HTTPException(403, "Only customers and vendors submit requests")
    reference = await next_sequence("REQ")
    doc = {
        "reference": reference,
        "status": "NEW",
        "source": user["role"],
        "submitted_by": str(user["_id"]),
        "submitted_by_name": user.get("name"),
        **body.dict(),
        "assigned_to": None,
        "linked_order_id": None,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    res = await db.requests.insert_one(doc)
    doc["_id"] = res.inserted_id
    await notify(
        await _admins_and_managers(),
        "request_new",
        "New incoming request",
        f"{reference} from {body.business_name}",
        {"request_id": str(res.inserted_id)},
    )
    return clean(doc)


@router.get("/{rid}")
async def get_request(rid: str, user=Depends(get_current_user)):
    req = await db.requests.find_one({"_id": oid(rid)})
    if not req:
        raise HTTPException(404, "Request not found")
    if user["role"] in ("Customer", "Vendor") and req.get("submitted_by") != str(user["_id"]):
        raise HTTPException(403, "Not permitted")
    return clean(req)


def _can_triage(user):
    return user["role"] == "Admin" or (user["role"] == "Manager") or has_perm(user, "assign_responsibility")


@router.post("/{rid}/assign")
async def assign_request(rid: str, body: TriageBody, user=Depends(get_current_user)):
    if not _can_triage(user):
        raise HTTPException(403, "Not permitted")
    if not body.employee_id:
        raise HTTPException(400, "employee_id required")
    await db.requests.update_one(
        {"_id": oid(rid)},
        {"$set": {"assigned_to": body.employee_id, "status": "ASSIGNED", "updated_at": now_utc()}},
    )
    await notify([body.employee_id], "request_assigned", "Request assigned to you", f"Request {rid}", {"request_id": rid})
    return clean(await db.requests.find_one({"_id": oid(rid)}))


@router.post("/{rid}/clarify")
async def clarify_request(rid: str, body: TriageBody, user=Depends(get_current_user)):
    if not _can_triage(user):
        raise HTTPException(403, "Not permitted")
    req = await db.requests.find_one({"_id": oid(rid)})
    if not req:
        raise HTTPException(404, "Request not found")
    await db.requests.update_one(
        {"_id": oid(rid)}, {"$set": {"status": "CLARIFICATION", "clarification_note": body.note, "updated_at": now_utc()}}
    )
    await notify([req["submitted_by"]], "request_clarify", "Clarification requested", body.note or "", {"request_id": rid})
    return clean(await db.requests.find_one({"_id": oid(rid)}))


@router.post("/{rid}/reject")
async def reject_request(rid: str, body: TriageBody, user=Depends(get_current_user)):
    if not _can_triage(user):
        raise HTTPException(403, "Not permitted")
    if not body.reason:
        raise HTTPException(400, "A rejection reason is required")
    req = await db.requests.find_one({"_id": oid(rid)})
    if not req:
        raise HTTPException(404, "Request not found")
    await db.requests.update_one(
        {"_id": oid(rid)}, {"$set": {"status": "REJECTED", "rejection_reason": body.reason, "updated_at": now_utc()}}
    )
    await notify([req["submitted_by"]], "request_rejected", "Request update", "Your request could not be processed.", {"request_id": rid})
    return clean(await db.requests.find_one({"_id": oid(rid)}))


@router.post("/{rid}/convert")
async def convert_request(rid: str, body: TriageBody, user=Depends(get_current_user)):
    if not _can_triage(user):
        raise HTTPException(403, "Not permitted")
    req = await db.requests.find_one({"_id": oid(rid)})
    if not req:
        raise HTTPException(404, "Request not found")
    if req.get("linked_order_id"):
        raise HTTPException(409, "Request already converted to an order")
    order = {
        "job_number": None,
        "status": "DRAFT",
        "revision": 1,
        "priority": "Normal",
        "source": "Customer Portal" if req["source"] == "Customer" else "Vendor Portal",
        "creator_id": str(user["_id"]),
        "creator_name": user.get("name"),
        "assigned_to": body.employee_id or req.get("assigned_to"),
        "customer_id": req["submitted_by"] if req["source"] == "Customer" else None,
        "request_id": rid,
        "sales": {
            "customer_name": req.get("business_name"),
            "contact_person": req.get("contact_person"),
            "customer_mobile": req.get("mobile"),
            "customer_email": req.get("email"),
            "po_number": req.get("po_number"),
            "delivery_date": req.get("delivery_date"),
            "delivery_location": req.get("delivery_location"),
            "assigned_to": body.employee_id or req.get("assigned_to"),
        },
        "box": {"product_name": req.get("requirement"), "quantity": req.get("quantity")},
        "printing": {},
        "conversion": {},
        "quality": {},
        "commercial": {},
        "declaration": {},
        "documents": req.get("documents", []),
        "production_updates": [],
        "qc_inspections": [],
        "dispatches": [],
        "billing": [],
        "qty_ordered": 0,
        "qc_released_qty": 0,
        "dispatched_qty": 0,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    res = await db.orders.insert_one(order)
    await db.requests.update_one(
        {"_id": oid(rid)}, {"$set": {"status": "CONVERTED", "linked_order_id": str(res.inserted_id), "updated_at": now_utc()}}
    )
    if order["assigned_to"]:
        await notify([order["assigned_to"]], "order_assigned", "New order draft assigned", "Converted from a request", {"order_id": str(res.inserted_id)})
    return {"order_id": str(res.inserted_id)}
