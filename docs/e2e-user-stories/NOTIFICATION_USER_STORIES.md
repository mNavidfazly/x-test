> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Notification E2E User Stories (Phase 8A)

## Overview

E2E testing scenarios for the Notification System (Phase 8A). These stories verify the full notification lifecycle: bell badge in the header with unread count, the notification list page at `/notifications`, mark-as-read (single + bulk), click-to-navigate routing based on notification type, and real-time toast popups via Supabase Realtime subscription.

**Migration 00033** added the `notifications` table to the `supabase_realtime` publication (idempotent). 13 SECURITY DEFINER trigger functions create notifications at the database level — application code NEVER inserts notifications directly. 2 RLS policies control access: `notifications_select_own` (user_id = auth.uid()) and `notifications_update_own` (user_id = auth.uid()).

**What was built in Phase 8A:**
- `NotificationService` — root singleton with Realtime subscription tied to auth state via `effect(onCleanup)`, loadNotifications (limit 50), markAsRead, markAllAsRead, unreadCount computed, latestToast signal (auto-dismiss 5s)
- `NotificationListPageComponent` — 4-state template (loading/error/empty/list), type-specific icons+colors, unread border-l-teal-500 indicator, mark-all-as-read button
- Header bell — unread badge (rose-500 pill, 99+ cap), links to `/notifications`
- Main layout toast — fixed top-right overlay, click navigates + marks read, dismiss button
- 15 notification types with icon/color mapping and type-to-route helpers

**Cross-references:**
- Phase 6C (Questions Board) — QB-07 partially tested `question_answered` notification at DB level
- Phase 7B (Issue Management) — IM-09 partially tested `issue_resolved` notification at DB level
- Both those tests ran against the *stub* notification page — these stories verify the *real* implementation

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Primary Test User** | learner@calypso-commodities.com (Learner) |
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
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | NT-09, NT-12 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit, can_grade)** | Calypso (master) | NT-08, NT-10, NT-12 |
| 3 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | NT-01 to NT-11 |
| 4 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | NT-12 |

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
| 1 | NT-01 | Notification Page Load + List Rendering | Learner logged in, notifications exist in DB |
| 2 | NT-02 | Bell Badge Reflects Unread Count | NT-01 (notifications loaded) |
| 3 | NT-07 | Unread vs Read Visual Indicators | NT-01 (mix of read/unread notifications) |
| 4 | NT-04 | Mark Single Notification as Read | NT-01 (unread notification exists) |
| 5 | NT-05 | Mark All as Read | NT-01 (unread notifications exist) |
| 6 | NT-06 | Click Notification Navigates to Correct Route | NT-01 (typed notifications exist) |
| 7 | NT-03 | Empty State | All notifications cleared (or fresh user) |
| 8 | NT-08 | Trigger: Question Answered → Learner Notification | Pending expert question exists |
| 9 | NT-09 | Trigger: Issue Resolved → Learner Notification | Open issue exists |
| 10 | NT-10 | Trigger: New Expert Question → Lecturer Notification | Learner can ask question on module |
| 11 | NT-11 | Realtime Toast | Two browser sessions (advanced) |
| 12 | NT-12 | All Roles Can Access /notifications | Multiple role logins |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| NT-01 | Notification Page Load + List Rendering | Learner | ✅ | 2026-02-15 |
| NT-02 | Bell Badge Reflects Unread Count | Learner | ✅ | 2026-02-15 |
| NT-03 | Empty State | Learner | ✅ | 2026-02-15 |
| NT-04 | Mark Single Notification as Read | Learner | ✅ | 2026-02-15 |
| NT-05 | Mark All as Read | Learner | ✅ | 2026-02-15 |
| NT-06 | Click Notification Navigates to Correct Route | Learner | ✅ | 2026-02-15 |
| NT-07 | Unread vs Read Visual Indicators | Learner | ✅ | 2026-02-15 |
| NT-08 | Trigger: Question Answered → Learner Notification | Lecturer + Learner | ✅ | 2026-02-15 |
| NT-09 | Trigger: Issue Resolved → Learner Notification | Lecturer + Learner | ✅ | 2026-02-15 |
| NT-10 | Trigger: New Expert Question → Lecturer Notification | Learner + Lecturer | ✅ | 2026-02-15 |
| NT-11 | Realtime Toast | Learner (two sessions) | ⏳ | — (requires two browser instances — shared localStorage prevents multi-user in one context) |
| NT-12 | All Roles Can Access /notifications | All 4 roles | ✅ | 2026-02-15 |

