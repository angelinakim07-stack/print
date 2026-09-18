"""Authentication endpoints: login, refresh, logout, forgot-password."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from db import clean, db, now_utc, oid
from deps import get_current_user
from security import (
    create_access_token,
    new_refresh_raw,
    rate_limit,
    refresh_expiry,
    token_digest,
    verify_password,
)

router = APIRouter()


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class RefreshBody(BaseModel):
    refresh_token: str


class ForgotBody(BaseModel):
    email: EmailStr


def _public_user(user):
    u = clean(user)
    u.pop("password_hash", None)
    return u


async def _issue_tokens(user):
    raw = new_refresh_raw()
    await db.refresh_tokens.insert_one(
        {
            "user_id": str(user["_id"]),
            "token_hash": token_digest(raw),
            "created_at": now_utc(),
            "expires_at": refresh_expiry(),
            "revoked_at": None,
        }
    )
    return {
        "access_token": create_access_token(user),
        "refresh_token": raw,
        "user": _public_user(user),
    }


@router.post("/login")
async def login(body: LoginBody, request: Request):
    ip = request.client.host if request.client else "unknown"
    if not rate_limit(f"login:{ip}:{body.email.lower()}", limit=5, window_sec=60):
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a minute.")
    user = await db.users.find_one({"email": body.email.lower()})
    ok = verify_password(body.password, user["password_hash"]) if user else False
    if not user or not ok:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("active", False):
        raise HTTPException(status_code=403, detail="Account is disabled. Contact your admin.")
    return await _issue_tokens(user)


@router.post("/refresh")
async def refresh(body: RefreshBody):
    from datetime import timezone as _tz
    old = await db.refresh_tokens.find_one({"token_hash": token_digest(body.refresh_token)})
    if old and old.get("expires_at") is not None and old["expires_at"].tzinfo is None:
        old["expires_at"] = old["expires_at"].replace(tzinfo=_tz.utc)
    if not old or old.get("revoked_at") or old["expires_at"] <= now_utc():
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    user = await db.users.find_one({"_id": oid(old["user_id"])})
    if not user or not user.get("active", False):
        raise HTTPException(status_code=403, detail="Account is disabled")
    await db.refresh_tokens.update_one({"_id": old["_id"]}, {"$set": {"revoked_at": now_utc()}})
    return await _issue_tokens(user)


@router.post("/logout")
async def logout(body: RefreshBody):
    await db.refresh_tokens.update_one(
        {"token_hash": token_digest(body.refresh_token), "revoked_at": None},
        {"$set": {"revoked_at": now_utc()}},
    )
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(body: ForgotBody, request: Request):
    ip = request.client.host if request.client else "unknown"
    if not rate_limit(f"forgot:{ip}", limit=3, window_sec=3600):
        raise HTTPException(status_code=429, detail="Too many recovery requests. Try again later.")
    # Honest state: email delivery is not configured in this deployment.
    return {
        "ok": True,
        "email_configured": False,
        "message": (
            "Password email is not configured yet. Please ask your administrator to reset "
            "your password from Users & Permissions."
        ),
    }


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return _public_user(user)
