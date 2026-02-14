# Phase 10A Audit: Toast System, Error Handling, Security & Architecture

Audit date: 2026-02-14. Based on 5 parallel deep-dive agents across ~60 files.

---

## 1. Bugs to Fix (High Priority)

### TODO: Fix POST retry in HTTP interceptor (duplicate emails)
- **File:** `core/interceptors/http-error.interceptor.ts`
- **Problem:** Interceptor retries ALL 5xx requests including POST. If `POST /api/invite` or `POST /api/reminders/send` gets a 502 (e.g. Railway cold start), it retries and sends the email twice.
- **Fix:** Only retry idempotent methods:
  ```typescript
  if (req.method !== 'GET' && req.method !== 'HEAD') return throwError(() => error);
  ```
- **Affected endpoints:** `/api/invite`, `/api/reminders/send`, `/api/auth/reset-password`

### TODO: Fix double-toast in UserManagementService.inviteUser()
- **File:** `core/services/user-management.service.ts` + `features/admin/pages/user-management-page.component.ts`
- **Problem:** `inviteUser()` calls `ApiService.post()` (HttpClient). On 5xx/403/429, the interceptor toasts a generic error. Then `firstValueFrom` re-throws. Then the page component catches and calls `toast.error(message)`. User sees **two toasts**.
- **Fix options:**
  - (a) In the page catch block, check `if (err instanceof HttpErrorResponse && [403, 429, 500, 502, 503].includes(err.status)) return;` — skip caller toast for interceptor-covered codes
  - (b) Or: have the interceptor mark the error as "already toasted" via a custom property
- **Same risk in:** `AccessRequestService.approveAndInvite()`, `ProgressService.sendReminders()`, `BunnyUploadService.initAndUpload()`

### TODO: Add .catch() to getSession() in AuthService
- **File:** `core/services/auth.service.ts:52`
- **Problem:** If `getSession()` rejects (IndexedDB corruption, storage quota), `#loading` stays `true` forever. Guards wait for `loading === false` — user gets infinite spinner with no recovery.
- **Fix:**
  ```typescript
  this.#supabase.client.auth.getSession()
    .then(({ data: { session } }) => { ... })
    .catch(() => { this.#currentUser.set(null); this.#loading.set(false); });
  ```

---

## 2. Error Handling Consistency

### TODO: Adopt extractErrorMessage everywhere (4 manual patterns found)

**Current state:** 4 different error extraction patterns instead of the one shared utility.

| Pattern | Where | Fix |
|---------|-------|-----|
| `extractErrorMessage()` (shared) | course.service, 4 admin services (load methods only) | Already correct |
| Full manual ternary | progress.service, exam-grading.service, expert-question.service.loadBoard, issue.service.loadBoard | Replace with `extractErrorMessage` |
| Partial manual with optional chaining | comment.service, expert-question.service.loadMy, issue.service.loadMy, notification.service | Replace with `extractErrorMessage` |
| Custom `err?.error?.detail` | bunny-upload.service | Keep (FastAPI detail structure is different) |

### TODO: Add fallback messages to 8 throw-without-fallback methods
- **Problem:** `throw new Error(error.message)` without fallback. If `.message` is empty, user sees blank toast.
- **Files:**
  - `comment.service.ts`: `addComment`, `updateComment`, `deleteComment`, `addReply`, `updateReply`, `deleteReply` (6 methods)
  - `expert-question.service.ts`: `askQuestion` (1 method)
  - `issue.service.ts`: `reportIssue` (1 method)
- **Fix:** Change all to `throw new Error(extractErrorMessage(error, 'Descriptive fallback'))`

### TODO: Complete extractErrorMessage adoption in migrated services
- **Problem:** The 4 admin services (`tenant-management`, `user-management`, `access-request`, `lecturer-assignment`) import `extractErrorMessage` but only use it in load methods. All mutation methods still use raw `error.message || 'fallback'`.
- **Scope:** ~20 mutation methods across 4 services

### TODO: Fix ProfileService silent error
- **File:** `core/services/profile.service.ts`
- **Problem:** `#fetchProfile` discards the `error` field from Supabase response. A network error or RLS denial silently results in `profile = null`, indistinguishable from "user has no profile".
- **Fix:** Check for `error`, add error signal or at minimum `console.error`

---

## 3. Toast Migration: 13 Components Remaining

Convention: **Load errors stay inline. Action success/error use toast.**

### Page Components (8)

#### TODO: Migrate CourseFormPageComponent
- **File:** `features/courses/pages/course-form-page.component.ts`
- **Actions:** `onSave`, `onDelete`, `onAssignTenant`, `onUnassignTenant`
- **Note:** Shared `errorMessage` signal used for BOTH load and action errors. Split: keep load error inline, action errors via toast. Success: `onSave`/`onDelete` navigate away (optional brief toast). `onAssignTenant`/`onUnassignTenant` need success toast.

