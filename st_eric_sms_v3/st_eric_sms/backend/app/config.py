from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    SECRET_KEY: str = "dev-only-change-me"
    DATABASE_URL: str = "sqlite:///./dev.db"
    ACCESS_TOKEN_MINUTES: int = 480
    CORS_ORIGINS: str = "http://localhost:5173"
    UPLOAD_DIR: str = "./uploads"
    PUBLIC_URL: str = "http://localhost:5173"   # used inside report-card QR codes
    ANTHROPIC_API_KEY: str = ""                  # optional: enables AI-written comment drafts
    ANTHROPIC_MODEL: str = "claude-haiku-4-5-20251001"
    FEE_SYSTEM_DB_URL: str = ""     # read-only connection to the existing fee system
    FEE_SYSTEM_QUERY: str = ""      # SELECT returning: external_student_id, external_fee_id, fee_type, currency, amount_due, amount_paid
    MAX_UPLOAD_MB: int = 50
    SCHOOL_NAME: str = "St Eric High School"
    SCHOOL_ADDRESS: str = "Stand No 2395, Shonhiwa Drive, PBag 904, Norton, Zimbabwe"
    SCHOOL_PHONE: str = "062-2087 / 062-2200"


settings = Settings()
