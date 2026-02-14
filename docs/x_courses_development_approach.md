# X-Courses v2 - Development Approach

---

## 1. Overview

This document describes the development approach for building X-Courses v2 (Multi-Tenant Learning Platform). It is designed to be used alongside `learning-platform-requirements.md` and `supabase/migrations/00001-00033` as context for LLM-assisted development.

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
│  └───────────┘  │  avatars) │       │    │  POST /api/invite       (planned) │
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
  - User invitations (planned — sends email via Calypso SMTP)
  - Reminder emails (sends via Calypso SMTP + logs to `reminder_history`)
  - External quiz results webhook (planned — receives from external quiz platform)
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
│   └── e2e-user-stories/               # E2E test stories (54 content + 6 Bunny + 16 quiz + 11 enrollment + 11 progress + 12 dashboard + 14 comments + 12 questions + 12 issue-mgmt = 148 total)
│
├── supabase/
│   └── migrations/
│       └── 00001-00032                     # Complete schema (30 tables, ~242 RLS policies, auth hooks, security hardening, Keycloak SSO, course+lecture+module CRUD triggers, Bunny Stream support, module immutable fields, external_quiz enum, progress tracking triggers, reminder_history lecturer SELECT fix, quiz grading bypass, matching question RPC, external quiz auto-mark, comment badge triggers, profiles_select_tenant policy)
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
│   │   │   # Planned: invite.py (Phase 9B)
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
│   │   │   ├── __mocks__/                # Test mocks (11 factories + bunny-upload mock via inline provider)
│   │   │   │   ├── supabase.mock.ts      # Multi-tenant aware mock with JWT claims
│   │   │   │   ├── auth.mock.ts          # Session mock with role switching
│   │   │   │   ├── api.mock.ts           # FastAPI client mock
│   │   │   │   ├── toast.mock.ts
│   │   │   │   ├── router.mock.ts
│   │   │   │   ├── lucide.mock.ts
│   │   │   │   ├── tenant.mock.ts
│   │   │   │   ├── profile.mock.ts
│   │   │   │   ├── course.mock.ts        # CourseService + ProgressService + CommentService + ExpertQuestionService + IssueService + CourseWithProgress + CourseDetail + ModuleViewerData + LectureFormData + PdfFormData + ExamFormData + MarkdownFormData + ExternalQuizContent/FormData + EnrolledUser + UserProgressSummary + DashboardUserProgress + QuizForTaking + QuizAttemptResult + Comment/CommentReply + ExpertQuestion + Issue/IssueForBoard factories
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
│   │   │   │       ├── profile.model.ts
│   │   │   │       └── tenant.model.ts
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── sidebar/
│   │   │   │   │   ├── sidebar.component.ts        # Role-aware nav, mobile overlay, desktop static
│   │   │   │   │   ├── sidebar.component.spec.ts
│   │   │   │   │   └── sidebar-nav.config.ts       # 6 sections, 16 items, filterNavSections()
│   │   │   │   ├── header/
│   │   │   │   │   ├── header.component.ts          # Hamburger, notification bell, user menu dropdown
│   │   │   │   │   └── header.component.spec.ts
│   │   │   │   └── main-layout/
│   │   │   │       ├── main-layout.component.ts     # Shell: sidebar + header + <router-outlet>
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
│   │   │   │   ├── teaching/             # ✅ Phase 5D + 6C + 7B complete
│   │   │   │   │   └── pages/
│   │   │   │   │       ├── exam-grading-page.component.ts       # Smart: cross-course exam grading dashboard (Phase 5D)
│   │   │   │   │       ├── exam-grading-page.component.spec.ts
│   │   │   │   │       ├── questions-board-page.component.ts    # Smart: expert questions board with filters, summary cards, expandable rows, inline response form (Phase 6C)
│   │   │   │   │       ├── questions-board-page.component.spec.ts
│   │   │   │   │       ├── issue-management-page.component.ts   # Smart: issue management board with 4 filters, 5 summary cards, expandable rows, inline status+notes editing (Phase 7B)
│   │   │   │   │       └── issue-management-page.component.spec.ts
│   │   │   │   │
│   │   │   │   │                         # --- Planned (not yet built) ---
│   │   │   │   ├── quizzes/              # Phase 5A quiz-taking components live in courses/components/ (quiz-question, quiz-result-item, quiz-taker)
│   │   │   │   ├── exams/                # Phase 5C-5D
│   │   │   │   ├── notifications/        # Phase 8
│   │   │   │   └── admin/                # Phase 9
│   │   │   │
│   │   │   └── shared/
│   │   │       └── components/
│   │   │           ├── stub-page.component.ts  # "Coming soon" placeholder for unbuilt feature routes
│   │   │           ├── file-upload.component.ts       # ✅ Presentational: drag-and-drop file picker, client-side validation (Phase 3C-2)
│   │   │           ├── file-upload.component.spec.ts
│   │   │           ├── tiptap-editor.component.ts     # ✅ Shared: Tiptap v2 WYSIWYG wrapper with toolbar (B/I/S/H2/H3/lists/code/undo/redo) (Phase 3C-3)
│   │   │           └── tiptap-editor.component.spec.ts
│   │   │           # Planned (Phase 10): data-table, confirmation-dialog, loading-spinner,
│   │   │           # empty-state, badge, module-type-icon, toast.service, date-format.pipe
│   │   │
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
- [x] Header with notification bell (hardcoded 0 count for 1G, Realtime in Phase 8) + user menu dropdown (avatar/initials, profile link, sign out)
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

