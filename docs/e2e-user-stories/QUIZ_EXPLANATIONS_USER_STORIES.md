> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Per-Question Explanations E2E User Stories (Phase 12C)

## Overview

E2E testing scenarios for the "Per-Question Explanations" feature (Phase 12C). This feature adds an optional explanation text field to quiz questions that lecturers can fill in via the quiz builder and learners see after submitting a quiz attempt.

**What changed:**
- **Quiz builder** — "Explanation (optional)" textarea with Lightbulb icon below each question's options/answer section, separated by a thin border
- **Quiz results** — amber card (`bg-amber-50`) with Lightbulb icon showing the explanation text, rendered after the option list for each question
- **`get_quiz_results` RPC** — returns `explanation` when `show_correct_answers = true`, returns `NULL` when `false` (same gating as `correct_answer`)
- **JSON import/export** — `explanation` field parsed as optional string, included in template

**Key components:**
- `QuizFormComponent` — explanation textarea per question, wired into form data model
- `QuizResultItemComponent` — `@if (result().explanation)` amber display block with `Lightbulb` icon
- `CourseService` — `#insertQuizQuestions` includes `explanation`, `#fetchModuleContent` SELECTs it, `#contentToFormData` maps it
- `get_quiz_results(p_attempt_id)` — SECURITY DEFINER RPC, conditionally returns explanation based on `show_correct_answers`

**Storage:** `quiz_questions.explanation` (TEXT, nullable) — added in migration 00042.

**Why these E2E tests matter:** Unit tests mock the Supabase client. These E2E tests validate: (1) the full lecturer→DB→learner pipeline (explanation saved in builder → persisted → returned by RPC → displayed in results), (2) the actual `get_quiz_results` RPC conditional logic with real PostgreSQL execution (not mocked), and (3) quiz builder edit round-trip (save → reopen → explanation still there).

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | http://localhost:4200 |
| **Backend URL** | http://localhost:8000 |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Primary Test Users** | Platform Admin + Learner (see below) |
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
| 1 | `et@calypso-commodities.com` | **Platform Admin** (can edit courses) | Calypso (master) | QE-01 |
| 2 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | QE-02, QE-03 |

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
| 1 | QE-01 | Lecturer Adds Explanation in Quiz Builder | PA/Lecturer has edit access to a course with a quiz module |
| 2 | QE-02 | Learner Sees Explanation After Quiz Submission | QE-01 (explanation must exist on the quiz question) |
| 3 | QE-03 | Explanation Hidden When show_correct_answers=false | Independent (uses a different quiz, or same quiz with setting changed) |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| QE-01 | Lecturer Adds Explanation in Quiz Builder | Platform Admin | ✅ | 2026-02-17 |
| QE-02 | Learner Sees Explanation After Quiz Submission | Learner | ✅ | 2026-02-17 |
| QE-03 | Explanation Hidden When show_correct_answers=false | Learner | ✅ | 2026-02-17 |

---

## Preconditions (All Stories)

- All test user accounts exist and can log in (see [TEST_USERS.md](TEST_USERS.md))
- At least 1 course exists with a quiz module that has questions
- Platform Admin has edit access to the course (via `is_platform_admin` or `lecturer_can_edit_course_ids`)
- Learner is enrolled in the course containing the quiz

**Verify quiz exists with questions:**

```sql
SELECT q.id AS quiz_id, q.title, m.id AS module_id, m.title AS module_title,
       c.id AS course_id, c.title AS course_title,
       q.show_correct_answers,
       (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count,
       (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id AND qq.explanation IS NOT NULL) AS questions_with_explanation
FROM quizzes q
JOIN modules m ON m.id = q.module_id
JOIN lectures l ON l.id = m.lecture_id
JOIN courses c ON c.id = l.course_id
ORDER BY c.title, l.sort_order, m.sort_order;
```

**Verify learner enrollment:**

```sql
SELECT c.id, c.title, ce.created_at AS enrolled_at
FROM course_enrollments ce
JOIN courses c ON c.id = ce.course_id
WHERE ce.user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
ORDER BY ce.created_at DESC;
```

