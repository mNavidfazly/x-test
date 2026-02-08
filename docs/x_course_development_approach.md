# X-Course v2 - Development Approach

---

## 1. Overview

This document describes the development approach for building X-Course v2 (Multi-Tenant Learning Platform). It is designed to be used alongside `learning-platform-requirements.md` and `supabase/migrations/00001-00013` as context for LLM-assisted development.

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Schema-First** | Database schema is defined completely before any feature work |
| **Isolated Features** | Each feature is self-contained. Changes to one feature don't affect others |
| **Desktop-First** | UI optimized for desktop, but must work on mobile/tablet |
| **Real Auth First** | Multi-provider auth (Azure SSO + email/password + magic link) with per-tenant configuration in Phase 1. Invite-only (no public registration) |
| **Incremental Validation** | Each step is tested and validated before moving to the next |
| **CRUD via Supabase** | All basic CRUD operations go directly from Angular to Supabase |
| **Complex Logic via FastAPI** | Invitations, reminders, external quiz webhooks go through FastAPI |
| **Multi-Tenant Isolation** | Every query respects tenant boundaries via RLS + JWT custom claims |

### 1.2 Technology Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| **Database** | Supabase PostgreSQL + RLS (~236 policies) | Supabase Cloud |
| **Auth** | Supabase Auth (Azure SSO for Calypso, email/password + magic link per-tenant for clients) | Supabase Cloud |
| **Storage** | Supabase Storage (PDFs, files, avatars, exam submissions) | Supabase Cloud |
| **Realtime** | Supabase Realtime (notifications) | Supabase Cloud |
| **Scheduled Jobs** | pg_cron (exam deadlines, content staleness) | Supabase Cloud |
| **Frontend** | Angular 19 + Tailwind CSS v3 + Lucide Icons | Vercel |
| **Backend API** | FastAPI (Python 3.11+) | Railway |
| **Video** | Bunny CDN (streaming URLs, not Supabase Storage) | Bunny CDN |
| **Email** | Calypso SMTP (direct SMTP, not Resend) | Calypso Infrastructure |
| **SSO** | Microsoft Entra ID (for @calypso-commodities.com domain). Phase 2: Keycloak SSO for xLNG cross-product SSO | Microsoft |
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
│  │ PostgreSQL│  │  Storage  │       │    │  POST /api/invite                 │
│  │ + RLS     │  │ (PDFs,    │       │    │  POST /api/reminders/send         │
│  │ + Triggers│  │  exams,   │       │    │  POST /api/quiz-results/external  │
│  └───────────┘  │  avatars) │       │    │  GET  /api/health                 │
│  ┌───────────┐  └───────────┘       │    │                                   │
│  │   Auth    │  ┌───────────┐       │    └───────────────────────────────────┘
│  │ (Azure +  │  │ Realtime  │       │                    │
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
    │ Bunny CDN│  (Video streaming - external URLs stored in module_videos)
    └──────────┘
```

**Key Principles:**
- **Angular → Supabase directly** for all CRUD operations, auth, storage uploads, and Realtime subscriptions
- **Angular → FastAPI** for:
  - User invitations (sends email via Calypso SMTP)
  - Reminder emails (sends via Calypso SMTP)
  - External quiz results webhook (receives from external quiz platform)
- **Notifications** are created automatically via PostgreSQL triggers (SECURITY DEFINER)
- **Videos** are hosted on Bunny CDN — only URLs are stored in the database
- **Deployment** is git-based: push to `main` on GitHub → Vercel auto-deploys `frontend/`, Railway auto-deploys `backend/`

---

## 2. Project Structure

```
x-course-v2/                                  # GitHub monorepo (main branch → auto-deploy)
├── docs/
│   ├── learning-platform-requirements.md
│   ├── x_course_development_approach.md    # This document
│   └── e2e-user-stories/
│
├── supabase/
│   └── migrations/
│       └── 00001-00013                     # Complete schema (30 tables, ~236 RLS policies, auth hooks, security hardening)
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
│   │   │   ├── invite.py                 # POST /api/invite
│   │   │   ├── reminders.py              # POST /api/reminders/send
│   │   │   └── quiz_results.py           # POST /api/quiz-results/external
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── supabase.py               # Supabase Python client (service role)
│   │   │   ├── email.py                  # Calypso SMTP client
│   │   │   └── auth.py                   # JWT verification
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
│   │   │   ├── __mocks__/                # Test mocks
│   │   │   │   ├── supabase.mock.ts      # Multi-tenant aware mock with JWT claims
│   │   │   │   ├── auth.mock.ts
│   │   │   │   ├── api.mock.ts           # FastAPI client mock
│   │   │   │   ├── toast.mock.ts
│   │   │   │   ├── router.mock.ts
│   │   │   │   └── lucide.mock.ts
│   │   │   │
│   │   │   ├── core/
│   │   │   │   ├── services/
│   │   │   │   │   ├── supabase.service.ts
│   │   │   │   │   ├── auth.service.ts   # Azure SSO + email/password + magic link (per-tenant)
│   │   │   │   │   └── api.service.ts    # FastAPI client
│   │   │   │   ├── guards/
│   │   │   │   │   ├── auth.guard.ts
│   │   │   │   │   └── role.guard.ts     # 5-role guard (learner, tenant_admin, platform_admin, csm, lecturer)
│   │   │   │   └── models/
│   │   │   │       ├── course.model.ts
│   │   │   │       ├── module.model.ts
│   │   │   │       ├── profile.model.ts
│   │   │   │       ├── tenant.model.ts
│   │   │   │       ├── quiz.model.ts
│   │   │   │       ├── exam.model.ts
│   │   │   │       └── ...
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── sidebar/              # Role-aware navigation
│   │   │   │   ├── header/               # Notification bell, user menu
│   │   │   │   └── main-layout/
│   │   │   │
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login/            # Tenant-aware: Azure SSO + email/password + magic link
│   │   │   │   │   ├── accept-invite/    # Set password flow
│   │   │   │   │   └── access-request/   # Request access page
│   │   │   │   │
│   │   │   │   ├── courses/
│   │   │   │   │   ├── course-list/      # Enrolled courses with progress bars
│   │   │   │   │   ├── course-detail/    # Lecture accordion, module list
│   │   │   │   │   └── course-form/      # Create/edit (Platform Admin + Lecturer with can_edit)
│   │   │   │   │
│   │   │   │   ├── content/
│   │   │   │   │   ├── lecture-form/     # Lecture CRUD with sort ordering
│   │   │   │   │   ├── module-form/      # 5 module types, Tiptap editor, file uploads
│   │   │   │   │   └── module-viewers/
│   │   │   │   │       ├── video-viewer/     # Bunny CDN player
│   │   │   │   │       ├── pdf-viewer/       # PDF display + download
│   │   │   │   │       ├── markdown-viewer/  # ngx-markdown + Prism.js
│   │   │   │   │       └── module-navigation/ # Previous/next, mark-as-complete
│   │   │   │   │
│   │   │   │   ├── progress/
│   │   │   │   │   ├── progress-dashboard/  # Role-scoped views (5 variants)
│   │   │   │   │   └── progress-tracking/   # Manual marking, frontend % calculation
│   │   │   │   │
│   │   │   │   ├── quizzes/
│   │   │   │   │   ├── quiz-taking/     # 6 question type renderers, timer, randomization
│   │   │   │   │   └── quiz-builder/    # Questions CRUD, options, correct answers
│   │   │   │   │
│   │   │   │   ├── exams/
│   │   │   │   │   ├── exam-module/     # Download + timer + upload + deadline
│   │   │   │   │   └── exam-grading/    # Lecturer: score + feedback, exam reset
│   │   │   │   │
│   │   │   │   ├── comments/
│   │   │   │   │   ├── comment-list/    # Tenant-isolated, expert badges
│   │   │   │   │   └── ask-expert/      # Modal + My Questions page
│   │   │   │   │
│   │   │   │   ├── issues/
│   │   │   │   │   ├── issue-form/      # Type selection, description
│   │   │   │   │   └── issue-dashboard/ # Role-scoped, status workflow
│   │   │   │   │
│   │   │   │   ├── notifications/
│   │   │   │   │   ├── notification-bell/  # Unread count, Realtime subscription
│   │   │   │   │   └── notification-list/  # All notifications, mark as read
│   │   │   │   │
│   │   │   │   └── admin/
│   │   │   │       ├── tenants/         # CRUD, course assignment
│   │   │   │       ├── users/           # Invite, role changes, profiles
│   │   │   │       ├── assignments/     # CSM + Lecturer assignment management
│   │   │   │       ├── access-requests/ # Approve/reject, domain routing
│   │   │   │       └── staleness/       # Content staleness dashboard
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── components/
│   │   │       │   ├── data-table/
│   │   │       │   ├── confirmation-dialog/
│   │   │       │   ├── loading-spinner/
│   │   │       │   ├── empty-state/
│   │   │       │   ├── badge/           # Role badges, status badges
│   │   │       │   ├── file-upload/
│   │   │       │   └── module-type-icon/
│   │   │       ├── pipes/
│   │   │       │   └── date-format.pipe.ts
│   │   │       └── services/
│   │   │           └── toast.service.ts
│   │   │
│   │   └── test-setup.ts               # Angular TestBed initialization
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
│       └── tenant-courses.test.ts
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
  - [x] Create private GitHub repo — `TereschenkoAI/x-course-v2`
  - [x] Push initial commit with `docs/` and `supabase/` folders
- [x] Run database migrations — all 13 applied via `supabase db push` (jwt helpers moved from `auth` to `public` schema for Cloud compatibility)
- [ ] Configure auth:
  - [ ] Microsoft Entra ID SSO (for @calypso-commodities.com domain) — deferred (Azure AD app registration needed)
  - [x] Enable email/password auth — enabled by default, confirmed via `config push`
  - [x] Enable magic link auth — implicit with email provider (uses `signInWithOtp`)
  - [x] Disable public registration — `enable_signup = false` in config.toml, pushed via `supabase config push`
  - [x] Disable public email signup — covered by `enable_signup = false`
  - [x] Set magic link / OTP expiration to 15 minutes — `otp_expiry = 900` in config.toml
  - [x] Use OTP code template — all 4 email templates use `{{ .Token }}` (magic_link, confirmation, invite, recovery)
  - [ ] Configure `xms_edov` optional claim on Azure AD app registration — deferred (Azure Portal needed)
  - [x] Configure per-tenant auth methods in `tenants.settings` — Calypso set to `["azure_sso","email_password","magic_link"]`
  - [x] Configure custom SMTP — Office 365 (`smtp.office365.com:587`, `support@calypso-commodities.com`)
- [x] Configure auth hooks:
  - [x] Custom Access Token Hook → `public.custom_access_token_hook` — enabled via `config push` + GRANTs for `supabase_auth_admin`
  - [ ] Password Verification Hook → requires Team/Enterprise plan (project is Pro)
- [x] Verify master tenant seed data (Calypso, is_master=true, domain='calypso-commodities.com')
- [x] Enable Realtime for `notifications` table
- [x] Verify storage buckets created (avatars, course-files, exam-submissions)
- [x] Enable pg_cron — 4 jobs scheduled: orphaned-users cleanup (daily 3AM), exam-deadline reminder (hourly), content-staleness check (daily midnight), cron-history cleanup (weekly)
- [x] Note credentials — `.env.example` + `.env` created, API keys retrieved via CLI

#### 1B - RLS Test Infrastructure
- [ ] Install dependencies: `vitest @supabase/supabase-js dotenv @faker-js/faker`
- [ ] Create `tests/` directory structure
- [ ] Create `tests/setup.ts`:
  - [ ] adminClient (service role, bypasses RLS)
  - [ ] createClientAs(user) (authenticated client with RLS enforced)
  - [ ] toDenyAccess() custom matcher (SELECT=empty, INSERT=error, UPDATE/DELETE=empty+.select())
  - [ ] Test factories for: tenants, profiles (5 roles), courses, lectures, modules, enrollments, tenant_courses, csm_assignments, lecturer_assignments
  - [ ] cleanupTestData() (FK dependency order)
- [ ] Create `vitest.config.ts` for RLS tests (fork pooling for isolation)
- [ ] Create `scripts/test-runner.ts` (Supabase branch management)
- [ ] Add npm scripts: `test:rls`, `test:rls:local`, `test:rls:watch`
- [ ] Write initial RLS tests for tenants + profiles
- [ ] **Tests:** ~15 initial RLS tests

#### 1C - FastAPI Setup
- [ ] Create FastAPI project structure (`backend/app/main.py`, `config.py`)
- [ ] Configure environment variables (Pydantic BaseSettings, `.env.example`)
- [ ] Setup Supabase Python client (service role for server-side operations)
- [ ] Setup JWT authentication middleware (verify Supabase JWT)
- [ ] Setup SMTP client (Calypso SMTP — host, port, username, password)
- [ ] Create health check endpoint (`GET /api/health`)
- [ ] Commit and push `backend/` to GitHub
- [ ] Connect Railway to GitHub repo (root directory: `backend/`, deploy branch: `main`, auto-deploy on push)
- [ ] Verify connectivity to Supabase

#### 1D - Angular Setup
- [ ] Create Angular 19 project
- [ ] Install and configure Tailwind CSS v3
- [ ] Install Lucide icons (`lucide-angular`)
- [ ] Setup Supabase JS client (SupabaseService)
- [ ] Setup API service for FastAPI (ApiService)
- [ ] Configure environment files (supabaseUrl, supabaseAnonKey, apiUrl)
- [ ] Commit and push `frontend/` to GitHub
- [ ] Connect Vercel to GitHub repo (root directory: `frontend/`, deploy branch: `main`, auto-deploy on push)
- [ ] **Tests:** Basic smoke tests

#### 1E - Frontend Test Infrastructure
- [ ] Install: vitest, @analogjs/vitest-angular, @analogjs/vite-plugin-angular, jsdom, @testing-library/angular
- [ ] Create `vitest.config.mts` with AnalogJS plugin, pool: 'forks'
- [ ] Create `src/test-setup.ts` (Zone.js via @analogjs/vitest-angular/setup-zone)
- [ ] Create mock infrastructure:
  - [ ] `supabase.mock.ts` — Multi-tenant aware mock with JWT claims simulation (tenant_id, is_platform_admin, csm_tenant_ids, lecturer_course_ids, etc.)
  - [ ] `auth.mock.ts` — Session mock with role switching
  - [ ] `api.mock.ts` — FastAPI client mock
  - [ ] `toast.mock.ts`
  - [ ] `router.mock.ts`
  - [ ] `lucide.mock.ts`
- [ ] Add npm scripts: `test`, `test:watch`, `test:coverage`, `test:ui`

#### 1F - Auth Flow
- [ ] Login page (tenant-aware):
  - [ ] Read tenant's `settings.auth_methods` to determine available methods
  - [ ] Azure SSO button (show if tenant allows `azure_sso`)
  - [ ] Email + Password form (show if tenant allows `email_password`)
  - [ ] Magic Link input (show if tenant allows `magic_link`)
  - [ ] Domain detection: user enters email → resolve tenant → show allowed methods
  - [ ] Use PKCE flow (`flowType: 'pkce'` in Supabase client init)
- [ ] Password reset flow:
  - [ ] Proxy through FastAPI (`POST /api/auth/reset-password`)
  - [ ] FastAPI validates tenant allows `email_password` before forwarding to Supabase admin API
  - [ ] Frontend never calls `resetPasswordForEmail()` directly (prevents ghost password on SSO-only users)
- [ ] Tenant resolution:
  - [ ] `POST /api/auth/resolve-tenant` — returns allowed auth methods for email domain
  - [ ] Rate limit: 10 requests/minute/IP
  - [ ] Pre-invite check: verify email doesn't already have a profile before sending invitation
- [ ] Accept invite page (set password)
- [ ] Access request page (enter email → domain routing → pending approval)
- [ ] Auth guard (redirect to login if not authenticated)
- [ ] Role guard with 5-role support:
  - [ ] Learner (implicit — all authenticated users)
  - [ ] Tenant Admin (`is_tenant_admin` from JWT)
  - [ ] Platform Admin (`is_platform_admin` from JWT)
  - [ ] CSM (`csm_tenant_ids.length > 0` from JWT)
  - [ ] Lecturer (`lecturer_course_ids.length > 0` from JWT)
- [ ] Auth service with session management
- [ ] Logout functionality
- [ ] **Tests:** Auth service tests, guard tests

#### 1G - Layout Shell
- [ ] Main layout component
- [ ] Role-aware sidebar navigation:
  - [ ] **All users:** My Courses, Notifications
  - [ ] **Tenant Admin:** + User Management, Progress Dashboard
  - [ ] **CSM:** + Assigned Tenants, Progress Dashboard, Expert Questions
  - [ ] **Lecturer:** + My Courses (teaching), Questions Board, Exam Grading, Progress Dashboard
  - [ ] **Platform Admin:** + All of the above + Tenant Management, Content Management, Staleness Dashboard
- [ ] Header with notification bell (unread count) + user menu
- [ ] Mobile responsive sidebar (overlay on mobile, static on desktop)
- [ ] **Tests:** Layout component tests

---

### Phase 2: Content Read

Goal: Display courses, lectures, and modules with proper tenant-scoped access.

#### 2A - Course List & Detail
- [ ] Course list page (enrolled courses for current user's tenant)
- [ ] Progress bar per course (frontend calculation: completed_modules / total_modules)
- [ ] Course detail page:
  - [ ] Course metadata (title, description, thumbnail, enrollment type)
  - [ ] Lecture accordion (sorted by sort_order)
  - [ ] Module list within each lecture (sorted by sort_order)
  - [ ] Module type icons (video, PDF, markdown, quiz, exam)
  - [ ] Completion status indicators per module
- [ ] CourseService (Supabase queries with tenant_courses join for access)
- [ ] **Tests:** CourseListComponent, CourseDetailComponent

#### 2B - Module Viewers
- [ ] Video viewer (Bunny CDN player — just render video_url from module_videos)
- [ ] PDF viewer (display + download from Supabase Storage via file_url)
- [ ] Markdown viewer (ngx-markdown with Prism.js syntax highlighting, render from module_markdown.content)
- [ ] Downloadable files list (module_files — download links)
- [ ] Module navigation (previous/next within lecture)
- [ ] Mark-as-complete button (inserts/updates user_progress)
- [ ] **Tests:** Each viewer component, module navigation

#### 2C - Content Read RLS Tests
- [ ] Courses: tenant user sees courses via tenant_courses, cannot see unassigned courses
- [ ] Lectures: inherits from course access
- [ ] Modules: inherits from course access (uses denormalized course_id)
- [ ] Module subtables: videos, pdfs, markdown, files inherit from module → course access
- [ ] Platform admin: sees all courses
- [ ] Lecturer: sees assigned courses (cross-tenant)
- [ ] CSM: sees courses assigned to their tenants
- [ ] **Tests:** ~40 RLS tests

---

### Phase 3: Content Write

Goal: Allow Platform Admins and Lecturers (with can_edit) to create and manage course content.

#### 3A - Course CRUD
- [ ] Create course form (Platform Admin only)
- [ ] Edit course form (Platform Admin + Lecturer with can_edit)
- [ ] Course metadata: title, description, thumbnail, enrollment type, password (if password_protected), staleness threshold
- [ ] Assign courses to tenants (Platform Admin — manages tenant_courses)
- [ ] Delete course (Platform Admin only, cascades)
- [ ] created_by / updated_by tracking
- [ ] **Tests:** CourseFormComponent, CourseService

#### 3B - Lecture CRUD
- [ ] Create lecture within course
- [ ] Edit lecture (title, description)
- [ ] Sort ordering (drag-and-drop or up/down buttons)
- [ ] Delete lecture (cascades modules)
- [ ] created_by / updated_by tracking
- [ ] **Tests:** LectureFormComponent

#### 3C - Module CRUD
- [ ] Module type selection (video, PDF, markdown, quiz, exam)
- [ ] Per-type forms:
  - [ ] Video: video_url (Bunny CDN), thumbnail_url, duration
  - [ ] PDF: file upload to Supabase Storage (course-files bucket), file_name, page_count
  - [ ] Markdown: Tiptap WYSIWYG editor (exports markdown for storage in module_markdown.content), attached files (module_files)
  - [ ] Quiz: redirects to Quiz Builder (Phase 3D)
  - [ ] Exam: exam file upload, duration_minutes, passing_score, max_file_size, allowed_file_types
- [ ] Sort ordering within lecture
- [ ] "Significant update" checkbox on save → sets significant_update_at, resets affected progress
- [ ] created_by / updated_by tracking
- [ ] Delete module (cascades subtable)
- [ ] **Tests:** ModuleFormComponent (per type)

#### 3D - Quiz Builder
- [ ] Quiz settings: title, description, time_limit, passing_score, max_attempts, show_correct_answers, randomize_questions, randomize_answers
- [ ] Questions CRUD:
  - [ ] 6 question types: single_choice, multiple_choice, true_false, fill_blank, matching, short_answer
  - [ ] Question text, points, sort_order
  - [ ] Options CRUD (for choice-based types): option_text, is_correct, sort_order
  - [ ] Correct answer (for fill_blank, short_answer)
- [ ] **Tests:** QuizBuilderComponent, QuestionFormComponent

#### 3E - External Quiz Reference
- [ ] External quiz reference form: external_quiz_id, external_quiz_url, passing_score
- [ ] Display "Take External Quiz" button in module viewer
- [ ] **Tests:** ExternalQuizRefComponent

#### 3F - Content Write RLS Tests
- [ ] Platform Admin can INSERT/UPDATE/DELETE courses, lectures, modules, subtables
- [ ] Lecturer with can_edit can INSERT/UPDATE/DELETE on assigned courses
- [ ] Lecturer without can_edit cannot write content
- [ ] Regular tenant user cannot write content
- [ ] CSM cannot write content
- [ ] Tenant Admin cannot write content
- [ ] **Tests:** ~30 RLS tests

---

### Phase 4: Enrollment & Progress

#### 4A - Enrollment System
- [ ] Enrollment flow based on course enrollment_type:
  - [ ] **Open:** Self-enroll button (validates course assigned to user's tenant via tenant_courses)
  - [ ] **Password protected:** Password input modal before enrollment
  - [ ] **Invite only:** Enrolled by Tenant Admin or Platform Admin (insert into course_enrollments)
- [ ] Enrollment service (Supabase direct)
- [ ] Tenant Admin: can enroll users in their tenant
- [ ] Platform Admin: can enroll any user
- [ ] Unenroll functionality (Tenant Admin, Platform Admin)
- [ ] **Tests:** EnrollmentService, enrollment components

#### 4B - Progress Tracking
- [ ] Mark module as complete (user_progress INSERT/UPDATE)
- [ ] Auto-mark on quiz pass (quiz_attempts.passed = true → insert progress as completed, marked_by = 'system')
- [ ] Auto-mark on exam pass (exam_submissions.score >= passing_score → insert progress as completed, marked_by = 'system')
- [ ] Frontend progress calculation:
  ```typescript
  const totalModules = course.lectures.flatMap(l => l.modules).length;
  const completedModules = userProgress.filter(p => p.status === 'completed').length;
  const percentage = (completedModules / totalModules) * 100;
  ```
- [ ] Admin progress override (Tenant Admin, Platform Admin can mark any user's progress)
- [ ] **Tests:** ProgressService, progress tracking components

#### 4C - Progress Dashboard
- [ ] Role-scoped views:
  - [ ] **Learner:** Own progress only (My Courses page with progress bars)
  - [ ] **Tenant Admin:** All users in their tenant, all courses, filter/search
  - [ ] **CSM:** All users in assigned tenants, all courses
  - [ ] **Lecturer:** All users (cross-tenant) for assigned courses only
  - [ ] **Platform Admin:** Everyone, everything, filter by tenant/course
- [ ] Dashboard features:
  - [ ] User list with progress percentage
  - [ ] Filter by course, progress range, last active date
  - [ ] Last active = MAX(user_progress.updated_at)
  - [ ] Bulk select users for reminder emails
- [ ] **Tests:** ProgressDashboardComponent (role-scoped rendering)

#### 4D - Enrollment & Progress RLS Tests
- [ ] Enrollments: self-enroll only in own tenant + assigned courses, tenant admin can enroll in own tenant
- [ ] Progress: own progress read/write, tenant admin reads own tenant, CSM reads assigned tenants
- [ ] Progress: lecturer reads assigned courses (cross-tenant)
- [ ] Progress: platform admin reads all
- [ ] Escalation: learner cannot write other user's progress
- [ ] **Tests:** ~40 RLS tests

---

### Phase 5: Quizzes & Exams

#### 5A - Quiz Taking
- [ ] Quiz start flow: check max_attempts, create quiz_attempt
- [ ] 6 question type renderers:
  - [ ] Single choice (radio buttons)
  - [ ] Multiple choice (checkboxes)
  - [ ] True/false (radio buttons)
  - [ ] Fill in the blank (text input)
  - [ ] Matching (drag-and-drop or dropdowns)
  - [ ] Short answer (textarea)
- [ ] Timer (countdown from time_limit, auto-submit on expire)
- [ ] Question randomization (if quiz.randomize_questions)
- [ ] Answer randomization (if quiz.randomize_answers)
- [ ] Auto-grading on submit:
  - [ ] Calculate score from quiz_attempt_answers vs correct answers
  - [ ] Set quiz_attempts.score, quiz_attempts.passed
  - [ ] If passed → auto-mark module progress as completed
- [ ] Results display: score, pass/fail, questions got wrong, correct answers (if show_correct_answers)
- [ ] **Tests:** QuizTakingComponent, each question type renderer

#### 5B - External Quiz Webhook
- [ ] FastAPI endpoint: `POST /api/quiz-results/external`
- [ ] Request body: `{ external_quiz_id, user_email, score, passed, details }`
- [ ] Lookup user by email → get user_id, tenant_id
- [ ] Insert into external_quiz_results (service role, bypasses RLS)
- [ ] If passed → auto-mark module progress (lookup module via external_quiz_references)
- [ ] API key or webhook signature validation
- [ ] **Tests:** pytest endpoint tests

#### 5C - Exam Flow
- [ ] Exam module display: title, description, duration, file types, passing score
- [ ] "Start Exam" button → download exam file (exam_file_url) + start countdown timer
- [ ] Timer: deadline = now + duration_minutes
- [ ] Upload submission: file validation (type, size), store in exam-submissions bucket
- [ ] Insert exam_submissions record (file_url, deadline, user_id, tenant_id, course_id, exam_id)
- [ ] Deadline enforcement: reject uploads after deadline
- [ ] UNIQUE constraint on (user_id, exam_id) — single submission only
- [ ] **Tests:** ExamModuleComponent

#### 5D - Exam Grading
- [ ] Lecturer grading page (cross-tenant for assigned courses where can_grade = true)
- [ ] Download student submission
- [ ] Enter score + written feedback
- [ ] Update exam_submissions (score, feedback, graded_by, graded_at)
- [ ] Auto-notification via trigger (notify_exam_graded)
- [ ] If passed → auto-mark module progress as completed
- [ ] Exam reset (delete submission → student can retake):
  - [ ] Lecturer (for assigned courses with can_grade)
  - [ ] Platform Admin (any)
- [ ] **Tests:** ExamGradingComponent

#### 5E - Quiz & Exam RLS Tests
- [ ] Quiz attempts: own insert/read, tenant admin read, lecturer read (cross-tenant via quiz → module → course)
- [ ] Quiz answers: own insert/read, lecturer read (cross-tenant)
- [ ] Exam submissions: own insert, own read, lecturer with can_grade read/update/delete, platform admin all
- [ ] External quiz results: own read, lecturer read (cross-tenant), inserts via service role only
- [ ] **Tests:** ~30 RLS tests

---

### Phase 6: Comments & Ask Expert

#### 6A - Comments
- [ ] Comment list per module (tenant-isolated — users only see their tenant's comments)
- [ ] Post comment (user_id + tenant_id from JWT)
- [ ] Expert badges:
  - [ ] Lecturer commenting on assigned course → 🎓 **Expert** badge
  - [ ] CSM / Platform Admin commenting → 🏢 **Calypso** badge
  - [ ] Determine badge from: lecturer_course_assignments + profiles.is_platform_admin + csm_tenant_assignments
- [ ] 1-level replies (comment_replies — reply to comment, no reply to reply)
- [ ] Edit own comments/replies
- [ ] Delete: own, Tenant Admin (own tenant), Platform Admin (all)
- [ ] Lecturer cross-tenant commenting: can comment on modules of assigned courses using the target tenant's tenant_id (validated by RLS via tenant_courses join)
- [ ] **Tests:** CommentListComponent, CommentFormComponent

#### 6B - Ask Expert
- [ ] "Ask Expert" button on module/course view
- [ ] Question modal: text input, shows which course/module
- [ ] Insert into expert_questions (user_id, tenant_id, course_id, module_id, question_text)
- [ ] Auto-notification via trigger (notify_new_expert_question → lecturers + CSMs)
- [ ] "My Questions" page:
  - [ ] List of own questions with status (pending/answered/closed)
  - [ ] View response when answered
- [ ] **Tests:** AskExpertComponent, MyQuestionsComponent

#### 6C - Questions Board (Lecturer)
- [ ] Lecturer dashboard: incoming questions for assigned courses (cross-tenant)
- [ ] Filter by status (pending, answered, closed)
- [ ] Reply to question: update expert_questions (response_text, responded_by, responded_at, status → 'answered')
- [ ] Auto-notification via trigger (notify_question_answered → learner)
- [ ] CSM visibility: can see questions from assigned tenants (read-only awareness, cannot reply)
- [ ] Platform Admin: can see all, can reply
- [ ] **Tests:** QuestionsBoardComponent

#### 6D - Comments & Expert Questions RLS Tests
- [ ] Comments: tenant users see own tenant only, lecturer sees cross-tenant for assigned courses
- [ ] Comments: lecturer INSERT with tenant_courses validation
- [ ] Comment replies: same tenant isolation + lecturer cross-tenant
- [ ] Expert questions: own questions read, tenant admin read (own tenant), CSM read (assigned tenants), lecturer read (assigned courses cross-tenant)
- [ ] Expert questions: lecturer UPDATE (response), platform admin UPDATE
- [ ] **Tests:** ~35 RLS tests

---

### Phase 7: Issue Reporting

#### 7A - Issue Reporting UI
- [ ] "Report Issue" button on module/course
- [ ] Issue type selection: content_error, technical, accessibility, other
- [ ] Description text input
- [ ] Module/course linking (auto-populated from context)
- [ ] Insert into issues table
- [ ] Auto-notification via trigger (notify_new_issue → lecturers + CSMs + platform admins, with deduplication)
- [ ] "My Issues" page: own issues with status
- [ ] **Tests:** IssueFormComponent, MyIssuesComponent

#### 7B - Issue Management
- [ ] Role-scoped issue dashboard:
  - [ ] **Learner:** Own issues only
  - [ ] **Tenant Admin:** All issues from their tenant
  - [ ] **CSM:** Issues from assigned tenants
  - [ ] **Lecturer:** Issues on assigned courses (cross-tenant)
  - [ ] **Platform Admin:** All issues
- [ ] Status workflow: open → investigating → resolved → closed
- [ ] Internal notes (visible to Calypso staff only, not to reporter)
- [ ] Resolved_by, resolved_at tracking
- [ ] **Tests:** IssueDashboardComponent

#### 7C - Issue RLS Tests
- [ ] Issues: own read, tenant admin read (own tenant), CSM read (assigned tenants), lecturer read (assigned courses cross-tenant)
- [ ] Issues: own INSERT, platform admin + lecturer UPDATE (status, internal_notes)
- [ ] Issues: internal_notes not visible to reporter (app-level, not RLS)
- [ ] **Tests:** ~20 RLS tests

---

### Phase 8: Notifications

#### 8A - Notification Service & Bell
- [ ] NotificationService:
  - [ ] Supabase Realtime subscription on `notifications` table (filter: `user_id=eq.{currentUserId}`)
  - [ ] Unread count (notifications where read_at IS NULL)
  - [ ] Mark as read (UPDATE read_at)
  - [ ] Mark all as read
- [ ] Notification bell component (in header):
  - [ ] Unread count badge
  - [ ] Toast popup on new notification
  - [ ] Dropdown/page with notification list
- [ ] Notification list page:
  - [ ] All notifications, sorted by created_at DESC
  - [ ] Click to navigate to related content (via data jsonb)
  - [ ] Mark individual as read
- [ ] **Tests:** NotificationService, NotificationBellComponent, NotificationListComponent

#### 8B - Verify Notification Triggers
All 10 trigger functions in the schema should be verified working:

| # | Trigger | Table | Event | Recipients |
|---|---------|-------|-------|------------|
| 1 | notify_course_assigned | course_enrollments | INSERT | Enrolled learner |
| 2 | notify_new_module | modules | INSERT | All enrolled learners |
| 3 | notify_progress_reset | user_progress | UPDATE | Affected learner |
| 4 | notify_exam_graded | exam_submissions | UPDATE (score set) | Submitting learner |
| 5 | notify_question_answered | expert_questions | UPDATE (response set) | Asking learner |
| 6 | notify_reminder_sent | reminder_history | INSERT | Reminded learner |
| 7 | notify_new_expert_question | expert_questions | INSERT | Assigned lecturers + CSMs |
| 8 | notify_new_exam_submission | exam_submissions | INSERT | Lecturers with can_grade |
| 9 | notify_new_issue | issues | INSERT | Lecturers + CSMs + Platform Admins (deduplicated) |
| 10 | notify_new_access_request | access_requests | INSERT | Tenant admins (if known domain) + Platform admins |

Plus 2 pg_cron jobs (uncomment in migration after enabling pg_cron):
| Job | Schedule | What |
|-----|----------|------|
| exam-deadline-reminder | Every hour | Notify learners 24h before deadline |
| content-staleness-check | Daily midnight | Notify lecturers + admins about stale courses |

- [ ] Test each trigger manually or via integration tests
- [ ] Enable pg_cron and uncomment scheduled jobs

#### 8C - Notification RLS Tests
- [ ] Notifications: own read only, own update only (mark as read)
- [ ] Notifications: no direct INSERT (only via SECURITY DEFINER triggers)
- [ ] **Tests:** ~10 RLS tests

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

#### 9D - Reminder Emails
- [ ] FastAPI endpoint: `POST /api/reminders/send`
- [ ] Request body: `{ user_ids: [], course_id? }`
- [ ] Verify sender authorization:
  - [ ] Tenant Admin: can remind users in own tenant
  - [ ] CSM: can remind users in assigned tenants
  - [ ] Lecturer: can remind users on assigned courses (cross-tenant)
  - [ ] Platform Admin: can remind anyone
- [ ] Send generic reminder email via Calypso SMTP
- [ ] Insert into reminder_history (sent_by enforced by RLS)
- [ ] Auto-notification via trigger (notify_reminder_sent → learner)
- [ ] Integration with Progress Dashboard (bulk select → send reminder)
- [ ] **Tests:** pytest endpoint tests, ReminderService

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
| `/api/invite` | POST | Send invitation email (Calypso SMTP) | JWT (Tenant Admin, Platform Admin) |
| `/api/reminders/send` | POST | Send reminder emails (Calypso SMTP) | JWT (Tenant Admin, CSM, Lecturer, Platform Admin) |
| `/api/quiz-results/external` | POST | External quiz results webhook | API Key / Webhook Signature |

**Note:** All CRUD operations go directly from Angular to Supabase. FastAPI is only used for operations requiring:
- Server-side email sending (SMTP)
- External system integration (webhook)
- Service-role database operations (user creation via invite)

---

## 5. Supabase Direct Operations (from Angular)

| Operation | Table(s) | Notes |
|-----------|----------|-------|
| Login (Azure SSO) | auth | Supabase Auth with Microsoft provider (Calypso employees) |
| Login (Email/Magic Link) | auth | Supabase Auth |
| Accept Invite | auth | Set password |
| List Courses | courses + tenant_courses | RLS filters by tenant |
| Get Course Detail | courses + lectures + modules | With subtable data |
| Create/Edit Course | courses | Platform Admin / Lecturer can_edit |
| CRUD Lectures | lectures | Via course access |
| CRUD Modules | modules + subtables | With type-specific subtable |
| CRUD Quiz Questions | quiz_questions + quiz_question_options | Via quiz → module → course |
| Enroll in Course | course_enrollments | Self-enroll or admin-enroll |
| Track Progress | user_progress | Mark complete, auto-mark |
| Read Progress Dashboard | user_progress | Role-scoped SELECT |
| Take Quiz | quiz_attempts + quiz_attempt_answers | Own insert + auto-grade |
| Submit Exam | exam_submissions | Own insert with deadline |
| Grade Exam | exam_submissions | Lecturer UPDATE (score, feedback) |
| CRUD Comments | comments + comment_replies | Tenant-isolated |
| Ask Expert | expert_questions | Own INSERT |
| Answer Expert Question | expert_questions | Lecturer UPDATE |
| Report Issue | issues | Own INSERT |
| Manage Issue | issues | Lecturer/Admin UPDATE |
| Read Notifications | notifications | Own SELECT |
| Mark Notification Read | notifications | Own UPDATE |
| CRUD Tenants | tenants | Platform Admin |
| Manage Tenant Courses | tenant_courses | Platform Admin |
| CRUD CSM Assignments | csm_tenant_assignments | Platform Admin |
| CRUD Lecturer Assignments | lecturer_course_assignments | Platform Admin |
| Manage Access Requests | access_requests | Platform Admin / Tenant Admin |
| Upload Files | storage (course-files, exam-submissions, avatars) | Role-based bucket policies |

---

## 5.1 Supabase Realtime Subscriptions

Angular subscribes to real-time changes for live updates:

| Subscription | Table | Filter | Purpose |
|-------------|-------|--------|---------|
| Notifications | notifications | `user_id=eq.{currentUserId}` | New notification toasts + bell count |

**Enable Realtime in Supabase:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

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

## 7. RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| tenants | Own + platform admin + CSM (assigned) | Platform admin | Platform admin | Platform admin |
| profiles | Own + tenant admin (same tenant) + platform admin + CSM (assigned) + lecturer (enrolled users) | Auto (trigger on signup) | Own + tenant admin + platform admin (role fields protected by trigger) | - |
| courses | Via tenant_courses + platform admin + lecturer (assigned) | Platform admin | Platform admin + lecturer (can_edit) | Platform admin |
| lectures | Via course access | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) |
| modules | Via course access (denormalized course_id) | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) |
| module_videos/pdfs/markdown/files | Via module → course access | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) |
| quizzes | Via module → course access | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) |
| quiz_questions / options | Via quiz → module → course access | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) |
| exams | Via module → course access | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) |
| external_quiz_references | Via module → course access | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) | Platform admin + lecturer (can_edit) |
| tenant_courses | Own tenant + platform admin + CSM (assigned) | Platform admin | - | Platform admin |
| csm_tenant_assignments | Own + platform admin | Platform admin | - | Platform admin |
| lecturer_course_assignments | Own + platform admin | Platform admin | Platform admin | Platform admin |
| course_enrollments | Own + tenant admin + platform admin + CSM (assigned) + lecturer (assigned courses) | Self (with tenant_courses check) + tenant admin + platform admin | - | Tenant admin + platform admin |
| user_progress | Own + tenant admin + platform admin + CSM (assigned) + lecturer (assigned courses) | Own (with tenant check) | Own + tenant admin + platform admin | - |
| comments | Tenant + platform admin + CSM (assigned) + lecturer (assigned courses cross-tenant) | Own (tenant check) + lecturer (tenant_courses validated) | Own | Own + tenant admin + platform admin |
| comment_replies | Tenant + platform admin + CSM (assigned) + lecturer (cross-tenant) | Own (tenant check) + lecturer (tenant_courses validated) | Own | Own + tenant admin + platform admin |
| expert_questions | Own + tenant admin + platform admin + CSM (assigned) + lecturer (assigned courses) | Own (tenant check) | Lecturer (assigned courses) + platform admin | - |
| issues | Own + tenant admin + platform admin + CSM (assigned) + lecturer (assigned courses) | Own (tenant check) | Platform admin + lecturer (assigned courses) | - |
| quiz_attempts | Own + tenant admin + platform admin + lecturer (cross-tenant via quiz) | Own (tenant check) | Own | - |
| quiz_attempt_answers | Own (via attempt) + platform admin + lecturer (cross-tenant) | Own (via attempt) | - | - |
| exam_submissions | Own + tenant admin + platform admin + lecturer (can_grade, cross-tenant) | Own (tenant check) | Lecturer (can_grade) + platform admin | Lecturer (can_grade) + platform admin |
| external_quiz_results | Own + platform admin + lecturer (cross-tenant) | Service role only (FastAPI webhook) | - | - |
| notifications | Own | Triggers only (SECURITY DEFINER) | Own (mark as read) | - |
| reminder_history | Tenant admin + platform admin + CSM (assigned) | Tenant admin (own tenant) + platform admin (self as sent_by) + CSM (assigned) + lecturer (via user_progress) | - | - |
| access_requests | Platform admin + tenant admin (own tenant) | Anon (status=pending, no reviewed fields) | Platform admin + tenant admin | - |

