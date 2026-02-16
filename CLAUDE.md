# X-Courses v2 — Project Instructions

## Project Owner

- **Name:** Eugen Tereschenko
- **Company Email:** et@calypso-commodities.com

## Angular 19 Conventions

All frontend code must follow modern Angular 19 patterns:

- **Standalone only** — no NgModules. Use `strictStandalone` compiler flag.
- **Signals for state** — `signal()`, `computed()`, `linkedSignal()`, `effect()`. Avoid imperative lifecycle hooks (`ngOnInit`, `ngOnChanges`) when signals suffice.
- **Signal inputs/queries** — `input()`, `input.required()`, `viewChild()`, `contentChildren()` instead of decorators.
- **`inject()` over constructors** — no constructor DI, no `super()` chains.
- **`OnPush` always** — every component uses `ChangeDetectionStrategy.OnPush`.
- **Zoneless** — bootstrap with `provideZonelessChangeDetection()`.
- **New control flow** — `@if`, `@for` (with `track`), `@switch` in templates. No `*ngIf`/`*ngFor`/`CommonModule`.
- **`toSignal()` for observables** — convert RxJS streams to signals at the component boundary. Keep RxJS for HTTP/realtime internals.
- **`resource()` for async data** — use declarative `resource()` API where appropriate.
- **`#private` fields** — prefer JS `#` over TS `private` keyword.
- **No unnecessary abstractions** — don't wrap single-use logic in services/utilities prematurely.

## Templates & Styles

- **Inline templates by default** — use `template:` in `@Component`, not `templateUrl`. Angular 2024 RFC removed the old "extract after 3 lines" recommendation. Inline encourages decomposition and makes PRs easier to review. Extract to external `.html` only when a template exceeds ~50 lines.
- **No component style files** — Tailwind handles styling in templates. Use `host: { class: 'block' }` for host element styling. Add inline `styles:` only when you genuinely need SCSS (animations, `:host` pseudo-selectors, 3rd-party overrides). Never generate empty `.scss` files.
- **@apply classes first** — 28 centralized CSS classes in `frontend/src/styles.scss` cover buttons, inputs, badges, cards, tables, alerts, and text tokens. **Always use these instead of raw Tailwind** for common patterns (e.g., `class="btn-primary"` not `class="bg-teal-600 text-white rounded-lg px-4 py-2..."`). Use raw Tailwind only for one-off or layout-specific styling not covered by @apply classes.
- **5 shared components** — `LoadingSpinnerComponent`, `ErrorAlertComponent`, `EmptyStateComponent`, `StatCardComponent`, `StatusBadgeComponent` in `shared/components/` eliminate structural HTML duplication. Use these instead of copy-pasting loading/error/empty/stat patterns. See `docs/x_courses_development_approach.md` § Section 9 for usage details.

## Project Structure

- **Feature-first organization** — `core/`, `shared/`, `features/`, `layout/` at top level. Inside `features/`, group by domain (`auth/`, `courses/`, `quizzes/`, `admin/`), not by type.
- **No barrel files (`index.ts`)** — direct imports only. Barrels cause circular dependencies, impair tree-shaking with esbuild, and slow tests ~2x. Use TypeScript path aliases (`@core/*`, `@shared/*`, `@features/*`) for cleaner imports.
- **Keep file suffixes** — `.component.ts`, `.service.ts`, `.pipe.ts`, `.guard.ts`. Disambiguation matters at 200+ files.
- **`app-` selector prefix** — for all components. Keep it simple and uniform.
- **`-page` suffix for route components** — `course-list-page.component.ts` (smart/routed) vs `course-list.component.ts` (presentational).
- **One component per file** — always.

## Component Patterns

- **Three-tier split:**
  - **Page components (smart)** — in `features/<x>/pages/`. Inject services, manage state, handle routing. Pass data to children.
  - **Presentational components (dumb)** — in `features/<x>/components/` or `shared/components/`. Only `input()` and `output()`. All derived state via `computed()`.
  - **Interactive components (smart-lite)** — components that must trigger mutations (e.g., `CommentForm`, `NotificationBell`). CAN inject a narrow, purpose-built service.
- **Lazy-load all feature routes** — `loadChildren`/`loadComponent` for every feature area. Use `@defer` for heavy within-page sections (below-fold content, role-specific panels, modals).

## Data Layer

