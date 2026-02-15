> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — User Management E2E User Stories (Phase 9B)

## Overview

E2E testing scenarios for the User Management page at `/admin/users` (Phase 9B). These stories verify the **dual-role** admin workflow: both Tenant Admin (TA) and Platform Admin (PA) can access this page, but with different views and capabilities.

**TA view:** Sees only own-tenant users (RLS-scoped via `profiles_select_tenant`), no tenant column, no Platform Admin toggle, no tenant picker in invite form.

**PA view:** Sees all users across all tenants, tenant column visible, Platform Admin summary card + toggle, tenant picker in invite form.

**Key features tested:**
- User list with role-scoped visibility (TA vs PA)
- Invite user via FastAPI `POST /api/invite` → `supabase.auth.admin.invite_user_by_email()`
- Role toggles (`is_tenant_admin`, `is_platform_admin`) protected by `protect_profile_role_fields()` trigger
- Profile editing (`full_name`)
- Self-protection (cannot modify own admin flags)
- Role-based access control (Learner/Lecturer/CSM blocked)

**Backend endpoint:** `POST /api/invite` (FastAPI) — PA or TA only. Validates tenant exists, checks duplicate email, calls Supabase Admin API to create auth user + send invitation email. `handle_new_user()` trigger auto-creates the profile.

**No migration needed** — `profiles` table, all RLS policies, and all triggers already exist.

**Cross-references:**
- Phase 9A (Tenant Management) is the companion admin board for tenants
- `UserManagementService` is a separate service from `AuthService` — admin CRUD via Supabase + invite via ApiService
- Route guarded by `roleGuard('tenant_admin', 'platform_admin')` — both TA and PA can access
- Sidebar entry: "Tenant Admin" section → "User Management" (Users icon) — visible to both `tenant_admin` and `platform_admin` roles

**Key DB triggers relevant:**
- `protect_profile_role_fields()` — PA can change any role field; TA can only toggle `is_tenant_admin` on same-tenant users
- `enforce_platform_roles_master_tenant()` — blocks `is_platform_admin = true` for non-master-tenant users
- `handle_new_user()` — creates profile from email domain match OR `raw_user_meta_data.tenant_id` (for invites)
- `set_profile_audit_fields()` — auto-sets `updated_at` on update

**Key RLS policies:**
- `profiles_select_tenant` (migration 00032) — ALL authenticated users can SELECT same-tenant profiles
- `profiles_select_platform_admin` — PA sees all profiles
- `profiles_update_tenant_admin` — TA can UPDATE same-tenant profiles
- `profiles_update_platform_admin` — PA can UPDATE any profile

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Primary Test Users** | `et@calypso-commodities.com` (PA), `admin@calypsoclient.com` (TA) |

### Alternative URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| **Production** | https://x-courses-v2.vercel.app | https://x-courses-v2-production.up.railway.app |
| **Production (Custom Domain)** | https://xcourses.x-lng.com | https://x-courses-v2-production.up.railway.app |
| **Local Dev** | http://localhost:4200 | http://localhost:8000 |

### Test Users

> Full setup instructions: [TEST_USERS.md](TEST_USERS.md)

All test users use password: `TestUser123!`

| # | Email | Role | Tenant | Used In |
|---|-------|------|--------|---------|
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | UM-01, UM-03, UM-05, UM-07, UM-08, UM-09, UM-11 |
| 2 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | UM-02, UM-04, UM-06, UM-10 |
| 3 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | UM-12 |
| 4 | `lecturer-edit@calypso-commodities.com` | **Lecturer** | Calypso (master) | UM-12 |
| 5 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | UM-12 |

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Passed |
| ❌ | Failed |
| ⏳ | Not Tested |
| ⚠️ | Partial |

---

## Recommended Test Order

**IMPORTANT**: Tests should be run in this order due to dependencies:

