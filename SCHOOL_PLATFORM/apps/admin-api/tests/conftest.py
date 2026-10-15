import os
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///./test_school.db"

import pytest
from fastapi.testclient import TestClient

from app.db import Base, engine
from app.main import app
from app.security import Principal, get_principal


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_principal] = lambda: Principal("test-admin", frozenset({"registrar"}))
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
