"""Test universal bulk import and St Eric standard class streams."""
import io
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db import engine
from app.main import app
from app.models import Base, ClassGroup, Student, StudentGuardian, User
from app.security import hash_password, verify_password


def init_db():
    from app.routers.auth import _fails
    _fails.clear()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        admin = User(username="admin", password_hash=hash_password("pw"), full_name="Headmaster", role="admin")
        db.add(admin)
        db.commit()


def test_init_standard_classes():
    init_db()
    with TestClient(app) as c:
        tok = c.post("/api/v1/auth/login", data={"username": "admin", "password": "pw"}).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}
        r = c.post("/api/v1/setup/init-standard-classes", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert data["created"] > 0

        with Session(engine) as db:
            # Verify Form 1 streams A to H exist
            for stream in ("1A", "1B", "1C", "1D", "1E", "1F", "1G", "1H"):
                assert db.query(ClassGroup).filter(ClassGroup.name == stream).first() is not None

            # Verify A-Level combinations exist
            assert db.query(ClassGroup).filter(ClassGroup.name == "5 Sciences A").first() is not None
            assert db.query(ClassGroup).filter(ClassGroup.name == "5 Commercials A").first() is not None
            assert db.query(ClassGroup).filter(ClassGroup.name == "5 Arts").first() is not None


def test_bulk_import_csv_and_account_creation():
    init_db()
    with TestClient(app) as c:
        tok = c.post("/api/v1/auth/login", data={"username": "admin", "password": "pw"}).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}

        # CSV content with two siblings (same guardian Moyo)
        csv_data = (
            "First Name,Last Name,Gender,Class,Guardian Name,Guardian Phone\n"
            "Tinashe,Moyo,M,1A,Mr. Patrick Moyo,+263771112233\n"
            "Chipo,Sibanda,F,1A,Mrs. Sibanda,+263772223344\n"
            "Farai,Moyo,M,1B,Mr. Patrick Moyo,+263771112233\n"
        ).encode("utf-8")

        files = {"file": ("students.csv", io.BytesIO(csv_data), "text/csv")}
        r = c.post(
            "/api/v1/setup/bulk-import",
            headers=h,
            files=files,
            data={"import_type": "students"},
        )
        assert r.status_code == 200
        res = r.json()
        assert res["students_created"] == 3
        assert res["success"] is True

        with Session(engine) as db:
            # 1. Verify Student Accounts: username = first_name, password = SURNAME
            tinashe_user = db.query(User).filter(User.username.like("tinashe%")).first()
            assert tinashe_user is not None
            assert tinashe_user.must_change_password is True
            assert verify_password("MOYO", tinashe_user.password_hash)

            # 2. Verify Guardian Accounts: multi-child linking
            moyo_guardian = db.query(User).filter(User.phone == "+263771112233").first()
            assert moyo_guardian is not None
            assert moyo_guardian.role == "parent"
            assert verify_password("MOYO", moyo_guardian.password_hash)

            # Guardian should be linked to BOTH Tinashe and Farai
            links = db.query(StudentGuardian).filter(StudentGuardian.user_id == moyo_guardian.id).all()
            assert len(links) == 2
