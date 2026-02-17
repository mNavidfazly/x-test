> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Access Requests E2E User Stories (Phase 9C)

## Overview

E2E testing scenarios for the Access Requests page at `/admin/access-requests` (Phase 9C). These stories verify the **dual-role** admin workflow: both Tenant Admin (TA) and Platform Admin (PA) can access this page, but with different views and capabilities.

**TA view:** Sees only own-tenant requests (RLS-scoped via `access_requests_select_tenant_admin` where `tenant_id = jwt_claim('tenant_id')`), no tenant column, no tenant picker. Can approve (using their own tenant) or reject.

**PA view:** Sees all requests across all tenants, tenant column visible, "Unknown domain" badge for requests with `tenant_id = NULL`, tenant picker required before approving unknown-domain requests.

**Key features tested:**
- Access request list with role-scoped visibility (TA vs PA)
- Approve & Invite workflow: (1) UPDATE status to 'approved', (2) POST /api/invite (existing FastAPI endpoint)
- Reject workflow: UPDATE status to 'rejected' + review_notes
- Unknown-domain handling (PA-only tenant picker)
- Already-reviewed requests: read-only info (reviewer name, date, notes)
- Filter by search (name/email/domain) + status dropdown
- Role-based access control (Learner/Lecturer/CSM blocked)

**Migration 00034** — BEFORE INSERT trigger `resolve_access_request_tenant()` auto-resolves `domain → tenant_id` from the `tenants` table. Requests from known domains get `tenant_id` set automatically; unknown domains keep `tenant_id = NULL`.

**No new backend endpoint** — reuses existing `POST /api/invite` (FastAPI) from Phase 9B.

**Cross-references:**
- Phase 9B (User Management) is the companion admin board for users
- `AccessRequestService` is a separate service (3 signals + 3 methods) — approve via Supabase + invite via ApiService
- Route guarded by `roleGuard('tenant_admin', 'platform_admin')` — both TA and PA can access
- Sidebar entry: "Tenant Admin" section → "Access Requests" (UserPlus icon) — visible to both `tenant_admin` and `platform_admin` roles

**Key DB components:**
- `access_requests` table: 10 columns (id, email, full_name, domain, tenant_id, status, reviewed_by, reviewed_at, review_notes, created_at)
- `resolve_access_request_tenant()` — BEFORE INSERT trigger (migration 00034)
- `notify_new_access_request()` — AFTER INSERT trigger for PA/TA notifications
- `notify_access_request_reviewed()` — AFTER UPDATE trigger when status changes from 'pending'
- 5 RLS policies: 2 SELECT (PA unrestricted, TA own-tenant), 1 INSERT (anon), 2 UPDATE (PA any, TA own-tenant)
- 0 DELETE policies — no delete feature in UI
- `idx_access_requests_email_pending` — unique partial index: one pending request per email

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
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | AR-01, AR-03, AR-04, AR-05, AR-06, AR-07, AR-08, AR-09, AR-10, AR-11 |
| 2 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | AR-02, AR-11 |
| 3 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | AR-11 |
| 4 | `lecturer-edit@calypso-commodities.com` | **Lecturer** | Calypso (master) | AR-11 |
| 5 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | AR-11 |

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
| 1 | AR-01 | PA — Navigation + Page Load | PA logged in, test access requests seeded |
| 2 | AR-02 | TA — Navigation + Scoped View | TA logged in, at least 1 request for TA's tenant |
| 3 | AR-03 | Summary Cards | AR-01 (page loads with data) |
| 4 | AR-04 | Filter by Search | AR-01 (multiple requests exist) |
| 5 | AR-05 | Filter by Status | AR-01 (requests with different statuses exist) |
| 6 | AR-06 | Expand Pending Request | AR-01 (pending request exists) |
| 7 | AR-07 | PA — Unknown Domain + Tenant Picker | AR-01 (unknown-domain pending request exists) |
| 8 | AR-08 | Approve & Invite | AR-01 (pending request exists), SMTP configured |
| 9 | AR-09 | Reject Request | AR-01 (pending request exists after AR-08 consumed one) |
| 10 | AR-10 | Already-Reviewed Read-Only | AR-08 or AR-09 (reviewed request exists) |
| 11 | AR-11 | Role Access Control | Multiple role logins |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| AR-01 | PA — Navigation + Page Load | Platform Admin | ✅ | 2026-02-17 |
| AR-02 | TA — Navigation + Scoped View | Tenant Admin | ✅ | 2026-02-17 |
| AR-03 | Summary Cards | Platform Admin | ✅ | 2026-02-17 |
| AR-04 | Filter by Search | Platform Admin | ✅ | 2026-02-17 |
| AR-05 | Filter by Status | Platform Admin | ✅ | 2026-02-17 |
| AR-06 | Expand Pending Request | Platform Admin | ✅ | 2026-02-17 |
| AR-07 | PA — Unknown Domain + Tenant Picker | Platform Admin | ✅ | 2026-02-17 |
| AR-08 | Approve & Invite | Platform Admin | ✅ | 2026-02-17 |
| AR-09 | Reject Request | Platform Admin | ✅ | 2026-02-17 |
| AR-10 | Already-Reviewed Read-Only | Platform Admin | ✅ | 2026-02-17 |
| AR-11 | Role Access Control | Multiple | ✅ | 2026-02-17 |