| Order | ID | Story | Dependencies |
|-------|-----|-------|--------------|
| 1 | UM-01 | PA — Navigation + Page Load | PA logged in, at least 3 users exist across 2+ tenants |
| 2 | UM-02 | TA — Navigation + Scoped View | TA logged in, users exist on TA's tenant |
| 3 | UM-03 | Summary Cards | UM-01 (page loads with data) |
| 4 | UM-04 | Filter by Search | UM-01 or UM-02 (multiple users exist) |
| 5 | UM-05 | Filter by Role | UM-01 (users with different roles exist) |
| 6 | UM-06 | Expand Row + Edit Profile | UM-01 (users exist) |
| 7 | UM-07 | Toggle Tenant Admin Role | UM-01 (regular user exists on same tenant) |
| 8 | UM-08 | Toggle Platform Admin Role (PA Only) | UM-01 (master tenant user exists) |
| 9 | UM-09 | Self-Role Protection | UM-01 (PA is viewing their own row) |
| 10 | UM-10 | Invite User (TA Flow) | TA logged in, SMTP or local mailer configured |
| 11 | UM-11 | Invite User (PA Flow) | PA logged in, SMTP configured, test tenant exists |
| 12 | UM-12 | Role Access Control | Multiple role logins |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| UM-01 | PA — Navigation + Page Load | Platform Admin | ✅ | 15 Feb 2026 |
| UM-02 | TA — Navigation + Scoped View | Tenant Admin | ✅ | 15 Feb 2026 |
| UM-03 | Summary Cards | Platform Admin | ✅ | 15 Feb 2026 |
| UM-04 | Filter by Search | Tenant Admin | ✅ | 15 Feb 2026 |
| UM-05 | Filter by Role | Platform Admin | ✅ | 15 Feb 2026 |
| UM-06 | Expand Row + Edit Profile | Platform Admin | ✅ | 15 Feb 2026 |
| UM-07 | Toggle Tenant Admin Role | Platform Admin | ✅ | 15 Feb 2026 |
| UM-08 | Toggle Platform Admin Role (PA Only) | Platform Admin | ✅ | 15 Feb 2026 |
| UM-09 | Self-Role Protection | Platform Admin | ✅ | 15 Feb 2026 |
| UM-10 | Invite User (TA Flow) | Tenant Admin | ✅ | 15 Feb 2026 |
| UM-11 | Invite User (PA Flow) | Platform Admin | ✅ | 15 Feb 2026 |
| UM-12 | Role Access Control | Multiple | ✅ | 15 Feb 2026 |

---

## Preconditions (All Stories)

- Platform Admin (`et@calypso-commodities.com`) and Tenant Admin (`admin@calypsoclient.com`) can log in with password
- At least 3 users exist across 2+ tenants (Calypso master + Calypso Client)
- At least one user with `is_tenant_admin = true` exists (besides the PA)
- At least one regular user (no admin flags) exists

**Verify existing users:**

```sql
SELECT p.email, p.full_name, p.is_platform_admin, p.is_tenant_admin,
       t.name as tenant_name, t.is_master
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
ORDER BY t.is_master DESC, p.email;
```

**Cleanup SQL** (run before testing to restore known state):

```sql
-- Delete any test-invited users from previous runs
DELETE FROM auth.users WHERE email IN (
  'e2e-invite-ta@calypsoclient.com',
  'e2e-invite-pa@calypsoclient.com'
);

-- Reset role flags on test users to known state (may need trigger disable)
ALTER TABLE profiles DISABLE TRIGGER protect_role_fields;

-- Ensure learner is NOT admin (in case previous test toggled and didn't revert)
UPDATE profiles SET is_tenant_admin = false, is_platform_admin = false
WHERE email = 'learner@calypso-commodities.com';

ALTER TABLE profiles ENABLE TRIGGER protect_role_fields;

-- Verify state
SELECT p.email, p.is_platform_admin, p.is_tenant_admin
FROM profiles p
WHERE p.email IN (
  'et@calypso-commodities.com',
  'admin@calypsoclient.com',
  'learner@calypso-commodities.com',
  'lecturer-edit@calypso-commodities.com',
  'csm@calypso-commodities.com'
);
```

---

