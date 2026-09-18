"""Dashboards, reports and CSV export (authorization-scoped)."""
import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from db import clean, db, now_utc, oid
from deps import get_current_user, get_current_user_optional, has_perm
from security import decode_access_token

router = APIRouter()

ACTIVE_STATUSES = ["NEW", "UNDER_CHECKING", "CORRECTION_REQUIRED", "APPROVED",
                   "PRODUCTION_PLANNING", "IN_PRODUCTION", "QC", "READY_FOR_DISPATCH", "DISPATCHED"]


def _scope(user):
    role, uid = user["role"], str(user["_id"])
    if role in ("Admin", "Manager"):
        return {}
    if role == "Employee":
        return {"$or": [{"creator_id": uid}, {"assigned_to": uid}]}
    if role == "Customer":
        return {"customer_id": uid}
    return {"creator_id": uid}


@router.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    base = _scope(user)
    now = now_utc()

    async def count(extra):
        return await db.orders.count_documents({**base, **extra})

    tiles = {
        "active_jobs": await count({"status": {"$in": ACTIVE_STATUSES}}),
        "awaiting_approval": await count({"status": "UNDER_CHECKING"}),
        "corrections_pending": await count({"status": "CORRECTION_REQUIRED"}),
        "in_production": await count({"status": {"$in": ["PRODUCTION_PLANNING", "IN_PRODUCTION"]}}),
        "qc_pending": await count({"status": "QC"}),
        "ready_for_dispatch": await count({"status": "READY_FOR_DISPATCH"}),
        "billing_pending": await count({"status": "DISPATCHED"}),
        "closed": await count({"status": "CLOSED"}),
    }
    # delayed = active with a past delivery date
    delayed = await db.orders.count_documents({
        **base, "status": {"$in": ACTIVE_STATUSES},
        "sales.delivery_date": {"$lt": now.strftime("%Y-%m-%d")},
    })
    tiles["delayed_jobs"] = delayed

    fu_scope = {} if user["role"] in ("Admin", "Manager") else {"assigned_to": str(user["_id"])}
    tiles["followups_due"] = await db.followups.count_documents({
        **fu_scope, "status": "Open",
        "due_at": {"$gte": now.replace(hour=0, minute=0, second=0, microsecond=0),
                   "$lt": now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)},
    })
    tiles["followups_overdue"] = await db.followups.count_documents({**fu_scope, "status": "Open", "due_at": {"$lt": now}})

    if user["role"] in ("Customer", "Vendor"):
        tiles = {"my_requests": await db.requests.count_documents({"submitted_by": str(user["_id"])}),
                 "my_orders": await db.orders.count_documents(base),
                 "in_production": tiles["in_production"], "ready_for_dispatch": tiles["ready_for_dispatch"]}

    recent = await db.orders.find(base).sort("updated_at", -1).limit(8).to_list(8)
    workload = []
    if user["role"] in ("Admin", "Manager"):
        pipeline = [{"$match": {"status": {"$in": ACTIVE_STATUSES}}},
                    {"$group": {"_id": "$assigned_to", "count": {"$sum": 1}}}]
        agg = await db.orders.aggregate(pipeline).to_list(100)
        for row in agg:
            if not row["_id"]:
                continue
            emp = await db.users.find_one({"_id": __import__("bson").ObjectId(row["_id"])}) if len(str(row["_id"])) == 24 else None
            workload.append({"employee": emp.get("name") if emp else "Unassigned", "count": row["count"]})
    return {"tiles": tiles, "recent": [_recent_card(r) for r in recent], "workload": workload,
            "updated_at": now.isoformat()}


def _recent_card(o):
    return {
        "id": str(o["_id"]),
        "job_number": o.get("job_number"),
        "status": o.get("status"),
        "priority": o.get("priority"),
        "customer_name": (o.get("sales") or {}).get("customer_name"),
        "product_name": (o.get("box") or {}).get("product_name"),
        "updated_at": o.get("updated_at").isoformat() if o.get("updated_at") else None,
    }


REPORT_QUERIES = {
    "pending": {"status": {"$in": ["NEW", "UNDER_CHECKING", "CORRECTION_REQUIRED", "APPROVED"]}},
    "production": {"status": {"$in": ["PRODUCTION_PLANNING", "IN_PRODUCTION"]}},
    "qc": {"status": "QC"},
    "dispatch": {"status": {"$in": ["READY_FOR_DISPATCH", "DISPATCHED"]}},
    "billing": {"status": {"$in": ["DISPATCHED", "BILLED"]}},
}


@router.get("/{report_type}")
async def report(report_type: str, user=Depends(get_current_user)):
    base = _scope(user)
    now = now_utc()
    if report_type == "delayed":
        query = {**base, "status": {"$in": ACTIVE_STATUSES}, "sales.delivery_date": {"$lt": now.strftime("%Y-%m-%d")}}
    elif report_type in REPORT_QUERIES:
        query = {**base, **REPORT_QUERIES[report_type]}
    else:
        raise HTTPException(404, "Unknown report type")
    docs = await db.orders.find(query).sort("updated_at", -1).limit(500).to_list(500)
    return {"type": report_type, "items": [_recent_card(d) for d in docs], "count": len(docs)}


@router.get("/export/csv")
async def export_csv(report_type: str = "pending", token: str | None = Query(None), user=Depends(get_current_user_optional)):
    if user is None and token:
        try:
            payload = decode_access_token(token)
            user = await db.users.find_one({"_id": oid(payload["sub"])})
        except Exception:
            user = None
    if user is None or not user.get("active", False):
        raise HTTPException(401, "Authentication required")
    if user["role"] not in ("Admin", "Manager") and not has_perm(user, "export_reports"):
        raise HTTPException(403, "Missing permission: export_reports")
    base = _scope(user)
    now = now_utc()
    if report_type == "delayed":
        query = {**base, "status": {"$in": ACTIVE_STATUSES}, "sales.delivery_date": {"$lt": now.strftime("%Y-%m-%d")}}
    else:
        query = {**base, **REPORT_QUERIES.get(report_type, {})}
    docs = await db.orders.find(query).sort("updated_at", -1).limit(2000).to_list(2000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Job Number", "Status", "Priority", "Customer", "Product", "Quantity", "Delivery Date"])
    for o in docs:
        writer.writerow([
            o.get("job_number"), o.get("status"), o.get("priority"),
            (o.get("sales") or {}).get("customer_name"), (o.get("box") or {}).get("product_name"),
            (o.get("box") or {}).get("quantity"), (o.get("sales") or {}).get("delivery_date"),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{report_type}-report.csv"'},
    )