#### 9A - Tenant Management
- [ ] Tenant list (Platform Admin only)
- [ ] Create tenant (name, domain, settings)
- [ ] Edit tenant
- [ ] Course assignment: assign/unassign courses to tenants (manage tenant_courses)
- [ ] CSM assignment: assign CSMs to tenants (manage csm_tenant_assignments, enforces master tenant)
- [ ] **Tests:** TenantManagementComponent, TenantService

#### 9B - User Management
- [ ] User list (role-scoped: Tenant Admin sees own tenant, Platform Admin sees all)
- [ ] Invite user:
  - [ ] Frontend: enter email, select tenant (Platform Admin) or use own tenant (Tenant Admin)
  - [ ] Backend: `POST /api/invite` → send invitation email via Calypso SMTP
  - [ ] Supabase: `auth.admin.inviteUserByEmail()` with `raw_user_meta_data: { tenant_id }`
- [ ] Change user roles:
  - [ ] Toggle is_tenant_admin (Tenant Admin of same tenant, or Platform Admin)
  - [ ] Toggle is_platform_admin (Platform Admin only)
  - [ ] Protected by `protect_profile_role_fields()` trigger
- [ ] View/edit user profiles
- [ ] **Tests:** UserManagementComponent, InviteService

#### 9C - Access Requests
- [ ] Access request list:
  - [ ] Platform Admin: all pending requests
  - [ ] Tenant Admin: requests routed to their tenant (by domain match)
- [ ] Approve: create user invitation → send email
- [ ] Reject: update status to 'rejected'
- [ ] Domain routing logic:
  - [ ] Known domain (matches tenant) → routed to that tenant's admin
  - [ ] Unknown domain → routed to Platform Admin
- [ ] **Tests:** AccessRequestComponent

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

#### 9E - CSM & Lecturer Assignment Management
- [ ] CSM assignments page (Platform Admin only):
  - [ ] List CSM → tenant assignments
  - [ ] Add/remove assignments (validates master tenant user via trigger)
- [ ] Lecturer assignments page (Platform Admin only):
  - [ ] List Lecturer → course assignments
  - [ ] Add/remove assignments (validates master tenant user via trigger)
  - [ ] Toggle can_edit and can_grade flags
- [ ] **Important:** After changing assignments, user must re-login for JWT claims to refresh
- [ ] **Tests:** AssignmentManagementComponents

#### 9F - Admin RLS Tests
- [ ] Tenants: platform admin CRUD, others read own only
- [ ] Tenant courses: platform admin INSERT/DELETE, others read based on tenant
- [ ] CSM assignments: platform admin CRUD, CSM reads own
- [ ] Lecturer assignments: platform admin CRUD, lecturer reads own
- [ ] Profiles: escalation prevention via protect_profile_role_fields trigger
- [ ] Access requests: platform admin + tenant admin based on routing
- [ ] Reminder history: sender-specific INSERT, role-scoped SELECT
- [ ] Master tenant enforcement: cannot assign non-master-tenant users as CSM/Lecturer
- [ ] **Tests:** ~40 RLS tests

