"""Auth dependencies and permission helpers used across routers."""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db import db, oid
from security import decode_access_token

bearer = HTTPBearer(auto_error=True)
optional_bearer = HTTPBearer(auto_error=False)

ROLES = ["Admin", "Manager", "Employee", "Customer", "Vendor"]
INTERNAL_ROLES = ["Admin", "Manager", "Employee"]

# Granular permissions that Admin may grant to Managers and Employees.
PERMISSIONS = [
    "create_edit_orders",
    "assign_responsibility",
    "check_approve_return",
    "update_production",
    "qc_updates",
    "record_dispatch",
    "record_billing",
    "export_reports",
]


async def get_current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = decode_access_token(cred.credentials)
        if payload.get("type") != "access":
            raise ValueError("wrong token type")
        user = await db.users.find_one({"_id": oid(payload["sub"])})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    if not user or not user.get("active", False):
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user


async def get_current_user_optional(cred: HTTPAuthorizationCredentials = Depends(optional_bearer)):
    if not cred:
        return None
    try:
        payload = decode_access_token(cred.credentials)
        if payload.get("type") != "access":
            return None
        user = await db.users.find_one({"_id": oid(payload["sub"])})
    except Exception:
        return None
    if not user or not user.get("active", False):
        return None
    return user


def require_roles(*roles):
    async def dep(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not permitted for your role")
        return user

    return dep


def has_perm(user, perm: str) -> bool:
    if user["role"] == "Admin":
        return True
    return bool((user.get("permissions") or {}).get(perm))


def require_perm(perm: str):
    async def dep(user=Depends(get_current_user)):
        if not has_perm(user, perm):
            raise HTTPException(status_code=403, detail=f"Missing permission: {perm}")
        return user

    return dep
