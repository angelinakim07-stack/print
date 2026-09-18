"""Order lifecycle: submit validation, job numbering, approval, corrections, revisions, production, QC, dispatch, billing, close."""
import requests


def H(sess):
    return {"Authorization": f"Bearer {sess['token']}"}


def _minimal_valid_order_payload(amit_uid, po_doc, art_doc):
    return {
        "priority": "Normal",
        "source": "Employee",
        "assigned_to": amit_uid,
        "sales": {
            "assigned_to": amit_uid,
            "customer_name": "TEST Customer Co",
            "po_number": "PO-TEST-1",
            "po_date": "2026-01-01",
            "delivery_date": "2030-01-01",
            "delivery_location": "Mumbai",
        },
        "box": {
            "product_name": "Test Box",
            "box_type": "RSC",
            "length": 10, "width": 10, "height": 10,
            "quantity": 500, "ply": 3,
            "board_spec": "3-ply", "paper_gsm_bf": "150 BF",
        },
        "printing": {"required": "Yes", "process": "Flexo", "artwork_approval": "Yes"},
        "conversion": {"processes": ["Slotting"]},
        "commercial": {"rate_per_piece": 10, "gst_percent": 18},
        "declaration": {k: True for k in [
            "po_checked", "size_ok", "quantity_ok", "spec_ok", "printing_ok",
            "processes_ok", "artwork_attached", "delivery_confirmed", "instructions_ok",
        ]},
        "documents": [
            {"category": "PO Copy", **po_doc},
            {"category": "Printing Artwork", **art_doc},
        ],
    }


def test_submit_validation_returns_missing_list(api, sessions):
    # create draft with empty body
    amit = sessions["amit"]
    r = requests.post(f"{api}/orders", json={"priority": "Normal"}, headers=H(amit), timeout=10)
    assert r.status_code == 200, r.text
    oid = r.json()["id"]

    r2 = requests.post(f"{api}/orders/{oid}/submit", headers=H(amit), timeout=10)
    assert r2.status_code == 422, r2.text
    detail = r2.json().get("detail")
    assert isinstance(detail, dict)
    assert isinstance(detail.get("missing"), list) and len(detail["missing"]) > 0


def test_full_happy_path(api, sessions):
    amit = sessions["amit"]
    admin = sessions["admin"]
    deepak = sessions["deepak"]
    kavita = sessions["kavita"]

    amit_uid = amit["user"]["id"] if "id" in amit["user"] else amit["user"].get("_id")

    # create draft
    r = requests.post(f"{api}/orders",
                      json=_minimal_valid_order_payload(amit_uid, {"id": "po1"}, {"id": "art1"}),
                      headers=H(amit), timeout=15)
    assert r.status_code == 200, r.text
    order = r.json()
    oid = order["id"] if "id" in order else order.get("_id")
    assert order["status"] == "DRAFT"
    assert order["job_number"] is None

    # submit
    r2 = requests.post(f"{api}/orders/{oid}/submit", headers=H(amit), timeout=15)
    assert r2.status_code == 200, r2.text
    submitted = r2.json()
    assert submitted["status"] == "UNDER_CHECKING"
    job_no = submitted["job_number"]
    assert job_no and job_no.startswith("PPC-")

    # Amit (creator) cannot approve their own order
    r_self = requests.post(f"{api}/orders/{oid}/approve", json={"note": "n"}, headers=H(amit), timeout=10)
    # amit doesn't have check_approve_return perm anyway; expect 403
    assert r_self.status_code == 403

    # Admin approves (admin is NOT creator; check pass)
    r3 = requests.post(f"{api}/orders/{oid}/approve", json={"note": "ok"}, headers=H(admin), timeout=10)
    assert r3.status_code == 200, r3.text
    assert r3.json()["status"] == "APPROVED"

    # Cannot PATCH approved order
    r_patch = requests.patch(f"{api}/orders/{oid}", json={"priority": "High"}, headers=H(amit), timeout=10)
    assert r_patch.status_code == 409

    # deepak plans production and moves to IN_PRODUCTION -> QC
    rp = requests.post(f"{api}/orders/{oid}/production/plan",
                       json={"machine": "M1", "responsible": "X"}, headers=H(deepak), timeout=10)
    assert rp.status_code == 200
    assert rp.json()["status"] == "PRODUCTION_PLANNING"

    rp2 = requests.post(f"{api}/orders/{oid}/production/update",
                        json={"produced_qty": 500, "move_to": "IN_PRODUCTION"}, headers=H(deepak), timeout=10)
    assert rp2.status_code == 200
    assert rp2.json()["status"] == "IN_PRODUCTION"

    rp3 = requests.post(f"{api}/orders/{oid}/production/update",
                        json={"produced_qty": 500, "move_to": "QC"}, headers=H(deepak), timeout=10)
    assert rp3.status_code == 200
    assert rp3.json()["status"] == "QC"

    # QC Fail -> stays in QC
    rq = requests.post(f"{api}/orders/{oid}/qc",
                       json={"inspected_qty": 500, "passed_qty": 0, "rejected_qty": 500, "result": "Fail"},
                       headers=H(deepak), timeout=10)
    assert rq.status_code == 200
    assert rq.json()["status"] == "QC"

    # kavita cannot dispatch yet (not ready)
    rd_fail = requests.post(f"{api}/orders/{oid}/dispatch",
                            json={"quantity": 100}, headers=H(kavita), timeout=10)
    assert rd_fail.status_code == 409

    # QC Pass
    rq2 = requests.post(f"{api}/orders/{oid}/qc",
                        json={"inspected_qty": 500, "passed_qty": 500, "rejected_qty": 0, "result": "Pass"},
                        headers=H(deepak), timeout=10)
    assert rq2.status_code == 200
    assert rq2.json()["status"] == "READY_FOR_DISPATCH"
    assert rq2.json()["qc_released_qty"] == 500

    # Dispatch too much
    rd_over = requests.post(f"{api}/orders/{oid}/dispatch",
                            json={"quantity": 999}, headers=H(kavita), timeout=10)
    assert rd_over.status_code == 422

    # Partial dispatch
    rd1 = requests.post(f"{api}/orders/{oid}/dispatch",
                        json={"quantity": 200}, headers=H(kavita), timeout=10)
    assert rd1.status_code == 200
    assert rd1.json()["status"] == "READY_FOR_DISPATCH"

    # Full dispatch remaining
    rd2 = requests.post(f"{api}/orders/{oid}/dispatch",
                        json={"quantity": 300}, headers=H(kavita), timeout=10)
    assert rd2.status_code == 200
    assert rd2.json()["status"] == "DISPATCHED"

    # Billing requires DISPATCHED
    rb = requests.post(f"{api}/orders/{oid}/billing",
                       json={"invoice_number": "INV-TEST-1", "taxable_value": 5000, "gst_rate": 18},
                       headers=H(kavita), timeout=10)
    assert rb.status_code == 200
    assert rb.json()["status"] == "BILLED"

    # Close (admin/manager only)
    rc_fail = requests.post(f"{api}/orders/{oid}/close", headers=H(amit), timeout=10)
    assert rc_fail.status_code == 403

    rc = requests.post(f"{api}/orders/{oid}/close", headers=H(admin), timeout=10)
    assert rc.status_code == 200
    assert rc.json()["status"] == "CLOSED"


