"""Background reminder worker.

Generates in-app notifications for follow-ups becoming due, overdue follow-ups,
and overdue delivery commitments. Runs on a periodic asyncio loop so reminders
do not depend on any app being in the foreground. De-duplicated to at most one
reminder per item per day.
"""
import asyncio
import logging
from datetime import timedelta

from db import db, now_utc
from services import notify

logger = logging.getLogger("printpack.scheduler")

INTERVAL_SECONDS = 300  # every 5 minutes
ACTIVE_STATUSES = [
    "NEW", "UNDER_CHECKING", "CORRECTION_REQUIRED", "APPROVED",
    "PRODUCTION_PLANNING", "IN_PRODUCTION", "QC", "READY_FOR_DISPATCH",
]


async def run_reminder_cycle() -> dict:
    now = now_utc()
    today = now.strftime("%Y-%m-%d")
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    counts = {"due": 0, "overdue": 0, "delivery": 0}

    # Follow-ups due today
    due = await db.followups.find(
        {"status": "Open", "due_at": {"$gte": start_of_day, "$lt": end_of_day}}
    ).to_list(2000)
    for f in due:
        if f.get("last_due_reminder") == today or not f.get("assigned_to"):
            continue
        await notify([f["assigned_to"]], "followup_due", "Follow-up due today",
                     f.get("title", "Follow-up"), {"followup_id": str(f["_id"])})
        await db.followups.update_one({"_id": f["_id"]}, {"$set": {"last_due_reminder": today}})
        counts["due"] += 1

    # Overdue follow-ups
    overdue = await db.followups.find(
        {"status": "Open", "due_at": {"$lt": start_of_day}}
    ).to_list(2000)
    for f in overdue:
        if f.get("last_overdue_reminder") == today or not f.get("assigned_to"):
            continue
        await notify([f["assigned_to"]], "followup_overdue", "Overdue follow-up",
                     f.get("title", "Follow-up"), {"followup_id": str(f["_id"])})
        await db.followups.update_one({"_id": f["_id"]}, {"$set": {"last_overdue_reminder": today}})
        counts["overdue"] += 1

    # Overdue delivery commitments
    orders = await db.orders.find(
        {"status": {"$in": ACTIVE_STATUSES}, "sales.delivery_date": {"$lt": today}}
    ).to_list(2000)
    for o in orders:
        if o.get("last_delay_reminder") == today:
            continue
        targets = [o.get("assigned_to"), o.get("creator_id")]
        await notify(targets, "delivery_overdue", "Delivery commitment overdue",
                     f"{o.get('job_number') or 'Order'} · {(o.get('sales') or {}).get('customer_name', '')}",
                     {"order_id": str(o["_id"])})
        await db.orders.update_one({"_id": o["_id"]}, {"$set": {"last_delay_reminder": today}})
        counts["delivery"] += 1

    if any(counts.values()):
        logger.info("Reminder cycle sent %s", counts)
    return counts


async def _loop():
    # small initial delay so the app finishes startup first
    await asyncio.sleep(15)
    while True:
        try:
            await run_reminder_cycle()
        except Exception as e:  # never let the worker die
            logger.warning("Reminder cycle failed: %s", e)
        await asyncio.sleep(INTERVAL_SECONDS)


_task = None


def start_scheduler():
    global _task
    if _task is None:
        _task = asyncio.create_task(_loop())
        logger.info("Reminder scheduler started (every %ss)", INTERVAL_SECONDS)
