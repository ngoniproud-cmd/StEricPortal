import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.config import settings
from app.routers import (assignments, auth, candidates, enrolment, fees, library, marks, misc, notices, people, reports,
                         schedule, setup)

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="St Eric High School SMS", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=800)  # smaller pages = cheaper data for families
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS.split(","), allow_methods=["*"], allow_headers=["*"])
for r in (auth.router, people.router, marks.router, reports.router, reports.public, library.router, misc.router, assignments.router,
          enrolment.public, enrolment.router, schedule.router, notices.router, candidates.router, fees.router, setup.router):
    app.include_router(r, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
