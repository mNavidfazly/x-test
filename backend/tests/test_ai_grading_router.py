from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.config import get_settings
from app.dependencies import get_current_user, get_supabase
from app.main import app
from app.models.schemas import UserClaims

_user = UserClaims(sub="user-123", tenant_id="tenant-1")


def _auth_override():
    return _user


def _make_supabase_mock(
    attempt=None,
    answers=None,
    questions=None,
    rpc_result=None,
):
    mock = MagicMock()

    def table_side_effect(table_name):
        t = MagicMock()

        if table_name == "quiz_attempts":
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[attempt] if attempt else []
            )
        elif table_name == "quiz_attempt_answers":
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=answers or []
            )
            # Also support update chain
            t.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()
        elif table_name == "quiz_questions":
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=questions or []
            )
        return t

    mock.table.side_effect = table_side_effect
    mock.rpc.return_value.execute.return_value = MagicMock(
        data=rpc_result or {"score": 0, "passed": False, "earned_points": 0, "total_points": 0}
    )
    return mock


_ATTEMPT = {
    "id": "attempt-1",
    "user_id": "user-123",
    "quiz_id": "quiz-1",
    "score": 50.0,
    "passed": False,
    "submitted_at": "2025-01-01T00:00:00Z",
}

_QUESTIONS = [
    {"id": "q1", "question_text": "What is LNG?", "question_type": "short_answer", "correct_answer": "Liquefied Natural Gas", "points": 10},
    {"id": "q2", "question_text": "True or False?", "question_type": "true_false", "correct_answer": None, "points": 10},
]

_ANSWERS = [
    {"question_id": "q1", "user_answer": "liquid natural gas", "ai_accepted": False},
    {"question_id": "q2", "user_answer": "opt-correct", "ai_accepted": False},
]

_RPC_RESULT = {"score": 50.0, "passed": False, "earned_points": 10, "total_points": 20}


