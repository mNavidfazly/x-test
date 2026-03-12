import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.config import Settings, get_settings
from app.dependencies import get_current_user, get_supabase
from app.models.schemas import AiGradeRequest, AiGradeResponse, UserClaims
from app.services.ai_grading import check_text_answers

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai-grading"])


@router.post("/quiz-grading/ai-check", response_model=AiGradeResponse)
def ai_grade_check(
    body: AiGradeRequest,
    user: Annotated[UserClaims, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> AiGradeResponse:
    """AI-check text answers that failed exact match grading."""

    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI grading not configured",
        )

    # 1. Fetch attempt — verify ownership and that it's been graded
    attempt_result = (
        supabase.table("quiz_attempts")
        .select("id, user_id, quiz_id, score, passed, submitted_at")
        .eq("id", body.attempt_id)
        .limit(1)
        .execute()
    )

    if not attempt_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")

    attempt = attempt_result.data[0]

    if attempt["user_id"] != user.sub:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your attempt")

    if attempt["submitted_at"] is None or attempt["score"] is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attempt not yet graded")

    # 2. Get all answers + questions for this attempt
    answers_result = (
        supabase.table("quiz_attempt_answers")
        .select("question_id, user_answer, ai_accepted")
        .eq("attempt_id", body.attempt_id)
        .execute()
    )

    questions_result = (
        supabase.table("quiz_questions")
        .select("id, question_text, question_type, correct_answer, points")
        .eq("quiz_id", attempt["quiz_id"])
        .execute()
    )

    answers_by_qid = {a["question_id"]: a for a in (answers_result.data or [])}
    questions = questions_result.data or []

    # 3. Find text questions that failed exact match and haven't been AI-checked yet
    text_to_check = []
    for q in questions:
        if q["question_type"] not in ("fill_blank", "short_answer"):
            continue
        ans = answers_by_qid.get(q["id"])
        if not ans or not ans["user_answer"] or not q["correct_answer"]:
            continue
        # Already AI-accepted from a previous call
        if ans["ai_accepted"]:
            continue
        # Check if exact match already passed (skip AI)
        if ans["user_answer"].strip().lower() == q["correct_answer"].strip().lower():
            continue
        text_to_check.append({
            "question_id": q["id"],
            "question_text": q["question_text"],
            "question_type": q["question_type"],
            "correct_answer": q["correct_answer"],
            "user_answer": ans["user_answer"],
        })

    # 4. Early return if nothing to check
    if not text_to_check:
        rpc_result = supabase.rpc(
            "recalculate_quiz_score", {"p_attempt_id": body.attempt_id}
        ).execute()
        result = rpc_result.data
        return AiGradeResponse(
            score=result["score"],
            passed=result["passed"],
            earned_points=result["earned_points"],
            total_points=result["total_points"],
            ai_corrections=0,
        )

    # 5. Call AI service
    ai_results = check_text_answers(settings.anthropic_api_key, text_to_check)

    # 6. Validate AI results — only accept IDs that we actually sent
    valid_question_ids = {item["question_id"] for item in text_to_check}
    ai_results = {qid: v for qid, v in ai_results.items() if qid in valid_question_ids}

    # 7. Update ai_accepted for accepted answers
    accepted_ids = [qid for qid, accepted in ai_results.items() if accepted]

    for qid in accepted_ids:
        supabase.table("quiz_attempt_answers").update(
            {"ai_accepted": True}
        ).eq("attempt_id", body.attempt_id).eq("question_id", qid).execute()

    # 8. Recalculate score via RPC — single source of truth for grading logic
    rpc_result = supabase.rpc(
        "recalculate_quiz_score", {"p_attempt_id": body.attempt_id}
    ).execute()
    result = rpc_result.data

    logger.info(
        "AI grading: attempt=%s checked=%d accepted=%d score=%s->%s",
        body.attempt_id, len(text_to_check), len(accepted_ids),
        attempt["score"], result["score"],
    )

    return AiGradeResponse(
        score=result["score"],
        passed=result["passed"],
        earned_points=result["earned_points"],
        total_points=result["total_points"],
        ai_corrections=len(accepted_ids),
    )