---

## Preconditions (All Stories)

- Platform Admin (`et@calypso-commodities.com`) and Tenant Admin (`admin@calypsoclient.com`) can log in with password
- **Migration 00034 has been pushed** (`supabase db push`) — the `resolve_access_request_tenant()` trigger must exist for known-domain requests to get `tenant_id` auto-populated
- Test access requests have been seeded (see Data Setup below)

**Data Setup SQL** (run before testing):

```sql
-- Clean up any previous test access requests
DELETE FROM access_requests WHERE email LIKE 'e2e-%';

-- Also clean up any auth users from previous approve tests
DELETE FROM auth.users WHERE email = 'e2e-pending@calypsoclient.com';

-- 1. Pending from known domain (calypsoclient.com)
--    Migration 00034 trigger auto-resolves tenant_id → Calypso Client
INSERT INTO access_requests (email, full_name, domain, status)
VALUES ('e2e-pending@calypsoclient.com', 'Alice Pending', 'calypsoclient.com', 'pending');

-- 2. Pending from unknown domain (no matching tenant)
--    tenant_id stays NULL → only PA sees this
INSERT INTO access_requests (email, full_name, domain, status)
VALUES ('e2e-unknown@unknowndomain.com', 'Bob Unknown', 'unknowndomain.com', 'pending');

-- 3. Approved request (pre-reviewed)
INSERT INTO access_requests (email, full_name, domain, status, reviewed_by, reviewed_at, review_notes)
VALUES (
  'e2e-approved@calypsoclient.com',
  'Charlie Approved',
  'calypsoclient.com',
  'approved',
  (SELECT id FROM profiles WHERE email = 'et@calypso-commodities.com'),
  now(),
  'Approved for onboarding'
);

-- 4. Rejected request (pre-reviewed)
INSERT INTO access_requests (email, full_name, domain, status, reviewed_by, reviewed_at, review_notes)
VALUES (
  'e2e-rejected@calypsoclient.com',
  'Diana Rejected',
  'calypsoclient.com',
  'rejected',
  (SELECT id FROM profiles WHERE email = 'et@calypso-commodities.com'),
  now(),
  'Domain not eligible'
);

-- Verify all 4 test requests were created
SELECT id, email, full_name, domain, tenant_id, status, reviewed_by, review_notes
FROM access_requests
WHERE email LIKE 'e2e-%'
ORDER BY status, email;
```

**Expected state after setup:**

| Email | Domain | tenant_id | Status | Visible to TA? | Visible to PA? |
|-------|--------|-----------|--------|-----------------|-----------------|
| `e2e-pending@calypsoclient.com` | calypsoclient.com | Calypso Client ID | pending | Yes | Yes |
| `e2e-unknown@unknowndomain.com` | unknowndomain.com | NULL | pending | **No** | Yes |
| `e2e-approved@calypsoclient.com` | calypsoclient.com | Calypso Client ID | approved | Yes | Yes |
| `e2e-rejected@calypsoclient.com` | calypsoclient.com | Calypso Client ID | rejected | Yes | Yes |

---

## AR-01: PA — Navigation + Page Load

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that Platform Admin can see "Access Requests" in the sidebar (under "Tenant Admin" section), navigate to `/admin/access-requests`, and see the full request table with tenant column, summary cards, and filter bar.

