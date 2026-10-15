from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StudentCreate(BaseModel):
    sis_id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9._-]+$")
    legal_first_name: str = Field(min_length=1, max_length=120)
    legal_last_name: str = Field(min_length=1, max_length=120)
    preferred_name: str | None = Field(default=None, max_length=120)
    admission_date: date | None = None


class StudentPatch(BaseModel):
    legal_first_name: str | None = Field(default=None, min_length=1, max_length=120)
    legal_last_name: str | None = Field(default=None, min_length=1, max_length=120)
    preferred_name: str | None = Field(default=None, max_length=120)
    status: Literal["active", "inactive", "graduated", "withdrawn"] | None = None
    expected_version: int = Field(ge=1)


class StudentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sis_id: str
    legal_first_name: str
    legal_last_name: str
    preferred_name: str | None
    admission_date: date | None
    status: str
    canvas_user_id: str | None
    version: int
    created_at: datetime
    updated_at: datetime


class Page(BaseModel):
    items: list[StudentRead]
    limit: int
    offset: int
    total: int
