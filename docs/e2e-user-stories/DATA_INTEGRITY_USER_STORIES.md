# X-Courses v2 — Data Integrity E2E User Stories

## Overview

These stories verify database-level data integrity constraints including cascading deletes, audit field triggers, sort order consistency, denormalized field enforcement, and module type immutability. They complement the Content Write stories by verifying that DB triggers and FK constraints work correctly end-to-end.

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Storage Bucket** | `course-files` |
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
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | DI-01 through DI-10 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit)** | Calypso (master) | DI-04 |
| 3 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | DI-01, DI-02, DI-08 |

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Passed - All steps completed successfully |
| ❌ | Failed - One or more steps failed |
| ⏳ | Not Tested - Story has not been executed yet |
| ⚠️ | Partial - Some steps passed, issues found |

---

## Recommended Test Order

**IMPORTANT**: Tests should be run in this order due to dependencies:

| Order | ID | Story | Dependencies |
|-------|-----|-------|--------------|
| 1 | DI-04 | Audit Fields — created_by/updated_by Verification | Platform Admin + Lecturer with can_edit logged in |
| 2 | DI-10 | Denormalized course_id Consistency Trigger | Course with lecture exists |
| 3 | DI-06 | Significant Update Flag and Staleness Timestamp | Module exists |
| 4 | DI-05 | Module Type Immutability — DB Gap Documentation | Module exists |
| 5 | DI-03 | Sort Order After Gap-Creating Operations | Course exists |
| 6 | DI-09 | Non-Atomic Sort Order Swap — Resilience | Course with 3+ lectures exists |
| 7 | DI-08 | Password-Protected Course Enrollment | None (creates disposable course) |
| 8 | DI-01 | Cascading Delete — Lecture Deletion | Course with lectures + modules + progress exists |
| 9 | DI-07 | Storage File Orphan Documentation | Module with uploaded files exists |
| 10 | DI-02 | Cascading Delete — Course Deletion Depth | Disposable course with full content tree exists |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| DI-01 | Cascading Delete — Lecture Deletion | Platform Admin | ⏳ Not Tested | — |
| DI-02 | Cascading Delete — Course Deletion Depth | Platform Admin | ⏳ Not Tested | — |
| DI-03 | Sort Order After Gap-Creating Operations | Platform Admin | ⏳ Not Tested | — |
| DI-04 | Audit Fields — created_by/updated_by Verification | Platform Admin + Lecturer | ⏳ Not Tested | — |
| DI-05 | Module Type Immutability — DB Gap Documentation | Platform Admin | ⏳ Not Tested | — |
| DI-06 | Significant Update Flag and Staleness Timestamp | Platform Admin | ⏳ Not Tested | — |
| DI-07 | Storage File Orphan Documentation | Platform Admin | ⏳ Not Tested | — |
| DI-08 | Password-Protected Course Enrollment | Platform Admin + Learner | ⏳ Not Tested | — |
| DI-09 | Non-Atomic Sort Order Swap — Resilience | Platform Admin | ⏳ Not Tested | — |
| DI-10 | Denormalized course_id Consistency Trigger | Platform Admin | ⏳ Not Tested | — |

---

## DI-01: Cascading Delete — Lecture Deletion

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that deleting a lecture cascades correctly through modules, subtables, and user_progress rows, and that progress percentages are recalculated without phantom entries.

**Covers**: ON DELETE CASCADE from `lectures` → `modules` → `module_videos`, `module_pdfs`, `module_markdown`, `module_files` → `user_progress`; FK constraints across 4 levels