---

## QE-01: Lecturer Adds Explanation in Quiz Builder

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the full quiz builder round-trip for explanations: Platform Admin opens a quiz module for editing → finds the "Explanation (optional)" textarea below a question → types an explanation → saves → reopens the quiz for editing → explanation text is persisted. This validates the INSERT pipeline (`#insertQuizQuestions` includes `explanation`), the SELECT pipeline (`#fetchModuleContent` + `#contentToFormData`), and the UI rendering in the builder.

**Covers**: `QuizFormComponent` (Lightbulb icon + label + textarea), `CourseService.#insertQuizQuestions` (explanation in INSERT), `CourseService.#fetchModuleContent` (explanation in SELECT), `CourseService.#contentToFormData` (explanation mapping), `quiz_questions.explanation` column

### Preconditions
- Logged in as Platform Admin (`et@calypso-commodities.com`)
- At least 1 course with a quiz module exists

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) | Dashboard loads at `/dashboard` | ✅ |
| 2 | Navigate to a course that has a quiz module (e.g., "Introduction to Commodity Trading") | Course detail page loads with lectures and modules listed | ✅ |
| 3 | Click the edit (pencil) icon on a quiz module | Quiz builder form loads with existing questions visible | ✅ |
| 4 | Scroll to the first question | Question card visible with Q1 label, type selector, question text, and options/answer | ✅ |
| 5 | Below the options section, find "Explanation (optional)" label with Lightbulb icon | Label rendered with amber Lightbulb icon (`text-amber-500`), textarea with placeholder "Explain why the correct answer is correct..." | ✅ |
| 6 | Type a distinctive explanation text: "This is the correct answer because it demonstrates the fundamental principle of commodity pricing." | Text appears in the textarea | ✅ |
| 7 | Click "Save Changes" | Module saves successfully (redirects or shows success indicator) | ✅ |
| 8 | Navigate back to the same quiz module and click edit again | Quiz builder reloads with existing data | ✅ |
| 9 | Scroll to the same question | Question card visible with all previous data | ✅ |
| 10 | Verify the explanation textarea contains the saved text | Textarea shows: "This is the correct answer because it demonstrates the fundamental principle of commodity pricing." | ✅ |

### SQL Verification
```sql
-- Verify explanation was saved to the database
SELECT qq.id, qq.question_text, qq.explanation, qq.question_type
FROM quiz_questions qq
WHERE qq.explanation IS NOT NULL
ORDER BY qq.quiz_id, qq.sort_order;
```

### Notes / Learnings
- The explanation field is optional — leaving it empty saves `NULL` in the database
- The quiz builder deletes all questions and re-inserts on save (not an UPDATE per question) — so explanation must be included in the INSERT payload
- The textarea uses `[(ngModel)]` binding (not signal-based like module notes) because the quiz builder uses mutable array state, not signals
- The Lightbulb icon is `text-amber-500` (14px in builder, 16px in results)

---

## QE-02: Learner Sees Explanation After Quiz Submission

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the core UX payoff of the feature: a learner takes a quiz, submits it, and sees the explanation text displayed in an amber card below each question's result. This tests the full pipeline from DB → `get_quiz_results` RPC (SECURITY DEFINER) → frontend `QuizQuestionResult.explanation` → `QuizResultItemComponent` rendering. This is the story that validates the feature works end-to-end with real RLS and RPC execution.

**Covers**: `get_quiz_results(p_attempt_id)` RPC (explanation in return type, `show_correct_answers=true` branch), `QuizResultItemComponent` (amber card with Lightbulb icon), `CourseService.submitQuizAttempt()` (maps explanation from RPC response), `QuizQuestionResult.explanation` type

