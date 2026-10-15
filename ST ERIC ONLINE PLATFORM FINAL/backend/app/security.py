"""Password hashing (bcrypt) and JWT tokens (HS256).
Direct bcrypt implementation using rounds=4 in test mode for speed."""
from datetime import datetime, timedelta, timezone
import os
import bcrypt
from jose import jwt

from app.config import settings

ALGO = "HS256"


def hash_password(p: str) -> str:
    pwd_bytes = p.encode("utf-8")
    rounds = 4 if os.environ.get("ENVIRONMENT") == "test" or "test" in os.environ.get("DATABASE_URL", "") else 12
    salt = bcrypt.gensalt(rounds=rounds)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False


def make_token(user_id: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    return jwt.encode({"sub": user_id, "role": role, "exp": exp}, settings.SECRET_KEY, ALGO)


def read_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGO])
