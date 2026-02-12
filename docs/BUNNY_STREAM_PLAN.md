# Phase 3C-4: Bunny Stream Integration

## Roadmap Placement

After 3C-3 (Tiptap Markdown), before 3D (Quiz Builder). Still module content CRUD territory — replaces the manual URL-paste video approach with proper upload + embed.

```
3C-1: Module CRUD Core + Video       (done)
3C-2: File Upload + PDF + Exam       (next)
3C-3: Tiptap Markdown + Quiz Stub
3C-4: Bunny Stream Integration       <-- THIS
3D:   Quiz Builder
```

---

## Architecture: Upload & Playback Flow

```
Angular Frontend                    FastAPI Backend                  Bunny Stream
================                    ==============                  ============

1. User picks file in VideoForm
2. Click "Upload"
3. POST /api/video/init-upload  -->  4. Verify JWT (admin or lecturer can_edit)
   { title, course_id }             5. POST video.bunnycdn.com/library/{id}/videos
                                        --> returns { guid }
                                     6. SHA256(library_id + api_key + expire + guid)
8. Receive credentials  <---------  7. Return { video_id, library_id, signature, expire }

9. tus-js-client uploads           (browser -> Bunny directly, no proxy)
   directly to Bunny  -------------------------------------------------->
   (progress signal updates)
10. onSuccess -> user clicks Save
    INSERT module + module_videos via Supabase

--- Later (async) ---

Bunny finishes encoding
POST /api/video/webhook  -------->  Verify library_id, update module_videos
{ VideoGuid, Status: 3 }           (encoding_status, duration, thumbnail_url)

--- Playback ---

Viewer loads module_videos ->
  status 0-2: "Processing..." placeholder
  status 3-4: GET /api/video/{id}/status -> signed embed URL
              <iframe src="https://iframe.mediadelivery.net/embed/{lib}/{vid}?token=...&expires=...">
  status 5:   "Encoding failed" error
```

### Security: Token-Signed Embed URLs

Video embeds use **two layers** of protection:

1. **Referer restriction** (Bunny dashboard) — only `x-courses-v2.vercel.app` and `localhost:4200`
2. **Token authentication** (per-URL signing) — SHA256 token with 4-hour expiry

Token generation (server-side only):
```
token = SHA256(token_key + video_id + expiration_time)
embed_url = https://iframe.mediadelivery.net/embed/{lib}/{vid}?token={token}&expires={expire}
```

The `bunny_token_key` is configured in Bunny dashboard (Library > Security > Token Authentication) and stored server-side in FastAPI config. Frontend never sees the key — it calls `GET /api/video/{id}/status` which returns the pre-signed embed URL.

---

## 1. Migration 00022: Bunny Stream Support

**File:** `supabase/migrations/00022_bunny_stream_support.sql`

No backward compatibility — delete existing rows, replace columns.

```sql
-- Delete existing rows (no backward compat)
DELETE FROM module_videos;

-- Drop old columns
ALTER TABLE module_videos
  DROP COLUMN video_url,
  DROP COLUMN thumbnail_url,
  DROP COLUMN duration;

-- Add Bunny-specific columns
ALTER TABLE module_videos
  ADD COLUMN bunny_video_id    text NOT NULL,
  ADD COLUMN bunny_library_id  bigint NOT NULL,
  ADD COLUMN encoding_status   smallint NOT NULL DEFAULT 0,
  ADD COLUMN duration          integer,
  ADD COLUMN thumbnail_url     text,
  ADD COLUMN original_filename text;

-- Index for webhook lookups
CREATE UNIQUE INDEX idx_module_videos_bunny_video_id
  ON module_videos (bunny_video_id);
```

RLS unchanged — all 10 existing policies reference only `module_id`, not the dropped columns.

---

## 2. FastAPI Backend

### 2.1 Config (`backend/app/config.py`)

Add to `Settings`:
```python
bunny_api_key: str = ""
bunny_library_id: int = 0
bunny_cdn_hostname: str = ""       # e.g. "vz-abcdef-123.b-cdn.net"
bunny_token_key: str = ""          # Token authentication key from Bunny dashboard
```

### 2.2 Schemas (`backend/app/models/schemas.py`)

```python
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
    embed_url: Optional[str] = None    # Token-signed embed URL (only when status >= 3)

class WebhookPayload(BaseModel):
    VideoLibraryId: int
    VideoGuid: str
    Status: int
```

### 2.3 Service (`backend/app/services/bunny.py` — NEW)

6 pure async functions using `httpx` (already installed):

| Function | Purpose |
|----------|---------|
| `create_video(settings, title)` | POST to Bunny Stream API, returns `{ guid }` |
| `generate_tus_signature(library_id, api_key, video_id)` | SHA256 TUS upload signature + expiry (2h) |
| `generate_embed_token(token_key, video_id)` | SHA256 embed URL token + expiry (4h) |
| `get_video_status(settings, video_id)` | GET video object from Bunny |
| `delete_video(settings, video_id)` | DELETE video from Bunny |
| `build_thumbnail_url(settings, thumbnail_filename, video_id)` | Construct CDN thumbnail URL |