---

### Phase 10: Polish & Final Testing

#### 10A - Error Handling
- [ ] Global HTTP error interceptor
- [ ] Toast notifications for success/error/info
- [ ] Retry logic for network errors
- [ ] Graceful degradation (loading states, error states)
- [ ] Auth session expiry handling (redirect to login)

#### 10B - Performance
- [ ] Lazy loading for feature modules
- [ ] Virtual scrolling for large tables (progress dashboard, user lists)
- [ ] Debounce search inputs
- [ ] Optimize RLS queries (verify index usage)

#### 10C - Shared Component Tests
- [ ] DataTableComponent tests
- [ ] ConfirmationDialogComponent tests
- [ ] LoadingSpinnerComponent tests
- [ ] EmptyStateComponent tests
- [ ] BadgeComponent tests
- [ ] FileUploadComponent tests
- [ ] ModuleTypeIconComponent tests

#### 10D - Complete RLS Permission Matrix
- [ ] All 30 tables covered
- [ ] 5-category test organization:
  - [ ] **TEN** — Tenant Isolation (users can't see other tenants' data)
  - [ ] **XTA** — Cross-Tenant Access (lecturers see assigned courses, CSMs see assigned tenants)
  - [ ] **ESC** — Escalation Prevention (no self-promotion, role field protection)
  - [ ] **ROL** — Role-Based Access (correct CRUD per role)
  - [ ] **INH** — Inherited Access (module subtables inherit from course access)
- [ ] **Target:** ~245 total RLS tests

#### 10E - Test Coverage Review
- [ ] Ensure all services have tests
- [ ] Ensure all major components have tests
- [ ] Review and fix any failing tests
- [ ] Generate coverage report
- [ ] Document any intentional gaps

#### 10F - Content Staleness Dashboard
- [ ] Dashboard for Platform Admin + Lecturer (assigned courses)
- [ ] Shows courses not updated beyond staleness_threshold_days
- [ ] Based on MAX(modules.updated_at) per course vs courses.staleness_threshold_days
- [ ] Link to course edit page for quick updates
- [ ] **Tests:** StalenessDashboardComponent

---

## 4. FastAPI Endpoints Summary

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/health` | GET | Health check | None |
| `/api/auth/resolve-tenant` | POST | Resolve email domain → tenant + allowed auth methods + idp_hint | None (rate-limited 10/min/IP) |
| `/api/auth/reset-password` | POST | Validate tenant allows email_password, then forward to Supabase admin API | None (rate-limited 5/min/IP) |
| `/api/invite` | POST | *Planned (Phase 9B)* — Send invitation email (Calypso SMTP) | JWT (Tenant Admin, Platform Admin) |
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
- `frontend/src/app/__mocks__/` — 10 mock files (supabase, auth, api, toast, router, lucide, tenant, profile, course [incl. progress admin + dashboard progress + comment + expert-question + issue + notification], tiptap)

See `CLAUDE.md` § Testing for conventions and patterns.

### 10.3 RLS Testing

Tests run against isolated Supabase branches to avoid production data corruption.

**NPM Scripts:**
```bash
npm run test:rls       # Full suite (creates branch, tests, cleanup)
npm run test:rls:local # Local only (requires env vars)
```

**Key files:** `tests/setup.ts` (factories, adminClient, createClientAs, toDenyAccess matcher), `scripts/test-runner.ts` (branch management). See `CLAUDE.md` § Testing for patterns, gotchas, and permission matrix categories (TEN/XTA/ESC/ROL/INH/CW/EP).

**278 total RLS tests** across 10 files:
- `tenants.test.ts` (10), `profiles.test.ts` (14), `courses.test.ts` (16), `content-hierarchy.test.ts` (26), `content-write.test.ts` (48), `enrollment-progress.test.ts` (48), `quiz-exam.test.ts` (55), `comments.test.ts` (24), `expert-questions.test.ts` (16), `issues.test.ts` (21)

---

*(Sections 11-12 removed — the Phase 3 checklists above serve as the canonical task tracker.)*
