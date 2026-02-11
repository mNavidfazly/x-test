# X-Courses v2 — E2E Test Users

## Overview

Test user accounts for manual E2E testing. These users cover all 5 roles across 2 tenants (master + client).

## Tenants

| Tenant | Domain | is_master | Auth Methods | Status |
|--------|--------|-----------|--------------|--------|
| **Calypso** | `calypso-commodities.com` | `true` | email_password, magic_link, keycloak_sso | EXISTS (migration 00002) |
| **Equinor** | `equinor.com` | `false` | keycloak_sso only | EXISTS (migration 00018) |
| **Calypso Client** | `calypsoclient.com` | `false` | email_password, magic_link | READY (created 2026-02-11) |

---

## Test User Matrix

### Calypso Users (Master Tenant)

CSM, Lecturer, and Platform Admin roles **must** be on the master tenant (trigger-enforced by `enforce_master_tenant_assignment()` and `enforce_platform_roles_master_tenant()`).

| # | Email | Password | Role | Purpose | Status |
|---|-------|----------|------|---------|--------|
| 1 | `et@calypso-commodities.com` | `TestUser123!` | **Platform Admin** | Full CRUD, tenant assignment, delete | READY (password reset 2026-02-11) |
| 2 | `lecturer-edit@calypso-commodities.com` | `TestUser123!` | **Lecturer (can_edit)** | Edit courses/lectures/modules on assigned courses | READY (created 2026-02-11) |
| 3 | `lecturer-view@calypso-commodities.com` | `TestUser123!` | **Lecturer (read-only)** | View assigned courses, NO edit access | READY (created 2026-02-11) |
| 4 | `csm@calypso-commodities.com` | `TestUser123!` | **CSM** | View assigned tenants' data, NO content write | READY (created 2026-02-11) |
| 5 | `learner@calypso-commodities.com` | `TestUser123!` | **Learner** | View enrolled courses, take quizzes, no edit | READY (created 2026-02-11) |

### Calypso Client Users (Client Tenant)

| # | Email | Password | Role | Purpose | Status |
|---|-------|----------|------|---------|--------|
| 6 | `admin@calypsoclient.com` | `TestUser123!` | **Tenant Admin** | Manage users/enrollments, NO content write | READY (created 2026-02-11) |
| 7 | `learner@calypsoclient.com` | `TestUser123!` | **Learner** | Client-side learner, different tenant | READY (created 2026-02-11) |

---

## Role Details

| Role | Profile Flags | Assignments | Content Write? |
|------|--------------|-------------|---------------|
| **Platform Admin** | `is_platform_admin = true` | — | YES (full CRUD on all courses) |
| **Lecturer (can_edit)** | — | `lecturer_course_assignments` with `can_edit = true` | YES (assigned courses only) |
| **Lecturer (read-only)** | — | `lecturer_course_assignments` with `can_edit = false` | NO (read only) |
| **CSM** | — | `csm_tenant_assignments` | NO |
| **Tenant Admin** | `is_tenant_admin = true` | — | NO |
| **Learner** | — | — | NO |

---

## Setup Instructions

### Prerequisites

- Supabase project ref: `ruhdnvtvoxxiodnyyqqf`
- You need the **Service Role Key** (from Supabase Dashboard → Settings → API)
- Access to the **SQL Editor** in Supabase Dashboard

Set these in your terminal before running commands:

```bash
export SUPABASE_URL="https://ruhdnvtvoxxiodnyyqqf.supabase.co"
export SERVICE_ROLE_KEY="your-service-role-key-here"
```

---

### Step 1: Create Client Tenant

Run in the **Supabase SQL Editor**:

```sql
-- Create Calypso Client tenant (client tenant for testing)
INSERT INTO tenants (name, domain, is_master, settings)
VALUES (
  'Calypso Client',
  'calypsoclient.com',
  false,
  jsonb_build_object('auth_methods', '["email_password", "magic_link"]'::jsonb)
)
ON CONFLICT (domain) DO NOTHING;

-- Verify tenants
SELECT id, name, domain, is_master, settings->'auth_methods' as auth_methods
FROM tenants ORDER BY is_master DESC;
```

**Save the tenant IDs** — you'll need the Calypso Client tenant ID for later.

---

### Step 2: Create Users via Admin API

Run these curl commands. The `handle_new_user()` trigger will auto-create profiles linked to the correct tenant (resolved from email domain).

