# X-Courses v2 — Tenant Management E2E User Stories (Phase 9A)

## Overview

E2E testing scenarios for the Tenant Management page at `/platform/tenants` (Phase 9A). These stories verify the Platform Admin workflow for managing tenants: navigating to the board, viewing the tenants table with 4 summary cards, filtering by name/domain search, creating new tenants, editing tenant details (name, domain, auth methods), managing course assignments (with cascade warnings), managing CSM assignments, deleting non-master tenants (two-click confirmation), and role-based access control.

**Frontend-only phase** — no DB migrations needed. All tables (`tenants`, `tenant_courses`, `csm_tenant_assignments`), RLS policies, triggers (`protect_tenant_critical_fields`, `enforce_master_tenant_assignment`, `cleanup_tenant_course_removal`, `set_tenant_audit_fields`), and constraints already exist (migrations 00001-00023).

**Cross-references:**
- `TenantManagementService` is a NEW separate service (not the auth-flow `TenantService`) — admin CRUD via Supabase
- Route guarded by `roleGuard('platform_admin')` — only PA can access
- Sidebar entry: "Platform" section → "Tenant Management" (Building2 icon)
- Follows the expandable-row board pattern from `IssueManagementPageComponent` (Phase 7B) with 3 tabbed sub-sections

**Key DB triggers relevant:**
- `protect_tenant_critical_fields()` — blocks changes to `is_master` after creation
- `enforce_master_tenant_assignment()` — CSM assignment only allows master-tenant users
- `cleanup_tenant_course_removal()` — CASCADE: removing course from tenant deletes enrollments + progress
- `set_tenant_audit_fields()` — auto-sets `updated_at` on update

**Key RLS policies:**
- `tenants_select_platform_admin` — PA sees all tenants
- `tenants_insert_platform_admin` — PA can create tenants
- `tenants_update_platform_admin` — PA can update tenants
- `tenants_delete_platform_admin` — PA can delete tenants (except master — trigger blocks `is_master` changes, CASCADE handles cleanup)
- `tenant_courses_insert_platform_admin` / `tenant_courses_delete_platform_admin` — PA manages course assignments
- `csm_tenant_assignments_insert_platform_admin` / `csm_tenant_assignments_delete_platform_admin` — PA manages CSM assignments

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Primary Test User** | et@calypso-commodities.com (Platform Admin) |
| **Tenant** | Calypso (master tenant) |

### Alternative URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| **Production** | https://x-courses-v2.vercel.app | https://x-courses-v2-production.up.railway.app |
| **Local Dev** | http://localhost:4200 | http://localhost:8000 |

### Test Users

> Full setup instructions: [TEST_USERS.md](TEST_USERS.md)

All test users use password: `TestUser123!`

| # | Email | Role | Tenant | Used In |
|---|-------|------|--------|---------|
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | TM-01 through TM-09 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit, can_grade)** | Calypso (master) | TM-10 |
| 3 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | TM-10 |
| 4 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | TM-10 |
| 5 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | TM-10 |

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
| 1 | TM-01 | Navigation + Page Load | PA logged in, at least 2 tenants exist |
| 2 | TM-02 | Summary Cards | TM-01 (page loads with data) |
| 3 | TM-03 | Filter by Search | TM-01 (multiple tenants exist) |
| 4 | TM-04 | Create New Tenant | TM-01 (page loads) |
| 5 | TM-05 | Edit Tenant Details | TM-04 (new tenant exists to edit) or existing tenant |
| 6 | TM-06 | Master Tenant Protection | TM-01 (master tenant exists) |
| 7 | TM-07 | Manage Course Assignments | TM-01 (tenant with courses exists), at least one unassigned course |
| 8 | TM-08 | Manage CSM Assignments | TM-01 (tenant exists), at least one available CSM |
| 9 | TM-09 | Delete Tenant | TM-04 (test tenant created — will be deleted) |
| 10 | TM-10 | Role Access Control | Multiple role logins |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| TM-01 | Navigation + Page Load | Platform Admin | ✅ | 2026-02-14 |
| TM-02 | Summary Cards | Platform Admin | ✅ | 2026-02-14 |
| TM-03 | Filter by Search | Platform Admin | ✅ | 2026-02-14 |
| TM-04 | Create New Tenant | Platform Admin | ✅ | 2026-02-14 |
| TM-05 | Edit Tenant Details | Platform Admin | ✅ | 2026-02-14 |
| TM-06 | Master Tenant Protection | Platform Admin | ✅ | 2026-02-14 |
| TM-07 | Manage Course Assignments | Platform Admin | ✅ | 2026-02-14 |
| TM-08 | Manage CSM Assignments | Platform Admin | ✅ | 2026-02-14 |
| TM-09 | Delete Tenant | Platform Admin | ✅ | 2026-02-14 |
| TM-10 | Role Access Control | Multiple | ✅ | 2026-02-14 |

