> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Role-Adaptive Dashboard E2E User Stories (Phase 11B)

## Overview

E2E testing scenarios for the Role-Adaptive Dashboard at `/dashboard` (Phase 11B). This is the **default landing page** for all authenticated users (`'' redirectTo 'dashboard'`). The dashboard adapts its content based on the logged-in user's role, showing relevant action items, overview stats, and enrolled courses.

**Key components:**
- `DashboardComponent` — role-adaptive page with 4 conditional sections (greeting, action items, overview stats, my courses)
- `DashboardService` — lightweight parallel count queries using `{ count: 'exact', head: true }` pattern, role-conditional via JWT claims, `Promise.allSettled()` for resilience
- `DashboardActionCardComponent` — presentational card with icon, count, label, routerLink
- Reuses: `CourseCardComponent`, `StatCardComponent`, `StatusBadgeComponent`, `LoadingSpinnerComponent`, `ErrorAlertComponent`, `EmptyStateComponent`

**4 dashboard sections:**

| # | Section | Shown For | Content |
|---|---------|-----------|---------|
| 1 | Welcome Header | All users | Time-of-day greeting + `full_name` (or email prefix fallback) + role badges via `StatusBadgeComponent` |
| 2 | Needs Your Attention | TA, PA, Lecturer | Grid of clickable action cards with live counts from DB |
| 3 | Overview Stats | TA, PA, Lecturer, CSM | `StatCardComponent` grid — counts from DB or JWT claims |
| 4 | My Courses | All users | Top 6 enrolled courses sorted by `lastActivity` desc, using `CourseCardComponent` |

**Action items (Section 2) — role matrix:**

| Action Item | Count Source | Shown For | Links To |
|---|---|---|---|
| Pending Requests | `access_requests WHERE status='pending'` | TA, PA | `/admin/access-requests` |
| Open Issues | `issues WHERE status IN ('open','investigating')` | Lecturer, PA | `/teaching/issues` |
| Unanswered Questions | `expert_questions WHERE status='pending'` | Lecturer, PA | `/teaching/questions` |
| Ungraded Exams | `exam_submissions WHERE score IS NULL` | Lecturer (can_grade), PA | `/teaching/grading` |

**Overview stats (Section 3) — role matrix:**

| Stat | Source | Shown For |
|---|---|---|
| Total Users | DB count `profiles` | TA, PA |
| Total Courses | DB count `courses` | PA only |
| Total Tenants | DB count `tenants` | PA only |
| Assigned Courses | JWT `lecturer_course_ids.length` | Lecturer |
| Assigned Tenants | JWT `csm_tenant_ids.length` | CSM |

**RLS scoping on count queries:**
- **Platform Admin**: sees all data across all tenants (unconditional SELECT policies)
- **Tenant Admin**: `access_requests` and `profiles` scoped to own tenant via RLS
- **Lecturer**: `issues` and `expert_questions` scoped to assigned courses via RLS
- **CSM**: no count queries (stats come from JWT claims)
- **Learner**: no count queries, no action items

**Enrolled courses (Section 4):**
- `CourseService.loadCourses()` → filter `isEnrolled` → sort by `lastActivity` desc → limit 6
- Progress bar shown for each enrolled course with `completedModules / moduleCount`
- "View all courses" link appears only when there are enrolled courses

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
| **Production (Custom Domain)** | https://xcourses.x-lng.com | https://x-courses-v2-production.up.railway.app |
| **Local Dev** | http://localhost:4200 | http://localhost:8000 |

### Test Users

> Full setup instructions: [TEST_USERS.md](TEST_USERS.md)

All test users use password: `TestUser123!`