---

## Preconditions (All Stories)

- At least one course with modules exists and is assigned to the learner's tenant via `tenant_courses`
- Learner is enrolled in the course
- Lecturer has `lecturer_course_assignments` for the course
- For trigger stories (NT-08 to NT-11), appropriate entities must exist (expert questions, issues)

**Ensure notifications exist** (seed data for NT-01 to NT-07):

The easiest approach is to generate notifications by performing real actions:
1. Login as learner, ask an expert question → triggers `notify_new_expert_question` (notifies lecturer)
2. Login as lecturer, respond to the question → triggers `notify_question_answered` (notifies learner)
3. Login as learner, report an issue → triggers `notify_new_issue` (notifies lecturer/PA)
4. Login as PA, resolve the issue → triggers `notify_issue_resolved` (notifies learner)

This produces 2 learner-visible notifications (`question_answered` + `issue_resolved`) and 2 staff-visible notifications (`new_expert_question` + `new_issue`).

**Alternate: Create test notifications via SQL** (direct insert for controlled test data):
```sql
-- Get learner's user_id and tenant_id
SELECT id, tenant_id FROM profiles WHERE email = 'learner@calypso-commodities.com';

-- Get a course_id for data references
SELECT id, title FROM courses LIMIT 3;

-- Insert test notifications for the learner (use actual UUIDs from above)
INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
VALUES
  ('<LEARNER_ID>', '<TENANT_ID>', 'question_answered',
   'Your question has been answered',
   'An expert has responded to your question. Click to see the answer.',
   '{"question_id": "q1", "course_id": "<COURSE_ID>", "module_id": "m1"}'::jsonb),

  ('<LEARNER_ID>', '<TENANT_ID>', 'issue_resolved',
   'Your issue has been resolved',
   'Your reported issue has been resolved by an admin.',
   '{"issue_id": "i1", "course_id": "<COURSE_ID>", "issue_type": "content_error"}'::jsonb),

  ('<LEARNER_ID>', '<TENANT_ID>', 'course_assigned',
   'New course assigned',
   'You have been enrolled in: LNG Trading Fundamentals',
   '{"course_id": "<COURSE_ID>"}'::jsonb),

  ('<LEARNER_ID>', '<TENANT_ID>', 'exam_graded',
   'Exam graded',
   'Your exam submission has been graded. Score: 85%',
   '{"submission_id": "s1", "course_id": "<COURSE_ID>", "exam_id": "e1", "score": "85"}'::jsonb);

-- Mark some as read and leave some unread (for testing visual indicators)
UPDATE notifications SET read_at = NOW()
WHERE user_id = '<LEARNER_ID>' AND type = 'course_assigned';
```

**Cleanup SQL** (reset before testing):
```sql
-- Check existing notifications for learner
SELECT id, type, title, read_at, created_at
FROM notifications
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
ORDER BY created_at DESC;

-- Delete all notifications for learner (to test empty state)
DELETE FROM notifications
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');

-- Delete all notifications (nuclear option)
DELETE FROM notifications;
```

---

## NT-01: Notification Page Load + List Rendering

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that the notification list page loads correctly, shows existing notifications with proper titles, body text, type-specific icons, and relative timestamps. This is the core page functionality test.

**Covers**: `NotificationListPageComponent`, `NotificationService.loadNotifications()`, `getNotificationMeta()` icon/color mapping, relative timestamp formatting, `notifications_select_own` RLS policy

**Preconditions**:
- Learner has at least 2 notifications in the database (see Preconditions section above)
- At least one `question_answered` and one `issue_resolved` notification

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| 2 | Click bell icon in header (or navigate directly to `/notifications`) | Notification list page loads | ☐ |
| 3 | Verify page header | Bell icon + "Notifications" title + "Stay up to date with your courses" subtitle | ☐ |
| 4 | Verify notification cards render | Multiple cards in a vertical list, each with white bg, rounded-xl border | ☐ |
| 5 | Verify each card structure | Left: colored icon circle (32px). Center: title (semibold) + body text (slate-500). Right: relative timestamp | ☐ |
| 6 | Verify `question_answered` card | MessageSquare icon in teal circle, title "Your question has been answered" | ☐ |
| 7 | Verify `issue_resolved` card | CheckCircle2 icon in emerald circle, title "Your issue has been resolved" | ☐ |
| 8 | Verify `course_assigned` card (if exists) | BookOpen icon in teal circle, title "New course assigned" | ☐ |
| 9 | Verify body text renders | Body text visible below title (e.g., "An expert has responded to your question...") | ☐ |
| 10 | Verify timestamps | Relative times like "just now", "5m ago", "2h ago", "3d ago", or "Feb 10" for older | ☐ |
| 11 | Verify notifications sorted by date | Most recent at top, oldest at bottom | ☐ |

