from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    subject: str
    roles: frozenset[str]


def get_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> Principal:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    
    token = credentials.credentials

    # 1. Try local St Eric School JWT authentication (HS256)
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.oidc_audience,
            options={"require": ["exp", "sub"]},
        )
        roles = claims.get("roles", ["registrar"])
        if isinstance(roles, list):
            return Principal(subject=claims["sub"], roles=frozenset(str(role) for role in roles))
    except jwt.PyJWTError:
        pass

    # 2. Fallback to external OIDC JWKS if configured
    try:
        key_client = jwt.PyJWKClient(settings.oidc_jwks_url, cache_keys=True)
        key = key_client.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256", "ES256"],
            audience=settings.oidc_audience,
            issuer=settings.oidc_issuer,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
        roles = claims.get("roles", [])
        if not isinstance(roles, list):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid roles claim")
        return Principal(subject=claims["sub"], roles=frozenset(str(role) for role in roles))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def require_roles(*allowed: str):
    allowed_set = frozenset(allowed)

    def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.roles.isdisjoint(allowed_set):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return principal

    return dependency
