> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Teaching Overview E2E User Stories (Phase 11A)

## Overview

E2E testing scenarios for the Teaching Overview page at `/teaching/courses` (Phase 11A). These stories verify a **per-course aggregate dashboard** that gives lecturers and platform admins an at-a-glance view of pending action items across 4 teaching domains: exams, questions, issues, and content staleness. Users can expand course rows to see quick-action links that deep-link to the corresponding board pages with course pre-filtering.

**Key components:**
- `TeachingOverviewPageComponent` — page with filters, summary cards, expandable data table, quick-action links
- `TeachingOverviewService` — 6 parallel lightweight Supabase queries (courses, enrollments, pending exams, pending questions, open issues, modules) + client-side `Map<courseId, count>` aggregation + staleness computation
- `TeachingCourseOverview` model — `id`, `title`, `canEdit`, `canGrade`, `enrolledCount`, `pendingExams`, `pendingQuestions`, `openIssues`, `staleModules`, `totalModules`, `totalActionItems`

**6-query aggregation (all via Supabase, no FastAPI):**
- `courses` — course list with `staleness_threshold_days`
- `course_enrollments` — enrolled learner count per course
- `exam_submissions` — pending exam count per course (`score IS NULL`)
- `expert_questions` — pending question count per course (`status = 'pending'`)
- `issues` — open issue count per course (`status IN ('open', 'investigating')`)
- `modules` — total + stale module count per course (staleness computed client-side)

**Expandable row quick actions (with deep-link query params):**
- "N pending exams" → `/teaching/grading?courseId={id}` (only if canGrade)
- "N unanswered questions" → `/teaching/questions?courseId={id}`
- "N open issues" → `/teaching/issues?courseId={id}`
- "N stale modules" → `/teaching/staleness` (only if canEdit)
- "View learner progress" → `/analytics/progress`
- "Edit course" → `/courses/{id}/edit` (only if canEdit)

**RLS scoping:**
- **Platform Admin**: sees ALL courses (unconditional SELECT)
- **Lecturer**: sees only assigned courses (via `lecturer_course_assignments` RLS join)
- Permission badges reflect JWT claims: `lecturer_can_edit_course_ids` → "Edit", `lecturer_can_grade_course_ids` → "Grade", neither → "Read"

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
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | TO-01 through TO-08, TO-10 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit + can_grade)** | Calypso (master) | TO-06, TO-09, TO-10 |
| 3 | `lecturer-view@calypso-commodities.com` | **Lecturer (read-only)** | Calypso (master) | TO-06, TO-10 |
| 4 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | TO-10 |
| 5 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | TO-10 |
| 6 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | TO-10 |

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
| 1 | TO-01 | PA Navigation + Page Load | PA logged in, at least 1 course with modules |
| 2 | TO-02 | Per-Course Count Accuracy | TO-01 (page loads with data) |
| 3 | TO-03 | Summary Cards | TO-01 (courses with varied action items) |
| 4 | TO-04 | Search Filter | TO-01 (multiple courses visible) |
| 5 | TO-05 | Status Filter (Needs Attention / All Clear) | TO-01 (courses in both states) |
| 6 | TO-06 | Permission Badges | TO-01 (courses with different permissions) |
| 7 | TO-07 | Expand Course Row — Quick Actions | TO-01 (at least 1 course with action items) |
| 8 | TO-08 | Deep-Link to Board Pages with Course Pre-Filtering | TO-07 (expanded row links work) |
| 9 | TO-09 | Lecturer Scoped View | Lecturer logged in, assigned to at least 1 course |
| 10 | TO-10 | Role Access Control | Multiple role logins |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| TO-01 | PA Navigation + Page Load | Platform Admin | ✅ | 2026-02-15 |
| TO-02 | Per-Course Count Accuracy | Platform Admin | ✅ | 2026-02-15 |
| TO-03 | Summary Cards | Platform Admin | ✅ | 2026-02-15 |
| TO-04 | Search Filter | Platform Admin | ✅ | 2026-02-15 |
| TO-05 | Status Filter (Needs Attention / All Clear) | Platform Admin | ✅ | 2026-02-15 |
| TO-06 | Permission Badges | Platform Admin | ✅ | 2026-02-15 |
| TO-07 | Expand Course Row — Quick Actions | Platform Admin | ✅ | 2026-02-15 |
| TO-08 | Deep-Link to Board Pages with Course Pre-Filtering | Platform Admin | ✅ | 2026-02-15 |
| TO-09 | Lecturer Scoped View | Lecturer | ✅ | 2026-02-15 |
| TO-10 | Role Access Control | Multiple | ✅ | 2026-02-15 |

