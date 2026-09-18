"""MongoDB connection, serialization helpers and business-date utilities."""
import os
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pymongo import ReturnDocument

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
fs = AsyncIOMotorGridFSBucket(db)

IST = ZoneInfo("Asia/Kolkata")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ist_datekey() -> str:
    return datetime.now(IST).strftime("%y%m%d")


def clean(doc):
    """Convert a Mongo document into a JSON-safe dict (ObjectId -> str, _id -> id)."""
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    for k, v in list(doc.items()):
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, list):
            doc[k] = [clean(i) if isinstance(i, dict) else (str(i) if isinstance(i, ObjectId) else i) for i in v]
        elif isinstance(v, dict):
            doc[k] = {kk: (str(vv) if isinstance(vv, ObjectId) else vv) for kk, vv in v.items()}
    return doc


def oid(value) -> ObjectId:
    return ObjectId(value)


async def next_sequence(prefix: str) -> str:
    """Atomic per-day sequence, e.g. PPC-260918-001 / REQ-260918-001 (Asia/Kolkata date)."""
    datekey = ist_datekey()
    counter_id = f"{prefix}-{datekey}"
    doc = await db.counters.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"{prefix}-{datekey}-{doc['seq']:03d}"


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.refresh_tokens.create_index("token_hash", unique=True)
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.orders.create_index("job_number")
    await db.orders.create_index("status")
    await db.orders.create_index("creator_id")
    await db.orders.create_index("assigned_to")
    await db.orders.create_index("customer_id")
    await db.requests.create_index("reference")
    await db.followups.create_index("due_at")
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.activity.create_index("order_id")
