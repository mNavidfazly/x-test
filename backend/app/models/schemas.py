from typing import List, Optional

from pydantic import BaseModel


class UserClaims(BaseModel):
    sub: str
    tenant_id: Optional[str] = None
    is_tenant_admin: bool = False
    is_platform_admin: bool = False
    csm_tenant_ids: List[str] = []
    lecturer_course_ids: List[str] = []
    lecturer_can_edit_course_ids: List[str] = []
    lecturer_can_grade_course_ids: List[str] = []


class HealthResponse(BaseModel):
    status: str
    supabase: str
    version: str


class ResolveEmailRequest(BaseModel):
    email: str


class ResolveEmailResponse(BaseModel):
    tenant_name: Optional[str]
    auth_methods: List[str]
    idp_hint: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    email: str
    redirect_to: Optional[str] = None


class ResetPasswordResponse(BaseModel):
    message: str
