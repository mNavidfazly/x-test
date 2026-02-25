import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import Client

from app.dependencies import get_supabase
from app.models.schemas import (
    ResetPasswordRequest,
    ResetPasswordResponse,
    ResolveEmailRequest,
    ResolveEmailResponse,
)
from app.services.tenant import (
    extract_domain,
    lookup_idp_hint,
    lookup_tenant,
    lookup_tenant_by_profile_email,
    resolve_auth_methods,
)

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["auth"])

RESET_MESSAGE = "If an account exists for this email, you will receive a password reset link."


@router.post("/auth/resolve-tenant", response_model=ResolveEmailResponse)
@limiter.limit("10/minute")
async def resolve_tenant(
    request: Request,
    body: ResolveEmailRequest,
    supabase: Annotated[Client, Depends(get_supabase)],
) -> ResolveEmailResponse:
    try:
        domain = extract_domain(body.email)
    except ValueError:
        return ResolveEmailResponse(tenant_name=None, auth_methods=[])

    tenant = lookup_tenant(supabase, domain)
    if tenant is None:
        tenant = lookup_tenant_by_profile_email(supabase, body.email)
    methods = resolve_auth_methods(tenant)
    tenant_name = tenant["name"] if tenant else None

    idp_hint = None
    if "keycloak_sso" in methods:
        idp_hint = lookup_idp_hint(supabase, body.email)

    return ResolveEmailResponse(tenant_name=tenant_name, auth_methods=methods, idp_hint=idp_hint)


@router.post("/auth/reset-password", response_model=ResetPasswordResponse)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    supabase: Annotated[Client, Depends(get_supabase)],
) -> ResetPasswordResponse:
    try:
        domain = extract_domain(body.email)
        tenant = lookup_tenant(supabase, domain)
        if tenant is None:
            tenant = lookup_tenant_by_profile_email(supabase, body.email)
        methods = resolve_auth_methods(tenant)

        if "email_password" in methods:
            options = {}
            if body.redirect_to:
                options["redirect_to"] = body.redirect_to
            supabase.auth.reset_password_for_email(
                body.email,
                options=options if options else None,
            )
    except Exception:
        logger.debug("reset-password swallowed error for %s", body.email)

    return ResetPasswordResponse(message=RESET_MESSAGE)
