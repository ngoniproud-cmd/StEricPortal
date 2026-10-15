from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../../.env", "../.env"), extra="ignore")

    environment: Literal["development", "test", "staging", "production"] = "development"
    database_url: str = "sqlite:///./school.db"
    canvas_base_url: str = "https://canvas.invalid"
    canvas_account_id: str = "1"
    canvas_access_token: str = ""
    jwt_secret: str = "st-eric-secondary-school-norton-secret-key-change-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440
    oidc_issuer: str = "https://identity.invalid"
    oidc_audience: str = "school-admin-api"
    oidc_jwks_url: str = "https://identity.invalid/.well-known/jwks.json"
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["http://localhost:5173", "http://localhost:8080"])

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
