# X-Courses v2 — Questions Board E2E User Stories (Phase 6C)

## Overview

E2E testing scenarios for the Questions Board page at `/teaching/questions` (Phase 6C). These stories verify the lecturer/admin workflow for managing expert questions: navigating to the board, viewing questions table with summary stats, filtering by search/course/status, expanding a row to respond, submitting and updating responses, closing questions, notification triggers (`notify_question_answered`), learner-side verification after response, and role-based access control.

**Frontend-only phase** — no DB migrations needed. All RLS policies (8 on `expert_questions`), triggers (`notify_question_answered`, `notify_new_expert_question`), and the `expert_questions` table were created in migrations 00004-00009.

**Cross-references:**
- Phase 6B (Ask Expert — Learner Side) created the learner question-asking UI — `ASK_EXPERT_USER_STORIES.md` (if exists)
- `ExpertQuestionService` is extended (not separate) — board signals + methods added to the existing service
- Route guarded by `roleGuard('lecturer', 'platform_admin')` — learners/TA/CSM are blocked
- Follows the same pattern as `ExamGradingPageComponent`

**Key DB triggers tested:**
- `notify_question_answered()` — fires when `response_text` changes from NULL to non-NULL (first response only)
- `notify_new_expert_question()` — fires on INSERT into `expert_questions` (notifies lecturers/admins)

**Key RLS policies:**
- `expert_questions_select_lecturer` — lecturer sees questions on assigned courses (cross-tenant)
- `expert_questions_select_platform_admin` — PA sees all questions
- `expert_questions_update_lecturer` — lecturer can update questions on assigned courses
- `expert_questions_update_platform_admin` — PA can update any question

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Primary Test User** | lecturer-edit@calypso-commodities.com (Lecturer, can_edit + can_grade) |
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
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | QB-02, QB-09, QB-12 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit, can_grade)** | Calypso (master) | QB-01, QB-03, QB-04, QB-05, QB-06, QB-07, QB-08, QB-10, QB-11 |
| 3 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | QB-07 (verification), QB-08, QB-12 |
| 4 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | QB-12 |

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
| 1 | QB-01 | Navigation + Page Load | Lecturer logged in, at least one expert question exists |
| 2 | QB-02 | Platform Admin Sees All Questions | PA logged in, questions from multiple courses |
| 3 | QB-03 | Filter by Search | QB-01 (page loads with data) |
| 4 | QB-04 | Filter by Course + Status | QB-01 (multiple questions exist) |
| 5 | QB-05 | Summary Stats | QB-01 (questions in various statuses) |
| 6 | QB-06 | Respond to Pending Question | QB-01 (pending question exists) |
| 7 | QB-07 | Learner Sees Response + Notification | QB-06 (response just submitted) |
| 8 | QB-08 | Update Existing Response | QB-06 (answered question exists) |
| 9 | QB-09 | Close Question | QB-06 or QB-08 (answered question exists) |
| 10 | QB-10 | Closed Question Read-Only | QB-09 (closed question exists) |
| 11 | QB-11 | Clear Filters | QB-01 (page loads with data) |
| 12 | QB-12 | Role Access Control | Multiple role logins |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| QB-01 | Navigation + Page Load | Lecturer | ✅ | 2026-02-13 |
| QB-02 | Platform Admin Sees All Questions | Platform Admin | ✅ | 2026-02-13 |
| QB-03 | Filter by Search | Lecturer | ✅ | 2026-02-13 |
| QB-04 | Filter by Course + Status | Lecturer | ✅ | 2026-02-13 |
| QB-05 | Summary Stats | Lecturer | ✅ | 2026-02-13 |
| QB-06 | Respond to Pending Question | Lecturer | ✅ | 2026-02-13 |
| QB-07 | Learner Sees Response + Notification | Lecturer + Learner | ✅ | 2026-02-13 |
| QB-08 | Update Existing Response | Lecturer | ✅ | 2026-02-13 |
| QB-09 | Close Question | Lecturer | ✅ | 2026-02-13 |
| QB-10 | Closed Question Read-Only | Lecturer | ✅ | 2026-02-13 |
| QB-11 | Clear Filters | Lecturer | ✅ | 2026-02-13 |
| QB-12 | Role Access Control | Multiple | ✅ | 2026-02-13 |

---

## Preconditions (All Stories)

