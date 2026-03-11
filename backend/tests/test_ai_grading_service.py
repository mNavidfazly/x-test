import json
from unittest.mock import MagicMock, patch

from app.services.ai_grading import check_text_answers


def _make_question(qid="q1", qtype="short_answer", correct="Liquefied Natural Gas", user="liquid natural gas"):
    return {
        "question_id": qid,
        "question_text": "What does LNG stand for?",
        "question_type": qtype,
        "correct_answer": correct,
        "user_answer": user,
    }


class TestCheckTextAnswers:
    def test_empty_questions_returns_empty(self):
        assert check_text_answers("key", []) == {}

    def test_no_api_key_returns_empty(self):
        assert check_text_answers("", [_make_question()]) == {}

    @patch("app.services.ai_grading.anthropic")
    def test_successful_ai_check(self, mock_anthropic):
        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(text='{"q1": true, "q2": false}')]
        mock_anthropic.Anthropic.return_value.messages.create.return_value = mock_msg

        result = check_text_answers("key", [
            _make_question("q1"),
            _make_question("q2", user="something wrong"),
        ])

        assert result == {"q1": True, "q2": False}
        mock_anthropic.Anthropic.assert_called_once_with(api_key="key")

    @patch("app.services.ai_grading.anthropic")
    def test_ai_returns_markdown_code_block(self, mock_anthropic):
        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(text='```json\n{"q1": true}\n```')]
        mock_anthropic.Anthropic.return_value.messages.create.return_value = mock_msg

        result = check_text_answers("key", [_make_question("q1")])
        assert result == {"q1": True}

    @patch("app.services.ai_grading.anthropic")
    def test_ai_error_returns_empty(self, mock_anthropic):
        mock_anthropic.Anthropic.return_value.messages.create.side_effect = RuntimeError("API timeout")

        result = check_text_answers("key", [_make_question()])
        assert result == {}

    @patch("app.services.ai_grading.anthropic")
    def test_invalid_json_returns_empty(self, mock_anthropic):
        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(text="not valid json")]
        mock_anthropic.Anthropic.return_value.messages.create.return_value = mock_msg

        result = check_text_answers("key", [_make_question()])
        assert result == {}

    @patch("app.services.ai_grading.anthropic")
    def test_non_dict_json_returns_empty(self, mock_anthropic):
        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(text="[1, 2, 3]")]
        mock_anthropic.Anthropic.return_value.messages.create.return_value = mock_msg

        result = check_text_answers("key", [_make_question()])
        assert result == {}

    @patch("app.services.ai_grading.anthropic")
    def test_fill_blank_uses_strict_mode(self, mock_anthropic):
        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(text='{"q1": true}')]
        mock_anthropic.Anthropic.return_value.messages.create.return_value = mock_msg

        check_text_answers("key", [_make_question("q1", qtype="fill_blank")])

        call_args = mock_anthropic.Anthropic.return_value.messages.create.call_args
        prompt = call_args.kwargs["messages"][0]["content"]
        assert "STRICT" in prompt