## UM-01: PA — Navigation + Page Load

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify that Platform Admin can see "User Management" in the sidebar (under "Tenant Admin" section — PA was added to this section's roles), navigate to `/admin/users`, and see the full user table with tenant column, PA-specific summary cards, and filter bar.

**Covers**: Sidebar config (roles: `['tenant_admin', 'platform_admin']`), route `admin/users` with `roleGuard`, `UserManagementService.loadUsers()`, FK join `tenant:tenants(name)`, PA-specific UI elements

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `et@calypso-commodities.com` | Successful login, main layout visible |
| 2 | Look at sidebar | "Tenant Admin" section visible with "User Management" item (Users icon) |
| 3 | Click "User Management" in sidebar | Navigates to `/admin/users` |
| 4 | Wait for page to load | "User Management" header visible with Users icon + teal count badge |
| 5 | Verify "Invite User" button | Teal primary button in top-right corner with UserPlus icon |
| 6 | Verify filter bar | Search input ("Search by name or email...") + role dropdown ("All Roles") visible |
| 7 | Verify summary cards | 4 cards: "Total Users", "Tenant Admins" (amber), "Platform Admins" (teal, PA-only), "Regular Users" (slate) |
| 8 | Verify table headers | Headers: Name, Email, Roles, **Tenant** (PA-only column), Joined |
| 9 | Verify users from MULTIPLE tenants visible | Users from both Calypso (master) and Calypso Client visible |
| 10 | Verify role badges | PA user shows teal "Platform Admin" badge, TA user shows amber "Tenant Admin" badge, regular users show slate "User" badge |
| 11 | Verify tenant column values | Each row shows the tenant name (e.g., "Calypso", "Calypso Client") |
| 12 | Verify avatar initials | Users show 2-letter initials in circular avatar (first letters of first+last name) |

### SQL Verification

```sql
-- Count all users (PA should see this many)
SELECT COUNT(*) FROM profiles;

-- PA view: all users with tenant names
SELECT p.email, p.full_name, p.is_platform_admin, p.is_tenant_admin,
       t.name as tenant_name
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
ORDER BY p.created_at DESC;
```

### Notes / Learnings
- PA sees ALL users across all tenants via `profiles_select_platform_admin` policy
- FK join `tenant:tenants(name)` resolves tenant_name — null-safe: shows "Unknown" if tenant join fails
- "Tenant Admin" section in sidebar now includes `platform_admin` in roles (Phase 9B change)
- Tenant column is conditionally rendered: `@if (isPlatformAdmin())` — only visible to PA
- "Platform Admins" summary card is also PA-only
- Avatar initials: `full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)` — falls back to first letter of email if no name

---

## UM-02: TA — Navigation + Scoped View

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify that Tenant Admin sees only users from their own tenant (RLS-scoped by `profiles_select_tenant`), does NOT see the tenant column, does NOT see the "Platform Admins" summary card, and does NOT see the Platform Admin role toggle in expanded rows.

**Covers**: TA RLS scoping, conditional UI hiding, `profiles_select_tenant` policy, TA-specific view

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `admin@calypsoclient.com` (Tenant Admin on Calypso Client) | Successful login |
| 2 | Look at sidebar | "Tenant Admin" section visible with "User Management" item (Users icon) |
| 3 | Click "User Management" | Navigates to `/admin/users` |
| 4 | Wait for page to load | "User Management" header visible with count badge |
| 5 | Verify summary cards | **3 cards only**: "Total Users", "Tenant Admins", "Regular Users" — NO "Platform Admins" card |
| 6 | Verify table headers | Headers: Name, Email, Roles, Joined — **NO "Tenant" column** |
| 7 | Verify only own-tenant users visible | Only users from Calypso Client tenant shown (e.g., `admin@calypsoclient.com`, `learner@calypsoclient.com`) |
| 8 | Verify NO cross-tenant users | Users from Calypso (master) like `et@calypso-commodities.com` are NOT visible |
| 9 | Verify user count matches | Total count = number of profiles where `tenant_id` = Calypso Client's tenant ID |
| 10 | Click "Invite User" | Invite form shows email input but **NO tenant picker** (TA uses own tenant) |
| 11 | Click on a user row to expand | Expanded row shows name edit + "Tenant Admin" checkbox, but **NO "Platform Admin" checkbox** |

### SQL Verification

```sql
-- TA view: only same-tenant users
SELECT p.email, p.full_name, p.is_tenant_admin
FROM profiles p
WHERE p.tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com')
ORDER BY p.created_at DESC;

-- Count (should match TA's Total Users card)
SELECT COUNT(*) FROM profiles
WHERE tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com');
```

### Notes / Learnings
- RLS handles scoping automatically — TA's query returns only same-tenant profiles
- No client-side tenant filtering needed — `profiles_select_tenant` policy does `USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))`
- `isPlatformAdmin()` computed signal drives conditional rendering: tenant column, PA summary card, PA toggle
- TA can toggle `is_tenant_admin` on same-tenant users but NOT `is_platform_admin`
- If TA has zero other users in their tenant, they see only themselves (empty state unlikely unless brand-new tenant)

---

## UM-03: Summary Cards

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify that summary stat cards show accurate counts for the current (filtered) user list. PA sees 4 cards, TA sees 3.

**Covers**: `totalUsers`, `tenantAdminCount`, `platformAdminCount`, `regularUserCount` computed signals

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/users` | 4 summary cards visible |
| 2 | Count user rows in table | Matches "Total Users" card value |
| 3 | Count rows with "Tenant Admin" badge | Matches "Tenant Admins" card value |
| 4 | Count rows with "Platform Admin" badge | Matches "Platform Admins" card value |
| 5 | Count rows with "User" badge | Matches "Regular Users" card value |
| 6 | Apply a search filter | All cards recalculate for filtered data |
| 7 | Apply a role filter ("Tenant Admins") | "Total Users" = "Tenant Admins" count, others adjust |

### SQL Verification

```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_tenant_admin) as tenant_admins,
  COUNT(*) FILTER (WHERE is_platform_admin) as platform_admins,
  COUNT(*) FILTER (WHERE NOT is_tenant_admin AND NOT is_platform_admin) as regular_users
