> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Profile Page & Course Thumbnail Upload E2E User Stories (Phase 10D)

## Overview

E2E testing scenarios for two features delivered in Phase 10D:

1. **Profile Page** (`/profile`) — displays full user info (name, email, org, roles, member since), supports inline name editing and avatar upload/remove via private `avatars` bucket with signed URLs.
2. **Course Thumbnail Upload** — course form now has Upload/URL dual-mode tabs. Uploaded thumbnails go to `course-files` bucket as storage paths, resolved to signed URLs at read time via batch `createSignedUrls()` in course lists and single `createSignedUrl()` in course detail.

**Key components:**
- `ProfilePageComponent` — smart page: avatar upload/remove, inline name edit, role badges, initials fallback
- `ProfileService` — `loadFullProfile()`, `updateName()`, `uploadAvatar()`, `removeAvatar()`, `#resolveAvatarUrl()` (signed URLs with 1hr expiry + cache-buster)
- `CourseFormComponent` — Upload/URL tab toggle, `FileUploadComponent` integration, `CourseFormSaveEvent` output (`{ data, thumbnailFile }`)
- `CourseFormPageComponent` — upload orchestration: two-step create (create → upload → update), edit with old thumbnail cleanup
- `CourseService` — `uploadThumbnail()`, `deleteThumbnailIfStoragePath()`, `getCourseThumbnailSignedUrl()`, `#resolveThumbnailUrls()` (batch)

**Storage paths:**
- Avatars: `avatars/{userId}/avatar` (fixed path, `upsert: true`)
- Thumbnails: `course-files/{courseId}/thumbnail-{timestamp}.{ext}`

**Signed URL strategy:**
- All three buckets are **private** — no public URLs
- Signed URLs expire after 1 hour; avatar URLs refresh on token refresh (~1hr)
- `isStoragePath(url)` utility: returns `true` if URL does NOT start with `http://` or `https://`
- Cache-busting: `&v={Date.now()}` appended to avatar signed URLs

**Migration 00037:**
- Makes `avatars` bucket private (`public = false`)
- Drops `avatars_select_public` policy
- Adds `avatars_select_authenticated` policy (any logged-in user can view any avatar)

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | http://localhost:4200 |
| **Backend URL** | http://localhost:8000 |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Storage Buckets** | `avatars` (private), `course-files` (private) |
| **Primary Test User** | et@calypso-commodities.com (Platform Admin) |
| **Tenant** | Calypso (master tenant) |

### Alternative URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| **Production** | https://x-courses-v2.vercel.app | https://x-courses-v2-production.up.railway.app |
| **Local Dev** | http://localhost:4200 | http://localhost:8000 |

### Test Users

> Full setup instructions: [TEST_USERS.md](TEST_USERS.md)

All test users use password: `TestUser123!`

| # | Email | Role | Tenant | Used In |
|---|-------|------|--------|---------|
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | PT-01 through PT-08, PT-10, PT-11 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit)** | Calypso (master) | PT-09 |
| 3 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | PT-09 |
| 4 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | PT-09 |

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Passed |
| ❌ | Failed |
| ⏳ | Not Tested |
| ⚠️ | Partial |

---

## Recommended Test Order

**IMPORTANT**: Tests should be run in this order due to dependencies:

