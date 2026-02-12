import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from jose import jwt

from app.dependencies import get_current_user
from app.main import app
from app.models.schemas import UserClaims

SECRET = "test-jwt-secret-that-is-long-enough-for-hs256"


def _make_token(claims=None) -> str:
    payload = {
        "sub": "00000000-0000-0000-0000-000000000001",
        "iss": "supabase",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
        "tenant_id": "tenant-123",
        "is_tenant_admin": False,
        "is_platform_admin": True,
        "csm_tenant_ids": [],
        "lecturer_course_ids": [],
        "lecturer_can_edit_course_ids": [],
        "lecturer_can_grade_course_ids": [],
    }
    if claims:
        payload.update(claims)
    return jwt.encode(payload, SECRET, algorithm="HS256")


def _admin_user() -> UserClaims:
    return UserClaims(
        sub="user-admin",
        is_platform_admin=True,
        lecturer_can_edit_course_ids=[],
    )


def _lecturer_user(course_id: str) -> UserClaims:
    return UserClaims(
        sub="user-lecturer",
        is_platform_admin=False,
        lecturer_can_edit_course_ids=[course_id],
    )


def _learner_user() -> UserClaims:
    return UserClaims(
        sub="user-learner",
        is_platform_admin=False,
        lecturer_can_edit_course_ids=[],
    )


# ─── init-upload ───────────────────────────────────────────


class TestInitUpload:
    @patch("app.routers.video.create_video", new_callable=AsyncMock)
    def test_admin_can_init_upload(self, mock_create, client):
        app.dependency_overrides[get_current_user] = _admin_user
        mock_create.return_value = {"guid": "video-guid-123"}

        resp = client.post(
            "/api/video/init-upload",
            json={"title": "Test Video", "course_id": "course-1"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["video_id"] == "video-guid-123"
        assert data["library_id"] == 12345
        assert "auth_signature" in data
        assert "auth_expire" in data
        assert data["tus_endpoint"] == "https://video.bunnycdn.com/tusupload"
        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.video.create_video", new_callable=AsyncMock)
    def test_lecturer_can_init_upload_for_assigned_course(self, mock_create, client):
        app.dependency_overrides[get_current_user] = lambda: _lecturer_user("course-1")
        mock_create.return_value = {"guid": "video-guid-456"}

        resp = client.post(
            "/api/video/init-upload",
            json={"title": "Lecture Video", "course_id": "course-1"},
        )

        assert resp.status_code == 200
        assert resp.json()["video_id"] == "video-guid-456"
        app.dependency_overrides.pop(get_current_user, None)

    def test_lecturer_rejected_for_unassigned_course(self, client):
        app.dependency_overrides[get_current_user] = lambda: _lecturer_user("course-1")

        resp = client.post(
            "/api/video/init-upload",
            json={"title": "Sneaky Video", "course_id": "course-999"},
        )

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)

    def test_learner_rejected(self, client):
        app.dependency_overrides[get_current_user] = _learner_user

        resp = client.post(
            "/api/video/init-upload",
            json={"title": "Learner Video", "course_id": "course-1"},
        )

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)

    def test_unauthenticated_rejected(self, client):
        # No auth override, no token header
        resp = client.post(
            "/api/video/init-upload",
            json={"title": "No Auth", "course_id": "course-1"},
        )

        assert resp.status_code in (401, 403)


# ─── video status ──────────────────────────────────────────


class TestVideoStatus:
    @patch("app.routers.video.get_video_status", new_callable=AsyncMock)
    def test_returns_embed_url_when_ready(self, mock_status, client):
        app.dependency_overrides[get_current_user] = _admin_user
        mock_status.return_value = {
            "status": 4,
            "encodeProgress": 100,
            "length": 120,
            "thumbnailFileName": "thumbnail.jpg",
        }

        resp = client.get("/api/video/video-guid-123/status")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == 4
        assert data["encode_progress"] == 100
        assert data["duration"] == 120
        assert data["embed_url"] is not None
        assert "iframe.mediadelivery.net/embed" in data["embed_url"]
        assert "token=" in data["embed_url"]
        assert "expires=" in data["embed_url"]
        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.video.get_video_status", new_callable=AsyncMock)
    def test_no_embed_url_when_processing(self, mock_status, client):
        app.dependency_overrides[get_current_user] = _admin_user
        mock_status.return_value = {
            "status": 2,
            "encodeProgress": 45,
            "length": 0,
        }

        resp = client.get("/api/video/video-guid-123/status")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == 2
        assert data["encode_progress"] == 45
        assert data["embed_url"] is None
        app.dependency_overrides.pop(get_current_user, None)


# ─── webhook ───────────────────────────────────────────────


class TestWebhook:
    def test_valid_webhook_updates_db(self, client, mock_supabase):
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            MagicMock(data=[{"bunny_video_id": "vid-1"}])
        )

        resp = client.post(
            "/api/video/webhook",
            json={"VideoLibraryId": 12345, "VideoGuid": "vid-1", "Status": 2},
        )

        assert resp.status_code == 200
        mock_supabase.table.assert_called_with("module_videos")

    def test_rejects_wrong_library_id(self, client):
        resp = client.post(
            "/api/video/webhook",
            json={"VideoLibraryId": 99999, "VideoGuid": "vid-1", "Status": 2},
        )

        assert resp.status_code == 403

    @patch("app.routers.video.get_video_status", new_callable=AsyncMock)
    def test_fetches_details_on_status_3(self, mock_status, client, mock_supabase):
        mock_status.return_value = {
            "length": 300,
            "thumbnailFileName": "thumbnail.jpg",
        }
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            MagicMock(data=[{"bunny_video_id": "vid-2"}])
        )

        resp = client.post(
            "/api/video/webhook",
            json={"VideoLibraryId": 12345, "VideoGuid": "vid-2", "Status": 3},
        )

        assert resp.status_code == 200
        mock_status.assert_called_once()
        # Verify the update included duration and thumbnail
        call_args = mock_supabase.table.return_value.update.call_args
        update_data = call_args[0][0]
        assert update_data["encoding_status"] == 3
        assert update_data["duration"] == 300
        assert "thumbnail_url" in update_data


# ─── delete video ─────────────────────────────────────────


class TestDeleteVideo:
    @patch("app.routers.video.delete_video", new_callable=AsyncMock)
    def test_admin_can_delete_video(self, mock_delete, client):
        app.dependency_overrides[get_current_user] = _admin_user
        mock_delete.return_value = None

        resp = client.delete("/api/video/video-guid-123")

        assert resp.status_code == 200
        mock_delete.assert_called_once()
        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.video.delete_video", new_callable=AsyncMock)
    def test_lecturer_can_delete_video(self, mock_delete, client):
        app.dependency_overrides[get_current_user] = lambda: _lecturer_user("course-1")
        mock_delete.return_value = None

        resp = client.delete("/api/video/video-guid-456")

        assert resp.status_code == 200
        mock_delete.assert_called_once()
        app.dependency_overrides.pop(get_current_user, None)

    def test_learner_rejected(self, client):
        app.dependency_overrides[get_current_user] = _learner_user

        resp = client.delete("/api/video/video-guid-123")

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.video.delete_video", new_callable=AsyncMock)
    def test_bunny_failure_still_returns_200(self, mock_delete, client):
        app.dependency_overrides[get_current_user] = _admin_user
        mock_delete.side_effect = Exception("Bunny API error")

        resp = client.delete("/api/video/video-guid-123")

        assert resp.status_code == 200
        app.dependency_overrides.pop(get_current_user, None)