**Security Features:**
- `protect_profile_role_fields()` trigger prevents privilege escalation on profile updates
- `enforce_platform_roles_master_tenant()` ensures platform admin flag only on master tenant
- `enforce_master_tenant_assignment()` ensures CSM/Lecturer assignments only for master tenant users
- `enforce_module_course_consistency()` validates denormalized course_id on modules
- `enforce_exam_submission_course()` validates course_id on exam submissions

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

All @calypso-commodities.com users use Microsoft Entra ID SSO (configured via `tenants.settings.auth_methods = ["azure_sso"]`).
Client tenants configure their own allowed methods (email/password, magic link, or both).
Phase 2: Keycloak SSO for xLNG cross-product single sign-on.

`handle_new_user()` enforces these settings at the database level — if a user authenticates via a method not allowed for their tenant, no profile is created. See `docs/AUTH_SYSTEM.md` Section 8 for the full settings schema.

Additionally, `password_verification_hook` (00013) enforces auth method restrictions at every password sign-in attempt — if a tenant doesn't allow `email_password`, the hook rejects the sign-in even if the user has a valid password.

### 8.3 No Versioning System

Unlike X-Crude, X-Course has no version management. Content is edited directly:
- Updates go straight to the database (no version history)
- "Significant update" checkbox on module save → resets affected learner progress
- No version comparison or restore functionality
- `created_by` and `updated_by` columns provide basic audit trail