FROM profiles;
```

### Notes / Learnings
- All counts derive from `filteredUsers()` — applying any filter recalculates all cards
- A user can be both `is_tenant_admin` AND `is_platform_admin` — they'd count in both TA and PA buckets
- `tabular-nums` font class ensures consistent number width
- PA card uses teal-600, TA card uses amber-600, Regular card uses slate-500

---

## UM-04: Filter by Search

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify search filter correctly filters users by name or email (case-insensitive).

**Covers**: `searchTerm` signal, `filteredUsers` computed — `full_name`/`email` matching

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as TA, navigate to `/admin/users` | Users listed |
| 2 | Type partial email (e.g., "admin") in search | Only users with "admin" in name or email shown |
| 3 | Verify summary cards update | Counts reflect filtered rows |
| 4 | Clear search, type a name (e.g., "Learner") | Filters by full_name match |
| 5 | Clear search, type non-existent term (e.g., "zzzzz") | Empty state: "No users found." |
| 6 | Click "Clear filters" | All users visible, original count restored |

### Notes / Learnings
- Search is case-insensitive (`.toLowerCase()` applied to both term and field values)
- Search checks two fields: `full_name` (null-safe) and `email`
- "Clear filters" link appears when search term OR role filter is non-default

---

## UM-05: Filter by Role

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify the role dropdown filter correctly filters users by role category.

**Covers**: `roleFilter` signal, dropdown options, filter logic

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/users` | All users listed, role dropdown shows "All Roles" |
| 2 | Select "Tenant Admins" from dropdown | Only users with `is_tenant_admin = true` shown |
| 3 | Verify badges | All visible rows show amber "Tenant Admin" badge |
| 4 | Select "Platform Admins" | Only users with `is_platform_admin = true` shown |
| 5 | Select "Regular Users" | Only users with neither admin flag shown |
| 6 | Verify "User" badges | All visible rows show slate "User" badge |
| 7 | Select "All Roles" | All users visible again |
| 8 | Combine role filter with search | Both filters apply (AND logic) |

### Notes / Learnings
- Role filter options: "All Roles", "Tenant Admins", "Platform Admins", "Regular Users"
- "Regular Users" = `!is_tenant_admin && !is_platform_admin`
- Role filter + search combine with AND logic
- "Platform Admins" option exists in dropdown even for TA, but TA won't have any PA users in their tenant list (they're all on master tenant)

---

## UM-06: Expand Row + Edit Profile

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify the expand/collapse row behavior and profile name editing: click a user row to expand, see name input pre-filled, modify name, save, verify persistence.

**Covers**: `onExpandUser()`, `editName` pre-fill, `UserManagementService.updateUserProfile()`, data reload

