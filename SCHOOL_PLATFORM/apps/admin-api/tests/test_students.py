from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import AuditEvent, OutboxEvent


def test_create_list_and_audit_student(client):
    response = client.post("/api/v1/students", json={
        "sis_id": "L-001", "legal_first_name": "Amina", "legal_last_name": "Dlamini"
    })
    assert response.status_code == 201
    body = response.json()
    assert body["version"] == 1
    listed = client.get("/api/v1/students").json()
    assert listed["total"] == 1
    assert listed["items"][0]["sis_id"] == "L-001"
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(AuditEvent)) == 1
        assert db.scalar(select(func.count()).select_from(OutboxEvent)) == 1


def test_duplicate_sis_id_conflicts(client):
    payload = {"sis_id": "L-001", "legal_first_name": "A", "legal_last_name": "B"}
    assert client.post("/api/v1/students", json=payload).status_code == 201
    assert client.post("/api/v1/students", json=payload).status_code == 409


def test_optimistic_version_conflict(client):
    created = client.post("/api/v1/students", json={
        "sis_id": "L-002", "legal_first_name": "Neo", "legal_last_name": "Mokoena"
    }).json()
    first = client.patch(f"/api/v1/students/{created['id']}", json={
        "preferred_name": "N", "expected_version": 1
    })
    assert first.status_code == 200
    stale = client.patch(f"/api/v1/students/{created['id']}", json={
        "preferred_name": "NN", "expected_version": 1
    })
    assert stale.status_code == 409
