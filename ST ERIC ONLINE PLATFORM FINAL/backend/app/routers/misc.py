"""Announcements, notifications, attendance, insights, AI drafts, dashboards."""
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session
from app.ai import draft_comment
from app.db import get_db
from app.deps import current_user, require_roles
from app.insights import attendance_rate, class_insights
from app.models import (Announcement, Assessment, Attendance, ClassGroup, FeeRecord, LibraryItem, Mark, Notification,
                        ReportComment, Student, StudentGuardian, Subject, TeacherAssignment, User)
from app.notifications import family_user_ids, notify, users_with_role
from app.report_card import build_report
from app.routers.reports import children_of

router = APIRouter(tags=["school"])
staff = require_roles("teacher", "admin")


# ---------- announcements (one-way) ----------
class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=5000)
    audience: str = Field("all", pattern="^(all|students|parents|teachers)$")


@router.post("/announcements", status_code=201)
def post_announcement(b: AnnouncementIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    if user.role == "teacher" and b.audience in ("all", "teachers"):
        raise HTTPException(403, "Teachers can post to students or parents. School-wide notices come from the office.")
    a = Announcement(title=b.title.strip(), body=b.body.strip(), audience=b.audience, published_by=user.id)
    db.add(a)
    roles = {"all": ("student", "parent", "teacher"), "students": ("student",), "parents": ("parent",), "teachers": ("teacher",)}[b.audience]
    notify(db, users_with_role(db, *roles), a.title, a.body[:140], "/announcements")
    db.commit()
    return {"id": a.id}


@router.get("/announcements")
def list_announcements(db: Session = Depends(get_db), user: User = Depends(current_user)):
    mine = {"student": "students", "parent": "parents", "teacher": "teachers"}.get(user.role)
    stmt = select(Announcement).where(Announcement.status == "published")
    if user.role != "admin":
        stmt = stmt.where(Announcement.audience.in_(["all", mine]))
    names = {u.id: u.full_name for u in db.scalars(select(User))}
    return [{"id": a.id, "title": a.title, "body": a.body, "audience": a.audience, "by": names.get(a.published_by),
             "created_at": a.created_at} for a in db.scalars(stmt.order_by(Announcement.created_at.desc()).limit(50))]


# ---------- notifications ----------
@router.get("/notifications")
def my_notifications(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(30)).all()
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))) or 0
    return {"unread": unread, "items": [{"id": str(n.id), "title": n.title, "body": n.body, "link": n.link, "read": bool(n.is_read), "created_at": n.created_at} for n in rows]}


@router.post("/notifications/read-all")
def read_all(db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.execute(update(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False)).values(is_read=True))
    db.commit()
    return {"ok": True}