### Preconditions
- A user exists whose name can be safely modified (use a test learner)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/users` | Users table loaded |
| 2 | Click on a user row (e.g., `learner@calypso-commodities.com`) | Row expands below with "Edit User" heading, name input, role checkboxes, user info section |
| 3 | Verify name input pre-filled | Shows current `full_name` (e.g., "Test Learner (Calypso)") |
| 4 | Verify user info section | Shows user ID, tenant name + ID, created_at, updated_at |
| 5 | Change name to "Test Learner Updated" | Input updated |
| 6 | Click "Save" button | Spinner on button → row collapses → data reloads |
| 7 | Verify updated name in table | "Test Learner Updated" visible in the name column |
| 8 | Click same user row again | Expands with updated name in the input |
| 9 | Change name back to "Test Learner (Calypso)" and save | Restore original name |

### SQL Verification

```sql
-- Verify name updated
SELECT email, full_name, updated_at
FROM profiles WHERE email = 'learner@calypso-commodities.com';
```

### Notes / Learnings
- Pre-fill logic in `onExpandUser()`: `editName.set(user.full_name ?? '')`
- `updateUserProfile()` sends `{ full_name }` to base `profiles` table
- After saving, `loadUsers()` is called to refresh all data
- Save error is shown inline below the edit form
- Clicking an already-expanded row collapses it (toggle behavior)

---

## UM-07: Toggle Tenant Admin Role

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify that PA can toggle the `is_tenant_admin` flag on another user, and the role badge updates accordingly. Then toggle back to restore original state.

**Covers**: `onToggleTenantAdmin()`, `UserManagementService.updateUserRoles()`, `protect_profile_role_fields()` trigger, badge re-rendering

### Preconditions
- A regular user exists on the same tenant (e.g., `learner@calypso-commodities.com` on Calypso master)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/users` | Users listed |
| 2 | Find `learner@calypso-commodities.com` | Shows slate "User" badge (no admin flags) |
| 3 | Click on the learner row to expand | Expanded section shows "Tenant Admin" checkbox (unchecked) |
| 4 | Click the "Tenant Admin" checkbox | Spinner briefly, then data reloads |
| 5 | Verify badge change | Learner now shows amber "Tenant Admin" badge instead of "User" |
| 6 | Verify summary cards update | "Tenant Admins" count increased by 1, "Regular Users" decreased by 1 |
| 7 | Click on the learner row again to expand | "Tenant Admin" checkbox is now checked |
| 8 | Click the checkbox again to toggle OFF | Spinner → data reloads → badge reverts to "User" |
| 9 | Verify original state restored | Badge is slate "User" again, summary cards back to original counts |

### SQL Verification

```sql
-- Check role flag (during and after test)
SELECT email, is_tenant_admin, is_platform_admin
FROM profiles WHERE email = 'learner@calypso-commodities.com';
```

### Notes / Learnings
- `protect_profile_role_fields()` trigger validates JWT claims: PA can toggle any role field
- TA can also toggle `is_tenant_admin` on same-tenant users (but NOT `is_platform_admin`)
- After toggling, the affected user's JWT claims won't refresh until they re-login (~1hr token lifetime)
- The role toggle immediately calls `updateUserRoles()` + `loadUsers()` — no separate Save button (checkbox triggers directly)
- Badge rendering is reactive: `is_tenant_admin` → amber badge, neither → slate badge

---

## UM-08: Toggle Platform Admin Role (PA Only)

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify that PA can toggle the `is_platform_admin` flag on another master-tenant user. TA should NOT see this toggle at all.

**Covers**: `onTogglePlatformAdmin()`, `isPlatformAdmin()` conditional rendering, `enforce_platform_roles_master_tenant()` trigger

