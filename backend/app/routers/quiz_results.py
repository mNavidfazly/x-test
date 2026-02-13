import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from supabase import Client

from app.config import Settings, get_settings
from app.dependencies import get_supabase
from app.models.schemas import ExternalQuizResultRequest, ExternalQuizResultResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["quiz-results"])


@router.post("/quiz-results/external", response_model=ExternalQuizResultResponse)
def receive_external_quiz_result(
    body: ExternalQuizResultRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    supabase: Annotated[Client, Depends(get_supabase)],
    x_api_key: Annotated[str, Header()],
) -> ExternalQuizResultResponse:
    """Receive quiz result from an external quiz platform via webhook."""

    # 1. Validate API key
    if not settings.external_quiz_api_key or x_api_key != settings.external_quiz_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )

    # 2. Look up user by email → get user_id, tenant_id
    profile_result = (
        supabase.table("profiles")
        .select("id, tenant_id")
        .eq("email", body.user_email)
        .limit(1)
        .execute()
    )

    if not profile_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found with email: {body.user_email}",
        )

    profile = profile_result.data[0]
    user_id = profile["id"]
    tenant_id = profile["tenant_id"]

    # 3. Insert into external_quiz_results (service role bypasses RLS)
    insert_data = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "external_quiz_id": body.external_quiz_id,
        "score": body.score,
        "passed": body.passed,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "raw_response": body.details,
    }

    try:
        result = (
            supabase.table("external_quiz_results")
            .insert(insert_data)
            .execute()
        )
    except Exception:
        logger.exception("Failed to insert external quiz result for %s", body.user_email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store quiz result",
        )

    result_id = result.data[0]["id"] if result.data else None

    logger.info(
        "External quiz result recorded: user=%s quiz=%s passed=%s",
        user_id,
        body.external_quiz_id,
        body.passed,
    )

    return ExternalQuizResultResponse(
        status="ok",
        user_id=user_id,
        result_id=result_id,
    )
