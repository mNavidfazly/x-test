from unittest.mock import MagicMock

from app.routers.auth import RESET_MESSAGE


def _mock_tenant_lookup(mock_supabase: MagicMock, tenant_data: list):
    mock_supabase.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value = (
        MagicMock(data=tenant_data)
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
        mock_supabase.auth.admin.generate_link.assert_called_once()

    def test_skips_when_not_allowed(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [{
            "id": "tid-1",
            "name": "Acme",
            "settings": {"auth_methods": ["keycloak_sso"]},
        }])
        resp = client.post("/api/auth/reset-password", json={"email": "user@acme.com"})
        assert resp.status_code == 200
        assert resp.json()["message"] == RESET_MESSAGE
        mock_supabase.auth.admin.generate_link.assert_not_called()

    def test_no_tenant_skips(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [])
        resp = client.post("/api/auth/reset-password", json={"email": "user@unknown.com"})
        assert resp.status_code == 200
        assert resp.json()["message"] == RESET_MESSAGE
        mock_supabase.auth.admin.generate_link.assert_not_called()

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
        mock_supabase.auth.admin.generate_link.side_effect = Exception("User not found")
        resp = client.post("/api/auth/reset-password", json={"email": "user@acme.com"})
        assert resp.status_code == 200
        assert resp.json()["message"] == RESET_MESSAGE

    def test_invalid_email_returns_200(self, client):
        resp = client.post("/api/auth/reset-password", json={"email": "nope"})
        assert resp.status_code == 200
        assert resp.json()["message"] == RESET_MESSAGE

    def test_null_settings_allows_reset(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [{
            "id": "tid-1",
            "name": "Acme",
            "settings": None,
        }])
        resp = client.post("/api/auth/reset-password", json={"email": "user@acme.com"})
        assert resp.status_code == 200
        mock_supabase.auth.admin.generate_link.assert_called_once()
