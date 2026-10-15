import csv
import io
import zipfile
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Student


@dataclass(frozen=True)
class SISArchive:
    content: bytes
    row_count: int


def build_users_archive(db: Session, account_id: str) -> SISArchive:
    """Build a deterministic Canvas SIS users archive for review/import.

    Login IDs are intentionally not derived here: identity naming and collision policy must
    be approved. This export therefore expects a pre-provisioned login ID equal to SIS ID in
    the pilot and must be replaced if the identity provider uses another immutable key.
    """
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=[
        "user_id", "integration_id", "login_id", "first_name", "last_name", "status"
    ], lineterminator="\n")
    writer.writeheader()
    students = db.scalars(select(Student).order_by(Student.sis_id)).all()
    for student in students:
        writer.writerow({
            "user_id": student.sis_id,
            "integration_id": student.id,
            "login_id": student.sis_id,
            "first_name": student.preferred_name or student.legal_first_name,
            "last_name": student.legal_last_name,
            "status": "active" if student.status == "active" else "deleted",
        })
    csv_bytes = output.getvalue().encode("utf-8")
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        info = zipfile.ZipInfo("users.csv", date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        zf.writestr(info, csv_bytes)
    return SISArchive(content=archive.getvalue(), row_count=len(students))
