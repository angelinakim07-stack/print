"""Shared fixtures for PRINT PACK INC backend tests."""
import os

import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://box-order-system-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


CREDS = {
    "admin": ("admin@printpackinc.com", "Admin@12345"),
    "manager": ("manager@printpackinc.com", "Manager@123"),
    "viewmanager": ("viewmanager@printpackinc.com", "Manager@123"),
    "amit": ("amit@printpackinc.com", "Employee@123"),
    "deepak": ("deepak@printpackinc.com", "Employee@123"),
    "kavita": ("kavita@printpackinc.com", "Employee@123"),
    "customer": ("customer@example.com", "Customer@123"),
    "vendor": ("vendor@example.com", "Vendor@123"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    if r.status_code != 200:
        return None
    d = r.json()
    return {"token": d["access_token"], "refresh": d["refresh_token"], "user": d["user"]}


@pytest.fixture(scope="session")
def api():
    return API


@pytest.fixture(scope="session")
def sessions():
    """Log in all seeded roles once per session."""
    out = {}
    for k, (email, pw) in CREDS.items():
        s = _login(email, pw)
        if s is None:
            pytest.skip(f"Cannot log in seeded account: {email}")
        out[k] = s
    return out


def auth(sess):
    return {"Authorization": f"Bearer {sess['token']}"}


@pytest.fixture
def H():
    return auth
