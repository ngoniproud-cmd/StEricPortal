import io
import zipfile
from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.config import settings
from app.db import engine
from app.main import app
from app.models import *  # noqa
from app.security import hash_password

PDF = b"%PDF-1.4 x"


@pytest.fixture()
def w():
    from app.routers.auth import _fails; _fails.clear()
    from app.routers import enrolment; enrolment._hits.clear()
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    with Session(engine) as db:
        us = {r: User(username=r, password_hash=hash_password("pw"), full_name=r.title(), role=r, phone="+263771000001" if r == "parent" else None)
              for r in ("admin", "teacher", "teacher2", "student", "parent", "parent2")}
        us["teacher2"].role = "teacher"; us["parent2"].role = "parent"
        db.add_all(us.values())
        f4, f1, f5 = ClassGroup(name="4 Blue", form=4, year=2026), ClassGroup(name="1 Red", form=1, year=2026), ClassGroup(name="5 Arts", form=5, year=2026)
        eng, mat, phy = Subject(name="English Language", level="O"), Subject(name="Mathematics", level="O"), Subject(name="Physics", level="O")
        db.add_all([f4, f1, f5, eng, mat, phy]); db.flush()
        a, b = (Student(admission_no="S1", first_name="Ana", last_name="Zed", class_id=f4.id, user_id=us["student"].id),
                Student(admission_no="S2", first_name="Ben", last_name="Yao", class_id=f4.id))
        db.add_all([a, b]); db.flush()
        db.add_all([TeacherAssignment(teacher_id=us["teacher"].id, class_id=f4.id, subject_id=phy.id), StudentGuardian(student_id=a.id, user_id=us["parent"].id),
                    StudentGuardian(student_id=b.id, user_id=us["parent2"].id)])
        db.commit()
        return {"f4": str(f4.id), "f1": str(f1.id), "f5": str(f5.id), "eng": str(eng.id), "mat": str(mat.id), "phy": str(phy.id),
                "a": str(a.id), "b": str(b.id), "t": str(us["teacher"].id), "t2": str(us["teacher2"].id)}


def H(c, u):
    return {"Authorization": "Bearer " + c.post("/api/v1/auth/login", data={"username": u, "password": "pw"}).json()["access_token"]}


def due(days=3):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def test_assignments_flow(w):
    with TestClient(app) as c:
        t, s, p = H(c, "teacher"), H(c, "student"), H(c, "parent")
        f = {"class_id": w["f4"], "subject_id": w["phy"], "title": "Lab report", "due_at": due(), "max_marks": "20"}
        assert c.post("/api/v1/assignments", headers=H(c, "teacher2"), data=f).status_code == 403   # not assigned
        r = c.post("/api/v1/assignments", headers=t, data=f, files={"file": ("brief.pdf", PDF)}); assert r.status_code == 201; aid = r.json()["id"]
        assert c.get("/api/v1/notifications", headers=s).json()["unread"] == 1
        assert c.get(f"/api/v1/assignments/{aid}/attachment", headers=s).content == PDF
        assert c.post(f"/api/v1/assignments/{aid}/submit", headers=s, data={}).status_code == 422
        assert c.post(f"/api/v1/assignments/{aid}/submit", headers=t, data={"text": "x"}).status_code == 403
        r = c.post(f"/api/v1/assignments/{aid}/submit", headers=s, data={"text": "My answer"}, files={"file": ("work.pdf", PDF)}); assert r.json()["late"] is False
        assert c.post(f"/api/v1/assignments/{aid}/submit", headers=s, data={"text": "v2"}).status_code == 200   # resubmit before marking
        rows = c.get(f"/api/v1/assignments/{aid}/submissions", headers=t).json()["rows"]
        by = {x["name"]: x for x in rows}; assert by["Ana Zed"]["submitted"] and not by["Ben Yao"]["submitted"] and by["Ana Zed"]["text"] == "v2"
        assert c.get(f"/api/v1/assignments/{aid}/submissions/{w['a']}/file", headers=t).content == PDF
        assert c.get(f"/api/v1/assignments/{aid}/submissions", headers=H(c, "teacher2")).status_code == 403
        assert c.put(f"/api/v1/assignments/{aid}/submissions/{w['a']}/mark", headers=t, json={"mark": 25}).status_code == 422
        assert c.put(f"/api/v1/assignments/{aid}/submissions/{w['a']}/mark", headers=t, json={"mark": 16, "feedback": "Good"}).status_code == 200
        assert c.post(f"/api/v1/assignments/{aid}/submit", headers=s, data={"text": "v3"}).status_code == 423
        mine = c.get("/api/v1/assignments", headers=p).json()
        assert mine[0]["submission"]["mark"] == 16 and mine[0]["student"]["name"] == "Ana Zed"
        assert c.get("/api/v1/assignments", headers=H(c, "parent2")).json()[0]["submission"] is None   # other parent sees own child only
        r = c.post(f"/api/v1/assignments/{aid}/to-assessment?term=1&year=2026", headers=t).json(); assert r["saved"] == 1
        sheet = {x["name"]: x for x in c.get(f"/api/v1/assessments/{r['assessment_id']}/sheet", headers=t).json()["rows"]}
        assert sheet["Ana Zed"]["grade"] == "A" and sheet["Ben Yao"]["grade"] is None   # 80% O-Level


