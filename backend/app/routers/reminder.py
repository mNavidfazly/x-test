import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.config import Settings, get_settings
from app.dependencies import get_current_user, get_supabase
from app.models.schemas import SendRemindersRequest, SendRemindersResponse, UserClaims
from app.services.email import send_email

logger = logging.getLogger(__name__)

router = APIRouter(tags=["reminders"])


@router.post("/reminders/send", response_model=SendRemindersResponse)
async def send_reminders(
    body: SendRemindersRequest,
    user: Annotated[UserClaims, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SendRemindersResponse:
    """Send reminder emails to selected users and log to reminder_history."""
    # Authorization: PA, TA, CSM, or Lecturer
    if not (
        user.is_platform_admin
        or user.is_tenant_admin
        or len(user.csm_tenant_ids) > 0
        or len(user.lecturer_course_ids) > 0
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to send reminders",
        )

    if not body.user_ids:
        return SendRemindersResponse(sent=0, failed=0)

    # Fetch recipient profiles
    result = (
        supabase.table("profiles")
        .select("id, email, tenant_id")
        .in_("id", body.user_ids)
        .execute()
    )
    recipients = result.data or []

    sent = 0
    failed = 0

    for recipient in recipients:
        try:
            html_body = f"""
            <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0d9488;">Course Progress Reminder</h2>
                <p>{body.message}</p>
                <p style="margin-top: 24px;">
                    <a href="{settings.frontend_url}/courses"
                       style="background-color: #0d9488; color: white; padding: 12px 24px;
                              border-radius: 8px; text-decoration: none; font-weight: 600;">
                        Continue Learning
                    </a>
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
                    This reminder was sent by your learning administrator.
                </p>
            </div>
            """

            await send_email(
                settings,
                recipient["email"],
                "Course Progress Reminder",
                html_body,
            )

            # Log to reminder_history (trigger auto-creates notification)
            supabase.table("reminder_history").insert(
                {
                    "sent_by": user.sub,
                    "sent_to": recipient["id"],
                    "tenant_id": recipient["tenant_id"],
                    "course_id": body.course_id,
                }
            ).execute()

            sent += 1
        except Exception as e:
            logger.warning("Failed to send reminder to %s: %s", recipient.get("email"), e)
            failed += 1

    return SendRemindersResponse(sent=sent, failed=failed)
