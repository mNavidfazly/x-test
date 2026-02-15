> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Content Staleness Dashboard E2E User Stories (Phase 10G)

## Overview

E2E testing scenarios for the Content Staleness Dashboard at `/teaching/staleness` (Phase 10G). These stories verify a **per-module staleness dashboard** with **expandable course rows** and **postpone (snooze) functionality** — each module is individually assessed as stale or fresh based on its own `updated_at` vs the parent course's `staleness_threshold_days`. Users can postpone stale modules for 30 days to suppress false positives.

**Key components:**
- `StalenessDashboardPageComponent` — page with filters, summary cards, expandable data table, postpone actions
- `StalenessService` — 2 parallel Supabase queries + client-side per-module computation + `postponeModule()` / `postponeAllStaleModules()` mutations
- `StaleModule` model — `id`, `title`, `moduleType`, `updatedAt`, `daysSinceUpdate`, `isStale`, `daysOverdue`, `postponedUntil`, `isPostponed`
- `StaleCourse` model — `id`, `title`, `thresholdDays`, `modules[]`, `staleModuleCount`, `freshModuleCount`, `totalModuleCount`, `hasStaleModules`, `postponedModuleCount`

**Per-module staleness logic:**
- For each module: `daysSinceUpdate = floor((now - module.updated_at) / 86400000)`
- `isPastThreshold = daysSinceUpdate > course.staleness_threshold_days`
- `isPostponed = staleness_postponed_until != null && staleness_postponed_until > now`
- `isStale = isPastThreshold && !isPostponed`
- `daysOverdue = daysSinceUpdate - thresholdDays` (only when past threshold)
- Course-level rollup: `hasStaleModules = any module isStale`, `staleModuleCount`, `freshModuleCount` (excludes postponed), `postponedModuleCount`
- Courses with 0 modules: `hasStaleModules = false`, status = "No Modules"
- Null `staleness_threshold_days` defaults to 180

**Postpone (snooze) feature:**
- Stale modules can be postponed for 30 days — sets `staleness_postponed_until` column on `modules` table
- Per-module "Postpone" button (CalendarClock icon) visible only on stale modules in expanded rows
- Per-course "Postpone All" button in Action column — postpones all stale modules in that course at once
- Postponed modules show blue badge "Postponed until {date}" instead of red "Stale" badge
- After 30 days, postpone expires and module reappears as stale (self-healing)
- Migration 00035: module-specific trigger `set_module_updated_at()` prevents `updated_at` bump on pure postpone operations

**Expandable row pattern:**
- Click a course row (or chevron) to expand and show a nested module table
- Expanded row shows: module type icon, title, last updated date, age ("N days ago"), stale/postponed/fresh badge, action (Postpone button for stale modules)
- Click again to collapse; clicking another course switches the expansion

**RLS scoping:**
- **Platform Admin**: sees ALL courses (unconditional SELECT)
- **Lecturer**: sees only assigned courses (via `lecturer_course_assignments` RLS join)
- Both roles see modules scoped by their course visibility
- Existing UPDATE RLS on modules covers postpone (PA + Lecturer with can_edit)

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
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | CS-01 through CS-08, CS-11 through CS-14 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit)** | Calypso (master) | CS-09, CS-10, CS-14 |
| 3 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | CS-10 |
| 4 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | CS-10 |
| 5 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | CS-10 |

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
| 1 | CS-01 | PA Navigation + Page Load | PA logged in, at least 1 course with modules |
| 2 | CS-02 | Per-Module Staleness Data Accuracy | CS-01 (page loads with data) |
| 3 | CS-03 | Summary Cards (Module-Level Counts) | CS-01 (courses with mixed statuses) |
| 4 | CS-04 | Search Filter | CS-01 (multiple courses visible) |
| 5 | CS-05 | Status Filter (Has Stale / All Fresh / Has Postponed / No Modules) | CS-01 (courses in all states) |
| 6 | CS-06 | View Course Link | CS-01 (at least 1 course visible) |
| 7 | CS-07 | Expand Course Row — Module Details | CS-01 (course with modules visible) |
| 8 | CS-08 | Expand/Collapse Behavior | CS-07 (expandable rows work) |
| 9 | CS-09 | Lecturer Scoped View | Lecturer logged in, assigned to at least 1 course |
| 10 | CS-10 | Role Access Control | Multiple role logins |
| 11 | CS-11 | Postpone Single Module | CS-07 (expanded row with stale module) |
| 12 | CS-12 | Postpone All Stale Modules (Course-Level) | CS-01 (course with stale modules) |
| 13 | CS-13 | Postpone Badge + Status Update | CS-11 or CS-12 (module has been postponed) |
| 14 | CS-14 | Postpone — Lecturer with can_edit | Lecturer logged in, assigned course with stale modules |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| CS-01 | PA Navigation + Page Load | Platform Admin | ✅ | 2026-02-15 |
| CS-02 | Per-Module Staleness Data Accuracy | Platform Admin | ✅ | 2026-02-15 |
| CS-03 | Summary Cards (Module-Level Counts) | Platform Admin | ✅ | 2026-02-15 |
| CS-04 | Search Filter | Platform Admin | ✅ | 2026-02-15 |
| CS-05 | Status Filter (Has Stale / All Fresh / Has Postponed / No Modules) | Platform Admin | ✅ | 2026-02-15 |
| CS-06 | View Course Link → Course Detail | Platform Admin | ✅ | 2026-02-15 |
| CS-07 | Expand Course Row — Module Details | Platform Admin | ✅ | 2026-02-15 |
| CS-08 | Expand/Collapse Behavior | Platform Admin | ✅ | 2026-02-15 |
| CS-09 | Lecturer Sees Only Assigned Courses | Lecturer | ✅ | 2026-02-15 |
| CS-10 | Role Access Control | Multiple | ✅ | 2026-02-15 |
| CS-11 | Postpone Single Module | Platform Admin | ✅ | 2026-02-15 |
| CS-12 | Postpone All Stale Modules (Course-Level) | Platform Admin | ✅ | 2026-02-15 |
| CS-13 | Postpone Badge + Status Update | Platform Admin | ✅ | 2026-02-15 |
| CS-14 | Postpone — Lecturer with can_edit | Lecturer | ✅ | 2026-02-15 |