@router.post("/notifications/{nid}/read")
def read_one(nid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.execute(update(Notification).where(Notification.id == nid, Notification.user_id == user.id).values(is_read=True))
    db.commit()
    return {"ok": True}


@router.delete("/notifications/{nid}")
def delete_one(nid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.execute(delete(Notification).where(Notification.id == nid, Notification.user_id == user.id))
    db.commit()
    return {"ok": True}


@router.delete("/notifications")
def clear_all_notifications(db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.execute(delete(Notification).where(Notification.user_id == user.id))
    db.commit()
    return {"ok": True}


# ---------- attendance ----------
class RegisterRow(BaseModel):
    student_id: uuid.UUID
    status: str = Field(pattern="^(present|absent|late|excused)$")


def _can_mark(db: Session, user: User, class_id: uuid.UUID):
    if user.role == "teacher":
        ok = db.scalar(select(ClassGroup.id).where(ClassGroup.id == class_id, ClassGroup.class_teacher_id == user.id)) or \
             db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id == user.id, TeacherAssignment.class_id == class_id))
        if not ok:
            raise HTTPException(403, "This is not one of your classes.")


@router.get("/attendance/class/{class_id}")
def get_register(class_id: uuid.UUID, day: date | None = None, db: Session = Depends(get_db), user: User = Depends(staff)):
    _can_mark(db, user, class_id)
    day = day or date.today()
    saved = {a.student_id: a.status for a in db.scalars(select(Attendance).where(Attendance.day == day))}
    students = db.scalars(select(Student).where(Student.class_id == class_id, Student.status == "active").order_by(Student.last_name, Student.first_name)).all()
    return {"day": day, "rows": [{"student_id": s.id, "name": s.full_name, "admission_no": s.admission_no, "status": saved.get(s.id, "present")} for s in students],
            "already_marked": any(s.id in saved for s in students)}


@router.put("/attendance/class/{class_id}")
def save_register(class_id: uuid.UUID, rows: list[RegisterRow], day: date | None = None, db: Session = Depends(get_db), user: User = Depends(staff)):
    _can_mark(db, user, class_id)
    day = day or date.today()
    if day > date.today():
        raise HTTPException(422, "You cannot mark attendance for a future date.")
    valid = set(db.scalars(select(Student.id).where(Student.class_id == class_id)))
    existing = {a.student_id: a for a in db.scalars(select(Attendance).where(Attendance.day == day, Attendance.student_id.in_(valid)))}
    newly_absent = []
    for r in rows:
        if r.student_id not in valid:
            raise HTTPException(422, "A student in the list is not in this class.")
        a = existing.get(r.student_id)
        if a:
            if a.status != "absent" and r.status == "absent":
                newly_absent.append(r.student_id)
            a.status, a.marked_by = r.status, user.id
        else:
            db.add(Attendance(student_id=r.student_id, day=day, status=r.status, marked_by=user.id))
            if r.status == "absent":
                newly_absent.append(r.student_id)
    for sid in newly_absent:
        st = db.get(Student, sid)
        notify(db, family_user_ids(db, [sid]), f"{st.first_name} was marked absent", day.strftime("%d/%m/%Y"), "/attendance")
    db.commit()
    return {"saved": len(rows), "absent": len(newly_absent)}


# ---------- insights + AI ----------
@router.get("/insights/class/{class_id}")
def insights(class_id: uuid.UUID, term: int, year: int, db: Session = Depends(get_db), user: User = Depends(staff)):
    _can_mark(db, user, class_id)
    return class_insights(db, class_id, term, year)


@router.post("/ai/report-comment")
def ai_comment(student_id: uuid.UUID, term: int, year: int, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Returns a DRAFT. Nothing is saved until the teacher edits and saves it."""
    st = db.get(Student, student_id)
    if not st:
        raise HTTPException(404, "Student not found.")
    _can_mark(db, user, st.class_id)
    d = build_report(db, student_id, term, year)
    return draft_comment(st.first_name, d["level"], d["rows"], d["overall"], d["position"], d["class_size"], attendance_rate(db, student_id))


def top_students_per_form(db: Session, term: int = 3, year: int = 2026) -> list[dict]:
    """Computes best performing student per form (Forms 1 to 6)."""
    from app.report_card import subject_averages
    out = []
    for f in (1, 2, 3, 4, 5, 6):
        form_classes = db.scalars(select(ClassGroup.id).where(ClassGroup.form == f, ClassGroup.year == year, ClassGroup.status == "active")).all()
        if not form_classes:
            continue
        students = db.scalars(select(Student).where(Student.class_id.in_(form_classes), Student.status == "active")).all()
        best_st = None
        best_avg = -1.0
        for s in students:
            avgs = list(subject_averages(db, s.id, term, year).values())
            if avgs:
                avg = sum(avgs) / len(avgs)
                if avg > best_avg:
                    best_avg = avg
                    best_st = s
        if best_st and best_avg >= 0:
            c = db.get(ClassGroup, best_st.class_id)
            out.append({
                "form": f,
                "student_id": str(best_st.id),
                "student_name": best_st.full_name,
                "admission_no": best_st.admission_no,
                "class_name": c.name if c else f"Form {f}",
                "overall": round(best_avg),
            })
    return out


@router.get("/top-performers")
def list_top_performers(term: int = 3, year: int = 2026, db: Session = Depends(get_db), _: User = Depends(current_user)):
    return top_students_per_form(db, term, year)


# ---------- dashboards ----------
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)):
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))) or 0
    base = {"role": user.role, "name": user.full_name, "unread": unread}
    if user.role == "admin":
        today = date.today()
        marked = db.scalar(select(func.count()).select_from(Attendance).where(Attendance.day == today))
        present = db.scalar(select(func.count()).select_from(Attendance).where(Attendance.day == today, Attendance.status.in_(["present", "late"])))
        return {**base, "students": db.scalar(select(func.count()).select_from(Student).where(Student.status == "active")),
                "teachers": db.scalar(select(func.count()).select_from(User).where(User.role == "teacher", User.status == "active")),
                "attendance_today": round(100 * present / marked) if marked else None,
                "pending_uploads": db.scalar(select(func.count()).select_from(LibraryItem).where(LibraryItem.status == "pending")),
                "published_reports": db.scalar(select(func.count()).select_from(ReportComment).where(ReportComment.published.is_(True))),
                "top_performers": top_students_per_form(db, 3, 2026)}
    if user.role == "librarian":
        return {**base, "pending_uploads": db.scalar(select(func.count()).select_from(LibraryItem).where(LibraryItem.status == "pending")),
                "approved": db.scalar(select(func.count()).select_from(LibraryItem).where(LibraryItem.status == "approved"))}
    if user.role == "teacher":
        classes_count = db.scalar(select(func.count(func.distinct(TeacherAssignment.class_id))).where(TeacherAssignment.teacher_id == user.id))
        my_class_group = db.scalar(select(ClassGroup).where(ClassGroup.class_teacher_id == user.id, ClassGroup.status == "active"))
        my_class = None
        if my_class_group:
            student_count = db.scalar(select(func.count()).select_from(Student).where(Student.class_id == my_class_group.id, Student.status == "active"))
            my_class = {"id": str(my_class_group.id), "name": my_class_group.name, "form": my_class_group.form, "year": my_class_group.year, "students": student_count}
        ta_rows = db.execute(
            select(TeacherAssignment, ClassGroup.name.label("class_name"), ClassGroup.form, Subject.name.label("subject_name"))
            .join(ClassGroup, ClassGroup.id == TeacherAssignment.class_id)
            .join(Subject, Subject.id == TeacherAssignment.subject_id)
            .where(TeacherAssignment.teacher_id == user.id, ClassGroup.status == "active")
            .order_by(ClassGroup.form, ClassGroup.name)
        ).all()
        teaching = [{"class_id": str(ta.TeacherAssignment.class_id), "class_name": ta.class_name, "form": ta.form,
                     "subject_id": str(ta.TeacherAssignment.subject_id), "subject": ta.subject_name} for ta in ta_rows]
        return {**base, "classes": classes_count, "my_class": my_class, "teaching": teaching, "top_performers": top_students_per_form(db, 3, 2026)}
    if user.role == "hod":
        dept = user.department
        dept_teachers = db.scalar(select(func.count()).select_from(User).where(User.role == "teacher", User.department == dept, User.status == "active"))
        dept_subs = db.scalars(select(Subject.id).where(Subject.department == dept, Subject.status == "active")).all()
        dept_classes = db.scalar(select(func.count(func.distinct(TeacherAssignment.class_id))).where(TeacherAssignment.subject_id.in_(dept_subs))) if dept_subs else 0
        return {
            **base,
            "department": dept,
            "dept_teachers": dept_teachers,
            "dept_classes": dept_classes,
            "dept_subjects": len(dept_subs),
            "top_performers": top_students_per_form(db, 3, 2026),
        }
    kids = children_of(db, user)
    from app.routers.reports import has_cleared_fees
    children_data = []
    for k in kids:
        cleared, balances = has_cleared_fees(db, k)
        children_data.append({
            "id": k.id,
            "name": k.full_name,
            "admission_no": k.admission_no,
            "class": k.klass.name if k.klass else None,
            "attendance": attendance_rate(db, k.id),
            "fees_cleared": cleared,
            "fee_balance": balances,
        })
    return {
        **base,
        "children": children_data,
    }


# ═══════════════════════════════════════════════════════
# HEADMASTER ANALYTICS ENDPOINTS
# ═══════════════════════════════════════════════════════

@router.get("/analytics/enrollment-by-gender")
def analytics_enrollment_gender(year: int | None = None, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    """Enrollment breakdown by gender and form, for pie + bar charts."""
    stmt = select(Student.gender, ClassGroup.form, func.count().label("count")).join(
        ClassGroup, ClassGroup.id == Student.class_id
    ).where(Student.status == "active")
    if year:
        stmt = stmt.where(ClassGroup.year == year)
    stmt = stmt.group_by(Student.gender, ClassGroup.form).order_by(ClassGroup.form)
    rows = db.execute(stmt).all()
    total_m = sum(r.count for r in rows if r.gender == "M")
    total_f = sum(r.count for r in rows if r.gender == "F")
    total_other = sum(r.count for r in rows if r.gender not in ("M", "F"))
    by_form: dict[int, dict] = {}
    for r in rows:
        f = r.form
        if f not in by_form:
            by_form[f] = {"form": f, "male": 0, "female": 0, "total": 0}
        if r.gender == "M":
            by_form[f]["male"] += r.count
        elif r.gender == "F":
            by_form[f]["female"] += r.count
        by_form[f]["total"] += r.count
    return {
        "summary": {"male": total_m, "female": total_f, "other": total_other, "total": total_m + total_f + total_other},
        "by_form": sorted(by_form.values(), key=lambda x: x["form"]),
    }


@router.get("/analytics/fee-collection")
def analytics_fee_collection(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    """Monthly fee collection: collected vs outstanding."""
    from sqlalchemy import extract
    stmt = select(
        extract("month", FeeRecord.last_synced_at).label("month"),
        func.sum(FeeRecord.amount_paid).label("collected"),
        func.sum(FeeRecord.balance).label("outstanding"),
    ).group_by(extract("month", FeeRecord.last_synced_at)).order_by(extract("month", FeeRecord.last_synced_at))
    rows = db.execute(stmt).all()
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    data = [
        {"month": months[int(r.month) - 1], "collected": float(r.collected or 0), "outstanding": float(r.outstanding or 0)}
        for r in rows if r.month
    ]
    total_collected = sum(d["collected"] for d in data)
    total_outstanding = sum(d["outstanding"] for d in data)
    return {"monthly": data, "total_collected": total_collected, "total_outstanding": total_outstanding}


@router.get("/analytics/academic-performance")
def analytics_academic_performance(term: int = 3, year: int = 2026, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    """Mean score per form for a given term/year."""
    assessments = db.scalars(select(Assessment).where(Assessment.term == term, Assessment.year == year)).all()
    if not assessments:
        return {"by_form": [], "term": term, "year": year}
    form_scores: dict[int, list[float]] = {}
    for a in assessments:
        klass = db.get(ClassGroup, a.class_id)
        if not klass:
            continue
        marks = db.scalars(select(Mark).where(Mark.assessment_id == a.id, Mark.marks_obtained.is_not(None), Mark.absent.is_(False))).all()
        for m in marks:
            pct = (m.marks_obtained / a.max_marks) * 100 if a.max_marks else 0
            form_scores.setdefault(klass.form, []).append(pct)
    result = []
    for form in sorted(form_scores.keys()):
        scores = form_scores[form]
        mean = round(sum(scores) / len(scores), 1) if scores else 0
        result.append({"form": form, "mean": mean, "count": len(scores)})
    return {"by_form": result, "term": term, "year": year}


@router.get("/analytics/weekly-attendance")
def analytics_weekly_attendance(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    """Attendance by day of week, broken down by gender."""
    from datetime import timedelta
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    days = [week_start + timedelta(days=i) for i in range(5)]
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    result = []
    for i, day in enumerate(days):
        stmt = select(Student.gender, Attendance.status, func.count().label("cnt")).join(
            Attendance, Attendance.student_id == Student.id
        ).where(Attendance.day == day).group_by(Student.gender, Attendance.status)
        rows = db.execute(stmt).all()
        male_present = sum(r.cnt for r in rows if r.gender == "M" and r.status in ("present", "late"))
        female_present = sum(r.cnt for r in rows if r.gender == "F" and r.status in ("present", "late"))
        male_total = sum(r.cnt for r in rows if r.gender == "M")
        female_total = sum(r.cnt for r in rows if r.gender == "F")
        result.append({"day": day_names[i], "date": str(day),
                       "male_present": male_present, "female_present": female_present,
                       "male_total": male_total, "female_total": female_total})
    return result


# ═══════════════════════════════════════════════════════
# CLASS TEACHER & STUDENT MANAGEMENT
# ═══════════════════════════════════════════════════════

@router.get("/my-class")
def my_class_info(class_id: uuid.UUID | None = None, db: Session = Depends(get_db), user: User = Depends(require_roles("teacher", "admin"))):
    """Class teacher's class with full student list."""
    if user.role == "teacher":
        if class_id:
            klass = db.scalar(select(ClassGroup).where(ClassGroup.id == class_id, ClassGroup.class_teacher_id == user.id))
        else:
            klass = db.scalar(select(ClassGroup).where(ClassGroup.class_teacher_id == user.id, ClassGroup.status == "active"))
        if not klass:
            # Fallback: check if teacher teaches any class
            first_teach = db.scalar(select(TeacherAssignment.class_id).where(TeacherAssignment.teacher_id == user.id))
            if first_teach:
                klass = db.get(ClassGroup, first_teach)
        if not klass:
            return {"class": None, "students": []}
    else:
        if class_id:
            klass = db.get(ClassGroup, class_id)
        else:
            klass = db.scalar(select(ClassGroup).where(ClassGroup.status == "active").order_by(ClassGroup.form, ClassGroup.name))
        if not klass:
            return {"class": None, "students": []}

    students = db.scalars(
        select(Student).where(Student.class_id == klass.id, Student.status == "active")
        .order_by(Student.last_name, Student.first_name)
    ).all()
    student_list = []
    for s in students:
        guardian_link = db.scalar(select(StudentGuardian).where(StudentGuardian.student_id == s.id))
        guardian_name = None
        if guardian_link:
            g = db.get(User, guardian_link.user_id)
            if g:
                guardian_name = g.full_name
        student_list.append({"id": str(s.id), "admission_no": s.admission_no, "name": s.full_name,
                             "gender": s.gender, "guardian": guardian_name})
    return {
        "class": {"id": str(klass.id), "name": klass.name, "form": klass.form, "year": klass.year},
        "students": student_list,
    }


@router.get("/my-class/marks-status")
def my_class_marks_status(class_id: uuid.UUID | None = None, term: int = 3, year: int = 2026, db: Session = Depends(get_db), user: User = Depends(require_roles("teacher", "admin"))):
    """Subject teacher upload confirmation status, position calculation ready flag, and report card publication status."""
    if user.role == "teacher":
        if class_id:
            klass = db.scalar(select(ClassGroup).where(ClassGroup.id == class_id, ClassGroup.class_teacher_id == user.id))
        else:
            klass = db.scalar(select(ClassGroup).where(ClassGroup.class_teacher_id == user.id, ClassGroup.status == "active"))
    else:
        klass = db.get(ClassGroup, class_id) if class_id else db.scalar(select(ClassGroup).where(ClassGroup.status == "active").order_by(ClassGroup.form, ClassGroup.name))
    if not klass:
        return {"error": "Class not found", "subjects": []}

    students_count = db.scalar(select(func.count()).select_from(Student).where(Student.class_id == klass.id, Student.status == "active")) or 0
    tas = db.scalars(select(TeacherAssignment).where(TeacherAssignment.class_id == klass.id)).all()
    subject_status = []
    all_ready = True

    for ta in tas:
        subj = db.get(Subject, ta.subject_id)
        teacher = db.get(User, ta.teacher_id)
        if not subj: continue

        assessments = db.scalars(select(Assessment).where(
            Assessment.class_id == klass.id,
            Assessment.subject_id == subj.id,
            Assessment.term == term,
            Assessment.year == year
        )).all()

        exam_assessments = [a for a in assessments if a.kind.startswith("exam")]
        test_assessments = [a for a in assessments if a.kind == "test"]

        marks_entered = 0
        if exam_assessments:
            # Check primary exam
            marks_entered = db.scalar(select(func.count()).select_from(Mark).where(
                Mark.assessment_id == exam_assessments[0].id,
                or_(Mark.marks_obtained.is_not(None), Mark.absent.is_(True))
            )) or 0

        is_complete = bool(exam_assessments and marks_entered >= students_count and students_count > 0)
        if not is_complete:
            all_ready = False

        subject_status.append({
            "subject_id": str(subj.id),
            "subject_name": subj.name,
            "teacher_name": teacher.full_name if teacher else "Unassigned",
            "tests_count": len(test_assessments),
            "has_exam": bool(exam_assessments),
            "marks_entered": marks_entered,
            "total_students": students_count,
            "is_complete": is_complete
        })

    published_count = db.scalar(select(func.count()).select_from(ReportComment).join(
        Student, Student.id == ReportComment.student_id
    ).where(Student.class_id == klass.id, ReportComment.term == term, ReportComment.year == year, ReportComment.published.is_(True))) or 0

    is_published = published_count > 0 and published_count >= students_count

    return {
        "class_id": str(klass.id),
        "class_name": klass.name,
        "term": term,
        "year": year,
        "total_students": students_count,
        "subjects": subject_status,
        "all_confirmed": all_ready and len(subject_status) > 0,
        "is_published": is_published,
        "published_count": published_count
    }


class NewStudentBody(BaseModel):
    admission_no: str = Field(min_length=2, max_length=30)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    gender: str | None = None


@router.post("/my-class/students", status_code=201)
def add_student_to_class(b: NewStudentBody, db: Session = Depends(get_db), user: User = Depends(require_roles("teacher", "admin"))):
    """Class teacher adds a new student."""
    if user.role == "teacher":
        klass = db.scalar(select(ClassGroup).where(ClassGroup.class_teacher_id == user.id, ClassGroup.status == "active"))
        if not klass:
            raise HTTPException(403, "You are not assigned as a class teacher.")
    else:
        raise HTTPException(422, "Admin: use /students/import instead.")
    adm = b.admission_no.strip().upper()
    if db.scalar(select(Student.id).where(Student.admission_no == adm)):
        raise HTTPException(409, f"Student {adm} already exists.")
    g = (b.gender or "").strip().upper()[:1]
    s = Student(admission_no=adm, first_name=b.first_name.strip(), last_name=b.last_name.strip(),
                gender=g if g in ("M", "F") else None, class_id=klass.id)
    db.add(s); db.commit()
    return {"id": str(s.id), "name": s.full_name, "admission_no": s.admission_no}


@router.get("/class-rank/{class_id}")
def class_rank(class_id: uuid.UUID, term: int, year: int, db: Session = Depends(get_db), user: User = Depends(require_roles("teacher", "admin"))):
    """End-of-term ranked class list with marks per subject."""
    if user.role == "teacher":
        klass = db.get(ClassGroup, class_id)
        if not klass or klass.class_teacher_id != user.id:
            assigned = db.scalar(select(TeacherAssignment.id).where(
                TeacherAssignment.teacher_id == user.id, TeacherAssignment.class_id == class_id))
            if not assigned:
                raise HTTPException(403, "You do not teach this class.")
    klass = db.get(ClassGroup, class_id)
    if not klass:
        raise HTTPException(404, "Class not found.")
    students = db.scalars(select(Student).where(Student.class_id == class_id, Student.status == "active")
                          .order_by(Student.last_name, Student.first_name)).all()
    assessments = db.scalars(select(Assessment).where(
        Assessment.class_id == class_id, Assessment.term == term, Assessment.year == year)).all()
    subjects_map = {}
    for a in assessments:
        subj = db.get(Subject, a.subject_id)
        if subj:
            subjects_map[a.subject_id] = subj.name
    rows = []
    for s in students:
        subject_scores: dict[str, dict] = {}
        totals: list[float] = []
        for a in assessments:
            subj_name = subjects_map.get(a.subject_id, "")
            m = db.scalar(select(Mark).where(Mark.assessment_id == a.id, Mark.student_id == s.id))
            if m and m.marks_obtained is not None and not m.absent:
                pct = round((m.marks_obtained / a.max_marks) * 100, 1) if a.max_marks else 0
                subject_scores[subj_name] = {"marks": m.marks_obtained, "max": a.max_marks, "pct": pct, "grade": m.grade}
                totals.append(pct)
        overall = round(sum(totals) / len(totals), 1) if totals else None
        rows.append({"student_id": str(s.id), "name": s.full_name, "admission_no": s.admission_no,
                     "gender": s.gender, "subjects": subject_scores, "overall": overall})
    rows.sort(key=lambda x: (x["overall"] is None, -(x["overall"] or 0)))
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return {"class": klass.name, "form": klass.form, "term": term, "year": year,
            "subjects": list(subjects_map.values()), "students": rows}
