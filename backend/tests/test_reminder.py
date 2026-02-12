from unittest.mock import AsyncMock, MagicMock, patch

from app.dependencies import get_current_user
from app.main import app
from app.models.schemas import UserClaims


def _pa_user() -> UserClaims:
    return UserClaims(
        sub="user-pa",
        tenant_id="tenant-master",
        is_platform_admin=True,
    )


def _ta_user() -> UserClaims:
    return UserClaims(
        sub="user-ta",
        tenant_id="tenant-1",
        is_tenant_admin=True,
    )


def _csm_user() -> UserClaims:
    return UserClaims(
        sub="user-csm",
        tenant_id="tenant-master",
        csm_tenant_ids=["tenant-1", "tenant-2"],
    )


def _lecturer_user() -> UserClaims:
    return UserClaims(
        sub="user-lecturer",
        tenant_id="tenant-master",
        lecturer_course_ids=["course-1"],
    )


def _learner_user() -> UserClaims:
    return UserClaims(
        sub="user-learner",
        tenant_id="tenant-1",
    )


RECIPIENTS = [
    {"id": "u1", "email": "alice@test.com", "tenant_id": "tenant-1"},
    {"id": "u2", "email": "bob@test.com", "tenant_id": "tenant-1"},
]

PAYLOAD = {
    "user_ids": ["u1", "u2"],
    "course_id": "course-1",
    "message": "Keep going!",
}


class TestSendReminders:
    @patch("app.routers.reminder.send_email", new_callable=AsyncMock)
    def test_pa_can_send_to_any_user(self, mock_email, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _pa_user
        mock_supabase.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            MagicMock(data=RECIPIENTS)
        )
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock()

        resp = client.post("/api/reminders/send", json=PAYLOAD)

        assert resp.status_code == 200
        data = resp.json()
        assert data["sent"] == 2
        assert data["failed"] == 0
        assert mock_email.call_count == 2
        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.reminder.send_email", new_callable=AsyncMock)
    def test_ta_can_send_reminders(self, mock_email, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _ta_user
        mock_supabase.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            MagicMock(data=RECIPIENTS[:1])
        )
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock()

        resp = client.post("/api/reminders/send", json=PAYLOAD)

        assert resp.status_code == 200
        assert resp.json()["sent"] == 1
        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.reminder.send_email", new_callable=AsyncMock)
    def test_csm_can_send_reminders(self, mock_email, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _csm_user
        mock_supabase.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            MagicMock(data=RECIPIENTS)
        )
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock()

        resp = client.post("/api/reminders/send", json=PAYLOAD)

        assert resp.status_code == 200
        assert resp.json()["sent"] == 2
        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.reminder.send_email", new_callable=AsyncMock)
    def test_lecturer_can_send_reminders(self, mock_email, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _lecturer_user
        mock_supabase.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            MagicMock(data=RECIPIENTS[:1])
        )
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock()

        resp = client.post("/api/reminders/send", json=PAYLOAD)

        assert resp.status_code == 200
        assert resp.json()["sent"] == 1
        app.dependency_overrides.pop(get_current_user, None)

    def test_learner_rejected_403(self, client):
        app.dependency_overrides[get_current_user] = _learner_user

        resp = client.post("/api/reminders/send", json=PAYLOAD)

        assert resp.status_code == 403
        assert "permission" in resp.json()["detail"].lower()
        app.dependency_overrides.pop(get_current_user, None)

    def test_unauthenticated_401(self, client):
        # No get_current_user override — HTTPBearer requires Authorization header
        app.dependency_overrides.pop(get_current_user, None)

        resp = client.post("/api/reminders/send", json=PAYLOAD)

        assert resp.status_code in (401, 403)

    @patch("app.routers.reminder.send_email", new_callable=AsyncMock)
    def test_partial_failure_returns_counts(self, mock_email, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _pa_user
        mock_supabase.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            MagicMock(data=RECIPIENTS)
        )
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock()

        # First call succeeds, second raises
        mock_email.side_effect = [None, Exception("SMTP error")]

        resp = client.post("/api/reminders/send", json=PAYLOAD)

        assert resp.status_code == 200
        data = resp.json()
        assert data["sent"] == 1
        assert data["failed"] == 1
        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.reminder.send_email", new_callable=AsyncMock)
    def test_empty_user_ids_returns_zero(self, mock_email, client):
        app.dependency_overrides[get_current_user] = _pa_user

        resp = client.post(
            "/api/reminders/send",
            json={"user_ids": [], "course_id": None, "message": "Hi"},
        )

        assert resp.status_code == 200
        assert resp.json() == {"sent": 0, "failed": 0}
        mock_email.assert_not_called()
        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.reminder.send_email", new_callable=AsyncMock)
    def test_reminder_history_inserted(self, mock_email, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _pa_user
        mock_supabase.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            MagicMock(data=[RECIPIENTS[0]])
        )
        mock_insert = MagicMock()
        mock_supabase.table.return_value.insert.return_value.execute = mock_insert

        resp = client.post("/api/reminders/send", json=PAYLOAD)

        assert resp.status_code == 200
        # Verify insert was called (table("reminder_history").insert(...).execute())
        mock_supabase.table.assert_any_call("reminder_history")
        app.dependency_overrides.pop(get_current_user, None)