- At least one course with modules exists and is assigned to learner's tenant via `tenant_courses`
- Learner is enrolled in the course
- Learner has asked at least one expert question (from Phase 6B or created via SQL)
- Lecturer has `lecturer_course_assignments` row for the course (used by RLS to scope questions)

**Ensure expert questions exist** (if not from Phase 6B testing):

1. Login as `learner@calypso-commodities.com`
2. Navigate to a course → module viewer
3. Click "Ask an Expert" button between files and comments
4. Type a question and submit
5. Repeat for different modules/courses if needed for filter testing

**Alternate: Create test questions via SQL**:
```sql
-- Get IDs needed
SELECT id, email FROM profiles WHERE email IN (
  'learner@calypso-commodities.com',
  'lecturer-edit@calypso-commodities.com'
);

SELECT c.id as course_id, c.title, m.id as module_id, m.title as module_title
FROM courses c
JOIN modules m ON m.course_id = c.id
LIMIT 5;

SELECT id FROM tenants WHERE domain = 'calypso-commodities.com';

-- Insert test questions (use actual UUIDs from above queries)
INSERT INTO expert_questions (user_id, tenant_id, course_id, module_id, question_text, status)
VALUES
  ('<LEARNER_ID>', '<TENANT_ID>', '<COURSE_1_ID>', '<MODULE_1_ID>', 'How does the LNG pricing formula work in practice?', 'pending'),
  ('<LEARNER_ID>', '<TENANT_ID>', '<COURSE_1_ID>', '<MODULE_2_ID>', 'Can you explain the hedging strategy in more detail?', 'pending'),
  ('<LEARNER_ID>', '<TENANT_ID>', '<COURSE_2_ID>', NULL, 'General question about course prerequisites', 'pending');
```

**Cleanup SQL** (run before testing to ensure clean state):
```sql
-- Check existing expert questions
SELECT eq.id, eq.user_id, p.email as asker_email, eq.course_id, c.title as course,
       eq.module_id, eq.question_text, eq.status, eq.response_text, eq.created_at
FROM expert_questions eq
JOIN profiles p ON p.id = eq.user_id
JOIN courses c ON c.id = eq.course_id
ORDER BY eq.created_at DESC;

-- Reset a specific question to pending (revert answered/closed)
UPDATE expert_questions
SET response_text = NULL, responded_by = NULL, responded_at = NULL, status = 'pending'
WHERE id = '<QUESTION_ID>';

-- Delete question_answered notifications (to re-test trigger)
DELETE FROM notifications WHERE type = 'question_answered';
```

---

## QB-01: Navigation + Page Load

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that a lecturer can see "Questions Board" in the sidebar Teaching section, navigate to `/teaching/questions`, and see the questions table with summary cards.

**Covers**: Sidebar config (`roles: ['lecturer', 'platform_admin']`), route `teaching/questions` with `roleGuard`, `ExpertQuestionService.loadBoardQuestions()`, asker profile join, course/module join

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `lecturer-edit@calypso-commodities.com` | Successful login, main layout visible |
| 2 | Look at sidebar | "Teaching" section visible with "Questions Board" item (MessageSquare icon) |
| 3 | Click "Questions Board" in sidebar | Navigates to `/teaching/questions` |
| 4 | Wait for page to load | "Questions Board" header visible with MessageSquare icon |
| 5 | Verify pending badge in header | If pending questions exist, amber badge shows "N pending" next to title |
| 6 | Verify filter bar | Search input ("Search by learner or question..."), course dropdown ("All Courses"), status dropdown ("All Status") visible |
| 7 | Verify summary cards | 4 cards: "Total", "Pending" (amber), "Answered" (emerald), "Closed" (slate) with numeric values |
| 8 | Verify questions table | Table headers: Learner, Course, Module, Question, Asked, Status |
| 9 | Verify at least one question row | Learner email (+ name below), course title, module title (or dash), truncated question text, relative time, status badge |

### SQL Verification
```sql
-- Verify lecturer assignment
SELECT lca.course_id, c.title, lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN courses c ON c.id = lca.course_id
WHERE lca.user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com');

-- Verify questions exist for those courses
SELECT eq.id, p.email, c.title, eq.status, eq.question_text
FROM expert_questions eq
JOIN profiles p ON p.id = eq.user_id
JOIN courses c ON c.id = eq.course_id
WHERE eq.course_id IN (
  SELECT course_id FROM lecturer_course_assignments
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
)
ORDER BY eq.created_at DESC;
```

