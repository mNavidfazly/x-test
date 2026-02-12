import json
import logging

from jose import JWTError, jwt, jwk

from app.models.schemas import UserClaims

logger = logging.getLogger(__name__)

ALGORITHMS = ["HS256", "ES256"]

# Cache for JWKS public keys (keyed by kid)
_jwks_cache: dict = {}


def _get_jwks_key(kid: str, supabase_url: str) -> object:
    """Fetch and cache the JWKS public key for ES256 verification."""
    if kid in _jwks_cache:
        return _jwks_cache[kid]

    import httpx

    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        resp = httpx.get(jwks_url, timeout=10)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
        for key_data in keys:
            if key_data.get("kid") == kid:
                constructed = jwk.construct(key_data, algorithm="ES256")
                _jwks_cache[kid] = constructed
                return constructed
    except Exception:
        logger.warning("Failed to fetch JWKS from %s", jwks_url)

    return None


def decode_jwt(token: str, secret: str, supabase_url: str = "") -> UserClaims:
    # Peek at the token header to determine algorithm
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")

    if alg == "ES256" and supabase_url:
        kid = header.get("kid", "")
        key = _get_jwks_key(kid, supabase_url)
        if key is None:
            raise JWTError("Could not fetch JWKS public key")
        payload = jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            options={"verify_aud": False},
        )
    else:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )

    return UserClaims(
        sub=payload["sub"],
        tenant_id=payload.get("tenant_id"),
        is_tenant_admin=payload.get("is_tenant_admin", False),
        is_platform_admin=payload.get("is_platform_admin", False),
        csm_tenant_ids=payload.get("csm_tenant_ids", []),
        lecturer_course_ids=payload.get("lecturer_course_ids", []),
        lecturer_can_edit_course_ids=payload.get("lecturer_can_edit_course_ids", []),
        lecturer_can_grade_course_ids=payload.get("lecturer_can_grade_course_ids", []),
    )
