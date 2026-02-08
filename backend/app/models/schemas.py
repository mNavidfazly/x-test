from pydantic import BaseModel


class UserClaims(BaseModel):
    sub: str
    tenant_id: str | None = None
    is_tenant_admin: bool = False
    is_platform_admin: bool = False
    csm_tenant_ids: list[str] = []
    lecturer_course_ids: list[str] = []
    lecturer_can_edit_course_ids: list[str] = []
    lecturer_can_grade_course_ids: list[str] = []


class HealthResponse(BaseModel):
    status: str
    supabase: str
    version: str
