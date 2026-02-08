from jose import JWTError, jwt

from app.models.schemas import UserClaims

ALGORITHM = "HS256"


def decode_jwt(token: str, secret: str) -> UserClaims:
    payload = jwt.decode(
        token,
        secret,
        algorithms=[ALGORITHM],
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
