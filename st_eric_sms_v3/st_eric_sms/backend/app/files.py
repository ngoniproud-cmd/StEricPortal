"""Shared safe-upload helper: extension allow-list, size limit, magic-byte check, random on-disk name."""
import uuid
from pathlib import Path
from fastapi import HTTPException, UploadFile
from app.config import settings
from app.routers.library import ALLOWED, MAGIC


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
