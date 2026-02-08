import os
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

# Set test env vars before importing app modules
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-that-is-long-enough-for-hs256")
os.environ.setdefault("SMTP_PASSWORD", "test-smtp-password")

from app.config import Settings, get_settings
from app.dependencies import get_supabase
from app.main import app


@pytest.fixture
def settings() -> Settings:
    return get_settings()


@pytest.fixture
def mock_supabase() -> MagicMock:
    mock = MagicMock()
    mock.table.return_value.select.return_value.limit.return_value.execute.return_value = (
        MagicMock(count=1)
    )
    return mock


@pytest.fixture
def client(mock_supabase: MagicMock) -> TestClient:
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    yield TestClient(app)
    app.dependency_overrides.clear()
