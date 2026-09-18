"""In-app notification inbox and device registration."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from db import clean, db, now_utc, oid
from deps import get_current_user

router = APIRouter()


class DeviceBody(BaseModel):
    token: str
    platform: str | None = None


@router.get("")
async def list_notifications(skip: int = 0, limit: int = 50, user=Depends(get_current_user)):
    uid = str(user["_id"])
    items = await db.notifications.find({"user_id": uid}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    unread = await db.notifications.count_documents({"user_id": uid, "read": False})
    return {"unread": unread, "items": [clean(i) for i in items]}


@router.get("/unread-count")
async def unread_count(user=Depends(get_current_user)):
    unread = await db.notifications.count_documents({"user_id": str(user["_id"]), "read": False})
    return {"unread": unread}


@router.post("/{nid}/read")
async def mark_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one(
        {"_id": oid(nid), "user_id": str(user["_id"])}, {"$set": {"read": True}}
    )
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": str(user["_id"]), "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/register-device")
async def register_device(body: DeviceBody, user=Depends(get_current_user)):
    await db.devices.update_one(
        {"token": body.token},
        {"$set": {"user_id": str(user["_id"]), "platform": body.platform, "updated_at": now_utc()}},
        upsert=True,
    )
    return {"ok": True}


@router.post("/unregister-device")
async def unregister_device(body: DeviceBody, user=Depends(get_current_user)):
    await db.devices.delete_one({"token": body.token, "user_id": str(user["_id"])})
    return {"ok": True}