### SQL Verification
```sql
-- Count notifications the learner should see
SELECT COUNT(*) FROM notifications
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');

-- Verify notification details match what's displayed
SELECT id, type, title, body, data, read_at, created_at
FROM notifications
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
ORDER BY created_at DESC;
```

### Notes / Learnings
- `notifications_select_own` RLS: `USING (user_id = auth.uid())` — learner only sees their own notifications
- `loadNotifications()` uses `.order('created_at', { ascending: false }).limit(50)` — max 50 shown
- Type-specific icons via `getNotificationMeta()` — 15 types each have a Lucide icon + color class
- Relative time formatting: <1m="just now", <60m="Xm ago", <24h="Xh ago", <7d="Xd ago", else "Mon DD"

---

## NT-02: Bell Badge Reflects Unread Count

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that the bell icon in the header shows a rose-colored unread badge with the correct count. Badge should update when notifications are marked as read.

**Covers**: `HeaderComponent` unread badge, `NotificationService.unreadCount` computed signal, badge rendering (rose-500 pill, 99+ cap)

**Preconditions**:
- Learner has at least 2 unread notifications (`read_at = NULL`)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| 2 | Verify bell icon in header | Bell icon visible (aria-label="Notifications") | ☐ |
| 3 | Verify unread badge | Rose-500 pill overlapping top-right of bell, showing number (e.g., "3") | ☐ |
| 4 | Verify badge count matches unread notifications | Count matches `SELECT COUNT(*) FROM notifications WHERE user_id = ... AND read_at IS NULL` | ☐ |
| 5 | Navigate to `/notifications` | Page loads | ☐ |
| 6 | Verify same count in page header | Rose badge "N unread" next to "Notifications" title | ☐ |
| 7 | Click on an unread notification | Notification is marked as read | ☐ |
| 8 | Navigate back to `/notifications` (or any page) | Bell badge count decreased by 1 | ☐ |
| 9 | Mark all as read (if button visible) | Badge disappears from bell (count = 0) | ☐ |

### Notes / Learnings
- Badge shows exact count up to 99, then "99+" for 100+
- Badge uses `absolute -top-0.5 -right-0.5` positioning on the bell anchor
- `unreadCount` is `computed(() => notifications().filter(n => !n.read_at).length)` — reactive, updates on any signal change
- Bell links to `/notifications` (not a dropdown) — simplicity over complexity

---

## NT-03: Empty State

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that the notification page shows an appropriate empty state when the user has no notifications.

**Covers**: Empty state template branch in `NotificationListPageComponent`

**Preconditions**:
- Use a user with no notifications, OR clear all notifications first (see cleanup SQL)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as a user with zero notifications | Dashboard loads | ☐ |
| 2 | Navigate to `/notifications` | Notification list page loads | ☐ |
| 3 | Verify empty state | Centered layout: large Bell icon (48px, slate-300), "No notifications yet" text (semibold), "You'll see updates about your courses here." subtitle | ☐ |
| 4 | Verify no "Mark all as read" button | Button hidden when unread count = 0 | ☐ |
| 5 | Verify no unread count badge in header | Rose badge not visible on bell when count = 0 | ☐ |
| 6 | Verify no "N unread" badge in page header | Badge hidden when count = 0 | ☐ |

### Notes / Learnings
- Empty state triggers when `notifications().length === 0` AND not loading AND no error
- This can be tested after running "Mark all as read" and then deleting all notifications
- Or use a fresh test user who has never received a notification (e.g., a newly created user)

---

## NT-04: Mark Single Notification as Read

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that clicking an unread notification marks it as read: the teal left border changes to transparent, the bold title becomes regular weight, and the unread count decreases.

**Covers**: `NotificationListPageComponent.onNotificationClick()`, `NotificationService.markAsRead()`, `notifications_update_own` RLS policy, local signal update

**Preconditions**:
- Learner has at least one unread notification

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| 2 | Navigate to `/notifications` | Notifications visible | ☐ |
| 3 | Note the unread count in the header and page header badges | E.g., "3 unread" | ☐ |
| 4 | Identify an unread notification (teal left border, bold title) | Unread visual indicators present | ☐ |
| 5 | Click on the unread notification | Page navigates to the target route (depends on type) | ☐ |
| 6 | Navigate back to `/notifications` | Notification list reloads | ☐ |
| 7 | Verify the clicked notification is now "read" | Left border changed from teal to transparent, title no longer bold | ☐ |
| 8 | Verify unread count decreased | Header badge shows count - 1 (e.g., "2 unread") | ☐ |