class TestAiGradingRouter:
    def _get_client(self, supabase_mock):
        app.dependency_overrides[get_current_user] = _auth_override
        app.dependency_overrides[get_supabase] = lambda: supabase_mock
        client = TestClient(app)
        return client

    def teardown_method(self):
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_supabase, None)

    def test_no_auth_returns_401(self):
        """Without auth override, should return 403 (no bearer token)."""
        app.dependency_overrides.pop(get_current_user, None)
        mock_sb = _make_supabase_mock()
        app.dependency_overrides[get_supabase] = lambda: mock_sb
        client = TestClient(app)
        resp = client.post("/api/quiz-grading/ai-check", json={"attempt_id": "x"})
        assert resp.status_code == 403
        app.dependency_overrides.clear()

    def test_no_api_key_returns_503(self):
        """Without anthropic_api_key configured, should return 503."""
        mock_sb = _make_supabase_mock()
        client = self._get_client(mock_sb)
        resp = client.post("/api/quiz-grading/ai-check", json={"attempt_id": "attempt-1"})
        assert resp.status_code == 503

    @patch("app.routers.ai_grading.check_text_answers")
    def test_attempt_not_found(self, mock_ai):
        mock_sb = _make_supabase_mock(attempt=None)
        settings = get_settings()
        settings.anthropic_api_key = "test-key"

        client = self._get_client(mock_sb)
        resp = client.post("/api/quiz-grading/ai-check", json={"attempt_id": "nonexistent"})
        assert resp.status_code == 404

        settings.anthropic_api_key = ""

    @patch("app.routers.ai_grading.check_text_answers")
    def test_wrong_user_returns_403(self, mock_ai):
        attempt = {**_ATTEMPT, "user_id": "other-user"}
        mock_sb = _make_supabase_mock(attempt=attempt)
        settings = get_settings()
        settings.anthropic_api_key = "test-key"

        client = self._get_client(mock_sb)
        resp = client.post("/api/quiz-grading/ai-check", json={"attempt_id": "attempt-1"})
        assert resp.status_code == 403

        settings.anthropic_api_key = ""

    @patch("app.routers.ai_grading.check_text_answers")
    def test_no_text_questions_early_return_calls_rpc(self, mock_ai):
        questions = [_QUESTIONS[1]]  # Only true_false
        answers = [_ANSWERS[1]]
        rpc_result = {"score": 50.0, "passed": False, "earned_points": 10, "total_points": 20}
        mock_sb = _make_supabase_mock(
            attempt=_ATTEMPT, answers=answers, questions=questions,
            rpc_result=rpc_result,
        )
        settings = get_settings()
        settings.anthropic_api_key = "test-key"

        client = self._get_client(mock_sb)
        resp = client.post("/api/quiz-grading/ai-check", json={"attempt_id": "attempt-1"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ai_corrections"] == 0
        assert data["score"] == 50.0
        mock_sb.rpc.assert_called_once_with("recalculate_quiz_score", {"p_attempt_id": "attempt-1"})
        mock_ai.assert_not_called()

        settings.anthropic_api_key = ""

    @patch("app.routers.ai_grading.check_text_answers")
    def test_ai_accepts_answer_calls_rpc(self, mock_ai):
        mock_ai.return_value = {"q1": True}
        rpc_result = {"score": 100.0, "passed": True, "earned_points": 20, "total_points": 20}
        mock_sb = _make_supabase_mock(
            attempt=_ATTEMPT, answers=_ANSWERS, questions=_QUESTIONS,
            rpc_result=rpc_result,
        )
        settings = get_settings()
        settings.anthropic_api_key = "test-key"

        client = self._get_client(mock_sb)
        resp = client.post("/api/quiz-grading/ai-check", json={"attempt_id": "attempt-1"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ai_corrections"] == 1
        assert data["score"] == 100.0
        assert data["passed"] is True
        mock_sb.rpc.assert_called_once_with("recalculate_quiz_score", {"p_attempt_id": "attempt-1"})

        settings.anthropic_api_key = ""

    @patch("app.routers.ai_grading.check_text_answers")
    def test_ai_rejects_answer_still_calls_rpc(self, mock_ai):
        mock_ai.return_value = {"q1": False}
        rpc_result = {"score": 50.0, "passed": False, "earned_points": 10, "total_points": 20}
        mock_sb = _make_supabase_mock(
            attempt=_ATTEMPT, answers=_ANSWERS, questions=_QUESTIONS,
            rpc_result=rpc_result,
        )
        settings = get_settings()
        settings.anthropic_api_key = "test-key"

        client = self._get_client(mock_sb)
        resp = client.post("/api/quiz-grading/ai-check", json={"attempt_id": "attempt-1"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ai_corrections"] == 0
        assert data["score"] == 50.0
        mock_sb.rpc.assert_called_once_with("recalculate_quiz_score", {"p_attempt_id": "attempt-1"})

        settings.anthropic_api_key = ""

    @patch("app.routers.ai_grading.check_text_answers")
    def test_ai_failure_returns_zero_corrections(self, mock_ai):
        mock_ai.return_value = {}  # AI failed gracefully
        rpc_result = {"score": 50.0, "passed": False, "earned_points": 10, "total_points": 20}
        mock_sb = _make_supabase_mock(
            attempt=_ATTEMPT, answers=_ANSWERS, questions=_QUESTIONS,
            rpc_result=rpc_result,
        )
        settings = get_settings()
        settings.anthropic_api_key = "test-key"

        client = self._get_client(mock_sb)
        resp = client.post("/api/quiz-grading/ai-check", json={"attempt_id": "attempt-1"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ai_corrections"] == 0

        settings.anthropic_api_key = ""

    @patch("app.routers.ai_grading.check_text_answers")
    def test_ai_hallucinated_ids_filtered(self, mock_ai):
        """AI returns IDs we didn't send — they should be ignored."""
        mock_ai.return_value = {"q1": True, "unknown-id": True}
        rpc_result = {"score": 100.0, "passed": True, "earned_points": 20, "total_points": 20}
        mock_sb = _make_supabase_mock(
            attempt=_ATTEMPT, answers=_ANSWERS, questions=_QUESTIONS,
            rpc_result=rpc_result,
        )
        settings = get_settings()
        settings.anthropic_api_key = "test-key"

        client = self._get_client(mock_sb)
        resp = client.post("/api/quiz-grading/ai-check", json={"attempt_id": "attempt-1"})
        assert resp.status_code == 200
        data = resp.json()
        # Only q1 should be counted, not unknown-id
        assert data["ai_corrections"] == 1

        settings.anthropic_api_key = ""
