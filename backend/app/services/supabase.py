from typing import Optional

from supabase import Client, create_client

from app.config import Settings

_client: Optional[Client] = None


def get_supabase_client(settings: Settings) -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client