| Order | ID | Story | Dependencies |
|-------|-----|-------|--------------|
| 1 | PT-01 | Profile Page Load + Data Display | PA logged in |
| 2 | PT-02 | Inline Name Editing | PT-01 (profile page loads) |
| 3 | PT-03 | Avatar Upload | PT-01 (profile page loads) |
| 4 | PT-04 | Avatar Removal | PT-03 (avatar exists) |
| 5 | PT-05 | Role Badges for Different Users | Multiple logins |
| 6 | PT-06 | Create Course with Uploaded Thumbnail | PA logged in |
| 7 | PT-07 | Thumbnail Shows on Course Card (Signed URL) | PT-06 (course with uploaded thumbnail exists) |
| 8 | PT-08 | Edit Course — Thumbnail Preview + Replace | PT-06 (course with uploaded thumbnail exists) |
| 9 | PT-09 | Profile Page — Role Access | Multiple logins |
| 10 | PT-10 | Create Course with URL Thumbnail (Backward Compat) | PA logged in |
| 11 | PT-11 | Header Avatar Reflects Upload | PT-03 (avatar was uploaded) |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| PT-01 | Profile Page Load + Data Display | Platform Admin | ✅ | 2026-02-15 |
| PT-02 | Inline Name Editing | Platform Admin | ✅ | 2026-02-15 |
| PT-03 | Avatar Upload | Platform Admin | ✅ | 2026-02-15 |
| PT-04 | Avatar Removal | Platform Admin | ✅ | 2026-02-15 |
| PT-05 | Role Badges for Different Users | Multiple | ✅ | 2026-02-15 |
| PT-06 | Create Course with Uploaded Thumbnail | Platform Admin | ✅ | 2026-02-15 |
| PT-07 | Thumbnail Shows on Course Card | Platform Admin | ✅ | 2026-02-15 |
| PT-08 | Edit Course — Thumbnail Preview + Replace | Platform Admin | ✅ | 2026-02-15 |
| PT-09 | Profile Page — Role Access | Multiple | ✅ | 2026-02-15 |
| PT-10 | Create Course with URL Thumbnail | Platform Admin | ✅ | 2026-02-15 |
| PT-11 | Header Avatar Reflects Upload | Platform Admin | ✅ | 2026-02-15 |

---

## Preconditions (All Stories)

- Migration 00037 applied (`supabase db push` or local `supabase migration up`)
- Angular dev server running (`cd frontend && npm start`)
- At least 1 existing course (for edit tests)
- Test image file available for upload (any JPEG/PNG under 5MB)

**Verify migration 00037 applied:**

```sql
-- Avatars bucket should be private
SELECT id, public FROM storage.buckets WHERE id = 'avatars';
-- Expected: public = false

-- Authenticated SELECT policy should exist
SELECT policyname FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'avatars_select_authenticated';
```

**Verify current profile data:**

```sql
SELECT p.id, p.email, p.full_name, p.avatar_url, p.is_platform_admin, p.is_tenant_admin,
       t.name as tenant_name
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
WHERE p.email = 'et@calypso-commodities.com';
```

---

## PT-01: Profile Page Load + Data Display

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that `/profile` loads full user data: name, email, organization, role badges, member-since date, and avatar (or initials fallback). This validates the `ProfileService.loadFullProfile()` round-trip including the tenant FK join.

**Covers**: Route `/profile` → `ProfilePageComponent`, `ProfileService.loadFullProfile()`, tenant join, role computation from JWT claims

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Click avatar/name area in header (or navigate to `/profile`) | Navigates to `/profile` | ☐ |
| 3 | Verify loading state briefly shown | "Loading profile..." text or spinner | ☐ |
| 4 | Verify full name displayed | Name from `profiles.full_name` shown (e.g., "Eugen Tereschenko") | ☐ |
| 5 | Verify email displayed | `et@calypso-commodities.com` shown in info row | ☐ |
| 6 | Verify organization displayed | Tenant name shown (e.g., "Calypso") | ☐ |
| 7 | Verify role badges | "Platform Admin" badge visible (teal). If also TA: "Tenant Admin" badge (amber) | ☐ |
| 8 | Verify "Member Since" date | Formatted date from `profiles.created_at` | ☐ |
| 9 | Verify avatar or initials | If `avatar_url` exists: avatar image shown. If null: initials circle shown | ☐ |
| 10 | Verify pencil icon next to name | Edit name button (pencil icon) visible | ☐ |