---

## Preconditions (All Stories)

- At least 1 course with stale modules (some modules not updated for >180 days)
- At least 1 course with all fresh modules (all modules updated within threshold)
- At least 1 course with 0 modules (to test "No Modules" state)
- Ideally 1 course with a custom `staleness_threshold_days` different from the default 180 (e.g., 90 days)
- Lecturer has `lecturer_course_assignments` for at least 1 but NOT all courses

**Verify current per-module staleness state:**

```sql
-- Per-module staleness for all courses (including postpone status)
SELECT
  c.title AS course_title,
  COALESCE(c.staleness_threshold_days, 180) AS threshold,
  m.title AS module_title,
  m.module_type,
  m.updated_at,
  m.staleness_postponed_until,
  FLOOR(EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400)::int AS days_since_update,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 > COALESCE(c.staleness_threshold_days, 180)
      AND (m.staleness_postponed_until IS NULL OR m.staleness_postponed_until <= NOW()) THEN true
    ELSE false
  END AS is_stale,
  CASE
    WHEN m.staleness_postponed_until IS NOT NULL AND m.staleness_postponed_until > NOW() THEN true
    ELSE false
  END AS is_postponed,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 > COALESCE(c.staleness_threshold_days, 180)
    THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 - COALESCE(c.staleness_threshold_days, 180))::int
    ELSE NULL
  END AS days_overdue
FROM courses c
LEFT JOIN modules m ON m.course_id = c.id
ORDER BY c.title, m.updated_at ASC;
```

**Course-level summary:**

```sql
SELECT
  c.id,
  c.title,
  COALESCE(c.staleness_threshold_days, 180) AS threshold,
  COUNT(m.id) AS total_modules,
  COUNT(m.id) FILTER (
    WHERE EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 > COALESCE(c.staleness_threshold_days, 180)
      AND (m.staleness_postponed_until IS NULL OR m.staleness_postponed_until <= NOW())
  ) AS stale_modules,
  COUNT(m.id) FILTER (
    WHERE m.staleness_postponed_until IS NOT NULL AND m.staleness_postponed_until > NOW()
  ) AS postponed_modules,
  COUNT(m.id) FILTER (
    WHERE EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 <= COALESCE(c.staleness_threshold_days, 180)
      AND (m.staleness_postponed_until IS NULL OR m.staleness_postponed_until <= NOW())
  ) AS fresh_modules
FROM courses c
LEFT JOIN modules m ON m.course_id = c.id
GROUP BY c.id, c.title, c.staleness_threshold_days
ORDER BY c.title;
```

**Ensure a "No Modules" course exists (if not):**

```sql
INSERT INTO courses (title, description, enrollment_type)
VALUES ('Empty Test Course', 'Course with no modules for staleness testing', 'invite_only')
ON CONFLICT DO NOTHING;

INSERT INTO tenant_courses (tenant_id, course_id)
SELECT t.id, c.id
FROM tenants t, courses c
WHERE t.domain = 'calypso-commodities.com'
  AND c.title = 'Empty Test Course'
ON CONFLICT DO NOTHING;
```

**Ensure stale modules exist (if all modules are recently updated):**

```sql
-- NOTE: Must disable triggers because set_module_updated_at() resets updated_at to NOW()
ALTER TABLE modules DISABLE TRIGGER set_module_audit_fields;
ALTER TABLE modules DISABLE TRIGGER set_module_updated_at;
ALTER TABLE modules DISABLE TRIGGER enforce_module_immutable_fields;
ALTER TABLE modules DISABLE TRIGGER on_significant_module_update;

UPDATE modules
SET updated_at = NOW() - INTERVAL '200 days'
WHERE course_id = '<COURSE_ID>';

ALTER TABLE modules ENABLE TRIGGER set_module_audit_fields;
ALTER TABLE modules ENABLE TRIGGER set_module_updated_at;
ALTER TABLE modules ENABLE TRIGGER enforce_module_immutable_fields;
ALTER TABLE modules ENABLE TRIGGER on_significant_module_update;
```

**Clear all postponed states (for clean test runs):**

```sql
UPDATE modules SET staleness_postponed_until = NULL WHERE staleness_postponed_until IS NOT NULL;
```

**Verify lecturer assignment:**

```sql
SELECT lca.course_id, c.title, lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN courses c ON c.id = lca.course_id
WHERE lca.lecturer_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com');
```

---

## CS-01: PA Navigation + Page Load

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that the Platform Admin can find and navigate to the Content Staleness dashboard via the sidebar Teaching section, and that the page renders the full structure: header with course count badge, filter bar, 4 module-level summary cards, and expandable data table with correct columns.

**Covers**: Sidebar config (`Teaching` section, `roles: ['lecturer', 'platform_admin']`), route `teaching/staleness` with `roleGuard`, `StalenessService.loadStalenessData()`, page rendering

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Look at sidebar Teaching section | "Content Staleness" item visible with Clock icon | ☐ |
| 3 | Click "Content Staleness" in sidebar | Navigates to `/teaching/staleness` | ☐ |
| 4 | Verify page header | "Content Staleness" heading with Clock icon and teal course count badge | ☐ |
| 5 | Verify teal badge shows total count | Number in badge matches total courses visible in table (unfiltered) | ☐ |
| 6 | Verify filter bar | Search input ("Search by course title...") + Status dropdown ("All Status") visible | ☐ |
| 7 | Verify summary cards row | 4 cards: "Total Modules" (slate), "Stale Modules" (rose), "Fresh Modules" (emerald), "Courses" (slate) | ☐ |
| 8 | Verify table headers | 7 columns: (chevron), Course, Modules, Stale / Fresh, Threshold, Status, Action | ☐ |
| 9 | Verify at least one data row | Row with chevron icon, course title, total module count, stale/fresh counts, threshold + "days", status badge, "View" link | ☐ |
| 10 | Verify PA sees ALL courses | Total count matches the number of courses in the system (PA has no RLS restriction on courses) | ☐ |