### Notes / Learnings
- RLS automatically scopes: lecturer sees questions only for assigned courses (cross-tenant)
- Courses dropdown is derived from question data (Map dedup + alphabetical sort)
- `asker:profiles!user_id(full_name, email)` — uses FK disambiguation because `expert_questions` has two FK refs to `profiles` (user_id + responded_by)
- Null-safe asker display: if `profiles` join returns null (RLS gap), shows "[Unknown]" (CM-BUG-01 pattern)

---

## QB-02: Platform Admin Sees All Questions

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that Platform Admin sees ALL expert questions across all courses and tenants (no RLS scoping limitation).

**Covers**: PA RLS policies on `expert_questions`, cross-course visibility, sidebar Teaching section visible for PA

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `et@calypso-commodities.com` (Platform Admin) | Successful login |
| 2 | Verify sidebar | "Teaching" section visible with "Questions Board" |
| 3 | Click "Questions Board" | Page loads at `/teaching/questions` |
| 4 | Verify question count | Total count matches all questions in DB (across all courses/tenants) |
| 5 | Verify course dropdown | Shows all courses that have questions (may be more than lecturer sees) |

### SQL Verification
```sql
-- Count all questions (PA should see this many)
SELECT COUNT(*) FROM expert_questions;

-- Compare with lecturer's scoped view
SELECT COUNT(*) FROM expert_questions
WHERE course_id IN (
  SELECT course_id FROM lecturer_course_assignments
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
);
```

### Notes / Learnings
- If PA count equals lecturer count, that's expected when all questions happen to be in lecturer's assigned courses
- `expert_questions_select_platform_admin`: `USING (is_platform_admin = 'true')` — unconditional
- PA can also respond and close questions via `expert_questions_update_platform_admin`

---

## QB-03: Filter by Search

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that the search filter correctly filters questions by learner email, learner name, or question text.

**Covers**: `searchTerm` signal, `filteredQuestions` computed — email/name/question text matching (case-insensitive)

### Preconditions
- At least 2 questions from different learners (or with distinct question text)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/questions` | Page loads with multiple questions |
| 2 | Note the total question count | e.g., "Total: 3" in summary card |
| 3 | Type a learner's email (partial) into search, e.g., "learner" | Table filters to rows where learner email contains "learner" |
| 4 | Verify summary cards update | Total/Pending/Answered/Closed counts reflect filtered rows |
| 5 | Clear the search, type a question keyword, e.g., "pricing" | Filters by question text match |
| 6 | Clear the search, type a learner name, e.g., "Bob" | Filters by learner full_name match |
| 7 | Click "Clear filters" link | All questions visible again, original count restored |

### Notes / Learnings
- Search is case-insensitive (`.toLowerCase()` applied to both search term and field values)
- "Clear filters" link only appears when at least one filter is active (search term OR course OR status != all)
- Search checks three fields: `asker.email`, `asker.full_name`, `question_text`

---

## QB-04: Filter by Course + Status

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that course dropdown and status dropdown correctly filter questions, and that filters can be combined.

**Covers**: `selectedCourseId` signal, `statusFilter` signal, filter combination (AND logic)

### Preconditions
- At least 2 different courses with expert questions
- At least one pending + one answered question

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/questions` | Multiple questions from different courses visible |
| 2 | Select a specific course from the dropdown | Only questions for that course shown; summary cards update |
| 3 | Additionally select "Pending" from status dropdown | Only pending questions for the selected course shown |
| 4 | Change status to "Answered" | Only answered questions for the selected course shown |
| 5 | Change status to "Closed" | Only closed questions for the selected course shown (or empty state if none) |
| 6 | Change status back to "All Status" | Shows all questions for the selected course |
| 7 | Select "All Courses" | All questions visible again |
| 8 | Click "Clear filters" | All filters reset to defaults |

### Notes / Learnings
- Course dropdown options are derived from question data (only courses that have at least one question appear)
- Multiple filters combine with AND logic
- Empty state shows "No questions found." with HelpCircle icon when all questions are filtered out

---

## QB-05: Summary Stats

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that summary stat cards are accurate and reflect the current filter state. Cards should show correct counts for Total, Pending, Answered, and Closed.

