from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str

    smtp_host: str = "smtp.office365.com"
    smtp_port: int = 587
    smtp_username: str = "support@calypso-commodities.com"
    smtp_password: str
    from_email: str = "noreply@calypso-commodities.com"

    cors_origins: list[str] = ["http://localhost:4200"]

    model_config = SettingsConfigDict(env_file=".env")


@lru_cache
def get_settings() -> Settings:
    return Settings()
