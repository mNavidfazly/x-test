import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.config import Settings, get_settings
from app.dependencies import get_current_user, get_supabase
from app.models.schemas import (
    InitUploadRequest,
    InitUploadResponse,
    UserClaims,
    VideoStatusResponse,
    WebhookPayload,
)
from app.services.bunny import (
    TUS_ENDPOINT,
    create_video,
    delete_video,
    generate_embed_token,
    generate_tus_signature,
    get_video_status,
    build_thumbnail_url,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["video"])


@router.post("/video/init-upload", response_model=InitUploadResponse)
async def init_upload(
    body: InitUploadRequest,
    user: Annotated[UserClaims, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> InitUploadResponse:
    """Create a video in Bunny Stream and return TUS upload credentials."""
    if not user.is_platform_admin and body.course_id not in user.lecturer_can_edit_course_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to upload videos for this course",
        )

    video = await create_video(settings, body.title)
    video_id = video["guid"]

    signature, expire = generate_tus_signature(
        settings.bunny_library_id, settings.bunny_api_key, video_id
    )

    return InitUploadResponse(
        video_id=video_id,
        library_id=settings.bunny_library_id,
        auth_signature=signature,
        auth_expire=expire,
        tus_endpoint=TUS_ENDPOINT,
    )


@router.get("/video/{video_id}/status", response_model=VideoStatusResponse)
async def video_status(
    video_id: str,
    user: Annotated[UserClaims, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> VideoStatusResponse:
    """Get encoding status and signed embed URL for a video."""
    video = await get_video_status(settings, video_id)

    embed_url = None
    video_status_code = video.get("status", 0)
    if video_status_code >= 3:
        token, expire = generate_embed_token(settings.bunny_token_key, video_id)
        embed_url = (
            f"https://iframe.mediadelivery.net/embed"
            f"/{settings.bunny_library_id}/{video_id}"
            f"?token={token}&expires={expire}"
        )

    thumbnail_url = None
    thumbnail_filename = video.get("thumbnailFileName")
    if thumbnail_filename and settings.bunny_cdn_hostname:
        thumbnail_url = build_thumbnail_url(
            settings.bunny_cdn_hostname, video_id, thumbnail_filename
        )

    return VideoStatusResponse(
        video_id=video_id,
        status=video_status_code,
        encode_progress=video.get("encodeProgress", 0),
        duration=video.get("length") or None,
        thumbnail_url=thumbnail_url,
        embed_url=embed_url,
    )


@router.post("/video/webhook", status_code=200)
async def video_webhook(
    body: WebhookPayload,
    settings: Annotated[Settings, Depends(get_settings)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> dict:
    """Handle Bunny Stream encoding status webhook."""
    if body.VideoLibraryId != settings.bunny_library_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid library ID",
        )

    update_data: dict = {"encoding_status": body.Status}

    # On encoding finished (status 3), fetch video details for duration/thumbnail
    if body.Status == 3:
        try:
            video = await get_video_status(settings, body.VideoGuid)
            duration = video.get("length")
            if duration:
                update_data["duration"] = duration
            thumbnail_filename = video.get("thumbnailFileName")
            if thumbnail_filename and settings.bunny_cdn_hostname:
                update_data["thumbnail_url"] = build_thumbnail_url(
                    settings.bunny_cdn_hostname, body.VideoGuid, thumbnail_filename
                )
        except Exception:
            logger.warning("Failed to fetch video details for %s", body.VideoGuid)

    result = (
        supabase.table("module_videos")
        .update(update_data)
        .eq("bunny_video_id", body.VideoGuid)
        .execute()
    )

    if not result.data:
        logger.warning("No module_videos row found for bunny_video_id=%s", body.VideoGuid)

    return {"status": "ok"}


@router.delete("/video/{video_id}", status_code=200)
async def delete_video_endpoint(
    video_id: str,
    user: Annotated[UserClaims, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """Delete a video from Bunny Stream. Used for cleanup when a module is deleted."""
    if not user.is_platform_admin and not user.lecturer_can_edit_course_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete videos",
        )

    try:
        await delete_video(settings, video_id)
    except Exception:
        logger.warning("Failed to delete Bunny video %s", video_id)

    return {"status": "ok"}