**Preconditions**:
- Logged in as Platform Admin (`et@calypso-commodities.com`)
- A test course exists with at least 2 lectures
- Lecture 1 has 3 modules: one video, one PDF, one markdown (rich text)
- A Learner (`learner@calypso-commodities.com`) has marked at least 2 modules in Lecture 1 as complete (creating `user_progress` rows)
- On the course detail page (`/courses/:courseId`)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to `/courses/:courseId` as Platform Admin | Course detail loads with 2 lectures visible, Lecture 1 has 3 modules | ☐ |
| 2 | Expand Lecture 1, note the 3 module IDs (from URL or browser DevTools network tab) | Record `moduleId1` (video), `moduleId2` (PDF), `moduleId3` (markdown) for later API verification | ☐ |
| 3 | Note the lecture ID for Lecture 1 | Record `lectureId1` from the accordion data or network tab | ☐ |
| 4 | Open browser console, verify user_progress rows exist: `const { data } = await supabase.from('user_progress').select('*').in('module_id', ['moduleId1','moduleId2','moduleId3']); console.log(data.length);` | Returns 2 or more rows (the Learner's progress entries) | ☐ |
| 5 | Open browser console, verify module subtable rows exist: `const { data: vids } = await supabase.from('module_videos').select('*').eq('module_id', 'moduleId1'); console.log(vids.length);` | Returns 1 row for the video module | ☐ |
| 6 | Verify PDF subtable: `const { data: pdfs } = await supabase.from('module_pdfs').select('*').eq('module_id', 'moduleId2'); console.log(pdfs.length);` | Returns 1 row for the PDF module | ☐ |
| 7 | Verify markdown subtable: `const { data: mds } = await supabase.from('module_markdown').select('*').eq('module_id', 'moduleId3'); console.log(mds.length);` | Returns 1 row for the markdown module | ☐ |
| 8 | Click the trash icon on Lecture 1 accordion header | Inline confirmation appears: "Are you sure? This will delete the lecture and all its modules." | ☐ |
| 9 | Click "Yes, Delete" | Lecture 1 deleted, only Lecture 2 remains in the UI | ☐ |
| 10 | Verify UI: only Lecture 2 is displayed | Lecture 1 gone from the accordion list | ☐ |
| 11 | Open browser console, query modules: `const { data } = await supabase.from('modules').select('*').eq('lecture_id', 'lectureId1'); console.log(data.length);` | Returns 0 rows — all 3 modules cascade-deleted | ☐ |
| 12 | Query module_videos for deleted module: `const { data } = await supabase.from('module_videos').select('*').eq('module_id', 'moduleId1'); console.log(data.length);` | Returns 0 rows — subtable row cascade-deleted | ☐ |
| 13 | Query module_pdfs and module_markdown similarly | Both return 0 rows — subtable rows cascade-deleted | ☐ |
| 14 | Query user_progress for deleted modules: `const { data } = await supabase.from('user_progress').select('*').in('module_id', ['moduleId1','moduleId2','moduleId3']); console.log(data.length);` | Returns 0 rows — progress entries cascade-deleted | ☐ |

**Notes/Learnings**:
- ON DELETE CASCADE propagates from `lectures` → `modules` (via `modules.lecture_id` FK) → each subtable (via `module_videos.module_id` FK, etc.) → `user_progress` (via `user_progress.module_id` FK)
- Storage files (PDF uploads, file attachments) are NOT cleaned up by cascade delete — only DB rows are removed (see DI-07)
- Progress percentage shown on the course detail page should recalculate based on remaining modules after the cascade — no phantom progress from deleted modules
- If the Learner visits the course after deletion, they should see updated progress reflecting only Lecture 2's modules

---

## DI-02: Cascading Delete — Course Deletion Depth

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that deleting a course cascades through the full 6-level FK chain (courses → lectures → modules → quizzes → quiz_questions → quiz_question_options) plus parallel deletions of tenant_courses, course_enrollments, and user_progress.

**Covers**: Full ON DELETE CASCADE chain across 12+ tables; FK constraints: `lectures.course_id`, `modules.lecture_id`, `quizzes.module_id`, `quiz_questions.quiz_id`, `quiz_question_options.question_id`, `tenant_courses.course_id`, `course_enrollments.course_id`, `user_progress.module_id`; SET NULL behavior on `expert_questions.module_id` and `issues.module_id`

**Preconditions**:
- Logged in as Platform Admin
- Create a disposable test course with the following content tree:
  - 1 lecture with modules of each type (video, PDF, markdown, exam)
  - Course assigned to at least one tenant via `tenant_courses`
  - A Learner enrolled in the course (creates `course_enrollments` row)
  - The Learner has marked at least one module complete (creates `user_progress` row)
- Record all IDs: courseId, lectureId, moduleIds (one per type), tenant_courses row ID, enrollment ID

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to `/courses/:courseId` as Platform Admin | Course detail page loads with all content visible | ☐ |
| 2 | Record all entity IDs via browser console or network tab | Note: courseId, lectureId, videoModuleId, pdfModuleId, markdownModuleId, examModuleId | ☐ |
| 3 | Verify tenant_courses row exists: `const { data } = await supabase.from('tenant_courses').select('*').eq('course_id', courseId); console.log(data.length);` | Returns 1+ rows (course assigned to tenant) | ☐ |
| 4 | Verify course_enrollments row exists: `const { data } = await supabase.from('course_enrollments').select('*').eq('course_id', courseId); console.log(data.length);` | Returns 1+ rows (Learner enrolled) | ☐ |
| 5 | Verify user_progress rows exist for the enrolled Learner's module completions | Returns 1+ rows | ☐ |
| 6 | Verify module subtable rows exist (module_videos, module_pdfs, module_markdown, exams) | Each returns 1 row for the corresponding module | ☐ |
| 7 | Click "Edit" on course, scroll to "Delete Course" danger zone | "Delete Course" button visible (Platform Admin only) | ☐ |
| 8 | Click "Delete Course" | Confirmation prompt: "Are you sure? This will permanently delete this course and all its content." | ☐ |
| 9 | Click "Yes, Delete" | Course deleted, redirected to `/courses` | ☐ |
| 10 | Verify course no longer in course list | Course card absent from `/courses` page | ☐ |
| 11 | Query lectures: `const { data } = await supabase.from('lectures').select('*').eq('course_id', courseId); console.log(data.length);` | Returns 0 rows — lectures cascade-deleted | ☐ |
| 12 | Query modules for the deleted lecture: `const { data } = await supabase.from('modules').select('*').eq('lecture_id', lectureId); console.log(data.length);` | Returns 0 rows — modules cascade-deleted | ☐ |
| 13 | Query all subtables (module_videos, module_pdfs, module_markdown, exams) for deleted module IDs | All return 0 rows — subtable rows cascade-deleted | ☐ |
| 14 | Query tenant_courses: `const { data } = await supabase.from('tenant_courses').select('*').eq('course_id', courseId); console.log(data.length);` | Returns 0 rows — tenant assignment cascade-deleted | ☐ |
| 15 | Query course_enrollments: `const { data } = await supabase.from('course_enrollments').select('*').eq('course_id', courseId); console.log(data.length);` | Returns 0 rows — enrollment cascade-deleted | ☐ |
| 16 | Query user_progress for any of the deleted module IDs | Returns 0 rows — progress cascade-deleted | ☐ |

**Notes/Learnings**:
- The full cascade chain is: `courses` → `lectures` (via `course_id`) → `modules` (via `lecture_id`) → subtables (via `module_id`) → `quiz_questions` (via `quiz_id` on quizzes) → `quiz_question_options` (via `question_id`)
- Parallel cascade paths from courses: `tenant_courses` (via `course_id`), `course_enrollments` (via `course_id`)
- `expert_questions.module_id` uses SET NULL (not CASCADE) — the question remains but loses its module reference
- `issues.module_id` uses SET NULL (not CASCADE) — the issue remains but loses its module reference
- Storage files (PDFs, exam files, attachments) are NOT cleaned up — only DB rows are removed
- This is a destructive operation — use a disposable test course, not one needed for other test stories

---

## DI-03: Sort Order After Gap-Creating Operations

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that sort order calculations and swaps work correctly even when gaps exist in the sort_order sequence (caused by deleting middle items), and that no duplicate sort_orders are created within the same parent.

**Covers**: `CourseService.createLecture` (auto sort_order = max+1), `CourseService.swapLectureSortOrder`, `CourseService.createModule` (auto sort_order = max+1), `CourseService.swapModuleSortOrder`; non-atomic sequential swap behavior

**Preconditions**:
- Logged in as Platform Admin
- A test course exists (or create one)
- On the course detail page (`/courses/:courseId`)

**Lecture Sort Order Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Create Lecture A: "Sort Test A" | Lecture A appears, sort_order = 0 (first lecture) | ☐ |
| 2 | Create Lecture B: "Sort Test B" | Lecture B appears below A, sort_order = 1 | ☐ |
| 3 | Create Lecture C: "Sort Test C" | Lecture C appears below B, sort_order = 2 | ☐ |
| 4 | Delete Lecture B (the middle one) | Lecture B removed; UI shows A, C. Gap in sort_order: A(0), C(2) | ☐ |
| 5 | Create Lecture D: "Sort Test D" | Lecture D appears below C. sort_order = 3 (max(0,2)+1 = 3) | ☐ |
| 6 | Verify display order: A, C, D | Lectures rendered in sort_order ascending: 0, 2, 3 | ☐ |
| 7 | Move C above A: click up-chevron on C | A and C swap sort_orders. New order: C, A, D | ☐ |
| 8 | Reload the page | Order persists: C, A, D (sort_orders swapped in DB) | ☐ |
| 9 | Open browser console, query sort_orders: `const { data } = await supabase.from('lectures').select('id, title, sort_order').eq('course_id', courseId).order('sort_order'); console.log(data);` | Verify no duplicate sort_orders within this course. Each lecture has a unique sort_order | ☐ |

**Module Sort Order Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 10 | Inside Lecture C (or any lecture), create Module M1: "Module Alpha" (any type) | Module M1 appears, sort_order = 0 | ☐ |
| 11 | Create Module M2: "Module Beta" | Module M2 appears below M1, sort_order = 1 | ☐ |
| 12 | Create Module M3: "Module Gamma" | Module M3 appears below M2, sort_order = 2 | ☐ |
| 13 | Delete Module M2 (the middle one) | M2 removed; UI shows M1, M3. Gap: M1(0), M3(2) | ☐ |
| 14 | Create Module M4: "Module Delta" | M4 appears below M3. sort_order = 3 (max(0,2)+1 = 3) | ☐ |
| 15 | Move M3 above M1: click up-chevron on M3 | M1 and M3 swap sort_orders. New order: M3, M1, M4 | ☐ |
| 16 | Reload the page | Module order persists: M3, M1, M4 | ☐ |

**Notes/Learnings**:
- New items always get `max(existing sort_order) + 1`, which means gaps persist after deletions — sort_orders are never "compacted"
- The swap operation exchanges the sort_order values of two adjacent items via 2 sequential Supabase UPDATE calls (not atomic)
- Gaps in sort_order values are harmless — items are rendered by `ORDER BY sort_order ASC`, which handles non-contiguous values correctly
- There is no UNIQUE constraint on `(course_id, sort_order)` for lectures or `(lecture_id, sort_order)` for modules — duplicates are possible in theory (see DI-09)
- If all lectures/modules are deleted and a new one is created, it gets sort_order = 0 (max of empty set defaults to -1 + 1 = 0, or equivalent logic)

---

## DI-04: Audit Fields — created_by/updated_by Verification

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that the three audit triggers (`set_course_audit_fields`, `set_lecture_audit_fields`, `set_module_audit_fields`) correctly set `created_by`/`updated_by` from `auth.uid()` and `created_at`/`updated_at` timestamps on INSERT and UPDATE.

**Covers**: `set_course_audit_fields()` (migration 00019), `set_lecture_audit_fields()` (migration 00020), `set_module_audit_fields()` (migration 00021); BEFORE INSERT/UPDATE triggers; `auth.uid()` extraction

**Preconditions**:
- Platform Admin (`et@calypso-commodities.com`) logged in — note their user UUID (User A)
- Lecturer with can_edit (`lecturer-edit@calypso-commodities.com`) available — note their user UUID (User B)
- A test course exists or will be created in step 1
- Both users' UUIDs can be obtained from browser console: `const { data: { user } } = await supabase.auth.getUser(); console.log(user.id);`

**Course Audit Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | As Platform Admin (User A), create a new course: "Audit Test Course" | Course created successfully | ☐ |
| 2 | Open browser console, query the course: `const { data } = await supabase.from('courses').select('id, created_by, updated_by, created_at, updated_at').eq('title', 'Audit Test Course').single(); console.log(data);` | `created_by` = User A UUID, `updated_by` = User A UUID, `created_at` within last minute, `updated_at` = `created_at` (same timestamp on INSERT) | ☐ |
| 3 | Note the `created_at` timestamp for later comparison | Record timestamp | ☐ |
| 4 | Log out, log in as Lecturer (User B, `lecturer-edit@calypso-commodities.com`) | Session established as User B | ☐ |
| 5 | Navigate to the course, click Edit, change title to "Audit Test Course (Updated)", save | Course updated successfully | ☐ |
| 6 | Open browser console, query the course again: `const { data } = await supabase.from('courses').select('id, created_by, updated_by, created_at, updated_at').eq('title', 'Audit Test Course (Updated)').single(); console.log(data);` | `created_by` STILL = User A UUID (unchanged), `updated_by` NOW = User B UUID, `created_at` unchanged from step 3, `updated_at` > `created_at` | ☐ |

**Lecture Audit Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 7 | Log out, log in as Platform Admin (User A) | Session established as User A | ☐ |
| 8 | Navigate to the test course, create a new lecture: "Audit Test Lecture" | Lecture created | ☐ |
| 9 | Query the lecture: `const { data } = await supabase.from('lectures').select('id, created_by, updated_by, created_at, updated_at').eq('title', 'Audit Test Lecture').single(); console.log(data);` | `created_by` = User A UUID, `updated_by` = User A UUID, timestamps set correctly | ☐ |
| 10 | Log out, log in as Lecturer (User B), edit the lecture title to "Audit Test Lecture (Updated)" | Lecture updated | ☐ |
| 11 | Query the lecture again | `created_by` STILL = User A, `updated_by` NOW = User B, `updated_at` > `created_at` | ☐ |

**Module Audit Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 12 | Log in as Platform Admin (User A), create a video module in the test lecture: "Audit Test Module" | Module created | ☐ |
| 13 | Query the module: `const { data } = await supabase.from('modules').select('id, created_by, updated_by, created_at, updated_at').eq('title', 'Audit Test Module').single(); console.log(data);` | `created_by` = User A UUID, `updated_by` = User A UUID, timestamps set correctly | ☐ |
| 14 | Log out, log in as Lecturer (User B), edit the module (change title to "Audit Test Module (Updated)") | Module updated | ☐ |
| 15 | Query the module again | `created_by` STILL = User A, `updated_by` NOW = User B, `updated_at` > `created_at` | ☐ |

**Notes/Learnings**:
- All three triggers use the same pattern: on INSERT, set `created_by = auth.uid()`, `updated_by = auth.uid()`, `created_at = now()`, `updated_at = now()`; on UPDATE, set only `updated_by = auth.uid()`, `updated_at = now()` (never overwrite `created_by`/`created_at`)
- `auth.uid()` returns the UUID of the currently authenticated Supabase user — this is populated automatically by the JWT
- If a service account (no auth context) performs an operation, `auth.uid()` returns NULL — audit fields would be NULL
- The triggers are BEFORE INSERT/UPDATE — they modify the NEW row before it hits the table
- Migration 00019: courses, Migration 00020: lectures, Migration 00021: modules — identical trigger pattern across all three

---

## DI-05: Module Type Immutability — DB Gap Documentation

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Document and verify the known gap that module type (`module_type` column) has NO database trigger preventing changes after creation — only UI enforcement (type selector hidden in edit mode).

**Covers**: `modules.module_type` column; KNOWN GAP: no `protect_module_type_immutability()` trigger exists; UI-only enforcement in ModuleFormPageComponent (type selector hidden in edit mode)

**Preconditions**:
- Logged in as Platform Admin
- A video module exists in a test course (created in a previous test or pre-existing)
- Note the module ID from the URL or DevTools

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to the edit page for the video module: `/courses/:courseId/modules/:moduleId/edit` | Edit form loads, module type shown as "Video" but NOT editable (no type selector) | ☐ |
| 2 | Verify type is displayed as a static label, not a dropdown or selector | Type shown in the heading or badge area — no interactive type-changing UI | ☐ |
| 3 | Open browser console, confirm current module_type: `const { data } = await supabase.from('modules').select('id, module_type').eq('id', 'moduleId').single(); console.log(data);` | Returns `module_type: 'video'` | ☐ |
| 4 | Attempt to change module_type via console: `const { data, error } = await supabase.from('modules').update({ module_type: 'pdf' }).eq('id', 'moduleId').select(); console.log({ data, error });` | **CURRENT BEHAVIOR: UPDATE SUCCEEDS** — `module_type` changed to 'pdf'. No trigger blocks this. This is the known gap. | ☐ |
| 5 | Verify the inconsistency: query module_videos for this module: `const { data } = await supabase.from('module_videos').select('*').eq('module_id', 'moduleId'); console.log(data.length);` | Returns 1 row — the `module_videos` subtable row still exists despite `module_type` now being 'pdf' | ☐ |
| 6 | Query module_pdfs for this module: `const { data } = await supabase.from('module_pdfs').select('*').eq('module_id', 'moduleId'); console.log(data.length);` | Returns 0 rows — no PDF content exists because the module was originally created as video | ☐ |
| 7 | Navigate to the module viewer: `/courses/:courseId/modules/:moduleId` | **Broken state**: viewer sees `module_type='pdf'` and attempts to load PDF content, finds nothing. May show error state, empty viewer, or crash depending on error handling | ☐ |
| 8 | **CLEANUP**: Revert the module_type back to 'video': `await supabase.from('modules').update({ module_type: 'video' }).eq('id', 'moduleId');` | module_type restored to 'video', module viewer works again | ☐ |
| 9 | Navigate to module viewer again, verify it works normally | Video content displays correctly after revert | ☐ |

**Notes/Learnings**:
- **KNOWN GAP**: There is NO database trigger that prevents changing `module_type` after creation. The only enforcement is UI-level (type selector is hidden in edit mode in ModuleFormPageComponent)
- If `module_type` is changed via direct API call, the subtable data becomes inconsistent: the old subtable row (e.g., `module_videos`) still exists, but the viewer looks for the new type's subtable (e.g., `module_pdfs`) which has no data
- **Recommendation**: Add a BEFORE UPDATE trigger `protect_module_type_immutability()` that raises an exception if `NEW.module_type IS DISTINCT FROM OLD.module_type`. This would be a one-line migration:
  ```sql
  CREATE FUNCTION protect_module_type_immutability() RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.module_type IS DISTINCT FROM OLD.module_type THEN
      RAISE EXCEPTION 'Module type cannot be changed after creation';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  CREATE TRIGGER enforce_module_type_immutability
    BEFORE UPDATE ON modules FOR EACH ROW
    EXECUTE FUNCTION protect_module_type_immutability();
  ```
- RLS policies do not prevent this because they only check role-based access, not field-level immutability
- This gap exists because the `module_type` enum was designed for INSERT-time classification, and UPDATE immutability was left to the application layer

---

## DI-06: Significant Update Flag and Staleness Timestamp

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that the `significantUpdate` flag on module save correctly sets or preserves the `significant_update_at` timestamp on the modules table, and that the UI checkbox and helper text are present.

**Covers**: `ModuleSavePayload.significantUpdate` flag; `modules.significant_update_at` column; CourseService.updateModule; content staleness tracking (used by `pg_cron` daily staleness check)

**Preconditions**:
- Logged in as Platform Admin
- A module exists (any type) in a test course
- On the course detail page

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to the edit page for an existing module: `/courses/:courseId/modules/:moduleId/edit` | Edit form loads with pre-populated fields | ☐ |
| 2 | Open browser console, check current significant_update_at: `const { data } = await supabase.from('modules').select('id, significant_update_at').eq('id', 'moduleId').single(); console.log(data);` | `significant_update_at` is likely NULL (never set before) | ☐ |
| 3 | Verify the "Significant Update" checkbox exists in the form | Checkbox is present with helper text explaining that checking it marks the content as significantly updated (affects staleness tracking) | ☐ |
| 4 | Ensure the "Significant Update" checkbox is NOT checked | Checkbox is unchecked by default | ☐ |
| 5 | Change the module title (e.g., append " - v2"), leave the checkbox unchecked, click "Save Changes" | Module updated, redirected to course detail | ☐ |
| 6 | Query significant_update_at again: `const { data } = await supabase.from('modules').select('id, significant_update_at').eq('id', 'moduleId').single(); console.log(data);` | `significant_update_at` is still NULL — non-significant edits do not set this field | ☐ |
| 7 | Navigate back to the edit page | Edit form loads | ☐ |
| 8 | Change the module title again, CHECK the "Significant Update" checkbox, click "Save Changes" | Module updated, redirected to course detail | ☐ |
| 9 | Query significant_update_at again | `significant_update_at` is now set to approximately the current timestamp (within the last minute) | ☐ |
| 10 | Note the `significant_update_at` value | Record timestamp for step 12 comparison | ☐ |
| 11 | Navigate to edit page again, make a minor change, leave checkbox UNCHECKED, save | Module updated | ☐ |
| 12 | Query significant_update_at again | `significant_update_at` retains the value from step 9 — it is NOT cleared by non-significant edits | ☐ |

**Notes/Learnings**:
- `significant_update_at` is used by the `pg_cron` daily staleness check job — it compares this timestamp against `courses.staleness_threshold_days` to generate `content_staleness` notifications
- The field is only SET when the checkbox is checked; it is never cleared by subsequent saves without the checkbox
- The `set_module_audit_fields()` trigger handles `updated_at` independently — `significant_update_at` is a separate concern managed by the application layer (CourseService)
- The checkbox should be unchecked by default to prevent accidental staleness resets
- This feature exists to distinguish between cosmetic edits (typo fixes, formatting) and substantive content changes that should reset the staleness timer

---

## DI-07: Storage File Orphan Documentation

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Document and verify the known gap that deleting modules, lectures, or courses removes DB rows via cascade but does NOT clean up files in Supabase Storage — resulting in orphaned files that consume storage quota.

**Covers**: KNOWN GAP: Supabase Storage files (`course-files` bucket) not cleaned up on FK cascade delete; `module_pdfs.file_url`, `module_files.file_url`, `exams.exam_file_url` storage references

**Preconditions**:
- Logged in as Platform Admin
- A PDF module exists with an uploaded PDF file (note the `file_url` from `module_pdfs`)
- The module has at least one file attachment (note the `file_url` from `module_files`)
- Record both storage URLs before deletion

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to the edit page for a PDF module that has an uploaded PDF file | Edit form loads, PDF file shown in the form, file attachments section visible | ☐ |
| 2 | Open browser console, query the PDF file URL: `const { data } = await supabase.from('module_pdfs').select('file_url').eq('module_id', 'moduleId').single(); console.log(data.file_url);` | Returns the Supabase Storage public URL (e.g., `https://ruhdnvtvoxxiodnyyqqf.supabase.co/storage/v1/object/public/course-files/...`) | ☐ |
| 3 | Record the PDF file URL | Note URL for step 8 | ☐ |
| 4 | Query file attachments: `const { data } = await supabase.from('module_files').select('file_url').eq('module_id', 'moduleId'); console.log(data);` | Returns 1+ rows with file URLs | ☐ |
| 5 | Record the attachment file URL(s) | Note URL(s) for step 9 | ☐ |
| 6 | Navigate back to course detail, delete the module via trash icon + confirm | Module deleted (cascade removes module_pdfs and module_files DB rows) | ☐ |
| 7 | Verify DB rows are gone: query module_pdfs and module_files for the deleted module ID | Both return 0 rows — FK cascade worked correctly for DB rows | ☐ |
| 8 | Open the recorded PDF file URL in a new browser tab | **FILE STILL ACCESSIBLE** — the storage object was not deleted. The Supabase Storage public URL still serves the file. This is the known gap. | ☐ |
| 9 | Open the recorded attachment file URL in a new browser tab | **FILE STILL ACCESSIBLE** — same behavior, storage object not cleaned up | ☐ |
| 10 | Verify via Supabase Storage API: `const { data } = await supabase.storage.from('course-files').list('courseId'); console.log(data);` | Files still listed in the storage bucket under the course ID folder | ☐ |

**Notes/Learnings**:
- **KNOWN GAP**: No storage cleanup mechanism exists. FK cascade deletes only remove database rows, not the corresponding files in Supabase Storage
- Orphaned files accumulate over time and consume storage quota (Supabase bills by storage usage)
- This affects three tables: `module_pdfs.file_url`, `module_files.file_url`, and `exams.exam_file_url`
- **Potential solutions** (not yet implemented):
  1. Database trigger (AFTER DELETE) that calls a Supabase Edge Function to delete the storage object
  2. Scheduled cleanup job that scans storage for files not referenced by any DB row
  3. Application-level cleanup in `CourseService.deleteModule()` before the DB delete
- The storage path format is `course-files/{courseId}/{timestamp}-{filename}` — when a course is deleted, the entire `{courseId}/` folder becomes orphaned
- This is a low-priority issue for early development but will need resolution before production scale

---

## DI-08: Password-Protected Course Enrollment

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify the `hash_course_password()` trigger auto-hashes plaintext passwords on INSERT/UPDATE, that `enroll_with_password()` RPC validates passwords correctly, and that changing enrollment_type clears the password hash.

**Covers**: `hash_course_password()` DB trigger (migration 00019); `enroll_with_password(p_course_id, p_password)` RPC function (migration 00009); `courses.password_hash` column; `courses.enrollment_type` enum; bcrypt hashing

**Preconditions**:
- Logged in as Platform Admin for course creation
- Learner account (`learner@calypso-commodities.com`) available for enrollment testing
- Enrollment UI is NOT yet built (Phase 4A) — all enrollment steps use browser console RPC calls

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | As Platform Admin, create a new course: "Password Enrollment Test", enrollment_type: "Password protected", password: "SecretPass123" | Course created successfully | ☐ |
| 2 | Open browser console, query the course's password_hash: `const { data } = await supabase.from('courses').select('id, enrollment_type, password_hash').eq('title', 'Password Enrollment Test').single(); console.log(data);` | `enrollment_type` = 'password_protected', `password_hash` starts with '$2' (bcrypt hash, NOT plaintext 'SecretPass123') | ☐ |
| 3 | Verify the password_hash is NOT the plaintext value | `password_hash` is a ~60-character bcrypt string, not 'SecretPass123' | ☐ |
| 4 | Assign the course to the Calypso tenant (if not auto-assigned) via the edit page tenant toggle | Course visible to Calypso tenant users | ☐ |
| 5 | Log out, log in as Learner (`learner@calypso-commodities.com`) | Learner session established | ☐ |
| 6 | Open browser console, attempt enrollment with WRONG password: `const { data, error } = await supabase.rpc('enroll_with_password', { p_course_id: 'courseId', p_password: 'WrongPassword' }); console.log({ data, error });` | RPC returns error: "Invalid course password" (or similar message) — enrollment denied | ☐ |
| 7 | Verify no enrollment row created: `const { data } = await supabase.from('course_enrollments').select('*').eq('course_id', 'courseId').eq('user_id', learnerId); console.log(data.length);` | Returns 0 rows — Learner is NOT enrolled | ☐ |
| 8 | Attempt enrollment with CORRECT password: `const { data, error } = await supabase.rpc('enroll_with_password', { p_course_id: 'courseId', p_password: 'SecretPass123' }); console.log({ data, error });` | RPC succeeds — enrollment created | ☐ |
| 9 | Verify enrollment row: `const { data } = await supabase.from('course_enrollments').select('*').eq('course_id', 'courseId').eq('user_id', learnerId); console.log(data);` | Returns 1 row — Learner is enrolled | ☐ |
| 10 | Attempt enrollment again with correct password: `const { data, error } = await supabase.rpc('enroll_with_password', { p_course_id: 'courseId', p_password: 'SecretPass123' }); console.log({ data, error });` | RPC returns error: "Already enrolled" (or similar) — duplicate enrollment prevented | ☐ |
| 11 | Log out, log in as Platform Admin | Admin session established | ☐ |
| 12 | Edit the course, change enrollment_type to "Open" (from dropdown), save | Course updated to open enrollment | ☐ |
| 13 | Query password_hash: `const { data } = await supabase.from('courses').select('enrollment_type, password_hash').eq('title', 'Password Enrollment Test').single(); console.log(data);` | `enrollment_type` = 'open', `password_hash` = NULL — hash is cleared when enrollment_type changes away from password_protected | ☐ |
| 14 | Edit course again, change enrollment_type back to "Password protected", enter new password: "NewPass456", save | Course updated | ☐ |
| 15 | Query password_hash again | `password_hash` starts with '$2' (new bcrypt hash) — new password hashed correctly | ☐ |
| 16 | Edit course again, leave password field BLANK, save | Course updated | ☐ |
| 17 | Query password_hash | `password_hash` retains the hash from step 15 (NOT cleared) — blank password in edit mode preserves existing hash | ☐ |

**Notes/Learnings**:
- `hash_course_password()` trigger: on INSERT/UPDATE, if `enrollment_type = 'password_protected'` and `password_hash` is set (not starting with '$2'), it hashes the plaintext value with bcrypt
- When `enrollment_type` changes away from `password_protected`, the trigger clears `password_hash` to NULL
- When editing with a blank password field, the frontend omits `password_hash` from the UPDATE payload, so the existing hash is preserved
- `enroll_with_password()` RPC: validates the password using `crypt()` comparison, creates `course_enrollments` row on success
- Enrollment UI is not yet built (Phase 4A) — this test uses console RPC calls exclusively
- The RPC function also checks that the course exists, that enrollment_type is 'password_protected', and that the user is not already enrolled

---

## DI-09: Non-Atomic Sort Order Swap — Resilience

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that the application handles duplicate sort_order values gracefully (simulating a partial swap failure) and that reorder operations can repair the inconsistency.

**Covers**: `CourseService.swapLectureSortOrder` (2 sequential UPDATEs, non-atomic); UI resilience when `ORDER BY sort_order` encounters duplicates; self-healing via subsequent swap operations

**Preconditions**:
- Logged in as Platform Admin
- A test course with exactly 3 lectures exists (create them if needed)
- On the course detail page (`/courses/:courseId`)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Create 3 lectures: "Resilience A", "Resilience B", "Resilience C" | Three lectures displayed in order A(0), B(1), C(2) | ☐ |
| 2 | Open browser console, verify sort_orders: `const { data } = await supabase.from('lectures').select('id, title, sort_order').eq('course_id', courseId).order('sort_order'); console.log(data);` | A: sort_order=0, B: sort_order=1, C: sort_order=2 — all unique | ☐ |
| 3 | Simulate partial swap failure by manually setting duplicate sort_orders via console: `await supabase.from('lectures').update({ sort_order: 1 }).eq('id', 'lectureAId');` | Lecture A now has sort_order=1 (same as B). Two lectures share sort_order=1 | ☐ |
| 4 | Verify the duplicate: `const { data } = await supabase.from('lectures').select('id, title, sort_order').eq('course_id', courseId).order('sort_order'); console.log(data);` | A: sort_order=1, B: sort_order=1, C: sort_order=2 — duplicate exists | ☐ |
| 5 | Reload the course detail page | Page loads WITHOUT crashing. All 3 lectures are visible. The relative order of A and B (both sort_order=1) is undefined but both are displayed | ☐ |
| 6 | Verify all 3 lecture titles are present in the UI | "Resilience A", "Resilience B", "Resilience C" all visible (order of A/B may vary) | ☐ |
| 7 | Attempt to reorder: click the up or down chevron on any lecture | Swap operation executes — exchanges sort_orders of two adjacent lectures | ☐ |
| 8 | Reload the page and query sort_orders again: `const { data } = await supabase.from('lectures').select('id, title, sort_order').eq('course_id', courseId).order('sort_order'); console.log(data);` | After the swap, sort_orders should be updated. Check if duplicates are resolved | ☐ |
| 9 | If duplicates remain, perform additional reorder operations | Each swap should gradually fix the sort_order distribution until all values are unique | ☐ |
| 10 | Final verification: query all sort_orders, confirm no duplicates | All 3 lectures have distinct sort_order values | ☐ |

**Notes/Learnings**:
- **KNOWN WEAKNESS**: The swap operation uses 2 sequential Supabase UPDATE calls (not wrapped in a database transaction). If the first UPDATE succeeds but the second fails (network error, timeout), two items end up with the same sort_order
- There is no UNIQUE constraint on `(course_id, sort_order)` or `(lecture_id, sort_order)` — PostgreSQL does not prevent duplicates at the DB level
- The UI renders lectures/modules using `ORDER BY sort_order ASC` — when duplicates exist, PostgreSQL returns them in an undefined (but stable within a single query) order
- The page should never crash due to duplicate sort_orders — it may display items in unexpected order, but the UI must remain functional
- **Future improvement**: Wrap the two UPDATEs in a PL/pgSQL RPC function that runs as a single transaction, or add a UNIQUE constraint and handle conflicts
- The same non-atomic pattern applies to module sort_order swaps (`CourseService.swapModuleSortOrder`)

---

## DI-10: Denormalized course_id Consistency Trigger

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that the `enforce_module_course_consistency()` trigger prevents `modules.course_id` from diverging from the parent `lectures.course_id`, both on INSERT and UPDATE.

**Covers**: `enforce_module_course_consistency()` trigger (migration 00005); `modules.course_id` denormalized column; FK relationship `modules.lecture_id` → `lectures.id`; cross-tenant data leak prevention

**Preconditions**:
- Logged in as Platform Admin
- Two separate courses exist: Course A and Course B
- Course A has at least one lecture (Lecture A1)
- Course B has a different `course_id`
- Note all IDs: courseAId, courseBId, lectureA1Id

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to Course A's detail page, create a module in Lecture A1 (any type, e.g., "Consistency Test Module") | Module created successfully | ☐ |
| 2 | Open browser console, verify module's course_id matches Course A: `const { data } = await supabase.from('modules').select('id, course_id, lecture_id').eq('title', 'Consistency Test Module').single(); console.log(data);` | `course_id` = courseAId, `lecture_id` = lectureA1Id — auto-set correctly by the trigger | ☐ |
| 3 | Attempt to UPDATE module's course_id to Course B via console: `const { data, error } = await supabase.from('modules').update({ course_id: 'courseBId' }).eq('id', 'moduleId').select(); console.log({ data, error });` | **Error returned**: "Module course_id does not match lecture's course_id" (or similar exception from the trigger). UPDATE is blocked. | ☐ |
| 4 | Verify module's course_id is unchanged: `const { data } = await supabase.from('modules').select('course_id').eq('id', 'moduleId').single(); console.log(data);` | `course_id` still = courseAId — the trigger prevented the inconsistent update | ☐ |
| 5 | Attempt to INSERT a new module with mismatched course_id via console: `const { data, error } = await supabase.from('modules').insert({ title: 'Bad Module', lecture_id: 'lectureA1Id', course_id: 'courseBId', module_type: 'markdown', sort_order: 99 }).select(); console.log({ data, error });` | **Error returned**: same consistency exception. INSERT is blocked because Lecture A1 belongs to Course A, not Course B. | ☐ |
| 6 | Verify no "Bad Module" row was created: `const { data } = await supabase.from('modules').select('*').eq('title', 'Bad Module'); console.log(data.length);` | Returns 0 rows — the inconsistent INSERT was rejected | ☐ |
| 7 | Verify the original module still works: navigate to module viewer | Module loads and displays content correctly — no corruption | ☐ |
| 8 | Open browser console, verify the trigger function exists: `const { data } = await supabase.rpc('enforce_module_course_consistency'); console.log(data);` (this will error — just verify the function is mentioned in error) | The function exists in the database (may return an error about wrong invocation, but confirms it's registered) | ☐ |

**Notes/Learnings**:
- **CRITICAL**: If `modules.course_id` diverges from `lectures.course_id`, RLS policies that filter on `modules.course_id` will return incorrect results — potentially leaking content across tenants
- The `modules.course_id` column is intentionally denormalized (duplicated from `lectures.course_id`) for RLS performance — joining through lectures on every module query would be expensive
- The trigger fires on both INSERT and UPDATE, checking that `NEW.course_id` matches the `course_id` of the lecture referenced by `NEW.lecture_id`
- The `CourseService.createModule()` method sets `course_id` from the course context automatically — the trigger is a safety net for direct API access or bugs
- Migration 00005 contains this trigger alongside other module-related constraints
- This is one of the most important data integrity constraints in the system — a failure here could result in cross-tenant data visibility

---

## Known Issues

| ID | Issue | Severity | Details |
|----|-------|----------|---------|
| DI-05 | Module type immutability has NO database trigger | Medium | UI-only enforcement via hidden type selector in edit mode. Direct API calls can change `module_type`, causing subtable inconsistency. **Migration recommended**: add `protect_module_type_immutability()` BEFORE UPDATE trigger. |
| DI-07 | Storage file orphans accumulate on delete | Low | FK cascade deletes only remove DB rows. Files in the `course-files` Supabase Storage bucket are not cleaned up, consuming quota over time. No cleanup mechanism exists. |
| DI-09 | Sort order swap is non-atomic (2 sequential UPDATEs) | Low | Partial failure (first UPDATE succeeds, second fails) leaves duplicate `sort_order` values. No UNIQUE constraint prevents this at the DB level. UI handles duplicates gracefully but order is undefined. **Future fix**: wrap in PL/pgSQL RPC transaction. |
| DI-08 | Enrollment UI not yet built | Info | Password-protected enrollment can only be tested via `enroll_with_password()` RPC calls in the browser console. Enrollment UI is planned for Phase 4A. |

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|------------------|------|------|-------|
| — | — | — | — | — | — |

---

## References

| Document | Purpose |
|----------|---------|
| `docs/e2e-user-stories/TEST_USERS.md` | Test user accounts, passwords, setup instructions |
| `docs/e2e-user-stories/CONTENT_WRITE_USER_STORIES.md` | Content write stories (companion tests, format reference) |
| `supabase/migrations/00002*.sql` | Base schema: FK constraints, cascade delete definitions |
| `supabase/migrations/00005*.sql` | Module constraints: `enforce_module_course_consistency()` trigger |
| `supabase/migrations/00009*.sql` | RPC functions: `enroll_with_password()`, `grade_quiz_attempt()` |
| `supabase/migrations/00019*.sql` | Course CRUD triggers: `hash_course_password()`, `set_course_audit_fields()` |
| `supabase/migrations/00020*.sql` | Lecture CRUD trigger: `set_lecture_audit_fields()` |
| `supabase/migrations/00021*.sql` | Module CRUD trigger: `set_module_audit_fields()` |
| `frontend/src/app/core/services/course.service.ts` | CourseService — CRUD methods, sort order swap, module content helpers |
| `frontend/src/app/features/courses/pages/module-form-page.component.ts` | Module form page — type selector visibility, edit mode behavior |