def test_late_flag_and_planner(w):
    with TestClient(app) as c:
        t, s = H(c, "teacher"), H(c, "student")
        aid = c.post("/api/v1/assignments", headers=t, data={"class_id": w["f4"], "subject_id": w["phy"], "title": "Old work", "due_at": due(-1)}).json()["id"]
        assert c.post(f"/api/v1/assignments/{aid}/submit", headers=s, data={"text": "late"}).json()["late"] is True
        day = date.today() + timedelta(days=1)
        monday = day - timedelta(days=day.weekday())
        for i in range(3):
            c.post("/api/v1/assignments", headers=t, data={"class_id": w["f4"], "subject_id": w["phy"], "title": f"HW {i}", "due_at": datetime.combine(day, datetime.min.time()).replace(hour=12, tzinfo=timezone.utc).isoformat()})
        pl = c.get(f"/api/v1/assignments/planner?class_id={w['f4']}&week_start={monday}", headers=t).json()
        assert pl["warnings"] and any(d["overloaded"] for d in pl["days"])
        r = c.post(f"/api/v1/assignments/{aid}/to-assessment?term=1&year=2026", headers=t); assert r.status_code == 422   # no 'out of'


def test_enrolment(w):
    with TestClient(app) as c:
        form = {"first_name": "Nia", "last_name": "Dube", "gender": "F", "date_of_birth": "2014-05-01", "intake_form": "1", "guardian_name": "Mrs Dube", "guardian_phone": "+263772223334"}
        assert c.post("/api/v1/public/applications", data={**form, "website": "spam"}).json()["reference"].endswith("000000")
        assert c.post("/api/v1/public/applications", data={**form, "guardian_phone": "0772"}).status_code == 422
        assert c.post("/api/v1/public/applications", data={**form, "intake_form": "3"}).status_code == 422
        assert c.post("/api/v1/public/applications", data=form, files={"birth_cert": ("x.exe", b"MZ")}).status_code == 422
        r = c.post("/api/v1/public/applications", data=form, files={"birth_cert": ("bc.pdf", PDF)}); ref = r.json()["reference"]
        assert c.get("/api/v1/public/applications/status", params={"reference": ref, "phone": "+263000"}).status_code == 404
        assert c.get("/api/v1/public/applications/status", params={"reference": ref, "phone": "+263772223334"}).json()["status"] == "received"
        a = H(c, "admin"); q = c.get("/api/v1/applications", headers=a).json(); assert len(q) == 1 and q[0]["has_birth_cert"]
        assert c.get("/api/v1/applications", headers=H(c, "teacher")).status_code == 403
        assert c.get(f"/api/v1/applications/{q[0]['id']}/file/birth_cert", headers=a).content == PDF
        assert c.post(f"/api/v1/applications/{q[0]['id']}/accept", headers=a, json={"class_id": w["f4"]}).status_code == 422   # wrong form
        r = c.post(f"/api/v1/applications/{q[0]['id']}/accept", headers=a, json={"class_id": w["f1"]}).json()
        assert r["admission_no"] == "SE2026001" and r["temporary_password"]
        assert c.post(f"/api/v1/applications/{q[0]['id']}/accept", headers=a, json={"class_id": w["f1"]}).status_code == 409
        login = c.post("/api/v1/auth/login", data={"username": r["parent_username"], "password": r["temporary_password"]}).json(); assert login["must_change_password"]
        for _ in range(6):
            c.post("/api/v1/public/applications", data=form)
        assert c.post("/api/v1/public/applications", data=form).status_code == 429


