"""End-to-end: teacher enters marks -> grades saved -> audit needed to edit -> parent sees report."""
import os
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db import engine
from app.main import app
from app.models import *  # noqa
from app.security import hash_password


@pytest.fixture()
def world():
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    with Session(engine) as db:
        t = User(username="t1", password_hash=hash_password("pw"), full_name="Mr T", role="teacher")
        p = User(username="p1", password_hash=hash_password("pw"), full_name="Mrs P", role="parent")
        k = ClassGroup(name="4 Blue", form=4, year=2026)
        sub = Subject(name="Mathematics", level="O")
        db.add_all([t, p, k, sub]); db.flush()
        s = Student(admission_no="A1", first_name="Tino", last_name="Moyo", class_id=k.id)
        db.add_all([s, TeacherAssignment(teacher_id=t.id, class_id=k.id, subject_id=sub.id)]); db.flush()
        a = Assessment(class_id=k.id, subject_id=sub.id, title="Test 1", term=1, year=2026, max_marks=50)
        db.add_all([a, StudentGuardian(student_id=s.id, user_id=p.id)]); db.commit()
        return {"aid": str(a.id), "sid": str(s.id)}


def login(c, u):
    return {"Authorization": "Bearer " + c.post("/api/v1/auth/login", data={"username": u, "password": "pw"}).json()["access_token"]}


def test_flow(world):
    with TestClient(app) as c:
        h = login(c, "t1")
        r = c.put(f"/api/v1/assessments/{world['aid']}/marks", headers=h,
                  json={"marks": [{"student_id": world["sid"], "marks_obtained": 51}]})
        assert r.json()["saved"] == 0 and "Cannot exceed" in r.json()["errors"][0]["error"]
        r = c.put(f"/api/v1/assessments/{world['aid']}/marks", headers=h,
                  json={"marks": [{"student_id": world["sid"], "marks_obtained": 40}]})
        assert r.json()["saved"] == 1
        assert c.get(f"/api/v1/assessments/{world['aid']}/sheet", headers=h).json()["rows"][0]["grade"] == "A"  # 80% O-level
        r = c.put(f"/api/v1/assessments/{world['aid']}/marks", headers=h,
                  json={"marks": [{"student_id": world["sid"], "marks_obtained": 30}]})
        assert "reason" in r.json()["errors"][0]["error"]
        r = c.put(f"/api/v1/assessments/{world['aid']}/marks", headers=h,
                  json={"marks": [{"student_id": world["sid"], "marks_obtained": 30, "reason": "Marking error"}]})
        assert r.json()["saved"] == 1
        ph = login(c, "p1")
        assert c.get(f"/api/v1/report-cards/{world['sid']}?term=1&year=2026", headers=ph).status_code == 404  # unpublished
