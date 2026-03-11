import json
import logging
from typing import Dict, List, TypedDict

import anthropic

logger = logging.getLogger(__name__)


class TextQuestion(TypedDict):
    question_id: str
    question_text: str
    question_type: str  # "fill_blank" or "short_answer"
    correct_answer: str
    user_answer: str


def check_text_answers(api_key: str, questions: List[TextQuestion]) -> Dict[str, bool]:
    """Check text answers using Claude Sonnet with extended thinking.

    Returns a dict mapping question_id -> is_correct.
    On any failure, returns an empty dict (graceful degradation).
    """
    if not questions or not api_key:
        return {}

    items = []
    for q in questions:
        strictness = "STRICT" if q["question_type"] == "fill_blank" else "LENIENT"
        items.append(
            f'- ID: {q["question_id"]}\n'
            f'  Question: {q["question_text"]}\n'
            f'  Correct answer: {q["correct_answer"]}\n'
            f'  User answer: {q["user_answer"]}\n'
            f'  Mode: {strictness}'
        )

    prompt = (
        "You are a quiz grading assistant. For each question below, determine if the user's answer "
        "is semantically equivalent to the correct answer.\n\n"
        "Rules:\n"
        "- STRICT mode (fill_blank): The user must provide the same concept, term, or value. "
        "Accept minor spelling variations, abbreviations, and different formatting of the same thing. "
        "Reject different concepts even if related.\n"
        "- LENIENT mode (short_answer): Accept answers that convey the same meaning, even if worded "
        "differently. The core idea must match. Accept reasonable paraphrasing.\n\n"
        "Questions:\n" + "\n".join(items) + "\n\n"
        'Respond ONLY with a JSON object mapping each question ID to true (accept) or false (reject). '
        'Example: {"id1": true, "id2": false}'
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=16000,
            thinking={
                "type": "enabled",
                "budget_tokens": 5000,
            },
            messages=[{"role": "user", "content": prompt}],
        )

        # Extract text from response — skip thinking blocks, find the text block
        text = ""
        for block in message.content:
            if getattr(block, "type", None) == "text":
                text = block.text.strip()
                break

        # Parse JSON — handle potential markdown code blocks
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        result = json.loads(text)
        if not isinstance(result, dict):
            logger.warning("AI grading returned non-dict: %s", type(result))
            return {}

        return {k: bool(v) for k, v in result.items()}

    except (json.JSONDecodeError, IndexError, KeyError) as e:
        logger.warning("AI grading parse error: %s", e)
        return {}
    except Exception as e:
        logger.warning("AI grading error: %s", e)
        return {}