#### TODO: Migrate CourseDetailPageComponent
- **File:** `features/courses/pages/course-detail-page.component.ts`
- **Actions:** `onSaveLecture`, `onDeleteLecture`, `onMoveLecture`, `onDeleteModule`, `onMoveModule`, `onDelete` (course)
- **Note:** `lectureError` signal for inline banner. No success feedback at all currently. Course delete error silently swallowed (line 462-463) — add error toast.

#### TODO: Migrate ModuleFormPageComponent
- **File:** `features/courses/pages/module-form-page.component.ts`
- **Actions:** `onSave`
- **Note:** Shared `errorMessage` for load+action. Split. Navigates away on success.

#### TODO: Migrate ExamGradingPageComponent
- **File:** `features/teaching/pages/exam-grading-page.component.ts`
- **Actions:** `onGradeSubmission`, `onConfirmReset`
- **Note:** `gradeError` signal inside expanded row. No success feedback. Add success toast for grade/reset.

#### TODO: Migrate QuestionsBoardPageComponent
- **File:** `features/teaching/pages/questions-board-page.component.ts`
- **Actions:** `onRespondToQuestion`, `onCloseQuestion`
- **Note:** `responseError` signal inside expanded row. Add success toast.

#### TODO: Migrate IssueManagementPageComponent
- **File:** `features/teaching/pages/issue-management-page.component.ts`
- **Actions:** `onSaveIssue`
- **Note:** `saveError` signal inside expanded row. Add success toast.

