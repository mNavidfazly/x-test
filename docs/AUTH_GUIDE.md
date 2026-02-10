# X-Courses v2 — Complete Authentication & Authorization Guide

> A comprehensive guide to understanding how authentication, authorization, and multi-tenancy work in X-Courses v2 — from browser to database and back.
>
> **Audience:** Anyone who wants to understand the full auth design: what it does, how it works, why decisions were made, and what edge cases exist.
>
> **Related:** `AUTH_SYSTEM.md` is the DB-level technical reference. This document covers the entire stack.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Architecture Overview](#2-architecture-overview)
3. [The Five Roles](#3-the-five-roles)
4. [Login Flow — Step by Step](#4-login-flow--step-by-step)
5. [The Three Auth Methods](#5-the-three-auth-methods)
6. [JWT Claims — The Core of Authorization](#6-jwt-claims--the-core-of-authorization)
7. [User Creation — What Happens in the Database](#7-user-creation--what-happens-in-the-database)
8. [Row-Level Security — How Data Access Works](#8-row-level-security--how-data-access-works)
9. [Tenant System](#9-tenant-system)
10. [Per-Tenant Auth Method Enforcement](#10-per-tenant-auth-method-enforcement)
11. [Password Reset Flow](#11-password-reset-flow)
12. [Access Request Flow (No Account Yet)](#12-access-request-flow-no-account-yet)
13. [Session Lifecycle](#13-session-lifecycle)
14. [Route Protection (Frontend)](#14-route-protection-frontend)
15. [Multi-Provider Identity Linking](#15-multi-provider-identity-linking)
16. [Security Hardening](#16-security-hardening)
17. [Edge Cases & Failure Modes](#17-edge-cases--failure-modes)
18. [Keycloak SSO Integration](#18-keycloak-sso-integration)
19. [Known Gaps & Trade-offs](#19-known-gaps--trade-offs)
20. [File Reference](#20-file-reference)

---

## 1. Technology Stack

### Frontend (Angular 19)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Supabase Client | `@supabase/supabase-js` | Auth operations (login, signup, OAuth, OTP), session management, direct DB queries |
| Auth Service | `auth.service.ts` | Signal-based reactive auth state, JWT decoding, role computation |
| Tenant Service | `tenant.service.ts` | Resolves email domain to tenant via FastAPI, caches per domain |
| API Service | `api.service.ts` | HTTP client for FastAPI with automatic Bearer token injection |
| Route Guards | `auth.guard.ts`, `role.guard.ts` | Protect routes based on authentication state and roles |

### Backend (FastAPI / Python)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| JWT Verification | `python-jose` (HS256) | Verify Supabase JWTs using the shared JWT secret (audience verification disabled) |
| Tenant Resolution | `supabase-py` (service role) | Query `tenants` table by email domain (bypasses RLS) |
| Rate Limiting | `slowapi` | 10 req/min on resolve-tenant, 5 req/min on reset-password |
| Password Reset Proxy | `supabase-py` admin API | Forward reset requests after validating tenant auth methods |

### Database (Supabase / PostgreSQL)

| Component | Where | Purpose |
|-----------|-------|---------|
| `handle_new_user()` | Trigger on `auth.users` INSERT | Auto-creates profile, resolves tenant, enforces auth methods |
| `custom_access_token_hook()` | Supabase Auth hook | Bakes 7 custom claims into every JWT |
| `password_verification_hook()` | Supabase Auth hook | Blocks password sign-in for tenants that disallow it |
| `jwt_claim()` / `jwt_claim_array()` | Helper functions | Extract claims from JWT for use in RLS policies |
| 215+ RLS policies | All 30 tables | Enforce data access boundaries per role/tenant |
| Protection triggers | Various tables | Prevent privilege escalation and unauthorized mutations |

### Auth Protocol

- **PKCE (Proof Key for Code Exchange)** — not the implicit flow. Required for SPAs. Configured via `flowType: 'pkce'` in the Supabase client.
- **HS256 JWT signing** — symmetric key shared between Supabase and FastAPI.
- **Token lifetime:** 1 hour (Supabase default), auto-refreshed by the client SDK.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                                │
│                                                                         │
│  Angular App (x-courses-v2.vercel.app)                                   │
│  ├── AuthService          — manages session, decodes JWT, computes roles│
│  ├── TenantService        — resolves email → tenant via FastAPI         │
│  ├── SupabaseService      — configured Supabase client (PKCE)           │
│  ├── Route Guards          — protect routes based on auth/role state    │
│  └── Components            — login, dashboard, etc.                    │
│         │                           │                                   │
│         │ Direct Supabase           │ FastAPI calls                     │
│         │ (auth + CRUD)             │ (auth proxy + email)              │
│         v                           v                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐    ┌──────────────────────────┐               │
│  │   SUPABASE CLOUD     │    │    FASTAPI BACKEND       │               │
│  │   (Frankfurt)        │    │    (Railway)              │               │
│  │                      │    │                           │               │
│  │  Auth Module:        │    │  POST /api/auth/          │               │
│  │  ├─ signInWithPwd    │    │    resolve-tenant         │               │
│  │  ├─ signInWithOtp    │    │  POST /api/auth/          │               │
│  │  ├─ signInWithOAuth  │    │    reset-password         │               │
│  │  └─ signOut          │    │                           │               │
│  │                      │    │  Verifies JWTs with       │               │
│  │  Hooks:              │    │  same HS256 secret        │               │
│  │  ├─ access_token_hook│    │                           │               │
│  │  └─ password_hook    │    │  Uses service_role key    │               │
│  │                      │    │  for admin DB operations  │               │
│  │  PostgreSQL + RLS:   │    └──────────────────────────┘               │
│  │  ├─ 30 tables        │                                               │
│  │  ├─ 215+ policies    │                                               │
│  │  ├─ triggers + hooks │                                               │
│  │  └─ helper functions │                                               │
│  └──────────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Principle: Three-Layer Authorization

1. **Frontend (cosmetic)** — hides UI elements based on decoded JWT claims. Not security. A user who tampers with the UI still hits layer 2 and 3.
2. **Backend (operational)** — FastAPI verifies JWT and checks roles before performing privileged operations (email sending, password resets). Thin layer — only for operations that can't go through Supabase directly.
3. **Database (enforced)** — RLS policies on every table read JWT claims and enforce access. This is the real security boundary. Even if frontend and backend are compromised, the database rejects unauthorized queries.

---

## 3. The Five Roles

There is **no `role` column** in the database. Roles are computed from boolean flags on `profiles` and rows in assignment tables.

### Role Definitions

| Role | How It's Determined | What They Can Do |
|------|-------------------|-----------------|
| **Learner** | Every user (implicit) | View courses assigned to their tenant, self-enroll in open courses, take quizzes/exams, comment, report issues, view own progress |
| **Tenant Admin** | `profiles.is_tenant_admin = true` | Everything a learner can do + manage users in their tenant, approve/reject access requests, view tenant-wide progress, delete comments |
| **Lecturer** | Has rows in `lecturer_course_assignments` | Everything a learner can do + view/edit assigned courses (cross-tenant), grade exams, answer expert questions. Granular via `can_edit` and `can_grade` booleans |
| **CSM** | Has rows in `csm_tenant_assignments` | Everything a learner can do + view data across assigned tenants (progress, comments, issues, enrollments). Read-only cross-tenant. Cannot grade or edit courses |
| **Platform Admin** | `profiles.is_platform_admin = true` | Everything. Full CRUD across all tenants. Manage tenants, assign courses, manage all users |

### Role Constraints

- **Learner** is always present — there's no way to remove the base role.
- **A user can hold multiple roles** simultaneously. Example: a Calypso employee could be both a Lecturer (assigned to specific courses) and a CSM (assigned to specific tenants).
- **Platform Admin, CSM, and Lecturer must be on the master tenant** (Calypso). Database triggers enforce this — you cannot make a client-tenant user a platform admin or assign them as a CSM/lecturer.
- **Tenant Admin can be on any tenant.** Each client tenant can have their own admins.
- **Platform Admin and Tenant Admin on the same user** is possible but unusual — platform admins have global access, so tenant admin is redundant for them.

### How Roles Map to JWT Claims

When a user logs in, the `custom_access_token_hook` reads the database and bakes these claims into the JWT:

```
profiles.is_platform_admin = true     →  JWT: { "is_platform_admin": true }
profiles.is_tenant_admin = true       →  JWT: { "is_tenant_admin": true }
profiles.tenant_id = "abc-123"        →  JWT: { "tenant_id": "abc-123" }

csm_tenant_assignments rows           →  JWT: { "csm_tenant_ids": ["id1", "id2"] }

lecturer_course_assignments rows      →  JWT: { "lecturer_course_ids": ["c1", "c2"],
                                                 "lecturer_can_edit_course_ids": ["c1"],
                                                 "lecturer_can_grade_course_ids": ["c1", "c2"] }
```

The frontend `AuthService` exposes a `roles()` signal derived from the decoded claims. Role computation happens inside `#computeRoles()` during JWT parsing, and the result is stored on the `AppUser` object:

```typescript
// auth.service.ts — roles is a pass-through from the pre-computed AppUser
readonly roles = computed(() => this.#currentUser()?.roles ?? []);

// The actual computation happens in #computeRoles(), called during #parseSession():
#computeRoles(claims: JwtClaims): UserRole[] {
  const r: UserRole[] = ['learner'];
  if (claims.is_tenant_admin) r.push('tenant_admin');
  if (claims.is_platform_admin) r.push('platform_admin');
  if (claims.csm_tenant_ids?.length) r.push('csm');
  if (claims.lecturer_course_ids?.length) r.push('lecturer');
  return r;
}
```

---

## 4. Login Flow — Step by Step

X-Courses has a **two-step tenant-aware login** — the user enters their email first, and the system determines which login methods are available based on their tenant.

### Complete Flow Diagram

```
USER opens /login
     │
     ▼
[Step 1] Enter email address
     │
     ▼
[Step 2] Frontend calls POST /api/auth/resolve-tenant
     │   Body: { "email": "alice@santos.com" }
     │
     ▼
FastAPI Backend:
     ├── Extract domain from email ("santos.com")
     ├── Query: supabase.table("tenants").select(...).ilike("domain", "santos.com")
     ├── Read settings->'auth_methods'
     └── Return: { "tenant_name": "Santos", "auth_methods": ["email_password", "magic_link"] }
     │
     │   NOTE: tenant_name is null and auth_methods is [] if no tenant matches.
     │   Invalid emails (no @ symbol) also return { tenant_name: null, auth_methods: [] }.
     │
     ▼
[Step 3] Frontend shows available login options:
     │   ├── "Sign in with Password" button (if email_password allowed)
     │   ├── "Send sign-in code" button (if magic_link allowed)
     │   ├── "Sign in with SSO" button (if keycloak_sso allowed)
     │   └── If auth_methods is empty → "No tenant found" message
     │
     ▼
[Step 4] User chooses a method and authenticates:
     │
     ├── Email + Password:
     │   └── supabase.auth.signInWithPassword({ email, password })
     │       → Supabase verifies credentials
     │       → password_verification_hook fires (checks tenant allows email_password)
     │       → Returns session with JWT
     │
     ├── Magic Link (OTP code):
     │   └── supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
     │       → Supabase sends 6-digit OTP code to email ({{ .Token }} template)
     │       → User enters code on the login page OTP step
     │       → supabase.auth.verifyOtp({ email, token, type: 'email' })
     │       → Returns session with JWT
     │
     └── Keycloak SSO:
         └── supabase.auth.signInWithOAuth({ provider: 'keycloak' })
             → Browser redirects to Keycloak login
             → After auth, redirects back to /auth/callback
             → Supabase PKCE exchange happens automatically
             → Returns session with JWT
     │
     ▼
[Step 5] JWT contains custom claims (7 claims baked by access_token_hook)
     │
     ▼
[Step 6] AuthService detects session change via onAuthStateChange
     │   ├── Decodes JWT payload (base64 → JSON)
     │   ├── Extracts custom claims (tenant_id, roles, etc.)
     │   ├── Computes roles array
     │   └── Sets currentUser signal
     │
     ▼
[Step 7] Auth guard detects isAuthenticated() = true
     │
     ▼
[Step 8] Redirect to / (which route config redirects to /dashboard)
     │
     ▼
[Step 9] ProfileService fetches full_name + avatar_url from profiles table
         (via Supabase client, which includes JWT → RLS allows SELECT)
```

### What Happens for a First-Time User?

For a brand-new user who has never logged in:

1. They choose a login method (e.g., email+password → they use `signUp` instead of `signInWithPassword`)
2. Supabase creates a row in `auth.users`
3. The `on_auth_user_created` trigger fires `handle_new_user()`
4. Tenant is resolved from email domain (e.g., `alice@santos.com` → `santos.com` → Santos tenant)
5. Auth method is checked against tenant settings
6. If both pass: a `profiles` row is created (Learner by default)
7. If either fails: **no profile is created** — the user is authenticated but has zero access
8. On next token refresh (or immediate if the trigger completes before token issuance), JWT gets custom claims

### What If Tenant Resolution Fails?

If the user's email domain doesn't match any tenant AND there's no `tenant_id` in their metadata:

- **No profile is created**
- The user exists in `auth.users` but has no `profiles` row
- JWT has no custom claims → all RLS policies deny access
- Frontend detects "profileless user" and could redirect to an access request page
- The `cleanup_orphaned_auth_users()` cron job eventually removes such users

---

## 5. The Three Auth Methods

### 5.1 Email + Password

**How it works:**
- User signs up with email and password via Supabase Auth
- Supabase stores the password hash in `auth.users`
- On sign-in, `password_verification_hook` fires and checks if the tenant allows `email_password`
- If blocked: sign-in fails with "Password authentication is not allowed for this organization. Please use SSO."
- If the user has no profile: sign-in fails with "Account not found" (HTTP 403)

**Frontend code path:**
```
Login page → signInWithPassword({ email, password })
           → Supabase Auth
           → password_verification_hook (tenant check)
           → JWT issued with custom claims
           → onAuthStateChange fires
           → AuthService updates signals
```

**When to use:** Client tenants that don't have SSO infrastructure. Simple, familiar.

### 5.2 Magic Link (OTP Code)

**How it works:**
- User clicks "Send sign-in code" on the login page
- Supabase sends a 6-digit OTP code to their email (using `{{ .Token }}` template, NOT a clickable link)
- User enters the code on the login page's OTP verification step
- Frontend calls `verifyOtp()` which returns a session

**Why OTP codes instead of clickable links:** Corporate email security scanners (Microsoft Defender, Mimecast, Proofpoint) follow links in emails to check for phishing, which **consumes magic link tokens** before the user can click them. OTP codes are not affected because scanners don't submit form data.

**Frontend code path:**
```
Login page (step 2: methods) → "Send sign-in code" button
  → signInWithOtp({ email, options: { shouldCreateUser: false } })
  → Supabase sends 6-digit OTP code email
  → Login page transitions to step 3: OTP verification
  → User enters 6-digit code
  → verifyOtp({ email, token, type: 'email' })
  → onAuthStateChange fires (SIGNED_IN)
  → Router navigates to /
```

**Key implementation details:**
- `shouldCreateUser: false` prevents Supabase from creating orphaned `auth.users` rows for unknown email addresses
- OTP input: single text field with `inputmode="numeric"`, `autocomplete="one-time-code"`, `maxlength="6"`, monospace font
- Verify button disabled until exactly 6 digits entered
- 60-second resend cooldown prevents rate-limit hits (Supabase limit: 2 emails/hour per recipient)
- Code expires in 15 minutes (`otp_expiry = 900` in `config.toml`)
- Back button returns to methods step, clearing OTP state

**Important limitation:** At the database level, Supabase uses `provider = 'email'` for BOTH email+password and magic link. The database **cannot distinguish** between them. If a tenant allows `magic_link` but not `email_password`, the `handle_new_user()` trigger allows both (it checks `_auth_methods ? 'email_password' OR _auth_methods ? 'magic_link'`). The `password_verification_hook` provides enforcement for password sign-in specifically, but magic link sign-in has no equivalent hook. **The frontend is the enforcement layer** for showing only allowed methods.

### 5.3 Keycloak SSO

**How it works:**
- User clicks "Sign in with SSO"
- Browser redirects to Keycloak login page (with optional `kc_idp_hint` for automatic IdP selection)
- After authentication, Keycloak redirects back to Supabase's callback URL
- Supabase exchanges the authorization code (PKCE flow) for tokens
- Supabase creates/updates the `auth.users` row
- Browser redirects to the app's `/auth/callback` page
- The Supabase client automatically detects the callback and establishes the session

**Frontend code path:**
```
Login page → signInWithOAuth({ provider: 'keycloak', options: { redirectTo, queryParams: { kc_idp_hint } } })
           → Browser → Keycloak login (customers realm)
           → Keycloak → Supabase callback
           → Supabase → /auth/callback
           → detectSessionInUrl: true handles PKCE exchange
           → onAuthStateChange fires
           → AuthCallbackComponent effect() redirects to /
```

**Cross-product SSO:** Users with an active session in xLNG (same Keycloak "customers" realm) are redirected back immediately with zero prompts. See `AUTH_SYSTEM.md` Section 13 for full architecture.

---

## 6. JWT Claims — The Core of Authorization

Every authenticated request to Supabase includes a JWT. The `custom_access_token_hook` injects 7 custom claims into this JWT. These claims are the **single source of truth** for what the user can access.

### The 7 Claims

| # | Claim | Type | Source Table | Example Value |
|---|-------|------|-------------|---------------|
| 1 | `tenant_id` | string (UUID) | `profiles.tenant_id` | `"a1b2c3d4-..."` |
| 2 | `is_tenant_admin` | boolean | `profiles.is_tenant_admin` | `true` |
| 3 | `is_platform_admin` | boolean | `profiles.is_platform_admin` | `false` |
| 4 | `csm_tenant_ids` | string[] (UUIDs) | `csm_tenant_assignments` | `["id1", "id2"]` |
| 5 | `lecturer_course_ids` | string[] (UUIDs) | `lecturer_course_assignments` | `["c1", "c2"]` |
| 6 | `lecturer_can_edit_course_ids` | string[] (UUIDs) | `lecturer_course_assignments` (where `can_edit=true`) | `["c1"]` |
| 7 | `lecturer_can_grade_course_ids` | string[] (UUIDs) | `lecturer_course_assignments` (where `can_grade=true`) | `["c1", "c2"]` |

### How Claims Are Read

**In the database (RLS policies):**
```sql
-- Scalar claim (returns text):
public.jwt_claim('tenant_id')         -- → 'a1b2c3d4-...'
public.jwt_claim('is_platform_admin') -- → 'true'

-- Array claim (returns text[]):
public.jwt_claim_array('csm_tenant_ids')           -- → ARRAY['id1', 'id2']
public.jwt_claim_array('lecturer_course_ids')       -- → ARRAY['c1', 'c2']
```

**In the frontend (AuthService):**
```typescript
// JWT is decoded from base64 — no library needed
const payload = JSON.parse(atob(session.access_token.split('.')[1]));
// payload.tenant_id, payload.is_platform_admin, payload.csm_tenant_ids, etc.
```

**In the backend (FastAPI):**
```python
# JWT verified with python-jose using HS256
# Note: audience verification is disabled because Supabase's aud claim
# behavior is not always predictable across environments
payload = jwt.decode(
    token, SUPABASE_JWT_SECRET, algorithms=["HS256"],
    options={"verify_aud": False}
)
# payload["tenant_id"], payload["is_platform_admin"], etc.
```

### Claims Staleness

JWT claims are **pre-computed at token issuance**. They are NOT re-evaluated on every request. This means:

- When a role or assignment changes in the database, the JWT still contains the old values
- Claims update on the **next token refresh** (automatic, every ~1 hour) or on re-login
- **Maximum staleness window: ~1 hour**

**Example scenario:**
1. A platform admin removes Alice as a CSM for tenant Santos (deletes her `csm_tenant_assignments` row)
2. Alice's current JWT still contains `csm_tenant_ids: ["santos-uuid"]`
3. Alice can still read Santos data for up to 1 hour
4. After token refresh, her JWT no longer contains the CSM claim
5. RLS policies now correctly block her from Santos data

**Why this trade-off?** Performance. If every RLS policy had to query assignment tables on every request, query performance would degrade significantly across 215+ policies. Pre-computing claims into the JWT means RLS policies only read a local variable — zero table lookups.

### Profileless Users

If a user has no `profiles` row (tenant resolution failed, auth method blocked, or edge case), the `custom_access_token_hook` returns the event **unmodified** — no custom claims are injected.

Result: `jwt_claim('tenant_id')` returns `''`, `jwt_claim('is_platform_admin')` returns `''`, all arrays are empty. Every RLS policy evaluates to false. The user has zero data access despite being authenticated.

---

## 7. User Creation — What Happens in the Database

When a new user authenticates for the first time, Supabase creates an `auth.users` row. This fires the `on_auth_user_created` trigger, which calls `handle_new_user()`.

### Step-by-Step Flow

```
auth.users INSERT
     │
     ▼
handle_new_user() — SECURITY DEFINER, SET search_path = public
     │
     ├── [1] Extract email domain
     │       split_part(NEW.email, '@', 2) → e.g., "santos.com"
     │
     ├── [2] Try to resolve tenant by email domain
     │       SELECT id, settings FROM tenants
     │       WHERE lower(domain) = lower('santos.com')
     │
     ├── [3] If no match: try metadata fallback
     │       Check if raw_user_meta_data has 'tenant_id'
     │       (set by admin during invitation)
     │       If so: _tenant_id = metadata.tenant_id
     │
     ├── [4] If still no match: RETURN NEW (no profile created)
     │       User is "orphaned" — authenticated but no access
     │
     ├── [5] Check auth method enforcement
     │       Read provider from raw_app_meta_data.provider
     │       Read allowed methods from tenants.settings.auth_methods
     │       │
     │       ├── auth_methods is NULL → allow all (backward compat)
     │       ├── admin invitation (has tenant_id metadata) → bypass check
     │       ├── provider = 'keycloak' → check 'keycloak_sso' in allowed
     │       ├── provider = 'email' → check 'email_password' OR 'magic_link'
     │       └── unknown provider → blocked
     │
     ├── [6] If allowed: INSERT INTO profiles
     │       (id, tenant_id, email, full_name)
     │       Default: is_tenant_admin=false, is_platform_admin=false
     │       → User is a Learner
     │
     └── [7] RETURN NEW (trigger completes)
```

### Important Details

- **One profile per auth user.** `profiles.id` references `auth.users.id` as a PRIMARY KEY. You cannot have two profiles for one auth user, or two auth users sharing one profile.
- **One tenant per email domain.** `tenants.domain` has a UNIQUE constraint. The email `alice@santos.com` always maps to the Santos tenant.
- **Admin invitations bypass auth method checks.** When a tenant admin or platform admin invites a user via the Supabase admin API, they set `tenant_id` in `raw_user_meta_data`. The trigger sees this and skips the auth method check — the admin is explicitly authorizing this user regardless of how they authenticate.
- **The trigger only fires once.** `AFTER INSERT ON auth.users` — it fires when the user is created, not when they sign in again. If they sign in via a second provider (identity linking), no new `auth.users` row is created, so no trigger fires.

---

## 8. Row-Level Security — How Data Access Works

Every one of the 30 tables in X-Courses has Row-Level Security (RLS) enabled. This means PostgreSQL evaluates access policies before returning any data — even if the SQL query asks for all rows, only allowed rows are returned.

### How RLS Reads JWT Claims

Every Supabase client request includes the user's JWT in the `Authorization` header. PostgreSQL makes this available via `current_setting('request.jwt.claims')`. The helper functions `jwt_claim()` and `jwt_claim_array()` wrap this for convenience:

```sql
-- Example: Does this user belong to tenant "abc"?
public.jwt_claim('tenant_id') = 'abc'  -- reads from JWT, not from any table

-- Example: Is this user a CSM for tenant "abc"?
'abc' = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
```

### RLS Patterns by Role

#### Learner (all users)

Learners see their own data and content assigned to their tenant:

```sql
-- Own records (enrollments, progress, quiz attempts, etc.):
user_id = auth.uid()

-- Courses visible to their tenant:
EXISTS (
  SELECT 1 FROM tenant_courses tc
  WHERE tc.course_id = courses.id
  AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
)

-- Self-enrollment restricted to open courses only:
EXISTS (
  SELECT 1 FROM courses c
  WHERE c.id = course_enrollments.course_id
  AND c.enrollment_type = 'open'
)
```

**Quiz answer protection:** Learner SELECT policies on `quiz_questions` and `quiz_question_options` base tables were **dropped** (migration 00010). Learners MUST use the safe views (`quiz_questions_safe`, `quiz_question_options_safe`) which strip `correct_answer` and `is_correct` columns.

#### Tenant Admin

Same-tenant access plus user management:

```sql
-- All data in their tenant:
public.jwt_claim('is_tenant_admin') = 'true'
AND tenant_id = public.jwt_claim('tenant_id')::uuid
```

#### CSM

Cross-tenant read access to assigned tenants:

```sql
-- Tenant-isolated tables (have tenant_id column):
tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
```

For **shared content** tables that don't have a `tenant_id` column (courses, lectures, modules, etc.), CSM policies JOIN through `tenant_courses`:

```sql
-- CSM access to courses (no tenant_id on courses table):
EXISTS (
  SELECT 1 FROM tenant_courses tc
  WHERE tc.course_id = courses.id
  AND tc.tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
)
```

For deeply nested tables without `tenant_id` (e.g., `quiz_attempt_answers`), RLS JOINs through a parent table:

```sql
EXISTS (
  SELECT 1 FROM quiz_attempts qa
  WHERE qa.id = quiz_attempt_answers.attempt_id
  AND qa.tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
)
```

#### Lecturer

Course-scoped access with granular permissions:

```sql
-- Read access to assigned courses:
course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])

-- Edit access (content modifications):
course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])

-- Grade access (exam submissions, quiz grading):
course_id = ANY(public.jwt_claim_array('lecturer_can_grade_course_ids')::uuid[])
```

**Key insight:** Lecturers are **cross-tenant**. A lecturer assigned to Course A sees all enrollments, attempts, and submissions for Course A across ALL tenants that have the course. This is by design — course content is shared, not tenant-scoped.

#### Platform Admin

Global access — no filters:

```sql
public.jwt_claim('is_platform_admin') = 'true'
```

### Two Categories of Data

Understanding this distinction is critical:

| Category | Has `tenant_id`? | Examples | How RLS works |
|----------|-----------------|---------|---------------|
| **Shared content** | NO | courses, lectures, modules, quizzes, exams, quiz_questions, quiz_question_options | Access gated via `tenant_courses` JOIN or lecturer assignments |
| **Tenant-isolated data** | YES | profiles, enrollments, progress, comments, quiz_attempts, exam_submissions, notifications | Direct `tenant_id` check against JWT claim |

---

## 9. Tenant System

### What Is a Tenant?

A tenant represents an organization (a company) in the LMS. Each tenant:
- Has a unique email domain (e.g., `santos.com`)
- Has a set of users (via `profiles.tenant_id`)
- Has access to specific courses (via `tenant_courses`)
- Can configure which auth methods are allowed (via `settings.auth_methods`)

### The Master Tenant

One special tenant exists: the **master tenant** (Calypso). It is unique:
- Enforced by a partial unique index: only one row can have `is_master = true`
- The `is_master` flag **cannot be changed after creation** — the `protect_tenant_critical_fields` trigger blocks mutation on UPDATE, and the partial unique index prevents a second master on INSERT
- Platform admins, CSMs, and Lecturers must belong to this tenant
- Master tenant users can access data across all tenants (per their role)

### Tenant Resolution

When a new user signs up, the system needs to determine which tenant they belong to:

1. **Primary:** Extract domain from email → match against `tenants.domain`
2. **Fallback:** Check for `tenant_id` in user metadata (set during admin invitations)
3. **No match:** User gets no profile → zero access

This means:
- `alice@santos.com` → domain `santos.com` → Santos tenant
- `bob@calypso-commodities.com` → domain `calypso-commodities.com` → Calypso (master) tenant
- `charlie@unknown.com` → no match → no profile

### Tenant-Course Relationship

Courses are **global content** — they have no `tenant_id`. They are assigned to tenants via the `tenant_courses` junction table:

```
Course "LNG Basics"  ← tenant_courses → Santos tenant
                     ← tenant_courses → Equinor tenant
                     ← tenant_courses → QatarEnergy tenant
```

A Santos user sees "LNG Basics" because there's a `tenant_courses` row for (Santos, LNG Basics). If that row is deleted (via `cleanup_tenant_course_removal` trigger), all Santos enrollments, progress, and quiz attempts for that course are also cleaned up.

---

## 10. Per-Tenant Auth Method Enforcement

Each tenant can configure which authentication methods their users are allowed to use. This is stored in `tenants.settings` (JSONB):

```json
{
  "auth_methods": ["email_password", "magic_link"]
}
```

### Enforcement Layers

There are **three layers** of enforcement:

| Layer | Where | What It Blocks |
|-------|-------|----------------|
| **Frontend** | Login page | Only shows buttons for allowed methods. Hides "Sign in with SSO" if `keycloak_sso` not in list |
| **Database trigger** | `handle_new_user()` | Blocks profile creation if auth method is not allowed for the resolved tenant |
| **Database hook** | `password_verification_hook` | Blocks password sign-in if `email_password` is not in the tenant's allowed methods |

### Valid Auth Method Values

| Value | Provider String | Description |
|-------|----------------|-------------|
| `email_password` | `email` | Traditional email + password |
| `magic_link` | `email` | Passwordless email login |
| `keycloak_sso` | `keycloak` | Keycloak SSO (via `calypso-xcourses` client in "customers" realm) |

### The Email Provider Problem

Supabase uses `provider = 'email'` for both email+password and magic link. At the database level, these are **indistinguishable**. The enforcement handles this as follows:

- `handle_new_user()`: If provider is `'email'`, allows if EITHER `email_password` or `magic_link` is in the allowed list
- `password_verification_hook`: Fires on every password sign-in and checks specifically for `email_password`. This is the only DB-level enforcement that can distinguish password from magic link.
- **Frontend**: The real enforcement layer for magic-link-only vs password-only tenants. It shows only the allowed UI.

### Settings Validation

The `protect_tenant_critical_fields()` trigger validates `auth_methods` on UPDATE:
- Must be a JSONB array
- Each element must be one of the 3 valid strings
- Invalid values are rejected with an error

Note: This trigger fires on UPDATE only, not INSERT. On INSERT, `is_master` uniqueness is protected by the partial unique index `idx_tenants_single_master`.

### Default Behavior

If `auth_methods` is absent from tenant settings → **all methods are allowed**. This ensures backward compatibility — existing tenants without the setting don't suddenly lose access.

---

## 11. Password Reset Flow

Password reset is deliberately routed through FastAPI instead of going directly to Supabase. Here's why and how:

### Why Proxy Through FastAPI?

Calling `supabase.auth.resetPasswordForEmail()` directly from the frontend has a critical security issue: it sets a password on the `auth.users` row **regardless of whether the tenant allows email+password auth**. An SSO-only tenant user could receive a password reset email, set a password, and bypass SSO.

The FastAPI proxy validates the tenant's auth methods before forwarding.

### Flow

```
[1] User on /reset-password page enters email
     │
     ▼
[2] Frontend: POST /api/auth/reset-password
     Body: { "email": "alice@santos.com" }
     │
     ▼
[3] FastAPI (all wrapped in try/except — always returns same response):
     ├── Extract domain from email
     ├── Query tenants by domain (service-role, bypasses RLS)
     ├── Read settings->'auth_methods'
     ├── CHECK: is 'email_password' in the list?
     │   ├── YES → proceed to step 4
     │   └── NO → silently skip (no error returned)
     │
     ▼
[4] FastAPI: supabase.auth.admin.generate_link({ type: "recovery", email })
     (Uses service_role key — admin API)
     │
     ▼
[5] Supabase sends password reset email to user
     │
     ▼
[6] User clicks link → redirected to app with recovery token
     │
     ▼
[7] Supabase client detects recovery event
     User sets new password
     │
     ▼
[8] supabase.auth.updateUser({ password: newPassword })
```

**Anti-enumeration:** The endpoint ALWAYS returns the same generic response: `"If an account exists for this email, you will receive a password reset link."` This prevents attackers from discovering which emails have accounts. Whether the tenant doesn't exist, the auth method is blocked, or the Supabase API call fails — the response is identical.

### Rate Limiting

The reset-password endpoint is rate-limited to **5 requests per minute per IP** to prevent abuse.

---

## 12. Access Request Flow (No Account Yet)

For users who don't have an account yet and whose email domain might not match any tenant.

### Flow

```
[1] User visits /request-access (no authentication required)
     │
     ▼
[2] User fills form: email and full_name
     │
     ▼
[3] Frontend: supabase.from('access_requests').insert({
       email, full_name, domain (extracted from email), status: 'pending'
     })
     (Uses anon key — RLS policy access_requests_insert_anon allows
      INSERT with status='pending' and null review fields)
     │
     ▼
[4] Database trigger: notify_new_access_request()
     ├── Extract domain from email
     ├── If domain matches a tenant:
     │   └── Notify that tenant's admins + all platform admins
     └── If unknown domain:
         └── Notify platform admins only
     │
     ▼
[5] Admin sees notification, reviews request in admin panel
     Sets status = 'approved' or 'rejected'
     │
     ▼
[6] Database trigger: notify_access_request_reviewed()
     ├── If requester already has a profile:
     │   └── Notify them directly
     └── If no profile:
         └── Notify platform admins with needs_invite: true
             (Admin must send an invitation to create the user)
```

### RLS Policies for Access Requests

- **Anyone** can INSERT (even unauthenticated) — but only with `status='pending'` and null review fields
- **Platform admins** can SELECT all and UPDATE (approve/reject)
- **Tenant admins** can SELECT and UPDATE only requests for their tenant (matched by email domain)

---

## 13. Session Lifecycle

### Initialization (App Start)

```
App bootstraps
     │
     ▼
SupabaseService creates client:
     createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
       auth: {
         flowType: 'pkce',
         autoRefreshToken: true,    // auto-refresh before expiry
         persistSession: true,      // store in localStorage
         detectSessionInUrl: true,  // handle OAuth callbacks
       }
     })
     │
     ▼
AuthService constructor:
     │  loading signal initialized to true (at field declaration)
     │
     ├── [1] Subscribes to supabase.auth.onAuthStateChange()
     │       └── On any event: parses session → sets currentUser → sets loading = false
     │
     └── [2] Calls supabase.auth.getSession()
             └── Reads from localStorage → validates token → parses session → sets loading = false
     │
     │  NOTE: onAuthStateChange is subscribed FIRST, then getSession() is called.
     │  This ensures auth state changes during getSession() are captured.
     │  Whichever completes second sets the final state.
```

### Token Refresh

Supabase tokens last ~1 hour. The client SDK automatically refreshes them:

1. `autoRefreshToken: true` means the SDK sets a timer to refresh before expiry
2. On refresh, Supabase calls `custom_access_token_hook` again
3. The hook re-reads `profiles` and assignment tables → injects fresh claims
4. `onAuthStateChange` fires with event `TOKEN_REFRESHED`
5. `AuthService` decodes the new JWT → updates claims/roles signals
6. **This is when role changes take effect** — up to ~1 hour after the DB change

### Sign Out

```
User clicks "Sign out"
     │
     ▼
AuthService.signOut():
     ├── supabase.auth.signOut()
     │   └── Clears localStorage session
     ├── onAuthStateChange fires with event SIGNED_OUT
     ├── currentUser signal → null
     ├── isAuthenticated signal → false
     ├── roles signal → []
     └── ProfileService reactively clears profile signal → null
     │   (via effect() watching currentUser — not an explicit call)
     │
     ▼
Auth guard detects isAuthenticated = false → redirects to /login
```

---

## 14. Route Protection (Frontend)

### Auth Guard — Protect Authenticated Routes

```typescript
// auth.guard.ts — functional guard (CanActivateFn)
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Synchronous fast-path: if loading is already done, don't create Observable
  if (!auth.loading()) {
    if (auth.isAuthenticated()) return true;
    router.navigate(['/login']);
    return false;
  }

  // Async path: wait for loading to complete
  return toObservable(auth.loading).pipe(
    filter(loading => !loading),
    take(1),
    map(() => {
      if (auth.isAuthenticated()) return true;
      router.navigate(['/login']);
      return false;
    })
  );
};
```

**Key pattern:** The guard uses `toObservable()` + `filter(!loading)` + `take(1)` because auth state is asynchronous — `getSession()` needs to complete before we know if the user is logged in. The synchronous fast-path avoids unnecessary Observable creation on navigation between authenticated pages (when loading is already false).

### Role Guard — Restrict by Role

```typescript
// role.guard.ts — factory function
export function roleGuard(...allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.loading()) {
      if (auth.hasAnyRole(allowedRoles)) return true;
      router.navigate(['/']);
      return false;
    }

    return toObservable(auth.loading).pipe(
      filter(loading => !loading),
      take(1),
      map(() => {
        if (auth.hasAnyRole(allowedRoles)) return true;
        router.navigate(['/']);
        return false;
      })
    );
  };
}

// Usage in routes:
{ path: 'admin/users', canActivate: [roleGuard('tenant_admin', 'platform_admin')], ... }
```

### Route Structure

```
/login                    — public (no guard)
/auth/callback            — public (handles OAuth redirect)
/reset-password           — public
/request-access           — public

/                         — authGuard → MainLayoutComponent
  /dashboard              — any authenticated user
  /courses                — any authenticated user
  /notifications          — any authenticated user
  /profile                — any authenticated user
  /teaching/:path         — stub (role guards to be added in future phases)
  /admin/:path            — stub (role guards to be added in future phases)
  /csm/:path              — stub (role guards to be added in future phases)
  /analytics/:path        — stub (role guards to be added in future phases)
  /platform/:path         — stub (role guards to be added in future phases)
```

Note: Currently only `authGuard` is applied (on the parent route). Role guards on individual feature routes will be added as those features are built.

---

## 15. Multi-Provider Identity Linking

Supabase has built-in **Automatic Identity Linking** (always enabled). This is critical for multi-provider scenarios.

### How It Works

When a user authenticates via a **second** OAuth provider using the **same verified email**, Supabase does NOT create a new user. Instead:

1. Supabase finds the existing `auth.users` row with that email
2. Adds a new entry in `auth.identities` linked to that user
3. `handle_new_user()` does NOT fire (no INSERT on `auth.users`)
4. The user's profile, tenant, roles — everything stays the same

### Example

```
Day 1: alice@calypso-commodities.com signs in via email+password
  → auth.users row created (UUID: aaa-111)
  → handle_new_user() fires → profile created
  → auth.identities: [{ provider: 'email', ... }]

Day 30: Same Alice signs in via Keycloak SSO (same email)
  → Supabase finds existing auth.users row (aaa-111)
  → auth.identities: [{ provider: 'email', ... }, { provider: 'keycloak', ... }]
  → No trigger fires, no duplicate profile
  → JWT claims are identical regardless of which provider she used
```

### Security

- Only **verified** email addresses are linked. Unverified identities are purged during linking.
- This prevents pre-account takeover attacks (attacker creates email+password before legitimate user uses SSO).

---

## 16. Security Hardening

### Privilege Escalation Prevention

Several database triggers and Supabase Auth hooks prevent unauthorized changes:

**PostgreSQL Triggers:**

| Trigger | Fires On | Prevents |
|---------|----------|----------|
| `protect_profile_role_fields()` | UPDATE on `profiles` | Non-admins changing `is_platform_admin`, `is_tenant_admin`, `tenant_id` |
| `enforce_platform_roles_master_tenant()` | INSERT/UPDATE on `profiles` | Platform admins being assigned to non-master tenants |
| `enforce_master_tenant_assignment()` | INSERT/UPDATE on `csm_tenant_assignments`, `lecturer_course_assignments` | Non-master-tenant users being assigned as CSM/Lecturer |
| `protect_tenant_critical_fields()` | UPDATE on `tenants` | Changing `is_master` after creation, invalid `auth_methods` values |

**Supabase Auth Hooks (not PostgreSQL triggers — called by GoTrue, not by CREATE TRIGGER):**

| Hook | Fires On | Prevents |
|------|----------|----------|
| `password_verification_hook` | Every password sign-in attempt | Password auth for tenants that disallow `email_password` |

### Who Can Change What on Profiles

| Field | Platform Admin | Tenant Admin (same tenant) | Self | Others |
|-------|---------------|---------------------------|------|--------|
| `full_name` | Yes | Yes | Yes | No |
| `avatar_url` | Yes | Yes | Yes | No |
| `is_tenant_admin` | Yes | Yes | No | No |
| `is_platform_admin` | Yes | No | No | No |
| `tenant_id` | Yes | No | No | No |

### Storage Security

Three storage buckets with path-based RLS:

| Bucket | Path Pattern | Policy |
|--------|-------------|--------|
| `avatars` | `{user_id}/filename` | Users can upload/read own avatar. Others can read. Profile must exist. |
| `course-files` | `{course_id}/filename` | Read: users in tenant with course access. Write: lecturers with `can_edit`. |
| `exam-submissions` | `{course_id}/{user_id}/filename` | Read: own submissions + lecturers with `can_grade`. Write: own only. Profile must exist. |

The profile existence check (added in migration 00013) prevents orphaned `auth.users` (no profile) from uploading files. Without it, an authenticated user with no profile could upload to storage.

### SECURITY DEFINER Functions

All `SECURITY DEFINER` functions have `SET search_path = public`. This is critical because:
- The `supabase_auth_admin` role (which calls auth hooks) has `search_path = auth`
- Without `SET search_path = public`, the function would look for tables in the `auth` schema
- This caused a 500 error on every sign-in until fixed in migration 00014 (the `custom_access_token_hook` was the only function missing it)

---

## 17. Edge Cases & Failure Modes

### Edge Case 1: User with No Profile

**Scenario:** User authenticates successfully but has no `profiles` row (domain mismatch, auth method blocked).

**What happens:**
- `auth.users` row exists → user is "authenticated"
- JWT has standard Supabase claims (sub, email, etc.) but NO custom claims
- `jwt_claim('tenant_id')` returns `''` → every RLS policy fails
- User can authenticate (get a session) but cannot read or write any data
- Frontend should detect this and show an appropriate message or redirect to access request

### Edge Case 2: Admin Invitation to Nonexistent Tenant

**Scenario:** Admin sets `tenant_id` metadata for a tenant UUID that doesn't exist in the database.

**What happens:**
- `handle_new_user()` reads `tenant_id` from metadata → `_tenant_id` is set to the nonexistent UUID
- The `_tenant_id IS NULL` check passes (it's NOT null — it's a valid UUID format)
- `SELECT settings INTO _settings FROM tenants WHERE id = _tenant_id` returns null (no matching row)
- Since `_settings` is null, `_auth_methods` is null → `_allowed` is set to true (backward compat path)
- The INSERT into profiles attempts to use the nonexistent tenant UUID
- **Foreign key constraint fails** (`profiles.tenant_id REFERENCES tenants`) → INSERT is rejected
- No profile created. User is orphaned.

### Edge Case 3: Race Condition — Profile Not Ready at First Token

**Scenario:** User signs up. `handle_new_user()` is still running when the first JWT is issued.

**What happens:**
- `custom_access_token_hook` runs and finds no profile yet
- Returns JWT without custom claims
- User's first request has no access
- On next token refresh (up to 1 hour, or immediate if the client retries), the hook finds the profile
- **Mitigation:** The trigger usually completes in milliseconds. This race is extremely rare. If hit, a page refresh or `supabase.auth.refreshSession()` fixes it.

### Edge Case 4: Same Email, Two Tenants

**Scenario:** `alice@acme.com` — domain `acme.com` is registered for Tenant A. An admin from Tenant B wants to invite Alice.

**What happens:**
- Alice already has a profile in Tenant A (auto-created from domain match)
- Admin invitation sets `tenant_id = Tenant B` in metadata
- When Alice accepts the invitation, Supabase's identity linking merges identities (same email → same `auth.users` row)
- `handle_new_user()` does NOT fire (no new user created)
- Alice stays in Tenant A. The invitation to Tenant B silently fails.
- **Impact:** One email = one user = one tenant. Cross-tenant users are not supported.

### Edge Case 5: SSO User Sets Password via Reset Link

**Scenario:** A user on an SSO-only tenant (Keycloak SSO only) receives a password reset email somehow.

**What happens without mitigation:**
- `resetPasswordForEmail()` sends a reset link
- User clicks it, sets a password
- Supabase adds a password hash to the `auth.users` row
- Now the user can sign in with email+password, bypassing SSO

**Mitigation (implemented):**
1. Frontend NEVER calls `resetPasswordForEmail()` directly — always proxies through FastAPI
2. FastAPI checks if `email_password` is in the tenant's allowed methods before forwarding
3. `password_verification_hook` blocks password sign-in if tenant doesn't allow `email_password`
4. Even if a password somehow gets set, it can't be used to sign in

### Edge Case 6: Token Used by Email Scanner

**Scenario:** Corporate email scanner follows URLs in emails, consuming one-time tokens.

**Mitigation (implemented):** The magic link flow uses 6-digit OTP codes (`{{ .Token }}` in email templates), NOT clickable links. The user types the code into the login page. Scanners don't submit form data, so the OTP code is safe. All 4 email templates use `{{ .Token }}`.

### Edge Case 7: Auth Method Removed Retroactively

**Scenario:** Tenant switches from `["email_password", "magic_link"]` to `["magic_link"]` only.

**What happens:**
- Existing users with passwords can still have passwords on their `auth.users` rows
- `password_verification_hook` blocks all password sign-ins for this tenant → existing passwords are useless
- `handle_new_user()` would still allow new `email` provider users (can't distinguish) → but password_verification_hook blocks password sign-in anyway
- **Net effect:** Effectively enforced. Users must use magic link. Old passwords remain but can't be used.

---

## 18. Keycloak SSO Integration

Keycloak enables cross-product SSO between xLNG and X-Courses. The architecture uses the existing "customers" realm -- no broker realm needed.

See `AUTH_SYSTEM.md` Section 13 for the full technical architecture, SSO flows, DB changes, API changes, and Keycloak configuration checklist.

**Key points:**
- Single OIDC client (`calypso-xcourses`) in the existing "customers" realm
- Same realm = same session: users authenticated in xLNG get instant SSO to X-Courses
- `kc_idp_hint` parameter enables automatic IdP routing (no manual selection)
- `profiles.keycloak_idp_alias` stores the user's IdP alias for subsequent logins
- All 215+ RLS policies, the access token hook, all triggers, storage policies are provider-agnostic -- no changes needed

---

## 19. Known Gaps & Trade-offs

### Architecture Trade-offs

| Trade-off | Decision | Consequence |
|-----------|----------|-------------|
| Pre-computed JWT claims | Fast RLS (no table lookups per request) | Up to 1 hour stale claims after role changes |
| One email = one tenant | Simple tenant resolution | Users cannot belong to multiple tenants |
| Provider-agnostic DB layer | New auth methods need zero SQL changes | Can't distinguish email+password from magic link at DB level |
| Profileless users allowed to exist | Graceful handling of unresolved tenants | Need cleanup cron job for orphaned auth.users |

### Known Gaps

| Priority | Gap | Impact | Mitigation |
|----------|-----|--------|------------|
| Medium | Email+password vs magic link indistinguishable at DB level | Tenant with `magic_link` only still allows password signup at DB level | `password_verification_hook` blocks password sign-in |
| Medium | Same email can't belong to two tenants | Cross-tenant users not supported | Known limitation, by design |
| Medium | Auth method changes not fully retroactive | Removing `email_password` blocks sign-in but old passwords remain on auth.users | Not a security issue — password_verification_hook blocks usage |
| Medium | Backend strips `keycloak_sso` from resolve-tenant responses | If a tenant has `keycloak_sso` in settings, the backend's `ALL_AUTH_METHODS` list filters it out, so frontend never sees it | Will be fixed when Keycloak support is added in Phase 2 |
| ~~Medium~~ | ~~Magic links vulnerable to email scanners~~ | ~~Corporate email scanners consume magic link tokens~~ | **Fixed:** OTP code entry implemented — all email templates use `{{ .Token }}`, frontend has 3-step OTP flow |
| Low | 1-hour stale claims window | Brief access window after permission revocation | Acceptable trade-off for RLS performance |
| Low | Orphaned auth.users accumulate | Cleanup depends on pg_cron job being active | `cleanup_orphaned_auth_users()` scheduled via cron |

---

## 20. File Reference

### Frontend Auth Files

| File | Purpose |
|------|---------|
| `frontend/src/app/core/services/auth.service.ts` | Signal-based auth state, JWT decoding, role computation, sign-in/sign-out methods |
| `frontend/src/app/core/services/supabase.service.ts` | Supabase client singleton with PKCE config |
| `frontend/src/app/core/services/tenant.service.ts` | Tenant resolution via FastAPI, per-domain caching |
| `frontend/src/app/core/services/api.service.ts` | HTTP client for FastAPI with Bearer token injection |
| `frontend/src/app/core/services/profile.service.ts` | Fetches user profile (name, avatar) from Supabase |
| `frontend/src/app/core/guards/auth.guard.ts` | Route guard: requires authentication |
| `frontend/src/app/core/guards/role.guard.ts` | Route guard factory: requires specific roles |
| `frontend/src/app/core/models/auth.model.ts` | TypeScript types: UserRole, JwtClaims, AppUser |
| `frontend/src/app/features/auth/login/login.component.ts` | Two-step tenant-aware login page |
| `frontend/src/app/features/auth/callback/auth-callback.component.ts` | OAuth callback handler (PKCE exchange) |
| `frontend/src/app/features/auth/reset-password/reset-password.component.ts` | Password reset (proxied through FastAPI) |
| `frontend/src/app/features/auth/access-request/access-request.component.ts` | Access request form (anonymous Supabase insert) |

### Backend Auth Files

| File | Purpose |
|------|---------|
| `backend/app/routers/auth.py` | Endpoints: resolve-tenant (10/min), reset-password (5/min) |
| `backend/app/routers/health.py` | Health check endpoint with Supabase connectivity test |
| `backend/app/services/tenant.py` | Query tenant by email domain via service-role Supabase client |
| `backend/app/services/auth.py` | JWT decode/verify using python-jose (HS256, audience verification disabled) |
| `backend/app/services/supabase.py` | Supabase client with service_role key |
| `backend/app/services/email.py` | SMTP email sending (used by health check, future invite/reminder endpoints) |
| `backend/app/models/schemas.py` | Pydantic models: UserClaims, ResolveEmailRequest/Response, ResetPasswordRequest/Response |
| `backend/app/config.py` | Settings: supabase_url, supabase_service_key, supabase_jwt_secret, cors_origins |
| `backend/app/dependencies.py` | FastAPI dependencies: get_settings, get_current_user (JWT verification for future authenticated endpoints) |
| `backend/app/main.py` | App factory: CORS middleware, rate limiter, router mounting |

### Database Auth Migrations

| Migration | Auth Content |
|-----------|-------------|
| `00001_extensions_types_helpers.sql` | `jwt_claim()`, `jwt_claim_array()` helper functions |
| `00002_tables.sql` | `tenants`, `profiles`, `csm_tenant_assignments`, `lecturer_course_assignments`, `access_requests` |
| `00004_rls_policies.sql` | All 215+ RLS policies across 30 tables |
| `00005_functions_and_triggers.sql` | `handle_new_user()`, `protect_profile_role_fields()`, `enforce_platform_roles_master_tenant()`, `enforce_master_tenant_assignment()` |
| `00006_jwt_claims_hook.sql` | `custom_access_token_hook()` |
| `00007_storage_policies.sql` | Storage bucket RLS |
| `00009_audit_fixes.sql` | Safe views, quiz grading RPC |
| `00010_cross_ref_audit_fixes.sql` | `cleanup_tenant_course_removal()` |
| `00011_comprehensive_audit_fixes.sql` | 7 CSM policies, notification fallback |
| `00012_auth_method_enforcement.sql` | Per-tenant auth method enforcement in `handle_new_user()` |
| `00013_security_hardening.sql` | `password_verification_hook`, `protect_tenant_critical_fields`, storage profile checks |
| `00014_fix_hook_search_path.sql` | Fix `custom_access_token_hook` missing `SET search_path = public` |