| # | Email | Role | Tenant | Used In |
|---|-------|------|--------|---------|
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | DB-01, DB-06, DB-07 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit)** | Calypso (master) | DB-03 |
| 3 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | DB-02 |
| 4 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | DB-04 |
| 5 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | DB-05, DB-08 |

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
| 1 | DB-01 | PA Full Dashboard + Count Accuracy | PA logged in, at least 1 course enrolled |
| 2 | DB-02 | TA Scoped Dashboard | TA logged in |
| 3 | DB-03 | Lecturer Teaching Dashboard | Lecturer logged in, assigned to courses |
| 4 | DB-04 | CSM Overview Dashboard | CSM logged in, assigned to tenants |
| 5 | DB-05 | Learner Minimal Dashboard | Learner logged in |
| 6 | DB-06 | Action Card Navigation | DB-01 (PA sees all action cards) |
| 7 | DB-07 | Enrolled Course Cards + Progress | DB-01 (PA has enrolled courses) |
| 8 | DB-08 | Empty Enrolled Courses State | User with no enrollments |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| DB-01 | PA Full Dashboard + Count Accuracy | Platform Admin | ✅ | 2026-02-15 |
| DB-02 | TA Scoped Dashboard | Tenant Admin | ✅ | 2026-02-15 |
| DB-03 | Lecturer Teaching Dashboard | Lecturer | ✅ | 2026-02-15 |
| DB-04 | CSM Overview Dashboard | CSM | ✅ | 2026-02-15 |
| DB-05 | Learner Minimal Dashboard | Learner | ✅ | 2026-02-15 |
| DB-06 | Action Card Navigation | Platform Admin | ✅ | 2026-02-15 |
| DB-07 | Enrolled Course Cards + Progress | Learner | ✅ | 2026-02-15 |
| DB-08 | Empty Enrolled Courses State | Platform Admin | ✅ | 2026-02-15 |

---

## Preconditions (All Stories)

- All 5 test user accounts exist and can log in (see [TEST_USERS.md](TEST_USERS.md))
- At least 1 course exists with enrolled users (for "My Courses" section)
- At least 1 pending access request exists (for TA/PA action item)
- Ideally: at least 1 open issue, 1 pending expert question, 1 ungraded exam submission (for full PA action items)
- Lecturer is assigned to at least 1 course via `lecturer_course_assignments`
- CSM is assigned to at least 1 tenant via `csm_tenant_assignments`

**Verify dashboard count data:**

```sql
-- Pending access requests (TA sees own tenant, PA sees all)
SELECT status, COUNT(*) FROM access_requests GROUP BY status;

-- Open issues
SELECT status, COUNT(*) FROM issues WHERE status IN ('open', 'investigating');

-- Pending expert questions
SELECT status, COUNT(*) FROM expert_questions WHERE status = 'pending';

-- Ungraded exam submissions (score IS NULL)
SELECT COUNT(*) FROM exam_submissions WHERE score IS NULL;

-- Total users, courses, tenants
SELECT 'profiles' AS table_name, COUNT(*) FROM profiles
UNION ALL SELECT 'courses', COUNT(*) FROM courses
UNION ALL SELECT 'tenants', COUNT(*) FROM tenants;
```

**Verify enrolled courses for PA:**

```sql
SELECT c.title, ce.user_id, up.status, up.completed_at
FROM course_enrollments ce
JOIN courses c ON c.id = ce.course_id
JOIN profiles p ON p.id = ce.user_id
LEFT JOIN user_progress up ON up.user_id = ce.user_id AND up.module_id IN (
  SELECT m.id FROM modules m WHERE m.course_id = c.id
)
WHERE p.email = 'et@calypso-commodities.com'
ORDER BY c.title;
```

**Verify lecturer assignment:**

```sql
SELECT lca.course_id, c.title, lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN courses c ON c.id = lca.course_id
WHERE lca.lecturer_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com');
```

**Verify CSM assignment:**

```sql
SELECT cta.tenant_id, t.name
FROM csm_tenant_assignments cta
JOIN tenants t ON t.id = cta.tenant_id
WHERE cta.user_id = (SELECT id FROM profiles WHERE email = 'csm@calypso-commodities.com');
```

---

## DB-01: PA Full Dashboard + Count Accuracy

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that the Platform Admin sees the complete dashboard with all 4 sections, and that the displayed counts match the actual database state. This is the "golden path" test — PA sees the most complete view of the dashboard.