**Covers**: `totalQuestions`, `pendingCount`, `answeredCount`, `closedCount` computed signals, stat card rendering

### Preconditions
- Multiple questions in various statuses: at least 1 pending, 1 answered, 1 closed

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/questions` | Page loads with multiple questions |
| 2 | Count question rows manually | Matches "Total" card value |
| 3 | Count rows with amber "Pending" badge | Matches "Pending" card value (amber text) |
| 4 | Count rows with emerald "Answered" badge | Matches "Answered" card value (emerald text) |
| 5 | Count rows with slate "Closed" badge | Matches "Closed" card value (slate text) |
| 6 | Apply a filter (e.g., course dropdown) | All 4 summary cards recalculate for filtered data |
| 7 | Verify badge icons | Pending: Clock icon (amber), Answered: CheckCircle2 icon (emerald), Closed: XCircle icon (slate) |

### SQL Verification
```sql
-- Calculate expected stats for lecturer
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'answered') as answered,
  COUNT(*) FILTER (WHERE status = 'closed') as closed
FROM expert_questions
WHERE course_id IN (
  SELECT course_id FROM lecturer_course_assignments
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
);
```

### Notes / Learnings
- Summary cards use `tabular-nums` font class for consistent number width
- All counts derive from `filteredQuestions()` — applying any filter recalculates all 4 cards
- Pending count also appears as a badge in the page header ("N pending")

---

## QB-06: Respond to Pending Question

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify the full response workflow: expand a pending question row, enter a response, submit, verify UI updates. This is the core interaction of the Questions Board.

**Covers**: `onExpandQuestion()`, `onRespondToQuestion()`, `ExpertQuestionService.respondToQuestion()`, `notify_question_answered()` trigger, data reload

### Preconditions
- At least one question with `status = 'pending'` exists

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/questions` | Pending question visible with amber "Pending" badge |
| 2 | Click on the pending question row | Row expands below to show: full question text (whitespace-pre-wrap), response textarea, "Submit Response" button (Send icon) |
| 3 | Verify textarea placeholder | "Type your response..." |
| 4 | Verify Submit button is disabled | Button dimmed (`disabled:opacity-50`) because textarea is empty |
| 5 | Type: "The LNG pricing formula uses market benchmarks..." | Textarea accepts input, Submit button becomes enabled |
| 6 | Click "Submit Response" | Spinner (Loader2 animate-spin) shown on button, row collapses, data reloads |
| 7 | Verify the question row updated | Badge changed from "Pending" (amber) to "Answered" (emerald with CheckCircle2 icon) |
| 8 | Verify summary cards updated | Pending count decreased by 1, Answered count increased by 1 |
| 9 | Click on the now-answered row to expand | Response textarea is pre-filled with the submitted text, button says "Update Response", "Close Question" button visible |

### SQL Verification
```sql
-- Verify response was saved
SELECT id, response_text, responded_by, responded_at, status
FROM expert_questions WHERE id = '<QUESTION_ID>';
-- response_text should be the typed text
-- responded_by should be the lecturer's user ID
-- responded_at should be set
-- status should be 'answered'

-- Verify notification was created for the learner
SELECT id, type, user_id, data
FROM notifications
WHERE type = 'question_answered'
AND user_id = (SELECT user_id FROM expert_questions WHERE id = '<QUESTION_ID>')
ORDER BY created_at DESC LIMIT 1;
```

### Notes / Learnings
- `notify_question_answered()` fires only when `response_text` transitions from NULL to non-NULL (first response only)
- `respondToQuestion()` sets 4 fields: `response_text`, `responded_by`, `responded_at`, `status='answered'`
- After responding, `loadBoardQuestions()` is called again to refresh all data
- The Cancel button collapses the expanded row without submitting
- `$event.stopPropagation()` is not needed on row click — the row itself is the click target

---

## QB-07: Learner Sees Response + Notification

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that after the lecturer responds to a question, the learner sees the response on their "My Questions" page and receives a notification via `notify_question_answered` trigger.

**Covers**: Learner-side `MyQuestionsPageComponent`, `ExpertQuestionService.loadMyQuestions()`, `notify_question_answered()` trigger, notification display

