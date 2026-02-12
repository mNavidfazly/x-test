# X-Courses v2 - Development Approach

---

## 1. Overview

This document describes the development approach for building X-Courses v2 (Multi-Tenant Learning Platform). It is designed to be used alongside `learning-platform-requirements.md` and `supabase/migrations/00001-00024` as context for LLM-assisted development.

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
  - Reminder emails (planned — sends via Calypso SMTP)
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
│   └── e2e-user-stories/
│
├── supabase/
│   └── migrations/
│       └── 00001-00024                     # Complete schema (30 tables, ~242 RLS policies, auth hooks, security hardening, Keycloak SSO, course+lecture+module CRUD triggers, Bunny Stream support, module immutable fields)
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
│   │   │   └── auth.py                   # POST /api/auth/resolve-tenant (10/min), POST /api/auth/reset-password (5/min)
│   │   │   ├── video.py                 # POST /api/video/init-upload, GET /api/video/{id}/status, POST /api/video/webhook, DELETE /api/video/{id}
│   │   │   # Planned: invite.py (Phase 9B), reminders.py (Phase 9D), quiz_results.py (Phase 5B)
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
│   │   │   ├── __mocks__/                # Test mocks (10 factories + bunny-upload mock via inline provider)
│   │   │   │   ├── supabase.mock.ts      # Multi-tenant aware mock with JWT claims
│   │   │   │   ├── auth.mock.ts          # Session mock with role switching
│   │   │   │   ├── api.mock.ts           # FastAPI client mock
│   │   │   │   ├── toast.mock.ts
│   │   │   │   ├── router.mock.ts
│   │   │   │   ├── lucide.mock.ts
│   │   │   │   ├── tenant.mock.ts
│   │   │   │   ├── profile.mock.ts
│   │   │   │   ├── course.mock.ts        # CourseService + CourseWithProgress + CourseDetail + ModuleViewerData + LectureFormData + PdfFormData + ExamFormData + MarkdownFormData factories
│   │   │   │   └── tiptap.mock.ts        # MockTiptapEditorComponent (textarea fallback for tests)
│   │   │   │
│   │   │   ├── core/
│   │   │   │   ├── services/
│   │   │   │   │   ├── supabase.service.ts
│   │   │   │   │   ├── auth.service.ts    # Keycloak SSO + email/password + magic link OTP (per-tenant)
│   │   │   │   │   ├── api.service.ts     # FastAPI client (HttpClient wrapper with JWT headers, get/post/delete)
│   │   │   │   │   ├── tenant.service.ts  # Resolve email → tenant + auth methods + idp_hint (caches per email)
│   │   │   │   │   ├── profile.service.ts # Fetch profile (full_name, avatar_url) via effect()
│   │   │   │   │   ├── course.service.ts  # ✅ loadCourseList, loadCourseDetail, loadModuleViewer, markModuleComplete, CRUD (course+lecture+module incl. video/pdf/exam/markdown), module_files CRUD, Bunny video cleanup on delete
│   │   │   │   │   ├── bunny-upload.service.ts  # ✅ BunnyUploadService (TUS upload via tus-js-client, progress signals, pollStatus, deleteVideo)
│   │   │   │   │   └── course.service.spec.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── auth.guard.ts
│   │   │   │   │   └── role.guard.ts      # 5-role guard (learner, tenant_admin, platform_admin, csm, lecturer)
│   │   │   │   └── models/
│   │   │   │       ├── auth.model.ts      # AppUser, JwtClaims, UserRole
│   │   │   │       ├── course.model.ts    # ✅ CourseWithProgress, CourseDetail, ModuleViewerData, CourseFormData, LectureFormData, VideoFormData, PdfFormData, ExamFormData, MarkdownFormData, ExamContent, ModuleSavePayload, union types
│   │   │   │       ├── profile.model.ts
│   │   │   │       └── tenant.model.ts
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── sidebar/
│   │   │   │   │   ├── sidebar.component.ts        # Role-aware nav, mobile overlay, desktop static
│   │   │   │   │   ├── sidebar.component.spec.ts
│   │   │   │   │   └── sidebar-nav.config.ts       # 6 sections, 13 items, filterNavSections()
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
│   │   │   │   ├── courses/               # ✅ Phase 2A + 2B + 3A + 3B + 3C-1 + 3C-2 + 3C-3 + 3C-4 complete
│   │   │   │   │   ├── pages/
│   │   │   │   │   │   ├── course-list-page.component.ts    # Smart: injects CourseService, grid of CourseCards
│   │   │   │   │   │   ├── course-list-page.component.spec.ts
│   │   │   │   │   │   ├── course-detail-page.component.ts  # Smart: course detail + lecture CRUD orchestration (inline editing)
│   │   │   │   │   │   ├── course-detail-page.component.spec.ts
│   │   │   │   │   │   ├── course-form-page.component.ts    # Smart: create/edit course, tenant assignment, delete (Phase 3A)
│   │   │   │   │   │   ├── course-form-page.component.spec.ts
│   │   │   │   │   │   ├── module-form-page.component.ts    # Smart: create/edit module, type selector, video/pdf/exam/markdown forms + module files editor (Phase 3C)
│   │   │   │   │   │   ├── module-form-page.component.spec.ts
│   │   │   │   │   │   ├── module-viewer-page.component.ts  # Smart: video/pdf/markdown viewer, prev/next nav, mark-complete
│   │   │   │   │   │   └── module-viewer-page.component.spec.ts
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── course-card.component.ts          # Presentational: progress bar, action button, badge
│   │   │   │   │   │   ├── course-card.component.spec.ts
│   │   │   │   │   │   ├── lecture-accordion.component.ts    # Presentational: collapsible, module list, X/Y count, edit/delete/reorder buttons
│   │   │   │   │   │   ├── lecture-accordion.component.spec.ts
│   │   │   │   │   │   ├── lecture-form.component.ts         # Presentational: inline lecture create/edit form (title + description)
│   │   │   │   │   │   ├── lecture-form.component.spec.ts
│   │   │   │   │   │   ├── module-item.component.ts          # Presentational: type icon, status badge, RouterLink for video/pdf/markdown
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
│   │   │   │   │   │   └── quiz-form.component.spec.ts
│   │   │   │   │   ├── utils/
│   │   │   │   │   │   ├── quiz-json-template.ts             # Quiz JSON template constant (all 6 types) (Phase 3D)
│   │   │   │   │   │   ├── quiz-json.utils.ts                # validateQuizJson() — shape validation + defaults (Phase 3D)
│   │   │   │   │   │   └── quiz-json.utils.spec.ts
│   │   │   │   │
│   │   │   │   │                         # --- Planned (not yet built) ---
│   │   │   │   ├── content/              # Phase 3C
│   │   │   │   ├── progress/             # Phase 4
│   │   │   │   ├── quizzes/              # Phase 5A
│   │   │   │   ├── exams/                # Phase 5C-5D
│   │   │   │   ├── comments/             # Phase 6
│   │   │   │   ├── issues/               # Phase 7
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
  - [x] Create private GitHub repo — `TereschenkoAI/x-courses-v2`
  - [x] Push initial commit with `docs/` and `supabase/` folders
