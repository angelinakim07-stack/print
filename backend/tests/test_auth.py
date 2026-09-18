"""Health + auth flow tests: login, refresh, logout, rate limit, forgot-password."""
import time

import pytest
import requests


def test_health(api):
    r = requests.get(f"{api}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


# --- Login for all seeded roles ---
@pytest.mark.parametrize("role_key", ["admin", "manager", "viewmanager", "amit", "deepak", "kavita", "customer", "vendor"])
def test_login_all_roles(api, sessions, role_key):
    s = sessions[role_key]
    assert s["token"]
    assert s["user"]["email"]


def test_login_invalid_password(api):
    r = requests.post(f"{api}/auth/login", json={"email": "admin@printpackinc.com", "password": "wrongpw!"}, timeout=10)
    assert r.status_code in (401, 429)


def test_forgot_password_honest_state(api):
    r = requests.post(f"{api}/auth/forgot-password", json={"email": "admin@printpackinc.com"}, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d.get("email_configured") is False
    assert "administrator" in (d.get("message") or "").lower()


def test_refresh_and_logout(api, sessions):
    s = sessions["amit"]
    r = requests.post(f"{api}/auth/refresh", json={"refresh_token": s["refresh"]}, timeout=10)
    assert r.status_code == 200
    d = r.json()
    new_refresh = d["refresh_token"]
    # old refresh should now be revoked
    r2 = requests.post(f"{api}/auth/refresh", json={"refresh_token": s["refresh"]}, timeout=10)
    assert r2.status_code == 401
    # logout new refresh
    r3 = requests.post(f"{api}/auth/logout", json={"refresh_token": new_refresh}, timeout=10)
    assert r3.status_code == 200


def test_login_rate_limit(api):
    # Rate limit is 5/min per (ip,email) per process. Ingress may spread across replicas —
    # allow up to N attempts and require at least one 429 across the batch.
    email = "ratelimit_probe@nonexistent.example.com"
    codes = []
    for _ in range(20):
        r = requests.post(f"{api}/auth/login", json={"email": email, "password": "x"}, timeout=10)
        codes.append(r.status_code)
    assert 429 in codes, f"Expected 429 in {codes}"


def test_me_endpoint(api, sessions):
    r = requests.get(f"{api}/auth/me", headers={"Authorization": f"Bearer {sessions['admin']['token']}"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["role"] == "Admin"


def test_invalid_token_rejected(api):
    r = requests.get(f"{api}/auth/me", headers={"Authorization": "Bearer bad.token.here"}, timeout=10)
    assert r.status_code == 401