**Covers**: `DashboardService.loadCounts()` (all 7 queries), `CourseService.loadCourses()`, greeting with full_name, all role badges, all action items, all overview stats, enrolled courses

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) | Redirected to `/dashboard` automatically | ☐ |
| 2 | Verify page header | LayoutDashboard icon (teal) + "Good morning/afternoon/evening, Eugen" (or full_name from profile) | ☐ |
| 3 | Verify role badges | "Learner" (teal/primary) and "Platform Admin" (rose/error) badges visible | ☐ |
| 4 | Verify "Needs Your Attention" section exists | Section heading visible with action card grid below | ☐ |
| 5 | Verify "Pending Requests" action card | Amber icon bg, count matches `SELECT COUNT(*) FROM access_requests WHERE status='pending'`, links to `/admin/access-requests` | ☐ |
| 6 | Verify "Open Issues" action card | Rose icon bg, count matches `SELECT COUNT(*) FROM issues WHERE status IN ('open','investigating')`, links to `/teaching/issues` | ☐ |
| 7 | Verify "Unanswered Questions" action card | Purple icon bg, count matches `SELECT COUNT(*) FROM expert_questions WHERE status='pending'`, links to `/teaching/questions` | ☐ |
| 8 | Verify "Ungraded Exams" action card | Blue icon bg, count matches `SELECT COUNT(*) FROM exam_submissions WHERE score IS NULL`, links to `/teaching/grading` | ☐ |
| 9 | Verify "Overview" section exists | Section heading with StatCard grid below | ☐ |
| 10 | Verify "Total Users" stat card | Value matches `SELECT COUNT(*) FROM profiles` | ☐ |
| 11 | Verify "Total Courses" stat card | Value matches `SELECT COUNT(*) FROM courses` (teal text) | ☐ |
| 12 | Verify "Total Tenants" stat card | Value matches `SELECT COUNT(*) FROM tenants` (blue text) | ☐ |
| 13 | Verify "My Courses" section exists | Section heading with course card grid or empty state | ☐ |
| 14 | If PA has enrolled courses: verify course cards render | Course titles visible, progress bars shown for enrolled courses | ☐ |
| 15 | If PA has enrolled courses: verify "View all courses" link | Teal link with ArrowRight icon, points to `/courses` | ☐ |

### SQL Verification
```sql
-- All counts PA should see
SELECT 'Pending Requests' AS item, COUNT(*) FROM access_requests WHERE status = 'pending'
UNION ALL SELECT 'Open Issues', COUNT(*) FROM issues WHERE status IN ('open', 'investigating')
UNION ALL SELECT 'Unanswered Questions', COUNT(*) FROM expert_questions WHERE status = 'pending'
UNION ALL SELECT 'Ungraded Exams', COUNT(*) FROM exam_submissions WHERE score IS NULL
UNION ALL SELECT 'Total Users', COUNT(*) FROM profiles
UNION ALL SELECT 'Total Courses', COUNT(*) FROM courses
UNION ALL SELECT 'Total Tenants', COUNT(*) FROM tenants;
```

### Notes / Learnings
- PA sees all 4 action items + all 3 overview stats (most complete view of any role)
- PA's RLS on all tables is unconditional SELECT — counts reflect the entire system
- The greeting uses `ProfileService.profile()?.full_name` — if null, falls back to email prefix ("et")
- Time-of-day greeting: `hour < 12` = morning, `12-17` = afternoon, `≥18` = evening
- Action items only appear when counts have loaded (not during loading state)
- Count values of 0 are still shown (0 issues = "nothing pending" is useful info)

---

## DB-02: TA Scoped Dashboard

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that the Tenant Admin sees a scoped dashboard — only the action items and stats relevant to their role (pending access requests + total users), scoped to their own tenant by RLS. Teaching items (issues, questions, exams) must NOT appear.

**Covers**: TA-specific `showActionItems`, `actionItems` (pending requests only), `showOverview` (total users only), RLS scoping of count queries to TA's tenant

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Tenant Admin (`admin@calypsoclient.com`) | Dashboard loads at `/dashboard` | ☐ |
| 2 | Verify greeting | "Good morning/afternoon/evening, Test Tenant Admin (Client)" or full_name | ☐ |
| 3 | Verify role badges | "Learner" (teal) and "Tenant Admin" (amber/warning) badges | ☐ |
| 4 | Verify "Needs Your Attention" section exists | Section heading visible | ☐ |
| 5 | Verify "Pending Requests" action card present | Amber card with count, links to `/admin/access-requests` | ☐ |
| 6 | Verify "Open Issues" is NOT present | No rose-colored "Open Issues" card visible | ☐ |
| 7 | Verify "Unanswered Questions" is NOT present | No purple card visible | ☐ |
| 8 | Verify "Ungraded Exams" is NOT present | No blue "Ungraded Exams" card visible | ☐ |
| 9 | Verify "Overview" section exists | Section heading with stat card(s) | ☐ |
| 10 | Verify "Total Users" stat card | Value = number of users in TA's tenant (Calypso Client) — NOT all users system-wide | ☐ |
| 11 | Verify "Total Courses" is NOT present | PA-only stat, should not appear for TA | ☐ |
| 12 | Verify "Total Tenants" is NOT present | PA-only stat, should not appear for TA | ☐ |
| 13 | Verify "Assigned Courses" is NOT present | Lecturer-only stat | ☐ |
| 14 | Verify "Assigned Tenants" is NOT present | CSM-only stat | ☐ |
| 15 | Verify "My Courses" section | Course cards or empty state for TA's enrolled courses | ☐ |