### Preconditions
- Logged in as Learner (`learner@calypso-commodities.com`)
- QE-01 completed (at least one quiz question has an explanation in the DB)
- The quiz has `show_correct_answers = true`
- The quiz allows attempts (not maxed out — check `max_attempts`)

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | Log in as Learner (`learner@calypso-commodities.com`) | Dashboard loads at `/dashboard` | ✅ |
| 2 | Navigate to the course containing the quiz with explanations | Course detail page loads | ✅ |
| 3 | Click on the quiz module to open it | Quiz taker component loads with "Start Quiz" or attempt history | ✅ |
| 4 | Start a new quiz attempt (click "Start Quiz" or "Retake Quiz") | Quiz enters active phase — questions displayed with answer inputs | ✅ |
| 5 | Answer at least the question that has an explanation (select any option) | Answer registered (question count updates) | ✅ |
| 6 | Click "Submit Quiz" and confirm | Results phase loads — grade card with score percentage, passed/failed status | ✅ |
| 7 | Scroll to the "Question Results" section | Individual question result cards visible (emerald/rose borders based on correctness) | ✅ |
| 8 | Find the question that has an explanation | Question card with number badge, user answer, correct answer (if shown), and option list | ✅ |
| 9 | Below the option list, verify the explanation card | Amber card (`bg-amber-50 border-amber-200 rounded-lg`) with Lightbulb icon (`text-amber-500`) and explanation text in `text-slate-700` | ✅ |
| 10 | Verify the explanation text matches what was set in QE-01 | Text reads: "This is the correct answer because it demonstrates the fundamental principle of commodity pricing." | ✅ |
| 11 | Verify questions WITHOUT explanations do NOT show the amber card | Other question results have no `.bg-amber-50` element | ✅ |

### SQL Verification
```sql
-- Verify the attempt exists and was submitted
SELECT qa.id, qa.quiz_id, qa.attempt_number, qa.submitted_at, qa.score, qa.passed
FROM quiz_attempts qa
WHERE qa.user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
ORDER BY qa.submitted_at DESC
LIMIT 3;

-- Verify get_quiz_results returns explanation (run as the learner via RPC)
-- This can't be run directly from SQL — it uses auth.uid(), so verify via the frontend response
```

### Notes / Learnings
- The `get_quiz_results` RPC is SECURITY DEFINER — it runs as postgres, not the learner. It checks `auth.uid()` to verify the attempt belongs to the caller.
- Explanation is only returned when `show_correct_answers = true`. The quiz used in this test MUST have that setting enabled.
- The amber card uses `@if (result().explanation)` — falsy check means empty strings won't render either.
- If the learner has maxed out attempts, they can still "View" past results — explanations should appear there too.

---

## QE-03: Explanation Hidden When show_correct_answers=false

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the security boundary: when a quiz has `show_correct_answers = false`, the `get_quiz_results` RPC returns `NULL` for the explanation field (same as `correct_answer` and `is_correct`). This ensures lecturers who disable answer revealing also hide explanations — preventing learners from deducing correct answers from the explanation text. This tests the actual PostgreSQL RPC branch, not just frontend conditional rendering.

**Covers**: `get_quiz_results(p_attempt_id)` RPC (`show_correct_answers=false` branch → `NULL::text AS explanation`), `QuizResultItemComponent` (`@if (result().explanation)` evaluates to false), `quizzes.show_correct_answers` setting

### Preconditions
- Logged in as Learner (`learner@calypso-commodities.com`)
- A quiz exists with `show_correct_answers = false` AND at least one question has a non-null `explanation` in the database
- If no such quiz exists, the Platform Admin must first: (a) set `show_correct_answers = false` on a quiz, and (b) ensure a question has an explanation set

### Steps

| # | Action | Expected Result | ✓ |
|---|--------|-----------------|---|
| 1 | **(Setup — if needed)** Log in as Platform Admin, navigate to the quiz, toggle `show_correct_answers` OFF, save | Quiz saved with `show_correct_answers = false` | ✅ |
| 2 | Log in as Learner (`learner@calypso-commodities.com`) | Dashboard loads | ✅ |
| 3 | Navigate to the quiz module with `show_correct_answers = false` | Quiz taker loads | ✅ |
| 4 | Start and submit a quiz attempt (answer at least one question) | Results phase loads — grade card shows score | ✅ |
| 5 | Scroll to "Question Results" section | Question result cards visible | ✅ |
| 6 | Verify NO "Correct answer:" label is shown on any question | Correct answers are hidden (the `correct_answer` field is NULL from the RPC) | ✅ |
| 7 | Verify NO amber explanation cards (`.bg-amber-50`) appear anywhere in results | Zero elements with `bg-amber-50` class — explanations are NULL from the RPC | ✅ |
| 8 | Verify option list does NOT show green/red correctness indicators | Options have neutral styling (no `bg-emerald-50` or `bg-rose-50` — `is_correct` is NULL) | ✅ |
| 9 | **(Cleanup — if setup was done)** Log back in as Platform Admin, toggle `show_correct_answers` back ON, save | Quiz restored to original state | ✅ |