- [x] Run database migrations — all 24 applied via `supabase db push` (jwt helpers moved from `auth` to `public` schema for Cloud compatibility; 00014 fixes search_path; 00015-00017 Keycloak SSO; 00018 Equinor tenant; 00019-00021 course/lecture/module CRUD triggers; 00022-00023 search_path + immutable fields fixes; 00024 Bunny Stream support)
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
- [x] **Tests:** 60 pytest tests passing (health, auth/JWT, config, tenant service, resolve-tenant, reset-password, idp hint, auth methods, video upload/status/webhook/delete)
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
- [x] Role-aware sidebar navigation (6 sections, 13 nav items, `filterNavSections()` pure function):
  - [x] **All users:** Dashboard, My Courses, Notifications
  - [x] **Tenant Admin:** + User Management, Progress Dashboard
  - [x] **CSM:** + Assigned Tenants, Expert Questions, Progress Dashboard
  - [x] **Lecturer:** + My Courses (teaching), Questions Board, Exam Grading, Progress Dashboard
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
- [x] **Tests:** 14 backend (pytest) + ~20 frontend (vitest) — 60 total backend, 413 total frontend

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
All 13 trigger functions in the schema should be verified working:

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
| 11 | notify_issue_resolved | issues | UPDATE (status→resolved) | Reporter |
| 12 | notify_exam_reset | exam_submissions | DELETE | Student |
| 13 | notify_access_request_reviewed | access_requests | UPDATE (status changed) | Requester + admins |

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
| `/api/auth/resolve-tenant` | POST | Resolve email domain → tenant + allowed auth methods + idp_hint | None (rate-limited 10/min/IP) |
| `/api/auth/reset-password` | POST | Validate tenant allows email_password, then forward to Supabase admin API | None (rate-limited 5/min/IP) |
| `/api/invite` | POST | *Planned (Phase 9B)* — Send invitation email (Calypso SMTP) | JWT (Tenant Admin, Platform Admin) |
| `/api/reminders/send` | POST | *Planned (Phase 9D)* — Send reminder emails (Calypso SMTP) | JWT (Tenant Admin, CSM, Lecturer, Platform Admin) |
| `/api/quiz-results/external` | POST | *Planned (Phase 5B)* — External quiz results webhook | API Key / Webhook Signature |
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
- `frontend/src/app/__mocks__/` — 10 mock factories (supabase, auth, api, toast, router, lucide, tenant, profile, course, tiptap)

See `CLAUDE.md` § Testing for conventions and patterns.

### 10.3 RLS Testing

Tests run against isolated Supabase branches to avoid production data corruption.

**NPM Scripts:**
```bash
npm run test:rls       # Full suite (creates branch, tests, cleanup)
npm run test:rls:local # Local only (requires env vars)
```

**Key files:** `tests/setup.ts` (factories, adminClient, createClientAs, toDenyAccess matcher), `scripts/test-runner.ts` (branch management). See `CLAUDE.md` § Testing for patterns, gotchas, and permission matrix categories (TEN/XTA/ESC/ROL/INH).

---

*(Sections 11-12 removed — the Phase 3 checklists above serve as the canonical task tracker.)*
