"""Notification and audit-log services."""
from db import db, now_utc


async def notify(user_ids, ntype: str, title: str, body: str, data=None):
    user_ids = [u for u in {str(x) for x in (user_ids or [])} if u]
    if not user_ids:
        return
    docs = [
        {
            "user_id": uid,
            "type": ntype,
            "title": title,
            "body": body,
            "data": data or {},
            "read": False,
            "created_at": now_utc(),
        }
        for uid in user_ids
    ]
    await db.notifications.insert_many(docs)


async def log_activity(order_id: str, actor, action: str, changes=None, reason=None, note=None, internal=True):
    await db.activity.insert_one(
        {
            "order_id": str(order_id),
            "actor_id": str(actor["_id"]),
            "actor_name": actor.get("name") or actor.get("email"),
            "actor_role": actor.get("role"),
            "action": action,
            "changes": changes or {},
            "reason": reason,
            "note": note,
            "internal": internal,
            "created_at": now_utc(),
        }
    )
