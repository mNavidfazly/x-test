from unittest.mock import MagicMock

from app.services.tenant import ALL_AUTH_METHODS


def _mock_tenant_lookup(mock_supabase: MagicMock, tenant_data: list):
    mock_supabase.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value = (
        MagicMock(data=tenant_data)
    )


class TestResolveTenant:
    def test_tenant_found_with_auth_methods(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [{
            "id": "tid-1",
            "name": "Acme Corp",
            "settings": {"auth_methods": ["email_password", "azure_sso"]},
        }])
        resp = client.post("/api/auth/resolve-tenant", json={"email": "user@acme.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_name"] == "Acme Corp"
        assert data["auth_methods"] == ["email_password", "azure_sso"]

    def test_tenant_found_without_auth_methods_returns_all(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [{
            "id": "tid-1",
            "name": "Acme Corp",
            "settings": {},
        }])
        resp = client.post("/api/auth/resolve-tenant", json={"email": "user@acme.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["auth_methods"] == list(ALL_AUTH_METHODS)

    def test_tenant_null_settings_returns_all(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [{
            "id": "tid-1",
            "name": "Acme Corp",
            "settings": None,
        }])
        resp = client.post("/api/auth/resolve-tenant", json={"email": "user@acme.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["auth_methods"] == list(ALL_AUTH_METHODS)

    def test_tenant_not_found(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [])
        resp = client.post("/api/auth/resolve-tenant", json={"email": "user@unknown.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_name"] is None
        assert data["auth_methods"] == []

    def test_invalid_email(self, client):
        resp = client.post("/api/auth/resolve-tenant", json={"email": "not-an-email"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_name"] is None
        assert data["auth_methods"] == []

    def test_empty_email(self, client):
        resp = client.post("/api/auth/resolve-tenant", json={"email": ""})
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_name"] is None
        assert data["auth_methods"] == []

    def test_does_not_expose_tenant_id(self, client, mock_supabase):
        _mock_tenant_lookup(mock_supabase, [{
            "id": "secret-tid",
            "name": "Acme Corp",
            "settings": {"auth_methods": ["email_password"]},
        }])
        resp = client.post("/api/auth/resolve-tenant", json={"email": "user@acme.com"})
        data = resp.json()
        assert "id" not in data
        assert "secret-tid" not in str(data)
