from app.main import app
from app.security import Principal, get_principal


def test_forbidden_role(client):
    app.dependency_overrides[get_principal] = lambda: Principal("teacher-1", frozenset({"teacher"}))
    response = client.post("/api/v1/students", json={
        "sis_id": "L-003", "legal_first_name": "X", "legal_last_name": "Y"
    })
    assert response.status_code == 403
