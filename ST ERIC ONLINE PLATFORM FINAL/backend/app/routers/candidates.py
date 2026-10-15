"""ZIMSEC candidate register for Form 4 (O-Level) and Form 6 (A-Level)."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_roles
from app.models import Candidate, CandidateSubject, ClassGroup, FeeRecord, Student, Subject, User

router = APIRouter(prefix="/candidates", tags=["candidates"])
admin = require_roles("admin")
CORE = ("english language", "mathematics")  # every Form 4 candidate should sit these


class CandidateIn(BaseModel):
    student_id: uuid.UUID
    year: int = Field(ge=2000, le=2100)
    candidate_number: str | None = Field(None, max_length=20)
    centre_number: str | None = Field(None, max_length=20)
    subject_ids: list[uuid.UUID] = []


class CandidateUpdate(BaseModel):
    candidate_number: str | None = Field(None, max_length=20)
    centre_number: str | None = Field(None, max_length=20)
    status: str | None = Field(None, pattern="^(entered|fee_cleared|confirmed)$")
    subject_ids: list[uuid.UUID] | None = None


def fee_state(db: Session, admission_no: str) -> str:
    rows = list(db.scalars(select(FeeRecord).where(FeeRecord.external_student_id == admission_no)))
    if not rows:
        return "unknown"
    return "cleared" if all(float(r.balance) <= 0 for r in rows) else "owing"


def _row(db: Session, c: Candidate, dup_numbers: set, subj_names: dict) -> dict:
    st = db.get(Student, c.student_id)
    klass = db.get(ClassGroup, st.class_id) if st.class_id else None
    ids = list(db.scalars(select(CandidateSubject.subject_id).where(CandidateSubject.candidate_id == c.id)))
    names = [subj_names[i] for i in ids if i in subj_names]
    issues = []
    if not ids:
        issues.append("No subjects entered")
    if klass and klass.form == 4:
        low = [n.lower() for n in names]
        for core in CORE:
            if not any(core in n for n in low):
                issues.append(f"Missing {core.title()}")
    if c.candidate_number and c.candidate_number in dup_numbers:
        issues.append("Duplicate candidate number")
    if not c.candidate_number:
        issues.append("No candidate number yet")
    fs = fee_state(db, st.admission_no)
    if fs == "owing":
        issues.append("Fees outstanding")
    return {"id": c.id, "student_id": st.id, "name": st.full_name, "admission_no": st.admission_no, "class": klass.name if klass else None,
            "form": klass.form if klass else None, "year": c.year, "candidate_number": c.candidate_number, "centre_number": c.centre_number,
            "status": c.status, "subjects": names, "subject_ids": ids, "fees": fs, "issues": issues}


@router.get("")
def list_candidates(year: int, class_id: uuid.UUID | None = None, db: Session = Depends(get_db), _: User = Depends(admin)):
    cs = list(db.scalars(select(Candidate).where(Candidate.year == year)))
    if class_id:
        ids = set(db.scalars(select(Student.id).where(Student.class_id == class_id)))
        cs = [c for c in cs if c.student_id in ids]
    nums = [c.candidate_number for c in cs if c.candidate_number]
    dups = {n for n in nums if nums.count(n) > 1}
    subj = {s.id: s.name for s in db.scalars(select(Subject))}
    return sorted((_row(db, c, dups, subj) for c in cs), key=lambda r: r["name"])


def _check_subjects(db: Session, ids: list[uuid.UUID]):
    found = set(db.scalars(select(Subject.id).where(Subject.id.in_(ids)))) if ids else set()
    if found != set(ids):
        raise HTTPException(422, "One of the chosen subjects does not exist.")
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "A subject is listed twice.")


@router.post("", status_code=201)
def add(b: CandidateIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    st = db.get(Student, b.student_id)
    klass = st and st.class_id and db.get(ClassGroup, st.class_id)
    if not klass or klass.form not in (4, 6):
        raise HTTPException(422, "Only Form 4 and Form 6 learners can be entered as candidates.")
    if db.scalar(select(Candidate.id).where(Candidate.student_id == b.student_id, Candidate.year == b.year)):
        raise HTTPException(409, "This learner is already entered for that year.")
    _check_subjects(db, b.subject_ids)
    c = Candidate(student_id=b.student_id, year=b.year, candidate_number=b.candidate_number, centre_number=b.centre_number)
    db.add(c); db.flush()
    db.add_all(CandidateSubject(candidate_id=c.id, subject_id=i) for i in b.subject_ids)
    db.commit()
    return {"id": c.id}


@router.patch("/{cid}")
def update(cid: uuid.UUID, b: CandidateUpdate, db: Session = Depends(get_db), _: User = Depends(admin)):
    c = db.get(Candidate, cid)
    if not c:
        raise HTTPException(404, "Candidate not found.")
    data = b.model_dump(exclude_unset=True)
    if data.get("status") == "fee_cleared" and fee_state(db, db.get(Student, c.student_id).admission_no) == "owing":
        raise HTTPException(422, "This learner still has fees outstanding.")
    for k in ("candidate_number", "centre_number", "status"):
        if k in data:
            setattr(c, k, data[k])
    if b.subject_ids is not None:
        _check_subjects(db, b.subject_ids)
        for s in db.scalars(select(CandidateSubject).where(CandidateSubject.candidate_id == cid)):
            db.delete(s)
        db.flush()
        db.add_all(CandidateSubject(candidate_id=cid, subject_id=i) for i in b.subject_ids)
    db.commit()
    return {"ok": True}