TUS signature: `sha256(library_id + api_key + expiration_time + video_id)`, expiry = now + 2 hours.
Embed token: `sha256(token_key + video_id + expiration_time)`, expiry = now + 4 hours.

### 2.4 Router (`backend/app/routers/video.py` — NEW)

3 endpoints:

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/video/init-upload` | JWT (admin or lecturer can_edit) | Create video in Bunny + return TUS credentials |
| `GET /api/video/{video_id}/status` | JWT (any authenticated) | Poll encoding progress + return signed embed URL |
| `POST /api/video/webhook` | None (validate library_id) | Bunny encoding status callback |

**`GET /api/video/{video_id}/status`** returns:
- `status`, `encode_progress`, `duration`, `thumbnail_url`
- `embed_url` — pre-signed iframe URL with token (only when status >= 3)

Webhook flow: verify `VideoLibraryId == settings.bunny_library_id`, then update `module_videos` via service-role Supabase client. On status=3 (Finished), also fetch video details to populate `duration` and `thumbnail_url`.

### 2.5 Register in `backend/app/main.py`

```python
from app.routers import auth, health, video
app.include_router(video.router, prefix="/api")
```

---

## 3. Frontend

### 3.1 New Dependency

```
npm install tus-js-client
```

### 3.2 Model Updates (`course.model.ts`)

Replace existing interfaces:

```typescript
export type BunnyEncodingStatus = 0 | 1 | 2 | 3 | 4 | 5;

export interface ModuleVideo {
  bunny_video_id: string;
  bunny_library_id: number;
  encoding_status: BunnyEncodingStatus;
  duration: number | null;
  thumbnail_url: string | null;
  original_filename: string | null;
}

export interface VideoFormData {
  bunny_video_id: string;
  bunny_library_id: number;
  original_filename: string | null;
}

export interface BunnyUploadCredentials {
  video_id: string;
  library_id: number;
  auth_signature: string;
  auth_expire: number;
  tus_endpoint: string;
}

export interface BunnyVideoStatus {
  video_id: string;
  status: number;
  encode_progress: number;
  duration: number | null;
  thumbnail_url: string | null;
  embed_url: string | null;
}
```

### 3.3 BunnyUploadService (`bunny-upload.service.ts` — NEW)

Wraps FastAPI init-upload + tus-js-client. Exposes reactive signals:

| Signal | Type | Purpose |
|--------|------|---------|
| `uploading` | `boolean` | Upload in progress |
| `progress` | `number` | 0-100 percentage |
| `error` | `string` | Error message |
| `uploadedVideoId` | `string \| null` | Set on success |

Methods: `initAndUpload(file, title, courseId)`, `pollStatus(videoId)`, `abort()`, `reset()`

Uses `ApiService` (HttpClient wrapper for FastAPI) — calls `POST /api/video/init-upload` then creates `tus.Upload` with the returned credentials.

`pollStatus(videoId)` returns `Observable<BunnyVideoStatus>` — calls `GET /api/video/{id}/status` which includes the token-signed `embed_url`.

### 3.4 CourseService Updates

Update 4 private methods to use new column names:
- `#insertModuleContent` — INSERT `bunny_video_id`, `bunny_library_id`, `original_filename`
- `#upsertModuleContent` — same fields with `onConflict: 'module_id'`
- `#fetchModuleContent` — SELECT new columns
- `#contentToFormData` — map to new `VideoFormData` shape

### 3.5 VideoFormComponent (Complete Rewrite)

**Current:** 3 text inputs (Video URL, Thumbnail URL, Duration) — manual paste.

**New:** File picker + TUS upload + progress bar.

Template:
```
Title input
Description textarea

Create mode (no bunny_video_id yet):
  - File picker area (dashed border)
  - "Upload" button -> triggers BunnyUploadService
  - Progress bar (0-100%)
  - Success: checkmark + filename

Edit mode (existing bunny_video_id):
  - Current filename + encoding status badge
  - "Replace video" button -> shows file picker

Save/Cancel buttons
```

Validation: `isValid()` = non-empty title AND bunny_video_id set (from upload or edit pre-population).

Client-side 2GB file size limit check before upload.

New input: `courseId = input.required<string>()` (for init-upload auth check).

### 3.6 VideoViewerComponent (Complete Rewrite)

**Current:** Native `<video>` tag with `[src]`.

**New:** Bunny iframe embed with encoding status handling + token-signed URLs.

3 states by `encoding_status`:
- **0-2 (Processing):** Gray placeholder + spinner + "Video is being processed"
- **5 (Failed):** Rose placeholder + alert icon + "Video encoding failed"
- **3-4 (Ready):** Fetch signed embed URL from `GET /api/video/{id}/status`, render responsive 16:9 iframe