### SQL Verification
```sql
-- Verify the quiz's show_correct_answers setting
SELECT q.id, q.title, q.show_correct_answers,
       (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id AND qq.explanation IS NOT NULL) AS questions_with_explanation
FROM quizzes q
JOIN modules m ON m.id = q.module_id
JOIN lectures l ON l.id = m.lecture_id
JOIN courses c ON c.id = l.course_id
ORDER BY c.title;
```

### Notes / Learnings
- The `get_quiz_results` RPC has two branches: `IF NOT _quiz.show_correct_answers THEN` returns `NULL::text AS explanation` (along with NULL correct_answer and NULL is_correct). The `ELSE` branch returns `qq.explanation`.
- This is a security measure — if explanations reference or reveal correct answers (e.g., "The answer is Paris because..."), hiding them when correct answers are hidden prevents information leakage.
- The frontend check `@if (result().explanation)` handles this correctly: NULL from the RPC → signal holds null → `@if` evaluates to false → no amber card rendered.
- If the quiz has no questions with explanations AND show_correct_answers=false, the test still passes — just verify no amber cards appear.

---

## Data Setup Notes

### Finding a quiz with questions for testing

```sql
-- List all quizzes with their course, question count, and show_correct_answers setting
SELECT c.title AS course, q.title AS quiz, q.show_correct_answers,
       m.id AS module_id, q.max_attempts,
       COUNT(qq.id) AS questions
FROM quizzes q
JOIN modules m ON m.id = q.module_id
JOIN lectures l ON l.id = m.lecture_id
JOIN courses c ON c.id = l.course_id
LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
GROUP BY c.title, q.title, q.show_correct_answers, m.id, q.max_attempts
ORDER BY c.title;
```

### Adding explanation to a question directly (if QE-01 can't be run first)

```sql
-- Set explanation on the first question of a specific quiz
UPDATE quiz_questions
SET explanation = 'This is the correct answer because it demonstrates the fundamental principle of commodity pricing.'
WHERE quiz_id = (SELECT id FROM quizzes LIMIT 1)
  AND sort_order = 0;
```

---

## Test Execution Log

| Date | Tester | Stories Run | Result |
|------|--------|-------------|--------|
| 2026-02-17 | Claude Opus 4.6 (Playwright MCP) | QE-01, QE-02, QE-03 | All 3 PASS |

### 2026-02-17 — Full Regression (Playwright MCP)
- **Tester:** Claude Opus 4.6 (Playwright MCP)
- **Scope:** Full re-test of all stories
- **Result:** All stories pass ✅
- **Bugs found:** None

## Bugs Found

| ID | Story | Description | Severity | Status |
|----|-------|-------------|----------|--------|
| — | — | — | — | — |

## References

- **Migration:** `supabase/migrations/00042_quiz_question_explanations.sql`
- **Quiz builder:** `frontend/src/app/features/courses/components/quiz-form.component.ts`
- **Quiz result item:** `frontend/src/app/features/courses/components/quiz-result-item.component.ts`
- **Quiz taker:** `frontend/src/app/features/courses/components/quiz-taker.component.ts`
- **Models:** `QuizQuestionFormData`, `QuizQuestionResult`, `QuizContent` in `course.model.ts`
- **RPC function:** `get_quiz_results(p_attempt_id)` — SECURITY DEFINER, returns `explanation text`
- **Phase spec:** `docs/x_courses_development_approach.md` § Phase 12C
