import uuid
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User
from app.security import read_token

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    try:
        uid = uuid.UUID(read_token(token)["sub"])
    except (JWTError, ValueError, KeyError):
        raise HTTPException(401, "Session expired. Please sign in again.")
    user = db.get(User, uid)
    if not user or user.status != "active":
        raise HTTPException(401, "Account not available.")
    return user


def require_roles(*roles: str):
    def check(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "You do not have access to this.")
        return user
    return check