#### TODO: Migrate AccessRequestPageComponent
- **File:** `features/admin/pages/access-request-page.component.ts`
- **Actions:** `onApprove`, `onReject`
- **Note:** Has BOTH `reviewSuccess` AND `reviewError` signals. Replace both with toast. Double-toast risk with `/api/invite` (see Bug #2).

#### TODO: Migrate ProgressDashboardPageComponent
- **File:** `features/analytics/pages/progress-dashboard-page.component.ts`
- **Actions:** `onSendReminders`
- **Note:** Has `reminderResult` (sent/failed counts) + `reminderError`. Both → toast. Double-toast risk with `/api/reminders/send` (see Bug #2).

### Interactive Components (5)

#### TODO: Migrate CommentSectionComponent
- **File:** `features/courses/components/comment-section.component.ts`
- **Actions:** `onAddComment`, `onSubmitReply`, `onSaveEditComment`, `onSaveEditReply`, `onDeleteComment`, `onDeleteReply` (6 methods)
- **Note:** `actionError` signal. High-frequency interaction — toast is appropriate. No success toast needed (list refreshes visually).

#### TODO: Migrate AskExpertComponent (error only)
- **File:** `features/courses/components/ask-expert.component.ts`
- **Actions:** `onSubmit` (error path only)
- **Note:** `submitted` signal replaces form with success card + "Ask another" button. **Keep `submitted` state** (UX state change). Only migrate `actionError` to toast.

#### TODO: Migrate ReportIssueComponent (error only)
- **File:** `features/courses/components/report-issue.component.ts`
- **Actions:** `onSubmit` (error path only)
- **Note:** Same pattern as AskExpert. **Keep `submitted` state.** Only migrate `actionError` to toast.

#### TODO: Migrate EnrollmentManagerComponent
- **File:** `features/courses/components/enrollment-manager.component.ts`
- **Actions:** `onAddUser`, `onUnenroll`
- **Note:** `addError` signal shared for load+action+validation. Validation errors ("Please enter an email") could stay inline. Backend errors → toast. Add success toast for enroll/unenroll.

#### TODO: Migrate ProgressManagerComponent
- **File:** `features/courses/components/progress-manager.component.ts`
- **Actions:** `onMarkComplete`, `onReset`
- **Note:** Shared `error` signal for load+action. Split. Add success toast.

---

## 4. Security Findings

### TODO: Add role guards to stub catch-all routes
- **File:** `app.routes.ts`
- **Problem:** `teaching/:path`, `admin/:path`, `csm/:path`, `platform/:path` stub routes are accessible to ALL authenticated users. While they only show placeholder pages, they reveal section existence to learners.
- **Fix:** Add `canActivate: [roleGuard(...)]` to each stub route now, before replacing with real components.

### INFO: No critical security issues found
- 0 CRITICAL, 0 HIGH findings
- JWT decoding is fail-safe (try/catch -> DEFAULT_CLAIMS, strict `=== true` comparison)
- `returnUrl` safe — Angular Router can't navigate to external URLs
- Toast messages via `{{ }}` interpolation — no XSS
- Client-side roles purely cosmetic — RLS handles real security
- `bypassSecurityTrustResourceUrl` on video/PDF: only writable by admin/lecturers, `<iframe>` doesn't execute `javascript:` URLs

### INFO: Minor security notes (no action needed)
- `#signOutInitiated` flag has theoretical race condition (double-click signout) — worst case is unnecessary "session expired" toast
- `atob()` doesn't handle URL-safe base64 — Supabase uses standard base64, fail-safe if it ever changes
- No client-side rate limiting on login — server-side rate limiting exists (Supabase + FastAPI 10/min/IP)
- Using `canActivate` instead of `canMatch` for role routes — chunks download before guard rejects (no data leak, just wasted bandwidth)

---

## 5. Code Duplication

### TODO: Extract formatDate() and formatRelativeTime() into date.utils.ts
- **`formatDate()`** — identical in 7 components (~10 lines each):
  - `user-management-page`, `access-request-page`, `lecturer-assignment-page`, `enrollment-manager`, `quiz-taker`, `exam-taker`, `exam-grading-page`
- **`formatRelativeTime()`** — identical in 6 components (~15 lines each):
  - `my-questions-page`, `notification-list-page`, `my-issues-page`, `questions-board-page`, `issue-management-page`, `comment-section`
- **Target file:** `core/utils/date.utils.ts` (pattern: same as existing `core/utils/error.utils.ts`)
- **Savings:** ~160 lines removed

### TODO: Consider SummaryCard shared component
- **Pattern:** 4-card stats grid duplicated in 7 board pages (~18 lines each):
  - `tenant-management-page`, `user-management-page`, `access-request-page`, `lecturer-assignment-page`, `questions-board-page`, `issue-management-page`, `exam-grading-page`
- **Potential component:** `SummaryCardComponent` with inputs: `label`, `value`, `colorClass`
- **Savings:** ~90 lines of template duplication
- **Note:** Per CLAUDE.md "no unnecessary abstractions" — this is borderline. The cards are simple enough that copy-paste is acceptable. Consider only if touching these templates anyway.

### TODO: Move loadAvailableTenants() out of page components
- **Problem:** 2 components directly query Supabase (rule violation per CLAUDE.md):
  - `user-management-page.component.ts:527`
  - `access-request-page.component.ts:429`
- **Both do:** `this.#supabaseService.client.from('tenants').select('id, name').order('name')`
- **Fix:** Move to `TenantManagementService` or a shared `TenantService` method

---

## 6. Architecture Quality

### Grade: A- overall

| Area | Grade | Notes |
|------|-------|-------|
| Signals in services | A+ | 100% signal-based, zero BehaviorSubjects |
| OnPush change detection | A+ | 57/57 components |
| `inject()` pattern | A+ | Zero constructor DI |
| `@if`/`@for` syntax | A+ | Zero legacy directives |
| No barrel files | A+ | Zero `index.ts` |
| Toast/Notification separation | A+ | Zero overlap, complementary systems |
| Toast design centralization | A+ | One file controls all toast styling |
| Error handling consistency | B- | 4 different patterns, 8 missing fallbacks |
| Code duplication | B- | formatDate in 7 files, formatRelativeTime in 6 |
| Direct Supabase in components | B | 2 violations |
| CourseService size | B- | 1575 lines — god service candidate |

### INFO: Minor inconsistencies (no action needed)
- `ApiService` uses TS `private` instead of `#private` fields
- Some services expose as `service`, others as `questionService`/`issueService`
- `LecturerAssignmentPage` missing `readonly` on `#auth` and `#toast`
- `file-upload.component.ts` uses `@ViewChild` decorator instead of `viewChild()`
- `quiz-form.component.ts` injects `ChangeDetectorRef` (smell in signals codebase)
- `NotificationService.#latestToast` naming could confuse with `ToastService` — consider renaming to `#latestPopup`

---

## Summary: Priority Action Items

| # | Priority | Task | Scope |
|---|----------|------|-------|
| 1 | **HIGH** | Fix POST retry in interceptor | 1 file, ~3 lines |
| 2 | **HIGH** | Fix double-toast for HttpClient errors | 4 caller sites |
| 3 | **HIGH** | Add .catch() to getSession() | 1 file, ~3 lines |
| 4 | **MEDIUM** | Extract date.utils.ts (formatDate + formatRelativeTime) | 13 files |
| 5 | **MEDIUM** | Adopt extractErrorMessage everywhere | ~12 service files, ~30 catch blocks |
| 6 | **MEDIUM** | Add fallback messages to 8 throw sites | 3 service files |
| 7 | **MEDIUM** | Fix ProfileService silent error | 1 file |
| 8 | **MEDIUM** | Migrate 13 components to toast | 13 component files + specs |
| 9 | **LOW** | Add role guards to stub routes | 1 file (app.routes.ts) |
| 10 | **LOW** | Move loadAvailableTenants to service | 2 component files + 1 service |
| 11 | **LOW** | Consider SummaryCard component | 7 board pages |