### Notes / Learnings
- `loadFullProfile()` uses `.select('*, tenants!inner(name)')` to get tenant name in one query
- If avatar_url is a storage path, it's resolved to a signed URL by `#resolveAvatarUrl()`
- The initials are computed from `full_name` (first letter of each word) or first letter of email if no name
- Roles come from JWT claims, not the profile query — `is_platform_admin`, `is_tenant_admin`, `csm_tenant_ids.length > 0`, `lecturer_course_ids.length > 0`

---

## PT-02: Inline Name Editing

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify the inline name editing flow: click pencil → input appears with current name → type new name → click checkmark → name updates → success toast. Also test cancel flow.

**Covers**: `ProfilePageComponent` name editing signals (`editingName`, `savingName`, `nameInput`), `ProfileService.updateName()`, toast notification

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/profile` as PA | Profile page loads with current name | ☐ |
| 2 | Note the current name displayed | e.g., "Eugen Tereschenko" | ☐ |
| 3 | Click pencil icon next to name | Text input appears, pre-filled with current name. Check and X icons replace pencil | ☐ |
| 4 | Clear input and type "Test Name PT-02" | Input shows new value | ☐ |
| 5 | Click checkmark (save) icon | Brief loading state, then name updates to "Test Name PT-02" | ☐ |
| 6 | Verify success toast | "Name updated" toast appears | ☐ |
| 7 | Verify name persisted | Refresh the page (`/profile`) — name still shows "Test Name PT-02" | ☐ |
| 8 | Click pencil again to edit | Input appears with "Test Name PT-02" | ☐ |
| 9 | Type "Should Not Save" | Input shows new value | ☐ |
| 10 | Click X (cancel) icon | Input disappears, name still shows "Test Name PT-02" (not "Should Not Save") | ☐ |
| 11 | **Cleanup**: Edit name back to original | Restore original name (e.g., "Eugen Tereschenko") | ☐ |

### Notes / Learnings
- `updateName()` calls `.update({ full_name })` then `refreshProfile()` to update the header signal
- The `protect_profile_role_fields()` trigger allows `full_name` and `avatar_url` updates but blocks role fields
- ngModel is used for the input — changes are local until save is clicked
- After save, `refreshProfile()` re-fetches the profile signal, which updates the header name display

---

## PT-03: Avatar Upload

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify avatar upload: click camera overlay → select image file → instant preview → upload to `avatars/{userId}/avatar` → signed URL resolves → avatar image displayed. This is the most critical test — validates the full storage roundtrip with private bucket + signed URLs.

**Covers**: `ProfilePageComponent` avatar upload, `ProfileService.uploadAvatar()`, `avatars` bucket storage, `createSignedUrl()`, cache-busting

### Preconditions
- Migration 00037 applied (avatars bucket is private)
- A test image file (JPEG or PNG, under 5MB) accessible on the local filesystem

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/profile` as PA | Profile page loads | ☐ |
| 2 | Verify avatar area | Shows either current avatar image or initials circle with camera overlay | ☐ |
| 3 | Click on avatar area (camera overlay) | File picker opens (hidden `<input type="file" accept="image/*">`) | ☐ |
| 4 | Select a test image file (JPEG/PNG, <5MB) | File picker closes | ☐ |
| 5 | Verify upload progress | Loading spinner/overlay on avatar area | ☐ |
| 6 | Verify avatar updates to uploaded image | Image displays (via signed URL), no initials shown | ☐ |
| 7 | Verify success toast | "Avatar updated" toast appears | ☐ |
| 8 | Verify "Remove photo" link appears | Text link below avatar becomes visible | ☐ |
| 9 | Refresh the page | Avatar still shows the uploaded image (re-fetched via signed URL) | ☐ |
| 10 | Inspect the avatar `<img>` src | URL contains `token=` (signed URL) and `&v=` (cache-buster) | ☐ |

### SQL Verification
```sql
-- Verify avatar_url is a storage path (NOT a full URL)
SELECT avatar_url FROM profiles WHERE email = 'et@calypso-commodities.com';
-- Expected: something like 'user-uuid/avatar' (no http prefix)

-- Verify file exists in storage
SELECT name, metadata FROM storage.objects
WHERE bucket_id = 'avatars'
AND name LIKE '%/avatar';
```