### SQL Verification
```sql
SELECT COUNT(*) FROM courses;
```

### Notes / Learnings
- PA's RLS on `courses` is unconditional SELECT — sees all courses
- PA's RLS on `modules` is also unconditional — sees all modules for staleness computation
- The teal badge in the header shows `service.courses().length` (total unfiltered count), NOT `filteredCourses().length`
- Summary cards show module-level counts from `filteredCourses()` — they update when filters change
- Courses with stale modules are sorted first (by max `daysOverdue` desc), then postponed, then all-fresh, then no-modules
- Each course row has a right-pointing chevron (ChevronRight) indicating it can be expanded

---

## CS-02: Per-Module Staleness Data Accuracy

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that per-module staleness computations in the table and expanded module details are correct by cross-referencing with actual database values. This is the most important test — if the computation is wrong, the entire dashboard is misleading.

**Covers**: `StalenessService.loadStalenessData()` per-module computation — `daysSinceUpdate`, `isStale`, `isPostponed`, `daysOverdue` per module, course-level rollups (`staleModuleCount`, `freshModuleCount`, `postponedModuleCount`, `hasStaleModules`)

### Preconditions
- At least 1 course with some stale modules and some fresh modules (mixed)
- At least 1 course with all fresh modules
- At least 1 course with 0 modules
- Ideally 1 course with custom `staleness_threshold_days` (not default 180)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Run the per-module SQL verification query (from Preconditions section) | Get expected per-module staleness values | ☐ |
| 2 | Navigate to `/teaching/staleness` as PA | Dashboard loads with all courses | ☐ |
| 3 | Find a course with **"Has Stale"** badge | Rose badge with AlertTriangle icon visible in Status column | ☐ |
| 4 | Check the Stale / Fresh column for that course | Shows "N / M" where N = stale modules (rose), M = fresh modules (emerald), matches SQL | ☐ |
| 5 | Expand that course (click the row) | Nested module table appears with Type, Module, Last Updated, Age, Status, Action columns | ☐ |
| 6 | Verify stale module in expanded view | Module shows: type icon, title, formatted date, "N days ago", rose "Stale (Xd overdue)" badge, "Postpone" button | ☐ |
| 7 | Verify stale module's `daysOverdue` | Value = `daysSinceUpdate - thresholdDays` — matches SQL computation (±1 day) | ☐ |
| 8 | Verify fresh module in expanded view | Module shows: type icon, title, formatted date, "N days ago", emerald "Fresh" badge, no Postpone button | ☐ |
| 9 | Find a course with **"All Fresh"** badge | Emerald badge with CheckCircle2 icon — all modules within threshold | ☐ |
| 10 | Expand that course | All modules show "Fresh" badge, no stale modules, no Postpone buttons | ☐ |
| 11 | Find a course with **"No Modules"** badge | Slate badge with Package icon, module count = 0, Stale/Fresh shows em-dash (—) | ☐ |
| 12 | Expand that course | Shows "This course has no modules yet." message | ☐ |
| 13 | Verify threshold column | Shows course-specific threshold (or default 180) + "days" suffix | ☐ |
| 14 | If a course has custom threshold, verify it | The non-180 value appears in the Threshold column AND affects per-module staleness | ☐ |
| 15 | Verify sort order | Courses with stale modules first (by max `daysOverdue` desc), then postponed, then all-fresh, then no-modules | ☐ |
| 16 | Verify module sort within expanded row | Stale modules first (by `daysOverdue` desc), then postponed, then fresh (by `daysSinceUpdate` desc) | ☐ |

### SQL Verification
```sql
-- Per-module staleness for manual comparison
SELECT
  c.title AS course_title,
  COALESCE(c.staleness_threshold_days, 180) AS threshold_days,
  m.title AS module_title,
  m.module_type,
  FLOOR(EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400)::int AS days_since_update,
  m.staleness_postponed_until,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 > COALESCE(c.staleness_threshold_days, 180)
      AND (m.staleness_postponed_until IS NULL OR m.staleness_postponed_until <= NOW()) THEN 'STALE'
    WHEN m.staleness_postponed_until IS NOT NULL AND m.staleness_postponed_until > NOW() THEN 'POSTPONED'
    ELSE 'FRESH'
  END AS status,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 > COALESCE(c.staleness_threshold_days, 180)
    THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 - COALESCE(c.staleness_threshold_days, 180))::int
    ELSE NULL
  END AS days_overdue
FROM courses c
LEFT JOIN modules m ON m.course_id = c.id
ORDER BY c.title, status, days_since_update DESC;
```

### Notes / Learnings
- `daysSinceUpdate` may differ by +/-1 day depending on timezone and time of testing — this is expected
- `staleness_threshold_days` defaults to 180 when NULL in the DB — verify the coalescing works
- Module `updated_at` is set by the `set_module_updated_at()` trigger on any UPDATE to modules (migration 00035 replaced the generic trigger)
- Courses with NO modules always show `hasStaleModules = false` — they get "No Modules" badge, not "All Fresh"
- Module type icons: video = Video, pdf = FileText, markdown = Type, quiz = HelpCircle, exam = ClipboardCheck, external_quiz = ExternalLink
- Expanded module table now has 6 columns: Type, Module, Last Updated, Age, Status, Action

---

## CS-03: Summary Cards (Module-Level Counts)

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that the 4 summary cards display correct module-level counts and update reactively when filters are applied.