def test_calendar_and_timetable(w):
    with TestClient(app) as c:
        a, p = H(c, "admin"), H(c, "parent")
        d = date.today() + timedelta(days=5)
        c.post("/api/v1/calendar", headers=a, json={"title": "Whole school sports", "kind": "sports", "start_date": str(d)})
        c.post("/api/v1/calendar", headers=a, json={"title": "Form 5 trip", "start_date": str(d), "form": 5})
        c.post("/api/v1/calendar", headers=a, json={"title": "Form 4 exam", "kind": "exam", "start_date": str(d), "form": 4})
        assert c.post("/api/v1/calendar", headers=a, json={"title": "Bad", "start_date": str(d), "end_date": str(d - timedelta(days=1))}).status_code == 422
        assert c.post("/api/v1/calendar", headers=p, json={"title": "x", "start_date": str(d)}).status_code == 403
        assert sorted(e["title"] for e in c.get("/api/v1/calendar", headers=p).json()) == ["Form 4 exam", "Whole school sports"]
        assert len(c.get("/api/v1/calendar", headers=a).json()) == 3
        ics = c.get("/api/v1/calendar/ics", headers=p).text
        assert ics.startswith("BEGIN:VCALENDAR") and "SUMMARY:Whole school sports" in ics and "Form 5 trip" not in ics
        slot = {"class_id": w["f4"], "subject_id": w["phy"], "teacher_id": w["t"], "day": 1, "period": 1, "room": "Lab 1"}
        assert c.post("/api/v1/timetable", headers=a, json=slot).status_code == 201
        assert "already has a lesson" in c.post("/api/v1/timetable", headers=a, json=slot).json()["detail"]
        assert "teaching" in c.post("/api/v1/timetable", headers=a, json={**slot, "class_id": w["f1"], "room": "Lab 2"}).json()["detail"]
        assert "Room" in c.post("/api/v1/timetable", headers=a, json={**slot, "class_id": w["f1"], "teacher_id": w["t2"]}).json()["detail"]
        assert c.post("/api/v1/timetable", headers=a, json={**slot, "class_id": w["f1"], "teacher_id": w["t2"], "room": "Lab 9"}).status_code == 201
        assert c.get("/api/v1/timetable/mine", headers=p).json()[0]["slots"][0]["subject"] == "Physics"
        assert c.get(f"/api/v1/timetable/class/{w['f1']}", headers=p).status_code == 403
        assert c.get("/api/v1/timetable/mine", headers=H(c, "teacher")).json()[0]["slots"][0]["class"] == "4 Blue"


def test_notices_consent(w):
    with TestClient(app) as c:
        t, p, p2, a = H(c, "teacher"), H(c, "parent"), H(c, "parent2"), H(c, "admin")
        assert c.post("/api/v1/notices", headers=t, json={"title": "School trip", "body": "Zoo trip"}).status_code == 403   # teachers: class only
        nid = c.post("/api/v1/notices", headers=t, json={"title": "Zoo trip", "body": "Permission please", "class_id": w["f4"], "deadline": str(date.today() + timedelta(days=2))}).json()["id"]
        assert c.get("/api/v1/notifications", headers=p).json()["unread"] == 1
        assert c.post(f"/api/v1/notices/{nid}/respond", headers=p, json={"student_id": w["b"], "response": "agree"}).status_code == 403   # not their child
        assert c.post(f"/api/v1/notices/{nid}/respond", headers=p, json={"student_id": w["a"], "response": "maybe"}).status_code == 422
        assert c.post(f"/api/v1/notices/{nid}/respond", headers=H(c, "student"), json={"student_id": w["a"], "response": "agree"}).status_code == 403
        assert c.post(f"/api/v1/notices/{nid}/respond", headers=p, json={"student_id": w["a"], "response": "agree"}).status_code == 200
        assert c.post(f"/api/v1/notices/{nid}/respond", headers=p, json={"student_id": w["a"], "response": "decline"}).status_code == 200   # may change mind
        n = c.get("/api/v1/notices", headers=t).json()[0]; assert (n["agree"], n["decline"], n["waiting"]) == (0, 1, 1)
        assert c.get(f"/api/v1/notices/{nid}/tally", headers=H(c, "teacher2")).status_code == 404
        assert c.post(f"/api/v1/notices/{nid}/remind", headers=t).json()["reminded"] == 1
        assert c.get("/api/v1/notices", headers=p).json()[0]["response"] == "decline"
        assert c.post("/api/v1/notices", headers=a, json={"title": "Past", "body": "old", "deadline": "2000-01-01"}).status_code == 422
        with Session(engine) as db:
            db.get(Notice, __import__("uuid").UUID(nid)).deadline = date.today() - timedelta(days=1); db.commit()
        assert "deadline" in c.post(f"/api/v1/notices/{nid}/respond", headers=p2, json={"student_id": w["b"], "response": "agree"}).json()["detail"]


