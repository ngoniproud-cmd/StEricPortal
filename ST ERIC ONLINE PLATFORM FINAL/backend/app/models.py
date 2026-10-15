"""All tables in one file (small school, small system). UUID keys, created/updated
timestamps everywhere, soft delete via `status`. ZIMSEC only.

MERGED: V3's complete 22-model set + SCHOOL_PLATFORM's enterprise patterns:
  - `version` column on Student, Mark, Assessment, ReportComment (optimistic concurrency)
  - AuditEvent model (global audit trail with JSON details)
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, Numeric,
                        String, Text, UniqueConstraint, Uuid, func)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Stamp:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


def fk(table: str, nullable=False):
    return mapped_column(Uuid, ForeignKey(f"{table}.id"), nullable=nullable, index=True)


# ────────────────────────── identity ──────────────────────────

class User(Stamp, Base):
    __tablename__ = "users"
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), index=True)  # admin|hod|teacher|student|parent|librarian
    department: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. Sciences, Commercials, Humanities, Languages, Practical Arts
    phone: Mapped[str | None] = mapped_column(String(15))     # +263XXXXXXXXX
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active")


class ClassGroup(Stamp, Base):
    __tablename__ = "classes"
    name: Mapped[str] = mapped_column(String(50))             # e.g. "4 Blue"
    form: Mapped[int] = mapped_column(Integer)                # 1-6
    year: Mapped[int] = mapped_column(Integer)
    class_teacher_id: Mapped[uuid.UUID | None] = fk("users", True)
    status: Mapped[str] = mapped_column(String(20), default="active")


class Student(Stamp, Base):
    __tablename__ = "students"
    user_id: Mapped[uuid.UUID | None] = fk("users", True)
    admission_no: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    gender: Mapped[str | None] = mapped_column(String(1))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    class_id: Mapped[uuid.UUID | None] = fk("classes", True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    version: Mapped[int] = mapped_column(Integer, default=1)
    klass: Mapped["ClassGroup"] = relationship()

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class StudentGuardian(Stamp, Base):
    __tablename__ = "student_guardians"
    __table_args__ = (UniqueConstraint("student_id", "user_id"),)
    student_id: Mapped[uuid.UUID] = fk("students")
    user_id: Mapped[uuid.UUID] = fk("users")
    relationship_type: Mapped[str] = mapped_column(String(30), default="parent")


# ────────────────────────── academics ──────────────────────────

class Subject(Stamp, Base):
    __tablename__ = "subjects"
    name: Mapped[str] = mapped_column(String(100))
    zimsec_code: Mapped[str | None] = mapped_column(String(10))  # ZIMSEC syllabus code only
    level: Mapped[str] = mapped_column(String(1), default="O")   # O | A
    department: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Sciences, Commercials, Humanities, Languages, Practical Arts
    status: Mapped[str] = mapped_column(String(20), default="active")


class TeacherAssignment(Stamp, Base):
    __tablename__ = "teacher_assignments"
    __table_args__ = (UniqueConstraint("teacher_id", "class_id", "subject_id"),)
    teacher_id: Mapped[uuid.UUID] = fk("users")
    class_id: Mapped[uuid.UUID] = fk("classes")
    subject_id: Mapped[uuid.UUID] = fk("subjects")


class Assessment(Stamp, Base):
    __tablename__ = "assessments"
    class_id: Mapped[uuid.UUID] = fk("classes")
    subject_id: Mapped[uuid.UUID] = fk("subjects")
    title: Mapped[str] = mapped_column(String(150))
    kind: Mapped[str] = mapped_column(String(20), default="test")  # test|assignment|exam
    term: Mapped[int] = mapped_column(Integer)                     # 1-3
    year: Mapped[int] = mapped_column(Integer)
    max_marks: Mapped[float] = mapped_column(Float)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)


class Mark(Stamp, Base):
    __tablename__ = "marks"
    __table_args__ = (UniqueConstraint("assessment_id", "student_id"), Index("ix_marks_assessment_student", "assessment_id", "student_id"))
    assessment_id: Mapped[uuid.UUID] = fk("assessments")
    student_id: Mapped[uuid.UUID] = fk("students")
    marks_obtained: Mapped[float | None] = mapped_column(Float)    # None = not yet entered
    absent: Mapped[bool] = mapped_column(Boolean, default=False)
    grade: Mapped[str | None] = mapped_column(String(1))
    entered_by: Mapped[uuid.UUID | None] = fk("users", True)
    version: Mapped[int] = mapped_column(Integer, default=1)


class MarkAudit(Stamp, Base):
    __tablename__ = "mark_audits"
    mark_id: Mapped[uuid.UUID] = fk("marks")
    old_value: Mapped[float | None] = mapped_column(Float)
    new_value: Mapped[float | None] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(Text)
    changed_by: Mapped[uuid.UUID] = fk("users")


class GradingBand(Stamp, Base):
    """Admin-editable override of app.grading.DEFAULT_BANDS."""
    __tablename__ = "grading_bands"
    __table_args__ = (UniqueConstraint("level", "grade"),)
    level: Mapped[str] = mapped_column(String(1))
    grade: Mapped[str] = mapped_column(String(1))
    min_pct: Mapped[int] = mapped_column(Integer)
    max_pct: Mapped[int] = mapped_column(Integer)
    points: Mapped[int] = mapped_column(Integer, default=0)
    remark: Mapped[str] = mapped_column(String(50), default="")


class ReportComment(Stamp, Base):
    __tablename__ = "report_comments"
    __table_args__ = (UniqueConstraint("student_id", "term", "year"),)
    student_id: Mapped[uuid.UUID] = fk("students")
    term: Mapped[int] = mapped_column(Integer)
    year: Mapped[int] = mapped_column(Integer)
    class_teacher_comment: Mapped[str | None] = mapped_column(Text)
    head_comment: Mapped[str | None] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)


# ────────────────────────── attendance ──────────────────────────

class Attendance(Stamp, Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("student_id", "day"), Index("ix_attendance_day_student", "day", "student_id"))
    student_id: Mapped[uuid.UUID] = fk("students")
    day: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(10))  # present|absent|late|excused
    marked_by: Mapped[uuid.UUID | None] = fk("users", True)


# ────────────────────────── library ──────────────────────────

class LibraryItem(Stamp, Base):
    """Online library: textbooks, notes, past papers, marking schemes. Teachers upload, librarian approves."""
    __tablename__ = "library_items"
    __table_args__ = (Index("ix_library_status_kind", "status", "kind"),)
    title: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(20), index=True)  # textbook|notes|past_paper|marking_scheme|other
    subject_id: Mapped[uuid.UUID | None] = fk("subjects", True)
    form: Mapped[int] = mapped_column(Integer, default=0)      # 0 = all forms, 1-6
    exam_year: Mapped[int | None] = mapped_column(Integer)
    session: Mapped[str | None] = mapped_column(String(20))    # June | November
    paper_no: Mapped[str | None] = mapped_column(String(10))
    file_path: Mapped[str] = mapped_column(String(300))
    original_name: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_by: Mapped[uuid.UUID] = fk("users")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending|approved|rejected|removed
    reviewed_by: Mapped[uuid.UUID | None] = fk("users", True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reject_reason: Mapped[str | None] = mapped_column(Text)
    views: Mapped[int] = mapped_column(Integer, default=0)
    downloads: Mapped[int] = mapped_column(Integer, default=0)


class LibraryFavourite(Stamp, Base):
    __tablename__ = "library_favourites"
    __table_args__ = (UniqueConstraint("user_id", "item_id"),)
    user_id: Mapped[uuid.UUID] = fk("users")
    item_id: Mapped[uuid.UUID] = fk("library_items")


# ────────────────────────── communication ──────────────────────────

class Notification(Stamp, Base):
    """In-app alerts (free, no SMS): results published, absences, announcements, library decisions."""
    __tablename__ = "notifications"
    user_id: Mapped[uuid.UUID] = fk("users")
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str | None] = mapped_column(String(200))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class Announcement(Stamp, Base):
    __tablename__ = "announcements"
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    audience: Mapped[str] = mapped_column(String(20), default="all")  # all|students|parents|teachers
    published_by: Mapped[uuid.UUID] = fk("users")
    status: Mapped[str] = mapped_column(String(20), default="published")


# ────────────────────────── fees (read-only mirror) ──────────────────────────

class FeeRecord(Stamp, Base):
    """Read-only mirror of the school's EXISTING fee system."""
    __tablename__ = "fee_records"
    external_student_id: Mapped[str] = mapped_column(String(50), index=True)
    external_fee_id: Mapped[str] = mapped_column(String(50), unique=True)
    fee_type: Mapped[str] = mapped_column(String(50))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    amount_due: Mapped[float] = mapped_column(Numeric(10, 2))
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    balance: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(20))
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ────────────────────────── homework ──────────────────────────

