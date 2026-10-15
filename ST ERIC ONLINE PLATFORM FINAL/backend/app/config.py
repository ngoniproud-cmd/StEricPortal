"""Merged configuration: V3 school settings + SCHOOL_PLATFORM environment/validator patterns.
St Eric High School, Stand No 2395, Shonhiwa Drive, PBag 904, Norton, Zimbabwe."""
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- environment ---
    ENVIRONMENT: Literal["development", "test", "staging", "production"] = "development"

    # --- auth ---
    SECRET_KEY: str = "dev-only-change-me"
    ACCESS_TOKEN_MINUTES: int = 480

    # --- database ---
    DATABASE_URL: str = "sqlite:///./dev.db"

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def resolve_sqlite_path(cls, value: str):
        if value.startswith("sqlite:///./"):
            from pathlib import Path
            db_name = value.replace("sqlite:///./", "")
            canonical_path = (Path(__file__).resolve().parent.parent / db_name).as_posix()
            return f"sqlite:///{canonical_path}"
        return value

    # --- CORS ---
    CORS_ORIGINS: Annotated[list[str], Field(default_factory=lambda: ["http://localhost:5173", "http://localhost:8080"])]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    # --- file uploads ---
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 50

    # --- public URL (for QR codes on report cards) ---
    PUBLIC_URL: str = "http://localhost:5173"

    # --- AI comment drafting (optional) ---
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-haiku-4-5-20251001"

    # --- fee system (read-only, existing school system) ---
    FEE_SYSTEM_DB_URL: str = ""
    FEE_SYSTEM_QUERY: str = ""

    # --- school identity ---
    SCHOOL_NAME: str = "St Eric High School"
    SCHOOL_ADDRESS: str = "Stand No 2395, Shonhiwa Drive, PBag 904, Norton, Zimbabwe"
    SCHOOL_PHONE: str = "062-2087 / 062-2200"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
