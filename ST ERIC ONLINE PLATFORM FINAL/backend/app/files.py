"""Shared safe-upload helper: extension allow-list, size limit, magic-byte check, random on-disk name.
FIXED: constants are now defined here instead of imported from routers.library (circular import)."""
import uuid
from pathlib import Path
from fastapi import HTTPException, UploadFile
from app.config import settings

ALLOWED = {".pdf": "application/pdf", ".doc": "application/msword",
           ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
           ".ppt": "application/vnd.ms-powerpoint",
           ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
           ".xls": "application/vnd.ms-excel",
           ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
           ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}

MAGIC = {".pdf": b"%PDF", ".png": b"\x89PNG", ".jpg": b"\xff\xd8\xff", ".jpeg": b"\xff\xd8\xff",
         ".docx": b"PK", ".pptx": b"PK", ".xlsx": b"PK", ".doc": b"\xd0\xcf\x11\xe0",
         ".ppt": b"\xd0\xcf\x11\xe0", ".xls": b"\xd0\xcf\x11\xe0"}


def upload_dir(sub: str) -> Path:
    p = Path(settings.UPLOAD_DIR) / sub
    p.mkdir(parents=True, exist_ok=True)
    return p


async def store(file: UploadFile, sub: str, exts: set[str] | None = None, max_mb: int | None = None) -> tuple[str, str]:
    """Returns (stored_name, original_name)."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED or (exts and ext not in exts):
        raise HTTPException(422, "This file type is not allowed.")
    data = await file.read()
    if len(data) > (max_mb or settings.MAX_UPLOAD_MB) * 1024 * 1024:
        raise HTTPException(413, f"File is too large (maximum {max_mb or settings.MAX_UPLOAD_MB} MB).")
    if not data.startswith(MAGIC[ext]):
        raise HTTPException(422, "The file content does not match its type.")
    name = f"{uuid.uuid4().hex}{ext}"
    (upload_dir(sub) / name).write_bytes(data)
    return name, Path(file.filename).name
