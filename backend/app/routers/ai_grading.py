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
        quiz_result = (
            supabase.table("quizzes")
            .select("passing_score")
            .eq("id", attempt["quiz_id"])
            .limit(1)
            .execute()
        )
        passing_score = quiz_result.data[0]["passing_score"] if quiz_result.data else 0

        total_points = sum(q["points"] for q in questions)
        earned_points = (attempt["score"] / 100) * total_points if total_points > 0 else 0

        return AiGradeResponse(
            score=attempt["score"],
            passed=attempt["passed"],
            earned_points=round(earned_points, 2),
            total_points=total_points,
            ai_corrections=0,
        )

    # 5. Call AI service
    ai_results = check_text_answers(settings.anthropic_api_key, text_to_check)

    # 6. Update ai_accepted for accepted answers
    accepted_ids = [qid for qid, accepted in ai_results.items() if accepted]

    for qid in accepted_ids:
        supabase.table("quiz_attempt_answers").update(
            {"ai_accepted": True}
        ).eq("attempt_id", body.attempt_id).eq("question_id", qid).execute()

    # 7. Recalculate score
    quiz_result = (
        supabase.table("quizzes")
        .select("passing_score")
        .eq("id", attempt["quiz_id"])
        .limit(1)
        .execute()
    )
    passing_score = quiz_result.data[0]["passing_score"] if quiz_result.data else 0

    # Get option data for choice-based questions
    options_result = (
        supabase.table("quiz_question_options")
        .select("id, question_id, is_correct")
        .in_("question_id", [q["id"] for q in questions])
        .execute()
    )
    options_by_qid = {}
    for opt in (options_result.data or []):
        options_by_qid.setdefault(opt["question_id"], []).append(opt)

    accepted_set = set(accepted_ids)
    # Include previously AI-accepted answers
    for q in questions:
        ans = answers_by_qid.get(q["id"])
        if ans and ans["ai_accepted"]:
            accepted_set.add(q["id"])

    total_points = 0
    earned_points = 0

    for q in questions:
        pts = q["points"]
        total_points += pts
        ans = answers_by_qid.get(q["id"])
        user_answer = ans["user_answer"] if ans else None

        if not user_answer:
            continue

        qtype = q["question_type"]

        if qtype in ("single_choice", "true_false"):
            opts = options_by_qid.get(q["id"], [])
            for opt in opts:
                if opt["id"] == user_answer and opt["is_correct"]:
                    earned_points += pts
                    break

        elif qtype == "multiple_choice":
            opts = options_by_qid.get(q["id"], [])
            correct_ids = {o["id"] for o in opts if o["is_correct"]}
            if correct_ids:
                user_ids = set(user_answer.split(","))
                correct_selected = len(user_ids & correct_ids)
                incorrect_selected = len(user_ids) - correct_selected
                ratio = max(0, (correct_selected - incorrect_selected) / len(correct_ids))
                earned_points += round(ratio * pts, 2)

        elif qtype in ("fill_blank", "short_answer"):
            if q["correct_answer"]:
                if user_answer.strip().lower() == q["correct_answer"].strip().lower():
                    earned_points += pts
                elif q["id"] in accepted_set:
                    earned_points += pts

        elif qtype == "matching":
            if q["correct_answer"]:
                try:
                    import json
                    user_pairs = json.loads(user_answer)
                    correct_pairs = json.loads(q["correct_answer"])
                    total_pairs = len(correct_pairs)
                    if total_pairs > 0:
                        correct_count = sum(
                            1 for i in range(total_pairs)
                            if i < len(user_pairs) and user_pairs[i].get("right") == correct_pairs[i].get("right")
                        )
                        earned_points += round((correct_count / total_pairs) * pts, 2)
                except (ValueError, TypeError, KeyError):
                    pass

    # Calculate new score
    new_score = round((earned_points / total_points) * 100, 2) if total_points > 0 else 0
    new_passed = new_score >= passing_score

    # 8. Update score via RPC (bypasses protect trigger)
    if new_score != attempt["score"]:
        supabase.rpc("update_quiz_score", {
            "p_attempt_id": body.attempt_id,
            "p_score": new_score,
            "p_passed": new_passed,
        }).execute()

    logger.info(
        "AI grading: attempt=%s corrections=%d score=%s->%s",
        body.attempt_id, len(accepted_ids), attempt["score"], new_score,
    )

    return AiGradeResponse(
        score=new_score,
        passed=new_passed,
        earned_points=round(earned_points, 2),
        total_points=total_points,
        ai_corrections=len(accepted_ids),
    )
