import hashlib
import time
from typing import Optional

import httpx

from app.config import Settings

BUNNY_API_BASE = "https://video.bunnycdn.com"
TUS_ENDPOINT = f"{BUNNY_API_BASE}/tusupload"


async def create_video(settings: Settings, title: str) -> dict:
    """Create a video placeholder in Bunny Stream. Returns the full video object including guid."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BUNNY_API_BASE}/library/{settings.bunny_library_id}/videos",
            headers={"AccessKey": settings.bunny_api_key},
            json={"title": title},
        )
        resp.raise_for_status()
        return resp.json()


def generate_tus_signature(
    library_id: int, api_key: str, video_id: str, expiry_seconds: int = 7200
) -> tuple[str, int]:
    """Generate SHA256 signature for TUS upload auth. Returns (signature, expire_timestamp)."""
    expire = int(time.time()) + expiry_seconds
    raw = f"{library_id}{api_key}{expire}{video_id}"
    signature = hashlib.sha256(raw.encode()).hexdigest()
    return signature, expire


def generate_embed_token(
    token_key: str, video_id: str, expiry_seconds: int = 14400
) -> tuple[str, int]:
    """Generate SHA256 token for signed embed URL. Returns (token, expire_timestamp)."""
    expire = int(time.time()) + expiry_seconds
    raw = f"{token_key}{video_id}{expire}"
    token = hashlib.sha256(raw.encode()).hexdigest()
    return token, expire


async def get_video_status(settings: Settings, video_id: str) -> dict:
    """Get video encoding status from Bunny Stream. Returns the full video object."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BUNNY_API_BASE}/library/{settings.bunny_library_id}/videos/{video_id}",
            headers={"AccessKey": settings.bunny_api_key},
        )
        resp.raise_for_status()
        return resp.json()


async def delete_video(settings: Settings, video_id: str) -> None:
    """Delete a video from Bunny Stream."""
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{BUNNY_API_BASE}/library/{settings.bunny_library_id}/videos/{video_id}",
            headers={"AccessKey": settings.bunny_api_key},
        )
        resp.raise_for_status()


def build_thumbnail_url(
    cdn_hostname: str, video_id: str, thumbnail_filename: Optional[str] = None
) -> str:
    """Construct CDN thumbnail URL."""
    filename = thumbnail_filename or "thumbnail.jpg"
    return f"https://{cdn_hostname}/{video_id}/{filename}"