---

## Preconditions (All Stories)

- At least 2 courses visible to the PA with different action item profiles
- At least 1 course with pending exams (`exam_submissions` where `score IS NULL`)
- At least 1 course with pending questions (`expert_questions` where `status = 'pending'`)
- At least 1 course with open issues (`issues` where `status IN ('open', 'investigating')`)
- At least 1 course with stale modules (modules not updated for > `staleness_threshold_days`)
- Ideally 1 course with zero action items (all clear)
- Lecturer assigned to at least 1 but NOT all courses

**Verify current teaching overview data:**

```sql
-- Per-course action item counts (mirrors TeachingOverviewService aggregation)
SELECT
  c.id,
  c.title,
  COALESCE(c.staleness_threshold_days, 180) AS threshold,
  (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) AS enrolled_count,
  (SELECT COUNT(*) FROM exam_submissions es WHERE es.course_id = c.id AND es.score IS NULL) AS pending_exams,
  (SELECT COUNT(*) FROM expert_questions eq WHERE eq.course_id = c.id AND eq.status = 'pending') AS pending_questions,
  (SELECT COUNT(*) FROM issues i WHERE i.course_id = c.id AND i.status IN ('open', 'investigating')) AS open_issues,
  (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS total_modules,
  (SELECT COUNT(*) FROM modules m
   WHERE m.course_id = c.id
     AND EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 > COALESCE(c.staleness_threshold_days, 180)
     AND (m.staleness_postponed_until IS NULL OR m.staleness_postponed_until <= NOW())
  ) AS stale_modules
FROM courses c
ORDER BY c.title;
```

**Verify lecturer assignments:**

```sql
SELECT lca.course_id, c.title, lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN courses c ON c.id = lca.course_id
WHERE lca.lecturer_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com');

SELECT lca.course_id, c.title, lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN courses c ON c.id = lca.course_id
WHERE lca.lecturer_id = (SELECT id FROM profiles WHERE email = 'lecturer-view@calypso-commodities.com');
```

---

## TO-01: PA Navigation + Page Load

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that the Platform Admin can find and navigate to the Teaching Overview page via the sidebar Teaching section, and that the page renders the full structure: header with course count badge, filter bar, 4 summary cards, and data table with correct columns.

**Covers**: Sidebar config (`Teaching` section, item renamed to "Teaching Overview"), route `teaching/courses` with `roleGuard('lecturer', 'platform_admin')`, `TeachingOverviewService.loadOverview()`, page rendering

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Look at sidebar Teaching section | "Teaching Overview" item visible with GraduationCap icon (NOT "My Courses") | ☐ |
| 3 | Click "Teaching Overview" in sidebar | Navigates to `/teaching/courses` | ☐ |
| 4 | Verify page header | "Teaching Overview" heading with GraduationCap icon and teal badge showing course count | ☐ |
| 5 | Verify teal badge shows total count | Number in badge matches total courses visible in table (unfiltered) | ☐ |
| 6 | Verify filter bar | Search input ("Search by course title...") + Status dropdown ("All Courses" / "Needs Attention" / "All Clear") visible | ☐ |
| 7 | Verify summary cards row | 4 cards: "Pending Exams" (amber-600), "Open Questions" (amber-600), "Open Issues" (amber-600), "Stale Modules" (rose-600) | ☐ |
| 8 | Verify table headers | 8 columns: (chevron), Course, Permissions, Learners, Exams, Questions, Issues, Staleness | ☐ |
| 9 | Verify at least one data row | Row with chevron icon, course title, permission badges, enrolled count, action item counts, staleness badge | ☐ |
| 10 | Verify PA sees ALL courses | Total count matches the number of courses in the system (PA has no RLS restriction on courses) | ☐ |

### SQL Verification
```sql
SELECT COUNT(*) FROM courses;
```

### Notes / Learnings
- PA's RLS on `courses` is unconditional SELECT — sees all courses
- The teal badge in the header shows `service.courses().length` (total unfiltered count)
- Summary cards show sums across `filteredCourses()` — they update when filters change
- Courses are sorted by `totalActionItems` descending, then alphabetically
- Sidebar item was renamed from "My Courses" to "Teaching Overview" to differentiate from the general `/courses` page

---

## TO-02: Per-Course Count Accuracy

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that the per-course counts displayed in the table (enrolled learners, pending exams, pending questions, open issues, stale modules) are accurate by cross-referencing with actual database values. This is the most important test — if counts are wrong, the entire dashboard is misleading.