### SQL Verification
```sql
-- Counts scoped to TA's tenant (Calypso Client)
SELECT 'Pending Requests (TA tenant)' AS item, COUNT(*)
FROM access_requests
WHERE status = 'pending'
  AND tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com')
UNION ALL
SELECT 'Total Users (TA tenant)', COUNT(*)
FROM profiles
WHERE tenant_id = (SELECT id FROM tenants WHERE domain = 'calypsoclient.com');
```

### Notes / Learnings
- RLS auto-scopes `access_requests` and `profiles` to the TA's tenant — counts reflect only their tenant, not the whole system
- The TA's "Total Users" count will be significantly smaller than the PA's (only their tenant's users)
- "Pending Requests" count also scoped — only pending requests for the TA's tenant domain
- TA has no teaching responsibilities → no issues/questions/exams action items
- If the TA's tenant has 0 pending requests, the card still shows "0" (not hidden)

**E2E Observations (2026-02-15):**
- Greeting: "Good afternoon, Test Tenant Admin (Client)" — full_name resolved correctly
- Badges: "Learner" + "Tenant Admin" as expected
- Action items: Only "Pending Requests" (0) — no teaching items. Verified correct.
- Overview: "Total Users" = 2 — verified via REST API: exactly 2 profiles in Calypso Client tenant
- My Courses: Empty state shown ("No enrolled courses yet.")

---

## DB-03: Lecturer Teaching Dashboard

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that a Lecturer sees teaching-related action items (Open Issues, Unanswered Questions, Ungraded Exams if can_grade) and an "Assigned Courses" stat derived from JWT claims. Verify that admin-only items (Pending Requests, Total Users/Courses/Tenants) do NOT appear.

**Covers**: Lecturer-specific `actionItems` (issues, questions, conditionally exams), `overviewStats` (assigned courses from JWT), RLS scoping of count queries to assigned courses

### Preconditions
- Lecturer has `can_edit = true` AND `can_grade = true` for at least 1 course (to test Ungraded Exams visibility)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Lecturer (`lecturer-edit@calypso-commodities.com`) | Dashboard loads at `/dashboard` | ☐ |
| 2 | Verify greeting | "Good morning/afternoon/evening, Test Lecturer (Edit)" or full_name | ☐ |
| 3 | Verify role badges | "Learner" (teal) and "Lecturer" (blue/info) badges | ☐ |
| 4 | Verify "Needs Your Attention" section exists | Section heading visible with action card grid | ☐ |
| 5 | Verify "Open Issues" action card present | Rose card with count, links to `/teaching/issues` | ☐ |
| 6 | Verify "Unanswered Questions" action card present | Purple card with count, links to `/teaching/questions` | ☐ |
| 7 | Verify "Ungraded Exams" action card present | Blue card with count (lecturer has can_grade), links to `/teaching/grading` | ☐ |
| 8 | Verify "Pending Requests" is NOT present | Admin-only action item — no amber card | ☐ |
| 9 | Verify "Overview" section exists | Section heading with stat card(s) | ☐ |
| 10 | Verify "Assigned Courses" stat card | Value = number of courses lecturer is assigned to (from JWT `lecturer_course_ids.length`) | ☐ |
| 11 | Verify "Total Users" is NOT present | Admin-only stat | ☐ |
| 12 | Verify "Total Courses" is NOT present | PA-only stat | ☐ |
| 13 | Verify "Total Tenants" is NOT present | PA-only stat | ☐ |
| 14 | Verify "Assigned Tenants" is NOT present | CSM-only stat | ☐ |
| 15 | Verify "My Courses" section | Course cards or empty state | ☐ |

### SQL Verification
```sql
-- Lecturer's assigned courses (should match JWT claim count)
SELECT COUNT(*)
FROM lecturer_course_assignments
WHERE lecturer_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com');

-- Issues scoped to lecturer's assigned courses
SELECT COUNT(*)
FROM issues
WHERE status IN ('open', 'investigating')
  AND course_id IN (
    SELECT course_id FROM lecturer_course_assignments
    WHERE lecturer_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
  );
```

### Notes / Learnings
- "Assigned Courses" stat value comes from JWT claim `lecturer_course_ids.length` — zero DB cost
- Issues and questions counts are scoped by RLS to the lecturer's assigned courses (via `lecturer_course_assignments` join in RLS policy)
- "Ungraded Exams" only appears when `lecturer_can_grade_course_ids.length > 0` — a read-only lecturer (can_grade=false) would NOT see this card
- Lecturer's issue/question counts may differ from PA's counts if the lecturer is assigned to a subset of courses

**E2E Observations (2026-02-15):**
- Greeting: "Good afternoon, Test Lecturer (Edit)" — full_name resolved correctly
- Badges: "Learner" + "Lecturer" as expected
- Action items: Open Issues (1), Unanswered Questions (2), Ungraded Exams (0) — all 3 present, no Pending Requests
- Overview: "Assigned Courses" = 2 — matches JWT claim
- My Courses: Empty state shown ("No enrolled courses yet.")

---

## DB-04: CSM Overview Dashboard

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that a CSM sees only the Overview section with an "Assigned Tenants" stat (derived from JWT claims) and enrolled courses. No "Needs Your Attention" section should appear — CSMs have no action items on the dashboard.

**Covers**: CSM-specific `showActionItems` (false), `showOverview` (true, CSM has assigned tenants), `overviewStats` (assigned tenants from JWT)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as CSM (`csm@calypso-commodities.com`) | Dashboard loads at `/dashboard` | ☐ |
| 2 | Verify greeting | "Good morning/afternoon/evening, Test CSM" or full_name | ☐ |
| 3 | Verify role badges | "Learner" (teal) and "CSM" (purple) badges | ☐ |
| 4 | Verify "Needs Your Attention" section is NOT present | No "Needs Your Attention" heading visible (CSM has no action items) | ☐ |
| 5 | Verify "Overview" section exists | Section heading with stat card(s) | ☐ |
| 6 | Verify "Assigned Tenants" stat card | Value = number of tenants CSM is assigned to (from JWT `csm_tenant_ids.length`), purple text | ☐ |
| 7 | Verify "Total Users" is NOT present | Admin-only stat | ☐ |
| 8 | Verify "Total Courses" is NOT present | PA-only stat | ☐ |
| 9 | Verify "Total Tenants" is NOT present | PA-only stat (CSM sees "Assigned Tenants" instead) | ☐ |
| 10 | Verify "Assigned Courses" is NOT present | Lecturer-only stat | ☐ |
| 11 | Verify "My Courses" section | Course cards or empty state | ☐ |

### SQL Verification
```sql
-- CSM's assigned tenants (should match JWT claim count)
SELECT COUNT(*)
FROM csm_tenant_assignments
WHERE user_id = (SELECT id FROM profiles WHERE email = 'csm@calypso-commodities.com');
```

### Notes / Learnings
- CSM has no count queries fired — the only stat is from JWT claims (`csm_tenant_ids.length`)
- "Needs Your Attention" section hidden because `showActionItems()` checks `is_tenant_admin || is_platform_admin || lecturer_course_ids.length > 0` — CSM matches none
- "Overview" section still shown because `showOverview()` checks `csm_tenant_ids.length > 0` — CSM matches this
- CSM pages are mostly stubs — this is why there are no action items for CSM on the dashboard

**E2E Observations (2026-02-15):**
- Greeting: "Good afternoon, Test CSM" — full_name resolved correctly
- Badges: "Learner" + "CSM" as expected
- "Needs Your Attention" section: NOT present (confirmed absent from DOM)
- Overview: "Assigned Tenants" = 1 — matches JWT claim
- My Courses: Empty state shown ("No enrolled courses yet.")

---

## DB-05: Learner Minimal Dashboard

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that a pure Learner (no admin/teaching/CSM roles) sees only the Welcome Header and My Courses sections. The "Needs Your Attention" and "Overview" sections must be completely absent — not empty, but not rendered at all.

**Covers**: `showActionItems()` returns false for learner, `showOverview()` returns false for learner, enrolled courses display

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Learner (`learner@calypso-commodities.com`) | Dashboard loads at `/dashboard` | ☐ |
| 2 | Verify greeting | "Good morning/afternoon/evening, Test Learner (Calypso)" or full_name | ☐ |
| 3 | Verify role badges | Only "Learner" (teal/primary) badge — no other badges | ☐ |
| 4 | Verify "Needs Your Attention" section is NOT present | No "Needs Your Attention" heading in the page at all | ☐ |
| 5 | Verify "Overview" section is NOT present | No "Overview" heading in the page at all | ☐ |
| 6 | Verify "My Courses" section exists | "My Courses" heading always present for all users | ☐ |
| 7 | If learner has enrolled courses: verify course cards | Course titles, progress bars, enrollment data visible | ☐ |
| 8 | If learner has no enrolled courses: verify empty state | "No enrolled courses yet. Browse available courses to get started." with BookOpen icon | ☐ |
| 9 | Verify NO stat cards anywhere on page | No `StatCardComponent` instances rendered | ☐ |
| 10 | Verify NO action item cards anywhere | No `DashboardActionCardComponent` instances rendered | ☐ |

### Notes / Learnings
- Pure learner = `is_tenant_admin: false`, `is_platform_admin: false`, `lecturer_course_ids: []`, `csm_tenant_ids: []`
- The `showActionItems()` and `showOverview()` computed signals return `false` → Angular's `@if` blocks don't render those DOM sections at all
- `DashboardService.loadCounts()` is still called but fires 0 queries for a pure learner (no tables to count)
- The dashboard for learners is intentionally simple — their value is in "My Courses" and discovering new courses via `/courses`

**E2E Observations (2026-02-15):**
- Greeting: "Good afternoon, Test Learner (Calypso)" — full_name resolved correctly
- Badges: Only "Learner" — no other badges
- "Needs Your Attention": NOT present (confirmed absent)
- "Overview": NOT present (confirmed absent)
- My Courses: 2 enrolled courses with progress bars:
  - CW01: 1/4 modules (25%), "Continue", "Today", 1h duration
  - Intro Commodity: 7/9 modules (78%), "Continue", "Yesterday", 2h 15m duration
- "View all courses" link present and functional
- This also verifies DB-07 (course cards with progress data)

---

## DB-06: Action Card Navigation

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that clicking each action item card navigates to the correct destination page. This is critical because the dashboard is a hub — users land here and navigate to their most relevant page. A broken link means users can't reach their work queue.

**Covers**: `DashboardActionCardComponent` `routerLink` binding, Angular router navigation for all 4 action item routes

### Preconditions
- Log in as Platform Admin (sees all 4 action items)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as PA (`et@calypso-commodities.com`) | Dashboard with all 4 action cards visible | ☐ |
| 2 | Click "Pending Requests" card | Navigates to `/admin/access-requests` — Access Requests page loads with page heading | ☐ |
| 3 | Navigate back to `/dashboard` | Dashboard reloads | ☐ |
| 4 | Click "Open Issues" card | Navigates to `/teaching/issues` — Issue Management page loads with page heading | ☐ |
| 5 | Navigate back to `/dashboard` | Dashboard reloads | ☐ |
| 6 | Click "Unanswered Questions" card | Navigates to `/teaching/questions` — Questions Board page loads with page heading | ☐ |
| 7 | Navigate back to `/dashboard` | Dashboard reloads | ☐ |
| 8 | Click "Ungraded Exams" card | Navigates to `/teaching/grading` — Exam Grading page loads with page heading | ☐ |
| 9 | Navigate back to `/dashboard` | Dashboard reloads, all data intact | ☐ |

### Notes / Learnings
- Each `DashboardActionCardComponent` renders an `<a [routerLink]="route()">` — standard Angular navigation, no programmatic routing
- The ChevronRight icon on each card provides a visual affordance that the card is clickable/navigable
- After navigating back, `DashboardService.loadCounts()` and `CourseService.loadCourses()` fire again in `ngOnInit`
- The destination pages all have their own `roleGuard` — PA can access all 4
- If any destination route is misconfigured or renamed, the navigation will fail (redirect to dashboard or 404)

**E2E Observations (2026-02-15):**
- All 4 action card navigation links verified as PA:
  - "Pending Requests" → `/admin/access-requests` (Access Requests page loaded)
  - "Open Issues" → `/teaching/issues` (Issue Management page loaded)
  - "Unanswered Questions" → `/teaching/questions` (Questions Board page loaded)
  - "Ungraded Exams" → `/teaching/grading` (Exam Grading page loaded)
- All 4 navigations worked correctly, page headings confirmed on each destination

---

## DB-07: Enrolled Course Cards + Progress

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that the "My Courses" section renders enrolled course cards with correct progress data, sorts them by recent activity, limits to 6 cards, and shows the "View all courses" navigation link. This tests the integration of `CourseService.loadCourses()` with `CourseCardComponent`.

**Covers**: `enrolledCourses` computed signal (filter + sort + slice), `CourseCardComponent` rendering (title, progress bar, module count, duration, enrollment badge, action label), "View all courses" routerLink

### Preconditions
- PA has at least 1 enrolled course (ideally 2+ for sort verification)
- At least 1 enrolled course has some progress (completedModules > 0)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as PA (`et@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Scroll to "My Courses" section | Course card grid visible (1-3 columns responsive) | ☐ |
| 3 | Verify course card content | Each card shows: thumbnail/gradient, title, enrollment badge (Open/Invite/Password), progress bar (X/Y modules, N%) | ☐ |
| 4 | Verify progress bar accuracy | `completedModules / moduleCount` fraction and percentage match actual progress data | ☐ |
| 5 | Verify module count in footer | "N modules" with BookOpen icon matches actual module count | ☐ |
| 6 | Verify duration in footer (if > 0) | Clock icon + formatted duration (e.g., "2h 30m") from `totalDurationMinutes` | ☐ |
| 7 | Verify action label | "Start" (0 progress), "Continue" (partial), "Review" (100%), or "View" (not enrolled) | ☐ |
| 8 | Verify sort order | Courses with more recent `lastActivity` appear first (most recently active on top/left) | ☐ |
| 9 | Verify max 6 cards | If PA has more than 6 enrolled courses, only the 6 most recent appear | ☐ |
| 10 | Verify "View all courses" link | Teal link visible with ArrowRight icon at top-right of section | ☐ |
| 11 | Click "View all courses" | Navigates to `/courses` — full course list page loads | ☐ |
| 12 | Click a course card | Navigates to `/courses/<course-id>` — course detail page loads | ☐ |

### SQL Verification
```sql
-- PA's enrolled courses
SELECT c.title, ce.created_at AS enrollment_date
FROM course_enrollments ce
JOIN courses c ON c.id = ce.course_id
WHERE ce.user_id = (SELECT id FROM profiles WHERE email = 'et@calypso-commodities.com')
ORDER BY ce.created_at DESC;
```

### Notes / Learnings
- `CourseCardComponent` is reused from the courses feature — same component on `/courses` page and dashboard
- `enrolledCourses` filters `isEnrolled` first, then sorts by `lastActivity` desc, then slices to 6
- Sort handles null `lastActivity`: courses with activity sort before those without, null-activity courses sort alphabetically
- Progress bar uses `[style.width.%]="course().progressPercent"` — 0% = empty bar, 100% = full teal bar
- The "View all courses" link only renders when `enrolledCourses().length > 0`
- Course cards use `RouterLink` to `/courses/:id` — clicking navigates to detail page

**E2E Observations (2026-02-15):**
- Verified via Learner (DB-05): 2 enrolled courses with full progress data:
  - CW01: 1/4 modules (25%), "Continue" label, "Today" relative date, 1h duration
  - Intro Commodity: 7/9 modules (78%), "Continue" label, "Yesterday" relative date, 2h 15m duration
- Progress bars rendered correctly with percentage widths
- "View all courses" link visible and navigates to `/courses`
- Courses sorted by lastActivity desc (most recent first)

---

## DB-08: Empty Enrolled Courses State

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify the empty state when a user has no enrolled courses. The "My Courses" section should show an `EmptyStateComponent` with a helpful message and BookOpen icon, and the "View all courses" link should NOT appear.

**Covers**: `enrolledCourses().length === 0` branch, `EmptyStateComponent` rendering, "View all courses" link conditional visibility

### Preconditions
- The test user has NO enrolled courses (or use a user known to have 0 enrollments)
- If no test user has 0 enrollments, temporarily unenroll the learner or use a freshly created user

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as a user with no enrolled courses | Dashboard loads at `/dashboard` | ☐ |
| 2 | Scroll to "My Courses" section | "My Courses" heading visible | ☐ |
| 3 | Verify empty state component | EmptyState with BookOpen icon: "No enrolled courses yet. Browse available courses to get started." | ☐ |
| 4 | Verify "View all courses" link is NOT present | No teal link with "View all courses" text visible | ☐ |
| 5 | Verify no course cards rendered | No `CourseCardComponent` instances in the DOM | ☐ |

### SQL Verification
```sql
-- Verify user has no enrollments
SELECT COUNT(*) FROM course_enrollments
WHERE user_id = (SELECT id FROM profiles WHERE email = '<TEST_USER_EMAIL>');
-- Expected: 0
```

### Notes / Learnings
- The empty state is rendered by `EmptyStateComponent` — shared component from `shared/components/`
- "View all courses" link is conditionally rendered: `@if (enrolledCourses().length > 0)` — hidden when empty
- This state is common for new users who just got access — the empty state message guides them to browse courses
- `CourseService.loadCourses()` returns courses the user can see (via RLS/tenant_courses), but `enrolledCourses` further filters to `isEnrolled === true`

**E2E Observations (2026-02-15):**
- Verified via PA, TA, Lecturer, and CSM — all 4 roles show empty state since none are enrolled in courses
- Empty state message: "No enrolled courses yet. Browse available courses to get started." with BookOpen icon
- "View all courses" link NOT present when empty (correctly hidden)
- No course cards rendered in any of these 4 role dashboards

---

## Data Setup Notes

### Verifying Per-Role Dashboard State

For comprehensive testing, ensure the test data supports each role seeing meaningful counts:

```sql
-- Quick overview of actionable items in the system
SELECT 'Pending Access Requests' AS item, COUNT(*) FROM access_requests WHERE status = 'pending'
UNION ALL SELECT 'Open Issues', COUNT(*) FROM issues WHERE status IN ('open', 'investigating')
UNION ALL SELECT 'Pending Expert Questions', COUNT(*) FROM expert_questions WHERE status = 'pending'
UNION ALL SELECT 'Ungraded Exam Submissions', COUNT(*) FROM exam_submissions WHERE score IS NULL
UNION ALL SELECT 'Total Users', COUNT(*) FROM profiles
UNION ALL SELECT 'Total Courses', COUNT(*) FROM courses
UNION ALL SELECT 'Total Tenants', COUNT(*) FROM tenants;
```

### Creating Test Data (if counts are all zero)

If all counts are 0, the action item cards still render (showing 0) but the test is less meaningful. To create actionable items:

```sql
-- Create a pending access request (for TA/PA to see)
INSERT INTO access_requests (email, status)
VALUES ('newuser@calypsoclient.com', 'pending')
ON CONFLICT DO NOTHING;

-- Note: Issues, expert questions, and exam submissions are typically created
-- by learner actions (reporting, asking, submitting). You may need to run
-- through those flows first or insert test data via service-role.
```

### Enrolling the Learner (if needed for DB-07/DB-08)

```sql
-- Enroll the learner in a course (for "My Courses" section)
INSERT INTO course_enrollments (user_id, course_id, tenant_id)
SELECT p.id, c.id, p.tenant_id
FROM profiles p, courses c
WHERE p.email = 'learner@calypso-commodities.com'
  AND c.title = '<COURSE_TITLE>'
ON CONFLICT DO NOTHING;

-- Unenroll (for testing empty state in DB-08)
DELETE FROM course_enrollments
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-15 | Claude Code | DB-01 to DB-08 | 8 | 0 | All stories pass on localhost:4200. DB-07 verified via Learner (2 enrolled courses with progress). DB-08 verified via PA/TA/Lecturer/CSM (all show empty state). All DB counts verified against Supabase REST API. |

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| — | — | No bugs found yet | — | — | — |

---

## References

| Document | Path |
|----------|------|
| Dashboard Component | `frontend/src/app/features/dashboard/dashboard.component.ts` |
| Dashboard Component Tests | `frontend/src/app/features/dashboard/dashboard.component.spec.ts` |
| Dashboard Service | `frontend/src/app/features/dashboard/dashboard.service.ts` |
| Dashboard Service Tests | `frontend/src/app/features/dashboard/dashboard.service.spec.ts` |
| Action Card Component | `frontend/src/app/features/dashboard/components/dashboard-action-card.component.ts` |
| Action Card Tests | `frontend/src/app/features/dashboard/components/dashboard-action-card.component.spec.ts` |
| Course Card Component | `frontend/src/app/features/courses/components/course-card.component.ts` |
| Course Service | `frontend/src/app/core/services/course.service.ts` |
| Auth Service (roles/claims) | `frontend/src/app/core/services/auth.service.ts` |
| Profile Service | `frontend/src/app/core/services/profile.service.ts` |
| Route Config | `frontend/src/app/app.routes.ts` |
| Sidebar Nav Config | `frontend/src/app/layout/sidebar/sidebar-nav.config.ts` |
| Shared Components | `frontend/src/app/shared/components/` |
| Test Users Setup | `docs/e2e-user-stories/TEST_USERS.md` |
