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


class InitUploadRequest(BaseModel):
    title: str
    course_id: str


class InitUploadResponse(BaseModel):
    video_id: str
    library_id: int
    auth_signature: str
    auth_expire: int
    tus_endpoint: str


class VideoStatusResponse(BaseModel):
    video_id: str
    status: int
    encode_progress: int
    duration: Optional[int] = None
    thumbnail_url: Optional[str] = None
    embed_url: Optional[str] = None


class WebhookPayload(BaseModel):
    VideoLibraryId: int
    VideoGuid: str
    Status: int


class SendRemindersRequest(BaseModel):
    user_ids: List[str]
    course_id: Optional[str] = None
    message: str


class SendRemindersResponse(BaseModel):
    sent: int
    failed: int


class ExternalQuizResultRequest(BaseModel):
    external_quiz_id: str
    user_email: str
    score: Optional[float] = None
    passed: Optional[bool] = None
    details: Optional[dict] = None


class ExternalQuizResultResponse(BaseModel):
    status: str
    user_id: Optional[str] = None
    result_id: Optional[str] = None