**Covers**: `TeachingOverviewService.loadOverview()` — 6 parallel queries, `Map<courseId, count>` aggregation, client-side staleness computation, `totalActionItems` sort

### Preconditions
- At least 1 course with a mix of pending action items (exams, questions, issues, stale modules)
- At least 1 course with zero action items

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Run the per-course SQL verification query (from Preconditions section) | Get expected counts per course | ☐ |
| 2 | Navigate to `/teaching/courses` as PA | Dashboard loads with all courses | ☐ |
| 3 | Pick a course with pending exams | Exams column shows the count matching `pending_exams` from SQL | ☐ |
| 4 | Verify enrolled learner count | Learners column shows `enrolled_count` matching SQL (tabular-nums) | ☐ |
| 5 | Verify pending questions count | Questions column shows count matching `pending_questions` from SQL | ☐ |
| 6 | Verify open issues count | Issues column shows count matching `open_issues` from SQL | ☐ |
| 7 | Verify staleness badge | If `stale_modules > 0`: warning badge "N stale" (with AlertTriangle icon). If `total_modules > 0 && stale_modules == 0`: success badge "All fresh" (with CheckCircle2 icon). If `total_modules == 0`: neutral badge "No modules" | ☐ |
| 8 | Verify counts > 0 are highlighted | Non-zero counts appear in `text-amber-600 font-semibold`; zero counts in plain `text-slate-600` | ☐ |
| 9 | Find a course where canGrade is false (if any) | Exams column shows em-dash "—" instead of a count | ☐ |
| 10 | Verify sort order | Courses with highest `totalActionItems` appear first; within same count, alphabetical | ☐ |
| 11 | Pick a course with zero action items | All counts are 0 or "—", staleness shows "All fresh" or "No modules" | ☐ |

### SQL Verification
```sql
-- Detailed per-course counts
SELECT
  c.id,
  c.title,
  (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) AS enrolled_count,
  (SELECT COUNT(*) FROM exam_submissions es WHERE es.course_id = c.id AND es.score IS NULL) AS pending_exams,
  (SELECT COUNT(*) FROM expert_questions eq WHERE eq.course_id = c.id AND eq.status = 'pending') AS pending_questions,
  (SELECT COUNT(*) FROM issues i WHERE i.course_id = c.id AND i.status IN ('open', 'investigating')) AS open_issues,
  (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS total_modules,
  (SELECT COUNT(*) FROM modules m
   WHERE m.course_id = c.id
     AND EXTRACT(EPOCH FROM (NOW() - m.updated_at)) / 86400 > COALESCE(c.staleness_threshold_days, 180)
     AND (m.staleness_postponed_until IS NULL OR m.staleness_postponed_until <= NOW())
  ) AS stale_modules
FROM courses c
ORDER BY c.title;
```

### Notes / Learnings
- `totalActionItems = pendingExams + pendingQuestions + openIssues + staleModules` — stale modules count toward action items
- For PA, `canGrade` is always true (PA has full grading access via unconditional RLS)
- For lecturers, `canGrade` depends on `lecturer_can_grade_course_ids` JWT claim
- Staleness computation reuses the same date arithmetic as `StalenessService`: `daysSinceUpdate > threshold && !isPostponed`
- Day calculation may differ by ±1 day depending on timezone — this is expected

---

## TO-03: Summary Cards

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that the 4 summary cards display correct aggregate counts (summed across all filtered courses) and update reactively when filters are applied.

