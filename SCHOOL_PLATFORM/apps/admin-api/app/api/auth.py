from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_access_token, verify_password
from ..db import get_db
from ..models import User
from ..security import Principal, get_principal

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    username: str
    full_name: str
    roles: list[str]


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username.strip()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    roles = user.roles if isinstance(user.roles, list) else ["registrar"]
    token = create_access_token(
        subject=user.username,
        roles=roles,
        full_name=user.full_name,
    )
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            username=user.username,
            full_name=user.full_name,
            roles=roles,
        ),
    )


@router.get("/me", response_model=UserResponse)
def me(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == principal.subject))
    if user:
        roles = user.roles if isinstance(user.roles, list) else list(principal.roles)
        return UserResponse(username=user.username, full_name=user.full_name, roles=roles)
    return UserResponse(username=principal.subject, full_name="User", roles=list(principal.roles))
