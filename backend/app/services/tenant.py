from __future__ import annotations

from typing import Optional

from supabase import Client

ALL_AUTH_METHODS = ["email_password", "magic_link", "keycloak_sso"]


def extract_domain(email: str) -> str:
    if not email or "@" not in email:
        raise ValueError("Invalid email")
    parts = email.split("@")
    if len(parts) != 2 or not parts[1]:
        raise ValueError("Invalid email")
    return parts[1].lower()


def lookup_tenant(supabase: Client, domain: str) -> Optional[dict]:
    result = (
        supabase.table("tenants")
        .select("id, name, settings")
        .ilike("domain", domain)
        .limit(1)
        .execute()
    )
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


def resolve_auth_methods(tenant: Optional[dict]) -> list[str]:
    if tenant is None:
        return []
    settings = tenant.get("settings")
    if not settings or not isinstance(settings, dict):
        return list(ALL_AUTH_METHODS)
    methods = settings.get("auth_methods")
    if not methods or not isinstance(methods, list):
        return list(ALL_AUTH_METHODS)
    return [m for m in methods if m in ALL_AUTH_METHODS]


def lookup_tenant_by_profile_email(supabase: Client, email: str) -> Optional[dict]:
    """Fallback: if domain lookup fails, check if user already has a profile with a tenant."""
    result = (
        supabase.table("profiles")
        .select("tenant_id, tenants(id, name, settings)")
        .eq("email", email.lower())
        .limit(1)
        .execute()
    )
    if not result.data or not result.data[0].get("tenant_id"):
        return None
    tenant_data = result.data[0].get("tenants")
    if tenant_data and isinstance(tenant_data, dict):
        return tenant_data
    return None


def lookup_idp_hint(supabase: Client, email: str) -> Optional[str]:
    """Look up keycloak_idp_alias from profiles for returning Keycloak users."""
    result = (
        supabase.table("profiles")
        .select("keycloak_idp_alias")
        .eq("email", email.lower())
        .limit(1)
        .execute()
    )
    if result.data and len(result.data) > 0:
        return result.data[0].get("keycloak_idp_alias")
    return None
