"""User & permission management (admin) plus self-service profile endpoints."""
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from db import clean, db, now_utc, oid
from deps import PERMISSIONS, ROLES, get_current_user, require_roles
from security import hash_password, verify_password

router = APIRouter()


class CreateUserBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    permissions: dict | None = None
    phone: str | None = None
    company: str | None = None


class UpdateUserBody(BaseModel):
    name: str | None = None
    phone: str | None = None
    company: str | None = None
    permissions: dict | None = None


class ActiveBody(BaseModel):
    active: bool


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


class ResetPasswordBody(BaseModel):
    new_password: str | None = None


def _out(user):
    u = clean(user)
    u.pop("password_hash", None)
    return u


@router.get("")
async def list_users(role: str | None = None, user=Depends(require_roles("Admin", "Manager"))):
    q = {}
    if role:
        q["role"] = role
    users = await db.users.find(q).sort("created_at", -1).to_list(1000)
    return [_out(u) for u in users]


@router.post("")
async def create_user(body: CreateUserBody, admin=Depends(require_roles("Admin"))):
    if body.role not in ROLES:
        raise HTTPException(400, "Invalid role")
    perms = {}
    if body.role in ("Manager", "Employee") and body.permissions:
        perms = {k: bool(v) for k, v in body.permissions.items() if k in PERMISSIONS}
    doc = {
        "name": body.name.strip(),
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "role": body.role,
        "permissions": perms,
        "phone": body.phone,
        "company": body.company,
        "active": True,
        "created_at": now_utc(),
        "created_by": str(admin["_id"]),
    }
    try:
        res = await db.users.insert_one(doc)
    except Exception:
        raise HTTPException(409, "A user with this email already exists")
    doc["_id"] = res.inserted_id
    return _out(doc)


@router.patch("/{uid}")
async def update_user(uid: str, body: UpdateUserBody, admin=Depends(require_roles("Admin"))):
    updates = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.phone is not None:
        updates["phone"] = body.phone
    if body.company is not None:
        updates["company"] = body.company
    if body.permissions is not None:
        target = await db.users.find_one({"_id": oid(uid)})
        if not target:
            raise HTTPException(404, "User not found")
        if target["role"] not in ("Manager", "Employee"):
            raise HTTPException(400, "Permissions apply to managers and employees only")
        updates["permissions"] = {k: bool(v) for k, v in body.permissions.items() if k in PERMISSIONS}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    await db.users.update_one({"_id": oid(uid)}, {"$set": updates})
    return _out(await db.users.find_one({"_id": oid(uid)}))


@router.patch("/{uid}/active")
async def set_active(uid: str, body: ActiveBody, admin=Depends(require_roles("Admin"))):
    await db.users.update_one({"_id": oid(uid)}, {"$set": {"active": body.active}})
    if not body.active:
        # Immediately revoke all sessions of a disabled account.
        await db.refresh_tokens.update_many(
            {"user_id": uid, "revoked_at": None}, {"$set": {"revoked_at": now_utc()}}
        )
    return {"active": body.active}


@router.post("/{uid}/reset-password")
async def admin_reset_password(uid: str, body: ResetPasswordBody, admin=Depends(require_roles("Admin"))):
    target = await db.users.find_one({"_id": oid(uid)})
    if not target:
        raise HTTPException(404, "User not found")
    temp = body.new_password or ("Ppc-" + secrets.token_urlsafe(6))
    await db.users.update_one({"_id": oid(uid)}, {"$set": {"password_hash": hash_password(temp)}})
    await db.refresh_tokens.update_many(
        {"user_id": uid, "revoked_at": None}, {"$set": {"revoked_at": now_utc()}}
    )
    return {"ok": True, "temporary_password": temp}


@router.post("/me/change-password")
async def change_password(body: ChangePasswordBody, user=Depends(get_current_user)):
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    await db.users.update_one(
        {"_id": user["_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}}
    )
    return {"ok": True}


@router.patch("/me")
async def update_me(body: UpdateUserBody, user=Depends(get_current_user)):
    updates = {}
    for field in ("name", "phone", "company"):
        val = getattr(body, field)
        if val is not None:
            updates[field] = val
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    return _out(await db.users.find_one({"_id": user["_id"]}))