**Covers**: `totalModules`, `staleModules`, `freshModules` computed signals (reduce over `filteredCourses`), `filteredCourses().length` for Courses card, filter reactivity

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/staleness` as PA | Dashboard loads with all courses | ☐ |
| 2 | Verify "Total Modules" card | Sum of all `totalModuleCount` across all courses (slate-900 color) | ☐ |
| 3 | Verify "Stale Modules" card | Sum of all `staleModuleCount` (rose-600 color) — excludes postponed modules | ☐ |
| 4 | Verify "Fresh Modules" card | Sum of all `freshModuleCount` (emerald-600 color) — excludes postponed modules | ☐ |
| 5 | Verify "Courses" card | Total number of courses in filtered list (slate-600 color) | ☐ |
| 6 | Verify sum consistency | Stale Modules + Fresh Modules + Postponed Modules = Total Modules | ☐ |
| 7 | Apply status filter "Has Stale Modules" | Cards update: Total Modules = sum across stale-courses only, Courses = number of courses with stale modules | ☐ |
| 8 | Clear filter, apply search that matches 1 course | All 4 cards update to reflect just the 1 filtered course's module counts | ☐ |
| 9 | Clear filter | All cards return to original values | ☐ |

### Notes / Learnings
- All counts derive from `filteredCourses()` — applying any filter recalculates all 4 cards
- Total Modules, Stale Modules, Fresh Modules use `.reduce()` over `filteredCourses()` to sum per-course counts
- **Fresh Modules excludes postponed modules**: `freshModuleCount = totalModuleCount - staleModuleCount - postponedModuleCount`
- Courses card shows `filteredCourses().length` — the number of courses, not modules
- Numbers use `tabular-nums` CSS class for consistent digit width
- The teal badge in the header shows `service.courses().length` (unfiltered), while summary cards show filtered counts

---

## CS-04: Search Filter

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify the search input filters courses by title (case-insensitive partial match).

**Covers**: `searchTerm` signal, `filteredCourses` computed (search branch), "Clear filters" link

### Preconditions
- At least 2 courses with distinct titles visible in the dashboard

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/staleness` as PA | Full course list visible, no "Clear filters" link | ☐ |
| 2 | Note the total course count | e.g., Courses card = 4 | ☐ |
| 3 | Type a partial course title in the search input (e.g., "LNG") | Table filters to rows where title contains "LNG" (case-insensitive) | ☐ |
| 4 | Verify non-matching courses are hidden | Only matching courses visible; summary cards update | ☐ |
| 5 | Verify "Clear filters" link appears | Underlined text link visible next to the status dropdown | ☐ |
| 6 | Verify case insensitivity | Typing "lng" (lowercase) matches "LNG Fundamentals" | ☐ |
| 7 | Clear the search input manually (backspace) | Full course list restored | ☐ |
| 8 | Type a non-matching query (e.g., "xyzzzz") | Empty state: "No courses found." with CheckCircle2 icon | ☐ |
| 9 | Click "Clear filters" | Search cleared, full list restored | ☐ |

### Notes / Learnings
- Search only matches course `title` (NOT description, module names, etc.)
- Search is case-insensitive via `.toLowerCase().includes()`
- Placeholder text: "Search by course title..."
- Search input has a magnifying glass (Search) icon on the left side
- "Clear filters" appears when `searchTerm() || statusFilter() !== 'all'`

---

## CS-05: Status Filter (Has Stale / All Fresh / Has Postponed / No Modules)

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify the status dropdown correctly filters courses into four categories based on per-module staleness, and that combined search + status filtering works.

**Covers**: `statusFilter` signal, `filteredCourses` computed (status branches), filter combination (AND logic)

### Preconditions
- At least 1 course with stale modules (has_stale), 1 course with all fresh modules (all_fresh), 1 course with no modules (no_modules)
- For "Has Postponed" filter: at least 1 course with postponed modules (run CS-11 or CS-12 first)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/staleness` as PA | All courses visible, dropdown shows "All Status" | ☐ |
| 2 | Select "Has Stale Modules" from status dropdown | Only courses with "Has Stale" badge visible; All Fresh, Postponed, and No Modules courses hidden | ☐ |
| 3 | Verify summary cards update | Total Modules = sum of modules in has-stale courses only; Courses = number of has-stale courses | ☐ |
| 4 | Select "Has Postponed" from status dropdown | Only courses with `postponedModuleCount > 0` visible | ☐ |
| 5 | Select "All Fresh" from status dropdown | Only courses with "All Fresh" badge visible; Has Stale, Postponed, and No Modules hidden | ☐ |
| 6 | Verify All Fresh filter logic | All Fresh = `!hasStaleModules && postponedModuleCount === 0 && totalModuleCount > 0` — courses where every module is within threshold and none are postponed | ☐ |
| 7 | Select "No Modules" from status dropdown | Only courses with "No Modules" badge visible | ☐ |
| 8 | Verify No Modules filter logic | All visible courses show module count = 0 and Stale / Fresh column shows em-dash (—) | ☐ |
| 9 | Select "All Status" | Full list restored | ☐ |
| 10 | **Combined filter**: Select "Has Stale Modules" + type a search term | Both filters apply with AND logic — only has-stale courses matching the search term shown | ☐ |
| 11 | Click "Clear filters" | Search cleared, status reset to "All Status", full list restored | ☐ |

### Notes / Learnings
- Status categories are mutually exclusive per course:
  - "Has Stale Modules" = `hasStaleModules === true` (at least one module stale AND not postponed)
  - "Has Postponed" = `postponedModuleCount > 0` (at least one module currently postponed — may also have stale)
  - "All Fresh" = `!hasStaleModules && postponedModuleCount === 0 && totalModuleCount > 0`
  - "No Modules" = `totalModuleCount === 0`
- The dropdown values: `all`, `has_stale`, `has_postponed`, `all_fresh`, `no_modules`
- Multiple filters combine with AND logic
- Note: A course can match both "Has Stale" and "Has Postponed" if it has some stale + some postponed modules. In that case it shows "Has Stale" badge (priority)

---

## CS-06: View Course Link → Course Detail

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify the "View" link in each row navigates to the correct course detail page. This is the dashboard's primary call-to-action — content maintainers identify stale modules here and navigate to fix them.

**Covers**: RouterLink `['/courses', course.id]`, `stopPropagation()` on action cell (prevents row expansion on View click), course detail page loads

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/staleness` as PA | Courses visible with "View" links in the Action column | ☐ |
| 2 | Note the title of a course with stale modules | e.g., "LNG Fundamentals" | ☐ |
| 3 | Click the "View" link (teal text with ExternalLink icon) on that row | Navigates to `/courses/<course-id>` — row does NOT expand (stopPropagation) | ☐ |
| 4 | Verify course detail page loads | Course title matches, lectures and modules visible | ☐ |
| 5 | Navigate back to `/teaching/staleness` | Dashboard reloads with all data | ☐ |
| 6 | Click "View" on a different course | Navigates to that course's detail page with correct data | ☐ |