---

## Preconditions (All Stories)

- Platform Admin user (`et@calypso-commodities.com`) can log in with password
- At least 2 tenants exist: Calypso (master) and Calypso Client (non-master)
- At least one course exists and is assigned to a tenant via `tenant_courses`
- At least one CSM exists (from master tenant) assigned to a tenant via `csm_tenant_assignments`

**Verify existing tenants**:

```sql
SELECT id, name, domain, is_master, settings->'auth_methods' as auth_methods,
       (SELECT COUNT(*) FROM tenant_courses tc WHERE tc.tenant_id = t.id) as course_count,
       (SELECT COUNT(*) FROM csm_tenant_assignments cta WHERE cta.tenant_id = t.id) as csm_count
FROM tenants t
ORDER BY is_master DESC, name;
```

**Verify courses exist for assignment testing**:

```sql
-- All courses (shared, no tenant_id)
SELECT id, title FROM courses ORDER BY title;

-- Courses already assigned to Calypso Client
SELECT tc.id, c.title
FROM tenant_courses tc
JOIN courses c ON c.id = tc.course_id
JOIN tenants t ON t.id = tc.tenant_id
WHERE t.domain = 'calypsoclient.com';
```

**Verify CSMs available for assignment testing**:

```sql
-- CSMs already assigned
SELECT cta.id, p.email, p.full_name, t.name as tenant_name
FROM csm_tenant_assignments cta
JOIN profiles p ON p.id = cta.user_id
JOIN tenants t ON t.id = cta.tenant_id;
```

**Cleanup SQL** (run before testing to ensure clean state):

```sql
-- Delete test tenants from previous test runs (if any)
DELETE FROM tenants WHERE domain = 'e2etest.com';

-- Check current state
SELECT id, name, domain, is_master FROM tenants ORDER BY is_master DESC, name;
```

---

## TM-01: Navigation + Page Load

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that Platform Admin can see "Tenant Management" in the sidebar Platform section, navigate to `/platform/tenants`, and see the tenants table with summary cards and filter bar.

**Covers**: Sidebar config (`roles: ['platform_admin']`, Building2 icon), route `platform/tenants` with `roleGuard('platform_admin')`, `TenantManagementService.loadTenants()`, aggregate count joins

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `et@calypso-commodities.com` | Successful login, main layout visible |
| 2 | Look at sidebar | "Platform" section visible with "Tenant Management" item (Building2 icon) |
| 3 | Click "Tenant Management" in sidebar | Navigates to `/platform/tenants` |
| 4 | Wait for page to load | "Tenant Management" header visible with Building2 icon + teal count badge |
| 5 | Verify "Add Tenant" button | Teal primary button in top-right corner with Plus icon |
| 6 | Verify filter bar | Search input ("Search by name or domain...") visible |
| 7 | Verify summary cards | 4 cards: "Total Tenants", "Master", "Course Assignments", "CSM Assignments" with numeric values |
| 8 | Verify table headers | Table headers: Name, Domain, Auth Methods, Courses, CSMs |
| 9 | Verify at least two tenant rows | Calypso (master, with Shield icon + "Master" badge) and Calypso Client visible |
| 10 | Verify auth method pills | Calypso row shows auth method pills (e.g., "Email", "Magic Link", "Keycloak SSO") |
| 11 | Verify course/CSM counts | Each row shows numeric course count and CSM count |

