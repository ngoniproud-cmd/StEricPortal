import io
import zipfile

from app.auth import hash_password
from app.db import SessionLocal
from app.models import User


def test_auth_login_and_me(client):
    # Setup user
    with SessionLocal() as db:
        user = db.query(User).filter_by(username="admin").first()
        if not user:
            db.add(
                User(
                    username="admin",
                    password_hash=hash_password("StEric@2026"),
                    full_name="St Eric Administrator",
                    roles=["platform_admin", "registrar"],
                    is_active=True,
                )
            )
            db.commit()

    # Successful login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "StEric@2026"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert token

    # Check /me with token
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "admin"


def test_auth_login_failure(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "WrongPassword"},
    )
    assert res.status_code == 401


def test_export_sis_endpoint(client):
    res = client.get("/api/v1/students/export-sis")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/zip"
    zf = zipfile.ZipFile(io.BytesIO(res.content))
    assert "users.csv" in zf.namelist()
