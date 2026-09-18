"""Private document storage backed by GridFS. Files are never publicly served."""
import os

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from db import db, fs, now_utc, oid
from deps import get_current_user, get_current_user_optional
from security import decode_access_token

router = APIRouter()

MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "10"))

CATEGORIES = [
    "PO Copy",
    "Customer Drawing",
    "Printing Artwork",
    "Previous Sample Photo",
    "Quality/Specification",
    "QC Evidence",
    "Dispatch Document",
    "Invoice",
    "Other",
]


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    category: str = Form("Other"),
    order_id: str | None = Form(None),
    request_id: str | None = Form(None),
    user=Depends(get_current_user),
):
    data = await file.read()
    size_mb = len(data) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_MB:
        raise HTTPException(413, f"File exceeds the {MAX_UPLOAD_MB} MB limit")
    if not data:
        raise HTTPException(400, "Empty file")
    # Generated storage name; the original name is metadata only.
    storage_name = f"{now_utc().strftime('%Y%m%d%H%M%S')}-{ObjectId()}"
    file_id = await fs.upload_from_stream(
        storage_name,
        data,
        metadata={
            "original_name": file.filename,
            "content_type": file.content_type,
            "category": category,
            "order_id": order_id,
            "request_id": request_id,
            "uploaded_by": str(user["_id"]),
            "uploaded_by_name": user.get("name"),
            "uploaded_at": now_utc(),
            "size": len(data),
        },
    )
    return {
        "id": str(file_id),
        "original_name": file.filename,
        "content_type": file.content_type,
        "category": category,
        "size": len(data),
    }


async def _authorize_file(meta, user):
    role = user["role"]
    if role in ("Admin", "Manager"):
        return True
    uid = str(user["_id"])
    if meta.get("uploaded_by") == uid:
        return True
    order_id = meta.get("order_id")
    if order_id:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if order and (order.get("creator_id") == uid or order.get("assigned_to") == uid or order.get("customer_id") == uid):
            return True
    req_id = meta.get("request_id")
    if req_id:
        req = await db.requests.find_one({"_id": ObjectId(req_id)})
        if req and req.get("submitted_by") == uid:
            return True
    return False


@router.get("/{file_id}/download")
async def download_file(file_id: str, token: str | None = Query(None), user=Depends(get_current_user_optional)):
    if user is None and token:
        try:
            payload = decode_access_token(token)
            user = await db.users.find_one({"_id": oid(payload["sub"])})
        except Exception:
            user = None
    if user is None or not user.get("active", False):
        raise HTTPException(401, "Authentication required")
    try:
        stream = await fs.open_download_stream(ObjectId(file_id))
    except Exception:
        raise HTTPException(404, "File not found")
    meta = stream.metadata or {}
    if not await _authorize_file(meta, user):
        raise HTTPException(403, "You are not permitted to access this file")
    data = await stream.read()
    content_type = meta.get("content_type") or "application/octet-stream"
    filename = meta.get("original_name") or "download"

    def _iter():
        yield data

    return StreamingResponse(
        _iter(),
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