def test_send_back_and_resubmit_preserves_job_number(api, sessions):
    amit = sessions["amit"]
    admin = sessions["admin"]
    amit_uid = amit["user"]["id"] if "id" in amit["user"] else amit["user"].get("_id")

    r = requests.post(f"{api}/orders",
                      json=_minimal_valid_order_payload(amit_uid, {"id": "po2"}, {"id": "art2"}),
                      headers=H(amit), timeout=15)
    oid = r.json()["id"] if "id" in r.json() else r.json().get("_id")

    r2 = requests.post(f"{api}/orders/{oid}/submit", headers=H(amit), timeout=10)
    assert r2.status_code == 200
    job_no = r2.json()["job_number"]

    # Send-back requires reason+note
    rs_bad = requests.post(f"{api}/orders/{oid}/send-back",
                           json={"reason": "Other", "note": ""}, headers=H(admin), timeout=10)
    assert rs_bad.status_code == 400

    rs = requests.post(f"{api}/orders/{oid}/send-back",
                       json={"reason": "Other", "note": "Please clarify size"}, headers=H(admin), timeout=10)
    assert rs.status_code == 200
    assert rs.json()["status"] == "CORRECTION_REQUIRED"

    # Resubmit
    r3 = requests.post(f"{api}/orders/{oid}/submit", headers=H(amit), timeout=10)
    assert r3.status_code == 200
    assert r3.json()["job_number"] == job_no  # preserved


def test_approve_blocked_when_artwork_not_approved(api, sessions):
    amit = sessions["amit"]
    admin = sessions["admin"]
    amit_uid = amit["user"]["id"] if "id" in amit["user"] else amit["user"].get("_id")

    payload = _minimal_valid_order_payload(amit_uid, {"id": "po3"}, {"id": "art3"})
    payload["printing"]["artwork_approval"] = "No"

    r = requests.post(f"{api}/orders", json=payload, headers=H(amit), timeout=15)
    oid = r.json()["id"] if "id" in r.json() else r.json().get("_id")
    requests.post(f"{api}/orders/{oid}/submit", headers=H(amit), timeout=10)

    r2 = requests.post(f"{api}/orders/{oid}/approve", json={"note": "ok"}, headers=H(admin), timeout=10)
    assert r2.status_code == 422
