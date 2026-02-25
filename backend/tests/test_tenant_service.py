from unittest.mock import MagicMock

import pytest

from app.services.tenant import (
    ALL_AUTH_METHODS,
    extract_domain,
    lookup_idp_hint,
    lookup_tenant_by_profile_email,
    resolve_auth_methods,
)


class TestExtractDomain:
    def test_valid_email(self):
        assert extract_domain("user@example.com") == "example.com"

    def test_case_insensitive(self):
        assert extract_domain("User@EXAMPLE.COM") == "example.com"

    def test_no_at_sign(self):
        with pytest.raises(ValueError, match="Invalid email"):
            extract_domain("nope")

    def test_empty_string(self):
        with pytest.raises(ValueError, match="Invalid email"):
            extract_domain("")

    def test_multiple_at_signs(self):
        with pytest.raises(ValueError, match="Invalid email"):
            extract_domain("a@b@c.com")


class TestResolveAuthMethods:
    def test_no_tenant_returns_empty(self):
        assert resolve_auth_methods(None) == []

    def test_null_settings_returns_all(self):
        assert resolve_auth_methods({"settings": None}) == list(ALL_AUTH_METHODS)

    def test_empty_settings_returns_all(self):
        assert resolve_auth_methods({"settings": {}}) == list(ALL_AUTH_METHODS)

    def test_explicit_methods(self):
        tenant = {"settings": {"auth_methods": ["email_password", "magic_link"]}}
        assert resolve_auth_methods(tenant) == ["email_password", "magic_link"]

    def test_filters_invalid_methods(self):
        tenant = {"settings": {"auth_methods": ["email_password", "carrier_pigeon"]}}
        assert resolve_auth_methods(tenant) == ["email_password"]

    def test_no_auth_methods_key_returns_all(self):
        tenant = {"settings": {"other_setting": True}}
        assert resolve_auth_methods(tenant) == list(ALL_AUTH_METHODS)

    def test_empty_auth_methods_returns_all(self):
        tenant = {"settings": {"auth_methods": []}}
        assert resolve_auth_methods(tenant) == list(ALL_AUTH_METHODS)

    def test_settings_not_dict_returns_all(self):
        tenant = {"settings": "not-a-dict"}
        assert resolve_auth_methods(tenant) == list(ALL_AUTH_METHODS)

    def test_keycloak_sso_included(self):
        assert "keycloak_sso" in ALL_AUTH_METHODS

    def test_all_auth_methods_has_three_entries(self):
        assert len(ALL_AUTH_METHODS) == 3


class TestLookupIdpHint:
    def _mock_profiles_query(self, mock_supabase: MagicMock, data: list):
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            MagicMock(data=data)
        )

    def test_returns_alias_when_found(self):
        mock_sb = MagicMock()
        self._mock_profiles_query(mock_sb, [{"keycloak_idp_alias": "equinor-entraid"}])
        assert lookup_idp_hint(mock_sb, "user@equinor.com") == "equinor-entraid"

    def test_returns_none_when_no_profile(self):
        mock_sb = MagicMock()
        self._mock_profiles_query(mock_sb, [])
        assert lookup_idp_hint(mock_sb, "user@unknown.com") is None

    def test_returns_none_when_alias_is_null(self):
        mock_sb = MagicMock()
        self._mock_profiles_query(mock_sb, [{"keycloak_idp_alias": None}])
        assert lookup_idp_hint(mock_sb, "user@acme.com") is None


class TestLookupTenantByProfileEmail:
    def _mock_profiles_query(self, mock_supabase: MagicMock, data: list):
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            MagicMock(data=data)
        )

    def test_returns_tenant_when_profile_found(self):
        mock_sb = MagicMock()
        tenant_data = {"id": "tid-1", "name": "Calypso", "settings": {"auth_methods": ["email_password"]}}
        self._mock_profiles_query(mock_sb, [{"tenant_id": "tid-1", "tenants": tenant_data}])
        result = lookup_tenant_by_profile_email(mock_sb, "user@web.de")
        assert result == tenant_data

    def test_returns_none_when_no_profile(self):
        mock_sb = MagicMock()
        self._mock_profiles_query(mock_sb, [])
        assert lookup_tenant_by_profile_email(mock_sb, "unknown@web.de") is None

    def test_returns_none_when_tenants_join_is_none(self):
        mock_sb = MagicMock()
        self._mock_profiles_query(mock_sb, [{"tenant_id": "tid-1", "tenants": None}])
        assert lookup_tenant_by_profile_email(mock_sb, "user@web.de") is None

    def test_lowercases_email(self):
        mock_sb = MagicMock()
        tenant_data = {"id": "tid-1", "name": "Corp", "settings": None}
        self._mock_profiles_query(mock_sb, [{"tenant_id": "tid-1", "tenants": tenant_data}])
        lookup_tenant_by_profile_email(mock_sb, "User@WEB.DE")
        call_args = mock_sb.table.return_value.select.return_value.eq.call_args
        assert call_args[0] == ("email", "user@web.de")