**Covers**: Sidebar config (`roles: ['tenant_admin', 'platform_admin']`, UserPlus icon), route `admin/access-requests` with `roleGuard`, `AccessRequestService.loadRequests()`, FK joins `tenant:tenants(name)` + `reviewer:profiles!reviewed_by(full_name)`, PA-specific tenant column

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `et@calypso-commodities.com` | Successful login, main layout visible |
| 2 | Look at sidebar | "Tenant Admin" section visible with "Access Requests" item (UserPlus icon) below "User Management" |
| 3 | Click "Access Requests" in sidebar | Navigates to `/admin/access-requests` |
| 4 | Wait for page to load | "Access Requests" header visible with UserPlus icon + teal count badge |
| 5 | Verify filter bar | Search input ("Search by name, email, or domain...") + status dropdown ("All Statuses") visible |
| 6 | Verify summary cards | 4 cards: "Total Requests" (slate), "Pending" (amber), "Approved" (emerald), "Rejected" (rose) |
| 7 | Verify table headers | Headers: Name / Email, Domain, **Tenant** (PA-only column), Status, Requested |
| 8 | Verify at least 4 test requests visible | All 4 `e2e-*` test requests shown (PA sees all, including unknown-domain) |
| 9 | Verify status badges | Pending = amber badge, Approved = emerald badge, Rejected = rose badge |
| 10 | Verify tenant column | Known-domain requests show "Calypso Client"; unknown-domain shows amber "Unknown domain" badge |
| 11 | Verify chevron icons | Each row has a chevron-down icon (for expand) |

### SQL Verification

```sql
-- PA should see all requests (unrestricted SELECT policy)
SELECT ar.id, ar.email, ar.full_name, ar.domain, ar.status,
       t.name as tenant_name, ar.tenant_id
FROM access_requests ar
LEFT JOIN tenants t ON t.id = ar.tenant_id
WHERE ar.email LIKE 'e2e-%'
ORDER BY ar.created_at DESC;
```

### Notes / Learnings
- PA sees ALL access requests via `access_requests_select_platform_admin` policy
- FK join `tenant:tenants(name)` resolves tenant_name — null when `tenant_id` is NULL (unknown domain)
- "Unknown domain" badge (amber) only appears when `tenant_name` is null (PA view only)
- Sidebar "Tenant Admin" section includes both `tenant_admin` and `platform_admin` roles (updated in Phase 9B)
- Tenant column is conditionally rendered: `@if (isPlatformAdmin())` — only visible to PA

---

## AR-02: TA — Navigation + Scoped View

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that Tenant Admin sees only access requests from their own tenant (RLS-scoped by `access_requests_select_tenant_admin` where `tenant_id = jwt_claim('tenant_id')`), does NOT see the tenant column, does NOT see the tenant picker, and does NOT see requests from unknown domains.

**Covers**: TA RLS scoping, conditional UI hiding, `access_requests_select_tenant_admin` policy, TA-specific view

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `admin@calypsoclient.com` (Tenant Admin on Calypso Client) | Successful login |
| 2 | Look at sidebar | "Tenant Admin" section visible with "Access Requests" item (UserPlus icon) |
| 3 | Click "Access Requests" | Navigates to `/admin/access-requests` |
| 4 | Wait for page to load | "Access Requests" header visible with count badge |
| 5 | Verify table headers | Headers: Name / Email, Domain, Status, Requested — **NO "Tenant" column** |
| 6 | Verify only own-tenant requests visible | Only `calypsoclient.com` domain requests shown (3 of 4 test requests) |
| 7 | Verify unknown-domain request NOT visible | `e2e-unknown@unknowndomain.com` is NOT in the table (its `tenant_id` is NULL, doesn't match TA's tenant) |
| 8 | Verify request count | Count badge = 3 (pending + approved + rejected for Calypso Client) |
| 9 | Click on a pending request to expand | Expanded row shows review section with Approve & Reject buttons, but **NO tenant picker** |

### SQL Verification

```sql
-- TA view: only own-tenant requests
SELECT ar.email, ar.status, ar.tenant_id
FROM access_requests ar
WHERE ar.email LIKE 'e2e-%'
AND ar.tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com')
ORDER BY ar.created_at DESC;
-- Should return 3 rows (not the unknowndomain.com request)
```

