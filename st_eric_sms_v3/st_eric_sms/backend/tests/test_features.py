import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db import engine
from app.main import app
from app.models import *  # noqa
from app.security import hash_password
from app.report_card import sign
from datetime import date

PDF = b"%PDF-1.4 test file"


@pytest.fixture()
def w():
    from app.routers.auth import _fails; _fails.clear()
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    with Session(engine) as db:
        us = {r: User(username=r, password_hash=hash_password("pw"), full_name=r.title(), role=r)
              for r in ("admin", "teacher", "librarian", "student", "parent")}
        db.add_all(us.values())
        k1, k2 = ClassGroup(name="3 Blue", form=3, year=2026), ClassGroup(name="4 Blue", form=4, year=2027)
        sub = Subject(name="Physics", level="O")
        db.add_all([k1, k2, sub]); db.flush()
        st = Student(admission_no="S1", first_name="Ana", last_name="Zed", class_id=k1.id, user_id=us["student"].id)
        st2 = Student(admission_no="S2", first_name="Ben", last_name="Yao", class_id=k1.id)
        db.add_all([st, st2]); db.flush()
        db.add_all([TeacherAssignment(teacher_id=us["teacher"].id, class_id=k1.id, subject_id=sub.id),
                    StudentGuardian(student_id=st.id, user_id=us["parent"].id)])
        db.commit()
        return {"k1": str(k1.id), "k2": str(k2.id), "sid": str(st.id), "sid2": str(st2.id), "sub": str(sub.id)}


def H(c, u):
    t = c.post("/api/v1/auth/login", data={"username": u, "password": "pw"}).json()["access_token"]
    return {"Authorization": f"Bearer {t}"}


def up(c, h, name="notes.pdf", data=PDF, **extra):
    f = {"title": "Physics notes", "kind": "notes", "form": "3", **extra}
    return c.post("/api/v1/library", headers=h, data=f, files={"file": (name, data)})


def test_library_approval_flow(w):
    with TestClient(app) as c:
        t, l, s = H(c, "teacher"), H(c, "librarian"), H(c, "student")
        r = up(c, t); assert r.status_code == 201 and r.json()["status"] == "pending"
        iid = r.json()["id"]
        assert c.get("/api/v1/library", headers=s).json() == []                       # not visible yet
        assert c.get(f"/api/v1/library/{iid}/view", headers=s).status_code == 404
        assert c.post(f"/api/v1/library/{iid}/review", headers=t, json={"approve": True}).status_code == 403
        assert c.post(f"/api/v1/library/{iid}/review", headers=l, json={"approve": False}).status_code == 422  # reason needed
        assert c.post(f"/api/v1/library/{iid}/review", headers=l, json={"approve": True}).status_code == 200
        assert len(c.get("/api/v1/library", headers=s).json()) == 1
        assert c.get(f"/api/v1/library/{iid}/view", headers=s).content == PDF
        assert c.get(f"/api/v1/library/{iid}/download", headers=s).status_code == 200
        item = c.get("/api/v1/library", headers=s).json()[0]
        assert item["views"] == 1 and item["downloads"] == 1
        assert c.post(f"/api/v1/library/{iid}/favourite", headers=s).json()["favourite"] is True
        assert len(c.get("/api/v1/library?favourites=true", headers=s).json()) == 1
        assert c.get("/api/v1/library?q=physics", headers=s).json()[0]["title"] == "Physics notes"
        n = c.get("/api/v1/notifications", headers=t).json()
        assert n["unread"] == 1 and "approved" in n["items"][0]["title"].lower()


def test_library_validation_and_permissions(w):
    with TestClient(app) as c:
        t, s, l = H(c, "teacher"), H(c, "student"), H(c, "librarian")
        assert up(c, t, "evil.exe", b"MZ").status_code == 422
        assert up(c, t, "fake.pdf", b"not a pdf").status_code == 422
        assert up(c, s).status_code == 403                                             # students cannot upload
        assert up(c, l).json()["status"] == "approved"                                  # librarian uploads go live
        iid = up(c, t).json()["id"]
        assert c.delete(f"/api/v1/library/{iid}", headers=H(c, "admin")).status_code == 200
        assert c.get(f"/api/v1/library/{iid}/view", headers=t).status_code == 404


def test_report_qr_and_publish(w):
    with TestClient(app) as c:
        a, t = H(c, "admin"), H(c, "teacher")
        r = c.post("/api/v1/assessments", headers=t, json={"class_id": w["k1"], "subject_id": w["sub"], "title": "T1", "term": 1, "year": 2026, "max_marks": 100})
        aid = r.json()["id"]
        c.put(f"/api/v1/assessments/{aid}/marks", headers=t, json={"marks": [{"student_id": w["sid"], "marks_obtained": 72}]})
        p = H(c, "parent")
        assert c.get(f"/api/v1/report-cards/{w['sid']}?term=1&year=2026", headers=p).status_code == 404
        assert c.post("/api/v1/report-cards/publish", headers=t, json={"class_id": w["k1"], "term": 1, "year": 2026}).status_code == 403
        assert c.post("/api/v1/report-cards/publish", headers=a, json={"class_id": w["k1"], "term": 1, "year": 2026}).json()["published"] == 2
        rep = c.get(f"/api/v1/report-cards/{w['sid']}?term=1&year=2026", headers=p).json()
        assert rep["overall"] == 72 and rep["rows"][0]["grade"] == "A"
        assert c.get(f"/api/v1/report-cards/{w['sid']}/pdf?term=1&year=2026", headers=p).content[:4] == b"%PDF"
        assert c.get("/api/v1/notifications", headers=p).json()["unread"] == 1
        import uuid
        good = c.get(f"/api/v1/verify/{w['sid']}/1/2026/{sign(uuid.UUID(w['sid']), 1, 2026)}").json()
        assert good["genuine"] and good["overall"] == 72
        assert c.get(f"/api/v1/verify/{w['sid']}/1/2026/{'0' * 20}").json() == {"genuine": False}
        assert c.get(f"/api/v1/verify/{w['sid']}/2/2026/{sign(uuid.UUID(w['sid']), 1, 2026)}").json() == {"genuine": False}