### 8.4 Shared Content Model

Course content (courses, lectures, modules, subtables) has **no tenant_id**. Content is shared across all tenants:
- `tenant_courses` junction table controls which tenants can access which courses
- A course assigned to Santos and Equinor has identical content for both
- User-generated data (progress, comments, quiz attempts, exam submissions, issues) **has tenant_id** for isolation

### 8.5 Videos on Bunny CDN

Videos are **not** stored in Supabase Storage. They're hosted on Bunny CDN:
- `module_videos.video_url` contains the Bunny streaming URL
- `module_videos.thumbnail_url` contains the thumbnail
- Upload workflow is outside scope (admin uploads to Bunny, pastes URL)

### 8.6 No AI Chat

AI chat is not in scope for X-Course v2 (unlike X-Crude which has Claude integration).

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

## 9. Shared Components

Build these early, use everywhere:

| Component | Purpose |
|-----------|---------|
| `DataTableComponent` | Sortable, searchable, paginated table |
| `ConfirmationDialogComponent` | "Are you sure?" dialogs |
| `LoadingSpinnerComponent` | Consistent loading states |
| `EmptyStateComponent` | "No data" messages |
| `BadgeComponent` | Role badges (🎓 Expert, 🏢 Calypso), status badges (open/resolved/etc.) |
| `FileUploadComponent` | File upload with type/size validation |
| `ModuleTypeIconComponent` | Icons for video/PDF/markdown/quiz/exam |
| `ToastService` | Success/error/info toasts |

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

