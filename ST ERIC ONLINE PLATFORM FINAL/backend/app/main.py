"""FastAPI application entry point. MERGED:
- V3's complete router set and GZip middleware
- SCHOOL_PLATFORM's request-ID middleware, security headers, health probes"""
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal, engine
from app.models import Base
from app.routers import (assignments, auth, candidates, enrolment, fees, library, marks, misc, notices, people, reports,
                         schedule, setup)

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="St Eric High School — Online Platform",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
)
app.add_middleware(GZipMiddleware, minimum_size=800)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """From SCHOOL_PLATFORM: attach request ID and security headers to every response."""
    request.state.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))[:80]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# ── include all routers under /api/v1 ──
for r in (auth.router, people.router, marks.router, reports.router, reports.public, library.router, misc.router,
          assignments.router, enrolment.public, enrolment.router, schedule.router, notices.router,
          candidates.router, fees.router, setup.router):
    app.include_router(r, prefix="/api/v1")


# ── health probes (from SCHOOL_PLATFORM) ──
@app.get("/health/live")
def health_live():
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="database unavailable")
    return {"status": "ready"}


# Keep the original /health for backward compat
@app.get("/health")
def health():
    return {"status": "ok"}
