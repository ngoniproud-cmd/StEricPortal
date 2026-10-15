import uuid
from typing import Iterable
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Notification, Student, StudentGuardian, User


def notify(db: Session, user_ids: Iterable[uuid.UUID], title: str, body: str = "", link: str | None = None):
    for uid in set(user_ids):
        db.add(Notification(user_id=uid, title=title, body=body, link=link))


def family_user_ids(db: Session, student_ids: Iterable[uuid.UUID]) -> set[uuid.UUID]:
    """Student accounts plus linked parent accounts."""
    ids = list(student_ids)
    parents = set(db.scalars(select(StudentGuardian.user_id).where(StudentGuardian.student_id.in_(ids))))
    students = set(u for u in db.scalars(select(Student.user_id).where(Student.id.in_(ids))) if u)
    return parents | students


def users_with_role(db: Session, *roles: str) -> list[uuid.UUID]:
    return list(db.scalars(select(User.id).where(User.role.in_(roles), User.status == "active")))