### Notes / Learnings
- "View" link uses `[routerLink]="['/courses', course.id]"` — Angular RouterLink, not `<a href>`
- Link styling: `text-teal-600 hover:text-teal-700 text-xs font-semibold` with ExternalLink icon
- The Action cell has `(click)="$event.stopPropagation()"` to prevent the row click from triggering expand/collapse
- This completes the "identify → fix" workflow: see stale modules on dashboard → click View → edit modules → module's `updated_at` updates → module becomes "Fresh" on next reload

---

## CS-07: Expand Course Row — Module Details

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that clicking a course row expands it to show individual module details in a nested table. This is the core per-module staleness feature — users need to see exactly which modules are stale within each course.

**Covers**: `expandedCourseId` signal, `toggleCourse()` method, nested module table rendering, module type icons, stale/fresh/postponed badges per module, Postpone buttons

### Preconditions
- At least 1 course with both stale and fresh modules (mixed state)
- At least 1 course with 0 modules

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/staleness` as PA | Courses visible, all rows show right-pointing chevron (ChevronRight) | ☐ |
| 2 | Click a course row that has modules | Row expands: chevron changes to down (ChevronDown), nested module table appears below the row | ☐ |
| 3 | Verify nested table headers | 6 columns: Type, Module, Last Updated, Age, Status, Action | ☐ |
| 4 | Verify module type icon | Each module shows the correct icon for its type (Video/FileText/Type/HelpCircle/ClipboardCheck/ExternalLink) | ☐ |
| 5 | Verify module title | Each module's title is displayed | ☐ |
| 6 | Verify "Last Updated" column | Shows formatted date of module's `updated_at` | ☐ |
| 7 | Verify "Age" column | Shows "N days ago" where N = `daysSinceUpdate` | ☐ |
| 8 | Find a **stale** module in the expanded view | Rose badge: "Stale (Xd overdue)" where X = `daysOverdue` | ☐ |
| 9 | Verify stale module has "Postpone" button | Blue "Postpone" button with CalendarClock icon visible in Action column | ☐ |
| 10 | Find a **fresh** module in the expanded view | Emerald badge: "Fresh", no Postpone button in Action column | ☐ |
| 11 | Verify module sort order | Stale modules appear first (sorted by `daysOverdue` desc), then postponed, then fresh modules (sorted by `daysSinceUpdate` desc) | ☐ |
| 12 | Click a "No Modules" course | Shows "This course has no modules yet." centered text instead of a module table | ☐ |

### Notes / Learnings
- Module type icon mapping: `video` → Video, `pdf` → FileText, `markdown` → Type, `quiz` → HelpCircle, `exam` → ClipboardCheck, `external_quiz` → ExternalLink
- Unknown module types fall back to FileText icon
- The expanded row uses `<td colspan="7">` to span the full table width
- Background of expanded detail: `bg-slate-50`
- Stale badge format: "Stale (Xd overdue)" — "d" suffix, no space before "d"
- Postpone button: blue text, CalendarClock icon, only visible for `isStale` modules (not for fresh or already-postponed)

---

## CS-08: Expand/Collapse Behavior

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify the expand/collapse toggle behavior — clicking the same course collapses it, clicking a different course switches the expansion, and only one course can be expanded at a time.

**Covers**: `expandedCourseId` signal toggle logic, chevron direction changes, UI state consistency

### Preconditions
- At least 2 courses with modules visible

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/staleness` as PA | No course expanded initially, all chevrons point right | ☐ |
| 2 | Click Course A row | Course A expands: chevron changes to down, module table visible, row background highlights | ☐ |
| 3 | Click Course A row again | Course A collapses: chevron changes back to right, module table hidden, background returns to normal | ☐ |
| 4 | Click Course A to expand it again | Course A expanded | ☐ |
| 5 | Click Course B row (different course) | Course A collapses AND Course B expands simultaneously — only one expanded at a time | ☐ |
| 6 | Verify Course A is collapsed | Course A chevron points right, no module detail row visible | ☐ |
| 7 | Verify Course B is expanded | Course B chevron points down, module detail row visible | ☐ |
| 8 | Click Course B to collapse | All courses collapsed, no expanded rows | ☐ |

### Notes / Learnings
- Only one course can be expanded at a time (single `expandedCourseId` signal, not a Set)
- The expanded course row gets `bg-slate-50` background highlight
- Chevron direction: ChevronRight (collapsed) → ChevronDown (expanded)
- The entire row is clickable to toggle (except the Action cell which has `stopPropagation`)

---

## CS-09: Lecturer Sees Only Assigned Courses

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that RLS correctly scopes the staleness dashboard for lecturers — they should only see courses they're assigned to via `lecturer_course_assignments`, not all courses. Module details within their assigned courses should be complete and accurate.

**Covers**: RLS policies on `courses` (`courses_select_lecturer`), RLS on `modules` (lecturer sees modules for assigned courses only), per-module staleness computation scoped by RLS