```html
<div class="relative w-full" style="padding-top: 56.25%">
  <iframe [src]="embedUrl()"
          class="absolute inset-0 w-full h-full rounded-lg"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>
</div>
```

Embed URL comes from FastAPI (pre-signed with token), NOT constructed client-side. Frontend stores the signed URL in a signal after calling the status endpoint.

Uses `DomSanitizer.bypassSecurityTrustResourceUrl()` (same pattern as existing `pdf-viewer.component.ts`).

### 3.7 ModuleFormPageComponent Updates

- Update `videoFormData` signal default to new shape
- Update `#loadForEdit` video branch
- Change type hint: `'Upload a video'` (was `'Link to an external video'`)
- Pass `[courseId]="courseId()"` to VideoFormComponent

### 3.8 Mock Updates (`course.mock.ts`)

Update `createMockModuleVideo()` and `createMockVideoFormData()` to return new field shapes.

---

## 4. Files Summary

### New Files (6)
| File | Purpose |
|------|---------|
| `supabase/migrations/00022_bunny_stream_support.sql` | Schema: replace video_url with Bunny columns |
| `backend/app/services/bunny.py` | Bunny Stream API client |
| `backend/app/routers/video.py` | FastAPI: init-upload, status (with signed embed URL), webhook |
| `backend/tests/test_video.py` | Backend tests (~12) |
| `frontend/src/app/core/services/bunny-upload.service.ts` | TUS upload + signals |
| `frontend/src/app/core/services/bunny-upload.service.spec.ts` | Upload service tests |

### Modified Files (12)
| File | Change |
|------|--------|
| `backend/app/config.py` | +4 Bunny config fields (api_key, library_id, cdn_hostname, token_key) |
| `backend/app/models/schemas.py` | +4 Pydantic models |
| `backend/app/main.py` | Register video router |
| `backend/.env.example` | +4 env vars |
| `frontend/package.json` | +tus-js-client |
| `frontend/src/app/core/models/course.model.ts` | Replace ModuleVideo, VideoFormData, add Bunny types |
| `frontend/src/app/core/services/course.service.ts` | Update 4 private methods |
| `frontend/src/app/features/courses/components/video-form.component.ts` | Complete rewrite |
| `frontend/src/app/features/courses/components/video-form.component.spec.ts` | Complete rewrite |
| `frontend/src/app/features/courses/components/video-viewer.component.ts` | Complete rewrite |
| `frontend/src/app/features/courses/components/video-viewer.component.spec.ts` | Complete rewrite |
| `frontend/src/app/features/courses/pages/module-form-page.component.ts` | Defaults, hint, courseId |
| `frontend/src/app/__mocks__/course.mock.ts` | Update mock factories |

**Total: 6 new + 13 modified = 19 files**

---

## 5. Implementation Order

1. Migration 00022 -> `supabase db push`
2. Backend config + bunny service + tests
3. Backend video router + register + tests -> `pytest` (~58 total)
4. Frontend models + BunnyUploadService + tests
5. VideoFormComponent rewrite + spec
6. VideoViewerComponent rewrite + spec
7. ModuleFormPageComponent + mock updates
8. `npm test` -> verify all pass, `npm run build` -> clean
9. Bunny dashboard: Enable token authentication, set referer restrictions, configure webhook URL
10. Manual E2E test: upload -> encoding -> playback (verify token-signed URLs work)

---

## 6. Edge Cases

- **Orphan videos:** Upload without Save leaves video in Bunny. Acceptable — future cleanup job.
- **Encoding delay:** Minutes to process. Viewer shows "Processing" state. User refreshes to see update.
- **Webhook is public:** Bunny doesn't sign webhooks. We validate `VideoLibraryId` matches config.
- **No auto-delete from Bunny:** Module cascade deletes DB row but not Bunny video. Future improvement.
- **Module ID unknown at upload time:** Create mode has no module yet. Backend only needs `course_id` for auth.
- **CORS:** Bunny TUS endpoint already has CORS headers for browser uploads.
- **Token expiry:** Embed tokens expire after 4 hours. User refreshing a long-open page will re-fetch from the status endpoint (which generates a fresh token).
- **Referer + token = belt and suspenders:** Either alone prevents casual sharing, together they block hotlinking AND direct URL sharing.

---

## 7. Verification

1. `supabase db push` — migration 00022 applies
2. `cd backend && pytest` — ~58 tests pass (46 existing + 12 new)
3. `cd frontend && npm test` — all tests pass
4. `cd frontend && npm run build` — production build succeeds
5. Bunny dashboard: token auth enabled, referers set, webhook URL configured
6. Manual: upload real video -> see progress -> save -> encoding webhook fires -> token-signed embed plays