def test_marks_upload_and_isolation(w):
    with TestClient(app) as c:
        t = H(c, "teacher")
        aid = c.post("/api/v1/assessments", headers=t, json={"class_id": w["k1"], "subject_id": w["sub"], "title": "T1", "term": 1, "year": 2026, "max_marks": 50}).json()["id"]
        csv = b"admission_no,marks\nS1,40\nS2,ABS\nS9,10\n"
        r = c.post(f"/api/v1/assessments/{aid}/marks/upload", headers=t, files={"file": ("m.csv", csv)}).json()
        assert r["saved"] == 2 and r["errors"][0]["admission_no"] == "S9"
        sheet = c.get(f"/api/v1/assessments/{aid}/sheet", headers=t).json()["rows"]
        assert {x["admission_no"]: x["absent"] for x in sheet} == {"S1": False, "S2": True}
        assert c.get("/api/v1/assessments", headers=t).json()[0]["entered"] == 2
        assert c.get(f"/api/v1/assessments/{aid}/sheet", headers=H(c, "student")).status_code == 403
        bad = c.post(f"/api/v1/assessments/{aid}/marks/upload", headers=t, files={"file": ("m.csv", b"x,y\n1,2")})
        assert bad.status_code == 422


def test_attendance_alerts_insights_ai(w):
    with TestClient(app) as c:
        t, p = H(c, "teacher"), H(c, "parent")
        rows = [{"student_id": w["sid"], "status": "absent"}, {"student_id": w["sid2"], "status": "present"}]
        assert c.put(f"/api/v1/attendance/class/{w['k1']}", headers=t, json=rows).json()["absent"] == 1
        assert c.put(f"/api/v1/attendance/class/{w['k1']}", headers=t, json=rows).json()["absent"] == 0  # no duplicate alerts
        assert c.get("/api/v1/notifications", headers=p).json()["unread"] == 1
        assert c.put(f"/api/v1/attendance/class/{w['k1']}?day=2999-01-01", headers=t, json=rows).status_code == 422
        ins = c.get(f"/api/v1/insights/class/{w['k1']}?term=1&year=2026", headers=t).json()
        assert ins[0]["name"] == "Ana Zed" and ins[0]["risk"] == "high" and "Attendance" in ins[0]["flags"][0]
        aid = c.post("/api/v1/assessments", headers=t, json={"class_id": w["k1"], "subject_id": w["sub"], "title": "Test", "term": 1, "year": 2026, "max_marks": 100}).json()["id"]
        c.put(f"/api/v1/assessments/{aid}/marks", headers=t, json={"marks": [{"student_id": w["sid"], "marks_obtained": 78}]})
        d = c.post(f"/api/v1/ai/report-comment?student_id={w['sid']}&term=1&year=2026", headers=t).json()
        assert d["source"] == "rules" and "Ana" in d["draft"] and "Zed" not in d["draft"] and "Physics" in d["draft"]
        assert c.post(f"/api/v1/ai/report-comment?student_id={w['sid']}&term=1&year=2026", headers=p).status_code == 403


def test_people_admin(w):
    with TestClient(app) as c:
        a = H(c, "admin")
        assert c.post("/api/v1/users", headers=a, json={"username": "new", "full_name": "New", "role": "teacher", "phone": "0771"}).status_code == 422
        r = c.post("/api/v1/users", headers=a, json={"username": "new1", "full_name": "New One", "role": "teacher", "phone": "+263771234567"}).json()
        login = c.post("/api/v1/auth/login", data={"username": "new1", "password": r["temporary_password"]}).json()
        assert login["must_change_password"] is True
        h = {"Authorization": f"Bearer {login['access_token']}"}
        assert c.post("/api/v1/auth/change-password", headers=h, json={"current_password": "wrong", "new_password": "Longer-pass1"}).status_code == 400
        assert c.post("/api/v1/auth/change-password", headers=h, json={"current_password": r["temporary_password"], "new_password": "Longer-pass1"}).status_code == 200
        xl = b"admission_no,first_name,last_name,gender,class\nN1,Kay,Moyo,f,3 Blue\nS1,Dup,Dup,M,3 Blue\nN2,Lee,Ndlovu,M,9 Nope\n"
        r = c.post("/api/v1/students/import", headers=a, files={"file": ("s.csv", xl)}).json()
        assert r["created"] == 1 and len(r["errors"]) == 2
        p = c.post(f"/api/v1/classes/{w['k1']}/promote", headers=a, json={"target_class_id": w["k2"], "repeat_student_ids": [w["sid2"]]}).json()
        assert p["promoted"] == 2 and p["repeating"] == 1        # Ana + Kay moved, Ben repeats
        assert c.post(f"/api/v1/classes/{w['k2']}/promote", headers=a, json={"target_class_id": w["k1"]}).status_code == 422


def test_login_lockout_is_per_user(w):
    with TestClient(app) as c:
        for _ in range(5):
            assert c.post("/api/v1/auth/login", data={"username": "teacher", "password": "bad"}).status_code == 401
        assert c.post("/api/v1/auth/login", data={"username": "teacher", "password": "pw"}).status_code == 429
        assert c.post("/api/v1/auth/login", data={"username": "student", "password": "pw"}).status_code == 200  # others unaffected
