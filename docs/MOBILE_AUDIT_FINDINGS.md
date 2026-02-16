# Mobile Audit Findings

**Viewport:** 375 x 812 (iPhone 13/14 equivalent)
**Date:** 2026-02-16
**Tester:** Claude Opus 4.6 (Playwright MCP)
**App URL:** https://x-courses-v2.vercel.app

## Summary
- **Total Pages Audited:** 23/23 (all pages across 3 roles: Platform Admin, Learner, Tenant Admin)
- **Critical Issues (blocks usage):** 2 (AUTH-01, AUTH-02)
- **Major Issues (significant UX degradation):** 5 (CD-02, ISS-01, TM-03, TO-01, GLOB-01)
- **Minor Issues (cosmetic/polish):** 11 (DASH-01, TM-02, TM-04, LA-02, IM-01, IM-02, PD-01, TA-UM-01, GLOB-02, GLOB-03, GLOB-04)
- **Total unique issues:** 18

## Issue Severity Guide
- **CRITICAL:** Content inaccessible or functionality broken on mobile
- **MAJOR:** Significant layout breakage, overflow, or unusable touch targets
- **MINOR:** Cosmetic issues, suboptimal spacing, no functionality loss

---

## Batch 1: Auth Pages

### /login
- **No issues found.** Auth card centered, brand mark fits, email input full-width, "Continue" button prominent. Step 2 (auth methods) stacks nicely — SSO button, password field, magic link all properly spaced.

### /request-access
- [x] **[CRITICAL]** AUTH-01: Layout completely broken — card pushed to right, brand mark underneath on left
  - **Element:** Outer `auth-background` flex container
  - **Root cause:** Brand mark and auth-card are two separate flex children of `auth-background` (which is `flex items-center justify-center` with default `flex-direction: row`). On 375px they sit side-by-side instead of stacking.
  - **Fix:** Wrap both in `<div class="w-full max-w-md">` — exactly matching `/login` component structure.
  - **File:** `features/auth/access-request/access-request.component.ts`

### /reset-password
- [x] **[CRITICAL]** AUTH-02: Same broken layout as /request-access — identical root cause
  - **Fix:** Same wrapper div fix as AUTH-01.
  - **File:** `features/auth/reset-password/reset-password.component.ts`

---

## Batch 2: Platform Admin — Core Pages

### /dashboard
- **Mostly good.** Hamburger menu visible, action cards stack single-column, stat cards 2-col grid, welcome header wraps properly with role badges.
- [x] **[MINOR]** DASH-01: Sidebar "X" brand text intercepts click on hamburger button when sidebar is open — sidebar overlaps the toggle button area, making it hard to close via hamburger. User must tap backdrop or a nav link instead.

### /courses
- **Good.** Course cards stack single-column. "My Courses" + "Create Course" button fits side-by-side without wrapping.

### /courses/:id (Course Detail)
- [x] **[MINOR]** CD-01: Module action buttons (edit, move up/down, delete) are very small touch targets (~28px each) and cramped in a row of 3-4 icons
  - **Element:** Module item action buttons in lecture accordion
  - **Fix:** Increase padding or show actions via a "..." overflow menu on mobile
- [x] **[MAJOR]** CD-02: Enrolled Users table cut off — "ENROLLED" column header truncated to "ENRO", date column partially visible, "Unenroll" button column completely hidden off-screen
  - **Element:** `table` inside Enrolled Users section
  - **Fix:** Hide less-important columns on mobile or switch to card layout for enrolled users

### Module Viewers (all 8 types checked)
- **Video module:** Good — Bunny Stream iframe responsive, controls accessible, navigation bar (Previous/Next) fits
- **PDF module:** Layout OK — "pages" count + "Download PDF" link fit, PDF container responsive (test PDF failed to load but container sizing is fine)
- **Markdown module:** Good — text renders at full width, wraps properly
- **Quiz module:** Good — stats 2x2 grid, previous attempts table fits, "Start Quiz" button prominent
- **Exam module:** Good — metadata card 2x2 grid, "Start Exam" button prominent
- **External Quiz module:** Good — card layout, "Take External Quiz" button fits
- **Audio module:** Good — WaveSurfer waveform fits, play controls properly sized, volume slider and speed selector accessible
- **Download module:** Good — file card with download button fits well
- **Common elements (all modules):** "Ask an Expert" button, "Report Issue" button, Discussion section with comment input — all fit well