- **Feature services wrap Supabase** — `CourseService`, `QuizService`, `ProfileService`, etc. Components never import `SupabaseClient` directly. Services own queries, error handling, and caching.
- **Supabase for CRUD, HttpClient only for FastAPI** — don't mix them up. `ApiService` is exclusively for FastAPI endpoints.
- **Generated DB types** — run `supabase gen types typescript --linked` into `core/models/database.types.ts`. Use `Tables<>` and `QueryData<>` everywhere. Never hand-write table interfaces.
- **Signals in services** — services hold state as `signal()` + `computed()`. No BehaviorSubjects, no NgRx. Use `resource()` in components for parameterized reads with built-in loading/error states.
- **RLS does the security filtering** — never duplicate tenant/role filters client-side. Client-side role checks are purely cosmetic (show/hide UI).

## Routing & Guards

- **Functional guards only** — `CanActivateFn`, not class-based guards (deprecated).
- **`canMatch` for role-based routing** — same URL (`/dashboard`) renders different components per role via `canMatch`. Prevents unauthorized lazy chunk downloads.
- **`roleGuard()` factory** — higher-order function that takes a claim check function. Eliminates guard duplication across 5 roles.
- **Guards read JWT claims from `AuthStore` signal** — decoded once on login, cached reactively, read synchronously. Zero network requests in guards.

## Testing

- **Vitest + @testing-library/angular** — via `@analogjs/vite-plugin-angular`. Not Karma/Jasmine (still in angular.json but unused).
- **MSW for Supabase mocking** — intercept at HTTP level so tests use the real Supabase client code. Factory helpers for auth state (JWT claims, session).
- **Test behavior, not implementation** — query by role/text (`getByRole`, `getByText`), not signal values or CSS classes. Services: test API contract (inputs/outputs).
- **No snapshot tests** — brittle with Tailwind. Use explicit assertions.
- **Mock factories** — `createMockAuthState(role)` returns typed session/claims objects. Shared in `__mocks__/`.

## Styling — Calypso Design System

Full design guide in `docs/STYLING_GUIDE.md`. Architecture and class reference in `docs/x_courses_development_approach.md` § Section 9.

**Use @apply classes from `styles.scss` — NEVER copy raw Tailwind for these patterns:**

```
Buttons:    .btn-base  .btn-primary  .btn-primary-full  .btn-secondary  .btn-danger  .btn-danger-solid  .btn-ghost  .btn-link  .btn-icon  .btn-icon-danger  .btn-sm
Inputs:     .input-field  .select-field  .search-input  .checkbox-field  .form-label  .field-error
Badges:     .badge-success  .badge-warning  .badge-error  .badge-info  .badge-neutral  .badge-primary  .badge-purple
Cards:      .card  .form-card  .card-solid  .card-glass  .stat-card
Headers:    .form-section-header  .form-section-icon-header
Tables:     .table-container  .table-header  .th  .table-row  .table-cell  .expand-panel
Modals:     .modal-backdrop  .glass-panel  .modal-header-gradient
Auth:       .auth-background  .auth-card  .auth-input  .auth-btn-primary  .auth-label
Text:       .section-label  .page-title
Alerts:     .alert-error  .alert-success  .alert-warning
Sidebar:    .sidebar-logo-gradient  .sidebar-nav-active  .sidebar-desktop-collapsed
Patterns:   .option-card  .option-card-selected  .progress-track  .progress-fill  .skeleton-bar  .skeleton-circle  .skeleton-card  .back-link  .dashed-action-btn  .confirm-panel  .drop-zone  .drop-zone-active
Animations: .page-enter  .toast-enter  .notification-enter
```