### SQL Verification
```sql
-- Verify read_at was set
SELECT id, type, read_at FROM notifications
WHERE id = '<NOTIFICATION_ID>';
-- read_at should now be non-null
```

### Notes / Learnings
- `markAsRead()` sends `.update({ read_at: <ISO timestamp> }).eq('id', id)` to Supabase
- `notifications_update_own` RLS: `USING (user_id = auth.uid())` — can only update own
- Clicking an already-read notification does NOT call `markAsRead` again (skips if `read_at` truthy)
- The click also navigates via `getNotificationRoute(type, data)` — verified in NT-06

---

## NT-05: Mark All as Read

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify the "Mark all as read" bulk action: all unread notifications become read, the button disappears, and the bell badge clears.

**Covers**: `NotificationListPageComponent.onMarkAllAsRead()`, `NotificationService.markAllAsRead()`, `.is('read_at', null)` filter, local signal bulk update

**Preconditions**:
- Learner has at least 2 unread notifications

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| 2 | Navigate to `/notifications` | Multiple unread notifications visible | ☐ |
| 3 | Verify "Mark all as read" button visible | Button with CheckCheck icon next to page title, teal text | ☐ |
| 4 | Verify unread count badge | "N unread" badge visible in page header | ☐ |
| 5 | Click "Mark all as read" | All notifications transition to read state | ☐ |
| 6 | Verify all notifications now read | All left borders changed from teal to transparent, titles no longer bold | ☐ |
| 7 | Verify "Mark all as read" button disappeared | Button hidden when unread count = 0 | ☐ |
| 8 | Verify unread badge gone from page header | "N unread" badge no longer shown | ☐ |
| 9 | Verify bell badge gone from header | Rose pill no longer visible on bell icon | ☐ |
| 10 | Refresh the page | All still marked as read (persisted to DB) | ☐ |

### SQL Verification
```sql
-- Verify all learner notifications are read
SELECT id, type, read_at FROM notifications
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
AND read_at IS NULL;
-- Should return 0 rows
```

### Notes / Learnings
- `markAllAsRead()` sends `.update({ read_at: <timestamp> }).is('read_at', null)` — only updates unread
- Already-read notifications are not re-updated (the `.is('read_at', null)` filter excludes them)
- Local signal update: `list.map(n => n.read_at ? n : { ...n, read_at: readAt })` — immediate UI feedback

---

## NT-06: Click Notification Navigates to Correct Route

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that clicking a notification navigates to the correct page based on notification type and data. Different types route to different pages.

**Covers**: `getNotificationRoute()` helper, `Router.navigateByUrl()`, type-to-route mapping

**Preconditions**:
- Learner has notifications of different types: `question_answered`, `issue_resolved`, `course_assigned`

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| 2 | Navigate to `/notifications` | Notifications visible | ☐ |
| 3 | Click a `question_answered` notification | Navigates to `/questions` (My Questions page) | ☐ |
| 4 | Verify My Questions page loaded | "My Questions" header visible | ☐ |
| 5 | Navigate back to `/notifications` | — | ☐ |
| 6 | Click an `issue_resolved` notification | Navigates to `/issues` (My Issues page) | ☐ |
| 7 | Verify My Issues page loaded | "My Issues" header visible | ☐ |
| 8 | Navigate back to `/notifications` | — | ☐ |
| 9 | Click a `course_assigned` notification | Navigates to `/courses/{course_id}` (Course detail page) | ☐ |
| 10 | Verify course detail page loaded | Course title visible | ☐ |

### Route Mapping Reference

| Notification Type | Route | Notes |
|-------------------|-------|-------|
| `course_assigned` | `/courses/{course_id}` | With `/modules/{module_id}` if module_id in data |
| `new_module` | `/courses/{course_id}/modules/{module_id}` | Direct to module viewer if module_id present |
| `progress_reset` | `/courses/{course_id}/modules/{module_id}` | — |
| `exam_graded` | `/courses/{course_id}` | — |
| `question_answered` | `/questions` | My Questions page |
| `issue_resolved` | `/issues` | My Issues page |
| `reminder` | `/courses/{course_id}` | — |
| `exam_deadline` | `/courses/{course_id}` | — |
| `new_expert_question` | `/teaching/questions` | Questions Board (lecturer/PA only) |
| `new_exam_submission` | `/teaching/grading` | Exam Grading (lecturer/PA only) |
| `new_issue` | `/teaching/issues` | Issue Management (lecturer/PA only) |
| `exam_reset` | `/courses/{course_id}` | — |
| `new_access_request` | `null` (no navigation) | No admin page yet |
| `access_request_reviewed` | `null` (no navigation) | No admin page yet |