def test_candidates_and_fees(w):
    with TestClient(app) as c:
        a = H(c, "admin")
        assert c.post("/api/v1/candidates", headers=a, json={"student_id": w["a"], "year": 2026, "subject_ids": [w["phy"]]}).status_code == 201
        assert c.post("/api/v1/candidates", headers=a, json={"student_id": w["a"], "year": 2026}).status_code == 409
        assert c.post("/api/v1/candidates", headers=a, json={"student_id": w["a"], "year": 2027, "subject_ids": [w["phy"], w["phy"]]}).status_code == 422
        c.post("/api/v1/candidates", headers=a, json={"student_id": w["b"], "year": 2026, "candidate_number": "777", "subject_ids": [w["eng"], w["mat"]]})
        rows = {r["name"]: r for r in c.get("/api/v1/candidates?year=2026", headers=a).json()}
        assert "Missing English Language" in rows["Ana Zed"]["issues"] and "Missing Mathematics" in rows["Ana Zed"]["issues"]
        assert rows["Ben Yao"]["issues"] == []
        assert c.post("/api/v1/candidates", headers=H(c, "teacher"), json={"student_id": w["a"], "year": 2030}).status_code == 403
        csv_ = b"external_student_id,external_fee_id,fee_type,currency,amount_due,amount_paid\nS1,F1,Tuition,USD,300,100\nS2,F2,Tuition,USD,300,300\nS2,F3,Levy,ZWG,abc,0\n"
        r = c.post("/api/v1/fees/import", headers=a, files={"file": ("f.csv", csv_)}).json(); assert r["created"] == 2 and len(r["errors"]) == 1
        r = c.post("/api/v1/fees/import", headers=a, files={"file": ("f.csv", csv_)}).json(); assert r["updated"] == 2
        assert c.patch(f"/api/v1/candidates/{rows['Ana Zed']['id']}", headers=a, json={"status": "fee_cleared"}).status_code == 422   # owes US$200
        assert c.patch(f"/api/v1/candidates/{rows['Ben Yao']['id']}", headers=a, json={"status": "fee_cleared"}).status_code == 200
        me = c.get("/api/v1/fees/mine", headers=H(c, "parent")).json()
        assert len(me) == 1 and me[0]["balance"] == {"USD": 200.0} and me[0]["records"][0]["status"] == "part_paid"
        assert c.get("/api/v1/fees/mine", headers=a).status_code == 403
        assert c.post("/api/v1/fees/sync", headers=a).status_code == 400   # not configured: clear message
        import os, sqlalchemy
        fake = sqlalchemy.create_engine("sqlite:///./fakefee.db")
        with fake.begin() as cx:
            cx.execute(sqlalchemy.text("DROP TABLE IF EXISTS fee"))
            cx.execute(sqlalchemy.text("CREATE TABLE fee (sid TEXT, fid TEXT, t TEXT, cur TEXT, due REAL, paid REAL)"))
            cx.execute(sqlalchemy.text("INSERT INTO fee VALUES ('S1','F9','Boarding','USD',50,50)"))
        settings.FEE_SYSTEM_DB_URL = "sqlite:///./fakefee.db"
        settings.FEE_SYSTEM_QUERY = "SELECT sid AS external_student_id, fid AS external_fee_id, t AS fee_type, cur AS currency, due AS amount_due, paid AS amount_paid FROM fee"
        try:
            assert c.post("/api/v1/fees/sync", headers=a).json()["created"] == 1
            settings.FEE_SYSTEM_QUERY = "DELETE FROM fee"
            assert c.post("/api/v1/fees/sync", headers=a).status_code == 500   # never runs anything but SELECT
        finally:
            fake.dispose()
            settings.FEE_SYSTEM_DB_URL = settings.FEE_SYSTEM_QUERY = ""
            try:
                os.remove("fakefee.db")
            except OSError:
                pass


