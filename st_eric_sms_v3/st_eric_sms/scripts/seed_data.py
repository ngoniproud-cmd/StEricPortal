"""Demo data: python scripts/seed_data.py  (run from backend/ or via docker compose exec api)"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "backend"))
from sqlalchemy.orm import Session
from app.db import engine
from app.grading import DEFAULT_BANDS
from app.models import *  # noqa
from datetime import date, timedelta
from app.security import hash_password

with Session(engine) as db:
    if db.query(User).first():
        sys.exit("Already seeded.")
    pw = hash_password("ChangeMe123!")
    admin = User(username="admin", password_hash=pw, full_name="School Admin", role="admin")
    teacher = User(username="teacher", password_hash=pw, full_name="Mr Moyo", role="teacher")
    parent = User(username="parent", password_hash=pw, full_name="Mrs Ncube", role="parent", phone="+263771234567")
    librarian = User(username="librarian", password_hash=pw, full_name="Mrs Chuma (Librarian)", role="librarian")
    pupil = User(username="student", password_hash=pw, full_name="Tendai Ncube", role="student")
    db.add_all([librarian, pupil])
    k = ClassGroup(name="4 Blue", form=4, year=2026)
    subs = [Subject(name=n, level="O") for n in ("Mathematics", "English Language", "Integrated Science", "Shona")]
    db.add_all([admin, teacher, parent, k, *subs]); db.flush()
    kids = [Student(admission_no=f"SE26{i:03}", first_name=f, last_name=l, class_id=k.id)
            for i, (f, l) in enumerate([("Tendai", "Ncube"), ("Rudo", "Chikore"), ("Blessing", "Dube"), ("Farai", "Sibanda")], 1)]
    db.add_all(kids); db.flush()
    kids[0].user_id = pupil.id
    db.add(StudentGuardian(student_id=kids[0].id, user_id=parent.id))
    for s in subs:
        db.add(TeacherAssignment(teacher_id=teacher.id, class_id=k.id, subject_id=s.id))
        db.add(Assessment(class_id=k.id, subject_id=s.id, title="Term 1 Test 1", term=1, year=2026, max_marks=50))
    for lvl, bands in DEFAULT_BANDS.items():
        db.add_all(GradingBand(level=lvl, grade=b.grade, min_pct=b.min_pct, max_pct=b.max_pct, points=b.points, remark=b.remark) for b in bands)
    db.flush()
    for a in db.query(Assessment).all():          # demo marks so dashboards and report cards have data
        for kid, m in zip(kids, (41, 33, 27, 18)):
            db.add(Mark(assessment_id=a.id, student_id=kid.id, marks_obtained=m, entered_by=teacher.id))
    y = date.today().year
    for title, kind, a, b in (("Term 1", "term", date(y, 1, 12), date(y, 4, 17)), ("Term 2", "term", date(y, 5, 5), date(y, 8, 7)), ("Term 3", "term", date(y, 9, 8), date(y, 12, 4))):
        db.add(CalendarEvent(title=title, kind=kind, start_date=a, end_date=b))
    db.add(CalendarEvent(title="Inter-house athletics", kind="sports", start_date=date.today() + timedelta(days=12)))
    db.add(CalendarEvent(title="Form 4 mock examinations begin", kind="exam", start_date=date.today() + timedelta(days=20), form=4))
    db.add(Notice(title="Science museum trip", body="Form 4 Blue visit the science museum on Friday. Cost US$5. Please bring a packed lunch.", class_id=k.id,
                  deadline=date.today() + timedelta(days=7), created_by=teacher.id))
    for i, sub in enumerate(subs[:4]):
        db.add(TimetableSlot(class_id=k.id, subject_id=sub.id, teacher_id=teacher.id, day=i + 1, period=1, room=f"Room {i + 1}"))
    db.add(FeeRecord(external_student_id=kids[0].admission_no, external_fee_id="DEMO-T1", fee_type="Tuition", currency="USD", amount_due=250, amount_paid=150, balance=100, status="part_paid"))
    db.add(Announcement(title="Welcome to St Eric Online", body="Results, library and school news are now in one place.", audience="all", published_by=admin.id))
    db.commit()
print("Seeded. Logins: admin / teacher / librarian / student / parent  — password ChangeMe123!  (change immediately)")