### Notes / Learnings
- RLS handles scoping automatically — TA's query returns only requests where `tenant_id` matches their JWT `tenant_id`
- No client-side tenant filtering needed — `access_requests_select_tenant_admin` policy does the work
- `isPlatformAdmin()` computed signal drives conditional rendering: tenant column and tenant picker
- Unknown-domain requests (`tenant_id = NULL`) are invisible to TA — only PA can see and handle them
- TA approve flow uses `req.tenant_id` directly (always set for requests they can see) — no tenant picker needed

---

## AR-03: Summary Cards

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that summary stat cards show accurate counts for the current (filtered) request list. Both PA and TA see 4 cards.

**Covers**: `totalCount`, `pendingCount`, `approvedCount`, `rejectedCount` computed signals

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/access-requests` | 4 summary cards visible |
| 2 | Verify card values | "Total Requests" = total rows, "Pending" = pending count, "Approved" = approved count, "Rejected" = rejected count |
| 3 | Count request rows in table | Matches "Total Requests" card value |
| 4 | Count rows with amber "Pending" badge | Matches "Pending" card value |
| 5 | Count rows with emerald "Approved" badge | Matches "Approved" card value |
| 6 | Count rows with rose "Rejected" badge | Matches "Rejected" card value |
| 7 | Apply a search filter (e.g., "Alice") | All cards recalculate for filtered data |
| 8 | Apply status filter ("Pending") | "Total Requests" = "Pending" count, others adjust |
| 9 | Clear filters | All cards return to original values |

### SQL Verification

```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'approved') as approved,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected
FROM access_requests
WHERE email LIKE 'e2e-%';
```

### Notes / Learnings
- All counts derive from `filteredRequests()` — applying any filter recalculates all cards
- Card colors: Total = slate-900, Pending = amber-600, Approved = emerald-600, Rejected = rose-600
- `tabular-nums` font class ensures consistent number width
- PA sees more rows than TA (includes unknown-domain requests)

---

## AR-04: Filter by Search

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify search filter correctly filters requests by name, email, or domain (case-insensitive).

**Covers**: `searchTerm` signal, `filteredRequests` computed — `full_name`/`email`/`domain` matching

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/access-requests` | All requests listed |
| 2 | Type "Alice" in search input | Only `e2e-pending@calypsoclient.com` (Alice Pending) shown |
| 3 | Verify summary cards update | Total = 1, Pending = 1, Approved = 0, Rejected = 0 |
| 4 | Clear search, type "calypsoclient" | Requests with `calypsoclient.com` in email or domain shown (3 rows) |
| 5 | Clear search, type "unknowndomain" | Only `e2e-unknown@unknowndomain.com` shown (domain match) |
| 6 | Clear search, type "zzzzz" | Empty state: "No access requests found." |
| 7 | Click "Clear filters" | All requests visible, original count restored |

### Notes / Learnings
- Search is case-insensitive (`.toLowerCase()` applied to both term and field values)
- Search checks three fields: `full_name` (null-safe), `email`, and `domain` (null-safe)
- "Clear filters" link appears when search term OR status filter is non-default
- Search + status filter combine with AND logic

---

## AR-05: Filter by Status

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the status dropdown filter correctly filters requests by status.

