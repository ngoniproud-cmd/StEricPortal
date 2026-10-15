"""Global audit trail. Adopted from SCHOOL_PLATFORM's pattern, adapted for V3's User model.
Every mutation endpoint should call record_audit() after the change."""
from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditEvent, User


def record_audit(
    db: Session,
    user: User,
    action: str,
    object_type: str,
    object_id: str,
    details: dict | None = None,
    request: Request | None = None,
) -> None:
    db.add(
        AuditEvent(
            actor_id=str(user.id),
            actor_role=user.role,
            action=action,
            object_type=object_type,
            object_id=str(object_id),
            request_id=getattr(request.state, "request_id", "unknown") if request else "internal",
            details=details or {},
        )
    )