### Preconditions
- A master-tenant user exists who is NOT a PA (e.g., `learner@calypso-commodities.com`)
- **Important:** `is_platform_admin` can only be set on master-tenant users (trigger-enforced)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/users` | Users listed |
| 2 | Find `learner@calypso-commodities.com` (master tenant) | Shows "User" badge |
| 3 | Click row to expand | Two role checkboxes visible: "Tenant Admin" (Shield icon, amber) and "Platform Admin" (ShieldCheck icon, teal) |
| 4 | Click "Platform Admin" checkbox | Spinner → data reloads |
| 5 | Verify badge change | Learner now shows teal "Platform Admin" badge |
| 6 | Verify "Platform Admins" summary card increased | Count increased by 1 |
| 7 | **Immediately toggle back** — click row, uncheck "Platform Admin" | Spinner → reloads → badge reverts to "User" |
| 8 | Verify original state restored | Counts back to original |

### SQL Verification

```sql
-- Verify (during toggle)
SELECT email, is_platform_admin FROM profiles
WHERE email = 'learner@calypso-commodities.com';
```

### Notes / Learnings
- `is_platform_admin` toggle ONLY visible to PA users (`@if (isPlatformAdmin())` in template)
- `enforce_platform_roles_master_tenant()` trigger would block setting PA flag on a non-master-tenant user — this is enforced at DB level, not UI level
- **CRITICAL: Toggle back immediately!** Leaving a test user as PA could affect other tests
- TA expanded row shows ONLY "Tenant Admin" checkbox, never "Platform Admin"
- Both role toggles trigger immediately on checkbox change (no separate Save button)

---

## UM-09: Self-Role Protection

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify that a user cannot modify their own admin flags — checkboxes are disabled and a "Cannot modify own role" message is shown. This prevents accidental self-lockout.

**Covers**: `isSelf(userId)` check, checkbox `[disabled]` binding, "Cannot modify own role" message

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA (`et@calypso-commodities.com`), navigate to `/admin/users` | Users listed |
| 2 | Find the PA's own row (`et@calypso-commodities.com`) | Shows teal "Platform Admin" badge |
| 3 | Click own row to expand | Expanded section shows role checkboxes |
| 4 | Verify "Tenant Admin" checkbox is **disabled** | Checkbox is greyed out / not clickable |
| 5 | Verify "Platform Admin" checkbox is **disabled** | Checkbox is greyed out / not clickable |
| 6 | Verify "Cannot modify own role" message | Italic slate text next to each disabled checkbox |
| 7 | Verify name edit is still functional | Name input is editable, Save button works for profile changes |

### Notes / Learnings
- `isSelf()` compares `AuthService.currentUser()?.id` with the row's `user.id`
- Only role checkboxes are disabled — profile name editing still works on own account
- This is a UI-level protection. The `protect_profile_role_fields()` trigger is the DB-level protection.
- Without self-protection, a PA could accidentally uncheck their own PA flag and lock themselves out

---

## UM-10: Invite User (TA Flow)

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify the TA invite workflow: open invite form (no tenant picker), enter email, submit via FastAPI, see success message. The backend uses the TA's JWT `tenant_id` to determine which tenant to create the user in.

**Covers**: `onToggleInviteForm()`, invite form (TA variant — no tenant picker), `UserManagementService.inviteUser()`, `POST /api/invite` (FastAPI), success/error states

### Preconditions
- TA logged in (`admin@calypsoclient.com`)
- SMTP/mailer configured (Supabase Dashboard → Authentication → SMTP, or local Inbucket on localhost)
- The test email (`e2e-invite-ta@calypsoclient.com`) does NOT already exist

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as TA, navigate to `/admin/users` | Page loads |
| 2 | Click "Invite User" button | Form slides in with "Invite New User" heading |
| 3 | Verify form has email input ONLY | Email input (placeholder: "user@example.com"), NO tenant dropdown (TA flow) |
| 4 | Enter email: `e2e-invite-ta@calypsoclient.com` | Email input populated |
| 5 | Click "Send Invitation" | Spinner on button (Mail icon → Loader2), then success |
| 6 | Verify success message | Green emerald panel: "Invitation sent successfully!" |
| 7 | Verify email input cleared | Email field is empty after success |
| 8 | Wait for user list to reload | New user may appear in table (if `handle_new_user()` trigger fires immediately) |

### SQL Verification

```sql
-- Verify invited user was created in auth
SELECT id, email, invited_at, confirmed_at
FROM auth.users WHERE email = 'e2e-invite-ta@calypsoclient.com';

