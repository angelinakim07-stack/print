"""Password hashing, JWT tokens, refresh-token helpers and a simple rate limiter."""
import hashlib
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
ALGO = "HS256"
ACCESS_MINUTES = 15
REFRESH_DAYS = 30


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except Exception:
        return False


def create_access_token(user) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["_id"]),
        "role": user["role"],
        "type": "access",
        "jti": secrets.token_hex(8),
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_MINUTES),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        SECRET,
        algorithms=[ALGO],
        options={"require": ["exp", "iat", "sub", "type"]},
    )


def token_digest(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_refresh_raw() -> str:
    return secrets.token_urlsafe(48)


def refresh_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=REFRESH_DAYS)


# --- lightweight in-memory rate limiter (per-process; sufficient for preview) ---
_buckets: dict[str, list[float]] = {}


def rate_limit(key: str, limit: int, window_sec: int) -> bool:
    """Return True if the action is allowed, False if the limit is exceeded."""
    now = time.time()
    arr = [t for t in _buckets.get(key, []) if now - t < window_sec]
    if len(arr) >= limit:
        _buckets[key] = arr
        return False
    arr.append(now)
    _buckets[key] = arr
    return True