**Covers**: `totalPendingExams`, `totalPendingQuestions`, `totalOpenIssues`, `totalStaleModules` computed signals (reduce over `filteredCourses`), filter reactivity

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/courses` as PA | Dashboard loads with all courses | ☐ |
| 2 | Verify "Pending Exams" card | Sum of `pendingExams` across all courses (amber-600 color) | ☐ |
| 3 | Verify "Open Questions" card | Sum of `pendingQuestions` across all courses (amber-600 color) | ☐ |
| 4 | Verify "Open Issues" card | Sum of `openIssues` across all courses (amber-600 color) | ☐ |
| 5 | Verify "Stale Modules" card | Sum of `staleModules` across all courses (rose-600 color) | ☐ |
| 6 | Select "Needs Attention" from status dropdown | Cards update: all counts now sum only across courses with `totalActionItems > 0` | ☐ |
| 7 | Clear filter, type a search term matching 1 course | All 4 cards update to reflect just the 1 filtered course's counts | ☐ |
| 8 | Clear filter | All cards return to original (unfiltered) values | ☐ |

### Notes / Learnings
- All cards derive from `filteredCourses()` — applying any filter recalculates all 4 cards
- Each card uses `.reduce()` to sum the relevant count across `filteredCourses()`
- Cards show counts from `filteredCourses()`, while the teal header badge shows `service.courses().length` (unfiltered)
- Numbers use `tabular-nums` CSS class for consistent digit width

---

## TO-04: Search Filter

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
| 1 | Navigate to `/teaching/courses` as PA | Full course list visible, no "Clear filters" link | ☐ |
| 2 | Note the total course count from header badge | e.g., badge shows "4" | ☐ |
| 3 | Type a partial course title in the search input (e.g., "LNG") | Table filters to rows where title contains "LNG" (case-insensitive) | ☐ |
| 4 | Verify non-matching courses are hidden | Only matching courses visible; summary cards update | ☐ |
| 5 | Verify "Clear filters" link appears | Underlined text link visible next to the status dropdown | ☐ |
| 6 | Verify case insensitivity | Typing "lng" (lowercase) matches "LNG Fundamentals" | ☐ |
| 7 | Clear the search input manually (backspace) | Full course list restored | ☐ |
| 8 | Type a non-matching query (e.g., "xyzzzz") | Empty state: "No courses found." with GraduationCap icon | ☐ |
| 9 | Click "Clear filters" | Search cleared, full list restored | ☐ |

### Notes / Learnings
- Search only matches course `title` (NOT description, module names, or other fields)
- Search is case-insensitive via `.toLowerCase().includes()`
- Placeholder text: "Search by course title..."
- Search input has a magnifying glass (Search) icon on the left side
- "Clear filters" appears when `searchTerm() || statusFilter() !== 'all'`

---

## TO-05: Status Filter (Needs Attention / All Clear)

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify the status dropdown correctly filters courses into two action-oriented categories based on aggregate action item counts, and that combined search + status filtering works.

**Covers**: `statusFilter` signal, `filteredCourses` computed (status branches), filter combination (AND logic)

### Preconditions
- At least 1 course with `totalActionItems > 0` (needs attention)
- At least 1 course with `totalActionItems === 0` (all clear)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/courses` as PA | All courses visible, dropdown shows "All Courses" | ☐ |
| 2 | Select "Needs Attention" from status dropdown | Only courses with `totalActionItems > 0` visible (at least one non-zero count in exams/questions/issues/stale) | ☐ |
| 3 | Verify summary cards update | All counts now reflect only the "needs attention" courses | ☐ |
| 4 | Verify hidden courses are gone | Courses with all zeros are not in the table | ☐ |
| 5 | Select "All Clear" from status dropdown | Only courses with `totalActionItems === 0` visible — all counts are 0 | ☐ |
| 6 | Verify visible courses have zero action items | Every visible course has: pending exams = 0 (or "—"), questions = 0, issues = 0, staleness shows "All fresh" or "No modules" | ☐ |
| 7 | Select "All Courses" | Full list restored | ☐ |
| 8 | **Combined filter**: Select "Needs Attention" + type a search term | Both filters apply with AND logic — only needs-attention courses matching the search term | ☐ |
| 9 | Click "Clear filters" | Search cleared, status reset to "All Courses", full list restored | ☐ |

### Notes / Learnings
- `totalActionItems = pendingExams + pendingQuestions + openIssues + staleModules`
- For PA, `pendingExams` is always counted (canGrade is true for all courses)
- For lecturers, `pendingExams` is only counted for courses where they have grade permission
- "Needs Attention" means `totalActionItems > 0` — even 1 stale module qualifies
- "All Clear" means `totalActionItems === 0` — all domains are clean
- The dropdown values: `all`, `needs_attention`, `all_clear`
- Multiple filters combine with AND logic

---

## TO-06: Permission Badges

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that permission badges (Edit, Grade, Read) in the Permissions column correctly reflect the user's JWT claims for each course. This is critical for lecturers who need to understand their access level per course.

**Covers**: `canEdit`/`canGrade` from `AuthService.claims()`, badge rendering (badge-primary, badge-info, badge-neutral), per-course permission checks

### Preconditions
- Lecturer with `can_edit = true` AND `can_grade = true` on at least 1 course
- Ideally a read-only lecturer (can_edit = false, can_grade = false) for contrast

### Steps (Platform Admin)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as PA (`et@calypso-commodities.com`) | Teaching Overview loads | ☐ |
| 2 | Check Permissions column for all courses | PA sees "Edit" (teal) + "Grade" (blue) badges on every course — PA has full access | ☐ |