**vitest.config.mts:**
```typescript
import { defineConfig } from 'vitest/config';
import analog from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [analog()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    pool: 'forks',
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
```

**test-setup.ts:**
```typescript
import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed({ zoneless: false });
```

**Key Files:**
- `frontend/vitest.config.mts` - Test configuration
- `frontend/src/test-setup.ts` - Angular TestBed initialization
- `frontend/src/app/__mocks__/` - Service mocks

**Supabase Mock (Multi-Tenant Aware):**
```typescript
// frontend/src/app/__mocks__/supabase.mock.ts

export function createMockSupabaseService(options?: {
  tenantId?: string;
  isPlatformAdmin?: boolean;
  isTenantAdmin?: boolean;
  csmTenantIds?: string[];
  lecturerCourseIds?: string[];
}) {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((resolve) => resolve({ data: [], error: null }))
  };

  return {
    client: {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: 'test-user-id' },
              access_token: 'mock-jwt',
              // JWT claims available for role-based testing
              _claims: {
                tenant_id: options?.tenantId ?? 'test-tenant-id',
                is_platform_admin: options?.isPlatformAdmin ?? false,
                is_tenant_admin: options?.isTenantAdmin ?? false,
                csm_tenant_ids: options?.csmTenantIds ?? [],
                lecturer_course_ids: options?.lecturerCourseIds ?? [],
                lecturer_can_edit_course_ids: [],
                lecturer_can_grade_course_ids: [],
              }
            }
          },
          error: null
        }),
        signOut: vi.fn().mockResolvedValue({ error: null })
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'test/file.pdf' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.supabase.co/file.pdf' } })
        })
      }
    },
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),

    _mockQueryBuilder: mockQueryBuilder,
    _mockQueryResponse: (data: any, error: any = null) => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data, error }));
    },
    _resetMocks: () => {
      Object.values(mockQueryBuilder).forEach((fn: any) => fn.mockClear?.());
    }
  };
}

export type MockSupabaseService = ReturnType<typeof createMockSupabaseService>;
```

