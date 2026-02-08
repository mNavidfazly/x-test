import os

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_loads_from_env() -> None:
    settings = Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_key="test-key",
        supabase_jwt_secret="test-secret",
        smtp_password="test-pass",
    )
    assert settings.supabase_url == "https://test.supabase.co"
    assert settings.smtp_host == "smtp.office365.com"
    assert settings.smtp_port == 587


def test_settings_missing_required_raises() -> None:
    env_backup = {
        k: os.environ.pop(k)
        for k in [
            "SUPABASE_URL",
            "SUPABASE_SERVICE_KEY",
            "SUPABASE_JWT_SECRET",
            "SMTP_PASSWORD",
        ]
        if k in os.environ
    }
    try:
        with pytest.raises(ValidationError):
            Settings(_env_file=None)
    finally:
        os.environ.update(env_backup)


def test_settings_defaults() -> None:
    settings = Settings(
        supabase_url="https://x.supabase.co",
        supabase_service_key="key",
        supabase_jwt_secret="secret",
        smtp_password="pass",
    )
    assert settings.from_email == "noreply@calypso-commodities.com"
    assert settings.cors_origins == ["http://localhost:4200"]
