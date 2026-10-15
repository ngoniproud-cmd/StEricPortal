"""Early-warning insights. Transparent arithmetic (no black box): teachers can see exactly why a learner is flagged."""
import uuid
from collections import defaultdict
from datetime import date, timedelta
from statistics import mean
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Assessment, Attendance, ClassGroup, Mark, Student, Subject
from app.grading import level_for_form

PASS_PCT = {"O": 50, "A": 40}
RISK_ORDER = {"high": 0, "medium": 1, "low": 2}


def attendance_rate(db: Session, student_id: uuid.UUID, days: int = 30) -> float | None:
    rows = db.scalars(select(Attendance.status).where(Attendance.student_id == student_id,
                                                      Attendance.day >= date.today() - timedelta(days=days))).all()
    counted = [r for r in rows if r != "excused"]
    if not counted:
        return None
    return round(100 * sum(r in ("present", "late") for r in counted) / len(counted))


def class_insights(db: Session, class_id: uuid.UUID, term: int, year: int) -> list[dict]:
    level = level_for_form(db.get(ClassGroup, class_id).form)
    students = db.scalars(select(Student).where(Student.class_id == class_id, Student.status == "active")).all()
    subjects = {s.id: s.name for s in db.scalars(select(Subject))}
    series: dict = defaultdict(lambda: defaultdict(list))
    q = select(Mark, Assessment).join(Assessment, Mark.assessment_id == Assessment.id).where(
        Assessment.class_id == class_id, Assessment.term == term, Assessment.year == year,
        Mark.marks_obtained.is_not(None)).order_by(Assessment.created_at)
    for m, a in db.execute(q):
        series[m.student_id][a.subject_id].append(m.marks_obtained / a.max_marks * 100)
    out = []
    for st in students:
        flags, failing = [], 0
        for sid, pcts in series[st.id].items():
            if mean(pcts) < PASS_PCT[level]:
                failing += 1
                flags.append(f"Below pass mark in {subjects[sid]} ({round(mean(pcts))}%)")
            if len(pcts) >= 3 and mean(pcts[-2:]) <= mean(pcts[:-2]) - 10:
                flags.append(f"{subjects[sid]} is dropping: {round(mean(pcts[:-2]))}% earlier, {round(mean(pcts[-2:]))}% recently")
        rate = attendance_rate(db, st.id)
        if rate is not None and rate < 80:
            flags.append(f"Attendance {rate}% over the last 30 days")
        risk = "high" if failing >= 2 or (rate is not None and rate < 70) else "medium" if flags else "low"
        out.append({"student_id": st.id, "name": st.full_name, "risk": risk, "flags": flags, "attendance": rate})
    return sorted(out, key=lambda r: (RISK_ORDER[r["risk"]], r["name"]))