**Mock Factory Pattern (All mocks follow this):**
```typescript
import { vi, type Mock } from 'vitest';

// All mocks export factory + type
export function createMockCourseService() {
  return {
    getCourses: vi.fn().mockResolvedValue([]),
    getCourse: vi.fn().mockResolvedValue(null),
    createCourse: vi.fn().mockResolvedValue({ id: 'new-course-id' }),
    updateCourse: vi.fn().mockResolvedValue(true),
    deleteCourse: vi.fn().mockResolvedValue(true)
  };
}
export type MockCourseService = ReturnType<typeof createMockCourseService>;
```

**Component Test Pattern:**
```typescript
import '../../../../test-setup';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { CourseListComponent } from './course-list.component';
import { CourseService } from '../services/course.service';
import { ToastService } from '../../../shared/services/toast.service';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { provideLucideIcons } from '../../../__mocks__/lucide.mock';

describe('CourseListComponent', () => {
  function createMockCourse(overrides?: Partial<Course>): Course {
    return {
      id: 'course-1',
      title: 'Test Course',
      enrollment_type: 'open',
      ...overrides
    };
  }

  function createMockCourseService() {
    return {
      getCourses: vi.fn().mockResolvedValue([]),
      deleteCourse: vi.fn().mockResolvedValue(true)
    };
  }

  async function renderComponent(options?: { courses?: Course[] }) {
    const mockCourseService = createMockCourseService();
    const mockToast = createMockToastService();

    mockCourseService.getCourses.mockResolvedValue(options?.courses ?? []);

    const result = await render(CourseListComponent, {
      providers: [
        provideRouter([]),
        provideLucideIcons(),
        { provide: CourseService, useValue: mockCourseService },
        { provide: ToastService, useValue: mockToast }
      ]
    });

    await vi.waitFor(() => {
      result.fixture.detectChanges();
      expect(result.fixture.componentInstance.isLoading()).toBe(false);
    }, { timeout: 2000 });

    return { ...result, mockCourseService, mockToast };
  }

  it('displays courses', async () => {
    const courses = [
      createMockCourse({ title: 'X-LNG Advanced' }),
      createMockCourse({ id: 'c2', title: 'X-LNG Basics' })
    ];

    await renderComponent({ courses });

    expect(screen.getByText('X-LNG Advanced')).toBeTruthy();
    expect(screen.getByText('X-LNG Basics')).toBeTruthy();
  });
});
```

