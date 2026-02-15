# X-Courses v2 - Development Approach

---

## 1. Overview

This document describes the development approach for building X-Courses v2 (Multi-Tenant Learning Platform). It is designed to be used alongside `learning-platform-requirements.md` and `supabase/migrations/00001-00038` as context for LLM-assisted development.

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Schema-First** | Database schema is defined completely before any feature work |
| **Isolated Features** | Each feature is self-contained. Changes to one feature don't affect others |
| **Desktop-First** | UI optimized for desktop, but must work on mobile/tablet |
| **Real Auth First** | Multi-provider auth (Keycloak SSO + email/password + magic link) with per-tenant configuration. Invite-only (no public registration) |
| **Incremental Validation** | Each step is tested and validated before moving to the next |
| **CRUD via Supabase** | All basic CRUD operations go directly from Angular to Supabase |
| **Complex Logic via FastAPI** | Invitations, reminders, external quiz webhooks go through FastAPI |
| **Multi-Tenant Isolation** | Every query respects tenant boundaries via RLS + JWT custom claims |

### 1.2 Technology Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| **Database** | Supabase PostgreSQL + RLS (~242 policies) | Supabase Cloud |
| **Auth** | Supabase Auth (Keycloak SSO for Calypso + onboarded clients, email/password + magic link per-tenant) | Supabase Cloud |
| **Storage** | Supabase Storage (PDFs, files, avatars, exam submissions) | Supabase Cloud |
| **Realtime** | Supabase Realtime (notifications) | Supabase Cloud |
| **Scheduled Jobs** | pg_cron (exam deadlines, content staleness) | Supabase Cloud |
| **Frontend** | Angular 19 + Tailwind CSS v3 + Lucide Icons | Vercel |
| **Backend API** | FastAPI (Python 3.11+) | Railway |
| **Video** | Bunny Stream (TUS resumable upload, iframe embed with token auth, encoding webhook) | Bunny CDN |
| **Email** | Calypso SMTP (direct SMTP, not Resend) | Calypso Infrastructure |
| **SSO** | Keycloak SSO (via `calypso-xcourses` client in "customers" realm) for Calypso + onboarded client tenants | Keycloak |
| **Source Control** | GitHub (monorepo) | GitHub |
| **CI/CD** | Vercel + Railway auto-deploy from `main` branch | Vercel / Railway |

### 1.3 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER (Browser)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Angular Frontend (Vercel)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Auth UI   │  │   Courses   │  │  Progress   │  │  Admin / Settings   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                                    │
          │ CRUD, Auth, Storage,                               │ Invites, Reminders,
          │ Realtime                                           │ External Quiz Webhook
          ▼                                                    ▼