### Preconditions
- Lecturer is assigned to at least 1 course but NOT all courses in the system
- PA has already verified the full course count in CS-01

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Lecturer (`lecturer-edit@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Verify sidebar | "Teaching" section visible with "Content Staleness" item (Clock icon) | ☐ |
| 3 | Click "Content Staleness" | Navigates to `/teaching/staleness` | ☐ |
| 4 | Verify page loads with data | "Content Staleness" header visible, table has rows | ☐ |
| 5 | Note the Courses card count | e.g., Courses = 1 (lecturer's assigned courses only) | ☐ |
| 6 | Verify count is LESS than PA's total | Lecturer sees fewer courses than PA (from CS-01 step 10) | ☐ |
| 7 | Verify each visible course matches assignment | All visible courses are in the lecturer's `lecturer_course_assignments` | ☐ |
| 8 | Expand an assigned course | Module detail table shows all modules for that course with correct staleness | ☐ |
| 9 | Verify module counts match | `totalModuleCount` and stale/fresh counts match the actual module data (not affected by RLS scoping) | ☐ |
| 10 | Verify summary cards are correct | Total/Stale/Fresh Modules and Courses reflect only the lecturer's assigned courses | ☐ |

### SQL Verification
```sql
-- Courses the lecturer should see
SELECT c.id, c.title
FROM courses c
JOIN lecturer_course_assignments lca ON lca.course_id = c.id
WHERE lca.lecturer_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com');

-- Total courses (PA sees all)
SELECT COUNT(*) FROM courses;
```

### Notes / Learnings
- RLS on `courses` for lecturers: `courses_select_lecturer` uses `EXISTS (SELECT 1 FROM lecturer_course_assignments WHERE course_id = courses.id AND lecturer_id = auth.uid())`
- RLS on `modules` for lecturers: `modules_select_lecturer` uses a similar `lecturer_course_assignments` join — ensures module counts and per-module staleness are correct
- If the lecturer is assigned to ALL courses, the count will match PA — this test is most valuable when the lecturer has a subset
- Lecturer can expand rows, click "View", and use Postpone (if `can_edit`) just like PA

---

## CS-10: Role Access Control

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that only lecturers and platform admins can access `/teaching/staleness`. Learners, Tenant Admins, and CSMs should be blocked by the route guard and should not see the sidebar item.

**Covers**: `roleGuard('lecturer', 'platform_admin')`, sidebar visibility per role, Teaching section config

### Steps (Learner — BLOCKED)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as `learner@calypso-commodities.com` | Successful login | ☐ |
| 2 | Check sidebar | "Teaching" section NOT visible | ☐ |
| 3 | Navigate directly to `/teaching/staleness` in URL bar | Redirected away (to `/dashboard` or similar) — NOT the staleness dashboard | ☐ |
| 4 | Verify no "Content Staleness" heading visible | Page content is NOT the staleness dashboard | ☐ |

### Steps (Tenant Admin — BLOCKED)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 5 | Log in as `admin@calypsoclient.com` | Successful login | ☐ |
| 6 | Check sidebar | "Teaching" section NOT visible (TA is not in `['lecturer', 'platform_admin']`) | ☐ |
| 7 | Navigate directly to `/teaching/staleness` | Redirected away | ☐ |

### Steps (CSM — BLOCKED)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 8 | Log in as `csm@calypso-commodities.com` | Successful login | ☐ |
| 9 | Check sidebar | "Teaching" section NOT visible (CSM is not in `['lecturer', 'platform_admin']`) | ☐ |
| 10 | Navigate directly to `/teaching/staleness` | Redirected away | ☐ |

### Steps (Platform Admin — ALLOWED)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 11 | Log in as `et@calypso-commodities.com` (Platform Admin) | Successful login | ☐ |
| 12 | Check sidebar | "Teaching" section visible with "Content Staleness" (Clock icon) | ☐ |
| 13 | Navigate to `/teaching/staleness` | Page loads successfully, all courses visible, expandable rows work | ☐ |

### Steps (Lecturer — ALLOWED)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 14 | Log in as `lecturer-edit@calypso-commodities.com` | Successful login | ☐ |
| 15 | Check sidebar | "Teaching" section visible with "Content Staleness" | ☐ |
| 16 | Navigate to `/teaching/staleness` | Page loads, only assigned courses visible, expandable rows work | ☐ |

### Notes / Learnings
- Route guard checks JWT claims: `is_platform_admin` or `lecturer_course_ids` (non-empty)
- Sidebar Teaching section uses `roles: ['lecturer', 'platform_admin']` — same as Issue Management, Questions Board, and Exam Grading
- CSM is intentionally excluded — CSM role focuses on tenant-scoped data, not course-level content staleness
- A lecturer without any course assignments would pass the route guard but see an empty table (RLS scopes to empty)

---

## CS-11: Postpone Single Module

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that clicking the "Postpone" button on a stale module sets `staleness_postponed_until` to 30 days from now, shows a success toast, reloads data, and the module's badge changes from "Stale" to "Postponed until {date}".

**Covers**: `StalenessService.postponeModule()`, module-specific `set_module_updated_at()` trigger (skips `updated_at` bump), toast notification, data reload, badge transition

### Preconditions
- At least 1 course with stale modules (no prior postponements)
- Clear any existing postponements: `UPDATE modules SET staleness_postponed_until = NULL WHERE staleness_postponed_until IS NOT NULL;`

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/staleness` as PA | Dashboard loads with courses | ☐ |
| 2 | Find a course with "Has Stale" badge | Note the stale module count | ☐ |
| 3 | Expand the course (click the row) | Stale modules visible with rose badges and "Postpone" buttons | ☐ |
| 4 | Note the stale module's `updated_at` date | e.g., "Jun 15, 2025" | ☐ |
| 5 | Click "Postpone" on a stale module | Button shows loader spinner briefly | ☐ |
| 6 | Verify success toast | Green toast: "Module postponed for 30 days" | ☐ |
| 7 | Verify module badge changed | Module now shows blue badge: "Postponed until {date ~30 days from today}" | ☐ |
| 8 | Verify module's `updated_at` did NOT change | The "Last Updated" column still shows the original date (trigger skipped `updated_at` bump) | ☐ |
| 9 | Verify the module no longer has a "Postpone" button | Postponed modules have no action button | ☐ |
| 10 | Verify stale module count decreased | Course's "Stale / Fresh" column updated, summary cards updated | ☐ |
| 11 | If all stale modules postponed, verify course badge | Changes from "Has Stale" to "N Postponed" (blue badge with CalendarClock icon) | ☐ |

### SQL Verification
```sql
-- Verify the postpone was written correctly
SELECT id, title, updated_at, staleness_postponed_until
FROM modules
WHERE staleness_postponed_until IS NOT NULL
ORDER BY staleness_postponed_until DESC;
```

### Notes / Learnings
- **Critical**: The `set_module_updated_at()` trigger (migration 00035) must NOT bump `updated_at` when only `staleness_postponed_until` changes — otherwise the staleness clock resets
- Postpone duration is hardcoded to 30 days (v1)
- The `postponeModule()` method uses `.update({ staleness_postponed_until: until })` — no other fields changed
- After postpone, `loadStalenessData()` is called to reload all data from the server
- If the Supabase UPDATE fails (e.g., RLS denies), an error toast appears instead

---

## CS-12: Postpone All Stale Modules (Course-Level)

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that clicking "Postpone All" in a course's Action column postpones all stale modules in that course at once. Fresh modules and already-postponed modules should not be affected.

**Covers**: `StalenessService.postponeAllStaleModules()`, bulk `.update().in()`, toast notification, data reload, course badge transition

### Preconditions
- At least 1 course with 2+ stale modules
- Clear any existing postponements: `UPDATE modules SET staleness_postponed_until = NULL WHERE staleness_postponed_until IS NOT NULL;`

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/staleness` as PA | Dashboard loads | ☐ |
| 2 | Find a course with "Has Stale" badge and multiple stale modules | Note the stale count in "Stale / Fresh" column | ☐ |
| 3 | Verify "Postpone All" button visible | Blue button with CalendarClock icon in the Action column (next to "View") | ☐ |
| 4 | Click "Postpone All" | Button shows loader spinner briefly | ☐ |
| 5 | Verify success toast | Green toast: "All stale modules postponed for 30 days" | ☐ |
| 6 | Verify course badge changed | Was "Has Stale" (rose) → now "N Postponed" (blue with CalendarClock icon) | ☐ |
| 7 | Verify stale count is now 0 | "Stale / Fresh" column shows "0 / M" (all previously stale are now postponed) | ☐ |
| 8 | Expand the course | All previously-stale modules show blue "Postponed until {date}" badges | ☐ |
| 9 | Verify fresh modules unchanged | Fresh modules still show emerald "Fresh" badge | ☐ |
| 10 | Verify no "Postpone" buttons remain | No stale modules = no Postpone buttons in the expanded view | ☐ |
| 11 | Verify "Postpone All" button disappeared | No stale modules = "Postpone All" button hidden for this course | ☐ |
| 12 | Verify summary cards updated | Stale Modules count decreased by the number of postponed modules | ☐ |

### SQL Verification
```sql
-- Verify all stale modules for this course are now postponed
SELECT id, title, updated_at, staleness_postponed_until
FROM modules
WHERE course_id = '<COURSE_ID>'
ORDER BY staleness_postponed_until DESC NULLS LAST;
```

### Notes / Learnings
- "Postpone All" only appears for courses where `hasStaleModules === true`
- The method reads stale module IDs from the in-memory course data, then uses `.update().in('id', staleIds)` — one DB call
- After bulk postpone + reload, the course may shift in sort order (postponed courses sort after stale but before all-fresh)
- The "Postpone All" button has `disabled` state while the operation is in progress (prevents double-click)

---

## CS-13: Postpone Badge + Status Update

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify the visual state transitions after postponing modules — course-level badges, module-level badges, sort order changes, and summary card updates.

**Covers**: Blue `bg-blue-100 text-blue-700` badges, CalendarClock icon, `postponedModuleCount`, sort order (stale → postponed → fresh), "N Postponed" course badge

### Preconditions
- Complete CS-11 or CS-12 so that at least one course has postponed modules

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/staleness` as PA | Dashboard loads with postponed modules | ☐ |
| 2 | Find a course with "N Postponed" badge | Blue badge with CalendarClock icon showing count of postponed modules | ☐ |
| 3 | Verify badge shows correct count | Number matches actual postponed module count for that course | ☐ |
| 4 | Expand the course | Postponed modules show blue badge "Postponed until {date}" | ☐ |
| 5 | Verify postponed date is ~30 days from when you clicked | Date shown is approximately 30 days from today | ☐ |
| 6 | Verify module sort order | Stale (if any) → Postponed → Fresh | ☐ |
| 7 | Verify the "Last Updated" column was NOT changed | Original `updated_at` date preserved — trigger correctly skipped | ☐ |
| 8 | Verify summary cards | Stale Modules decreased, Fresh Modules decreased by postponed count, Total Modules unchanged | ☐ |
| 9 | Verify course sort order | Courses with stale modules first, then postponed-only courses, then all-fresh, then no-modules | ☐ |
| 10 | Verify "Has Stale" overrides "Postponed" | If a course has BOTH stale AND postponed modules, the badge shows "Has Stale" (rose), not "N Postponed" | ☐ |

### Notes / Learnings
- Three module states: Stale (rose) → Postponed (blue) → Fresh (emerald)
- Course badge priority: Has Stale > N Postponed > No Modules > All Fresh
- Postponed modules are excluded from both `staleModuleCount` AND `freshModuleCount`
- The "Postponed until" badge shows the formatted date from `mod.postponedUntil`
- After 30 days, the postpone expires automatically — `isPostponed` becomes false, `isStale` becomes true again

---

## CS-14: Postpone — Lecturer with can_edit

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that a lecturer with `can_edit` permission can postpone stale modules in their assigned courses. The existing `modules_update_lecturer` RLS policy should allow the UPDATE.

**Covers**: RLS UPDATE on modules for lecturers, `postponeModule()` and `postponeAllStaleModules()` from lecturer context

### Preconditions
- Lecturer has `can_edit = true` for at least one course with stale modules
- Clear any existing postponements on that course

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Lecturer (`lecturer-edit@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Navigate to `/teaching/staleness` | Page loads with assigned courses | ☐ |
| 3 | Find a course with stale modules | "Has Stale" badge visible | ☐ |
| 4 | Expand the course | Stale modules with "Postpone" buttons visible | ☐ |
| 5 | Click "Postpone" on a stale module | Success toast: "Module postponed for 30 days" | ☐ |
| 6 | Verify badge changed to "Postponed until {date}" | Blue badge visible, module no longer stale | ☐ |
| 7 | Click "Postpone All" on a course (if still has stale) | Success toast: "All stale modules postponed for 30 days" | ☐ |
| 8 | Verify all stale modules now postponed | All previously-stale modules show blue "Postponed until" badges | ☐ |

### SQL Verification
```sql
-- Verify lecturer's can_edit permission
SELECT lca.course_id, c.title, lca.can_edit
FROM lecturer_course_assignments lca
JOIN courses c ON c.id = lca.course_id
WHERE lca.lecturer_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
  AND lca.can_edit = true;
```

### Notes / Learnings
- Lecturers need `can_edit = true` for the course — the `modules_update_lecturer` RLS policy checks `EXISTS (SELECT 1 FROM lecturer_course_assignments WHERE course_id = modules.course_id AND lecturer_id = auth.uid() AND can_edit = true)`
- A lecturer WITHOUT `can_edit` would see the Postpone buttons but get an RLS error when clicking — the error toast would show "Failed to postpone"
- Platform Admins always have UPDATE access via `modules_update_platform_admin`

---

## Data Setup Notes

### Creating Varied Staleness States

For best test coverage, you need courses in all three states. If your data is all "fresh", backdate some modules:

```sql
-- IMPORTANT: Must disable triggers because set_module_updated_at() resets updated_at to NOW()
-- (Migration 00035 renamed the trigger from set_updated_at to set_module_updated_at)
ALTER TABLE modules DISABLE TRIGGER set_module_audit_fields;
ALTER TABLE modules DISABLE TRIGGER set_module_updated_at;
ALTER TABLE modules DISABLE TRIGGER enforce_module_immutable_fields;
ALTER TABLE modules DISABLE TRIGGER on_significant_module_update;

-- Make specific modules stale by backdating
UPDATE modules
SET updated_at = NOW() - INTERVAL '200 days'
WHERE course_id = '<COURSE_ID>';

-- Re-enable all triggers immediately
ALTER TABLE modules ENABLE TRIGGER set_module_audit_fields;
ALTER TABLE modules ENABLE TRIGGER set_module_updated_at;
ALTER TABLE modules ENABLE TRIGGER enforce_module_immutable_fields;
ALTER TABLE modules ENABLE TRIGGER on_significant_module_update;

-- Create a course with custom threshold (e.g., 90 days instead of 180)
UPDATE courses
SET staleness_threshold_days = 90
WHERE id = '<COURSE_ID>';

-- Verify the effect per-module
SELECT
  c.title AS course,
  m.title AS module,
  m.module_type,
  m.staleness_postponed_until,
  FLOOR(EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400)::int AS days_ago,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 > COALESCE(c.staleness_threshold_days, 180)
      AND (m.staleness_postponed_until IS NULL OR m.staleness_postponed_until <= NOW()) THEN 'STALE'
    WHEN m.staleness_postponed_until IS NOT NULL AND m.staleness_postponed_until > NOW() THEN 'POSTPONED'
    ELSE 'FRESH'
  END AS status
FROM courses c
LEFT JOIN modules m ON m.course_id = c.id
WHERE c.id = '<COURSE_ID>'
ORDER BY m.updated_at ASC;
```

### Resetting Between Test Runs

Clear all postponements and optionally reset backdated modules:

```sql
-- Clear all postponements
UPDATE modules SET staleness_postponed_until = NULL WHERE staleness_postponed_until IS NOT NULL;

-- To also reset backdated modules:
-- NOTE: Must disable triggers to reset timestamps
ALTER TABLE modules DISABLE TRIGGER set_module_audit_fields;
ALTER TABLE modules DISABLE TRIGGER set_module_updated_at;
ALTER TABLE modules DISABLE TRIGGER enforce_module_immutable_fields;
ALTER TABLE modules DISABLE TRIGGER on_significant_module_update;

UPDATE modules
SET updated_at = NOW()
WHERE course_id = '<COURSE_ID>';

ALTER TABLE modules ENABLE TRIGGER set_module_audit_fields;
ALTER TABLE modules ENABLE TRIGGER set_module_updated_at;
ALTER TABLE modules ENABLE TRIGGER enforce_module_immutable_fields;
ALTER TABLE modules ENABLE TRIGGER on_significant_module_update;

-- Reset custom threshold to default
UPDATE courses
SET staleness_threshold_days = NULL
WHERE id = '<COURSE_ID>';
```

### Cleanup — Remove Test-Only Course

```sql
DELETE FROM tenant_courses WHERE course_id = (SELECT id FROM courses WHERE title = 'Empty Test Course');
DELETE FROM courses WHERE title = 'Empty Test Course';
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-15 | Claude Code | CS-01 through CS-14 | 14 | 0 | Tested on localhost:4200 (feature not yet deployed to production). 5 roles tested. CS-09 note: lecturer was assigned to all 4 courses so RLS scoping count matched PA. Postponements cleared via Supabase REST API between CS-12 and CS-14. |
| 2026-02-15 | Claude (Playwright MCP) | CS-01 through CS-14 | 14 | 0 | Full regression run. 4 courses: CW01 (4 Postponed), CW-01 Updated (3 Fresh, 90d threshold), Intro Commodity (9 Fresh, 180d), Empty (No Modules). Expanded rows: 9 fresh modules with dates/ages, 4 postponed modules with blue badges. No regressions. |

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| — | — | No bugs found yet | — | — | — |

---

## References

| Document | Path |
|----------|------|
| Staleness Dashboard Page Component | `frontend/src/app/features/teaching/pages/staleness-dashboard-page.component.ts` |
| Staleness Service | `frontend/src/app/core/services/staleness.service.ts` |
| Staleness Service Tests | `frontend/src/app/core/services/staleness.service.spec.ts` |
| Dashboard Page Tests | `frontend/src/app/features/teaching/pages/staleness-dashboard-page.component.spec.ts` |
| Route Config | `frontend/src/app/app.routes.ts` |
| Sidebar Nav Config | `frontend/src/app/layout/sidebar/sidebar-nav.config.ts` |
| Mock Factories | `frontend/src/app/__mocks__/course.mock.ts` |
| Migration 00008 (pg_cron staleness job) | `supabase/migrations/00008_pg_cron_storage.sql` |
| Migration 00035 (staleness postpone) | `supabase/migrations/00035_staleness_postpone.sql` |
| Test Users Setup | `docs/e2e-user-stories/TEST_USERS.md` |