**Service Test Pattern:**
```typescript
import '../../../../test-setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CourseService } from './course.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockSupabaseService } from '../../../__mocks__/supabase.mock';

describe('CourseService', () => {
  let service: CourseService;
  let mockSupabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseService();

    TestBed.configureTestingModule({
      providers: [
        CourseService,
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    });

    service = TestBed.inject(CourseService);
  });

  describe('getCourses', () => {
    it('returns courses for the user tenant', async () => {
      const mockCourses = [{ id: '1', title: 'X-LNG Advanced' }];
      mockSupabase._mockQueryResponse(mockCourses);

      const courses = await service.getCourses();

      expect(mockSupabase.from).toHaveBeenCalledWith('courses');
      expect(courses).toEqual(mockCourses);
    });
  });
});
```

### 10.3 RLS Testing

**Why Branch-Based:**
Supabase Cloud is production. Tests run against isolated branches to avoid data corruption.

**NPM Scripts:**
```bash
npm run test:rls       # Full suite (creates branch, tests, cleanup)
npm run test:rls:local # Local only (requires env vars)
```

**Test Flow:**
1. Create Supabase branch (`supabase branches create test-run-{timestamp}`)
2. Wait for branch ready (poll until `preview_project_status === 'ACTIVE_HEALTHY'`)
3. Apply migrations via pg.Client (bypasses snapshot lag)
4. Get branch credentials (project_ref, anon_key, service_role_key)
5. Run tests against branch
6. Delete branch (always, even on failure, via finally block)