### Notes / Learnings
- `getNotificationRoute()` reads from `data` jsonb to construct the URL
- If `data` is missing required keys, the function returns `null` and click does nothing (no navigation)
- `new_access_request` and `access_request_reviewed` return `null` — clicking these notifications does nothing

---

## NT-07: Unread vs Read Visual Indicators

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify the visual distinction between unread and read notifications: unread have a teal left border and bold title, read have a transparent left border and regular-weight title.

**Covers**: Conditional CSS classes in `NotificationListPageComponent` template — `border-l-teal-500` vs `border-l-transparent`, `font-bold` on unread

**Preconditions**:
- Learner has a mix of read and unread notifications

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| 2 | Navigate to `/notifications` | Notifications visible | ☐ |
| 3 | Identify an unread notification | Card has `border-l-4 border-l-teal-500` (teal left accent), title text has `font-bold` | ☐ |
| 4 | Identify a read notification | Card has `border-l-4 border-l-transparent` (no visible border), title has `font-semibold` (not bold) | ☐ |
| 5 | Verify visual contrast | Unread clearly distinguishable from read at a glance | ☐ |
| 6 | Click the unread notification | Navigates, marks as read | ☐ |
| 7 | Navigate back to `/notifications` | The previously-unread notification now has transparent border + regular weight | ☐ |

### Notes / Learnings
- CSS classes: `[class.border-l-teal-500]="!notification.read_at"` and `[class.border-l-transparent]="!!notification.read_at"`
- Title: `[class.font-bold]="!notification.read_at"` — extra bold for unread, base `font-semibold` for read
- Both read and unread cards have `border-l-4` — the color just changes

---

## NT-08: Trigger — Question Answered → Learner Notification

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify the full notification loop for expert question answering: learner asks a question, lecturer responds, learner sees the `question_answered` notification on the notification page with correct title, body, and navigation.

**Covers**: `notify_question_answered()` trigger, `NotificationService.loadNotifications()`, notification rendering, click-to-navigate to `/questions`

**Preconditions**:
- Learner has a pending expert question, OR can ask a new one
- Lecturer is assigned to the course

### Setup (Learner Asks Question)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| S1 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| S2 | Navigate to a course → module viewer | Module viewer loads | ☐ |
| S3 | Click "Ask an Expert" → type a question → submit | Question submitted successfully | ☐ |
| S4 | Log out | — | ☐ |

### Steps (Lecturer Responds)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as `lecturer-edit@calypso-commodities.com` | Dashboard loads | ☐ |
| 2 | Navigate to `/teaching/questions` | Questions Board loads | ☐ |
| 3 | Find the learner's pending question | Question visible with "Pending" badge | ☐ |
| 4 | Click to expand, type a response, click "Submit Response" | Response saved, badge changes to "Answered" | ☐ |
| 5 | Log out | — | ☐ |

### Steps (Learner Verifies Notification)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 6 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| 7 | Verify bell badge | Unread count increased (rose pill visible on bell) | ☐ |
| 8 | Navigate to `/notifications` | Notification page loads | ☐ |
| 9 | Verify `question_answered` notification present | Title: "Your question has been answered", Body: "An expert has responded to your question. Click to see the answer." | ☐ |
| 10 | Verify unread indicator | Teal left border on the new notification | ☐ |
| 11 | Click the notification | Navigates to `/questions` (My Questions page) | ☐ |
| 12 | Verify the answered question | "Answered" badge (emerald) on the question, response text visible when expanded | ☐ |
| 13 | Navigate back to `/notifications` | Notification now marked as read (transparent border) | ☐ |

### SQL Verification
```sql
-- Verify notification was created by trigger
SELECT id, type, title, body, data, read_at, created_at
FROM notifications
WHERE type = 'question_answered'
AND user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
ORDER BY created_at DESC LIMIT 1;
-- title: 'Your question has been answered'
-- body: 'An expert has responded to your question. Click to see the answer.'
-- data keys: question_id, course_id, module_id
```

