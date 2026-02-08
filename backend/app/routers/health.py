from typing import Annotated

from fastapi import APIRouter, Depends
from supabase import Client

from app.dependencies import get_supabase
from app.models.schemas import HealthResponse

router = APIRouter()

VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse)
async def health_check(
    supabase: Annotated[Client, Depends(get_supabase)],
) -> HealthResponse:
    try:
        supabase.table("tenants").select("id", count="exact").limit(1).execute()
        sb_status = "connected"
    except Exception:
        sb_status = "unreachable"

    return HealthResponse(
        status="healthy",
        supabase=sb_status,
        version=VERSION,
    )