### Steps (Lecturer with can_edit + can_grade)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 3 | Log in as `lecturer-edit@calypso-commodities.com` | Teaching Overview loads with assigned courses | ☐ |
| 4 | Find an assigned course with `can_edit = true` | Permissions column shows "Edit" (teal badge-primary) | ☐ |
| 5 | Find an assigned course with `can_grade = true` | Permissions column shows "Grade" (blue badge-info) | ☐ |
| 6 | If course has both | Both "Edit" and "Grade" badges visible side by side | ☐ |

### Steps (Lecturer with read-only)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 7 | Log in as `lecturer-view@calypso-commodities.com` | Teaching Overview loads with assigned courses | ☐ |
| 8 | Check Permissions column | Shows "Read" (slate badge-neutral) — no "Edit" or "Grade" badge | ☐ |
| 9 | Verify Exams column shows "—" | Read-only lecturer has no grading access, so exams column shows em-dash | ☐ |

### SQL Verification
```sql
-- Check lecturer permissions per course
SELECT p.email, lca.course_id, c.title, lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN profiles p ON p.id = lca.lecturer_id
JOIN courses c ON c.id = lca.course_id
WHERE p.email IN ('lecturer-edit@calypso-commodities.com', 'lecturer-view@calypso-commodities.com');
```

### Notes / Learnings
- Badge types: `badge-primary` (Edit = teal), `badge-info` (Grade = blue), `badge-neutral` (Read = slate)
- Permission badges are cosmetic — RLS enforces actual access
- PA always sees Edit + Grade for all courses (unconditional RLS)
- The "—" (em-dash) in Exams column appears when `!canGrade` — those pending exams don't count toward `totalActionItems` either
- `canEdit` comes from `AuthService.claims().lecturer_can_edit_course_ids`
- `canGrade` comes from `AuthService.claims().lecturer_can_grade_course_ids`

---

## TO-07: Expand Course Row — Quick Actions

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that clicking a course row expands it to show a detail panel with quick-action links. The expanded row shows course info on the left and contextual navigation links on the right. Only one course can be expanded at a time.

**Covers**: `expandedCourseId` signal, `toggleCourse()` method, expanded row rendering, RouterLink generation, chevron direction toggle