class Assignment(Stamp, Base):
    __tablename__ = "assignments"
    class_id: Mapped[uuid.UUID] = fk("classes")
    subject_id: Mapped[uuid.UUID] = fk("subjects")
    teacher_id: Mapped[uuid.UUID] = fk("users")
    title: Mapped[str] = mapped_column(String(200))
    instructions: Mapped[str | None] = mapped_column(Text)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    max_marks: Mapped[float | None] = mapped_column(Float)
    attachment_path: Mapped[str | None] = mapped_column(String(300))
    attachment_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="active")


class Submission(Stamp, Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id"),)
    assignment_id: Mapped[uuid.UUID] = fk("assignments")
    student_id: Mapped[uuid.UUID] = fk("students")
    text: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str | None] = mapped_column(String(300))
    file_name: Mapped[str | None] = mapped_column(String(255))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_late: Mapped[bool] = mapped_column(Boolean, default=False)
    mark: Mapped[float | None] = mapped_column(Float)
    feedback: Mapped[str | None] = mapped_column(Text)
    marked_by: Mapped[uuid.UUID | None] = fk("users", True)


# ────────────────────────── enrolment ──────────────────────────

class Application(Stamp, Base):
    """Online enrolment application (Form 1 / Form 5 intake)."""
    __tablename__ = "applications"
    reference: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    gender: Mapped[str | None] = mapped_column(String(1))
    date_of_birth: Mapped[date] = mapped_column(Date)
    intake_form: Mapped[int] = mapped_column(Integer)          # 1 or 5
    previous_school: Mapped[str | None] = mapped_column(String(200))
    subjects_interest: Mapped[str | None] = mapped_column(Text)
    guardian_name: Mapped[str] = mapped_column(String(200))
    guardian_phone: Mapped[str] = mapped_column(String(15), index=True)
    guardian_email: Mapped[str | None] = mapped_column(String(200))
    birth_cert_path: Mapped[str | None] = mapped_column(String(300))
    report_path: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20), default="received", index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    student_id: Mapped[uuid.UUID | None] = fk("students", True)