**Color palette (baked into @apply classes — for reference only, don't use inline):**

```
Primary:    teal-600 / teal-700 (hover) / teal-500 (focus ring) / teal-100 (badge bg)
Success:    emerald-100 bg / emerald-700 text
Error:      rose-100 bg / rose-700 text / rose-600 (solid buttons)
Warning:    amber-100 bg / amber-700 text
Info:       blue-100 bg / blue-700 text
Neutral:    slate-100 bg / slate-600 text
Cards:      white bg / slate-200 border / rounded-xl / shadow-sm
Glassmorphism: bg-white/80 backdrop-blur-sm border-white/20 rounded-2xl shadow-lg (login page only)
```

- **Font:** Inter (`font-sans`). Numbers: always `tabular-nums`.
- **Icons:** Lucide (`lucide-angular`) — `w-4 h-4` (inline), `w-5 h-5` (buttons), `w-6 h-6` (titles). **Never use emojis** in UI — always use Lucide icons instead. For status indicators, use icons like `Check`, `X`, `AlertTriangle`, `Clock`, `Info` etc. rather than emoji characters.
- **Spinning icons (CRITICAL):** **NEVER put `animate-spin` directly on `<lucide-icon>`** — lucide-angular's `@Input('class')` copies host classes to the inner SVG, causing double rotation. Always wrap in a `<span>`: `<span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="16"></lucide-icon></span>`. Move `animate-spin` + spacing classes to the span, keep color/size classes on the icon.
- **Layout:** `flex h-screen`, sidebar `w-64 bg-white border-r`, main `flex-1 bg-slate-50`.
- **Corners:** `rounded-lg` (buttons/inputs), `rounded-xl`/`rounded-2xl` (cards), `rounded-full` (badges/avatars).
- **Transitions:** Use explicit `transition-[props] duration-200` (e.g., `transition-[background-color,border-color,box-shadow]`). **Never use `transition-all`** — it causes unnecessary repaints and interferes with `will-change` optimization.
- **No global dark mode** — dark surfaces are selective accent panels only. Mobile-first, responsive.

## Multi-Tenancy

- **Two data categories — know which is which:**
  - **Shared content** (courses, lectures, modules, quizzes, exams + all subtables) — no `tenant_id`. RLS gates access via `tenant_courses` join. Never add tenant filters to content queries. Course forms never have a tenant picker — courses are global, assignment to tenants is a separate Platform Admin action.
  - **Tenant-isolated user data** (profiles, enrollments, progress, comments, quiz attempts, submissions, notifications, issues) — has `tenant_id`. RLS auto-filters by JWT claim.
- **`tenant_courses` controls course visibility, not enrollment** — a user sees a course if their tenant has a `tenant_courses` row, regardless of enrollment. Enrollment gates quiz/exam/progress access.
- **Three lecturer JWT claims — use the right one:** `lecturer_course_ids` (read), `lecturer_can_edit_course_ids` (show edit UI), `lecturer_can_grade_course_ids` (show grade UI).
- **CSM = tenant-scoped, Lecturer = course-scoped** — CSM sees assigned tenants' data (group by tenant). Lecturer sees assigned courses' data across ALL tenants (group by course). Different access models, different UI groupings.
- **JWT staleness (~1 hour)** — after role/assignment changes, claims update on next token refresh. Show "re-login" message or call `refreshSession()`.
- **Profileless users exist** — authenticated ≠ has a profile. No profile = no JWT claims = zero RLS access. Auth flow must detect and redirect to access request page.
- **Tenant-aware login** — email → resolve tenant (FastAPI) → show allowed auth methods. Not a simple login form. Password reset proxies through FastAPI. See `docs/AUTH_SYSTEM.md`.

## CLI Tools & Deployment

- **Available CLIs:** `supabase` (DB migrations, type generation, branch management), `railway` (backend deployment/logs), `vercel` (frontend deployment/logs), Playwright MCP (E2E browser testing).
- **Deployment is Git-push based** — push to `main` on GitHub auto-deploys: Vercel picks up `frontend/`, Railway picks up `backend/`. Supabase migrations are pushed manually via `supabase db push`. **Always commit and push to GitHub for deployment — never deploy directly from CLI.**
- **Monorepo:** `TereschenkoAI/x-courses-v2` (private, SSH remote). Vercel root: `frontend/`. Railway root: `backend/`.
- **Supabase Cloud:** project ref `ruhdnvtvoxxiodnyyqqf` (Frankfurt). Type generation: `supabase gen types typescript --linked > frontend/src/app/core/models/database.types.ts`.
- **No CI/CD GitHub Actions** — deployment is purely git-based auto-deploy from hosting providers.


## Schema Quick Reference

### 30 Tables — Tenant ID Map

**Shared content (NO `tenant_id` — global, gated by `tenant_courses` join):**
`courses`, `lectures`, `modules`, `module_videos`, `module_pdfs`, `module_markdown`, `module_files`, `quizzes`, `quiz_questions`, `quiz_question_options`, `exams`, `external_quiz_references`, `lecturer_course_assignments`

**Tenant-scoped (HAS `tenant_id` — RLS auto-filters):**
`profiles`, `course_enrollments`, `user_progress`, `comments`, `comment_replies`, `expert_questions`, `issues`, `quiz_attempts`, `exam_submissions`, `external_quiz_results`, `notifications`, `reminder_history`, `access_requests` (nullable), `tenant_courses`, `csm_tenant_assignments`

**Special:** `tenants` (IS the tenant), `quiz_attempt_answers` (no tenant_id — joins via `quiz_attempts.attempt_id`)

### Enum Values (exact strings)

| Enum | Values |
|------|--------|
| `module_type` | `video`, `pdf`, `markdown`, `quiz`, `exam`, `external_quiz`, `audio`, `download` |
| `enrollment_type` | `invite_only`, `password_protected`, `open` |
| `progress_status` | `not_started`, `in_progress`, `completed` |
| `marked_by_type` | `user`, `system`, `admin` |
| `expert_question_status` | `pending`, `answered`, `closed` |
| `issue_type` | `content_error`, `technical`, `accessibility`, `other` |
| `issue_status` | `open`, `investigating`, `resolved`, `closed` |
| `access_request_status` | `pending`, `approved`, `rejected` |
| `quiz_question_type` | `single_choice`, `multiple_choice`, `true_false`, `fill_blank`, `matching`, `short_answer` |
| `notification_type` | `course_assigned`, `new_module`, `progress_reset`, `exam_graded`, `question_answered`, `reminder`, `exam_deadline`, `new_expert_question`, `new_exam_submission`, `new_issue`, `content_staleness`, `new_access_request`, `issue_resolved`, `exam_reset`, `access_request_reviewed` |

### Column Gotchas

- **`quizzes.time_limit`** — INTEGER in **SECONDS** (not minutes). Nullable = no limit.
- **`exams.duration_minutes`** — INTEGER in **MINUTES**. Different unit than quiz time_limit.
- **`modules.module_type`** — column is `module_type`, NOT `type`.
- **`modules.course_id`** — **denormalized** from `lectures.course_id`. Enforced by `enforce_module_course_consistency()` trigger. Must match lecture's course.
- **`course_enrollments`** — has **NO** `enrollment_type` column. That column is on `courses`.
- **`quiz_question_options.is_correct`** — **NEVER expose to learners**. Use `quiz_question_options_safe` view.
- **`quiz_questions.correct_answer`** — **NEVER expose to learners**. Use `quiz_questions_safe` view.
- **`issues.internal_notes`** — hidden from learners/tenant admins. Use `issues_safe` view.
- **`tenants.settings`** — JSONB. Auth methods at key `auth_methods`: array of `["email_password", "magic_link", "keycloak_sso"]`. If absent = all methods allowed.
- **`tenants.is_master`** — only one row can be true (unique partial index). **Cannot be changed after creation** (trigger).
- **`exam_submissions.course_id`** — denormalized, enforced by trigger.
- **`exams.max_file_size`** — bigint, default 50MB (52428800 bytes). `allowed_file_types` default `['application/pdf', 'application/zip']`.
- **`profiles.id`** — references `auth.users(id)`. Is the auth user's UUID, NOT auto-generated.
- **Storage paths** — `avatars/{user_id}/filename`, `course-files/{course_id}/filename`, `exam-submissions/{course_id}/{user_id}/filename`. `storage.foldername(name)` returns **1-indexed** text array.

### Safe Views & RPC Functions

| Function/View | Use For |
|---------------|---------|
| `quiz_questions_safe` | Read quiz questions without `correct_answer` (learner-safe) |
| `quiz_question_options_safe` | Read options without `is_correct` (learner-safe) |
| `issues_safe` | Read issues without `internal_notes` (learner/tenant admin safe) |
| `grade_quiz_attempt(p_attempt_id)` | Server-side quiz grading RPC. Returns `{score, passed, earned_points, total_points}` |
| `get_quiz_results(p_attempt_id)` | Post-submission results. Respects `show_correct_answers` flag |
| `enroll_with_password(p_course_id, p_password)` | Password-protected course enrollment RPC |

## Auth System Reference

### JWT Custom Claims (7 claims, baked at login)

| Claim | Type | Source |
|-------|------|--------|
| `tenant_id` | uuid (as text) | `profiles.tenant_id` |
| `is_tenant_admin` | boolean | `profiles.is_tenant_admin` |
| `is_platform_admin` | boolean | `profiles.is_platform_admin` |
| `csm_tenant_ids` | uuid[] | `csm_tenant_assignments.tenant_id` |
| `lecturer_course_ids` | uuid[] | All `lecturer_course_assignments.course_id` |
| `lecturer_can_edit_course_ids` | uuid[] | Where `can_edit=true` |
| `lecturer_can_grade_course_ids` | uuid[] | Where `can_grade=true` |

**No profile = no claims = zero RLS access.** Claims refresh only on re-login (~1hr token lifetime).

### 5 Roles (computed, no role column)

- **Learner** — implicit, all users. No flag. Self-enroll open courses, take quizzes/exams, comment, report issues.
- **Tenant Admin** — `profiles.is_tenant_admin = true`. Any tenant. Invite users, approve access requests, view tenant progress, delete tenant comments.
- **Platform Admin** — `profiles.is_platform_admin = true`. **Must be on master tenant** (trigger-enforced). Full cross-tenant CRUD.
- **CSM** — via `csm_tenant_assignments` row. **Must be from master tenant.** Scoped to assigned tenants. Can view progress/comments/issues. **Cannot** grade or edit courses.
- **Lecturer** — via `lecturer_course_assignments` row with `can_edit`/`can_grade` booleans. **Must be from master tenant.** Scoped to assigned courses, **cross-tenant** visibility.

### Auth Flow Gotchas

- **Login is tenant-aware:** email → `POST /api/auth/resolve-tenant` (FastAPI) → resolve domain → show allowed auth methods. Not a simple login form.
- **Password reset MUST proxy through FastAPI** (`POST /api/auth/reset-password`). Never call `resetPasswordForEmail()` directly — it sets passwords on SSO-only users without firing `handle_new_user()`.
- **PKCE flow required:** `flowType: 'pkce'` in Supabase client init. Also `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: true`.
- **`password_verification_hook()`** fires on every password sign-in. Blocks if tenant doesn't allow `email_password`.
- **Supabase can't distinguish email+password from magic link** — both show `provider: 'email'`. Frontend must enforce which UI to show.
- **Automatic Identity Linking:** same email via different providers merges into one `auth.users` row. No duplicate profiles.
- **`handle_new_user()` tenant resolution:** (1) email domain → `tenants.domain`, (2) fallback to `raw_user_meta_data.tenant_id` (admin invitations). Both fail → no profile created.
- **`tenants.domain` is UNIQUE** — one email domain = one tenant. One email cannot belong to two tenants.

### FastAPI Endpoints (intentionally thin)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | None | Health check |
| `POST /api/auth/resolve-tenant` | None (rate-limited 10/min/IP) | Resolve email domain → tenant + allowed auth methods |
| `POST /api/auth/reset-password` | None | Validate tenant allows email_password, then forward to Supabase |
| `POST /api/invite` | JWT: Tenant Admin / Platform Admin | Send invitation email via SMTP |
| `POST /api/reminders/send` | JWT: TA / CSM / Lecturer / PA | Send reminder email via SMTP |
| `POST /api/quiz-results/external` | API key / webhook | Receive external quiz results |

**All CRUD goes Angular → Supabase directly. Never add CRUD endpoints to FastAPI.**

## Notification System

- **All notifications are created by database triggers** — never by application code. 13 trigger functions, all SECURITY DEFINER with `BEGIN...EXCEPTION` handlers.
- **Realtime delivery:** Angular subscribes to `postgres_changes` on `notifications` table filtered by `user_id=eq.{currentUserId}`.
- **Users can only SELECT and UPDATE (mark read) their own notifications.** No direct INSERT allowed.
- **Two pg_cron jobs:** exam deadline reminders (hourly, 24h before deadline) and content staleness checks (daily, courses not updated beyond `staleness_threshold_days`).

## E2E Testing with Playwright MCP

- When running E2E tests from a user stories `.md` file, **write the result of each test story back into the same `.md` file immediately after completing it** — do not wait until all stories are done.
- Mark each story with its result (pass/fail) and any bugs found, inline in the `.md` file, as you go.

## Critical "Never Do This" Rules

These rules are NOT covered in other sections and cause hard-to-debug failures:

1. **Never expose `quiz_question_options.is_correct` or `quiz_questions.correct_answer` to learners** — always query `quiz_questions_safe` and `quiz_question_options_safe` views instead of base tables.
2. **Never call `resetPasswordForEmail()` directly from frontend** — must proxy through FastAPI (`POST /api/auth/reset-password`). Direct calls set passwords on SSO-only users.
3. **Never create SECURITY DEFINER functions without `SET search_path = public`** — `supabase_auth_admin` has `search_path=auth`, causing 500 errors on every auth operation.
4. **Never insert notifications from application code** — only database triggers create notifications. There are 13 trigger functions with deduplication and exception handling.
5. **Never set `modules.course_id` independently** — it must match `lectures.course_id` (enforced by `enforce_module_course_consistency()` trigger). Setting it wrong silently breaks RLS.
6. **Never use public Supabase Storage URLs** — always use signed (private) URLs via `createSignedUrl()` or `createSignedUrls()`. Public URLs bypass RLS and expose files to anyone with the link. All three buckets (`avatars`, `course-files`, `exam-submissions`) must remain **private**.