### SQL Verification

```sql
-- Verify tenants with counts
SELECT t.id, t.name, t.domain, t.is_master,
       t.settings->'auth_methods' as auth_methods,
       (SELECT COUNT(*) FROM tenant_courses tc WHERE tc.tenant_id = t.id) as courses,
       (SELECT COUNT(*) FROM csm_tenant_assignments cta WHERE cta.tenant_id = t.id) as csms
FROM tenants t
ORDER BY t.is_master DESC, t.name;
```

### Notes / Learnings
- RLS: `tenants_select_platform_admin` uses `USING (is_platform_admin = 'true')` — PA sees all tenants
- Count aggregation: `.select('*, tenant_courses(count), csm_tenant_assignments(count)')` — Supabase returns `[{count: N}]` per relation
- Master badge (Shield icon) shown only for `is_master = true` tenants
- Auth method pills map: `email_password` → "Email", `magic_link` → "Magic Link", `keycloak_sso` → "Keycloak SSO"
- Sidebar "Platform" section only visible to `platform_admin` role

---

## TM-02: Summary Cards

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that the 4 summary stat cards are accurate and reflect the current data. Cards show: Total Tenants, Master (always 1), Total Course Assignments (sum across all tenants), Total CSM Assignments (sum across all tenants).

**Covers**: `totalTenants`, `masterCount`, `totalCourseAssignments`, `totalCsmAssignments` computed signals

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/tenants` | Page loads with summary cards |
| 2 | Count tenant rows in table | Matches "Total Tenants" card value |
| 3 | Count rows with "Master" badge | Matches "Master" card value (should be 1) |
| 4 | Sum all "Courses" column values | Matches "Course Assignments" card value |
| 5 | Sum all "CSMs" column values | Matches "CSM Assignments" card value |
| 6 | Apply a search filter | All 4 summary cards recalculate for filtered data |

### SQL Verification

```sql
-- Calculate expected stats
SELECT
  COUNT(*) as total_tenants,
  COUNT(*) FILTER (WHERE is_master) as master_count,
  (SELECT COUNT(*) FROM tenant_courses) as total_course_assignments,
  (SELECT COUNT(*) FROM csm_tenant_assignments) as total_csm_assignments
FROM tenants;
```

### Notes / Learnings
- Summary cards use `tabular-nums` font class for consistent number width
- All counts derive from `filteredTenants()` — applying search filter recalculates all 4 cards
- Master count should always be 1 (unique partial index enforces single master)
- Course/CSM assignments are summed from individual tenant counts in the filtered list

---

## TM-03: Filter by Search

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that the search filter correctly filters tenants by name or domain (case-insensitive).

**Covers**: `searchTerm` signal, `filteredTenants` computed — name/domain matching

### Preconditions
- At least 2 tenants with distinct names and domains

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/tenants` | Multiple tenants visible |
| 2 | Note the total tenant count | e.g., "Total Tenants: 3" in summary card |
| 3 | Type "calypso" into search input | Tenants with "calypso" in name or domain shown (both Calypso and Calypso Client) |
| 4 | Verify summary cards update | Total count reflects filtered rows |
| 5 | Clear search, type "calypsoclient.com" | Only Calypso Client tenant shown (domain match) |
| 6 | Clear search, type "equinor" | Only Equinor tenant shown (if it exists) |
| 7 | Clear search | All tenants visible, original count restored |

