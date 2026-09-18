"""Requests, follow-ups, notifications, files, reports."""
import io

import requests


def H(sess):
    return {"Authorization": f"Bearer {sess['token']}"}


# ---- Requests ----
def test_customer_request_and_isolation(api, sessions):
    customer = sessions["customer"]
    r = requests.post(f"{api}/requests",
                      json={"business_name": "TEST Biz", "requirement": "5000 boxes"},
                      headers=H(customer), timeout=10)
    assert r.status_code == 200
    req = r.json()
    assert req.get("reference", "").startswith("REQ-")
    rid = req["id"] if "id" in req else req.get("_id")

    # Vendor should not see customer's request
    vendor = sessions["vendor"]
    lst = requests.get(f"{api}/requests", headers=H(vendor), timeout=10).json()
    assert all(x.get("id", x.get("_id")) != rid for x in lst)

    # Vendor GET direct → 403
    r2 = requests.get(f"{api}/requests/{rid}", headers=H(vendor), timeout=10)
    assert r2.status_code == 403


def test_request_convert_creates_draft_order(api, sessions):
    customer = sessions["customer"]
    admin = sessions["admin"]
    r = requests.post(f"{api}/requests",
                      json={"business_name": "TEST Biz 2", "requirement": "1000 boxes"},
                      headers=H(customer), timeout=10)
    rid = r.json()["id"] if "id" in r.json() else r.json().get("_id")

    # reject requires reason
    rr = requests.post(f"{api}/requests/{rid}/reject", json={}, headers=H(admin), timeout=10)
    assert rr.status_code == 400

    # convert
    rc = requests.post(f"{api}/requests/{rid}/convert", json={}, headers=H(admin), timeout=10)
    assert rc.status_code == 200
    assert rc.json().get("order_id")


# ---- Follow-ups ----
def test_followup_lifecycle(api, sessions):
    admin = sessions["admin"]
    r = requests.post(f"{api}/followups",
                      json={"title": "Call TEST customer", "due_at": "2030-01-01T09:00:00Z"},
                      headers=H(admin), timeout=10)
    assert r.status_code == 200
    fid = r.json()["id"] if "id" in r.json() else r.json().get("_id")

    # complete without outcome
    rc = requests.post(f"{api}/followups/{fid}/complete", json={"outcome": ""}, headers=H(admin), timeout=10)
    assert rc.status_code == 400

    # reschedule needs reason
    rr = requests.post(f"{api}/followups/{fid}/reschedule",
                       json={"due_at": "2030-01-02T09:00:00Z", "reason": ""}, headers=H(admin), timeout=10)
    assert rr.status_code == 400

    rr2 = requests.post(f"{api}/followups/{fid}/reschedule",
                        json={"due_at": "2030-01-02T09:00:00Z", "reason": "customer unavailable"},
                        headers=H(admin), timeout=10)
    assert rr2.status_code == 200

    rc2 = requests.post(f"{api}/followups/{fid}/complete",
                        json={"outcome": "spoke with customer"}, headers=H(admin), timeout=10)
    assert rc2.status_code == 200

    # buckets
    for bucket in ["today", "upcoming", "overdue", "completed"]:
        b = requests.get(f"{api}/followups?bucket={bucket}", headers=H(admin), timeout=10)
        assert b.status_code == 200


# ---- Notifications ----
def test_notifications_inbox(api, sessions):
    admin = sessions["admin"]
    r = requests.get(f"{api}/notifications", headers=H(admin), timeout=10)
    assert r.status_code == 200
    rc = requests.get(f"{api}/notifications/unread-count", headers=H(admin), timeout=10)
    assert rc.status_code == 200
    assert "count" in rc.json() or "unread" in rc.json()
    ra = requests.post(f"{api}/notifications/read-all", headers=H(admin), timeout=10)
    assert ra.status_code == 200


# ---- Reports ----
def test_dashboard_and_reports(api, sessions):
    admin = sessions["admin"]
    r = requests.get(f"{api}/reports/dashboard", headers=H(admin), timeout=15)
    assert r.status_code == 200
    tiles = r.json().get("tiles", {})
    for k in ["active_jobs", "awaiting_approval", "in_production"]:
        assert k in tiles

    for rt in ["pending", "production", "qc", "dispatch", "billing", "delayed"]:
        rr = requests.get(f"{api}/reports/{rt}", headers=H(admin), timeout=10)
        assert rr.status_code == 200, f"{rt} failed: {rr.text}"


def test_csv_export_permission(api, sessions):
    # kavita has record_dispatch/record_billing but not export_reports; expect 403
    r = requests.get(f"{api}/reports/export/csv?report_type=pending", headers=H(sessions["kavita"]), timeout=10)
    assert r.status_code == 403
    # admin allowed
    r2 = requests.get(f"{api}/reports/export/csv?report_type=pending", headers=H(sessions["admin"]), timeout=15)
    assert r2.status_code == 200


# ---- Files ----
def test_file_upload_and_auth(api, sessions):
    admin = sessions["admin"]
    files = {"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")}
    data = {"category": "Other"}
    r = requests.post(f"{api}/files", files=files, data=data, headers=H(admin), timeout=15)
    assert r.status_code == 200
    fid = r.json()["id"]

    # Unauthorized (no token) blocked
    r2 = requests.get(f"{api}/files/{fid}/download", timeout=10)
    assert r2.status_code in (401, 403)

    # Authorized via Bearer
    r3 = requests.get(f"{api}/files/{fid}/download", headers=H(admin), timeout=10)
    assert r3.status_code == 200
    assert r3.content == b"hello world"

    # Authorized via ?token=
    r4 = requests.get(f"{api}/files/{fid}/download?token={admin['token']}", timeout=10)
    assert r4.status_code == 200

    # Customer without link should be blocked (uploader = admin, no order attached)
    r5 = requests.get(f"{api}/files/{fid}/download", headers=H(sessions["customer"]), timeout=10)
    assert r5.status_code == 403
