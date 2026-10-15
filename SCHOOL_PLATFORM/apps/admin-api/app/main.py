import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from .api.auth import router as auth_router
from .api.health import router as health_router
from .api.students import router as students_router
from .auth import hash_password
from .config import get_settings
from .db import Base, SessionLocal, engine
from .models import Student, User

settings = get_settings()


def seed_initial_data():
    try:
        with SessionLocal() as db:
            # Seed default admin user for St Eric Secondary School
            admin = db.scalar(select(User).where(User.username == "admin"))
            if not admin:
                db.add(
                    User(
                        username="admin",
                        password_hash=hash_password("StEric@2026"),
                        full_name="St Eric Administrator",
                        roles=["platform_admin", "registrar"],
                        is_active=True,
                    )
                )

            # Seed sample St Eric learners if database is empty
            student_count = db.scalar(select(func.count()).select_from(Student)) or 0
            if student_count == 0:
                db.add_all([
                    Student(
                        sis_id="SEC-2026-001",
                        legal_first_name="Tinashe",
                        legal_last_name="Mutasa",
                        preferred_name="Tinashe",
                        status="active",
                    ),
                    Student(
                        sis_id="SEC-2026-002",
                        legal_first_name="Ruvimbo",
                        legal_last_name="Chikore",
                        preferred_name="Ruvie",
                        status="active",
                    ),
                    Student(
                        sis_id="SEC-2026-003",
                        legal_first_name="Farai",
                        legal_last_name="Nyathi",
                        preferred_name="Farai",
                        status="active",
                    ),
                ])
            db.commit()
    except Exception as e:
        # Ignore seeding errors if table migrations are running concurrently
        pass


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Ensure tables exist
    Base.metadata.create_all(engine)
    seed_initial_data()
    yield


app = FastAPI(
    title="St Eric Secondary School - Control Plane API",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))[:80]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


app.include_router(health_router)
app.include_router(auth_router)
app.include_router(students_router)