### /courses/new (New Course Form)
- **Good.** All fields stack vertically, drop-zone full-width, enrollment type selector compact, buttons fit.

### /courses/:id/edit (Edit Course Form)
- **Good.** Same as new form. Tenant assignment checkboxes stack well. "Delete Course" button at bottom.

### /notifications
- **Good.** Notification cards stack properly with icon + text + timestamp. "Mark all read" fits in header.

### /questions (My Questions)
- **Good.** Empty state centered. (No questions for PA user to test layout of filled state.)

### /issues (My Issues)
- [x] **[MAJOR]** ISS-01: Issue card layout awkward — badges ("Open", "Other"), course/module path, and timestamp are jumbled together in a cramped flex row. The course name "Introduction to Commodity Trading / Market Participants" wraps oddly around the badges.
  - **Element:** Issue card flex layout
  - **Fix:** Stack badges above content on mobile, or restructure card layout for narrow viewports

### /profile
- **Good.** Avatar centered, info rows with icon + label/value stack well, edit button accessible.

---

## Batch 3: Platform Admin — Admin & Teaching Pages

### /platform/tenants
- [x] **[MAJOR]** TM-01: "Add Tenant" button text wraps to 2 lines ("Add" / "Tenant") due to competing space with title + count badge in `flex justify-between`
  - **Element:** Page header `flex justify-between` with h1 + badge + button
  - **Fix:** Stack title row and action button vertically on mobile, or use icon-only button at small breakpoints
- [x] **[MINOR]** TM-02: Table columns "Courses" and "CSMs" hidden off-screen (only Name, Domain, Auth Methods partially visible). Horizontal scroll works but no visual scroll indicator.
- [x] **[MAJOR]** TM-03: Expanded row — tenant edit form `grid grid-cols-2` without responsive prefix. Name and Domain inputs crammed side-by-side at 375px. Domain input truncated to "calyp..."
  - **Element:** `grid grid-cols-2 gap-4` in expanded row detail form
  - **Fix:** Change to `grid grid-cols-1 md:grid-cols-2 gap-4`
  - **File:** `features/platform/pages/tenant-management-page.component.ts`
- [x] **[MINOR]** TM-04: Expanded row tab buttons ("Details", "Courses (1)", "CSMs (1)") — "CSMs" label partially cut off at right edge

### /platform/lecturer-assignments
- [x] **[MAJOR]** LA-01: Same button text wrapping issue — "New Assignment" wraps to 2 lines
- [x] **[MINOR]** LA-02: Table "PERMISSION" column partially visible, "Grade" badges clipped at right edge

### /platform/content
- **Mostly good.** Filter bar wraps nicely (search + 2 selects + checkbox stack). Stat cards 2-col. Table shows 3 columns (Course, Lectures, Modules) which is adequate — remaining columns off-screen with scroll.

### /teaching/courses (Teaching Overview)
- Table shows only Course + partial Permissions column. 8-column table heavily truncated.
- [x] **[MAJOR]** TO-01: Expanded row text "You can edit content and grade exams for this co..." cut off — the `flex gap-8` two-column layout (course info + quick actions side-by-side) has no responsive breakpoint, so content overflows at 375px
  - **Element:** Expanded row `flex gap-8` container
  - **Fix:** Change to `flex flex-col lg:flex-row gap-4 lg:gap-8`
  - **File:** `features/teaching/pages/teaching-overview-page.component.ts`

### /teaching/grading
- **OK.** Filter bar wraps (search + 2 selects). Stat cards 2-col. Table shows Learner + Course, rest off-screen with scroll. Same global table pattern.

### /teaching/questions
- **OK.** Same pattern as grading. "1 pending" badge fits next to title. Filter bar wraps. Table shows Learner + Course.

### /teaching/issues
- **Mostly OK.** Filter bar wraps (search + 2 selects + type filter on 3rd row).
- [x] **[MINOR]** IM-01: 5 stat cards in 2-col grid — the 5th card ("CLOSED 2") sits alone on a third row, creating visual asymmetry
  - **Fix:** Consider hiding the least important stat on mobile, or use 3-col for 3+2 arrangement
- [x] **[MINOR]** IM-02: Search placeholder "Search by reporter or descripti..." truncated — minor cosmetic issue

### /teaching/staleness
- **Good.** Only 2 visible table columns (Course, Modules) which is adequate. Filter bar and stat cards fine.

