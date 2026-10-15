import time
from collections import defaultdict, deque
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user
from app.models import User
from app.security import make_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
_fails: dict[str, deque] = defaultdict(deque)  # failed sign-ins per (ip, username): 5 per minute


def _blocked(key: str) -> bool:
    q, now = _fails[key], time.time()
    while q and now - q[0] > 60:
        q.popleft()
    return len(q) >= 5


@router.post("/login")
def login(req: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    username = form.username.strip().lower()
    key = f"{req.client.host if req.client else 'local'}:{username}"
    if _blocked(key):
        raise HTTPException(429, "Too many attempts. Wait a minute and try again.")
    user = db.scalar(select(User).where(User.username == username))
    if not user or user.status != "active" or not verify_password(form.password, user.password_hash):
        _fails[key].append(time.time())
        raise HTTPException(401, "Incorrect username or password.")
    _fails.pop(key, None)
    return {"access_token": make_token(str(user.id), user.role), "token_type": "bearer",
            "role": user.role, "full_name": user.full_name,
            "must_change_password": user.must_change_password}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"id": user.id, "full_name": user.full_name, "role": user.role, "must_change_password": user.must_change_password}
