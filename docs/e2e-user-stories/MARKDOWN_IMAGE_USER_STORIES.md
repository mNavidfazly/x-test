> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Markdown Image Upload E2E User Stories (Phase 11F)

## Overview

E2E testing scenarios for the Markdown Image Upload feature (Phase 11F). These stories cover:

- **Image upload via toolbar**: Clicking the Image button in the Tiptap toolbar, selecting a file, verifying the `supabase-storage://` URI is inserted into markdown content
- **Image upload via drag-and-drop / paste**: Dropping or pasting an image file onto the editor, verifying the upload flow
- **Signed URL resolution in viewer**: Viewing a markdown module with embedded images, verifying images render via signed URLs with no `supabase-storage://` URIs leaking to the rendered HTML

Images are uploaded to `course-files/{courseId}/markdown-images/{timestamp}-{name}.webp` via Supabase Storage, compressed to WebP (max 1200px), and stored in the database as `supabase-storage://` custom URIs. The viewer resolves these to 1-hour signed URLs at render time via batch `createSignedUrls()`.

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Storage Bucket** | `course-files` (private, signed URLs) |
| **Primary Test User** | et@calypso-commodities.com (Platform Admin) |
| **Tenant** | Calypso (master tenant) |

### Alternative URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| **Production** | https://x-courses-v2.vercel.app | https://x-courses-v2-production.up.railway.app |
| **Production (Custom Domain)** | https://xcourses.x-lng.com | https://x-courses-v2-production.up.railway.app |
| **Local Dev** | http://localhost:4200 | http://localhost:8000 |

### Test Users

> Full setup instructions: [TEST_USERS.md](TEST_USERS.md)

All test users use password: `TestUser123!`

| # | Email | Role | Tenant | Used In |
|---|-------|------|--------|---------|
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | MI-01, MI-02 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit)** | Calypso (master) | MI-01, MI-02 |

### Test Files

| File | Type | Size | Purpose |
|------|------|------|---------|
| **Any JPEG/PNG image** | `image/jpeg` or `image/png` | < 5 MB | Image upload test file |

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Passed |
| ❌ | Failed |
| ⏳ | Not Tested |
| ⚠️ | Partial |

## Recommended Test Order

| Order | ID | Story | Dependencies |
|-------|----|-------|--------------|
| 1 | MI-01 | Upload Image via Toolbar Button | Must have a markdown module to edit |
| 2 | MI-02 | Upload Image via Drag-and-Drop / Paste | Must have a markdown module to edit |

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| MI-01 | Upload Image via Toolbar Button | Platform Admin / Lecturer (can_edit) | ⏳ Not Tested | — |
| MI-02 | Upload Image via Drag-and-Drop / Paste | Platform Admin / Lecturer (can_edit) | ⏳ Not Tested | — |

---

## MI-01: Upload Image via Toolbar Button

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that a lecturer/admin can upload an image to a markdown module via the Tiptap toolbar Image button, and that the image renders correctly in the viewer with a signed URL.

**Covers**: `TiptapEditorComponent` (Image button, uploadHandler, compressImage), `MarkdownFormComponent` (handleImageUpload, Supabase Storage upload), `MarkdownViewerComponent` (signed URL resolution via `resolveMarkdownStorageUrls`)

**Preconditions**:
- User is logged in as Platform Admin or Lecturer with `can_edit` on the target course
- A course with at least one lecture exists
- A markdown module exists (or create one during the test)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to an existing markdown module's edit page (or create a new Rich Text module) | Markdown form loads with Title, Description, and Tiptap editor |  |
| 2 | Verify the Tiptap toolbar shows an Image button (ImagePlus icon) | Image button is visible in the toolbar between Code Block and Undo |  |
| 3 | Click the Image button | A native file picker dialog opens |  |
| 4 | Select a JPEG/PNG image file (< 5 MB) | The file picker closes. A brief loading spinner appears on the Image button. The image URI `supabase-storage://...` is inserted into the editor content |  |
| 5 | Save the module (click "Save Changes" or "Create Module") | Module saves successfully, navigates to course detail page |  |
| 6 | Navigate to the module viewer page | Markdown content renders with the uploaded image visible as an `<img>` tag with a signed URL (`https://...supabase.co/storage/v1/object/sign/...`) |  |
| 7 | Inspect the rendered HTML (View Page Source or DevTools) | No `supabase-storage://` URIs present in the rendered HTML — all replaced with signed URLs |  |

**Negative Cases**:
- Selecting a file > 5 MB should be silently ignored (no upload, no error)
- Selecting a non-image file type should be silently ignored

---

## MI-02: Upload Image via Drag-and-Drop / Paste

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that images can be uploaded by dragging a file onto the Tiptap editor area or by pasting a clipboard image, with the same upload and resolution flow as the toolbar button.

**Covers**: `TiptapEditorComponent` (`editorProps.handleDrop`, `editorProps.handlePaste`), same upload pipeline as MI-01

**Preconditions**:
- User is logged in as Platform Admin or Lecturer with `can_edit`
- A markdown module exists for editing
- An image file is available on the desktop/filesystem for dragging, or an image is copied to clipboard

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to the markdown module edit page | Tiptap editor loads with existing content |  |
| 2 | Drag an image file from the desktop/filesystem and drop it onto the Tiptap editor area | The upload spinner appears on the Image toolbar button. After a moment, a `supabase-storage://` URI is inserted into the editor at the drop position |  |
| 3 | Copy an image to the clipboard (e.g., screenshot or copy from browser), then paste (Ctrl/Cmd+V) into the editor | The upload spinner appears. After a moment, a `supabase-storage://` URI is inserted at the cursor position |  |
| 4 | Save the module | Module saves successfully |  |
| 5 | Navigate to the module viewer page | All uploaded images render correctly with signed URLs |  |

**Notes**:
- Drag-and-drop testing may be limited in automated Playwright tests — this is primarily a manual verification story
- Paste from clipboard works with screenshots and copied images, not with copied image URLs (those paste as text)

---

## Test Execution Log

| Timestamp | Tester | Stories Tested | Result |
|-----------|--------|----------------|--------|
| — | — | — | — |

## Bugs Found During E2E Testing

| Bug ID | Story | Description | Severity | Status |
|--------|-------|-------------|----------|--------|
| — | — | — | — | — |

## References

| Resource | Path |
|----------|------|
| TiptapEditorComponent | `frontend/src/app/shared/components/tiptap-editor.component.ts` |
| MarkdownFormComponent | `frontend/src/app/features/courses/components/markdown-form.component.ts` |
| MarkdownViewerComponent | `frontend/src/app/features/courses/components/markdown-viewer.component.ts` |
| markdown-storage.utils.ts | `frontend/src/app/core/utils/markdown-storage.utils.ts` |
| CourseService (cleanup) | `frontend/src/app/core/services/course.service.ts` |
| Dev Approach Phase 11F | `docs/x_courses_development_approach.md` |