### Preconditions
- Lecturer has just responded to a pending question (from QB-06)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `learner@calypso-commodities.com` | Successful login |
| 2 | Check notifications (bell icon or `/notifications`) | `question_answered` notification visible ("Your question has been answered") |
| 3 | Navigate to "My Questions" (`/questions`) | My Questions page loads |
| 4 | Find the question that was just answered | Card shows "Answered" badge (emerald) |
| 5 | Expand the question card (click to toggle) | Response text visible: "The LNG pricing formula uses market benchmarks..." |
| 6 | Verify responder info | Responder name/email shown (if joined) |

### SQL Verification
```sql
-- Verify notification exists
SELECT id, type, user_id, data, read_at, created_at
FROM notifications
WHERE type = 'question_answered'
AND user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
ORDER BY created_at DESC LIMIT 1;

-- Verify question status from learner's perspective
SELECT eq.id, eq.status, eq.response_text, eq.responded_at,
       resp.full_name as responder_name
FROM expert_questions eq
LEFT JOIN profiles resp ON resp.id = eq.responded_by
WHERE eq.user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
AND eq.status = 'answered'
ORDER BY eq.created_at DESC LIMIT 1;
```

### Notes / Learnings
- `notify_question_answered` fires on first response only (NULL→non-NULL transition)
- The learner's "My Questions" page uses `loadMyQuestions()` which joins `responder:profiles!responded_by(full_name, email)`
- This is different from the board view which joins `asker:profiles!user_id(full_name, email)` — FK disambiguation
- If `profiles_select_tenant` policy is missing, responder join returns null (CM-BUG-01 pattern)

---

## QB-08: Update Existing Response

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that an already-answered question's response can be updated. Verify the form pre-fills with existing response text and button says "Update Response".

**Covers**: `onExpandQuestion()` pre-fill logic (`responseText.set(q.response_text ?? '')`), `respondToQuestion()` with existing response, no re-triggering of `notify_question_answered`

### Preconditions
- An answered question exists (from QB-06)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/questions` | Answered question visible with emerald badge |
| 2 | Click on the answered question row | Row expands with response textarea **pre-filled** with existing response text |
| 3 | Verify textarea placeholder | "Update your response..." (different from pending's "Type your response...") |
| 4 | Verify button text | Shows "Update Response" (not "Submit Response") |
| 5 | Verify "Close Question" button visible | Rose-styled danger button visible next to Update Response |
| 6 | Modify the response text to "Updated: The LNG pricing formula uses JKM benchmarks specifically." | Textarea content changes |
| 7 | Click "Update Response" | Spinner shown, row collapses, data reloads |
| 8 | Verify badge unchanged | Still shows "Answered" (emerald) — status didn't change |
| 9 | Expand row again | Response textarea shows updated text |

### SQL Verification
```sql
-- Verify updated response
SELECT response_text, responded_by, responded_at, status
FROM expert_questions WHERE id = '<QUESTION_ID>';
-- response_text should be updated
-- responded_at should be updated to new timestamp
-- status remains 'answered'