### Preconditions
- At least 1 course with action items across multiple domains (exams + questions + issues)
- At least 2 courses visible for testing single-expansion behavior

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/courses` as PA | Courses visible, all rows show right-pointing chevron (ChevronRight) | ☐ |
| 2 | Click a course row that has pending items | Row expands: chevron changes to down (ChevronDown), detail panel appears below the row | ☐ |
| 3 | Verify left column of expanded row | Course title (text-lg font-semibold), enrolled learner count with Users icon, permission explanation text | ☐ |
| 4 | Verify right column heading | "Quick Actions" section label (uppercase, slate-500) | ☐ |
| 5 | Verify "pending exams" link (if canGrade) | Shows "N pending exams" with ClipboardCheck icon, or "Exam grading" if 0 pending | ☐ |
| 6 | Verify "unanswered questions" link | Shows "N unanswered questions" with MessageSquare icon, or "Questions board" if 0 pending | ☐ |
| 7 | Verify "open issues" link | Shows "N open issues" with Flag icon, or "Issue management" if 0 open | ☐ |
| 8 | Verify "stale modules" link (if canEdit) | Shows "N stale modules" with Clock icon, or "Content staleness" if 0 stale | ☐ |
| 9 | Verify "View learner progress" link | Always present with BarChart3 icon | ☐ |
| 10 | Verify "Edit course" link (if canEdit) | Present with Pencil icon, links to `/courses/{id}/edit` | ☐ |
| 11 | Click the same course row again | Row collapses: chevron returns to right, detail panel hidden | ☐ |
| 12 | Click Course A to expand, then click Course B | Course A collapses AND Course B expands — only one expanded at a time | ☐ |

### Notes / Learnings
- Only one course can be expanded at a time (single `expandedCourseId` signal)
- The expanded course row gets `bg-slate-50` background highlight
- Chevron direction: ChevronRight (collapsed) → ChevronDown (expanded)
- Links use teal color (`text-teal-600 hover:text-teal-700`) with transition
- Link text is contextual: shows count when > 0, generic label when 0
- Plural handling: "1 pending exam" vs "2 pending exams"
- "Exam grading" link only appears if `canGrade`; "Stale modules" and "Edit course" only if `canEdit`
- Detail panel uses `<td colspan="8">` to span the full table width

---

## TO-08: Deep-Link to Board Pages with Course Pre-Filtering

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that clicking action links in the expanded row navigates to the corresponding board page AND pre-selects the course in the course filter dropdown. This is the critical UX improvement — without pre-filtering, users land on unfiltered board pages and must manually find the course.

**Covers**: `[queryParams]="{ courseId: course.id }"` on RouterLinks, `ActivatedRoute.snapshot.queryParamMap.get('courseId')` in board pages, `selectedCourseId.set()` initialization

### Preconditions
- At least 1 course with: pending questions AND open issues AND pending exams (ideally all three)
- The course must have actual data in the board pages (not empty after filtering)

### Steps (Questions Board)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Navigate to `/teaching/courses` as PA | Dashboard loads | ☐ |
| 2 | Expand a course with pending questions | "N unanswered questions" link visible | ☐ |
| 3 | Click "N unanswered questions" link | Navigates to `/teaching/questions?courseId={uuid}` | ☐ |
| 4 | Verify Questions Board page loads | "Questions Board" heading visible | ☐ |
| 5 | Verify course dropdown is pre-selected | The course filter dropdown shows the course name (NOT "All Courses") | ☐ |
| 6 | Verify table is filtered | Only questions for the selected course are visible | ☐ |
| 7 | Clear the course filter | All questions across all courses appear | ☐ |

### Steps (Issue Management)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 8 | Navigate back to `/teaching/courses` | Dashboard reloads | ☐ |
| 9 | Expand a course with open issues | "N open issues" link visible | ☐ |
| 10 | Click "N open issues" link | Navigates to `/teaching/issues?courseId={uuid}` | ☐ |
| 11 | Verify Issue Management page loads | "Issue Management" heading visible | ☐ |
| 12 | Verify course dropdown is pre-selected | The course filter dropdown shows the course name (NOT "All Courses") | ☐ |
| 13 | Verify table is filtered | Only issues for the selected course are visible | ☐ |

### Steps (Exam Grading)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 14 | Navigate back to `/teaching/courses` | Dashboard reloads | ☐ |
| 15 | Expand a course with pending exams (must have canGrade) | "N pending exams" link visible | ☐ |
| 16 | Click "N pending exams" link | Navigates to `/teaching/grading?courseId={uuid}` | ☐ |
| 17 | Verify Exam Grading page loads | "Exam Grading" heading visible | ☐ |
| 18 | Verify course dropdown is pre-selected | The course filter dropdown shows the course name (NOT "All Courses") | ☐ |
| 19 | Verify table is filtered | Only submissions for the selected course are visible | ☐ |

### Notes / Learnings
- The `courseId` query param is a UUID string passed via Angular `[queryParams]`
- Each board page reads `this.#route.snapshot.queryParamMap.get('courseId')` in `ngOnInit()` and sets `selectedCourseId` signal
- The staleness dashboard (`/teaching/staleness`) does NOT receive a courseId param — it doesn't have a course filter dropdown (courses ARE the rows)
- If `courseId` doesn't match any of the user's courses (stale data, different role), the filter simply shows no results — no error
- URL format: `/teaching/questions?courseId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- This deep-linking pattern was added in Phase 11A alongside the Teaching Overview page

---

## TO-09: Lecturer Scoped View

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that RLS correctly scopes the Teaching Overview for lecturers — they should only see courses they're assigned to via `lecturer_course_assignments`, not all courses. Counts for visible courses should be complete and accurate.

**Covers**: RLS policies on `courses` (`courses_select_lecturer`), RLS on `course_enrollments`, `exam_submissions`, `expert_questions`, `issues`, `modules` (all lecturer-scoped), per-course count accuracy

### Preconditions
- Lecturer is assigned to at least 1 course but NOT all courses in the system
- PA has already verified the full course count in TO-01

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Lecturer (`lecturer-edit@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Verify sidebar | "Teaching" section visible with "Teaching Overview" item (GraduationCap icon) | ☐ |
| 3 | Click "Teaching Overview" | Navigates to `/teaching/courses` | ☐ |
| 4 | Verify page loads with data | "Teaching Overview" header visible, table has rows | ☐ |
| 5 | Note the header badge count | e.g., badge shows "2" (lecturer's assigned courses only) | ☐ |
| 6 | Verify count is LESS than PA's total | Lecturer sees fewer courses than PA (from TO-01 step 10) | ☐ |
| 7 | Verify each visible course matches assignment | All visible courses are in the lecturer's `lecturer_course_assignments` | ☐ |
| 8 | Verify per-course counts are correct | Enrolled, exams, questions, issues, stale counts match DB for the lecturer's assigned courses | ☐ |
| 9 | Verify summary cards reflect scoped data | All 4 stat cards sum counts only across the lecturer's assigned courses | ☐ |
| 10 | Expand a course | Quick-action links are correct; "Edit course" and "Stale modules" only appear if `can_edit` for this course | ☐ |
| 11 | Verify exam column for non-gradable courses | If lecturer has courses where `can_grade = false`, exams column shows "—" | ☐ |

### SQL Verification
```sql
-- Courses the lecturer should see
SELECT c.id, c.title, lca.can_edit, lca.can_grade
FROM courses c
JOIN lecturer_course_assignments lca ON lca.course_id = c.id
WHERE lca.lecturer_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com');

-- Total courses (PA sees all)
SELECT COUNT(*) FROM courses;
```

### Notes / Learnings
- RLS on `courses` for lecturers: `courses_select_lecturer` uses `EXISTS (SELECT 1 FROM lecturer_course_assignments WHERE course_id = courses.id AND lecturer_id = auth.uid())`
- RLS on `exam_submissions` for lecturers: scoped to `lecturer_can_grade_course_ids` — only courses with grade permission show exam counts
- RLS on `expert_questions`, `issues`, `modules` for lecturers: scoped to `lecturer_course_ids` — all assigned courses
- If the lecturer is assigned to ALL courses, the count will match PA — this test is most valuable with a subset
- The 6 parallel queries each apply their own RLS, so counts are automatically scoped correctly

---

## TO-10: Role Access Control

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-15 |
| **Status** | ✅ |
| **Tester** | Claude Code |

**Purpose**: Verify that only lecturers and platform admins can access `/teaching/courses`. Learners, Tenant Admins, and CSMs should be blocked by the route guard and should not see the sidebar item.

**Covers**: `roleGuard('lecturer', 'platform_admin')`, sidebar visibility per role, Teaching section config

### Steps (Learner — BLOCKED)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as `learner@calypso-commodities.com` | Successful login | ☐ |
| 2 | Check sidebar | "Teaching" section NOT visible | ☐ |
| 3 | Navigate directly to `/teaching/courses` in URL bar | Redirected away (to `/dashboard` or similar) — NOT the Teaching Overview | ☐ |
| 4 | Verify no "Teaching Overview" heading visible | Page content is NOT the Teaching Overview | ☐ |

### Steps (Tenant Admin — BLOCKED)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 5 | Log in as `admin@calypsoclient.com` | Successful login | ☐ |
| 6 | Check sidebar | "Teaching" section NOT visible (TA is not in `['lecturer', 'platform_admin']`) | ☐ |
| 7 | Navigate directly to `/teaching/courses` | Redirected away | ☐ |

### Steps (CSM — BLOCKED)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 8 | Log in as `csm@calypso-commodities.com` | Successful login | ☐ |
| 9 | Check sidebar | "Teaching" section NOT visible (CSM is not in `['lecturer', 'platform_admin']`) | ☐ |
| 10 | Navigate directly to `/teaching/courses` | Redirected away | ☐ |

### Steps (Platform Admin — ALLOWED)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 11 | Log in as `et@calypso-commodities.com` (Platform Admin) | Successful login | ☐ |
| 12 | Check sidebar | "Teaching" section visible with "Teaching Overview" (GraduationCap icon) | ☐ |
| 13 | Navigate to `/teaching/courses` | Page loads successfully, all courses visible | ☐ |

### Steps (Lecturer — ALLOWED)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 14 | Log in as `lecturer-edit@calypso-commodities.com` | Successful login | ☐ |
| 15 | Check sidebar | "Teaching" section visible with "Teaching Overview" | ☐ |
| 16 | Navigate to `/teaching/courses` | Page loads, only assigned courses visible | ☐ |

### Notes / Learnings
- Route guard checks JWT claims: `is_platform_admin` or `lecturer_course_ids` (non-empty)
- Sidebar Teaching section uses `roles: ['lecturer', 'platform_admin']` — same as Issue Management, Questions Board, Exam Grading, and Content Staleness
- CSM is intentionally excluded — CSM role focuses on tenant-scoped data, not course-level teaching actions
- A lecturer without any course assignments would pass the route guard but see an empty table (RLS scopes to empty)
- Teaching section also includes: Questions Board, Issue Management, Exam Grading, Content Staleness — all share the same role guard

---

## Data Setup Notes

### Creating Test Data for Teaching Overview

The Teaching Overview aggregates data from 4 domains. For comprehensive testing, you need activity in each domain for at least one course.

**Create pending exam submissions (if none exist):**

```sql
-- Insert a test exam submission with score=NULL (pending)
INSERT INTO exam_submissions (user_id, exam_id, course_id, tenant_id, file_url)
SELECT
  p.id,
  e.id,
  e.course_id,
  p.tenant_id,
  'https://example.com/test-submission.pdf'
FROM profiles p
CROSS JOIN exams e
WHERE p.email = 'learner@calypso-commodities.com'
  AND e.course_id IN (SELECT course_id FROM lecturer_course_assignments LIMIT 1)
LIMIT 1
ON CONFLICT DO NOTHING;
```

**Create pending expert questions (if none exist):**

```sql
-- Insert a test expert question with status='pending'
INSERT INTO expert_questions (user_id, course_id, module_id, tenant_id, question_text, status)
SELECT
  p.id,
  m.course_id,
  m.id,
  p.tenant_id,
  'Test question for E2E testing',
  'pending'
FROM profiles p
CROSS JOIN modules m
WHERE p.email = 'learner@calypso-commodities.com'
  AND m.course_id IN (SELECT course_id FROM lecturer_course_assignments LIMIT 1)
LIMIT 1
ON CONFLICT DO NOTHING;
```

**Create open issues (if none exist):**

```sql
-- Insert a test issue with status='open'
INSERT INTO issues (user_id, course_id, module_id, tenant_id, issue_type, description, status)
SELECT
  p.id,
  m.course_id,
  m.id,
  p.tenant_id,
  'content_error',
  'Test issue for E2E testing',
  'open'
FROM profiles p
CROSS JOIN modules m
WHERE p.email = 'learner@calypso-commodities.com'
  AND m.course_id IN (SELECT course_id FROM lecturer_course_assignments LIMIT 1)
LIMIT 1
ON CONFLICT DO NOTHING;
```

**Create stale modules (if all are fresh):**

```sql
-- NOTE: Must disable triggers because set_module_updated_at() resets updated_at to NOW()
ALTER TABLE modules DISABLE TRIGGER set_module_audit_fields;
ALTER TABLE modules DISABLE TRIGGER set_module_updated_at;
ALTER TABLE modules DISABLE TRIGGER enforce_module_immutable_fields;
ALTER TABLE modules DISABLE TRIGGER on_significant_module_update;

UPDATE modules
SET updated_at = NOW() - INTERVAL '200 days'
WHERE course_id = '<COURSE_ID>'
  AND id IN (SELECT id FROM modules WHERE course_id = '<COURSE_ID>' LIMIT 2);

ALTER TABLE modules ENABLE TRIGGER set_module_audit_fields;
ALTER TABLE modules ENABLE TRIGGER set_module_updated_at;
ALTER TABLE modules ENABLE TRIGGER enforce_module_immutable_fields;
ALTER TABLE modules ENABLE TRIGGER on_significant_module_update;
```

### Resetting Between Test Runs

No persistent mutations from the Teaching Overview page — it is read-only. No cleanup needed between test runs.

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-15 | Claude Code | TO-01 to TO-10 | 10 | 0 | 2 bugs found + fixed (PA permissions, dropdown pre-selection). 5 roles tested: PA, Lecturer (edit), Lecturer (view), Learner, Tenant Admin. |

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| 1 | TO-01 | PA sees "Read" badge + "—" in Exams for all courses — `is_platform_admin` not checked in `TeachingOverviewService` | High | Added `isPlatformAdmin` check: `canEdit = isPlatformAdmin \|\| editIds.has(course.id)` | ✅ Fixed |
| 2 | TO-08 | Deep-link course dropdown shows "All Courses" instead of pre-selected course — Angular `[value]` on `<select>` evaluates before `@for` `<option>` elements render | High | Changed from `[value]` on `<select>` to `[selected]` on each `<option>` in all 3 board pages (questions, issues, grading) | ✅ Fixed |

---

## References

| Document | Path |
|----------|------|
| Teaching Overview Page Component | `frontend/src/app/features/teaching/pages/teaching-overview-page.component.ts` |
| Teaching Overview Service | `frontend/src/app/core/services/teaching-overview.service.ts` |
| Teaching Overview Service Tests | `frontend/src/app/core/services/teaching-overview.service.spec.ts` |
| Overview Page Tests | `frontend/src/app/features/teaching/pages/teaching-overview-page.component.spec.ts` |
| Route Config | `frontend/src/app/app.routes.ts` |
| Sidebar Nav Config | `frontend/src/app/layout/sidebar/sidebar-nav.config.ts` |
| Questions Board (deep-link target) | `frontend/src/app/features/teaching/pages/questions-board-page.component.ts` |
| Issue Management (deep-link target) | `frontend/src/app/features/teaching/pages/issue-management-page.component.ts` |
| Exam Grading (deep-link target) | `frontend/src/app/features/teaching/pages/exam-grading-page.component.ts` |
| Test Users Setup | `docs/e2e-user-stories/TEST_USERS.md` |