┌─────────────────────────────────────┐    ┌───────────────────────────────────┐
│      Supabase Cloud                 │    │        FastAPI (Railway)          │
│  ┌───────────┐  ┌───────────┐       │    │                                   │
│  │ PostgreSQL│  │  Storage  │       │    │  GET  /api/health                 │
│  │ + RLS     │  │ (PDFs,    │       │    │  POST /api/auth/resolve-tenant    │
│  │ + Triggers│  │  exams,   │       │    │  POST /api/auth/reset-password    │
│  └───────────┘  │  avatars) │       │    │  POST /api/invite                 │
│  ┌───────────┐  └───────────┘       │    │                                   │
│  │   Auth    │  ┌───────────┐       │    └───────────────────────────────────┘
│  │(Keycloak+ │  │ Realtime  │       │                    │
│  │  email +  │  │ (notifs)  │       │                    │
│  │  magic)   │  └───────────┘       │                    │
│  └───────────┘                      │                    ▼
│  ┌───────────┐                      │              ┌──────────┐
│  │ pg_cron   │                      │              │ Calypso  │
│  │ (deadlines│                      │              │  SMTP    │
│  │  staleness│                      │              └──────────┘
│  └───────────┘                      │
└─────────────────────────────────────┘
          ▲
          │
    ┌──────────┐
    │ Bunny CDN│  (Video streaming — TUS upload via FastAPI init, iframe embed with token auth)
    └──────────┘
```

**Key Principles:**
- **Angular → Supabase directly** for all CRUD operations, auth, storage uploads, and Realtime subscriptions
- **Angular → FastAPI** for:
  - Tenant resolution (email → tenant + auth methods + IdP hint)
  - Password reset proxy (validates tenant allows email_password)
  - User invitations (sends invite via `supabase.auth.admin.invite_user_by_email()`)
  - Reminder emails (sends via Calypso SMTP + logs to `reminder_history`)
  - External quiz results webhook (receives from external quiz platform)
  - Bunny Stream video upload init + embed URL signing + encoding webhook
- **Notifications** are created automatically via PostgreSQL triggers (SECURITY DEFINER)
- **Videos** are hosted on Bunny Stream — uploaded via TUS (browser → Bunny directly), embedded via token-signed iframe URLs. FastAPI handles upload init, embed signing, and encoding webhooks
- **Deployment** is git-based: push to `main` on GitHub → Vercel auto-deploys `frontend/`, Railway auto-deploys `backend/`

---

## 2. Project Structure

```
x-courses-v2/                                  # GitHub monorepo (main branch → auto-deploy)
├── docs/
│   ├── learning-platform-requirements.md
│   ├── x_courses_development_approach.md    # This document
│   └── e2e-user-stories/               # E2E test stories (54 content + 6 Bunny + 16 quiz + 11 enrollment + 11 progress + 12 dashboard + 14 comments + 12 questions + 12 issue-mgmt + 12 notifications + 10 tenant-mgmt + 12 user-mgmt + 11 access-requests = 193 total)
│
├── supabase/
│   └── migrations/
│       └── 00001-00037                     # Complete schema (30 tables, ~242 RLS policies, auth hooks, security hardening, Keycloak SSO, course+lecture+module CRUD triggers, Bunny Stream support, module immutable fields, external_quiz enum, progress tracking triggers, reminder_history lecturer SELECT fix, quiz grading bypass, matching question RPC, external quiz auto-mark, comment badge triggers, profiles_select_tenant policy, notifications Realtime, access_requests domain→tenant_id trigger, staleness postpone, performance indexes, avatars bucket private)
│
├── backend/                                # FastAPI app (Railway)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py                      # Pydantic BaseSettings
│   │   ├── dependencies.py               # get_supabase(), get_current_user()
│   │   │
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── health.py                 # GET /api/health
│   │   │   ├── auth.py                   # POST /api/auth/resolve-tenant (10/min), POST /api/auth/reset-password (5/min)
│   │   │   ├── video.py                 # POST /api/video/init-upload, GET /api/video/{id}/status, POST /api/video/webhook, DELETE /api/video/{id}
│   │   │   ├── reminder.py              # POST /api/reminders/send (PA/TA/CSM/Lecturer auth, sends email + inserts reminder_history)
│   │   │   ├── quiz_results.py            # POST /api/quiz-results/external (external quiz webhook, API key auth)
│   │   │   ├── invite.py                  # ✅ POST /api/invite (PA/TA auth, supabase.auth.admin.invite_user_by_email + tenant validation + duplicate check) (Phase 9B)
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── supabase.py               # Supabase Python client (service role)
│   │   │   ├── tenant.py                 # Tenant resolution (email domain → tenant + auth methods + idp_hint)
│   │   │   ├── email.py                  # Calypso SMTP client
│   │   │   ├── auth.py                   # JWT verification (ES256 JWKS + HS256 fallback)
│   │   │   └── bunny.py                  # Bunny Stream API client (create video, TUS signature, embed token, status, delete)
│   │   │
│   │   └── models/
│   │       ├── __init__.py
│   │       └── schemas.py                # Pydantic request/response models
│   │
│   ├── tests/
│   │   └── ...
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                               # Angular app (Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── __mocks__/                # Test mocks (15 factories + bunny-upload mock via inline provider)
│   │   │   │   ├── supabase.mock.ts      # Multi-tenant aware mock with JWT claims
│   │   │   │   ├── auth.mock.ts          # Session mock with role switching
│   │   │   │   ├── api.mock.ts           # FastAPI client mock
│   │   │   │   ├── toast.mock.ts
│   │   │   │   ├── router.mock.ts
│   │   │   │   ├── lucide.mock.ts
│   │   │   │   ├── tenant.mock.ts
│   │   │   │   ├── profile.mock.ts
│   │   │   │   ├── course.mock.ts        # CourseService + ProgressService + CommentService + ExpertQuestionService + IssueService + NotificationService + TenantManagementService + UserManagementService + AccessRequestService + CourseWithProgress + CourseDetail + ModuleViewerData + LectureFormData + PdfFormData + ExamFormData + MarkdownFormData + ExternalQuizContent/FormData + EnrolledUser + UserProgressSummary + DashboardUserProgress + QuizForTaking + QuizAttemptResult + Comment/CommentReply + ExpertQuestion + Issue/IssueForBoard + Notification + TenantForBoard/CsmAssignment + UserForBoard + AccessRequestForBoard factories
│   │   │   │   └── tiptap.mock.ts        # MockTiptapEditorComponent (textarea fallback for tests)
│   │   │   │
│   │   │   ├── core/
│   │   │   │   ├── services/
│   │   │   │   │   ├── supabase.service.ts
│   │   │   │   │   ├── auth.service.ts    # Keycloak SSO + email/password + magic link OTP (per-tenant)
│   │   │   │   │   ├── api.service.ts     # FastAPI client (HttpClient wrapper with JWT headers, get/post/delete)
│   │   │   │   │   ├── tenant.service.ts  # Resolve email → tenant + auth methods + idp_hint (caches per email)
│   │   │   │   │   ├── profile.service.ts # Fetch profile (full_name, avatar_url) via effect()
│   │   │   │   │   ├── course.service.ts  # ✅ loadCourseList, loadCourseDetail, loadModuleViewer, markModuleComplete, CRUD (course+lecture+module incl. video/pdf/exam/markdown/external_quiz), module_files CRUD, Bunny video cleanup on delete, enrollment (enroll/unenroll/adminEnroll/loadEnrolled/lookupUser), progress admin (loadCourseProgressAdmin/adminMarkModuleComplete/adminResetModuleProgress), quiz taking (loadQuizForTaking/startQuizAttempt/submitQuizAttempt/getQuizAttemptResults), exam taking (loadExamForTaking/submitExamSubmission)
│   │   │   │   │   ├── bunny-upload.service.ts  # ✅ BunnyUploadService (TUS upload via tus-js-client, progress signals, pollStatus, deleteVideo)
│   │   │   │   │   ├── progress.service.ts       # ✅ ProgressService (4 parallel queries + client-side aggregation, sendReminders via ApiService)
│   │   │   │   │   ├── progress.service.spec.ts
│   │   │   │   │   ├── comment.service.ts        # ✅ CommentService (7 methods: load/add/update/delete comments + replies, signal state, nested Supabase select with author joins)
│   │   │   │   │   ├── comment.service.spec.ts
│   │   │   │   │   ├── expert-question.service.ts   # ✅ ExpertQuestionService (2+3 methods: learner loadMyQuestions/askQuestion + board loadBoardQuestions/respondToQuestion/closeQuestion — dual-signal state) (Phase 6B+6C)
│   │   │   │   │   ├── expert-question.service.spec.ts
│   │   │   │   │   ├── issue.service.ts             # ✅ IssueService (2+2 methods: learner loadMyIssues/reportIssue + board loadBoardIssues/updateIssue — dual-signal, dual-table: issues_safe view for learner, base issues for board) (Phase 7A+7B)
│   │   │   │   │   ├── issue.service.spec.ts
│   │   │   │   │   ├── notification.service.ts      # ✅ NotificationService (Realtime subscription via effect(), loadNotifications, markAsRead, markAllAsRead, latestToast, unreadCount computed) (Phase 8A)
│   │   │   │   │   ├── notification.service.spec.ts
│   │   │   │   │   ├── tenant-management.service.ts # ✅ TenantManagementService (3 signals + 12 methods: CRUD tenants, course assignments, CSM assignments) (Phase 9A)
│   │   │   │   │   ├── tenant-management.service.spec.ts
│   │   │   │   │   ├── user-management.service.ts  # ✅ UserManagementService (3 signals + 5 methods: loadUsers, inviteUser via ApiService, updateUserRoles, updateUserProfile, removeUserAdminRole) (Phase 9B)
│   │   │   │   │   ├── user-management.service.spec.ts
│   │   │   │   │   ├── access-request.service.ts   # ✅ AccessRequestService (3 signals + 3 methods: loadRequests with FK joins, reviewRequest, approveAndInvite two-step) (Phase 9C)
│   │   │   │   │   ├── access-request.service.spec.ts
│   │   │   │   │   ├── lecturer-assignment.service.ts # ✅ LecturerAssignmentService (3 signals + 6 methods: loadAssignments triple FK join, addAssignment, removeAssignment, updatePermissions, loadAvailableLecturers, loadAvailableCourses two-query Set filter) (Phase 9E)
│   │   │   │   │   ├── lecturer-assignment.service.spec.ts
│   │   │   │   │   └── course.service.spec.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── auth.guard.ts
│   │   │   │   │   └── role.guard.ts      # 5-role guard (learner, tenant_admin, platform_admin, csm, lecturer)
│   │   │   │   └── models/
│   │   │   │       ├── auth.model.ts      # AppUser, JwtClaims, UserRole
│   │   │   │       ├── course.model.ts    # ✅ CourseWithProgress, CourseDetail, ModuleViewerData, CourseFormData, LectureFormData, VideoFormData, PdfFormData, ExamFormData, MarkdownFormData, ExternalQuizContent, ExternalQuizFormData, ExamContent, ModuleSavePayload, EnrolledUser, MarkedByType, UserProgressRecord, UserProgressSummary, DashboardUserProgress, DashboardCourseProgress, DashboardCourseSummary, ReminderRequest, ReminderResponse, QuizForTaking, QuizQuestionForTaking, QuizQuestionOptionForTaking, QuizAttemptAnswer, QuizAttemptResult, QuizQuestionResult, union types
│   │   │   │       ├── comment.model.ts   # ✅ Comment, CommentReply, CommentAuthor, BadgeType
│   │   │   │       ├── expert-question.model.ts  # ✅ ExpertQuestion, ExpertQuestionStatus, ExpertQuestionForBoard, QuestionAsker, BoardCourseSummary (Phase 6B+6C)
│   │   │   │       ├── issue.model.ts            # ✅ Issue, IssueType, IssueStatus, IssueForBoard, IssueReporter, BoardIssueSummary (Phase 7A+7B)
│   │   │   │       ├── notification.model.ts    # ✅ AppNotification, NotificationType (15), NOTIFICATION_META map, getNotificationMeta(), getNotificationRoute() (Phase 8A)
│   │   │   │       ├── tenant-management.model.ts # ✅ TenantForBoard, TenantSettings, TenantCourseAssignment, CsmAssignment, AvailableCourse, AvailableCsm, TenantFormData (Phase 9A)
│   │   │   │       ├── user-management.model.ts   # ✅ UserForBoard, InviteUserData, UpdateUserRolesData, UpdateUserProfileData (Phase 9B)
│   │   │   │       ├── access-request.model.ts    # ✅ AccessRequestForBoard, AccessRequestStatus, ReviewAccessRequestData (Phase 9C)
│   │   │   │       ├── lecturer-assignment.model.ts # ✅ LecturerAssignment, AvailableLecturer, AvailableCourse, UpdatePermissionsData (Phase 9E)
│   │   │   │       ├── profile.model.ts
│   │   │   │       └── tenant.model.ts
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── sidebar/
│   │   │   │   │   ├── sidebar.component.ts        # Role-aware nav, mobile overlay, desktop static
│   │   │   │   │   ├── sidebar.component.spec.ts
│   │   │   │   │   └── sidebar-nav.config.ts       # 6 sections, 17 items, filterNavSections()
│   │   │   │   ├── header/
│   │   │   │   │   ├── header.component.ts          # Hamburger, notification bell (Realtime unread count badge, rose-500 pill, 99+ cap), user menu dropdown
│   │   │   │   │   └── header.component.spec.ts
│   │   │   │   └── main-layout/
│   │   │   │       ├── main-layout.component.ts     # Shell: sidebar + header + <router-outlet> + toast overlay (fixed top-right, Realtime notifications)
│   │   │   │       └── main-layout.component.spec.ts
│   │   │   │
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login/            # Tenant-aware: Keycloak SSO + email/password + magic link (3-step OTP)
│   │   │   │   │   ├── callback/         # Auth callback (handles invite links + SSO redirects)
│   │   │   │   │   ├── reset-password/   # Password reset (pre-populates email from query param)
│   │   │   │   │   └── access-request/   # Request access page
│   │   │   │   │
│   │   │   │   ├── dashboard/             # Dashboard page
│   │   │   │   │
│   │   │   │   ├── courses/               # ✅ Phase 2A + 2B + 3A + 3B + 3C-1 + 3C-2 + 3C-3 + 3C-4 + 3D + 3E + 4A + 4B + 4C + 5A + 5C + 6A + 6B + 7A complete
│   │   │   │   │   ├── pages/
│   │   │   │   │   │   ├── course-list-page.component.ts    # Smart: injects CourseService, grid of CourseCards
│   │   │   │   │   │   ├── course-list-page.component.spec.ts
│   │   │   │   │   │   ├── course-detail-page.component.ts  # Smart: course detail + lecture CRUD orchestration (inline editing) + enrollment CTA + enrollment manager + progress manager
│   │   │   │   │   │   ├── course-detail-page.component.spec.ts
│   │   │   │   │   │   ├── course-form-page.component.ts    # Smart: create/edit course, tenant assignment, delete (Phase 3A)
│   │   │   │   │   │   ├── course-form-page.component.spec.ts
│   │   │   │   │   │   ├── module-form-page.component.ts    # Smart: create/edit module, type selector (6 types), video/pdf/exam/markdown/quiz/external_quiz forms + module files editor + significant update checkbox (Phase 3C-4B)
│   │   │   │   │   │   ├── module-form-page.component.spec.ts
│   │   │   │   │   │   ├── module-viewer-page.component.ts  # Smart: video/pdf/markdown/external_quiz/quiz/exam viewer, prev/next nav, mark-complete (gated by enrollment), quiz taker + exam taker + ask expert + comment section integration
│   │   │   │   │   │   └── module-viewer-page.component.spec.ts
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── course-card.component.ts          # Presentational: progress bar, action button, badge
│   │   │   │   │   │   ├── course-card.component.spec.ts
│   │   │   │   │   │   ├── lecture-accordion.component.ts    # Presentational: collapsible, module list, X/Y count, edit/delete/reorder buttons
│   │   │   │   │   │   ├── lecture-accordion.component.spec.ts
│   │   │   │   │   │   ├── lecture-form.component.ts         # Presentational: inline lecture create/edit form (title + description)
│   │   │   │   │   │   ├── lecture-form.component.spec.ts
│   │   │   │   │   │   ├── module-item.component.ts          # Presentational: type icon, status badge, RouterLink for video/pdf/markdown/external_quiz/quiz
│   │   │   │   │   │   ├── module-item.component.spec.ts
│   │   │   │   │   │   ├── video-viewer.component.ts         # Smart-lite: Bunny iframe embed with token-signed URLs, 3 encoding states (processing/ready/failed), polling
│   │   │   │   │   │   ├── video-viewer.component.spec.ts
│   │   │   │   │   │   ├── pdf-viewer.component.ts           # Presentational: <iframe> + DomSanitizer + download link
│   │   │   │   │   │   ├── pdf-viewer.component.spec.ts
│   │   │   │   │   │   ├── markdown-viewer.component.ts      # Presentational: ngx-markdown with prose styling
│   │   │   │   │   │   ├── markdown-viewer.component.spec.ts
│   │   │   │   │   │   ├── course-form.component.ts          # Presentational: course create/edit form (Phase 3A)
│   │   │   │   │   │   ├── course-form.component.spec.ts
│   │   │   │   │   │   ├── tenant-assignment.component.ts    # Presentational: assign courses to tenants (Phase 3A)
│   │   │   │   │   │   ├── tenant-assignment.component.spec.ts
│   │   │   │   │   │   ├── video-form.component.ts           # Presentational: video module form (title + desc + TUS file upload + progress bar) (Phase 3C-4)
│   │   │   │   │   │   ├── video-form.component.spec.ts
│   │   │   │   │   │   ├── pdf-form.component.ts             # Presentational: PDF module form (title + desc + file upload + page_count) (Phase 3C-2)
│   │   │   │   │   │   ├── pdf-form.component.spec.ts
│   │   │   │   │   │   ├── exam-form.component.ts            # Presentational: exam module form (settings + constraints + exam file upload) (Phase 3C-2)
│   │   │   │   │   │   ├── exam-form.component.spec.ts
│   │   │   │   │   │   ├── markdown-form.component.ts       # Presentational: markdown module form (title + desc + Tiptap WYSIWYG editor) (Phase 3C-3)
│   │   │   │   │   │   ├── markdown-form.component.spec.ts
│   │   │   │   │   │   ├── module-files-editor.component.ts  # Smart-lite: file attachment upload/delete for modules (edit mode only) (Phase 3C-3)
│   │   │   │   │   │   ├── module-files-editor.component.spec.ts
│   │   │   │   │   │   ├── module-files-list.component.ts    # Presentational: downloadable files with human-readable sizes
│   │   │   │   │   │   ├── module-files-list.component.spec.ts
│   │   │   │   │   │   ├── quiz-form.component.ts            # Presentational: quiz builder — 6 question types, inline CRUD, JSON import/export (Phase 3D)
│   │   │   │   │   │   ├── quiz-form.component.spec.ts
│   │   │   │   │   │   ├── external-quiz-form.component.ts   # Presentational: external quiz form — quiz_id, quiz_url, passing_score (Phase 3E)
│   │   │   │   │   │   ├── external-quiz-form.component.spec.ts
│   │   │   │   │   │   ├── external-quiz-viewer.component.ts  # Presentational: info card + "Take External Quiz" button (Phase 3E)
│   │   │   │   │   │   ├── external-quiz-viewer.component.spec.ts
│   │   │   │   │   │   ├── enrollment-cta.component.ts        # Presentational: 3 enrollment states (open/password/invite) + enrolled badge (Phase 4A)
│   │   │   │   │   │   ├── enrollment-cta.component.spec.ts
│   │   │   │   │   │   ├── enrollment-manager.component.ts    # Smart-lite: admin enrollment panel — enrolled users table, add by email, unenroll (Phase 4A)
│   │   │   │   │   │   ├── enrollment-manager.component.spec.ts
│   │   │   │   │   │   ├── progress-manager.component.ts      # Smart-lite: admin progress panel — user progress accordion, mark complete/reset per module (Phase 4B)
│   │   │   │   │   │   ├── progress-manager.component.spec.ts
│   │   │   │   │   │   ├── quiz-question.component.ts          # Presentational: renders 6 question types (single_choice, multiple_choice, true_false, fill_blank, short_answer, matching) (Phase 5A)
│   │   │   │   │   │   ├── quiz-question.component.spec.ts
│   │   │   │   │   │   ├── quiz-result-item.component.ts       # Presentational: per-question results after grading (Phase 5A)
│   │   │   │   │   │   ├── quiz-result-item.component.spec.ts
│   │   │   │   │   │   ├── quiz-taker.component.ts             # Smart-lite: 3-phase quiz flow (start → active → results), timer, answer management, auto-submit (Phase 5A)
│   │   │   │   │   │   ├── quiz-taker.component.spec.ts
│   │   │   │   │   │   ├── exam-taker.component.ts             # Smart-lite: 3-phase exam flow (info → active → submitted), timer (informational), file upload, grading status (Phase 5C)
│   │   │   │   │   │   ├── exam-taker.component.spec.ts
│   │   │   │   │   │   ├── comment-section.component.ts        # Smart-lite: comment section with badges (Expert/Calypso), 1-level replies, inline edit/delete, relative timestamps (Phase 6A)
│   │   │   │   │   │   ├── comment-section.component.spec.ts
│   │   │   │   │   │   ├── ask-expert.component.ts             # Smart-lite: "Ask an Expert" button → form → success confirmation, injects ExpertQuestionService (Phase 6B)
│   │   │   │   │   │   ├── ask-expert.component.spec.ts
│   │   │   │   │   │   ├── report-issue.component.ts           # Smart-lite: "Report Issue" button → form (type dropdown + description) → success confirmation, injects IssueService (Phase 7A)
│   │   │   │   │   │   └── report-issue.component.spec.ts
│   │   │   │   │   ├── utils/
│   │   │   │   │   │   ├── quiz-json-template.ts             # Quiz JSON template constant (all 6 types) (Phase 3D)
│   │   │   │   │   │   ├── quiz-json.utils.ts                # validateQuizJson() — shape validation + defaults (Phase 3D)
│   │   │   │   │   │   └── quiz-json.utils.spec.ts
│   │   │   │   │
│   │   │   │   │
│   │   │   │   ├── analytics/               # ✅ Phase 4C complete
│   │   │   │   │   └── pages/
│   │   │   │   │       ├── progress-dashboard-page.component.ts    # Smart: cross-course progress dashboard, filters, summary stats, bulk reminders
│   │   │   │   │       └── progress-dashboard-page.component.spec.ts
│   │   │   │   │
│   │   │   │   │
│   │   │   │   ├── questions/              # ✅ Phase 6B complete
│   │   │   │   │   └── pages/
│   │   │   │   │       ├── my-questions-page.component.ts    # Smart: "My Questions" page — accordion cards, status badges (amber/emerald/slate), expand to see expert response, "Go to module" links (Phase 6B)
│   │   │   │   │       └── my-questions-page.component.spec.ts
│   │   │   │   │
│   │   │   │   │
│   │   │   │   ├── issues/               # ✅ Phase 7A complete
│   │   │   │   │   └── pages/
│   │   │   │   │       ├── my-issues-page.component.ts          # Smart: "My Issues" page — accordion cards, 4 status badges (amber/blue/emerald/slate), issue type labels, expand to see status updates (Phase 7A)
│   │   │   │   │       └── my-issues-page.component.spec.ts
│   │   │   │   │
│   │   │   │   ├── notifications/        # ✅ Phase 8A complete
│   │   │   │   │   └── pages/
│   │   │   │   │       ├── notification-list-page.component.ts    # Smart: notification list with type-specific icons+colors, unread indicator, mark all as read, click to navigate (Phase 8A)
│   │   │   │   │       └── notification-list-page.component.spec.ts
│   │   │   │   │
│   │   │   │   ├── platform/             # ✅ Phase 9A + 9E complete
│   │   │   │   │   └── pages/
│   │   │   │   │       ├── tenant-management-page.component.ts    # Smart: PA-only tenant board — CRUD tenants, expandable rows with 3 tabs (Details/Courses/CSMs), course+CSM assignment management, master tenant protection, two-click delete (Phase 9A)
│   │   │   │   │       ├── tenant-management-page.component.spec.ts
│   │   │   │   │       ├── lecturer-assignment-page.component.ts  # Smart: PA-only lecturer assignment board — flat table with triple FK joins, expandable rows with can_edit/can_grade toggles, add form (lecturer+course pickers), remove, JWT warning banner, 4 summary cards, search filter (Phase 9E)
│   │   │   │   │       └── lecturer-assignment-page.component.spec.ts
│   │   │   │   │
│   │   │   │   ├── teaching/             # ✅ Phase 5D + 6C + 7B complete
│   │   │   │   │   └── pages/
│   │   │   │   │       ├── exam-grading-page.component.ts       # Smart: cross-course exam grading dashboard (Phase 5D)
│   │   │   │   │       ├── exam-grading-page.component.spec.ts
│   │   │   │   │       ├── questions-board-page.component.ts    # Smart: expert questions board with filters, summary cards, expandable rows, inline response form (Phase 6C)
│   │   │   │   │       ├── questions-board-page.component.spec.ts
│   │   │   │   │       ├── issue-management-page.component.ts   # Smart: issue management board with 4 filters, 5 summary cards, expandable rows, inline status+notes editing (Phase 7B)
│   │   │   │   │       └── issue-management-page.component.spec.ts
│   │   │   │   │
│   │   │   │   │
│   │   │   │   ├── admin/                # ✅ Phase 9C complete
│   │   │   │   │   └── pages/
│   │   │   │   │       ├── user-management-page.component.ts    # Smart: TA+PA user board — user list with FK tenant join, invite form (TA: email-only, PA: email + tenant picker), role toggles (TA/PA), profile name edit, self-role protection, summary cards, search + role filters (Phase 9B)
│   │   │   │   │       ├── user-management-page.component.spec.ts
│   │   │   │   │       ├── access-request-page.component.ts     # Smart: TA+PA access request board — dual-role view (PA: tenant column + tenant picker for unknown domains, TA: own-tenant only), approve & invite two-step, reject with notes, read-only reviewed rows, search + status filters (Phase 9C)
│   │   │   │   │       └── access-request-page.component.spec.ts
│   │   │   │   │
│   │   │   │   │                         # --- Notes ---
│   │   │   │   ├── quizzes/              # Phase 5A quiz-taking components live in courses/components/ (quiz-question, quiz-result-item, quiz-taker)
│   │   │   │   └── exams/                # Phase 5C-5D exam-taking components live in courses/components/ (exam-taker)
│   │   │   │
│   │   │   └── shared/
│   │   │       └── components/
│   │   │           ├── stub-page.component.ts           # "Coming soon" placeholder for unbuilt feature routes
│   │   │           ├── file-upload.component.ts         # ✅ Presentational: drag-and-drop file picker, client-side validation (Phase 3C-2)
│   │   │           ├── file-upload.component.spec.ts
│   │   │           ├── tiptap-editor.component.ts       # ✅ Shared: Tiptap v2 WYSIWYG wrapper with toolbar (B/I/S/H2/H3/lists/code/undo/redo) (Phase 3C-3)
│   │   │           ├── tiptap-editor.component.spec.ts
│   │   │           ├── loading-spinner.component.ts     # ✅ Shared: centered Loader2 icon + message, input: message (default 'Loading...') (Phase 10H)
│   │   │           ├── loading-spinner.component.spec.ts
│   │   │           ├── error-alert.component.ts         # ✅ Shared: role="alert" div with alert-error class, input: message (required) (Phase 10H)
│   │   │           ├── error-alert.component.spec.ts
│   │   │           ├── empty-state.component.ts         # ✅ Shared: centered icon + message, inputs: icon (LucideIconData), message (Phase 10H)
│   │   │           ├── empty-state.component.spec.ts
│   │   │           ├── stat-card.component.ts           # ✅ Shared: stat-card with section-label + bold value, inputs: label, value, color (Phase 10H)
│   │   │           ├── stat-card.component.spec.ts
│   │   │           ├── status-badge.component.ts        # ✅ Shared: badge with variant→class mapping, input: variant (BadgeVariant), ng-content (Phase 10H)
│   │   │           └── status-badge.component.spec.ts
│   │   │
│   │   ├── styles.scss                 # ✅ @apply design system foundation — 28 semantic CSS classes (buttons, inputs, badges, cards, tables, alerts, text tokens). See Section 9. (Phase 10H)
│   │   └── test-setup.mjs              # Angular TestBed initialization (MUST be .mjs, not .ts)
│   │
│   ├── vitest.config.mts               # Frontend test config
│   ├── tailwind.config.js              # Tailwind v3
│   ├── angular.json
│   └── package.json
│
├── tests/                                  # RLS & Integration Tests
│   ├── setup.ts                        # Test factories, adminClient, createClientAs, toDenyAccess
│   ├── access-matrix.test.ts           # Permission matrix tests
│   └── rls/
│       ├── tenants.test.ts
│       ├── profiles.test.ts
│       ├── courses.test.ts
│       ├── lectures.test.ts
│       ├── modules.test.ts
│       ├── module-subtables.test.ts    # videos, pdfs, markdown, files
│       ├── quizzes.test.ts             # quizzes, questions, options
│       ├── exams.test.ts               # exams, submissions
│       ├── enrollments.test.ts
│       ├── progress.test.ts
│       ├── comments.test.ts            # comments + replies
│       ├── expert-questions.test.ts
│       ├── issues.test.ts
│       ├── quiz-attempts.test.ts       # attempts + answers
│       ├── notifications.test.ts
│       ├── reminder-history.test.ts
│       ├── access-requests.test.ts
│       ├── assignments.test.ts         # CSM + lecturer assignments
│       ├── tenant-courses.test.ts
│       ├── content-write.test.ts      # CW-001 to CW-048: content write permissions (Phase 3F)
│       └── enrollment-progress.test.ts # EP-001 to EP-048: enrollment + progress RLS (Phase 4D)
│
├── scripts/
│   └── test-runner.ts                  # Supabase branch management for RLS tests
│
└── vitest.config.ts                        # RLS test config
```

---

## 3. Development Phases

### Phase 1: Foundation

#### 1A - Supabase Setup
- [x] Create Supabase project — `ruhdnvtvoxxiodnyyqqf` (Frankfurt, Calypso Ventures GmbH org)
- [x] Initialize GitHub monorepo:
  - [x] `git init` + create `.gitignore`
  - [x] Create private GitHub repo — `TereschenkoAI/x-courses-v2`
  - [x] Push initial commit with `docs/` and `supabase/` folders
- [x] Run database migrations — all 27 applied via `supabase db push` (jwt helpers moved from `auth` to `public` schema for Cloud compatibility; 00014 fixes search_path; 00015-00017 Keycloak SSO; 00018 Equinor tenant; 00019-00021 course/lecture/module CRUD triggers; 00022-00023 search_path + immutable fields fixes; 00024 Bunny Stream support; 00025 external_quiz enum value; 00026 progress tracking triggers + admin INSERT policies; 00027 reminder_history lecturer SELECT fix)
- [ ] Configure auth:
  - [x] Keycloak SSO (for @calypso-commodities.com domain + onboarded clients) — via `calypso-xcourses` client in "customers" realm
  - [x] Enable email/password auth — enabled by default, confirmed via `config push`
  - [x] Enable magic link auth — implicit with email provider (uses `signInWithOtp`)
  - [x] Disable public registration + email signup — `enable_signup = false` in config.toml, pushed via `supabase config push`
  - [x] Set magic link / OTP expiration to 15 minutes — `otp_expiry = 900` in config.toml
  - [x] Use OTP code template — all 4 email templates use `{{ .Token }}` (magic_link, confirmation, invite, recovery)
  - [x] Configure per-tenant auth methods in `tenants.settings` — Calypso set to `["keycloak_sso","email_password","magic_link"]`
  - [x] Configure custom SMTP — Office 365 (`smtp.office365.com:587`, `support@calypso-commodities.com`)
- [x] Configure auth hooks:
  - [x] Custom Access Token Hook → `public.custom_access_token_hook` — enabled via `config push` + GRANTs for `supabase_auth_admin`
  - [ ] Password Verification Hook → requires Team/Enterprise plan (project is Pro)
- [x] Verify master tenant seed data (Calypso, is_master=true, domain='calypso-commodities.com')
- [x] Enable Realtime for `notifications` table
- [x] Verify storage buckets created (avatars, course-files, exam-submissions)
- [x] Enable pg_cron — 2 cron jobs defined in migrations (exam-deadline reminder hourly, content-staleness check daily). `cleanup_orphaned_auth_users` function exists (00013) but not scheduled as cron. All jobs commented out in migration files, enabled via Dashboard.
- [x] Note credentials — `.env.example` + `.env` created, API keys retrieved via CLI

#### 1B - RLS Test Infrastructure
- [x] Install dependencies: `vitest @supabase/supabase-js dotenv @faker-js/faker tsx pg`
- [x] Create `tests/` directory structure
- [x] Create `tests/setup.ts`:
  - [x] adminClient (service role, bypasses RLS)
  - [x] createClientAs(user) (authenticated client with RLS enforced)
  - [x] toDenyAccess() custom matcher (SELECT=empty, INSERT=error, UPDATE/DELETE=empty+.select())
  - [x] Test factories for: tenants, profiles (5 roles), courses, lectures, modules, enrollments, tenant_courses, csm_assignments, lecturer_assignments
  - [x] setProfileRole() helper (direct pg with fake JWT claims to bypass `protect_profile_role_fields` trigger)
  - [x] cleanupTestData() (FK dependency order)
- [x] Create `vitest.config.ts` for RLS tests (fork pooling for isolation)
- [x] Create `scripts/test-runner.ts` (Supabase branch management — creates ephemeral preview branch, runs tests, deletes branch)
- [x] Add npm scripts: `test:rls`, `test:rls:local`, `test:rls:watch`
- [x] Write initial RLS tests for tenants (10 tests) + profiles (14 tests)
- [x] **Tests:** 24 RLS tests passing (tenants + profiles)

#### 1C - FastAPI Setup
- [x] Create FastAPI project structure (`backend/app/main.py`, `config.py`, `dependencies.py`, routers, services, models)
- [x] Configure environment variables (Pydantic BaseSettings, `.env.example`)
- [x] Setup Supabase Python client (service role for server-side operations)
- [x] Setup JWT authentication middleware (verify Supabase JWT via python-jose HS256)
- [x] Setup SMTP client (Calypso SMTP via Office 365 — `smtp.office365.com:587`, `aiosmtplib`)
- [x] Create health check endpoint (`GET /api/health` — returns status + Supabase connectivity)
- [x] Write Dockerfile (Python 3.11-slim, uvicorn)
- [x] **Tests:** 69 pytest tests passing (health, auth/JWT, config, tenant service, resolve-tenant, reset-password, idp hint, auth methods, video upload/status/webhook/delete, reminder send)
- [x] Commit and push `backend/` to GitHub
- [x] Connect Railway to GitHub repo (root directory: `backend/`, deploy branch: `main`, auto-deploy on push)
- [x] Verify connectivity to Supabase (health endpoint returns `"supabase": "connected"`)

#### 1D - Angular Setup
- [x] Create Angular 19 project (`ng new frontend --style=scss --routing --skip-git --skip-tests --ssr=false`)
- [x] Install and configure Tailwind CSS v3
- [x] Install Lucide icons (`lucide-angular`)
- [x] Setup Supabase JS client (SupabaseService — PKCE flow, autoRefreshToken, persistSession, detectSessionInUrl)
- [x] Setup API service for FastAPI (ApiService — HttpClient wrapper with JWT auth headers)
- [x] Configure environment files (supabaseUrl, supabaseAnonKey, apiUrl) + angular.json fileReplacements
- [x] Commit and push `frontend/` to GitHub
- [x] Connect Vercel to GitHub repo (root directory: `frontend/`, deploy branch: `main`, auto-deploy on push) — live at `https://x-courses-v2.vercel.app`
- [ ] **Tests:** Basic smoke tests (deferred to 1E — frontend test infrastructure)

#### 1E - Frontend Test Infrastructure
- [x] Install: vitest, @analogjs/vitest-angular, @analogjs/vite-plugin-angular, jsdom, @testing-library/angular
- [x] Create `vitest.config.mts` with AnalogJS plugin
- [x] Create `src/test-setup.mjs` (Zone.js via @analogjs/vitest-angular/setup-zone, TestBed init)
- [x] Create mock infrastructure:
  - [x] `supabase.mock.ts` — Multi-tenant aware mock with JWT claims simulation
  - [x] `auth.mock.ts` — Session mock with role switching (placeholder for Phase 1F)
  - [x] `api.mock.ts` — FastAPI client mock
  - [x] `toast.mock.ts`
  - [x] `router.mock.ts`
  - [x] `lucide.mock.ts`
- [x] Add npm scripts: `test`, `test:watch`, `test:coverage`, `test:ui`
- [x] 3 smoke tests (8 assertions) passing: AppComponent, SupabaseService, ApiService

#### 1F - Auth Flow
- [x] Login page (tenant-aware):
  - [x] Read tenant's `settings.auth_methods` to determine available methods
  - [x] Keycloak SSO button (show if tenant allows `keycloak_sso`)
  - [x] Email + Password form (show if tenant allows `email_password`)
  - [x] Magic Link / OTP code flow (show if tenant allows `magic_link`) — 3-step: send code → enter 6-digit OTP → verify
  - [x] Domain detection: user enters email → resolve tenant → show allowed methods
  - [x] Use PKCE flow (`flowType: 'pkce'` in Supabase client init)
- [x] Password reset flow:
  - [x] Proxy through FastAPI (`POST /api/auth/reset-password`)
  - [x] FastAPI validates tenant allows `email_password` before forwarding to Supabase admin API
  - [x] Frontend never calls `resetPasswordForEmail()` directly (prevents ghost password on SSO-only users)
- [x] Tenant resolution:
  - [x] `POST /api/auth/resolve-tenant` — returns allowed auth methods for email domain
  - [x] Rate limit: 10 requests/minute/IP
  - [x] Pre-invite check: verify email doesn't already have a profile before sending invitation
- [x] Accept invite page — not needed (Supabase invite links go to `/auth/callback`, `detectSessionInUrl: true` handles token exchange)
- [x] Access request page (enter email → domain routing → pending approval)
- [x] Auth guard (redirect to login if not authenticated)
- [x] Role guard with 5-role support:
  - [x] Learner (implicit — all authenticated users)
  - [x] Tenant Admin (`is_tenant_admin` from JWT)
  - [x] Platform Admin (`is_platform_admin` from JWT)
  - [x] CSM (`csm_tenant_ids.length > 0` from JWT)
  - [x] Lecturer (`lecturer_course_ids.length > 0` from JWT)
- [x] Auth service with session management
- [x] Logout functionality
- [x] **Tests:** 38 backend tests (tenant service, resolve-tenant, reset-password) + 92 frontend tests (auth service, guards, login with OTP flow, reset-password, access-request, tenant service, layout shell)

#### 1G - Layout Shell
- [x] Main layout component (wraps authenticated routes via `loadComponent` on parent route)
- [x] Role-aware sidebar navigation (6 sections, 16 nav items, `filterNavSections()` pure function):
  - [x] **All users:** Dashboard, My Courses, My Questions, My Issues, Notifications
  - [x] **Tenant Admin:** + User Management, Progress Dashboard
  - [x] **CSM:** + Assigned Tenants, Expert Questions, Progress Dashboard
  - [x] **Lecturer:** + My Courses (teaching), Questions Board, Exam Grading, Issue Management, Progress Dashboard
  - [x] **Platform Admin:** + All of the above + Tenant Management, Content Management, Staleness Dashboard
- [x] Header with notification bell (Realtime unread count badge via NotificationService — Phase 8A) + user menu dropdown (avatar/initials, profile link, sign out)
- [x] ProfileService (fetches `full_name`/`avatar_url` from `profiles` table via `effect()` watching auth state)
- [x] Mobile responsive sidebar (fixed overlay with backdrop on `<lg`, static `w-64` on `lg:`, translate-x transitions)
- [x] StubPageComponent ("Coming soon" placeholder for unbuilt feature routes)
- [x] Dashboard stripped to content-only (layout handled by MainLayoutComponent)
- [x] **Tests:** 25 new tests (4 ProfileService + 9 Sidebar + 7 Header + 5 MainLayout) — 82 total frontend tests

---

### Phase 2: Content Read

Goal: Display courses, lectures, and modules with proper tenant-scoped access.

#### 2A - Course List & Detail
- [x] Course list page (enrolled courses for current user's tenant)
- [x] Progress bar per course (frontend calculation: completed_modules / total_modules)
- [x] Course detail page:
  - [x] Course metadata (title, description, thumbnail, enrollment type)
  - [x] Lecture accordion (sorted by sort_order)
  - [x] Module list within each lecture (sorted by sort_order)
  - [x] Module type icons (video, PDF, markdown, quiz, exam)
  - [x] Completion status indicators per module
- [x] CourseService (4 parallel Supabase queries — courses, modules, user_progress, course_enrollments — with `.eq('user_id', userId)` on user-scoped tables)
- [x] Union types at service boundary: `EnrollmentType`, `ModuleType`, `ProgressStatus` (Supabase returns `string`, cast with `as` at service layer)
- [x] **Tests:** 51 new tests (9 CourseService + 10 CourseCard + 6 CourseListPage + 7 CourseDetailPage + 4 LectureAccordion + 4 ModuleItem + 1 mock factory + new unauthenticated test) — 147 total frontend tests

#### 2B - Module Viewers
- [x] Video viewer (Bunny iframe embed with token-signed URLs, 3 encoding states: processing spinner / ready iframe / failed alert, auto-polling during encoding)
- [x] PDF viewer (`<iframe>` + DomSanitizer `bypassSecurityTrustResourceUrl`, download button, page count)
- [x] Markdown viewer (ngx-markdown@19.1 with Tailwind prose styling, render from module_markdown.content)
- [x] Downloadable files list (module_files — download links with human-readable KB/MB/GB sizes)
- [x] Module navigation (cross-lecture prev/next — flattened from courseDetail.lectures)
- [x] Mark-as-complete button (upsert user_progress with `onConflict: 'user_id,tenant_id,module_id'`, hidden for quiz/exam due to `enforce_quiz_exam_completion` trigger)
- [x] Quiz/exam: "Coming soon" placeholder in module viewer, non-linkable in module-item
- [x] Route: `/courses/:courseId/modules/:moduleId` (lazy-loaded ModuleViewerPageComponent)
- [x] CourseService: `loadModuleViewer()` (2-step: module metadata → type-specific content) + `markModuleComplete()`
- [x] Module-item: RouterLink for video/pdf/markdown, "Coming soon" for quiz/exam
- [x] Lecture-accordion + course-detail-page: `courseId` passthrough to module-item
- [x] **Tests:** 33 new tests (6 CourseService + 3 VideoViewer + 3 PdfViewer + 2 MarkdownViewer + 3 ModuleFilesList + 11 ModuleViewerPage + 4 updated ModuleItem + 1 updated LectureAccordion) — 180 total frontend tests

#### 2C - Content Read RLS Tests
- [x] Courses: tenant user sees courses via tenant_courses, cannot see unassigned courses (TEN-005/006/007)
- [x] Lectures: inherits from course access (INH-001/002)
- [x] Modules: inherits from course access via denormalized course_id (INH-004/005)
- [x] Module subtables: videos (INH-007/008), pdfs (INH-011/012), markdown (INH-013/014), files (INH-016/017)
- [x] Platform admin: sees all courses, lectures, modules, subtables (ROL-011/017/019, INH-009/018)
- [x] Lecturer: sees assigned courses cross-tenant (ROL-012/018/020, INH-010/019)
- [x] CSM: sees courses via `courses_select_csm` (ROL-013), known gap — NO CSM SELECT on lectures/modules/subtables (INH-003/006/015)
- [x] Tenant_courses: tenant isolation (TEN-008/009), platform admin (ROL-015), CSM (ROL-016), cross-tenant (XTA-006)
- [x] Escalation prevention: learner cannot INSERT/UPDATE/DELETE courses (ESC-004/006/007), lectures (ESC-008/009), modules (ESC-010), tenant_courses (ESC-005)
- [x] 4 new factory functions in `tests/setup.ts`: createModuleVideo, createModulePdf, createModuleMarkdown, createModuleFile
- [x] **Tests:** 42 new RLS tests (16 courses + 26 content-hierarchy) — 66 total RLS tests

---

### Phase 3: Content Write

Goal: Allow Platform Admins and Lecturers (with can_edit) to create and manage course content.

#### 3A - Course CRUD
- [x] Create course form (Platform Admin only)
- [x] Edit course form (Platform Admin + Lecturer with can_edit)
- [x] Course metadata: title, description, thumbnail, enrollment type, password (if password_protected), staleness threshold
- [x] Assign courses to tenants (Platform Admin — manages tenant_courses)
- [x] Delete course (Platform Admin only, cascades)
- [x] created_by / updated_by tracking
- [x] **Tests:** CourseFormComponent, CourseFormPageComponent, TenantAssignmentComponent, CourseService — 223 total frontend tests

#### 3B - Lecture CRUD
- [x] Create lecture within course (auto sort_order = max + 1)
- [x] Edit lecture (title, description) — inline editing, not separate page
- [x] Sort ordering (up/down buttons — sequential swap via 2 Supabase UPDATEs)
- [x] Delete lecture (cascades modules → subtables → progress → quiz attempts, with 2-step confirmation)
- [x] created_by / updated_by tracking (migration 00020: `set_lecture_audit_fields()` trigger)
- [x] Inline editing orchestrated by CourseDetailPageComponent (`editingLectureId` signal: 'new' | lectureId | null)
- [x] LectureFormComponent (presentational), LectureAccordionComponent (edit/delete/reorder buttons)
- [x] 4 CourseService methods: `createLecture`, `updateLecture`, `deleteLecture`, `swapLectureSortOrder`
- [x] Lecturers with `can_edit` have full CRUD on lectures (unlike courses: admin-only delete)
- [x] **Tests:** 34 new tests (8 LectureForm + 16 LectureAccordion + 7 CourseDetailPage lecture CRUD + 9 CourseService lecture methods) — 257 total frontend tests

#### 3C-1 — Module CRUD: Core + Video (Complete)
- [x] Migration 00021: `set_module_audit_fields()` trigger (auto `created_by`/`updated_by`)
- [x] Model types: `ModuleFormData`, `VideoFormData`, `ModuleContentFormData`, `ModuleSavePayload`
- [x] CourseService: `createModule`, `updateModule`, `deleteModule`, `swapModuleSortOrder`, `loadModuleForEdit`
- [x] Two-step creation with rollback (module row → subtable, rollback on subtable failure)
- [x] ModuleFormPageComponent (separate page) with type selector (all 5 types shown)
- [x] VideoFormComponent (self-contained: title + desc + TUS file upload with progress bar — rewritten in 3C-4 for Bunny Stream)
- [x] Non-video types: generic form with title/description + "settings coming soon" note
- [x] ModuleItemComponent: edit/delete/reorder buttons (canEdit), delete confirmation
- [x] LectureAccordionComponent: "Add Module" button, module event forwarding (5 new outputs)
- [x] CourseDetailPageComponent: module CRUD orchestration (navigate, delete, reorder)
- [x] Routes: `courses/:courseId/modules/new`, `courses/:courseId/modules/:moduleId/edit`
- [x] Type is immutable after creation, `lectureId` as query param for create
- [x] **Tests:** 58 new tests (8 VideoForm + 17 ModuleFormPage + 10 ModuleItem + 7 LectureAccordion + 12 CourseService + 4 CourseDetailPage) — 315 total frontend tests

#### 3C-2 — Module CRUD: File Upload + PDF + Exam (Complete)
- [x] FileUploadComponent (shared, presentational drag-and-drop / file picker — no SupabaseService, parent handles upload)
- [x] Supabase Storage integration (course-files bucket, upload on save not on file select, path: `course-files/{courseId}/{timestamp}-{filename}`)
- [x] PdfFormComponent with file upload, file_name, page_count (optional)
- [x] ExamFormComponent: title + desc + duration_minutes, passing_score, max_file_size (MB display → bytes on save), allowed_file_types checkboxes, optional exam_file_url upload
- [x] Exam title sync: module title and exam title kept in sync on save
- [x] `significantUpdate` flag on `ModuleSavePayload` → sets `significant_update_at` on module row
- [x] CourseService: extend `#insertModuleContent`, `#upsertModuleContent`, `#contentToFormData`, `#fetchModuleContent` for PDF + Exam
- [x] ModuleFormPageComponent: PDF + Exam get dedicated forms, generic form narrowed (markdown + quiz at 3C-2 → quiz-only after 3C-3)
- [x] Model types: `PdfFormData`, `ExamFormData`, `ExamContent`, updated `ModuleContentFormData` union
- [x] Mock factories: `createMockPdfFormData()`, `createMockExamFormData()`
- [x] **Tests:** 40 new tests (8 FileUpload + 8 PdfForm + 10 ExamForm + 6 ModuleFormPage + 8 CourseService) — 355 total frontend tests

#### 3C-3 — Module CRUD: Tiptap Markdown + Module Files + Quiz Stub (Complete)
- [x] Install Tiptap: @tiptap/core, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-code-block-lowlight, tiptap-markdown, ngx-tiptap@12 (Angular 19), lowlight, highlight.js
- [x] TiptapEditorComponent (shared WYSIWYG wrapper with toolbar: B/I/S/H2/H3/BulletList/OrderedList/CodeBlock/Undo/Redo)
- [x] MarkdownFormComponent (presentational: title + desc + Tiptap editor, follows VideoForm pattern)
- [x] ModuleFilesEditorComponent (smart-lite: attach/delete files for ALL module types, edit mode only, immediate upload on file select)
- [x] MockTiptapEditorComponent (textarea fallback for tests — avoids Tiptap DOM issues in test env)
- [x] CourseService: module_files CRUD (`loadModuleFiles`, `addModuleFile`, `deleteModuleFile`) + markdown subtable CRUD in `#insertModuleContent`, `#upsertModuleContent`, `#contentToFormData`
- [x] ModuleFormPageComponent: dedicated markdown form + module files editor for all types in edit mode + quiz stub narrowed to quiz-only
- [x] Quiz stub: creates module with type=quiz, "Quiz Builder coming in Phase 3D" note
- [x] Model types: `MarkdownFormData`, updated `ModuleContentFormData` union for markdown
- [x] Mock factories: `createMockMarkdownFormData()`, mock service methods for module files
- [x] `editor.storage['markdown']` — bracket notation required (TS index signature), CommonJS warning from `markdown-it-task-lists` is harmless
- [x] **Tests:** 38 new tests (6 TiptapEditor + 8 MarkdownForm + 8 ModuleFilesEditor + 9 CourseService + 7 ModuleFormPage) — 393 total frontend tests

#### 3C-4 — Bunny Stream Integration (Complete)
> Detailed implementation plan: [docs/BUNNY_STREAM_PLAN.md](BUNNY_STREAM_PLAN.md)
- [x] Migration 00024: Replace `video_url`/`thumbnail_url`/`duration` with `bunny_video_id`, `bunny_library_id`, `encoding_status`, auto-populated `duration`/`thumbnail_url`, `original_filename` + unique index on `bunny_video_id`
- [x] Backend: Add `bunny_api_key`, `bunny_library_id`, `bunny_cdn_hostname`, `bunny_token_key` to Settings
- [x] Backend: `services/bunny.py` — create_video, generate_tus_signature, generate_embed_token, get_video_status, delete_video, build_thumbnail_url
- [x] Backend: `routers/video.py` — `POST /api/video/init-upload` (JWT, creates video + returns TUS credentials), `GET /api/video/{id}/status` (returns signed embed URL + encoding status), `POST /api/video/webhook` (encoding status callback), `DELETE /api/video/{id}` (cleanup on module delete)
- [x] Backend: JWT auth upgraded to ES256 (JWKS auto-discovery) with HS256 fallback — Supabase migrated signing algorithm
- [x] Frontend: Install `tus-js-client`, create BunnyUploadService (TUS upload + progress signals + pollStatus + deleteVideo)
- [x] Frontend: Rewrite VideoFormComponent — file picker + TUS upload progress bar + 2GB limit (replaces URL text inputs)
- [x] Frontend: Rewrite VideoViewerComponent — Bunny iframe embed with token-signed URLs + 3 encoding states (processing/ready/failed) + auto-polling + `#polledStatus` signal pattern
- [x] Frontend: Update ModuleFormPageComponent, CourseService private methods (#insertModuleContent, #upsertModuleContent, #fetchModuleContent, #contentToFormData), mock factories
- [x] Frontend: CourseService Bunny video cleanup — deleteModule, deleteLecture, deleteCourse all collect bunny_video_ids before cascade delete and fire-and-forget `DELETE /api/video/{id}`
- [x] Bunny dashboard: Token authentication enabled, allowed referers set (`x-courses-v2.vercel.app`, `localhost:4200`)
- [x] Bunny webhook URL configured → `https://{railway-domain}/api/video/webhook`
- [x] E2E verified: full round-trip (upload 21.5MB MP4 → encode → signed iframe playback → delete with Bunny cleanup)
- [x] **Tests:** 14 backend (pytest) + ~20 frontend (vitest) — 413 total frontend (backend count at time of 3C-4: 60)

#### 3D - Quiz Builder (Complete)
- [x] Quiz settings: title, description, time_limit (seconds in DB, minutes in UI), passing_score, max_attempts, show_correct_answers, randomize_questions, randomize_answers
- [x] Questions CRUD:
  - [x] 6 question types: single_choice, multiple_choice, true_false, fill_blank, matching, short_answer
  - [x] Question text, points, sort_order — inline editing with reordering (move up/down)
  - [x] Options CRUD (for choice-based types): option_text, is_correct (radio for single, checkbox for multi), sort_order
  - [x] Correct answer text input (for fill_blank, short_answer)
  - [x] Matching pairs editor with add/remove (for matching type)
- [x] Quiz JSON Import/Export: Template download (all 6 types), file import with `validateQuizJson()` validation, export for round-trip editing
- [x] CourseService: 4 quiz switch cases + `#insertQuizQuestions` helper, delete-and-reinsert strategy for updates
- [x] E2E verified: 16 stories (QB-01 to QB-16) all pass, 1 bug found and fixed (FileReader change detection in zoneless mode)
- [x] **Tests:** QuizFormComponent (23 tests), quiz-json.utils (23 tests) — 456 total frontend tests, build OK

#### 3E - External Quiz Reference (Complete)
- [x] Migration 00025: `ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'external_quiz'` (table + 9 RLS policies already existed since 00002/00004)
- [x] ExternalQuizFormComponent: 3 fields (quiz_id, quiz_url, passing_score) + title/description — simplest module type, no file upload, no signed URLs
- [x] ExternalQuizViewerComponent: info card with quiz ID, passing score, "Take External Quiz" button (`target="_blank"`)
- [x] CourseService: 4 switch cases (insert/upsert/fetch/toFormData) — follows exam pattern
- [x] ModuleItemComponent: ExternalLink icon + added to `LINKABLE_TYPES` (clickable from course detail)
- [x] ModuleViewerPageComponent: `@case ('external_quiz')` + added to `canMarkComplete` (manual completion until Phase 5B webhook)
- [x] ModuleFormPageComponent: type selector (6th option), form wiring, edit mode loading
- [x] E2E verified: 2 stories (EQ-01 create+view, EQ-02 edit round-trip) all pass, 0 bugs found
- [x] **Tests:** 24 new tests (11 ExternalQuizForm + 6 ExternalQuizViewer + 3 CourseService + 2 ModuleFormPage + 2 ModuleViewerPage) — 480 total frontend tests, build OK

#### 3F - Content Write RLS Tests (Complete)
- [x] Platform Admin can INSERT/UPDATE/DELETE courses, lectures, modules, subtables (CW-001 to CW-012)
- [x] Lecturer with can_edit can INSERT/UPDATE/DELETE on assigned courses (CW-013 to CW-022)
- [x] Lecturer (can_edit) escalation boundaries — cannot INSERT/DELETE courses or tenant_courses (CW-023 to CW-026)
- [x] Lecturer without can_edit cannot write content (CW-027 to CW-032)
- [x] Tenant Admin cannot write content (CW-033 to CW-037)
- [x] CSM cannot write content (CW-038 to CW-042)
- [x] Learner cannot INSERT subtables — module_videos, module_pdfs, quizzes, quiz_questions, exams, external_quiz_references (CW-043 to CW-048)
- [x] Fixed `createModuleVideo` factory for Bunny Stream schema (bunny_video_id, bunny_library_id, encoding_status)
- [x] Added 5 new factories: createQuiz, createQuizQuestion, createQuizQuestionOption, createExam, createExternalQuizReference
- [x] **Tests:** 48 new RLS tests (CW-001 to CW-048) — 114 total RLS tests, all pass

---

### Phase 4: Enrollment & Progress

#### 4A - Enrollment System (Complete)
- [x] NO migrations — all DB infrastructure already existed (course_enrollments table, enroll_with_password RPC, 10 RLS policies)
- [x] Enrollment flow based on course enrollment_type:
  - [x] **Open:** Self-enroll button (direct INSERT into course_enrollments, RLS policy `ce_insert_self` validates tenant_courses assignment + open enrollment_type)
  - [x] **Password protected:** Password input with error handling, calls `enroll_with_password()` RPC (server-side bcrypt comparison)
  - [x] **Invite only:** Info card ("requires administrator invitation"), Tenant Admin/Platform Admin enroll users via EnrollmentManager
- [x] EnrollmentCtaComponent (presentational): 4 states — open button, password input, invite-only info, enrolled badge. Hidden when canEdit. `setError()` method for parent error propagation
- [x] EnrollmentManagerComponent (smart-lite): admin panel for PA/TA — enrolled users table, add by email (lookupUserByEmail → adminEnrollUser), unenroll button
- [x] CourseService: 6 new methods — `enrollInOpenCourse`, `enrollWithPassword`, `adminEnrollUser`, `unenrollUser`, `loadEnrolledUsers`, `lookupUserByEmail`
- [x] `CourseDetail.isEnrolled` added, `loadCourseDetail` gets 3rd parallel query (maybeSingle on course_enrollments)
- [x] Module viewer: `canMarkComplete` now checks `courseDetail()?.isEnrolled` — unenrolled users can view content but cannot track progress
- [x] CourseDetailPageComponent: enrollment CTA between header and lectures, enrollment manager before delete section, `canManageEnrollments()` computed (PA/TA)
- [x] Cross-tenant isolation: TA sees only own tenant's enrolled users, PA sees all tenants
- [x] E2E verified: 11 stories (EN-01 to EN-11) all pass, 1 bug found and fixed (enrollment error feedback via `setError()` + `viewChild`)
- [x] **Tests:** 38 new tests (10 EnrollmentCta + 10 EnrollmentManager + 8 CourseService + 6 CourseDetailPage + 2 ModuleViewerPage enrollment gating + 2 EnrollmentCta in parent) — 518 total frontend tests, build OK

#### 4B - Progress Tracking (Complete)
- [x] Migration 00026: 2 admin INSERT policies (`progress_insert_platform_admin`, `progress_insert_tenant_admin`) + 3 SECURITY DEFINER trigger functions:
  - [x] `auto_mark_quiz_completed()` — AFTER UPDATE on quiz_attempts when `passed` changes to true
  - [x] `auto_mark_exam_completed()` — AFTER UPDATE on exam_submissions when `score` first set and >= `passing_score`
  - [x] `reset_progress_on_significant_update()` — AFTER UPDATE on modules when `significant_update_at` changes, resets completed progress for that module
- [x] Model types: `MarkedByType`, `UserProgressRecord`, `UserProgressSummary`
- [x] CourseService: 3 new methods — `loadCourseProgressAdmin` (2 parallel queries: enrollments + progress), `adminMarkModuleComplete` (upsert with `marked_by='admin'`), `adminResetModuleProgress` (update to `not_started`)
- [x] ProgressManagerComponent (smart-lite): user progress accordion with per-user progress bars, expand to see module-level status badges, Mark Complete / Reset buttons per module
- [x] Course detail page integration: ProgressManagerComponent after EnrollmentManager, gated by `canManageEnrollments()` (PA/TA only)
- [x] Significant update checkbox on module edit form (edit mode only): amber box with "This is a significant update" checkbox, sets `significant_update_at` on save → triggers progress reset cascade
- [x] Cross-tenant isolation: TA sees only own tenant's users, PA sees all tenants
- [x] E2E verified: 11 stories (PT-01 to PT-11) all pass, 0 bugs found. 2 deferred (PT-12/PT-13 — quiz/exam auto-mark needs Phase 5A/5B)
- [x] **Tests:** 23 new tests (6 CourseService + 10 ProgressManager + 3 CourseDetailPage + 4 ModuleFormPage) — 541 total frontend tests, build OK

#### 4C - Progress Dashboard (Complete)
- [x] ProgressService (separate from CourseService): 4 parallel Supabase queries (courses, enrollments, progress, modules) + optional 5th for PA/CSM tenant names, client-side aggregation
- [x] ProgressDashboardPageComponent at `/analytics/progress`:
  - [x] Role-scoped data via RLS: PA sees all, TA sees own tenant, Lecturer sees assigned courses cross-tenant, CSM sees assigned tenants
  - [x] User table with per-course mini progress bars, overall %, last active (relative dates), email, name
  - [x] Summary stat cards: Total Users, Avg Progress, Completed (100%), At Risk (<25%)
  - [x] Filters: search (email + name), course dropdown, progress range (min-max %), clear filters
  - [x] Checkbox selection with Select All, "Send Reminder (N)" button
  - [x] Bulk reminder panel: custom message textarea, Send/Cancel, loading state
  - [x] Tenant column visible for PA/CSM only (`showTenantColumn` computed)
  - [x] Learner blocked by `roleGuard('tenant_admin', 'csm', 'lecturer', 'platform_admin')`
- [x] Backend `POST /api/reminders/send` (reminder.py): PA/TA/CSM/Lecturer authorization, sends email via SMTP, inserts `reminder_history` (trigger auto-creates notification)
- [x] Sidebar: Added `platform_admin` to Analytics section roles
- [x] Route: `analytics/progress` with roleGuard (replaced stub)
- [x] E2E verified: 12 stories (PD-01 to PD-12), 11 pass + 1 partial (SMTP timeout locally), 0 bugs found
- [x] **Tests:** 25 new frontend (8 ProgressService + 14 ProgressDashboardPage + 3 mock factories) + 9 new backend (reminder endpoint) — 566 total frontend, 69 total backend, build OK

#### 4D - Enrollment & Progress RLS Tests (Complete)
- [x] Enrollments SELECT: own, tenant admin, platform admin, CSM, lecturer + cross-tenant isolation (10 tests)
- [x] Enrollments INSERT: self-enroll open course, enrollment_type enforcement (invite_only/password_protected blocked), TA own tenant, PA any (8 tests)
- [x] Enrollments DELETE: TA own tenant, PA any, learner/CSM denied (5 tests)
- [x] enroll_with_password RPC: correct password, wrong password rejected, cross-tenant rejected (3 tests)
- [x] Progress SELECT: own, TA own tenant, PA all, CSM assigned tenants, lecturer assigned courses cross-tenant (10 tests)
- [x] Progress INSERT: own, TA own tenant (admin mark), PA any + user_id/tenant_id enforcement (5 tests)
- [x] Progress UPDATE: own, TA own tenant, PA any + cross-tenant denied (5 tests)
- [x] Progress DELETE: no policies exist — even PA cannot delete (1 test)
- [x] Trigger: enforce_quiz_exam_completion blocks non-admin quiz completion (1 test)
- [x] Bug found + fixed: missing `reminder_history_select_lecturer` policy (migration 00027)
- [x] **Tests:** 48 new RLS tests (EP-001 to EP-048), 162 total RLS tests, all passing

---

### Phase 5: Quizzes & Exams

#### 5A - Quiz Taking (Complete)
- [x] Quiz start flow: check max_attempts, create quiz_attempt
- [x] 6 question type renderers:
  - [x] Single choice (radio buttons)
  - [x] Multiple choice (checkboxes)
  - [x] True/false (radio buttons)
  - [x] Fill in the blank (text input)
  - [x] Matching (dropdowns)
  - [x] Short answer (textarea)
- [x] Timer (countdown from time_limit, auto-submit on expire)
- [x] Question randomization (if quiz.randomize_questions)
- [x] Answer randomization (if quiz.randomize_answers)
- [x] Auto-grading on submit:
  - [x] Call `grade_quiz_attempt` RPC (server-side grading)
  - [x] Fetch results via `get_quiz_results` RPC
  - [x] If passed → auto-mark module progress as completed (via DB trigger)
- [x] Results display: score, pass/fail, per-question results with correct answers (if show_correct_answers)
- [x] 3 new components:
  - [x] QuizQuestionComponent (presentational): renders 6 question types (single_choice, multiple_choice, true_false, fill_blank, short_answer, matching)
  - [x] QuizResultItemComponent (presentational): per-question results after grading
  - [x] QuizTakerComponent (smart-lite): 3-phase quiz flow (start → active → results), timer, answer management, auto-submit
- [x] CourseService: 4 new methods — `loadQuizForTaking`, `startQuizAttempt`, `submitQuizAttempt`, `getQuizAttemptResults`
- [x] Model types: `QuizForTaking`, `QuizQuestionForTaking`, `QuizQuestionOptionForTaking`, `QuizAttemptAnswer`, `QuizAttemptResult`, `QuizQuestionResult`
- [x] ModuleItemComponent: added 'quiz' to LINKABLE_TYPES (clickable from course detail)
- [x] ModuleViewerPageComponent: integrated QuizTakerComponent (onQuizCompleted is no-op to preserve results view)
- [x] Mock factories: 5 new (quiz-taking types) + 4 new service mock methods
- [x] Migration 00028: fix `protect_quiz_attempt_score` trigger conflict — `set_config('app.grading_in_progress')` bypass
- [x] **Tests:** 47 new tests (17 QuizQuestion + 6 QuizResultItem + 16 QuizTaker + 8 CourseService quiz methods) — 620 total frontend tests, build OK
- [x] **E2E verified:** 11 stories (QT-01 to QT-11), 10 pass + 1 partial (QT-04 timer colors). 3 bugs found+fixed (QT-BUG-01/02/03). PT-12 resolved.

#### 5B - External Quiz Webhook
- [x] FastAPI endpoint: `POST /api/quiz-results/external`
- [x] Request body: `{ external_quiz_id, user_email, score, passed, details }`
- [x] Lookup user by email → get user_id, tenant_id
- [x] Insert into external_quiz_results (service role, bypasses RLS)
- [x] If passed → auto-mark module progress (lookup module via external_quiz_references)
- [x] API key or webhook signature validation
- [x] Migration 00030: `auto_mark_external_quiz_completed()` trigger — AFTER INSERT on `external_quiz_results`, auto-marks `user_progress` with `marked_by='system'`
- [x] **Tests:** 8 pytest endpoint tests — 77 total backend tests pass

#### 5C - Exam Flow
- [x] ExamTakerComponent: 3-phase (info → active → submitted), ~200 lines inline template
- [x] Info phase: exam metadata grid (duration, passing score, file types, max size) + "Start Exam" button
- [x] Active phase: countdown timer (teal→amber→rose, informational — does NOT auto-submit or block), download exam file link, FileUploadComponent for submission, 2-step submit confirmation
- [x] Submitted phase: submission details (on-time/late badge), grading status (awaiting/passed/failed), feedback display
- [x] Timer persistence: localStorage `exam_start_{examId}` survives page refresh, cleared on submit
- [x] CourseService: `#getSignedUrlFromBucket` (generalized signed URL helper), `loadExamForTaking` (exam + submission query, dual-bucket signed URLs), `submitExamSubmission` (upload + INSERT + cleanup on error)
- [x] ExamContent vs ExamTakingData: ExamContent omits `id` (admin viewer), ExamTakingData includes `id` (needed for FK)
- [x] UNIQUE violation handling: catches duplicate key error → "You have already submitted this exam"
- [x] Module viewer page: `@case ('exam')` + `onExamCompleted()` no-op (same as quiz pattern)
- [x] Module item: added `'exam'` to LINKABLE_TYPES (clickable from course detail)
- [x] Mock factories: `createMockExamTakingData()`, `createMockExamSubmission()` + 2 new service mock methods
- [x] **Tests:** 27 new tests (18 ExamTaker + 6 CourseService + 3 viewer page) — 648 total frontend tests, build OK

#### 5D - Exam Grading
- [x] ExamGradingService (separate from CourseService): `loadGradingData`, `gradeSubmission`, `resetSubmission`
- [x] Queries `exam_submissions` with nested select joins (profiles, exams, courses), resolves signed URLs in parallel
- [x] Lecturer grading page (cross-tenant for assigned courses where can_grade = true)
- [x] Download student submission (signed URL link)
- [x] Enter score (0-100) + written feedback
- [x] Update exam_submissions (score, feedback, graded_by, graded_at)
- [x] Auto-notification via trigger (notify_exam_graded) — fires on first grade only (NULL→non-NULL)
- [x] If passed → auto-mark module progress as completed (auto_mark_exam_completed trigger)
- [x] Exam reset (delete submission → student can retake + fire-and-forget storage cleanup):
  - [x] Lecturer (for assigned courses with can_grade)
  - [x] Platform Admin (any)
- [x] Re-grading allowed — updating an already-graded score permitted (no re-notification)
- [x] ExamGradingPageComponent: filter bar (search + course + status), 4 summary cards, expandable table rows with inline grading form, 2-step reset confirmation
- [x] Route: `teaching/grading` with roleGuard('lecturer', 'platform_admin') — BEFORE `teaching/:path` catch-all
- [x] Sidebar: Teaching section roles updated to `['lecturer', 'platform_admin']`
- [x] Mock factories: `createMockGradingSubmission()`, `createMockExamGradingService()`
- [x] **Tests:** 31 new tests (11 service + 20 component) — 679 total frontend tests, build OK

#### 5E - Quiz & Exam RLS Tests ✅
- [x] Quiz attempts: 16 tests (SELECT 8, INSERT 4, UPDATE 3, DELETE 1) — learner self, TA same-tenant, PA all, lecturer cross-tenant, CSM assigned-tenant, protect_quiz_attempt_score trigger
- [x] Quiz attempt answers: 11 tests (SELECT 7, INSERT 2, UPDATE 1, DELETE 1) — no TA policy (intentional gap), no UPDATE/DELETE policies
- [x] Exam submissions: 19 tests (SELECT 8, INSERT 3, UPDATE 4, DELETE 4) — lecturer can_grade scope, PA all, TA denied
- [x] External quiz results: 8 tests (SELECT 7, INSERT 1) — service-role only INSERT, no TA policy (intentional gap)
- [x] Trigger: enforce_exam_submission_course rejects mismatched course_id
- [x] 4 new factory functions in tests/setup.ts
- [x] **Tests:** 55 new RLS tests (QE-001 to QE-055) — 217 total RLS tests across 7 files

---

### Phase 6: Comments & Ask Expert

#### 6A - Comments (Complete)
- [x] Migration 00031: `badge_type text` column on `comments` + `comment_replies`, SECURITY DEFINER BEFORE INSERT triggers (`set_comment_badge`, `set_comment_reply_badge`) — auto-set 'calypso' (PA/CSM) or 'expert' (Lecturer on course) or NULL
- [x] CommentService (separate from CourseService): 7 methods — `loadComments`, `addComment`, `updateComment`, `deleteComment`, `addReply`, `updateReply`, `deleteReply`. Signal-based state (comments, loading, error). Nested Supabase select with author join + reply author join.
- [x] CommentSectionComponent (smart-lite in `features/courses/components/`): inline template (~200 lines), expert/calypso badges with Lucide icons (GraduationCap/Building2), avatar initials, relative timestamps, inline edit/delete/reply forms, permission-aware action buttons (own/TA/PA)
- [x] Module viewer page integration: `<app-comment-section>` between files section and bottom navigation bar, auto-reloads on module navigation via `effect()` watching `moduleId`
- [x] Mock factories: `createMockComment()`, `createMockCommentReply()`, `createMockCommentService()`
- [x] Lecturer cross-tenant commenting: lecturers insert with own tenant_id (master), visible via `comments_select_lecturer` RLS policy. Explicit cross-tenant posting deferred.
- [x] No enrollment gate — comments visible to anyone with module access (via tenant_courses RLS)
- [x] Plain text only (no markdown) — `<textarea>` input, `body` is `text NOT NULL`
- [x] **Tests:** 31 new tests (13 CommentService + 17 CommentSectionComponent + 1 ModuleViewerPage comment integration) — 710 total frontend tests, build OK

#### 6B - Ask Expert (Complete)
- [x] No migration needed — `expert_questions` table + 8 RLS policies + 2 notification triggers already exist (migrations 00001-00009)
- [x] ExpertQuestionService (separate from CourseService): 2 methods — `loadMyQuestions` (nested FK joins to courses/modules/profiles, `.eq('user_id')` filter, order by created_at desc), `askQuestion` (insert + reload-after-mutation). Signal-based state (questions, loading, error).
- [x] ExpertQuestion model: `ExpertQuestionStatus` type, `ExpertQuestion` interface with nullable FK join fields (course, module, responder) — null-safe pattern from CM-BUG-01
- [x] AskExpertComponent (smart-lite in `features/courses/components/`): 3-state UI (collapsed teal button → form with textarea → success confirmation), injects ExpertQuestionService, manual textarea binding
- [x] Module viewer page integration: `<app-ask-expert>` between files section and comment section, passes courseId + moduleId as required inputs
- [x] MyQuestionsPageComponent (smart page in `features/questions/pages/`): expandable accordion cards, status badges (amber=pending, emerald=answered, slate=closed), "Go to module" RouterLink, expert response in teal-50 card, relative timestamps
- [x] Route `/questions` + sidebar "My Questions" (HelpCircle icon, roles: 'all') — added before `/notifications` in route config
- [x] Mock factories: `createMockExpertQuestion()`, `createMockExpertQuestionService()`, `MockExpertQuestionService` type — in course.mock.ts
- [x] Auto-notification via existing DB triggers: `notify_new_expert_question` (INSERT → lecturers + CSMs), `notify_question_answered` (UPDATE → learner)
- [x] **Tests:** 38 new tests (11 ExpertQuestionService + 10 AskExpertComponent + 16 MyQuestionsPageComponent + 1 ModuleViewerPage ask-expert integration) — 748 total frontend tests, build OK

#### 6C - Questions Board (Lecturer) ✅
- [x] No migration needed — reuses `expert_questions` table + existing RLS policies
- [x] Extended ExpertQuestionService (same service, 4 new board signals + 3 new methods): `loadBoardQuestions` (FK join to asker profile, grouped by course), `respondToQuestion` (update response_text + status → answered), `closeQuestion` (status → closed)
- [x] New model types: `ExpertQuestionForBoard` (with asker FK join), `QuestionAsker`, `BoardCourseSummary`
- [x] QuestionsBoardPageComponent (~300 lines): filter bar (search input + course dropdown + status dropdown), 4 summary cards (total/pending/answered/closed), expandable table rows with inline response form
- [x] Filter by status (pending, answered, closed) + search by question text + filter by course
- [x] Reply to question: update expert_questions (response_text, responded_by, responded_at, status → 'answered')
- [x] Auto-notification via trigger (notify_question_answered → learner) — fires at DB level
- [x] CSM visibility: can see questions from assigned tenants (read-only awareness, cannot reply)
- [x] Platform Admin: can see all, can reply
- [x] Route: `teaching/questions` with `roleGuard('lecturer', 'platform_admin')` — BEFORE `teaching/:path` catch-all
- [x] Mock backward compat: extended `createMockExpertQuestionService` with board options, all default empty — 27 existing call sites unaffected
- [x] QB-BUG-01: Closed questions with `response_text` didn't show expert response on learner's My Questions page — condition was `status === 'answered'` only, changed to `response_text` truthy check
- [x] **Tests:** 33 new tests (11 service + 22 component) + 1 bug fix — 782 total frontend tests, build OK. E2E 12/12 all PASS.

#### 6D - Comments & Expert Questions RLS Tests ✅
- [x] 3 new factory functions in `tests/setup.ts`: `createComment`, `createCommentReply`, `createExpertQuestion`
- [x] Comments SELECT (7 tests): tenant users see own tenant only, PA sees all, CSM sees assigned tenant, lecturer sees cross-tenant for assigned courses, TA sees own tenant
- [x] Comments INSERT (4 tests): own tenant OK, wrong tenant denied. **Finding:** `comments_insert_lecturer` and `comments_insert_csm` policies are broken — their EXISTS subqueries reference `tenant_courses` which has no lecturer/CSM SELECT policy. PostgreSQL recursively applies RLS in policy subqueries. Lecturers/CSMs use `comments_insert_own` with their master tenant_id instead.
- [x] Comments UPDATE (2 tests): author can update own, others denied
- [x] Comments DELETE (4 tests): author, TA (same tenant), PA (any) can delete; others denied
- [x] Comment replies: same tenant isolation + lecturer cross-tenant SELECT, own INSERT, own UPDATE/DELETE, PA DELETE (7 tests)
- [x] Expert questions SELECT (7 tests): own questions, TA own tenant, PA all, CSM assigned tenants, lecturer cross-tenant on assigned courses
- [x] Expert questions INSERT (2 tests): own tenant OK, wrong tenant denied
- [x] Expert questions UPDATE (4 tests): lecturer can update (response + status), PA can update any, learner and TA denied
- [x] Expert questions DELETE (3 tests): no DELETE policies — all roles denied (learner, PA, lecturer)
- [x] **Tests:** 40 new RLS tests (CM-001 to CM-024, EQ-001 to EQ-016) — 257 total RLS tests across 9 files

---

### Phase 7: Issue Reporting

#### 7A - Issue Reporting UI (Complete)
- [x] No migration needed — `issues` table, `issues_safe` view, 6 RLS policies, 2 notification triggers already exist
- [x] IssueService (separate from CourseService): 2 methods — `loadMyIssues` (from `issues_safe` view, excludes internal_notes), `reportIssue` (INSERT into base `issues` table without `.select()` — learner has INSERT but no SELECT on base table). Signal-based state.
- [x] ReportIssueComponent (smart-lite in `features/courses/components/`): 3-state UI (collapsed Flag button → form with issue type dropdown + description textarea → success confirmation), injects IssueService
- [x] MyIssuesPageComponent (smart page in `features/issues/pages/`): expandable accordion cards, 4 status badges (amber=open, blue=investigating, emerald=resolved, slate=closed), issue type labels, expand to see description + "Go to module" link + resolution panel
- [x] Route `/issues` + sidebar "My Issues" (Flag icon, roles: 'all') — added before `/notifications` in route config
- [x] Module viewer page integration: `<app-report-issue>` between ask-expert and comment section
- [x] **Dual table strategy:** SELECT from `issues_safe` (view, no internal_notes), INSERT into base `issues` table (learner has INSERT but no SELECT on base)
- [x] Mock factories: `createMockIssue()`, `createMockIssueService()` in course.mock.ts
- [x] Auto-notification via existing DB triggers: `notify_new_issue` (INSERT → lecturers + CSMs + PA, deduplicated)
- [x] **Tests:** 39 new tests (11 IssueService + 10 ReportIssueComponent + 17 MyIssuesPageComponent + 1 ModuleViewerPage integration) — 821 total frontend tests, build OK
- [x] **E2E verified:** 13 stories (IR-01 to IR-13), all pass, 0 bugs found

#### 7B - Issue Management Board (Complete)
- [x] Extended IssueService with dual-signal pattern (4 board signals + 2 board methods): `loadBoardIssues` (base `issues` table with reporter FK join, includes internal_notes), `updateIssue` (status + internal_notes, auto-sets resolved_by/resolved_at when resolving, clears when moving away from resolved)
- [x] New model types: `IssueForBoard` (with reporter FK join + internal_notes), `IssueReporter`, `BoardIssueSummary`
- [x] IssueManagementPageComponent (~290 lines): 4 filters (search/course/status/type), 5 summary cards (Total/Open/Investigating/Resolved/Closed), expandable table rows with inline status dropdown + internal notes textarea + Save/Cancel
- [x] Status badges: open=amber/Clock, investigating=blue/Eye, resolved=emerald/CheckCircle2, closed=slate/XCircle
- [x] Board reads from base `issues` table (not `issues_safe`) — includes `internal_notes` + reporter FK join
- [x] Route: `teaching/issues` with `roleGuard('lecturer', 'platform_admin')` — BEFORE `teaching/:path` catch-all
- [x] Sidebar: "Issue Management" in Teaching section (Flag icon)
- [x] Mock backward compat: extended `createMockIssueService` with board options, all default empty — existing call sites unaffected
- [x] Auto-notification via trigger: `notify_issue_resolved` fires when status changes to 'resolved'
- [x] **Tests:** 33 new tests (12 IssueService board + 20 IssueManagementPage + 1 existing fix) — 854 total frontend tests, build OK
- [x] **E2E verified:** 12 stories (IM-01 to IM-12), all pass, 4 roles tested (Lecturer, PA, Learner, CSM), 0 bugs found

#### 7C - Issue RLS Tests (Complete)
- [x] `createIssue` factory in `tests/setup.ts` (userId, tenantId, courseId, overrides)
- [x] Base table SELECT (7 tests): Learner/TA cannot SELECT base table (dropped in 00010), PA sees all, CSM sees assigned tenant, Lecturer sees assigned courses cross-tenant
- [x] `issues_safe` view SELECT (4 tests): Learner sees own, TA sees tenant, internal_notes column absent
- [x] INSERT (2 tests): Learner can insert with own user_id+tenant_id, wrong tenant denied
- [x] UPDATE (5 tests): Lecturer can update assigned course issues, PA can update any, Learner/TA/CSM denied
- [x] DELETE (3 tests): No DELETE policies — PA, Lecturer, Learner all denied
- [x] **IS-RLS-BUG-01:** Learner INSERT with `.select().single()` fails — learner has INSERT but NO SELECT on base table (dropped migration 00010). Must INSERT without `.select()`, verify via admin.
- [x] **Tests:** 21 new RLS tests (IS-001 to IS-021) — 278 total RLS tests across 10 files, all pass

---

### Phase 8: Notifications

#### 8A - Notification Service & Bell (Complete)
- [x] Migration 00033: `notifications` added to `supabase_realtime` publication (idempotent DO block — table was already published, so migration is a safe no-op)
- [x] `notification.model.ts`: `AppNotification` interface, `NotificationType` (15-value string literal union), `NotificationMeta` interface (icon + colorClass), `NOTIFICATION_META` map (15 entries, type-specific Lucide icons + Tailwind color classes), `getNotificationMeta()` helper with Bell fallback, `getNotificationRoute(type, data)` helper mapping each notification type to a frontend route (or null)
- [x] NotificationService (root singleton): Supabase Realtime subscription via `effect(onCleanup)` tied to auth state, `loadNotifications` (limit 50, ordered by created_at DESC), `markAsRead` (single), `markAllAsRead` (bulk), `dismissToast`, `latestToast` signal (5s auto-dismiss via setTimeout), `unreadCount` computed signal
- [x] Header: inject NotificationService, expose `unreadCount`, rose-500 pill badge with 99+ cap on bell icon
- [x] Main layout: toast overlay (fixed top-right z-50, click navigates + marks read, X dismiss button with stopPropagation)
- [x] NotificationListPageComponent (~250 lines): 4-state template (loading/error/empty/list), type-specific icons+colors from NOTIFICATION_META, unread border-l-teal-500 indicator, "Mark all as read" button (hidden when all read), click → markAsRead + Router.navigate, relative timestamps
- [x] Route `/notifications` replaced stub with real lazy-loaded component
- [x] Mock factories: `createMockNotification()` (full AppNotification factory), `createMockNotificationService()` (signal-based mock with helper setters)
- [x] Supabase mock enhanced: `channel().on().subscribe()` chain returns `this` (mockReturnThis pattern), `removeChannel` added
- [x] **Tests:** 31 new tests (12 NotificationService + 16 NotificationListPage + 3 HeaderComponent badge) — 885 total frontend tests, build OK
- [x] **E2E verified:** 12 stories (NT-01 to NT-12), 11 pass / 1 skipped (NT-11 Realtime Toast — requires two separate browser instances, Supabase auth localStorage prevents multi-user testing in single browser context), 0 bugs found. Verified all 4 roles (learner, lecturer, PA, CSM). Triggers verified: `notify_question_answered`, `notify_issue_resolved`, `notify_new_expert_question`, `notify_new_issue`.

#### 8B - Verify Notification Triggers (Complete)
All 13 trigger functions verified via integration tests (`tests/rls/notifications.test.ts`, Section B):

| # | Trigger | Table | Event | Recipients | Test IDs |
|---|---------|-------|-------|------------|----------|
| 1 | notify_course_assigned | course_enrollments | INSERT | Enrolled learner | NT-010 |
| 2 | notify_new_module | modules | INSERT | All enrolled learners | NT-011, NT-012 |
| 3 | notify_progress_reset | user_progress | UPDATE | Affected learner | NT-013, NT-014 |
| 4 | notify_exam_graded | exam_submissions | UPDATE (score set) | Submitting learner | NT-015, NT-016 |
| 5 | notify_question_answered | expert_questions | UPDATE (response set) | Asking learner | NT-017, NT-018 |
| 6 | notify_reminder_sent | reminder_history | INSERT | Reminded learner | NT-019 |
| 7 | notify_new_expert_question | expert_questions | INSERT | Assigned lecturers + CSMs | NT-020, NT-021 |
| 8 | notify_new_exam_submission | exam_submissions | INSERT | Lecturers with can_grade | NT-022 |
| 9 | notify_new_issue | issues | INSERT | Lecturers + CSMs + Platform Admins (deduplicated) | NT-023 |
| 10 | notify_new_access_request | access_requests | INSERT | Tenant admins (if known domain) + Platform admins | NT-024, NT-025 |
| 11 | notify_issue_resolved | issues | UPDATE (status→resolved) | Reporter | NT-026, NT-027 |
| 12 | notify_exam_reset | exam_submissions | DELETE | Student | NT-028 |
| 13 | notify_access_request_reviewed | access_requests | UPDATE (status changed) | Requester + admins | NT-029, NT-030 |

- [x] All 13 triggers verified with positive + negative tests (21 trigger tests total)
- [x] Covers: correct recipients, notification type/title/body, data payload keys, conditional fire guards (e.g., score NULL→non-NULL only)
- [ ] Enable pg_cron and uncomment scheduled jobs (operational task — requires Supabase Dashboard)

#### 8C - Notification RLS Tests (Complete)
- [x] Notifications: own read only (NT-001 to NT-003), own update only (NT-004, NT-005)
- [x] Notifications: no direct INSERT (NT-006, NT-007), no DELETE (NT-008, NT-009)
- [x] **Tests:** 9 RLS tests + 21 trigger tests = 30 new tests in `tests/rls/notifications.test.ts` — 308 total RLS tests across 11 files

---

### Phase 9: Admin

#### 9A - Tenant Management (Complete)
- [x] No migration needed — `tenants`, `tenant_courses`, `csm_tenant_assignments` tables + RLS policies + triggers already exist (migrations 00001-00023)
- [x] `tenant-management.model.ts`: 7 interfaces — `TenantForBoard`, `TenantSettings`, `TenantCourseAssignment`, `CsmAssignment`, `AvailableCourse`, `AvailableCsm`, `TenantFormData`
- [x] TenantManagementService (separate from auth-flow TenantService — different concern): 3 signals (`tenants`, `loading`, `error`) + 12 methods:
  - [x] `loadTenants` — `.select('*, tenant_courses(count), csm_tenant_assignments(count)')`, maps `[{count:N}]` → `courseCount`/`csmCount`
  - [x] `createTenant` / `updateTenant` / `deleteTenant` — CRUD on `tenants` table
  - [x] `loadTenantCourses` / `loadAvailableCourses` / `assignCourseToTenant` / `removeCourseFromTenant` — manage `tenant_courses`
  - [x] `loadCsmAssignments` / `loadAvailableCsms` / `assignCsm` / `removeCsm` — manage `csm_tenant_assignments`
- [x] TenantManagementPageComponent (~480 lines): PA-only board at `/platform/tenants`
  - [x] Header: Building2 icon + "Tenant Management" + teal count badge + "Add Tenant" button
  - [x] Create form: name + domain + 3 auth method checkboxes (Email default-checked)
  - [x] Filter bar: search by name/domain (case-insensitive)
  - [x] 4 summary cards: Total Tenants, Master (always 1), Course Assignments (sum), CSM Assignments (sum)
  - [x] Table: Name (Master badge with Shield icon), Domain, Auth Methods (pills), Courses count, CSMs count
  - [x] Expandable rows with 3 tabs (Details / Courses / CSMs):
    - [x] Details: inline edit name/domain/auth methods + Save + two-click Delete (disabled for master with AlertTriangle warning)
    - [x] Courses: assigned list with remove (X) + "Add Course" dropdown + cascade warning (cleanup_tenant_course_removal)
    - [x] CSMs: assigned list with remove (X) + "Add CSM" dropdown (master-tenant users only, enforce_master_tenant_assignment)
- [x] Route: `platform/tenants` with `roleGuard('platform_admin')` — BEFORE `platform/:path` catch-all
- [x] Mock factories: `createMockTenantForBoard`, `createMockTenantCourseAssignment`, `createMockCsmAssignment`, `createMockTenantManagementService` — with `_set*` helpers + backward-compat defaults
- [x] **Key gotcha:** "Master" text in both badge and summary card — use `getAllByText` not `getByText`
- [x] **Key gotcha:** Supabase count pattern `.select('*, tenant_courses(count)')` returns `[{count: N}]` — map via `?.[0]?.count ?? 0`
- [x] **Tests:** 41 new tests (19 TenantManagementService + 22 TenantManagementPage) — 926 total frontend tests, build OK
- [x] **E2E verified:** 10 stories (TM-01 to TM-10), all pass, 5 roles tested (PA allowed, Learner/Lecturer/CSM/TA blocked), 0 bugs found

#### 9B - User Management (Complete)
- [x] No migration needed — `profiles` table + RLS policies (`profiles_select_tenant`, `profiles_select_platform_admin`, `profiles_update_tenant_admin`, `profiles_update_platform_admin`) + `protect_profile_role_fields()` trigger already exist
- [x] `user-management.model.ts`: 4 interfaces — `UserForBoard`, `InviteUserData`, `UpdateUserRolesData`, `UpdateUserProfileData`
- [x] UserManagementService (separate from ProfileService — different concern): 3 signals (`users`, `loading`, `error`) + 5 methods:
  - [x] `loadUsers` — `.select('*, tenant:tenants(name)')`, maps `row.tenant?.name` → `tenant_name`. RLS auto-scopes: TA sees own-tenant, PA sees all
  - [x] `inviteUser(data)` — calls `ApiService.post('/invite', data)`. TA sends `{ email }` (backend uses JWT tenant_id). PA sends `{ email, tenant_id }`
  - [x] `updateUserRoles(userId, data)` / `updateUserProfile(userId, data)` / `removeUserAdminRole(userId)` — `.update().eq('id', userId)` on `profiles` table
- [x] FastAPI `POST /api/invite` endpoint (`backend/app/routers/invite.py`):
  - [x] Auth: JWT (PA or TA only, else 403). PA provides `tenant_id`, TA uses JWT claim
  - [x] Validates tenant exists via `maybe_single().execute()`, checks email uniqueness
  - [x] Calls `supabase.auth.admin.invite_user_by_email()` with `options={"data": {"tenant_id": tenant_id}}`
  - [x] `InviteUserRequest` / `InviteUserResponse` schemas in `schemas.py`
  - [x] **UM-BUG-01 (Critical):** Python `maybe_single().execute()` returns `None` for 0 rows (not response with `data=None`). Fixed: null checks `tenant_result is None or not tenant_result.data`
- [x] UserManagementPageComponent (~450 lines): TA+PA board at `/admin/users`
  - [x] Header: Users icon + "User Management" + teal count badge + "Invite User" button
  - [x] Invite form (collapsible): email input + tenant dropdown (PA only, loads from `tenants` table) + Invite/Cancel buttons
  - [x] Filter bar: search by name/email + role filter dropdown (All / Tenant Admin / Platform Admin / Regular User)
  - [x] Summary cards: Total Users + Tenant Admins + Platform Admins (PA only) + Regular Users
  - [x] Table: Avatar initials + Name, Email, Roles (badges: teal PA / amber TA / slate User), Tenant (PA only), Joined
  - [x] Expandable rows: name edit (input + Save) + role toggles (TA checkbox + PA checkbox for PA users only)
  - [x] Self-role protection: own checkboxes disabled + "Cannot modify own role" message
  - [x] TA-scoped view: no tenant column, no PA toggle, no PA summary card, no tenant picker in invite
- [x] Route: `admin/users` with `roleGuard('tenant_admin', 'platform_admin')` — BEFORE `admin/:path` catch-all
- [x] Sidebar update: "Tenant Admin" section roles changed from `['tenant_admin']` to `['tenant_admin', 'platform_admin']` — PA sees User Management link
- [x] Mock factories: `createMockUserForBoard`, `createMockUserManagementService` — with `_set*` helpers + backward-compat defaults
- [x] **Tests:** 41 new frontend tests (18 UserManagementService + 22 UserManagementPage + 1 sidebar) + 8 backend pytest tests (PA/TA invite, role rejection, duplicate email 409, nonexistent tenant 404, unauthenticated 401) — 967 total frontend, 85 backend
- [x] **E2E verified:** 12 stories (UM-01 to UM-12), all pass, 5 roles tested (PA + TA allowed, Learner/Lecturer/CSM blocked), 1 bug found+fixed (UM-BUG-01)

#### 9C - Access Requests (Complete)
- [x] Migration 00034: BEFORE INSERT trigger `resolve_access_request_tenant()` — auto-resolves `domain → tenant_id` from `tenants` table. Known domains get `tenant_id` set; unknown domains keep `tenant_id = NULL` (only PA sees them)
- [x] `access-request.model.ts`: 3 types — `AccessRequestForBoard`, `AccessRequestStatus`, `ReviewAccessRequestData`
- [x] AccessRequestService (separate service): 3 signals (`requests`, `loading`, `error`) + 3 methods:
  - [x] `loadRequests` — `.select('*, tenant:tenants(name), reviewer:profiles!reviewed_by(full_name)')`, maps FK joins to flat fields. RLS auto-scopes: TA sees own-tenant, PA sees all
  - [x] `reviewRequest(id, data, userId)` — `.update({ status, review_notes, reviewed_by, reviewed_at })`. Used for both approve and reject
  - [x] `approveAndInvite(id, email, tenantId, userId)` — two-step: (1) `reviewRequest()` with status 'approved', (2) `ApiService.post('/invite', { email, tenant_id })` via `firstValueFrom()`. If step 2 fails, request is still 'approved' — UI shows error + allows retry
- [x] AccessRequestPageComponent (~440 lines): TA+PA board at `/admin/access-requests`
  - [x] Header: UserPlus icon + "Access Requests" + teal count badge
  - [x] Filter bar: search by name/email/domain (case-insensitive) + status dropdown (All / Pending / Approved / Rejected)
  - [x] 4 summary cards: Total Requests (slate), Pending (amber), Approved (emerald), Rejected (rose)
  - [x] Table: Name/Email, Domain, Tenant (PA only — "Unknown domain" amber badge when `tenant_id = NULL`), Status badge, Requested date
  - [x] Expandable rows — two templates:
    - [x] **Pending**: request details + review notes textarea + "Approve & Invite" (teal) + "Reject" (rose) buttons
    - [x] **Already reviewed**: read-only reviewer name, date, notes — no action buttons
  - [x] PA-only: tenant picker dropdown for unknown-domain requests — "Approve & Invite" disabled until tenant selected
  - [x] TA-scoped: no tenant column, no tenant picker, no unknown-domain requests (RLS filters them)
- [x] Route: `admin/access-requests` with `roleGuard('tenant_admin', 'platform_admin')` — BEFORE `admin/:path` catch-all
- [x] Sidebar: added "Access Requests" (UserPlus icon) under "Tenant Admin" section
- [x] Notification routing: updated `getNotificationRoute()` for `new_access_request` → `/admin/access-requests`
- [x] Mock factories: `createMockAccessRequestForBoard`, `createMockAccessRequestService` — with `_set*` helpers + backward-compat defaults
- [x] **Key finding:** Existing access_requests rows (created before migration 00034) have `tenant_id = NULL` — they show as "Unknown domain" for PA. Migration only fixes FUTURE inserts.
- [x] **Tests:** 37 new frontend tests (16 AccessRequestService + 21 AccessRequestPage) — 1004 total frontend, 85 backend, build OK
- [x] **E2E verified:** 11 stories (AR-01 to AR-11), all pass, 5 roles tested (PA + TA allowed, Learner/Lecturer/CSM blocked), 0 bugs found

#### 9D - Reminder Emails (Complete — built as part of Phase 4C)
- [x] FastAPI endpoint: `POST /api/reminders/send` (backend/app/routers/reminder.py)
- [x] Request body: `{ user_ids: [], course_id?, message }`
- [x] Sender authorization:
  - [x] Tenant Admin: can remind users in own tenant
  - [x] CSM: can remind users in assigned tenants
  - [x] Lecturer: can remind users on assigned courses (cross-tenant)
  - [x] Platform Admin: can remind anyone
- [x] Send HTML reminder email via Calypso SMTP (aiosmtplib)
- [x] Insert into reminder_history (service role, trigger auto-creates notification)
- [x] Auto-notification via trigger (notify_reminder_sent → learner)
- [x] Integration with Progress Dashboard (bulk select → send reminder)
- [x] **Tests:** 9 pytest endpoint tests (auth, authorization, send flow, partial failure)

#### 9E - CSM & Lecturer Assignment Management (Complete)
- [x] CSM → tenant assignment management — **completed in Phase 9A** (Tenant Management "CSMs" tab)
- [x] Lecturer assignments page (Platform Admin only):
  - [x] List Lecturer → course assignments (triple FK join: `profiles!user_id`, `courses!course_id`, `profiles!assigned_by`)
  - [x] Add/remove assignments (validates master tenant user via trigger, course dropdown excludes already-assigned)
  - [x] Toggle can_edit and can_grade flags (expandable row with checkboxes, immediate persistence)
- [x] **Important:** JWT warning banner — "Permission changes take effect when the lecturer next logs in (~1 hour JWT refresh)."
- [x] **Files:** LecturerAssignmentService (3 signals + 6 methods), LecturerAssignmentPageComponent (~350 lines), model types, mock factories
- [x] **Route:** `platform/lecturer-assignments` with `roleGuard('platform_admin')`, sidebar UserCog icon in Platform section
- [x] **Tests:** 15 service + 21 page = 36 new tests (1040 total frontend)
- [x] **E2E:** 7 stories (LA-01 to LA-07), all pass, 3 roles tested (PA + Learner + Lecturer), 0 bugs

#### 9F - Admin RLS Tests (Complete)
- [x] CSM assignments: PA CRUD (INSERT/DELETE), CSM reads own, learner/TA/lecturer denied
- [x] Lecturer assignments: PA full CRUD, lecturer reads own but CANNOT UPDATE/DELETE, TA/learner denied
- [x] Access requests: PA SELECT all + UPDATE, TA SELECT/UPDATE own-tenant, authenticated INSERT (pending only), no DELETE
- [x] Reminder history: PA/TA/CSM/lecturer SELECT (role-scoped), PA/TA/CSM/lecturer INSERT (role-scoped), learner denied, no UPDATE/DELETE
- [x] Tenants gap-fill: PA UPDATE/DELETE, TA cannot UPDATE
- [x] Profiles gap-fill: PA UPDATE role fields, TA UPDATE same-tenant, TA denied cross-tenant
- [x] Master tenant enforcement trigger: non-master user rejected as CSM and lecturer
- [x] resolve_access_request_tenant trigger: domain auto-resolves to tenant_id
- [x] **Key finding:** `access_requests` INSERT+SELECT fails for learner (no SELECT policy) — INSERT without `.select()`, verify via admin
- [x] **Files:** `tests/rls/admin.test.ts` (new), `tests/setup.ts` (2 factories + tracker fields)
- [x] **Tests:** 46 new RLS tests (354 total RLS, 12 test files)

---

### Phase 10: Polish & Final Testing

#### 10A - Error Handling & Toast System (Complete)
- [x] `extractErrorMessage()` utility — `core/utils/error.utils.ts`, replaced `#extractErrorMessage` in 5 services (CourseService, TenantManagement, UserManagement, AccessRequest, LecturerAssignment)
- [x] ToastService: signal-based queue, auto-dismiss (4s success/info, 6s warning, 8s error), persistent option, max 5 toasts
- [x] ToastContainerComponent: fixed bottom-right, 4 variants (emerald success, rose error, amber warning, blue info), dismiss button, role="alert"
- [x] Auth session expiry handling:
  - [x] `#signOutInitiated` flag distinguishes user-initiated vs involuntary sign-out
  - [x] User-initiated: redirect to `/login` (no toast)
  - [x] Involuntary: persistent error toast + redirect to `/login?returnUrl=...`
  - [x] `returnUrl` preserved through guard → login → post-auth redirect
- [x] HTTP error interceptor (`httpErrorInterceptor`):
  - [x] 1 retry with 1s delay for GET/HEAD 5xx and network errors (idempotent methods only)
  - [x] Auto-toast: network error (0), forbidden (403), rate limit (429), server error (500+)
  - [x] No toast for 401 (auth handler covers) or 404 (callers handle contextually)
- [x] 3 pilot components migrated to toast: UserManagement, TenantManagement, LecturerAssignment
- [x] Convention established: **load errors stay inline (error signal in template), action success/error use toast**
- [x] **Tests:** 39 new frontend tests (1079 total), 354 RLS, 85 backend, build OK

#### 10B - Toast Audit & Bug Fixes (Complete)
- [x] 5-agent deep audit identified 3 HIGH bugs, 4 MEDIUM error-handling issues, 13 components needing toast, 1 security gap, 2 code duplication hotspots → documented in `docs/toast-audit.md`
- [x] **Bug fix (HIGH):** POST retry in interceptor — added `(req.method === 'GET' || req.method === 'HEAD')` guard. `POST /api/invite` on 502 no longer retries (was sending emails twice)
- [x] **Bug fix (HIGH):** Double-toast prevention — exported `isToastedByInterceptor(err)` helper. Applied in 3 caller sites: AccessRequestPage, ProgressDashboard, UserManagementPage
- [x] **Bug fix (HIGH):** `getSession()` rejection in AuthService — added `.catch(() => { set(null); setLoading(false) })`. Prevents infinite spinner on IndexedDB corruption
- [x] **Bug fix (MEDIUM):** ProfileService silent error — `#fetchProfile` now destructures `{ data, error }`, logs errors via `console.error`
- [x] Shared date utilities — `core/utils/date.utils.ts`:
  - [x] `formatDate()` extracted from 7 components (~70 lines saved): user-management-page, access-request-page, lecturer-assignment-page, enrollment-manager, quiz-taker, exam-taker, exam-grading-page
  - [x] `formatRelativeTime()` extracted from 6 components (~90 lines saved): my-questions-page, notification-list-page, my-issues-page, questions-board-page, issue-management-page, comment-section
  - [x] Template access pattern: `readonly formatDate = formatDate;` as class property
- [x] Error handling consistency — `extractErrorMessage` adopted across all services:
  - [x] 8 load methods across 6 services (comment, expert-question, issue, progress, exam-grading, notification)
  - [x] 8 throw-without-fallback methods now have descriptive fallback messages (comment: 6, expert-question: 1, issue: 1)
  - [x] ~22 mutation methods across 4 admin services (tenant-management, user-management, access-request, lecturer-assignment)
- [x] Toast migration — 13 components migrated:
  - [x] **Course CRUD (3):** course-form-page, course-detail-page, module-form-page — action errors/success → toast, load errors stay inline
  - [x] **Teaching (3):** exam-grading-page, questions-board-page, issue-management-page — removed gradeError/responseError/saveError signals
  - [x] **Admin/Analytics (2):** access-request-page (removed reviewSuccess/reviewError), progress-dashboard-page (removed reminderResult/reminderError)
  - [x] **Interactive (5):** comment-section (6 methods, removed actionError), ask-expert (error→toast, kept submitted state), report-issue (error→toast, kept submitted state), enrollment-manager (validation inline, backend→toast), progress-manager (split error signal)
- [x] **Security:** Role guards added to 4 stub catch-all routes: `teaching/:path` (lecturer/PA), `admin/:path` (TA/PA), `csm/:path` (CSM/PA), `platform/:path` (PA)
- [x] **Cleanup:** `loadAvailableTenantsList()` moved from 2 page components into TenantManagementService — eliminated direct Supabase queries in components
- [x] **Tests:** 17 new frontend tests (1096 total), 354 RLS, 85 backend, build OK

#### 10C - Performance (Complete)
- [x] **Lazy loading:** Already done — all 30 routes use `loadComponent` with dynamic `import()`. No changes needed.
- [x] **Client-side pagination:** Added to progress-dashboard (50/page) and user-management (50/page) with signal-based `currentPage`, `paginatedUsers`, auto-reset on filter change. Notification-list: "Load more" button (50 increments).
- [x] **Debounce search:** Created `debouncedSignal()` utility (`core/utils/debounce.utils.ts`). Applied to progress-dashboard and user-management (300ms). 7 other search inputs skipped — datasets too small.
- [x] **RLS query indexes:** Migration 00036 — 5 indexes (ext_quiz_refs, enrollments user+course, module_files, issues user_id, comments user_id).
- [x] **`@defer (on viewport)`:** Module viewer — comment section, ask expert, report issue now deferred below fold.
- [x] **Bug fix:** Video-form `setInterval` leak — `#clearUploadCheck()` on `DestroyRef.onDestroy`. Course-card: `loading="lazy"` on thumbnail img.
- [x] **Tests:** 20 new tests (6 debounce utility + 8 pagination + 4 load-more + 1 interval cleanup + 1 video-form), 1167 total frontend tests, build OK

#### 10D - Profile Page & Course Thumbnail Upload (Complete)
- [x] **Migration 00037:** Make `avatars` bucket private (`public = false`), drop `avatars_select_public`, add `avatars_select_authenticated` (any logged-in user can view any avatar)
- [x] **Profile model:** Added `FullProfileData` interface in `core/models/profile.model.ts`
- [x] **ProfileService — 4 new methods + signed URL resolution:**
  - [x] `loadFullProfile()` — `.select('*, tenants!inner(name)')` with avatar signed URL resolution
  - [x] `updateName(fullName)` — `.update({ full_name })` + `refreshProfile()` to update header
  - [x] `uploadAvatar(file)` — validate image/5MB, upload to `avatars/{userId}/avatar` with `upsert:true`, update `profiles.avatar_url`, refresh
  - [x] `removeAvatar()` — remove from storage, set `avatar_url: null`, refresh
  - [x] `#resolveAvatarUrl(path)` — if starts with `http` return as-is (backward compat), else `createSignedUrl(path, 3600)` + `&v={timestamp}` cache-buster
  - [x] Updated `#fetchProfile` effect to resolve avatar signed URLs — keeps header avatar fresh on token refresh (~1hr)
- [x] **ProfilePageComponent** (`features/profile/pages/`):
  - [x] Large centered avatar with camera overlay for upload, "Remove photo" link
  - [x] Info card: Full Name (inline edit with pencil/check/x), Email (readonly), Organization (readonly), Roles (colored badges), Member Since
  - [x] Hidden `<input type="file" accept="image/*">` triggered by avatar overlay click
  - [x] Instant FileReader preview on file select, upload via ProfileService
  - [x] Toast for all action success/error, inline error for load failure
- [x] **`isStoragePath()` utility** (`core/utils/storage.utils.ts`): Returns `true` if URL does NOT start with `http://` or `https://` — distinguishes storage paths from external URLs
- [x] **CourseService — 3 new methods + 2 modified:**
  - [x] `uploadThumbnail(courseId, file)` — upload to `course-files/{courseId}/thumbnail-{timestamp}.{ext}`, return storage path
  - [x] `deleteThumbnailIfStoragePath(url)` — if `isStoragePath(url)`, remove from storage (fire-and-forget)
  - [x] `getCourseThumbnailSignedUrl(path)` — public wrapper around `#getSignedUrl`
  - [x] Modified `loadCourses()` — batch `createSignedUrls()` via `#resolveThumbnailUrls()` for all storage-path thumbnails
  - [x] Modified `loadCourseDetail()` — resolve `thumbnail_url` if it's a storage path
- [x] **CourseFormComponent — Upload/URL dual-mode tabs:**
  - [x] `thumbnailMode` signal (`'upload' | 'url'`), `#pendingFile` signal, `#filePreviewUrl` signal
  - [x] `thumbnailPreviewUrl` computed (pending file > current signed URL > external URL)
  - [x] `currentThumbnailSignedUrl` input for edit-mode preview
  - [x] `FileUploadComponent` integration: accept `image/jpeg,image/png,image/webp`, maxSizeMB 5
  - [x] Output type changed to `CourseFormSaveEvent { data: CourseFormData; thumbnailFile: File | null }`
  - [x] `DestroyRef.onDestroy` to revoke ObjectURL on component destroy
- [x] **CourseFormPageComponent — Upload orchestration:**
  - [x] **Create mode:** two-step — create course → upload thumbnail → update course with storage path
  - [x] **Edit mode:** delete old storage-path thumbnail → upload new → update course
  - [x] `currentThumbnailSignedUrl` signal resolved in `ngOnInit` for edit-mode preview
- [x] **Tests:** 37 new frontend tests (14 ProfileService + 20 ProfilePage + 3 isStoragePath), 1204 total, 354 RLS, 85 backend, build OK
- [x] **E2E:** 11 stories (PT-01 to PT-11), all pass, 5 roles tested, 0 bugs found

#### 10E - Complete RLS Permission Matrix
- [ ] All 30 tables covered
- [ ] 5-category test organization:
  - [ ] **TEN** — Tenant Isolation (users can't see other tenants' data)
  - [ ] **XTA** — Cross-Tenant Access (lecturers see assigned courses, CSMs see assigned tenants)
  - [ ] **ESC** — Escalation Prevention (no self-promotion, role field protection)
  - [ ] **ROL** — Role-Based Access (correct CRUD per role)
  - [ ] **INH** — Inherited Access (module subtables inherit from course access)
- [ ] **Target:** ~245 total RLS tests

#### 10F - Test Coverage Review
- [ ] Ensure all services have tests
- [ ] Ensure all major components have tests
- [ ] Review and fix any failing tests
- [ ] Generate coverage report
- [ ] Document any intentional gaps

#### 10G - Content Staleness Dashboard (Complete)
- [x] **Migration 00035:** `staleness_postponed_until` column on modules, module-specific `set_module_updated_at()` trigger replacing generic `handle_updated_at` on modules only
- [x] **StalenessService** (`core/services/staleness.service.ts`): 3 signals + 6 methods (loadStaleCourses, postponeModule, postponeAllModules, etc.)
- [x] **StalenessDashboardPageComponent** (`features/teaching/pages/`):
  - [x] Expandable course rows showing per-module staleness status
  - [x] Per-module "Postpone" and per-course "Postpone All" buttons (30-day snooze)
  - [x] Blue badges for postponed state (`bg-blue-100 text-blue-700`), CalendarClock icon
  - [x] Self-healing: `staleness_postponed_until` ignored once module is actually updated
  - [x] `IS NOT DISTINCT FROM` checks on mutable columns to detect pure-postpone updates
- [x] **Route:** `/teaching/staleness` with `roleGuard('lecturer', 'platform_admin')`
- [x] **Tests:** 51 new tests (20 service + 31 page), 1147 total frontend tests, build OK
- [x] **E2E:** 14 stories (CS-01 to CS-14), all pass, 5 roles tested, 0 bugs found

#### 10H - UI Design Centralization (Complete)
- [x] **@apply Foundation** (`frontend/src/styles.scss`): 28 semantic CSS classes in `@layer components { ... }` — buttons (8), form controls (5), badges (8), cards (2), table (4), text tokens (2), alerts (3). See Section 9 for full reference.
- [x] **Template Migration:** ~32 component files migrated from inline Tailwind to @apply classes. Zero test breakage (tests check text/roles, not CSS classes).
- [x] **5 Shared Angular Components** (`shared/components/`):
  - [x] `LoadingSpinnerComponent` — centered Loader2 icon + message. Used in ~13 loading states.
  - [x] `ErrorAlertComponent` — `alert-error` div with `role="alert"`. Used in ~13 error states.
  - [x] `EmptyStateComponent` — centered icon + message. Used in ~8 empty-data states (no subtitle support — complex empty states stay inline).
  - [x] `StatCardComponent` — `.stat-card` + `.section-label` + bold value. Used in ~9 board pages (4 summary cards each).
  - [x] `StatusBadgeComponent` — maps `BadgeVariant` to `.badge-*` class, uses `<ng-content>`. Used where badge color is dynamic.
- [x] **Consumer Migration:** ~15 page components migrated to use shared components. Test `componentImports` updated accordingly.
- [x] **Inconsistency Normalization:** Error border-radius (→ `rounded-xl`), badge padding (→ `px-2.5`), search input width (→ `w-64`), loading icon size (→ 24), empty state padding (→ `py-12`), table cell padding (→ `px-3`).
- [x] **Tests:** 18 new shared component tests (5 specs), 1222 total frontend tests, build OK

#### 10I - Module Time Estimation (Complete)
- [x] **Migration 00038:** `estimated_duration_minutes INTEGER NOT NULL DEFAULT 15` on `modules` table. Existing modules default to 15 min. No new RLS policies needed (existing 7 module policies cover the new column).
- [x] **`formatDuration()` utility** (`date.utils.ts`): Converts minutes → `"45 min"` / `"1h 30m"` / `"2h"`. 9 test cases.
- [x] **Module form:** "Estimated Duration (minutes)" number input on parent `ModuleFormPageComponent` — applies to all 6 module types (video, PDF, markdown, quiz, exam, external quiz). Default 15, range 1-999. Pre-populated in edit mode.
- [x] **Course card:** Total course duration in footer (Clock icon + formatted duration, e.g., "2h 30m") next to module count.
- [x] **Course detail header:** Total duration computed from `lectures.reduce()`, displayed below description with Clock icon.
- [x] **Lecture accordion:** Per-lecture duration sum in header between title and completion badge.
- [x] **Module item:** Individual module duration after title (`text-xs text-slate-400 tabular-nums`).
- [x] **Module viewer:** Duration in header near navigation counter with Clock icon.
- [x] **Architecture:** Single column on `modules` + client-side aggregation via `reduce()`. No denormalized columns, no triggers, no new RLS policies. Consistent with existing `moduleCount`/`progressPercent` patterns.
- [x] **Tests:** 9 new formatDuration tests, ~44 existing test fixes (mock factories + inline mock updates), 1266 total frontend tests, build OK

### Phase 11: Dashboard & Landing Experience

#### 11A - Teaching Overview Page
- [ ] **TeachingOverviewService** (`core/services/teaching-overview.service.ts`): 3 signals + 1 method. 6 parallel lightweight Supabase queries (courses, enrollments, pending exams, pending questions, open issues, modules) + client-side `Map<courseId, count>` aggregation. Staleness computed client-side (reuses StalenessService date arithmetic). No new migration.
- [ ] **TeachingOverviewPageComponent** (`features/teaching/pages/`):
  - [ ] Per-course table with permission badges (Edit/Grade/Read), enrolled count, and cross-domain action item counts
  - [ ] 4 stat cards: Pending Exams, Open Questions, Open Issues, Stale Modules
  - [ ] Expandable rows with direct RouterLinks to teaching board pages and course edit
  - [ ] Filters: search by title + status (All/Needs Attention/All Clear)
  - [ ] Follows exact same visual pattern as sibling teaching pages (10G/5D/6C/7B)
- [ ] **Route:** `/teaching/courses` with `roleGuard('lecturer', 'platform_admin')` — replaces catch-all stub
- [ ] **Sidebar:** Rename "My Courses" → "Teaching Overview" in Teaching section
- [ ] **Tests:** ~41 new tests (15 service + 26 page)

#### 11B - Role-Adaptive Dashboard (Complete)
- [x] **DashboardService** (`features/dashboard/dashboard.service.ts`): Lightweight parallel count queries using `{ count: 'exact', head: true }` pattern. Role-conditional: only fires queries relevant to user's JWT claims. Uses `Promise.allSettled()` for resilience.
  - [x] Pending access requests count (TA, PA)
  - [x] Open issues count (Lecturer, PA)
  - [x] Ungraded exam submissions count (Lecturer with can_grade, PA)
  - [x] Unanswered expert questions count (Lecturer, PA)
  - [x] Total users count (TA, PA)
  - [x] Total courses count (PA)
  - [x] Total tenants count (PA)
- [x] **DashboardActionCardComponent** (`features/dashboard/components/`): Presentational card with icon, count, label, routerLink. Uses .card @apply class + colored icon backgrounds.
- [x] **DashboardComponent rewrite** (`features/dashboard/dashboard.component.ts`): Replace 42-line placeholder with role-adaptive dashboard (~255 lines). 4 sections:
  - [x] Welcome header: time-of-day greeting + full_name (ProfileService) + role badges (StatusBadgeComponent)
  - [x] Needs Your Attention: action item card grid (pending requests, open issues, ungraded exams, unanswered questions) — only for admin/teaching roles
  - [x] Overview stats: StatCard grid (total users, courses, tenants, assigned courses/tenants) — only for admin/teaching/CSM
  - [x] My Courses: top 6 enrolled courses by recent activity using CourseCardComponent + EmptyState fallback
- [x] **Reuses:** CourseService.loadCourses(), CourseCardComponent, ProfileService.profile(), AuthService roles/claims, 5 shared components
- [x] **No new migrations** — all data already exists, RLS auto-scopes counts
- [x] **Tests:** 19 service + 4 action card + 28 page = 51 new tests, 1317 total frontend tests, build OK

#### 11C - Lecturer Display on Course Pages (Complete)
- [x] **Migration 00039** (`supabase/migrations/00039_lecturer_assignments_learner_select.sql`): New RLS SELECT policy `lecturer_assignments_select_authenticated` on `lecturer_course_assignments` — allows any authenticated user to read lecturer assignments (data is non-sensitive, course access already gated by `tenant_courses`).
- [x] **Model changes** (`core/models/course.model.ts`): `CourseLecturer` interface (user_id, full_name, email, avatar_url). Added `lecturers: CourseLecturer[]` to both `CourseWithProgress` and `CourseDetail`.
- [x] **CourseService** (`core/services/course.service.ts`):
  - [x] `loadCourses()`: 5th parallel query on `lecturer_course_assignments` with FK join to `profiles!user_id`. Builds `Map<courseId, CourseLecturer[]>`, attaches to each course.
  - [x] `loadCourseDetail()`: 4th parallel query scoped to specific courseId.
  - [x] `#resolveAvatarUrls()`: Batch avatar resolution using `createSignedUrls()` on `avatars` bucket (same pattern as `#resolveThumbnailUrls()`).
- [x] **CourseCardComponent** (`features/courses/components/`): Overlapping avatar stack (w-8 h-8, `flex -space-x-2`) between description and progress bar. `displayedLecturers()` (first 3), `lecturerLabel()` ("Name1, Name2" / "Name1 +N more"), `getInitials()` helper.
- [x] **CourseDetailPageComponent** (`features/courses/pages/`): "Instructors" section with avatar chips — each lecturer as `bg-white border rounded-xl` card with w-8 h-8 avatar, name, and email. Initials fallback for no-avatar lecturers.
- [x] **AskExpertComponent** (`features/courses/components/`): New `lecturers` input. Expert identity shown in all 3 states — collapsed (avatar stack + names below button), open form ("Your question goes to {names}"), success ("{names} will be notified"). Falls back to generic text when no lecturers.
- [x] **ModuleViewerPageComponent**: Passes `courseService.courseDetail()?.lecturers ?? []` to `<app-ask-expert>`.
- [x] **Mock factories** (`__mocks__/course.mock.ts`): `lecturers: []` defaults in `createMockCourseWithProgress()` and `createMockCourseDetail()`. New `createMockCourseLecturer()` factory.
- [x] **Tests:** 6 course card + 4 course detail + 4 ask expert + 5 dashboard/service fixes = 19 test changes, 1377 total frontend tests, build OK

#### 11D - User Avatars Across Platform (Complete)
- [x] **No new migrations** — `profiles.avatar_url` already exists, avatars bucket + signed URLs already work.
- [x] **Shared `resolveAvatarUrls()` utility** (`core/utils/avatar.utils.ts`): Generic batch resolver with deduplication. `Map<path, indices[]>` ensures 30 comments from 8 users = 8 signed URL requests. Also exports `getInitials(name: string)` (replaces 3+ duplicated implementations).
- [x] **UserAvatarComponent** (`shared/components/user-avatar.component.ts`): Shared presentational component replacing 5+ duplicated avatar/initials patterns. 4 sizes (xs=24px, sm=32px, md=40px, lg=112px), 2 color variants (teal, slate), `extraClass` input for stacked borders. `OnPush`, standalone, no service injection.
- [x] **Model updates** — added `avatar_url: string | null` to 4 interfaces:
  - [x] `CommentAuthor` in `comment.model.ts`
  - [x] `QuestionAsker` in `expert-question.model.ts`
  - [x] `IssueReporter` in `issue.model.ts`
  - [x] `GradingSubmission.learner_avatar_url` in `course.model.ts`
- [x] **Service FK join updates** (5 services + 1 refactor):
  - [x] `CommentService`: FK join adds `avatar_url`, batch resolve for all comment + reply authors
  - [x] `ExpertQuestionService`: FK join adds `avatar_url`, resolve askers
  - [x] `IssueService`: FK join adds `avatar_url`, resolve reporters
  - [x] `ExamGradingService`: FK join adds `avatar_url`, wrapper approach for flattened model
  - [x] `UserManagementService`: added `resolveAvatarUrls()` call (already had `avatar_url` via `SELECT *`)
  - [x] `CourseService`: refactored `#resolveAvatarUrls()` to delegate to shared utility
- [x] **Template updates** (9 components):
  - [x] Header: replaced inline avatar/initials with `<app-user-avatar size="sm">`
  - [x] CommentSection: replaced teal initials (sm) + slate reply initials (xs)
  - [x] CourseCard: replaced inline lecturer avatar
  - [x] QuestionsBoardPage: avatar + text combo in Learner column
  - [x] IssueManagementPage: avatar + text combo in Reporter column
  - [x] ExamGradingPage: avatar + text combo in Learner column
  - [x] UserManagementPage: replaced slate initials with shared component
  - [x] Dashboard: added current user avatar next to greeting
  - [x] ProfilePage: no change (kept camera overlay pattern, already works)
- [x] **Notifications excluded** — no `actor_id` field, would need migration + 13 trigger updates. Separate future phase.
- [x] **Tests:** 20 new tests (12 avatar utils + 8 user-avatar component), 1397 total frontend tests, build OK

#### 11E - Audio Module + Downloadable Files Module (Complete)
- [x] **Migration 00040** (`supabase/migrations/00040_audio_and_download_module_types.sql`): Extends `module_type` enum with `audio` and `download`. Creates `module_audio` table (file_url, file_name, file_size, duration_seconds, mime_type) and `module_downloads` table (file_url, file_name, file_size). 18 RLS policies (9 per table) matching existing subtable pattern using `jwt_claim()` / `jwt_claim_array()`.
- [x] **SupabaseTusUploadService** (`core/services/supabase-tus-upload.service.ts`): Reusable TUS resumable upload service for large files (200-500MB). Uses `tus-js-client` v4.3.1, 6MB chunk size (Supabase requirement), direct storage hostname (bypasses Kong gateway). Signals: `uploading`, `progress`, `error`, `uploadedPath`. Supports abort and resume. Pattern follows existing `BunnyUploadService`.
- [x] **Shared `formatFileSize()` utility** (`core/utils/file.utils.ts`): Extracted from 2 duplicate implementations. Handles null, bytes, KB, MB, GB.
- [x] **AudioFormComponent** (`features/courses/components/audio-form.component.ts`): TUS upload form for audio files (MP3/WAV, max 200MB). Optional duration field (minutes → seconds conversion). Uses `FileUploadComponent` + `SupabaseTusUploadService`. Abort on destroy via `DestroyRef`.
- [x] **AudioViewerComponent** (`features/courses/components/audio-viewer.component.ts`): WaveSurfer.js v7 waveform player. Initializes via `effect()` watching `audio()` input + `viewChild` container signal. Controls: play/pause, time display (mm:ss), volume slider, speed selector (0.5x-2x). Context menu disabled (download deterrent). Loading/error states via shared components.
- [x] **DownloadFormComponent** (`features/courses/components/download-form.component.ts`): TUS upload form for ZIP files (max 500MB). Same pattern as AudioFormComponent minus duration field.
- [x] **DownloadViewerComponent** (`features/courses/components/download-viewer.component.ts`): Presentational card with file info, optional description, and download link. Uses shared `formatFileSize()`. Icons: `FolderArchive`, `Download`.
- [x] **CourseService updates** (`core/services/course.service.ts`): 4 switch-case methods updated (`#fetchModuleContent`, `#insertModuleContent`, `#upsertModuleContent`, `#contentToFormData`) + `#collectModuleStoragePaths()` extended for cleanup.
- [x] **Page updates**: ModuleFormPage (2 type cards + 2 form sections + 2 edit branches), ModuleViewerPage (2 `@case` blocks + `canMarkComplete` updated), ModuleItem (icons + linkable types), ContentManagementPage + StalenessDashboard (icon/label/filter maps).
- [x] **MockAudioViewerComponent** (`__mocks__/audio-viewer.mock.ts`): jsdom-safe mock (WaveSurfer.js can't run in jsdom).
- [x] **Tests:** 58 new frontend tests (9 TUS service + 10 audio form + 6 audio viewer + 8 download form + 6 download viewer + 5 module-form-page + 4 module-viewer-page + 6 file utils + 4 existing spec updates), 1455 total. 26 new RLS tests (13 module_audio + 13 module_downloads — SELECT/INSERT/UPDATE/DELETE per role). Build OK.

---

## 4. FastAPI Endpoints Summary

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/health` | GET | Health check | None |
| `/api/auth/resolve-tenant` | POST | Resolve email domain → tenant + allowed auth methods + idp_hint | None (rate-limited 10/min/IP) |
| `/api/auth/reset-password` | POST | Validate tenant allows email_password, then forward to Supabase admin API | None (rate-limited 5/min/IP) |
| `/api/invite` | POST | ✅ Invite user via `supabase.auth.admin.invite_user_by_email()` (validates tenant + email uniqueness, sends Supabase invite email) | JWT (Tenant Admin, Platform Admin) |
| `/api/reminders/send` | POST | Send reminder emails + log to `reminder_history` (Calypso SMTP) | JWT (Tenant Admin, CSM, Lecturer, Platform Admin) |
| `/api/quiz-results/external` | POST | External quiz results webhook — receives score/passed, inserts into `external_quiz_results`, auto-marks progress via trigger | API Key (`X-API-Key` header) |
| `/api/video/init-upload` | POST | Create Bunny video + return TUS upload credentials | JWT (Platform Admin, Lecturer with can_edit) |
| `/api/video/{id}/status` | GET | Poll Bunny encoding progress + return signed embed URL | JWT (any authenticated) |
| `/api/video/webhook` | POST | Bunny encoding status callback | None (validates library_id) |
| `/api/video/{id}` | DELETE | Delete video from Bunny Stream (cleanup on module/lecture/course delete) | JWT (Platform Admin, Lecturer with can_edit) |

**Note:** All CRUD operations go directly from Angular to Supabase. FastAPI is only used for operations requiring:
- Server-side email sending (SMTP)
- External system integration (webhook)
- Service-role database operations (user creation via invite)
- Bunny Stream API key operations (video upload init, embed URL signing, encoding webhook, video deletion)

---

## 5. Data Flow Summary

- **Angular → Supabase directly** for all CRUD (30 tables), auth, storage uploads, and Realtime subscriptions. RLS policies enforce access at the database level.
- **Angular → FastAPI** only for email sending (invites, reminders), external quiz webhooks, and tenant resolution.
- **Realtime:** Angular subscribes to `notifications` table changes filtered by `user_id=eq.{currentUserId}`.
- See `CLAUDE.md` § Data Layer and § Multi-Tenancy for detailed patterns.

---

## 6. Environment Variables

### 6.1 FastAPI (.env)

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_JWT_SECRET=xxx

# Email (Calypso SMTP)
SMTP_HOST=smtp.calypso-commodities.com
SMTP_PORT=587
SMTP_USERNAME=noreply@calypso-commodities.com
SMTP_PASSWORD=xxx
FROM_EMAIL=noreply@calypso-commodities.com

# Bunny Stream
BUNNY_API_KEY=xxx
BUNNY_LIBRARY_ID=123456
BUNNY_CDN_HOSTNAME=vz-xxxxx-xxx.b-cdn.net
BUNNY_TOKEN_KEY=xxx
```

### 6.2 Angular (environment.ts)

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://xxx.supabase.co',
  supabaseAnonKey: 'eyJ...',
  apiUrl: 'http://localhost:8000/api',
};
```

---

## 7. RLS & Security Summary

**~242 RLS policies** across 30 tables (source of truth: `supabase/migrations/00004_rls_policies.sql` + audit fixes in 00009-00013).

**Access patterns by role:**
- **Learner:** Own data + tenant-scoped shared content (via `tenant_courses`)
- **Tenant Admin:** Own tenant's users, enrollments, progress, comments, issues
- **CSM:** Assigned tenants' data (cross-tenant, read-only)
- **Lecturer:** Assigned courses' data (cross-tenant, can_edit/can_grade flags control write access)
- **Platform Admin:** Full CRUD on everything

**9 security trigger functions:** `custom_access_token_hook`, `handle_new_user`, `password_verification_hook`, `protect_profile_role_fields`, `protect_tenant_critical_fields`, `enforce_platform_roles_master_tenant`, `enforce_master_tenant_assignment`, `enforce_module_course_consistency`, `enforce_exam_submission_course`

**3 progress tracking triggers (00026):** `auto_mark_quiz_completed` (on quiz_attempts), `auto_mark_exam_completed` (on exam_submissions), `reset_progress_on_significant_update` (on modules) — all SECURITY DEFINER with `SET search_path = public`

See `CLAUDE.md` § Schema Quick Reference for the full table-by-table breakdown.

---

## 8. Important Notes

### 8.1 No Public Registration

Users cannot register themselves. Flow:
1. Admin invites user via FastAPI email endpoint
2. User receives email with invite link
3. User sets password and completes profile
4. Profile auto-created via `handle_new_user()` trigger (matches domain → tenant, checks auth method)

Note: `handle_new_user()` enforces per-tenant auth methods from `tenants.settings.auth_methods`.
If an auth method is not allowed for the tenant, no profile is created. Admin invitations bypass this check.

### 8.2 Per-Tenant Auth Methods

Calypso (@calypso-commodities.com) supports all 3 auth methods: `["keycloak_sso","email_password","magic_link"]`.
Client tenants configure their own allowed methods per `tenants.settings.auth_methods` (e.g., Equinor is SSO-only: `["keycloak_sso"]`).

`handle_new_user()` enforces these settings at the database level — if a user authenticates via a method not allowed for their tenant, no profile is created. See `docs/AUTH_SYSTEM.md` Section 8 for the full settings schema.

Additionally, `password_verification_hook` (00013) enforces auth method restrictions at every password sign-in attempt — if a tenant doesn't allow `email_password`, the hook rejects the sign-in even if the user has a valid password.

### 8.3 No Versioning System

Unlike X-Crude, X-Courses has no version management. Content is edited directly:
- Updates go straight to the database (no version history)
- "Significant update" checkbox on module save → resets affected learner progress
- No version comparison or restore functionality
- `created_by` and `updated_by` columns provide basic audit trail

### 8.4 Shared Content Model

Course content (courses, lectures, modules, subtables) has **no tenant_id**. Content is shared across all tenants:
- `tenant_courses` junction table controls which tenants can access which courses
- A course assigned to Santos and Equinor has identical content for both
- User-generated data (progress, comments, quiz attempts, exam submissions, issues) **has tenant_id** for isolation

### 8.5 Videos on Bunny Stream

Videos are uploaded to Bunny Stream via TUS resumable uploads and embedded via Bunny's iframe player:
- `module_videos.bunny_video_id` — Bunny video GUID (used for embed URL + API calls)
- `module_videos.bunny_library_id` — Bunny library ID
- `module_videos.encoding_status` — 0=Queued, 1=Processing, 2=Encoding, 3=Finished (not yet playable), 4=Ready (playable — use `>= 4` for iframe embed), 5=Failed
- `module_videos.duration` / `thumbnail_url` — auto-populated by webhook after encoding
- `module_videos.original_filename` — original upload filename for display
- Upload: Angular → FastAPI `POST /api/video/init-upload` (create video + sign TUS credentials) → browser uploads directly to Bunny via tus-js-client
- Playback: `<iframe src="https://iframe.mediadelivery.net/embed/{library_id}/{video_id}?token={hash}&expires={ts}">` (token-signed, expires after 4h)
- Encoding webhook: Bunny → FastAPI `POST /api/video/webhook` → updates module_videos via service-role Supabase client
- Security: Bunny API key is server-side only (FastAPI), never exposed to frontend. Embed URLs use token authentication (SHA256 signed, time-limited). Referer restriction configured in Bunny dashboard.
- Cleanup on delete: When a video module, lecture, or course is deleted, CourseService collects `bunny_video_id`s before cascade delete and fire-and-forget calls `DELETE /api/video/{id}` for each. Best-effort — failures are logged but don't block the delete.
- Orphan cleanup: Upload without Save leaves video in Bunny — future cleanup cron, not in scope

### 8.6 No AI Chat

AI chat is not in scope for X-Courses v2 (unlike X-Crude which has Claude integration).

### 8.7 JWT Custom Claims Refresh

After role changes (CSM/Lecturer assignments, is_tenant_admin, is_platform_admin), the user must re-login for JWT claims to update. This is acceptable since role changes are rare.

Claims in JWT:
```json
{
  "tenant_id": "uuid",
  "is_tenant_admin": true/false,
  "is_platform_admin": true/false,
  "csm_tenant_ids": ["uuid", ...],
  "lecturer_course_ids": ["uuid", ...],
  "lecturer_can_edit_course_ids": ["uuid", ...],
  "lecturer_can_grade_course_ids": ["uuid", ...]
}
```

### 8.8 Mobile Support

Desktop-first, but must work on mobile:
- Collapsible sidebar
- Responsive tables (horizontal scroll or card view)
- Touch-friendly buttons
- Video player responsive (Bunny handles this)

---

## 9. Styling & Design System Architecture

The UI uses a **two-layer design centralization** system to eliminate copy-pasted Tailwind and ensure consistent styling across ~50 components.

### 9.1 Architecture Overview

| Layer | What | Where | Purpose |
|-------|------|-------|---------|
| **@apply Foundation** | 28 semantic CSS classes | `frontend/src/styles.scss` | Single source for colors, spacing, borders. Change one class → all instances update. |
| **Shared Components** | 5 Angular components | `frontend/src/app/shared/components/` | Eliminates structural HTML duplication (loading spinners, error alerts, stat cards, badges, empty states). |

**The decision rule:** Use `@apply` classes for styling consistency (buttons, inputs, badges, cards, tables). Extract a shared component only when the same **HTML block** (not just the same styles) appears in 8+ places.

### 9.2 Layer 1: @apply Classes

All classes live inside `@layer components { ... }` in `frontend/src/styles.scss`. Components use them as regular CSS classes in templates.

**Buttons (8 classes):**

| Class | Visual |
|-------|--------|
| `.btn-primary` | Teal bg, white text, shadow-sm, hover:teal-700, active:scale-95, disabled states, inline-flex + gap-2 |
| `.btn-primary-full` | Same as btn-primary but `w-full justify-center` |
| `.btn-secondary` | White bg, slate-300 border, hover:bg-slate-50 |
| `.btn-danger` | Rose-50 bg, rose-600 text, rose-200 border, hover:bg-rose-100 |
| `.btn-danger-solid` | Rose-600 bg, white text, smaller padding (px-3 py-1.5) |
| `.btn-ghost` | Text-only, no background, hover darkens text (slate-600→slate-800) |
| `.btn-link` | Smaller (text-xs), underlined, slate-500 |
| `.btn-icon` | Icon-only (p-1.5), hover:bg-slate-100 |

**Form Controls (5 classes):**

| Class | Visual |
|-------|--------|
| `.input-field` | Full-width, rounded-lg, slate-300 border, teal focus ring + border |
| `.select-field` | Same as input-field but without `w-full` (width varies by context) |
| `.search-input` | Fixed `w-64`, left padding for search icon (`pl-9`), teal focus ring |
| `.checkbox-field` | Rounded checkbox, teal color, teal focus ring |
| `.form-label` | Block display, text-sm, font-medium, slate-700, mb-1 |

**Badges (8 classes):**

| Class | Colors |
|-------|--------|
| `.badge` | Base only: inline-flex, rounded-full, px-2.5 py-0.5, text-xs, font-semibold |
| `.badge-success` | Emerald-100 bg, emerald-700 text |
| `.badge-warning` | Amber-100 bg, amber-700 text |
| `.badge-error` | Rose-100 bg, rose-700 text |
| `.badge-info` | Blue-100 bg, blue-700 text |
| `.badge-neutral` | Slate-100 bg, slate-600 text |
| `.badge-primary` | Teal-100 bg, teal-700 text |
| `.badge-purple` | Purple-100 bg, purple-700 text |

**Cards & Tables (6 classes):**

| Class | Visual |
|-------|--------|
| `.card` | White bg, slate-200 border, rounded-xl, shadow-sm |
| `.stat-card` | Extends `.card` + px-4 py-3 |
| `.table-container` | Extends `.card` + overflow-hidden |
| `.table-header` | Slate-50 bg, bottom border (for `<thead>`) |
| `.th` | Cell: px-3 py-3, uppercase, text-xs, semibold, tracking-wide, slate-500 |
| `.table-row` | Bottom border (slate-100), hover:bg-slate-50/50, last:no-border |

**Text Tokens (2 classes):**

| Class | Visual |
|-------|--------|
| `.section-label` | Uppercase, text-xs, semibold, tracking-wide, slate-500 |
| `.page-title` | text-xl, font-bold, slate-900 |

**Alerts (3 classes):**

| Class | Visual |
|-------|--------|
| `.alert-error` | Rose-50 bg, rose-200 border, rose-700 text, rounded-xl |
| `.alert-success` | Emerald-50 bg, emerald-200 border, emerald-700 text, rounded-xl |
| `.alert-warning` | Amber-50 bg, amber-200 border, amber-700 text, rounded-xl |

### 9.3 Layer 2: Shared Components

All in `frontend/src/app/shared/components/`. All use `ChangeDetectionStrategy.OnPush`, `host: { class: 'block' }` (or `'inline'` for StatusBadge).

#### `<app-loading-spinner>`
- **Inputs:** `message` (string, default `'Loading...'`)
- **Renders:** Centered animated Loader2 icon (size 24) + text
- **Usage:** `<app-loading-spinner message="Loading tenants..." />`
- **Replaces:** `<div class="flex items-center justify-center py-12"><lucide-icon [img]="icons.Loader2" ...>...` pattern

#### `<app-error-alert>`
- **Inputs:** `message` (required string)
- **Renders:** `<div class="alert-error" role="alert">{{ message() }}</div>`
- **Usage:** `<app-error-alert [message]="service.error()!" />`
- **Replaces:** `<div class="alert-error" role="alert">{{ error() }}</div>` pattern

#### `<app-empty-state>`
- **Inputs:** `icon` (required LucideIconData), `message` (required string)
- **Renders:** Centered icon (size 40, slate-300) + text paragraph
- **Usage:** `<app-empty-state [icon]="icons.Building2" message="No tenants found." />`
- **Limitation:** No subtitle support. Leave inline if the empty state needs a subtitle or action button.

#### `<app-stat-card>`
- **Inputs:** `label` (required string), `value` (required string | number), `color` (string, default `'text-slate-900'`)
- **Renders:** `.stat-card` div with `.section-label` label + bold `text-2xl tabular-nums` value
- **Usage:** `<app-stat-card label="Pending" [value]="pendingCount()" color="text-amber-600" />`

#### `<app-status-badge>`
- **Inputs:** `variant` (required `BadgeVariant`: `'success'|'warning'|'error'|'info'|'neutral'|'primary'|'purple'`)
- **Renders:** `<span [class]="badgeClass()"><ng-content /></span>` — maps variant to `.badge-*` class
- **Exports:** `BadgeVariant` type for use in consuming components
- **Usage:** `<app-status-badge [variant]="statusVariant()">{{ statusLabel() }}</app-status-badge>`
- **When:** Use when badge color is **dynamic** (determined at runtime). For **static** badges where the color is known at template time, use the `@apply` class directly: `<span class="badge-success">Active</span>`.

### 9.4 Usage Conventions

**Decision guide — when to use what:**

| Scenario | Use | Example |
|----------|-----|---------|
| Button styling | `@apply` class | `<button class="btn-primary">Save</button>` |
| Text input | `@apply` class | `<input class="input-field" />` |
| Static badge (color known at compile time) | `@apply` class | `<span class="badge-success">Active</span>` |
| Dynamic badge (color depends on data) | Shared component | `<app-status-badge [variant]="statusVariant()">...</app-status-badge>` |
| Table structure | `@apply` classes | `.table-container` > `.table-header` > `.th` + `.table-row` |
| Card container | `@apply` class | `<div class="card p-6">...</div>` |
| Loading spinner | Shared component | `<app-loading-spinner message="Loading..." />` |
| Inline error display | Shared component | `<app-error-alert [message]="error()!" />` |
| Empty data state | Shared component | `<app-empty-state [icon]="icons.X" message="No data." />` |
| Summary stat card | Shared component | `<app-stat-card label="Total" [value]="count()" />` |
| Page title | `@apply` class | `<h1 class="page-title">Dashboard</h1>` |

**How to restyle globally:**
- **Change primary color** (teal → blue): Edit `styles.scss` — replace `teal-600`→`blue-600`, `teal-700`→`blue-700`, `teal-500`→`blue-500`, `teal-100`→`blue-100` across relevant classes. One file, ~10 find-and-replace operations.
- **Change badge colors:** Edit the corresponding `.badge-*` class in `styles.scss`.
- **Change card appearance:** Edit `.card` in `styles.scss` — `.stat-card` and `.table-container` derive from it automatically.
- **Change button sizes/padding:** Edit `.btn-primary` etc. in `styles.scss`.

**How to add a new design token:**
1. Add the new `@apply` class in `styles.scss` inside `@layer components { ... }`
2. Use it in component templates as `class="your-new-class"`
3. No Angular code changes, no imports needed — it's pure CSS

**Testing shared components in parent specs:**
- When a parent component uses a shared component that depends on Lucide icons (LoadingSpinner, EmptyState), include **both** the shared component **and** `MockLucideIconComponent` in `componentImports`:
  ```typescript
  componentImports: [MockLucideIconComponent, LoadingSpinnerComponent, EmptyStateComponent, ...]
  ```
- StatCardComponent, ErrorAlertComponent, StatusBadgeComponent have no icon dependency — just include them directly.

**What NOT to do:**
- Don't write inline Tailwind for patterns that already have an `@apply` class (e.g., don't write `bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold...` when `.btn-primary` exists)
- Don't create shared components for patterns with too much variation (tables with 4-7 different column layouts, filter bars with different inputs)
- Don't add inline Tailwind that contradicts the centralized class (e.g., `class="btn-primary bg-blue-600"` — change the class in `styles.scss` instead)
- Don't forget to add new shared components to `componentImports` in consuming component tests

---

## 10. Testing Strategy

### 10.1 Overview

| Test Type | Technology | Location | When to Run |
|-----------|------------|----------|-------------|
| Frontend Unit | Vitest + @testing-library/angular | `frontend/src/**/*.spec.ts` | During development |
| RLS/Database | Vitest + Supabase Branches | `tests/**/*.test.ts` | Before merges |
| FastAPI Unit | pytest | `backend/tests/` | During development |

### 10.2 Frontend Testing

**Technology Stack:**
- Vitest (test runner)
- @testing-library/angular (component rendering)
- @analogjs/vite-plugin-angular (Vite support)
- vi.fn() for mocking

**NPM Scripts:**
```bash
cd frontend
npm test                    # Run once (vitest)
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
npm run test:ui             # Interactive browser UI
```

**Key Files (source of truth — do NOT duplicate code examples here, they drift):**
- `frontend/vitest.config.mts` — Test configuration (Vite + AnalogJS angular plugin)
- `frontend/src/test-setup.mjs` — Angular TestBed initialization. **MUST be `.mjs`**, not `.ts` (Angular Vite plugin silently swallows `.ts` setupFiles)
- `frontend/src/app/__mocks__/` — 10 mock files (supabase, auth, api, toast, router, lucide, tenant, profile, course [incl. progress admin + dashboard progress + comment + expert-question + issue + notification + tenant-management + user-management + access-request + lecturer-assignment], tiptap)

See `CLAUDE.md` § Testing for conventions and patterns.

### 10.3 RLS Testing

Tests run against isolated Supabase branches to avoid production data corruption.

**NPM Scripts:**
```bash
npm run test:rls       # Full suite (creates branch, tests, cleanup)
npm run test:rls:local # Local only (requires env vars)
```

**Key files:** `tests/setup.ts` (factories, adminClient, createClientAs, toDenyAccess matcher), `scripts/test-runner.ts` (branch management). See `CLAUDE.md` § Testing for patterns, gotchas, and permission matrix categories (TEN/XTA/ESC/ROL/INH/CW/EP).

**354 total RLS tests** across 12 files:
- `tenants.test.ts` (10), `profiles.test.ts` (14), `courses.test.ts` (16), `content-hierarchy.test.ts` (26), `content-write.test.ts` (48), `enrollment-progress.test.ts` (48), `quiz-exam.test.ts` (55), `comments.test.ts` (24), `expert-questions.test.ts` (16), `issues.test.ts` (21), `notifications.test.ts` (30), `admin.test.ts` (46)

---

*(Sections 11-12 removed — the Phase 3 checklists above serve as the canonical task tracker.)*
