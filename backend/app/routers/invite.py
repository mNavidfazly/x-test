import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.schemas import InviteUserRequest, InviteUserResponse, UserClaims

logger = logging.getLogger(__name__)

router = APIRouter(tags=["invite"])


@router.post("/invite", response_model=InviteUserResponse)
async def invite_user(
    body: InviteUserRequest,
    user: Annotated[UserClaims, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> InviteUserResponse:
    """Invite a new user by email. Creates auth user + sends invite email."""
    # Authorization: Platform Admin or Tenant Admin only
    if not (user.is_platform_admin or user.is_tenant_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins and tenant admins can invite users",
        )

    # Determine tenant_id
    if user.is_platform_admin and body.tenant_id:
        tenant_id = body.tenant_id
    elif user.tenant_id:
        tenant_id = user.tenant_id
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine tenant for invitation",
        )

    # Validate tenant exists (maybe_single returns None for 0 rows)
    tenant_result = (
        supabase.table("tenants")
        .select("id")
        .eq("id", tenant_id)
        .maybe_single()
        .execute()
    )
    if tenant_result is None or not tenant_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    # Check if user with this email already exists (None = not found = OK)
    existing = (
        supabase.table("profiles")
        .select("id")
        .eq("email", body.email)
        .maybe_single()
        .execute()
    )
    if existing is not None and existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    # Invite user via Supabase Auth Admin API
    try:
        result = supabase.auth.admin.invite_user_by_email(
            body.email,
            options={"data": {"tenant_id": tenant_id}},
        )
        user_id = result.user.id if result.user else None
    except Exception as e:
        logger.error("Failed to invite user %s: %s", body.email, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send invitation",
        )

    return InviteUserResponse(
        message="Invitation sent successfully",
        user_id=str(user_id) if user_id else None,
    )
