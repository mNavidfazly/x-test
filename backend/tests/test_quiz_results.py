from unittest.mock import MagicMock

API_KEY = "test-external-quiz-api-key"

VALID_PAYLOAD = {
    "external_quiz_id": "EXT-QUIZ-001",
    "user_email": "alice@test.com",
    "score": 85.0,
    "passed": True,
    "details": {"raw_score": 17, "max_score": 20},
}

PROFILE = {"id": "user-uuid-1", "tenant_id": "tenant-uuid-1"}


class TestExternalQuizWebhook:
    """Tests for POST /api/quiz-results/external"""

    def test_valid_result_inserts_and_returns_ok(self, client, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            MagicMock(data=[PROFILE])
        )
        mock_supabase.table.return_value.insert.return_value.execute.return_value = (
            MagicMock(data=[{"id": "result-uuid-1"}])
        )

        resp = client.post(
            "/api/quiz-results/external",
            json=VALID_PAYLOAD,
            headers={"X-API-Key": API_KEY},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["user_id"] == "user-uuid-1"
        assert data["result_id"] == "result-uuid-1"

    def test_rejects_missing_api_key(self, client):
        resp = client.post(
            "/api/quiz-results/external",
            json=VALID_PAYLOAD,
        )
        assert resp.status_code == 422

    def test_rejects_wrong_api_key(self, client):
        resp = client.post(
            "/api/quiz-results/external",
            json=VALID_PAYLOAD,
            headers={"X-API-Key": "wrong-key"},
        )
        assert resp.status_code == 403
        assert "Invalid API key" in resp.json()["detail"]

    def test_returns_404_for_unknown_email(self, client, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            MagicMock(data=[])
        )

        resp = client.post(
            "/api/quiz-results/external",
            json={**VALID_PAYLOAD, "user_email": "unknown@test.com"},
            headers={"X-API-Key": API_KEY},
        )

        assert resp.status_code == 404
        assert "No user found" in resp.json()["detail"]

    def test_accepts_minimal_payload(self, client, mock_supabase):
        """score, passed, and details are all optional."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            MagicMock(data=[PROFILE])
        )
        mock_supabase.table.return_value.insert.return_value.execute.return_value = (
            MagicMock(data=[{"id": "result-uuid-2"}])
        )

        resp = client.post(
            "/api/quiz-results/external",
            json={
                "external_quiz_id": "EXT-QUIZ-002",
                "user_email": "alice@test.com",
            },
            headers={"X-API-Key": API_KEY},
        )

        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_rejects_missing_required_fields(self, client):
        """external_quiz_id and user_email are required."""
        resp = client.post(
            "/api/quiz-results/external",
            json={"score": 90},
            headers={"X-API-Key": API_KEY},
        )
        assert resp.status_code == 422

    def test_inserts_into_correct_table(self, client, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            MagicMock(data=[PROFILE])
        )
        mock_supabase.table.return_value.insert.return_value.execute.return_value = (
            MagicMock(data=[{"id": "result-uuid-3"}])
        )

        resp = client.post(
            "/api/quiz-results/external",
            json=VALID_PAYLOAD,
            headers={"X-API-Key": API_KEY},
        )

        assert resp.status_code == 200
        mock_supabase.table.assert_any_call("external_quiz_results")

    def test_insert_failure_returns_500(self, client, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            MagicMock(data=[PROFILE])
        )
        mock_supabase.table.return_value.insert.return_value.execute.side_effect = (
            Exception("DB error")
        )

        resp = client.post(
            "/api/quiz-results/external",
            json=VALID_PAYLOAD,
            headers={"X-API-Key": API_KEY},
        )

        assert resp.status_code == 500
        assert "Failed to store quiz result" in resp.json()["detail"]
