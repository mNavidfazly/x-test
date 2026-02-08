import time

import pytest
from jose import jwt

from app.services.auth import ALGORITHM, decode_jwt

SECRET = "test-jwt-secret-that-is-long-enough-for-hs256"


def _make_token(
    claims: dict | None = None,
    secret: str = SECRET,
    exp_offset: int = 3600,
) -> str:
    payload = {
        "sub": "00000000-0000-0000-0000-000000000001",
        "iss": "supabase",
        "iat": int(time.time()),
        "exp": int(time.time()) + exp_offset,
        "tenant_id": "tenant-123",
        "is_tenant_admin": False,
        "is_platform_admin": True,
        "csm_tenant_ids": ["t1", "t2"],
        "lecturer_course_ids": [],
        "lecturer_can_edit_course_ids": [],
        "lecturer_can_grade_course_ids": [],
    }
    if claims:
        payload.update(claims)
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def test_decode_valid_token() -> None:
    token = _make_token()
    user = decode_jwt(token, SECRET)
    assert user.sub == "00000000-0000-0000-0000-000000000001"
    assert user.tenant_id == "tenant-123"
    assert user.is_platform_admin is True
    assert user.is_tenant_admin is False
    assert user.csm_tenant_ids == ["t1", "t2"]


def test_decode_minimal_claims() -> None:
    token = _make_token(claims={
        "tenant_id": None,
        "is_tenant_admin": False,
        "is_platform_admin": False,
        "csm_tenant_ids": [],
        "lecturer_course_ids": [],
        "lecturer_can_edit_course_ids": [],
        "lecturer_can_grade_course_ids": [],
    })
    user = decode_jwt(token, SECRET)
    assert user.sub == "00000000-0000-0000-0000-000000000001"
    assert user.tenant_id is None
    assert user.csm_tenant_ids == []


def test_decode_expired_token() -> None:
    token = _make_token(exp_offset=-3600)
    with pytest.raises(Exception):
        decode_jwt(token, SECRET)


def test_decode_wrong_secret() -> None:
    token = _make_token(secret="wrong-secret-that-is-long-enough")
    with pytest.raises(Exception):
        decode_jwt(token, SECRET)


def test_decode_malformed_token() -> None:
    with pytest.raises(Exception):
        decode_jwt("not.a.jwt", SECRET)
