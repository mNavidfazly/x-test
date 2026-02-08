# X-Course v2 — Authentication, Authorization & Multi-Tenancy

> Technical reference for the database-level auth system as implemented in `supabase/migrations/00001-00013`. Frontend and backend code do not exist yet — see [Section 12](#12-frontend--backend-planned) for planned architecture.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [User Roles (5 Roles)](#2-user-roles)
3. [JWT Custom Claims Hook](#3-jwt-custom-claims-hook)
4. [User Creation Flow](#4-user-creation-flow)
5. [Role Protection & Immutability](#5-role-protection--immutability)
6. [RLS Policy Patterns by Role](#6-rls-policy-patterns-by-role)
7. [Profiles Table — RLS Detail](#7-profiles-table--rls-detail)
8. [Tenant System](#8-tenant-system)
9. [Access Request System](#9-access-request-system)
10. [Security Properties](#10-security-properties)
11. [Known Gaps](#11-known-gaps)
12. [Frontend & Backend (PLANNED)](#12-frontend--backend-planned)
13. [Future: Keycloak Integration](#13-future-keycloak-integration)

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     SUPABASE AUTH (Multi-Provider)                         │
│                                                                            │
│  User authenticates via Azure SSO, Email/Password, or Magic Link           │
│       │                                                                    │
│       v                                                                    │
│  auth.users row created (Supabase internal)                                │
│       │                                                                    │
│       ├──> Trigger: on_auth_user_created                                   │
│       │       └── handle_new_user()  [00005:28-60]                         │
│       │              ├── Resolve tenant from email domain                   │
│       │              └── INSERT into profiles                              │
│       │                                                                    │
│       └──> Hook: custom_access_token_hook  [00006:10-64]                   │
│               ├── Read profiles row                                        │
│               ├── Read csm_tenant_assignments                              │
│               ├── Read lecturer_course_assignments                          │
│               └── Inject 7 claims into JWT                                 │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                           POSTGRESQL + RLS                                 │
│                                                                            │
│  JWT arrives with every Supabase client request                            │
│       │                                                                    │
│       v                                                                    │
│  auth.jwt_claim(name)        ── extract scalar from JWT   [00001:66-72]    │
│  auth.jwt_claim_array(name)  ── extract array from JWT    [00001:75-88]    │
│       │                                                                    │
│       v                                                                    │
│  ~215+ RLS policies evaluate claims — zero DB lookups per row              │
│                                                                            │
│  30 tables with RLS enabled  [00004:13-42]                                 │
│  3 storage buckets with policies  [00007]                                  │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                      FRONTEND + BACKEND (PLANNED)                          │
│                                                                            │
│  Angular 19 frontend — not yet implemented                                 │
│  FastAPI backend — not yet implemented                                     │
│  See Section 12 for planned architecture                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key design decision:** Authorization data is pre-computed into JWT claims at token issuance (via the custom access token hook), rather than queried from the database during each RLS policy evaluation. This means:
- RLS policies are fast (read claims from JWT, no table lookups)
- Role/permission changes take effect on next token refresh (~1 hour max)
- The `custom_access_token_hook` function is the single source of truth for what gets into the JWT

---

## 2. User Roles

There are **5 roles** derived from boolean flags on `profiles` and rows in assignment tables. There is no `role` text column — roles are computed.

| Role | How Determined | Scope | Tenant Constraint |
|------|---------------|-------|-------------------|
| **Platform Admin** | `profiles.is_platform_admin = true` | Global — all tenants, all data | Must be on master tenant (Calypso) |
| **Tenant Admin** | `profiles.is_tenant_admin = true` | Own tenant only | Must have a tenant |
| **CSM** | Has rows in `csm_tenant_assignments` | Assigned tenants only | Must be on master tenant |
| **Lecturer** | Has rows in `lecturer_course_assignments` | Assigned courses only (with `can_edit`/`can_grade` granularity) | Must be on master tenant |
| **Learner** | None of the above | Own tenant, enrolled courses only | Must have a tenant |

### Tables

**`profiles`** (`00002:30-40`):
```sql
CREATE TABLE profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants ON DELETE RESTRICT,
  email             text NOT NULL,
  full_name         text,
  avatar_url        text,
  is_tenant_admin   boolean NOT NULL DEFAULT false,
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

**`csm_tenant_assignments`** (`00002:173-180`):
```sql
CREATE TABLE csm_tenant_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES profiles ON DELETE SET NULL,
  UNIQUE (user_id, tenant_id)
);
```

**`lecturer_course_assignments`** (`00002:182-191`):
```sql
CREATE TABLE lecturer_course_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses ON DELETE CASCADE,
  can_edit    boolean NOT NULL DEFAULT false,
  can_grade   boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES profiles ON DELETE SET NULL,
  UNIQUE (user_id, course_id)
);
```

### Role Notes
- A single user can be both Tenant Admin and have CSM/Lecturer assignments (the booleans and assignment tables are independent)
- Platform Admin + Tenant Admin are mutually exclusive in practice (platform admins are on master tenant, tenant admins are on client tenants)
- CSMs and Lecturers must be on the master (Calypso) tenant — enforced by `enforce_master_tenant_assignment()` trigger (`00005:195-215`)

---

## 3. JWT Custom Claims Hook

**File:** `00006_jwt_claims_hook.sql`

The function `custom_access_token_hook(event jsonb)` runs on every token issuance/refresh. It injects 7 claims:

| # | Claim | Type | Source |
|---|-------|------|--------|
| 1 | `tenant_id` | text | `profiles.tenant_id` |
| 2 | `is_tenant_admin` | boolean | `profiles.is_tenant_admin` |
| 3 | `is_platform_admin` | boolean | `profiles.is_platform_admin` |
| 4 | `csm_tenant_ids` | uuid[] | `csm_tenant_assignments` rows for this user |
| 5 | `lecturer_course_ids` | uuid[] | `lecturer_course_assignments` rows for this user |
| 6 | `lecturer_can_edit_course_ids` | uuid[] | Filtered subset where `can_edit = true` |
| 7 | `lecturer_can_grade_course_ids` | uuid[] | Filtered subset where `can_grade = true` |

**If no profile exists** (user just authenticated via SSO but trigger hasn't created their profile yet), the hook returns the event unmodified — no custom claims. This means the user's first request may have a JWT without custom claims until the next token refresh.

### Helper Functions

These extract claims from the JWT at RLS evaluation time (`00001:66-88`):

```sql
-- Extract scalar: auth.jwt_claim('tenant_id') → text
CREATE OR REPLACE FUNCTION auth.jwt_claim(claim text)
RETURNS text AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::json ->> claim,
    ''
  );
$$ LANGUAGE sql STABLE;

-- Extract array: auth.jwt_claim_array('csm_tenant_ids') → text[]
CREATE OR REPLACE FUNCTION auth.jwt_claim_array(claim text)
RETURNS text[] AS $$
  SELECT coalesce(
    array(
      SELECT jsonb_array_elements_text(
        coalesce(
          current_setting('request.jwt.claims', true)::jsonb -> claim,
          '[]'::jsonb
        )
      )
    ),
    '{}'::text[]
  );
$$ LANGUAGE sql STABLE;
```

### Permissions

The hook function is accessible only to `supabase_auth_admin` — not to `authenticated`, `anon`, or `public` roles. The hook also has SELECT grants on `profiles`, `csm_tenant_assignments`, and `lecturer_course_assignments` for `supabase_auth_admin`.

---

## 4. User Creation Flow

**File:** `00005_functions_and_triggers.sql` (lines 28-60), updated in `00012_auth_method_enforcement.sql`

When a user authenticates for the first time:

```
[1] User authenticates via one of:
    ├── Microsoft Azure SSO (Calypso employees)
    ├── Email + Password signup (client tenant users)
    └── Magic Link / OTP (all users, configurable per tenant)
         │
         v
[2] Supabase creates auth.users row
         │
         v
[3] Trigger on_auth_user_created fires handle_new_user()
         │
         v
[4] Tenant resolution:
    ├── Extract domain from email (split_part('@', 2))
    ├── SELECT id, settings FROM tenants WHERE lower(domain) = lower(email_domain)
    │
    ├── If no match: check raw_user_meta_data->>'tenant_id'
    │   (set by admin when inviting via Supabase Auth API)
    │
    └── If still no match: profile is NOT created
         │
         v
[5] Auth method enforcement (00012):
    ├── Read tenants.settings->'auth_methods'
    ├── Read raw_app_meta_data->>'provider' (set by Supabase: 'azure', 'email', 'keycloak')
    ├── If auth_methods not configured → allow all (backward compat)
    ├── If admin invitation (has tenant_id metadata) → bypass check
    ├── Map provider to allowed method and check
    └── If not allowed → profile is NOT created
         │
         v
[6] INSERT INTO profiles (id, tenant_id, email, full_name)
    VALUES (auth_user.id, resolved_tenant, email, full_name_from_metadata)
         │
         v
[7] Next token refresh: custom_access_token_hook reads new profile
    and injects claims into JWT
```

### Key behavior

- **No fallback tenant**: If the email domain doesn't match any tenant AND no `tenant_id` metadata exists, the user gets no `profiles` row. They are effectively locked out — all RLS policies will deny access.
- **Auth method enforcement**: Even if the tenant resolves, the auth method must be allowed in `tenants.settings.auth_methods`. If not, profile creation is skipped.
- **Admin bypass**: Admin invitations (with `tenant_id` in `raw_user_meta_data`) bypass the auth method check — the admin is explicitly authorizing this user.
- **Default role**: New users are `is_tenant_admin = false, is_platform_admin = false` — i.e., Learner by default.
- **Name extraction**: Uses `raw_user_meta_data->>'full_name'`, falls back to empty string.
- **ON CONFLICT DO NOTHING**: Not present in the current trigger — if a profile already exists (shouldn't happen), the INSERT will fail. The trigger is AFTER INSERT on `auth.users`, so it only fires once per auth user creation.

### Provider-Agnostic Design

The user creation trigger works identically for all auth methods. Supabase Auth creates an `auth.users` row regardless of provider, and `handle_new_user()` resolves the tenant from email domain — the trigger never checks which provider was used for its core logic.

This means:
- No per-provider logic in the database layer (beyond auth method enforcement)
- New auth methods can be added without SQL changes (just update tenant settings)
- Frontend controls which login options to show; DB enforces tenant boundaries and allowed methods

### Trigger SQL

```sql
-- Original: 00005:28-60, updated: 00012
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _domain text;
  _settings jsonb;
  _provider text;
  _auth_methods jsonb;
  _allowed boolean := false;
BEGIN
  _domain := split_part(NEW.email, '@', 2);

  -- Step 1: Email domain match (works for any provider)
  SELECT id, settings INTO _tenant_id, _settings
  FROM tenants WHERE lower(domain) = lower(_domain);

  -- Step 2: Explicit tenant_id in metadata (admin invitations)
  IF _tenant_id IS NULL AND NEW.raw_user_meta_data ? 'tenant_id' THEN
    _tenant_id := (NEW.raw_user_meta_data ->> 'tenant_id')::uuid;
    SELECT settings INTO _settings FROM tenants WHERE id = _tenant_id;
  END IF;

  -- If no tenant resolved, nothing to do
  IF _tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Step 3: Check auth method is allowed for this tenant
  _provider := NEW.raw_app_meta_data ->> 'provider';
  _auth_methods := _settings -> 'auth_methods';

  IF _auth_methods IS NULL THEN
    -- No auth_methods configured → allow all (backward compatibility)
    _allowed := true;
  ELSIF NEW.raw_user_meta_data ? 'tenant_id' THEN
    -- Admin invitation → bypass auth method check
    _allowed := true;
  ELSIF _provider = 'azure' THEN
    _allowed := _auth_methods ? 'azure_sso';
  ELSIF _provider = 'keycloak' THEN
    _allowed := _auth_methods ? 'keycloak_sso';
  ELSIF _provider = 'email' THEN
    -- Can't distinguish email+password from magic link at DB level
    _allowed := (_auth_methods ? 'email_password') OR (_auth_methods ? 'magic_link');
  END IF;
  -- Unknown provider → _allowed stays false

  -- Step 4: Create profile if allowed
  IF _allowed THEN
    INSERT INTO profiles (id, tenant_id, email, full_name)
    VALUES (
      NEW.id, _tenant_id, NEW.email,
      coalesce(NEW.raw_user_meta_data ->> 'full_name', '')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## 5. Role Protection & Immutability

Three triggers prevent unauthorized privilege changes:

### 5.1 `protect_profile_role_fields()` (`00005:224-264`)

Fires BEFORE UPDATE on `profiles`. Rules:

| Caller | Can change `is_platform_admin`? | Can change `tenant_id`? | Can change `is_tenant_admin`? |
|--------|--------------------------------|------------------------|------------------------------|
| Platform Admin | Yes | Yes | Yes |
| Tenant Admin (same tenant) | No | No | Yes |
| Anyone else | No | No | No |

```sql
-- Reads caller's role from JWT claims:
_is_platform_admin := coalesce(auth.jwt_claim('is_platform_admin'), '') = 'true';
_is_tenant_admin := coalesce(auth.jwt_claim('is_tenant_admin'), '') = 'true';
_caller_tenant_id := nullif(auth.jwt_claim('tenant_id'), '')::uuid;
```

### 5.2 `enforce_platform_roles_master_tenant()` (`00005:66-78`)

Fires BEFORE INSERT OR UPDATE on `profiles`. If `is_platform_admin = true`, the `tenant_id` must reference a tenant where `is_master = true`. Prevents creating platform admins on client tenants.

### 5.3 `enforce_master_tenant_assignment()` (`00005:195-215`)

Fires BEFORE INSERT OR UPDATE on both `csm_tenant_assignments` and `lecturer_course_assignments`. The user being assigned must belong to the master tenant. Prevents assigning client-tenant users as CSMs or Lecturers.

---

## 6. RLS Policy Patterns by Role

All 30 tables have RLS enabled (`00004:13-42`). Policies follow consistent patterns per role:

### Platform Admin — Global Access
```sql
auth.jwt_claim('is_platform_admin') = 'true'
```
Platform admins have FOR ALL or FOR SELECT/UPDATE/INSERT/DELETE policies on every table. No tenant filtering.

### Tenant Admin — Own Tenant
```sql
auth.jwt_claim('is_tenant_admin') = 'true'
AND tenant_id = auth.jwt_claim('tenant_id')::uuid
```
Tenant admins can manage users, enrollments, and view data within their own tenant. Cannot access other tenants.

### CSM — Assigned Tenants
```sql
tenant_id = ANY(auth.jwt_claim_array('csm_tenant_ids')::uuid[])
```
CSMs can view (SELECT) data across their assigned tenants. For tables without a `tenant_id` column (e.g., `quiz_attempt_answers`), policies JOIN through a parent table that has `tenant_id`:
```sql
-- Example: quiz_answers_select_csm (00011)
EXISTS (
  SELECT 1 FROM quiz_attempts qa
  WHERE qa.id = quiz_attempt_answers.attempt_id
    AND qa.tenant_id = ANY(auth.jwt_claim_array('csm_tenant_ids')::uuid[])
)
```

### Lecturer — Assigned Courses
```sql
course_id = ANY(auth.jwt_claim_array('lecturer_course_ids')::uuid[])
```
For content editing:
```sql
course_id = ANY(auth.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
```
For grading:
```sql
course_id = ANY(auth.jwt_claim_array('lecturer_can_grade_course_ids')::uuid[])
```
Lecturers are cross-tenant — they see data from all tenants for their assigned courses.

### Learner — Own Data + Tenant Boundary
```sql
-- Own records:
user_id = auth.uid()

-- Tenant-scoped content (via tenant_courses):
EXISTS (
  SELECT 1 FROM tenant_courses tc
  WHERE tc.course_id = courses.id
    AND tc.tenant_id = auth.jwt_claim('tenant_id')::uuid
)
```
Learners see only courses assigned to their tenant, and can only read/write their own records (progress, quiz attempts, comments, etc.).

---

## 7. Profiles Table — RLS Detail

8 policies on `profiles` (`00004:68-106`):

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| `profiles_select_own` | SELECT | Self | `id = auth.uid()` |
| `profiles_select_tenant_admin` | SELECT | Tenant Admin | Same tenant + `is_tenant_admin = true` |
| `profiles_select_platform_admin` | SELECT | Platform Admin | `is_platform_admin = true` (global) |
| `profiles_select_csm` | SELECT | CSM | `tenant_id = ANY(csm_tenant_ids)` |
| `profiles_select_lecturer` | SELECT | Lecturer | User enrolled in lecturer's courses (via `course_enrollments` JOIN) |
| `profiles_update_own` | UPDATE | Self | `id = auth.uid()` (role fields protected by trigger) |
| `profiles_update_platform_admin` | UPDATE | Platform Admin | `is_platform_admin = true` (global) |
| `profiles_update_tenant_admin` | UPDATE | Tenant Admin | Same tenant + `is_tenant_admin = true` |

**Note:** Regular learners cannot see other learners' profiles — only their own. Tenant admins, CSMs, lecturers, and platform admins can see profiles within their scope.

---

## 8. Tenant System

### Tenants Table (`00002:12-20`)

```sql
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  is_master   boolean NOT NULL DEFAULT false,
  domain      text UNIQUE,             -- email domain for auto-assignment
  settings    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Only one master tenant allowed:
CREATE UNIQUE INDEX idx_tenants_single_master
  ON tenants (is_master) WHERE is_master = true;
```

### Tenant-Course Assignment

Courses are **shared content** (no `tenant_id`). They are linked to tenants via `tenant_courses`:

```sql
CREATE TABLE tenant_courses (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses ON DELETE CASCADE,
  UNIQUE (tenant_id, course_id)
);
```

This is the primary access boundary — learners and tenant admins can only see courses assigned to their tenant.

### Tenant Rules

| Rule | Enforcement |
|------|-------------|
| Only one master tenant | Partial unique index `idx_tenants_single_master` |
| Platform admins must be on master tenant | `enforce_platform_roles_master_tenant()` trigger |
| CSMs/Lecturers must be on master tenant | `enforce_master_tenant_assignment()` trigger |
| Tenant deletion blocked while users exist | `profiles.tenant_id REFERENCES tenants ON DELETE RESTRICT` |
| Course removal from tenant cleans up enrollments + progress | `cleanup_tenant_course_removal()` trigger (`00010`) |
| Per-tenant auth method enforcement | `handle_new_user()` checks `settings->'auth_methods'` against `raw_app_meta_data.provider` (`00012`) |
| Per-tenant password sign-in enforcement | `password_verification_hook` blocks password auth for tenants without `email_password` in settings (`00013`) |
| Only platform admins manage tenants | `tenants_all_platform_admin` FOR ALL policy |

### Tenant Settings Schema

The `tenants.settings` jsonb column stores per-tenant configuration. Auth method configuration:

```json
{
  "auth_methods": ["azure_sso", "email_password", "magic_link"]
}
```

| Value | Supabase Provider | Description |
|-------|-------------------|-------------|
| `azure_sso` | `'azure'` | Microsoft Entra ID / Azure AD SSO |
| `email_password` | `'email'` | Email + password signup/login |
| `magic_link` | `'email'` | Passwordless email login (OTP) |
| `keycloak_sso` | `'keycloak'` | Keycloak SSO (Phase 2 — future) |

**Note:** Supabase uses `provider = 'email'` for both email+password and magic link. The DB enforcement cannot distinguish between them — if either `email_password` or `magic_link` is in the allowed list, both email-based methods pass the DB check. The frontend controls which UI to show per tenant.

**Default:** If `auth_methods` key is absent from settings → all methods allowed (backward compatibility).

---

## 9. Access Request System

For users whose email domain doesn't match any tenant, or who want to request access before being invited.

### Table (`00002:347-356` + `00011`)

```sql
CREATE TABLE access_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  domain      text,                                          -- extracted from email
  tenant_id   uuid REFERENCES tenants ON DELETE SET NULL,    -- resolved if domain matches
  status      access_request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES profiles ON DELETE SET NULL,
  reviewed_at timestamptz,
  full_name   text,          -- added in 00011
  review_notes text,         -- added in 00011
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### Flow

```
[1] Anonymous user submits access request
    (access_requests_insert_anon policy — no auth required)
         │
         v
[2] notify_new_access_request() trigger fires [00005:643-703]
    ├── If domain matches a tenant: notify tenant admins + platform admins
    └── If unknown domain: notify platform admins only
         │
         v
[3] Admin reviews request, sets status = 'approved' or 'rejected'
         │
         v
[4] notify_access_request_reviewed() trigger fires [00011:264-343]
    ├── If requester has a profile: notify them directly
    └── If no profile: notify platform admins with needs_invite: true
```

### Policies (`00004`)

- `access_requests_insert_anon`: Anyone can INSERT with `status = 'pending'` and null review fields
- `access_requests_select_platform_admin`: Platform admins see all
- `access_requests_select_tenant_admin`: Tenant admins see requests for their tenant
- `access_requests_update_platform_admin`: Platform admins can update (approve/reject)
- `access_requests_update_tenant_admin`: Tenant admins can update for their tenant

---

## 10. Security Properties

### Strengths

| Property | Implementation |
|----------|---------------|
| **Tenant isolation** | Enforced at database level via RLS — not bypassable from frontend |
| **Role immutability** | `protect_profile_role_fields()` trigger blocks unauthorized changes to `is_platform_admin`, `is_tenant_admin`, `tenant_id` |
| **Master tenant enforcement** | Platform admins, CSMs, and Lecturers must be on master tenant — enforced by triggers |
| **Quiz answer protection** | `quiz_questions_safe` and `quiz_question_options_safe` views strip `correct_answer` and `is_correct` (`00009`) |
| **Server-side quiz grading** | `grade_quiz_attempt()` RPC — learners never see correct answers during grading (`00009`, fixed in `00011`) |
| **Enrollment type enforcement** | Self-enrollment restricted to `open` courses only (`enrollments_insert_self` CHECK in `00009`) |
| **Completion bypass prevention** | `enforce_quiz_exam_completion()` trigger blocks marking quiz/exam modules complete without passing (`00010`) |
| **Score tamper protection** | `protect_quiz_score` trigger blocks direct score updates by non-admin users (`00009`) |
| **Notification exception handling** | All 10+ notification triggers wrapped in BEGIN...EXCEPTION blocks (`00009`) |
| **RLS on all 30 tables** | Every table has RLS enabled + policies (`00004`) |
| **Multi-provider identity safety** | Supabase Automatic Identity Linking merges OAuth identities by verified email — one `auth.users` row, one profile, multiple providers |
| **Per-tenant auth method enforcement** | `handle_new_user()` blocks profile creation for disallowed auth methods via `tenants.settings.auth_methods` (`00012`) |
| **3 storage buckets secured** | `avatars`, `course-files`, `exam-submissions` all have path-based RLS (`00007`, fixes in `00009`, `00011`, `00013`) |
| **Password sign-in enforcement** | `password_verification_hook` blocks password auth for tenants that don't allow `email_password` (`00013`) |
| **Tenant settings validation** | `protect_tenant_critical_fields()` trigger validates `auth_methods` values, blocks `is_master` mutation (`00013`) |
| **Storage upload requires profile** | `avatars_insert_own` and `exam_sub_insert_own` require profile existence — orphaned auth.users cannot upload (`00013`) |

### Stale Claims Window

JWT claims are pre-computed by the custom access token hook. When a role or assignment changes:
- The change is written to the database immediately
- The JWT still contains the old claims until the next token refresh
- Default Supabase token lifetime: 1 hour
- **Max staleness window: ~1 hour** after privilege changes

This means: if a CSM is unassigned from a tenant, they can still read that tenant's data until their token refreshes. This is a known trade-off for RLS performance.

### Identity Linking Across Providers

Supabase Auth has built-in **Automatic Identity Linking** (always enabled, no toggle to disable). This is critical for the multi-provider auth setup:

- When a user authenticates via a **second** OAuth provider with the **same verified email**, Supabase does **not** create a new `auth.users` row. Instead, it adds a new entry in `auth.identities` linked to the existing user.
- The `handle_new_user()` trigger does **NOT** fire again — it's `AFTER INSERT ON auth.users`, and no INSERT occurs during identity linking.
- The user's profile remains unchanged: same UUID, same `tenant_id`, same roles.
- The `custom_access_token_hook` works identically regardless of which provider the user signs in with — it reads from `profiles` and assignment tables, not auth provider info.

**Security:** Only **verified** email addresses are linked. Unverified identities are purged during linking to prevent pre-account takeover attacks.

**Practical example:** A Calypso employee with both a Microsoft Entra account and a Keycloak (xLNG) account — same email `alice@calypso.ai`:
1. First login via Azure SSO → `auth.users` row created, `handle_new_user()` fires, profile created
2. Later login via Keycloak SSO → `auth.identities` row added, no new user, no trigger fire
3. Result: one profile, two auth identities, same JWT claims regardless of provider used

**Phase 1→2 transition:** When Keycloak is added later, existing email+password users who authenticate via Keycloak SSO with the same email get their identity linked automatically — seamless migration, no data duplication.

---

## 11. Known Gaps

From `docs/COMPREHENSIVE_AUDIT.md` and multi-provider auth security audit — remaining unfixed items after migrations 00009-00013:

### High Priority

| ID | Gap | Description |
|----|-----|-------------|
| H1 | Orphaned auth.users accumulate | `handle_new_user()` skips profile but `auth.users` row persists. Mitigated by `cleanup_orphaned_auth_users()` cron job (`00013`). Requires pg_cron scheduling |
| H2 | Same email cannot belong to two tenants | `profiles.id` is 1:1 with `auth.users.id`. Second tenant invite silently fails. Needs backend duplicate check before sending invites |
| H3 | No break-glass when Azure AD is down | All Calypso employees locked out. Keep one platform admin with magic link fallback. Document emergency procedure |

### Medium Priority

| ID | Gap | Description |
|----|-----|-------------|
| M1 | No learner self-unenroll | No DELETE policy on `course_enrollments` for own rows |
| M2 | Learners can't close own questions | No UPDATE policy on `expert_questions` for own rows |
| M3 | Reporters can't update own issues | No UPDATE policy on `issues` for own rows |
| M4 | No notification dismissal | No DELETE or `dismissed_at` mechanism for notifications |
| M5 | Platform admin missing progress policies | No INSERT/DELETE on `user_progress` for platform admins |
| M6 | No exam deadline enforcement | Late submissions possible at DB level |
| M7 | No `max_attempts` enforcement | Quiz attempt limit not enforced at DB level |
| M8 | No reminder rate limiting | Spam possible at DB level |
| M9 | Email+password vs magic link indistinguishable at DB level | Both use `provider = 'email'`. Tenant with `magic_link` only still accepts password signup. Frontend enforces; DB cannot distinguish |
| M10 | Auth method changes not fully retroactive | Removing `email_password` blocks new sign-ins (via `password_verification_hook`) but existing passwords remain on auth.users rows |

### Low Priority / Informational

| ID | Gap | Description |
|----|-----|-------------|
| L1 | No status transition enforcement | Issues and expert questions can jump to any status |
| L2 | Notification UPDATE too broad | Can mutate any column, not just `read_at` |
| L3 | pg_cron jobs commented out | Staleness check and exam deadline cron are inactive |
| L4 | CSMs not notified about stale content | Staleness notifications only go to lecturers + admins |
| L5 | `significant_update_at` not automated | Client must set it manually — no trigger |
| L6 | `sort_order` no uniqueness | Concurrent editors can create duplicate orderings |
| L7 | Lecturer `can_edit` too broad | UPDATE on ALL columns, not just content fields |
| L8 | Storage orphaning on tenant deletion | Files in all 3 buckets not cleaned up |
| L9 | External quiz completion trigger gap | `enforce_quiz_exam_completion` doesn't handle external quiz module type |
| L11 | 1-hour stale JWT claims window | Known trade-off (see Section 10) |
| L12 | Pre-convention course-files inaccessible | Files uploaded before path convention change in 00009 |

---

## 12. Frontend & Backend (PLANNED)

> **Status: NOT YET IMPLEMENTED.** The following describes the planned architecture based on project requirements. No frontend or backend code exists in this repository.

### Planned Frontend (Angular 19)

- **Login options (Phase 1)** — tenant-aware login page:
  - Calypso employees: Microsoft Azure SSO — `supabase.auth.signInWithOAuth({ provider: 'azure' })`
  - Client tenant users: Email + Password — `supabase.auth.signUp({ email, password })` / `supabase.auth.signInWithPassword({ email, password })`
  - All users (configurable per tenant): Magic Link — `supabase.auth.signInWithOtp({ email })`
  - Per-tenant: Frontend reads `tenants.settings.auth_methods` to determine which login options to show
  - Domain detection: user enters email → resolve tenant → show allowed methods
- **Login options (Phase 2 — future)**: Add Keycloak SSO for xLNG cross-product single sign-on. Client tenants onboarded to Keycloak switch to SSO-only (email/password removed for that tenant).
- **Session**: Supabase JS client with `persistSession: true`, `autoRefreshToken: true`, PKCE flow (`flowType: 'pkce'`)
- **Route guards**: `authGuard` (any authenticated user), `adminGuard` (role-based), `publicGuard` (login page)
- **State management**: RxJS BehaviorSubject for `currentUser$`, `isLoading$`, `isAuthenticated$`
- **Profile loading**: Query `profiles` table after login, map `is_platform_admin`/`is_tenant_admin` to role enum
- **OAuth callback**: Parse tokens from URL hash, call `setSession()`, clean URL

### Planned Backend (FastAPI)

- **JWT verification**: Verify Supabase JWTs using `python-jose` (HS256) with Supabase JWT secret
- **Service role client**: Uses `service_role` key (bypasses RLS) for admin operations
- **Planned endpoints**:
  - `POST /api/email/invitation` — send invitation emails
  - `POST /api/email/reminder` — send course reminder emails
  - `POST /api/email/certificate` — send certificate emails
  - `POST /api/certificate/generate` — generate PDF certificates
  - `POST /api/video/signed-url` — Bunny.net video upload URLs
  - `POST /api/quiz/webhook` — external quiz result webhook (HMAC-SHA256 auth)
  - `GET /api/me` — debug endpoint returning JWT claims
- **Important design consideration**: Backend will need its own RBAC layer — simply verifying the JWT is not enough. Any authenticated user would be able to call any endpoint without role checks.
- **Tenant-aware login support**:
  - `POST /api/auth/resolve-tenant` — resolve tenant from email domain, return allowed auth methods (public, rate-limited 10/min/IP)
  - `POST /api/auth/reset-password` — proxy password reset through FastAPI (validates tenant allows `email_password` before calling Supabase admin API). Frontend must never call `resetPasswordForEmail()` directly
  - Pre-invite validation: check if email already has a profile before sending invitation (prevents silent failures from duplicate invites)

### Key Files (To Be Created)

| Layer | Key Files |
|-------|-----------|
| Frontend | `auth.service.ts`, `supabase.service.ts`, `auth.guard.ts`, `admin.guard.ts`, `login.component.ts` |
| Backend | `auth.py` (JWT verify), `email.py` (email sending), `supabase.py` (service client) |

---

## 13. Future: Keycloak Integration

> **Status: PLANNED — Phase 2.** This section documents the planned architecture for adding Keycloak SSO to enable cross-product single sign-on between xLNG and X-Course.

### Architecture: Single X-Course Broker Realm

```
xLNG Keycloak Instance
  ├── Realm: Santos          (xLNG tenant)
  ├── Realm: Equinor         (xLNG tenant)
  ├── Realm: QatarEnergy     (xLNG tenant)
  └── Realm: x-course        ← NEW broker realm
        ├── IdP: santos-xlng      → brokers to Santos realm
        ├── IdP: equinor-xlng     → brokers to Equinor realm
        ├── IdP: qatarenergy-xlng → brokers to QatarEnergy realm
        └── Client: supabase-xcourse (OIDC client for Supabase)

Supabase Auth
  └── Keycloak provider → https://keycloak.example.com/realms/x-course
```

**Why broker realm:** Supabase's built-in Keycloak provider supports exactly ONE realm URL. The broker realm solves this — Supabase connects to `x-course` realm only, which delegates authentication to the appropriate xLNG tenant realm via Identity Brokering.

### SSO Flow

```
[1] User working in xLNG (Santos realm) → has active Keycloak session
[2] Clicks "Go to X-Course" → URL includes kc_idp_hint=santos-xlng
[3] Supabase redirects to x-course realm → auto-redirects to Santos realm
[4] Santos realm sees active session → redirects back immediately (SSO!)
[5] x-course realm issues token → Supabase creates auth.users row
[6] handle_new_user() trigger: email bob@santos.com → domain "santos.com" → tenant resolved
[7] custom_access_token_hook injects JWT claims → user lands on dashboard
Total time: ~2-3 seconds, zero manual input
```

### DB Changes Required (Migration — future)

Only 2 changes needed:

1. **Add `keycloak_realm` column to `tenants`:**
   ```sql
   ALTER TABLE tenants ADD COLUMN keycloak_realm text UNIQUE;
   ```
   For tenant resolution when email domain doesn't match but Keycloak realm does.

2. **Update `handle_new_user()` with Keycloak realm fallback:**
   Extended resolution chain: email domain → Keycloak realm (`raw_user_meta_data->>'kc_realm'`) → metadata `tenant_id`

### What Doesn't Change

| Component | Why |
|-----------|-----|
| `custom_access_token_hook()` | Reads profiles + assignments, not auth provider |
| ~215+ RLS policies | All use `auth.jwt_claim()` — provider-agnostic |
| `protect_profile_role_fields()` | Reads JWT claims, not provider info |
| All triggers | Check business rules, not provider |
| Storage policies | Path-based, provider-agnostic |
| `profiles` table schema | No new columns needed |

### SSO Enforcement for Onboarded Tenants

When a client tenant switches to Keycloak SSO:
- Update `tenants.settings.auth_methods` to `["keycloak_sso"]` (removes email/password)
- Frontend stops showing email/password login for that tenant
- `handle_new_user()` blocks non-Keycloak signups for that tenant
- Existing email+password users seamlessly transition via Supabase's Automatic Identity Linking (same email → identity merged)

### Known Limitation

Supabase may drop custom Keycloak claims from `raw_user_meta_data`. This means the `kc_realm` claim needed for Step 2 of tenant resolution may not be available.

**Mitigation:** Email domain resolution (Step 1) is the primary path and works regardless. The Keycloak realm step is a fallback for cases where email domains don't match any tenant. Backend workaround available if needed (decode Keycloak token server-side and update `raw_user_meta_data` via admin API).

### Keycloak Configuration Checklist (Manual Steps)

1. **Create x-course realm** on existing Keycloak instance
2. **Add Identity Providers** for each xLNG tenant realm (type: "Keycloak OpenID Connect", alias: `{tenant}-xlng`)
3. **Create supabase-xcourse client** (openid-connect, confidential, redirect URI to Supabase callback)
4. **Configure Supabase Dashboard** (Authentication → Providers → Enable Keycloak, point to x-course realm)
5. **Add Identity Provider Mappers** (hardcoded `kc_realm` attribute per IdP for tenant resolution)

---

## Appendix: Migration File Reference

| Migration | Auth-Related Content |
|-----------|---------------------|
| `00001_extensions_types_helpers.sql` | `auth.jwt_claim()`, `auth.jwt_claim_array()` helper functions |
| `00002_tables.sql` | `profiles`, `tenants`, `csm_tenant_assignments`, `lecturer_course_assignments`, `access_requests` tables |
| `00004_rls_policies.sql` | All ~215+ RLS policies across 30 tables |
| `00005_functions_and_triggers.sql` | `handle_new_user()`, `protect_profile_role_fields()`, `enforce_platform_roles_master_tenant()`, `enforce_master_tenant_assignment()`, all notification triggers |
| `00006_jwt_claims_hook.sql` | `custom_access_token_hook()` — the core of the auth system |
| `00007_storage_policies.sql` | Storage bucket RLS (avatars, course-files, exam-submissions) |
| `00009_audit_fixes.sql` | Safe views, quiz grading RPC, enrollment CHECK constraints, notification hardening |
| `00010_cross_ref_audit_fixes.sql` | `cleanup_tenant_course_removal()`, `enforce_quiz_exam_completion()` |
| `00011_comprehensive_audit_fixes.sql` | Storage policy fix, time-limit fix, 7 CSM policies, notification fallback, `access_requests` columns |
| `00012_auth_method_enforcement.sql` | Per-tenant auth method enforcement in `handle_new_user()` via `tenants.settings.auth_methods` |
| `00013_security_hardening.sql` | `password_verification_hook()`, `protect_tenant_critical_fields()`, storage policy profile checks, `cleanup_orphaned_auth_users()` |