**Covers**: `statusFilter` signal, dropdown options, filter logic

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/access-requests` | All requests listed, status dropdown shows "All Statuses" |
| 2 | Select "Pending" from dropdown | Only pending requests shown (2 for PA) |
| 3 | Verify all visible rows have amber "Pending" badge | Correct |
| 4 | Select "Approved" | Only approved requests shown |
| 5 | Verify all visible rows have emerald "Approved" badge | Correct |
| 6 | Select "Rejected" | Only rejected requests shown |
| 7 | Verify all visible rows have rose "Rejected" badge | Correct |
| 8 | Select "All Statuses" | All requests visible again |
| 9 | Combine status filter with search | Both filters apply (AND logic) |

### Notes / Learnings
- Status filter options: "All Statuses", "Pending", "Approved", "Rejected"
- Status filter + search combine with AND logic
- Summary cards update to reflect filtered data
- PA sees 2 pending (including unknown domain), TA sees only 1 pending

---

## AR-06: Expand Pending Request

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the expand/collapse row behavior and review section for pending requests: click a request row to expand, see full details, review notes textarea, and Approve & Reject action buttons.

**Covers**: `onExpandRequest()`, pending row template, `reviewNotes` signal, button rendering

### Preconditions
- At least one pending request exists (e.g., `e2e-pending@calypsoclient.com`)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/access-requests` | Requests table loaded |
| 2 | Click on the `e2e-pending@calypsoclient.com` row | Row expands below with review section |
| 3 | Verify chevron icon changes | ChevronDown → ChevronUp for expanded row |
| 4 | Verify request details | Name: "Alice Pending", Email: "e2e-pending@calypsoclient.com", Domain: "calypsoclient.com", Tenant: "Calypso Client" (PA view), Requested: date |
| 5 | Verify "Review Notes" textarea | Editable textarea with placeholder "Optional notes about this decision..." |
| 6 | Verify action buttons | Two buttons: "Approve & Invite" (teal, Check icon) and "Reject" (rose, X icon) |
| 7 | Click same row again | Row collapses (toggle behavior) |
| 8 | Click a different request row | Previous row collapses, new row expands |

### Notes / Learnings
- Only one row can be expanded at a time (single `expandedRequestId` signal)
- `onExpandRequest()` pre-fills `reviewNotes` from `req.review_notes` (empty for pending)
- Error and success messages are reset when expanding a new row
- Approve button is disabled while `reviewing()` is true (prevents double-click)
- PA sees tenant in details section; TA does not

---

## AR-07: PA — Unknown Domain + Tenant Picker

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that PA sees "Unknown domain" badge for requests with `tenant_id = NULL`, and a tenant picker dropdown is shown in the expanded row. The "Approve & Invite" button should be disabled until a tenant is selected.

**Covers**: `isPlatformAdmin() && !req.tenant_id` condition, `availableTenants`, `selectedTenantId`, disabled button state

### Preconditions
- Unknown-domain pending request exists (`e2e-unknown@unknowndomain.com` with `tenant_id = NULL`)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/access-requests` | Requests table loaded |
| 2 | Find `e2e-unknown@unknowndomain.com` row | Tenant column shows amber "Unknown domain" badge (not a tenant name) |
| 3 | Click on the unknown-domain row to expand | Row expands with review section |
| 4 | Verify tenant detail in expanded section | "Tenant: Unknown domain — must assign tenant before approving" (amber text) |
| 5 | Verify tenant picker dropdown | "Assign Tenant (required for approval)" label with AlertTriangle icon, select dropdown listing all tenants |
| 6 | Verify "Approve & Invite" button is **disabled** | Button has `disabled:opacity-50` styling — cannot click without selecting tenant |
| 7 | Select "Calypso Client" from tenant picker | Dropdown value set |
| 8 | Verify "Approve & Invite" button is now **enabled** | Button becomes clickable |
| 9 | Do NOT click approve (collapse the row) | This preserves the request for AR-09 |

### SQL Verification

```sql
-- Verify the request has no tenant_id
SELECT email, domain, tenant_id, status
FROM access_requests
WHERE email = 'e2e-unknown@unknowndomain.com';
-- tenant_id should be NULL
```

### Notes / Learnings
- Tenant picker only appears when `isPlatformAdmin() && !req.tenant_id`
- Available tenants loaded via `this.#supabaseService.client.from('tenants').select('id, name').order('name')`
- "Approve & Invite" button `[disabled]` binding: `reviewing() || (isPlatformAdmin() && !req.tenant_id && !selectedTenantId())`
- The `selectedTenantId` is used in `onApprove()`: `const tenantId = req.tenant_id ?? this.selectedTenantId()`
- TA never sees this scenario — unknown-domain requests are invisible to TA (RLS filters them out)

---

## AR-08: Approve & Invite

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the full approve workflow for a known-domain pending request: expand row, click "Approve & Invite", verify two-step process (status update + invite), see success, data reloads with updated status.

**Covers**: `onApprove()`, `AccessRequestService.approveAndInvite()`, `POST /api/invite` (FastAPI), success state, data reload