**Two Client Types:**
```typescript
// 1. Admin Client - Bypasses RLS (for test setup only)
export const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// 2. Authenticated Client - RLS enforced
export async function createClientAs(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  await client.auth.signInWithPassword({
    email: user.email,
    password: user.password
  });

  return client;
}
```

**Custom Matcher: toDenyAccess()**

| Operation | RLS Blocks | Supabase Returns | Detection |
|-----------|-----------|------------------|-----------|
| SELECT | Filters silently | `{ data: [], error: null }` | `data.length === 0` |
| INSERT | Returns error | `{ data: null, error: {...} }` | `error !== null` |
| UPDATE | 0 rows affected | `{ data: [], error: null }` | `data.length === 0` |
| DELETE | 0 rows affected | `{ data: [], error: null }` | `data.length === 0` |

**CRITICAL:** UPDATE/DELETE must chain `.select()` to detect 0 rows!

```typescript
// SELECT: denied if empty array
await expect(
  client.from('courses').select('*').eq('id', unassignedCourseId)
).toDenyAccess('select');

// INSERT: denied if error
await expect(
  client.from('courses').insert({ title: 'Unauthorized Course' })
).toDenyAccess('insert');

// UPDATE: MUST chain .select() for row count!
await expect(
  client.from('courses').update({ title: 'Hacked' }).eq('id', courseId).select()
).toDenyAccess('update');

// DELETE: same pattern
await expect(
  client.from('courses').delete().eq('id', courseId).select()
).toDenyAccess('delete');
```

**Permission Matrix Categories:**
| Prefix | Name | Purpose | Example |
|--------|------|---------|---------|
| TEN | Tenant Isolation | Other tenant's data invisible | Santos user cannot see Equinor's progress |
| XTA | Cross-Tenant Access | Lecturers/CSMs see assigned data | Lecturer sees progress for assigned courses across all tenants |
| ESC | Escalation Prevention | No role self-elevation | Learner cannot set is_platform_admin=true |
| ROL | Role-Based Access | Correct CRUD per role | Tenant Admin can read own tenant's users, not others |
| INH | Inherited Access | Subtables inherit parent access | module_videos access follows module → course access chain |

### 10.4 Test Factories

**Location:** `tests/setup.ts`

| Factory | Purpose |
|---------|---------|
| `createTenant(overrides)` | Create tenant (name, domain, is_master) |
| `createUser(tenantId, role, overrides)` | Create auth.users + profiles entry with role flags |
| `createCourse(overrides)` | Create course |
| `createLecture(courseId, overrides)` | Create lecture in course |
| `createModule(lectureId, courseId, type, overrides)` | Create module (validates denormalized course_id) |
| `createTenantCourse(tenantId, courseId)` | Assign course to tenant |
| `createEnrollment(userId, tenantId, courseId)` | Enroll user in course |
| `createCSMAssignment(userId, tenantId)` | Assign CSM to tenant |
| `createLecturerAssignment(userId, courseId, overrides)` | Assign lecturer to course (can_edit, can_grade) |
| `createQuiz(moduleId, overrides)` | Create quiz for module |
| `createQuizQuestion(quizId, overrides)` | Create quiz question |
| `createExam(moduleId, overrides)` | Create exam for module |
| `createProgress(userId, tenantId, courseId, lectureId, moduleId)` | Create progress record |
| `createComment(userId, tenantId, moduleId, overrides)` | Create comment |
| `createExpertQuestion(userId, tenantId, courseId, overrides)` | Create expert question |
| `createIssue(userId, tenantId, courseId, overrides)` | Create issue |
| `createExamSubmission(userId, tenantId, examId, courseId, overrides)` | Create exam submission |
| `cleanupTestData()` | Delete all test data (FK dependency order) |

**Factory Example:**
```typescript
export async function createUser(
  tenantId: string,
  role: 'learner' | 'tenant_admin' | 'platform_admin',
  overrides: Partial<{ email: string; full_name: string }> = {}
): Promise<TestUser> {
  const email = overrides.email ?? faker.internet.email();
  const password = 'test-password-123';

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { tenant_id: tenantId, full_name: overrides.full_name ?? faker.person.fullName() }
  });

  if (authError) throw new Error(`Failed to create user: ${authError.message}`);

  // Set role flags on profile
  const roleFlags: Partial<Profile> = {};
  if (role === 'tenant_admin') roleFlags.is_tenant_admin = true;
  if (role === 'platform_admin') roleFlags.is_platform_admin = true;

  if (Object.keys(roleFlags).length > 0) {
    await adminClient.from('profiles').update(roleFlags).eq('id', authData.user.id);
  }

  return { id: authData.user.id, email, password, tenantId };
}
```

### 10.5 What to Test When

| Phase | Frontend Tests | RLS Tests |
|-------|----------------|-----------|
| 1 (Foundation) | Auth service, guards, layout | tenants, profiles (~15) |
| 2 (Content Read) | Course list/detail, module viewers | courses, lectures, modules, subtables (~40) |
| 3 (Content Write) | Course/lecture/module forms, quiz builder | Content CRUD operations (~30) |
| 4 (Enrollment & Progress) | Enrollment, progress dashboard | enrollments, user_progress (~40) |
| 5 (Quizzes & Exams) | Quiz taking, exam flow, grading | quiz_attempts, exam_submissions (~30) |
| 6 (Comments & Expert) | Comments, ask expert, questions board | comments, replies, expert_questions (~35) |
| 7 (Issue Reporting) | Issue form, issue dashboard | issues (~20) |
| 8 (Notifications) | Bell, list, realtime | notifications (~10) |
| 9 (Admin) | Tenant/user/assignment management | assignments, access_requests, reminder_history (~40) |
| 10 (Polish) | Shared components | Complete permission matrix (~245 total) |

### 10.6 Permission Matrix Example