### Notes / Learnings
- Search is case-insensitive (`.toLowerCase()` applied to both search term and field values)
- Search checks two fields: `name` and `domain`
- No "Clear filters" link — just clear the search input (single filter dimension, unlike Issue Management's 4 filters)
- Domain can be null — null-safe check in filter logic

---

## TM-04: Create New Tenant

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify the full create tenant workflow: open form, fill name + domain + auth methods, submit, verify tenant appears in the table. This tenant will be used in TM-05 (edit) and TM-09 (delete).

**Covers**: `showCreateForm`, `createName`/`createDomain`/`createAuthMethods` signals, `TenantManagementService.createTenant()`, `loadTenants()` reload

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/tenants` | Page loads |
| 2 | Note the current total tenant count | e.g., 3 |
| 3 | Click "Add Tenant" button | Create form slides in below header with "Create New Tenant" heading |
| 4 | Verify form fields | Name input (placeholder: "Tenant name"), Domain input (placeholder: "example.com"), 3 auth method checkboxes (Email checked by default, Magic Link unchecked, Keycloak SSO unchecked), Create + Cancel buttons |
| 5 | Enter name: "E2E Test Tenant" | Name input populated |
| 6 | Enter domain: "e2etest.com" | Domain input populated |
| 7 | Check "Magic Link" checkbox | Both "Email" and "Magic Link" checked |
| 8 | Click "Create" button | Spinner on button, then form closes, table reloads |
| 9 | Verify new tenant in table | "E2E Test Tenant" row visible with domain "e2etest.com" |
| 10 | Verify auth method pills | "Email" and "Magic Link" pills shown on the new row |
| 11 | Verify course/CSM counts | 0 for both (newly created tenant has no assignments) |
| 12 | Verify total count increased | Summary card "Total Tenants" increased by 1 |

### SQL Verification

```sql
-- Verify new tenant was created
SELECT id, name, domain, is_master, settings->'auth_methods' as auth_methods,
       created_at, updated_at
FROM tenants WHERE domain = 'e2etest.com';
-- is_master should be false
-- auth_methods should be ["email_password", "magic_link"]
```

### Notes / Learnings
- Default auth method is `email_password` (checked by default in form)
- `is_master` is never set by the create form — always false for new tenants (only one master allowed)
- `tenants.domain` has a UNIQUE constraint — duplicate domain will fail with error message
- After successful create, `loadTenants()` is called to refresh the full list
- Cancel button closes the form without creating

---

## TM-05: Edit Tenant Details

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify the edit workflow: click a tenant row to expand, see 3 tabs (Details/Courses/CSMs), modify name, domain, and auth methods in the Details tab, save changes, verify persistence.

**Covers**: `onExpandRow()`, `activeTab` signal, `editName`/`editDomain`/`editAuthMethods` pre-fill, `TenantManagementService.updateTenant()`, `protect_tenant_critical_fields()` trigger

### Preconditions
- A non-master tenant exists (use "E2E Test Tenant" from TM-04, or Calypso Client)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/tenants` | Tenants table loaded |
| 2 | Click on "E2E Test Tenant" row (or any non-master tenant) | Row expands below with 3 tab buttons: "Details", "Courses", "CSMs" |
| 3 | Verify "Details" tab is active by default | Details panel visible with Name input, Domain input, Auth Method checkboxes, Save/Delete buttons |
| 4 | Verify name input pre-filled | Shows "E2E Test Tenant" (current name) |
| 5 | Verify domain input pre-filled | Shows "e2etest.com" (current domain) |
| 6 | Verify auth method checkboxes match | "Email" and "Magic Link" checked, "Keycloak SSO" unchecked (matching TM-04) |
| 7 | Change name to "E2E Test Tenant Updated" | Name input updated |
| 8 | Check "Keycloak SSO" checkbox | All 3 auth methods now checked |
| 9 | Click "Save" button | Spinner on button, then row collapses, data reloads |
| 10 | Verify updated name in table | "E2E Test Tenant Updated" visible |
| 11 | Verify updated auth method pills | "Email", "Magic Link", and "Keycloak SSO" pills all shown |
| 12 | Click on the tenant row again to expand | Verify pre-filled fields show updated values |

### SQL Verification

```sql
-- Verify updated fields
SELECT name, domain, settings->'auth_methods' as auth_methods, updated_at
FROM tenants WHERE domain = 'e2etest.com';
-- name should be "E2E Test Tenant Updated"
-- auth_methods should be ["email_password", "magic_link", "keycloak_sso"]
-- updated_at should be recent
```

### Notes / Learnings
- Pre-fill logic runs in `onExpandRow()` — sets `editName`, `editDomain`, `editAuthMethods` from tenant data
- `updateTenant()` sends `{ name, domain, settings: { auth_methods } }` to the base `tenants` table
- `protect_tenant_critical_fields()` trigger blocks changes to `is_master` and ensures `settings.auth_methods` is a valid array
- After saving, `loadTenants()` is called to refresh all data
- Cancel button (if shown) collapses the row without saving
- Domain is nullable — clearing it should be allowed

---

## TM-06: Master Tenant Protection

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that the master tenant cannot be deleted. The UI should show a protection message instead of a Delete button.

**Covers**: `is_master` check in template, Delete button conditional rendering, protection message

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/tenants` | Tenants table loaded |
| 2 | Identify the master tenant row | Calypso row has "Master" badge (Shield icon, teal) |
| 3 | Click on Calypso (master tenant) row | Row expands, Details tab shown |
| 4 | Look for Delete button | **No "Delete" button visible** |
| 5 | Verify protection message | "Master tenant cannot be deleted" text shown (with AlertTriangle icon) |
| 6 | Verify name/domain/auth methods are still editable | Input fields are present and editable (master can be edited, just not deleted) |
| 7 | Click "Save" after modifying auth methods | Changes saved successfully (update is allowed) |

### SQL Verification

```sql
-- Verify master tenant exists
SELECT id, name, domain, is_master FROM tenants WHERE is_master = true;
-- Should return exactly one row (unique partial index)
```

### Notes / Learnings
- `is_master = true` disables the Delete button in the template — not even shown
- Protection message: "Master tenant cannot be deleted" with AlertTriangle icon
- Master tenant CAN be edited (name, domain, auth methods) — only deletion is blocked
- `protect_tenant_critical_fields()` trigger also blocks `UPDATE` to `is_master` column — so even if someone tried to change `is_master` to false via SQL, the trigger would block it
- Only one master tenant can exist (unique partial index: `UNIQUE (is_master) WHERE is_master = true`)

---

## TM-07: Manage Course Assignments

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify the Courses tab workflow: switch to Courses tab, view assigned courses, add a new course assignment, see cascade warning, remove a course assignment.

**Covers**: `activeTab('courses')`, `loadTenantCourses()`, `loadAvailableCourses()`, `assignCourseToTenant()`, `removeCourseFromTenant()`, cascade warning display

### Preconditions
- A tenant with at least one course assigned (use Calypso Client)
- At least one course NOT yet assigned to that tenant (for the "add" test)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/tenants` | Tenants table loaded |
| 2 | Click on a non-master tenant row (e.g., Calypso Client) | Row expands, Details tab shown |
| 3 | Click the "Courses" tab button | Tab switches, loading spinner shown briefly, then assigned courses list appears |
| 4 | Verify service calls | `loadTenantCourses` and `loadAvailableCourses` called for this tenant |
| 5 | Verify assigned courses list | Each row shows course title with an "X" (remove) button |
| 6 | Verify "Add Course" dropdown | Dropdown shows courses NOT yet assigned to this tenant |
| 7 | Select a course from the dropdown | Course selected in dropdown |
| 8 | Click "Add" button | Course added to the assigned list, dropdown reloads (added course removed from available options) |
| 9 | Verify cascade warning | Warning text visible: "Removing a course from this tenant will also delete all related enrollments and progress data." (with AlertTriangle icon) |
| 10 | Click "X" on the just-added course | Course removed from the list, appears back in dropdown |
| 11 | Verify course count updated in table row | Courses count reflects the current assignment count |

### SQL Verification

```sql
-- Verify course assignments for tenant
SELECT tc.id, c.title, tc.created_at
FROM tenant_courses tc
JOIN courses c ON c.id = tc.course_id
WHERE tc.tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com')
ORDER BY c.title;

-- Verify available courses (not yet assigned)
SELECT c.id, c.title FROM courses c
WHERE c.id NOT IN (
  SELECT tc.course_id FROM tenant_courses tc
  WHERE tc.tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com')
)
ORDER BY c.title;
```

### Notes / Learnings
- Courses tab calls both `loadTenantCourses(tenantId)` and `loadAvailableCourses(tenantId)` simultaneously
- `loadTenantCourses` uses FK join: `course:courses(title)` to get course titles
- `loadAvailableCourses` does a two-query approach: all courses minus already-assigned
- `removeCourseFromTenant` triggers `cleanup_tenant_course_removal()` which CASCADE deletes enrollments + progress — the cascade warning is critical
- After add/remove, both lists reload (assigned + available)
- If no unassigned courses exist, the dropdown will be empty with a "No courses available" message
- `tenant_courses` has no UPDATE policy — use INSERT/DELETE pattern (add new, remove old)

---

## TM-08: Manage CSM Assignments

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify the CSMs tab workflow: switch to CSMs tab, view assigned CSMs, add a new CSM, remove a CSM.

**Covers**: `activeTab('csms')`, `loadCsmAssignments()`, `loadAvailableCsms()`, `assignCsm()`, `removeCsm()`, master-tenant constraint

### Preconditions
- A tenant has at least one CSM assigned (or none — test the empty state)
- At least one CSM-eligible user exists on the master tenant (not yet assigned to this tenant)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/tenants` | Tenants table loaded |
| 2 | Click on a tenant row (e.g., Calypso Client) | Row expands |
| 3 | Click the "CSMs" tab button | Tab switches, loading spinner shown briefly, then CSM list appears |
| 4 | Verify service calls | `loadCsmAssignments` and `loadAvailableCsms` called for this tenant |
| 5 | Verify assigned CSMs list | Each row shows CSM name + email with "assigned at" date and an "X" (remove) button |
| 6 | Verify "Add CSM" dropdown | Dropdown shows master-tenant users NOT yet assigned to this tenant as CSM |
| 7 | Select a CSM from the dropdown | User selected |
| 8 | Click "Add" button | CSM added to the assigned list, dropdown reloads |
| 9 | Verify CSM count updated in table row | CSMs count reflects current assignment count |
| 10 | Click "X" on the just-added CSM | CSM removed from list, appears back in dropdown |
| 11 | Verify CSM count decreased | Count updates correctly |

### SQL Verification

```sql
-- Verify CSM assignments
SELECT cta.id, p.email, p.full_name, cta.assigned_at
FROM csm_tenant_assignments cta
JOIN profiles p ON p.id = cta.user_id
WHERE cta.tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com');

-- Verify available CSMs (master-tenant users not yet assigned)
SELECT p.id, p.email, p.full_name
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
WHERE t.is_master = true
AND p.id NOT IN (
  SELECT cta.user_id FROM csm_tenant_assignments cta
  WHERE cta.tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com')
)
ORDER BY p.email;
```

### Notes / Learnings
- CSMs must be from the master tenant — `enforce_master_tenant_assignment()` trigger blocks non-master users
- `loadAvailableCsms` queries `profiles` where `tenant_id` = PA's tenant (master), then filters out already-assigned
- `assignCsm` sends `{ tenant_id, user_id, assigned_by }` where `assigned_by` is the PA's user ID
- `removeCsm(assignmentId)` deletes by assignment row ID, not by user ID
- CSM assignment table: `csm_tenant_assignments` has `user_id`, `tenant_id`, `assigned_by`, `assigned_at`
- If no available CSMs exist, the dropdown will be empty
- `csm_tenant_assignments` has no UPDATE policy — use INSERT/DELETE pattern

---

## TM-09: Delete Tenant

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify the two-click delete confirmation workflow: first click shows "Confirm Delete", second click actually deletes the tenant and removes it from the table.

**Covers**: `confirmingDelete` signal, `TenantManagementService.deleteTenant()`, two-click pattern, CASCADE cleanup

### Preconditions
- A non-master tenant exists that can be safely deleted (use "E2E Test Tenant Updated" from TM-04/TM-05)
- **WARNING**: Deleting a real tenant like "Calypso Client" will CASCADE delete all tenant_courses, enrollments, progress, and CSM assignments for that tenant. Only delete test tenants.

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/tenants` | Tenants table loaded |
| 2 | Note the current total count | e.g., 4 (after creating test tenant) |
| 3 | Click on "E2E Test Tenant Updated" row | Row expands, Details tab shown |
| 4 | Verify "Delete" button visible | Red danger-styled button with Trash2 icon (NOT present on master tenant) |
| 5 | Click "Delete" button (first click) | Button changes to "Confirm Delete" (red bg, more prominent) |
| 6 | Click "Confirm Delete" (second click) | Spinner on button, then row removed, table reloads |
| 7 | Verify tenant removed from table | "E2E Test Tenant Updated" no longer visible |
| 8 | Verify total count decreased | Summary card "Total Tenants" decreased by 1 |

### SQL Verification

```sql
-- Verify tenant was deleted
SELECT id FROM tenants WHERE domain = 'e2etest.com';
-- Should return 0 rows

-- Verify CASCADE cleaned up (if tenant had assignments)
SELECT COUNT(*) FROM tenant_courses WHERE tenant_id = '<DELETED_TENANT_ID>';
-- Should be 0
SELECT COUNT(*) FROM csm_tenant_assignments WHERE tenant_id = '<DELETED_TENANT_ID>';
-- Should be 0
```

### Notes / Learnings
- Two-click pattern prevents accidental deletion: "Delete" → "Confirm Delete"
- `confirmingDelete` signal tracks the two-click state
- CASCADE: deleting a tenant cascades to `tenant_courses`, which triggers `cleanup_tenant_course_removal()` (deletes enrollments + progress)
- After deletion, `loadTenants()` reloads the full list
- Master tenant delete is blocked in the UI (TM-06) — even if the API call were made, foreign key constraints would likely prevent it
- The expanded row collapses after successful deletion (the tenant no longer exists in the list)

---

## TM-10: Role Access Control

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that ONLY Platform Admin can access `/platform/tenants`. Learners, Lecturers, CSMs, and Tenant Admins should all be blocked by the route guard.

**Covers**: `roleGuard('platform_admin')`, sidebar "Platform" section visibility

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `learner@calypso-commodities.com` | Successful login |
| 2 | Check sidebar | "Platform" section NOT visible |
| 3 | Navigate directly to `/platform/tenants` | Redirected away (guard blocks access) |
| 4 | Logout, login as `lecturer-edit@calypso-commodities.com` | Successful login |
| 5 | Check sidebar | "Platform" section NOT visible (lecturers have "Teaching" section but NOT "Platform") |
| 6 | Navigate directly to `/platform/tenants` | Redirected away |
| 7 | Logout, login as `csm@calypso-commodities.com` | Successful login |
| 8 | Check sidebar | "Platform" section NOT visible |
| 9 | Navigate directly to `/platform/tenants` | Redirected away |
| 10 | Logout, login as `admin@calypsoclient.com` (Tenant Admin) | Successful login |
| 11 | Check sidebar | "Tenant Admin" section visible, but "Platform" section NOT visible |
| 12 | Navigate directly to `/platform/tenants` | Redirected away |
| 13 | Logout, login as `et@calypso-commodities.com` (Platform Admin) | Successful login |
| 14 | Check sidebar | "Platform" section visible with "Tenant Management" (Building2 icon) |
| 15 | Navigate to `/platform/tenants` | Page loads successfully, all tenants visible |

### Notes / Learnings
- Route guard checks JWT claims: `is_platform_admin`
- Only PA has the "Platform" sidebar section — it contains Tenant Management, Content Management, and Staleness Dashboard
- This is the most restrictive route in the app — only 1 of 5 roles can access it
- Unlike Issue Management (lecturer + PA) or Questions Board (lecturer + PA), Tenant Management is PA-only
- Even if a user somehow bypasses the route guard, RLS policies would block all data access (only `tenants_select_platform_admin` policy exists for reading tenants)

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| — | — | No bugs found | — | — | — |

---

## Data Setup Notes

### Creating Test Data for Assignment Tabs (TM-07, TM-08)

To fully test course and CSM assignment management, ensure:

1. **Multiple courses exist** — at least 2-3 courses for testing add/remove
2. **At least one course is NOT assigned** to the test tenant (for the "add" dropdown to have options)
3. **At least one master-tenant user** exists who is NOT yet assigned as CSM to the test tenant

```sql
-- Check courses and their assignments to Calypso Client
SELECT c.id, c.title,
  (SELECT COUNT(*) FROM tenant_courses tc
   WHERE tc.course_id = c.id
   AND tc.tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com')) as assigned
FROM courses c
ORDER BY c.title;

-- Check available CSMs (master-tenant users)
SELECT p.id, p.email, p.full_name,
  (SELECT COUNT(*) FROM csm_tenant_assignments cta
   WHERE cta.user_id = p.id
   AND cta.tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com')) as assigned
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
WHERE t.is_master = true
ORDER BY p.email;
```

### Cleanup After Full Test Run

```sql
-- Delete test tenant (from TM-04/TM-09)
DELETE FROM tenants WHERE domain = 'e2etest.com';

-- Restore Calypso Client course assignments if changed
-- (Only needed if you added/removed courses during TM-07 and didn't undo)
-- Check current state:
SELECT tc.id, c.title
FROM tenant_courses tc
JOIN courses c ON c.id = tc.course_id
WHERE tc.tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com');

-- Restore CSM assignments if changed
-- (Only needed if you added/removed CSMs during TM-08 and didn't undo)
SELECT cta.id, p.email
FROM csm_tenant_assignments cta
JOIN profiles p ON p.id = cta.user_id
WHERE cta.tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com');
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-14 | Claude (Playwright MCP) | TM-01 to TM-10 | 10 | 0 | Local dev (localhost:4200). All CRUD, assignment management, role guards verified. 0 bugs found. |

---

## References

- [Issue Management E2E Stories (Phase 7B)](ISSUE_MANAGEMENT_USER_STORIES.md) — similar board page pattern
- [Questions Board E2E Stories (Phase 6C)](QUESTIONS_BOARD_USER_STORIES.md) — similar board page pattern
- [Test Users](TEST_USERS.md) — full test user matrix
- `TenantManagementPageComponent`: `frontend/src/app/features/platform/pages/tenant-management-page.component.ts`
- `TenantManagementService`: `frontend/src/app/core/services/tenant-management.service.ts`
- `TenantForBoard` model: `frontend/src/app/core/models/tenant-management.model.ts`
- Sidebar config: `frontend/src/app/layout/sidebar/sidebar-nav.config.ts` (lines 66-73)
- DB policies: migrations `00004` (RLS), `00005` (triggers), `00010` (policy drops/recreates)
- Route: `frontend/src/app/app.routes.ts` (lines 187-194)