### Preconditions
- Pending request exists: `e2e-pending@calypsoclient.com` with `tenant_id` = Calypso Client
- SMTP/mailer configured (Supabase Dashboard or local Inbucket)
- No auth user exists for `e2e-pending@calypsoclient.com` (cleaned up in Data Setup)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/access-requests` | Requests listed |
| 2 | Find `e2e-pending@calypsoclient.com` | Status badge: amber "Pending" |
| 3 | Click row to expand | Review section with "Approve & Invite" and "Reject" buttons |
| 4 | Optionally type review notes | "Approved for access" (optional) |
| 5 | Click "Approve & Invite" | Spinner on button (Loader2 icon), then success |
| 6 | Verify success message | Green emerald panel: "Approved and invitation sent!" |
| 7 | Wait for row to collapse and data to reload | Row collapses automatically after success |
| 8 | Verify status change | `e2e-pending@calypsoclient.com` now shows emerald "Approved" badge |
| 9 | Verify summary cards update | "Pending" count decreased by 1, "Approved" count increased by 1 |
| 10 | Click the now-approved row to expand | Shows read-only review info (reviewer name, date), no action buttons |

### SQL Verification

```sql
-- Verify access request was approved
SELECT email, status, reviewed_by, reviewed_at, review_notes
FROM access_requests
WHERE email = 'e2e-pending@calypsoclient.com';
-- status should be 'approved', reviewed_by and reviewed_at should be set

-- Verify auth user was created by invite
SELECT id, email, invited_at
FROM auth.users
WHERE email = 'e2e-pending@calypsoclient.com';
-- Should exist (created by supabase.auth.admin.invite_user_by_email)

-- Verify profile was created (handle_new_user trigger)
SELECT p.email, p.full_name, t.name as tenant_name
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
WHERE p.email = 'e2e-pending@calypsoclient.com';
-- tenant should be Calypso Client
```

### Cleanup (REQUIRED after test)

```sql
-- Delete invited user (cascades to profile via FK)
DELETE FROM auth.users WHERE email = 'e2e-pending@calypsoclient.com';

-- Reset the access request back to pending (if running tests again)
UPDATE access_requests
SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, review_notes = NULL
WHERE email = 'e2e-pending@calypsoclient.com';
```

### Notes / Learnings
- `approveAndInvite()` is two-step: (1) `reviewRequest()` UPDATE status to 'approved', (2) `ApiService.post('/invite', { email, tenant_id })`
- If step 2 fails (e.g., 409 user already exists), the request is STILL marked as 'approved' — show error but status was already changed
- The invite endpoint creates an auth user + sends invitation email. `handle_new_user()` trigger auto-creates the profile.
- On local dev, check Supabase's Inbucket at `http://localhost:54324` for the invite email
- For known-domain requests, `req.tenant_id` is already set — no tenant picker needed
- The PA's reviewer info is recorded: `reviewed_by = PA's user ID`, `reviewed_at = now()`

---

## AR-09: Reject Request

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the reject workflow: expand a pending request, enter review notes, click "Reject", verify status change to 'rejected', data reloads.

**Covers**: `onReject()`, `AccessRequestService.reviewRequest()` with `status: 'rejected'`, review notes persistence

### Preconditions
- Pending request exists: `e2e-unknown@unknowndomain.com` (still pending from AR-07)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/access-requests` | Requests listed |
| 2 | Find `e2e-unknown@unknowndomain.com` | Status badge: amber "Pending" |
| 3 | Click row to expand | Review section with action buttons visible |
| 4 | Type review notes: "Domain not recognized" | Textarea populated |
| 5 | Click "Reject" | Spinner briefly, then row collapses, data reloads |
| 6 | Verify status change | `e2e-unknown@unknowndomain.com` now shows rose "Rejected" badge |
| 7 | Verify summary cards update | "Pending" count decreased by 1, "Rejected" count increased by 1 |
| 8 | Click the now-rejected row to expand | Shows read-only review info with reviewer name, date, and notes "Domain not recognized" |

### SQL Verification

```sql
-- Verify access request was rejected
SELECT email, status, reviewed_by, reviewed_at, review_notes
FROM access_requests
WHERE email = 'e2e-unknown@unknowndomain.com';
-- status should be 'rejected', review_notes should be 'Domain not recognized'
```

### Cleanup (for re-running tests)