```bash
# 2. Lecturer (can_edit)
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lecturer-edit@calypso-commodities.com",
    "password": "TestUser123!",
    "email_confirm": true,
    "user_metadata": {"full_name": "Test Lecturer (Edit)"}
  }' | jq '.id'

# 3. Lecturer (read-only)
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lecturer-view@calypso-commodities.com",
    "password": "TestUser123!",
    "email_confirm": true,
    "user_metadata": {"full_name": "Test Lecturer (View)"}
  }' | jq '.id'

# 4. CSM
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "csm@calypso-commodities.com",
    "password": "TestUser123!",
    "email_confirm": true,
    "user_metadata": {"full_name": "Test CSM"}
  }' | jq '.id'

# 5. Calypso Learner
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "learner@calypso-commodities.com",
    "password": "TestUser123!",
    "email_confirm": true,
    "user_metadata": {"full_name": "Test Learner (Calypso)"}
  }' | jq '.id'

# 6. Client Tenant Admin
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@calypsoclient.com",
    "password": "TestUser123!",
    "email_confirm": true,
    "user_metadata": {"full_name": "Test Tenant Admin (Client)"}
  }' | jq '.id'

# 7. Client Learner
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "learner@calypsoclient.com",
    "password": "TestUser123!",
    "email_confirm": true,
    "user_metadata": {"full_name": "Test Learner (Client)"}
  }' | jq '.id'
```

---

### Step 3: Set Role Flags on Profiles

The `protect_profile_role_fields()` trigger blocks role changes via normal queries (checks JWT claims). To set role flags, temporarily disable the trigger in the **SQL Editor**:

```sql
-- Temporarily disable the role protection trigger
ALTER TABLE profiles DISABLE TRIGGER protect_role_fields;

-- Set Platform Admin password (if not already set)
-- (User 1: et@calypso-commodities.com — already is_platform_admin, just ensure password)

-- Set Tenant Admin flag for client admin
UPDATE profiles
SET is_tenant_admin = true
WHERE email = 'admin@calypsoclient.com';

-- Re-enable the trigger
ALTER TABLE profiles ENABLE TRIGGER protect_role_fields;

-- Verify profiles were created correctly
SELECT p.email, p.full_name, p.is_platform_admin, p.is_tenant_admin,
       t.name as tenant_name, t.is_master
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
WHERE p.email IN (
  'et@calypso-commodities.com',
  'lecturer-edit@calypso-commodities.com',
  'lecturer-view@calypso-commodities.com',
  'csm@calypso-commodities.com',
  'learner@calypso-commodities.com',
  'admin@calypsoclient.com',
  'learner@calypsoclient.com'
)
ORDER BY t.is_master DESC, p.email;
```

---

### Step 4: Create Role Assignments

These require the user IDs from Step 2. Run in the **SQL Editor**:

```sql
-- Get user IDs (save these for the INSERT statements below)
SELECT p.id, p.email
FROM profiles p
WHERE p.email IN (
  'lecturer-edit@calypso-commodities.com',
  'lecturer-view@calypso-commodities.com',
  'csm@calypso-commodities.com'
);

-- ============================================================
-- IMPORTANT: You need a test course to assign lecturers to.
-- Either use an existing course or create one first as Platform Admin.
-- Replace <COURSE_ID> with the actual course UUID.
-- ============================================================

-- Lecturer (can_edit) — assigned to test course with edit permission
INSERT INTO lecturer_course_assignments (lecturer_id, course_id, can_edit, can_grade)
SELECT p.id, '<COURSE_ID>'::uuid, true, true
FROM profiles p WHERE p.email = 'lecturer-edit@calypso-commodities.com'
ON CONFLICT DO NOTHING;

-- Lecturer (read-only) — assigned to same course, NO edit permission
INSERT INTO lecturer_course_assignments (lecturer_id, course_id, can_edit, can_grade)
SELECT p.id, '<COURSE_ID>'::uuid, false, false
FROM profiles p WHERE p.email = 'lecturer-view@calypso-commodities.com'
ON CONFLICT DO NOTHING;

-- CSM — assigned to the Calypso Client tenant
INSERT INTO csm_tenant_assignments (user_id, tenant_id)
SELECT p.id, t.id
FROM profiles p, tenants t
WHERE p.email = 'csm@calypso-commodities.com'
  AND t.domain = 'calypsoclient.com'
ON CONFLICT DO NOTHING;

-- Verify assignments
SELECT 'Lecturer Assignments' as type, p.email, lca.course_id, lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN profiles p ON p.id = lca.lecturer_id
WHERE p.email LIKE '%calypso-commodities.com'
UNION ALL
SELECT 'CSM Assignments', p.email, cta.tenant_id, null, null
FROM csm_tenant_assignments cta
JOIN profiles p ON p.id = cta.user_id
WHERE p.email LIKE '%calypso-commodities.com';
```

---

### Step 5: Assign Course to Client Tenant

For the client tenant users to see the test course, it must be assigned via `tenant_courses`:

