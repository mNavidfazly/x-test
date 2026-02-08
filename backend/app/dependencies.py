from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from supabase import Client

from app.config import Settings, get_settings
from app.models.schemas import UserClaims
from app.services.auth import decode_jwt
from app.services.supabase import get_supabase_client

_bearer = HTTPBearer()


def get_supabase(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Client:
    return get_supabase_client(settings)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> UserClaims:
    try:
        return decode_jwt(credentials.credentials, settings.supabase_jwt_secret)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