### Notes / Learnings
- `notify_question_answered` fires only when `response_text` changes from NULL to non-NULL (first response)
- Updating an existing response does NOT re-fire the trigger
- The notification's `data` jsonb includes `question_id`, `course_id`, `module_id` — used for routing
- `getNotificationRoute('question_answered', data)` always returns `/questions` (ignores data keys for this type)

---

## NT-09: Trigger — Issue Resolved → Learner Notification

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify the full notification loop for issue resolution: learner reports an issue, PA resolves it, learner sees the `issue_resolved` notification on the notification page.

**Covers**: `notify_issue_resolved()` trigger, notification rendering, click-to-navigate to `/issues`

**Preconditions**:
- Learner has an open issue, OR can report a new one

### Setup (Learner Reports Issue)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| S1 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| S2 | Navigate to a course → module viewer | Module viewer loads | ☐ |
| S3 | Click "Report Issue" → select type + write description → submit | Issue submitted | ☐ |
| S4 | Log out | — | ☐ |

### Steps (PA Resolves)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as `et@calypso-commodities.com` (PA) | Dashboard loads | ☐ |
| 2 | Navigate to `/teaching/issues` | Issue Management loads | ☐ |
| 3 | Find the learner's issue | Issue visible with "Open" badge | ☐ |
| 4 | Click to expand, change status to "Resolved", click "Save Changes" | Issue resolved, badge changes to "Resolved" | ☐ |
| 5 | Log out | — | ☐ |

### Steps (Learner Verifies)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 6 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| 7 | Verify bell badge | Unread count increased | ☐ |
| 8 | Navigate to `/notifications` | — | ☐ |
| 9 | Verify `issue_resolved` notification | Title: "Your issue has been resolved", Body: "Your reported issue has been resolved by {PA name}." | ☐ |
| 10 | Click the notification | Navigates to `/issues` (My Issues page) | ☐ |
| 11 | Verify the resolved issue | "Resolved" badge (emerald), resolution info panel visible | ☐ |

### SQL Verification
```sql
-- Verify notification created by trigger
SELECT id, type, title, body, data
FROM notifications
WHERE type = 'issue_resolved'
AND user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
ORDER BY created_at DESC LIMIT 1;
-- title: 'Your issue has been resolved'
-- body: 'Your reported issue has been resolved by {resolver_name}.'
-- data keys: issue_id, course_id, issue_type
```

### Notes / Learnings
- `notify_issue_resolved` fires when status changes to `'resolved'` (from any other status)
- The body includes the resolver's name (looked up from `profiles`)
- `getNotificationRoute('issue_resolved', data)` always returns `/issues`

---

## NT-10: Trigger — New Expert Question → Lecturer Notification

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that when a learner asks an expert question, the assigned lecturer receives a `new_expert_question` notification visible on their notification page.

**Covers**: `notify_new_expert_question()` trigger, lecturer's notification page, click-to-navigate to `/teaching/questions`

**Preconditions**:
- Learner can access a module with the "Ask an Expert" component
- Lecturer is assigned to the course

### Steps (Learner Asks)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| 2 | Navigate to a course → module viewer | Module viewer loads | ☐ |
| 3 | Click "Ask an Expert" → type question → submit | Question submitted successfully | ☐ |
| 4 | Log out | — | ☐ |

### Steps (Lecturer Verifies)

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 5 | Login as `lecturer-edit@calypso-commodities.com` | Dashboard loads | ☐ |
| 6 | Verify bell badge | Unread count shows (rose pill on bell) | ☐ |
| 7 | Navigate to `/notifications` | Notification page loads | ☐ |
| 8 | Verify `new_expert_question` notification | Title: "New question from a learner", Body: "{learner name} asked a question on your course.", HelpCircle icon in blue circle | ☐ |
| 9 | Click the notification | Navigates to `/teaching/questions` (Questions Board) | ☐ |
| 10 | Verify the new question is visible on the board | Question from the learner visible with "Pending" badge | ☐ |

### SQL Verification
```sql
-- Verify notification for lecturer
SELECT id, type, title, body, data
FROM notifications
WHERE type = 'new_expert_question'
AND user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
ORDER BY created_at DESC LIMIT 1;
-- title: 'New question from a learner'
-- body: '{learner_name} asked a question on your course.'
-- data keys: question_id, course_id, module_id, asker_tenant_id
```