```typescript
// tests/access-matrix.test.ts

interface MatrixRow {
  id: string;                      // 'TEN-001', 'XTA-002', etc.
  description: string;
  role: 'learner' | 'tenant_admin' | 'platform_admin' | 'csm' | 'lecturer';
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  expected: 'allow' | 'deny';
  setup?: {
    targetTenant?: 'own' | 'other';
    courseAssigned?: boolean;
    lecturerCanEdit?: boolean;
    lecturerCanGrade?: boolean;
    filters?: Record<string, string>;
    payload?: Record<string, any>;
  };
}

const PERMISSION_MATRIX: MatrixRow[] = [
  // Tenant Isolation
  {
    id: 'TEN-001',
    description: 'Santos learner cannot see Equinor progress',
    role: 'learner',
    table: 'user_progress',
    action: 'select',
    expected: 'deny',
    setup: { targetTenant: 'other' }
  },

  // Cross-Tenant Access
  {
    id: 'XTA-001',
    description: 'Lecturer can see progress for assigned courses (cross-tenant)',
    role: 'lecturer',
    table: 'user_progress',
    action: 'select',
    expected: 'allow',
    setup: { courseAssigned: true }
  },

  // Escalation Prevention
  {
    id: 'ESC-001',
    description: 'Learner cannot set is_platform_admin on own profile',
    role: 'learner',
    table: 'profiles',
    action: 'update',
    expected: 'deny',
    setup: {
      payload: { is_platform_admin: true }
    }
  },

  // Role-Based Access
  {
    id: 'ROL-001',
    description: 'Lecturer without can_edit cannot update course content',
    role: 'lecturer',
    table: 'courses',
    action: 'update',
    expected: 'deny',
    setup: { lecturerCanEdit: false }
  },

  // Inherited Access
  {
    id: 'INH-001',
    description: 'module_videos access follows module → course chain',
    role: 'learner',
    table: 'module_videos',
    action: 'select',
    expected: 'allow',
    setup: { courseAssigned: true }
  }
];
```

### 10.7 Testing Best Practices

**DO:**
- Write tests alongside feature code (not after)
- Use mock factories, not inline mocks
- Test component behavior, not implementation
- Use `screen.getByRole()` over `getByText()` when possible
- Test loading and error states
- Test RLS for all CRUD operations
- Chain `.select()` on UPDATE/DELETE for row count detection
- Test all 5 roles for role-scoped features
- Test cross-tenant access for lecturer and CSM

**DON'T:**
- Skip tests "to save time"
- Test private methods directly
- Mock too much (keep some integration)
- Rely only on UI tests for security
- Forget to test tenant isolation
- Use custom JWT signing (branches have own secrets)
- Forget that role changes require JWT refresh (test with fresh sign-in)

### 10.8 Common Testing Gotchas

**Frontend (Vitest + @analogjs/vitest-angular):**
- Use `async/await` with `fixture.whenStable()` instead of `fakeAsync/tick`
- Use `vi.fn().mockResolvedValue()` instead of `jasmine.createSpy()`
- Tests using `TestBed.resetTestingModule()` must: (1) await `compileComponents()`, (2) provide all injected services as mocks
- Use `vi.spyOn(obj, 'method')` instead of `spyOn(obj, 'method')`
- Mock types: `{ methodName: Mock }` instead of `jasmine.SpyObj<Service>`

**RLS:**
- UPDATE/DELETE must chain `.select()` — otherwise can't detect 0 rows
- Branches have own JWT secrets — use `signInWithPassword()`, not custom JWT
- Apply migrations directly via pg.Client (snapshot lag workaround)
- `NULL = 'value'` returns NULL, not FALSE — watch NULL handling in policies
- Denormalized `course_id` on modules must be validated (trigger enforces this)
- JWT claims are populated via `custom_access_token_hook` — test users need profiles + assignments created before sign-in to get correct claims
- After creating CSM/Lecturer assignments, user must sign-out and sign-in again for claims to update

---

## 11. Checklist Summary

### Phase 1: Foundation
- [ ] Supabase setup + schema + RLS + multi-provider auth (Azure SSO + email/password + magic link)
- [ ] RLS test infrastructure setup (~15 tests)
- [ ] FastAPI setup + deploy to Railway
- [ ] Angular setup + deploy to Vercel
- [ ] Frontend test infrastructure setup
- [ ] Auth flow (Azure SSO + email/password + magic link, per-tenant config, guards, access request) + tests
- [ ] Layout shell (role-aware sidebar, notification bell) + tests

### Phase 2: Content Read
- [ ] Course list + detail + tests
- [ ] Module viewers (video, PDF, markdown, files, navigation, mark complete) + tests
- [ ] Content Read RLS tests (~40 tests)

### Phase 3: Content Write
- [ ] Course CRUD + tests
- [ ] Lecture CRUD + tests
- [ ] Module CRUD (5 types, Tiptap, file uploads, significant update) + tests
- [ ] Quiz Builder (6 question types) + tests
- [ ] External Quiz Reference + tests
- [ ] Content Write RLS tests (~30 tests)

### Phase 4: Enrollment & Progress
- [ ] Enrollment system (3 types) + tests
- [ ] Progress tracking (manual + auto-mark) + tests
- [ ] Progress dashboard (5 role-scoped views) + tests
- [ ] Enrollment & Progress RLS tests (~40 tests)

### Phase 5: Quizzes & Exams
- [ ] Quiz taking (6 renderers, timer, randomize, auto-grade) + tests
- [ ] External quiz webhook (FastAPI) + tests
- [ ] Exam flow (download, timer, upload, deadline) + tests
- [ ] Exam grading (lecturer, cross-tenant, reset) + tests
- [ ] Quiz & Exam RLS tests (~30 tests)

### Phase 6: Comments & Ask Expert
- [ ] Comments (tenant-isolated, badges, replies) + tests
- [ ] Ask Expert (modal, My Questions) + tests
- [ ] Questions Board (lecturer dashboard) + tests
- [ ] Comments & Expert Questions RLS tests (~35 tests)

### Phase 7: Issue Reporting
- [ ] Issue reporting UI + tests
- [ ] Issue management (role-scoped, status workflow) + tests
- [ ] Issue RLS tests (~20 tests)

### Phase 8: Notifications
- [ ] Notification service + bell + list + tests
- [ ] Verify all 10 trigger functions + 2 pg_cron jobs
- [ ] Notification RLS tests (~10 tests)

### Phase 9: Admin
- [ ] Tenant management + tests
- [ ] User management + invite flow + tests
- [ ] Access requests + tests
- [ ] Reminder emails (FastAPI) + tests
- [ ] CSM & Lecturer assignment management + tests
- [ ] Admin RLS tests (~40 tests)

### Phase 10: Polish & Final Testing
- [ ] Error handling
- [ ] Performance
- [ ] Shared component tests
- [ ] Complete RLS permission matrix (~245 total tests)
- [ ] Test coverage review
- [ ] Content staleness dashboard + tests

---

## 12. Getting Started

1. **Create Supabase project** (select EU region if GDPR applies)
2. **Initialize GitHub monorepo** (`git init`, create `.gitignore`, push `docs/` + `supabase/` to private repo)
3. **Run SQL migrations** from `supabase/migrations/00001-00013`
4. **Configure auth:**
   - Add Microsoft Entra ID as OAuth provider (for Calypso employees)
   - Enable email/password auth
   - Disable public email signup (Auth → Providers → Email → disable "Allow new users to sign up")
   - Set OTP expiration to 15 minutes (900 seconds)
   - Use OTP code template (`{{ .Token }}`) instead of clickable magic link
   - Configure `xms_edov` optional claim on Azure AD app registration
   - Enable magic link auth
   - Disable public registration (invite-only via admin)
   - Set per-tenant auth methods in `tenants.settings` (see Section 8.2)
5. **Configure auth hooks:**
   - Custom Access Token Hook → `public.custom_access_token_hook`
   - Password Verification Hook → `public.password_verification_hook`
6. **Enable Realtime** for `notifications` table
7. **Enable pg_cron** extension in Supabase Dashboard
8. **Verify storage buckets** (avatars, course-files, exam-submissions)
9. **Verify seed data** (Calypso master tenant exists)
10. **Note credentials** (URL, anon key, service role key, JWT secret)
11. **Setup RLS test infrastructure** (scripts/test-runner.ts, tests/setup.ts)
12. **Run initial RLS tests** to verify schema
13. **Create FastAPI project** (see Section 2 for structure)
14. **Configure SMTP** (Calypso SMTP host, port, credentials)
15. **Push `backend/` to GitHub** and **connect Railway** (root directory: `backend/`, deploy branch: `main`)
16. **Create Angular project**
17. **Install Tailwind CSS v3 + Lucide Icons**
18. **Setup frontend test infrastructure** (vitest, mocks, test-setup.ts)
19. **Configure Angular environment** (supabaseUrl, supabaseAnonKey, apiUrl)
20. **Push `frontend/` to GitHub** and **connect Vercel** (root directory: `frontend/`, deploy branch: `main`)
21. **Create first Platform Admin user** manually in Supabase
22. **Begin Phase 1F** - Auth flow
