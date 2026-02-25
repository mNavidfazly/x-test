from unittest.mock import MagicMock

from app.routers.auth import RESET_MESSAGE


def _mock_tenant_lookup(mock_supabase: MagicMock, tenant_data: list):
    mock_supabase.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value = (
        MagicMock(data=tenant_data)
    )


def _mock_profile_lookup(mock_supabase: MagicMock, profile_data: list):
    mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        MagicMock(data=profile_data)
    )


class TestResetPassword:
    def test_sends_when_allowed(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [{
            "id": "tid-1",
            "name": "Acme",
            "settings": {"auth_methods": ["email_password"]},
        }])
        resp = client.post("/api/auth/reset-password", json={"email": "user@acme.com"})
        assert resp.status_code == 200
        assert resp.json()["message"] == RESET_MESSAGE
        mock_supabase.auth.reset_password_for_email.assert_called_once()

    def test_skips_when_not_allowed(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [{
            "id": "tid-1",
            "name": "Acme",
            "settings": {"auth_methods": ["keycloak_sso"]},
        }])
        resp = client.post("/api/auth/reset-password", json={"email": "user@acme.com"})
        assert resp.status_code == 200
        assert resp.json()["message"] == RESET_MESSAGE
        mock_supabase.auth.reset_password_for_email.assert_not_called()

    def test_no_tenant_skips(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [])
        resp = client.post("/api/auth/reset-password", json={"email": "user@unknown.com"})
        assert resp.status_code == 200
        assert resp.json()["message"] == RESET_MESSAGE
        mock_supabase.auth.reset_password_for_email.assert_not_called()

    def test_same_message_always(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [])
        resp1 = client.post("/api/auth/reset-password", json={"email": "a@b.com"})

        _mock_tenant_lookup(mock_supabase, [{
            "id": "tid-1", "name": "X", "settings": {"auth_methods": ["email_password"]},
        }])
        resp2 = client.post("/api/auth/reset-password", json={"email": "c@d.com"})

        assert resp1.json()["message"] == resp2.json()["message"]

    def test_swallows_supabase_errors(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [{
            "id": "tid-1",
            "name": "Acme",
            "settings": {"auth_methods": ["email_password"]},
        }])
        mock_supabase.auth.reset_password_for_email.side_effect = Exception("User not found")
        resp = client.post("/api/auth/reset-password", json={"email": "user@acme.com"})
        assert resp.status_code == 200
        assert resp.json()["message"] == RESET_MESSAGE

    def test_invalid_email_returns_200(self, client):
        resp = client.post("/api/auth/reset-password", json={"email": "nope"})
        assert resp.status_code == 200
        assert resp.json()["message"] == RESET_MESSAGE

    def test_fallback_to_profile_sends_reset(self, client, mock_supabase):
        """Domain lookup fails but profile exists with email_password → send reset."""
        _mock_tenant_lookup(mock_supabase, [])  # no domain match
        _mock_profile_lookup(mock_supabase, [{
            "tenant_id": "tid-1",
            "tenants": {
                "id": "tid-1",
                "name": "Calypso",
                "settings": {"auth_methods": ["email_password"]},
            },
        }])
        resp = client.post("/api/auth/reset-password", json={"email": "user@web.de"})
        assert resp.status_code == 200
        assert resp.json()["message"] == RESET_MESSAGE
        mock_supabase.auth.reset_password_for_email.assert_called_once()

    def test_fallback_to_profile_skips_sso_only(self, client, mock_supabase):
        """Domain lookup fails, profile exists but SSO-only → skip reset."""
        _mock_tenant_lookup(mock_supabase, [])
        _mock_profile_lookup(mock_supabase, [{
            "tenant_id": "tid-1",
            "tenants": {
                "id": "tid-1",
                "name": "SSO Corp",
                "settings": {"auth_methods": ["keycloak_sso"]},
            },
        }])
        resp = client.post("/api/auth/reset-password", json={"email": "user@web.de"})
        assert resp.status_code == 200
        mock_supabase.auth.reset_password_for_email.assert_not_called()

    def test_null_settings_allows_reset(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [{
            "id": "tid-1",
            "name": "Acme",
            "settings": None,
        }])
        resp = client.post("/api/auth/reset-password", json={"email": "user@acme.com"})
        assert resp.status_code == 200
        mock_supabase.auth.reset_password_for_email.assert_called_once()