### /admin/users
- [x] **[MAJOR]** UM-01: Same "Invite User" button text wrapping as other admin pages (GLOB-01 pattern)
- Table shows Name + Email, remaining columns (Roles, Tenant, Joined) off-screen. Readable at 375px.
- No pagination visible (11 users fit on one page). M-08 cannot be confirmed here.

### /admin/access-requests
- **OK.** Title + "5" badge fits (no action button here). Table shows Name/Email + Domain + partial Tenant. Standard table scroll behavior.

### /analytics/progress
- **Mostly OK.** Filter bar with number inputs (0–100%) wraps properly.
- [x] **[MINOR]** PD-01: The most complex table — progress bars and nested course progress columns are all off-screen. Only checkbox + Email + partial Name visible. Key information (actual progress) requires horizontal scrolling.
  - **Note:** This is the table where mobile usability suffers most, since the whole point of the page is to see progress, but progress is hidden off-screen

---

## Batch 4: Learner Pages (logged in as `learner@calypsoclient.com`)

### /dashboard (Learner)
- **Good.** Simpler view than PA — welcome header with avatar initials + "Learner" badge, "My Courses" section with enrolled course card including progress bar (75%), "Continue" link. All fits well on mobile.

### /courses (Learner)
- **Good.** No "Create Course" button — cleaner header. Course cards stack single-column with enrollment badges and progress.

### /courses/:id (Learner Course Detail)
- **Good.** Much cleaner than admin view — no edit buttons, no enrollment manager table, no progress manager. Just title + badge, progress bar (9/12), "You're enrolled" status, and lecture accordion with completion checkmarks. Module items have no action buttons (edit/move/delete), so the touch target issue from admin view doesn't apply here.

### Module Viewers (Learner)
- **Quiz module (Sample Quiz):** Good — quiz stats 2x2 grid, previous attempts table with Score/Result/Date/View columns fits, "Continue Quiz" button prominent.
- **Exam module (E2E Exam Test):** Good — metadata card 2x2 grid, "Start Exam" button prominent.
- **All other module types:** Same as PA admin view (video, PDF, markdown, audio, download, external quiz) — all render well at 375px.

### /notifications (Learner)
- **Good.** Notification cards with "New content available" messages fit properly. Icon + title + description + timestamp layout works well.

### /questions, /issues, /profile (Learner)
- Same layouts as PA view — no additional issues beyond ISS-01 already noted for My Issues card layout.

---

## Batch 5: Tenant Admin Pages (logged in as `admin@calypsoclient.com`)

### /dashboard (Tenant Admin)
- **Good.** Simpler view — "Needs Your Attention" section (0 Pending Requests), "Overview" stat (Total Users: 2), "My Courses" (empty). All cards stack single-column, no layout issues.

### /admin/users (Tenant Admin)
- **Same GLOB-01 issue** — "Invite User" button text wraps to 2 lines, identical to PA view.
- Table is simpler than PA (4 cols: Name, Email, Roles, Joined — no Tenant column). Only Name + Email visible at 375px, Roles and Joined off-screen with scroll.
- [x] **[MINOR]** TA-UM-01: 3 stat cards (Total Users, Tenant Admins, Regular Users) in 2-col grid — 3rd card alone on row, same asymmetry pattern as IM-01

### /admin/access-requests (Tenant Admin)
- **Good.** Title "Access Requests" + "0" badge fits on one line (no action button, so no collision). 4 stat cards in clean 2x2 grid. Filter bar (search + status select) stacks properly. Empty state centered.

### /analytics/progress (Tenant Admin)
- **Good.** Same layout as PA view but TA-scoped (1 user). Title fits on one line. Filter bar wraps properly. 4 stat cards 2x2. Table shows checkbox + Email + partial Name at 375px — Courses/Overall/Last Active columns off-screen (same PD-01 pattern as PA view).

---

## Global Issues (Affect Multiple Pages)

### GLOB-01: [MAJOR] Page header title + action button collision on admin pages
- **Affected pages:** /platform/tenants, /platform/lecturer-assignments, /admin/users (confirmed all 3)
- **Pattern:** `flex items-center justify-between` with long title (e.g., "Tenant Management") + count badge + action button (e.g., "Add Tenant"). At 375px the button text wraps to multiple lines.
- **Fix:** On mobile, stack title row above action button (`flex-col sm:flex-row`), or use icon-only buttons with tooltips at small breakpoints.