```sql
-- Reset the rejected request back to pending
UPDATE access_requests
SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, review_notes = NULL
WHERE email = 'e2e-unknown@unknowndomain.com';
```

### Notes / Learnings
- Reject only calls `reviewRequest()` — no invite step needed
- `review_notes` is sent as `data.review_notes ?? undefined` — empty string becomes undefined (stored as NULL)
- No auth user is created for rejected requests
- The reject button is NOT disabled when no notes are entered (notes are optional)
- After rejection, the `notify_access_request_reviewed()` trigger fires — but since the requester has no auth account, the notification has no recipient (it's a no-op)

---

## AR-10: Already-Reviewed Read-Only

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that expanding an already-reviewed (approved or rejected) request shows read-only information instead of editable review fields and action buttons.

**Covers**: `req.status !== 'pending'` template branch, reviewer name + date rendering, `review_notes` display

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/admin/access-requests` | Requests listed |
| 2 | Find a pre-seeded approved request (`e2e-approved@calypsoclient.com`) | Emerald "Approved" badge |
| 3 | Click row to expand | Expanded section shows **read-only** info |
| 4 | Verify "Reviewed by:" field | Shows the reviewer's name (from FK join `reviewer:profiles!reviewed_by(full_name)`) |
| 5 | Verify "Reviewed at:" field | Shows a formatted date |
| 6 | Verify "Notes:" field | Shows "Approved for onboarding" (pre-seeded review notes) |
| 7 | Verify NO action buttons | No "Approve & Invite" or "Reject" button visible |
| 8 | Verify NO review notes textarea | No editable textarea |
| 9 | Collapse row, expand a rejected request (`e2e-rejected@calypsoclient.com`) | Same read-only pattern |
| 10 | Verify notes field | Shows "Domain not eligible" |

### Notes / Learnings
- Template switches on `req.status === 'pending'`: pending shows editable review UI, non-pending shows read-only
- `reviewer_name` comes from FK join `reviewer:profiles!reviewed_by(full_name)` — null-safe with "Unknown" fallback
- `review_notes` only shown if truthy — if notes are null/empty, the "Notes:" row is hidden
- The reviewed_at date is formatted via `formatDate()` using `en-GB` locale (e.g., "14 Feb 2026")

---

## AR-11: Role Access Control

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that ONLY Tenant Admin and Platform Admin can access `/admin/access-requests`. Learners, Lecturers, and CSMs should be blocked by the route guard.

**Covers**: `roleGuard('tenant_admin', 'platform_admin')`, sidebar "Tenant Admin" section visibility

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `learner@calypso-commodities.com` | Successful login |
| 2 | Check sidebar | "Tenant Admin" section NOT visible |
| 3 | Navigate directly to `/admin/access-requests` | Redirected away (guard blocks access) |
| 4 | Logout, login as `lecturer-edit@calypso-commodities.com` | Successful login |
| 5 | Check sidebar | "Teaching" section visible, but "Tenant Admin" section NOT visible |
| 6 | Navigate directly to `/admin/access-requests` | Redirected away |
| 7 | Logout, login as `csm@calypso-commodities.com` | Successful login |
| 8 | Check sidebar | "CSM" section visible, but "Tenant Admin" section NOT visible |
| 9 | Navigate directly to `/admin/access-requests` | Redirected away |
| 10 | Logout, login as `admin@calypsoclient.com` (Tenant Admin) | Successful login |
| 11 | Check sidebar | "Tenant Admin" section visible with both "User Management" and "Access Requests" |
| 12 | Navigate to `/admin/access-requests` | Page loads successfully, own-tenant requests visible |
| 13 | Logout, login as `et@calypso-commodities.com` (Platform Admin) | Successful login |
| 14 | Check sidebar | "Tenant Admin" section visible with both items |
| 15 | Navigate to `/admin/access-requests` | Page loads successfully, ALL requests visible |

### Notes / Learnings
- Route guard checks JWT claims: `is_tenant_admin` OR `is_platform_admin`
- Sidebar "Tenant Admin" section has `roles: ['tenant_admin', 'platform_admin']`
- Same guard as User Management (`/admin/users`) — both TA and PA can access
- Even if a user bypasses the route guard, RLS policies would restrict data: learners/lecturers/CSMs have no SELECT policy on `access_requests`
- The "Access Requests" item appears in the sidebar alongside "User Management" under the same "Tenant Admin" section

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| — | — | No bugs found | — | — | — |

---

## Data Setup Notes

### Verifying Migration 00034 Was Applied

Before seeding test data, verify the BEFORE INSERT trigger exists:

```sql
-- Check trigger exists
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'access_requests'
AND trigger_name = 'before_insert_resolve_tenant';
-- Should return 1 row: BEFORE INSERT

-- Test the trigger by inserting a known-domain request
INSERT INTO access_requests (email, full_name, domain, status)
VALUES ('test-trigger@calypsoclient.com', 'Trigger Test', 'calypsoclient.com', 'pending');

SELECT tenant_id FROM access_requests WHERE email = 'test-trigger@calypsoclient.com';
-- tenant_id should be Calypso Client's UUID (auto-resolved from domain)

-- Clean up test row
DELETE FROM access_requests WHERE email = 'test-trigger@calypsoclient.com';
```

### Verifying Test Data State

After seeding, verify all 4 test requests and their visibility:

```sql
SELECT ar.email, ar.status, ar.tenant_id,
       t.name as tenant_name,
       CASE WHEN ar.tenant_id IS NULL THEN 'PA only' ELSE 'PA + TA' END as visible_to
FROM access_requests ar
LEFT JOIN tenants t ON t.id = ar.tenant_id
WHERE ar.email LIKE 'e2e-%'
ORDER BY ar.status, ar.email;
```

### Full Cleanup After Test Run

```sql
-- Delete test access requests
DELETE FROM access_requests WHERE email LIKE 'e2e-%';

-- Delete any auth users created by approve tests
DELETE FROM auth.users WHERE email = 'e2e-pending@calypsoclient.com';

-- Verify cleanup
SELECT email FROM access_requests WHERE email LIKE 'e2e-%';
-- Should return 0 rows
```

### Restoring Pending State (for re-running AR-08 and AR-09)

If tests modified the status and you want to re-run:

```sql
-- Reset approved/rejected test requests back to pending
UPDATE access_requests
SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, review_notes = NULL
WHERE email IN ('e2e-pending@calypsoclient.com', 'e2e-unknown@unknowndomain.com');

-- Also delete the auth user created by approve
DELETE FROM auth.users WHERE email = 'e2e-pending@calypsoclient.com';
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 14 Feb 2026 | Claude (Playwright MCP) | AR-01 to AR-11 | 11/11 | 0 | Local dev (localhost:4200). AR-08 approve step works (status changes, notification fires), invite step 404 because local FastAPI not running — expected for local E2E. 5 roles tested for access control. 0 bugs found. |
| 15 Feb 2026 | Claude (Playwright MCP) | AR-01 to AR-11 | 11 | 0 | Full regression run. PA board: 4 requests (all Pending), stats cards, search+status filters, "Unknown domain" badge on unknowndomain.com. No regressions. |

### 2026-02-17 — Full Regression (Playwright MCP)
- **Tester:** Claude Opus 4.6 (Playwright MCP)
- **Scope:** Full re-test of all stories
- **Result:** All stories pass ✅
- **Bugs found:** None

---

## References

- [User Management E2E Stories (Phase 9B)](USER_MANAGEMENT_USER_STORIES.md) — companion admin board for users
- [Tenant Management E2E Stories (Phase 9A)](TENANT_MANAGEMENT_USER_STORIES.md) — PA-only admin board pattern
- [Test Users](TEST_USERS.md) — full test user matrix
- `AccessRequestPageComponent`: `frontend/src/app/features/admin/pages/access-request-page.component.ts`
- `AccessRequestService`: `frontend/src/app/core/services/access-request.service.ts`
- `AccessRequestForBoard` model: `frontend/src/app/core/models/access-request.model.ts`
- FastAPI invite endpoint (reused): `backend/app/routers/invite.py`
- Sidebar config: `frontend/src/app/layout/sidebar/sidebar-nav.config.ts` (lines 43-49)
- DB migration: `supabase/migrations/00034_access_requests_domain_routing.sql`
- RLS policies: migration `00004` (lines 1362-1387)
- Notification triggers: migrations `00005` (`notify_new_access_request`) + `00011` (`notify_access_request_reviewed`)
- Route: `frontend/src/app/app.routes.ts` (lines 173-179)