### Notes / Learnings
- Avatar uses fixed path `{userId}/avatar` with `upsert: true` — always overwrites, no cleanup needed
- Signed URL expires in 1 hour; `#fetchProfile` re-runs on token refresh keeping it fresh
- `&v={Date.now()}` cache-buster prevents browser caching of old image after re-upload
- File validation: must be image/* MIME type and under 5MB (enforced by `ProfileService.uploadAvatar()`)

---

## PT-04: Avatar Removal

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify avatar removal: click "Remove photo" → avatar deleted from storage → `avatar_url` set to null → initials fallback shown. Depends on PT-03 (avatar must exist first).

**Covers**: `ProfileService.removeAvatar()`, storage `remove()`, profile update `avatar_url: null`, initials fallback

### Preconditions
- PT-03 completed (avatar has been uploaded)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/profile` as PA | Profile page loads with avatar image visible | ☐ |
| 2 | Verify "Remove photo" link is visible | Link below avatar area | ☐ |
| 3 | Click "Remove photo" | Brief loading state | ☐ |
| 4 | Verify avatar replaced with initials circle | Initials of full name shown (e.g., "ET") in colored circle | ☐ |
| 5 | Verify "Remove photo" link disappears | No removal option when no avatar | ☐ |
| 6 | Verify success toast | "Avatar removed" toast appears | ☐ |
| 7 | Refresh the page | Initials still shown (avatar_url is null in DB) | ☐ |

### SQL Verification
```sql
-- avatar_url should be null after removal
SELECT avatar_url FROM profiles WHERE email = 'et@calypso-commodities.com';
-- Expected: NULL

-- File should be removed from storage
SELECT COUNT(*) FROM storage.objects
WHERE bucket_id = 'avatars'
AND name LIKE '%/avatar'
AND name LIKE (SELECT id::text FROM profiles WHERE email = 'et@calypso-commodities.com') || '%';
-- Expected: 0
```

### Notes / Learnings
- `removeAvatar()` does two things: (1) `storage.from('avatars').remove(['{userId}/avatar'])`, (2) `.update({ avatar_url: null })`
- After removal, `refreshProfile()` updates the signal so the header also drops the avatar

---

## PT-05: Role Badges for Different Users

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that the profile page shows the correct role badges for different user types. Roles are computed from JWT claims (not the profile query). Each role gets a distinct color badge.

**Covers**: `ProfilePageComponent` role computation, badge rendering, `roleStyle()` method

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) → `/profile` | "Platform Admin" badge shown (teal) | ☐ |
| 2 | Verify Learner badge also shown | "Learner" badge (slate) — all users are implicitly learners | ☐ |
| 3 | Log out, log in as Lecturer (`lecturer-edit@calypso-commodities.com`) → `/profile` | "Lecturer" badge shown (purple) + "Learner" badge | ☐ |
| 4 | Log out, log in as Tenant Admin (`admin@calypsoclient.com`) → `/profile` | "Tenant Admin" badge shown (amber) + "Learner" badge | ☐ |
| 5 | Verify org name for TA | Shows "Calypso Client" (not "Calypso") | ☐ |
| 6 | Log out, log in as Learner (`learner@calypso-commodities.com`) → `/profile` | Only "Learner" badge shown (slate) | ☐ |

### Notes / Learnings
- Role badge colors: Platform Admin = teal, Tenant Admin = amber, CSM = sky, Lecturer = purple, Learner = slate
- A user can have multiple roles (e.g., PA + Learner, TA + Learner)
- Roles computed from JWT claims: `is_platform_admin`, `is_tenant_admin`, `csm_tenant_ids.length > 0`, `lecturer_course_ids.length > 0`. "Learner" is always shown.
- Organization comes from the tenant FK join, NOT from JWT claims

---

## PT-06: Create Course with Uploaded Thumbnail

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify the full course creation flow with an uploaded thumbnail image. This tests the two-step create: (1) create course, (2) upload thumbnail to `course-files/{courseId}/thumbnail-{timestamp}.ext`, (3) update course with storage path. The thumbnail should then be resolved to a signed URL on the course detail page.

**Covers**: `CourseFormComponent` Upload tab, `FileUploadComponent`, `CourseFormPageComponent.onSave()` two-step create, `CourseService.uploadThumbnail()`, `CourseService.loadCourseDetail()` signed URL resolution

### Preconditions
- A test image file (JPEG or PNG, under 5MB) accessible on the local filesystem

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as PA, navigate to `/courses` | Course list loads | ☐ |
| 2 | Click "Create Course" | Navigate to `/courses/new` | ☐ |
| 3 | Enter title: "Thumbnail Test PT-06" | Title field filled | ☐ |
| 4 | Enter description: "Course with uploaded thumbnail" | Description filled | ☐ |
| 5 | Verify Thumbnail section shows "Upload" and "URL" tabs | Two mode buttons visible, "Upload" is default active | ☐ |
| 6 | Verify Upload tab is active by default | FileUploadComponent (drag-and-drop area) visible | ☐ |
| 7 | Click the drop zone or "browse" link | File picker opens | ☐ |
| 8 | Select a test image file | File selected, preview image appears above the upload area | ☐ |
| 9 | Verify preview image shows the selected file | Thumbnail preview with "Clear" (X) button visible | ☐ |
| 10 | Click "Create Course" | Saving state, then navigate to course detail | ☐ |
| 11 | Verify course detail page loads | "Thumbnail Test PT-06" title displayed | ☐ |
| 12 | Navigate to `/courses` list | Course list loads | ☐ |
| 13 | Find "Thumbnail Test PT-06" card | Course card visible with thumbnail image | ☐ |
| 14 | Inspect thumbnail `<img>` src on card | Contains `token=` (signed URL from `course-files` bucket) | ☐ |

### SQL Verification
```sql
-- Verify thumbnail_url is a storage path
SELECT id, title, thumbnail_url FROM courses WHERE title = 'Thumbnail Test PT-06';
-- Expected: thumbnail_url like 'course-files/{courseId}/thumbnail-{timestamp}.jpg'

-- Verify file exists in course-files bucket
SELECT name FROM storage.objects
WHERE bucket_id = 'course-files'
AND name LIKE '%/thumbnail-%';
```

### Notes / Learnings
- Two-step create: course is created first (thumbnail_url = null in form data), then thumbnail uploaded using returned `courseId`, then course updated with storage path
- If thumbnail upload fails after course creation, course exists without thumbnail — user can re-edit
- `FileUploadComponent` accepts `image/jpeg,image/png,image/webp` with 5MB max
- The course list resolves thumbnails via batch `createSignedUrls()` for efficiency

---

## PT-07: Thumbnail Shows on Course Card (Signed URL)

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that uploaded thumbnails are correctly resolved to signed URLs and displayed on course cards in the course list. This tests the batch `createSignedUrls()` flow in `CourseService.loadCourses()`.

**Covers**: `CourseService.loadCourses()` → `#resolveThumbnailUrls()`, `createSignedUrls()` batch resolution, `CourseCardComponent` image display

### Preconditions
- PT-06 completed (course with uploaded thumbnail exists)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/courses` as PA | Course list loads | ☐ |
| 2 | Find "Thumbnail Test PT-06" card | Card visible in the grid | ☐ |
| 3 | Verify thumbnail image is displayed | Image tag renders, shows the uploaded picture | ☐ |
| 4 | Verify no broken image icon | Image loads successfully (signed URL is valid) | ☐ |
| 5 | Check browser Network tab | Request to `storage/v1/object/sign/course-files/...` returns 200 | ☐ |
| 6 | Verify other course cards without uploaded thumbnails | Either show external URL image or no image (depending on their `thumbnail_url`) | ☐ |

### Notes / Learnings
- `#resolveThumbnailUrls()` collects all storage-path thumbnails, calls `createSignedUrls()` once, then replaces paths with signed URLs
- External URL thumbnails (starting with `http`) are left unchanged — backward compat
- If `createSignedUrls()` fails for a specific path, that course gets `null` thumbnail (graceful fallback)

---

## PT-08: Edit Course — Thumbnail Preview + Replace

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that editing a course with an existing uploaded thumbnail: (1) shows the current thumbnail preview via signed URL, (2) allows replacing with a new upload, (3) cleans up the old storage file.

**Covers**: `CourseFormPageComponent.currentThumbnailSignedUrl`, `CourseFormComponent.thumbnailPreviewUrl` computed, old thumbnail cleanup via `deleteThumbnailIfStoragePath()`

### Preconditions
- PT-06 completed (course with uploaded thumbnail exists)
- A second test image file for replacement

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to "Thumbnail Test PT-06" course detail | Detail page loads | ☐ |
| 2 | Click "Edit" button | Navigate to edit form | ☐ |
| 3 | Verify thumbnail preview shows current image | Existing uploaded thumbnail displayed above the Upload/URL tabs | ☐ |
| 4 | Verify "Upload" tab is active (storage path detected) | Upload mode is default for existing storage-path thumbnails | ☐ |
| 5 | Click the file upload area | File picker opens | ☐ |
| 6 | Select a different test image | New preview replaces old preview | ☐ |
| 7 | Click "Save Changes" | Saving state, then navigate back to detail | ☐ |
| 8 | Verify new thumbnail on detail page | New image displayed (not old one) | ☐ |
| 9 | Navigate to course list | Course card shows new thumbnail | ☐ |

### SQL Verification
```sql
-- Verify thumbnail_url changed (new timestamp in filename)
SELECT thumbnail_url FROM courses WHERE title = 'Thumbnail Test PT-06';
-- The timestamp portion should be different from PT-06

-- Verify only ONE thumbnail file per course in storage (old was deleted)
SELECT name FROM storage.objects
WHERE bucket_id = 'course-files'
AND name LIKE (SELECT id::text FROM courses WHERE title = 'Thumbnail Test PT-06') || '%/thumbnail-%';
-- Expected: exactly 1 row (new file only)
```

### Notes / Learnings
- On edit with a new file, `deleteThumbnailIfStoragePath(oldUrl)` deletes the previous file from storage before uploading the new one
- The `currentThumbnailSignedUrl` input provides the signed URL for previewing the existing thumbnail in edit mode
- `loadCourseDetail()` already resolves storage paths, so the signed URL is set in `ngOnInit`

---

## PT-09: Profile Page — Role Access

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that ALL authenticated users can access the profile page, regardless of role. The profile page is accessible to every logged-in user — there is no role guard on the `/profile` route.

**Covers**: Route config (no `roleGuard` on `/profile`), `ProfileService.loadFullProfile()` works for all roles

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) → `/profile` | Profile page loads with PA data | ☐ |
| 2 | Log out, log in as Lecturer (`lecturer-edit@calypso-commodities.com`) → `/profile` | Profile page loads with lecturer data | ☐ |
| 3 | Log out, log in as Tenant Admin (`admin@calypsoclient.com`) → `/profile` | Profile page loads with TA data, org = "Calypso Client" | ☐ |
| 4 | Log out, log in as Learner (`learner@calypso-commodities.com`) → `/profile` | Profile page loads with learner data, only "Learner" badge | ☐ |

### Notes / Learnings
- The `/profile` route uses `authGuard` (must be logged in) but no `roleGuard` (any role can access)
- `loadFullProfile()` queries `profiles` table with tenant join — all users have a profile row
- The `profiles_select_own` RLS policy allows any user to select their own profile
- The `tenants_select_own` or `tenants_select_member` policies allow the tenant join

---

## PT-10: Create Course with URL Thumbnail (Backward Compat)

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify backward compatibility — creating a course with an external URL thumbnail (not uploaded) still works. The URL tab provides a plain text input for external image URLs.

**Covers**: `CourseFormComponent` URL tab, `CourseFormPageComponent` save without thumbnailFile, `isStoragePath()` returns false for external URLs

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as PA, navigate to `/courses/new` | Create course form loads | ☐ |
| 2 | Enter title: "URL Thumbnail Test PT-10" | Title filled | ☐ |
| 3 | Click "URL" tab in Thumbnail section | URL text input appears | ☐ |
| 4 | Enter a valid image URL (e.g., `https://picsum.photos/400/300`) | URL field filled | ☐ |
| 5 | Verify thumbnail preview shows the URL image | Preview image rendered from the external URL | ☐ |
| 6 | Click "Create Course" | Course created, navigate to detail | ☐ |
| 7 | Navigate to `/courses` list | Course card shows the external thumbnail image | ☐ |
| 8 | Verify the image src is the original external URL | NOT a signed URL — direct external URL (starts with `https://`) | ☐ |

### SQL Verification
```sql
SELECT thumbnail_url FROM courses WHERE title = 'URL Thumbnail Test PT-10';
-- Expected: 'https://picsum.photos/400/300' (external URL, not a storage path)
```

### Notes / Learnings
- When `thumbnailFile` is null (URL mode), `onSave()` creates the course with the URL directly — no upload step
- `isStoragePath('https://...')` returns false, so `loadCourses()` skips signed URL resolution for this course
- External URLs are rendered directly in `<img>` tags — no storage interaction

---

## PT-11: Header Avatar Reflects Upload

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that uploading an avatar on the profile page immediately updates the avatar in the header navigation bar. This tests the signal reactivity: `ProfileService.profile()?.avatar_url` is used by the header component, and `refreshProfile()` after upload should propagate the signed URL.

**Covers**: `ProfileService.uploadAvatar()` → `refreshProfile()` → `profile()` signal → `HeaderComponent` template binding

### Preconditions
- No existing avatar (or start fresh after PT-04)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/profile` as PA | Profile page loads, initials circle shown (no avatar) | ☐ |
| 2 | Look at header bar avatar area | Header shows initials or default avatar (no image) | ☐ |
| 3 | Upload a test image via camera overlay on profile page | Avatar updates on profile page | ☐ |
| 4 | **Without navigating away**, look at header | Header avatar should now show the uploaded image (same signed URL) | ☐ |
| 5 | Navigate to `/courses` (different page) | Header still shows avatar image | ☐ |
| 6 | Navigate back to `/profile` | Avatar image still shown (signed URL re-resolved on page load) | ☐ |

### Notes / Learnings
- `uploadAvatar()` calls `refreshProfile()` which calls `#fetchProfile()` which re-fetches the profile and resolves the avatar URL
- The header component reads `this.#profile.profile()?.avatar_url` — when the signal updates, the header reactively re-renders
- Signed URL in the header stays valid for ~1 hour; `#fetchProfile` re-runs on token refresh to keep it fresh
- The `&v={Date.now()}` cache-buster on the signed URL prevents the browser from showing a cached old image

---

## Test Cleanup

After running all stories, clean up test data:

```sql
-- Remove test courses
DELETE FROM courses WHERE title IN ('Thumbnail Test PT-06', 'URL Thumbnail Test PT-10');

-- Restore original name (if changed in PT-02)
UPDATE profiles SET full_name = 'Eugen Tereschenko'
WHERE email = 'et@calypso-commodities.com';

-- Remove avatar (if not done in PT-04)
UPDATE profiles SET avatar_url = NULL
WHERE email = 'et@calypso-commodities.com';
```

Storage cleanup happens automatically for courses (via `#listCourseStoragePaths` in delete flow). Avatar storage files can be left — they'll be overwritten on next upload.
