from unittest.mock import MagicMock

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
        csm_tenant_ids=["tenant-1"],
    )


def _learner_user() -> UserClaims:
    return UserClaims(
        sub="user-learner",
        tenant_id="tenant-1",
    )


INVITE_PAYLOAD = {"email": "newuser@example.com", "tenant_id": "tenant-1"}


def _mock_tenant_exists(mock_supabase):
    """Wire up tenant lookup to return a valid tenant."""
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data={"id": "tenant-1"}
    )


def _mock_no_existing_profile(mock_supabase):
    """Wire up profile lookup to return no existing user."""
    # This needs a second .eq() chain — re-wire after tenant check
    pass


def _mock_invite_success(mock_supabase):
    """Wire up auth admin invite to succeed."""
    mock_user = MagicMock()
    mock_user.id = "new-user-id"
    mock_result = MagicMock()
    mock_result.user = mock_user
    mock_supabase.auth.admin.invite_user_by_email.return_value = mock_result


class TestInviteUser:
    def test_pa_can_invite_to_any_tenant(self, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _pa_user

        # Mock: tenant exists, no existing profile, invite succeeds
        # Note: maybe_single().execute() returns None for 0 rows in production
        mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.side_effect = [
            MagicMock(data={"id": "tenant-1"}),  # tenant lookup
            None,  # profile lookup (no duplicate — real maybe_single returns None)
        ]
        _mock_invite_success(mock_supabase)

        resp = client.post("/api/invite", json=INVITE_PAYLOAD)

        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Invitation sent successfully"
        assert data["user_id"] == "new-user-id"
        mock_supabase.auth.admin.invite_user_by_email.assert_called_once()
        app.dependency_overrides.pop(get_current_user, None)

    def test_ta_can_invite_to_own_tenant(self, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _ta_user

        # TA sends only email — tenant_id comes from JWT
        mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.side_effect = [
            MagicMock(data={"id": "tenant-1"}),  # tenant lookup (TA's own)
            None,  # no duplicate — real maybe_single returns None for 0 rows
        ]
        _mock_invite_success(mock_supabase)

        resp = client.post("/api/invite", json={"email": "newuser@example.com"})

        assert resp.status_code == 200
        assert resp.json()["message"] == "Invitation sent successfully"
        # Verify invite was called with TA's tenant_id
        call_args = mock_supabase.auth.admin.invite_user_by_email.call_args
        assert call_args[1]["options"]["data"]["tenant_id"] == "tenant-1"
        app.dependency_overrides.pop(get_current_user, None)

    def test_ta_uses_own_tenant_even_if_different_provided(self, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _ta_user

        mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.side_effect = [
            MagicMock(data={"id": "tenant-1"}),
            None,  # no duplicate
        ]
        _mock_invite_success(mock_supabase)

        # TA tries to specify a different tenant — should use their own
        resp = client.post(
            "/api/invite",
            json={"email": "newuser@example.com", "tenant_id": "tenant-other"},
        )

        assert resp.status_code == 200
        # TA is NOT platform admin, so tenant_id falls back to JWT claim
        call_args = mock_supabase.auth.admin.invite_user_by_email.call_args
        assert call_args[1]["options"]["data"]["tenant_id"] == "tenant-1"
        app.dependency_overrides.pop(get_current_user, None)

    def test_learner_rejected_403(self, client):
        app.dependency_overrides[get_current_user] = _learner_user

        resp = client.post("/api/invite", json=INVITE_PAYLOAD)

        assert resp.status_code == 403
        assert "permission" in resp.json()["detail"].lower() or "admin" in resp.json()["detail"].lower()
        app.dependency_overrides.pop(get_current_user, None)

    def test_csm_rejected_403(self, client):
        app.dependency_overrides[get_current_user] = _csm_user

        resp = client.post("/api/invite", json=INVITE_PAYLOAD)

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)

    def test_unauthenticated_401(self, client):
        app.dependency_overrides.pop(get_current_user, None)

        resp = client.post("/api/invite", json=INVITE_PAYLOAD)

        assert resp.status_code in (401, 403)

    def test_duplicate_email_returns_409(self, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _pa_user

        mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.side_effect = [
            MagicMock(data={"id": "tenant-1"}),  # tenant exists
            MagicMock(data={"id": "existing-user-id"}),  # profile exists!
        ]

        resp = client.post("/api/invite", json=INVITE_PAYLOAD)

        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"]
        mock_supabase.auth.admin.invite_user_by_email.assert_not_called()
        app.dependency_overrides.pop(get_current_user, None)

    def test_invite_includes_redirect_to(self, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _pa_user

        mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.side_effect = [
            MagicMock(data={"id": "tenant-1"}),  # tenant lookup
            None,  # no duplicate
        ]
        _mock_invite_success(mock_supabase)

        resp = client.post("/api/invite", json=INVITE_PAYLOAD)

        assert resp.status_code == 200
        call_args = mock_supabase.auth.admin.invite_user_by_email.call_args
        options = call_args[1]["options"]
        assert "redirect_to" in options
        assert options["redirect_to"].endswith("/auth/callback")
        app.dependency_overrides.pop(get_current_user, None)

    def test_nonexistent_tenant_returns_404(self, client, mock_supabase):
        app.dependency_overrides[get_current_user] = _pa_user

        # maybe_single().execute() returns None for 0 rows in production
        mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = None

        resp = client.post("/api/invite", json=INVITE_PAYLOAD)

        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
        app.dependency_overrides.pop(get_current_user, None)