-- Verify profile was created (handle_new_user trigger)
SELECT p.email, p.full_name, p.tenant_id, t.name as tenant_name
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
WHERE p.email = 'e2e-invite-ta@calypsoclient.com';
-- tenant should be Calypso Client (TA's tenant, passed via raw_user_meta_data.tenant_id)
```

### Cleanup (REQUIRED after test)

```sql
-- Delete invited user (cascades to profile via FK)
DELETE FROM auth.users WHERE email = 'e2e-invite-ta@calypsoclient.com';
```

### Notes / Learnings
- TA flow: backend uses `user.tenant_id` from JWT (not from request body)
- Even if TA tries to pass `tenant_id` in the request, the backend ignores it (only PA can override)
- `handle_new_user()` trigger fires on auth user creation — resolves tenant from `raw_user_meta_data.tenant_id` (set by invite endpoint)
- The invited user gets an email with a confirmation link — they must click it to set their password
- **Invite error cases**: duplicate email → 409 ("A user with this email already exists"), missing tenant → 404
- On local dev, check Supabase's Inbucket at `http://localhost:54324` for the invite email

---

## UM-11: Invite User (PA Flow)

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify the PA invite workflow: open invite form WITH tenant picker, select a tenant, enter email, submit. Also tests the duplicate email error case.

**Covers**: PA invite form (tenant dropdown), `loadAvailableTenants()`, `inviteTenantId` signal, error handling (409 Conflict)

### Preconditions
- PA logged in (`et@calypso-commodities.com`)
- At least 2 tenants exist (for the tenant picker)
- The test email (`e2e-invite-pa@calypsoclient.com`) does NOT already exist

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/users` | Page loads |
| 2 | Click "Invite User" button | Form slides in with "Invite New User" heading |
| 3 | Verify form has BOTH email input AND tenant dropdown | Email input + "Tenant" label + select dropdown with tenant options |
| 4 | Verify tenant dropdown options | Lists all tenants by name (e.g., "Calypso", "Calypso Client", "Equinor") |
| 5 | Select "Calypso Client" from tenant dropdown | Dropdown value set |
| 6 | Enter email: `e2e-invite-pa@calypsoclient.com` | Email input populated |
| 7 | Click "Send Invitation" | Spinner → success message |
| 8 | Verify success: "Invitation sent successfully!" | Green emerald panel visible |
| 9 | **Test duplicate error**: Re-open form, enter same email `e2e-invite-pa@calypsoclient.com`, select same tenant, submit | Red error: "A user with this email already exists" (409 from backend) |

### SQL Verification

```sql
-- Verify invited user
SELECT id, email, raw_user_meta_data->>'tenant_id' as invite_tenant_id
FROM auth.users WHERE email = 'e2e-invite-pa@calypsoclient.com';

-- Verify profile tenant
SELECT p.email, t.name as tenant_name
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
WHERE p.email = 'e2e-invite-pa@calypsoclient.com';
-- tenant should be Calypso Client (PA selected it)
```

### Cleanup (REQUIRED after test)

```sql
DELETE FROM auth.users WHERE email = 'e2e-invite-pa@calypsoclient.com';
```

### Notes / Learnings
- PA flow: backend uses `body.tenant_id` (from the tenant picker) because `user.is_platform_admin` is true
- Tenant dropdown loads from `tenants` table: `.select('id, name').order('name')` — PA has SELECT all
- Tenants are loaded lazily: when invite form is first opened or when a user row is expanded (whichever comes first)
- "Send Invitation" button is disabled when email is empty OR tenant is not selected (for PA)
- Duplicate invite returns HTTP 409 from FastAPI → shown as red error inline in the form
- Cancel button closes the form and resets all fields + errors

---

## UM-12: Role Access Control

| Field | Value |
|-------|-------|
| **Last Checked** | 14 Feb 2026 |
| **Status** | ✅ |
| **Tester** | Claude E2E |

**Purpose**: Verify that ONLY Tenant Admin and Platform Admin can access `/admin/users`. Learners, Lecturers, and CSMs should be blocked by the route guard.

**Covers**: `roleGuard('tenant_admin', 'platform_admin')`, sidebar "Tenant Admin" section visibility

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `learner@calypso-commodities.com` | Successful login |
| 2 | Check sidebar | "Tenant Admin" section NOT visible |
| 3 | Navigate directly to `/admin/users` | Redirected away (guard blocks access) |
| 4 | Logout, login as `lecturer-edit@calypso-commodities.com` | Successful login |
| 5 | Check sidebar | "Teaching" section visible, but "Tenant Admin" section NOT visible |
| 6 | Navigate directly to `/admin/users` | Redirected away |
| 7 | Logout, login as `csm@calypso-commodities.com` | Successful login |
| 8 | Check sidebar | "CSM" section visible, but "Tenant Admin" section NOT visible |
| 9 | Navigate directly to `/admin/users` | Redirected away |
| 10 | Logout, login as `admin@calypsoclient.com` (Tenant Admin) | Successful login |
| 11 | Check sidebar | "Tenant Admin" section visible with "User Management" (Users icon) |
| 12 | Navigate to `/admin/users` | Page loads successfully, own-tenant users visible |
| 13 | Logout, login as `et@calypso-commodities.com` (Platform Admin) | Successful login |
| 14 | Check sidebar | "Tenant Admin" section visible with "User Management" |
| 15 | Navigate to `/admin/users` | Page loads successfully, ALL users visible |

### Notes / Learnings
- Route guard checks JWT claims: `is_tenant_admin` OR `is_platform_admin`
- Sidebar "Tenant Admin" section has `roles: ['tenant_admin', 'platform_admin']` (updated in Phase 9B)
- Unlike Tenant Management (PA-only), User Management allows BOTH TA and PA
- Even if a user bypasses the route guard, RLS policies would restrict data: learners/lecturers/CSMs have no UPDATE policy on profiles (except learner's self-update policy, if it exists)
- This is a two-role page — the first admin page that allows a non-PA role

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| UM-BUG-01 | UM-10/11 | `POST /api/invite` crashes with `AttributeError: 'NoneType' object has no attribute 'data'` — Python postgrest-py `maybe_single().execute()` returns `None` for 0 rows (not a response with `data=None`). Backend crashed before CORS middleware could add headers, causing browser CORS error. | **Critical** | Added null checks: `tenant_result is None or not tenant_result.data` and `existing is not None and existing.data`. Updated test mocks to use `None` for 0-row cases. | ✅ Fixed (commit 521c658) |

---

## Data Setup Notes

### Verifying Roles Before Testing

Ensure at least one user of each type exists for meaningful filter/count testing:

```sql
SELECT
  p.email, p.full_name,
  CASE
    WHEN p.is_platform_admin THEN 'Platform Admin'
    WHEN p.is_tenant_admin THEN 'Tenant Admin'
    ELSE 'Regular User'
  END as role_label,
  t.name as tenant_name
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
ORDER BY t.is_master DESC, role_label, p.email;
```

### Invite Test Cleanup

After running UM-10 and UM-11, always clean up invited test users:

```sql
-- Delete ALL test-invited users
DELETE FROM auth.users WHERE email IN (
  'e2e-invite-ta@calypsoclient.com',
  'e2e-invite-pa@calypsoclient.com'
);

-- Verify cleanup
SELECT email FROM profiles WHERE email LIKE 'e2e-invite-%';
-- Should return 0 rows
```

### Restoring Role Flags After Toggle Tests

If UM-07 or UM-08 was interrupted before reverting:

```sql
ALTER TABLE profiles DISABLE TRIGGER protect_role_fields;

UPDATE profiles
SET is_tenant_admin = false, is_platform_admin = false
WHERE email = 'learner@calypso-commodities.com';

ALTER TABLE profiles ENABLE TRIGGER protect_role_fields;
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 14 Feb 2026 | Claude E2E | UM-01 to UM-12 | 12 | 0 | 1 bug found+fixed (UM-BUG-01: maybe_single returns None). All 12 stories pass after fix. 5 roles tested (PA, TA, Learner, Lecturer, CSM). |
| 15 Feb 2026 | Claude (Playwright MCP) | UM-01 to UM-12 | 12 | 0 | Full regression run. PA board: 9 users (Total:9, TA:1, PA:1, Regular:7), role filter dropdown, Invite User button, cross-tenant view with Tenant column. No regressions. |
| 15 Feb 2026 | Claude Opus 4.6 (Playwright MCP) | UM-01 to UM-12 (Phase 10C regression) | 12 | 0 | Post-10C regression. PA: 9 users, 4 cards (9/1/1/7), Tenant col, search debounce ("admin"→1 user), role filter ("Platform Admins"→1), expand row (name+role checkboxes), self-protection (both checkboxes disabled+"Cannot modify own role"), invite form (email+tenant picker, 3 tenants). TA: 2 users, 3 cards (no PA), no Tenant col, invite form (email only, no tenant picker), expand shows only TA checkbox. Learner blocked→/dashboard. No regressions from pagination/debounce. |

---

## References

- [Tenant Management E2E Stories (Phase 9A)](TENANT_MANAGEMENT_USER_STORIES.md) — companion admin board for tenants
- [Test Users](TEST_USERS.md) — full test user matrix
- `UserManagementPageComponent`: `frontend/src/app/features/admin/pages/user-management-page.component.ts`
- `UserManagementService`: `frontend/src/app/core/services/user-management.service.ts`
- `UserForBoard` model: `frontend/src/app/core/models/user-management.model.ts`
- FastAPI invite endpoint: `backend/app/routers/invite.py`
- Sidebar config: `frontend/src/app/layout/sidebar/sidebar-nav.config.ts` (lines 43-48, updated in Phase 9B)
- DB policies: migrations `00004` (RLS), `00015` (protect_profile_role_fields trigger), `00032` (profiles_select_tenant)
- Route: `frontend/src/app/app.routes.ts` (lines 165-172)