### GLOB-02: [MINOR] Tables with 5+ columns require horizontal scroll — no visual indicator
- **Affected pages:** All table-heavy pages (tenants, lecturer assignments, content mgmt, teaching overview, grading, questions board, issues, staleness, user mgmt, access requests, progress dashboard)
- **Pattern:** `table-container` has `overflow-x-auto` which works, but users have no visual cue that more columns exist to the right
- **Note:** Tables are functional — this is a polish issue, not a blocker. A gradient fade or scroll shadow at the right edge would help discoverability.

### GLOB-03: [MINOR] Small touch targets on icon-only buttons (~28-32px)
- **Affected pages:** Course detail (module action buttons), table expand chevrons, various edit/delete icon buttons
- **Pattern:** `.btn-icon` has `p-1.5` giving ~28px touch target. Apple recommends 44px minimum.
- **Fix:** Increase to `p-2.5` or `p-3` on mobile for `.btn-icon` via media query

### GLOB-04: [MINOR] Toast/notification popup can overflow viewport on mobile
- **Affected components:** `toast-container.component.ts`, `main-layout.component.ts` (realtime notification popup)
- **Pattern:** `max-w-sm` (384px) + `right-4` (16px) = 400px needed, but viewport is 375px. Long toast messages could extend 25px past left edge.
- **Fix:** Add `left-4` alongside `right-4` to constrain toast width to viewport, or use `max-w-[calc(100vw-2rem)]` on mobile.

---

## Pre-Identified Issues Validation

| ID | Predicted | Confirmed? | Severity | Notes |
|----|-----------|------------|----------|-------|
| M-01 | `.search-input` w-64 overflow | No | N/A | Search inputs appear to respect container width and don't overflow. The `w-64` seems constrained by parent. |
| M-02 | `.btn-icon` touch target ~28px | Yes | MINOR | Confirmed on course detail module actions, table chevrons |
| M-03 | Toast `max-w-sm` > viewport | Yes (code) | MINOR | `max-w-sm` (384px) + `right-4` (16px) = toast could overflow left edge by 25px. Fix: add `left-4` or use `w-[calc(100vw-2rem)]` on mobile |
| M-04 | Teaching expanded `flex gap-8` | Yes | MAJOR | Confirmed — two-column layout overflows at 375px (TO-01) |
| M-05 | Tenant form `grid-cols-2` | Yes | MAJOR | Confirmed — Name/Domain inputs crammed (TM-03) |
| M-06 | Page header title+button collision | Yes | MAJOR | Confirmed on tenants, lecturer assignments (GLOB-01) |
| M-07 | Tables need scroll indicator | Yes | MINOR | Functional but no visual cue (GLOB-02) |
| M-08 | Pagination tight at 375px | Not confirmed | N/A | User mgmt shows all 11 users without pagination. Progress dashboard has only 3 users. Cannot test with current data volume. |

---

## Overall Assessment

### What Works Well
- **Sidebar/header mobile pattern** — hamburger toggle, slide-in with backdrop, responsive breakpoint at `lg:` — fully functional
- **All 8 module viewers** — video, PDF, markdown, audio, download, quiz, exam, external quiz — render correctly at 375px across all roles
- **Card-based layouts** — course cards, notification cards, dashboard cards, stat cards — all stack single-column properly
- **Filter bars** — search inputs + select dropdowns wrap to multiple rows gracefully on all pages
- **Auth login page** — glass card, brand mark, multi-step auth flow — all perfectly centered and spaced
- **Learner experience** — the cleanest mobile experience, with no admin clutter (no edit/delete buttons, no enrollment tables)
- **Forms** — course create/edit forms stack vertically, all inputs full-width, drop-zone responsive

### Priority Fix Recommendations

**Quick wins (< 30 min total):**
1. AUTH-01 + AUTH-02: Add wrapper div to `/request-access` and `/reset-password` — 2 files, 5 minutes each
2. TM-03: Change `grid-cols-2` to `grid-cols-1 md:grid-cols-2` — 1 file, 2 minutes
3. TO-01: Change `flex gap-8` to `flex flex-col lg:flex-row gap-4 lg:gap-8` — 1 file, 2 minutes
4. GLOB-04: Add `left-4` to toast containers — 2 files, 2 minutes each

**Medium effort (1-2 hours):**
5. GLOB-01: Page header responsive stacking on 3 admin pages — systematic pattern fix
6. ISS-01: Issue card layout restructure for mobile

**Nice-to-have (polish):**
7. GLOB-02: Table scroll shadow/indicator CSS
8. GLOB-03: Increase `.btn-icon` touch target on mobile
9. Odd stat card counts (3 or 5 cards in 2-col grid)