-- Verify NO new notification (update doesn't re-fire trigger)
SELECT COUNT(*)
FROM notifications
WHERE type = 'question_answered'
AND user_id = (SELECT user_id FROM expert_questions WHERE id = '<QUESTION_ID>')
AND created_at > NOW() - INTERVAL '1 minute';
-- Should be 0 (no new notification from response update)
```

### Notes / Learnings
- `notify_question_answered` trigger checks `OLD.response_text IS NULL AND NEW.response_text IS NOT NULL` — updating an existing response (non-NULL to non-NULL) does NOT re-trigger
- Pre-fill logic: `onExpandQuestion()` calls `responseText.set(q.response_text ?? '')` — always pre-fills for answered/closed
- `respondToQuestion()` re-sets `responded_by` and `responded_at` to current user/time on every update

---

## QB-09: Close Question

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that an answered question can be closed. Closing sets `status = 'closed'` and makes the question read-only.

**Covers**: `onCloseQuestion()`, `ExpertQuestionService.closeQuestion()`, status UPDATE, data reload

### Preconditions
- An answered question exists (from QB-06 or QB-08)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as Platform Admin (`et@calypso-commodities.com`), navigate to `/teaching/questions` | Answered question visible |
| 2 | Click on the answered question row | Row expands with response form, "Close Question" button visible |
| 3 | Click "Close Question" | Spinner shown briefly, row collapses, data reloads |
| 4 | Verify the question row updated | Badge changed from "Answered" (emerald) to "Closed" (slate with XCircle icon) |
| 5 | Verify summary cards updated | Answered count decreased by 1, Closed count increased by 1 |

### SQL Verification
```sql
-- Verify status changed to closed
SELECT id, status, response_text FROM expert_questions WHERE id = '<QUESTION_ID>';
-- status should be 'closed'
-- response_text should still contain the response (not cleared)
```

### Notes / Learnings
- `closeQuestion()` only updates `status = 'closed'` — does NOT clear `response_text`
- PA uses `expert_questions_update_platform_admin` policy
- No `notify_question_closed` trigger exists — learner is not notified on close (by design)
- Closing without responding first is not possible through the UI (Close button only appears in the "answered" state)

---

## QB-10: Closed Question Read-Only

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that expanding a closed question shows the response as read-only text (no textarea), with a "This question is closed" label.

**Covers**: Closed state rendering in expanded row (read-only), XCircle icon, no edit/update buttons

### Preconditions
- A closed question with a response exists (from QB-09)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/questions` | Closed question visible with slate "Closed" badge |
| 2 | Click on the closed question row | Row expands |
| 3 | Verify full question text visible | Question text displayed with `whitespace-pre-wrap` |
| 4 | Verify response displayed as plain text | Response text shown as `<p>` (NOT in a textarea) — read-only |
| 5 | Verify NO "Update Response" button | No submit/update buttons visible |
| 6 | Verify "This question is closed" label | Slate-colored text with XCircle icon at bottom of expanded section |

### Notes / Learnings
- The closed state uses a different template branch: plain `<p>` for response_text instead of `<textarea>`
- If `response_text` is null on a closed question (edge case — closed without ever answering via direct DB update), the response block is not shown
- The "This question is closed" label always appears for closed status

---

## QB-11: Clear Filters

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that "Clear filters" resets all active filters (search, course, status) back to defaults and restores the full question list.

**Covers**: `clearFilters()` method, filter state reset, "Clear filters" link visibility

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/questions` | All questions visible, no "Clear filters" link |
| 2 | Type "pricing" in search box | Table filters, "Clear filters" link appears |
| 3 | Select a course from dropdown | Table filters further |
| 4 | Select "Pending" from status dropdown | Table filters further (multiple filters applied) |
| 5 | Click "Clear filters" | Search box cleared, course dropdown resets to "All Courses", status resets to "All Status" |
| 6 | Verify all questions visible again | Total count matches pre-filter count |
| 7 | Verify "Clear filters" link is gone | Link hidden when no filters are active |

### Notes / Learnings
- "Clear filters" only appears when `searchTerm() || selectedCourseId() || statusFilter() !== 'all'`
- `clearFilters()` resets: `searchTerm.set('')`, `selectedCourseId.set(null)`, `statusFilter.set('all')`
- Filter state is all signal-based — no URL query params (same pattern as ExamGradingPage)

---

## QB-12: Role Access Control

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | — |

**Purpose**: Verify that only lecturers and platform admins can access `/teaching/questions`. Learners, Tenant Admins, and CSMs should be blocked by the route guard.

**Covers**: `roleGuard('lecturer', 'platform_admin')`, sidebar visibility per role

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `learner@calypso-commodities.com` | Successful login |
| 2 | Check sidebar | "Teaching" section NOT visible |
| 3 | Navigate directly to `/teaching/questions` | Redirected away (guard blocks access) |
| 4 | Logout, login as `csm@calypso-commodities.com` | Successful login |
| 5 | Check sidebar | "Teaching" section NOT visible (CSM not in `['lecturer', 'platform_admin']`) |
| 6 | Navigate directly to `/teaching/questions` | Redirected away |
| 7 | Logout, login as `et@calypso-commodities.com` (Platform Admin) | Successful login |
| 8 | Check sidebar | "Teaching" section visible with "Questions Board" (MessageSquare icon) |
| 9 | Navigate to `/teaching/questions` | Page loads successfully, all questions visible |
| 10 | Logout, login as `lecturer-edit@calypso-commodities.com` | Successful login |
| 11 | Check sidebar | "Teaching" section visible with "Questions Board" |
| 12 | Navigate to `/teaching/questions` | Page loads, only questions for assigned courses visible |

### Notes / Learnings
- Route guard checks JWT claims: `is_platform_admin` or `lecturer_course_ids` (non-empty)
- A lecturer without any course assignments would pass the route guard (they have role claims) but would see an empty table (RLS filters by course assignment)
- CSM is intentionally excluded — CSM has their own "Expert Questions" link at `/csm/questions` (stub page for now)
- Sidebar Teaching section shows for `['lecturer', 'platform_admin']` roles

---

## Data Setup Notes

### Creating Multiple Questions for Filter Testing

To test QB-03, QB-04, and QB-05 effectively, you need multiple questions across different courses and in different statuses.

**Option A: Use prior Phase 6B test data** — If learner asked questions during Phase 6B testing, they already exist.

**Option B: Create test questions via SQL** (for controlled test data):
```sql
-- Get learner's ID and tenant
SELECT id, tenant_id FROM profiles WHERE email = 'learner@calypso-commodities.com';

-- Get course/module IDs
SELECT c.id as course_id, c.title, m.id as module_id, m.title as module_title
FROM courses c
JOIN modules m ON m.course_id = c.id
ORDER BY c.title, m.order_index
LIMIT 10;

-- Insert questions in different statuses (replace UUIDs)
INSERT INTO expert_questions (user_id, tenant_id, course_id, module_id, question_text, status)
VALUES
  ('<LEARNER_ID>', '<TENANT_ID>', '<COURSE_1>', '<MOD_1>', 'How does the LNG pricing formula work?', 'pending'),
  ('<LEARNER_ID>', '<TENANT_ID>', '<COURSE_1>', '<MOD_2>', 'What are the hedging strategies?', 'pending');

-- Pre-answer one question
UPDATE expert_questions
SET response_text = 'The hedging strategy involves...',
    responded_by = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com'),
    responded_at = NOW(),
    status = 'answered'
WHERE question_text = 'What are the hedging strategies?';

-- Pre-close another (need to answer first, then close)
INSERT INTO expert_questions (user_id, tenant_id, course_id, module_id, question_text, status, response_text, responded_by, responded_at)
VALUES (
  '<LEARNER_ID>', '<TENANT_ID>', '<COURSE_2>', NULL,
  'Outdated question about prerequisites',
  'closed',
  'This has been resolved.',
  (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com'),
  NOW()
);
```

### Resetting Between Test Runs

```sql
-- Reset all questions to pending (revert all answers/closes)
UPDATE expert_questions
SET response_text = NULL, responded_by = NULL, responded_at = NULL, status = 'pending'
WHERE course_id IN (
  SELECT course_id FROM lecturer_course_assignments
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
);

-- Delete question-related notifications
DELETE FROM notifications
WHERE type IN ('question_answered', 'new_expert_question');

-- Nuclear option: delete all test questions
DELETE FROM expert_questions
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-13 | Claude (Playwright MCP) | QB-01 to QB-12 | 12 | 0 | 1 bug found+fixed (QB-BUG-01). Local dev (localhost:4200). Notification page stub — can't verify notification UI. |

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| QB-BUG-01 | QB-07 | Closed questions with `response_text` don't show the expert response on learner's My Questions page. Template had `@if (question.status === 'answered' && question.response_text)` — excluded closed status. Closed questions that were answered first fell through both conditionals. | Medium | Changed condition to `@if (question.response_text)` — show response for any status when response exists. Added unit test. File: `my-questions-page.component.ts:105` | Fixed |

---

## References

- [Comment E2E Stories (Phase 6A)](COMMENT_USER_STORIES.md) — same module viewer context
- [Exam Grading E2E Stories (Phase 5D)](EXAM_GRADING_USER_STORIES.md) — same board page pattern
- [Test Users](TEST_USERS.md) — full test user matrix
- `QuestionsBoardPageComponent`: `frontend/src/app/features/teaching/pages/questions-board-page.component.ts`
- `ExpertQuestionService`: `frontend/src/app/core/services/expert-question.service.ts`
- `ExpertQuestionForBoard` model: `frontend/src/app/core/models/expert-question.model.ts`
- Sidebar config: `frontend/src/app/layout/sidebar/sidebar-nav.config.ts`
- DB triggers: migrations `00004` (RLS), `00005`/`00009` (notification triggers)
- Route: `frontend/src/app/app.routes.ts` (lines 136-142)