### Notes / Learnings
- `notify_new_expert_question` notifies BOTH lecturers (assigned to course) AND CSMs (assigned to learner's tenant)
- Deduplication: if a user is both lecturer and CSM, they only get one notification
- `getNotificationRoute('new_expert_question', data)` returns `/teaching/questions`
- The notification icon is HelpCircle (blue) — matches the "Ask an Expert" component icon

---

## NT-11: Realtime Toast

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that when a notification is created while the user is logged in, a toast popup appears at the top-right corner with the notification title and body. Toast auto-dismisses after 5 seconds.

**Covers**: Supabase Realtime `postgres_changes` subscription, `NotificationService.#startListening()`, `latestToast` signal, `MainLayoutComponent` toast overlay, auto-dismiss timer

**Preconditions**:
- Two browser sessions (or tabs) are needed:
  - Session A: Learner logged in on any page
  - Session B: Lecturer logged in, ready to respond to a pending expert question

**IMPORTANT**: This test requires Supabase Realtime to be working. Migration 00033 must be applied.

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Open browser Tab A: login as `learner@calypso-commodities.com` | Dashboard loads | ☐ |
| 2 | Stay on any page (e.g., dashboard or a course page) | Learner is idle, page is open | ☐ |
| 3 | Open browser Tab B: login as `lecturer-edit@calypso-commodities.com` | Dashboard loads in Tab B | ☐ |
| 4 | In Tab B: navigate to `/teaching/questions`, respond to the learner's pending question | Response submitted | ☐ |
| 5 | Switch to Tab A within 5 seconds | **Toast popup appears** at top-right: white card with shadow, notification title + body, X dismiss button | ☐ |
| 6 | Verify toast content | Title: "Your question has been answered", Body: "An expert has responded..." | ☐ |
| 7 | Wait 5 seconds (or click X to dismiss) | Toast auto-disappears | ☐ |
| 8 | Verify bell badge updated | Unread count increased by 1 | ☐ |
| 9 | Navigate to `/notifications` in Tab A | New notification appears at top of list (most recent) | ☐ |

### Alternative: Toast Click Navigation

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 10 | (If another notification arrives) Click on the toast body (not X) | Toast dismissed, notification marked as read, navigates to route | ☐ |

### Notes / Learnings
- Realtime subscription: `.channel('notifs-{userId}').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.{userId}' })`
- The notification is created by the DB trigger `notify_question_answered` — it's a server-side INSERT
- Toast auto-dismiss: 5-second `setTimeout` → `#latestToast.set(null)`
- Toast click: `onToastClick(notification)` → `dismissToast()`, `markAsRead()`, `navigateByUrl(route)`
- If Realtime is down or not configured, notifications still appear on page refresh (just no live push)
- **This test depends on Supabase Realtime infrastructure** — it may not work in all environments

---

## NT-12: All Roles Can Access /notifications

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that ALL authenticated roles can access the notification page. Unlike teaching boards (restricted to lecturer/PA), notifications are available to everyone.

**Covers**: Route config (no role guard), sidebar visibility (`roles: 'all'`), `notifications_select_own` RLS scoping per user

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Login as `learner@calypso-commodities.com` (Learner) | Dashboard loads | ☐ |
| 2 | Verify sidebar | "Notifications" item visible with Bell icon | ☐ |
| 3 | Navigate to `/notifications` | Page loads successfully — shows learner's notifications (or empty state) | ☐ |
| 4 | Log out | — | ☐ |
| 5 | Login as `lecturer-edit@calypso-commodities.com` (Lecturer) | Dashboard loads | ☐ |
| 6 | Navigate to `/notifications` | Page loads — shows lecturer's notifications (may include `new_expert_question`, `new_issue`) | ☐ |
| 7 | Log out | — | ☐ |
| 8 | Login as `et@calypso-commodities.com` (Platform Admin) | Dashboard loads | ☐ |
| 9 | Navigate to `/notifications` | Page loads — shows PA's notifications (may include `new_issue`, `new_access_request`) | ☐ |
| 10 | Log out | — | ☐ |
| 11 | Login as `csm@calypso-commodities.com` (CSM) | Dashboard loads | ☐ |
| 12 | Navigate to `/notifications` | Page loads — shows CSM's notifications (may include `new_expert_question`, `new_issue`) | ☐ |
| 13 | Verify each role only sees OWN notifications | RLS `notifications_select_own` ensures no cross-user leakage | ☐ |

### SQL Verification
```sql
-- Count notifications per test user
SELECT p.email, COUNT(n.id) as notification_count
FROM profiles p
LEFT JOIN notifications n ON n.user_id = p.id
WHERE p.email IN (
  'learner@calypso-commodities.com',
  'lecturer-edit@calypso-commodities.com',
  'et@calypso-commodities.com',
  'csm@calypso-commodities.com'
)
GROUP BY p.email;
```

### Notes / Learnings
- `/notifications` route has no role guard — only the parent `authGuard` (must be logged in)
- Sidebar entry uses `roles: 'all'` — visible to every role
- `notifications_select_own` RLS: `USING (user_id = auth.uid())` — each user only sees their own
- Different roles receive different notification types (learner gets `question_answered`, lecturer gets `new_expert_question`, etc.)
- A user who has never triggered any notification-creating action will see the empty state

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| — | — | No bugs found | — | — | N/A |

---

## Data Setup Notes

### Generating Notifications via Real Actions (Recommended)

The most reliable way to populate notifications is to perform real actions that trigger the DB functions:

| Action | Trigger | Type | Recipient |
|--------|---------|------|-----------|
| Enroll a learner in a course | `notify_course_assigned` | `course_assigned` | Learner |
| Lecturer responds to expert question | `notify_question_answered` | `question_answered` | Asking learner |
| PA/Lecturer resolves an issue | `notify_issue_resolved` | `issue_resolved` | Reporter |
| Learner asks expert question | `notify_new_expert_question` | `new_expert_question` | Lecturer + CSM |
| Learner reports issue | `notify_new_issue` | `new_issue` | Lecturer + CSM + PA |

### Resetting Between Test Runs

```sql
-- Delete all notifications for a specific user
DELETE FROM notifications
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');

-- Delete all test notifications
DELETE FROM notifications
WHERE user_id IN (
  SELECT id FROM profiles WHERE email IN (
    'learner@calypso-commodities.com',
    'lecturer-edit@calypso-commodities.com',
    'et@calypso-commodities.com',
    'csm@calypso-commodities.com'
  )
);

-- Reset expert questions to re-test trigger (revert answered → pending)
UPDATE expert_questions
SET response_text = NULL, responded_by = NULL, responded_at = NULL, status = 'pending'
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');

-- Reset issues to re-test trigger (revert resolved → open)
UPDATE issues SET status = 'open', resolved_by = NULL, resolved_at = NULL
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-14 | Claude (Playwright MCP) | NT-01 to NT-10, NT-12 | 11 | 0 | NT-11 skipped (Supabase auth uses localStorage — two users can't coexist in one browser context). NT-12 fully verified (all 4 roles: learner, lecturer, PA, CSM). NT-03 verified on sign-out. NT-09 used lecturer instead of PA to resolve issue. 0 bugs found. |
| 2026-02-15 | Claude Opus 4.6 (Playwright MCP) | NT-01 through NT-12 (Phase 10C regression) | 11 | 0 | Post-10C regression. Learner: 16 notifications, 4 unread, bell badge "4", Mark all as read visible, multiple types (new_module, issue_resolved, question_answered, course_assigned, exam_graded, exam_reset). PA: 50 notifications (all read after previous mark-all-as-read), no bell badge, multiple types (access_requests, issues, course_assigned). visibleCount signal works (50 shown, no "Load more" since DB limit is 50). NT-11 still ⏳ (requires 2 browser instances). No regressions from Load more / visibleCount changes. |

---

## References

| Document | Path |
|----------|------|
| NotificationListPageComponent | `frontend/src/app/features/notifications/pages/notification-list-page.component.ts` |
| NotificationService | `frontend/src/app/core/services/notification.service.ts` |
| Notification Model | `frontend/src/app/core/models/notification.model.ts` |
| Header (bell badge) | `frontend/src/app/layout/header/header.component.ts` |
| Main Layout (toast) | `frontend/src/app/layout/main-layout/main-layout.component.ts` |
| Migration 00033 (Realtime) | `supabase/migrations/00033_notifications_realtime.sql` |
| Notification triggers | `supabase/migrations/00009_auth_hardening.sql` (lines 369-766, 1028-1061) |
| RLS Policies (notifications) | `supabase/migrations/00004_rls_policies.sql` |
| Sidebar config | `frontend/src/app/layout/sidebar/sidebar-nav.config.ts` |
| Mock Factories | `frontend/src/app/__mocks__/course.mock.ts` |
| Test Users Setup | `docs/e2e-user-stories/TEST_USERS.md` |
| Questions Board Stories | `docs/e2e-user-stories/QUESTIONS_BOARD_USER_STORIES.md` |
| Issue Management Stories | `docs/e2e-user-stories/ISSUE_MANAGEMENT_USER_STORIES.md` |
