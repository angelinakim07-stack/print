"""Follow-up desk: schedule, complete (with outcome), reschedule (with reason)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import clean, db, now_utc, oid
from deps import get_current_user
from services import notify

router = APIRouter()


class FollowupBody(BaseModel):
    order_id: str | None = None
    request_id: str | None = None
    title: str
    assigned_to: str | None = None
    due_at: str
    method: str = "Call"
    notes: str | None = None


class CompleteBody(BaseModel):
    outcome: str
    next_due_at: str | None = None
    next_title: str | None = None


class RescheduleBody(BaseModel):
    due_at: str
    reason: str


def _parse(dt: str) -> datetime:
    try:
        return datetime.fromisoformat(dt.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(400, "Invalid date/time")


@router.get("")
async def list_followups(bucket: str | None = None, user=Depends(get_current_user)):
    q = {}
    if user["role"] not in ("Admin", "Manager"):
        q["assigned_to"] = str(user["_id"])
    now = now_utc()
    if bucket == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        q["status"] = "Open"
        q["due_at"] = {"$gte": start, "$lt": end}
    elif bucket == "upcoming":
        q["status"] = "Open"
        q["due_at"] = {"$gte": now + timedelta(days=1)}
    elif bucket == "overdue":
        q["status"] = "Open"
        q["due_at"] = {"$lt": now}
    elif bucket == "completed":
        q["status"] = "Completed"
    items = await db.followups.find(q).sort("due_at", 1).to_list(500)
    return [clean(i) for i in items]


@router.post("")
async def create_followup(body: FollowupBody, user=Depends(get_current_user)):
    doc = {
        **body.dict(),
        "due_at": _parse(body.due_at),
        "assigned_to": body.assigned_to or str(user["_id"]),
        "status": "Open",
        "created_by": str(user["_id"]),
        "created_at": now_utc(),
    }
    res = await db.followups.insert_one(doc)
    doc["_id"] = res.inserted_id
    if doc["assigned_to"] != str(user["_id"]):
        await notify([doc["assigned_to"]], "followup_assigned", "Follow-up assigned", body.title,
                     {"followup_id": str(res.inserted_id)})
    return clean(doc)


@router.post("/{fid}/complete")
async def complete_followup(fid: str, body: CompleteBody, user=Depends(get_current_user)):
    fu = await db.followups.find_one({"_id": oid(fid)})
    if not fu:
        raise HTTPException(404, "Follow-up not found")
    if not body.outcome:
        raise HTTPException(400, "An outcome is required to complete a follow-up")
    await db.followups.update_one(
        {"_id": oid(fid)},
        {"$set": {"status": "Completed", "outcome": body.outcome, "completed_at": now_utc(),
                  "completed_by": str(user["_id"])}},
    )
    created = None
    if body.next_due_at:
        nxt = {
            "order_id": fu.get("order_id"), "request_id": fu.get("request_id"),
            "title": body.next_title or fu["title"], "assigned_to": fu.get("assigned_to"),
            "due_at": _parse(body.next_due_at), "method": fu.get("method", "Call"),
            "status": "Open", "created_by": str(user["_id"]), "created_at": now_utc(),
            "previous_followup": fid,
        }
        r = await db.followups.insert_one(nxt)
        created = str(r.inserted_id)
    return {"ok": True, "next_followup_id": created}


@router.post("/{fid}/reschedule")
async def reschedule_followup(fid: str, body: RescheduleBody, user=Depends(get_current_user)):
    fu = await db.followups.find_one({"_id": oid(fid)})
    if not fu:
        raise HTTPException(404, "Follow-up not found")
    if not body.reason:
        raise HTTPException(400, "A reason is required to reschedule")
    history = fu.get("reschedule_history", [])
    history.append({"previous_due_at": fu.get("due_at"), "reason": body.reason, "at": now_utc()})
    await db.followups.update_one(
        {"_id": oid(fid)},
        {"$set": {"due_at": _parse(body.due_at), "reschedule_history": history}},
    )
    return clean(await db.followups.find_one({"_id": oid(fid)}))