# ────────────────────────── schedule ──────────────────────────

class CalendarEvent(Stamp, Base):
    __tablename__ = "calendar_events"
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20), default="event")  # term|holiday|exam|sports|event
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date | None] = mapped_column(Date)
    form: Mapped[int | None] = mapped_column(Integer)
    class_id: Mapped[uuid.UUID | None] = fk("classes", True)
    description: Mapped[str | None] = mapped_column(Text)


class Notice(Stamp, Base):
    """Trip / sports / clinic notice needing a parent's Agree or Decline. One-way: no free text back."""
    __tablename__ = "notices"
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    deadline: Mapped[date | None] = mapped_column(Date)
    class_id: Mapped[uuid.UUID | None] = fk("classes", True)  # None = whole school
    created_by: Mapped[uuid.UUID] = fk("users")
    status: Mapped[str] = mapped_column(String(20), default="active")


class NoticeResponse(Stamp, Base):
    __tablename__ = "notice_responses"
    __table_args__ = (UniqueConstraint("notice_id", "student_id"),)
    notice_id: Mapped[uuid.UUID] = fk("notices")
    student_id: Mapped[uuid.UUID] = fk("students")
    parent_id: Mapped[uuid.UUID] = fk("users")
    response: Mapped[str] = mapped_column(String(10))  # agree|decline


# ────────────────────────── ZIMSEC candidates ──────────────────────────

class Candidate(Stamp, Base):
    """ZIMSEC examination candidate (Form 4 = O-Level, Form 6 = A-Level)."""
    __tablename__ = "candidates"
    __table_args__ = (UniqueConstraint("student_id", "year"),)
    student_id: Mapped[uuid.UUID] = fk("students")
    year: Mapped[int] = mapped_column(Integer)
    candidate_number: Mapped[str | None] = mapped_column(String(20))
    centre_number: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="entered")  # entered|fee_cleared|confirmed


class CandidateSubject(Stamp, Base):
    __tablename__ = "candidate_subjects"
    __table_args__ = (UniqueConstraint("candidate_id", "subject_id"),)
    candidate_id: Mapped[uuid.UUID] = fk("candidates")
    subject_id: Mapped[uuid.UUID] = fk("subjects")


class TimetableSlot(Stamp, Base):
    __tablename__ = "timetable_slots"
    class_id: Mapped[uuid.UUID] = fk("classes")
    subject_id: Mapped[uuid.UUID] = fk("subjects")
    teacher_id: Mapped[uuid.UUID] = fk("users")
    day: Mapped[int] = mapped_column(Integer)      # 1=Mon .. 5=Fri
    period: Mapped[int] = mapped_column(Integer)   # 1..10
    room: Mapped[str | None] = mapped_column(String(30))


# ────────────────────────── audit (from SCHOOL_PLATFORM) ──────────────────────────

class AuditEvent(Stamp, Base):
    """Global audit trail. Every mutation records an event with JSON details."""
    __tablename__ = "audit_events"
    actor_id: Mapped[str] = mapped_column(String(200), index=True)
    actor_role: Mapped[str] = mapped_column(String(20))
    action: Mapped[str] = mapped_column(String(120), index=True)
    object_type: Mapped[str] = mapped_column(String(80))
    object_id: Mapped[str] = mapped_column(String(80), index=True)
    request_id: Mapped[str] = mapped_column(String(80), index=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
