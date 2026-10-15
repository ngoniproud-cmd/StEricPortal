"""Term report card: weighted average per subject -> ZIMSEC grade -> PDF."""
import base64, hashlib, hmac, io
import uuid
from collections import defaultdict
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.grading import DEFAULT_BANDS, band_for, is_pass, level_for_form
from app.models import (Assessment, ClassGroup, Mark, ReportComment, Student, Subject)
from app.routers.marks import bands_for


def subject_averages(db: Session, student_id: uuid.UUID, term: int, year: int) -> dict[uuid.UUID, float]:
    rows = db.execute(select(Mark, Assessment).join(Assessment, Mark.assessment_id == Assessment.id).where(
        Mark.student_id == student_id, Assessment.term == term, Assessment.year == year,
        Mark.marks_obtained.is_not(None))).all()
    acc = defaultdict(lambda: [0.0, 0.0])
    for m, a in rows:
        acc[a.subject_id][0] += m.marks_obtained / a.max_marks * 100 * a.weight
        acc[a.subject_id][1] += a.weight
    return {sid: tot / w for sid, (tot, w) in acc.items() if w}


def build_report(db: Session, student_id: uuid.UUID, term: int, year: int) -> dict:
    st = db.get(Student, student_id)
    klass = db.get(ClassGroup, st.class_id)
    level = level_for_form(klass.form)
    bands = bands_for(db, level)
    avgs = subject_averages(db, student_id, term, year)
    subjects = {s.id: s for s in db.scalars(select(Subject).where(Subject.id.in_(avgs.keys())))} if avgs else {}
    rows = []
    for sid, pct in sorted(avgs.items(), key=lambda kv: subjects[kv[0]].name):
        b = band_for(pct, level, bands)
        rows.append({"subject": subjects[sid].name, "percent": round(pct), "grade": b.grade,
                     "remark": b.remark, "points": b.points, "passed": is_pass(b.grade, level)})
    overall = round(sum(r["percent"] for r in rows) / len(rows)) if rows else 0
    # class position by overall average
    mates = db.scalars(select(Student.id).where(Student.class_id == st.class_id, Student.status == "active")).all()
    totals = []
    for mid in mates:
        v = list(subject_averages(db, mid, term, year).values())
        if v:
            totals.append((mid, sum(v) / len(v)))
    totals.sort(key=lambda t: -t[1])
    pos = next((i + 1 for i, (mid, _) in enumerate(totals) if mid == student_id), None)
    c = db.scalar(select(ReportComment).where(ReportComment.student_id == student_id,
                                              ReportComment.term == term, ReportComment.year == year))
    return {"school": settings, "student": st, "klass": klass, "level": level, "term": term, "year": year,
            "rows": rows, "overall": overall, "position": pos, "class_size": len(totals),
            "class_teacher_comment": c.class_teacher_comment if c else "",
            "head_comment": c.head_comment if c else "", "qr": qr_data_uri(student_id, term, year), "bands": bands or DEFAULT_BANDS[level]}


def render_pdf(data: dict) -> bytes:
    from weasyprint import HTML  # imported lazily: needs system libs
    env = Environment(loader=FileSystemLoader(Path(__file__).parent / "templates"),
                      autoescape=select_autoescape(["html"]))
    return HTML(string=env.get_template("report_card.html").render(**data)).write_pdf()


def sign(student_id: uuid.UUID, term: int, year: int) -> str:
    msg = f"{student_id}:{term}:{year}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()[:20]


def verify_signature(student_id: uuid.UUID, term: int, year: int, sig: str) -> bool:
    return hmac.compare_digest(sign(student_id, term, year), sig)


def qr_data_uri(student_id: uuid.UUID, term: int, year: int) -> str:
    import qrcode
    url = f"{settings.PUBLIC_URL}/verify/{student_id}/{term}/{year}/{sign(student_id, term, year)}"
    buf = io.BytesIO()
    qrcode.make(url, box_size=4, border=1).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