def test_setup_grading_audit_zip(w):
    with TestClient(app) as c:
        a, t = H(c, "admin"), H(c, "teacher")
        assert c.post("/api/v1/classes", headers=a, json={"name": "4 Blue", "form": 4, "year": 2026}).status_code == 409
        cid = c.post("/api/v1/classes", headers=a, json={"name": "2 Green", "form": 2, "year": 2026}).json()["id"]
        assert c.delete(f"/api/v1/classes/{w['f4']}", headers=a).status_code == 409   # still has learners
        assert c.delete(f"/api/v1/classes/{cid}", headers=a).status_code == 200
        assert c.post("/api/v1/subjects", headers=a, json={"name": "Shona", "zimsec_code": "3159", "level": "O"}).status_code == 201
        assert c.post("/api/v1/teacher-assignments", headers=a, json={"teacher_id": w["t"], "class_id": w["f4"], "subject_id": w["phy"]}).status_code == 409
        assert c.post("/api/v1/teacher-assignments", headers=a, json={"teacher_id": w["t2"], "class_id": w["f4"], "subject_id": w["mat"]}).status_code == 201
        assert c.patch("/api/v1/users/" + w["t2"] + "/status", headers=a, json={"status": "inactive"}).status_code == 200
        assert c.post("/api/v1/auth/login", data={"username": "teacher2", "password": "pw"}).status_code == 401
        assert len(c.get(f"/api/v1/students/{w['a']}/guardians", headers=a).json()) == 1
        # grading editor
        cur = c.get("/api/v1/grading/A", headers=t).json(); assert cur["custom"] is False and cur["bands"][3] == {"grade": "D", "min_pct": 45, "max_pct": 49, "points": 2, "remark": "Satisfactory"}
        bad = [dict(b) for b in cur["bands"]]; bad[3]["min_pct"] = 46
        assert c.put("/api/v1/grading/A", headers=a, json=bad).status_code == 422
        assert c.put("/api/v1/grading/A", headers=t, json=cur["bands"]).status_code == 403
        good = [dict(b) for b in cur["bands"]]; good[0]["min_pct"] = 75; good[1]["max_pct"] = 74; good[1]["min_pct"] = 65; good[2]["max_pct"] = 64; good[2]["min_pct"] = 55; good[3]["max_pct"] = 54
        assert c.put("/api/v1/grading/A", headers=a, json=good).status_code == 200
        assert c.get("/api/v1/grading/A", headers=a).json()["custom"] is True
        # audit + class zip
        aid = c.post("/api/v1/assessments", headers=t, json={"class_id": w["f4"], "subject_id": w["phy"], "title": "T1", "term": 1, "year": 2026, "max_marks": 100}).json()["id"]
        c.put(f"/api/v1/assessments/{aid}/marks", headers=t, json={"marks": [{"student_id": w["a"], "marks_obtained": 60}]})
        c.put(f"/api/v1/assessments/{aid}/marks", headers=t, json={"marks": [{"student_id": w["a"], "marks_obtained": 65, "reason": "Recount"}]})
        log = c.get("/api/v1/audit", headers=a).json(); assert log[0]["reason"] == "Recount" and "Ana Zed" in log[0]["what"]
        assert c.get("/api/v1/audit", headers=t).status_code == 403
        z = c.get(f"/api/v1/report-cards/class/{w['f4']}/zip?term=1&year=2026", headers=a)
        names = zipfile.ZipFile(io.BytesIO(z.content)).namelist(); assert len(names) == 2 and all(n.endswith(".pdf") for n in names)