```sql
-- Assign the test course to the Calypso Client tenant
INSERT INTO tenant_courses (tenant_id, course_id)
SELECT t.id, '<COURSE_ID>'::uuid
FROM tenants t
WHERE t.domain = 'calypsoclient.com'
ON CONFLICT DO NOTHING;

-- Verify
SELECT t.name, tc.course_id, c.title
FROM tenant_courses tc
JOIN tenants t ON t.id = tc.tenant_id
JOIN courses c ON c.id = tc.course_id
WHERE t.domain = 'calypsoclient.com';
```

---

### Step 6: Set Platform Admin Password (if needed)

```bash
# Ensure et@calypso-commodities.com has the standard test password
# Get user ID first
USER_ID=$(curl -s "$SUPABASE_URL/auth/v1/admin/users?page=1&per_page=50" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" | \
  jq -r '.users[] | select(.email == "et@calypso-commodities.com") | .id')

curl -s -X PUT "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password": "TestUser123!"}'
```

---

## Verification Checklist

After setup, verify each user can log in:

| # | Email | Login | Expected After Login |
|---|-------|-------|---------------------|
| 1 | `et@calypso-commodities.com` | email + password | Dashboard, full sidebar, "Create Course" visible on `/courses` |
| 2 | `lecturer-edit@calypso-commodities.com` | email + password | Dashboard, "Edit" button on assigned course, can add lectures/modules |
| 3 | `lecturer-view@calypso-commodities.com` | email + password | Dashboard, can see assigned course, NO edit buttons |
| 4 | `csm@calypso-commodities.com` | email + password | Dashboard, "Assigned Tenants" in sidebar |
| 5 | `learner@calypso-commodities.com` | email + password | Dashboard, "My Courses" only, can view enrolled courses |
| 6 | `admin@calypsoclient.com` | email + password | Dashboard, "User Management" in sidebar, NO content edit |
| 7 | `learner@calypsoclient.com` | email + password | Dashboard, "My Courses" only |

---

## JWT Claims After Login

After each user logs in, their JWT will contain these claims (from `custom_access_token_hook`):

| User | `tenant_id` | `is_platform_admin` | `is_tenant_admin` | `csm_tenant_ids` | `lecturer_course_ids` | `lecturer_can_edit_course_ids` |
|------|-------------|--------------------|--------------------|-------------------|----------------------|-------------------------------|
| Platform Admin | Calypso ID | `true` | `false` | `[]` | `[]` | `[]` |
| Lecturer (edit) | Calypso ID | `false` | `false` | `[]` | `[<COURSE_ID>]` | `[<COURSE_ID>]` |
| Lecturer (view) | Calypso ID | `false` | `false` | `[]` | `[<COURSE_ID>]` | `[]` |
| CSM | Calypso ID | `false` | `false` | `[<CLIENT_TENANT_ID>]` | `[]` | `[]` |
| Calypso Learner | Calypso ID | `false` | `false` | `[]` | `[]` | `[]` |
| Client TA | Client ID | `false` | `true` | `[]` | `[]` | `[]` |
| Client Learner | Client ID | `false` | `false` | `[]` | `[]` | `[]` |

---

## Cleanup (if needed)

To remove all test users and start fresh:

```bash
# Delete users via Admin API (this cascades to profiles via FK)
for EMAIL in \
  "lecturer-edit@calypso-commodities.com" \
  "lecturer-view@calypso-commodities.com" \
  "csm@calypso-commodities.com" \
  "learner@calypso-commodities.com" \
  "admin@calypsoclient.com" \
  "learner@calypsoclient.com"; do

  USER_ID=$(curl -s "$SUPABASE_URL/auth/v1/admin/users?page=1&per_page=50" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" | \
    jq -r ".users[] | select(.email == \"$EMAIL\") | .id")

  if [ -n "$USER_ID" ]; then
    curl -s -X DELETE "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY"
    echo "Deleted: $EMAIL ($USER_ID)"
  fi
done
```

To remove the client tenant:
```sql
DELETE FROM tenants WHERE domain = 'calypsoclient.com';
```

---

## Notes

- **JWT claims refresh on re-login** (~1hr token lifetime). After changing role assignments, the user must log out and back in to get updated claims.
- **`protect_profile_role_fields()` trigger** blocks role changes via normal Supabase client calls. Must disable trigger temporarily when setting up roles via SQL Editor.
- **`enforce_master_tenant_assignment()` trigger** prevents CSM/Lecturer assignments for non-master-tenant users.
- **`enforce_platform_roles_master_tenant()` trigger** prevents `is_platform_admin = true` for non-master-tenant users.
- **Equinor tenant is SSO-only** — cannot create email+password test users on that domain.
- **`handle_new_user()` trigger** auto-creates profiles from email domain matching `tenants.domain`. If the domain doesn't match a tenant, NO profile is created (user exists in auth but has zero RLS access).
