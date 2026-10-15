from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import record_audit
from ..db import get_db
from ..models import OutboxEvent, Student
from ..schemas import Page, StudentCreate, StudentPatch, StudentRead
from ..security import Principal, require_roles

router = APIRouter(prefix="/api/v1/students", tags=["students"])
read_roles = require_roles("platform_admin", "registrar", "counsellor", "auditor")
write_roles = require_roles("platform_admin", "registrar")


@router.get("", response_model=Page)
def list_students(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: Principal = Depends(read_roles),
):
    total = db.scalar(select(func.count()).select_from(Student)) or 0
    items = db.scalars(select(Student).order_by(Student.sis_id).limit(limit).offset(offset)).all()
    return Page(items=list(items), limit=limit, offset=offset, total=total)


@router.get("/export-sis")
def export_sis(
    db: Session = Depends(get_db),
    principal: Principal = Depends(read_roles),
):
    from fastapi.responses import Response
    from ..sis import build_users_archive
    archive = build_users_archive(db, "1")
    return Response(
        content=archive.content,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=st_eric_canvas_users.zip"},
    )



@router.post("", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(write_roles),
):
    student = Student(**payload.model_dump())
    db.add(student)
    try:
        db.flush()
        db.add(OutboxEvent(aggregate_type="student", aggregate_id=student.id,
                           aggregate_version=student.version, event_type="student.upserted",
                           payload={"student_id": student.id, "sis_id": student.sis_id}))
        record_audit(db, request, principal, "student.create", "student", student.id,
                     {"sis_id": student.sis_id})
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="SIS ID already exists") from exc
    db.refresh(student)
    return student


@router.patch("/{student_id}", response_model=StudentRead)
def patch_student(
    student_id: str,
    payload: StudentPatch,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(write_roles),
):
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.version != payload.expected_version:
        raise HTTPException(status_code=409, detail={"message": "Version conflict", "current": student.version})
    changes = payload.model_dump(exclude={"expected_version"}, exclude_unset=True)
    for key, value in changes.items():
        setattr(student, key, value)
    student.version += 1
    db.add(OutboxEvent(aggregate_type="student", aggregate_id=student.id,
                       aggregate_version=student.version, event_type="student.upserted",
                       payload={"student_id": student.id, "sis_id": student.sis_id}))
    record_audit(db, request, principal, "student.update", "student", student.id,
                 {"fields": sorted(changes)})
    db.commit()
    db.refresh(student)
    return student
