import io
import zipfile

from app.db import SessionLocal
from app.models import Student
from app.sis import build_users_archive


def test_sis_archive_is_deterministic_and_escaped(client):
    with SessionLocal() as db:
        db.add(Student(sis_id="L-10", legal_first_name="Ama,hle", legal_last_name="Ndlovu"))
        db.commit()
        first = build_users_archive(db, "1")
        second = build_users_archive(db, "1")
    assert first.content == second.content
    with zipfile.ZipFile(io.BytesIO(first.content)) as zf:
        csv_text = zf.read("users.csv").decode()
    assert '"Ama,hle"' in csv_text
    assert first.row_count == 1
