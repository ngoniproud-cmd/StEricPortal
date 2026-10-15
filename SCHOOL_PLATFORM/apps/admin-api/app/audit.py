from fastapi import Request
from sqlalchemy.orm import Session

from .models import AuditEvent
from .security import Principal


def record_audit(
    db: Session,
    request: Request,
    principal: Principal,
    action: str,
    object_type: str,
    object_id: str,
    details: dict | None = None,
) -> None:
    db.add(
        AuditEvent(
            actor_id=principal.subject,
            actor_roles=sorted(principal.roles),
            action=action,
            object_type=object_type,
            object_id=object_id,
            request_id=getattr(request.state, "request_id", "unknown"),
            details=details or {},
        )
    )
